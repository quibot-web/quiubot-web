import { auth } from "@/auth";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { registrarError } from "@/lib/registrarError";
import { COOKIE_STATE_META } from "@/app/lib/metaErrors";

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Senal de riesgo mas fuerte de las tres: si una misma cuenta publicitaria
// de Meta (un negocio real) ya esta conectada a OTRO usuario de Quiubot,
// es casi seguro que se trate de una cuenta duplicada para abusar del plan
// gratis o del trial. No bloqueamos la conexion (el usuario igual puede
// usar su cuenta de Meta con normalidad) — solo se apaga el trial si lo
// tenia, y queda registrado para revision manual, igual que las otras
// senales (ver /api/registro-riesgo).
const RIESGO_META_REPETIDA = 6;

// El nonce de /api/meta/conectar es de un solo uso -- se borra en TODAS las
// salidas de este handler (exito o rechazo), nunca sobrevive a un intento.
function redirigirLimpiandoCookie(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: COOKIE_STATE_META, path: "/api/meta" });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (errorParam || !code || !state) {
    return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
  }

  // El "state" ya no trae el correo en texto plano -- es solo un nonce que
  // debe coincidir EXACTO con el que /api/meta/conectar guardo en una
  // cookie httpOnly al iniciar el flujo. Si no coincide, o no hay sesion
  // activa, se rechaza sin tocar la base de datos (antes bastaba con
  // armar cualquier "state" con el correo de otra persona).
  const cookieState = req.cookies.get(COOKIE_STATE_META)?.value;
  if (!cookieState || !compararSeguro(state, cookieState)) {
    return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
  }

  const session = await auth();
  if (!session?.user?.email) {
    return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
  }
  const email = session.user.email.trim().toLowerCase();

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  try {
    // 1. Intercambiar el "code" por un access token de corta duración
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri || "")}` +
        `&client_secret=${appSecret}` +
        `&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Error obteniendo token corto:", tokenData);

      registrarError({
        origen: "conectar_meta",
        email,
        paso: "intercambiar_code_por_token",
        errorMensaje: "Meta no devolvió un access_token al intercambiar el code",
        detalleTecnico: JSON.stringify(tokenData),
      });

      return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
    }

    // 2. Cambiar el token corto por uno de larga duración (60 dias)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${appId}` +
        `&client_secret=${appSecret}` +
        `&fb_exchange_token=${tokenData.access_token}`
    );
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || tokenData.access_token;
    const expiresIn = longTokenData.expires_in || tokenData.expires_in || 5184000; // 60 dias por defecto

    // 3. Obtener info basica del usuario y sus cuentas publicitarias
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
    const meData = await meRes.json();

    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,business&access_token=${accessToken}`
    );
    const adAccountsData = await adAccountsRes.json();
    const primeraCuenta = adAccountsData.data && adAccountsData.data[0] ? adAccountsData.data[0] : null;

    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const primeraPagina = pagesData.data && pagesData.data[0] ? pagesData.data[0] : null;

    const fechaExpira = new Date(Date.now() + expiresIn * 1000);

    // 3.5 — Deteccion de cuenta publicitaria repetida entre usuarios distintos.
    // Se hace ANTES de guardar, comparando contra lo que ya hay en la tabla.
    if (primeraCuenta) {
      const { data: otroUsuarioConEstaCuenta } = await supabaseAdmin
        .from("usuarios")
        .select("id, email")
        .eq("meta_ad_account_id", primeraCuenta.id)
        .neq("email", email)
        .maybeSingle();

      if (otroUsuarioConEstaCuenta) {
        const { data: usuarioActual } = await supabaseAdmin
          .from("usuarios")
          .select("id, en_trial")
          .eq("email", email)
          .maybeSingle();

        if (usuarioActual) {
          await supabaseAdmin.from("senales_registro").insert({
            usuario_id: usuarioActual.id,
            ip_hash: "meta-ad-account-repetida",
            dispositivo_id: null,
            riesgo: RIESGO_META_REPETIDA,
            marcado_sospechoso: true,
            detalle: `La cuenta publicitaria de Meta ${primeraCuenta.id} ya estaba conectada al usuario ${otroUsuarioConEstaCuenta.email}.`,
          });

          if (usuarioActual.en_trial) {
            await supabaseAdmin
              .from("usuarios")
              .update({ en_trial: false, plan: "arranque", trial_termina_en: null })
              .eq("id", usuarioActual.id);
          }
        }
      }
    }

    // 4. Guardar todo en Supabase (esto sigue pasando siempre — nunca se
    // le rompe la conexion de Meta a nadie, solo se apaga el trial si aplicaba).
    // meta_token_vencera_avisado vuelve a false: el token es nuevo, asi que
    // el aviso de "por vencer" (ver /api/cron/avisar-meta-por-vencer) debe
    // poder volver a dispararse para ESTE vencimiento, no quedar apagado
    // para siempre por un aviso de la conexion anterior.
    const { error } = await supabaseAdmin
      .from("usuarios")
      .update({
        meta_access_token: accessToken,
        meta_token_expira: fechaExpira.toISOString(),
        meta_ad_account_id: primeraCuenta ? primeraCuenta.id : null,
        meta_business_id: primeraCuenta && primeraCuenta.business ? primeraCuenta.business.id : null,
        meta_user_name: meData.name || null,
        meta_page_id: primeraPagina ? primeraPagina.id : null,
        meta_page_name: primeraPagina ? primeraPagina.name : null,
        meta_token_vencera_avisado: false,
      })
      .eq("email", email);

    if (error) {
      console.error("Error guardando token de Meta:", error);

      registrarError({
        origen: "conectar_meta",
        email,
        paso: "guardar_token_en_supabase",
        errorMensaje: "No se pudo guardar la conexión de Meta en la base de datos",
        detalleTecnico: JSON.stringify(error),
      });

      return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
    }

    return redirigirLimpiandoCookie(`${baseUrl}/?meta_conectado=1`);
  } catch (err) {
    console.error("Error en callback de Meta:", err);

    registrarError({
      origen: "conectar_meta",
      email,
      paso: "excepcion_general",
      errorMensaje: "Ocurrió un error inesperado conectando la cuenta de Meta",
      detalleTecnico: String(err),
    });

    return redirigirLimpiandoCookie(`${baseUrl}/?meta_error=1`);
  }
}
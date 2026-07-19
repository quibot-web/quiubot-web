import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Senal de riesgo mas fuerte de las tres: si una misma cuenta publicitaria
// de Meta (un negocio real) ya esta conectada a OTRO usuario de Quiubot,
// es casi seguro que se trate de una cuenta duplicada para abusar del plan
// gratis o del trial. No bloqueamos la conexion (el usuario igual puede
// usar su cuenta de Meta con normalidad) — solo se apaga el trial si lo
// tenia, y queda registrado para revision manual, igual que las otras
// senales (ver /api/registro-riesgo).
const RIESGO_META_REPETIDA = 6;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/?meta_error=1`);
  }

  const email = decodeURIComponent(state);
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
      return NextResponse.redirect(`${baseUrl}/?meta_error=1`);
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
    // le rompe la conexion de Meta a nadie, solo se apaga el trial si aplicaba)
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
      })
      .eq("email", email);

    if (error) {
      console.error("Error guardando token de Meta:", error);
      return NextResponse.redirect(`${baseUrl}/?meta_error=1`);
    }

    return NextResponse.redirect(`${baseUrl}/?meta_conectado=1`);
  } catch (err) {
    console.error("Error en callback de Meta:", err);
    return NextResponse.redirect(`${baseUrl}/?meta_error=1`);
  }
}
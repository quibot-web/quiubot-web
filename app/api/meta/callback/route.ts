import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

    // 4. Guardar todo en Supabase
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
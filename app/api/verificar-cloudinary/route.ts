import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ hasConfig: false });

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", session.user.email.toLowerCase())
    .single();

  // Verificamos que los 3 campos existan y no sean strings vacíos o nulos
  const hasConfig = !!(
    usuario?.cloudinary_name && 
    usuario?.cloudinary_key && 
    usuario?.cloudinary_secret
  );
  
  return NextResponse.json({ hasConfig });
}
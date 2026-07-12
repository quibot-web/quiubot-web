import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { v2 as cloudinary } from "cloudinary";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: usuario } = await supabaseAdmin
    .from("usuarios")
    .select("id, cloudinary_name, cloudinary_key, cloudinary_secret")
    .eq("email", session.user.email.trim().toLowerCase())
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { id } = await params;

  const { data: item, error: errorItem } = await supabaseAdmin
    .from("album_creativos")
    .select("id, public_id, tipo, user_id")
    .eq("id", id)
    .eq("user_id", usuario.id)
    .single();

  if (errorItem || !item) {
    return NextResponse.json({ error: "Creativo no encontrado" }, { status: 404 });
  }

  if (usuario.cloudinary_name && usuario.cloudinary_key && usuario.cloudinary_secret && item.public_id) {
    cloudinary.config({
      cloud_name: usuario.cloudinary_name,
      api_key: usuario.cloudinary_key,
      api_secret: usuario.cloudinary_secret,
    });

    try {
      await cloudinary.uploader.destroy(item.public_id, {
        resource_type: item.tipo === "video" ? "video" : "image",
      });
    } catch (err) {
      console.error("Error al borrar de Cloudinary:", err);
    }
  }

  const { error: errorDelete } = await supabaseAdmin
    .from("album_creativos")
    .delete()
    .eq("id", id)
    .eq("user_id", usuario.id);

  if (errorDelete) {
    return NextResponse.json({ error: errorDelete.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
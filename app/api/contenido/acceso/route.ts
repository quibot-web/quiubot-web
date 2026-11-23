import { NextResponse } from "next/server";
import { accesoContenido, esAdmin } from "@/app/lib/accesoContenido";

// ¿Puede este usuario usar /contenido? Lo usan las páginas al abrir: 200
// con el rol, o el mismo error que cualquier ruta de contenido (401, 404 o
// 403 con codigo "suscripcion_inactiva" y el mensaje para mostrar).
export async function GET() {
  const acceso = await accesoContenido();
  if (acceso.error) return acceso.error;
  return NextResponse.json({ acceso: true, esAdmin: esAdmin(acceso.usuario) });
}

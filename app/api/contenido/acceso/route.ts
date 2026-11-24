import { NextResponse } from "next/server";
import { accesoContenido, esAdmin, motivoSinContenido, puedeCrearContenido } from "@/app/lib/accesoContenido";

// ¿Qué puede hacer este usuario en /contenido? Lo usan las páginas al
// abrir. Cualquier sesión ve la página; puedeCrear dice si además puede
// crear, generar y publicar (Crecimiento o Escala vigente, o admin), y si
// no, el motivo para mostrar (subir de plan o renovar).
export async function GET() {
  const acceso = await accesoContenido("", { soloLectura: true });
  if (acceso.error) return acceso.error;
  const puedeCrear = puedeCrearContenido(acceso.usuario);
  return NextResponse.json({ acceso: true, esAdmin: esAdmin(acceso.usuario), puedeCrear, ...(puedeCrear ? {} : { motivo: motivoSinContenido(acceso.usuario) }) });
}

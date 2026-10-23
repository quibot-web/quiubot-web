import { redirect } from "next/navigation";

// /registro ya no es una página propia -- /login la absorbió (pestañas
// "Crear cuenta" / "Ya tengo cuenta", con "Crear cuenta" como pestaña por
// defecto, así que un simple redirect a /login ya cae en el modo correcto
// sin necesitar ?modo=). Se conserva como redirect en vez de borrar la ruta
// para no romper enlaces viejos que ya existan (correos, favoritos,
// campañas pautadas) -- y reenvía TODOS los parámetros que traiga (?next=,
// UTM, etc.) para que ninguno se pierda en el salto.
export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === "string") query.set(clave, valor);
    else if (Array.isArray(valor)) valor.forEach((v) => query.append(clave, v));
  }
  const qs = query.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}

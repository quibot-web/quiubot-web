// Datos reales en TODOS los guiones orgánicos (24 nov 2026, corrección
// obligatoria): un precio, %, horario, 2x1, envío gratis, garantía,
// cuotas o descuento solo se pueden decir o mostrar si el usuario los
// escribió (tema o idea) o están en los datos de la marca o del
// producto. Vale para el tema corto y la idea desarrollada, con voz o
// sin voz, en todas las recetas.
import { detectarDatosInventados } from "@/app/lib/ideaUsuario";
import type { EntradaGuionOrganico, ProductoResumenNegocio } from "@/video/promptGuionOrganico";

function textoProducto(p: Pick<ProductoResumenNegocio, "nombre" | "precio_cop" | "destacar">): string {
  const precio = p.precio_cop ? `$${p.precio_cop.toLocaleString("es-CO")} ${p.precio_cop}` : "";
  return `${p.nombre} ${precio} ${p.destacar ?? ""}`;
}

// La ÚNICA fuente de datos concretos: lo que escribió el usuario y los
// datos de la marca/producto. El ADN (voz de marca) no es fuente de datos.
export function fuentesDeDatosReales(entrada: Pick<EntradaGuionOrganico, "tema" | "infoAdicionalMarca" | "productos" | "productoPieza">): string {
  return [entrada.tema ?? "", entrada.infoAdicionalMarca ?? "", ...entrada.productos.map(textoProducto), entrada.productoPieza ? textoProducto(entrada.productoPieza) : ""].join("\n");
}

// Todo lo que el guion dice o muestra: narración, palabra gigante, textos
// de escena, textos de los visuales (ej. anuncio_boton.texto_arreglo),
// bucle y caption.
export function textosQueSeDicenOMuestran(guion: { escenas: unknown[]; bucle?: unknown; publicacion?: { caption?: string } | null }): string[] {
  const textos: string[] = [];
  const recorrer = (v: unknown) => {
    if (typeof v === "string") textos.push(v);
    else if (Array.isArray(v)) v.forEach(recorrer);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        // Identificadores y valores técnicos, no texto visible.
        if (["id", "bloque", "tipo", "media_id", "accion", "icono", "tratamiento", "abre_en", "cierra_en", "indicador", "eventos"].includes(k)) continue;
        recorrer(x);
      }
    }
  };
  recorrer(guion.escenas);
  recorrer(guion.bucle);
  if (guion.publicacion?.caption) textos.push(guion.publicacion.caption);
  return textos;
}

const MARCADOR = /\[[^\]\n]{1,40}\]/g;

export function erroresDatosDelGuion(guion: Parameters<typeof textosQueSeDicenOMuestran>[0], entrada: Parameters<typeof fuentesDeDatosReales>[0]): string[] {
  const textos = textosQueSeDicenOMuestran(guion);
  const marcadores = [...new Set(textos.flatMap((t) => t.match(MARCADOR) ?? []))].map((m) => `el guion trae el marcador ${m} sin reemplazar -- usa un dato real o quítalo`);
  return [...detectarDatosInventados(textos, fuentesDeDatosReales(entrada)), ...marcadores];
}

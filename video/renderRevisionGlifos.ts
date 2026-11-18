// Stills de revisión de los íconos dibujados (video/iconos.tsx, 18 nov
// 2026): cada lugar que antes pintaba un glifo o emoji fuera de nuestras
// fuentes (✓ ✗ ✓✓ ❌ ✔️ 👆 🕐 💬 🖼️ 👀 👤 📣). Para mirar con el render real
// que todos se dibujan, en su sitio y a su tamaño. El test
// video/glifosEnCodigo.test.ts evita que vuelva un glifo; esto revisa
// cómo se VEN los íconos.
//
// Uso: npx tsx video/renderRevisionGlifos.ts <carpeta-salida>
// Import relativo a propósito, igual que render.ts.
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { Guion } from "./guion.schema";
import type { Visual } from "./visuales/schema";
import { fixtureCompleta } from "./fixtures/completa";
import { fixtureLeads } from "./fixtures/leads";
import { fixtureVentaDirectaWhatsapp } from "./fixtures/ventaDirectaWhatsapp";
import { fixturePreguntaComunidad } from "./fixtures/organico/preguntaComunidad";
import { fixtureConsejosNumerados } from "./fixtures/organico/consejosNumerados";

type TomaBanco = { nombre: string; visual: Visual; bloque: "gancho" | "valor" | "marca" | "cta"; frame: number; chipBucle?: { indicador: "espera_final" | "contador"; texto: string } };

const TOMAS_BANCO: TomaBanco[] = [
  // Reel con voz (renderizarVisual, el camino real).
  { nombre: "cta-siguiendo-con-chulo", bloque: "cta", frame: 60, visual: { tipo: "boton_estado", texto: "Seguir", texto_activo: "x", eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 1, accion: "clic" }] } },
  { nombre: "cta-chulo-de-guion-guardado", bloque: "valor", frame: 60, visual: { tipo: "boton_estado", texto: "Seguir", texto_activo: "Siguiendo ✓", eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 1, accion: "clic" }] } },
  { nombre: "cursor-mano", bloque: "cta", frame: 14, visual: { tipo: "cursor_clic", texto_boton: "Escríbenos ya", eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 2, accion: "clic" }] } },
  { nombre: "celular-vacio-con-chip", bloque: "gancho", frame: 30, visual: { tipo: "celular_chat", eventos: [] }, chipBucle: { indicador: "espera_final", texto: "" } },
  { nombre: "celular-notificaciones", bloque: "marca", frame: 60, visual: { tipo: "celular_chat", eventos: [{ palabra: 0, accion: "notificacion_llega" }, { palabra: 1, accion: "numero_sube" }] } },
  { nombre: "chip-promesa-larga", bloque: "gancho", frame: 30, visual: { tipo: "comparacion", texto_mal: "Foto con flash", texto_bien: "Luz de ventana", eventos: [] }, chipBucle: { indicador: "contador", texto: "3 trucos para fotos que venden" } },
  { nombre: "conexion-cruz-megafono", bloque: "gancho", frame: 30, visual: { tipo: "conexion_whatsapp", eventos: [] } },
  { nombre: "respuesta-visto-reloj", bloque: "gancho", frame: 30, visual: { tipo: "respuesta_lenta", eventos: [] } },
  { nombre: "anuncio-megafono", bloque: "gancho", frame: 30, visual: { tipo: "anuncio_boton", eventos: [] } },
  { nombre: "comparacion-marcas", bloque: "valor", frame: 60, visual: { tipo: "comparacion", texto_mal: "Foto con flash", texto_bien: "Luz de ventana", eventos: [{ palabra: 0, accion: "cambia_estado" }] } },
  { nombre: "foto-mal", bloque: "gancho", frame: 30, visual: { tipo: "comparacion_foto", media_id: "foto-demo", texto_mal: "Así nadie la compra", texto_bien: "Así sí", eventos: [] } },
  { nombre: "foto-bien", bloque: "marca", frame: 60, visual: { tipo: "comparacion_foto", media_id: "foto-demo", texto_mal: "Así nadie la compra", texto_bien: "Así se ve el detalle", eventos: [{ palabra: 0, accion: "cambia_estado" }] } },
  // Catálogo de íconos (colores de marca) y guiones viejos con emoji.
  { nombre: "icono-luna", bloque: "gancho", frame: 30, visual: { tipo: "icono_palabra", icono_antes: "luna", palabra_antes: "Oscura", icono_despues: "sol", palabra_despues: "Con luz", eventos: [] } },
  { nombre: "icono-sol", bloque: "marca", frame: 60, visual: { tipo: "icono_palabra", icono_antes: "luna", palabra_antes: "Oscura", icono_despues: "sol", palabra_despues: "Con luz", eventos: [{ palabra: 0, accion: "cambia_estado" }] } },
  { nombre: "icono-viejo-emoji-calendario", bloque: "gancho", frame: 30, visual: { tipo: "icono_palabra", icono_antes: "📅", palabra_antes: "Tarde", icono_despues: "⏳", palabra_despues: "A tiempo", eventos: [] } },
  { nombre: "icono-reloj-arena-a-check", bloque: "marca", frame: 60, visual: { tipo: "icono_palabra", icono_antes: "reloj_arena", palabra_antes: "Esperando", icono_despues: "etiqueta_precio", palabra_despues: "Con precio", eventos: [{ palabra: 0, accion: "cambia_estado" }] } },
  { nombre: "anuncio-icono-camara", bloque: "gancho", frame: 30, visual: { tipo: "anuncio_boton", icono: "camara", etiqueta: "Publicación", texto_problema: "Sin precio", texto_arreglo: "Desde $45.000", eventos: [] } },
  { nombre: "conexion-icono-bolsa", bloque: "gancho", frame: 30, visual: { tipo: "conexion_whatsapp", icono: "bolsa", etiqueta: "Catálogo", texto_problema: "Sin precios", mensaje: "Hola, quiero la taza", eventos: [] } },
  { nombre: "respuesta-vieja-con-emoji", bloque: "marca", frame: 60, visual: { tipo: "respuesta_lenta", pregunta_cliente: "¿Cuánto vale?", respuesta: "¡Sí, aquí tienes! 😊", confirmacion: "¡Me la llevo! 🙌", eventos: [{ palabra: 0, accion: "cambia_estado" }] } },
  { nombre: "foto-sin-medio", bloque: "gancho", frame: 30, visual: { tipo: "comparacion_foto", media_id: "no-existe", texto_mal: "Así nadie la compra", texto_bien: "Así sí", eventos: [] } },
];

// Pipeline de siempre (Composicion): la escena pedida, a ~85% de su
// duración (las animaciones de entrada ya terminaron).
const TOMAS_FIXTURE: { nombre: string; id: string; guion: Guion; escena: (e: Guion["escenas"][number]) => boolean }[] = [
  { nombre: "viejo-beneficios-chulos", id: "demo-todas-las-escenas", guion: fixtureCompleta, escena: (e) => e.tipo === "beneficios_lista" },
  { nombre: "viejo-producto-hero-chulo", id: "demo-todas-las-escenas", guion: fixtureCompleta, escena: (e) => e.tipo === "producto_hero" },
  { nombre: "viejo-cta-formulario-chulos", id: "leads", guion: fixtureLeads, escena: (e) => e.tipo === "cta" },
  { nombre: "viejo-cta-whatsapp-mano", id: "venta-directa-whatsapp", guion: fixtureVentaDirectaWhatsapp, escena: (e) => e.tipo === "cta" },
  { nombre: "viejo-cta-comentar-burbuja", id: "organico-pregunta-comunidad", guion: fixturePreguntaComunidad, escena: (e) => e.tipo === "cta" },
  { nombre: "viejo-cta-seguir-persona", id: "organico-consejos-numerados", guion: fixtureConsejosNumerados, escena: (e) => e.tipo === "cta" },
  { nombre: "viejo-chip-bucle", id: "organico-consejos-numerados", guion: fixtureConsejosNumerados, escena: () => true },
];

async function main() {
  const salida = process.argv[2];
  if (!salida) throw new Error("Uso: npx tsx video/renderRevisionGlifos.ts <carpeta-salida>");
  fs.mkdirSync(salida, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });

  for (const toma of TOMAS_BANCO) {
    const inputProps = { visual: toma.visual, bloque: toma.bloque, chipBucle: toma.chipBucle };
    const composition = await selectComposition({ serveUrl, id: "banco-gancho-cierre", inputProps });
    const archivo = path.join(salida, `${toma.nombre}.png`);
    await renderStill({ composition, serveUrl, output: archivo, frame: toma.frame, inputProps });
    console.log(archivo);
  }

  for (const toma of TOMAS_FIXTURE) {
    const indice = toma.guion.escenas.findIndex(toma.escena);
    if (indice === -1) throw new Error(`${toma.nombre}: el fixture no tiene esa escena`);
    const fps = toma.guion.fps;
    const inicio = toma.guion.escenas.slice(0, indice).reduce((acc, e) => acc + Math.round(e.duracion_s * fps), 0);
    const frame = inicio + Math.floor(toma.guion.escenas[indice].duracion_s * fps * 0.85);
    const composition = await selectComposition({ serveUrl, id: toma.id });
    const archivo = path.join(salida, `${toma.nombre}.png`);
    await renderStill({ composition, serveUrl, output: archivo, frame });
    console.log(archivo, `(${toma.guion.escenas[indice].tipo}, cuadro ${frame})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

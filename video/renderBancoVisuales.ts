// Renderiza stills PNG del banco de pruebas visual (video/BancoVisuales.tsx)
// con los textos de cada visual al MÁXIMO de largo permitido por el
// schema (LIMITES_TEXTO_VISUAL), en "antes" y "después" -- para revisar
// con el render real que nada se corta, se sale o sale como cuadro
// (memorias: width:% sin contenedor propio, glifos faltantes).
//
// Uso: npx tsx video/renderBancoVisuales.ts [carpeta-salida]
// Import relativo a propósito, igual que render.ts: el bundler de
// Remotion no entiende el alias "@/" de tsconfig.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { LIMITES_TEXTO_VISUAL } from "./visuales/schema";

// Texto realista (palabras largas de verdad, no "xxxx") recortado al
// máximo exacto -- el peor caso real que puede mandar la IA.
function alMaximo(base: string, maximo: number): string {
  let t = base;
  while (t.length < maximo) t += ` ${base}`;
  return t.slice(0, maximo).trimEnd().padEnd(maximo, "s");
}

const CASOS: { nombre: string; tipo: "anuncio_boton" | "conexion_whatsapp" | "respuesta_lenta" | "comparacion" | "icono_palabra" | "checklist" | "comparacion_foto"; textos: Record<string, string> }[] = [
  {
    nombre: "checklist-maximo",
    tipo: "checklist",
    textos: {
      titulo: alMaximo("Antes de publicar revisa", LIMITES_TEXTO_VISUAL.checklist.titulo),
      item1: alMaximo("Luz natural de la ventana", LIMITES_TEXTO_VISUAL.checklist.item),
      item2: alMaximo("Fondo liso y sin desorden", LIMITES_TEXTO_VISUAL.checklist.item),
      item3: alMaximo("Producto en uso, con manos", LIMITES_TEXTO_VISUAL.checklist.item),
    },
  },
  {
    nombre: "comparacion_foto-maximo",
    tipo: "comparacion_foto",
    textos: {
      texto_mal: alMaximo("Foto oscura, nadie la entiende", LIMITES_TEXTO_VISUAL.comparacion_foto.texto),
      texto_bien: alMaximo("Con luz se ve el detalle real", LIMITES_TEXTO_VISUAL.comparacion_foto.texto),
    },
  },
  {
    nombre: "comparacion_foto-sin-foto",
    tipo: "comparacion_foto",
    textos: { sin_foto: "1", texto_mal: "Foto oscura", texto_bien: "Foto con luz" },
  },
  {
    nombre: "comparacion-maximo",
    tipo: "comparacion",
    textos: {
      etiqueta_mal: alMaximo("Así no lo hagas", LIMITES_TEXTO_VISUAL.comparacion.etiqueta),
      texto_mal: alMaximo("Foto con flash y fondo desordenado en la casa", LIMITES_TEXTO_VISUAL.comparacion.texto),
      etiqueta_bien: alMaximo("Así sí funciona", LIMITES_TEXTO_VISUAL.comparacion.etiqueta),
      texto_bien: alMaximo("Luz de ventana y fondo liso, sin distracciones", LIMITES_TEXTO_VISUAL.comparacion.texto),
    },
  },
  {
    nombre: "icono_palabra-maximo",
    tipo: "icono_palabra",
    textos: {
      icono_antes: "🌑",
      palabra_antes: alMaximo("Muy oscura y fea", LIMITES_TEXTO_VISUAL.icono_palabra.palabra),
      icono_despues: "☀️",
      palabra_despues: alMaximo("Luz natural ya", LIMITES_TEXTO_VISUAL.icono_palabra.palabra),
    },
  },
  {
    nombre: "icono_palabra-corta",
    tipo: "icono_palabra",
    textos: { icono_antes: "🐢", palabra_antes: "Lento", icono_despues: "⚡", palabra_despues: "Rápido" },
  },
  {
    nombre: "anuncio_boton-maximo",
    tipo: "anuncio_boton",
    textos: {
      icono: "📷",
      etiqueta: alMaximo("Publicación", LIMITES_TEXTO_VISUAL.anuncio_boton.etiqueta),
      texto_problema: alMaximo("Sin precio ni descripción", LIMITES_TEXTO_VISUAL.anuncio_boton.texto_problema),
      texto_arreglo: alMaximo("Desde $145.000 COP", LIMITES_TEXTO_VISUAL.anuncio_boton.texto_arreglo),
    },
  },
  {
    nombre: "conexion_whatsapp-maximo",
    tipo: "conexion_whatsapp",
    textos: {
      icono: "🛍️",
      etiqueta: alMaximo("Catálogo", LIMITES_TEXTO_VISUAL.conexion_whatsapp.etiqueta),
      texto_problema: alMaximo("Nadie te escribe", LIMITES_TEXTO_VISUAL.conexion_whatsapp.texto_problema),
      mensaje: alMaximo("Hola, ¿cuánto cuesta el jarrón azul?", LIMITES_TEXTO_VISUAL.conexion_whatsapp.mensaje),
    },
  },
  {
    nombre: "respuesta_lenta-maximo",
    tipo: "respuesta_lenta",
    textos: {
      pregunta_cliente: alMaximo("¿Hacen envíos a Cali y cuánto se demora?", LIMITES_TEXTO_VISUAL.respuesta_lenta.pregunta_cliente),
      respuesta: alMaximo("¡Sí! Llega en 2 días hábiles 😊", LIMITES_TEXTO_VISUAL.respuesta_lenta.respuesta),
      confirmacion: alMaximo("Perfecto, te pago ya mismo", LIMITES_TEXTO_VISUAL.respuesta_lenta.confirmacion),
    },
  },
  { nombre: "anuncio_boton-por-defecto", tipo: "anuncio_boton", textos: {} },
];

async function main() {
  const salida = process.argv[2] || path.join(os.homedir(), "Desktop", "videos_quiubot", "banco_visuales");
  fs.mkdirSync(salida, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "video", "Root.tsx") });

  for (const caso of CASOS) {
    for (const estado of ["antes", "despues"] as const) {
      const inputProps = { tipo: caso.tipo, estado, textos: caso.textos };
      const composition = await selectComposition({ serveUrl, id: "banco-visuales", inputProps });
      const archivo = path.join(salida, `${caso.nombre}-${estado}.png`);
      await renderStill({ composition, serveUrl, output: archivo, frame: 45, inputProps });
      console.log(archivo, JSON.stringify(caso.textos));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

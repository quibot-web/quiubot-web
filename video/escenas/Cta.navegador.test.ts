// Prueba de regresión del bug real encontrado el 15 nov 2026 (reel de
// referencia de contenido orgánico, "Siguiendo ✓" se partía en
// "Siguien"/"do ✓"): BotonGrande, dentro del contenedor de CtaWeb/
// CtaFormulario (position:relative, antes display:"inline-block"),
// quedaba mucho más angosto que el 80% de la zona segura pedido -- un
// porcentaje de ancho puesto en el BOTÓN mismo, cuando su contenedor es
// un inline-block sin ancho propio, es un caso límite de CSS que el
// navegador no resuelve al ancho esperado.
//
// jsdom NO sirve acá: no hace layout real (getBoundingClientRect()
// siempre da 0), así que no habría detectado este bug -- por eso esta
// prueba renderiza el HTML real (vía react-dom/server, sin ningún hook
// de Remotion: BotonGrande/CursorClic son componentes de presentación
// puros, reciben frame/progreso ya calculados) en un Chromium real con
// Playwright y mide el layout de verdad.
//
// *.navegador.test.ts, fuera de "npm test" (ver vitest.config.ts):
// lanzar un Chromium real es mucho más lento y variable que el resto
// de la suite (mockeada, sin red ni DB real) -- en un entorno
// restringido el arranque del navegador puede pasarse del timeout por
// defecto de vitest (5s) sin que haya ningún bug real, lo que volvía
// "npm test" rojo por una causa ajena a la lógica. Corre aparte con
// "npm run test:navegador". El timeout explícito de 30s (tercer
// argumento de it) es la red de seguridad dentro de ese script.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { ANCHO_MAX_PX, BotonGrande, CursorClic } from "./Cta";
import type { TemaGuion } from "../tema";

const TEMA: TemaGuion = { color_primario: "#534AB7", color_secundario: "#7F77DD", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot" };

// Mismo contenedor real que CtaWeb/CtaFormulario (ver Cta.tsx) --
// cualquier cambio futuro que vuelva a envolver el botón en un
// display:"inline-block" sin ancho propio debe romper esta prueba.
function wrapperReal(texto: string): string {
  const html = renderToStaticMarkup(BotonGrande({ texto, tema: TEMA, progreso: 1, completo: true }));
  const cursor = renderToStaticMarkup(CursorClic({ frame: 0, fps: 30, duracionCuadros: 90 }));
  return `<div id="wrapper" style="position:relative;width:${((ANCHO_MAX_PX / 1080) * 100).toFixed(1)}%">${html}${cursor}</div>`;
}

describe("BotonGrande dentro del contenedor real de CtaWeb/CtaFormulario", () => {
  it("mantiene su ancho de diseño (80% de la zona segura) con un texto largo real", async () => {
    const textoLargo = "Escríbenos ahora mismo por WhatsApp y te respondemos al instante";
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
      // "* { box-sizing: border-box }" -- Remotion lo inyecta siempre de
      // verdad (node_modules/remotion/dist/cjs/default-css.js), tanto en
      // Studio como en cada render; sin esto acá el padding del botón se
      // suma AFUERA del 100% en vez de adentro, y la prueba fallaría por
      // una diferencia que no existe en el render real.
      await page.setContent(`
        <!doctype html><html><head><style>* { box-sizing: border-box; }</style></head>
        <body style="margin:0;width:1080px;height:1920px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
          ${wrapperReal(textoLargo)}
        </body></html>
      `);

      const anchoWrapper = await page.locator("#wrapper").evaluate((el) => el.getBoundingClientRect().width);
      const anchoBoton = await page.locator("#wrapper > div").first().evaluate((el) => el.getBoundingClientRect().width);

      // El caso real roto medía ~350-400px (el ancho de la palabra más
      // larga, no del contenedor) -- acá debe coincidir con el ancho de
      // diseño real (ANCHO_MAX_PX, 760.3px), nunca angostarse por culpa
      // del texto.
      expect(anchoWrapper).toBeCloseTo(ANCHO_MAX_PX, 0);
      expect(anchoBoton).toBeCloseTo(ANCHO_MAX_PX, 0);
    } finally {
      await browser.close();
    }
  }, 30000);
});

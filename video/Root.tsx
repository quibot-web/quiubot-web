import { Composition, registerRoot, type CalculateMetadataFunction, staticFile } from "remotion";
import { Composicion, duracionEnCuadros, type PropsComposicion } from "./Composicion";
import type { Guion } from "./guion.schema";
import { fixtureCompleta } from "./fixtures/completa";
import { fixtureBucleContador } from "./fixtures/bucleContador";
import { fixtureVentaDirectaWhatsapp } from "./fixtures/ventaDirectaWhatsapp";
import { fixtureVentaDirectaWeb } from "./fixtures/ventaDirectaWeb";
import { fixtureLeads } from "./fixtures/leads";
import { fixtureTraficoMensajes } from "./fixtures/traficoMensajes";
import { fixtureReconocimiento } from "./fixtures/reconocimiento";
import { fixtureSeguidoresInstagram } from "./fixtures/seguidores";
import { fixtureRetargeting } from "./fixtures/retargeting";
import { fixtureConsejosNumerados } from "./fixtures/organico/consejosNumerados";
import { fixtureMitoVerdad } from "./fixtures/organico/mitoVerdad";
import { fixtureProductoEnUso } from "./fixtures/organico/productoEnUso";
import { fixtureSeriePartes } from "./fixtures/organico/seriePartes";
import { fixturePreguntaComunidad } from "./fixtures/organico/preguntaComunidad";
import { fixtureDetrasDeMarca } from "./fixtures/organico/detrasDeMarca";
import { ReelConsejosNumerados, duracionReelConsejosNumeradosEnCuadros } from "./fixtures/organico/referencia/ReelConsejosNumerados";
import { ReelMitoVerdad, duracionReelMitoVerdadEnCuadros } from "./fixtures/organico/referencia/ReelMitoVerdad";
import { ReelIlustrado, duracionReelIlustrado, type PropsReelIlustrado } from "./ilustrado/ReelIlustrado";
import { tiemposSinteticos } from "./ilustrado/guionPrototipo";
import { MARCA_PROTOTIPO, PLAN_PROTOTIPO } from "./ilustrado/planPrototipo";
import { ALTO_POST_FIJO, ANCHO_POST_FIJO, PostFijo } from "./ilustrado/PostFijo";
import { ReelAutomatico, duracionReelAutomaticoEnCuadros, type PropsReelAutomatico } from "./visuales/ReelAutomatico";
import { BancoGanchoCierre, BancoVisuales, type PropsBancoGanchoCierre, type PropsBancoVisuales } from "./BancoVisuales";

// Placeholder para "demo-1" (data URI, sin archivos nuevos en public/):
// solo para ver en Studio cómo se comporta producto_hero y el gancho con
// producto de fondo -- en producción esto siempre es una foto o video
// real del álbum, resuelto por la ruta /api/video/render (Fase 1b).
const FOTO_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#4a4a52"/>
      <stop offset="100%" stop-color="#101014"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#g)" />
  <text x="50%" y="48%" fill="#9a9aa2" font-size="42" font-family="Arial" text-anchor="middle">FOTO REAL DEL PRODUCTO</text>
  <text x="50%" y="54%" fill="#9a9aa2" font-size="42" font-family="Arial" text-anchor="middle">(álbum)</text>
</svg>
`)}`;

const MEDIOS_DEMO = { "demo-1": { url: FOTO_PLACEHOLDER, tipo: "imagen" as const } };

// Entrada de Remotion Studio (npm run video:studio) para probar escenas,
// capas y recetas en local. "completa" y "bucle-contador" son de antes
// de que existieran las recetas (paso 2): muestran las 9 escenas sin
// seguir ninguna receta. El resto son un ejemplo por receta (paso 3),
// los mismos que verifica npm run video:verificar.
const FIXTURES: { id: string; guion: Guion; mostrarZonaSegura?: boolean }[] = [
  { id: "demo-todas-las-escenas", guion: fixtureCompleta },
  { id: "demo-bucle-contador", guion: fixtureBucleContador, mostrarZonaSegura: true },
  { id: "venta-directa-whatsapp", guion: fixtureVentaDirectaWhatsapp },
  { id: "venta-directa-web", guion: fixtureVentaDirectaWeb },
  { id: "leads", guion: fixtureLeads },
  { id: "trafico-mensajes", guion: fixtureTraficoMensajes },
  { id: "reconocimiento", guion: fixtureReconocimiento },
  { id: "seguidores-instagram", guion: fixtureSeguidoresInstagram },
  { id: "retargeting", guion: fixtureRetargeting },
  // Fase O1, contenido orgánico -- un ejemplo por receta de video/recetas/organico/.
  { id: "organico-consejos-numerados", guion: fixtureConsejosNumerados },
  { id: "organico-mito-verdad", guion: fixtureMitoVerdad },
  { id: "organico-producto-en-uso", guion: fixtureProductoEnUso },
  { id: "organico-serie-partes", guion: fixtureSeriePartes },
  { id: "organico-pregunta-comunidad", guion: fixturePreguntaComunidad },
  { id: "organico-detras-de-marca", guion: fixtureDetrasDeMarca },
];

// La duración de los fixtures de arriba se conoce de antemano (están
// fijos en el módulo), pero "render" recibe un guion real distinto en
// cada corrida de "npm run render -- <guion.json>" (ver video/render.ts)
// vía --props/inputProps -- calculateMetadata la recalcula con las
// props reales, los valores de más abajo son solo el placeholder que
// pide <Composition> antes de que eso corra.
const calcularMetadataRender: CalculateMetadataFunction<PropsComposicion> = ({ props }) => ({
  durationInFrames: duracionEnCuadros(props.guion),
  fps: props.guion.fps,
});

const TEMA_PROTOTIPO = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna" as const, logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" };

function RemotionRoot() {
  return (
    <>
      {FIXTURES.map(({ id, guion, mostrarZonaSegura }) => (
        <Composition<any, PropsComposicion>
          key={id}
          id={id}
          component={Composicion}
          durationInFrames={duracionEnCuadros(guion)}
          fps={guion.fps}
          width={1080}
          height={1920}
          defaultProps={{ guion, medios: MEDIOS_DEMO, mostrarZonaSegura: !!mostrarZonaSegura }}
        />
      ))}
      <Composition<any, PropsComposicion>
        id="render"
        component={Composicion}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={calcularMetadataRender}
        defaultProps={{ guion: fixtureReconocimiento, medios: MEDIOS_DEMO, pistaUrl: null }}
      />

      {/* Fase A del pivote visual (ver el plan) -- reels de referencia
          hechos a mano, fuera del sistema Guion/Escena a propósito.
          Sin props: la composición es autocontenida. */}
      <Composition
        id="organico-referencia-consejos-numerados"
        component={ReelConsejosNumerados}
        durationInFrames={duracionReelConsejosNumeradosEnCuadros()}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="organico-referencia-mito-verdad"
        component={ReelMitoVerdad}
        durationInFrames={duracionReelMitoVerdadEnCuadros()}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Banco de pruebas visual (parte 2b): un visual suelto, "antes" o
          "después", con los textos que se le pasen -- solo para revisar
          stills reales (video/renderBancoVisuales.ts). */}
      <Composition
        id="banco-visuales"
        component={BancoVisuales}
        durationInFrames={60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ tipo: "anuncio_boton", estado: "antes", textos: {} } satisfies PropsBancoVisuales}
      />
      {/* Reel ilustrado (motor genérico, fase 1): por defecto el plan del
          prototipo con tiempos sintéticos; el mp4 con voz real se
          renderiza con la voz y sus tiempos (arnés admin o script local). */}
      <Composition
        id="reel-ilustrado"
        component={ReelIlustrado}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => ({ durationInFrames: duracionReelIlustrado(props) })}
        defaultProps={{ tiempos: tiemposSinteticos(), plan: PLAN_PROTOTIPO, vozUrl: null, fotoUrl: staticFile("demo-organico/foto-producto-ceramica.jpg"), tema: TEMA_PROTOTIPO, marca: MARCA_PROTOTIPO } satisfies PropsReelIlustrado}
      />
      {/* Solo para generar public/ilustrado/post-<tipo>.png (video/ilustrado/generarPostsFijos.ts). */}
      <Composition id="post-fijo" component={PostFijo} durationInFrames={1} fps={30} width={ANCHO_POST_FIJO} height={ALTO_POST_FIJO} defaultProps={{ tipo: "comida" as const }} />
      {/* Reel con voz completo desde un guion guardado
          (video/renderReelAutomatico.ts) -- para revisar estilos con el
          render real. La duración sale del guion (tiemposRender). */}
      <Composition
        id="reel-automatico"
        component={ReelAutomatico}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, duracionReelAutomaticoEnCuadros(props.guion)), fps: props.guion.fps })}
        defaultProps={{ guion: fixtureConsejosNumerados, medios: MEDIOS_DEMO } as PropsReelAutomatico}
      />
      {/* Parte 2e: un visual por el camino real (renderizarVisual), como
          gancho (problema) o cierre (arreglado). */}
      <Composition
        id="banco-gancho-cierre"
        component={BancoGanchoCierre}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ visual: { tipo: "comparacion", texto_mal: "Foto con flash", texto_bien: "Luz de ventana", eventos: [] }, bloque: "gancho" } satisfies PropsBancoGanchoCierre}
      />
    </>
  );
}

registerRoot(RemotionRoot);

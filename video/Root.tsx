import { Composition, registerRoot } from "remotion";
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
];

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
    </>
  );
}

registerRoot(RemotionRoot);

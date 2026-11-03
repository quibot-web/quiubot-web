import { Composition, registerRoot } from "remotion";
import { Composicion, type PropsComposicion } from "./Composicion";
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

function duracionEnCuadros(guion: Guion): number {
  return Math.round(guion.escenas.reduce((acc, e) => acc + e.duracion_s, 0) * guion.fps);
}

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
          defaultProps={{ guion, medios: {}, mostrarZonaSegura: !!mostrarZonaSegura }}
        />
      ))}
    </>
  );
}

registerRoot(RemotionRoot);

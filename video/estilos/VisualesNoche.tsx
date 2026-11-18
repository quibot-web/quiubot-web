// Layout "objeto protagonista" en el estilo Noche (sistema de estilos,
// paso 1): los visuales de 2 estados que no son maquetas de interfaz se
// dibujan SIN tarjeta blanca, más grandes y directo sobre el fondo
// oscuro. Misma lógica de cambio que sus versiones de siempre (cambio en
// cuadroCambia, mismos textos), otro tratamiento. Archivo aparte a
// propósito: los componentes de siempre no se tocan.
//
// Textos de 40px o más; colores de texto contra el fondo de la paleta
// (blanco, alerta/éxito claros -- contraste verificado en
// estilos.test.ts).
import { AbsoluteFill, Img, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { hexConAlfa, type TemaGuion } from "../tema";
import { IconoCatalogo } from "../iconosCatalogo";
import { IconoImagen, IconoMarca } from "../iconos";
import { PROTAGONISTA_ALTURA_PORCENTAJE, PROTAGONISTA_ANCHO_PORCENTAJE, PROTAGONISTA_TOP_PORCENTAJE } from "../visuales/geometria";
import { familiaDeFuenteSinCargar } from "../visuales/tamanos";
import type { PaletaNoche } from "./estilos";

const ANCHO_PX = (PROTAGONISTA_ANCHO_PORCENTAJE / 100) * 1080;

function Zona({ children, gap = 24 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${PROTAGONISTA_TOP_PORCENTAJE}%`,
        height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`,
        left: `${(100 - PROTAGONISTA_ANCHO_PORCENTAJE) / 2}%`,
        width: `${PROTAGONISTA_ANCHO_PORCENTAJE}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap,
      }}
    >
      {children}
    </div>
  );
}

function progresoCambio(frame: number, fps: number, cuadroCambia: number, damping = 13): number {
  return frame >= cuadroCambia ? spring({ frame: frame - cuadroCambia, fps, config: { damping } }) : 0;
}

function tamanoQueCabe(texto: string, familia: string, ancho: number, min: number, max: number, peso = 900): number {
  const { fontSize } = fitText({ text: texto, withinWidth: ancho, fontFamily: familia, fontWeight: peso });
  return Math.max(min, Math.min(max, Math.floor(fontSize)));
}

export function IconoPalabraNoche({
  frame,
  fps,
  cuadroCambia,
  tema,
  paleta,
  iconoAntes,
  palabraAntes,
  iconoDespues,
  palabraDespues,
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  tema: TemaGuion;
  paleta: PaletaNoche;
  iconoAntes: string;
  palabraAntes: string;
  iconoDespues: string;
  palabraDespues: string;
}) {
  const despues = frame >= cuadroCambia;
  const pop = despues ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 9, stiffness: 180 } }) : 1;
  const palabra = (despues ? palabraDespues : palabraAntes).toLocaleUpperCase("es");
  const color = despues ? paleta.exito : paleta.alerta;
  const tamano = tamanoQueCabe(palabra, familiaDeFuenteSinCargar(tema.fuente), ANCHO_PX - 40, 72, 200);
  return (
    <Zona gap={30}>
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})` }}>
        <IconoCatalogo valor={despues ? iconoDespues : iconoAntes} tamano={300} tema={tema} variante="sobre_oscuro" colorLuz={color} colorSuperficie={paleta.superficie} />
      </div>
      <div style={{ fontSize: tamano, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap", color, textShadow: `0 0 40px ${hexConAlfa(color, 0.45)}`, transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})` }}>
        {palabra}
      </div>
    </Zona>
  );
}

export function ContadorNoche({ valor, etiqueta, color, paleta }: { valor: number; etiqueta: string; color: string; paleta: PaletaNoche }) {
  return (
    <Zona gap={8}>
      <div style={{ fontSize: 380, fontWeight: 900, lineHeight: 0.95, color, textShadow: `0 0 60px ${hexConAlfa(color, 0.45)}` }}>{valor}</div>
      <div style={{ fontSize: 56, fontWeight: 800, color: paleta.textoSuave, textAlign: "center" }}>{etiqueta}</div>
    </Zona>
  );
}

const SEGUNDOS_ENTRE_MARCAS = 0.25;
const CASILLA_PX = 64;

function CasillaNoche({ progreso, paleta }: { progreso: number; paleta: PaletaNoche }) {
  const marcada = progreso > 0;
  return (
    <div
      style={{
        position: "relative",
        width: CASILLA_PX,
        height: CASILLA_PX,
        flexShrink: 0,
        borderRadius: 16,
        border: `5px solid ${marcada ? paleta.exito : paleta.textoSuave}`,
        background: marcada ? paleta.exito : "transparent",
        boxShadow: marcada ? `0 0 30px ${hexConAlfa(paleta.exito, 0.5)}` : "none",
      }}
    >
      {marcada && (
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 4,
            width: 16,
            height: 32,
            borderRight: "7px solid #0B2A16",
            borderBottom: "7px solid #0B2A16",
            transform: `rotate(45deg) scale(${interpolate(progreso, [0, 1], [0.4, 1])})`,
            opacity: progreso,
          }}
        />
      )}
    </div>
  );
}

export function ChecklistNoche({
  frame,
  fps,
  cuadroCambia,
  tema,
  paleta,
  titulo,
  items,
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  tema: TemaGuion;
  paleta: PaletaNoche;
  titulo?: string;
  items: string[];
}) {
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const anchoItem = ANCHO_PX - CASILLA_PX - 28 - 16;
  const tamano = Math.min(...items.map((i) => tamanoQueCabe(i, familia, anchoItem, 44, 66, 800)));
  return (
    <Zona gap={26}>
      {titulo && <div style={{ fontSize: 48, fontWeight: 900, color: paleta.luz, textTransform: "uppercase", letterSpacing: "0.03em", alignSelf: "flex-start" }}>{titulo}</div>}
      {items.map((item, i) => {
        const cuadro = cuadroCambia + Math.round(i * SEGUNDOS_ENTRE_MARCAS * fps);
        const progreso = frame >= cuadro ? spring({ frame: frame - cuadro, fps, config: { damping: 12 } }) : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, alignSelf: "flex-start" }}>
            <CasillaNoche progreso={progreso} paleta={paleta} />
            <span style={{ fontSize: tamano, fontWeight: 800, lineHeight: 1.1, color: progreso > 0 ? paleta.texto : paleta.textoSuave }}>{item}</span>
          </div>
        );
      })}
    </Zona>
  );
}

function Franja({ marca, etiqueta, texto, color, tamanoTexto, paleta, estilo }: { marca: "mal" | "bien"; etiqueta: string; texto: string; color: string; tamanoTexto: number; paleta: PaletaNoche; estilo: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: "47%",
        background: paleta.superficie,
        borderLeft: `12px solid ${color}`,
        borderRadius: 24,
        padding: "16px 30px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        boxShadow: `0 0 50px ${hexConAlfa(color, 0.18)}`,
        ...estilo,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconoMarca tipo={marca} tamano={42} colorMal={paleta.alerta} colorBien={paleta.exito} colorTrazo="#0B0B12" />
        <span style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, color, textTransform: "uppercase", letterSpacing: "0.03em" }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: tamanoTexto, fontWeight: 800, lineHeight: 1.12, color: paleta.texto }}>{texto}</div>
    </div>
  );
}

export function ComparacionNoche({
  frame,
  fps,
  cuadroCambia,
  tema,
  paleta,
  textoMal,
  textoBien,
  etiquetaMal = "Así no",
  etiquetaBien = "Así sí",
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  tema: TemaGuion;
  paleta: PaletaNoche;
  textoMal: string;
  textoBien: string;
  etiquetaMal?: string;
  etiquetaBien?: string;
}) {
  const progreso = progresoCambio(frame, fps, cuadroCambia, 15);
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const anchoTexto = (ANCHO_PX - 12 - 60) * 1.8;
  const tamano = Math.min(tamanoQueCabe(textoMal, familia, anchoTexto, 42, 54, 800), tamanoQueCabe(textoBien, familia, anchoTexto, 42, 54, 800));
  // Antes: solo el error, centrado. Después: sube y se apaga, entra lo correcto.
  const bajada = interpolate(progreso, [0, 1], [56, 0]);
  return (
    <div
      style={{
        position: "absolute",
        top: `${PROTAGONISTA_TOP_PORCENTAJE}%`,
        height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`,
        left: `${(100 - PROTAGONISTA_ANCHO_PORCENTAJE) / 2}%`,
        width: `${PROTAGONISTA_ANCHO_PORCENTAJE}%`,
      }}
    >
      <Franja
        marca="mal"
        etiqueta={etiquetaMal}
        texto={textoMal}
        color={paleta.alerta}
        tamanoTexto={tamano}
        paleta={paleta}
        estilo={{ top: 0, transform: `translateY(${bajada}%)`, opacity: interpolate(progreso, [0, 1], [1, 0.45]) }}
      />
      <Franja
        marca="bien"
        etiqueta={etiquetaBien}
        texto={textoBien}
        color={paleta.exito}
        tamanoTexto={tamano}
        paleta={paleta}
        estilo={{ bottom: 0, opacity: progreso, transform: `translateY(${interpolate(progreso, [0, 1], [40, 0])}px)` }}
      />
    </div>
  );
}

// La foto real de la marca, de borde a borde: el objeto protagonista por
// excelencia. Pasa de oscura y borrosa a nítida.
export function ComparacionFotoNoche({
  frame,
  fps,
  cuadroCambia,
  paleta,
  urlFoto,
  textoMal,
  textoBien,
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  paleta: PaletaNoche;
  urlFoto: string | null;
  textoMal: string;
  textoBien: string;
}) {
  const nitida = frame >= cuadroCambia;
  const progreso = progresoCambio(frame, fps, cuadroCambia, 14);
  const color = nitida ? paleta.exito : paleta.alerta;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: "18%", height: "35%", left: 0, right: 0, overflow: "hidden", background: paleta.fondoProfundo }}>
        {urlFoto ? (
          <Img
            src={urlFoto}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: `blur(${interpolate(progreso, [0, 1], [10, 0])}px) brightness(${interpolate(progreso, [0, 1], [0.4, 1])})`,
              transform: `scale(${interpolate(progreso, [0, 1], [1.08, 1.0])})`,
            }}
          />
        ) : (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <IconoImagen tamano={160} color={paleta.textoSuave} />
          </AbsoluteFill>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: "47%",
          left: "6%",
          right: "6%",
          background: hexConAlfa("#000000", 0.72),
          border: `4px solid ${color}`,
          borderRadius: 22,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <IconoMarca tipo={nitida ? "bien" : "mal"} tamano={44} colorMal={paleta.alerta} colorBien={paleta.exito} colorTrazo="#0B0B12" />
        <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.12, color: paleta.texto }}>{nitida ? textoBien : textoMal}</span>
      </div>
    </AbsoluteFill>
  );
}

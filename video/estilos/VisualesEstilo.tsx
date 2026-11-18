// Visuales de 2 estados en los layouts del sistema de estilos (Noche,
// Color pleno, Foto): misma lógica de cambio que sus versiones de siempre
// (cambio en cuadroCambia, mismos textos), otro tratamiento. Archivo
// aparte a propósito: los componentes de siempre no se tocan.
//
// Todos toman sus colores de la PaletaEstilo activa (nunca fijos): en
// Noche/Foto van directo sobre el fondo oscuro; en Color pleno sobre una
// placa blanca con contorno y sombra dura (paleta.placa). Textos de 40px
// o más; contraste verificado en estilos.test.ts.
import { AbsoluteFill, Img, interpolate, spring } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { hexConAlfa, mezclarColoresHex, type TemaGuion } from "../tema";
import { IconoCatalogo } from "../iconosCatalogo";
import { IconoImagen, IconoMarca } from "../iconos";
import { PROTAGONISTA_ALTURA_PORCENTAJE, PROTAGONISTA_ANCHO_PORCENTAJE, PROTAGONISTA_TOP_PORCENTAJE } from "../visuales/geometria";
import { familiaDeFuenteSinCargar } from "../visuales/tamanos";
import type { PaletaEstilo } from "./estilos";

const ANCHO_PX = (PROTAGONISTA_ANCHO_PORCENTAJE / 100) * 1080;
const LADO_PORCENTAJE = (100 - PROTAGONISTA_ANCHO_PORCENTAJE) / 2;
const PADDING_PLACA_PX = 36;
const TINTA_SOBRE_COLOR = "#0B0B12";

// Caja del objeto, centrada en la zona segura. Con placa (Color pleno),
// el contenido va sobre una placa blanca que se ajusta a su alto.
function Zona({ children, paleta, gap = 24 }: { children: React.ReactNode; paleta: PaletaEstilo; gap?: number }) {
  const contenido = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap, width: "100%" }}>{children}</div>
  );
  return (
    <div
      style={{
        position: "absolute",
        top: `${PROTAGONISTA_TOP_PORCENTAJE}%`,
        height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`,
        left: `${LADO_PORCENTAJE}%`,
        width: `${PROTAGONISTA_ANCHO_PORCENTAJE}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {paleta.placa ? (
        <div
          style={{
            width: "100%",
            background: paleta.placa.fondo,
            border: `6px solid ${paleta.placa.borde}`,
            borderRadius: 32,
            boxShadow: paleta.placa.sombra,
            padding: `${PADDING_PLACA_PX}px ${PADDING_PLACA_PX}px`,
          }}
        >
          {contenido}
        </div>
      ) : (
        contenido
      )}
    </div>
  );
}

function anchoUtil(paleta: PaletaEstilo): number {
  return paleta.placa ? ANCHO_PX - PADDING_PLACA_PX * 2 - 12 : ANCHO_PX;
}

function progresoCambio(frame: number, fps: number, cuadroCambia: number, damping = 13): number {
  return frame >= cuadroCambia ? spring({ frame: frame - cuadroCambia, fps, config: { damping } }) : 0;
}

function tamanoQueCabe(texto: string, familia: string, ancho: number, min: number, max: number, peso = 900): number {
  const { fontSize } = fitText({ text: texto, withinWidth: ancho, fontFamily: familia, fontWeight: peso });
  return Math.max(min, Math.min(max, Math.floor(fontSize)));
}

// Brillo de texto solo en los estilos oscuros (en Color pleno ensucia).
function brillo(paleta: PaletaEstilo, color: string, radio: number): string | undefined {
  return paleta.placa ? undefined : `0 0 ${radio}px ${hexConAlfa(color, 0.45)}`;
}

export function IconoPalabraEstilo({
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
  paleta: PaletaEstilo;
  iconoAntes: string;
  palabraAntes: string;
  iconoDespues: string;
  palabraDespues: string;
}) {
  const despues = frame >= cuadroCambia;
  const pop = despues ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 9, stiffness: 180 } }) : 1;
  const palabra = (despues ? palabraDespues : palabraAntes).toLocaleUpperCase("es");
  const color = despues ? paleta.exito : paleta.alerta;
  const tamano = tamanoQueCabe(palabra, familiaDeFuenteSinCargar(tema.fuente), anchoUtil(paleta) - 30, 72, 220);
  const icono = despues ? iconoDespues : iconoAntes;
  return (
    <Zona paleta={paleta} gap={30}>
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.8, 1])})` }}>
        {paleta.placa ? (
          <IconoCatalogo valor={icono} tamano={300} tema={tema} variante="sobre_oscuro" colorLuz={color} colorSuperficie={mezclarColoresHex(color, "#FFFFFF", 0.85)} colorIcono={color} />
        ) : (
          <IconoCatalogo valor={icono} tamano={320} tema={tema} variante="sobre_oscuro" colorLuz={color} colorSuperficie={paleta.superficie} />
        )}
      </div>
      <div style={{ fontSize: tamano, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap", color, textShadow: brillo(paleta, color, 40), transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})` }}>
        {palabra}
      </div>
    </Zona>
  );
}

export function ContadorEstilo({ valor, etiqueta, color, paleta }: { valor: number; etiqueta: string; color: string; paleta: PaletaEstilo }) {
  return (
    <Zona paleta={paleta} gap={8}>
      <div style={{ fontSize: 400, fontWeight: 900, lineHeight: 0.95, color, textShadow: brillo(paleta, color, 60) }}>{valor}</div>
      <div style={{ fontSize: 56, fontWeight: 800, color: paleta.textoSuave, textAlign: "center" }}>{etiqueta}</div>
    </Zona>
  );
}

// Layout "golpe de dato" (Color pleno): el número enorme directo sobre el
// color plano de la escena, sin placa -- un golpe visual de ~1 s.
export function GolpeDeDato({ frame, fps, cuadroCambia, valor, etiqueta, colorTexto }: { frame: number; fps: number; cuadroCambia: number; valor: number; etiqueta: string; colorTexto: string }) {
  const golpe = frame >= cuadroCambia ? spring({ frame: frame - cuadroCambia, fps, config: { damping: 8, stiffness: 200 } }) : 0;
  return (
    <div
      style={{
        position: "absolute",
        top: `${PROTAGONISTA_TOP_PORCENTAJE}%`,
        height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`,
        left: `${LADO_PORCENTAJE}%`,
        width: `${PROTAGONISTA_ANCHO_PORCENTAJE}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        color: colorTexto,
      }}
    >
      <div style={{ fontSize: 520, fontWeight: 900, lineHeight: 0.9, transform: `scale(${1 + 0.12 * (1 - golpe) * (frame >= cuadroCambia ? 1 : 0)})`, textShadow: `10px 10px 0 ${hexConAlfa("#000000", 0.18)}` }}>{valor}</div>
      <div style={{ fontSize: 64, fontWeight: 900, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.02em" }}>{etiqueta}</div>
    </div>
  );
}

const SEGUNDOS_ENTRE_MARCAS = 0.25;
const CASILLA_PX = 64;

function CasillaEstilo({ progreso, paleta }: { progreso: number; paleta: PaletaEstilo }) {
  const marcada = progreso > 0;
  // Chulo oscuro sobre el verde claro (Noche), blanco sobre el verde de
  // bloque (Color pleno).
  const colorChulo = paleta.placa ? "#FFFFFF" : "#0B2A16";
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
        boxShadow: marcada && !paleta.placa ? `0 0 30px ${hexConAlfa(paleta.exito, 0.5)}` : "none",
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
            borderRight: `7px solid ${colorChulo}`,
            borderBottom: `7px solid ${colorChulo}`,
            transform: `rotate(45deg) scale(${interpolate(progreso, [0, 1], [0.4, 1])})`,
            opacity: progreso,
          }}
        />
      )}
    </div>
  );
}

export function ChecklistEstilo({
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
  paleta: PaletaEstilo;
  titulo?: string;
  items: string[];
}) {
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const anchoItem = anchoUtil(paleta) - CASILLA_PX - 28 - 16;
  const tamano = Math.min(...items.map((i) => tamanoQueCabe(i, familia, anchoItem, 44, 72, 800)));
  return (
    <Zona paleta={paleta} gap={30}>
      {titulo && <div style={{ fontSize: 50, fontWeight: 900, color: paleta.luz, textTransform: "uppercase", letterSpacing: "0.03em", alignSelf: "flex-start" }}>{titulo}</div>}
      {items.map((item, i) => {
        const cuadro = cuadroCambia + Math.round(i * SEGUNDOS_ENTRE_MARCAS * fps);
        const progreso = frame >= cuadro ? spring({ frame: frame - cuadro, fps, config: { damping: 12 } }) : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, alignSelf: "flex-start" }}>
            <CasillaEstilo progreso={progreso} paleta={paleta} />
            <span style={{ fontSize: tamano, fontWeight: 800, lineHeight: 1.1, color: progreso > 0 ? paleta.texto : paleta.textoSuave }}>{item}</span>
          </div>
        );
      })}
    </Zona>
  );
}

function Franja({ marca, etiqueta, texto, color, tamanoTexto, paleta, estilo }: { marca: "mal" | "bien"; etiqueta: string; texto: string; color: string; tamanoTexto: number; paleta: PaletaEstilo; estilo: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: "47%",
        background: paleta.placa ? paleta.placa.fondo : paleta.superficie,
        borderTop: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined,
        borderRight: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined,
        borderBottom: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined,
        borderLeft: `14px solid ${color}`,
        borderRadius: 24,
        padding: "16px 30px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 8,
        boxShadow: paleta.placa ? paleta.placa.sombra : `0 0 50px ${hexConAlfa(color, 0.18)}`,
        ...estilo,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconoMarca tipo={marca} tamano={44} colorMal={paleta.alerta} colorBien={paleta.exito} colorTrazo={paleta.placa ? "#FFFFFF" : TINTA_SOBRE_COLOR} />
        <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, color, textTransform: "uppercase", letterSpacing: "0.03em" }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: tamanoTexto, fontWeight: 800, lineHeight: 1.12, color: paleta.texto }}>{texto}</div>
    </div>
  );
}

export function ComparacionEstilo({
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
  paleta: PaletaEstilo;
  textoMal: string;
  textoBien: string;
  etiquetaMal?: string;
  etiquetaBien?: string;
}) {
  const progreso = progresoCambio(frame, fps, cuadroCambia, 15);
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const anchoTexto = (ANCHO_PX - 14 - 60) * 1.8;
  const tamano = Math.min(tamanoQueCabe(textoMal, familia, anchoTexto, 42, 56, 800), tamanoQueCabe(textoBien, familia, anchoTexto, 42, 56, 800));
  // Antes: solo el error, centrado. Después: sube y se apaga, entra lo correcto.
  const bajada = interpolate(progreso, [0, 1], [56, 0]);
  return (
    <div style={{ position: "absolute", top: `${PROTAGONISTA_TOP_PORCENTAJE}%`, height: `${PROTAGONISTA_ALTURA_PORCENTAJE}%`, left: `${LADO_PORCENTAJE}%`, width: `${PROTAGONISTA_ANCHO_PORCENTAJE}%` }}>
      <Franja marca="mal" etiqueta={etiquetaMal} texto={textoMal} color={paleta.alerta} tamanoTexto={tamano} paleta={paleta} estilo={{ top: 0, transform: `translateY(${bajada}%)`, opacity: interpolate(progreso, [0, 1], [1, 0.5]) }} />
      <Franja marca="bien" etiqueta={etiquetaBien} texto={textoBien} color={paleta.exito} tamanoTexto={tamano} paleta={paleta} estilo={{ bottom: 0, opacity: progreso, transform: `translateY(${interpolate(progreso, [0, 1], [40, 0])}px)` }} />
    </div>
  );
}

// Foto real de la marca dentro de una caja, de oscura/borrosa a nítida.
function FotoCambio({ urlFoto, progreso, fondo, textoSuave }: { urlFoto: string | null; progreso: number; fondo: string; textoSuave: string }) {
  if (!urlFoto) {
    return (
      <AbsoluteFill style={{ background: fondo, alignItems: "center", justifyContent: "center" }}>
        <IconoImagen tamano={160} color={textoSuave} />
      </AbsoluteFill>
    );
  }
  return (
    <Img
      src={urlFoto}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        filter: `blur(${interpolate(progreso, [0, 1], [10, 0])}px) brightness(${interpolate(progreso, [0, 1], [0.4, 1])})`,
        transform: `scale(${interpolate(progreso, [0, 1], [1.08, 1.0])})`,
      }}
    />
  );
}

function ChipTexto({ marca, texto, color, paleta, estilo }: { marca: "mal" | "bien"; texto: string; color: string; paleta: PaletaEstilo; estilo: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        right: "6%",
        background: paleta.placa ? paleta.placa.fondo : hexConAlfa("#000000", 0.72),
        border: `${paleta.placa ? 6 : 4}px solid ${paleta.placa ? paleta.placa.borde : color}`,
        boxShadow: paleta.placa ? paleta.placa.sombra : undefined,
        borderRadius: 22,
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        ...estilo,
      }}
    >
      <IconoMarca tipo={marca} tamano={48} colorMal={paleta.alerta} colorBien={paleta.exito} colorTrazo={paleta.placa ? "#FFFFFF" : TINTA_SOBRE_COLOR} />
      <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.12, color: paleta.placa ? paleta.texto : "#FFFFFF" }}>{texto}</span>
    </div>
  );
}

// Objeto protagonista con foto (Noche): la foto de borde a borde en una
// franja ancha, con el texto en un chip encima.
export function ComparacionFotoEstilo({ frame, fps, cuadroCambia, paleta, urlFoto, textoMal, textoBien }: { frame: number; fps: number; cuadroCambia: number; paleta: PaletaEstilo; urlFoto: string | null; textoMal: string; textoBien: string }) {
  const nitida = frame >= cuadroCambia;
  const progreso = progresoCambio(frame, fps, cuadroCambia, 14);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: "20%", height: "34%", left: 0, right: 0, overflow: "hidden", borderTop: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined, borderBottom: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined }}>
        <FotoCambio urlFoto={urlFoto} progreso={progreso} fondo={paleta.fondoProfundo} textoSuave={paleta.textoSuave} />
      </div>
      <ChipTexto marca={nitida ? "bien" : "mal"} texto={nitida ? textoBien : textoMal} color={nitida ? paleta.exito : paleta.alerta} paleta={paleta} estilo={{ top: "46%" }} />
    </AbsoluteFill>
  );
}

// Layout "foto de borde a borde" (estilo Foto): la foto ES la escena, a
// pantalla completa, de oscura y borrosa a nítida.
export function FotoBordeABorde({ frame, fps, cuadroCambia, paleta, urlFoto, textoMal, textoBien }: { frame: number; fps: number; cuadroCambia: number; paleta: PaletaEstilo; urlFoto: string | null; textoMal: string; textoBien: string }) {
  const nitida = frame >= cuadroCambia;
  const progreso = progresoCambio(frame, fps, cuadroCambia, 14);
  return (
    <AbsoluteFill>
      <FotoCambio urlFoto={urlFoto} progreso={progreso} fondo={paleta.fondoProfundo} textoSuave={paleta.textoSuave} />
      {/* Velo abajo para que el chip y los subtítulos se lean sobre cualquier foto. */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75) 100%)" }} />
      <ChipTexto marca={nitida ? "bien" : "mal"} texto={nitida ? textoBien : textoMal} color={nitida ? paleta.exito : paleta.alerta} paleta={paleta} estilo={{ top: "45%" }} />
    </AbsoluteFill>
  );
}

// Layout "pantalla dividida": arriba lo que está mal, abajo lo que está
// bien, de borde a borde. Con foto: la misma foto oscura arriba y nítida
// abajo. Color pleno: bloques sólidos alerta/éxito (texto blanco, 5,4:1).
export function PantallaDividida({
  frame,
  fps,
  cuadroCambia,
  tema,
  paleta,
  textoMal,
  textoBien,
  etiquetaMal = "Así no",
  etiquetaBien = "Así sí",
  urlFoto,
}: {
  frame: number;
  fps: number;
  cuadroCambia: number;
  tema: TemaGuion;
  paleta: PaletaEstilo;
  textoMal: string;
  textoBien: string;
  etiquetaMal?: string;
  etiquetaBien?: string;
  // Solo comparacion_foto: la foto en las dos mitades.
  urlFoto?: string | null;
}) {
  const progreso = progresoCambio(frame, fps, cuadroCambia, 14);
  const familia = familiaDeFuenteSinCargar(tema.fuente);
  const tamano = Math.min(tamanoQueCabe(textoMal, familia, 1080 * 0.82 * 1.8, 42, 58, 800), tamanoQueCabe(textoBien, familia, 1080 * 0.82 * 1.8, 42, 58, 800));
  const fondoMal = paleta.placa ? paleta.alerta : mezclarColoresHex(paleta.alerta, paleta.fondo, 0.72);
  const fondoBien = paleta.placa ? paleta.exito : mezclarColoresHex(paleta.exito, paleta.fondo, 0.72);
  const conFoto = urlFoto !== undefined;
  const mitad = (marca: "mal" | "bien", etiqueta: string, texto: string, fondo: string, progresoFoto: number, estilo: React.CSSProperties) => (
    <div style={{ position: "absolute", left: 0, right: 0, height: "17%", overflow: "hidden", background: fondo, borderTop: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined, borderBottom: paleta.placa ? `6px solid ${paleta.placa.borde}` : undefined, ...estilo }}>
      {conFoto && (
        <>
          <FotoCambio urlFoto={urlFoto ?? null} progreso={progresoFoto} fondo={paleta.fondoProfundo} textoSuave={paleta.textoSuave} />
          <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 75%)" }} />
        </>
      )}
      <div style={{ position: "absolute", left: "6%", right: "6%", top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconoMarca tipo={marca} tamano={48} colorMal="#FFFFFF" colorBien="#FFFFFF" colorTrazo={marca === "mal" ? paleta.alerta : paleta.exito} />
          <span style={{ fontSize: 46, fontWeight: 900, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.03em" }}>{etiqueta}</span>
        </div>
        <div style={{ fontSize: tamano, fontWeight: 800, lineHeight: 1.1, color: "#FFFFFF" }}>{texto}</div>
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      {mitad("mal", etiquetaMal, textoMal, fondoMal, 0, { top: "20%", opacity: interpolate(progreso, [0, 1], [1, 0.75]) })}
      {mitad("bien", etiquetaBien, textoBien, fondoBien, 1, { top: "37%", opacity: progreso, transform: `translateX(${interpolate(progreso, [0, 1], [100, 0])}%)` })}
    </AbsoluteFill>
  );
}

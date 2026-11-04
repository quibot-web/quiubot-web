import { AbsoluteFill, Img, OffthreadVideo } from "remotion";
import type { MediaResuelto } from "../escenas/tipos";
import type { TemaGuion } from "../tema";

// Los 3 tratamientos de imagen (sección "Tratamientos de imagen" del
// plan) compartidos entre GanchoTexto y ProductoHero -- una sola vez,
// no una copia por escena. "completa" (con Ken Burns y el sesgo hacia
// recuadro_producto) se queda en cada escena por separado porque
// necesita sus propios cuadros/animación; estos dos son estáticos.

function MediaPlano({ media, style }: { media: MediaResuelto; style: React.CSSProperties }) {
  return media.tipo === "video" ? (
    <OffthreadVideo src={media.url} muted style={style} />
  ) : (
    <Img src={media.url} style={style} />
  );
}

// "centro": la escena entera es la pieza (ProductoHero -- la leyenda
// vive en una franja chica abajo). "arriba": el gancho necesita dejar
// libre la mitad inferior para su propio titular grande, así que el
// tratamiento se achica y sube.
type Anclaje = "centro" | "arriba";

// La imagen completa, sin recortar (nunca le corta texto impreso), con
// sombra y un fondo difuminado de la misma pieza detrás -- para que no
// quede un hueco donde la imagen no llena el cuadro 9:16.
export function MediaTarjeta({ media, anclaje = "centro" }: { media: MediaResuelto; anclaje?: Anclaje }) {
  const arriba = anclaje === "arriba";
  return (
    <AbsoluteFill
      style={{
        justifyContent: arriba ? "flex-start" : "center",
        alignItems: "center",
        padding: arriba ? "10% 9% 0" : "0 9% 30%",
      }}
    >
      {/* El fondo difuminado solo tiene sentido en "centro" (ProductoHero,
          donde la tarjeta ocupa casi toda la pantalla) -- en "arriba"
          (gancho) un AbsoluteFill tapa TODO el cuadro sin importar el
          padding del contenedor, incluida la zona del titular de abajo.
          El gancho ya tiene su propio FondoMarca detrás. */}
      {!arriba && (
        <AbsoluteFill>
          <MediaPlano
            media={media}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(50px) brightness(0.5)", transform: "scale(1.25)" }}
          />
        </AbsoluteFill>
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxHeight: arriba ? "38%" : "60%",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
          lineHeight: 0,
        }}
      >
        <MediaPlano media={media} style={{ width: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
      </div>
    </AbsoluteFill>
  );
}

// La pieza dentro de un marco de teléfono, como si fuera un post real
// -- dibujado en código (mismo criterio que el resto de video/: nada de
// assets nuevos en public/).
export function MediaCelular({ media, tema, anclaje = "centro" }: { media: MediaResuelto; tema: TemaGuion; anclaje?: Anclaje }) {
  const arriba = anclaje === "arriba";
  return (
    <AbsoluteFill
      style={{
        justifyContent: arriba ? "flex-start" : "center",
        alignItems: "center",
        padding: arriba ? "6% 20% 0" : "0 13% 24%",
      }}
    >
      <div
        style={{
          position: "relative",
          // Siempre se dimensiona por ALTO, nunca por ancho: con este
          // aspect-ratio tan vertical, un teléfono sacado del 100% del
          // ancho disponible queda más alto que todo el cuadro 9:16 y se
          // sale por abajo, encima de la leyenda.
          height: arriba ? "27%" : "68%",
          width: "auto",
          aspectRatio: "9 / 18.5",
          background: "#0a0a0a",
          borderRadius: 52,
          padding: 14,
          boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 38, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: tema.color_primario, flexShrink: 0 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>tu_marca</div>
          </div>
          <div style={{ flex: 1, position: "relative", background: "#f2f2f2" }}>
            <MediaPlano media={media} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

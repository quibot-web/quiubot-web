"use client";
import { useRef, useState } from "react";
import { urlOptimizadaCloudinary, urlPortadaVideo } from "@/app/lib/cloudinaryUrl";
import { validarImagenPropia, validarVideoPropio } from "@/app/lib/imagenes";

// Piezas compartidas entre /album (la página completa) y SelectorAlbum
// (la ventana que se abre dentro de ElegirEstrategia/estrategia) --
// mismos valores exactos de la maqueta aprobada (docs/diseno/
// album_creativos.html), para que las dos se vean idénticas. La única
// diferencia entre ambas vive en quien las usa: /album abre un panel de
// detalle al tocar una pieza; SelectorAlbum la elige y cierra.
export type ItemAlbum = { id?: string; url_imagen: string; tipo: string; public_id: string; creado_en?: string };

export type Filtro = "todos" | "imagen" | "video";

export const COLOR_MARCA = "#5546B8";
export const COLOR_MARCA_SUAVE = "#EFEDFB";
export const COLOR_FONDO = "#F8F8F6";
export const COLOR_BORDE = "#E9E7EE";
export const COLOR_TEXTO = "#1B1A22";
export const COLOR_TEXTO_SUAVE = "#6B6880";

export function formatearDuracion(segundos: number): string {
  const total = Math.round(segundos);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatearFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function formatearFechaLarga(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Esta semana / Este mes / Antes -- recalculado sobre TODO lo ya cargado
// cada vez que llega una página nueva (los items vienen ordenados desc
// por el servidor, pero una página puede cruzar el límite entre dos
// grupos, así que cada item se reclasifica por su propia fecha).
export function agruparPorFecha(items: ItemAlbum[]) {
  const ahora = Date.now();
  const unDiaMs = 24 * 60 * 60 * 1000;
  const grupos: { titulo: string; items: ItemAlbum[] }[] = [
    { titulo: "Esta semana", items: [] },
    { titulo: "Este mes", items: [] },
    { titulo: "Antes", items: [] },
  ];
  for (const item of items) {
    if (!item.creado_en) {
      grupos[2].items.push(item);
      continue;
    }
    const diasDesde = (ahora - new Date(item.creado_en).getTime()) / unDiaMs;
    if (diasDesde <= 7) grupos[0].items.push(item);
    else if (diasDesde <= 30) grupos[1].items.push(item);
    else grupos[2].items.push(item);
  }
  return grupos.filter((g) => g.items.length > 0);
}

// Mismas validaciones que ya usa "Subir el mío" en ElegirEstrategia
// (tipo de archivo, dimensión mínima de imagen, duración de video) --
// reusadas tal cual acá para que subir desde el álbum exija lo mismo,
// en vez de aceptar cualquier archivo sin revisar nada.
export async function subirArchivoValidado(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const esVideo = file.type.startsWith("video/");
  const validacion = esVideo ? await validarVideoPropio(file) : await validarImagenPropia(file);
  if (!validacion.ok) return { ok: false, error: validacion.error };

  const formData = new FormData();
  formData.append("archivo", file);
  const res = await fetch("/api/album/subir", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "No se pudo subir el archivo." };
  return { ok: true };
}

export function ChipsFiltro({ filtro, onCambiar }: { filtro: Filtro; onCambiar: (f: Filtro) => void }) {
  return (
    <div className="qb-album-chips">
      {([["todos", "Todos"], ["imagen", "Imágenes"], ["video", "Videos"]] as [Filtro, string][]).map(([valor, etiqueta]) => (
        <button
          key={valor}
          onClick={() => onCambiar(valor)}
          className={`qb-album-chip${filtro === valor ? " on" : ""}`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Esqueleto() {
  return <div className="qb-album-skel" />;
}

// Tarjeta 4:5 -- miniatura optimizada (w_400,f_auto,q_auto); en video,
// portada de Cloudinary (urlPortadaVideo) + preload="metadata" (la
// duración real para la etiqueta, nunca el archivo completo) y
// reproducción solo al pasar el mouse o tocar.
export function TarjetaAlbum({
  item,
  modoSeleccion,
  seleccionado,
  yaUsadaEn,
  onClick,
}: {
  item: ItemAlbum;
  modoSeleccion?: boolean;
  seleccionado?: boolean;
  yaUsadaEn?: string;
  onClick: () => void;
}) {
  const esVideo = item.tipo === "video";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duracion, setDuracion] = useState<number | null>(null);

  const miniatura = esVideo
    ? urlOptimizadaCloudinary(urlPortadaVideo(item.url_imagen), 400)
    : urlOptimizadaCloudinary(item.url_imagen, 400);

  const reproducir = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };
  const detener = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={reproducir}
      onMouseLeave={detener}
      onTouchStart={(e) => { e.stopPropagation(); reproducir(); }}
      className={`qb-album-tarjeta${seleccionado ? " sel" : ""}`}
    >
      {esVideo ? (
        <video
          ref={videoRef}
          src={item.url_imagen}
          poster={miniatura}
          preload="metadata"
          muted
          loop
          playsInline
          onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
          className="qb-album-media"
        />
      ) : (
        <img src={miniatura} alt="" loading="lazy" className="qb-album-media" />
      )}

      {esVideo && (
        <div className="qb-album-play">
          <span>▶</span>
        </div>
      )}

      <div className="qb-album-arriba">
        <span className="qb-album-badge">
          {esVideo ? `Video${duracion ? ` · ${formatearDuracion(duracion)}` : ""}` : "Imagen"}
        </span>
        <span className={`qb-album-check${modoSeleccion ? " modo" : ""}`} />
      </div>

      {yaUsadaEn ? (
        <div className="qb-album-usada">Ya usada en {yaUsadaEn}</div>
      ) : (
        item.creado_en && (
          <div className="qb-album-abajo">
            <span>{formatearFechaCorta(item.creado_en)}</span>
          </div>
        )
      )}
    </div>
  );
}

// Estilos compartidos -- un solo <style> para que /album y SelectorAlbum
// pinten exactamente lo mismo. Valores tal cual de la maqueta aprobada.
export function EstilosAlbum() {
  return (
    <style>{`
      .qb-album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 12px; }
      @media (max-width: 520px) { .qb-album-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; } }

      .qb-album-tarjeta { position: relative; border-radius: 16px; overflow: hidden; aspect-ratio: 4 / 5; cursor: pointer; background: #ddd; outline: 3px solid transparent; transition: transform .15s, outline-color .15s; }
      .qb-album-tarjeta:hover { transform: translateY(-2px); }
      .qb-album-tarjeta.sel { outline-color: ${COLOR_MARCA}; }
      .qb-album-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
      .qb-album-arriba { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; }
      .qb-album-badge { font-size: 11px; font-weight: 800; border-radius: 999px; padding: 3px 8px; background: rgba(255,255,255,.92); color: ${COLOR_TEXTO}; }
      .qb-album-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; background: rgba(0,0,0,.25); opacity: 0; transition: opacity .15s; flex-shrink: 0; }
      .qb-album-tarjeta:hover .qb-album-check, .qb-album-check.modo { opacity: 1; }
      .qb-album-tarjeta.sel .qb-album-check { background: ${COLOR_MARCA}; opacity: 1; }
      .qb-album-abajo { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 10px 9px; background: linear-gradient(transparent, rgba(0,0,0,.55)); color: #fff; font-size: 12px; font-weight: 600; display: flex; justify-content: flex-end; align-items: end; }
      .qb-album-usada { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,.65); color: #fff; font-size: 10px; padding: 4px 6px; text-align: center; line-height: 1.3; }
      .qb-album-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
      .qb-album-play span { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.9); display: grid; place-items: center; font-size: 14px; }

      .qb-album-skel { border-radius: 16px; aspect-ratio: 4 / 5; background: linear-gradient(90deg, #ECEAF2 25%, #F6F5FA 50%, #ECEAF2 75%); background-size: 200% 100%; animation: qb-album-sh 1.2s infinite; }
      @keyframes qb-album-sh { to { background-position: -200% 0; } }

      .qb-album-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .qb-album-chip { border: 1.5px solid ${COLOR_BORDE}; background: #fff; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13.5px; font-weight: 600; color: ${COLOR_TEXTO_SUAVE}; cursor: pointer; }
      .qb-album-chip.on { border-color: ${COLOR_MARCA}; background: ${COLOR_MARCA_SUAVE}; color: ${COLOR_MARCA}; }

      @keyframes qb-album-spin { to { transform: rotate(360deg); } }
      .qb-album-spin { animation: qb-album-spin .9s linear infinite; }
    `}</style>
  );
}

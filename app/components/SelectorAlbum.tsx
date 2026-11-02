"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Upload, Loader2 } from "lucide-react";
import { urlOptimizadaCloudinary, urlPortadaVideo } from "@/app/lib/cloudinaryUrl";

// Extraído tal cual del modal que ya vivía inline en app/estrategia/
// page.tsx (paso "album-selector") -- mismo markup, mismo comportamiento,
// solo parametrizado para poder usarse también desde ElegirEstrategia.tsx
// (elegir álbum dentro de la propia tarjeta del anuncio, en vez de en un
// paso aparte).
//
// A diferencia de antes: ya NO recibe "items" por prop -- el padre ya no
// carga el álbum completo (eso era lo que lo hacía lento con álbumes
// grandes). Este componente pide sus propias páginas de 24 a
// GET /api/album, con scroll infinito + filtro por tipo + agrupado por
// fecha, todo resuelto del lado del servidor o acá mismo, nunca con el
// álbum completo en memoria del padre.
//
// yaUsadaPorUrl reemplaza al viejo yaUsadaPorId: antes buscaba el
// public_id cruzando contra la lista completa del álbum que el padre
// tenía cargada -- ahora que el padre no la tiene, se compara directo
// por url_imagen (que ElegirEstrategia ya tiene a mano en sus propios
// creativos, sin necesidad de mirar el álbum para nada).
export type ItemAlbum = { id?: string; url_imagen: string; tipo: string; public_id: string; creado_en?: string };

type Props = {
  titulo: string;
  onElegir: (item: ItemAlbum) => void;
  onCerrar: () => void;
  yaUsadaPorUrl?: Record<string, string>;
};

const LIMITE_PAGINA = 24;
type Filtro = "todos" | "imagen" | "video";

function formatearDuracion(segundos: number): string {
  const total = Math.round(segundos);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

// Tarjeta 4:5 -- imagen/portada de video optimizadas (w_400,f_auto,q_auto,
// y la portada además recortada al segundo 1 para video). El video real
// solo se pide con preload="metadata" (la duración para la etiqueta, no
// el archivo completo) y solo se reproduce al pasar el mouse o tocarlo.
function TarjetaAlbum({ item, yaUsadaEn, onClick }: { item: ItemAlbum; yaUsadaEn?: string; onClick: () => void }) {
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
      style={{
        position: "relative", aspectRatio: "4 / 5", borderRadius: 14, overflow: "hidden",
        cursor: "pointer", border: "1px solid #e8e8e6", background: "#f3f2fe",
      }}
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
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <img src={miniatura} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}

      <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99 }}>
        {esVideo ? `Video${duracion ? ` · ${formatearDuracion(duracion)}` : ""}` : "Imagen"}
      </span>

      <span style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.92)", color: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={13} strokeWidth={3} />
      </span>

      {yaUsadaEn && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.65)", color: "#fff", fontSize: 10, padding: "4px 6px", textAlign: "center", lineHeight: 1.3 }}>
          Ya usada en {yaUsadaEn}
        </div>
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <div style={{ aspectRatio: "4 / 5", borderRadius: 14, background: "#f0eff7", animation: "album-pulso 1.4s ease-in-out infinite" }} />
  );
}

// Esta semana / Este mes / Antes -- recalculado sobre TODO lo ya cargado
// cada vez que llega una página nueva (los items ya vienen ordenados
// desc por el servidor, pero una página puede cruzar el límite entre
// dos grupos, así que se reclasifica cada item por su propia fecha en
// vez de asumir que el corte cae justo entre páginas).
function agruparPorFecha(items: ItemAlbum[]) {
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

export default function SelectorAlbum({ titulo, onElegir, onCerrar, yaUsadaPorUrl }: Props) {
  const [items, setItems] = useState<ItemAlbum[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [subiendo, setSubiendo] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const centinelaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // La función "cargar más" cambia en cada render (depende de cursor/
  // filtro) -- el observer se registra una sola vez, así que lee la
  // versión más reciente a través de este ref en vez de quedarse con
  // una vieja (cursor desactualizado) atrapada en su closure.
  const cargarMasRef = useRef<() => void>(() => {});

  const cargarPagina = async (reiniciar: boolean, cursorActual: string | null) => {
    if (reiniciar) setCargandoInicial(true);
    else setCargandoMas(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMITE_PAGINA) });
      if (filtro !== "todos") params.set("tipo", filtro);
      if (!reiniciar && cursorActual) params.set("cursor", cursorActual);

      const res = await fetch(`/api/album?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cargar tu álbum.");

      setItems((prev) => (reiniciar ? data.imagenes || [] : [...prev, ...(data.imagenes || [])]));
      setCursor(data.siguienteCursor || null);
      setHayMas(!!data.siguienteCursor);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo cargar tu álbum.");
    } finally {
      setCargandoInicial(false);
      setCargandoMas(false);
    }
  };

  // Primera carga y cada vez que cambia el filtro -- siempre reinicia
  // desde cero (cursor null), nunca mezcla páginas de dos filtros.
  useEffect(() => {
    cargarPagina(true, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  cargarMasRef.current = () => {
    if (cargandoInicial || cargandoMas || !hayMas) return;
    cargarPagina(false, cursor);
  };

  // IntersectionObserver sobre el contenedor con scroll del PROPIO modal
  // (no la ventana, que acá no se mueve) -- el botón "Cargar más" de
  // abajo es el respaldo si el observer no dispara por algún motivo.
  useEffect(() => {
    const centinela = centinelaRef.current;
    const raiz = scrollRef.current;
    if (!centinela || !raiz) return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) cargarMasRef.current();
      },
      { root: raiz, rootMargin: "200px" }
    );
    observer.observe(centinela);
    return () => observer.disconnect();
  }, []);

  const handleSubir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      const res = await fetch("/api/album/subir", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo subir el archivo.");
      await cargarPagina(true, null);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo subir el archivo.");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const grupos = agruparPorFecha(items);
  const vacio = !cargandoInicial && items.length === 0 && !errorMsg;

  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem 0.75rem", flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{titulo}</p>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Filtros fijos arriba al hacer scroll adentro del modal. */}
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff", display: "flex", gap: 8, padding: "0 1.5rem 0.75rem", borderBottom: "1px solid #e8e8e6", flexShrink: 0 }}>
          {([["todos", "Todos"], ["imagen", "Imágenes"], ["video", "Videos"]] as [Filtro, string][]).map(([valor, etiqueta]) => (
            <button
              key={valor}
              onClick={() => setFiltro(valor)}
              style={{
                border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: filtro === valor ? "#534AB7" : "#f3f2fe",
                color: filtro === valor ? "#fff" : "#534AB7",
              }}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div ref={scrollRef} style={{ overflowY: "auto", padding: "1rem 1.5rem 1.5rem", flex: 1 }}>
          {errorMsg && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 14 }}>
              {errorMsg}
            </div>
          )}

          {cargandoInicial && (
            <div className="album-grid">
              {Array.from({ length: 12 }).map((_, i) => <Esqueleto key={i} />)}
            </div>
          )}

          {vacio && (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
                {filtro === "todos" ? "Tu álbum todavía está vacío." : `No tienes ${filtro === "video" ? "videos" : "imágenes"} en tu álbum.`}
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#534AB7", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: subiendo ? "not-allowed" : "pointer" }}
              >
                {subiendo ? <Loader2 size={15} className="album-spin" /> : <Upload size={15} />}
                {subiendo ? "Subiendo..." : "Subir creativos"}
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleSubir} />
            </div>
          )}

          {!cargandoInicial && items.length > 0 && (
            <>
              {grupos.map((grupo) => (
                <div key={grupo.titulo} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
                    {grupo.titulo}
                  </p>
                  <div className="album-grid">
                    {grupo.items.map((item, i) => (
                      <TarjetaAlbum
                        key={item.id || item.public_id || `${grupo.titulo}-${i}`}
                        item={item}
                        yaUsadaEn={yaUsadaPorUrl?.[item.url_imagen]}
                        onClick={() => onElegir(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {cargandoMas && (
                <div className="album-grid">
                  {Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} />)}
                </div>
              )}

              {hayMas && !cargandoMas && (
                <button
                  onClick={() => cargarMasRef.current()}
                  style={{ display: "block", margin: "8px auto 0", background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cargar más
                </button>
              )}
            </>
          )}

          {/* Siempre montado en la misma posición del árbol (nunca
              adentro de un condicional que lo desmonte) -- el observer
              de abajo se registra una sola vez sobre este mismo nodo;
              si se desmontara con cada cambio de filtro, quedaría
              observando un nodo ya removido y el scroll infinito dejaría
              de disparar después del primer cambio de filtro. */}
          <div ref={centinelaRef} style={{ height: 1 }} />
        </div>
      </div>

      <style>{`
        @keyframes album-pulso { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
        @keyframes album-spin { to { transform: rotate(360deg); } }
        .album-spin { animation: album-spin 0.9s linear infinite; }

        /* 2 columnas en celular, 4 a 6 en escritorio -- con breakpoints
           explícitos en vez de auto-fill, que en los 760px del modal no
           llegaba de forma confiable a 4-6 columnas. */
        .album-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 480px) { .album-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 680px) { .album-grid { grid-template-columns: repeat(6, 1fr); } }
      `}</style>
    </div>
  );
}

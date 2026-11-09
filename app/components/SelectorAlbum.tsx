"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import {
  ChipsFiltro,
  Esqueleto,
  TarjetaAlbum,
  EstilosAlbum,
  agruparPorFecha,
  subirArchivoValidado,
  type ItemAlbum,
} from "@/app/components/album/AlbumUI";
import { useAlbumPaginado } from "@/app/components/album/useAlbumPaginado";

// Ventana que se abre dentro de ElegirEstrategia/estrategia para elegir
// una pieza del álbum -- usa exactamente los mismos componentes que
// /album (tarjeta, chips, grilla, skeletons, ver app/components/album/
// AlbumUI.tsx) para que se vean idénticas. La diferencia es nada más
// esta: tocar una pieza la elige y cierra el modal, en vez de abrir un
// panel de detalle.
//
// Ya no recibe "items" por prop -- pagina su propio álbum con
// useAlbumPaginado, igual que /album.
export type { ItemAlbum };

type Props = {
  titulo: string;
  onElegir: (item: ItemAlbum) => void;
  onCerrar: () => void;
  yaUsadaPorUrl?: Record<string, string>;
  // Modo selección múltiple (ej. fotos de un producto, varias piezas
  // de una campaña): tocar una pieza la marca en vez de elegirla ya
  // mismo, y una barra abajo confirma "Agregar N" -- igual que /album.
  // Con multiple:true, onElegir nunca se llama; se usa onElegirVarios.
  multiple?: boolean;
  onElegirVarios?: (items: ItemAlbum[]) => void;
  maxSeleccion?: number;
};

export default function SelectorAlbum({ titulo, onElegir, onCerrar, yaUsadaPorUrl, multiple, onElegirVarios, maxSeleccion }: Props) {
  const album = useAlbumPaginado();
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const [seleccionIds, setSeleccionIds] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const centinelaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cargarMasRef = useRef(() => {});
  cargarMasRef.current = album.cargarMas;

  // IntersectionObserver sobre el contenedor con scroll del PROPIO modal
  // (no la ventana, que acá no se mueve) -- siempre montado en la misma
  // posición del árbol (ver el comentario junto al div de abajo).
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
    setErrorSubida(null);
    const resultado = await subirArchivoValidado(archivo);
    if (resultado.ok) {
      await album.recargar();
    } else {
      setErrorSubida(resultado.error);
    }
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const grupos = agruparPorFecha(album.items);
  const vacio = !album.cargandoInicial && album.items.length === 0 && !album.errorMsg;
  const tope = maxSeleccion ?? Infinity;

  function alTocarPieza(item: ItemAlbum) {
    if (!multiple) {
      onElegir(item);
      return;
    }
    if (!item.id) return;
    setSeleccionIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id!)) {
        next.delete(item.id!);
      } else if (next.size < tope) {
        next.add(item.id!);
      }
      return next;
    });
  }

  function confirmarSeleccionMultiple() {
    const elegidos = album.items.filter((it) => it.id && seleccionIds.has(it.id));
    onElegirVarios?.(elegidos);
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <EstilosAlbum />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem 0.75rem", flexShrink: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1B1A22", margin: 0 }}>{titulo}</p>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: "#6B6880", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff", padding: "0 1.5rem 0.75rem", borderBottom: `1px solid #E9E7EE`, flexShrink: 0 }}>
          <ChipsFiltro filtro={album.filtro} onCambiar={album.setFiltro} />
        </div>

        <div ref={scrollRef} style={{ overflowY: "auto", padding: "1rem 1.5rem 1.5rem", flex: 1 }}>
          {(album.errorMsg || errorSubida) && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 14 }}>
              {errorSubida || album.errorMsg}
            </div>
          )}

          {album.cargandoInicial && (
            <div className="qb-album-grid">
              {Array.from({ length: 12 }).map((_, i) => <Esqueleto key={i} />)}
            </div>
          )}

          {vacio && (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ fontSize: 14, color: "#6B6880", marginBottom: 16 }}>
                {album.filtro === "todos" ? "Tu álbum todavía está vacío." : `No tienes ${album.filtro === "video" ? "videos" : "imágenes"} en tu álbum.`}
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#5546B8", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: subiendo ? "not-allowed" : "pointer" }}
              >
                {subiendo ? <Loader2 size={15} className="qb-album-spin" /> : <Upload size={15} />}
                {subiendo ? "Subiendo..." : "Subir creativos"}
              </button>
              <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleSubir} />
            </div>
          )}

          {!album.cargandoInicial && album.items.length > 0 && (
            <>
              {grupos.map((grupo) => (
                <div key={grupo.titulo} style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6880", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 10px" }}>
                    {grupo.titulo}
                  </p>
                  <div className="qb-album-grid">
                    {grupo.items.map((item, i) => (
                      <TarjetaAlbum
                        key={item.id || item.public_id || `${grupo.titulo}-${i}`}
                        item={item}
                        yaUsadaEn={yaUsadaPorUrl?.[item.url_imagen]}
                        modoSeleccion={multiple}
                        seleccionado={!!item.id && seleccionIds.has(item.id)}
                        onClick={() => alTocarPieza(item)}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {album.cargandoMas && (
                <div className="qb-album-grid">
                  {Array.from({ length: 6 }).map((_, i) => <Esqueleto key={i} />)}
                </div>
              )}

              {album.hayMas && !album.cargandoMas && (
                <button
                  onClick={() => album.cargarMas()}
                  style={{ display: "block", margin: "8px auto 0", background: "#fff", border: "1px solid #E9E7EE", color: "#5546B8", padding: "9px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cargar más
                </button>
              )}
            </>
          )}

          {/* Siempre montado en la misma posición del árbol (nunca
              adentro de un condicional que lo desmonte) -- el observer
              de arriba se registra una sola vez sobre este mismo nodo;
              si se desmontara con cada cambio de filtro, quedaría
              observando un nodo ya removido y el scroll infinito dejaría
              de disparar después del primer cambio de filtro. */}
          <div ref={centinelaRef} style={{ height: 1 }} />
        </div>

        {multiple && seleccionIds.size > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "10px 1.5rem", borderTop: "1px solid #E9E7EE", flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1B1A22" }}>
              {seleccionIds.size} seleccionada{seleccionIds.size !== 1 ? "s" : ""}
              {Number.isFinite(tope) ? ` de ${tope}` : ""}
            </span>
            <button
              onClick={confirmarSeleccionMultiple}
              style={{ border: "none", background: "#5546B8", color: "#fff", borderRadius: 12, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
            >
              Agregar {seleccionIds.size}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

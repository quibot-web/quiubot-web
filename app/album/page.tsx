"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import {
  ChipsFiltro,
  Esqueleto,
  TarjetaAlbum,
  EstilosAlbum,
  agruparPorFecha,
  formatearFechaLarga,
  subirArchivoValidado,
  COLOR_MARCA,
  COLOR_BORDE,
  COLOR_TEXTO,
  COLOR_TEXTO_SUAVE,
  COLOR_FONDO,
  type ItemAlbum,
} from "@/app/components/album/AlbumUI";
import { useAlbumPaginado } from "@/app/components/album/useAlbumPaginado";
import { urlOptimizadaCloudinary, urlPortadaVideo, urlDescargaCloudinary } from "@/app/lib/cloudinaryUrl";

// Página completa del álbum -- reemplaza a la vieja pestaña "Álbum
// Creativos" del home (que traía TODO sin paginar, en tamaño original).
// Usa las mismas piezas que SelectorAlbum (ver app/components/album/
// AlbumUI.tsx) para que ambas se vean idénticas; la diferencia es que
// acá tocar una pieza abre el panel de detalle, no la elige.
//
// Colecciones armadas por IA, "⭐ Los que más venden" y "En N campañas"
// no se muestran todavía -- no hay ningún dato real detrás (ver la
// investigación: no hay etiquetas/descripción guardadas por creativo, ni
// métricas por anuncio). Nada de eso se inventa; se deja para cuando
// exista el dato real. El buscador queda oculto por el mismo motivo (no
// hay texto guardado contra el que buscar).
export default function AlbumPage() {
  const album = useAlbumPaginado();

  const centinelaRef = useRef<HTMLDivElement>(null);
  const cargarMasRef = useRef(() => {});
  cargarMasRef.current = album.cargarMas;

  useEffect(() => {
    const centinela = centinelaRef.current;
    if (!centinela) return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) cargarMasRef.current();
      },
      { rootMargin: "300px" }
    );
    observer.observe(centinela);
    return () => observer.disconnect();
  }, []);

  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionIds, setSeleccionIds] = useState<Set<string>>(new Set());
  const [detalle, setDetalle] = useState<ItemAlbum | null>(null);
  const [idsPorBorrar, setIdsPorBorrar] = useState<string[] | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [erroresBorrado, setErroresBorrado] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSeleccion = (id: string) => {
    setSeleccionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClickTarjeta = (item: ItemAlbum) => {
    if (modoSeleccion) {
      if (item.id) toggleSeleccion(item.id);
      return;
    }
    setDetalle(item);
  };

  const handleSubir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setErrorSubida(null);
    const resultado = await subirArchivoValidado(file);
    if (resultado.ok) {
      // La pieza nueva aparece de primera sin recargar la página -- se
      // vuelve a pedir la primera página (ya con la nueva pieza, por
      // creado_en desc) en vez de recargar el navegador.
      await album.recargar();
    } else {
      setErrorSubida(resultado.error);
    }
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmarBorrado = async () => {
    if (!idsPorBorrar || idsPorBorrar.length === 0) return;
    setBorrando(true);
    let fallos = 0;
    for (const id of idsPorBorrar) {
      const res = await fetch(`/api/album/${id}`, { method: "DELETE" });
      if (!res.ok) fallos++;
    }
    setErroresBorrado(fallos);
    setBorrando(false);
    setIdsPorBorrar(null);
    setSeleccionIds(new Set());
    setModoSeleccion(false);
    setDetalle(null);
    await album.recargar();
  };

  const grupos = agruparPorFecha(album.items);
  const vacio = !album.cargandoInicial && album.items.length === 0 && !album.errorMsg;
  const totalConMas = album.hayMas ? `${album.items.length}+` : String(album.items.length);

  return (
    <div style={{ minHeight: "100vh", background: COLOR_FONDO, color: COLOR_TEXTO, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif" }}>
      <EstilosAlbum />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 16px 60px" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <a href="/" style={{ color: COLOR_MARCA, fontSize: 14, textDecoration: "none" }}>← Volver al panel principal</a>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            Álbum de creativos
            {!album.cargandoInicial && (
              <small style={{ color: COLOR_TEXTO_SUAVE, fontSize: 14, marginLeft: 8, fontWeight: 500 }}>
                {totalConMas} pieza{album.items.length !== 1 ? "s" : ""}
              </small>
            )}
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setModoSeleccion((v) => !v); setSeleccionIds(new Set()); }}
              style={{ border: `1.5px solid ${COLOR_BORDE}`, background: "#fff", color: COLOR_TEXTO, borderRadius: 12, padding: "10px 16px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              {modoSeleccion ? "Listo" : "Seleccionar"}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              style={{ border: "none", background: COLOR_MARCA, color: "#fff", borderRadius: 12, padding: "10px 16px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: subiendo ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {subiendo ? <Loader2 size={15} className="qb-album-spin" /> : null}
              {subiendo ? "Subiendo..." : "＋ Subir"}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleSubir} />
          </div>
        </div>

        <div style={{ position: "sticky", top: 0, zIndex: 5, background: COLOR_FONDO, padding: "14px 0 10px" }}>
          <ChipsFiltro filtro={album.filtro} onCambiar={album.setFiltro} />
        </div>

        {(album.errorMsg || errorSubida) && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
            {errorSubida || album.errorMsg}
          </div>
        )}

        {album.cargandoInicial && (
          <div className="qb-album-grid">
            {Array.from({ length: 12 }).map((_, i) => <Esqueleto key={i} />)}
          </div>
        )}

        {vacio && (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <p style={{ color: COLOR_TEXTO_SUAVE, marginBottom: 16, fontSize: 14 }}>Tu álbum todavía está vacío.</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: COLOR_MARCA, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 12, font: "inherit", fontSize: 14, fontWeight: 700, cursor: subiendo ? "not-allowed" : "pointer" }}
            >
              {subiendo ? <Loader2 size={15} className="qb-album-spin" /> : <Upload size={15} />}
              {subiendo ? "Subiendo..." : "Subir creativos"}
            </button>
          </div>
        )}

        {!album.cargandoInicial && album.items.length > 0 && (
          <>
            {grupos.map((grupo) => (
              <div key={grupo.titulo} style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, margin: "18px 0 10px" }}>{grupo.titulo}</h2>
                <div className="qb-album-grid">
                  {grupo.items.map((item) => (
                    <TarjetaAlbum
                      key={item.id}
                      item={item}
                      modoSeleccion={modoSeleccion}
                      seleccionado={!!item.id && seleccionIds.has(item.id)}
                      onClick={() => handleClickTarjeta(item)}
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
              <div style={{ textAlign: "center", margin: "16px 0" }}>
                <button
                  onClick={() => album.cargarMas()}
                  style={{ background: "#fff", border: `1px solid ${COLOR_BORDE}`, color: COLOR_MARCA, padding: "9px 18px", borderRadius: 12, font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cargar más
                </button>
              </div>
            )}
          </>
        )}

        <div ref={centinelaRef} style={{ height: 1 }} />
      </main>

      {/* Barra flotante del modo selección -- solo "Borrar" en bloque;
          "Usar en campaña" queda oculto por ahora (no hay un destino
          claro desde esta página aislada). */}
      {modoSeleccion && seleccionIds.size > 0 && (
        <div
          style={{
            position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)",
            background: COLOR_TEXTO, color: "#fff", borderRadius: 16, padding: "10px 12px 10px 18px",
            display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600,
            boxShadow: "0 12px 30px rgba(0,0,0,.25)", zIndex: 9,
          }}
        >
          <span>{seleccionIds.size} seleccionado{seleccionIds.size !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setIdsPorBorrar(Array.from(seleccionIds))}
            style={{ border: "none", background: "#DC2626", color: "#fff", borderRadius: 12, padding: "8px 14px", font: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Borrar
          </button>
        </div>
      )}

      {erroresBorrado > 0 && (
        <div
          style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", background: "#FEF2F2", color: "#991B1B", padding: "10px 16px", borderRadius: 10, fontSize: 13, zIndex: 9, display: "flex", alignItems: "center", gap: 10 }}
        >
          No se pudieron borrar {erroresBorrado} pieza{erroresBorrado !== 1 ? "s" : ""}.
          <button onClick={() => setErroresBorrado(0)} style={{ background: "none", border: "none", color: "#991B1B", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Confirmación propia (nunca confirm() del navegador) -- se usa
          tanto para el borrado en bloque como para el borrado de una
          sola pieza desde el panel de detalle. */}
      {idsPorBorrar && (
        <div
          onClick={() => setIdsPorBorrar(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,.6)", zIndex: 2001, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", maxWidth: 360, width: "100%", textAlign: "center" }}>
            <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 8px" }}>
              ¿Borrar {idsPorBorrar.length} creativo{idsPorBorrar.length !== 1 ? "s" : ""}?
            </p>
            <p style={{ fontSize: 13, color: COLOR_TEXTO_SUAVE, margin: "0 0 20px" }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setIdsPorBorrar(null)}
                disabled={borrando}
                style={{ flex: 1, border: `1.5px solid ${COLOR_BORDE}`, background: "#fff", color: COLOR_TEXTO, borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: borrando ? "not-allowed" : "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                disabled={borrando}
                style={{ flex: 1, border: "none", background: "#DC2626", color: "#fff", borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: borrando ? "not-allowed" : "pointer" }}
              >
                {borrando ? "Borrando..." : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel lateral de detalle -- vista grande, fecha, Descargar y
          Borrar. Sin métricas ni etiquetas de IA: no hay ese dato real
          guardado por creativo todavía (ver la investigación). */}
      {detalle && (
        <>
          <div onClick={() => setDetalle(null)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <aside
            style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 100%)", background: "#fff", boxShadow: "-12px 0 30px rgba(0,0,0,.15)", zIndex: 10, display: "flex", flexDirection: "column" }}
          >
            <div style={{ height: "46%", position: "relative", background: "#000", flexShrink: 0 }}>
              {detalle.tipo === "video" ? (
                <video
                  src={detalle.url_imagen}
                  poster={urlOptimizadaCloudinary(urlPortadaVideo(detalle.url_imagen), 800)}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" }}
                />
              ) : (
                <img src={urlOptimizadaCloudinary(detalle.url_imagen, 800)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              )}
              <button
                onClick={() => setDetalle(null)}
                style={{ position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.92)", fontSize: 18, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 18, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <p style={{ fontSize: 13, color: COLOR_TEXTO_SUAVE, margin: 0 }}>
                {detalle.creado_en ? formatearFechaLarga(detalle.creado_en) : ""}
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <a
                  href={urlDescargaCloudinary(detalle.url_imagen)}
                  download
                  style={{ flex: 1, textAlign: "center", border: `1.5px solid ${COLOR_BORDE}`, color: COLOR_TEXTO, borderRadius: 12, padding: "10px", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
                >
                  Descargar
                </a>
                <button
                  onClick={() => detalle.id && setIdsPorBorrar([detalle.id])}
                  style={{ flex: 1, border: "none", background: "#DC2626", color: "#fff", borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                >
                  Borrar
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

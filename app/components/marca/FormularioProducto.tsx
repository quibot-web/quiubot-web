"use client";
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import SelectorAlbum, { type ItemAlbum } from "@/app/components/SelectorAlbum";
import { subirArchivoValidado } from "@/app/components/album/AlbumUI";
import { urlOptimizadaCloudinary } from "@/app/lib/cloudinaryUrl";
import { TIPOS_PRODUCTO, CHIPS_DESTACAR, type TipoProducto, type ProductoConFotos } from "@/app/lib/productos";

const MAX_FOTOS = 3;

type FotoElegida = { id: string; url_imagen: string };

export default function FormularioProducto({
  modo,
  productoExistente,
  onGuardado,
  onCancelar,
}: {
  modo: "crear" | "editar";
  productoExistente?: ProductoConFotos;
  onGuardado: (producto: ProductoConFotos) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoProducto>(productoExistente?.tipo ?? "producto");
  const [nombre, setNombre] = useState(productoExistente?.nombre ?? "");
  const [precio, setPrecio] = useState<number | null>(productoExistente?.precio_cop ?? null);
  const [destacar, setDestacar] = useState(productoExistente?.destacar ?? "");
  const [url, setUrl] = useState(productoExistente?.url ?? "");
  const [fotos, setFotos] = useState<FotoElegida[]>(productoExistente?.fotos ?? []);

  const [mostrarSelectorAlbum, setMostrarSelectorAlbum] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function agregarFotoDesdeAlbum(item: ItemAlbum) {
    if (item.id && fotos.length < MAX_FOTOS && !fotos.some((f) => f.id === item.id)) {
      setFotos((prev) => [...prev, { id: item.id!, url_imagen: item.url_imagen }]);
    }
    setMostrarSelectorAlbum(false);
  }

  async function subirNuevaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendoFoto(true);
    setError(null);
    const resultado = await subirArchivoValidado(archivo);
    if (!resultado.ok) {
      setError(resultado.error);
      setSubiendoFoto(false);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    // subirArchivoValidado no devuelve el item nuevo -- se trae el más
    // reciente del álbum (orden por creado_en DESC, igual que /api/album).
    try {
      const res = await fetch("/api/album?limit=1");
      const data = await res.json();
      const nuevo = data.imagenes?.[0];
      if (nuevo?.id) setFotos((prev) => (prev.length < MAX_FOTOS ? [...prev, { id: nuevo.id, url_imagen: nuevo.url_imagen }] : prev));
    } catch {
      setError("La foto se subió, pero no se pudo agregar acá -- elígela del álbum.");
    }
    setSubiendoFoto(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function quitarFoto(id: string) {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  function onCambioPrecio(valor: string) {
    const soloDigitos = valor.replace(/\D/g, "");
    setPrecio(soloDigitos ? parseInt(soloDigitos, 10) : null);
  }

  function agregarChipDestacar(texto: string) {
    if (destacar.includes(texto)) return;
    setDestacar((prev) => (prev.trim() ? `${prev.trim()} · ${texto}` : texto));
  }

  async function guardar() {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    setError(null);

    const cuerpo = {
      tipo,
      nombre: nombre.trim(),
      precio_cop: precio,
      destacar: destacar.trim() || null,
      album_ids: fotos.map((f) => f.id),
      url: url.trim() || null,
    };

    try {
      const res = await fetch(modo === "crear" ? "/api/productos" : `/api/productos/${productoExistente!.id}`, {
        method: modo === "crear" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar el producto.");
        setGuardando(false);
        return;
      }
      onGuardado({ ...data.producto, fotos });
    } catch {
      setError("No se pudo conectar con el servidor.");
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(23,21,43,0.5)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="qv-formulario">
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{modo === "crear" ? "Nuevo producto" : "Editar producto"}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#888" }}>Lo vas a poder elegir después sin volver a escribirlo.</p>
          </div>

          <div style={{ display: "flex", gap: 6, background: "#f3f2f0", borderRadius: 10, padding: 4 }}>
            {TIPOS_PRODUCTO.map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                style={{ flex: 1, border: "none", background: tipo === t ? "#534AB7" : "none", color: tipo === t ? "#fff" : "#666", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                {t === "servicio" ? "Servicio" : "Producto"}
              </button>
            ))}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6 }}>
              Fotos <span style={{ fontWeight: 400, color: "#aaa" }}>(hasta {MAX_FOTOS}, opcional)</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {fotos.map((f) => (
                <div key={f.id} style={{ position: "relative", width: 68, height: 68, borderRadius: 10, overflow: "hidden", background: "#F3F2FE" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza, no hace falta next/image en un modal chico. */}
                  <img src={urlOptimizadaCloudinary(f.url_imagen, 140)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => quitarFoto(f.id)}
                    aria-label="Quitar foto"
                    style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {subiendoFoto && (
                <div style={{ width: 68, height: 68, borderRadius: 10, background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 size={18} color="#534AB7" className="qv-spin" />
                </div>
              )}
            </div>
            {fotos.length < MAX_FOTOS && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setMostrarSelectorAlbum(true)} style={{ background: "none", border: "none", color: "#534AB7", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                  Elegir del álbum
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={subiendoFoto} style={{ background: "none", border: "none", color: "#534AB7", fontSize: 12.5, fontWeight: 700, cursor: subiendoFoto ? "default" : "pointer", padding: 0 }}>
                  Subir nueva foto
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={subirNuevaFoto} />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 5 }}>Nombre</label>
            <input className="qv-input" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Pistola de impacto XR200" maxLength={200} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 5 }}>
              Precio <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ fontSize: 13, color: "#888" }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={precio ? precio.toLocaleString("es-CO") : ""}
                onChange={(e) => onCambioPrecio(e.target.value)}
                placeholder="189.900"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#1a1a1a", fontFamily: "inherit" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 5 }}>
              Qué destacar <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
              {CHIPS_DESTACAR.map((chip) => (
                <button
                  key={chip.texto}
                  onClick={() => agregarChipDestacar(chip.texto)}
                  style={{ border: "1.5px solid #E9E7EE", background: "#fff", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, color: "#444", cursor: "pointer" }}
                >
                  {chip.emoji} {chip.texto}
                </button>
              ))}
            </div>
            <textarea className="qv-input" rows={3} style={{ resize: "vertical" }} value={destacar} onChange={(e) => setDestacar(e.target.value)} placeholder="Garantía, envío, forma de pago..." maxLength={500} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 5 }}>
              Link <span style={{ fontWeight: 400, color: "#aaa" }}>(opcional)</span>
            </label>
            <input className="qv-input" type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." maxLength={500} />
          </div>

          {error && <p style={{ margin: 0, background: "#FEF0EF", color: "#B3261E", borderRadius: 10, padding: "9px 11px", fontSize: 12.5 }}>{error}</p>}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 22px", borderTop: "1px solid #eee", flexShrink: 0 }}>
          <button
            onClick={guardar}
            disabled={!nombre.trim() || guardando}
            style={{ flex: 1, border: "none", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 13.5, cursor: !nombre.trim() || guardando ? "default" : "pointer", background: "#534AB7", color: "#fff", opacity: !nombre.trim() || guardando ? 0.6 : 1 }}
          >
            {guardando ? "Guardando..." : "Guardar producto"}
          </button>
          <button onClick={onCancelar} disabled={guardando} style={{ flex: 1, border: "1.5px solid #e0e0e0", borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 13.5, cursor: "pointer", background: "#fff", color: "#1a1a1a" }}>
            Cancelar
          </button>
        </div>
      </div>

      {mostrarSelectorAlbum && <SelectorAlbum titulo="Elige una foto" onElegir={agregarFotoDesdeAlbum} onCerrar={() => setMostrarSelectorAlbum(false)} />}

      <style>{`
        .qv-formulario {
          width: 100%; max-width: 420px; max-height: 88vh; background: #fff; border-radius: 18px;
          box-shadow: 0 16px 40px -14px rgba(26,26,26,0.22); display: flex; flex-direction: column; overflow: hidden;
        }
        .qv-input {
          width: 100%; box-sizing: border-box; border: 1.5px solid #e0e0e0; border-radius: 10px; padding: 10px 12px;
          font-size: 13px; font-family: inherit; color: #1a1a1a; outline: none;
        }
        .qv-input:focus { border-color: #534AB7; }
        .qv-spin { animation: qv-spin .9s linear infinite; }
        @keyframes qv-spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .qv-formulario { max-width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; }
        }
      `}</style>
    </div>
  );
}

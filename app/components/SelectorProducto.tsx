"use client";
import { useEffect, useState } from "react";
import { productoParecido, type TipoProducto, type ProductoConFotos } from "@/app/lib/productos";
import { urlOptimizadaCloudinary } from "@/app/lib/cloudinaryUrl";

export type FotoDeProducto = { id: string; url_imagen: string };

export type ValorSelectorProducto = {
  // null = todavía no corresponde a un producto guardado (recién
  // escrito, o el usuario elige "Nuevo producto").
  productoId: string | null;
  tipo: TipoProducto;
  nombre: string;
  precioCop: number | null;
  destacar: string | null;
  // Solo tiene sentido cuando productoId es null: si se guarda al
  // usarlo. Marcada por defecto, como se pidió.
  guardarEnCatalogo: boolean;
  // Solo tiene sentido cuando productoId NO es null y se editó precio
  // o destacar respecto a lo guardado: si ese cambio también se
  // refleja en el catálogo, o queda solo para este uso.
  actualizarCatalogo: boolean;
  // Fotos guardadas del producto elegido (vacío si es nuevo) -- el
  // host las usa como punto de partida para las fotos de ESTA
  // campaña/video (puede quitarlas o agregar más ahí, eso no afecta
  // al catálogo). Nunca las edita este componente.
  fotosProducto: FotoDeProducto[];
};

export function valorVacioSelectorProducto(tipo: TipoProducto = "producto"): ValorSelectorProducto {
  return { productoId: null, tipo, nombre: "", precioCop: null, destacar: null, guardarEnCatalogo: true, actualizarCatalogo: false, fotosProducto: [] };
}

function textoPrecio(tipo: TipoProducto, precioCop: number | null): string {
  if (precioCop) return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(precioCop);
  return tipo === "servicio" ? "Precio según el proyecto" : "Sin precio";
}

// Llamado por cada página al momento de usar la selección de verdad
// (generar la estrategia, el guion de video, o crear la meta) -- nunca
// antes, para no guardar ni actualizar nada mientras el cliente todavía
// está escribiendo/decidiendo. Devuelve el producto_id final (nuevo,
// existente, o null si el cliente no quiso guardarlo).
export async function resolverProductoAlUsar(valor: ValorSelectorProducto): Promise<{ productoId: string | null; error?: string }> {
  if (!valor.nombre.trim()) return { productoId: null };

  if (valor.productoId) {
    try {
      // Siempre se toca ultimo_uso_en acá -- aunque no se haya editado
      // nada, esto SÍ es un uso real (ver marcar_uso en la ruta).
      const cambios: Record<string, unknown> = { marcar_uso: true };
      if (valor.actualizarCatalogo) {
        cambios.precio_cop = valor.precioCop;
        cambios.destacar = valor.destacar;
      }
      const res = await fetch(`/api/productos/${valor.productoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { productoId: valor.productoId, error: data.error || "No se pudo actualizar tu catálogo, pero se usó igual." };
      }
    } catch {
      return { productoId: valor.productoId, error: "No se pudo actualizar tu catálogo, pero se usó igual." };
    }
    return { productoId: valor.productoId };
  }

  if (!valor.guardarEnCatalogo) return { productoId: null };

  try {
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: valor.tipo, nombre: valor.nombre.trim(), precio_cop: valor.precioCop, destacar: valor.destacar, marcar_uso: true }),
    });
    const data = await res.json();
    if (!res.ok) return { productoId: null, error: data.error };
    return { productoId: data.producto.id };
  } catch {
    return { productoId: null, error: "No se pudo guardar en tu catálogo, pero se usó igual." };
  }
}

// Para el chat del Director: ahí "producto" llega como texto libre
// dentro del borrador (ver promptMetaConversacion.ts), sin ningún
// checkbox ni confirmación posible a esta altura (el turno ya cerró).
// Reusa un producto existente ante una coincidencia exacta o muy
// parecida (nunca pregunta "¿es el mismo?" -- no hay con quién), y
// solo crea uno nuevo cuando de verdad no hay nada parecido guardado.
export async function resolverProductoDesdeTexto(
  nombre: string,
  precioCop: number | null | undefined,
  productosConocidos: { id: string; nombre: string }[]
): Promise<{ productoId: string | null }> {
  const limpio = nombre.trim();
  if (!limpio) return { productoId: null };

  const normalizado = limpio.toLowerCase();
  const exacto = productosConocidos.find((p) => p.nombre.trim().toLowerCase() === normalizado);
  const parecido = exacto ? null : productoParecido(limpio, productosConocidos);
  const existente = exacto ?? (parecido ? productosConocidos.find((p) => p.nombre === parecido) : undefined);

  if (existente) {
    try {
      await fetch(`/api/productos/${existente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marcar_uso: true }),
      });
    } catch {
      // El uso real (la meta) ya se crea igual -- esto solo actualiza
      // ultimo_uso_en, no es motivo para bloquear nada.
    }
    return { productoId: existente.id };
  }

  try {
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "producto", nombre: limpio, precio_cop: precioCop ?? undefined, marcar_uso: true }),
    });
    if (!res.ok) return { productoId: null };
    const data = await res.json();
    return { productoId: data.producto?.id ?? null };
  } catch {
    return { productoId: null };
  }
}

const COLOR_BORDE = "#e0e0e0";
const COLOR_MARCA = "#534AB7";
const COLOR_SOBRE_MARCA = "#F3F2FE";

export default function SelectorProducto({
  tipoContenido,
  valor,
  onCambio,
  errorGuardado,
  onValidezCambia,
}: {
  // Filtra la lista a ese tipo -- opcional, si no viene se muestran
  // ambos (producto y servicio) mezclados.
  tipoContenido?: TipoProducto;
  valor: ValorSelectorProducto;
  onCambio: (v: ValorSelectorProducto) => void;
  // Error del backend al intentar guardar (ej. "Ya tienes un producto
  // con ese nombre") -- se muestra en el mismo recuadro bloqueante que
  // "¿es el mismo?", nunca escondido. El host lo limpia cuando el
  // cliente cambia algo (ver onCambio).
  errorGuardado?: string | null;
  // Avisa si en este momento se puede continuar: false mientras haya
  // un "¿es el mismo?" sin responder o un error de guardado sin
  // resolver. El host debe usarlo para deshabilitar su botón de
  // siguiente/continuar.
  onValidezCambia?: (valido: boolean) => void;
}) {
  const [productos, setProductos] = useState<ProductoConFotos[] | null>(null);
  const [editandoDestacar, setEditandoDestacar] = useState(false);
  // Nombre para el cual el cliente ya respondió "sí" o "no" al aviso de
  // parecido -- vuelve a null en cuanto el nombre cambia otra vez.
  const [parecidoResueltoPara, setParecidoResueltoPara] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data.productos ?? []))
      .catch(() => setProductos([]));
  }, []);

  const lista = (productos ?? []).filter((p) => !tipoContenido || p.tipo === tipoContenido);
  const productoActual = valor.productoId ? lista.find((p) => p.id === valor.productoId) : undefined;
  const parecido = !valor.productoId ? productoParecido(valor.nombre, lista) : null;
  const productoParecidoEncontrado = parecido ? lista.find((p) => p.nombre === parecido) : undefined;
  const parecidoPendiente = !!productoParecidoEncontrado && parecidoResueltoPara !== valor.nombre;
  const valido = !parecidoPendiente && !errorGuardado;

  useEffect(() => {
    // Ver la convención del proyecto sobre react-hooks/set-state-in-effect:
    // esto llama al setState del host, nunca del propio componente.
    const t = setTimeout(() => onValidezCambia?.(valido), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valido]);

  function elegirExistente(p: ProductoConFotos) {
    onCambio({
      productoId: p.id,
      tipo: p.tipo,
      nombre: p.nombre,
      precioCop: p.precio_cop,
      destacar: p.destacar,
      guardarEnCatalogo: false,
      actualizarCatalogo: false,
      fotosProducto: p.fotos,
    });
    setEditandoDestacar(false);
  }

  function elegirNuevo() {
    onCambio({ productoId: null, tipo: tipoContenido ?? valor.tipo, nombre: "", precioCop: null, destacar: null, guardarEnCatalogo: true, actualizarCatalogo: false, fotosProducto: [] });
    setEditandoDestacar(true);
    setParecidoResueltoPara(null);
  }

  function cambiarNombre(nombre: string) {
    onCambio({ ...valor, nombre });
  }

  const seEditoAlgo = !!productoActual && (valor.precioCop !== productoActual.precio_cop || (valor.destacar || "") !== (productoActual.destacar || ""));
  const chipsDestacar = (valor.destacar || "")
    .split(/[·,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {productos === null && (
          <div style={{ fontSize: 12.5, color: "#888", gridColumn: "1 / -1" }}>Cargando tu catálogo...</div>
        )}
        {lista.map((p) => {
          const seleccionado = valor.productoId === p.id;
          const foto = p.fotos[0]?.url_imagen;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirExistente(p)}
              style={{
                position: "relative",
                textAlign: "left",
                padding: 0,
                border: seleccionado ? `2px solid ${COLOR_MARCA}` : `2px solid ${COLOR_BORDE}`,
                borderRadius: 14,
                overflow: "hidden",
                background: "#fff",
                cursor: "pointer",
                boxShadow: seleccionado ? `0 0 0 3px ${COLOR_SOBRE_MARCA}` : "none",
                font: "inherit",
              }}
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: COLOR_SOBRE_MARCA, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza, no hace falta next/image en una tarjeta chica.
                  <img src={urlOptimizadaCloudinary(foto, 300)} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B7A9FF" strokeWidth={1.6} aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="8.5" cy="9.5" r="1.7" />
                    <path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L5 19" />
                  </svg>
                )}
                <span style={{ position: "absolute", top: 7, left: 7, background: "rgba(255,255,255,.92)", color: "#1a1a1a", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px" }}>
                  {p.tipo === "servicio" ? "Servicio" : "Producto"}
                </span>
                {seleccionado && (
                  <span style={{ position: "absolute", top: 7, right: 7, width: 22, height: 22, borderRadius: "50%", background: COLOR_MARCA, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
                    ✓
                  </span>
                )}
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{p.nombre}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: p.precio_cop ? COLOR_MARCA : "#999" }}>{textoPrecio(p.tipo, p.precio_cop)}</p>
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={elegirNuevo}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
            minHeight: 120, border: !valor.productoId ? `2px solid ${COLOR_MARCA}` : "2px dashed #CFC9EE",
            borderRadius: 14, background: !valor.productoId ? COLOR_SOBRE_MARCA : "transparent",
            color: COLOR_MARCA, fontWeight: 700, fontSize: 13, cursor: "pointer", font: "inherit",
          }}
        >
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>＋</span>
          Nuevo producto
        </button>
      </div>

      {!valor.productoId && (
        <>
          <input
            type="text"
            value={valor.nombre}
            onChange={(e) => cambiarNombre(e.target.value)}
            placeholder="Nombre del producto o servicio"
            style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a" }}
          />

          {parecidoPendiente && productoParecidoEncontrado && (
            <div style={{ background: "#FFF4E0", border: "1px solid #F0C97A", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <strong style={{ fontSize: 13, color: "#8A5200" }}>¿Es el mismo que ya tienes guardado?</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: 8 }}>
                <div style={{ width: 42, height: 42, borderRadius: 9, background: COLOR_SOBRE_MARCA, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {productoParecidoEncontrado.fotos[0]?.url_imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlOptimizadaCloudinary(productoParecidoEncontrado.fotos[0].url_imagen, 100)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B7A9FF" strokeWidth={1.8} aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9.5" r="1.7" />
                      <path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L5 19" />
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{productoParecidoEncontrado.nombre}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                    {textoPrecio(productoParecidoEncontrado.tipo, productoParecidoEncontrado.precio_cop)} · {productoParecidoEncontrado.fotos.length} foto{productoParecidoEncontrado.fotos.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => elegirExistente(productoParecidoEncontrado)}
                  style={{ border: "none", background: COLOR_MARCA, color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Sí, usar ese
                </button>
                <button
                  type="button"
                  onClick={() => setParecidoResueltoPara(valor.nombre)}
                  style={{ border: "1.5px solid #e0e0e0", background: "#fff", color: "#1a1a1a", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  No, es otro producto
                </button>
              </div>
            </div>
          )}

          {!parecidoPendiente && errorGuardado && (
            <div style={{ background: "#FEF0EF", border: "1px solid #F3C6C2", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
              <strong style={{ fontSize: 13, color: "#B3261E" }}>{errorGuardado}</strong>
              <span style={{ fontSize: 12, color: "#8a4a45" }}>Cambia el nombre, o elige ese producto arriba en vez de crear uno nuevo.</span>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#444", cursor: "pointer" }}>
            <input type="checkbox" checked={valor.guardarEnCatalogo} onChange={(e) => onCambio({ ...valor, guardarEnCatalogo: e.target.checked })} />
            Guardar en mis productos
          </label>
        </>
      )}

      <input
        type="text"
        inputMode="numeric"
        value={valor.precioCop ? valor.precioCop.toLocaleString("es-CO") : ""}
        onChange={(e) => {
          const soloDigitos = e.target.value.replace(/\D/g, "");
          onCambio({ ...valor, precioCop: soloDigitos ? parseInt(soloDigitos, 10) : null });
        }}
        placeholder={valor.tipo === "servicio" ? "Precio (opcional, según el proyecto)" : "Precio (opcional)"}
        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a" }}
      />

      {!editandoDestacar && valor.productoId && chipsDestacar.length > 0 ? (
        <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 12.5, color: "#1a1a1a" }}>Lo que la IA va a destacar</strong>
            <button type="button" onClick={() => setEditandoDestacar(true)} style={{ border: "none", background: "none", color: COLOR_MARCA, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0 }}>
              Editar para esta campaña
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {chipsDestacar.map((c, i) => (
              <span key={i} style={{ background: COLOR_SOBRE_MARCA, color: COLOR_MARCA, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "4px 10px" }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <textarea
          value={valor.destacar ?? ""}
          onChange={(e) => onCambio({ ...valor, destacar: e.target.value })}
          placeholder="Qué destacar (opcional): garantía, envío, forma de pago..."
          rows={2}
          style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", resize: "vertical", fontFamily: "inherit" }}
        />
      )}

      {productoActual && seEditoAlgo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666", flexWrap: "wrap" }}>
          <span>¿Actualizo tu catálogo con este cambio, o es solo por ahora?</span>
          <button
            type="button"
            onClick={() => onCambio({ ...valor, actualizarCatalogo: true })}
            style={{ border: "1px solid #534AB7", background: valor.actualizarCatalogo ? "#534AB7" : "#fff", color: valor.actualizarCatalogo ? "#fff" : "#534AB7", borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            Actualizar catálogo
          </button>
          <button
            type="button"
            onClick={() => onCambio({ ...valor, actualizarCatalogo: false })}
            style={{ border: "1px solid #ddd", background: !valor.actualizarCatalogo ? "#f3f2f0" : "#fff", color: "#666", borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
          >
            Solo por ahora
          </button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { productoParecido, type TipoProducto, type Producto } from "@/app/lib/productos";

export type ValorSelectorProducto = {
  // null = todavía no corresponde a un producto guardado (recién
  // escrito, o el usuario elige "Otro nuevo").
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
};

export function valorVacioSelectorProducto(tipo: TipoProducto = "producto"): ValorSelectorProducto {
  return { productoId: null, tipo, nombre: "", precioCop: null, destacar: null, guardarEnCatalogo: true, actualizarCatalogo: false };
}

// Llamado por cada página al momento de usar la selección de verdad
// (generar la estrategia, el guion de video, o crear la meta) -- nunca
// antes, para no guardar ni actualizar nada mientras el cliente todavía
// está escribiendo/decidiendo. Devuelve el producto_id final (nuevo,
// existente, o null si el cliente no quiso guardarlo).
export async function resolverProductoAlUsar(valor: ValorSelectorProducto): Promise<{ productoId: string | null; error?: string }> {
  if (!valor.nombre.trim()) return { productoId: null };

  if (valor.productoId) {
    if (valor.actualizarCatalogo) {
      try {
        const res = await fetch(`/api/productos/${valor.productoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ precio_cop: valor.precioCop, destacar: valor.destacar }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { productoId: valor.productoId, error: data.error || "No se pudo actualizar tu catálogo, pero se usó igual." };
        }
      } catch {
        return { productoId: valor.productoId, error: "No se pudo actualizar tu catálogo, pero se usó igual." };
      }
    }
    return { productoId: valor.productoId };
  }

  if (!valor.guardarEnCatalogo) return { productoId: null };

  try {
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: valor.tipo, nombre: valor.nombre.trim(), precio_cop: valor.precioCop, destacar: valor.destacar }),
    });
    const data = await res.json();
    if (!res.ok) return { productoId: null, error: data.error };
    return { productoId: data.producto.id };
  } catch {
    return { productoId: null, error: "No se pudo guardar en tu catálogo, pero se usó igual." };
  }
}

export default function SelectorProducto({
  tipoContenido,
  valor,
  onCambio,
}: {
  // Filtra la lista a ese tipo -- opcional, si no viene se muestran
  // ambos (producto y servicio) mezclados.
  tipoContenido?: TipoProducto;
  valor: ValorSelectorProducto;
  onCambio: (v: ValorSelectorProducto) => void;
}) {
  const [productos, setProductos] = useState<Producto[] | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data.productos ?? []))
      .catch(() => setProductos([]));
  }, []);

  const lista = (productos ?? []).filter((p) => !tipoContenido || p.tipo === tipoContenido);
  const productoActual = valor.productoId ? lista.find((p) => p.id === valor.productoId) : undefined;
  const parecido = !valor.productoId ? productoParecido(valor.nombre, lista) : null;

  function elegirExistente(p: Producto) {
    onCambio({ productoId: p.id, tipo: p.tipo, nombre: p.nombre, precioCop: p.precio_cop, destacar: p.destacar, guardarEnCatalogo: false, actualizarCatalogo: false });
  }

  function elegirNuevo() {
    onCambio({ productoId: null, tipo: tipoContenido ?? valor.tipo, nombre: "", precioCop: null, destacar: null, guardarEnCatalogo: true, actualizarCatalogo: false });
  }

  const seEditoAlgo = !!productoActual && (valor.precioCop !== productoActual.precio_cop || (valor.destacar || "") !== (productoActual.destacar || ""));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <select
        value={valor.productoId ?? "__nuevo__"}
        onChange={(e) => {
          if (e.target.value === "__nuevo__") {
            elegirNuevo();
            return;
          }
          const p = lista.find((it) => it.id === e.target.value);
          if (p) elegirExistente(p);
        }}
        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", background: "#fff" }}
      >
        {productos === null && <option>Cargando tu catálogo...</option>}
        {productos !== null && lista.length === 0 && <option value="__nuevo__">Todavía no tienes productos guardados</option>}
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
        <option value="__nuevo__">+ Otro nuevo</option>
      </select>

      {!valor.productoId && (
        <>
          <input
            type="text"
            value={valor.nombre}
            onChange={(e) => onCambio({ ...valor, nombre: e.target.value })}
            placeholder="Nombre del producto o servicio"
            style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a" }}
          />
          {parecido && (
            <button
              type="button"
              onClick={() => {
                const p = lista.find((it) => it.nombre === parecido);
                if (p) elegirExistente(p);
              }}
              style={{ textAlign: "left", background: "#FFF8E6", border: "1px solid #F0DBA0", borderRadius: 10, padding: "8px 11px", fontSize: 12, color: "#8A5A00", cursor: "pointer" }}
            >
              ¿Es el mismo que &quot;{parecido}&quot;? Tócalo para usar ese en vez de crear uno nuevo.
            </button>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#444", cursor: "pointer" }}>
            <input type="checkbox" checked={valor.guardarEnCatalogo} onChange={(e) => onCambio({ ...valor, guardarEnCatalogo: e.target.checked })} />
            Guardar en mis productos
          </label>
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            inputMode="numeric"
            value={valor.precioCop ? valor.precioCop.toLocaleString("es-CO") : ""}
            onChange={(e) => {
              const soloDigitos = e.target.value.replace(/\D/g, "");
              onCambio({ ...valor, precioCop: soloDigitos ? parseInt(soloDigitos, 10) : null });
            }}
            placeholder="Precio (opcional)"
            style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a" }}
          />
        </div>
      </div>
      <textarea
        value={valor.destacar ?? ""}
        onChange={(e) => onCambio({ ...valor, destacar: e.target.value })}
        placeholder="Qué destacar (opcional): garantía, envío, forma de pago..."
        rows={2}
        style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#1a1a1a", resize: "vertical", fontFamily: "inherit" }}
      />

      {productoActual && seEditoAlgo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666" }}>
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

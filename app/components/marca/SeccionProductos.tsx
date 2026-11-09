"use client";
import { useState } from "react";
import type { ProductoConFotos } from "@/app/lib/productos";
import TarjetaProducto from "./TarjetaProducto";
import FormularioProducto from "./FormularioProducto";

type Formulario = { modo: "crear" } | { modo: "editar"; producto: ProductoConFotos };

// Panel del módulo 4 de Mi marca ("Lo que vendes") -- arranca con la
// lista activa que ya trajo MarcaPage (mismo golpe de Promise.all que
// usan los otros 3 módulos) y avisa hacia arriba (onCambio) cada vez
// que la lista activa cambia, para que la tarjeta cerrada del módulo
// se mantenga al día sin que el usuario tenga que reabrir el panel.
export default function SeccionProductos({
  productosIniciales,
  onCambio,
}: {
  productosIniciales: ProductoConFotos[];
  onCambio: (productosActivos: ProductoConFotos[]) => void;
}) {
  const [productos, setProductos] = useState<ProductoConFotos[]>(productosIniciales);
  const [archivadosCount, setArchivadosCount] = useState(0);
  const [vistaArchivados, setVistaArchivados] = useState(false);
  const [productosArchivados, setProductosArchivados] = useState<ProductoConFotos[] | null>(null);
  const [cargandoArchivados, setCargandoArchivados] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);

  function irAArchivados() {
    setVistaArchivados(true);
    if (productosArchivados !== null) return;
    setCargandoArchivados(true);
    fetch("/api/productos?archivados=1")
      .then((r) => r.json())
      .then((data) => setProductosArchivados(data.productos ?? []))
      .catch(() => setProductosArchivados([]))
      .finally(() => setCargandoArchivados(false));
  }

  function archivar(producto: ProductoConFotos) {
    fetch(`/api/productos/${producto.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: false }) })
      .then((r) => r.json())
      .then((data) => {
        if (!data.producto) return;
        const nuevos = productos.filter((p) => p.id !== producto.id);
        setProductos(nuevos);
        onCambio(nuevos);
        setArchivadosCount((n) => n + 1);
        setProductosArchivados((prev) => (prev ? [{ ...data.producto, fotos: producto.fotos }, ...prev] : prev));
      })
      .catch(() => {});
  }

  function restaurar(producto: ProductoConFotos) {
    fetch(`/api/productos/${producto.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: true }) })
      .then((r) => r.json())
      .then((data) => {
        if (!data.producto) return;
        setProductosArchivados((prev) => (prev ?? []).filter((p) => p.id !== producto.id));
        setArchivadosCount((n) => Math.max(0, n - 1));
        const restaurado = { ...data.producto, fotos: producto.fotos };
        const nuevos = [restaurado, ...productos];
        setProductos(nuevos);
        onCambio(nuevos);
      })
      .catch(() => {});
  }

  function onGuardado(producto: ProductoConFotos) {
    const esNuevo = !productos.some((p) => p.id === producto.id);
    const nuevos = esNuevo ? [producto, ...productos] : productos.map((p) => (p.id === producto.id ? producto : p));
    setProductos(nuevos);
    onCambio(nuevos);
    setFormulario(null);
  }

  if (vistaArchivados) {
    return (
      <div>
        <button onClick={() => setVistaArchivados(false)} style={{ background: "none", border: "none", color: "#534AB7", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 14 }}>
          ← Volver
        </button>
        {cargandoArchivados ? (
          <p style={{ fontSize: 13, color: "#999" }}>Cargando...</p>
        ) : !productosArchivados || productosArchivados.length === 0 ? (
          <p style={{ fontSize: 13, color: "#888" }}>Todavía no archivaste ningún producto.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
            {productosArchivados.map((p) => (
              <TarjetaProducto key={p.id} producto={p} onRestaurar={() => restaurar(p)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#666", maxWidth: 420 }}>Guarda tus productos y servicios una vez y elígelos cada vez que los necesites, sin volver a escribirlos.</p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          {archivadosCount > 0 && (
            <button onClick={irAArchivados} style={{ background: "none", border: "none", color: "#666", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Ver archivados ({archivadosCount})
            </button>
          )}
          <button
            onClick={() => setFormulario({ modo: "crear" })}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Agregar producto
          </button>
        </div>
      </div>

      {productos.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #d8d4ee", borderRadius: 16, padding: "36px 24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Todavía no tienes productos guardados</p>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#888" }}>Agrega el primero para empezar a reutilizarlo.</p>
          <button
            onClick={() => setFormulario({ modo: "crear" })}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
          >
            + Agregar producto
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
          {productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} onEditar={() => setFormulario({ modo: "editar", producto: p })} onArchivar={() => archivar(p)} />
          ))}
        </div>
      )}

      {formulario && (
        <FormularioProducto
          modo={formulario.modo}
          productoExistente={formulario.modo === "editar" ? formulario.producto : undefined}
          onGuardado={onGuardado}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </div>
  );
}

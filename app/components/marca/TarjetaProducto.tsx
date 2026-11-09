"use client";
import { useState } from "react";
import type { ProductoConFotos } from "@/app/lib/productos";
import { urlOptimizadaCloudinary } from "@/app/lib/cloudinaryUrl";

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function textoPrecio(producto: ProductoConFotos): string {
  if (producto.precio_cop) return formatoCop(producto.precio_cop);
  return producto.tipo === "servicio" ? "Precio según el proyecto" : "Sin precio";
}

// Una tarjeta del catálogo -- se usa tanto en la vista activa (con
// "Editar"/"Archivar" en el menú) como en "Ver archivados" (con
// "Restaurar" en su lugar), según qué callback venga: solo uno de los
// dos (onArchivar/onRestaurar) llega nunca a la vez.
export default function TarjetaProducto({
  producto,
  onEditar,
  onArchivar,
  onRestaurar,
}: {
  producto: ProductoConFotos;
  onEditar?: () => void;
  onArchivar?: () => void;
  onRestaurar?: () => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmandoArchivar, setConfirmandoArchivar] = useState(false);

  const primeraFoto = producto.fotos[0]?.url_imagen;

  return (
    <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {primeraFoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary ya optimiza (f_auto,q_auto,w_400), no hace falta next/image acá.
          <img src={urlOptimizadaCloudinary(primeraFoto, 400)} alt={producto.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#B7A9FF" strokeWidth={1.6} aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.7" />
            <path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L5 19" />
          </svg>
        )}
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: producto.tipo === "servicio" ? "#E7F7F1" : "#534AB7",
            color: producto.tipo === "servicio" ? "#0B7A5C" : "#fff",
            fontSize: 10.5,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 999,
          }}
        >
          {producto.tipo === "servicio" ? "Servicio" : "Producto"}
        </span>

        {(onEditar || onArchivar || onRestaurar) && (
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              aria-label="Más opciones"
              style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", color: "#444", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}
            >
              ⋯
            </button>
            {menuAbierto && (
              <div style={{ position: "absolute", top: 32, right: 0, background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.14)", minWidth: 150, zIndex: 3, overflow: "hidden" }}>
                {onEditar && !confirmandoArchivar && (
                  <button
                    onClick={() => {
                      setMenuAbierto(false);
                      onEditar();
                    }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 12px", fontSize: 12.5, fontWeight: 600, color: "#1a1a1a", cursor: "pointer" }}
                  >
                    Editar
                  </button>
                )}
                {onArchivar && !confirmandoArchivar && (
                  <button
                    onClick={() => setConfirmandoArchivar(true)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 12px", fontSize: 12.5, fontWeight: 600, color: "#888", cursor: "pointer" }}
                  >
                    Archivar
                  </button>
                )}
                {onArchivar && confirmandoArchivar && (
                  <div style={{ padding: 10 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, color: "#444" }}>¿Archivar este producto? Dejás de verlo en los selectores, pero nada de lo que ya se usó cambia.</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => {
                          setMenuAbierto(false);
                          setConfirmandoArchivar(false);
                          onArchivar();
                        }}
                        style={{ flex: 1, background: "#FEF0EF", border: "1px solid #F3C6C2", color: "#B3261E", borderRadius: 8, padding: "6px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        Archivar
                      </button>
                      <button
                        onClick={() => setConfirmandoArchivar(false)}
                        style={{ flex: 1, background: "#fff", border: "1px solid #e0e0e0", color: "#444", borderRadius: 8, padding: "6px 0", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
                {onRestaurar && (
                  <button
                    onClick={() => {
                      setMenuAbierto(false);
                      onRestaurar();
                    }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 12px", fontSize: 12.5, fontWeight: 600, color: "#534AB7", cursor: "pointer" }}
                  >
                    Restaurar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: "13px 14px 14px", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>{producto.nombre}</p>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: "#534AB7" }}>{textoPrecio(producto)}</p>
        {producto.destacar && (
          <p style={{ margin: 0, fontSize: 12, color: "#888", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{producto.destacar}</p>
        )}
      </div>
    </div>
  );
}

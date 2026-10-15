"use client";
import { useState, useRef, useEffect } from "react";

// Lista curada de países soportados por Meta Ads, cubriendo Latinoamérica
// (mercado principal de Quiubot) más los mercados internacionales más
// comunes -- no es la lista completa de países que soporta Meta (son casi
// 200), pero cubre el caso real de "vendo en Colombia y también fuera".
// Compartida entre /marca (cobertura de ciudades) y / (WhatsApp de ventas).
export const PAISES_COBERTURA: { codigo: string; nombre: string }[] = [
  { codigo: "CO", nombre: "Colombia" },
  { codigo: "MX", nombre: "México" },
  { codigo: "AR", nombre: "Argentina" },
  { codigo: "CL", nombre: "Chile" },
  { codigo: "PE", nombre: "Perú" },
  { codigo: "EC", nombre: "Ecuador" },
  { codigo: "VE", nombre: "Venezuela" },
  { codigo: "BO", nombre: "Bolivia" },
  { codigo: "PY", nombre: "Paraguay" },
  { codigo: "UY", nombre: "Uruguay" },
  { codigo: "PA", nombre: "Panamá" },
  { codigo: "CR", nombre: "Costa Rica" },
  { codigo: "GT", nombre: "Guatemala" },
  { codigo: "HN", nombre: "Honduras" },
  { codigo: "SV", nombre: "El Salvador" },
  { codigo: "NI", nombre: "Nicaragua" },
  { codigo: "DO", nombre: "República Dominicana" },
  { codigo: "PR", nombre: "Puerto Rico" },
  { codigo: "ES", nombre: "España" },
  { codigo: "US", nombre: "Estados Unidos" },
  { codigo: "CA", nombre: "Canadá" },
  { codigo: "BR", nombre: "Brasil" },
  { codigo: "GB", nombre: "Reino Unido" },
];

// Código telefónico por país -- para separar/componer el número de
// WhatsApp (código + dígitos nacionales). No todos los PAISES_COBERTURA
// necesitan esto hoy (solo WhatsApp lo usa), pero vive acá junto a la
// lista para no desincronizarse.
export const CODIGO_TELEFONICO: Record<string, string> = {
  CO: "57", MX: "52", AR: "54", CL: "56", PE: "51", EC: "593", VE: "58",
  BO: "591", PY: "595", UY: "598", PA: "507", CR: "506", GT: "502",
  HN: "504", SV: "503", NI: "505", DO: "1", PR: "1", ES: "34", US: "1",
  CA: "1", BR: "55", GB: "44",
};

// Menú desplegable personalizado con la bandera real de cada país (un
// <select> nativo de HTML no puede mostrar imágenes dentro de sus
// opciones, solo texto -- por eso este es un dropdown construido a mano
// en vez del <select> que había antes). Las banderas vienen de flagcdn.com
// en tamaño chico (20x15), con una letra de respaldo si la imagen falla.
export function BanderaPais({ codigo, tamano = 20 }: { codigo: string; tamano?: number }) {
  const [fallo, setFallo] = useState(false);
  const alto = Math.round((tamano * 15) / 20);
  if (fallo) {
    return (
      <span style={{ width: tamano, height: alto, borderRadius: 3, background: "#e8e8e6", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#999", flexShrink: 0 }}>
        {codigo}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/${tamano}x${alto}/${codigo.toLowerCase()}.png`}
      alt={codigo}
      width={tamano}
      height={alto}
      style={{ borderRadius: 3, display: "block", flexShrink: 0, objectFit: "cover" }}
      onError={() => setFallo(true)}
    />
  );
}

export function SelectorPais({ valor, onChange }: { valor: string; onChange: (codigo: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const paisActual = PAISES_COBERTURA.find((p) => p.codigo === valor) || PAISES_COBERTURA[0];

  useEffect(() => {
    if (!abierto) return;
    const cerrarSiAfuera = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarSiAfuera);
    return () => document.removeEventListener("mousedown", cerrarSiAfuera);
  }, [abierto]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", fontSize: 13, cursor: "pointer", boxSizing: "border-box", textAlign: "left" }}
      >
        <BanderaPais codigo={paisActual.codigo} />
        <span style={{ flex: 1, color: "#1a1a1a" }}>{paisActual.nombre}</span>
        <span style={{ color: "#999", fontSize: 11, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>▾</span>
      </button>
      {abierto && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto", padding: 4 }}>
          {PAISES_COBERTURA.map((p) => (
            <div
              key={p.codigo}
              onClick={() => { onChange(p.codigo); setAbierto(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: p.codigo === valor ? "#F3F2FE" : "transparent",
                fontSize: 13, color: p.codigo === valor ? "#534AB7" : "#1a1a1a", fontWeight: p.codigo === valor ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (p.codigo !== valor) e.currentTarget.style.background = "#f9f9f8"; }}
              onMouseLeave={(e) => { if (p.codigo !== valor) e.currentTarget.style.background = "transparent"; }}
            >
              <BanderaPais codigo={p.codigo} />
              <span>{p.nombre}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

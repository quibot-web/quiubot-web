"use client";
import { useState } from "react";

export const FUENTES_LOGO: Record<string, string[]> = {
  whatsapp: ["https://cdn.simpleicons.org/whatsapp", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/whatsapp.svg"],
  openai: ["https://cdn.simpleicons.org/openai", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg"],
  cloudinary: ["https://cdn.simpleicons.org/cloudinary", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/cloudinary.svg"],
  meta: ["https://cdn.simpleicons.org/meta", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/meta.svg"],
  facebook: ["https://cdn.simpleicons.org/facebook", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/facebook.svg"],
  instagram: ["https://cdn.simpleicons.org/instagram", "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/instagram.svg"],
};

// Logo de marca con cadena de respaldo: intenta la primera fuente, si falla
// (onError) pasa a la siguiente, y si se agotan todas muestra la inicial
// del nombre en vez de dejar un ícono roto en pantalla. Compartido entre
// app/page.tsx (Integraciones) y app/estrategia/page.tsx (carrusel de
// objetivos) -- antes vivía duplicado solo en page.tsx.
export default function LogoMarca({ marca, nombre, tamano = 28 }: { marca: keyof typeof FUENTES_LOGO; nombre: string; tamano?: number }) {
  const [intento, setIntento] = useState(0);
  const fuentes = FUENTES_LOGO[marca] || [];
  const agotado = intento >= fuentes.length;

  if (agotado) {
    return (
      <span style={{ fontSize: tamano * 0.6, fontWeight: 800, color: "#534AB7" }}>{nombre[0]?.toUpperCase()}</span>
    );
  }
  return (
    <img
      key={intento}
      src={fuentes[intento]}
      alt={nombre}
      width={tamano}
      height={tamano}
      style={{ display: "block" }}
      onError={() => setIntento((n) => n + 1)}
    />
  );
}

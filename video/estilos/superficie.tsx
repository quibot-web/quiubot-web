// Colores de las maquetas de interfaz según el estilo activo (18 nov
// 2026, revisión de Noche: el anuncio simulado seguía con la tarjeta
// lila clara del estilo de siempre y desentonaba sobre el fondo oscuro).
// renderizarVisual() lo provee cuando hay estilo; sin proveedor (reels
// sin estilo) son los colores de siempre.
import { createContext, useContext } from "react";
import { SUPERFICIE_CLASICA, type SuperficieTarjeta } from "./estilos";

const ContextoSuperficie = createContext<SuperficieTarjeta>(SUPERFICIE_CLASICA);

export const ProveedorSuperficie = ContextoSuperficie.Provider;

export function useSuperficie(): SuperficieTarjeta {
  return useContext(ContextoSuperficie);
}

// Borde + sombra de una tarjeta en el estilo activo (borde de marca y
// brillo en Noche/Foto, contorno y sombra dura en Color pleno).
export function estiloTarjeta(s: SuperficieTarjeta, sombraActiva?: string): React.CSSProperties {
  return {
    background: s.tarjeta,
    border: s.borde ? `5px solid ${s.borde}` : undefined,
    boxShadow: sombraActiva ?? s.sombra,
  };
}

"use client";
import { useEffect } from "react";

/* ============================================================
   MEDICION DE CONVERSION — Meta Pixel
   ============================================================
   Vive en el layout raiz (app/layout.tsx) para cargar UNA SOLA VEZ
   por sitio, sin importar en que pagina "aterriza" alguien primero
   -- antes vivia solo dentro de /bienvenida, asi que window.fbq no
   existia en ninguna otra pagina (incluido /registro, donde ya se
   intentaba disparar CompleteRegistration sin que hubiera pixel
   cargado para recibirlo).
   ============================================================ */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// trackEvento = eventos ESTANDAR de Meta (los que Meta reconoce para
// optimizar campañas: PageView, CompleteRegistration, etc.).
export function trackEvento(evento: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", evento, params);
  }
}

// trackCustom = eventos PROPIOS de Quiubot que no son parte del set
// estandar de Meta (ej. "ClicPruebaGratis") -- se registran con
// trackCustom en vez de track para no mezclarlos con los estandar.
export function trackCustom(evento: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", evento, params);
  }
}

// Lee el Pixel ID de la variable de entorno NEXT_PUBLIC_META_PIXEL_ID (Coolify + .env.local).
// Si no existe, cae al valor actual como respaldo — asi no se rompe nada si aun no
// has agregado la variable, pero ya queda listo para moverlo sin tocar codigo.
const META_PIXEL_ID: string = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2226087528185704";

export default function MetaPixelBase() {
  useEffect(() => {
    if (typeof window === "undefined" || window.fbq) return;
    if (META_PIXEL_ID === "TU_PIXEL_ID_AQUI") return; // evita cargar sin ID configurado

    const cargar = () => {
      const script = document.createElement("script");
      script.innerHTML = `
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${META_PIXEL_ID}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
    };

    // El pixel no bloquea nada visual, asi que espera a que el hilo
    // principal este libre (o 2s como tope) en vez de competir con la
    // primera pintura de la pagina -- requestIdleCallback no existe en
    // todos los navegadores (Safari), de ahi el respaldo con setTimeout.
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(cargar, { timeout: 2000 });
    } else {
      setTimeout(cargar, 1);
    }
  }, []);

  return null;
}

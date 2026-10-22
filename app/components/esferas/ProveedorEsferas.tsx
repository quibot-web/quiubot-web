"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { calcularMirada, calcularMiradaLibre, calcularOffsetPath } from "./esferasShared";

type ContextoEsferas = {
  registrar: (el: HTMLDivElement) => () => void;
};

const Contexto = createContext<ContextoEsferas | null>(null);

// Un solo listener global de pointermove/touchmove para la mirada de
// TODAS las esferas registradas -- nunca uno por esfera, por
// performance (ver mirarHacia en esferas_v3.html, que ya era un único
// listener sobre document.querySelectorAll('.bot')). También centraliza
// el intervalo de mirada libre (1400ms) y el recálculo de órbitas al
// cambiar el tamaño de ventana.
export function ProveedorEsferas({ children }: { children: ReactNode }) {
  const botsRef = useRef<Set<HTMLDivElement>>(new Set());
  const ultimoMovimientoRef = useRef(0);

  useEffect(() => {
    const mirarHacia = (x: number, y: number) => {
      ultimoMovimientoRef.current = performance.now();
      for (const bot of botsRef.current) {
        if (bot.classList.contains("trabajando") || bot.classList.contains("pausa")) continue;
        const { mx, my } = calcularMirada(bot, x, y);
        bot.style.setProperty("--mx", `${mx}px`);
        bot.style.setProperty("--my", `${my}px`);
      }
    };

    const onPointerMove = (e: PointerEvent) => mirarHacia(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) mirarHacia(t.clientX, t.clientY);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    const intervalo = setInterval(() => {
      if (performance.now() - ultimoMovimientoRef.current < 2500) return;
      for (const bot of botsRef.current) {
        const libre = calcularMiradaLibre(bot);
        if (!libre) continue;
        bot.style.setProperty("--mx", `${libre.mx}px`);
        bot.style.setProperty("--my", `${libre.my}px`);
      }
    }, 1400);

    const recalcularOrbitas = () => {
      for (const bot of botsRef.current) {
        if (!bot.classList.contains("trabajando")) continue;
        const gema = bot.querySelector<HTMLElement>("[data-gema]");
        if (gema) gema.style.offsetPath = calcularOffsetPath(bot);
      }
    };
    recalcularOrbitas();
    window.addEventListener("resize", recalcularOrbitas);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", recalcularOrbitas);
      clearInterval(intervalo);
    };
  }, []);

  const registrar = (el: HTMLDivElement) => {
    botsRef.current.add(el);
    return () => {
      botsRef.current.delete(el);
    };
  };

  return <Contexto.Provider value={{ registrar }}>{children}</Contexto.Provider>;
}

export function useRegistrarEsfera() {
  const ctx = useContext(Contexto);
  return ctx?.registrar;
}

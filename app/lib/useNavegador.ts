"use client";
// Nombre del navegador en un componente cliente, sin desajustar la
// hidratación (en el servidor no hay navigator: devuelve null).
import { useSyncExternalStore } from "react";
import { nombreNavegador } from "./navegador";

const sinSuscripcion = () => () => {};

export function useNombreNavegador(): string | null {
  return useSyncExternalStore(sinSuscripcion, () => nombreNavegador(navigator.userAgent), () => null);
}

export function useDescripcionEquipo(): string | null {
  return useSyncExternalStore(
    sinSuscripcion,
    () => {
      const n = navigator as Navigator & { deviceMemory?: number };
      return `${n.hardwareConcurrency ?? "?"} núcleos lógicos${n.deviceMemory ? `, ~${n.deviceMemory} GB` : ""}`;
    },
    () => null
  );
}

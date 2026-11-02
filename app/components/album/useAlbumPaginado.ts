"use client";
import { useEffect, useRef, useState } from "react";
import type { Filtro, ItemAlbum } from "./AlbumUI";

const LIMITE_PAGINA = 24;

// Fetch + estado de paginación compartido entre /album y SelectorAlbum
// -- deliberadamente sin IntersectionObserver acá adentro: cada quien
// tiene su propio contenedor con scroll (la ventana en /album, el div
// interno del modal en SelectorAlbum), así que cada uno registra su
// propio observer y solo llama a cargarMas() que este hook expone.
export function useAlbumPaginado() {
  const [items, setItems] = useState<ItemAlbum[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargarPagina = async (reiniciar: boolean, cursorActual: string | null, filtroActual: Filtro) => {
    if (reiniciar) setCargandoInicial(true);
    else setCargandoMas(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMITE_PAGINA) });
      if (filtroActual !== "todos") params.set("tipo", filtroActual);
      if (!reiniciar && cursorActual) params.set("cursor", cursorActual);

      const res = await fetch(`/api/album?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cargar tu álbum.");

      setItems((prev) => (reiniciar ? data.imagenes || [] : [...prev, ...(data.imagenes || [])]));
      setCursor(data.siguienteCursor || null);
      setHayMas(!!data.siguienteCursor);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo cargar tu álbum.");
    } finally {
      setCargandoInicial(false);
      setCargandoMas(false);
    }
  };

  // Primera carga y cada vez que cambia el filtro -- siempre reinicia
  // desde cero (cursor null), nunca mezcla páginas de dos filtros.
  useEffect(() => {
    cargarPagina(true, null, filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  // Ref para que cargarMas() siempre lea cursor/filtro actuales, sin
  // depender de que quien la llama (un observer registrado una sola
  // vez) tenga la versión más reciente en su closure.
  const estadoRef = useRef({ cursor, filtro, cargandoInicial, cargandoMas, hayMas });
  estadoRef.current = { cursor, filtro, cargandoInicial, cargandoMas, hayMas };

  const cargarMas = () => {
    const { cursor: c, filtro: f, cargandoInicial: ci, cargandoMas: cm, hayMas: hm } = estadoRef.current;
    if (ci || cm || !hm) return;
    cargarPagina(false, c, f);
  };

  const recargar = () => cargarPagina(true, null, filtro);

  return { items, filtro, setFiltro, cargandoInicial, cargandoMas, hayMas, errorMsg, cargarMas, recargar };
}

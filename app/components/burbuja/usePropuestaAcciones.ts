"use client";
// Fase 2, Commit 3 -- extrae de app/decisiones/page.tsx (sin reescribir
// la lógica de negocio, mismas rutas de siempre) las acciones sobre una
// propuesta: aprobar, rechazar, ajustar y reintentar. No se porta
// recuperarCreativos -- decisión explícita de dejarlo fuera del
// rediseño (no tenía botón visible en /decisiones tampoco).
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccionPropuesta } from "@/app/lib/metas";
import type { PropuestaUnificada } from "@/app/lib/propuestas";
import { asistenteDeMensaje, confirmacionExito, confirmacionFalla, TEXTO_RECHAZO } from "@/app/lib/directorChat";

export function idReal(id: string): string {
  return id.startsWith("notif-") ? id.slice(6) : id;
}

export function campanaIdDe(p: { parametros: Record<string, unknown> | null }): string | null {
  const id = p.parametros?.campana_id;
  return typeof id === "string" ? id : null;
}

// Lee la respuesta como texto primero -- si el proxy cortó la conexión
// a mitad de una llamada larga, lo que llega puede ser una página de
// error HTML (o nada), y res.json() directo tira un parse error críptico
// (en Safari). Esto siempre devuelve algo mostrable.
async function leerJsonSeguro(res: Response): Promise<{ [key: string]: unknown }> {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return { error: `Error del servidor (código ${res.status})` };
  }
}

export type RecienDecidida = {
  propuesta: PropuestaUnificada;
  etiqueta: string;
  confirmacion: { texto: string; avisoReconectarMeta?: boolean };
  // Fijado al crear la entrada, nunca recalculado al renderizar (ver
  // ChatShell -- necesita una fecha estable para el orden cronológico).
  creadoEn: string;
};

export type ErrorAccion = { mensaje: string; motivo?: string; paso?: string };

export function usePropuestaAcciones(campanasPorId: Record<string, string>, onCambio: () => void) {
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [ajustandoId, setAjustandoId] = useState<string | null>(null);
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("20");
  const [error, setError] = useState<ErrorAccion | null>(null);
  const [recienDecididas, setRecienDecididas] = useState<RecienDecidida[]>([]);

  const nombreCampanaDe = (p: PropuestaUnificada): string | null => {
    const id = campanaIdDe(p);
    return id ? campanasPorId[id] ?? null : null;
  };

  const router = useRouter();

  async function aprobar(p: PropuestaUnificada) {
    setProcesandoId(p.id);
    setError(null);
    try {
      const url = p.origen === "notificacion" ? `/api/notificaciones/${idReal(p.id)}/aceptar` : `/api/propuestas/${p.id}/aprobar`;
      const res = await fetch(url, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        const { texto, avisoReconectarMeta } = confirmacionFalla(asistenteDeMensaje(p), (data.error as string) || "No se pudo aprobar.", data.motivo as string | undefined);
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto, avisoReconectarMeta }, creadoEn: new Date().toISOString() }]);
        setError({ mensaje: (data.error as string) || "No se pudo aprobar.", motivo: data.motivo as string | undefined, paso: data.paso as string | undefined });
        return;
      }
      // El Estratega no publica nada solo -- aprobar esto lleva a
      // /estrategia con el objetivo ya precargado, igual que hoy.
      if (p.accion === "generar_estrategia" && p.metaId) {
        const propuesta = data.propuesta as { parametros?: Record<string, unknown> } | undefined;
        const params = propuesta?.parametros || {};
        const extra = new URLSearchParams();
        if (typeof params.presupuesto_diario_sugerido_cop === "number") {
          extra.set("presupuesto_sugerido_cop", String(params.presupuesto_diario_sugerido_cop));
        }
        if (Array.isArray(params.angulos_a_evitar) && params.angulos_a_evitar.length > 0) {
          extra.set("angulos_a_evitar", JSON.stringify(params.angulos_a_evitar));
        }
        const query = extra.toString();
        router.push(`/estrategia?meta_id=${p.metaId}${query ? `&${query}` : ""}`);
        return;
      }
      if (p.accion !== "crear_creativos") {
        const resultado = data.resultado as { presupuesto_antes?: number; presupuesto_despues?: number; anuncios_creados?: unknown[] } | undefined;
        const texto = confirmacionExito(p.accion as AccionPropuesta, {
          campanaNombre: nombreCampanaDe(p),
          presupuestoAntes: resultado?.presupuesto_antes,
          presupuestoDespues: resultado?.presupuesto_despues,
          cantidadAnuncios: resultado?.anuncios_creados?.length,
        });
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto }, creadoEn: new Date().toISOString() }]);
      }
      onCambio();
    } finally {
      setProcesandoId(null);
    }
  }

  async function rechazar(p: PropuestaUnificada) {
    setProcesandoId(p.id);
    setError(null);
    try {
      const url = p.origen === "notificacion" ? `/api/notificaciones/${idReal(p.id)}/descartar` : `/api/propuestas/${p.id}/rechazar`;
      const res = await fetch(url, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        setError({ mensaje: (data.error as string) || "No se pudo rechazar." });
        return;
      }
      setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "No por ahora", confirmacion: { texto: TEXTO_RECHAZO }, creadoEn: new Date().toISOString() }]);
      onCambio();
    } finally {
      setProcesandoId(null);
    }
  }

  async function confirmarAjuste(p: PropuestaUnificada, parametros: Record<string, unknown>) {
    setProcesandoId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/propuestas/${p.id}/ajustar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros }),
      });
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        const { texto, avisoReconectarMeta } = confirmacionFalla(asistenteDeMensaje(p), (data.error as string) || "No se pudo ajustar.", data.motivo as string | undefined);
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto, avisoReconectarMeta }, creadoEn: new Date().toISOString() }]);
        setError({ mensaje: (data.error as string) || "No se pudo ajustar.", motivo: data.motivo as string | undefined, paso: data.paso as string | undefined });
        return;
      }
      const resultado = data.resultado as { presupuesto_antes?: number; presupuesto_despues?: number; anuncios_creados?: unknown[] } | undefined;
      const texto = confirmacionExito(p.accion as AccionPropuesta, {
        campanaNombre: nombreCampanaDe(p),
        presupuestoAntes: resultado?.presupuesto_antes,
        presupuestoDespues: resultado?.presupuesto_despues,
        cantidadAnuncios: resultado?.anuncios_creados?.length,
      });
      setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto }, creadoEn: new Date().toISOString() }]);
      setAjustandoId(null);
      onCambio();
    } finally {
      setProcesandoId(null);
    }
  }

  async function reintentarAgregarAnuncios(id: string) {
    setProcesandoId(id);
    try {
      const res = await fetch(`/api/propuestas/${id}/reintentar`, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok || data.ok === false) {
        setError({ mensaje: (data.error as string) || "No se pudo reintentar." });
      } else {
        setError(null);
        onCambio();
      }
    } catch {
      setError({ mensaje: "No se pudo conectar con el servidor." });
    } finally {
      setProcesandoId(null);
    }
  }

  // "Aprobar todas las de este tipo" (decisión de la Fase 2): dispara el
  // mismo aprobar() de siempre, una vez por propuesta, en paralelo --
  // nunca un endpoint de lote nuevo. Si alguna falla, las demás siguen;
  // cada una deja su propia entrada en recienDecididas/error como si se
  // hubiera aprobado una por una.
  async function aprobarEnLote(propuestas: PropuestaUnificada[]) {
    await Promise.allSettled(propuestas.map((p) => aprobar(p)));
  }

  return {
    procesandoId,
    ajustandoId,
    setAjustandoId,
    porcentajeAjuste,
    setPorcentajeAjuste,
    error,
    setError,
    recienDecididas,
    aprobar,
    rechazar,
    confirmarAjuste,
    reintentarAgregarAnuncios,
    aprobarEnLote,
    nombreCampanaDe,
  };
}

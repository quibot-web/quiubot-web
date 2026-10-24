"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId, EstadoEsfera } from "@/app/components/esferas/esferasShared";
import { NOMBRE_ASISTENTE, asistenteDeMensaje } from "@/app/lib/directorChat";
import estilos from "./TarjetaEquipo.module.css";

const EQUIPO: { id: AsistenteId; corto: string; principal?: boolean }[] = [
  { id: "director", corto: "Director", principal: true },
  { id: "marca", corto: "Marca" },
  { id: "estratega", corto: "Estratega" },
  { id: "creativo", corto: "Creativo" },
  { id: "publicador", corto: "Publicador" },
  { id: "analista", corto: "Analista" },
  { id: "optimizador", corto: "Optimizador" },
];

const LARGO_MAXIMO_PREVIA = 42;

function textoCorto(titulo: string): string {
  return titulo.length > LARGO_MAXIMO_PREVIA ? `${titulo.slice(0, LARGO_MAXIMO_PREVIA - 1)}…` : titulo;
}

// Versión corta del recordatorio de renovación para la burbuja del
// Inicio (que tiene muy poco espacio) -- "recien_pagado" no entra acá,
// no es urgente, se ve completo en /decisiones.
const TEXTO_CORTO_RECORDATORIO: Record<string, string> = {
  "3_dias_antes": "Tu plan vence pronto",
  hoy_vence: "Hoy vence tu plan",
  vencido: "Tu plan venció",
};

// Bloque "equipo" del Inicio -- mismo diseño de tarjeta oscura que la
// sección "Así se vería el equipo en el inicio" de esferas_v3.html (el
// brillo de las esferas se pierde sobre blanco). Admin-only: si
// /api/metas no responde 200 (no-admin), no renderiza nada. El estado
// de cada asistente es "pausa" si el Autopiloto está pausado,
// "esperando" si tiene al menos una propuesta pendiente (real, de
// /api/propuestas -- lectura dual con notificaciones), o "normal".
// Todas las esferas llevan a la conversación con el Director en
// /decisiones: el Director a la bandeja general, las demás con
// ?asistente=<id> para enfocar sus temas ahí.
export default function TarjetaEquipo() {
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);
  const [asistentesEsperando, setAsistentesEsperando] = useState<Set<AsistenteId>>(new Set());
  const [previa, setPrevia] = useState<{ titulo: string; asistente: AsistenteId; extra: number } | null>(null);

  // El fetch a /api/metas sigue acá -- no por su contenido, sino porque
  // si no responde 200 (sin tieneAutopiloto) este bloque no debe
  // renderizar nada, igual que siempre. Lo que cambió es que ya no lee
  // "la" meta pausada de ahí: con varias metas activas a la vez (una
  // por tipo) ese "la" ya no existe, y el pausado ahora se ve por meta
  // en "Mis metas", no atenuando todo el equipo acá.
  useEffect(() => {
    Promise.all([
      fetch("/api/metas").then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
      fetch("/api/propuestas").then((r) => (r.ok ? r.json() : { propuestas: [] })),
      fetch("/api/billing/recordatorio").then((r) => (r.ok ? r.json() : { etapa: null })),
    ])
      .then(([, propuestasData, recordatorioData]) => {
        setVisible(true);
        const lista: any[] = propuestasData.propuestas ?? [];
        // El asistente siempre se deduce de la acción cuando la hay
        // (ASISTENTE_POR_ACCION, vía asistenteDeMensaje) -- nunca del
        // campo asistente guardado, para que un dato de prueba viejo o
        // un error futuro al guardar no cambie qué esfera se marca
        // "esperando".
        const conjunto = new Set<AsistenteId>(lista.map((p) => asistenteDeMensaje(p)));
        setAsistentesEsperando(conjunto);

        // El recordatorio de renovación tiene prioridad sobre la
        // propuesta más reciente en los 3 días antes de vencer, el día
        // que vence, y después de vencer -- "recien_pagado" no es
        // urgente, no compite por la burbuja.
        const textoUrgente = TEXTO_CORTO_RECORDATORIO[recordatorioData?.etapa];
        if (textoUrgente) {
          setPrevia({ titulo: textoUrgente, asistente: "director", extra: 0 });
          return;
        }

        // Si no, la burbuja muestra la propuesta más reciente -- las
        // campañas con problema (origen "problema_campana") no
        // compiten por ese lugar, solo aparecen si no hay ninguna
        // propuesta real.
        const reales = lista.filter((p) => p.origen !== "problema_campana");
        const candidatos = reales.length > 0 ? reales : lista;
        if (candidatos.length > 0) {
          const [masReciente, ...resto] = [...candidatos].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
          setPrevia({ titulo: masReciente.titulo, asistente: asistenteDeMensaje(masReciente), extra: resto.length });
        }
      })
      .catch(() => setVisible(false))
      .finally(() => setCargando(false));
  }, []);

  if (cargando || !visible) return null;

  const estadoDe = (id: AsistenteId): EstadoEsfera => {
    if (asistentesEsperando.has(id)) return "esperando";
    return "normal";
  };

  const textoDe = (id: AsistenteId): string => {
    if (asistentesEsperando.has(id)) return "Te necesita";
    return "Activo";
  };

  const ariaLabelDe = (id: AsistenteId): string => {
    const estado = textoDe(id);
    return id === "director" ? `Hablar con el Director: ${estado}` : `Hablar con el Director sobre el ${NOMBRE_ASISTENTE[id]}: ${estado}`;
  };

  return (
    <div style={{ background: "#17151f", border: "1px solid #26232f", borderRadius: 18, padding: "18px 18px 22px" }}>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#f2f1f7" }}>Mi equipo</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 2px", alignItems: "flex-start" }}>
        {EQUIPO.map((a) => (
          <div key={a.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 90, fontSize: 12, textAlign: "center" }}>
            <span
              className={a.principal ? estilos.contenedorDirector : undefined}
              style={{ display: "block", marginTop: a.principal ? 0 : 10 }}
            >
              {a.principal && previa && (
                <span className={estilos.burbujaPrevia}>
                  {textoCorto(previa.titulo)}
                  {previa.extra > 0 && ` +${previa.extra}`}
                </span>
              )}
              <Link
                href={a.id === "director" ? "/decisiones" : `/decisiones?asistente=${a.id}`}
                aria-label={ariaLabelDe(a.id)}
                className={estilos.enlaceEsfera}
              >
                <EsferaAsistente asistente={a.id} estado={estadoDe(a.id)} tamano={a.principal ? 78 : 58} />
              </Link>
            </span>
            <b style={{ fontWeight: 600, marginTop: 2, color: "#f2f1f7" }}>{a.corto}</b>
            <span style={{ color: "#a3a0b3" }}>{textoDe(a.id)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

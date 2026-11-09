"use client";
// Componente de chat compartido por los 5 chats (grupo "Equipo" en
// /equipo y en la burbuja, Director, cada asistente, Soporte) --
// comportamiento de WhatsApp: altura fija (el padre debe darle
// flex:1/min-height:0 dentro de un contenedor de altura fija, nunca
// una página que crece), orden cronológico con lo más nuevo abajo,
// "scroll infinito" hacia arriba, separadores de fecha pegajosos, no
// mueve la posición si llega un mensaje nuevo mientras el usuario lee
// arriba (avisa con un botón flotante), e indicador de "escribiendo".
//
// El "scroll infinito" es virtual: revela más de los items que ya
// llegaron del servidor (ya acotados -- 50-60 por fuente, ver las
// rutas que los traen), no pide más páginas al backend. Entre abrir el
// chat y agotar lo ya cargado no hay diferencia visible; más allá de
// eso, hoy no hay nada más que mostrar (mismo techo que ya existía con
// el botón "Ver anteriores" que este componente reemplaza).
//
// PENDIENTE (anotado, no resuelto todavía): paginar los mensajes
// antiguos desde el servidor con un cursor real (ej. ?antes=<fecha>),
// en vez de revelar lo ya cargado -- hoy el techo de historial es el
// mismo límite fijo de siempre (50-60 filas), esto solo cambiaría cómo
// se revela, no cuánto hay disponible.
import { useEffect, useRef, useState } from "react";
import { etiquetaFecha } from "./etiquetaFecha";

export type ItemChat = {
  id: string;
  creadoEn: string;
  render: () => React.ReactNode;
};

const LOTE_VISIBLE = 20;
const UMBRAL_FONDO_PX = 120;
const UMBRAL_TOPE_PX = 80;

export default function ChatShell({
  items,
  cargando,
  escribiendo,
  indicadorEscribiendo,
  pildora,
  pie,
  textoVacio = "Todavía no hay nada acá.",
  senalIrAlFondo,
  onScroll,
}: {
  /** Ascendente -- el más viejo primero, el más nuevo al final. */
  items: ItemChat[];
  cargando: boolean;
  escribiendo?: boolean;
  /** La burbujita "● ● ●" con la esfera de quien está respondiendo. */
  indicadorEscribiendo?: React.ReactNode;
  pildora?: { texto: string; onClick: () => void } | null;
  /** El campo de texto (o, en los chats de solo lectura, el botón de abajo). */
  pie: React.ReactNode;
  textoVacio?: string;
  /** Cambia este valor (ej. un contador) para forzar ir al fondo ya
   * mismo -- "Ver todo" lo usa para no depender de si el usuario
   * estaba "cerca del fondo" cuando quitó un filtro. */
  senalIrAlFondo?: number | string;
  /** Además del manejo interno de scroll (infinito, botón de nuevos),
   * para que el padre reaccione a cualquier scroll (ej. plegar un
   * encabezado de contexto). */
  onScroll?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibles, setVisibles] = useState(LOTE_VISIBLE);
  const [mensajesNuevos, setMensajesNuevos] = useState(0);
  const prevLongitudRef = useRef(0);
  const prevAlturaScrollRef = useRef(0);
  const yaAbrioRef = useRef(false);
  const cercaDelFondoRef = useRef(true);

  const itemsVisibles = items.slice(Math.max(0, items.length - visibles));
  const hayAnteriores = items.length > itemsVisibles.length;

  // Primera carga con datos: bajar al fondo ya mismo, sin animación --
  // como abrir un chat de WhatsApp, nunca se ve el historial completo
  // de un salto.
  useEffect(() => {
    if (cargando || yaAbrioRef.current || items.length === 0) return;
    yaAbrioRef.current = true;
    prevLongitudRef.current = items.length;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [cargando, items.length]);

  // Creció al final (mensaje nuevo, propio o de la otra punta): si el
  // usuario está cerca del fondo, lo sigue; si no, no lo mueve y avisa.
  useEffect(() => {
    if (!yaAbrioRef.current) return;
    const crecioAlFinal = items.length > prevLongitudRef.current;
    prevLongitudRef.current = items.length;
    if (!crecioAlFinal) return;

    const el = scrollRef.current;
    if (!el) return;
    if (cercaDelFondoRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      setMensajesNuevos((n) => n + 1);
    }
  }, [items.length]);

  function alHacerScroll() {
    const el = scrollRef.current;
    if (!el) return;

    onScroll?.();
    cercaDelFondoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < UMBRAL_FONDO_PX;
    if (cercaDelFondoRef.current) setMensajesNuevos(0);

    if (el.scrollTop < UMBRAL_TOPE_PX && hayAnteriores) {
      prevAlturaScrollRef.current = el.scrollHeight;
      setVisibles((v) => v + LOTE_VISIBLE);
    }
  }

  // Al revelar más anteriores, la posición del usuario no debe saltar
  // -- se compensa el alto nuevo que se agregó arriba.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !prevAlturaScrollRef.current) return;
    el.scrollTop += el.scrollHeight - prevAlturaScrollRef.current;
    prevAlturaScrollRef.current = 0;
  }, [visibles]);

  function irAlFondo() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setMensajesNuevos(0);
  }

  // Señal externa (ej. "Ver todo" al quitar el filtro de pendientes)
  // -- va DESPUÉS del efecto de "creció al final" a propósito, para
  // ganarle si ambos se disparan en la misma pasada (quitar el filtro
  // también cambia items.length).
  const senalAnteriorRef = useRef(senalIrAlFondo);
  useEffect(() => {
    if (senalIrAlFondo === undefined || senalIrAlFondo === senalAnteriorRef.current) return;
    senalAnteriorRef.current = senalIrAlFondo;
    requestAnimationFrame(irAlFondo);
  }, [senalIrAlFondo]);

  const grupos: { etiqueta: string; items: ItemChat[] }[] = [];
  for (const it of itemsVisibles) {
    const etiqueta = etiquetaFecha(it.creadoEn);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.etiqueta === etiqueta) ultimo.items.push(it);
    else grupos.push({ etiqueta, items: [it] });
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", position: "relative" }}>
      {pildora && (
        <button
          onClick={pildora.onClick}
          style={{
            alignSelf: "center",
            margin: "8px auto 0",
            background: "#F3F2FE",
            border: "none",
            borderRadius: 999,
            padding: "7px 16px",
            color: "#534AB7",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          {pildora.texto}
        </button>
      )}

      <div ref={scrollRef} onScroll={alHacerScroll} style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {cargando ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>Cargando...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>{textoVacio}</div>
        ) : (
          <>
            {hayAnteriores && <div style={{ textAlign: "center", fontSize: 11, color: "#bbb", padding: "4px 0" }}>Cargando anteriores...</div>}
            {grupos.map((g) => (
              // Cada día en su propio contenedor: el separador es
              // sticky DENTRO de él, así que no puede "pegarse" más
              // allá de donde termina ese día -- el siguiente día lo
              // empuja solo, nunca quedan dos fechas fijas a la vez
              // (option 1 del pedido: contención, no IntersectionObserver).
              <div key={`${g.etiqueta}-${g.items[0].id}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span
                  style={{
                    position: "sticky",
                    top: 6,
                    zIndex: 1,
                    alignSelf: "center",
                    background: "#fff",
                    color: "#666",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "4px 13px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                  }}
                >
                  {g.etiqueta}
                </span>
                {g.items.map((it) => (
                  <div key={it.id}>{it.render()}</div>
                ))}
              </div>
            ))}
            {escribiendo && indicadorEscribiendo}
          </>
        )}
      </div>

      {mensajesNuevos > 0 && (
        <button
          onClick={irAlFondo}
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#534AB7",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          }}
        >
          ↓ {mensajesNuevos} mensaje{mensajesNuevos === 1 ? "" : "s"} nuevo{mensajesNuevos === 1 ? "" : "s"}
        </button>
      )}

      <div style={{ flexShrink: 0 }}>{pie}</div>
    </div>
  );
}

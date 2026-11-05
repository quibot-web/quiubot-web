"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TASA_CIERRE_POR_CATEGORIA, type CategoriaTasaCierre } from "@/app/lib/director/tasaCierre";
import type { TipoMeta } from "@/app/lib/metas";
import type { PrefillFormularioRapido } from "./FormularioRapido";

export type MensajeDirector = {
  rol: "director" | "usuario";
  texto: string;
  opciones?: string[];
  accion?: { label: string; href: string };
  creado_en: string;
};

export type BorradorChat = {
  tipo?: TipoMeta;
  producto?: string;
  precio_cop?: number;
  tasa_cierre_categoria?: CategoriaTasaCierre;
  presupuesto_cop?: number;
  plazo_dias?: number;
  usuario_cta?: string;
  roas_minimo?: number;
};

export type RangoResultadosChat = {
  cantidadMin: number;
  cantidadMax: number;
  cantidadPuntoMedio: number;
  costoPorResultado: number;
  fuente: "tu_historial" | "promedio_quiubot" | "referencia_admin";
  ventasEstimadas: { min: number; max: number } | null;
};

export type ResumenListoChat = {
  borrador: BorradorChat & { tipo: TipoMeta; producto: string; presupuesto_cop: number; plazo_dias: number };
  fechaFin: string;
  rango: RangoResultadosChat;
};

export type DatosInicialesConversacion = {
  conversacionId: string;
  mensajes: MensajeDirector[];
  borrador: BorradorChat;
  resumen: ResumenListoChat | null;
  errorInicial?: string;
};

const ETIQUETA_TIPO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "Conversaciones por WhatsApp",
  leads: "Leads (contactos)",
  ventas_web: "Ventas en tu sitio web",
  visitas_web: "Visitas a tu sitio web",
  seguidores_facebook: "Seguidores de Facebook",
  seguidores_instagram: "Seguidores de Instagram",
};

const UNIDAD_RESULTADO: Record<TipoMeta, string> = {
  conversaciones_whatsapp: "conversaciones",
  leads: "leads",
  ventas_web: "ventas",
  visitas_web: "visitas",
  seguidores_facebook: "seguidores",
  seguidores_instagram: "seguidores",
};

const ETIQUETA_TASA_CIERRE: Record<CategoriaTasaCierre, string> = {
  "1_de_10": "1 de cada 10",
  "2_3_de_10": "2-3 de cada 10",
  "4_5_de_10": "4-5 de cada 10",
  mas_5_de_10: "más de 5 de cada 10",
  no_sabe: "sin medir todavía",
};

const FUENTE_LABEL: Record<RangoResultadosChat["fuente"], string> = {
  tu_historial: "Calculado con tu propio historial",
  promedio_quiubot: "Calculado con el promedio de clientes de Quiubot",
  referencia_admin: "Calculado con un valor de referencia",
};

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

export default function ConversacionDirector({
  datosIniciales,
  onPreferirFormulario,
  variante = "pagina",
}: {
  datosIniciales: DatosInicialesConversacion;
  onPreferirFormulario: (prefill?: PrefillFormularioRapido) => void;
  // "pagina" (por defecto): /metas/crear, pensado para el viewport
  // completo. "embebida": la burbuja del Director (Paso 6) la monta
  // dentro de un panel chico -- mismo componente y lógica, solo cambia
  // el contenedor exterior (sin 100vh ni el padding de página completa).
  variante?: "pagina" | "embebida";
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MensajeDirector[]>(datosIniciales.mensajes);
  const [borrador, setBorrador] = useState<BorradorChat>(datosIniciales.borrador);
  const [resumen, setResumen] = useState<ResumenListoChat | null>(datosIniciales.resumen);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorTurno, setErrorTurno] = useState<string | null>(datosIniciales.errorInicial || null);
  const [creandoMeta, setCreandoMeta] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, resumen]);

  function irAFormularioRapido() {
    onPreferirFormulario({
      tipo: borrador.tipo,
      presupuestoCop: borrador.presupuesto_cop,
      roasMinimo: borrador.roas_minimo,
      fechaFin: resumen?.fechaFin,
      conversacionId: datosIniciales.conversacionId,
    });
  }

  async function enviarMensaje(contenido: string) {
    const mensaje = contenido.trim();
    if (!mensaje || enviando) return;

    setMensajes((prev) => [...prev, { rol: "usuario", texto: mensaje, creado_en: new Date().toISOString() }]);
    setTexto("");
    setEnviando(true);
    setErrorTurno(null);

    try {
      const res = await fetch("/api/metas/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Decisión del plan: si OpenAI falla a mitad de camino, nunca se
        // pierde lo que ya se contó -- se ofrece seguir en el formulario
        // con el borrador tal como quedó (ver data.borrador, que el
        // servidor siempre devuelve incluso en el error).
        if (data.borrador) setBorrador(data.borrador);
        if (Array.isArray(data.mensajes)) setMensajes(data.mensajes);
        setErrorTurno(data.error || "No se pudo conversar con el Director en este momento.");
        return;
      }

      setMensajes(data.mensajes);
      setBorrador(data.borrador);
      setResumen(data.resumen ?? null);
    } catch {
      setErrorTurno("No se pudo conectar con el Director. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function crearMetaDesdeResumen() {
    if (!resumen) return;
    setCreandoMeta(true);
    setErrorCreacion(null);

    const contexto: Record<string, unknown> = { producto: resumen.borrador.producto, origen: "conversacion", version: 1 };
    if (resumen.borrador.precio_cop !== undefined) contexto.precio_cop = resumen.borrador.precio_cop;
    if (resumen.borrador.tasa_cierre_categoria) contexto.tasa_cierre = TASA_CIERRE_POR_CATEGORIA[resumen.borrador.tasa_cierre_categoria];

    try {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: resumen.borrador.tipo,
          cantidad_objetivo: resumen.rango.cantidadPuntoMedio,
          fecha_fin: resumen.fechaFin,
          presupuesto_maximo_cop: resumen.borrador.presupuesto_cop,
          roas_minimo: resumen.borrador.roas_minimo,
          contexto,
          conversacion_id: datosIniciales.conversacionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCreacion(data.error || "No se pudo crear la meta.");
        setCreandoMeta(false);
        return;
      }
      router.push("/");
    } catch (err) {
      setErrorCreacion(err instanceof Error ? err.message : "Algo salió mal.");
      setCreandoMeta(false);
    }
  }

  const ultimoMensaje = mensajes[mensajes.length - 1];
  const opcionesActivas = !enviando && !resumen && ultimoMensaje?.rol === "director" ? ultimoMensaje.opciones : undefined;
  const accionActiva = !resumen && ultimoMensaje?.rol === "director" ? ultimoMensaje.accion : undefined;

  // Progreso aproximado -- la conversación no sigue un orden fijo (el
  // Director puede saltar según lo que el cliente ya contó), así que
  // esto es una estimación por campos llenos, no una máquina de estados.
  const pasos = [!!borrador.tipo, !!borrador.producto, !!borrador.presupuesto_cop, !!resumen];

  const esPagina = variante === "pagina";

  return (
    <div
      style={
        esPagina
          ? { minHeight: "100vh", background: "#F8F8F6", fontFamily: "-apple-system, Inter, Segoe UI, Roboto, sans-serif", display: "flex", justifyContent: "center", padding: "28px 16px 40px" }
          : { height: "100%", background: "#F8F8F6", fontFamily: "-apple-system, Inter, Segoe UI, Roboto, sans-serif", display: "flex", flexDirection: "column", padding: "14px 14px 10px", overflow: "hidden" }
      }
    >
      <div style={esPagina ? { maxWidth: 760, width: "100%" } : { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #B7A9FF, #5546B8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 22,
                boxShadow: "0 6px 18px -6px rgba(85,70,184,0.6)",
                flexShrink: 0,
              }}
            >
              ✦
            </div>
            <div>
              <b style={{ fontSize: 18, display: "block", color: "#1B1A22" }}>Director de Quiubot</b>
              <small style={{ color: "#1E9E6B", fontWeight: 600, fontSize: 13 }}>● Armando tu meta contigo</small>
            </div>
          </div>
          <button
            onClick={irAFormularioRapido}
            style={{ background: "none", border: "none", color: "#6B6880", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Prefiero llenarlo yo
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {pasos.map((activo, i) => (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 9, background: activo ? "#5546B8" : "#E3E0EE" }} />
          ))}
        </div>

        <div style={esPagina ? { display: "flex", flexDirection: "column", gap: 12 } : { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {mensajes.map((m, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.rol === "usuario" ? "flex-end" : "flex-start", gap: 8 }}>
              <div
                style={{
                  maxWidth: "82%",
                  padding: "13px 16px",
                  borderRadius: m.rol === "usuario" ? "20px 6px 20px 20px" : "6px 20px 20px 20px",
                  fontSize: 15.5,
                  lineHeight: 1.45,
                  background: m.rol === "usuario" ? "#5546B8" : "#fff",
                  color: m.rol === "usuario" ? "#fff" : "#1B1A22",
                  border: m.rol === "usuario" ? "none" : "1px solid #E9E7EE",
                }}
              >
                {m.texto}
              </div>
              {/* Chips y botón de acción solo en el ÚLTIMO mensaje del
                  Director -- en mensajes viejos ya no tiene sentido
                  volver a responderlos. */}
              {i === mensajes.length - 1 && m.rol === "director" && (opcionesActivas?.length || accionActiva) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {opcionesActivas?.map((op) => (
                    <button
                      key={op}
                      onClick={() => enviarMensaje(op)}
                      disabled={enviando}
                      style={{
                        border: "1.5px solid #E9E7EE",
                        background: "#fff",
                        borderRadius: 999,
                        padding: "9px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: enviando ? "default" : "pointer",
                        color: "#1B1A22",
                      }}
                    >
                      {op}
                    </button>
                  ))}
                  {accionActiva && (
                    <a
                      href={accionActiva.href}
                      style={{
                        border: "1.5px solid #5546B8",
                        background: "#EFEDFB",
                        borderRadius: 999,
                        padding: "9px 14px",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#5546B8",
                        textDecoration: "none",
                      }}
                    >
                      {accionActiva.label} →
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {enviando && (
            <div style={{ alignSelf: "flex-start", padding: "13px 16px", borderRadius: "6px 20px 20px 20px", background: "#fff", border: "1px solid #E9E7EE", color: "#6B6880", fontSize: 14 }}>
              El Director está escribiendo...
            </div>
          )}

          {resumen && (
            <div style={{ alignSelf: "flex-start", width: "min(560px, 100%)", background: "#fff", border: "2px solid #5546B8", borderRadius: 20, padding: 16 }}>
              <h4 style={{ fontSize: 14, color: "#6B6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 10px" }}>Tu meta</h4>
              <Fila etiqueta="Objetivo" valor={ETIQUETA_TIPO[resumen.borrador.tipo]} />
              <Fila
                etiqueta="Meta"
                valor={
                  resumen.rango.ventasEstimadas
                    ? `${resumen.rango.cantidadPuntoMedio} ${UNIDAD_RESULTADO[resumen.borrador.tipo]} · ~${resumen.rango.ventasEstimadas.min}-${resumen.rango.ventasEstimadas.max} ventas`
                    : `${resumen.rango.cantidadPuntoMedio} ${UNIDAD_RESULTADO[resumen.borrador.tipo]}`
                }
              />
              <Fila etiqueta="Producto" valor={resumen.borrador.producto} />
              <Fila etiqueta="Presupuesto" valor={`${formatoCop(resumen.borrador.presupuesto_cop)} en ${resumen.borrador.plazo_dias} días`} />
              {resumen.borrador.tasa_cierre_categoria && (
                <Fila etiqueta="Tasa de cierre" valor={ETIQUETA_TASA_CIERRE[resumen.borrador.tasa_cierre_categoria]} />
              )}

              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12.5, color: "#6B6880" }}>
                {FUENTE_LABEL[resumen.rango.fuente]}: entre {resumen.rango.cantidadMin} y {resumen.rango.cantidadMax} {UNIDAD_RESULTADO[resumen.borrador.tipo]} según el presupuesto. Son rangos, no garantías.
              </p>
              {resumen.borrador.tasa_cierre_categoria === "no_sabe" && (
                <p style={{ marginTop: 6, marginBottom: 0, background: "#FFF6E5", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, color: "#7A5200" }}>
                  📊 El estimado de ventas usa un número conservador porque todavía no mides tu tasa de cierre real -- vale la pena medirla en las primeras semanas para afinar esto.
                </p>
              )}

              {errorCreacion && (
                <p style={{ marginTop: 10, marginBottom: 0, background: "#FEF0EF", color: "#B3261E", borderRadius: 10, padding: "10px 12px", fontSize: 13.5 }}>{errorCreacion}</p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  onClick={crearMetaDesdeResumen}
                  disabled={creandoMeta}
                  style={{ flex: 1, border: 0, borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: creandoMeta ? "default" : "pointer", background: "#5546B8", color: "#fff" }}
                >
                  {creandoMeta ? "Creando..." : "✓ Crear mi meta"}
                </button>
                <button
                  onClick={() => enviarMensaje("Quiero cambiar algo de la meta")}
                  disabled={creandoMeta}
                  style={{ flex: 1, border: "1.5px solid #E9E7EE", borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: creandoMeta ? "default" : "pointer", background: "#fff", color: "#1B1A22" }}
                >
                  Cambiar algo
                </button>
              </div>
            </div>
          )}

          {errorTurno && (
            <div style={{ alignSelf: "flex-start", width: "min(560px, 100%)", background: "#FEF0EF", border: "1px solid #F3C6C2", borderRadius: 16, padding: "14px 16px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: "#B3261E" }}>{errorTurno}</p>
              <button
                onClick={irAFormularioRapido}
                style={{ border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", background: "#B3261E", color: "#fff" }}
              >
                Seguir en el formulario rápido
              </button>
            </div>
          )}

          <div ref={finRef} />
        </div>

        {!resumen && (
          <div style={esPagina ? { position: "sticky", bottom: 0, marginTop: 22, display: "flex", gap: 8, background: "#F8F8F6", padding: "10px 0" } : { flexShrink: 0, marginTop: 10, display: "flex", gap: 8, background: "#F8F8F6", padding: "10px 0 0" }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarMensaje(texto)}
              placeholder="Escríbele al Director..."
              disabled={enviando}
              style={{ flex: 1, background: "#fff", border: "1.5px solid #E9E7EE", borderRadius: 999, padding: "13px 18px", fontSize: 15, outline: "none" }}
            />
            <button
              onClick={() => enviarMensaje(texto)}
              disabled={enviando || !texto.trim()}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#5546B8",
                color: "#fff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                cursor: enviando || !texto.trim() ? "default" : "pointer",
                opacity: enviando || !texto.trim() ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #E9E7EE", fontSize: 14.5 }}>
      <span style={{ color: "#6B6880" }}>{etiqueta}</span>
      <b>{valor}</b>
    </div>
  );
}

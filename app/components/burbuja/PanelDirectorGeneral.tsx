"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatShell, { type ItemChat } from "@/app/components/chat/ChatShell";
import IndicadorEscribiendo from "@/app/components/chat/IndicadorEscribiendo";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { ContextoCuentaDirector } from "@/app/lib/director/contextoCuenta";
import type { ContenidoMeta, ResumenMetaListo } from "@/app/lib/director/flujoCrearMeta";
import { TASA_CIERRE_POR_CATEGORIA, type CategoriaTasaCierre } from "@/app/lib/director/tasaCierre";
import type { TipoMeta } from "@/app/lib/metas";
import type { PrefillFormularioRapido } from "@/app/metas/crear/FormularioRapido";

type AccionDirector = {
  label: string;
  tipo: "link" | "crear_meta" | "ir_a_soporte";
  href?: string;
};

type MensajeDirector = {
  rol: "user" | "assistant";
  mensaje: string;
  acciones?: AccionDirector[];
  contenido?: ContenidoMeta | null;
  creado_en?: string;
};

const ETIQUETA_CONEXION: { clave: keyof ContextoCuentaDirector["conexiones"]; etiqueta: string }[] = [
  { clave: "meta", etiqueta: "Meta Ads" },
  { clave: "pixel", etiqueta: "Píxel" },
  { clave: "instagram", etiqueta: "Instagram" },
  { clave: "openai", etiqueta: "OpenAI" },
  { clave: "cloudinary", etiqueta: "Cloudinary" },
];

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

const ETIQUETA_TASA_CIERRE: Record<string, string> = {
  "1_de_10": "1 de cada 10",
  "2_3_de_10": "2-3 de cada 10",
  "4_5_de_10": "4-5 de cada 10",
  mas_5_de_10: "más de 5 de cada 10",
  no_sabe: "sin medir todavía",
};

const FUENTE_LABEL: Record<ResumenMetaListo["rango"]["fuente"], string> = {
  tu_historial: "Calculado con tu propio historial",
  promedio_quiubot: "Calculado con el promedio de clientes de Quiubot",
  referencia_admin: "Calculado con un valor de referencia",
};

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function TarjetaContexto({ contexto }: { contexto: ContextoCuentaDirector }) {
  return (
    <div style={{ background: "#F8F8FD", border: "1px solid #E3E1F7", borderRadius: 12, padding: "10px 12px", fontSize: 11.5, margin: "10px 14px 0" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: contexto.propuestasPendientes > 0 ? 8 : 0 }}>
        {ETIQUETA_CONEXION.map(({ clave, etiqueta }) => {
          const conectado = contexto.conexiones[clave].conectado;
          return (
            <span key={clave} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #E9E7EE", borderRadius: 999, padding: "3px 8px", color: "#1a1a1a" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: conectado ? "#1E9E6B" : "#E5AE3A" }} />
              {etiqueta}
            </span>
          );
        })}
      </div>
      {contexto.propuestasPendientes > 0 && (
        <Link href="/equipo" style={{ color: "#534AB7", fontWeight: 700, textDecoration: "none" }}>
          {contexto.propuestasPendientes} propuesta{contexto.propuestasPendientes === 1 ? "" : "s"} pendiente{contexto.propuestasPendientes === 1 ? "" : "s"} →
        </Link>
      )}
    </div>
  );
}

function BarraPasos({ pasos }: { pasos: boolean[] }) {
  return (
    <div style={{ display: "flex", gap: 5, width: "min(220px, 100%)", margin: "2px 0 2px 34px" }}>
      {pasos.map((activo, i) => (
        <span key={i} style={{ flex: 1, height: 5, borderRadius: 9, background: activo ? "#5546B8" : "#E3E0EE" }} />
      ))}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #E9E7EE", fontSize: 13 }}>
      <span style={{ color: "#6B6880" }}>{etiqueta}</span>
      <b>{valor}</b>
    </div>
  );
}

function TarjetaResumenMeta({
  resumen,
  anchoMax,
  mostrarAcciones,
  creandoMeta,
  errorCreacion,
  onCrear,
  onCambiarAlgo,
}: {
  resumen: ResumenMetaListo;
  anchoMax: number;
  mostrarAcciones: boolean;
  creandoMeta: boolean;
  errorCreacion: string | null;
  onCrear: () => void;
  onCambiarAlgo: () => void;
}) {
  // El schema valida borrador discriminado por tipo (cada tipo solo
  // tiene los campos que le aplican) -- acá solo se muestra lo que haya,
  // así que se lee como objeto suelto en vez de narrowing por tipo.
  const borrador = resumen.borrador as ResumenMetaListo["borrador"] & { tasa_cierre_categoria?: CategoriaTasaCierre; precio_cop?: number; roas_minimo?: number };

  return (
    <div style={{ alignSelf: "flex-start", width: `min(${anchoMax}px, 100%)`, marginLeft: 34, background: "#fff", border: "2px solid #5546B8", borderRadius: 16, padding: 14 }}>
      <h4 style={{ fontSize: 12, color: "#6B6880", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px" }}>Tu meta</h4>
      <Fila etiqueta="Objetivo" valor={ETIQUETA_TIPO[borrador.tipo]} />
      <Fila
        etiqueta="Meta"
        valor={
          resumen.rango.ventasEstimadas
            ? `${resumen.rango.cantidadPuntoMedio} ${UNIDAD_RESULTADO[borrador.tipo]} · ~${resumen.rango.ventasEstimadas.min}-${resumen.rango.ventasEstimadas.max} ventas`
            : `${resumen.rango.cantidadPuntoMedio} ${UNIDAD_RESULTADO[borrador.tipo]}`
        }
      />
      <Fila etiqueta="Producto" valor={borrador.producto} />
      <Fila etiqueta="Presupuesto" valor={`${formatoCop(borrador.presupuesto_cop)} en ${borrador.plazo_dias} días`} />
      {borrador.tasa_cierre_categoria && <Fila etiqueta="Tasa de cierre" valor={ETIQUETA_TASA_CIERRE[borrador.tasa_cierre_categoria]} />}

      <p style={{ marginTop: 10, marginBottom: 0, fontSize: 11.5, color: "#6B6880" }}>
        {FUENTE_LABEL[resumen.rango.fuente]}: entre {resumen.rango.cantidadMin} y {resumen.rango.cantidadMax} {UNIDAD_RESULTADO[borrador.tipo]} según el presupuesto. Son rangos, no
        garantías.
      </p>

      {mostrarAcciones && (
        <>
          {errorCreacion && <p style={{ marginTop: 10, marginBottom: 0, background: "#FEF0EF", color: "#B3261E", borderRadius: 10, padding: "9px 11px", fontSize: 12.5 }}>{errorCreacion}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={onCrear}
              disabled={creandoMeta}
              style={{ flex: 1, border: 0, borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 13.5, cursor: creandoMeta ? "default" : "pointer", background: "#5546B8", color: "#fff" }}
            >
              {creandoMeta ? "Creando..." : "✓ Crear mi meta"}
            </button>
            <button
              onClick={onCambiarAlgo}
              disabled={creandoMeta}
              style={{ flex: 1, border: "1.5px solid #E9E7EE", borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 13.5, cursor: creandoMeta ? "default" : "pointer", background: "#fff", color: "#1B1A22" }}
            >
              Cambiar algo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PanelDirectorGeneral({
  activo,
  historialInicial,
  metaActivaId: metaActivaIdInicial,
  contexto,
  autoenviar,
  onConsumidoAutoenviar,
  onIrASoporte,
  onCambiarEstado,
  variante = "embebida",
  onPreferirFormulario,
  autoIniciarCrearMeta = false,
}: {
  activo: boolean;
  historialInicial: MensajeDirector[];
  metaActivaId: string | null;
  contexto: ContextoCuentaDirector | null;
  autoenviar: string | null;
  onConsumidoAutoenviar: () => void;
  onIrASoporte: (pregunta: string) => void;
  onCambiarEstado?: (estado: "listo" | "pensando") => void;
  // "embebida" (por defecto): la burbuja. "pagina": /metas/crear, que
  // monta este mismo componente a pantalla completa -- un solo chat,
  // nunca dos Directores distintos.
  variante?: "embebida" | "pagina";
  onPreferirFormulario?: (prefill?: PrefillFormularioRapido) => void;
  // /metas/crear (variante "pagina") llega con la intención de crear
  // una meta ya decidida -- entra directo al flujo en vez de esperar un
  // click en "Crear una meta" (ver empezarOContinuarCrearMeta: si ya
  // hay un borrador activo, esto solo baja al hilo existente).
  autoIniciarCrearMeta?: boolean;
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MensajeDirector[]>(historialInicial);
  // Mientras haya un borrador activo (servidor, no una suposición por el
  // historial -- un cliente puede haber creado y abandonado metas
  // antes), TODO lo que escriba va al flujo de crear meta: el prompt de
  // esa conversación ya sabe responder con amabilidad si el cliente se
  // sale del tema ("fuera_de_tema"), así que no hace falta adivinar acá
  // cuál de las dos conversaciones "quiso" continuar.
  const [metaActivaId, setMetaActivaId] = useState<string | null>(metaActivaIdInicial);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"listo" | "pensando">("listo");
  const [senalIrAlFondo, setSenalIrAlFondo] = useState(0);
  const [creandoMeta, setCreandoMeta] = useState(false);
  const [errorCreacion, setErrorCreacion] = useState<string | null>(null);

  async function enviarTurno(mensajeTexto: string | null, intencion?: "crear_meta") {
    if (estado === "pensando") return;
    if (!mensajeTexto && intencion !== "crear_meta") return;

    if (mensajeTexto) setMensajes((prev) => [...prev, { rol: "user", mensaje: mensajeTexto, creado_en: new Date().toISOString() }]);
    setTexto("");
    setEstado("pensando");
    onCambiarEstado?.("pensando");

    try {
      const res = await fetch("/api/director/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: mensajeTexto, intencion }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMensajes((prev) => [...prev, { rol: "assistant", mensaje: data.error || "Algo salió mal, intenta de nuevo.", creado_en: new Date().toISOString() }]);
      } else {
        if (typeof data.conversacionId === "string") setMetaActivaId(data.conversacionId);
        setMensajes((prev) => [...prev, { ...data.mensajeDirector, creado_en: data.mensajeDirector.creado_en ?? new Date().toISOString() }]);
      }
    } catch {
      setMensajes((prev) => [...prev, { rol: "assistant", mensaje: "No se pudo conectar con el Director. Intenta de nuevo.", creado_en: new Date().toISOString() }]);
    } finally {
      setEstado("listo");
      onCambiarEstado?.("listo");
      setSenalIrAlFondo((v) => v + 1);
    }
  }

  // "Crear una meta" / el botón que ofrece la IA: si ya hay un borrador
  // activo, su hilo ya está visible más arriba -- no vuelve a empezar,
  // solo baja al último mensaje.
  function empezarOContinuarCrearMeta() {
    if (metaActivaId) {
      setSenalIrAlFondo((v) => v + 1);
      return;
    }
    enviarTurno(null, "crear_meta");
  }

  function enviarDesdeInput() {
    enviarTurno(texto, metaActivaId ? "crear_meta" : undefined);
  }

  function irAFormularioRapido() {
    if (variante === "pagina") {
      onPreferirFormulario?.(metaActivaId ? { conversacionId: metaActivaId } : undefined);
    } else {
      window.location.href = "/metas/crear?formulario=1";
    }
  }

  async function crearMetaDesdeResumen(resumen: ResumenMetaListo) {
    if (!metaActivaId || creandoMeta) return;
    setCreandoMeta(true);
    setErrorCreacion(null);

    const borrador = resumen.borrador as ResumenMetaListo["borrador"] & { tasa_cierre_categoria?: CategoriaTasaCierre; precio_cop?: number; roas_minimo?: number };
    const contextoMeta: Record<string, unknown> = { producto: borrador.producto, origen: "conversacion", version: 1 };
    if (borrador.precio_cop !== undefined) contextoMeta.precio_cop = borrador.precio_cop;
    if (borrador.tasa_cierre_categoria) contextoMeta.tasa_cierre = TASA_CIERRE_POR_CATEGORIA[borrador.tasa_cierre_categoria];

    try {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: borrador.tipo,
          cantidad_objetivo: resumen.rango.cantidadPuntoMedio,
          fecha_fin: resumen.fechaFin,
          presupuesto_maximo_cop: borrador.presupuesto_cop,
          roas_minimo: borrador.roas_minimo,
          contexto: contextoMeta,
          conversacion_id: metaActivaId,
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

  const yaAutoinicioRef = useRef(false);
  useEffect(() => {
    if (!autoIniciarCrearMeta || yaAutoinicioRef.current) return;
    yaAutoinicioRef.current = true;
    const id = setTimeout(() => empezarOContinuarCrearMeta(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIniciarCrearMeta]);

  // Handoff desde Soporte (redirigirADirector) -- llega con la pregunta
  // ya escrita y se manda sola, una sola vez.
  useEffect(() => {
    if (!autoenviar) return;
    // setTimeout(0) en vez de llamar enviarTurno() directo acá -- el
    // envío real queda en un callback, no en el cuerpo síncrono del
    // efecto (react-hooks/set-state-in-effect).
    const id = setTimeout(() => {
      enviarTurno(autoenviar);
      onConsumidoAutoenviar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoenviar]);

  if (!activo) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: 14 }}>
        <div style={{ background: "#f5f4fb", border: "1px solid #e3e1f7", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#444", textAlign: "center", width: "100%" }}>
          Para que el Director te guíe, conecta tu cuenta de OpenAI en{" "}
          <Link href="/?tab=integraciones" style={{ color: "#534AB7", fontWeight: 600 }}>
            Integraciones
          </Link>
          .
        </div>
      </div>
    );
  }

  const anchoCard = variante === "pagina" ? 480 : 300;
  const ultimoIndice = mensajes.length - 1;

  const items: ItemChat[] = mensajes.map((m, i) => {
    const esUltimo = i === ultimoIndice;
    const accionesActivas = esUltimo && m.rol === "assistant" ? m.acciones : undefined;
    const contenido = m.rol === "assistant" ? m.contenido : undefined;
    const mostrarPasos = esUltimo && contenido?.pasos && !contenido.resumen;
    const mostrarOpcionesMeta = esUltimo && (contenido?.opciones?.length || contenido?.accionMeta);

    return {
      id: `m-${i}`,
      creadoEn: m.creado_en ?? new Date(0).toISOString(),
      render: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: m.rol === "user" ? "flex-end" : "flex-start" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {m.rol === "assistant" && <EsferaAsistente asistente="director" estado="normal" tamano={26} />}
            <div
              style={{
                background: m.rol === "user" ? "#534AB7" : "#f2f2f0",
                color: m.rol === "user" ? "#fff" : "#1a1a1a",
                padding: "8px 12px",
                borderRadius: 12,
                fontSize: 13,
                maxWidth: variante === "pagina" ? 420 : 230,
                lineHeight: 1.4,
              }}
            >
              {m.mensaje}
            </div>
          </div>

          {mostrarPasos && <BarraPasos pasos={contenido!.pasos!} />}

          {accionesActivas && accionesActivas.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: 34 }}>
              {accionesActivas.map((a, j) =>
                a.tipo === "link" && a.href ? (
                  <Link key={j} href={a.href} style={estiloChipLink}>
                    {a.label}
                  </Link>
                ) : (
                  <button key={j} onClick={() => (a.tipo === "crear_meta" ? empezarOContinuarCrearMeta() : onIrASoporte(ultimoMensajeUsuarioAnterior(mensajes)))} style={estiloChip}>
                    {a.label}
                  </button>
                )
              )}
            </div>
          )}

          {mostrarOpcionesMeta && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginLeft: 34 }}>
              {contenido?.opciones?.map((op) => (
                <button key={op} onClick={() => enviarTurno(op, "crear_meta")} disabled={estado === "pensando"} style={estiloChip}>
                  {op}
                </button>
              ))}
              {contenido?.accionMeta && (
                <Link href={contenido.accionMeta.href} style={estiloChipLink}>
                  {contenido.accionMeta.label} →
                </Link>
              )}
            </div>
          )}

          {contenido?.resumen && (
            <TarjetaResumenMeta
              resumen={contenido.resumen}
              anchoMax={anchoCard}
              mostrarAcciones={esUltimo}
              creandoMeta={creandoMeta}
              errorCreacion={errorCreacion}
              onCrear={() => crearMetaDesdeResumen(contenido.resumen!)}
              onCambiarAlgo={() => enviarTurno("Quiero cambiar algo de la meta", "crear_meta")}
            />
          )}
        </div>
      ),
    };
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {variante === "pagina" ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 10px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "radial-gradient(circle at 35% 30%, #B7A9FF, #5546B8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 19,
                boxShadow: "0 6px 18px -6px rgba(85,70,184,0.6)",
                flexShrink: 0,
              }}
            >
              ✦
            </div>
            <div>
              <b style={{ fontSize: 17, display: "block", color: "#1B1A22" }}>Director de Quiubot</b>
              <small style={{ color: "#1E9E6B", fontWeight: 600, fontSize: 12.5 }}>● Armando tu meta contigo</small>
            </div>
          </div>
          <button onClick={irAFormularioRapido} style={{ background: "none", border: "none", color: "#6B6880", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Prefiero llenarlo yo
          </button>
        </div>
      ) : (
        <>
          {contexto && <TarjetaContexto contexto={contexto} />}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 14px 0", flexShrink: 0 }}>
            <button onClick={empezarOContinuarCrearMeta} style={estiloChip}>
              Crear una meta
            </button>
            <Link href="/equipo" style={estiloChipLink}>
              Ver propuestas
            </Link>
            <Link href="/?tab=integraciones" style={estiloChipLink}>
              Conectar integraciones
            </Link>
            <button onClick={() => onIrASoporte("")} style={estiloChip}>
              Hablar con Soporte
            </button>
            {metaActivaId && (
              <button onClick={irAFormularioRapido} style={estiloChipTexto}>
                Prefiero llenar mi meta yo mismo
              </button>
            )}
          </div>
        </>
      )}

      <ChatShell
        items={items}
        cargando={false}
        escribiendo={estado === "pensando"}
        indicadorEscribiendo={<IndicadorEscribiendo asistente="director" />}
        textoVacio="Escríbele al Director lo que necesites."
        senalIrAlFondo={senalIrAlFondo}
        pie={
          <div style={{ display: "flex", borderTop: "1px solid #eee", padding: 10, gap: 8 }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviarDesdeInput()}
              placeholder="Escríbele al Director..."
              disabled={estado === "pensando"}
              style={{ flex: 1, border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={enviarDesdeInput}
              disabled={estado === "pensando" || !texto.trim()}
              style={{
                background: "#534AB7",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: estado === "pensando" ? "default" : "pointer",
                opacity: estado === "pensando" || !texto.trim() ? 0.6 : 1,
              }}
            >
              {estado === "pensando" ? "..." : "Enviar"}
            </button>
          </div>
        }
      />
    </div>
  );
}

function ultimoMensajeUsuarioAnterior(mensajes: MensajeDirector[]): string {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i].rol === "user") return mensajes[i].mensaje;
  }
  return "";
}

const estiloChip: CSSProperties = {
  border: "1.5px solid #E9E7EE",
  background: "#fff",
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "#1B1A22",
};

const estiloChipLink: CSSProperties = {
  border: "1.5px solid #534AB7",
  background: "#EFEDFB",
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 12,
  fontWeight: 700,
  color: "#534AB7",
  textDecoration: "none",
  display: "inline-block",
};

const estiloChipTexto: CSSProperties = {
  border: "none",
  background: "none",
  padding: "6px 2px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  color: "#6B6880",
  textDecoration: "underline",
};

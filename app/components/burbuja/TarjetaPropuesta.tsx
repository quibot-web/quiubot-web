"use client";
// Fase 2, Commit 3 -- la tarjeta de propuesta reusable (grupo "Equipo" y
// cualquier chat individual, Commits 4/5), portada de
// app/decisiones/page.tsx sin reescribir la lógica de negocio: mismas
// rutas de siempre, vía usePropuestaAcciones. Agrega costoEstimadoCop
// (decisión de la Fase 2: antes existía en los datos pero nunca se
// mostraba) con una etiqueta clara de qué es.
import { useEffect, useState } from "react";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { EstadoEsfera } from "@/app/components/esferas/esferasShared";
import { comprimirSiHaceFalta, esArchivoDeImagen } from "@/app/lib/imagenes";
import type { AccionPropuesta } from "@/app/lib/metas";
import type { PropuestaUnificada } from "@/app/lib/propuestas";
import { formatoCop } from "@/app/lib/directorTextos";
import { NOMBRE_ASISTENTE, asistenteDeMensaje, leadInPropuesta, cuerpoPropuesta, narracionEtapaCreativos } from "@/app/lib/directorChat";
import { CATALOGO_ACCIONES } from "@/app/lib/propuestas";
import { campanaIdDe } from "@/app/components/burbuja/usePropuestaAcciones";

type CreativoPropuesto = {
  titulo?: string;
  texto?: string;
  descripcion?: string;
  url_imagen?: string;
  cta?: string;
  concepto?: { angulo?: string; hook?: string };
};

// Acciones completas en sí mismas (sin un paso siguiente que requiera
// fotos, revisión de creativos editados, o salir a /estrategia) --
// decisión de la Fase 2: solo estas admiten "Aprobar todas las de este
// tipo" cuando hay muchas pendientes del mismo tipo.
export const ACCIONES_APROBABLES_EN_LOTE = new Set<AccionPropuesta>(["pausar", "ajustar_presupuesto"]);

// A partir de cuántas pendientes del mismo tipo se resumen en un solo
// mensaje agrupado en vez de mostrarse todas sueltas.
const UMBRAL_AGRUPADO = 3;

export type GrupoPropuestas = { accion: AccionPropuesta; propuestas: PropuestaUnificada[] };

export function agruparPropuestasPorTipo(propuestas: PropuestaUnificada[]): { sueltas: PropuestaUnificada[]; grupos: GrupoPropuestas[] } {
  const porAccion = new Map<AccionPropuesta, PropuestaUnificada[]>();
  const sinAccion: PropuestaUnificada[] = [];

  for (const p of propuestas) {
    if (!p.accion) {
      sinAccion.push(p);
      continue;
    }
    const lista = porAccion.get(p.accion) ?? [];
    lista.push(p);
    porAccion.set(p.accion, lista);
  }

  const sueltas: PropuestaUnificada[] = [...sinAccion];
  const grupos: GrupoPropuestas[] = [];

  for (const [accion, lista] of porAccion) {
    if (lista.length >= UMBRAL_AGRUPADO) {
      grupos.push({ accion, propuestas: lista });
    } else {
      sueltas.push(...lista);
    }
  }

  return { sueltas, grupos };
}

function tiempoRestante(venceEn: string | null): string | null {
  if (!venceEn) return null;
  const msRestantes = new Date(venceEn).getTime() - Date.now();
  if (msRestantes <= 0) return "vencida";
  const horas = Math.floor(msRestantes / (60 * 60 * 1000));
  if (horas < 1) return "vence en menos de 1h";
  if (horas < 24) return `vence en ${horas}h`;
  return `vence en ${Math.floor(horas / 24)}d`;
}

type Props = {
  propuesta: PropuestaUnificada;
  procesando: boolean;
  ajustando: boolean;
  porcentajeAjuste: string;
  onCambiarPorcentajeAjuste: (v: string) => void;
  onAprobar: () => void;
  onIniciarAjuste: () => void;
  onConfirmarAjustePorcentaje: () => void;
  onConfirmarAjusteCreativos: (editados: CreativoPropuesto[]) => void;
  onCancelarAjuste: () => void;
  onRechazar: () => void;
  onListoSubPaso: () => void;
  nombreCampana: string | null;
};

export default function TarjetaPropuesta({
  propuesta: p,
  procesando,
  ajustando,
  porcentajeAjuste,
  onCambiarPorcentajeAjuste,
  onAprobar,
  onIniciarAjuste,
  onConfirmarAjustePorcentaje,
  onConfirmarAjusteCreativos,
  onCancelarAjuste,
  onRechazar,
  onListoSubPaso,
  nombreCampana,
}: Props) {
  const campanaId = campanaIdDe(p);

  if (p.origen === "notificacion_informativa") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        <EsferaAsistente asistente="director" estado="normal" tamano={40} />
        <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <EsferaAsistente asistente={asistenteDeMensaje(p)} estado="normal" tamano={22} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: "0.02em" }}>{NOMBRE_ASISTENTE[asistenteDeMensaje(p)]}</span>
          </div>
          <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{p.justificacion}</p>
          {campanaId && (
            <a href={`/campanas?highlight=${campanaId}`} style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, color: "#534AB7", fontWeight: 600, textDecoration: "underline" }}>
              Ver campaña
            </a>
          )}
        </div>
      </div>
    );
  }

  const puedeAjustar = p.origen === "propuesta" && (p.accion === "ajustar_presupuesto" || p.accion === "agregar_anuncios");
  const restante = tiempoRestante(p.venceEn);
  const creativos = p.accion === "agregar_anuncios" ? ((p.parametros?.creativos as CreativoPropuesto[]) ?? []) : [];
  const etapa = (p.resultado as { etapa?: string } | null)?.etapa;

  const estadoMiniEsfera: EstadoEsfera = p.accion === "crear_creativos" && (etapa === "generando_conceptos" || etapa === "generando") ? "trabajando" : "normal";

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <EsferaAsistente asistente="director" estado="normal" tamano={40} />
      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "calc(100% - 50px)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <EsferaAsistente asistente={asistenteDeMensaje(p)} estado={estadoMiniEsfera} tamano={22} />
          <span style={{ fontSize: 13, color: "#1a1a1a" }}>{leadInPropuesta(p.accion as AccionPropuesta, nombreCampana, creativos.length)}</span>
        </div>

        {creativos.length > 0 && !ajustando && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {creativos.map((c, i) => (
              <div key={i} style={{ width: 92, border: "1px solid #ece9f9", borderRadius: 8, overflow: "hidden" }}>
                {c.url_imagen && <img src={c.url_imagen} alt="" style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />}
                <p style={{ fontSize: 10.5, color: "#666", margin: "4px 6px", lineHeight: 1.3 }}>{c.titulo || c.texto || ""}</p>
              </div>
            ))}
          </div>
        )}

        {p.accion === "crear_creativos" && etapa === "esperando_fotos" ? (
          <>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: "0 0 2px", lineHeight: 1.5 }}>{narracionEtapaCreativos("esperando_fotos")}</p>
            <PasoSubirFotos propuestaId={p.id} campanaId={campanaId} onListo={onListoSubPaso} />
          </>
        ) : p.accion === "crear_creativos" && etapa === "generando_conceptos" ? (
          <>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{narracionEtapaCreativos("generando_conceptos")}</p>
            <EstadoGenerandoConceptos onListo={onListoSubPaso} />
          </>
        ) : p.accion === "crear_creativos" && etapa === "generando" ? (
          <>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{narracionEtapaCreativos("generando")}</p>
            <EstadoGenerandoCreativos propuestaId={p.id} onListo={onListoSubPaso} />
          </>
        ) : p.accion === "agregar_anuncios" && etapa === "procesando" ? (
          <>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>Agregando tus anuncios a la campaña...</p>
            <EstadoAgregandoAnuncios onListo={onListoSubPaso} />
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>{p.titulo}</p>
            <p style={{ fontSize: 13, color: "#444", margin: "0 0 4px", lineHeight: 1.5 }}>{p.justificacion}</p>
            {p.impactoEsperado && <p style={{ fontSize: 13, color: "#444", margin: "0 0 4px", lineHeight: 1.5 }}>{cuerpoPropuesta(p).impacto}</p>}
            {p.costoEstimadoCop != null && (
              <p style={{ fontSize: 12.5, color: "#6B6880", margin: "0 0 4px" }}>Costo estimado de esta acción: {formatoCop(p.costoEstimadoCop)}</p>
            )}
            <p style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 600, margin: "4px 0 10px" }}>{cuerpoPropuesta(p).pregunta}</p>

            {ajustando && p.accion === "agregar_anuncios" ? (
              <AjusteCreativos creativos={creativos} procesando={procesando} onConfirmar={onConfirmarAjusteCreativos} onCancelar={onCancelarAjuste} />
            ) : ajustando ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="number"
                  value={porcentajeAjuste}
                  onChange={(e) => onCambiarPorcentajeAjuste(e.target.value)}
                  style={{ width: 70, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
                />
                <span style={{ fontSize: 13, color: "#666" }}>% de ajuste</span>
                <button
                  onClick={onConfirmarAjustePorcentaje}
                  disabled={procesando}
                  style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  {procesando ? "..." : "Aplicar ajuste"}
                </button>
                <button onClick={onCancelarAjuste} style={{ padding: "7px 10px", borderRadius: 8, background: "none", border: "none", color: "#888", fontSize: 12.5, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={onAprobar}
                  disabled={procesando}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesando ? "not-allowed" : "pointer" }}
                >
                  {procesando ? "..." : "Sí, adelante"}
                </button>
                {puedeAjustar && (
                  <button
                    onClick={onIniciarAjuste}
                    disabled={procesando}
                    style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#534AB7", border: "1px solid #534AB7", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                  >
                    Ajustar
                  </button>
                )}
                <button
                  onClick={onRechazar}
                  disabled={procesando}
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#888", border: "1px solid #ddd", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  No por ahora
                </button>
                {restante && <span style={{ fontSize: 11.5, color: restante === "vencida" ? "#B3261E" : "#999" }}>{restante}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Resumen de "muchas pendientes del mismo tipo" -- "Revisar una por una"
// deja que el que llama las despliegue sueltas (ver agruparPropuestasPorTipo);
// "Aprobar todas" solo aparece si la acción está en ACCIONES_APROBABLES_EN_LOTE.
export function TarjetaGrupoPropuestas({
  grupo,
  procesandoLote,
  onRevisarUnaPorUna,
  onAprobarTodas,
}: {
  grupo: GrupoPropuestas;
  procesandoLote: boolean;
  onRevisarUnaPorUna: () => void;
  onAprobarTodas: () => void;
}) {
  const puedeAprobarTodas = ACCIONES_APROBABLES_EN_LOTE.has(grupo.accion);
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <EsferaAsistente asistente="director" estado="normal" tamano={40} />
      <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "calc(100% - 50px)", flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>
          Tienes {grupo.propuestas.length} propuestas para {CATALOGO_ACCIONES[grupo.accion].label.toLowerCase()}
        </p>
        <p style={{ fontSize: 13, color: "#444", margin: "0 0 10px", lineHeight: 1.5 }}>Son del mismo tipo -- puedes revisarlas una por una{puedeAprobarTodas ? " o aprobarlas todas juntas" : ""}.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={onRevisarUnaPorUna}
            style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#534AB7", border: "1px solid #534AB7", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            Revisar una por una
          </button>
          {puedeAprobarTodas && (
            <button
              onClick={onAprobarTodas}
              disabled={procesandoLote}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesandoLote ? "not-allowed" : "pointer" }}
            >
              {procesandoLote ? "Aprobando..." : `Aprobar todas las de este tipo`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_FOTOS = 3;
type FotoElegida = { tipo: "base64" | "url"; valor: string; preview: string };

async function leerJsonSeguroLocal(res: Response): Promise<{ [key: string]: unknown }> {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return { error: `Error del servidor (código ${res.status})` };
  }
}

// Elegir hasta MAX_FOTOS fotos del álbum o subir nuevas, más un
// contexto de texto -- porteado tal cual de /decisiones.
function PasoSubirFotos({ propuestaId, campanaId, onListo }: { propuestaId: string; campanaId: string | null; onListo: () => void }) {
  const [album, setAlbum] = useState<{ id: string; url_imagen: string }[]>([]);
  const [elegidas, setElegidas] = useState<FotoElegida[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState<{ mensaje: string; paso?: string } | null>(null);
  const [tipoContenidoCampana, setTipoContenidoCampana] = useState<"producto" | "servicio">("producto");
  const [textoContexto, setTextoContexto] = useState("");

  useEffect(() => {
    fetch("/api/album?limit=8")
      .then((r) => r.json())
      .then((d) => setAlbum(d.imagenes ?? []))
      .catch(() => setAlbum([]));
  }, []);

  useEffect(() => {
    if (!campanaId) return;
    fetch("/api/campanas")
      .then((r) => (r.ok ? r.json() : { campanas: [] }))
      .then((d) => {
        const campana = (d.campanas ?? []).find((c: { id: string }) => c.id === campanaId);
        if (!campana) return;
        const tipo = campana.tipo_contenido === "servicio" ? "servicio" : "producto";
        setTipoContenidoCampana(tipo);
        setTextoContexto((tipo === "servicio" ? campana.descripcion_servicio : campana.datos_producto) || "");
      })
      .catch(() => {});
  }, [campanaId]);

  const alternarDelAlbum = (url: string) => {
    setElegidas((prev) => {
      const yaEsta = prev.some((f) => f.tipo === "url" && f.valor === url);
      if (yaEsta) return prev.filter((f) => !(f.tipo === "url" && f.valor === url));
      if (prev.length >= MAX_FOTOS) return prev;
      return [...prev, { tipo: "url", valor: url, preview: url }];
    });
  };

  const agregarArchivos = async (files: FileList | null) => {
    if (!files) return;
    setErrorLocal(null);
    const disponibles = MAX_FOTOS - elegidas.length;
    for (const file of Array.from(files).slice(0, disponibles)) {
      if (!esArchivoDeImagen(file)) continue;
      try {
        const base64 = await comprimirSiHaceFalta(file);
        setElegidas((prev) => [...prev, { tipo: "base64", valor: base64, preview: base64 }]);
      } catch {
        setErrorLocal({ mensaje: "No se pudo leer una de las fotos." });
      }
    }
  };

  const quitar = (preview: string) => setElegidas((prev) => prev.filter((f) => f.preview !== preview));

  const generar = async () => {
    if (elegidas.length === 0) {
      setErrorLocal({ mensaje: "Elige al menos 1 foto." });
      return;
    }
    setSubiendo(true);
    setErrorLocal(null);
    try {
      const res = await fetch(`/api/propuestas/${propuestaId}/subir-fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes: elegidas.map(({ tipo, valor }) => ({ tipo, valor })), texto_contexto: textoContexto }),
      });
      const data = await leerJsonSeguroLocal(res);
      if (!res.ok) {
        setErrorLocal({ mensaje: (data.error as string) || "No se pudo iniciar la generación.", paso: data.paso as string | undefined });
        return;
      }
      onListo();
    } catch (err) {
      setErrorLocal({ mensaje: err instanceof Error ? err.message : "Algo salió mal." });
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{ marginTop: 10, background: "#F9F8FD", borderRadius: 10, padding: "12px 14px" }}>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a1a", margin: "0 0 8px" }}>Elige hasta {MAX_FOTOS} fotos</p>

      {album.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {album.map((a) => {
            const seleccionada = elegidas.some((f) => f.tipo === "url" && f.valor === a.url_imagen);
            return (
              <img
                key={a.id}
                src={a.url_imagen}
                onClick={() => alternarDelAlbum(a.url_imagen)}
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: seleccionada ? "2.5px solid #534AB7" : "2.5px solid transparent", opacity: seleccionada ? 1 : 0.75 }}
                alt=""
              />
            );
          })}
        </div>
      )}

      <input type="file" accept="image/*" multiple onChange={(e) => agregarArchivos(e.target.files)} style={{ fontSize: 12, marginBottom: 8 }} />

      {elegidas.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {elegidas.map((f) => (
            <div key={f.preview} style={{ position: "relative" }}>
              <img src={f.preview} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} alt="" />
              <button onClick={() => quitar(f.preview)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#B3261E", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", display: "block", marginBottom: 4 }}>
        {tipoContenidoCampana === "servicio" ? "¿Quieres darnos más contexto?" : "¿Qué quieres destacar de este producto?"}{" "}
        <span style={{ fontWeight: 400, color: "#999" }}>(opcional)</span>
      </label>
      <textarea
        value={textoContexto}
        onChange={(e) => setTextoContexto(e.target.value.slice(0, 500))}
        placeholder={tipoContenidoCampana === "servicio" ? 'Ej: "Paquete todo incluido a Cartagena, 4 noches, incluye vuelos"' : "Ej.: precio $1.200.000, combo con 3 herramientas, 10% de descuento esta semana"}
        maxLength={500}
        rows={2}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #e0e0e0", background: "#fff", fontSize: 12.5, color: "#1a1a1a", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 4 }}
      />
      <p style={{ fontSize: 11, color: "#999", margin: "0 0 10px" }}>La IA usa esto para escribir tus anuncios. Mientras más concreto, mejor venden.</p>

      {errorLocal && (
        <p style={{ fontSize: 12, color: "#B3261E", margin: "0 0 8px" }}>
          {errorLocal.mensaje}
          {errorLocal.paso && <span style={{ display: "block", opacity: 0.8 }}>Paso: {errorLocal.paso}</span>}
        </p>
      )}

      <button
        onClick={generar}
        disabled={subiendo}
        style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: subiendo ? "not-allowed" : "pointer" }}
      >
        {subiendo ? "Enviando..." : "Generar creativos"}
      </button>
    </div>
  );
}

function EstadoGenerandoConceptos({ onListo }: { onListo: () => void }) {
  useEffect(() => {
    const intervalo = setInterval(onListo, 5000);
    return () => clearInterval(intervalo);
  }, [onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Pensando conceptos nuevos" />
    </div>
  );
}

function EstadoAgregandoAnuncios({ onListo }: { onListo: () => void }) {
  useEffect(() => {
    const intervalo = setInterval(onListo, 5000);
    return () => clearInterval(intervalo);
  }, [onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Agregando anuncios a tu campaña" />
    </div>
  );
}

function EstadoGenerandoCreativos({ propuestaId, onListo }: { propuestaId: string; onListo: () => void }) {
  useEffect(() => {
    let cancelado = false;
    const revisar = async () => {
      try {
        const res = await fetch(`/api/propuestas/${propuestaId}/revisar-generacion`, { method: "POST" });
        const data = await leerJsonSeguroLocal(res);
        if (cancelado) return;
        if (data.estado === "ejecutada" || data.estado === "fallida") {
          onListo();
          return;
        }
      } catch {
        // red caída puntual -- el siguiente tick reintenta
      }
      if (!cancelado) setTimeout(revisar, 5000);
    };
    const primerIntento = setTimeout(revisar, 5000);
    return () => {
      cancelado = true;
      clearTimeout(primerIntento);
    };
  }, [propuestaId, onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Generando creativos" />
    </div>
  );
}

function AjusteCreativos({
  creativos,
  procesando,
  onConfirmar,
  onCancelar,
}: {
  creativos: CreativoPropuesto[];
  procesando: boolean;
  onConfirmar: (editados: CreativoPropuesto[]) => void;
  onCancelar: () => void;
}) {
  const [items, setItems] = useState<CreativoPropuesto[]>(creativos);

  const quitar = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const editarTexto = (i: number, campo: "titulo" | "texto", valor: string) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  return (
    <div style={{ marginTop: 10, background: "#F9F8FD", borderRadius: 10, padding: "12px 14px" }}>
      {items.length === 0 && <p style={{ fontSize: 12.5, color: "#B3261E", margin: "0 0 8px" }}>Quitaste todos los creativos -- deja al menos uno.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {items.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {c.url_imagen && <img src={c.url_imagen} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} alt="" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={c.titulo || ""}
                onChange={(e) => editarTexto(i, "titulo", e.target.value)}
                placeholder="Título"
                style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, marginBottom: 4, boxSizing: "border-box" }}
              />
              <input
                value={c.texto || ""}
                onChange={(e) => editarTexto(i, "texto", e.target.value)}
                placeholder="Texto"
                style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
            <button onClick={() => quitar(i)} style={{ background: "none", border: "none", color: "#B3261E", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
              Quitar
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onConfirmar(items)}
          disabled={procesando || items.length === 0}
          style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesando || items.length === 0 ? "not-allowed" : "pointer" }}
        >
          {procesando ? "..." : "Aprobar con estos cambios"}
        </button>
        <button onClick={onCancelar} style={{ padding: "7px 10px", borderRadius: 8, background: "none", border: "none", color: "#888", fontSize: 12.5, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

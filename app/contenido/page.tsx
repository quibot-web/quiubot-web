"use client";

import CampoIdea from "./CampoIdea";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RECETAS_ORGANICAS_INFO,
  RECETAS_QUE_EXIGEN_MEDIA,
  ESTADOS_INFO,
  ESTADOS_NO_REPROGRAMABLES,
  colorPuntoEstado,
  labelReceta,
  lunesDeLaSemana,
  esFechaFutura,
  idsQuePrometenParte2SinCumplir,
  piezaSinVideoProxima,
  evaluarEliminacion,
  type PublicacionOrganica,
} from "@/app/lib/contenido";
import { hoyBogota, fechaBogota } from "@/app/lib/fechaBogota";
import { urlMiniaturaReel } from "@/app/lib/cloudinaryUrl";
import { construirTemaDesdeAdn, colorTextoSobre, type AdnMarcaParaTema } from "@/video/tema";
import SelectorAlbum, { type ItemAlbum } from "@/app/components/SelectorAlbum";
import { EtiquetaAnalisis } from "@/app/components/album/AlbumUI";
import SelectorProducto, { resolverProductoAlUsar, valorVacioSelectorProducto, type ValorSelectorProducto } from "@/app/components/SelectorProducto";
import ColaDeRender from "./ColaDeRender";
import ConfirmarEliminarReel from "./ConfirmarEliminarReel";
import type { RecetaOrganicaId } from "@/video/guion.schema";

const MAX_PIEZAS_POR_REEL = 3;

type Paso = "cargando" | "sin-acceso" | "calendario";
type Vista = "semana" | "mes";

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_SEMANA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function sumarDias(fechaYMD: string, dias: number): string {
  const [a, m, d] = fechaYMD.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function formatoDiaCorto(fechaYMD: string): string {
  const [, m, d] = fechaYMD.split("-");
  return `${d}/${m}`;
}

function primerDiaMes(mesYM: string): string {
  return `${mesYM}-01`;
}

function ultimoDiaMes(mesYM: string): string {
  const [a, m] = mesYM.split("-").map(Number);
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

function sumarMeses(mesYM: string, delta: number): string {
  const [a, m] = mesYM.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelMes(mesYM: string): string {
  const [a, m] = mesYM.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${a}`;
}

// Cuadrícula de semanas (lunes a domingo) que cubre todo el mes --
// igual que cualquier calendario tipo Metricool/Meta Business Suite,
// puede empezar en el mes anterior y terminar en el siguiente.
function gridDelMes(mesYM: string): string[][] {
  const inicio = lunesDeLaSemana(primerDiaMes(mesYM));
  const fin = sumarDias(lunesDeLaSemana(ultimoDiaMes(mesYM)), 6);
  const dias: string[] = [];
  let actual = inicio;
  while (actual <= fin) {
    dias.push(actual);
    actual = sumarDias(actual, 1);
  }
  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  return semanas;
}

function useEsMobile(): boolean {
  const [esMobile, setEsMobile] = useState(() => (typeof window !== "undefined" ? window.matchMedia("(max-width: 700px)").matches : false));
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const listener = (e: MediaQueryListEvent) => setEsMobile(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return esMobile;
}

export default function ContenidoPage() {
  const router = useRouter();
  const esMobile = useEsMobile();
  const [paso, setPaso] = useState<Paso>("cargando");
  const [sinAcceso, setSinAcceso] = useState<{ mensaje: string | null; suscripcion: boolean }>({ mensaje: null, suscripcion: false });
  // Arranque (o plan vencido): ve la página, pero no crea ni genera.
  const [avisoPlan, setAvisoPlan] = useState<{ codigo: string; mensaje: string } | null>(null);
  const [vista, setVista] = useState<Vista>("semana");
  const [semana, setSemana] = useState<string>(() => lunesDeLaSemana(hoyBogota()));
  const [mes, setMes] = useState<string>(() => hoyBogota().slice(0, 7));
  const [piezas, setPiezas] = useState<PublicacionOrganica[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [adnMarca, setAdnMarca] = useState<AdnMarcaParaTema | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [fechaFormulario, setFechaFormulario] = useState<string>(hoyBogota());
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tema = construirTemaDesdeAdn(adnMarca);

  const cargarDatos = useCallback(async (vistaActual: Vista, semanaActual: string, mesActual: string) => {
    setCargandoDatos(true);
    setErrorMsg(null);
    try {
      let url: string;
      if (vistaActual === "semana") {
        url = `/api/contenido?semana=${semanaActual}`;
      } else {
        const grid = gridDelMes(mesActual);
        url = `/api/contenido?desde=${grid[0][0]}&hasta=${grid[grid.length - 1][6]}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo cargar el calendario.");
        return;
      }
      setPiezas(data.piezas || []);
    } catch {
      setErrorMsg("No se pudo cargar el calendario.");
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Acceso por suscripción activa (ya no solo admin, ver
        // app/lib/accesoContenido.ts): el motivo se muestra tal cual.
        const accesoRes = await fetch("/api/contenido/acceso");
        const accesoData = await accesoRes.json().catch(() => ({}));
        if (!accesoRes.ok) {
          setSinAcceso({ mensaje: accesoData.error ?? null, suscripcion: accesoData.codigo === "suscripcion_inactiva" });
          setPaso("sin-acceso");
          return;
        }
        if (!accesoData.puedeCrear && accesoData.motivo) setAvisoPlan(accesoData.motivo);
        fetch("/api/marca-adn")
          .then((r) => r.json())
          .then((d) => setAdnMarca(d.adn_marca ?? null))
          .catch(() => {});
        await cargarDatos(vista, semana, mes);
        setPaso("calendario");
      } catch {
        setPaso("sin-acceso");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refrescar = useCallback(() => cargarDatos(vista, semana, mes), [cargarDatos, vista, semana, mes]);

  function cambiarVista(nueva: Vista) {
    setVista(nueva);
    cargarDatos(nueva, semana, mes);
  }
  function irASemana(nuevaSemana: string) {
    setSemana(nuevaSemana);
    cargarDatos("semana", nuevaSemana, mes);
  }
  function irAMes(nuevoMes: string) {
    setMes(nuevoMes);
    cargarDatos("mes", semana, nuevoMes);
  }

  async function reprogramarPieza(id: string, nuevaFechaYMD: string) {
    const pieza = piezas.find((p) => p.id === id);
    if (!pieza) return;
    // Conserva la hora original, solo cambia el día -- misma convención
    // de offset de Bogotá que usa el formulario de crear.
    const horaOriginal = new Date(pieza.programada_para).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/Bogota",
    });
    const nuevaISO = `${nuevaFechaYMD}T${horaOriginal}-05:00`;
    if (!esFechaFutura(nuevaISO)) {
      setErrorMsg("No puedes mover un reel a una fecha u hora que ya pasó.");
      return;
    }
    try {
      const res = await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reprogramar", programada_para: nuevaISO }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo mover el reel.");
        return;
      }
      refrescar();
    } catch {
      setErrorMsg("No se pudo mover el reel.");
    }
  }

  function abrirFormulario(fecha: string) {
    if (avisoPlan) return;
    setFechaFormulario(fecha);
    setMostrarFormulario(true);
  }

  if (paso === "cargando") return <PantallaCentro texto="Cargando…" />;
  if (paso === "sin-acceso")
    return <PantallaCentro texto={sinAcceso.mensaje ?? "No tienes acceso a esta sección."} enlace={sinAcceso.suscripcion ? { href: "/billing", texto: "Renovar mi plan" } : undefined} />;

  const piezasPorDia = (fecha: string) => piezas.filter((p) => fechaBogota(new Date(p.programada_para)) === fecha);
  const hoy = hoyBogota();

  const resumen = {
    total: piezas.length,
    listos: piezas.filter((p) => p.estado === "lista").length,
    publicados: piezas.filter((p) => p.estado === "publicada").length,
    porAprobar: piezas.filter((p) => p.estado === "borrador").length,
  };

  // Avisos (commit 4d) -- puros sobre las piezas ya cargadas, se
  // recalculan solos cada vez que cambia el calendario (aprobar,
  // cancelar, borrar, reprogramar), sin guardar nada aparte.
  const idsPrometenParte2 = idsQuePrometenParte2SinCumplir(piezas);
  const piezasSinVideoProxima = piezas.filter((p) => piezaSinVideoProxima(p));

  const fechaBaseGenerica = vista === "semana" ? semana : primerDiaMes(mes);
  const fechaInicialGenerica = fechaBaseGenerica < hoy ? hoy : fechaBaseGenerica;

  const diasSemana = Array.from({ length: 7 }, (_, i) => sumarDias(semana, i));
  const semanasMes = vista === "mes" ? gridDelMes(mes) : [];

  // En móvil, tanto semana como mes se muestran como una lista vertical
  // de días (una columna), en vez de la cuadrícula -- la cuadrícula de
  // 7 columnas no cabe en una pantalla angosta.
  const diasParaListaMobile = vista === "semana" ? diasSemana : semanasMes.flat();

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>Contenido orgánico</h1>
            <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
              {vista === "semana" ? `Semana del ${formatoDiaCorto(diasSemana[0])} al ${formatoDiaCorto(diasSemana[6])}` : labelMes(mes)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", border: "1px solid #534AB7", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => cambiarVista("semana")} style={botonVista(vista === "semana")}>
                Semana
              </button>
              <button type="button" onClick={() => cambiarVista("mes")} style={botonVista(vista === "mes")}>
                Mes
              </button>
            </div>
            <button
              type="button"
              onClick={() => (vista === "semana" ? irASemana(sumarDias(semana, -7)) : irAMes(sumarMeses(mes, -1)))}
              style={botonSecundario}
              disabled={cargandoDatos}
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => (vista === "semana" ? irASemana(lunesDeLaSemana(hoy)) : irAMes(hoy.slice(0, 7)))}
              style={botonSecundario}
              disabled={cargandoDatos}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => (vista === "semana" ? irASemana(sumarDias(semana, 7)) : irAMes(sumarMeses(mes, 1)))}
              style={botonSecundario}
              disabled={cargandoDatos}
            >
              Siguiente →
            </button>
          </div>
        </div>

        {avisoPlan && <AvisoPlan aviso={avisoPlan} />}

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {!avisoPlan && (
            <button type="button" style={botonPrimario} onClick={() => abrirFormulario(fechaInicialGenerica)}>
              ＋ Agregar reel
            </button>
          )}
          <button type="button" style={{ ...botonSecundario, opacity: 0.6, cursor: "not-allowed" }} disabled title="Disponible pronto -- el Director todavía no arma el calendario solo.">
            Pedir propuesta al Director (próximamente)
          </button>
          {!avisoPlan && (
            <button type="button" style={botonSecundario} onClick={refrescar} disabled={cargandoDatos}>
              Preparar mis videos
            </button>
          )}
          <span style={{ fontSize: 12, color: "#666", marginLeft: "auto" }}>
            {resumen.total} reels · {resumen.listos} listos · {resumen.publicados} publicados · {resumen.porAprobar} por aprobar
          </span>
        </div>

        {errorMsg && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}

        {piezasSinVideoProxima.length > 0 && (
          <p style={{ background: "#FEF6E7", border: "1px solid #F0C36D", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A6416", marginBottom: 16 }}>
            ⏰ {piezasSinVideoProxima.length} {piezasSinVideoProxima.length === 1 ? "pieza publica" : "piezas publican"} en menos de 2h y todavía no tienen video listo.
          </p>
        )}

        {!avisoPlan && <ColaDeRender piezasAprobadas={piezas.filter((p) => p.estado === "aprobada")} onPiezaLista={refrescar} />}

        {esMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diasParaListaMobile.map((fecha) => (
              <DiaCelda
                key={fecha}
                fecha={fecha}
                piezasDelDia={piezasPorDia(fecha)}
                esHoy={fecha === hoy}
                esPasado={fecha < hoy}
                tema={tema}
                compacta={false}
                tituloDia={`${DIAS_SEMANA[new Date(fecha + "T12:00:00Z").getUTCDay() === 0 ? 6 : new Date(fecha + "T12:00:00Z").getUTCDay() - 1]} ${formatoDiaCorto(fecha)}`}
                idsPrometenParte2={idsPrometenParte2}
                onClickPieza={(id) => router.push(`/contenido/${id}`)}
                onAgregar={abrirFormulario}
                onDropDia={(f) => reprogramarPieza(arrastrandoId!, f)}
                onDragStartPieza={setArrastrandoId}
                onEliminarPieza={setEliminandoId}
              />
            ))}
          </div>
        ) : vista === "semana" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(130px, 1fr))", gap: 12 }}>
            {diasSemana.map((fecha, i) => (
              <DiaCelda
                key={fecha}
                fecha={fecha}
                piezasDelDia={piezasPorDia(fecha)}
                esHoy={fecha === hoy}
                esPasado={fecha < hoy}
                tema={tema}
                compacta={false}
                tituloDia={`${DIAS_SEMANA[i]} ${formatoDiaCorto(fecha)}`}
                idsPrometenParte2={idsPrometenParte2}
                onClickPieza={(id) => router.push(`/contenido/${id}`)}
                onAgregar={abrirFormulario}
                onDropDia={(f) => reprogramarPieza(arrastrandoId!, f)}
                onDragStartPieza={setArrastrandoId}
                onEliminarPieza={setEliminandoId}
              />
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
              {DIAS_SEMANA_CORTO.map((d) => (
                <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "#999", textAlign: "center" }}>
                  {d}
                </div>
              ))}
            </div>
            {semanasMes.map((semanaFilas, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
                {semanaFilas.map((fecha) => (
                  <DiaCelda
                    key={fecha}
                    fecha={fecha}
                    piezasDelDia={piezasPorDia(fecha)}
                    esHoy={fecha === hoy}
                    esPasado={fecha < hoy}
                    tema={tema}
                    compacta
                    atenuadaFueraDeMes={fecha.slice(0, 7) !== mes}
                    tituloDia={fecha.slice(8, 10)}
                    idsPrometenParte2={idsPrometenParte2}
                onClickPieza={(id) => router.push(`/contenido/${id}`)}
                    onAgregar={abrirFormulario}
                    onDropDia={(f) => reprogramarPieza(arrastrandoId!, f)}
                    onDragStartPieza={setArrastrandoId}
                    onEliminarPieza={setEliminandoId}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {eliminandoId && (
        <ConfirmarEliminarReel
          piezaId={eliminandoId}
          onCerrar={() => setEliminandoId(null)}
          onEliminado={() => {
            setEliminandoId(null);
            refrescar();
          }}
        />
      )}
      {mostrarFormulario && (
        <FormularioAgregarReel
          fechaInicial={fechaFormulario}
          onCerrar={() => setMostrarFormulario(false)}
          onCreado={() => {
            setMostrarFormulario(false);
            refrescar();
          }}
        />
      )}
    </div>
  );
}

function DiaCelda({
  fecha,
  piezasDelDia,
  esHoy,
  esPasado,
  tema,
  compacta,
  atenuadaFueraDeMes,
  tituloDia,
  idsPrometenParte2,
  onClickPieza,
  onAgregar,
  onDropDia,
  onDragStartPieza,
  onEliminarPieza,
}: {
  fecha: string;
  piezasDelDia: PublicacionOrganica[];
  esHoy: boolean;
  esPasado: boolean;
  tema: ReturnType<typeof construirTemaDesdeAdn>;
  compacta: boolean;
  atenuadaFueraDeMes?: boolean;
  tituloDia: string;
  idsPrometenParte2: Set<string>;
  onClickPieza: (id: string) => void;
  onAgregar: (fecha: string) => void;
  onDropDia: (fecha: string) => void;
  onDragStartPieza: (id: string) => void;
  onEliminarPieza: (id: string) => void;
}) {
  const [sobreDrop, setSobreDrop] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (esPasado) return;
        e.preventDefault();
        setSobreDrop(true);
      }}
      onDragLeave={() => setSobreDrop(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobreDrop(false);
        if (!esPasado) onDropDia(fecha);
      }}
      style={{
        background: esPasado ? "#f2f2f0" : "#fff",
        opacity: esPasado ? 0.55 : atenuadaFueraDeMes ? 0.5 : 1,
        borderRadius: compacta ? 10 : 14,
        border: esHoy ? "2px solid #534AB7" : sobreDrop ? "2px dashed #534AB7" : "1px solid #e5e5e5",
        padding: compacta ? 6 : 12,
        minHeight: compacta ? 76 : 190,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: compacta ? 11 : 12, fontWeight: 700, color: esHoy ? "#534AB7" : "#666" }}>{tituloDia}</div>
      <div style={{ display: "flex", flexDirection: compacta ? "row" : "column", flexWrap: compacta ? "wrap" : "nowrap", gap: compacta ? 3 : 8, flex: 1 }}>
        {!compacta && piezasDelDia.length === 0 && <div style={{ fontSize: 12, color: "#bbb" }}>Sin piezas</div>}
        {piezasDelDia.map((p) => (
          <TarjetaPieza
            key={p.id}
            pieza={p}
            tema={tema}
            compacta={compacta}
            draggable={!ESTADOS_NO_REPROGRAMABLES.includes(p.estado)}
            prometeParte2={idsPrometenParte2.has(p.id)}
            onDragStart={() => onDragStartPieza(p.id)}
            onClick={() => onClickPieza(p.id)}
            onEliminar={() => onEliminarPieza(p.id)}
          />
        ))}
      </div>
      {!esPasado && (
        <button
          type="button"
          onClick={() => onAgregar(fecha)}
          style={{
            alignSelf: compacta ? "center" : "stretch",
            padding: compacta ? "2px 6px" : "6px 0",
            borderRadius: 8,
            border: "1.5px dashed #534AB7",
            background: "#F3F2FE",
            color: "#534AB7",
            fontSize: compacta ? 12 : 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ＋
        </button>
      )}
    </div>
  );
}

function TarjetaPieza({
  pieza,
  tema,
  compacta,
  draggable,
  prometeParte2,
  onDragStart,
  onClick,
  onEliminar,
}: {
  pieza: PublicacionOrganica;
  tema: ReturnType<typeof construirTemaDesdeAdn>;
  compacta: boolean;
  draggable: boolean;
  prometeParte2: boolean;
  onDragStart: () => void;
  onClick: () => void;
  onEliminar: () => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const eliminacion = evaluarEliminacion(pieza.estado);
  const dot = colorPuntoEstado(pieza.estado);
  const hora = new Date(pieza.programada_para).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const tieneVideo = !!pieza.url_video;
  const colorTexto = colorTextoSobre(tema.color_primario);
  const sinVideoProximo = piezaSinVideoProxima(pieza);

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onClick={onClick}
      onMouseLeave={() => setMenuAbierto(false)}
      title={`${labelReceta(pieza.receta_organica)} · ${hora} · ${ESTADOS_INFO[pieza.estado].label}`}
      style={{
        position: "relative",
        width: compacta ? 32 : "100%",
        height: compacta ? 56 : 160,
        borderRadius: compacta ? 6 : 10,
        overflow: "hidden",
        cursor: draggable ? "grab" : "pointer",
        background: tieneVideo ? "#111" : tema.color_primario,
        flexShrink: 0,
      }}
    >
      {tieneVideo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlMiniaturaReel(pieza.url_video!)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        !compacta && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, textAlign: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: colorTexto, lineHeight: 1.2 }}>{labelReceta(pieza.receta_organica)}</span>
          </div>
        )
      )}
      <div style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, borderRadius: "50%", background: dot, border: "1.5px solid #fff" }} />
      {/* Menú "⋯" (solo tarjeta grande; en la compacta del mes no cabe
          -- ahí se elimina desde la pantalla de la pieza). */}
      {!compacta && (
        <button
          type="button"
          aria-label="Más opciones"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            setMenuAbierto((v) => !v);
          }}
          style={{ position: "absolute", top: 2, right: 16, width: 26, height: 22, borderRadius: 6, border: "none", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: "22px", padding: 0, cursor: "pointer" }}
        >
          ⋯
        </button>
      )}
      {menuAbierto && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 26, right: 4, left: 4, background: "#fff", borderRadius: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", padding: 4, zIndex: 5, cursor: "default" }}
        >
          {eliminacion.permitido ? (
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                onEliminar();
              }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 8px", border: "none", background: "none", fontSize: 12, fontWeight: 700, color: "#B91C1C", cursor: "pointer", borderRadius: 6 }}
            >
              {eliminacion.tipo === "quitar_del_calendario" ? "Quitar del calendario" : "Eliminar"}
            </button>
          ) : (
            <p style={{ margin: 0, padding: "7px 8px", fontSize: 11, color: "#666" }}>{eliminacion.motivo}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setMenuAbierto(false);
              onClick();
            }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 8px", border: "none", background: "none", fontSize: 12, fontWeight: 600, color: "#1a1a1a", cursor: "pointer", borderRadius: 6 }}
          >
            {ESTADOS_NO_REPROGRAMABLES.includes(pieza.estado) ? "Abrir" : "Cambiar fecha y hora"}
          </button>
        </div>
      )}
      {sinVideoProximo && (
        <div title="Publica en menos de 2h y todavía no tiene video" style={{ position: "absolute", top: 3, left: 3, fontSize: compacta ? 10 : 12 }}>
          ⏰
        </div>
      )}
      {!compacta && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.65))", padding: "16px 6px 5px" }}>
          <div style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{hora}</div>
          {prometeParte2 && <div style={{ fontSize: 9, color: "#FFD27A", fontWeight: 700 }}>⚠ promete parte 2</div>}
        </div>
      )}
    </div>
  );
}

function FormularioAgregarReel({ fechaInicial, onCerrar, onCreado }: { fechaInicial: string; onCerrar: () => void; onCreado: () => void }) {
  const [receta, setReceta] = useState<RecetaOrganicaId>(RECETAS_ORGANICAS_INFO[0].id);
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState("12:00");
  const [productoValor, setProductoValor] = useState<ValorSelectorProducto>(valorVacioSelectorProducto());
  const [productoValido, setProductoValido] = useState(true);
  const [errorProducto, setErrorProducto] = useState<string | null>(null);
  const [piezasElegidas, setPiezasElegidas] = useState<ItemAlbum[]>([]);
  // Igual que en /video y /estrategia: las fotos que trajo el producto
  // elegido se pueden reemplazar al cambiar de producto sin tocar lo
  // que la marca agregó a mano desde el álbum.
  const [piezasDesdeProducto, setPiezasDesdeProducto] = useState<Set<string>>(new Set());
  const [mostrarSelectorAlbum, setMostrarSelectorAlbum] = useState(false);
  const [tema, setTema] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recetaExigeMedia = RECETAS_QUE_EXIGEN_MEDIA.includes(receta);
  const faltaMediaParaEstaReceta = recetaExigeMedia && piezasElegidas.length === 0;

  function alCambiarProducto(v: ValorSelectorProducto) {
    setProductoValor(v);
    setErrorProducto(null);
    setPiezasElegidas((prev) => {
      const sinLasDelProductoAnterior = prev.filter((p) => !p.id || !piezasDesdeProducto.has(p.id));
      const nuevas = v.fotosProducto.map((f) => ({ id: f.id, url_imagen: f.url_imagen, tipo: "imagen", public_id: f.id }));
      return [...sinLasDelProductoAnterior, ...nuevas].slice(0, MAX_PIEZAS_POR_REEL);
    });
    setPiezasDesdeProducto(new Set(v.fotosProducto.map((f) => f.id)));
  }

  function elegirPiezasDelAlbum(items: ItemAlbum[]) {
    // Sin repetidas; si con lo que ya había se pasa del máximo, se avisa
    // y se toman solo las primeras.
    const sinRepetir = items.filter((it) => !piezasElegidas.some((p) => p.id && p.id === it.id));
    const total = piezasElegidas.length + sinRepetir.length;
    if (total > MAX_PIEZAS_POR_REEL) {
      setError(`Elegiste ${total} piezas; un reel usa hasta ${MAX_PIEZAS_POR_REEL}, así que se tomaron las primeras ${MAX_PIEZAS_POR_REEL}.`);
    } else {
      setError(null);
    }
    setPiezasElegidas((prev) => [...prev, ...sinRepetir].slice(0, MAX_PIEZAS_POR_REEL));
    setMostrarSelectorAlbum(false);
  }

  function quitarPieza(id: string | undefined) {
    setPiezasElegidas((prev) => prev.filter((p) => p.id !== id));
  }

  async function guardar() {
    if (faltaMediaParaEstaReceta) {
      setError("Esta receta exige al menos una foto o video del álbum.");
      return;
    }
    const programada_para = `${fecha}T${hora}:00-05:00`;
    if (!esFechaFutura(programada_para)) {
      setError("La fecha y hora deben ser futuras -- esta ya pasó.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const { productoId, error: errorProd } = await resolverProductoAlUsar(productoValor);
      if (errorProd) {
        setErrorProducto(errorProd);
        setGuardando(false);
        return;
      }
      const res = await fetch("/api/contenido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receta_organica: receta,
          programada_para,
          producto_id: productoId,
          media_ids: piezasElegidas.map((p) => p.id).filter((id): id is string => !!id),
          tema: tema.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo crear el reel.");
        return;
      }
      onCreado();
    } catch {
      setError("No se pudo crear el reel.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20, padding: 20, overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px", color: "#1a1a1a" }}>Agregar reel</h2>

        <label style={etiquetaCampo}>Receta</label>
        <select value={receta} onChange={(e) => setReceta(e.target.value as RecetaOrganicaId)} style={campo}>
          {RECETAS_ORGANICAS_INFO.map((r) => {
            const bloqueada = RECETAS_QUE_EXIGEN_MEDIA.includes(r.id) && piezasElegidas.length === 0;
            // Fase B v2.0 (narración + voz + subtítulos sincronizados)
            // solo está en consejos_numerados por ahora -- las demás
            // siguen con el pipeline de siempre (sin voz) hasta que la
            // Fase B v2.1 las generalice. Se dejan seleccionables (no
            // se ocultan, para no cortar producción mientras eso pasa),
            // solo marcadas para que quede claro qué esperar.
            const esVersionAnterior = r.id !== "consejos_numerados";
            return (
              <option key={r.id} value={r.id} disabled={bloqueada}>
                {r.label}
                {esVersionAnterior ? " (versión anterior, sin voz)" : ""}
                {bloqueada ? " (elige antes una foto o video)" : ""}
              </option>
            );
          })}
        </select>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={etiquetaCampo}>Fecha</label>
            <input type="date" min={hoyBogota()} value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={etiquetaCampo}>Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} />
          </div>
        </div>

        <CampoIdea valor={tema} onCambio={setTema} />

        <label style={etiquetaCampo}>Producto o servicio (opcional)</label>
        <SelectorProducto valor={productoValor} onCambio={alCambiarProducto} errorGuardado={errorProducto} onValidezCambia={setProductoValido} />

        <label style={{ ...etiquetaCampo, marginTop: 16 }}>
          Fotos o video del álbum (hasta {MAX_PIEZAS_POR_REEL}){recetaExigeMedia ? " -- obligatorio para esta receta" : ""}
        </label>
        <p style={{ fontSize: 11.5, color: "#666", margin: "0 0 8px" }}>
          Elige del álbum o súbelas desde tu computador. Las fotos &ldquo;Apta para fondo&rdquo; (sin texto) son las que el reel puede usar de fondo en el estilo Foto.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {piezasElegidas.map((p) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ position: "relative", width: 64, height: 64 }}>
                {p.tipo === "video" ? (
                  <video src={p.url_imagen} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", background: "#000" }} muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url_imagen} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} />
                )}
                <button
                  type="button"
                  onClick={() => quitarPieza(p.id)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#b91c1c", color: "#fff", fontSize: 11, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <EtiquetaAnalisis item={p} compacta />
            </div>
          ))}
          {piezasElegidas.length < MAX_PIEZAS_POR_REEL && (
            <button
              type="button"
              onClick={() => setMostrarSelectorAlbum(true)}
              style={{ width: 64, height: 64, borderRadius: 8, border: "1.5px dashed #534AB7", background: "#F3F2FE", color: "#534AB7", fontSize: 20, cursor: "pointer" }}
            >
              ＋
            </button>
          )}
        </div>

        {error && <p style={{ color: "#b91c1c", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCerrar} style={{ ...botonSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !productoValido} style={{ ...botonPrimario, flex: 1 }}>
            {guardando ? "Guardando…" : "Crear"}
          </button>
        </div>
      </div>

      {mostrarSelectorAlbum && (
        <SelectorAlbum
          titulo={`Elige o sube hasta ${MAX_PIEZAS_POR_REEL - piezasElegidas.length} pieza${MAX_PIEZAS_POR_REEL - piezasElegidas.length !== 1 ? "s" : ""}`}
          onElegir={() => {}}
          multiple
          subirDesdeComputador
          mostrarAnalisis
          maxSeleccion={MAX_PIEZAS_POR_REEL - piezasElegidas.length}
          onElegirVarios={elegirPiezasDelAlbum}
          onCerrar={() => setMostrarSelectorAlbum(false)}
        />
      )}
    </div>
  );
}

function AvisoPlan({ aviso }: { aviso: { codigo: string; mensaje: string } }) {
  return (
    <div style={{ background: "#F3F2FE", border: "1px solid #C9C5F2", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13.5, color: "#3C3489", fontWeight: 700, flex: 1, minWidth: 220 }}>{aviso.mensaje}</span>
      <a href="/billing" style={{ padding: "10px 16px", borderRadius: 10, background: "#534AB7", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
        {aviso.codigo === "suscripcion_inactiva" ? "Renovar mi plan" : "Ver planes"}
      </a>
    </div>
  );
}

function PantallaCentro({ texto, enlace }: { texto: string; enlace?: { href: string; texto: string } }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#666", padding: 20, textAlign: "center" }}>
      {texto}
      {enlace && (
        <a href={enlace.href} style={{ padding: "10px 16px", borderRadius: 10, background: "#534AB7", color: "#fff", fontWeight: 700, textDecoration: "none" }}>
          {enlace.texto}
        </a>
      )}
    </div>
  );
}

function botonVista(activo: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    border: "none",
    background: activo ? "#534AB7" : "#fff",
    color: activo ? "#fff" : "#534AB7",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}

const botonPrimario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#534AB7",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const botonSecundario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #534AB7",
  background: "#fff",
  color: "#534AB7",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const etiquetaCampo: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#444", margin: "12px 0 4px" };

const campo: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 14,
  fontFamily: "inherit",
};

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Video, Upload, FolderOpen } from "lucide-react";
import { validarImagenPropia } from "@/app/lib/imagenes";

// Mismo shape que ya usa el resto de /estrategia (asignar-tipos) para la
// cola de generación -- "subida" es el único valor nuevo de verdad
// ("álbum" ya existía, "video"/"imagen" también). "subida" nunca entra a
// la cola de generación (ver dispararTipo en estrategia/page.tsx): su
// creativo ya viene armado desde que el cliente lo sube acá mismo.
export type TipoCreativo = "video" | "imagen" | "album" | "subida";

// Preparado para la fase 2 (mezcla de formatos + indicador) -- todavía no
// se construye la UI de carrusel, solo el tipo de dato que lo va a usar.
export type FormatoAnuncio = "imagen" | "carrusel" | "video" | "propio";
export type TarjetaCarrusel = { titulo: string; descripcion: string; escena: string };
export type CarruselAnuncio = { tipo: string; tarjetas: TarjetaCarrusel[] };

const NOMBRES_ANGULO: Record<string, string> = {
  dolor_problema: "Dolor / problema",
  aspiracion_transformacion: "Aspiración / transformación",
  prueba_social: "Prueba social",
  demostracion_producto: "Demostración de producto",
  antes_despues: "Antes y después",
  objecion_resuelta: "Objeción resuelta",
  oferta_urgencia_real: "Oferta con urgencia",
  identidad_pertenencia: "Identidad / pertenencia",
  curiosidad_intriga: "Curiosidad / intriga",
  momento_de_uso: "Momento de uso",
  comparacion_alternativas: "Comparación con alternativas",
  autoridad_experto: "Autoridad / experto",
  regalo_ocasion_especial: "Regalo / ocasión especial",
};

const NOMBRES_FORMATO_VISUAL: Record<string, string> = {
  estilo_de_vida: "Estilo de vida",
  producto_primer_plano: "Producto en primer plano",
  ugc_casero: "Estilo UGC casero",
  antes_despues_visual: "Antes/después visual",
  infografia_beneficios: "Infografía de beneficios",
  testimonio_tarjeta: "Testimonio en tarjeta",
  escena_de_uso: "Escena de uso",
  detalle_textura: "Detalle / textura",
  flat_lay: "Flat lay",
  comparativo_lado_a_lado: "Comparativo lado a lado",
  manos_ritual: "Manos / ritual",
  editorial_aspiracional: "Editorial aspiracional",
};

function fmtCOP(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export type CreativoPropio = { url_imagen: string };

// Revisión en segundo plano de "Subir el mío" (ver dispararRevisionImagen
// más abajo) -- nunca bloquea nada, solo informa en la misma tarjeta.
type ResultadoRevisionImagen = { cumple: boolean; puntos?: string[]; comentario?: string };
type RevisionImagen =
  | { estado: "revisando" }
  | { estado: "lista"; resultado: ResultadoRevisionImagen }
  | { estado: "no_disponible" };

type Props = {
  estrategias: any[];
  objetivo: { id: string; destino?: string } | null;
  esAdmin: boolean | null;
  // Encabezado de cada tarjeta ("Tu página" + avatar, antes genérico):
  // el nombre real de la página de Facebook conectada manda; si no hay,
  // el nombre de marca (ADN); si tampoco, el fallback "Tu marca" de acá
  // mismo. El logo (si existe) reemplaza el avatar genérico.
  paginaNombre?: string | null;
  nombreMarca?: string | null;
  logoUrl?: string | null;
  // (estrategia, tiposPorAnuncio, creativosPropios) -- solo de la
  // estrategia elegida, nunca arrastra nada de otra pestaña que el
  // cliente haya mirado antes de decidirse.
  onElegir: (estrategia: any, tiposPorAnuncio: Record<string, TipoCreativo>, creativosPropios: Record<string, CreativoPropio>) => void;
};

export default function ElegirEstrategia({ estrategias, objetivo, esAdmin, paginaNombre, nombreMarca, logoUrl, onElegir }: Props) {
  const esWhatsapp = objetivo?.destino === "whatsapp";
  const nombreEncabezado = paginaNombre || nombreMarca || "Tu marca";

  const idMasEfectivo = useMemo(
    () => estrategias.reduce((mejor: any, e: any) => (!mejor || (e.efectividad ?? 0) > (mejor.efectividad ?? 0) ? e : mejor), null)?.id,
    [estrategias]
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(estrategias[0]?.id);
  const [vistaPrevia, setVistaPrevia] = useState<"instagram" | "facebook">("instagram");
  const [menuSubirAbierto, setMenuSubirAbierto] = useState<Record<string, boolean>>({});
  const [subiendoClave, setSubiendoClave] = useState<string | null>(null);
  const [erroresSubida, setErroresSubida] = useState<Record<string, string>>({});
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  // Por estrategia (id -> clave -> ...) -- a propósito, no un solo mapa
  // compartido: dos estrategias distintas pueden reusar las mismas
  // claves "ci-ai" (son índices de SU PROPIO array de conjuntos/
  // anuncios), así que mirar varias pestañas antes de decidirse nunca
  // debe mezclar la elección de una con la de otra.
  const [tiposPorEstrategia, setTiposPorEstrategia] = useState<Record<string, Record<string, TipoCreativo>>>({});
  const [propiosPorEstrategia, setPropiosPorEstrategia] = useState<Record<string, Record<string, CreativoPropio>>>({});
  const [revisionesPorEstrategia, setRevisionesPorEstrategia] = useState<Record<string, Record<string, RevisionImagen>>>({});

  // Para no seguir llamando setState (ni, peor, seguir poleando) después
  // de que este componente se desmontó -- pasa en cuanto se hace clic en
  // "Elegir esta estrategia →" mientras una revisión seguía en curso.
  const montadoRef = useRef(true);
  useEffect(() => () => { montadoRef.current = false; }, []);

  useEffect(() => {
    if (!selectedId && estrategias[0]) setSelectedId(estrategias[0].id);
  }, [estrategias, selectedId]);

  const seleccionada = estrategias.find((e) => e.id === selectedId) ?? estrategias[0];
  if (!seleccionada) return null;

  const anuncios: { clave: string; conjunto: any; anuncio: any }[] = (seleccionada.conjuntos || []).flatMap((conjunto: any, ci: number) =>
    (conjunto.anuncios || []).map((anuncio: any, ai: number) => ({ clave: `${ci}-${ai}`, conjunto, anuncio }))
  );

  const tiposPorAnuncio = tiposPorEstrategia[seleccionada.id] || {};
  const creativosPropios = propiosPorEstrategia[seleccionada.id] || {};
  const revisionesPorAnuncio = revisionesPorEstrategia[seleccionada.id] || {};

  const cambiarTipo = (clave: string, tipo: TipoCreativo) => {
    setTiposPorEstrategia((prev) => ({ ...prev, [seleccionada.id]: { ...(prev[seleccionada.id] || {}), [clave]: tipo } }));
  };

  const quitarImagenPropia = (clave: string) => {
    setPropiosPorEstrategia((prev) => {
      const copia = { ...(prev[seleccionada.id] || {}) };
      delete copia[clave];
      return { ...prev, [seleccionada.id]: copia };
    });
  };

  const descartarRevision = (estrategiaId: string, clave: string) => {
    setRevisionesPorEstrategia((prev) => {
      const copia = { ...(prev[estrategiaId] || {}) };
      delete copia[clave];
      return { ...prev, [estrategiaId]: copia };
    });
  };

  // Revisión en segundo plano de la imagen que el cliente acaba de subir
  // -- nunca bloquea nada (el usuario sigue eligiendo formatos de otros
  // anuncios mientras corre). estrategiaId se recibe como parámetro (no
  // se lee "seleccionada.id" en vivo) para que, si el cliente cambia de
  // pestaña mientras esto sigue en curso, el resultado caiga en la
  // estrategia correcta y no en la que esté viendo en ese momento.
  const dispararRevisionImagen = async (estrategiaId: string, clave: string, urlImagen: string) => {
    const estrategiaDeLaRevision = estrategias.find((e) => e.id === estrategiaId);
    const [ci, ai] = clave.split("-").map(Number);
    const conjunto = estrategiaDeLaRevision?.conjuntos?.[ci];
    const anuncio = conjunto?.anuncios?.[ai];
    if (!conjunto || !anuncio) return;

    const marcar = (valor: RevisionImagen) => {
      if (!montadoRef.current) return;
      setRevisionesPorEstrategia((prev) => ({ ...prev, [estrategiaId]: { ...(prev[estrategiaId] || {}), [clave]: valor } }));
    };

    marcar({ estado: "revisando" });

    try {
      const res = await fetch("/api/estrategia/revisar-imagen-subida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_imagen: urlImagen,
          conjunto_nombre: conjunto.nombre,
          anuncio_nombre: anuncio.nombre,
          titulo: anuncio.copy?.titulo || "",
          texto: anuncio.copy?.texto || "",
          descripcion: anuncio.copy?.descripcion || "",
          cta: anuncio.copy?.cta || "",
          concepto: anuncio.concepto || null,
          campana: estrategiaDeLaRevision?.campana || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        marcar({ estado: "no_disponible" });
        return;
      }

      // Poll cada 3s con tope de 40s -- sin reintentos automáticos: si no
      // hay resultado para entonces, se cae al mensaje de "no pude
      // revisarla" y no se vuelve a intentar.
      const inicio = Date.now();
      const TOPE_MS = 40000;
      while (Date.now() - inicio < TOPE_MS) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (!montadoRef.current) return;
        const resPoll = await fetch(`/api/estrategia/revisar-imagen-jobs/${data.job_id}`);
        const dataPoll = await resPoll.json().catch(() => ({}));
        if (dataPoll.estado === "lista") {
          marcar({ estado: "lista", resultado: dataPoll.resultado || { cumple: true } });
          return;
        }
        if (dataPoll.estado === "fallida") {
          marcar({ estado: "no_disponible" });
          return;
        }
      }
      marcar({ estado: "no_disponible" });
    } catch {
      marcar({ estado: "no_disponible" });
    }
  };

  const manejarArchivoPropio = async (clave: string, file: File | undefined) => {
    if (!file) return;
    setErroresSubida((prev) => ({ ...prev, [clave]: "" }));
    setSubiendoClave(clave);
    try {
      const resultado = await validarImagenPropia(file);
      if (!resultado.ok) {
        setErroresSubida((prev) => ({ ...prev, [clave]: resultado.error }));
        return;
      }
      const res = await fetch("/api/estrategia/subir-imagen-anuncio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen_base64: resultado.base64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url_imagen) {
        setErroresSubida((prev) => ({ ...prev, [clave]: data.error || "No se pudo subir la imagen." }));
        return;
      }
      setPropiosPorEstrategia((prev) => ({ ...prev, [seleccionada.id]: { ...(prev[seleccionada.id] || {}), [clave]: { url_imagen: data.url_imagen } } }));
      cambiarTipo(clave, "subida");
      setMenuSubirAbierto((prev) => ({ ...prev, [clave]: false }));
      dispararRevisionImagen(seleccionada.id, clave, data.url_imagen);
    } catch {
      setErroresSubida((prev) => ({ ...prev, [clave]: "No se pudo conectar con el servidor." }));
    } finally {
      setSubiendoClave(null);
    }
  };

  return (
    <div className="qbe">
      <style>{`
        .qbe { --bg:#F6F5FB; --card:#fff; --line:#E7E4F3; --ink:#16142A; --muted:#5A5672; --soft:#8A86A3; --brand:#6C5CE7; --brand-d:#5A4BD6; --ok:#10A37F; --wa:#25D366; }
        .qbe button { font: inherit; cursor: pointer; }
        .qbe .tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 4px 0 18px; }
        .qbe .tab { text-align: left; background: var(--card); border: 1.5px solid var(--line); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, box-shadow .15s; }
        .qbe .tab[aria-selected="true"] { border-color: var(--brand); box-shadow: 0 12px 30px -18px rgba(108,92,231,.7); }
        .qbe .tab .t1 { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .qbe .tab b { font-size: 16px; color: var(--ink); }
        .qbe .tag { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: #E7F7F1; color: #0B7A5C; white-space: nowrap; }
        .qbe .tab .bar { height: 6px; border-radius: 99px; background: #EEECF7; overflow: hidden; }
        .qbe .tab .bar i { display: block; height: 100%; background: linear-gradient(90deg,#8C7EF7,#6C5CE7); border-radius: 99px; }
        .qbe .tab small { color: var(--muted); font-size: 13px; }
        .qbe .resumen { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 20px 22px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
        .qbe .resumen .txt { flex: 1 1 420px; min-width: 0; }
        .qbe .resumen h2 { margin: 0; font-size: 21px; color: var(--ink); }
        .qbe .resumen p { margin: 6px 0 0; color: var(--muted); font-size: 15px; }
        .qbe .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .qbe .chip { font-size: 13.5px; font-weight: 700; padding: 8px 12px; border-radius: 12px; background: #F3F1FB; color: #3B3758; }
        .qbe .cab { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 10px 0 14px; flex-wrap: wrap; }
        .qbe .cab h3 { margin: 0; font-size: 18px; color: var(--ink); }
        .qbe .cab span { color: var(--muted); font-size: 14px; }
        .qbe .toggle { display: inline-flex; background: #ECEAF6; border-radius: 12px; padding: 3px; }
        .qbe .toggle button { border: 0; background: transparent; padding: 8px 14px; border-radius: 9px; font-weight: 700; font-size: 14px; color: var(--muted); min-height: 38px; }
        .qbe .toggle button[aria-pressed="true"] { background: #fff; color: var(--ink); box-shadow: 0 2px 8px rgba(22,20,42,.08); }
        .qbe .carrusel { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(268px,1fr); gap: 16px; overflow-x: auto; padding: 4px 2px 14px; scroll-snap-type: x mandatory; }
        .qbe .anuncio { scroll-snap-align: start; display: flex; flex-direction: column; gap: 10px; }
        .qbe .feed { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: 0 14px 34px -24px rgba(22,20,42,.45); }
        .qbe .fh { display: flex; align-items: center; gap: 9px; padding: 10px 12px; }
        .qbe .av { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#F2B640,#C94680,#6C5CE7); padding: 2px; display: block; flex-shrink: 0; }
        .qbe .av i { display: block; width: 100%; height: 100%; border-radius: 50%; background: #2B2117; border: 2px solid #fff; }
        .qbe .av img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #fff; background: #fff; }
        .qbe .fh b { font-size: 13.5px; display: block; line-height: 1.2; color: var(--ink); }
        .qbe .fh small { font-size: 11.5px; color: var(--soft); }
        .qbe .fh .dots { margin-left: auto; color: var(--soft); font-weight: 800; letter-spacing: 1px; }
        .qbe .ctabar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: #F7F7F9; border-top: 1px solid #EFEFF3; }
        .qbe .ctabar small { display: block; color: var(--soft); font-size: 11px; }
        .qbe .ctabar b { font-size: 13.5px; line-height: 1.25; color: var(--ink); }
        .qbe .btnwa { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 13px; font-weight: 800; color: #fff; background: var(--wa); padding: 8px 11px; border-radius: 9px; flex-shrink: 0; }
        .qbe .btnct { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 13px; font-weight: 800; color: #fff; background: var(--brand); padding: 8px 11px; border-radius: 9px; flex-shrink: 0; }
        .qbe .cuerpo { padding: 10px 12px 12px; font-size: 13.5px; line-height: 1.45; color: var(--ink); }
        .qbe .cuerpo b { margin-right: 4px; }
        .qbe .cuerpo .mas { color: var(--soft); }
        .qbe .boceto { position: relative; aspect-ratio: 1/1; background: linear-gradient(160deg,#F4F1FF,#EAF4FF); border-bottom: 1px dashed #D9D3F3; display: flex; flex-direction: column; justify-content: space-between; padding: 14px; }
        .qbe .boceto .tipo { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; color: #4F40C9; text-transform: uppercase; letter-spacing: .05em; }
        .qbe .boceto .escena { font-size: 14.5px; line-height: 1.45; color: #2F2B4A; }
        .qbe .boceto .escena b { display: block; font-size: 12px; color: #7A7694; font-weight: 700; margin-bottom: 4px; }
        .qbe .boceto .prod { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #5A5672; font-weight: 600; }
        .qbe .boceto .prod i { width: 30px; height: 30px; border-radius: 8px; background: radial-gradient(60% 55% at 50% 45%,#D9B38A,#6E4325 70%); border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.15); display: block; }
        .qbe .boceto .hook { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: #16142A; color: #fff; font-weight: 800; font-size: 15px; line-height: 1.25; text-align: center; }
        .qbe .sinboceto { aspect-ratio: 1/1; background: #F3F2FE; display: flex; align-items: center; justify-content: center; font-size: 32px; }
        .qbe .formato { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; background: #ECEAF6; border-radius: 12px; padding: 3px; }
        .qbe .formato button { border: 0; background: transparent; border-radius: 9px; min-height: 36px; font-size: 12.5px; font-weight: 700; color: #5A5672; padding: 0 4px; line-height: 1.1; }
        .qbe .formato button[aria-pressed="true"] { background: #fff; color: #16142A; box-shadow: 0 2px 8px rgba(22,20,42,.08); }
        .qbe .formato button[disabled] { opacity: .55; cursor: not-allowed; }
        .qbe .formato button small { display: block; font-size: 9.5px; font-weight: 700; color: #8A86A3; }
        .qbe .subir { position: relative; aspect-ratio: 1/1; border-bottom: 1px dashed #D9D3F3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: repeating-linear-gradient(45deg,#FAF9FF,#FAF9FF 10px,#F3F0FF 10px,#F3F0FF 20px); text-align: center; padding: 16px; }
        .qbe .subir .ic { width: 44px; height: 44px; border-radius: 12px; background: #fff; border: 1px solid #DCD6F5; display: flex; align-items: center; justify-content: center; color: #6C5CE7; }
        .qbe .subir b { font-size: 14px; color: var(--ink); }
        .qbe .subir p { margin: 0; font-size: 12px; color: #5A5672; }
        .qbe .subir .btn { border: 1.5px solid #6C5CE7; color: #6C5CE7; background: #fff; border-radius: 10px; min-height: 36px; padding: 0 12px; font-weight: 700; font-size: 12.5px; }
        .qbe .subir .costo { font-size: 10.5px; color: #7A7694; font-weight: 600; }
        .qbe .subir .err { font-size: 11.5px; color: #B3261E; font-weight: 600; max-width: 220px; }
        .qbe .propiaLista { position: relative; aspect-ratio: 1/1; overflow: hidden; }
        .qbe .propiaLista img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .qbe .propiaLista .quitar { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,.55); color: #fff; border: none; border-radius: 999px; width: 26px; height: 26px; font-size: 13px; }
        .qbe .revision { padding: 10px 12px; border-bottom: 1px solid #EFEFF3; font-size: 12.5px; }
        .qbe .revision .estado { color: var(--soft); }
        .qbe .revision .estado.ok { color: #0B7A5C; font-weight: 800; }
        .qbe .revision .sug b { display: block; font-size: 12.5px; color: #92400E; margin-bottom: 4px; }
        .qbe .revision .sug ul { margin: 0 0 8px 18px; padding: 0; color: var(--muted); }
        .qbe .revision .sug ul li { margin-bottom: 2px; }
        .qbe .revision .botones { display: flex; gap: 8px; }
        .qbe .revision .botones button { flex: 1; border: 1px solid #DCD6F5; background: #fff; color: #4F40C9; border-radius: 8px; min-height: 32px; font-weight: 700; font-size: 11.5px; }
        .qbe .concepto { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 13px; display: grid; gap: 6px; font-size: 13.5px; }
        .qbe .concepto .ang { display: flex; gap: 6px; flex-wrap: wrap; }
        .qbe .concepto .ang span { font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 999px; background: #EFEBFF; color: #4F40C9; }
        .qbe .concepto .ang span.f { background: #EAF6FF; color: #1D5FA8; }
        .qbe .concepto p { margin: 0; color: var(--muted); }
        .qbe .concepto p b { color: var(--ink); }
        @media (max-width: 760px) { .qbe .tabs { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 78%; overflow-x: auto; } .qbe .carrusel { grid-auto-columns: 86%; } }
        @media (prefers-reduced-motion: reduce) { .qbe * { scroll-behavior: auto !important; } }
      `}</style>

      <div className="tabs" role="tablist" aria-label="Estrategias">
        {estrategias.map((e) => (
          <button
            key={e.id}
            className="tab"
            role="tab"
            aria-selected={e.id === seleccionada.id}
            onClick={() => setSelectedId(e.id)}
          >
            <span className="t1">
              <b>{e.campana?.nombre}</b>
              {e.id === idMasEfectivo && <span className="tag">Recomendada</span>}
            </span>
            <span className="bar"><i style={{ width: `${Math.round(e.efectividad ?? 0)}%` }} /></span>
            <small>Efectividad {Math.round(e.efectividad ?? 0)} % · {(e.conjuntos || []).reduce((n: number, c: any) => n + (c.anuncios?.length ?? 0), 0)} anuncios</small>
          </button>
        ))}
      </div>

      <div className="resumen">
        <div className="txt">
          <h2>{seleccionada.campana?.nombre}</h2>
          {seleccionada.justificacion_efectividad && <p>{seleccionada.justificacion_efectividad}</p>}
        </div>
        <div className="chips">
          <span className="chip">{fmtCOP(seleccionada.campana?.presupuesto_diario_cop)} / día</span>
          {objetivo?.destino === "whatsapp" && <span className="chip">WhatsApp</span>}
          {seleccionada.campana?.tipo_presupuesto && <span className="chip">{seleccionada.campana.tipo_presupuesto === "CBO" ? "Advantage+" : seleccionada.campana.tipo_presupuesto}</span>}
        </div>
      </div>

      <div className="cab">
        <div>
          <h3>Así serán tus anuncios</h3>
          <span>Elige el formato de cada anuncio. Los textos son los reales; las imágenes se crean en el siguiente paso siguiendo el boceto.</span>
        </div>
        <div className="toggle" role="group" aria-label="Vista previa">
          <button aria-pressed={vistaPrevia === "instagram"} onClick={() => setVistaPrevia("instagram")}>Instagram</button>
          <button aria-pressed={vistaPrevia === "facebook"} onClick={() => setVistaPrevia("facebook")}>Facebook</button>
        </div>
      </div>

      <div className="carrusel">
        {anuncios.map(({ clave, conjunto, anuncio }) => {
          const tipoActual = tiposPorAnuncio[clave] || "imagen";
          const hayVideoEnOtroLado = Object.entries(tiposPorAnuncio).some(([k, v]) => v === "video" && k !== clave);
          const videoProximamente = !esAdmin;
          const videoBloqueado = videoProximamente || (hayVideoEnOtroLado && tipoActual !== "video");
          const esFormatoSubir = tipoActual === "subida" || tipoActual === "album";
          const imagenPropia = creativosPropios[clave];
          const concepto = anuncio.concepto;
          const botonTexto = esWhatsapp ? "Enviar mensaje" : anuncio.copy?.cta || "Ver más";

          return (
            <div className="anuncio" key={clave}>
              <div className="formato" role="group" aria-label={`Formato del anuncio: ${anuncio.copy?.titulo || anuncio.nombre}`}>
                <button aria-pressed={tipoActual === "imagen"} onClick={() => cambiarTipo(clave, "imagen")}>Imagen</button>
                <button aria-pressed={false} disabled title="Próximamente">Carrusel<small>Pronto</small></button>
                <button
                  aria-pressed={tipoActual === "video"}
                  disabled={videoBloqueado}
                  title={videoProximamente ? "Próximamente" : videoBloqueado ? "Solo se puede usar video en un anuncio por estrategia" : undefined}
                  onClick={() => cambiarTipo(clave, "video")}
                >
                  Video{videoProximamente && <small>Pronto</small>}
                </button>
                <button aria-pressed={esFormatoSubir} onClick={() => setMenuSubirAbierto((prev) => ({ ...prev, [clave]: !prev[clave] }))}>
                  Subir el mío
                </button>
              </div>

              {menuSubirAbierto[clave] && !esFormatoSubir && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      // Pasa a "subida" ANTES de abrir el picker (no al
                      // terminar de subir) -- si no, mientras sube (o si
                      // falla) la tarjeta seguía mostrando el boceto de
                      // "imagen" normal, sin "Subiendo..." ni el error,
                      // porque esas dos vistas están condicionadas a
                      // tipoActual === "subida" más abajo.
                      cambiarTipo(clave, "subida");
                      setMenuSubirAbierto((prev) => ({ ...prev, [clave]: false }));
                      inputsRef.current[clave]?.click();
                    }}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1.5px solid #6C5CE7", color: "#6C5CE7", background: "#fff", borderRadius: 10, minHeight: 38, fontWeight: 700, fontSize: 12.5 }}
                  >
                    <Upload size={14} /> Subir una imagen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cambiarTipo(clave, "album");
                      setMenuSubirAbierto((prev) => ({ ...prev, [clave]: false }));
                    }}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1.5px solid #6C5CE7", color: "#6C5CE7", background: "#fff", borderRadius: 10, minHeight: 38, fontWeight: 700, fontSize: 12.5 }}
                  >
                    <FolderOpen size={14} /> Elegir de mi álbum
                  </button>
                </div>
              )}

              <input
                ref={(el) => { inputsRef.current[clave] = el; }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  manejarArchivoPropio(clave, file);
                  e.target.value = "";
                }}
              />

              <div className="feed">
                <div className="fh">
                  <span className="av">{logoUrl ? <img src={logoUrl} alt="" /> : <i />}</span>
                  <div><b>{nombreEncabezado}</b><small>Publicidad</small></div>
                  <span className="dots">···</span>
                </div>

                {tipoActual === "video" ? (
                  <div className="sinboceto">
                    <Video size={28} color="#6C5CE7" />
                  </div>
                ) : tipoActual === "album" ? (
                  <div className="sinboceto" style={{ flexDirection: "column", gap: 6 }}>
                    <FolderOpen size={26} color="#6C5CE7" />
                    <span style={{ fontSize: 12, color: "#5A5672", fontWeight: 600, padding: "0 16px", textAlign: "center" }}>
                      Elegirás la imagen de tu álbum en el siguiente paso
                    </span>
                  </div>
                ) : tipoActual === "subida" && imagenPropia ? (
                  <div className="propiaLista">
                    <img src={imagenPropia.url_imagen} alt="" />
                    <button
                      className="quitar"
                      title="Quitar"
                      onClick={() => {
                        quitarImagenPropia(clave);
                        cambiarTipo(clave, "imagen");
                        descartarRevision(seleccionada.id, clave);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : tipoActual === "subida" && subiendoClave === clave ? (
                  <div className="sinboceto">
                    <span style={{ fontSize: 12, color: "#5A5672" }}>Subiendo...</span>
                  </div>
                ) : tipoActual === "subida" ? (
                  <div className="subir">
                    <div className="ic"><Upload size={20} /></div>
                    <b>Usa tu propia imagen</b>
                    <p>JPG, PNG o WebP, mínimo 600×600px. Los textos del anuncio se mantienen.</p>
                    <button className="btn" type="button" onClick={() => inputsRef.current[clave]?.click()}>Elegir imagen</button>
                    {erroresSubida[clave] ? <span className="err">{erroresSubida[clave]}</span> : <span className="costo">No gasta generación de IA</span>}
                  </div>
                ) : concepto ? (
                  <div className="boceto">
                    <div className="tipo">
                      <ImageIcon size={16} />
                      Boceto de la imagen · {NOMBRES_FORMATO_VISUAL[concepto.formato_visual] || concepto.formato_visual}
                    </div>
                    <div className="escena"><b>Lo que mostrará:</b>{concepto.escenario}</div>
                    <div>
                      <span className="prod"><i />Se crea con tu foto del producto</span>
                      {concepto.hook && <div className="hook">{concepto.hook}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="sinboceto">🖼️</div>
                )}

                {tipoActual === "subida" && imagenPropia && revisionesPorAnuncio[clave] && (() => {
                  const revision = revisionesPorAnuncio[clave];
                  if (revision.estado === "revisando") {
                    return (
                      <div className="revision">
                        <span className="estado">Revisando tu imagen…</span>
                      </div>
                    );
                  }
                  if (revision.estado === "no_disponible") {
                    return (
                      <div className="revision">
                        <span className="estado">No pude revisarla, pero puedes usarla</span>
                      </div>
                    );
                  }
                  // estado === "lista": puntos manda si viene alguno
                  // (aunque cumple sea true) -- "✓ Encaja" es solo para
                  // cuando no hay ninguna sugerencia que dar.
                  const puntos = revision.resultado.puntos?.length
                    ? revision.resultado.puntos
                    : revision.resultado.cumple
                    ? []
                    : revision.resultado.comentario
                    ? [revision.resultado.comentario]
                    : [];
                  if (puntos.length === 0) {
                    return (
                      <div className="revision">
                        <span className="estado ok">✓ Encaja con este anuncio</span>
                      </div>
                    );
                  }
                  return (
                    <div className="revision">
                      <div className="sug">
                        <b>Sugerencias</b>
                        <ul>{puntos.slice(0, 3).map((p, i) => <li key={i}>{p}</li>)}</ul>
                        <div className="botones">
                          <button type="button" onClick={() => descartarRevision(seleccionada.id, clave)}>
                            Usarla así
                          </button>
                          <button type="button" onClick={() => inputsRef.current[clave]?.click()}>
                            Cambiar imagen
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="ctabar">
                  <div><small>{esWhatsapp ? "wa.me" : "Anuncio"}</small><b>{anuncio.copy?.titulo}</b></div>
                  <span className={esWhatsapp ? "btnwa" : "btnct"}>{botonTexto}</span>
                </div>
                <div className="cuerpo"><b>{nombreEncabezado}</b>{anuncio.copy?.texto} <span className="mas">más</span></div>
              </div>

              {concepto && (
                <div className="concepto">
                  <div className="ang">
                    <span>{NOMBRES_ANGULO[concepto.angulo] || concepto.angulo}</span>
                    <span className="f">{NOMBRES_FORMATO_VISUAL[concepto.formato_visual] || concepto.formato_visual}</span>
                  </div>
                  {concepto.persona && <p><b>Le habla a:</b> {concepto.persona}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          onClick={() => onElegir(seleccionada, tiposPorAnuncio, creativosPropios)}
          style={{ border: 0, minHeight: 52, padding: "0 28px", borderRadius: 14, background: "#6C5CE7", color: "#fff", fontWeight: 800, fontSize: 16, boxShadow: "0 12px 26px -12px #6C5CE7" }}
        >
          Elegir esta estrategia →
        </button>
      </div>
    </div>
  );
}

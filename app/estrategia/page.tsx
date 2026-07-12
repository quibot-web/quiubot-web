"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdBlueprintExplorer from "@/app/components/AdBlueprintExplorer";

function IconoWhatsApp() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ display: "inline-block" }}>
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M23.47 8.52A9.86 9.86 0 0 0 16.06 5.5c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L6 25.5l5.28-1.39a9.9 9.9 0 0 0 4.78 1.22h.01c5.46 0 9.9-4.44 9.9-9.9a9.85 9.85 0 0 0-2.5-6.91zm-7.41 15.24h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.55 3.7-8.25 8.26-8.25a8.2 8.2 0 0 1 5.84 2.42 8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.27 8.25zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31s-.87.85-.87 2.08.89 2.41 1.01 2.58c.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z"
      />
    </svg>
  );
}

const OBJETIVOS = [
  { id: "venta_directa_web", label: "Venta Directa", icon: "🛒", desc: "Ventas inmediatas en tu sitio web.", meta_objective: "OUTCOME_SALES", destino: "sitio_web" },
  { id: "venta_directa_whatsapp", label: "Venta Directa (WhatsApp)", icon: <IconoWhatsApp />, desc: "Ventas por conversación directa en WhatsApp.", meta_objective: "OUTCOME_SALES", destino: "whatsapp" },
  { id: "reconocimiento", label: "Reconocimiento", icon: "📢", desc: "Más personas conocerán tu marca.", meta_objective: "OUTCOME_AWARENESS", destino: "pagina" },
  { id: "retargeting", label: "Retargeting", icon: "🔄", desc: "Impacta a quienes ya te conocen.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
  { id: "leads", label: "Generación de Leads", icon: "🎯", desc: "Captura contactos interesados en tu producto.", meta_objective: "OUTCOME_LEADS", destino: "formulario" },
  { id: "trafico_mensajes", label: "Tráfico / Mensajes", icon: "💬", desc: "Lleva visitas a tu web o inicia conversaciones.", meta_objective: "OUTCOME_TRAFFIC", destino: "sitio_web" },
];

function analizarCreativosConEstrategia(items: any[], estrategia: any) {
  const objetivoCampana = (estrategia?.campana?.objetivo_meta || "").toLowerCase();
  const efectividadBase = estrategia?.efectividad ?? 80;
  let ajusteTotal = 0;

  const detalle = items.map((it) => {
    let cumple = true;
    let comentario = "";

    if (it.tipo === "video") {
      cumple = true;
      comentario = "El formato video suele generar más interacción para este objetivo.";
      ajusteTotal += 4;
    } else if (objetivoCampana.includes("venta") || objetivoCampana.includes("sales")) {
      cumple = true;
      comentario = "Una imagen clara del producto funciona bien en campañas de venta directa.";
      ajusteTotal += 2;
    } else if (objetivoCampana.includes("reconoc") || objetivoCampana.includes("awareness")) {
      cumple = false;
      comentario = "Para reconocimiento de marca, un video suele generar más alcance que una imagen estática.";
      ajusteTotal -= 6;
    } else {
      cumple = true;
      comentario = "El formato es compatible con la estrategia planteada.";
      ajusteTotal += 1;
    }

    return { id: it.id, tipo: it.tipo, url_imagen: it.url_imagen, cumple, comentario };
  });

  const promedioAjuste = items.length > 0 ? ajusteTotal / items.length : 0;
  let score = Math.round(efectividadBase + promedioAjuste);
  score = Math.max(40, Math.min(98, score));

  return { score, detalle };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Consulta /api/creativos-jobs/[id] cada 5s hasta que el job quede "listo" o "error".
// Se usa tanto para generar todos los creativos como para regenerar uno solo,
// y también para retomar un job desde el link de una notificación.
async function pollJobHasta(jobId: string, maxMs = 10 * 60 * 1000): Promise<any[]> {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const res = await fetch(`/api/creativos-jobs/${jobId}`);
    const data = await res.json().catch(() => ({}));
    if (data.estado === "listo") {
      return data.creativos || [];
    }
    if (data.estado === "error") {
      throw new Error(data.error_mensaje || "La generación de creativos falló.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("La generación de creativos está tardando más de lo esperado. Intenta de nuevo en unos minutos.");
}

function ErrorConAccion({ mensaje }: { mensaje: string }) {
  const tieneLinkOpenAI = mensaje.includes("platform.openai.com");
  return (
    <div style={{ color: "#991b1b", fontSize: 13 }}>
      <div>{mensaje}</div>
      {tieneLinkOpenAI && (
        <div style={{ marginTop: 6 }}>
          <a
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#7F77DD", fontWeight: 600 }}
          >
            Ir a recargar saldo
          </a>
        </div>
      )}
    </div>
  );
}

type EstrategiaStep =
  | "imagen"
  | "objetivo"
  | "presupuesto"
  | "resultado"
  | "fuente"
  | "album-selector"
  | "analisis"
  | "creativos";

export default function EstrategiaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<EstrategiaStep>("imagen");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState<typeof OBJETIVOS[number] | null>(null);
  const [presupuestoDiario, setPresupuestoDiario] = useState<number>(50000);
  const [cargandoEstrategia, setCargandoEstrategia] = useState(false);
  const [cargandoCreativos, setCargandoCreativos] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [estrategiaSeleccionada, setEstrategiaSeleccionada] = useState<any | null>(null);
  const [estrategiasGeneradas, setEstrategiasGeneradas] = useState<any[] | null>(null);
  const [descripcionVisual, setDescripcionVisual] = useState<string>("");
  const [imagenBase64Persistida, setImagenBase64Persistida] = useState<string | null>(null);
  const [creativos, setCreativos] = useState<any[] | null>(null);
  const [regenerandoIndices, setRegenerandoIndices] = useState<Record<number, boolean>>({});
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  const [fuenteCreativos, setFuenteCreativos] = useState<"ia" | "album" | null>(null);
  const [analisisResultado, setAnalisisResultado] = useState<{ score: number; detalle: any[] } | null>(null);

  const [albumItems, setAlbumItems] = useState<{ url_imagen: string; tipo: string; public_id: string }[]>([]);
  const [cargandoAlbum, setCargandoAlbum] = useState(false);
  const [seleccionAlbum, setSeleccionAlbum] = useState<string[]>([]);

  const [objetivosActivos, setObjetivosActivos] = useState<string[] | null>(null);
  const [esAdminObjetivos, setEsAdminObjetivos] = useState(false);
  const [planUsuario, setPlanUsuario] = useState<string>("arranque");
  const [planMinimoPorId, setPlanMinimoPorId] = useState<Record<string, string>>({});

  const fileRef = useRef<HTMLInputElement>(null);

  // Si el usuario llega desde la notificación "creativos_listos" (?job=<id>),
  // retoma el polling en vez de arrancar el wizard desde el paso 1.
  useEffect(() => {
    const jobId = searchParams.get("job");
    if (!jobId) return;

    const descGuardada = localStorage.getItem("quiubot_descripcion_visual_producto");
    if (descGuardada) setDescripcionVisual(descGuardada);
    const imgGuardada = localStorage.getItem("quiubot_imagen_producto_base64");
    if (imgGuardada) setImagenBase64Persistida(imgGuardada);

    setFuenteCreativos("ia");
    setCargandoCreativos(true);
    setStep("creativos");
    setErrorMsg(null);

    pollJobHasta(jobId)
      .then((creativosListos) => {
        localStorage.removeItem("quiubot_job_creativos_activo");

        // Si este job era la regeneración de un solo anuncio (no un lote completo nuevo),
        // restauramos el lote guardado y solo reemplazamos esa posición.
        const idxGuardado = localStorage.getItem("quiubot_job_regenerar_idx");
        const loteGuardado = localStorage.getItem("quiubot_creativos_lote");
        if (idxGuardado !== null && loteGuardado) {
          try {
            const loteBase = JSON.parse(loteGuardado);
            const idx = parseInt(idxGuardado, 10);
            if (creativosListos[0]) {
              loteBase[idx] = creativosListos[0];
            }
            setCreativos(loteBase);
          } catch {
            setCreativos(creativosListos);
          } finally {
            localStorage.removeItem("quiubot_creativos_lote");
            localStorage.removeItem("quiubot_job_regenerar_idx");
          }
        } else {
          setCreativos(creativosListos);
        }
      })
      .catch((e: any) => {
        localStorage.removeItem("quiubot_job_creativos_activo");
        localStorage.removeItem("quiubot_creativos_lote");
        localStorage.removeItem("quiubot_job_regenerar_idx");
        setErrorMsg(e?.message || "No se pudo recuperar el estado de la generación.");
        setCreativos([]);
      })
      .finally(() => setCargandoCreativos(false));

    // limpia el ?job= de la URL para que un refresh no repita el polling
    router.replace("/estrategia");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/objetivos-activos")
      .then((r) => r.json())
      .then((data) => {
        setObjetivosActivos(data.activos ?? []);
        setEsAdminObjetivos(!!data.esAdmin);
        setPlanUsuario(data.planUsuario || "arranque");
        setPlanMinimoPorId(data.planMinimoPorId || {});
      })
      .catch(() => setObjetivosActivos([]));
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleGenerarEstrategia = async () => {
    if (!imagen || !objetivo || presupuestoDiario < 20000) return;
    setCargandoEstrategia(true);
    setErrorMsg(null);
    try {
      const imagenBase64 = await fileToBase64(imagen);
      const res = await fetch("/api/generar-estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen_base64: imagenBase64, objetivo, presupuesto_diario_cop: presupuestoDiario }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudo generar la estrategia. Intenta de nuevo.");
        return;
      }
      setEstrategiasGeneradas(data.campanas || []);
      setDescripcionVisual(data.descripcion_visual_producto || "");
      try { localStorage.setItem("quiubot_descripcion_visual_producto", data.descripcion_visual_producto || ""); } catch {}
      setStep("resultado");
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setCargandoEstrategia(false);
    }
  };

  const handleSeleccionarEstrategia = (estrategia: any) => {
    setEstrategiaSeleccionada(estrategia);
    setStep("fuente");
  };

  const handleGenerarConIA = async () => {
    setFuenteCreativos("ia");
    setAnalisisResultado(null);
    setCargandoCreativos(true);
    setStep("creativos");
    setErrorMsg(null);
    // Un lote completo nuevo nunca es una regeneración parcial — limpiamos cualquier
    // marca vieja de "regenerando el índice X" que pudiera haber quedado de antes.
    localStorage.removeItem("quiubot_creativos_lote");
    localStorage.removeItem("quiubot_job_regenerar_idx");
    try {
      const imagenBase64 = imagen ? await fileToBase64(imagen) : imagenBase64Persistida;
      if (imagenBase64 && imagen) {
        try {
          localStorage.setItem("quiubot_imagen_producto_base64", imagenBase64);
          setImagenBase64Persistida(imagenBase64);
        } catch {}
      }
      const res = await fetch("/api/crear-creativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaSeleccionada,
          descripcion_visual_producto: descripcionVisual,
          imagen_producto_base64: imagenBase64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        setErrorMsg(data.error || "No se pudieron generar los creativos.");
        setCreativos([]);
        return;
      }
      localStorage.setItem("quiubot_job_creativos_activo", data.job_id);
      const creativosListos = await pollJobHasta(data.job_id);
      localStorage.removeItem("quiubot_job_creativos_activo");
      setCreativos(creativosListos);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
      setCreativos([]);
    } finally {
      setCargandoCreativos(false);
    }
  };

  // Regenera un solo anuncio, manteniendo su posición en la lista
  const handleRegenerarUno = async (idx: number) => {
    const creativo = creativos?.[idx];
    if (!creativo) return;
    setRegenerandoIndices((prev) => ({ ...prev, [idx]: true }));
    setErrorMsg(null);
    try {
      const imagenBase64 = imagen ? await fileToBase64(imagen) : imagenBase64Persistida;
      const estrategiaMini = {
        ...estrategiaSeleccionada,
        conjuntos: [
          {
            nombre: creativo.conjunto_nombre,
            anuncios: [
              {
                nombre: creativo.anuncio_nombre,
                copy: { titulo: creativo.titulo, texto: creativo.texto, cta: creativo.cta },
                argumentacion: creativo.argumentacion,
              },
            ],
          },
        ],
      };
      const res = await fetch("/api/crear-creativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaMini,
          descripcion_visual_producto: descripcionVisual,
          imagen_producto_base64: imagenBase64,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        setErrorMsg(data.error || "No se pudo regenerar este anuncio.");
        return;
      }
      // Guardamos el lote completo + qué índice se está regenerando, para que si el
      // usuario sale y vuelve por la notificación, se pueda reemplazar solo esa posición
      // en vez de perder los demás creativos del lote.
      try {
        localStorage.setItem("quiubot_job_creativos_activo", data.job_id);
        localStorage.setItem("quiubot_creativos_lote", JSON.stringify(creativos));
        localStorage.setItem("quiubot_job_regenerar_idx", String(idx));
      } catch {}
      const creativosListos = await pollJobHasta(data.job_id);
      localStorage.removeItem("quiubot_job_creativos_activo");
      if (!creativosListos[0]) {
        setErrorMsg("No se pudo regenerar este anuncio.");
        return;
      }
      setCreativos((prev) => {
        if (!prev) return prev;
        const nuevos = [...prev];
        nuevos[idx] = creativosListos[0];
        return nuevos;
      });
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
    } finally {
      setRegenerandoIndices((prev) => ({ ...prev, [idx]: false }));
    }
  };

  // Quita el creativo de esta campaña (el archivo ya quedó guardado en tu álbum permanentemente)
  const handleEliminarCreativo = (idx: number) => {
    setCreativos((prev) => prev?.filter((_, i) => i !== idx) ?? null);
  };

  const handleUsarAlbum = async () => {
    setFuenteCreativos("album");
    setCargandoAlbum(true);
    setStep("album-selector");
    try {
      const res = await fetch("/api/album");
      const data = await res.json();
      setAlbumItems(data.imagenes ?? []);
    } catch (e) {
      setErrorMsg("No se pudo cargar tu álbum.");
    } finally {
      setCargandoAlbum(false);
    }
  };

  const toggleSeleccionAlbum = (id: string) => {
    setSeleccionAlbum((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const handleConfirmarSeleccionAlbum = () => {
    const seleccionados = albumItems.filter((it) => seleccionAlbum.includes(it.public_id || it.url_imagen));
    const nuevosCreativos = seleccionados.map((it, i) => ({
      id: it.public_id || `album_${i}`,
      tipo: it.tipo,
      url_imagen: it.url_imagen,
      titulo: "",
      texto: "",
      cta: "Comprar ahora",
    }));
    setCreativos(nuevosCreativos);
    const resultado = analizarCreativosConEstrategia(nuevosCreativos, estrategiaSeleccionada);
    setAnalisisResultado(resultado);
    setStep("analisis");
  };

  const actualizarCreativo = (id: string, campo: string, valor: string) => {
    setCreativos((prev) => prev?.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)) ?? null);
  };

  const handlePublicarEnMeta = async () => {
    setPublicando(true);
    setErrorMsg(null);
    try {
      const efectividadFinal = fuenteCreativos === "album" ? analisisResultado?.score : estrategiaSeleccionada?.efectividad;
      const res = await fetch("/api/publicar-estrategia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estrategia: estrategiaSeleccionada,
          creativos,
          fuente_creativos: fuenteCreativos,
          efectividad_final: efectividadFinal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo publicar la estrategia en Meta.");
        return;
      }
      setPublicado(true);
    } catch (e) {
      setErrorMsg("No se pudo conectar con el servidor.");
    } finally {
      setPublicando(false);
    }
  };

  const scoreParaMostrar =
    fuenteCreativos === "album" ? analisisResultado?.score ?? estrategiaSeleccionada?.efectividad : estrategiaSeleccionada?.efectividad;

  const algunaRegenerando = Object.values(regenerandoIndices).some(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <button onClick={() => router.push("/")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "1.5rem", background: "none", border: "none", color: "#7F77DD", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: 0 }}>
          ← Volver al panel principal
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Motor de Estrategia Publicitaria</h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: "2rem" }}>
          Paso {step === "imagen" ? "1" : step === "objetivo" ? "2" : step === "presupuesto" ? "3" : step === "resultado" ? "4" : "5"} de 5
        </p>

        {step === "imagen" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>1. Sube la foto de tu producto</p>
            <div onClick={() => fileRef.current?.click()} style={{ border: "1.5px dashed #7F77DD", borderRadius: 12, padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fcfcff", minHeight: 180 }}>
              {preview ? (
                <img src={preview} alt="preview" style={{ maxHeight: 200, borderRadius: 8 }} />
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
                  <div style={{ fontSize: 14, color: "#534AB7", fontWeight: 500 }}>Subir foto del producto</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>Arrastra o haz clic aquí</div>
                </>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>
            <button onClick={() => setStep("objetivo")} disabled={!imagen} style={{ background: !imagen ? "#ccc" : "#534AB7", color: "#fff", border: "none", padding: "16px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: !imagen ? "not-allowed" : "pointer" }}>
              Siguiente paso
            </button>
          </div>
        )}

        {step === "objetivo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>2. Selecciona tu objetivo publicitario</p>
            {objetivosActivos === null && <p style={{ fontSize: 13, color: "#999" }}>Cargando objetivos disponibles...</p>}
            {objetivosActivos !== null && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                {OBJETIVOS.map((opt) => {
                  const estaActivo = objetivosActivos.includes(opt.id);
                  const planRequerido = planMinimoPorId[opt.id] || "arranque";
                  const ORDEN_PLANES = ["arranque", "crecimiento", "escala"];
                  const planAlcanza = ORDEN_PLANES.indexOf(planUsuario) >= ORDEN_PLANES.indexOf(planRequerido);
                  const soloVisualParaAdmin = esAdminObjetivos && !estaActivo;
                  const bloqueadoPorPlan = estaActivo && !planAlcanza && !esAdminObjetivos;
                  const clicable = (estaActivo && planAlcanza) || esAdminObjetivos;
                  const grisDelTodo = !estaActivo || bloqueadoPorPlan;

                  let etiqueta: string | null = null;
                  if (!estaActivo) etiqueta = soloVisualParaAdmin ? "Solo tú lo ves" : "Próximamente";
                  else if (bloqueadoPorPlan) etiqueta = `Plan ${planRequerido === "crecimiento" ? "Crecimiento" : "Escala"}`;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        if (clicable) setObjetivo(opt);
                        else if (bloqueadoPorPlan) router.push("/pricing");
                      }}
                      style={{
                        position: "relative",
                        padding: "1.5rem",
                        borderRadius: 16,
                        border: objetivo?.id === opt.id ? "2px solid #534AB7" : "1px solid #e8e8e6",
                        background: objetivo?.id === opt.id ? "#f3f2fe" : "#fff",
                        cursor: clicable ? "pointer" : bloqueadoPorPlan ? "pointer" : "not-allowed",
                        textAlign: "center",
                        transition: "all 0.2s",
                        opacity: grisDelTodo ? 0.45 : 1,
                        filter: grisDelTodo ? "grayscale(1)" : "none",
                      }}
                    >
                      {etiqueta && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: bloqueadoPorPlan ? "#f3f2fe" : soloVisualParaAdmin ? "#fef3c7" : "#e5e7eb",
                            color: bloqueadoPorPlan ? "#534AB7" : soloVisualParaAdmin ? "#92400e" : "#666",
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 10,
                          }}
                        >
                          {etiqueta}
                        </span>
                      )}
                      <div style={{ fontSize: 32, marginBottom: 10, display: "flex", justifyContent: "center" }}>{opt.icon}</div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{opt.desc}</div>
                      {bloqueadoPorPlan && (
                        <div style={{ fontSize: 11, color: "#534AB7", fontWeight: 600, marginTop: 8 }}>Mejorar plan →</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("imagen")} style={{ padding: "16px 32px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>Atrás</button>
              <button onClick={() => setStep("presupuesto")} disabled={!objetivo} style={{ flex: 1, background: !objetivo ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: !objetivo ? "not-allowed" : "pointer" }}>
                Siguiente →
              </button>
            </div>
            {errorMsg && <ErrorConAccion mensaje={errorMsg} />}
          </div>
        )}

        {step === "presupuesto" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <button onClick={() => setStep("objetivo")} style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, padding: 0, alignSelf: "flex-start" }}>
              ← Cambiar objetivo
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>3. ¿Cuál es tu presupuesto diario?</p>
            <p style={{ fontSize: 13, color: "#666", marginTop: -8 }}>La IA diseñará la mejor estructura de campaña posible para este monto exacto.</p>
            <div style={{ background: "#fff", border: "2px solid #e0e0e0", borderRadius: 14, padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: "#666" }}>$</span>
                <input type="number" min={20000} step={5000} value={presupuestoDiario} onChange={(e) => setPresupuestoDiario(Number(e.target.value))} style={{ flex: 1, border: "none", outline: "none", fontSize: 24, fontWeight: 700, color: "#1a1a1a", fontFamily: "inherit" }} />
                <span style={{ fontSize: 14, color: "#999" }}>COP / día</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {[30000, 50000, 100000, 150000].map((monto) => (
                  <button key={monto} onClick={() => setPresupuestoDiario(monto)} style={{ padding: "8px 14px", borderRadius: 20, border: presupuestoDiario === monto ? "2px solid #534AB7" : "1px solid #e0e0e0", background: presupuestoDiario === monto ? "#f3f2fe" : "#fff", color: presupuestoDiario === monto ? "#534AB7" : "#666", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ${monto.toLocaleString("es-CO")}
                  </button>
                ))}
              </div>
              {presupuestoDiario < 20000 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 10, fontSize: 13, color: "#991b1b" }}>
                  El mínimo recomendado es $20.000 COP/día — por debajo de esto, la campaña no suele salir de la fase de aprendizaje de Meta.
                </div>
              )}
              {presupuestoDiario >= 500000 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
                  Presupuestos altos sin historial previo pueden no optimizarse de inmediato. Considera empezar más bajo y escalar.
                </div>
              )}
            </div>
            {cargandoEstrategia && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem" }}>
                <div className="spinner-estrategia"></div>
                <p style={{ marginTop: "1rem", color: "#534AB7", fontWeight: 600 }}>Diseñando tu estrategia con IA...</p>
                <p style={{ marginTop: 4, color: "#999", fontSize: 12 }}>Esto puede tardar hasta 30 segundos</p>
              </div>
            )}
            {!cargandoEstrategia && (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("objetivo")} style={{ padding: "16px 32px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>Atrás</button>
                <button onClick={handleGenerarEstrategia} disabled={presupuestoDiario < 20000} style={{ flex: 1, background: presupuestoDiario < 20000 ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: presupuestoDiario < 20000 ? "not-allowed" : "pointer" }}>
                  🚀 Generar Estrategia
                </button>
              </div>
            )}
            {errorMsg && <ErrorConAccion mensaje={errorMsg} />}
          </div>
        )}

        {step === "resultado" && (
          <div>
            <button onClick={() => setStep("presupuesto")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Cambiar presupuesto
            </button>
            <AdBlueprintExplorer estrategias={estrategiasGeneradas ?? undefined} onPublish={handleSeleccionarEstrategia} />
          </div>
        )}

        {step === "fuente" && (
          <div>
            <button onClick={() => setStep("resultado")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Volver a estrategias
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 16 }}>4. ¿Cómo quieres tus creativos?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div onClick={handleGenerarConIA} style={{ padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", background: "#fff", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🤖</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Generar con IA</div>
                <div style={{ fontSize: 12, color: "#666" }}>Crea imágenes y copys nuevos automáticamente según tu estrategia.</div>
              </div>
              <div onClick={handleUsarAlbum} style={{ padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", background: "#fff", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Usar mis creativos del álbum</div>
                <div style={{ fontSize: 12, color: "#666" }}>Elige imágenes o videos que ya subiste. El sistema evaluará si encajan con la estrategia.</div>
              </div>
            </div>
          </div>
        )}

        {step === "album-selector" && (
          <div>
            <button onClick={() => setStep("fuente")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Atrás
            </button>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 16 }}>
              Selecciona los creativos que quieres usar ({seleccionAlbum.length} seleccionados)
            </p>
            {cargandoAlbum && <p style={{ color: "#666", fontSize: 13 }}>Cargando álbum...</p>}
            {!cargandoAlbum && albumItems.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>
                Aún no tienes imágenes ni videos en tu álbum. Sube contenido desde la sección "Álbum Creativos" en el panel principal.
              </p>
            )}
            {!cargandoAlbum && albumItems.length > 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                  {albumItems.map((item, i) => {
                    const itemId = item.public_id || item.url_imagen;
                    const seleccionado = seleccionAlbum.includes(itemId);
                    return (
                      <div key={itemId || i} onClick={() => toggleSeleccionAlbum(itemId)} style={{ position: "relative", borderRadius: 10, overflow: "hidden", cursor: "pointer", border: seleccionado ? "3px solid #534AB7" : "1px solid #e8e8e6" }}>
                        {item.tipo === "video" ? (
                          <video src={item.url_imagen} style={{ width: "100%", height: 120, objectFit: "cover", background: "#000" }} muted />
                        ) : (
                          <img src={item.url_imagen} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
                        )}
                        {seleccionado && (
                          <div style={{ position: "absolute", top: 6, right: 6, background: "#534AB7", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleConfirmarSeleccionAlbum} disabled={seleccionAlbum.length === 0} style={{ width: "100%", background: seleccionAlbum.length === 0 ? "#ccc" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: seleccionAlbum.length === 0 ? "not-allowed" : "pointer" }}>
                  Analizar {seleccionAlbum.length} creativo{seleccionAlbum.length !== 1 ? "s" : ""}
                </button>
              </>
            )}
          </div>
        )}

        {step === "analisis" && analisisResultado && (
          <div>
            <button onClick={() => setStep("album-selector")} style={{ marginBottom: 16, background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13 }}>
              ← Ajustar selección
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "2rem", background: "#fff", padding: "2rem", borderRadius: 16, border: "1px solid #e8e8e6", marginBottom: 20 }}>
              <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: `conic-gradient(#534AB7 ${analisisResultado.score}%, #f0f0f0 0)` }}>
                <div style={{ background: "#fff", width: 85, height: 85, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>{analisisResultado.score}%</div>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16 }}>Efectividad estimada con tus creativos</h2>
                <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
                  Estrategia original: {estrategiaSeleccionada?.efectividad}% · Recalculada con tu contenido: {analisisResultado.score}%
                </p>
              </div>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 10 }}>Detalle por creativo</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {analisisResultado.detalle.map((d, i) => (
                <div key={d.id || i} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", border: "1px solid #e8e8e6", borderRadius: 10, padding: 12 }}>
                  {d.tipo === "video" ? (
                    <video src={d.url_imagen} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", background: "#000" }} muted />
                  ) : (
                    <img src={d.url_imagen} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: d.cumple ? "#15803d" : "#b45309" }}>
                      {d.cumple ? "✅ Cumple con la estrategia" : "⚠️ No es ideal para esta estrategia"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{d.comentario}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep("creativos")} style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Continuar y editar copys →
            </button>
          </div>
        )}

        {step === "creativos" && (
          <div>
            <button
              onClick={() => !algunaRegenerando && setStep(fuenteCreativos === "album" ? "analisis" : "fuente")}
              disabled={algunaRegenerando}
              title={algunaRegenerando ? "Espera a que termine de regenerar el anuncio" : undefined}
              style={{ marginBottom: 16, background: "none", border: "none", color: algunaRegenerando ? "#bbb" : "#7F77DD", cursor: algunaRegenerando ? "not-allowed" : "pointer", fontSize: 13 }}
            >
              {fuenteCreativos === "album" ? "← Volver al análisis" : "← Cambiar fuente de creativos"}
            </button>
            {algunaRegenerando && (
              <p style={{ fontSize: 12, color: "#999", marginTop: -12, marginBottom: 16 }}>
                Espera a que termine de regenerar el anuncio antes de salir o publicar, para no perder el progreso.
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>5. Creativos de tu campaña</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {scoreParaMostrar != null && (
                  <span style={{ background: "#f3f2fe", color: "#534AB7", fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 20 }}>
                    Efectividad estimada: {scoreParaMostrar}%
                  </span>
                )}
                {fuenteCreativos === "ia" && !cargandoCreativos && creativos && creativos.length > 0 && (
                  <button
                    onClick={handleGenerarConIA}
                    style={{ background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 20, cursor: "pointer" }}
                  >
                    🔄 Regenerar todos
                  </button>
                )}
              </div>
            </div>

            {cargandoCreativos && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem" }}>
                <div className="spinner-estrategia"></div>
                <p style={{ marginTop: "1rem", color: "#534AB7", fontWeight: 600 }}>Generando creativos e imágenes...</p>
                <p style={{ marginTop: 4, color: "#999", fontSize: 12 }}>Esto puede tardar varios minutos — estamos planificando, generando y auditando cada imagen. No cierres esta pestaña.</p>
              </div>
            )}

            {!cargandoCreativos && creativos && creativos.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>No quedan creativos en esta campaña. Genera de nuevo o vuelve a elegir la fuente.</p>
            )}

            {!cargandoCreativos && creativos && creativos.length > 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                  {creativos.map((c, idx) => {
                    const regenerando = !!regenerandoIndices[idx];
                    return (
                      <div key={c.public_id || c.id || idx} style={{ background: "#fff", border: "1px solid #e8e8e6", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                        {/* Botón eliminar */}
                        <button
                          onClick={() => handleEliminarCreativo(idx)}
                          title="Quitar de esta campaña"
                          style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          ✕
                        </button>

                        {/* Imagen completa, sin recortar, con vista ampliada al hacer clic */}
                        {c.url_imagen ? (
                          c.tipo === "video" ? (
                            <video src={c.url_imagen} controls style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#f3f2fe", display: "block" }} />
                          ) : (
                            <div
                              onClick={() => setImagenAmpliada(c.url_imagen)}
                              style={{ width: "100%", background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-in", position: "relative" }}
                            >
                              <img src={c.url_imagen} alt="" style={{ width: "100%", maxHeight: 320, objectFit: "contain", opacity: regenerando ? 0.4 : 1, display: "block" }} />
                              {regenerando && (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <div className="spinner-estrategia" style={{ width: 28, height: 28, borderWidth: 3 }}></div>
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <div style={{ height: 160, background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🖼️</div>
                        )}

                        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
                          {fuenteCreativos === "album" ? (
                            <>
                              <input placeholder="Título del anuncio" value={c.titulo} onChange={(e) => actualizarCreativo(c.id, "titulo", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 13, fontWeight: 600 }} />
                              <textarea placeholder="Texto / descripción" value={c.texto} onChange={(e) => actualizarCreativo(c.id, "texto", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12, resize: "none", minHeight: 50 }} />
                              <input placeholder="Texto del botón (CTA)" value={c.cta} onChange={(e) => actualizarCreativo(c.id, "cta", e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #e0e0e0", fontSize: 12 }} />
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{c.titulo}</div>
                              <div style={{ fontSize: 12, color: "#666" }}>{c.texto}</div>
                              <span style={{ display: "inline-block", background: "#f3f2fe", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, width: "fit-content" }}>{c.cta}</span>
                              <button
                                onClick={() => handleRegenerarUno(idx)}
                                disabled={regenerando}
                                style={{ marginTop: 6, background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", fontSize: 12, fontWeight: 600, padding: "8px 10px", borderRadius: 8, cursor: regenerando ? "not-allowed" : "pointer" }}
                              >
                                {regenerando ? "Regenerando..." : "🔄 Regenerar este anuncio"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 24 }}>
                  <button onClick={handlePublicarEnMeta} disabled={publicando || publicado || algunaRegenerando} style={{ width: "100%", background: publicado ? "#10b981" : (publicando || algunaRegenerando) ? "#aaa" : "#534AB7", color: "#fff", border: "none", padding: 16, borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: (publicando || publicado || algunaRegenerando) ? "not-allowed" : "pointer" }}>
                    {publicado ? "✅ Campaña publicada en Meta" : publicando ? "📤 Publicando en Meta..." : algunaRegenerando ? "⏳ Espera a que termine la regeneración" : "📤 Publicar estrategia en Meta"}
                  </button>
                  {errorMsg && <ErrorConAccion mensaje={errorMsg} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de vista ampliada de imagen */}
      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: "2rem" }}
        >
          <img src={imagenAmpliada} alt="Vista ampliada" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}

      <style>{`
        .spinner-estrategia { border: 4px solid #f3f3f3; border-top: 4px solid #534AB7; border-radius: 50%; width: 40px; height: 40px; animation: spin-estrategia 1s linear infinite; }
        @keyframes spin-estrategia { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
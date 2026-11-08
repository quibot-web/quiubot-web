"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock } from "lucide-react";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import PanelDirectorGeneral from "@/app/components/burbuja/PanelDirectorGeneral";
import type { ContenidoMeta } from "@/app/lib/director/flujoCrearMeta";
import FormularioRapido, { type PrefillFormularioRapido } from "./FormularioRapido";

type Modo = "cargando" | "conversacion" | "formulario";

type MensajeDirector = { rol: "user" | "assistant"; mensaje: string; contenido?: ContenidoMeta | null; creado_en?: string };

// Chat único con el Director (ver app/lib/director/flujoCrearMeta.ts):
// esta página ya NO tiene su propia conversación -- es la vista en
// pantalla completa del MISMO chat que la burbuja, con la intención de
// crear una meta ya decidida de entrada (autoIniciarCrearMeta). Si ya
// hay un borrador activo (ej. el cliente venía de la burbuja), entra
// directo a ese hilo en vez de empezar de nuevo.
export default function CrearMetaPage() {
  const router = useRouter();
  const [puedeUsarAutopiloto, setPuedeUsarAutopiloto] = useState<boolean | null>(null);
  const [modo, setModo] = useState<Modo>("cargando");
  const [avisoApiKey, setAvisoApiKey] = useState(false);
  const [mensajesIniciales, setMensajesIniciales] = useState<MensajeDirector[]>([]);
  const [metaActivaId, setMetaActivaId] = useState<string | null>(null);
  const [prefillFormulario, setPrefillFormulario] = useState<PrefillFormularioRapido | undefined>(undefined);

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => setPuedeUsarAutopiloto(!!data.tieneAutopiloto))
      .catch(() => setPuedeUsarAutopiloto(false));
  }, []);

  useEffect(() => {
    if (puedeUsarAutopiloto !== true) return;

    // Entrada principal: la conversación con el Director (decisión del
    // plan) -- el formulario de siempre queda como "Prefiero llenarlo
    // yo". Si no tiene openai_key conectada, /api/director/conversacion
    // devuelve requiereApiKey:true y se abre el formulario directo con
    // el aviso, sin intentar la conversación.
    fetch("/api/director/conversacion")
      .then((r) => r.json())
      .then((data) => {
        if (data.requiereApiKey) {
          setAvisoApiKey(true);
          setModo("formulario");
          return;
        }
        setMensajesIniciales(Array.isArray(data.mensajes) ? data.mensajes : []);
        setMetaActivaId(data.metaActiva?.conversacionId ?? null);
        setModo("conversacion");
      })
      .catch(() => setModo("formulario"));
  }, [puedeUsarAutopiloto]);

  if (puedeUsarAutopiloto === null || modo === "cargando") {
    return <CargandoQuiubot mensaje="Verificando tu acceso" />;
  }

  if (puedeUsarAutopiloto === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Clock size={28} color="#534AB7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>
            Autopiloto — Próximamente
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
            Todavía estamos puliendo Autopiloto. Muy pronto lo abrimos para todos.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  if (modo === "formulario") {
    return (
      <>
        {avisoApiKey && (
          <div style={{ maxWidth: 560, margin: "28px auto 0", padding: "0 2rem" }}>
            <div style={{ background: "#F9F8FD", border: "1px solid #E4E1F7", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: "#1a1a1a" }}>Conecta tu llave de OpenAI para que el Director te guíe conversando en vez de este formulario.</span>
              <Link
                href="/?tab=integraciones"
                style={{ background: "#534AB7", color: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                Conectar mi llave de OpenAI
              </Link>
            </div>
          </div>
        )}
        <FormularioRapido
          prefill={prefillFormulario}
          onVolverAConversacion={
            !avisoApiKey
              ? () => {
                  setPrefillFormulario(undefined);
                  setModo("conversacion");
                }
              : undefined
          }
        />
      </>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#F8F8F6", display: "flex", justifyContent: "center", padding: "20px 16px" }}>
      <div style={{ maxWidth: 760, width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <PanelDirectorGeneral
          activo
          historialInicial={mensajesIniciales}
          metaActivaId={metaActivaId}
          contexto={null}
          autoenviar={null}
          onConsumidoAutoenviar={() => {}}
          onIrASoporte={() => {}}
          variante="pagina"
          autoIniciarCrearMeta
          onPreferirFormulario={(prefill) => {
            setPrefillFormulario(prefill);
            setModo("formulario");
          }}
        />
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { AlertTriangle, Lightbulb, BookOpen, Sparkles, Info } from "lucide-react";

// Logo real de Meta con respaldo: si el CDN principal falla, intenta el
// segundo antes de caer a una inicial -- mismo patrón que ya usamos en
// Integraciones, para no depender de un solo proveedor.
const FUENTES_LOGO_META = [
  "https://cdn.simpleicons.org/meta",
  "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/meta.svg",
];

function LogoMetaConRespaldo({ tamano }: { tamano: number }) {
  const [intento, setIntento] = useState(0);
  if (intento >= FUENTES_LOGO_META.length) {
    return <span style={{ fontWeight: 800, fontSize: tamano * 0.75, color: "#0064E0" }}>M</span>;
  }
  return (
    <img
      key={intento}
      src={FUENTES_LOGO_META[intento]}
      alt="Meta"
      width={tamano}
      height={tamano}
      style={{ display: "block" }}
      onError={() => setIntento((n) => n + 1)}
    />
  );
}

// Fondo suave por tipo -- mismo lenguaje visual que el resto de la app
// (círculos de color pastel detrás de un ícono, como en Integraciones).
const FONDO_POR_TIPO: Record<string, string> = {
  alerta: "#FEF2F2",
  sugerencia: "#F3F2FE",
  playbook_pendiente: "#EEF2FF",
  creativos_listos: "#F3F2FE",
  campana_publicada: "#EAF2FF",
};
const FONDO_DEFECTO = "#F3F4F6";

type Props = {
  tipo: string;
  size?: number;
};

// Reemplaza los emojis (🚨💡📘🎨ℹ️) por íconos reales consistentes con la
// marca. Los emojis se ven distinto en cada sistema operativo y le restan
// seriedad a la app; un logo real de Meta para lo que sí pasó en Meta
// genera reconocimiento inmediato ("esto sí ocurrió de verdad"), y un
// código de color consistente (rojo=atención, morado=Quiubot,
// azul=informativo) deja triage-ar sin tener que leer cada notificación.
export default function NotificacionIcono({ tipo, size = 30 }: Props) {
  const fondo = FONDO_POR_TIPO[tipo] || FONDO_DEFECTO;
  const tamanoIcono = Math.round(size * 0.52);

  let contenido: React.ReactNode;
  switch (tipo) {
    case "alerta":
      contenido = <AlertTriangle size={tamanoIcono} color="#DC2626" strokeWidth={2.2} aria-hidden="true" />;
      break;
    case "sugerencia":
      contenido = <Lightbulb size={tamanoIcono} color="#534AB7" strokeWidth={2.2} aria-hidden="true" />;
      break;
    case "playbook_pendiente":
      contenido = <BookOpen size={tamanoIcono} color="#4F46E5" strokeWidth={2.2} aria-hidden="true" />;
      break;
    case "creativos_listos":
      contenido = <Sparkles size={tamanoIcono} color="#534AB7" strokeWidth={2.2} aria-hidden="true" />;
      break;
    case "campana_publicada":
      contenido = <LogoMetaConRespaldo tamano={tamanoIcono} />;
      break;
    default:
      contenido = <Info size={tamanoIcono} color="#6B7280" strokeWidth={2.2} aria-hidden="true" />;
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: fondo,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {contenido}
    </span>
  );
}
import { AbsoluteFill, Img } from "remotion";
import type { TemaGuion } from "../tema";

// Esquina superior derecha, dentro de la zona segura (top 14%, lados 6%).
export function CapaLogo({ tema }: { tema: TemaGuion }) {
  if (!tema.logo_url) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Img
        src={tema.logo_url}
        style={{ position: "absolute", top: "16%", right: "8%", width: 70, height: 70, objectFit: "contain" }}
      />
    </AbsoluteFill>
  );
}

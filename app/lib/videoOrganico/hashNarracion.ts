import "server-only";
import { createHash } from "crypto";

// Fase B v2.0 (docs/diseno/plan_contenido_organico_fase_b_v2.md,
// punto 4). Si cualquier narracion cambia, voz_url/tiemposRender ya
// generados quedan desactualizados -- este hash se guarda junto a
// ellos (dentro del jsonb de guion, no una columna nueva: ya era el
// plan persistir tiemposRender ahí mismo) para que el código, antes
// de cualquier render, pueda comparar el texto narrado ACTUAL contra
// el que se usó la última vez que se llamó a generarVoz().
export function calcularHashNarracion(escenas: { narracion?: string }[]): string {
  const textoCompleto = escenas.map((e) => e.narracion ?? "").join("\n");
  return createHash("sha256").update(textoCompleto).digest("hex");
}

export function vozDesactualizada(hashGuardado: string | null | undefined, escenas: { narracion?: string }[]): boolean {
  return hashGuardado !== calcularHashNarracion(escenas);
}

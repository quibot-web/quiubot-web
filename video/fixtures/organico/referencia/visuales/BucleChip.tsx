// Chip "1/3, 2/3, 3/3" persistente (pedido explícito: "el contador se
// mantiene como bucle"). Mismo estilo visual que capas/Bucle.tsx (la
// capa real que ya existe para esto en producción) -- no se importa
// directo de ahí porque esa capa calcula sus cuadros a partir de un
// Guion completo (bucle.abre_en/cierra_en sobre guion.escenas), y este
// reel no pasa por el sistema Guion. El look (píldora negra, texto
// amarillo, misma posición) sí se copia tal cual para que, cuando esto
// se generalice en la Fase B, el usuario ya esté viendo el mismo
// lenguaje visual que usa el resto de los reels.
export function BucleChip({ paso, total }: { paso: number; total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "4%",
        left: "6%",
        background: "#111111",
        color: "#FFD43B",
        borderRadius: 999,
        padding: "8px 22px",
        fontSize: 32,
        fontWeight: 800,
      }}
    >
      {paso}/{total}
    </div>
  );
}

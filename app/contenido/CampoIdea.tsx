"use client";
import { LIMITE_IDEA, clasificarIdea } from "@/app/lib/ideaUsuario";

// "Tu idea para el video" (24 nov 2026): un tema corto o la idea completa
// del usuario (puntos, ejemplo propio, frase de cierre); el reel la sigue.
const PLACEHOLDER = `Un tema corto: "cómo elegir la talla correcta"

O tu idea completa, por ejemplo:
Mucha gente compra la talla equivocada por internet.
1. Mide tu prenda favorita, no tu cuerpo.
2. Compara con nuestra tabla de tallas.
3. Si quedas entre dos, elige la más grande.
Ejemplo: a Laura le pasó con un jean y ahora siempre mide primero.
Cierre: "Escríbenos tus medidas y te decimos tu talla."`;

// ayuda: reemplaza el texto de abajo (p. ej. en Historia narrada, donde no hay puntos ni series).
export default function CampoIdea({ valor, onCambio, onBlur, deshabilitado, ayuda, etiqueta }: { valor: string; onCambio: (v: string) => void; onBlur?: () => void; deshabilitado?: boolean; ayuda?: string; etiqueta?: string }) {
  const tipo = clasificarIdea(valor);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>{etiqueta ?? "Tu idea para el video (opcional)"}</label>
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value.slice(0, LIMITE_IDEA))}
        onBlur={onBlur}
        maxLength={LIMITE_IDEA}
        rows={7}
        placeholder={PLACEHOLDER}
        disabled={deshabilitado}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.45 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#777", marginTop: 4 }}>
        <span>
          {ayuda ?? (tipo === "idea"
            ? "El reel va a seguir tus puntos, en tu orden, con tus ejemplos y datos. Si no cabe en un reel, te proponemos una serie."
            : tipo === "tema"
              ? "Tema corto: el reel desarrolla los consejos."
              : "Sin idea: el reel elige un tema de tu negocio.")}
        </span>
        <span style={{ color: valor.length > LIMITE_IDEA * 0.9 ? "#b45309" : "#777", whiteSpace: "nowrap", marginLeft: 8 }}>
          {valor.length} / {LIMITE_IDEA}
        </span>
      </div>
    </div>
  );
}

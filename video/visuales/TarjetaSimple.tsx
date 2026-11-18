import type { ReactNode } from "react";
import { TARJETA_ANCHO_PORCENTAJE } from "./geometria";

// Bug real encontrado comparando cuadro a cuadro con
// organico-referencia-consejos-numerados (16 nov 2026, revisión de
// staging): CelularChat tiene su propia tarjeta (el mockup de
// celular), pero boton_estado/cursor_clic/contador no tenían NINGUNA
// -- quedaban como elementos sueltos flotando sobre el degradado,
// nunca tan grandes como el molde (que siempre mete el elemento
// principal DENTRO de una tarjeta que ocupa el ancho real, 70-85%,
// video/visuales/geometria.ts). Esta tarjeta genérica (fondo blanco,
// mismo lenguaje que el mockup de CelularChat) es lo que les faltaba.
// sinFondo (estilo Noche): mismo ancho -- BotonEstado calcula su tamaño
// contra este ancho -- pero sin la tarjeta blanca: el botón va directo
// sobre el fondo oscuro.
export function TarjetaSimple({ children, sinFondo = false }: { children: ReactNode; sinFondo?: boolean }) {
  return (
    <div
      style={{
        width: `${TARJETA_ANCHO_PORCENTAJE}%`,
        height: "92%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: sinFondo ? "transparent" : "#fff",
        borderRadius: 36,
        boxShadow: sinFondo ? "none" : "0 30px 80px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}

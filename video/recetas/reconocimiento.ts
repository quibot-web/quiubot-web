import type { RecetaObjetivo } from "./tipos";

// Botón real: LEARN_MORE (anexo_reglas_copy_y_cta.md). Menos venta, más
// valor y recordación -- la marca está presente todo el tiempo, no como
// intro.
export const recetaReconocimiento: RecetaObjetivo = {
  objetivoId: "reconocimiento",
  enfoque:
    "Valor y recordación, no venta: un consejo útil, un dato curioso o una emoción ligada a la marca. Nada de precios ni \"compra ya\".",
  duracionMinS: 6,
  duracionMaxS: 15,
  bloques: ["gancho", "valor", "marca", "cta"],
  bucleTipico:
    "\"Dato que no sabías...\" que se resuelve en el bloque de valor -- usa lista_numerada ahí para poder cerrar el bucle en \"contador\" (1/3, 2/3, 3/3).",
  indicadorBucle: "contador",
  accionCta: "suave",
  textoCtaSugerido: "Conócenos",
  requiereUsuarioEnCta: false,
  requiereRevelacionMarca: true,
};

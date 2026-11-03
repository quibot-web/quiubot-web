import type { RecetaObjetivo } from "./tipos";

// El botón real depende del texto del CTA (formulario instantáneo de
// Meta) -- ver anexo_reglas_copy_y_cta.md. El video siempre pide
// "formulario" como accion.
export const recetaLeads: RecetaObjetivo = {
  objetivoId: "leads",
  enfoque: "Valor a cambio de datos: lo que recibe la persona al dejar sus datos. Usa las reglas COPY QUE VENDE.",
  duracionMinS: 12,
  duracionMaxS: 20,
  bloques: ["gancho", "problema", "valor", "beneficio", "cta"],
  bucleTipico: "Promesa (\"te digo cuánto cuesta...\") que se cumple al llenar el formulario -- el bucle se cierra en el cta.",
  indicadorBucle: "espera_final",
  accionCta: "formulario",
  textoCtaSugerido: "Pide tu cotización gratis",
  requiereUsuarioEnCta: false,
};

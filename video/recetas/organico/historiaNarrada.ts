import type { RecetaOrganica } from "./tipos";

// Historia narrada (visuales-v2, 24 nov 2026): la IA sigue el texto del
// usuario frase por frase, en su orden, y solo lo adapta a voz (frases
// cortas, gancho, duración). Cada frase se ilustra con el kit o las
// escenas del reel ilustrado. Si termina en una pregunta con dos
// opciones, el cierre es un cartel con A y B y la invitación a comentar.
// Una escena por frase (de 3 a 7): los bloques son gancho, valor (las
// frases del medio) y cta (la última).
export const recetaHistoriaNarrada: RecetaOrganica = {
  recetaId: "historia_narrada",
  enfoque: "El relato del usuario, frase por frase, narrado e ilustrado.",
  duracionMinS: 10,
  duracionMaxS: 30,
  bloques: ["gancho", "valor", "valor", "valor", "valor", "valor", "cta"],
  bucleTipico: "El gancho abre la historia; la pregunta final la deja abierta para comentar.",
  indicadorBucle: "espera_final",
  accionCta: "comentar",
  textoCtaSugerido: "Comenta A o B",
  requiereUsuarioEnCta: false,
};

// Errores de la cuenta de OpenAI del cliente (BYOK), con un aviso claro y
// el mismo en todas las rutas de /contenido (lanzamiento 30 nov 2026).
// Antes cada ruta tenía su propia expresión, y una se escapaba: cuando la
// voz (TTS) se quedaba sin créditos, generarVoz lanzaba el mensaje ya en
// español y la ruta del guion, que buscaba "insufficient_quota", mostraba
// el error genérico.

export const MENSAJE_OPENAI_SIN_CREDITOS = "Tu cuenta de OpenAI no tiene créditos. Agrega saldo en platform.openai.com y vuelve a intentar.";
export const MENSAJE_OPENAI_LLAVE_INVALIDA = "Tu llave de OpenAI no es válida o fue revocada. Revísala en Integraciones y vuelve a intentar.";

export type ErrorOpenAI = { codigo: "openai_sin_creditos" | "openai_llave_invalida"; mensaje: string };

const SIN_CREDITOS = /insufficient_quota|credit_balance_exhausted|billing_hard_limit_reached|exceeded your current quota|no tiene créditos/i;
const LLAVE_INVALIDA = /invalid_api_key|incorrect api key|Error de OpenAI \(401\)|account_deactivated/i;

// detalle: el texto del error (mensaje de una excepción o cuerpo de la respuesta de OpenAI).
export function errorDeOpenAI(detalle: unknown): ErrorOpenAI | null {
  const texto = detalle instanceof Error ? detalle.message : String(detalle ?? "");
  if (SIN_CREDITOS.test(texto)) return { codigo: "openai_sin_creditos", mensaje: MENSAJE_OPENAI_SIN_CREDITOS };
  if (LLAVE_INVALIDA.test(texto)) return { codigo: "openai_llave_invalida", mensaje: MENSAJE_OPENAI_LLAVE_INVALIDA };
  return null;
}

// Cuerpo y estado HTTP para responder al cliente (402: tiene que pagar o
// arreglar algo en SU cuenta de OpenAI, no es una falla de Quiubot).
export function respuestaErrorOpenAI(e: ErrorOpenAI): { cuerpo: { error: string; codigo: string }; status: number } {
  return { cuerpo: { error: e.mensaje, codigo: e.codigo }, status: 402 };
}

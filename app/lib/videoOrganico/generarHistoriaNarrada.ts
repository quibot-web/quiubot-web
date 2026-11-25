import "server-only";
// "Historia narrada" (visuales-v2, 24 nov 2026): el texto del usuario,
// frase por frase, con voz e ilustrado con el kit. La IA solo adapta el
// texto a voz (app/lib/historiaNarrada.ts lo revisa); el código arma el
// guion, la IA ilustra la historia (plan ilustrado) y el código pone el
// cartel de opciones si termina en "A o B". Sin plan ilustrado válido no
// hay reel: este formato es solo para cuentas de REELS_ILUSTRADOS_EMAILS.
import { construirPromptHistoria, frasesDeLasOpciones, frasesDelCartel, iconoDeFrase, guionDesdeHistoria, leerRespuestaHistoria, problemasDeLaHistoria } from "@/app/lib/historiaNarrada";
import { GuionSchema, type Guion } from "@/video/guion.schema";
import { seccionNegocio } from "@/video/promptGuionOrganico";
import { limpiarHashtags } from "@/video/arreglosAutomaticosGuion";
import { asignarEstilo, elegirEstilo, estilosDisponibles } from "@/video/estilos/estilos";
import type { PlanIlustrado } from "@/video/ilustrado/motor/plan";
import { escenarioDeNarracion } from "@/video/ilustrado/motor/validarPlan";
import { erroresDatosDelGuion } from "./datosReales";
import { ajustarConVozReal, generarPlanIlustrado } from "./generarPlanIlustrado";
import { llamarOpenAI, regenerarVozParaGuion, type ParametrosGenerarGuionConVoz, type ResultadoGenerarGuionConVoz } from "./generarGuionConVoz";

export async function generarHistoriaNarrada(params: ParametrosGenerarGuionConVoz): Promise<ResultadoGenerarGuionConVoz> {
  const texto = params.entrada.tema?.trim() ?? "";
  if (!texto) return { ok: false, status: 400, error: 'Escribe tu historia en "Tu idea para el video": este formato la narra frase por frase.' };
  const llamar = (prompt: string) => llamarOpenAI(params.apiKeyUsuario, prompt);
  const negocio = seccionNegocio(params.entrada.infoAdicionalMarca, params.entrada.productos);
  const maxReintentos = params.maxReintentos ?? 2;

  // 1. La IA adapta el texto a voz; el código revisa que lo siguió.
  async function intentar(erroresPrevios?: string[]): Promise<{ ok: true; guion: Guion; preguntaEn: number | null; opciones: { a: string; b: string } | null } | { ok: false; errores: string[] }> {
    let crudo: unknown;
    try {
      crudo = JSON.parse(await llamar(construirPromptHistoria(texto, negocio, erroresPrevios)));
    } catch {
      return { ok: false, errores: ["La respuesta no fue un JSON válido."] };
    }
    const leida = leerRespuestaHistoria(crudo);
    if (!leida.ok) return leida;
    const problemas = problemasDeLaHistoria(texto, leida.r);
    if (problemas.length) return { ok: false, errores: problemas };
    const candidato = guionDesdeHistoria(leida.r, { tema: params.tema, ganchoTipo: params.entrada.ganchoTipoAsignado, pistaId: params.pistaIdElegida, hashtags: limpiarHashtags(leida.r.hashtags) });
    const parseado = GuionSchema.safeParse(candidato);
    if (!parseado.success) return { ok: false, errores: parseado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    // Datos del usuario permitidos; nada inventado.
    const inventados = erroresDatosDelGuion(parseado.data, params.entrada);
    if (inventados.length) return { ok: false, errores: inventados };
    const o = leida.r.opciones;
    return { ok: true, guion: parseado.data, preguntaEn: o ? o.pregunta_en : null, opciones: o ? { a: o.a, b: o.b } : null };
  }
  let r = await intentar(params.erroresPrevios);
  let intentosGuion = 1;
  for (; !r.ok && intentosGuion <= maxReintentos; intentosGuion++) r = await intentar(r.errores);
  if (!r.ok) return { ok: false, status: 502, error: "No se pudo adaptar tu historia a voz después de varios intentos.", resumenErrores: r.errores };
  const { guion, preguntaEn, opciones } = r;

  // 2. Lo que se ve: la IA ilustra la historia (sin la pregunta final, que
  // es el cartel). Antes de pagar la voz.
  const narraciones = guion.escenas.map((e) => ({ id: e.id, narracion: e.narracion ?? "" }));
  const historia = preguntaEn === null ? narraciones : narraciones.slice(0, preguntaEn);
  const p = await generarPlanIlustrado(historia, params.llamarIAPlan ?? llamar, 3, { conKit: true, historial: params.historialVisual ?? [], opcionesDeHistoria: frasesDeLasOpciones(historia) });
  if (!p.ok) return { ok: false, status: 502, error: "No se pudo ilustrar tu historia después de varios intentos.", resumenErrores: p.errores };
  // El escenario sale de TODA la historia (también de la pregunta final).
  const escenario = escenarioDeNarracion(narraciones);
  const conEscenario: PlanIlustrado = { ...p.plan, ...(escenario ? { escenario } : {}) };
  // Cada opción del cartel con la miniatura de la escena que la ilustró.
  const deOpciones = frasesDeLasOpciones(historia);
  const iconos = deOpciones ? { iconoA: iconoDeFrase(p.plan, deOpciones.a), iconoB: iconoDeFrase(p.plan, deOpciones.b) } : {};
  const plan: PlanIlustrado = preguntaEn === null || !opciones ? conEscenario : { ...conEscenario, frases: [...conEscenario.frases, ...frasesDelCartel(narraciones, preguntaEn)], opciones: { ...opciones, ...iconos } };

  // 3. La voz (con su control de voz incompleta) y los tiempos.
  const voz = await regenerarVozParaGuion(guion.escenas, { openaiKey: params.apiKeyUsuario, voz: params.voz, cloudinary: params.cloudinary }, "historia_narrada");
  if (!voz.ok) return voz;
  const ajuste = voz.campos.palabrasPorEscena ? ajustarConVozReal(plan, voz.campos.palabrasPorEscena) : { plan, ajustes: [] };
  const guionFinal: Guion = {
    ...guion,
    ...voz.campos,
    // Respaldo sin ilustración (si el render ilustrado fallara): un estilo de siempre.
    estilo: asignarEstilo(guion.escenas, elegirEstilo(params.historialEstilos ?? [], estilosDisponibles(false)), { fotosSinTexto: [] }),
    ilustrado: ajuste.plan,
  };
  return { ok: true, guion: guionFinal, puntajeAlineacion: voz.puntajeAlineacion, intentosGuion, crudo: voz.crudo, planIlustrado: { estado: "generado", intentos: p.intentos, ajustes: [...p.ajustes, ...ajuste.ajustes], historial: p.historial } };
}

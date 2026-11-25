import type { RecetaOrganicaId } from "../../guion.schema";
import type { RecetaOrganica } from "./tipos";
import { recetaConsejosNumerados } from "./consejosNumerados";
import { recetaMitoVerdad } from "./mitoVerdad";
import { recetaProductoEnUso } from "./productoEnUso";
import { recetaSeriePartes } from "./seriePartes";
import { recetaPreguntaComunidad } from "./preguntaComunidad";
import { recetaDetrasDeMarca } from "./detrasDeMarca";
import { recetaHistoriaNarrada } from "./historiaNarrada";

export const RECETAS_ORGANICAS: Record<RecetaOrganicaId, RecetaOrganica> = {
  consejos_numerados: recetaConsejosNumerados,
  mito_verdad: recetaMitoVerdad,
  producto_en_uso: recetaProductoEnUso,
  serie_partes: recetaSeriePartes,
  pregunta_comunidad: recetaPreguntaComunidad,
  detras_de_marca: recetaDetrasDeMarca,
  historia_narrada: recetaHistoriaNarrada,
};

export function recetaOrganicaDe(recetaId: RecetaOrganicaId): RecetaOrganica {
  return RECETAS_ORGANICAS[recetaId];
}

export type { RecetaOrganica } from "./tipos";
export { validarContraRecetaOrganica } from "./tipos";

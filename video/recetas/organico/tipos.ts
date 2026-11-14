import type { AccionCta, BloqueGuion, Guion, RecetaOrganicaId } from "../../guion.schema";
import { validarOrdenBloques } from "../tipos";

// Mismo shape que RecetaObjetivo (video/recetas/tipos.ts), sin lo que
// solo tiene sentido para anuncios (ganchoUsaProductoDeFondo existe acá
// también -- producto_en_uso sí lo necesita -- pero no hay mapeo a
// botón de Meta: el contenido orgánico nunca publica un anuncio).
export interface RecetaOrganica {
  recetaId: RecetaOrganicaId;
  enfoque: string;
  duracionMinS: number;
  duracionMaxS: number;
  bloques: BloqueGuion[];
  bucleTipico: string;
  indicadorBucle: "contador" | "espera_final" | "ninguno";
  accionCta: AccionCta;
  textoCtaSugerido: string;
  requiereUsuarioEnCta: boolean;
  requiereRevelacionMarca?: boolean;
  permiteObjecionRespuesta?: boolean;
  ganchoUsaProductoDeFondo?: boolean;
}

// Validaciones que dependen de la receta orgánica -- mismo rol que
// validarContraReceta (recetas/tipos.ts) para anuncios, pero sin nada
// de CTA-de-Meta (acá no hay botón de anuncio que coincidir). Reusa
// validarOrdenBloques tal cual: es genérica por bloques, no sabe nada de
// objetivos ni de recetas orgánicas.
export function validarContraRecetaOrganica(guion: Guion, receta: RecetaOrganica, huboMediaElegida: boolean): string[] {
  const errores: string[] = [];

  if (guion.uso !== "organico") {
    errores.push(`Se está validando contra una receta orgánica, pero el guion tiene uso "${guion.uso}".`);
  }
  if (guion.receta_organica !== receta.recetaId) {
    errores.push(`El guion es para "${guion.receta_organica}" pero se está validando contra la receta de "${receta.recetaId}".`);
  }

  if (guion.duracion_objetivo_s < receta.duracionMinS || guion.duracion_objetivo_s > receta.duracionMaxS) {
    errores.push(
      `duracion_objetivo_s (${guion.duracion_objetivo_s}s) debe estar entre ${receta.duracionMinS}s y ${receta.duracionMaxS}s para esta receta.`
    );
  }

  const bloquesUsados = guion.escenas.map((e) => e.bloque);
  const errorOrden = validarOrdenBloques(bloquesUsados, receta.bloques);
  if (errorOrden) errores.push(errorOrden);

  const ultimaEscena = guion.escenas[guion.escenas.length - 1];
  if (ultimaEscena.tipo === "cta" && ultimaEscena.params.accion !== receta.accionCta) {
    errores.push(`El CTA debe ser "${receta.accionCta}" para esta receta, no "${ultimaEscena.params.accion}".`);
  }
  if (ultimaEscena.tipo === "cta") {
    const tieneUsuario = !!ultimaEscena.params.usuario;
    if (receta.requiereUsuarioEnCta && !tieneUsuario) {
      errores.push(`El CTA de "${receta.recetaId}" debe incluir el @usuario (su botón real necesita a qué cuenta apunta).`);
    }
    if (!receta.requiereUsuarioEnCta && tieneUsuario) {
      errores.push(`El CTA de "${receta.recetaId}" no debe incluir @usuario (su botón real no apunta a un perfil).`);
    }
  }

  if (receta.requiereRevelacionMarca && !guion.escenas.some((e) => e.tipo === "revelacion_marca")) {
    errores.push("Esta receta exige una escena revelacion_marca.");
  }

  if (!receta.permiteObjecionRespuesta && guion.escenas.some((e) => e.tipo === "objecion_respuesta")) {
    errores.push("objecion_respuesta solo se acepta en la receta mito_verdad.");
  }

  if (receta.ganchoUsaProductoDeFondo && huboMediaElegida && !guion.escenas.some((e) => e.tipo === "producto_hero")) {
    errores.push("Esta receta exige al menos una escena producto_hero cuando se eligió una pieza del álbum.");
  }

  return errores;
}

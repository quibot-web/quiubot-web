import type { AccionCta, BloqueGuion, Guion, ObjetivoVideo } from "../guion.schema";

export interface RecetaObjetivo {
  objetivoId: ObjetivoVideo;
  enfoque: string;
  duracionMinS: number;
  duracionMaxS: number;
  // Orden permitido de bloques (puede saltarse los opcionales, pero no
  // reordenarlos ni usar uno que no esté aquí). "cta" siempre al final.
  bloques: BloqueGuion[];
  bucleTipico: string;
  indicadorBucle: "contador" | "espera_final" | "ninguno";
  accionCta: AccionCta;
  // Texto de botón sugerido para el prompt de la IA -- dos recetas pueden
  // compartir objeto (seguidores.ts, traficoYVisitasWeb.ts) pero el texto
  // del CTA sigue siendo específico por id real (ver anexo_reglas_copy_y_cta.md).
  textoCtaSugerido: string;
  // true solo para seguidores_instagram: su botón real (VIEW_INSTAGRAM_PROFILE)
  // va con @usuario; seguidores_facebook (LIKE_PAGE) nunca lo lleva.
  requiereUsuarioEnCta: boolean;
  requiereRevelacionMarca?: boolean;
  permiteObjecionRespuesta?: boolean;
}

// ¿Los bloques usados en el guion respetan el orden de la receta? Se
// permite saltarse bloques opcionales, pero no reordenarlos ni usar uno
// que la receta no contempla -- es una subsecuencia de receta.bloques.
export function validarOrdenBloques(bloquesUsados: BloqueGuion[], bloquesReceta: BloqueGuion[]): string | null {
  let cursor = 0;
  for (const b of bloquesUsados) {
    const idx = bloquesReceta.indexOf(b, cursor);
    if (idx === -1) {
      return `El bloque "${b}" no está permitido o está fuera de orden para este objetivo. Orden esperado: ${bloquesReceta.join(" -> ")}.`;
    }
    cursor = idx + 1;
  }
  return null;
}

// Validaciones que dependen del objetivo (sección 3B y 4 del plan) --
// complementan a GuionSchema (guion.schema.ts), que solo valida la forma
// del guion sin conocer la receta. huboMediaElegida indica si el admin
// eligió piezas del álbum en el paso 1 del formulario (/video).
export function validarContraReceta(guion: Guion, receta: RecetaObjetivo, huboMediaElegida: boolean): string[] {
  const errores: string[] = [];

  if (guion.objetivo !== receta.objetivoId) {
    errores.push(`El guion es para "${guion.objetivo}" pero se está validando contra la receta de "${receta.objetivoId}".`);
  }

  if (guion.duracion_objetivo_s < receta.duracionMinS || guion.duracion_objetivo_s > receta.duracionMaxS) {
    errores.push(
      `duracion_objetivo_s (${guion.duracion_objetivo_s}s) debe estar entre ${receta.duracionMinS}s y ${receta.duracionMaxS}s para este objetivo.`
    );
  }

  const bloquesUsados = guion.escenas.map((e) => e.bloque);
  const errorOrden = validarOrdenBloques(bloquesUsados, receta.bloques);
  if (errorOrden) errores.push(errorOrden);

  const ultimaEscena = guion.escenas[guion.escenas.length - 1];
  if (ultimaEscena.tipo === "cta" && ultimaEscena.params.accion !== receta.accionCta) {
    errores.push(`El CTA debe ser "${receta.accionCta}" para este objetivo, no "${ultimaEscena.params.accion}".`);
  }
  if (ultimaEscena.tipo === "cta") {
    const tieneUsuario = !!ultimaEscena.params.usuario;
    if (receta.requiereUsuarioEnCta && !tieneUsuario) {
      errores.push(`El CTA de "${receta.objetivoId}" debe incluir el @usuario (su botón real necesita a qué cuenta apunta).`);
    }
    if (!receta.requiereUsuarioEnCta && tieneUsuario) {
      errores.push(`El CTA de "${receta.objetivoId}" no debe incluir @usuario (su botón real no apunta a un perfil).`);
    }
  }

  if (receta.requiereRevelacionMarca && !guion.escenas.some((e) => e.tipo === "revelacion_marca")) {
    errores.push("Este objetivo exige una escena revelacion_marca.");
  }

  if (!receta.permiteObjecionRespuesta && guion.escenas.some((e) => e.tipo === "objecion_respuesta")) {
    errores.push("objecion_respuesta solo se acepta en el objetivo de volver a impactar (retargeting).");
  }

  const esVentaOImpacto = guion.objetivo === "venta_directa_whatsapp" || guion.objetivo === "venta_directa_web" || guion.objetivo === "retargeting";
  if (esVentaOImpacto && huboMediaElegida && !guion.escenas.some((e) => e.tipo === "producto_hero")) {
    errores.push("Este objetivo exige al menos una escena producto_hero cuando el admin eligió piezas del álbum.");
  }

  return errores;
}

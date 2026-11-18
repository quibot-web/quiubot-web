// Caso real que motivó esto (18 nov 2026): GuionSchema no puede exigir
// narracion/visual para TODO uso "organico" sin romper retroactivamente
// las 6 recetas ya en producción (ninguna los trae todavía) -- por eso
// esta validación vive aparte, y estas pruebas confirman las 2 cosas:
// que GuionSchema sigue aceptando guiones orgánicos sin estos campos
// (fixtures reales, probado en video/arreglosAutomaticosGuion.test.ts
// y app/api/contenido/[id]/route.test.ts), y que esta función nueva sí
// los exige cuando se usa a propósito.
import { describe, it, expect } from "vitest";
import { GuionSchema, type Guion } from "../guion.schema";
import { validarEdicionDesdeAudio, validarEstructuraConsejosNumeradosAudio } from "./validarEdicionDesdeAudio";

function escenaBase(id: string, overrides: Partial<Guion["escenas"][number]> = {}): Guion["escenas"][number] {
  return {
    id,
    bloque: "valor",
    tipo: "cta",
    duracion_s: 3,
    params: { accion: "seguir", texto_boton: "Seguir" },
    ...overrides,
  } as Guion["escenas"][number];
}

describe("validarEdicionDesdeAudio", () => {
  it("sin narracion, reporta el hallazgo con el id de la escena", () => {
    const hallazgos = validarEdicionDesdeAudio([escenaBase("e1")]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]).toMatchObject({ escenaId: "e1" });
    expect(hallazgos[0].mensaje).toContain("Falta narracion");
  });

  it("con narracion pero sin visual, reporta el hallazgo correcto", () => {
    const hallazgos = validarEdicionDesdeAudio([escenaBase("e1", { narracion: "Hola a todos hoy" })]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("Falta visual");
  });

  it("evento.palabra dentro del rango real de la narracion: sin hallazgos", () => {
    const escena = escenaBase("e1", {
      narracion: "Hola a todos hoy", // 4 palabras, índices 0-3
      visual: { tipo: "contador", desde: 0, hasta: 3, etiqueta: "mensajes nuevos", eventos: [{ palabra: 0, accion: "sube" }, { palabra: 3, accion: "sube" }] },
    });
    expect(validarEdicionDesdeAudio([escena])).toHaveLength(0);
  });

  it("evento.palabra fuera de rango (índice 5 en una narracion de 4 palabras): hallazgo con el mensaje exacto", () => {
    const escena = escenaBase("e1", {
      narracion: "Hola a todos hoy",
      visual: { tipo: "contador", desde: 0, hasta: 3, etiqueta: "mensajes nuevos", eventos: [{ palabra: 5, accion: "sube" }] },
    });
    const hallazgos = validarEdicionDesdeAudio([escena]);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("palabra 5");
    expect(hallazgos[0].mensaje).toContain("4 palabra(s)");
  });

  it("GuionSchema sigue aceptando un guion orgánico real SIN narracion/visual (compatibilidad con las 6 recetas existentes)", () => {
    const guion = GuionSchema.parse({
      version: 1,
      formato: "9x16",
      fps: 30,
      uso: "organico",
      receta_organica: "consejos_numerados",
      gancho_tipo: "pregunta",
      duracion_objetivo_s: 16,
      bucle: { texto: "3 consejos", abre_en: "e1", cierra_en: "e2", indicador: "contador" },
      tema: { color_primario: "#534AB7", color_secundario: "#7F77DD", fuente: "moderna", logo_url: null, nombre_marca: "Quiubot" },
      musica: { pista_id: null, volumen: 0.35 },
      publicacion: { caption: "Caption de prueba", hashtags: ["#tip", "#consejos", "#negocio"] },
      escenas: [
        { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.2, params: { texto: "¿Sabías esto?", palabra_clave: "esto" } },
        { id: "e2", bloque: "valor", tipo: "lista_numerada", duracion_s: 5, params: { titulo: "3 tips", items: ["uno", "dos", "tres"] } },
        { id: "e3", bloque: "marca", tipo: "revelacion_marca", duracion_s: 4, params: { frase: "Quiubot", mostrar_logo: true } },
        { id: "e4", bloque: "cta", tipo: "cta", duracion_s: 4, params: { accion: "seguir", texto_boton: "Seguir" } },
      ],
    });
    // Y por lo tanto esta misma lista de escenas SÍ dispara hallazgos
    // si se le pide validarEdicionDesdeAudio() a propósito.
    expect(validarEdicionDesdeAudio(guion.escenas).length).toBeGreaterThan(0);
  });
});

// Caso real (16 nov 2026, revisión de staging): la IA metió los 3
// consejos en una sola escena "valor" con un visual "contador" en vez
// de una escena por consejo -- decir, no mostrar.
function escenaConAudio(id: string, bloque: Guion["escenas"][number]["bloque"], narracion: string, visual: Guion["escenas"][number]["visual"]): Guion["escenas"][number] {
  return escenaBase(id, { bloque, narracion, visual });
}

// Ronda J: el gancho se queda CONGELADO en 0 -- eventos vacío, nunca
// "numero_sube"/"notificacion_llega" (esos cuentan la resolución, que
// es de la escena "marca", nunca del gancho).
const GANCHO_OK = escenaConAudio("e1", "gancho", "¿Sabes por qué pierdes clientes sin darte cuenta?", {
  tipo: "celular_chat",
  eventos: [],
});
// Los 3 consejos usan los 3 tipos de 2 estados (problema->arreglo) --
// pedido explícito (3ra revisión de staging): boton_estado/cursor_clic
// ya NO valen para escenas "valor" (son de 1 estado, no muestran un
// antes real). El evento cae pasado el 30% de la narracion (regla
// nueva: "el cambio de estado está amarrado a la palabra donde se da
// la solución", nunca en las primeras palabras).
const VALOR_1_OK = escenaConAudio("e2", "valor", "Responde cada mensaje en menos de un minuto.", {
  tipo: "anuncio_boton",
  eventos: [{ palabra: 4, accion: "cambia_estado" }],
});
const VALOR_2_OK = escenaConAudio("e3", "valor", "Usa fotos reales de tu negocio, no imágenes genéricas.", {
  tipo: "conexion_whatsapp",
  eventos: [{ palabra: 5, accion: "cambia_estado" }],
});
const VALOR_3_OK = escenaConAudio("e4", "valor", "Revisa el avance de tu negocio todos los días.", {
  tipo: "contador",
  desde: 0,
  hasta: 3,
  etiqueta: "días revisados",
  eventos: [{ palabra: 5, accion: "sube" }],
});
const MARCA_OK = escenaConAudio("e5", "marca", "Así ganas la confianza de quien te escribe.", {
  tipo: "celular_chat",
  eventos: [{ palabra: 0, accion: "notificacion_llega" }, { palabra: 4, accion: "numero_sube" }],
});
// Ronda M -- caso real que motivó la regla: el clic cayendo en la
// última palabra dejaba "Siguiendo ✓" sin tiempo visible. 6 palabras
// (índices 0-5); palabra 2 es <= la mitad (3), deja la mitad de la
// escena para ver el cambio.
const CTA_OK = escenaConAudio("e6", "cta", "Síguenos para más consejos como este.", {
  tipo: "boton_estado",
  texto: "Seguir",
  texto_activo: "Siguiendo",
  eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 2, accion: "clic" }],
});

describe("textos de botón sin glifos fuera de las fuentes", () => {
  it("un chulo de texto en el botón de la CTA: hallazgo; sin él, limpio", () => {
    const conChulo = escenaConAudio("e6", "cta", "Síguenos para más consejos como este.", {
      tipo: "cursor_clic",
      texto_boton: "Listo \u2713",
      eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 2, accion: "clic" }],
    });
    expect(validarEdicionDesdeAudio([conChulo]).some((h) => h.mensaje.includes("no se puede dibujar"))).toBe(true);
    const limpio = { ...conChulo, visual: { ...conChulo.visual!, texto_boton: "Seguir" } } as typeof conChulo;
    expect(validarEdicionDesdeAudio([limpio])).toHaveLength(0);
  });
});

describe("validarEstructuraConsejosNumeradosAudio", () => {
  it("la estructura aprobada (gancho + 3 valor + marca + cta, gancho/marca en celular_chat) no dispara hallazgos", () => {
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    expect(validarEstructuraConsejosNumeradosAudio(escenas)).toHaveLength(0);
  });

  it("parte 2c: los visuales nuevos (comparacion, icono_palabra) también valen para un consejo, con textos del tema", () => {
    const comparacion = escenaConAudio("e2", "valor", "Saca la foto junto a una ventana, nunca con flash.", {
      tipo: "comparacion",
      texto_mal: "Foto con flash y fondo desordenado",
      texto_bien: "Luz de ventana y fondo liso",
      eventos: [{ palabra: 5, accion: "cambia_estado" }],
    });
    const iconoPalabra = escenaConAudio("e3", "valor", "Muestra el producto en uso, no solo sobre la mesa.", {
      tipo: "icono_palabra",
      icono_antes: "📦",
      palabra_antes: "Quieto",
      icono_despues: "🙌",
      palabra_despues: "En uso",
      eventos: [{ palabra: 4, accion: "cambia_estado" }],
    });
    const respuesta = escenaConAudio("e4", "valor", "Responde con el precio apenas te pregunten por una foto.", {
      tipo: "respuesta_lenta",
      pregunta_cliente: "¿Cuánto vale la taza azul?",
      respuesta: "Vale $45.000, ¡te la envío hoy!",
      confirmacion: "¡Me la llevo!",
      eventos: [{ palabra: 5, accion: "cambia_estado" }],
    });
    expect(validarEstructuraConsejosNumeradosAudio([GANCHO_OK, comparacion, iconoPalabra, respuesta, MARCA_OK, CTA_OK])).toHaveLength(0);
  });

  it("caso real: los 3 consejos metidos en una sola escena 'valor' con un contador -- hallazgo de estructura, no de contenido", () => {
    const escenaMergeada = escenaConAudio(
      "e2",
      "valor",
      "Uno: elige mensajes. Dos: usa fotos reales. Tres: pide escribirte por WhatsApp.",
      { tipo: "contador", desde: 0, hasta: 3, etiqueta: "consejos aplicados", eventos: [{ palabra: 0, accion: "sube" }] }
    );
    const escenas = [GANCHO_OK, escenaMergeada, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].mensaje).toContain("exactamente 6 escenas");
  });

  it("gancho con un visual de 1 estado (ni celular_chat ni de 2 estados): hallazgo específico", () => {
    const ganchoMalo = escenaConAudio("e1", "gancho", "¿Sabes por qué pierdes clientes sin darte cuenta?", {
      tipo: "boton_estado",
      texto: "Clientes",
      texto_activo: "Perdidos",
      eventos: [{ palabra: 0, accion: "aparece" }],
    });
    const escenas = [ganchoMalo, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes("celular_chat"))).toBe(true);
  });

  it("parte 2e: gancho de 2 estados que ya muestra el arreglo (con evento): hallazgo, debe quedarse en el problema", () => {
    const ganchoResuelto = escenaConAudio("e1", "gancho", "¿Tus fotos espantan a los clientes?", {
      tipo: "icono_palabra",
      icono_antes: "🌑",
      palabra_antes: "Oscura",
      icono_despues: "☀️",
      palabra_despues: "Con luz",
      eventos: [{ palabra: 2, accion: "cambia_estado" }],
    });
    const hallazgos = validarEstructuraConsejosNumeradosAudio([ganchoResuelto, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK]);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes('estado "problema"'))).toBe(true);
  });

  it("ronda J -- caso real: gancho con celular_chat pero con numero_sube (contradice 'Cero mensajes...'): hallazgo específico", () => {
    const ganchoConSubida = escenaConAudio("e1", "gancho", "¿Cero mensajes aunque tus anuncios ya están publicados?", {
      tipo: "celular_chat",
      eventos: [{ palabra: 7, accion: "numero_sube" }],
    });
    const escenas = [ganchoConSubida, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes("congelado"))).toBe(true);
  });

  it("ronda J -- gancho con celular_chat y notificacion_llega: mismo hallazgo", () => {
    const ganchoConNotificacion = escenaConAudio("e1", "gancho", "¿Sabes por qué pierdes clientes sin darte cuenta?", {
      tipo: "celular_chat",
      eventos: [{ palabra: 0, accion: "notificacion_llega" }],
    });
    const escenas = [ganchoConNotificacion, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes("congelado"))).toBe(true);
  });

  it("ronda J -- gancho con celular_chat y eventos vacíos: pasa limpio (GANCHO_OK ya lo cubre, caso explícito aparte)", () => {
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1")).toBe(false);
  });

  it("marca sin reusar celular_chat (no cierra el bucle): hallazgo específico", () => {
    const marcaMala = escenaConAudio("e5", "marca", "Así ganas la confianza de quien te escribe.", {
      tipo: "boton_estado",
      texto: "Confianza",
      texto_activo: "Lograda",
      eventos: [{ palabra: 0, accion: "aparece" }],
    });
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, marcaMala, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e5" && h.mensaje.includes("cierra el bucle"))).toBe(true);
  });

  it("una escena 'valor' que enumera varios consejos (aunque la estructura tenga 6 escenas): hallazgo de enumeración", () => {
    const valorEnumerado = escenaConAudio("e2", "valor", "Primero responde rápido, segundo usa fotos reales y tercero revisa el avance.", {
      tipo: "contador",
      desde: 0,
      hasta: 3,
      etiqueta: "pasos aplicados",
      eventos: [{ palabra: 0, accion: "sube" }],
    });
    const escenas = [GANCHO_OK, valorEnumerado, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e2" && h.mensaje.includes("enumerar"))).toBe(true);
  });

  it("caso real (staging, 2do round): 'Segundo, verifica dos cosas' es UN consejo con un número dentro, no una enumeración -- sin hallazgo", () => {
    // 14 palabras (índices 0-13); el cambio de estado va en "real"
    // (índice 8, pasado el 30%) -- justo donde se da la solución.
    const valorConNumeroAdentro = escenaConAudio("e2", "valor", "Segundo, verifica dos cosas: que la foto sea real y represente lo que vendes.", {
      tipo: "anuncio_boton",
      eventos: [{ palabra: 8, accion: "cambia_estado" }],
    });
    const escenas = [GANCHO_OK, valorConNumeroAdentro, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.filter((h) => h.escenaId === "e2")).toHaveLength(0);
  });

  it("caso malo real: 'Uno: elige mensajes. Dos: usa fotos reales. Tres: ...' SÍ enumera 3 consejos de verdad -- hallazgo, con un ejemplo de cómo corregirlo", () => {
    const valorEnumeradoConDosPuntos = escenaConAudio(
      "e2",
      "valor",
      "Uno: elige mensajes. Dos: usa fotos reales. Tres: pide escribirte por WhatsApp.",
      { tipo: "contador", desde: 0, hasta: 3, etiqueta: "consejos aplicados", eventos: [{ palabra: 0, accion: "sube" }] }
    );
    const escenas = [GANCHO_OK, valorEnumeradoConDosPuntos, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    const hallazgo = hallazgos.find((h) => h.escenaId === "e2" && h.mensaje.includes("enumerar"));
    expect(hallazgo).toBeDefined();
    // El ejemplo de corrección va en el mismo mensaje -- pedido
    // explícito para que el reintento no repita el mismo error.
    expect(hallazgo!.mensaje).toContain("ej.");
  });

  it("un consejo demasiado corto para ser concreto ('elige mensajes'): hallazgo de concreción", () => {
    const valorCorto = escenaConAudio("e2", "valor", "Elige mensajes.", {
      tipo: "anuncio_boton",
      eventos: [{ palabra: 1, accion: "cambia_estado" }],
    });
    const escenas = [GANCHO_OK, valorCorto, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e2" && h.mensaje.includes("muy corta"))).toBe(true);
  });

  // Caso real (16 nov 2026, 3ra revisión de staging): "Meta: mensajes"
  // era un botón suelto (boton_estado) sin antes/después real, y un
  // cursor sin nada que mostrara el problema (cursor_clic) -- "decía,
  // no mostraba". Ninguno de los 2 cuenta ya como visual de consejo.
  it("boton_estado en una escena 'valor': hallazgo -- es de 1 estado, no muestra un antes real", () => {
    const valorConBotonSuelto = escenaConAudio("e2", "valor", "Responde cada mensaje en menos de un minuto.", {
      tipo: "boton_estado",
      texto: "Responder rápido",
      texto_activo: "¡Hecho!",
      eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 4, accion: "clic" }],
    });
    const escenas = [GANCHO_OK, valorConBotonSuelto, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e2" && h.mensaje.includes("2 estados"))).toBe(true);
  });

  it("cursor_clic en una escena 'valor': mismo hallazgo que boton_estado", () => {
    const valorConCursorSuelto = escenaConAudio("e3", "valor", "Usa fotos reales de tu negocio, no imágenes genéricas.", {
      tipo: "cursor_clic",
      texto_boton: "Subir foto real",
      eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 5, accion: "clic" }],
    });
    const escenas = [GANCHO_OK, VALOR_1_OK, valorConCursorSuelto, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e3" && h.mensaje.includes("2 estados"))).toBe(true);
  });

  it("contador sin etiqueta no compila (el schema la exige) -- con etiqueta, un número de contexto SÍ es válido para 'valor'", () => {
    expect(validarEstructuraConsejosNumeradosAudio([GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK]).filter((h) => h.escenaId === "e4")).toHaveLength(0);
  });

  it("caso real: el cambio de estado cae en la primera palabra -- nunca se alcanza a mostrar el problema", () => {
    const valorCambioMuyPronto = escenaConAudio("e2", "valor", "Responde cada mensaje en menos de un minuto.", {
      tipo: "anuncio_boton",
      eventos: [{ palabra: 0, accion: "cambia_estado" }],
    });
    const escenas = [GANCHO_OK, valorCambioMuyPronto, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e2" && h.mensaje.includes("muy al principio"))).toBe(true);
  });

  it("ronda M -- caso real: gancho de 16 palabras (~5s) -- hallazgo de gancho largo", () => {
    const ganchoLargo = escenaConAudio(
      "e1",
      "gancho",
      "¿Sabes por qué muchos negocios pierden clientes todos los días sin darse cuenta de lo que está pasando?",
      { tipo: "celular_chat", eventos: [] }
    );
    const escenas = [ganchoLargo, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes("palabras"))).toBe(true);
  });

  it("gancho de 12 palabras exactas: pasa (el límite es inclusivo)", () => {
    const ganchoLimite = escenaConAudio("e1", "gancho", "¿Sabes por qué muchos negocios pierden clientes todos los días sin razón?", {
      tipo: "celular_chat",
      eventos: [],
    });
    const escenas = [ganchoLimite, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e1" && h.mensaje.includes("palabras"))).toBe(false);
  });

  it("ronda M -- caso real: el clic de la CTA cae en la última palabra -- hallazgo de clic tardío", () => {
    const ctaClicTardio = escenaConAudio("e6", "cta", "Síguenos para más consejos como este.", {
      tipo: "boton_estado",
      texto: "Seguir",
      texto_activo: "Siguiendo",
      eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 5, accion: "clic" }],
    });
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, ctaClicTardio];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e6" && h.mensaje.includes("cae muy tarde"))).toBe(true);
  });

  it("CTA con cursor_clic (no boton_estado): misma regla de la mitad se aplica igual", () => {
    const ctaConCursor = escenaConAudio("e6", "cta", "Síguenos para más consejos como este.", {
      tipo: "cursor_clic",
      texto_boton: "Seguir",
      eventos: [{ palabra: 0, accion: "aparece" }, { palabra: 5, accion: "clic" }],
    });
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, ctaConCursor];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.escenaId === "e6" && h.mensaje.includes("cae muy tarde"))).toBe(true);
  });

  it("ronda M -- caso real: 2 consejos distintos en palabras pero con el MISMO tipo de visual -- hallazgo de tema repetido", () => {
    const valor2ConTipoRepetido = escenaConAudio("e3", "valor", "Usa fotos reales de tu negocio, no imágenes genéricas.", {
      tipo: "anuncio_boton", // mismo tipo que VALOR_1_OK ("e2")
      eventos: [{ palabra: 5, accion: "cambia_estado" }],
    });
    const escenas = [GANCHO_OK, VALOR_1_OK, valor2ConTipoRepetido, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.mensaje.includes("mismo visual") && h.mensaje.includes("e2") && h.mensaje.includes("e3"))).toBe(true);
  });

  it("los 3 consejos con 3 tipos de visual distintos (GANCHO_OK..CTA_OK ya lo cubre): sin hallazgo de repetido", () => {
    const escenas = [GANCHO_OK, VALOR_1_OK, VALOR_2_OK, VALOR_3_OK, MARCA_OK, CTA_OK];
    const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
    expect(hallazgos.some((h) => h.mensaje.includes("mismo visual"))).toBe(false);
  });

  describe("parte 2e: gancho y cierre con un visual de 2 estados", () => {
    const VISUAL_FOTO_PROBLEMA = {
      tipo: "icono_palabra" as const,
      icono_antes: "🌑",
      palabra_antes: "Oscura",
      icono_despues: "☀️",
      palabra_despues: "Con luz",
    };
    const GANCHO_FOTO = escenaConAudio("e1", "gancho", "¿Tus fotos espantan a los clientes?", { ...VISUAL_FOTO_PROBLEMA, eventos: [] });
    const MARCA_FOTO = escenaConAudio("e5", "marca", "Con esos tres cambios tus fotos ya venden solas.", {
      ...VISUAL_FOTO_PROBLEMA,
      eventos: [{ palabra: 0, accion: "cambia_estado" }],
    });
    const valorComparacion = escenaConAudio("e2", "valor", "Saca la foto junto a una ventana, nunca con flash.", {
      tipo: "comparacion",
      texto_mal: "Foto con flash",
      texto_bien: "Luz de ventana",
      eventos: [{ palabra: 5, accion: "cambia_estado" }],
    });
    const valorChecklist = escenaConAudio("e3", "valor", "Antes de publicar revisa fondo, luz y enfoque.", {
      tipo: "checklist",
      items: ["Fondo liso", "Luz de día", "Enfocada"],
      eventos: [{ palabra: 4, accion: "cambia_estado" }],
    });
    const valorAnuncio = escenaConAudio("e4", "valor", "Pon el precio en la publicación de cada foto.", {
      tipo: "anuncio_boton",
      etiqueta: "Publicación",
      texto_problema: "Sin precio",
      texto_arreglo: "Desde $45.000",
      eventos: [{ palabra: 4, accion: "cambia_estado" }],
    });
    const base = [GANCHO_FOTO, valorComparacion, valorChecklist, valorAnuncio, MARCA_FOTO, CTA_OK];

    it("gancho en el problema + marca con el mismo visual arreglado al principio: pasa limpio", () => {
      expect(validarEstructuraConsejosNumeradosAudio(base)).toHaveLength(0);
    });

    it("marca con otro tipo de visual: hallazgo de cierre del bucle", () => {
      const escenas = base.map((e) => (e.id === "e5" ? { ...e, visual: MARCA_OK.visual } : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e5" && h.mensaje.includes("cierra el bucle"))).toBe(true);
    });

    it("marca con textos distintos a los del gancho: hallazgo", () => {
      const escenas = base.map((e) => (e.id === "e5" ? { ...e, visual: { ...VISUAL_FOTO_PROBLEMA, palabra_despues: "Nítida", eventos: [{ palabra: 0, accion: "cambia_estado" as const }] } } : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e5" && h.mensaje.includes("mismos textos"))).toBe(true);
    });

    it("marca con los mismos textos en otro orden de campos: pasa limpio", () => {
      const reordenado = { eventos: [{ palabra: 0, accion: "cambia_estado" as const }], palabra_despues: "Con luz", icono_despues: "☀️", palabra_antes: "Oscura", icono_antes: "🌑", tipo: "icono_palabra" as const };
      const escenas = base.map((e) => (e.id === "e5" ? { ...e, visual: reordenado } : e));
      expect(validarEstructuraConsejosNumeradosAudio(escenas)).toHaveLength(0);
    });

    it("marca sin evento (repite el problema): hallazgo", () => {
      const escenas = base.map((e) => (e.id === "e5" ? { ...e, visual: { ...VISUAL_FOTO_PROBLEMA, eventos: [] } } : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e5" && h.mensaje.includes("necesita su evento"))).toBe(true);
    });

    it("marca con el arreglo tarde: hallazgo", () => {
      const escenas = base.map((e) => (e.id === "e5" ? { ...e, visual: { ...VISUAL_FOTO_PROBLEMA, eventos: [{ palabra: 7, accion: "cambia_estado" as const }] } } : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e5" && h.mensaje.includes("cae tarde"))).toBe(true);
    });

    it("un consejo repite el visual del gancho: hallazgo en ese consejo", () => {
      const repetido = escenaConAudio("e3", "valor", "Toma la foto de día, con la luz de la ventana.", {
        ...VISUAL_FOTO_PROBLEMA,
        eventos: [{ palabra: 5, accion: "cambia_estado" }],
      });
      const escenas = base.map((e) => (e.id === "e3" ? repetido : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e3" && h.mensaje.includes("mismo visual del gancho"))).toBe(true);
    });

    it("un consejo de 2 estados sin evento (nunca muestra el arreglo): hallazgo", () => {
      const escenas = base.map((e) => (e.id === "e2" ? { ...e, visual: { tipo: "comparacion" as const, texto_mal: "Foto con flash", texto_bien: "Luz de ventana", eventos: [] } } : e));
      const hallazgos = validarEstructuraConsejosNumeradosAudio(escenas);
      expect(hallazgos.some((h) => h.escenaId === "e2" && h.mensaje.includes("no tiene evento"))).toBe(true);
    });
  });
});

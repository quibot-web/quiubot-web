// Prueba generarGuionConVoz() -- OpenAI y generarVoz() mockeados,
// nunca contra OpenAI ni Cloudinary de verdad. alinearPalabras()/
// construirCamposDeTiempo()/verificarPalabrasCompletas()/
// calcularHashNarracion() son las funciones puras reales (no
// mockeadas): ya tienen su propia batería de pruebas, acá se verifica
// que generarGuionConVoz() las conecta bien, no que cada una funcione
// por separado.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RecetaOrganica } from "@/video/recetas/organico";
import { RECETAS_ORGANICAS } from "@/video/recetas/organico";
import { recetaParaPromptConAudio, type EntradaGuionOrganico } from "@/video/promptGuionOrganico";
import type { TemaGuion } from "@/video/tema";

const generarVozMock = vi.fn();
vi.mock("./generarVoz", () => ({ generarVoz: (...args: unknown[]) => generarVozMock(...args) }));

// construirCamposDeTiempo real por default (es una función pura, ya
// probada aparte en compactarPausas.test.ts/pruebaDeEstres.test.ts) --
// se sobreescribe solo en la prueba de "palabra mordida" de abajo, para
// forzar el caso sin tener que reconstruir a mano un silencio real que
// produzca ese corte exacto.
const construirCamposDeTiempoMock = vi.fn();
vi.mock("./compactarPausas", async (importOriginal) => {
  const real = await importOriginal<typeof import("./compactarPausas")>();
  construirCamposDeTiempoMock.mockImplementation(real.construirCamposDeTiempo);
  return { ...real, construirCamposDeTiempo: (...args: unknown[]) => construirCamposDeTiempoMock(...args) };
});

const { generarGuionConVoz } = await import("./generarGuionConVoz");

const TEMA: TemaGuion = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna", logo_url: null, nombre_marca: "Marca", instagramUsuario: null };

function entradaBase(): EntradaGuionOrganico {
  return {
    recetaId: "consejos_numerados",
    receta: RECETAS_ORGANICAS.consejos_numerados,
    duracionS: 16,
    infoAdicionalMarca: "Plataforma de publicidad en Meta para pymes.",
    adnTitular: "Marca de prueba",
    adnFraseCorta: "Hecho con cariño",
    productos: [],
    tema: null,
    productoPieza: null,
    ganchoTipoAsignado: "pregunta",
    piezas: [],
    analisisPiezas: {},
  };
}

// Guion válido mínimo, mismo shape real que ya se vio en staging
// (narracion + visual por escena, 6 bloques: gancho + 3×valor + marca
// + cta).
const GUION_CON_AUDIO_VALIDO = {
  gancho_tipo: "pregunta",
  bucle: { texto: "3 ajustes", abre_en: "e1", cierra_en: "e4", indicador: "contador" },
  escenas: [
    { id: "e1", bloque: "gancho", tipo: "gancho_texto", duracion_s: 2.2, texto_gigante: "¿Vendes hoy?", narracion: "Hola a todos los que venden hoy", visual: { tipo: "celular_chat", eventos: [] }, params: { texto: "Hola a todos", palabra_clave: "todos" } },
    {
      id: "e2",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 2.6,
      narracion: "Primero pon un boton de contacto visible",
      visual: { tipo: "anuncio_boton", eventos: [{ palabra: 5, accion: "cambia_estado" }] },
      params: { titulo: "Consejo 1", items: ["Pon el boton", "Usa una accion", "Prueba el clic"] },
    },
    {
      id: "e3",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 2.6,
      narracion: "Segundo conecta tu anuncio con WhatsApp",
      visual: { tipo: "conexion_whatsapp", eventos: [{ palabra: 5, accion: "cambia_estado" }] },
      params: { titulo: "Consejo 2", items: ["Conecta WhatsApp", "Usa el numero", "Envia un mensaje"] },
    },
    {
      id: "e4",
      bloque: "valor",
      tipo: "lista_numerada",
      duracion_s: 2.6,
      narracion: "Tercero responde cada mensaje rapido",
      visual: { tipo: "respuesta_lenta", eventos: [{ palabra: 4, accion: "cambia_estado" }] },
      params: { titulo: "Consejo 3", items: ["Responde rapido", "Abre directo", "Continua la charla"] },
    },
    { id: "e5", bloque: "marca", tipo: "revelacion_marca", duracion_s: 3, narracion: "Marca lista", visual: { tipo: "celular_chat", eventos: [] }, params: { frase: "Marca lista", mostrar_logo: true } },
    {
      id: "e6",
      bloque: "cta",
      tipo: "cta",
      duracion_s: 2.6,
      narracion: "Síguenos ya",
      visual: { tipo: "boton_estado", texto: "Seguir", texto_activo: "Siguiendo", eventos: [{ palabra: 0, accion: "aparece" }] },
      params: { accion: "seguir", texto_boton: "Síguenos", usuario: "@marca" },
    },
  ],
  caption: "Un caption cualquiera.",
  hashtags: ["#uno", "#dos", "#tres"],
};

function respuestaOpenAI(contenidoObjeto: unknown) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(contenidoObjeto) } }] }) };
}

// Timestamps reales pareja a palabra por posición -- mismo criterio
// que alinearPalabras.test.ts (conteo exacto -> puntaje 1). Sin
// silencios grandes: no es el foco de esta prueba (ya cubierto por
// compactarPausas.test.ts/encontrarSilenciosLargos.test.ts).
function palabrasParaTexto(texto: string): { texto: string; inicio_s: number; fin_s: number }[] {
  let t = 0;
  return texto.split(" ").map((palabra) => {
    const inicio_s = t;
    const fin_s = t + 0.3;
    t = fin_s + 0.1;
    return { texto: palabra, inicio_s, fin_s };
  });
}

function parametrosBase() {
  const entrada = entradaBase();
  return {
    apiKeyUsuario: "sk-test",
    cloudinary: { cloudName: "demo", apiKey: "k", apiSecret: "s" },
    voz: "cedar",
    tema: TEMA,
    entrada,
    recetaConAudio: recetaParaPromptConAudio(entrada) as RecetaOrganica,
    tienePiezas: false,
    pistaIdElegida: null,
    duracionObjetivoS: 16,
    recetaId: "consejos_numerados" as const,
  };
}

describe("generarGuionConVoz", () => {
  beforeEach(() => {
    generarVozMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("éxito: valida, genera voz, alinea y compacta -- el guion final trae vozUrl/tiemposRender/palabrasPorEscena/narracionHash", async () => {
    const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO));
    vi.stubGlobal("fetch", fetchMock);
    generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(textoCompleto), silencios: [] });

    const resultado = await generarGuionConVoz(parametrosBase());

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error("no debería fallar");
    expect(resultado.guion.vozUrl).toBe("https://cloudinary.test/voz.mp3");
    expect(resultado.guion.tiemposRender).toHaveLength(6);
    expect(resultado.guion.palabrasPorEscena).toHaveLength(6);
    expect(resultado.guion.narracionHash).toEqual(expect.any(String));
    expect(resultado.intentosGuion).toBe(1);
    // Sistema de estilos (paso 1): el estilo lo pone el código, con un
    // layout por escena -- el gancho de texto va como palabra gigante.
    expect(resultado.guion.estilo?.id).toBe("noche"); // sin historial
    expect(Object.keys(resultado.guion.estilo?.layouts ?? {})).toHaveLength(6);
    expect(resultado.guion.estilo?.layouts.e1).toBe("palabra_gigante");
    expect(generarVozMock).toHaveBeenCalledWith(textoCompleto, { openaiKey: "sk-test", voz: "cedar", cloudinary: { cloudName: "demo", apiKey: "k", apiSecret: "s" } });
  });

  it("voz incompleta (la TTS llegó cortada, caso real de la torta): se detecta antes del render y se pide una vez más; si la segunda sale bien, sigue", async () => {
    const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
    const completa = palabrasParaTexto(textoCompleto);
    const cortada = completa.slice(0, Math.floor(completa.length * 0.6));
    generarVozMock.mockResolvedValueOnce({ audioUrl: "https://cloudinary.test/cortada.mp3", palabras: cortada, silencios: [] });
    generarVozMock.mockResolvedValueOnce({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: completa, silencios: [] });
    const resultado = await generarGuionConVoz(parametrosBase());
    expect(generarVozMock).toHaveBeenCalledTimes(2);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.guion.vozUrl).toBe("https://cloudinary.test/voz.mp3");
  });

  it("voz incompleta dos veces: error claro antes del render (nunca un reel sin su última frase)", async () => {
    const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
    const cortada = palabrasParaTexto(textoCompleto).slice(0, 10);
    generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/cortada.mp3", palabras: cortada, silencios: [] });
    const resultado = await generarGuionConVoz(parametrosBase());
    expect(generarVozMock).toHaveBeenCalledTimes(2);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.status).toBe(502);
      expect(resultado.error).toMatch(/incompleta/);
    }
  });

  it("guion con numeración doble ('1/3 ' antepuesta por la IA): se limpia sola antes de validar, sin gastar reintento -- la IA sí llamó una sola vez", async () => {
    // Caso real migrado desde app/api/contenido/[id]/guion/route.test.ts:
    // consejos_numerados ya no pasa por el pipeline viejo, pero
    // limpiarNumeracionItemsLista() sigue corriendo acá adentro.
    const guionConNumeracion = {
      ...GUION_CON_AUDIO_VALIDO,
      escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) =>
        e.id === "e2" ? { ...e, params: { ...e.params, items: ["1/3 Pon el boton", "2/3 Usa una accion", "3/3 Prueba el clic"] } } : e
      ),
    };
    const textoCompleto = guionConNumeracion.escenas.map((e) => e.narracion).join(" ");
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConNumeracion));
    vi.stubGlobal("fetch", fetchMock);
    generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(textoCompleto), silencios: [] });

    const resultado = await generarGuionConVoz(parametrosBase());

    expect(resultado.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (resultado.ok) {
      const e2 = resultado.guion.escenas.find((e) => e.id === "e2") as { params?: { items?: string[] } };
      expect(e2.params?.items).toEqual(["Pon el boton", "Usa una accion", "Prueba el clic"]);
    }
  });

  it("estructura inválida (numero_sube en el gancho, contradice 'cero mensajes'): se reintenta y si sigue mal, falla con resumenErrores -- nunca llama a generarVoz()", async () => {
    const guionConGanchoRoto = { ...GUION_CON_AUDIO_VALIDO, escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) => (e.id === "e1" ? { ...e, visual: { tipo: "celular_chat", eventos: [{ palabra: 0, accion: "numero_sube" }] } } : e)) };
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(guionConGanchoRoto));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await generarGuionConVoz({ ...parametrosBase(), maxReintentos: 1 });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.status).toBe(502);
      expect(resultado.resumenErrores?.join(" ")).toContain("e1");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 intento inicial + 1 reintento
    expect(generarVozMock).not.toHaveBeenCalled();
  });

  describe("parte 2d: comparacion_foto usa una foto REAL de las piezas elegidas", () => {
    function guionConFoto(mediaId: string) {
      return {
        ...GUION_CON_AUDIO_VALIDO,
        escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) =>
          e.id === "e4" ? { ...e, visual: { tipo: "comparacion_foto", media_id: mediaId, texto_mal: "Foto oscura", texto_bien: "Foto con luz", eventos: [{ palabra: 4, accion: "cambia_estado" }] } } : e
        ),
      };
    }
    function parametrosConPiezas() {
      const base = parametrosBase();
      return {
        ...base,
        entrada: { ...base.entrada, piezas: [{ id: "foto-1", tipo: "imagen" as const }, { id: "video-1", tipo: "video" as const }] },
        tienePiezas: true,
        maxReintentos: 0,
      };
    }

    it("con una imagen de las piezas elegidas: pasa", async () => {
      const guion = guionConFoto("foto-1");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(guion)));
      generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(guion.escenas.map((e) => e.narracion).join(" ")), silencios: [] });
      const resultado = await generarGuionConVoz(parametrosConPiezas());
      expect(resultado.ok).toBe(true);
    });

    it("con un id que no está entre las piezas: se rechaza (nunca inventa una foto)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(guionConFoto("inventada"))));
      const resultado = await generarGuionConVoz(parametrosConPiezas());
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.resumenErrores?.join(" ")).toContain('media_id "inventada" no está entre las piezas disponibles');
      expect(generarVozMock).not.toHaveBeenCalled();
    });

    it("con un VIDEO de las piezas: se rechaza (el visual difumina y aclara una foto)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(guionConFoto("video-1"))));
      const resultado = await generarGuionConVoz(parametrosConPiezas());
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.resumenErrores?.join(" ")).toContain("necesita una pieza de tipo imagen");
    });
  });

  it("la compactación se come una palabra real: no entrega el guion, falla con 502 aunque la validación de texto haya pasado", async () => {
    // No se reconstruye a mano un silencio real que produzca el corte
    // -- eso ya lo prueba compactarPausas.test.ts/pruebaDeEstres.test.ts
    // por su cuenta. Acá se fuerza el resultado de construirCamposDeTiempo()
    // para probar SOLO que generarGuionConVoz() revisa verificarPalabrasCompletas()
    // y corta la entrega si encuentra algo, en vez de confiar ciegamente.
    const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
    const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO));
    vi.stubGlobal("fetch", fetchMock);
    generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(textoCompleto), silencios: [] });
    construirCamposDeTiempoMock.mockReturnValueOnce({
      tiemposRender: [],
      palabrasPorEscena: [],
      segmentosAudio: [],
      palabrasFlat: [{ texto: "mordida", inicio_s: 1, fin_s: 1.3 }],
      tramosPorEscena: [[{ original: { inicio_s: 5, fin_s: 5.3 }, compactado: { inicio_s: 5, fin_s: 5.3 } }]],
    });

    const resultado = await generarGuionConVoz(parametrosBase());

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("mordido");
    }
  });

  it("rotación de estilos: con historial, nunca repite el estilo de la pieza anterior", async () => {
    const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
    generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(textoCompleto), silencios: [] });
    const resultado = await generarGuionConVoz({ ...parametrosBase(), historialEstilos: ["noche"] });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.guion.estilo?.id).toBe("color_pleno");
  });

  describe("reel ilustrado (fase 2)", () => {
    const PLAN_FIXTURE = {
      frases: [
        { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1 }, { escena: "feed", accion: "lo_miran", palabra: 5 }] },
        { escena_id: "e2", acciones: [{ escena: "feed", accion: "desliza", palabra: 3 }, { escena: "feed", accion: "se_detiene", palabra: 6 }] },
        { escena_id: "e3", acciones: [{ escena: "chat", accion: "llega_mensaje", palabra: 3 }, { escena: "chat", accion: "llega_mensaje", palabra: 5 }] },
        { escena_id: "e4", acciones: [{ escena: "chat", accion: "responde", palabra: 1 }, { escena: "chat", accion: "se_vuelve_venta", palabra: 3 }] },
        { escena_id: "e5", acciones: [{ escena: "billetera", accion: "se_llena", palabra: 0 }] },
        { escena_id: "e6", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 1 }] },
      ],
    };
    function prepararVoz() {
      const textoCompleto = GUION_CON_AUDIO_VALIDO.escenas.map((e) => e.narracion).join(" ");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
      generarVozMock.mockResolvedValue({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(textoCompleto), silencios: [] });
    }

    it("cuenta de la lista: el plan se pide ANTES de pagar la voz y queda en el guion, con su estilo de respaldo", async () => {
      prepararVoz();
      const orden: string[] = [];
      const llamarIAPlan = vi.fn(async () => {
        orden.push("plan");
        return JSON.stringify(PLAN_FIXTURE);
      });
      generarVozMock.mockImplementation(async (texto: string) => {
        orden.push("voz");
        return { audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(texto), silencios: [] };
      });
      const resultado = await generarGuionConVoz({ ...parametrosBase(), conPlanIlustrado: true, llamarIAPlan });
      if (!resultado.ok) throw new Error("no debería fallar");
      expect(orden).toEqual(["plan", "voz"]);
      expect(resultado.guion.ilustrado?.frases).toHaveLength(6);
      expect(resultado.planIlustrado.estado).toBe("generado");
      expect(resultado.guion.estilo).toBeDefined(); // respaldo siempre presente
    });

    it("si el plan no sale válido en 3 intentos, la pieza se genera igual con su estilo (sin 'ilustrado') y queda el motivo", async () => {
      prepararVoz();
      const llamarIAPlan = vi.fn(async () => JSON.stringify({ frases: [{ escena_id: "e1", acciones: [{ escena: "feed", accion: "vuela", palabra: 0 }] }] }));
      const resultado = await generarGuionConVoz({ ...parametrosBase(), conPlanIlustrado: true, llamarIAPlan });
      if (!resultado.ok) throw new Error("no debería fallar");
      expect(llamarIAPlan).toHaveBeenCalledTimes(3);
      expect(resultado.guion.ilustrado).toBeUndefined();
      expect(resultado.planIlustrado.estado).toBe("respaldo");
      expect(resultado.guion.estilo).toBeDefined();
    });

    it("cuenta fuera de la lista: nunca se pide plan", async () => {
      prepararVoz();
      const llamarIAPlan = vi.fn();
      const resultado = await generarGuionConVoz({ ...parametrosBase(), llamarIAPlan });
      if (!resultado.ok) throw new Error("no debería fallar");
      expect(llamarIAPlan).not.toHaveBeenCalled();
      expect(resultado.planIlustrado.estado).toBe("no_aplica");
      expect(resultado.guion.ilustrado).toBeUndefined();
    });
  });

  describe("tu idea para el video (24 nov 2026)", () => {
    // Las 3 narraciones de consejo del guion de prueba, como idea del usuario.
    const IDEA = "Quiero un reel para vender más por WhatsApp, con mis palabras.\n1. Pon un boton de contacto visible\n2. Conecta tu anuncio con WhatsApp\n3. Responde cada mensaje rapido\nCierre: Síguenos ya";
    const conIdea = (tema: string) => {
      const base = parametrosBase();
      return { ...base, entrada: { ...base.entrada, tema } };
    };
    function prepararVozOk() {
      generarVozMock.mockImplementation(async (texto: string) => ({ audioUrl: "https://cloudinary.test/voz.mp3", palabras: palabrasParaTexto(texto), silencios: [] }));
    }

    it("idea larga respetada: el guion que sigue sus puntos en su orden se acepta", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
      prepararVozOk();
      const r = await generarGuionConVoz(conIdea(IDEA));
      expect(r.ok).toBe(true);
    });

    it("idea larga NO respetada (orden cambiado): se reintenta y si sigue igual, falla diciendo qué punto", async () => {
      const ideaAlReves = "Quiero un reel para vender más por WhatsApp, con mis palabras.\n1. Responde cada mensaje rapido\n2. Conecta tu anuncio con WhatsApp\n3. Pon un boton de contacto visible";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
      prepararVozOk();
      const r = await generarGuionConVoz(conIdea(ideaAlReves));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect((r.resumenErrores ?? []).join(" ")).toMatch(/respeta el orden/);
      expect(generarVozMock).not.toHaveBeenCalled();
    });

    it("idea que no cabe: la IA propone la serie y se devuelve SIN pagar la voz ni reintentar", async () => {
      const fetchMock = vi.fn().mockResolvedValue(respuestaOpenAI({ no_cabe: true, motivo: "Son muchos pasos para 30 segundos.", partes: [{ titulo: "Parte 1", idea: "primeros pasos" }, { titulo: "Parte 2", idea: "últimos pasos" }] }));
      vi.stubGlobal("fetch", fetchMock);
      // Idea en prosa, sin puntos marcados: ahí la IA sí puede proponer serie.
      const prosa = "Quiero contar toda la historia de cómo pasamos de vender por un local a vender por WhatsApp: qué cambiamos en los anuncios, cómo armamos el catálogo, cómo usamos etiquetas, cómo respondemos, cómo cobramos y cómo hacemos seguimiento, con ejemplos de mis clientes de este año y de los errores que cometimos al principio.";
      const r = await generarGuionConVoz(conIdea(prosa));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.status).toBe(422);
      expect(r.propuestaSerie?.partes).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(generarVozMock).not.toHaveBeenCalled();
    });

    it("dato inventado (precio que el usuario no escribió) se rechaza; el mismo dato escrito por el usuario se acepta", async () => {
      const conPrecio = { ...GUION_CON_AUDIO_VALIDO, escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) => (e.id === "e5" ? { ...e, narracion: "Marca lista desde $45.000" } : e)) };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(conPrecio)));
      prepararVozOk();
      const inventado = await generarGuionConVoz(conIdea(IDEA));
      expect(inventado.ok).toBe(false);
      if (!inventado.ok) expect((inventado.resumenErrores ?? []).join(" ")).toMatch(/\$45\.000.*no lo inventes/);
      const delUsuario = await generarGuionConVoz(conIdea(`${IDEA}\nEl kit cuesta $45.000.`));
      expect(delUsuario.ok).toBe(true);
    });

    it("tema corto sin precio: un guion con precio o 'envío gratis' se rechaza y nunca se paga la voz", async () => {
      const conDatos = { ...GUION_CON_AUDIO_VALIDO, escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) => (e.id === "e5" ? { ...e, narracion: "Marca lista con envío gratis desde $45.000" } : e)) };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(conDatos)));
      prepararVozOk();
      const r = await generarGuionConVoz(conIdea("vender más por WhatsApp"));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect((r.resumenErrores ?? []).join(" ")).toMatch(/\$45\.000/);
        expect((r.resumenErrores ?? []).join(" ")).toMatch(/envío gratis/);
      }
      expect(generarVozMock).not.toHaveBeenCalled();
    });

    it("caso real: idea de 3 puntos con ejemplos (~170 palabras) va en UN solo reel aunque la IA intente partirla", async () => {
      const ejemplo = "Ejemplo de mi tienda: una clienta escribió un domingo a las nueve de la noche preguntando por el estuche azul, le respondimos al día siguiente y ya le había comprado a otra marca que sí le contestó enseguida. Desde ese día tenemos respuestas guardadas para las preguntas que más se repiten y alguien de turno revisa los mensajes cada hora. Otro ejemplo: un cliente nos encontró por un anuncio, no vio cómo escribirnos y nos lo contó semanas después en el local; por eso ahora el botón está siempre visible.";
      const idea = `Quiero un reel para vender más por WhatsApp, con mis palabras y mis ejemplos.\n1. Pon un boton de contacto visible en el anuncio, porque si la persona tiene que buscar cómo escribirte se va.\n2. Conecta tu anuncio con WhatsApp para que el mensaje llegue directo y no se pierda en otra bandeja.\n3. Responde cada mensaje rapido, idealmente en menos de diez minutos.\n${ejemplo}\nCierre: escríbenos y te ayudamos a configurarlo hoy mismo.`;
      expect(idea.split(/\s+/).length).toBeGreaterThan(150);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respuestaOpenAI({ no_cabe: true, motivo: "Supera las ochenta palabras.", partes: [{ titulo: "1", idea: "a" }, { titulo: "2", idea: "b" }] }))
        .mockResolvedValueOnce(respuestaOpenAI(GUION_CON_AUDIO_VALIDO));
      vi.stubGlobal("fetch", fetchMock);
      prepararVozOk();
      const r = await generarGuionConVoz(conIdea(idea));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.intentosGuion).toBe(2);
      // El reintento le dijo que va en un solo reel, condensando.
      const promptReintento = JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content as string;
      expect(promptReintento).toMatch(/va en UN solo reel de hasta ~50 segundos/);
    });

    it("'Hazlo en un solo reel (resumido)': aunque tenga 5 puntos, no vale 'no_cabe'", async () => {
      const idea = "Cinco errores.\n1. Pon un boton de contacto visible\n2. Conecta tu anuncio con WhatsApp\n3. Responde cada mensaje rapido\n4. Marca lista\n5. Siguenos";
      const fetchMock = vi.fn().mockResolvedValueOnce(respuestaOpenAI({ no_cabe: true, motivo: "m", partes: [{ titulo: "1", idea: "a" }, { titulo: "2", idea: "b" }] })).mockResolvedValueOnce(respuestaOpenAI(GUION_CON_AUDIO_VALIDO));
      vi.stubGlobal("fetch", fetchMock);
      prepararVozOk();
      const base = conIdea(idea);
      const r = await generarGuionConVoz({ ...base, entrada: { ...base.entrada, unSoloReel: true } });
      expect(r.ok).toBe(true);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toMatch(/UN SOLO reel resumido/);
    });

    describe("partes de una serie: cada una funciona sola y se siente serie", () => {
      const conEscenas = (cambios: Record<string, string>) => ({ ...GUION_CON_AUDIO_VALIDO, escenas: GUION_CON_AUDIO_VALIDO.escenas.map((e) => (cambios[e.id] ? { ...e, narracion: cambios[e.id] } : e)) });
      const parte = (n: number, total: number) => {
        const base = conIdea(`Parte ${n} de ${total}.\nVender por WhatsApp sin perder clientes, contado con ejemplos de mi tienda y mis propias palabras.`);
        return { ...base, entrada: { ...base.entrada, serie: { parte: n, total, ideaAnterior: n > 1 ? "Parte 1: botón y conexión" : null, ideaSiguiente: n < total ? "Parte 2: responder rápido" : null } } };
      };

      it("parte 1 sin adelanto ni llamados al cierre: se rechaza", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(conEscenas({ e6: "Gracias por ver hasta el final" }))));
        prepararVozOk();
        const r = await generarGuionConVoz(parte(1, 2));
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect((r.resumenErrores ?? []).join(" ")).toMatch(/adelantar en concreto lo que viene en la parte 2/);
          expect((r.resumenErrores ?? []).join(" ")).toMatch(/guardar el reel o seguir la cuenta/);
        }
      });

      it("parte 1 con adelanto ('Mañana: cómo ...') y llamados (guarda, síguenos): pasa y el guion queda marcado como Parte 1 de 2", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(conEscenas({ e5: "Mañana: cómo responder sin perder ventas", e6: "Guárdalo y síguenos ya" }))));
        prepararVozOk();
        const r = await generarGuionConVoz(parte(1, 2));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.guion.serie).toEqual({ parte: 1, total: 2 });
      });

      it("parte 2 sin repaso de la parte 1: se rechaza; con 'Ayer viste que ...': pasa", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
        prepararVozOk();
        const sinRepaso = await generarGuionConVoz(parte(2, 2));
        expect(sinRepaso.ok).toBe(false);
        if (!sinRepaso.ok) expect((sinRepaso.resumenErrores ?? []).join(" ")).toMatch(/repasa en UNA frase lo de la parte anterior/);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(conEscenas({ e2: "Ayer viste el boton: primero pon un boton de contacto visible" }))));
        const conRepaso = await generarGuionConVoz(parte(2, 2));
        expect(conRepaso.ok).toBe(true);
        if (conRepaso.ok) expect(conRepaso.guion.serie).toEqual({ parte: 2, total: 2 });
      });

      it("una parte de serie nunca puede responder 'no_cabe' (se pide condensar)", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(respuestaOpenAI({ no_cabe: true, motivo: "m", partes: [{ titulo: "1", idea: "a" }, { titulo: "2", idea: "b" }] })).mockResolvedValue(respuestaOpenAI(conEscenas({ e5: "Mañana: cómo responder sin perder ventas", e6: "Guárdalo y síguenos ya" })));
        vi.stubGlobal("fetch", fetchMock);
        prepararVozOk();
        const r = await generarGuionConVoz(parte(1, 2));
        expect(r.ok).toBe(true);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content).toMatch(/parte de una serie: tiene que caber en UN reel/);
      });
    });

    it("idea corta (un tema): se genera como siempre, sin exigir puntos", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaOpenAI(GUION_CON_AUDIO_VALIDO)));
      prepararVozOk();
      const r = await generarGuionConVoz(conIdea("vender más por WhatsApp"));
      expect(r.ok).toBe(true);
    });
  });
});


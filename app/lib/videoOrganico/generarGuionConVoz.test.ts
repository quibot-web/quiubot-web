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
});

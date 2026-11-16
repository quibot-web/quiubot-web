// ejecutarTurnoMeta con Supabase y llamarDirector mockeados -- nunca
// contra la base real ni contra OpenAI. Cubre el caso real del 18 nov
// 2026: el chat del Director preguntaba el @usuario de Instagram
// aunque la cuenta ya estuviera conectada. usuario_cta ahora se llena
// SIEMPRE desde el contexto real (nunca desde lo que diga el modelo),
// mismo criterio que valor_inicial.
import { describe, it, expect, vi, beforeEach } from "vitest";

const llamarDirectorMock = vi.fn();
vi.mock("@/app/lib/director/llamarDirector", () => ({
  llamarDirector: (...args: unknown[]) => llamarDirectorMock(...args),
}));

const obtenerSaludInstagramMock = vi.fn();
vi.mock("@/app/lib/metaInstagramSalud", () => ({
  obtenerSaludInstagram: (...args: unknown[]) => obtenerSaludInstagramMock(...args),
}));

let borradorGuardado: Record<string, unknown> | null = null;
const MARCA_MOCK = { adn_marca: null, nombre_marca: "Tienda de Juan", ciudades_cobertura: [], pais_cobertura: "CO", sitio_web: null, whatsapp_numero: null };

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (tabla: string) => {
      if (tabla === "conversaciones_meta") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { borrador: {} } }) }) }),
          update: (valores: Record<string, unknown>) => ({
            eq: () => {
              borradorGuardado = valores.borrador as Record<string, unknown>;
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (tabla === "director_conversaciones") {
        return {
          select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }),
          insert: () => ({
            select: () => ({ single: async () => ({ data: { id: "fila-1", creado_en: new Date().toISOString() } }) }),
          }),
        };
      }
      if (tabla === "marcas") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: MARCA_MOCK }) }) }) };
      }
      if (tabla === "metas") {
        return { select: () => ({ eq: () => ({ neq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) };
      }
      if (tabla === "productos") {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ order: async () => ({ data: [] }) }) }) }) }) };
      }
      throw new Error(`Tabla no mockeada en este test: ${tabla}`);
    },
  },
}));

import { ejecutarTurnoMeta, construirContextoNegocio } from "./flujoCrearMeta";
import type { ContextoNegocioDirector } from "./promptMetaConversacion";

const CONTEXTO_BASE: ContextoNegocioDirector = {
  nombreNegocio: "Tienda de Juan",
  adnTitular: null,
  adnFraseCorta: null,
  paisCobertura: "CO",
  ciudadesCobertura: [],
  metaAnteriorResumen: null,
  productos: [],
  conexionMeta: {
    pagina: "Tienda de Juan",
    cuentaPublicitaria: "Cuenta de Juan",
    instagram: { conectado: false, username: null, seguidores: null },
    whatsapp: null,
    sitioWeb: null,
    pixel: { conectado: false, nombre: null },
  },
};

const USUARIO = {
  id: "user-1",
  email: "usuario1@quiubot.test",
  meta_ad_account_id: "act_1",
  meta_access_token: "token",
  meta_pixel_id: null,
  meta_page_id: null,
};

beforeEach(() => {
  llamarDirectorMock.mockReset();
  obtenerSaludInstagramMock.mockReset();
  borradorGuardado = null;
});

describe("ejecutarTurnoMeta -- usuario_cta de seguidores_instagram", () => {
  it("con Instagram conectado, el borrador trae el @usuario real aunque el modelo no lo haya puesto", async () => {
    llamarDirectorMock.mockResolvedValue({
      respuesta: "¡Listo, vamos con seguidores de Instagram!",
      borrador_parcial: { tipo: "seguidores_instagram" },
    });

    const contexto: ContextoNegocioDirector = {
      ...CONTEXTO_BASE,
      conexionMeta: { ...CONTEXTO_BASE.conexionMeta, instagram: { conectado: true, username: "tiendadejuan", seguidores: 500 } },
    };

    const resultado = await ejecutarTurnoMeta({
      usuario: USUARIO,
      apiKey: "sk-test",
      conversacionId: "conv-1",
      contextoNegocio: contexto,
      mensajeUsuario: "Quiero seguidores de Instagram",
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.borrador.usuario_cta).toBe("@tiendadejuan");
    expect(borradorGuardado?.usuario_cta).toBe("@tiendadejuan");
    // El modelo nunca mencionó el @usuario -- confirma que no hizo
    // falta preguntarlo para que quede en el borrador.
    expect(llamarDirectorMock).toHaveBeenCalledTimes(1);
  });

  it("sin Instagram conectado, el borrador nunca inventa un @usuario", async () => {
    llamarDirectorMock.mockResolvedValue({
      respuesta: "Necesitas vincular tu Instagram antes de seguir con esta meta.",
      borrador_parcial: { tipo: "seguidores_instagram" },
    });

    const resultado = await ejecutarTurnoMeta({
      usuario: USUARIO,
      apiKey: "sk-test",
      conversacionId: "conv-1",
      contextoNegocio: CONTEXTO_BASE, // instagram.conectado: false
      mensajeUsuario: "Quiero seguidores de Instagram",
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.borrador.usuario_cta).toBeUndefined();
  });

  it("el prompt que recibe el modelo ya trae el @usuario conectado, para que confirme en vez de preguntar", async () => {
    llamarDirectorMock.mockResolvedValue({ respuesta: "ok", borrador_parcial: {} });

    const contexto: ContextoNegocioDirector = {
      ...CONTEXTO_BASE,
      conexionMeta: { ...CONTEXTO_BASE.conexionMeta, instagram: { conectado: true, username: "tiendadejuan", seguidores: 500 } },
    };

    await ejecutarTurnoMeta({ usuario: USUARIO, apiKey: "sk-test", conversacionId: "conv-1", contextoNegocio: contexto, mensajeUsuario: "hola" });

    const systemPromptEnviado = llamarDirectorMock.mock.calls[0]?.[2] as string;
    expect(systemPromptEnviado).toContain("Instagram conectado: @tiendadejuan");
  });
});

// Usuarios con id distinto en cada caso -- la caché de
// obtenerSaludInstagramCacheada es un Map module-level por user_id, y
// estos tests comparten el módulo real (solo se mockea
// obtenerSaludInstagram): usar el mismo id entre tests haría que uno
// contamine el resultado cacheado del otro.
describe("construirContextoNegocio -- caché y resiliencia de obtenerSaludInstagram", () => {
  it("no vuelve a llamar a Meta en una segunda construcción de contexto del mismo usuario (dentro del TTL)", async () => {
    obtenerSaludInstagramMock.mockResolvedValue({ conectado: true, username: "tiendadejuan", followers_count: 500, tokenVencido: false });
    const usuario = {
      id: "user-cache-1",
      email: "cache1@quiubot.test",
      meta_page_id: "page-1",
      meta_access_token: "token-1",
      meta_page_name: "Página de prueba",
      meta_ad_account_nombre: "Cuenta de prueba",
      meta_pixel_id: null,
      meta_pixel_nombre: null,
    };

    const primero = await construirContextoNegocio(usuario);
    const segundo = await construirContextoNegocio(usuario);

    expect(obtenerSaludInstagramMock).toHaveBeenCalledTimes(1);
    expect(primero.conexionMeta.instagram.username).toBe("tiendadejuan");
    expect(segundo.conexionMeta.instagram.username).toBe("tiendadejuan");
  });

  it("si obtenerSaludInstagram falla, el contexto sigue armándose sin ese dato, nunca lanza un error crudo", async () => {
    obtenerSaludInstagramMock.mockRejectedValue(new Error("fallo de red simulado"));
    const usuario = {
      id: "user-resiliente-1",
      email: "resiliente1@quiubot.test",
      meta_page_id: "page-2",
      meta_access_token: "token-2",
      meta_page_name: "Página de prueba",
      meta_ad_account_nombre: "Cuenta de prueba",
      meta_pixel_id: null,
      meta_pixel_nombre: null,
    };

    const contexto = await construirContextoNegocio(usuario);

    expect(contexto.conexionMeta.instagram).toEqual({ conectado: false, username: null, seguidores: null });
    // El resto del contexto (página, cuenta publicitaria) sigue
    // llegando bien -- un fallo de Meta no debe tumbar todo el turno.
    expect(contexto.conexionMeta.pagina).toBe("Página de prueba");
  });
});

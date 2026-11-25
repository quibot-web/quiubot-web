import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ClaseEnVivo from "./ClaseEnVivo";
import {
  ENLACE_COMUNIDAD,
  FIN_EN_VIVO,
  INICIO_CLASE,
  archivoIcs,
  enlaceGoogleCalendar,
  estadoClase,
  horaLocalSiDistinta,
  tiempoRestante,
} from "./evento";

vi.mock("@/auth", () => ({ auth: (fn: unknown) => fn }));
vi.mock("@/lib/adminCandado", () => ({ NOMBRE_COOKIE_ADMIN: "x", verificarCandadoAdmin: async () => true }));
const { default: middleware, esPaginaClasePublica } = await import("@/middleware");

const pedirSinSesion = async (ruta: string) => {
  const url = `https://quiubot.site${ruta}`;
  const req = { auth: null, url, nextUrl: new URL(url), cookies: { get: () => undefined }, headers: new Headers({ host: "quiubot.site" }) };
  const res = (await (middleware as unknown as (r: unknown) => Promise<Response | undefined>)(req)) as Response | undefined;
  return res?.headers.get("location") ?? "pasa";
};

const render = (ahora: number) => renderToString(createElement(ClaseEnVivo, { ahoraServidor: ahora }));

describe("/clase es pública", () => {
  it("la página, el .ics y las imágenes para compartir pasan sin sesión; el resto de la app sigue pidiendo login", async () => {
    for (const ruta of ["/clase", "/clase/calendario.ics", "/clase/opengraph-image.png"]) {
      expect(esPaginaClasePublica(ruta), ruta).toBe(true);
      expect(await pedirSinSesion(ruta), ruta).toBe("pasa");
    }
    expect(esPaginaClasePublica("/clases")).toBe(false);
    expect(await pedirSinSesion("/clases")).toMatch(/\/login/);
    expect(await pedirSinSesion("/contenido")).toMatch(/\/login/);
  });
});

describe("hora de la clase", () => {
  it("es el jueves 26 de noviembre de 2026 a las 8:00 p. m. de Colombia (01:00 UTC del 27)", () => {
    expect(new Date(INICIO_CLASE).toISOString()).toBe("2026-11-27T01:00:00.000Z");
    expect(FIN_EN_VIVO - INICIO_CLASE).toBe(4.5 * 3600 * 1000);
  });
});

describe("los tres estados según la hora", () => {
  const antes = Date.parse("2026-11-25T15:30:00Z");
  const justoAntes = INICIO_CLASE - 1;
  const alEmpezar = INICIO_CLASE;
  const casiTermina = FIN_EN_VIVO - 1;
  const despues = FIN_EN_VIVO;

  it("estadoClase cambia en los bordes exactos", () => {
    expect(estadoClase(antes)).toBe("antes");
    expect(estadoClase(justoAntes)).toBe("antes");
    expect(estadoClase(alEmpezar)).toBe("en_vivo");
    expect(estadoClase(casiTermina)).toBe("en_vivo");
    expect(estadoClase(despues)).toBe("terminada");
  });

  it("antes: cuenta regresiva con días, horas, minutos y segundos", () => {
    expect(tiempoRestante(antes)).toEqual({ dias: 1, horas: 9, minutos: 30, segundos: 0 });
    expect(tiempoRestante(justoAntes)).toEqual({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
    const html = render(antes);
    expect(html).toContain("La clase empieza en");
    expect(html).toContain('role="timer"');
    expect(html).toMatch(/>01<\/span><span class="unidad-nombre">días/);
    expect(html).toMatch(/>09<\/span><span class="unidad-nombre">horas/);
    expect(html).toContain("Agregar a mi calendario");
    expect(html).toContain("Cómo participar");
    expect(html).not.toContain("está en vivo");
    expect(html).not.toContain("La clase terminó");
  });

  it("en vivo: desde las 8:00 p. m. y durante 4 h 30 min", () => {
    for (const t of [alEmpezar, casiTermina]) {
      const html = render(t);
      expect(html).toContain("¡La clase está en vivo!");
      expect(html).not.toContain("La clase empieza en");
      expect(html).not.toContain("La clase terminó");
      expect(html).not.toContain("Cómo participar");
    }
  });

  it("después: la clase terminó, con el mismo botón", () => {
    const html = render(despues);
    expect(html).toContain("La clase terminó. Únete a la comunidad para la próxima");
    expect(html).not.toContain("La clase empieza en");
    expect(html).not.toContain("está en vivo");
    expect(html).not.toContain("Agregar a mi calendario");
    expect(html).not.toContain("Cómo participar");
  });
});

describe("botón principal", () => {
  it("en los tres estados abre el grupo de WhatsApp (sin parámetros de rastreo) en pestaña nueva", () => {
    expect(ENLACE_COMUNIDAD).toBe("https://chat.whatsapp.com/Lg8wjlX3JqULjmLaa5W6et");
    for (const t of [INICIO_CLASE - 60_000, INICIO_CLASE, FIN_EN_VIVO]) {
      const html = render(t);
      const boton = html.match(/<a[^>]*data-testid="boton-comunidad"[^>]*>/)?.[0] ?? "";
      expect(boton).toContain(`href="${ENLACE_COMUNIDAD}"`);
      expect(boton).toContain('target="_blank"');
      expect(boton).toContain('rel="noopener noreferrer"');
      expect(html).toContain("Unirme a la comunidad");
    }
  });
});

describe("calendario", () => {
  it("Google Calendar: 8:00 a 10:00 p. m. de Colombia con el enlace del grupo", () => {
    const u = new URL(enlaceGoogleCalendar());
    expect(u.searchParams.get("dates")).toBe("20261127T010000Z/20261127T030000Z");
    expect(u.searchParams.get("details")).toContain(ENLACE_COMUNIDAD);
    expect(u.searchParams.get("text")).toBe("Clase en vivo: cómo decide Meta qué anuncios mostrar");
  });

  it(".ics válido: horas en UTC, CRLF, líneas de máximo 75 bytes y el enlace del grupo", () => {
    const ics = archivoIcs();
    expect(ics).toContain("DTSTART:20261127T010000Z\r\n");
    expect(ics).toContain("DTEND:20261127T030000Z\r\n");
    for (const linea of ics.split("\r\n")) {
      expect(new TextEncoder().encode(linea).length).toBeLessThanOrEqual(75);
    }
    const desplegado = ics.replace(/\r\n /g, "");
    expect(desplegado).toContain(`URL:${ENLACE_COMUNIDAD}\r\n`);
    expect(desplegado).toContain(ENLACE_COMUNIDAD);
    expect(desplegado).toContain("SUMMARY:Clase en vivo: cómo decide Meta qué anuncios mostrar\r\n");
  });
});

describe("En tu hora", () => {
  it("no aparece si la hora local es la misma que en Colombia", () => {
    expect(horaLocalSiDistinta("America/Bogota")).toBeNull();
    expect(horaLocalSiDistinta("America/Lima")).toBeNull();
    expect(horaLocalSiDistinta(undefined)).toBeNull();
    expect(horaLocalSiDistinta("Zona/Inventada")).toBeNull();
  });

  it("aparece convertida cuando la zona es distinta", () => {
    expect(horaLocalSiDistinta("Europe/Madrid")).toMatch(/viernes.*27.*noviembre.*2:00/);
    expect(horaLocalSiDistinta("America/Mexico_City")).toMatch(/jueves.*26.*noviembre.*7:00/);
  });
});

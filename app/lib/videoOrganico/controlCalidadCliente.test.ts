import { describe, it, expect, vi } from "vitest";
import { ejecutarControlDeCalidadConReintentos, type ClasificacionQC } from "./controlCalidadCliente";

// Bug real (ronda M, probado en staging): ColaDeRender.tsx (/contenido)
// recompactaba UNA vez y subía el resultado al álbum sin volver a
// correr el control de calidad -- un silencio de 0.78s pasó igual. El
// arnés admin SIEMPRE revuelve a verificar después de recompactar;
// estos tests prueban que el loop compartido (que ambos usan desde
// esta ronda) hace lo mismo.
describe("ejecutarControlDeCalidadConReintentos", () => {
  it("aprobado en el primer intento: nunca llama a recompactar ni a rerenderizar", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValue({ tipo: "aprobado" });
    const recompactar = vi.fn();
    const rerenderizar = vi.fn();

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: { algo: true },
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado).toEqual({ aprobado: true, guion: "guion-0", blob: "blob-0", hallazgos: [], intentosRecompactacion: 0 });
    expect(correrQC).toHaveBeenCalledTimes(1);
    expect(recompactar).not.toHaveBeenCalled();
    expect(rerenderizar).not.toHaveBeenCalled();
  });

  it("falla por pausas: recompacta, RE-RENDERIZA, y vuelve a correr el control de calidad sobre el nuevo blob antes de aprobar", async () => {
    const correrQC = vi
      .fn<(b: string, g: string) => Promise<ClasificacionQC>>()
      .mockResolvedValueOnce({ tipo: "pausas" })
      .mockResolvedValueOnce({ tipo: "aprobado" });
    const recompactar = vi.fn().mockResolvedValue("guion-1");
    const rerenderizar = vi.fn().mockResolvedValue("blob-1");

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: { algo: true },
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado.aprobado).toBe(true);
    expect(resultado.guion).toBe("guion-1");
    expect(resultado.blob).toBe("blob-1");
    expect(resultado.intentosRecompactacion).toBe(1);
    expect(recompactar).toHaveBeenCalledTimes(1);
    expect(rerenderizar).toHaveBeenCalledWith("guion-1");
    // La prueba real del bug: correrQC se llama 2 veces -- antes del
    // recompactado y DESPUÉS, sobre blob-1 (no se sube blob-0 sin
    // reverificar).
    expect(correrQC).toHaveBeenCalledTimes(2);
    expect(correrQC).toHaveBeenNthCalledWith(2, "blob-1", "guion-1");
  });

  it("sigue con pausas después de agotar los reintentos: NUNCA aprueba, queda con los intentos gastados", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValue({ tipo: "pausas" });
    const recompactar = vi.fn().mockResolvedValue("guion-recompactado");
    const rerenderizar = vi.fn().mockResolvedValue("blob-recompactado");

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: { algo: true },
      maxIntentos: 3,
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado.aprobado).toBe(false);
    expect(correrQC).toHaveBeenCalledTimes(3);
    expect(recompactar).toHaveBeenCalledTimes(2);
    expect(resultado.hallazgos[0]).toMatch(/siguió con pausas largas/);
  });

  it("rechazado por contenido/visión: nunca intenta recompactar, aunque haya crudo disponible", async () => {
    const correrQC = vi
      .fn<(b: string, g: string) => Promise<ClasificacionQC>>()
      .mockResolvedValue({ tipo: "rechazado", hallazgos: ["pantalla vacía en la escena 3"] });
    const recompactar = vi.fn();
    const rerenderizar = vi.fn();

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: { algo: true },
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado.aprobado).toBe(false);
    expect(resultado.hallazgos).toEqual(["pantalla vacía en la escena 3"]);
    expect(recompactar).not.toHaveBeenCalled();
    expect(correrQC).toHaveBeenCalledTimes(1);
  });

  it("sin crudo disponible: no puede recompactar aunque el problema sea solo de pausas, se rechaza en el primer intento", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValue({ tipo: "pausas" });
    const recompactar = vi.fn();
    const rerenderizar = vi.fn();

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: undefined,
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado.aprobado).toBe(false);
    expect(recompactar).not.toHaveBeenCalled();
    expect(correrQC).toHaveBeenCalledTimes(1);
  });

  it("si recompactar falla (ej. la petición no responde ok), rechaza con un mensaje claro y no sigue reintentando", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValue({ tipo: "pausas" });
    const recompactar = vi.fn().mockResolvedValue(null);
    const rerenderizar = vi.fn();

    const resultado = await ejecutarControlDeCalidadConReintentos({
      blobInicial: "blob-0",
      guionInicial: "guion-0",
      crudo: { algo: true },
      correrQC,
      recompactar,
      rerenderizar,
    });

    expect(resultado.aprobado).toBe(false);
    expect(resultado.hallazgos[0]).toMatch(/No se pudo recompactar/);
    expect(correrQC).toHaveBeenCalledTimes(1);
    expect(rerenderizar).not.toHaveBeenCalled();
  });

  it("voz cortada en el primer render: se vuelve a renderizar la MISMA pieza (sin recompactar) y se aprueba si el segundo pasa", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValueOnce({ tipo: "voz", hallazgos: ['Se cortó el comienzo de "Escribe"'] }).mockResolvedValueOnce({ tipo: "aprobado" });
    const recompactar = vi.fn();
    const rerenderizar = vi.fn().mockResolvedValue("blob-2");
    const r = await ejecutarControlDeCalidadConReintentos({ blobInicial: "blob-1", guionInicial: "g", crudo: { x: 1 }, correrQC, recompactar, rerenderizar });
    expect(r.aprobado).toBe(true);
    expect(r.blob).toBe("blob-2");
    expect(rerenderizar).toHaveBeenCalledTimes(1);
    expect(recompactar).not.toHaveBeenCalled();
  });

  it("voz cortada dos veces: error visible con el motivo, sin un tercer render", async () => {
    const correrQC = vi.fn<(b: string, g: string) => Promise<ClasificacionQC>>().mockResolvedValue({ tipo: "voz", hallazgos: ['Se cortó el comienzo de "Escribe" (segundo 7.80 del video)'] });
    const rerenderizar = vi.fn().mockResolvedValue("blob-2");
    const r = await ejecutarControlDeCalidadConReintentos({ blobInicial: "blob-1", guionInicial: "g", crudo: null, correrQC, recompactar: vi.fn(), rerenderizar });
    expect(r.aprobado).toBe(false);
    expect(r.hallazgos[0]).toMatch(/La voz del video no pasó el control dos veces: Se cortó el comienzo de "Escribe"/);
    expect(rerenderizar).toHaveBeenCalledTimes(1);
    expect(correrQC).toHaveBeenCalledTimes(2);
  });
});

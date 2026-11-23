import { describe, expect, it } from "vitest";
import { palabrasFaltantes } from "./palabrasFaltantes";

const NARRACIONES = [
  { id: "e1", narracion: "Likes: muchos no garantizan ni un solo mensaje nuevo." },
  { id: "e3", narracion: "Escribe una pregunta concreta que la persona pueda responder por WhatsApp." },
  { id: "e6", narracion: "Sigue a Quiubot para más consejos de publicidad útil." },
];

describe("palabras faltantes (Whisper sobre el audio final vs. la narración)", () => {
  it("transcripción completa, con errores normales de Whisper (tildes, 'Kiubot', puntuación): no falta nada", () => {
    const t = "Likes, muchos no garantizan ni un solo mensaje nuevo. Escribe una pregunta concreta que la persona pueda responder por Whatsapp. Sigue a Kiubot para mas consejos de publicidad util.";
    expect(palabrasFaltantes(NARRACIONES, t)).toEqual([]);
  });

  it("falta la primera palabra de una frase: se reporta como primera de frase", () => {
    const t = "Likes, muchos no garantizan ni un solo mensaje nuevo. Una pregunta concreta que la persona pueda responder por WhatsApp. Sigue a Quiubot para más consejos de publicidad útil.";
    expect(palabrasFaltantes(NARRACIONES, t)).toEqual([{ palabra: "Escribe", escena_id: "e3", primeraDeFrase: true }]);
  });

  it("una palabra mordida que Whisper igual transcribe completa NO la detecta este control (por eso el principal es la energía)", () => {
    const t = "Likes, muchos no garantizan ni un solo mensaje nuevo. Escribe una pregunta concreta que la persona pueda responder por WhatsApp. Sigue a Quiubot para más consejos de publicidad útil.";
    expect(palabrasFaltantes(NARRACIONES, t)).toEqual([]);
  });

  it("palabras cortas que Whisper omite a mitad de frase no cuentan; una de contenido sí", () => {
    const t = "Likes, muchos no garantizan ni un solo mensaje nuevo. Escribe una pregunta concreta que la persona pueda responder por WhatsApp. Sigue Quiubot para más de publicidad útil.";
    expect(palabrasFaltantes(NARRACIONES, t)).toEqual([{ palabra: "consejos", escena_id: "e6", primeraDeFrase: false }]);
  });
});

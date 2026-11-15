// Relativo, no "@/..." -- ver el comentario en video/guion.schema.ts.
import type { AnalisisPieza } from "../../app/lib/analisisPieza";
import type { Escena, UsoGuion } from "../guion.schema";
import type { TemaGuion } from "../tema";
import type { MediaResuelto, MediosResueltos } from "./tipos";
import { GanchoTexto } from "./GanchoTexto";
import { ProblemaDato } from "./ProblemaDato";
import { ProductoHero } from "./ProductoHero";
import { BeneficiosLista } from "./BeneficiosLista";
import { ListaNumerada } from "./ListaNumerada";
import { RevelacionMarca } from "./RevelacionMarca";
import { OfertaPrecio } from "./OfertaPrecio";
import { ObjecionRespuesta } from "./ObjecionRespuesta";
import { DosOpciones } from "./DosOpciones";
import { Cta } from "./Cta";

export function renderizarEscena(
  escena: Escena,
  tema: TemaGuion,
  medios: MediosResueltos,
  analisisPiezas?: Record<string, AnalisisPieza>,
  uso: UsoGuion = "anuncio",
  medioDeFondo?: MediaResuelto | null
) {
  switch (escena.tipo) {
    case "gancho_texto":
      return <GanchoTexto escena={escena} tema={tema} medios={medios} analisisPiezas={analisisPiezas} uso={uso} medioDeFondo={medioDeFondo} />;
    case "problema_dato":
      return <ProblemaDato escena={escena} tema={tema} medios={medios} uso={uso} />;
    case "producto_hero":
      return <ProductoHero escena={escena} tema={tema} medios={medios} analisisPiezas={analisisPiezas} uso={uso} />;
    case "beneficios_lista":
      return <BeneficiosLista escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
    case "lista_numerada":
      return <ListaNumerada escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
    case "revelacion_marca":
      return <RevelacionMarca escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
    case "oferta_precio":
      return <OfertaPrecio escena={escena} tema={tema} medios={medios} uso={uso} />;
    case "objecion_respuesta":
      return <ObjecionRespuesta escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
    case "dos_opciones":
      return <DosOpciones escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
    case "cta":
      return <Cta escena={escena} tema={tema} medios={medios} uso={uso} medioDeFondo={medioDeFondo} />;
  }
}

export type { MediosResueltos } from "./tipos";

import { TARJETA_ANCHO_PORCENTAJE } from "./geometria";
import {
  TAMANO_FUENTE_SUBTITULOS,
  TAMANO_FUENTE_BOTON,
  TAMANO_FUENTE_CONTADOR_GIGANTE,
  TAMANO_FUENTE_MENSAJE,
  TAMANO_FUENTE_NOTIFICACION,
  TAMANO_FUENTE_NUMERO_GIGANTE,
  TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE,
} from "./tamanos";

// Regla de escala del molde aprobado, pedida explícita (revisión de
// staging, 16 nov 2026): el elemento principal ocupa 70-85% del ancho
// dentro de la zona segura, y los textos de visuales/subtítulos/
// titulares tienen 40px o más a 1080 de ancho -- caso real que la
// motivó: "boton_estado"/"cursor_clic"/"contador" se reutilizaron sin
// su escala real (una tarjeta de 130px perdida en medio de fondo
// vacío, subtítulos a 38px).
//
// A diferencia de validarEdicionDesdeAudio()/validarEstructuraConsejosNumeradosAudio()
// (que validan el GUION que escribió la IA, distinto cada vez), esto
// valida los CONSTANTES de geometría del propio molde -- no cambian
// por guion, así que esto es más un chequeo de REGRESIÓN (si alguien
// vuelve a achicar un tamaño en el código, esto lo atrapa antes de
// gastar en render+visión) que algo que varíe corrida a corrida. Se
// corre igual en cada intento del arnés (pedido explícito: "para que
// una escena diminuta falle antes de llegar al modelo de visión") --
// si el molde está bien, el costo es solo evaluar unas comparaciones.
export type HallazgoGeometria = { elemento: string; mensaje: string };

const ANCHO_MINIMO_PORCENTAJE = 70;
const ANCHO_MAXIMO_PORCENTAJE = 85;
const TAMANO_FUENTE_MINIMO = 40;

// Lógica pura aparte (recibe los valores, no los importa) para poder
// probar el umbral con casos sintéticos de sobra y de falla -- las
// constantes reales del molde solo se pueden "ver pasar", nunca
// "ver fallar", sin esto.
export function compararGeometria(anchoTarjetaPorcentaje: number, tamanosDeFuente: { nombre: string; valor: number }[]): HallazgoGeometria[] {
  const hallazgos: HallazgoGeometria[] = [];

  if (anchoTarjetaPorcentaje < ANCHO_MINIMO_PORCENTAJE || anchoTarjetaPorcentaje > ANCHO_MAXIMO_PORCENTAJE) {
    hallazgos.push({
      elemento: "TARJETA_ANCHO_PORCENTAJE",
      mensaje: `El elemento principal (tarjeta/zona visual) ocupa ${anchoTarjetaPorcentaje}% del ancho -- debe estar entre ${ANCHO_MINIMO_PORCENTAJE}% y ${ANCHO_MAXIMO_PORCENTAJE}%, como en el molde aprobado.`,
    });
  }

  for (const { nombre, valor } of tamanosDeFuente) {
    if (valor < TAMANO_FUENTE_MINIMO) {
      hallazgos.push({ elemento: nombre, mensaje: `${nombre} es ${valor}px -- debe ser ${TAMANO_FUENTE_MINIMO}px o más a 1080 de ancho, como en el molde aprobado.` });
    }
  }

  return hallazgos;
}

export function validarGeometriaMinima(): HallazgoGeometria[] {
  return compararGeometria(TARJETA_ANCHO_PORCENTAJE, [
    { nombre: "SubtitulosSincronizados.TAMANO_FUENTE_SUBTITULOS", valor: TAMANO_FUENTE_SUBTITULOS },
    { nombre: "BotonEstado.TAMANO_FUENTE_BOTON", valor: TAMANO_FUENTE_BOTON },
    { nombre: "Contador.TAMANO_FUENTE_CONTADOR_GIGANTE", valor: TAMANO_FUENTE_CONTADOR_GIGANTE },
    { nombre: "CelularChat.TAMANO_FUENTE_MENSAJE", valor: TAMANO_FUENTE_MENSAJE },
    { nombre: "CelularChat.TAMANO_FUENTE_NOTIFICACION", valor: TAMANO_FUENTE_NOTIFICACION },
    { nombre: "CelularChat.TAMANO_FUENTE_NUMERO_GIGANTE", valor: TAMANO_FUENTE_NUMERO_GIGANTE },
    { nombre: "CelularChat.TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE", valor: TAMANO_FUENTE_ETIQUETA_NUMERO_GIGANTE },
  ]);
}

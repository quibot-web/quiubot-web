// Datos y lógica pura de la clase en vivo de /clase (sin React, sin base de
// datos) -- así los tres estados según la hora, la cuenta regresiva y los
// enlaces de calendario se prueban con fechas fijas en clase.test.ts.

export const ENLACE_COMUNIDAD = "https://chat.whatsapp.com/Lg8wjlX3JqULjmLaa5W6et";

export const TITULO_CLASE = "Clase en vivo: cómo decide Meta qué anuncios mostrar";
export const SUBTITULO_CLASE =
  "Una clase gratuita para dueños de negocios que quieren vender con anuncios en Facebook e Instagram";

// Jueves 26 de noviembre de 2026, 8:00 p. m. hora de Colombia (UTC-5, sin
// horario de verano) = 01:00 UTC del viernes 27.
export const INICIO_CLASE = Date.parse("2026-11-27T01:00:00Z");
// En el calendario la clase va de 8:00 a 10:00 p. m. hora de Colombia.
export const FIN_CALENDARIO = Date.parse("2026-11-27T03:00:00Z");
// En la página se muestra "en vivo" durante 4 h 30 min desde el inicio.
export const DURACION_EN_VIVO_MS = (4 * 60 + 30) * 60 * 1000;
export const FIN_EN_VIVO = INICIO_CLASE + DURACION_EN_VIVO_MS;

export const ZONA_COLOMBIA = "America/Bogota";

export type EstadoClase = "antes" | "en_vivo" | "terminada";

export function estadoClase(ahora: number): EstadoClase {
  if (ahora < INICIO_CLASE) return "antes";
  if (ahora < FIN_EN_VIVO) return "en_vivo";
  return "terminada";
}

export type Restante = { dias: number; horas: number; minutos: number; segundos: number };

export function tiempoRestante(ahora: number): Restante {
  const totalSeg = Math.max(0, Math.floor((INICIO_CLASE - ahora) / 1000));
  return {
    dias: Math.floor(totalSeg / 86400),
    horas: Math.floor((totalSeg % 86400) / 3600),
    minutos: Math.floor((totalSeg % 3600) / 60),
    segundos: totalSeg % 60,
  };
}

const FORMATO_FECHA_HORA: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

export function fechaHoraEnZona(zona: string): string {
  return new Intl.DateTimeFormat("es-CO", { ...FORMATO_FECHA_HORA, timeZone: zona }).format(INICIO_CLASE);
}

// "En tu hora: …" solo cuando la hora local del visitante es distinta de la
// de Colombia (Lima o Bogotá dan la misma hora y no muestran nada). Si la
// zona no es válida o el navegador no la informa, no se muestra.
export function horaLocalSiDistinta(zonaVisitante: string | undefined): string | null {
  if (!zonaVisitante) return null;
  try {
    const local = fechaHoraEnZona(zonaVisitante);
    if (local === fechaHoraEnZona(ZONA_COLOMBIA)) return null;
    const nombreZona = new Intl.DateTimeFormat("es-CO", { timeZone: zonaVisitante, timeZoneName: "short" })
      .formatToParts(INICIO_CLASE)
      .find((p) => p.type === "timeZoneName")?.value;
    return nombreZona ? `${local} (${nombreZona})` : local;
  } catch {
    return null;
  }
}

const DESCRIPCION_CALENDARIO =
  `${SUBTITULO_CLASE}.\n\nÚnete a la comunidad de WhatsApp: ${ENLACE_COMUNIDAD}`;

function utcCompacto(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function enlaceGoogleCalendar(): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: TITULO_CLASE,
    dates: `${utcCompacto(INICIO_CLASE)}/${utcCompacto(FIN_CALENDARIO)}`,
    details: DESCRIPCION_CALENDARIO,
    location: ENLACE_COMUNIDAD,
    ctz: ZONA_COLOMBIA,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function escaparIcs(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545: líneas de máximo 75 octetos; las siguientes empiezan con un
// espacio. Se corta por bytes UTF-8 sin partir caracteres (tildes, ñ).
function plegarLinea(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  const utf8 = new TextEncoder();
  for (const ch of linea) {
    const b = utf8.encode(ch).length;
    const limite = partes.length === 0 ? 75 : 74;
    if (bytes + b > limite) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += ch;
    bytes += b;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export function archivoIcs(): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quiubot//Clase en vivo//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:clase-meta-anuncios-20261126@quiubot.site",
    "DTSTAMP:20261124T000000Z",
    `DTSTART:${utcCompacto(INICIO_CLASE)}`,
    `DTEND:${utcCompacto(FIN_CALENDARIO)}`,
    `SUMMARY:${escaparIcs(TITULO_CLASE)}`,
    `DESCRIPTION:${escaparIcs(DESCRIPCION_CALENDARIO)}`,
    `LOCATION:${escaparIcs(ENLACE_COMUNIDAD)}`,
    `URL:${ENLACE_COMUNIDAD}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:La clase empieza en 30 minutos",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.map(plegarLinea).join("\r\n") + "\r\n";
}

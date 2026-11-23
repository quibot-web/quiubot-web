// Nombre legible del navegador que renderiza los videos (la cola de
// /contenido y el arnés del reel ilustrado lo muestran: Safari y Chrome
// rinden distinto). Puro, a partir del user agent.
export function nombreNavegador(ua: string): string {
  const v = (re: RegExp) => ua.match(re)?.[1]?.split(".").slice(0, 2).join(".");
  if (/Edg\//.test(ua)) return `Edge ${v(/Edg\/([\d.]+)/) ?? ""}`.trim();
  if (/OPR\//.test(ua)) return `Opera ${v(/OPR\/([\d.]+)/) ?? ""}`.trim();
  if (/Firefox\//.test(ua)) return `Firefox ${v(/Firefox\/([\d.]+)/) ?? ""}`.trim();
  if (/CriOS\//.test(ua)) return `Chrome ${v(/CriOS\/([\d.]+)/) ?? ""}`.trim();
  if (/Chrome\//.test(ua)) return `Chrome ${v(/Chrome\/([\d.]+)/) ?? ""}`.trim();
  if (/Safari\//.test(ua)) return `Safari ${v(/Version\/([\d.]+)/) ?? ""}`.trim();
  return "Navegador desconocido";
}

export function esSafari(ua: string): boolean {
  return nombreNavegador(ua).startsWith("Safari");
}

// "Hoy" / "Ayer" / "3 de nov." para los separadores de fecha del chat
// -- comparación por fecha local, no por diferencia de horas (un
// mensaje de las 11:58pm y otro de las 12:02am del día siguiente son
// días distintos aunque falten minutos entre ellos).
export function etiquetaFecha(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);

  const mismoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (mismoDia(fecha, hoy)) return "Hoy";
  if (mismoDia(fecha, ayer)) return "Ayer";
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

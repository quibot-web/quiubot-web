import BienvenidaExperience from "./BienvenidaExperience";

export const metadata = {
  title: "Publicidad con IA para tu negocio",
  description:
    "Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor que vigila tus campañas todo el tiempo. Prueba gratis 7 días.",
};

// force-dynamic: sin esto, Next podría prerenderizar esta página UNA
// sola vez en el build y servir ese mismo HTML siempre -- y entonces
// ?vista=autopiloto nunca se leería por request en el servidor
// desplegado (lo confirmé viendo el build: sin este export, la ruta
// salía marcada "○ Static"). Con el interruptor apagado (como hoy en
// producción), esto no cambia nada que el visitante vea -- solo hace
// que el servidor renderice la página en cada visita en vez de servir
// HTML cacheado desde el build, que es justo lo que hace falta para
// que la vista previa pueda reaccionar a cada URL distinta.
export const dynamic = "force-dynamic";

// Vista previa de la Parte B (Autopiloto) sin tocar AUTOPILOTO_PUBLICO
// -- solo funciona en el deploy de staging (rama "dev" en Coolify) con
// ?vista=autopiloto en la URL. En producción (cualquier otra rama) el
// parámetro ni siquiera se lee: esStaging corta antes de tocar
// searchParams, así que no hay manera de activarlo ahí por accidente.
export default async function BienvenidaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const esStaging = process.env.COOLIFY_BRANCH === "dev";
  const vista = esStaging ? (await searchParams).vista : undefined;

  return <BienvenidaExperience forzarAutopiloto={vista === "autopiloto"} />;
}

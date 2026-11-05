// Fase 2, Commit 4 -- /decisiones queda como redirect a /equipo (el
// grupo la reemplaza, no la complementa). El filtro ?asistente= se
// conserva igual en el destino.
import { redirect } from "next/navigation";

export default async function DecisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ asistente?: string }>;
}) {
  const { asistente } = await searchParams;
  redirect(asistente ? `/equipo?asistente=${asistente}` : "/equipo");
}

import BienvenidaExperience from "./BienvenidaExperience";
import { DIAS_PRUEBA } from "@/app/lib/planesConfig";

export const metadata = {
  title: "Publicidad con IA para tu negocio",
  description: `Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor que vigila tus campañas todo el tiempo. Prueba gratis ${DIAS_PRUEBA} días.`,
};

export default function BienvenidaPage() {
  return <BienvenidaExperience />;
}

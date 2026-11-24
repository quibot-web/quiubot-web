// Prototipo de la tanda 1 del kit (visuales-v2, 23 nov 2026): la idea de
// la cartelera del salón. Instagram (feed) -> cartelera con muchos dibujos
// y un solo espacio -> la profesora elige el dibujo que les gusta a los
// niños (no el del niño que le trae dulces) -> niños felices aplaudiendo ->
// anuncio con el producto -> cierre con el perfil y "Seguir".
// Es un plan como los que escribirá la IA: solo datos de listas cerradas.
import { ComposicionKitSchema } from "./catalogoKit";
import type { PlanIlustrado } from "../motor/plan";

export const NARRACION_PROTOTIPO_KIT = [
  { id: "e1", narracion: "Tu feed de Instagram es como la cartelera del salón." },
  { id: "e2", narracion: "Hay muchísimos dibujos y un solo espacio libre." },
  { id: "e3", narracion: "La profesora no elige el dibujo del niño que le trae dulces;" },
  { id: "e4", narracion: "elige el que a los niños les encanta mirar." },
  { id: "e5", narracion: "Y cuando les gusta, todos aplauden." },
  { id: "e6", narracion: "Igual con tu anuncio: muestra tu producto en uso." },
  { id: "e7", narracion: "Síguenos para más ideas como esta." },
];

export const COMPOSICION_SALON = ComposicionKitSchema.parse({
  id: "k_salon",
  fondo: "salon",
  pared: "crema",
  personajes: [
    { id: "nina2", tipo: "nina", posicion: "izquierda", mira: "derecha" },
    { id: "nino2", tipo: "nino", posicion: "centro_izquierda", mira: "derecha" },
    { id: "nina", tipo: "nina", posicion: "centro", mira: "derecha", peinado: "colitas", pelo: "pelirrojo", piel: "clara", ropa: "rosado", ropa2: "verde" },
    { id: "nino", tipo: "nino", posicion: "centro_derecha", mira: "derecha", peinado: "rizado", pelo: "negro", piel: "morena", ropa: "amarillo", ropa2: "azul" },
    { id: "profesora", tipo: "profesora", posicion: "derecha", mira: "izquierda", peinado: "mono", pelo: "castano", piel: "triguena", ropa: "turquesa", ropa2: "morado", accesorio: "gafas" },
  ],
  objetos: [
    { id: "cartelera", tipo: "cartelera", lugar: "pared_centro", visible: false },
    { id: "dulces", tipo: "dulces", en_mano_de: "nino" },
    { id: "dibujo_nina", tipo: "dibujo", en_mano_de: "nina", motivo: "arcoiris" },
  ],
});

export const PLAN_PROTOTIPO_KIT: PlanIlustrado = {
  composiciones: [COMPOSICION_SALON],
  frases: [
    { escena_id: "e1", acciones: [{ escena: "feed", accion: "desliza", palabra: 1 }, { escena: "k_salon", accion: "cartelera.aparece", palabra: 7 }] },
    { escena_id: "e2", acciones: [{ escena: "k_salon", accion: "micro", palabra: 1 }, { escena: "k_salon", accion: "cartelera.destaca_hueco", palabra: 6 }] },
    {
      escena_id: "e3",
      acciones: [
        { escena: "k_salon", accion: "profesora.quieto", palabra: 1 },
        { escena: "k_salon", accion: "nino.ofrece", palabra: 7, objetivo: "profesora" },
        { escena: "k_salon", accion: "dulces.destaca", palabra: 11 },
      ],
    },
    {
      escena_id: "e4",
      acciones: [
        { escena: "k_salon", accion: "profesora.senala", palabra: 0, objetivo: "dibujo_nina" },
        { escena: "k_salon", accion: "nino.triste", palabra: 2 },
        { escena: "k_salon", accion: "dibujo_nina.va_al_hueco", palabra: 5 },
        { escena: "k_salon", accion: "nina.feliz", palabra: 7 },
      ],
    },
    {
      escena_id: "e5",
      acciones: [
        { escena: "k_salon", accion: "nina.celebra", palabra: 0 },
        { escena: "k_salon", accion: "nino.feliz", palabra: 1 },
        { escena: "k_salon", accion: "profesora.feliz", palabra: 2 },
        { escena: "k_salon", accion: "nino.aplaude", palabra: 3 },
        { escena: "k_salon", accion: "nino2.aplaude", palabra: 4 },
        { escena: "k_salon", accion: "nina2.aplaude", palabra: 5 },
      ],
    },
    { escena_id: "e6", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 2 }, { escena: "feed", accion: "se_detiene", palabra: 6 }] },
    { escena_id: "e7", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 2 }] },
  ],
};

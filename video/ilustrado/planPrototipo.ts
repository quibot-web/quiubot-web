// Plan ilustrado del prototipo "Por qué tus anuncios no venden" (v2
// aprobada el 18 nov 2026), ahora con las escenas y acciones del
// catálogo: qué palabra de cada frase dispara qué acción. Los índices
// son posiciones de palabra en NARRACION_PROTOTIPO.
import type { PlanIlustrado } from "./motor/plan";
import type { MarcaIlustrada } from "./motor/escenas/tipos";

export const PLAN_PROTOTIPO: PlanIlustrado = {
  frases: [
    // Pagas anuncios… y nadie te compra.
    { escena_id: "e1", acciones: [{ escena: "feed", accion: "aparece_anuncio", palabra: 1 }, { escena: "feed", accion: "desliza", palabra: 2 }] },
    // La gente ve tu anuncio y pasa de largo.
    {
      escena_id: "e2",
      acciones: [
        { escena: "feed", accion: "aparece_anuncio", palabra: 1 },
        { escena: "feed", accion: "lo_miran", palabra: 2 },
        { escena: "feed", accion: "pasa_de_largo", palabra: 6 },
      ],
    },
    // Y cada vez que pasa, se te va una moneda.
    {
      escena_id: "e3",
      acciones: [
        { escena: "billetera", accion: "sale_moneda", palabra: 4 },
        { escena: "billetera", accion: "sale_moneda", palabra: 7 },
        { escena: "billetera", accion: "sale_moneda", palabra: 9 },
      ],
    },
    // Primer error: le hablas a todo el mundo.
    { escena_id: "e4", acciones: [{ escena: "multitud", accion: "foco_barre", palabra: 3 }, { escena: "multitud", accion: "todos_tenues", palabra: 7 }] },
    // Elige a quién, y se iluminan los que sí pueden comprarte.
    { escena_id: "e5", acciones: [{ escena: "multitud", accion: "se_iluminan", palabra: 5 }, { escena: "multitud", accion: "miran_arriba", palabra: 10 }] },
    // Segundo: tu foto no detiene el dedo.
    { escena_id: "e6", acciones: [{ escena: "feed", accion: "foto_apagada", palabra: 2 }, { escena: "feed", accion: "desliza", palabra: 6 }] },
    // Una foto clara, con el producto en uso, sí lo detiene.
    {
      escena_id: "e7",
      acciones: [
        { escena: "feed", accion: "foto_se_aclara", palabra: 2 },
        // "producto": la gente mira la foto (y no pasan más de 7 palabras sin cambio).
        { escena: "feed", accion: "lo_miran", palabra: 5 },
        { escena: "feed", accion: "se_detiene", palabra: 10 },
      ],
    },
    // Tercero: te escriben… y nadie responde.
    {
      escena_id: "e8",
      acciones: [
        { escena: "chat", accion: "llega_mensaje", palabra: 1 },
        { escena: "chat", accion: "llega_mensaje", palabra: 2 },
        { escena: "reloj_cliente", accion: "reloj_acelera", palabra: 4 },
        { escena: "reloj_cliente", accion: "cliente_se_va", palabra: 5 },
      ],
    },
    // Responde rápido y ese mensaje se vuelve venta.
    {
      escena_id: "e9",
      acciones: [
        { escena: "chat", accion: "responde", palabra: 0 },
        { escena: "chat", accion: "llega_mensaje", palabra: 3 },
        // "se" (no "vuelve"): deja ~0,6 s antes de "venta", que está en otra isla.
        { escena: "chat", accion: "se_vuelve_venta", palabra: 5 },
        { escena: "billetera", accion: "recibe_moneda", palabra: 7 },
      ],
    },
    // Así tu presupuesto deja de irse… y empieza a volver.
    { escena_id: "e10", acciones: [{ escena: "billetera", accion: "se_cierra", palabra: 5 }, { escena: "billetera", accion: "se_llena", palabra: 7 }] },
    // Sigue a Quiubot para más trucos de anuncios.
    { escena_id: "e11", acciones: [{ escena: "perfil", accion: "aparece", palabra: 0 }, { escena: "perfil", accion: "toque_seguir", palabra: 2 }] },
  ],
};

// Marca del prototipo (fase 1). Respuesta del chat neutra: no promete
// nada (ni precio ni envío) que una marca real podría no ofrecer.
export const MARCA_PROTOTIPO: MarcaIlustrada = {
  nombreTienda: "quiubot",
  colorMarca: "#534AB7",
  colorSecundario: "#B9B2FF",
  inicial: "Q",
  descripcionPerfil: "Trucos de anuncios para tu negocio",
  chat: { cliente: ["Hola", "¿Precio?", "¡Lo quiero!"], respuesta: "¡Hola! Ya te ayudo" },
};

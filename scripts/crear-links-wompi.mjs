/**
 * Crea los 4 links de pago de Quiubot en Wompi VIA API (no por el panel),
 * porque solo la API permite configurar "redirect_url".
 *
 * COMO CORRERLO (una sola vez, en tu propia terminal, NUNCA le pegues tu llave
 * privada a Claude ni a nadie mas):
 *
 *   1. Ve a Wompi -> Configuracion -> Llaves API (API Keys).
 *   2. Copia tu "Llave privada" (empieza con prv_prod_... para produccion real,
 *      o prv_test_... si primero quieres probar en sandbox).
 *   3. En CMD, dentro de la carpeta del proyecto, corre:
 *
 *      set WOMPI_PRIVATE_KEY=prv_prod_TU_LLAVE_AQUI
 *      node scripts/crear-links-wompi.mjs
 *
 *   4. El script va a imprimir 4 links nuevos (checkout.wompi.co/l/xxxxx).
 *      Copia esos 4 y pegaselos a Claude para actualizar LINKS_WOMPI en
 *      app/billing/page.tsx.
 *   5. Cuando confirmes que los nuevos funcionan, desactiva los 4 links viejos
 *      desde el panel de Wompi (boton "Desactivar link").
 */

const WOMPI_PRIVATE_KEY = process.env.WOMPI_PRIVATE_KEY;

if (!WOMPI_PRIVATE_KEY) {
  console.error("Falta la variable de entorno WOMPI_PRIVATE_KEY. Revisa las instrucciones en la parte de arriba de este archivo.");
  process.exit(1);
}

const API_BASE = WOMPI_PRIVATE_KEY.startsWith("prv_test_")
  ? "https://sandbox.wompi.co/v1"
  : "https://production.wompi.co/v1";

const REDIRECT_URL = "https://quiubot.site/pago-exitoso";

const LINKS_A_CREAR = [
  {
    clave: "crecimiento",
    name: "Quiubot - Plan Crecimiento",
    description:
      "Suscripción mensual al plan Crecimiento de Quiubot: 4 estrategias nuevas por mes, todos los objetivos publicitarios, Playbook vigilando 2 campañas, alertas y sugerencias inteligentes.",
    amount_in_cents: 14990000, // $149.900
  },
  {
    clave: "escala",
    name: "Quiubot - Plan Escala",
    description:
      "Suscripción mensual al plan Escala de Quiubot: estrategias nuevas ilimitadas, todos los objetivos publicitarios, Playbook vigilando todas tus campañas, alertas y sugerencias con prioridad.",
    amount_in_cents: 24990000, // $249.900
  },
  {
    clave: "crecimiento_anual",
    name: "Quiubot - Plan Crecimiento Anual",
    description:
      "Suscripción anual al plan Crecimiento de Quiubot: 4 estrategias nuevas por mes, todos los objetivos publicitarios, Playbook vigilando 2 campañas, alertas y sugerencias inteligentes. Precio congelado por 12 meses.",
    amount_in_cents: 152898000, // $1.528.980
  },
  {
    clave: "escala_anual",
    name: "Quiubot - Plan Escala Anual",
    description:
      "Suscripción anual al plan Escala de Quiubot: estrategias nuevas ilimitadas, todos los objetivos publicitarios, Playbook vigilando todas tus campañas, alertas y sugerencias con prioridad. Precio congelado por 12 meses.",
    amount_in_cents: 254898000, // $2.548.980
  },
];

async function crearLink(datos) {
  const res = await fetch(`${API_BASE}/payment_links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WOMPI_PRIVATE_KEY}`,
    },
    body: JSON.stringify({
      name: datos.name,
      description: datos.description,
      single_use: false,
      collect_shipping: false,
      currency: "COP",
      amount_in_cents: datos.amount_in_cents,
      redirect_url: REDIRECT_URL,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error creando "${datos.name}":`, JSON.stringify(data, null, 2));
    return null;
  }

  return data.data.id;
}

async function main() {
  console.log(`Creando links en: ${API_BASE}`);
  console.log(`Redireccion configurada a: ${REDIRECT_URL}\n`);

  const resultados = {};

  for (const link of LINKS_A_CREAR) {
    const id = await crearLink(link);
    if (id) {
      resultados[link.clave] = `https://checkout.wompi.co/l/${id}`;
      console.log(`✓ ${link.name}: https://checkout.wompi.co/l/${id}`);
    }
  }

  console.log("\n--- Pega esto en el chat con Claude ---");
  console.log(JSON.stringify(resultados, null, 2));
}

main();

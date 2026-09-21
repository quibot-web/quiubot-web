export const metadata = {
  title: "Eliminación de datos",
  description: "Cómo solicitar la eliminación de tus datos en Quiubot.",
};

export default function EliminarDatosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#fff", border: "1px solid #e8e8e6", borderRadius: 20, padding: "3rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <img src="/marca/icono-quiubot.svg" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: "#17152B" }}>
            quiu<span style={{ color: "#7F77DD" }}>bot</span>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#17152B", marginTop: 24, marginBottom: 4 }}>
          Eliminación de datos
        </h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 32 }}>
          Última actualización: septiembre de 2026
        </p>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: "#333" }}>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>1. Qué datos guarda Quiubot</h2>
            <p>
              Al usar Quiubot, guardamos la siguiente información asociada a tu cuenta:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>
                <strong>Datos de tu cuenta:</strong> nombre, correo electrónico, plan de
                suscripción, y las credenciales de terceros que conectas (OpenAI, Cloudinary),
                guardadas cifradas.
              </li>
              <li>
                <strong>Datos de tu cuenta de Meta conectada:</strong> token de acceso, cuenta
                publicitaria, página de Facebook, y píxel — todo lo necesario para publicar y
                monitorear tus campañas en Meta Ads.
              </li>
              <li>
                <strong>ADN de marca:</strong> el análisis de identidad visual que genera
                Quiubot a partir de tus creativos.
              </li>
              <li>
                <strong>Estrategias, creativos y videos generados</strong> con inteligencia
                artificial a través de la plataforma.
              </li>
              <li>
                <strong>Campañas publicadas</strong> y el historial de su rendimiento.
              </li>
              <li>
                <strong>Notificaciones</strong> que te ha enviado la plataforma.
              </li>
              <li>
                <strong>Conversaciones con el asistente</strong> de Quiubot dentro de la app.
              </li>
              <li>
                <strong>Progreso de tutoriales</strong> vistos dentro de la plataforma.
              </li>
              <li>
                <strong>Órdenes de pago</strong> asociadas a tu suscripción.
              </li>
              <li>
                <strong>Señales de registro</strong> capturadas al crear tu cuenta o conectar
                Meta, usadas para prevenir fraude.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>2. Cómo solicitar la eliminación de tus datos</h2>
            <p>
              Hoy la eliminación de cuenta todavía no está disponible como un botón dentro de
              la plataforma — para solicitarla, escríbenos a{" "}
              <a href="mailto:admin@quiubot.site?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos" style={linkStyle}>
                admin@quiubot.site
              </a>{" "}
              desde el mismo correo con el que tienes tu cuenta registrada, indicando que
              quieres eliminar tu cuenta y tus datos.
            </p>
            <p>
              Para verificar tu identidad y procesar la solicitud más rápido, incluye en el
              correo el correo exacto con el que te registraste en Quiubot.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>3. Qué pasa con tu conexión a Meta</h2>
            <p>
              Si conectaste tu cuenta de Meta (Facebook/Instagram) a Quiubot, al procesar tu
              solicitud eliminamos el token de acceso y los datos de tu cuenta publicitaria,
              página y píxel que teníamos guardados. Esto no afecta a tu cuenta de Meta en sí
              — solo elimina la conexión y los datos que Quiubot había guardado de ella.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>4. Cuánto tarda</h2>
            <p>
              Procesamos las solicitudes de eliminación en un plazo máximo de{" "}
              <strong>30 días calendario</strong> desde que confirmamos tu identidad. Te
              avisaremos por correo cuando el proceso haya terminado.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#17152B",
  marginBottom: 8,
};

const linkStyle: React.CSSProperties = {
  color: "#7F77DD",
  fontWeight: 600,
  textDecoration: "none",
};

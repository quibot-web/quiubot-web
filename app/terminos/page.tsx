export const metadata = {
  title: "Términos y Condiciones",
  description: "Términos y condiciones de uso de Quiubot.",
};

export default function TerminosPage() {
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
          Términos y Condiciones de Uso
        </h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 32 }}>
          Última actualización: julio de 2026
        </p>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: "#333" }}>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>1. Identificación del prestador del servicio</h2>
            <p>
              Quiubot es un nombre comercial operado por <strong>Juan José Palacios Villarreal</strong>,
              persona natural identificada con NIT/RUT <em>[en trámite ante la DIAN]</em>, con domicilio
              en Colombia. El servicio se presta a través del sitio web <strong>quiubot.site</strong>.
            </p>
            <p>
              Correo de contacto: <a href="mailto:hola@quiubot.site" style={linkStyle}>hola@quiubot.site</a><br />
              Teléfono de contacto: <em>[teléfono de la empresa — pendiente de reemplazar]</em>
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>2. Objeto del servicio</h2>
            <p>
              Quiubot es una plataforma que utiliza inteligencia artificial para generar estrategia
              publicitaria, creativos y campañas para redes sociales (Meta Ads), y para monitorear y
              sugerir ajustes sobre campañas activas. El servicio se ofrece bajo modalidad de suscripción,
              con un período de prueba gratuita de 7 días para nuevos usuarios.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>3. Cuentas de terceros conectadas por el usuario</h2>
            <p>
              Para usar ciertas funciones de Quiubot, el usuario debe conectar sus propias credenciales
              de servicios de terceros — incluyendo, sin limitarse a, OpenAI, Cloudinary y Meta Ads
              (Facebook/Instagram). El usuario es responsable de mantener vigentes dichas credenciales y
              de los costos que dichos terceros le facturen directamente por su uso. Quiubot no participa
              en la facturación de esos servicios y no es responsable de cambios en las políticas,
              precios o disponibilidad de esos terceros.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>4. Planes, pagos y reembolsos</h2>
            <p>
              Quiubot ofrece distintos planes de suscripción, detallados en la página de precios de la
              plataforma. Todo usuario nuevo recibe automáticamente 7 días de prueba gratuita con acceso
              completo antes de que se le solicite realizar cualquier pago.
            </p>
            <p>
              <strong>Quiubot no ofrece reembolsos</strong> sobre pagos ya realizados. El período de
              prueba gratuita constituye la oportunidad del usuario para evaluar la plataforma antes de
              decidir suscribirse a un plan pago.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>5. Uso aceptable de la plataforma</h2>
            <p>
              El usuario se compromete a utilizar Quiubot únicamente para fines lícitos, y a no emplear
              la plataforma para generar contenido publicitario que infrinja la ley colombiana, las
              políticas de publicidad de Meta, o los derechos de terceros. Quiubot se reserva el derecho
              de suspender cuentas que incumplan esta condición.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>6. Propiedad intelectual</h2>
            <p>
              El nombre "Quiubot", su logotipo y la identidad visual de la plataforma son propiedad de
              Juan José Palacios Villarreal. El usuario conserva la propiedad de los creativos e imágenes
              que genera o sube a través de la plataforma.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>7. Tratamiento de datos personales</h2>
            <p>
              Quiubot trata los datos personales de sus usuarios de acuerdo con la Ley 1581 de 2012 y
              demás normas colombianas de protección de datos. Los datos recolectados (nombre, correo
              electrónico, y datos de uso de la plataforma) se usan exclusivamente para prestar el
              servicio y no se comparten con terceros distintos a los proveedores estrictamente
              necesarios para operar la plataforma (como Google, para autenticación, y Supabase, como
              base de datos).
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>8. Limitación de responsabilidad</h2>
            <p>
              Quiubot genera estrategias y creativos con apoyo de inteligencia artificial. No garantiza
              resultados específicos de ventas, alcance o rendimiento publicitario, ya que estos dependen
              de múltiples factores fuera del control de la plataforma, incluyendo las políticas y
              subastas propias de Meta Ads.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>9. Modificaciones a estos términos</h2>
            <p>
              Estos términos pueden actualizarse periódicamente. Los cambios entran en vigencia desde su
              publicación en esta misma página. El uso continuado de la plataforma después de una
              actualización constituye la aceptación de los términos modificados.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>10. Contacto</h2>
            <p>
              Para cualquier pregunta sobre estos términos, puedes escribir a{" "}
              <a href="mailto:hola@quiubot.site" style={linkStyle}>hola@quiubot.site</a>.
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
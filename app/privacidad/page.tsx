export const metadata = {
  title: "Política de Privacidad",
  description: "Política de tratamiento de datos personales de Quiubot, conforme a la Ley 1581 de 2012 (Colombia).",
};

export default function PrivacidadPage() {
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
          Política de Privacidad y Tratamiento de Datos Personales
        </h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 32 }}>
          Última actualización: noviembre de 2026
        </p>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: "#333" }}>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>1. Responsable del tratamiento</h2>
            <p>
              Quiubot es un nombre comercial operado por <strong>Juan José Palacios Villarreal</strong>,
              identificado con NIT/RUT <strong>1005870718-0</strong>, con domicilio en{" "}
              <strong>Carrera 1 # 78-11, Barrio Pettecuy Etapa 2, Cali, Valle del Cauca</strong>, Colombia.
            </p>
            <p>
              Correo de contacto para asuntos de protección de datos:{" "}
              <a href="mailto:juanjosepalaciosvillarreal@gmail.com" style={linkStyle}>juanjosepalaciosvillarreal@gmail.com</a>.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>2. Finalidades del tratamiento</h2>
            <p>
              Quiubot trata tus datos personales para:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>Crear y administrar tu cuenta, y prestarte el servicio de la plataforma.</li>
              <li>Generar, con apoyo de inteligencia artificial, estrategia publicitaria, creativos, contenido y campañas para tus redes sociales.</li>
              <li>Publicar y monitorear tus campañas en Meta Ads a través de tu cuenta de Meta conectada.</li>
              <li>Procesar el pago de tu suscripción y gestionar la facturación.</li>
              <li>Brindarte soporte y comunicarte novedades sobre el servicio.</li>
              <li>Prevenir fraude y proteger la seguridad de la plataforma.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>3. Datos que se tratan</h2>
            <p>
              Al usar Quiubot, tratamos la siguiente información asociada a tu cuenta:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>
                <strong>Datos de tu cuenta:</strong> nombre, correo electrónico, plan de
                suscripción, y las credenciales de terceros que conectas (OpenAI, Cloudinary),
                guardadas cifradas.
              </li>
              <li>
                <strong>Datos de tu cuenta de Meta conectada:</strong> token de acceso, cuenta
                publicitaria, página de Facebook, cuenta de Instagram, y píxel — todo lo
                necesario para publicar y monitorear tus campañas en Meta Ads.
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
            <h2 style={sectionTitle}>4. Terceros que procesan tus datos</h2>
            <p>
              Para prestar el servicio, Quiubot comparte o procesa datos a través de estos terceros:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>
                <strong>Meta (Facebook/Instagram Ads y píxel):</strong> recibe los datos de tu
                cuenta publicitaria, página, cuenta de Instagram y píxel que autorizas al
                conectar tu cuenta de Meta, para publicar y medir tus campañas.
              </li>
              <li>
                <strong>OpenAI y Cloudinary:</strong> procesan tu contenido (texto, imágenes y
                video) para generar y almacenar tus creativos. Quiubot funciona bajo el modelo
                &ldquo;trae tus propias llaves&rdquo; (BYOK) — estos dos servicios se conectan con las{" "}
                <strong>credenciales propias de cada usuario</strong>, no con credenciales de
                Quiubot, y el usuario es quien contrata directamente el servicio con ellos.
              </li>
              <li>
                <strong>Supabase:</strong> base de datos donde se almacena la información de tu cuenta.
              </li>
              <li>
                <strong>Google:</strong> usado para la autenticación (inicio de sesión).
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>5. Derechos del titular</h2>
            <p>
              Como titular de tus datos personales, de acuerdo con la Ley 1581 de 2012, tienes derecho a:
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>Conocer, actualizar y rectificar tus datos personales.</li>
              <li>Solicitar prueba de la autorización otorgada para el tratamiento de tus datos.</li>
              <li>Ser informado sobre el uso que se le ha dado a tus datos personales.</li>
              <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
              <li>
                Revocar la autorización y/o solicitar la supresión de tus datos, cuando no se
                respeten los principios, derechos y garantías constitucionales y legales — ver el
                procedimiento real en nuestra{" "}
                <a href="/eliminar-datos" style={linkStyle}>página de eliminación de datos</a>.
              </li>
              <li>Acceder de forma gratuita a tus datos personales que hayan sido objeto de tratamiento.</li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>6. Procedimiento de consultas y reclamos</h2>
            <p>
              Puedes ejercer tus derechos escribiendo a{" "}
              <a href="mailto:juanjosepalaciosvillarreal@gmail.com" style={linkStyle}>juanjosepalaciosvillarreal@gmail.com</a>{" "}
              desde el mismo correo con el que tienes tu cuenta registrada, indicando si se trata
              de una consulta o un reclamo.
            </p>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>
                <strong>Consultas</strong> (sobre qué datos tuyos tenemos o cómo se tratan): se
                responden en un plazo máximo de <strong>10 días hábiles</strong> contados desde su
                recibo, prorrogable 5 días hábiles más si es necesario, avisándote antes de que
                venza el plazo inicial.
              </li>
              <li>
                <strong>Reclamos</strong> (para corregir, actualizar o suprimir tus datos, o
                revocar tu autorización): se confirma su recibo en un plazo máximo de{" "}
                <strong>2 días hábiles</strong>, y se responde de fondo en un plazo máximo de{" "}
                <strong>15 días hábiles</strong> contados desde su recibo.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>7. Transferencias internacionales de datos</h2>
            <p>
              Meta, OpenAI y Cloudinary procesan datos en servidores ubicados fuera de Colombia.
              Al aceptar esta política y usar la plataforma, autorizas estas transferencias
              internacionales, necesarias para prestar el servicio que contrataste.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionTitle}>8. Vigencia</h2>
            <p>
              Esta política aplica mientras tu cuenta esté activa, y tus datos se conservan por el
              tiempo adicional que exijan las normas legales aplicables o que sea necesario para
              resolver disputas, después de lo cual se eliminan conforme al procedimiento descrito
              en nuestra{" "}
              <a href="/eliminar-datos" style={linkStyle}>página de eliminación de datos</a>.
            </p>
          </section>

          <section>
            <h2 style={sectionTitle}>9. Modificaciones a esta política</h2>
            <p>
              Esta política puede actualizarse periódicamente. Los cambios entran en vigencia
              desde su publicación en esta misma página, con la fecha de actualización indicada
              al inicio.
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

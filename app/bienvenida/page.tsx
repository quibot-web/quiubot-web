import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Publicidad con IA para tu negocio",
  description:
    "Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor que vigila tus campañas cada 6 horas. Prueba gratis 7 días.",
};

const PASOS = [
  {
    numero: "01",
    titulo: "Sube tu marca (opcional)",
    texto:
      "Una imagen es suficiente para que la IA entienda tus colores, tu logo y tu estilo antes de generar nada.",
  },
  {
    numero: "02",
    titulo: "Elige objetivo y presupuesto",
    texto:
      "Con eso, Quiubot genera la estrategia completa: qué publicar, a quién y con cuánto.",
  },
  {
    numero: "03",
    titulo: "Recibe tus creativos",
    texto:
      "Generados por IA y auditados automáticamente, o elegidos directo de tu álbum si ya los tienes.",
  },
  {
    numero: "04",
    titulo: "Publica con un clic",
    texto:
      "La campaña sale a Meta tal cual la planeaste. Desde ahí, Quiubot empieza a vigilarla.",
  },
];

const AYUDAS = [
  {
    titulo: "Revisa cada 6 horas",
    texto:
      "Sincroniza tus campañas activas y compara su rendimiento contra tu propio promedio, no contra reglas genéricas.",
  },
  {
    titulo: "Audita cada creativo",
    texto:
      "Antes de mostrártelo, una segunda IA revisa que el logo, los colores y el mensaje coincidan con tu marca.",
  },
  {
    titulo: "Nunca actúa sin ti",
    texto:
      'Las sugerencias de ajuste, como pausar o subir presupuesto, solo se aplican cuando tú das clic en "Aplicar".',
  },
  {
    titulo: "Sin sorpresas de costo",
    texto:
      "Conectas tu propia cuenta de OpenAI, así que solo pagas exactamente lo que usas — nunca un margen escondido.",
  },
];

const PLANES = [
  { nombre: "Arranque", precio: "Gratis", detalle: "1 estrategia al mes, para empezar sin riesgo." },
  { nombre: "Crecimiento", precio: "$149.900", detalle: "4 estrategias al mes, todos los objetivos.", destacado: true },
  { nombre: "Escala", precio: "$249.900", detalle: "Estrategias y campañas vigiladas sin límite." },
];

export default function BienvenidaPage() {
  return (
    <div className={`${display.variable} ${mono.variable} qb-lp`}>
      <style>{`
        .qb-lp {
          --bg: #FAFAF8;
          --bg-alt: #F1EFFB;
          --ink: #17152B;
          --muted: #6B6478;
          --purple-deep: #4A3FAE;
          --purple: #7F77DD;
          --purple-light: #C4BFF0;
          --mint: #1FA97C;
          --white: #FFFFFF;
          background: var(--bg);
          color: var(--ink);
          font-family: system-ui, sans-serif;
          overflow-x: hidden;
        }
        .qb-lp h1, .qb-lp h2, .qb-lp h3 {
          font-family: var(--font-display), system-ui, sans-serif;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .qb-lp .eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--purple-deep);
          margin: 0 0 14px;
        }
        .qb-lp .wrap {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .qb-lp .btn-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--purple-deep), var(--purple));
          color: #fff;
          font-weight: 600;
          font-size: 16px;
          padding: 15px 28px;
          border-radius: 14px;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(74,63,174,0.28);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .qb-lp .btn-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px rgba(74,63,174,0.36);
        }
        .qb-lp .micro {
          font-size: 13px;
          color: var(--muted);
          margin-top: 12px;
        }

        /* ---- NAV ---- */
        .qb-lp nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 24px;
          max-width: 1120px;
          margin: 0 auto;
        }
        .qb-lp .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 18px;
        }
        .qb-lp .brand img { width: 32px; height: 32px; border-radius: 9px; }
        .qb-lp .brand span.acc { color: var(--purple); }
        .qb-lp nav .btn-cta { padding: 10px 20px; font-size: 14px; border-radius: 10px; }

        /* ---- HERO ---- */
        .qb-lp .hero {
          padding: 56px 24px 40px;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: center;
          max-width: 1120px;
          margin: 0 auto;
        }
        .qb-lp .hero h1 {
          font-size: clamp(34px, 5vw, 54px);
          line-height: 1.06;
          font-weight: 700;
        }
        .qb-lp .hero h1 .grad {
          background: linear-gradient(135deg, var(--purple-deep), var(--purple));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .qb-lp .hero p.sub {
          font-size: 17px;
          line-height: 1.55;
          color: var(--muted);
          margin: 20px 0 28px;
          max-width: 480px;
        }

        /* ---- ORBIT SIGNATURE ---- */
        .qb-lp .orbit-stage {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          max-width: 420px;
          margin: 0 auto;
        }
        .qb-lp .orbit-ring-bg {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          border: 1.5px dashed rgba(127,119,221,0.35);
        }
        .qb-lp .orbit-center {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 96px; height: 96px;
          border-radius: 28px;
          background: linear-gradient(135deg, var(--purple-deep), var(--purple));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 12px 34px rgba(74,63,174,0.35);
          animation: qbBreathe 4s ease-in-out infinite;
        }
        .qb-lp .orbit-center img { width: 52px; height: 52px; }
        .qb-lp .orbit-track {
          position: absolute;
          inset: 8%;
          animation: qbSpinSlow 26s linear infinite;
        }
        .qb-lp .orbit-node {
          position: absolute;
          top: 50%; left: 50%;
          width: 0; height: 0;
        }
        .qb-lp .orbit-node .pin {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          animation: qbSpinSlowReverse 26s linear infinite;
        }
        .qb-lp .orbit-node .dot {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: var(--purple);
          box-shadow: 0 0 0 5px rgba(127,119,221,0.18);
        }
        .qb-lp .orbit-node .label {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--purple-deep);
          background: #fff;
          padding: 4px 9px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          white-space: nowrap;
        }
        @keyframes qbSpinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes qbSpinSlowReverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes qbBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.06); }
        }

        /* ---- SECTIONS shared ---- */
        .qb-lp section { padding: 88px 24px; }
        .qb-lp .section-head { max-width: 620px; margin: 0 auto 48px; text-align: center; }
        .qb-lp .section-head h2 { font-size: clamp(26px, 3.4vw, 38px); font-weight: 700; }
        .qb-lp .alt { background: var(--bg-alt); }

        /* ---- PAIN ---- */
        .qb-lp .pain-list {
          max-width: 700px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .qb-lp .pain-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          font-size: 16px;
          color: var(--ink);
          background: #fff;
          border: 1px solid #ECE9F7;
          border-radius: 14px;
          padding: 16px 20px;
        }
        .qb-lp .pain-item .x {
          color: #C24545;
          font-weight: 700;
          flex-shrink: 0;
        }

        /* ---- STEPS ---- */
        .qb-lp .steps {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .qb-lp .step {
          background: #fff;
          border: 1px solid #ECE9F7;
          border-radius: 18px;
          padding: 24px 20px;
        }
        .qb-lp .step .num {
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          color: var(--purple);
          font-weight: 500;
          margin-bottom: 14px;
        }
        .qb-lp .step h3 { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .qb-lp .step p { font-size: 14px; color: var(--muted); line-height: 1.5; margin: 0; }

        /* ---- AYUDAS ---- */
        .qb-lp .ayudas {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        .qb-lp .ayuda-card {
          background: #fff;
          border-radius: 18px;
          padding: 26px 24px;
          border: 1px solid #ECE9F7;
        }
        .qb-lp .ayuda-card h3 {
          font-size: 16px; font-weight: 600; margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .qb-lp .ayuda-card h3::before {
          content: "";
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--mint);
          flex-shrink: 0;
        }
        .qb-lp .ayuda-card p { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 0; }

        /* ---- PLANES ---- */
        .qb-lp .planes {
          max-width: 900px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .qb-lp .plan-card {
          background: #fff;
          border: 1.5px solid #ECE9F7;
          border-radius: 18px;
          padding: 26px 22px;
          text-align: center;
        }
        .qb-lp .plan-card.destacado {
          border-color: var(--purple);
          box-shadow: 0 10px 30px rgba(127,119,221,0.16);
        }
        .qb-lp .plan-card .tag {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--purple);
          font-weight: 600;
        }
        .qb-lp .plan-card h3 { font-size: 18px; margin: 10px 0 4px; }
        .qb-lp .plan-card .precio { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .qb-lp .plan-card .precio small { font-size: 12px; font-weight: 500; color: var(--muted); }
        .qb-lp .plan-card p.detalle { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .qb-lp .planes-footer { text-align: center; margin-top: 28px; }
        .qb-lp .planes-footer a { color: var(--purple-deep); font-size: 14px; font-weight: 600; text-decoration: none; }

        /* ---- CTA FINAL ---- */
        .qb-lp .cta-final {
          background: linear-gradient(135deg, var(--purple-deep), var(--purple));
          border-radius: 28px;
          max-width: 1000px;
          margin: 0 auto;
          padding: 64px 40px;
          text-align: center;
        }
        .qb-lp .cta-final h2 {
          color: #fff;
          font-size: clamp(24px, 3.2vw, 34px);
          font-weight: 700;
          max-width: 560px;
          margin: 0 auto 28px;
        }
        .qb-lp .cta-final .btn-cta {
          background: #fff;
          color: var(--purple-deep);
          box-shadow: 0 10px 28px rgba(0,0,0,0.18);
        }
        .qb-lp .cta-final .micro { color: rgba(255,255,255,0.75); }

        /* ---- FOOTER ---- */
        .qb-lp footer {
          padding: 40px 24px 60px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }
        .qb-lp footer a { color: var(--muted); text-decoration: underline; }

        @media (max-width: 860px) {
          .qb-lp .hero { grid-template-columns: 1fr; padding-top: 32px; }
          .qb-lp .hero p.sub { max-width: 100%; }
          .qb-lp .steps { grid-template-columns: 1fr 1fr; }
          .qb-lp .ayudas { grid-template-columns: 1fr; }
          .qb-lp .planes { grid-template-columns: 1fr; }
          .qb-lp section { padding: 64px 20px; }
        }
        @media (max-width: 480px) {
          .qb-lp .steps { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qb-lp .orbit-track, .qb-lp .orbit-node .pin, .qb-lp .orbit-center {
            animation: none !important;
          }
        }
      `}</style>

      <nav>
        <div className="brand">
          <img src="/marca/icono-quiubot.svg" alt="" />
          quiu<span className="acc">bot</span>
        </div>
        <Link href="/login" className="btn-cta">Iniciar prueba gratis</Link>
      </nav>

      <section className="hero" style={{ paddingBottom: 20 }}>
        <div>
          <p className="eyebrow">Publicidad con IA · Meta Ads</p>
          <h1>
            Tu próxima campaña <span className="grad">no la armas tú.</span>
          </h1>
          <p className="sub">
            Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor
            que vigila tus campañas cada 6 horas para que nunca quemes presupuesto sin darte cuenta.
          </p>
          <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
          <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        </div>

        <div className="orbit-stage">
          <div className="orbit-ring-bg" />
          <div className="orbit-track">
            <div className="orbit-node" style={{ transform: "rotate(0deg) translate(0, -160px)" }}>
              <div className="pin"><span className="dot" /><span className="label">Estrategia</span></div>
            </div>
            <div className="orbit-node" style={{ transform: "rotate(90deg) translate(0, -160px)" }}>
              <div className="pin"><span className="dot" /><span className="label">Creativos</span></div>
            </div>
            <div className="orbit-node" style={{ transform: "rotate(180deg) translate(0, -160px)" }}>
              <div className="pin"><span className="dot" /><span className="label">Publicación</span></div>
            </div>
            <div className="orbit-node" style={{ transform: "rotate(270deg) translate(0, -160px)" }}>
              <div className="pin"><span className="dot" /><span className="label">Optimización</span></div>
            </div>
          </div>
          <div className="orbit-center">
            <img src="/marca/icono-quiubot.svg" alt="Quiubot" />
          </div>
        </div>
      </section>

      <section>
        <div className="section-head">
          <p className="eyebrow" style={{ textAlign: "center" }}>El problema real</p>
          <h2>Anunciarte en Meta no debería sentirse como un segundo trabajo.</h2>
        </div>
        <div className="pain-list">
          <div className="pain-item"><span className="x">✕</span>Horas armando campañas que no sabes si van a funcionar.</div>
          <div className="pain-item"><span className="x">✕</span>Presupuesto gastado en anuncios que nadie ajustó a tiempo.</div>
          <div className="pain-item"><span className="x">✕</span>Creativos que tardan días en llegar — o que no coinciden con tu marca.</div>
        </div>
      </section>

      <section className="alt">
        <div className="section-head">
          <p className="eyebrow" style={{ textAlign: "center" }}>Cómo funciona</p>
          <h2>De la idea a la campaña publicada, en un solo flujo.</h2>
        </div>
        <div className="steps">
          {PASOS.map((p) => (
            <div className="step" key={p.numero}>
              <div className="num">{p.numero}</div>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <p className="eyebrow" style={{ textAlign: "center" }}>Mientras tú haces otras cosas</p>
          <h2>Quiubot no te deja solo después de publicar.</h2>
        </div>
        <div className="ayudas">
          {AYUDAS.map((a) => (
            <div className="ayuda-card" key={a.titulo}>
              <h3>{a.titulo}</h3>
              <p>{a.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="alt">
        <div className="section-head">
          <p className="eyebrow" style={{ textAlign: "center" }}>Después de tu prueba</p>
          <h2>Elige el plan que se ajuste a tu negocio.</h2>
        </div>
        <div className="planes">
          {PLANES.map((p) => (
            <div className={`plan-card ${p.destacado ? "destacado" : ""}`} key={p.nombre}>
              {p.destacado && <div className="tag">Más elegido</div>}
              <h3>{p.nombre}</h3>
              <div className="precio">
                {p.precio}{p.precio !== "Gratis" && <small> COP/mes</small>}
              </div>
              <p className="detalle">{p.detalle}</p>
            </div>
          ))}
        </div>
        <div className="planes-footer">
          <Link href="/pricing">Ver todos los detalles de los planes →</Link>
        </div>
      </section>

      <section>
        <div className="cta-final">
          <h2>Tus primeros 7 días con Quiubot ya están pagados. Por nosotros.</h2>
          <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
          <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        </div>
      </section>

      <footer>
        <p>© {new Date().getFullYear()} Quiubot. Publicidad con IA para negocios colombianos.</p>
      </footer>
    </div>
  );
}
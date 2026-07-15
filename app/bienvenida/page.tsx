import Link from "next/link";
import RevealObserver from "@/app/components/RevealObserver";

export const metadata = {
  title: "Publicidad con IA para tu negocio",
  description:
    "Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor que vigila tus campañas todo el tiempo. Prueba gratis 7 días.",
};

const AYUDAS = [
  {
    titulo: "Vigila constantemente",
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

const GANANCIAS = [
  "Las horas que ibas a gastar armando la campaña tú mismo.",
  "La tranquilidad de saber que algo está vigilando tus anuncios, todo el tiempo.",
  "La libertad de enfocarte en tu negocio, no en Meta Ads Manager.",
];

const CHIPS_CONFIANZA = ["Cero curva de aprendizaje", "Tú apruebas cada cambio", "Pagas solo lo que usas"];

const PLANES = [
  { nombre: "Arranque", precio: "Gratis", detalle: "1 estrategia al mes, para empezar sin riesgo." },
  { nombre: "Crecimiento", precio: "$149.900", detalle: "4 estrategias al mes, todos los objetivos.", destacado: true },
  { nombre: "Escala", precio: "$249.900", detalle: "Estrategias y campañas vigiladas sin límite." },
];

export default function BienvenidaPage() {
  return (
    <div className="qb-lp">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap"
      />
      <RevealObserver />
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
          --font-display: 'Space Grotesk', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
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
        .qb-lp .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
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
        .qb-lp .btn-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(74,63,174,0.36); }
        .qb-lp .micro { font-size: 13px; color: var(--muted); margin-top: 12px; }

        /* ---- SCROLL REVEAL ---- */
        .qb-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s cubic-bezier(.16,.84,.44,1), transform .7s cubic-bezier(.16,.84,.44,1); }
        .qb-reveal.qb-in { opacity: 1; transform: none; }
        .qb-reveal-delay-1.qb-in { transition-delay: .08s; }
        .qb-reveal-delay-2.qb-in { transition-delay: .16s; }
        .qb-reveal-delay-3.qb-in { transition-delay: .24s; }
        .qb-reveal-delay-4.qb-in { transition-delay: .32s; }

        /* ---- NAV ---- */
        .qb-lp nav { display: flex; align-items: center; justify-content: space-between; padding: 22px 24px; max-width: 1120px; margin: 0 auto; position: relative; z-index: 2; }
        .qb-lp .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; }
        .qb-lp .brand img { width: 32px; height: 32px; border-radius: 9px; }
        .qb-lp .brand span.acc { color: var(--purple); }
        .qb-lp nav .btn-cta { padding: 10px 20px; font-size: 14px; border-radius: 10px; }

        /* ---- HERO + AMBIENT BLOBS ---- */
        .qb-lp .hero-stage { position: relative; overflow: hidden; }
        .qb-lp .blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.32; z-index: 0; }
        .qb-lp .blob-a { width: 420px; height: 420px; background: var(--purple); top: -140px; left: -110px; animation: qbBlobMove 15s ease-in-out infinite; }
        .qb-lp .blob-b { width: 360px; height: 360px; background: var(--mint); top: 60px; right: -140px; animation: qbBlobMove 19s ease-in-out infinite reverse; }
        @keyframes qbBlobMove { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px, 40px) scale(1.08); } }

        .qb-lp .hero { padding: 56px 24px 40px; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: center; max-width: 1120px; margin: 0 auto; position: relative; z-index: 1; }
        .qb-lp .hero h1 { font-size: clamp(34px, 5vw, 54px); line-height: 1.06; font-weight: 700; }
        .qb-lp .hero h1 .grad { background: linear-gradient(135deg, var(--purple-deep), var(--purple)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .qb-lp .hero p.sub { font-size: 17px; line-height: 1.55; color: var(--muted); margin: 20px 0 28px; max-width: 480px; }

        /* ---- ORBIT SIGNATURE ---- */
        .qb-lp .orbit-stage { position: relative; width: 100%; aspect-ratio: 1 / 1; max-width: 420px; margin: 0 auto; }
        .qb-lp .orbit-ring-bg { position: absolute; inset: 8%; border-radius: 50%; border: 1.5px dashed rgba(127,119,221,0.35); }
        .qb-lp .orbit-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 96px; height: 96px; border-radius: 28px; background: linear-gradient(135deg, var(--purple-deep), var(--purple)); display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 34px rgba(74,63,174,0.35); animation: qbBreathe 4s ease-in-out infinite; }
        .qb-lp .orbit-center img { width: 52px; height: 52px; }
        .qb-lp .orbit-track { position: absolute; inset: 8%; animation: qbSpinSlow 26s linear infinite; }
        .qb-lp .orbit-node { position: absolute; top: 50%; left: 50%; width: 0; height: 0; }
        .qb-lp .orbit-node .pin { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 6px; animation-duration: 26s; animation-timing-function: linear; animation-iteration-count: infinite; }
        .qb-lp .orbit-node .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--purple); box-shadow: 0 0 0 5px rgba(127,119,221,0.18); }
        .qb-lp .orbit-node .label { font-family: var(--font-mono), monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: var(--purple-deep); background: #fff; padding: 4px 9px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); white-space: nowrap; }
        @keyframes qbSpinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes qbCounter0 { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(-360deg); } }
        @keyframes qbCounter90 { from { transform: translate(-50%, -50%) rotate(-90deg); } to { transform: translate(-50%, -50%) rotate(-450deg); } }
        @keyframes qbCounter180 { from { transform: translate(-50%, -50%) rotate(-180deg); } to { transform: translate(-50%, -50%) rotate(-540deg); } }
        @keyframes qbCounter270 { from { transform: translate(-50%, -50%) rotate(-270deg); } to { transform: translate(-50%, -50%) rotate(-630deg); } }
        .qb-lp .orbit-node.n0 .pin { animation-name: qbCounter0; }
        .qb-lp .orbit-node.n90 .pin { animation-name: qbCounter90; }
        .qb-lp .orbit-node.n180 .pin { animation-name: qbCounter180; }
        .qb-lp .orbit-node.n270 .pin { animation-name: qbCounter270; }
        @keyframes qbBreathe { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.06); } }

        /* ---- SECTIONS shared ---- */
        .qb-lp section { padding: 88px 24px; position: relative; }
        .qb-lp .section-head { max-width: 640px; margin: 0 auto 48px; text-align: center; }
        .qb-lp .section-head h2 { font-size: clamp(26px, 3.4vw, 38px); font-weight: 700; }
        .qb-lp .section-head p.lead { font-size: 16px; color: var(--muted); margin-top: 14px; line-height: 1.55; }
        .qb-lp .alt { background: var(--bg-alt); }

        /* ---- PAIN ---- */
        .qb-lp .pain-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .qb-lp .pain-item { display: flex; gap: 14px; align-items: flex-start; font-size: 16px; color: var(--ink); background: #fff; border: 1px solid #ECE9F7; border-radius: 14px; padding: 16px 20px; }
        .qb-lp .pain-item .x { color: #C24545; font-weight: 700; flex-shrink: 0; }

        /* ---- DEMO VIVO ---- */
        .qb-lp .demo-grid { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: 1fr 0.8fr; gap: 40px; align-items: center; }
        .qb-lp .demo-frame { background: #fff; border-radius: 22px; border: 1px solid #ECE9F7; box-shadow: 0 20px 50px rgba(74,63,174,0.12); overflow: hidden; }
        .qb-lp .demo-topbar { display: flex; gap: 6px; padding: 12px 16px; border-bottom: 1px solid #F1EFF9; }
        .qb-lp .demo-topbar span { width: 9px; height: 9px; border-radius: 50%; background: #E5E1F5; }
        .qb-lp .demo-body { position: relative; height: 280px; padding: 26px; }
        .qb-lp .demo-scene { position: absolute; inset: 0; padding: 26px; display: flex; flex-direction: column; justify-content: center; gap: 16px; opacity: 0; animation: qbSceneCycle 12s ease-in-out infinite; }
        .qb-lp .demo-scene .tag { font-family: var(--font-mono), monospace; font-size: 11px; color: var(--purple); text-transform: uppercase; letter-spacing: 0.08em; }
        .qb-lp .demo-scene .titulo { font-size: 18px; font-weight: 600; }
        .qb-lp .scene-1 { animation-delay: 0s; }
        .qb-lp .scene-2 { animation-delay: 3s; }
        .qb-lp .scene-3 { animation-delay: 6s; }
        .qb-lp .scene-4 { animation-delay: 9s; }
        @keyframes qbSceneCycle {
          0% { opacity: 0; transform: translateY(10px); }
          4% { opacity: 1; transform: none; }
          23% { opacity: 1; transform: none; }
          28% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 0; }
        }
        .qb-lp .avatar-marca { width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, var(--purple), var(--purple-light)); }
        .qb-lp .paleta { display: flex; gap: 6px; margin-top: 2px; }
        .qb-lp .paleta span { width: 16px; height: 16px; border-radius: 5px; }
        .qb-lp .badge-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--mint); font-weight: 600; }
        .qb-lp .pills { display: flex; gap: 8px; }
        .qb-lp .pill { font-size: 12px; padding: 6px 12px; border-radius: 20px; border: 1px solid #E5E1F5; color: var(--muted); }
        .qb-lp .pill.activo { background: var(--purple); color: #fff; border-color: var(--purple); }
        .qb-lp .budget-row { display: flex; align-items: center; gap: 10px; }
        .qb-lp .budget-bar { position: relative; height: 8px; border-radius: 6px; background: #EFEDFA; overflow: visible; width: 220px; }
        .qb-lp .budget-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--purple-deep), var(--purple)); width: 0%; animation: qbFillBar 12s ease-in-out infinite; animation-delay: 3s; position: relative; }
        .qb-lp .budget-fill::after { content: ""; position: absolute; right: -7px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 3px solid var(--purple-deep); box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
        .qb-lp .budget-num { font-family: var(--font-mono), monospace; font-size: 13px; font-weight: 600; color: var(--purple-deep); opacity: 0; animation: qbFadeSimple 12s ease-in-out infinite; animation-delay: 3s; }
        @keyframes qbFillBar { 0%, 25% { width: 0%; } 30%, 100% { width: 72%; } }
        @keyframes qbFadeSimple { 0%, 25% { opacity: 0; } 30%, 100% { opacity: 1; } }
        .qb-lp .creativos-row { display: flex; gap: 12px; }
        .qb-lp .creativo-card { position: relative; width: 76px; height: 86px; border-radius: 12px; opacity: 0; animation: qbFadeInCard 12s ease-in-out infinite; overflow: hidden; box-shadow: 0 6px 14px rgba(74,63,174,0.16); }
        .qb-lp .creativo-card .foto { height: 58px; display: flex; align-items: center; justify-content: center; }
        .qb-lp .creativo-card .foto svg { width: 22px; height: 22px; opacity: 0.9; }
        .qb-lp .creativo-card .info-mini { background: #fff; padding: 6px 7px; }
        .qb-lp .creativo-card .info-mini .linea { height: 5px; border-radius: 3px; background: #E5E1F5; margin-bottom: 4px; }
        .qb-lp .creativo-card .info-mini .linea.corta { width: 60%; }
        .qb-lp .creativo-card .precio-tag { position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.92); color: var(--purple-deep); font-size: 8px; font-weight: 700; padding: 2px 5px; border-radius: 6px; }
        .qb-lp .creativo-card::after { content: "✓"; position: absolute; bottom: 30px; left: 6px; width: 14px; height: 14px; border-radius: 50%; background: var(--mint); color: #fff; font-size: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #fff; }
        .qb-lp .creativo-card.c1 .foto { background: linear-gradient(160deg, #8B82E8, #4A3FAE); }
        .qb-lp .creativo-card.c2 .foto { background: linear-gradient(160deg, #6FCBA6, #1FA97C); }
        .qb-lp .creativo-card.c3 .foto { background: linear-gradient(160deg, #E8B4E0, #B36FCB); }
        .qb-lp .creativo-card:nth-child(1) { animation-delay: 6.2s; }
        .qb-lp .creativo-card:nth-child(2) { animation-delay: 6.6s; }
        .qb-lp .creativo-card:nth-child(3) { animation-delay: 7s; }
        @keyframes qbFadeInCard { 0%, 25% { opacity: 0; transform: translateY(6px); } 27%, 55% { opacity: 1; transform: none; } 60%, 100% { opacity: 0; } }
        .qb-lp .campana-row { display: flex; align-items: center; gap: 10px; background: #F7F6FD; border: 1px solid #ECE9F7; border-radius: 12px; padding: 12px 16px; width: 260px; }
        .qb-lp .campana-row .estado-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 0 4px rgba(31,169,124,0.18); flex-shrink: 0; }
        .qb-lp .campana-row .info { display: flex; flex-direction: column; gap: 2px; }
        .qb-lp .campana-row .info b { font-size: 13px; }
        .qb-lp .campana-row .info span { font-size: 11px; color: var(--muted); }
        .qb-lp .check-circle { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--mint), #2ECC9A); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; box-shadow: 0 0 0 8px rgba(31,169,124,0.14); }

        .qb-lp .ganancias { display: flex; flex-direction: column; gap: 20px; }
        .qb-lp .ganancias h3 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .qb-lp .ganancia-item { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; color: var(--ink); line-height: 1.5; }
        .qb-lp .ganancia-item .check { color: var(--mint); font-weight: 700; flex-shrink: 0; }

        /* ---- AYUDAS ---- */
        .qb-lp .ayudas { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .qb-lp .ayuda-card { background: #fff; border-radius: 18px; padding: 26px 24px; border: 1px solid #ECE9F7; transition: transform .25s ease, box-shadow .25s ease; }
        .qb-lp .ayuda-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(74,63,174,0.12); }
        .qb-lp .ayuda-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .qb-lp .ayuda-card h3::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--mint); flex-shrink: 0; }
        .qb-lp .ayuda-card p { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 0; }

        /* ---- SELLO DE CONFIANZA ---- */
        .qb-lp .sello-box { max-width: 780px; margin: 0 auto; text-align: center; background: #fff; border: 1.5px solid #E5E1F5; border-radius: 26px; padding: 48px 40px; position: relative; }
        .qb-lp .sello-box::before { content: ""; position: absolute; inset: 8px; border: 1px dashed rgba(127,119,221,0.3); border-radius: 20px; pointer-events: none; }
        .qb-lp .sello-icono { width: 60px; height: 60px; margin: 0 auto 18px; border-radius: 50%; background: linear-gradient(135deg, var(--purple-deep), var(--purple)); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 26px rgba(74,63,174,0.28); }
        .qb-lp .sello-icono svg { width: 26px; height: 26px; }
        .qb-lp .sello-box h2 { font-size: clamp(24px, 3vw, 32px); }
        .qb-lp .sello-box p.lead { max-width: 560px; margin: 14px auto 0; }
        .qb-lp .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 30px; }
        .qb-lp .chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--purple-deep); background: var(--bg-alt); border: 1px solid #E5E1F5; padding: 9px 16px 9px 12px; border-radius: 20px; }
        .qb-lp .chip .check-mini { width: 16px; height: 16px; border-radius: 50%; background: var(--mint); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .qb-lp .garantias { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 34px; padding-top: 30px; border-top: 1px solid #F1EFF9; text-align: left; }
        .qb-lp .garantia { display: flex; flex-direction: column; gap: 8px; }
        .qb-lp .garantia .icono-g { width: 38px; height: 38px; border-radius: 12px; background: var(--bg-alt); display: flex; align-items: center; justify-content: center; }
        .qb-lp .garantia .icono-g svg { width: 18px; height: 18px; }
        .qb-lp .garantia .titulo-g { font-size: 15px; font-weight: 700; color: var(--ink); }
        .qb-lp .garantia .texto-g { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .qb-lp .sello-cta { margin-top: 32px; display: flex; flex-direction: column; align-items: center; gap: 10px; }

        /* ---- PLANES ---- */
        .qb-lp .planes { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .qb-lp .plan-card { background: #fff; border: 1.5px solid #ECE9F7; border-radius: 18px; padding: 26px 22px; text-align: center; transition: transform .25s ease; }
        .qb-lp .plan-card:hover { transform: translateY(-4px); }
        .qb-lp .plan-card.destacado { border-color: var(--purple); box-shadow: 0 10px 30px rgba(127,119,221,0.16); }
        .qb-lp .plan-card .tag { font-family: var(--font-mono), monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--purple); font-weight: 600; }
        .qb-lp .plan-card h3 { font-size: 18px; margin: 10px 0 4px; }
        .qb-lp .plan-card .precio { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .qb-lp .plan-card .precio small { font-size: 12px; font-weight: 500; color: var(--muted); }
        .qb-lp .plan-card p.detalle { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .qb-lp .planes-footer { text-align: center; margin-top: 28px; }
        .qb-lp .planes-footer a { color: var(--purple-deep); font-size: 14px; font-weight: 600; text-decoration: none; }

        /* ---- CTA FINAL ---- */
        .qb-lp .cta-final { background: linear-gradient(135deg, var(--purple-deep), var(--purple)); border-radius: 28px; max-width: 1000px; margin: 0 auto; padding: 64px 40px; text-align: center; }
        .qb-lp .cta-final h2 { color: #fff; font-size: clamp(24px, 3.2vw, 34px); font-weight: 700; max-width: 560px; margin: 0 auto 28px; }
        .qb-lp .cta-final .btn-cta { background: #fff; color: var(--purple-deep); box-shadow: 0 10px 28px rgba(0,0,0,0.18); }
        .qb-lp .cta-final .micro { color: rgba(255,255,255,0.75); }

        /* ---- FOOTER ---- */
        .qb-lp footer { padding: 40px 24px 60px; text-align: center; color: var(--muted); font-size: 13px; }
        .qb-lp footer a { color: var(--muted); text-decoration: underline; }

        @media (max-width: 860px) {
          .qb-lp .hero { grid-template-columns: 1fr; padding-top: 32px; }
          .qb-lp .hero p.sub { max-width: 100%; }
          .qb-lp .demo-grid { grid-template-columns: 1fr; }
          .qb-lp .ayudas { grid-template-columns: 1fr; }
          .qb-lp .planes { grid-template-columns: 1fr; }
          .qb-lp .garantias { grid-template-columns: 1fr; }
          .qb-lp section { padding: 64px 20px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qb-lp .orbit-track, .qb-lp .orbit-node .pin, .qb-lp .orbit-center,
          .qb-lp .blob-a, .qb-lp .blob-b, .qb-lp .demo-scene, .qb-lp .budget-fill, .qb-lp .creativo-card, .qb-lp .pin-ring {
            animation: none !important;
          }
          .qb-lp .demo-scene.scene-1 { opacity: 1; }
          .qb-lp .qb-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>

      <div className="hero-stage">
        <div className="blob blob-a" />
        <div className="blob blob-b" />

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
              que vigila tus campañas todo el tiempo para que nunca quemes presupuesto sin darte cuenta.
            </p>
            <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
            <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
          </div>

          <div className="orbit-stage">
            <div className="orbit-ring-bg" />
            <div className="orbit-track">
              <div className="orbit-node n0" style={{ transform: "rotate(0deg) translate(0, -160px)" }}>
                <div className="pin"><span className="dot" /><span className="label">Estrategia</span></div>
              </div>
              <div className="orbit-node n90" style={{ transform: "rotate(90deg) translate(0, -160px)" }}>
                <div className="pin"><span className="dot" /><span className="label">Creativos</span></div>
              </div>
              <div className="orbit-node n180" style={{ transform: "rotate(180deg) translate(0, -160px)" }}>
                <div className="pin"><span className="dot" /><span className="label">Publicación</span></div>
              </div>
              <div className="orbit-node n270" style={{ transform: "rotate(270deg) translate(0, -160px)" }}>
                <div className="pin"><span className="dot" /><span className="label">Optimización</span></div>
              </div>
            </div>
            <div className="orbit-center">
              <img src="/marca/icono-quiubot.svg" alt="Quiubot" />
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="section-head qb-reveal">
          <p className="eyebrow" style={{ textAlign: "center" }}>El problema real</p>
          <h2>Anunciarte en Meta no debería sentirse como un segundo trabajo.</h2>
          <p className="lead">
            Abres el administrador de anuncios con toda la intención del mundo, y una hora después
            sigues sin publicar nada — o publicas algo a medias, cruzando los dedos.
          </p>
        </div>
        <div className="pain-list">
          <div className="pain-item qb-reveal qb-reveal-delay-1"><span className="x">✕</span>Te sientas a "armar rápido una campaña" y dos horas después sigues decidiendo el texto del anuncio.</div>
          <div className="pain-item qb-reveal qb-reveal-delay-2"><span className="x">✕</span>Publicas, te desconectas un par de días, y vuelves a ver presupuesto gastado en algo que nadie ajustó a tiempo.</div>
          <div className="pain-item qb-reveal qb-reveal-delay-3"><span className="x">✕</span>Pides creativos y te tardan días en llegar — o llegan sin parecerse en nada a tu marca.</div>
        </div>
      </section>

      <section className="alt">
        <div className="section-head qb-reveal">
          <p className="eyebrow" style={{ textAlign: "center" }}>Así se siente usar Quiubot</p>
          <h2>Mira cómo tu negocio gana tiempo, en tiempo real.</h2>
          <p className="lead">No es una explicación. Es exactamente lo que pasa cuando entras.</p>
        </div>
        <div className="demo-grid">
          <div className="demo-frame qb-reveal">
            <div className="demo-topbar"><span /><span /><span /></div>
            <div className="demo-body">
              <div className="demo-scene scene-1">
                <span className="tag">01 · Marca</span>
                <div className="avatar-marca" />
                <div className="paleta">
                  <span style={{ background: "#4A3FAE" }} />
                  <span style={{ background: "#7F77DD" }} />
                  <span style={{ background: "#C4BFF0" }} />
                </div>
                <div className="badge-ok">✓ Identidad de marca detectada</div>
              </div>
              <div className="demo-scene scene-2">
                <span className="tag">02 · Objetivo y presupuesto</span>
                <div className="pills">
                  <span className="pill activo">Venta Directa</span>
                  <span className="pill">Reconocimiento</span>
                </div>
                <div className="budget-row">
                  <div className="budget-bar"><div className="budget-fill" /></div>
                  <span className="budget-num">$300.000/mes</span>
                </div>
              </div>
              <div className="demo-scene scene-3">
                <span className="tag">03 · Creativos</span>
                <div className="creativos-row">
                  <div className="creativo-card c1">
                    <div className="foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2l1.5 4h9L18 2" /><path d="M3.5 6h17l-1.4 13a2 2 0 01-2 1.8H6.9a2 2 0 01-2-1.8L3.5 6z" />
                      </svg>
                    </div>
                    <div className="precio-tag">-20%</div>
                    <div className="info-mini"><div className="linea" /><div className="linea corta" /></div>
                  </div>
                  <div className="creativo-card c2">
                    <div className="foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                      </svg>
                    </div>
                    <div className="precio-tag">Nuevo</div>
                    <div className="info-mini"><div className="linea" /><div className="linea corta" /></div>
                  </div>
                  <div className="creativo-card c3">
                    <div className="foto">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" />
                      </svg>
                    </div>
                    <div className="precio-tag">Top</div>
                    <div className="info-mini"><div className="linea" /><div className="linea corta" /></div>
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>Generados y auditados por IA</div>
              </div>
              <div className="demo-scene scene-4">
                <span className="tag">04 · Publicación</span>
                <div className="check-circle">✓</div>
                <div className="campana-row">
                  <span className="estado-dot" />
                  <div className="info">
                    <b>Venta Directa · Activa</b>
                    <span>Publicada en Meta Ads</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ganancias qb-reveal qb-reveal-delay-2">
            <h3>Lo que te regala Quiubot</h3>
            {GANANCIAS.map((g) => (
              <div className="ganancia-item" key={g}>
                <span className="check">✓</span>{g}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="section-head qb-reveal">
          <p className="eyebrow" style={{ textAlign: "center" }}>Mientras tú haces otras cosas</p>
          <h2>Quiubot no te deja solo después de publicar.</h2>
        </div>
        <div className="ayudas">
          {AYUDAS.map((a, i) => (
            <div className={`ayuda-card qb-reveal qb-reveal-delay-${(i % 4) + 1}`} key={a.titulo}>
              <h3>{a.titulo}</h3>
              <p>{a.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="alt">
        <div className="sello-box qb-reveal">
          <div className="sello-icono">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h2>Negocios reales ya están usando Quiubot.</h2>
          <p className="lead">
            Ya generamos estrategias y campañas reales para los primeros negocios que se unieron —
            sin equipos de marketing, sin agencias, sin líos. Tú puedes ser el próximo en recuperar tus horas.
          </p>
          <div className="chips">
            {CHIPS_CONFIANZA.map((c) => (
              <span className="chip" key={c}><span className="check-mini">✓</span>{c}</span>
            ))}
          </div>

          <div className="garantias">
            <div className="garantia">
              <div className="icono-g">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4A3FAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M3 9h18" /><path d="M8 2v4M16 2v4" />
                </svg>
              </div>
              <div className="titulo-g">7 días gratis, de verdad</div>
              <div className="texto-g">Todo el poder de Quiubot desde el primer minuto, sin pagar nada.</div>
            </div>
            <div className="garantia">
              <div className="icono-g">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4A3FAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" strokeDasharray="3 3" />
                </svg>
              </div>
              <div className="titulo-g">Sin tarjeta de crédito</div>
              <div className="texto-g">Entras con tu cuenta de Google. Nada de datos de pago para empezar.</div>
            </div>
            <div className="garantia">
              <div className="icono-g">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4A3FAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div className="titulo-g">Tú apruebas cada acción</div>
              <div className="texto-g">Ningún cambio se aplica en tus campañas sin tu clic. Siempre decides tú.</div>
            </div>
          </div>

          <div className="sello-cta">
            <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
            <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
          </div>
        </div>
      </section>

      <section>
        <div className="section-head qb-reveal">
          <p className="eyebrow" style={{ textAlign: "center" }}>Después de tu prueba</p>
          <h2>Elige el plan que se ajuste a tu negocio.</h2>
        </div>
        <div className="planes">
          {PLANES.map((p, i) => (
            <div className={`plan-card ${p.destacado ? "destacado" : ""} qb-reveal qb-reveal-delay-${i + 1}`} key={p.nombre}>
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
          <Link href="/login?next=/billing">Ver todos los detalles de los planes →</Link>
        </div>
      </section>

      <section>
        <div className="cta-final qb-reveal">
          <h2>Tus primeros 7 días con Quiubot ya están pagados. Por nosotros.</h2>
          <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
          <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        </div>
      </section>

      <footer>
        <p>© {new Date().getFullYear()} Quiubot. Publicidad con IA para negocios colombianos.</p>
        <p style={{ marginTop: 6 }}><a href="/terminos">Términos y condiciones</a></p>
      </footer>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RevealObserver from "@/app/components/RevealObserver";

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

const RECIBO_LINEAS = [
  { estado: "x", texto: "Estrategia", nota: "generada" },
  { estado: "x", texto: "Creativos", nota: "3 listos" },
  { estado: "x", texto: "Publicacion", nota: "activa" },
  { estado: " ", texto: "Optimizacion", nota: "vigilando" },
];

const PASOS = [
  {
    tab: "Mi marca",
    eyebrow: "Paso 1 · una sola vez",
    titulo: "Conectas tu marca, y ya.",
    texto:
      "Subes tu logo y tus colores una sola vez. Quedan guardados y la IA los usa en cada creativo que genera después — nunca más explicas tu marca dos veces.",
  },
  {
    tab: "Motor de Estrategia",
    eyebrow: "Paso 2 · 40 segundos",
    titulo: "Eliges objetivo y presupuesto.",
    texto:
      "Nada de formularios de agencia. Escoges qué quieres lograr y cuánto quieres invertir — Quiubot arma la estrategia completa por ti.",
  },
  {
    tab: "Álbum",
    eyebrow: "Paso 3 · sin diseñador",
    titulo: "Los creativos llegan listos.",
    texto:
      "Generados y auditados por IA antes de mostrártelos, para que coincidan con tu marca. Apruebas el que te gusta y sigues.",
  },
  {
    tab: "Mis Campañas",
    eyebrow: "Paso 4 · para siempre",
    titulo: "Publicada, queda vigilada.",
    texto:
      "Quiubot compara tu campaña contra tu propio promedio todo el tiempo. Si algo se puede mejorar, te avisa — tú decides si aplicar.",
  },
];

const TAB_ICONS = [
  <path key="a" d="M4 4h16v16H4z" />,
  <path key="b" d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  <path key="c" d="M4 6l8-4 8 4v8l-8 4-8-4V6z" />,
  <path key="d" d="M3 12h4l3 8 4-16 3 8h4" />,
];

function PanelContenido({ paso }: { paso: number }) {
  return (
    <div className="panel-fade" key={paso}>
      {paso === 0 && (
        <div className="panel-escena">
          <div className="avatar-marca" />
          <div className="paleta">
            <span style={{ background: "#4A3FAE" }} />
            <span style={{ background: "#7F77DD" }} />
            <span style={{ background: "#C4BFF0" }} />
          </div>
          <div className="badge-ok">✓ Identidad de marca guardada</div>
        </div>
      )}
      {paso === 1 && (
        <div className="panel-escena">
          <div className="pills">
            <span className="pill activo">Venta Directa</span>
            <span className="pill">Reconocimiento</span>
          </div>
          <div className="budget-row">
            <div className="budget-bar"><div className="budget-fill" /></div>
            <span className="budget-num">$300.000/mes</span>
          </div>
        </div>
      )}
      {paso === 2 && (
        <div className="panel-escena">
          <div className="creativos-row">
            <div className="creativo-card c1"><div className="foto" /><div className="precio-tag">-20%</div><div className="info-mini"><div className="linea" /><div className="linea corta" /></div></div>
            <div className="creativo-card c2"><div className="foto" /><div className="precio-tag">Nuevo</div><div className="info-mini"><div className="linea" /><div className="linea corta" /></div></div>
            <div className="creativo-card c3"><div className="foto" /><div className="precio-tag">Top</div><div className="info-mini"><div className="linea" /><div className="linea corta" /></div></div>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Generados y auditados por IA</div>
        </div>
      )}
      {paso === 3 && (
        <div className="panel-escena">
          <div className="campana-row">
            <span className="estado-dot" />
            <div className="info"><b>Venta Directa · Activa</b><span>Publicada en Meta Ads</span></div>
          </div>
          <div className="vigilancia-line">
            <svg viewBox="0 0 200 40" width="100%" height="40">
              <polyline points="0,30 30,26 60,28 90,14 120,18 150,6 180,10 200,4" fill="none" stroke="#1FA97C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="badge-ok">✓ Rendimiento por encima de tu promedio</div>
        </div>
      )}
    </div>
  );
}

export default function BienvenidaExperience() {
  const [pasoActivo, setPasoActivo] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      setProgreso(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0);
      setNavScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.paso);
            setPasoActivo(idx);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="qb-lp">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      <RevealObserver />
      <style>{`
        .qb-lp {
          --bg: #FAFAF8;
          --bg-alt: #F1EFFB;
          --paper: #FFFDF7;
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
        .qb-lp h1, .qb-lp h2, .qb-lp h3 { font-family: var(--font-display), system-ui, sans-serif; letter-spacing: -0.02em; margin: 0; }
        .qb-lp .eyebrow { font-family: var(--font-mono), monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--purple-deep); margin: 0 0 14px; }

        .qb-lp .btn-cta { display: inline-flex; align-items: center; gap: 8px; background: var(--purple-deep); color: #fff; font-weight: 600; font-size: 16px; padding: 15px 28px; border-radius: 10px; text-decoration: none; box-shadow: 0 3px 0 rgba(23,21,43,0.18); transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; border: none; cursor: pointer; }
        .qb-lp .btn-cta:hover { transform: translateY(-1px); background: #3E3494; box-shadow: 0 4px 0 rgba(23,21,43,0.2); }
        .qb-lp .btn-cta:active { transform: translateY(1px); box-shadow: 0 1px 0 rgba(23,21,43,0.18); }
        .qb-lp .micro { font-size: 13px; color: var(--muted); margin-top: 12px; }

        .qb-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s cubic-bezier(.16,.84,.44,1), transform .7s cubic-bezier(.16,.84,.44,1); }
        .qb-reveal.qb-in { opacity: 1; transform: none; }
        .qb-reveal-delay-1.qb-in { transition-delay: .08s; }
        .qb-reveal-delay-2.qb-in { transition-delay: .16s; }
        .qb-reveal-delay-3.qb-in { transition-delay: .24s; }
        .qb-reveal-delay-4.qb-in { transition-delay: .32s; }

        /* ---- PROGRESO GLOBAL ---- */
        .qb-lp .progreso-bar { position: fixed; top: 0; left: 0; height: 3px; background: var(--mint); z-index: 60; transition: width .1s linear; }

        /* ---- NAV STICKY ---- */
        .qb-lp nav { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; max-width: 1120px; margin: 0 auto; background: rgba(250,250,248,0.82); backdrop-filter: blur(10px); border-bottom: 1px dashed #E2DEF3; transition: box-shadow .2s ease, padding .2s ease; }
        .qb-lp nav.scrolled { box-shadow: 0 6px 18px rgba(23,21,43,0.06); padding: 12px 24px; }
        .qb-lp .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; }
        .qb-lp .brand img { width: 32px; height: 32px; border-radius: 9px; }
        .qb-lp .brand span.acc { color: var(--purple); }
        .qb-lp nav .btn-cta { padding: 10px 20px; font-size: 14px; border-radius: 8px; box-shadow: none; }

        /* ---- HERO ---- */
        .qb-lp .hero { padding: 60px 24px 64px; display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; max-width: 1120px; margin: 0 auto; position: relative; background-image: radial-gradient(rgba(74,63,174,0.14) 1px, transparent 1px); background-size: 22px 22px; background-position: -6px -6px; }
        .qb-lp .hero::before { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, var(--bg) 35%, transparent 70%); pointer-events: none; z-index: 0; }
        .qb-lp .hero > * { position: relative; z-index: 1; }
        .qb-lp .hero h1 { font-size: clamp(34px, 5vw, 54px); line-height: 1.06; font-weight: 700; }
        .qb-lp .hero h1 .grad { color: var(--purple-deep); }
        .qb-lp .hero p.sub { font-size: 17px; line-height: 1.55; color: var(--muted); margin: 20px 0 28px; max-width: 480px; }

        .qb-lp .recibo-stage { display: flex; justify-content: center; }
        .qb-lp .recibo-shadow { filter: drop-shadow(0 22px 40px rgba(23,21,43,0.16)); }
        .qb-lp .recibo { width: 100%; max-width: 320px; background: var(--paper); padding: 26px 26px 22px; font-family: var(--font-mono), monospace; transform: rotate(-2deg);
          clip-path: polygon(0% 0%, 100% 0%, 100% 94%, 96% 100%, 92% 94%, 88% 100%, 84% 94%, 80% 100%, 76% 94%, 72% 100%, 68% 94%, 64% 100%, 60% 94%, 56% 100%, 52% 94%, 48% 100%, 44% 94%, 40% 100%, 36% 94%, 32% 100%, 28% 94%, 24% 100%, 20% 94%, 16% 100%, 12% 94%, 8% 100%, 4% 94%, 0% 100%);
        }
        .qb-lp .recibo-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .qb-lp .recibo-top b { font-size: 14px; letter-spacing: 0.06em; }
        .qb-lp .recibo-top span { font-size: 11px; color: var(--muted); }
        .qb-lp .recibo-fecha { font-size: 11px; color: var(--muted); margin-bottom: 14px; }
        .qb-lp .recibo-div { border-top: 1px dashed #D8D3EC; margin: 12px 0; }
        .qb-lp .recibo-linea { display: flex; align-items: baseline; gap: 8px; font-size: 13px; padding: 5px 0; white-space: nowrap; overflow: hidden; width: 0; animation: qbTypeLine 10s steps(24, end) infinite; }
        .qb-lp .recibo-linea .box { color: var(--mint); font-weight: 700; flex-shrink: 0; }
        .qb-lp .recibo-linea.pend .box { color: var(--purple); }
        .qb-lp .recibo-linea .rel-txt { flex-shrink: 0; }
        .qb-lp .recibo-linea .dots { color: #C7C1E0; flex: 1; }
        .qb-lp .recibo-linea .nota { flex-shrink: 0; color: var(--ink); font-weight: 600; }
        .qb-lp .recibo-linea.pend .nota::after { content: "_"; animation: qbBlink 1s steps(1) infinite; }
        .qb-lp .recibo-linea:nth-child(1) { animation-delay: 0s; }
        .qb-lp .recibo-linea:nth-child(2) { animation-delay: 1.4s; }
        .qb-lp .recibo-linea:nth-child(3) { animation-delay: 2.8s; }
        .qb-lp .recibo-linea:nth-child(4) { animation-delay: 4.2s; }
        @keyframes qbTypeLine { 0% { width: 0; } 12%, 100% { width: 100%; } }
        @keyframes qbBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .qb-lp .recibo-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-top: 4px; }
        .qb-lp .recibo-total span:last-child { color: var(--purple-deep); }
        .qb-lp .recibo-code { text-align: center; font-size: 10px; letter-spacing: 0.3em; color: var(--muted); margin-top: 16px; }

        .qb-lp section { padding: 88px 24px; position: relative; }
        .qb-lp .section-head { max-width: 640px; margin: 0 auto 48px; text-align: center; }
        .qb-lp .section-head h2 { font-size: clamp(26px, 3.4vw, 38px); font-weight: 700; }
        .qb-lp .section-head p.lead { font-size: 16px; color: var(--muted); margin-top: 14px; line-height: 1.55; }
        .qb-lp .alt { background: var(--bg-alt); }

        .qb-lp .pain-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .qb-lp .pain-item { display: flex; gap: 14px; align-items: flex-start; font-size: 16px; color: var(--ink); background: #fff; border: 1px solid #ECE9F7; border-radius: 14px; padding: 16px 20px; }
        .qb-lp .pain-item .x { color: #C24545; font-weight: 700; flex-shrink: 0; }

        /* ---- EXPERIENCIA SCROLL-DRIVEN ---- */
        .qb-lp .experiencia-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 0.85fr 1.05fr; gap: 60px; }
        .qb-lp .pasos-col { display: flex; flex-direction: column; gap: 0; }
        .qb-lp .paso-block { min-height: 62vh; display: flex; flex-direction: column; justify-content: center; padding: 24px 0; }
        .qb-lp .paso-block .tab-activa { display: none; }
        .qb-lp .paso-block h3 { font-size: clamp(22px, 2.6vw, 30px); font-weight: 700; margin: 10px 0 12px; }
        .qb-lp .paso-block p { font-size: 15.5px; color: var(--muted); line-height: 1.6; max-width: 420px; }
        .qb-lp .paso-num { font-family: var(--font-mono), monospace; font-size: 12px; color: var(--purple); letter-spacing: 0.08em; text-transform: uppercase; }

        .qb-lp .panel-col { position: sticky; top: 100px; align-self: start; height: fit-content; }
        .qb-lp .panel-frame { background: #fff; border-radius: 16px; border: 1px solid #ECE9F7; box-shadow: 0 20px 44px rgba(23,21,43,0.1); overflow: hidden; display: flex; height: 340px; }
        .qb-lp .panel-rail { width: 56px; background: var(--bg-alt); border-right: 1px solid #ECE9F7; display: flex; flex-direction: column; align-items: center; padding: 18px 0; gap: 14px; }
        .qb-lp .rail-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: var(--muted); transition: background .2s ease, color .2s ease; }
        .qb-lp .rail-icon.activo { background: var(--purple-deep); color: #fff; }
        .qb-lp .rail-icon svg { width: 16px; height: 16px; }
        .qb-lp .panel-main { flex: 1; display: flex; flex-direction: column; }
        .qb-lp .panel-topbar { display: flex; align-items: center; gap: 6px; padding: 12px 18px; border-bottom: 1px solid #F1EFF9; }
        .qb-lp .panel-topbar span { width: 8px; height: 8px; border-radius: 50%; background: #E5E1F5; }
        .qb-lp .panel-topbar b { margin-left: 8px; font-size: 12px; color: var(--muted); font-weight: 500; }
        .qb-lp .panel-body { flex: 1; padding: 24px; display: flex; align-items: center; }
        .qb-lp .panel-fade { width: 100%; animation: qbPanelFade .45s cubic-bezier(.16,.84,.44,1); }
        @keyframes qbPanelFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .qb-lp .panel-escena { display: flex; flex-direction: column; gap: 16px; width: 100%; }
        .qb-lp .avatar-marca { width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, var(--purple), var(--purple-light)); }
        .qb-lp .paleta { display: flex; gap: 6px; }
        .qb-lp .paleta span { width: 16px; height: 16px; border-radius: 5px; }
        .qb-lp .badge-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--mint); font-weight: 600; }
        .qb-lp .pills { display: flex; gap: 8px; }
        .qb-lp .pill { font-size: 12px; padding: 6px 12px; border-radius: 20px; border: 1px solid #E5E1F5; color: var(--muted); }
        .qb-lp .pill.activo { background: var(--purple); color: #fff; border-color: var(--purple); }
        .qb-lp .budget-row { display: flex; align-items: center; gap: 10px; }
        .qb-lp .budget-bar { position: relative; height: 8px; border-radius: 6px; background: #EFEDFA; width: 220px; }
        .qb-lp .budget-fill { height: 100%; border-radius: 6px; background: var(--purple-deep); animation: qbFillOnce .8s ease forwards; }
        @keyframes qbFillOnce { from { width: 0%; } to { width: 72%; } }
        .qb-lp .budget-num { font-family: var(--font-mono), monospace; font-size: 13px; font-weight: 600; color: var(--purple-deep); }
        .qb-lp .creativos-row { display: flex; gap: 12px; }
        .qb-lp .creativo-card { position: relative; width: 76px; height: 86px; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 14px rgba(74,63,174,0.16); animation: qbCardIn .45s ease both; }
        .qb-lp .creativo-card:nth-child(1) { animation-delay: 0s; }
        .qb-lp .creativo-card:nth-child(2) { animation-delay: .12s; }
        .qb-lp .creativo-card:nth-child(3) { animation-delay: .24s; }
        @keyframes qbCardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .qb-lp .creativo-card .foto { height: 58px; }
        .qb-lp .creativo-card.c1 .foto { background: linear-gradient(160deg, #8B82E8, #4A3FAE); }
        .qb-lp .creativo-card.c2 .foto { background: linear-gradient(160deg, #6FCBA6, #1FA97C); }
        .qb-lp .creativo-card.c3 .foto { background: linear-gradient(160deg, #E8B4E0, #B36FCB); }
        .qb-lp .creativo-card .info-mini { background: #fff; padding: 6px 7px; }
        .qb-lp .creativo-card .info-mini .linea { height: 5px; border-radius: 3px; background: #E5E1F5; margin-bottom: 4px; }
        .qb-lp .creativo-card .info-mini .linea.corta { width: 60%; }
        .qb-lp .creativo-card .precio-tag { position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.92); color: var(--purple-deep); font-size: 8px; font-weight: 700; padding: 2px 5px; border-radius: 6px; }
        .qb-lp .campana-row { display: flex; align-items: center; gap: 10px; background: #F7F6FD; border: 1px solid #ECE9F7; border-radius: 12px; padding: 12px 16px; }
        .qb-lp .campana-row .estado-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--mint); box-shadow: 0 0 0 4px rgba(31,169,124,0.18); flex-shrink: 0; }
        .qb-lp .campana-row .info { display: flex; flex-direction: column; gap: 2px; }
        .qb-lp .campana-row .info b { font-size: 13px; }
        .qb-lp .campana-row .info span { font-size: 11px; color: var(--muted); }
        .qb-lp .vigilancia-line { opacity: 0.9; }

        .qb-lp .ganancias { display: flex; flex-direction: column; gap: 20px; margin-top: 8px; }
        .qb-lp .ganancias h3 { font-size: 18px; font-weight: 700; }
        .qb-lp .ganancia-item { display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; color: var(--ink); line-height: 1.5; }
        .qb-lp .ganancia-item .check { color: var(--mint); font-weight: 700; flex-shrink: 0; }

        .qb-lp .ayudas { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .qb-lp .ayuda-card { background: #fff; border-radius: 14px; padding: 26px 24px; border: 1px solid #ECE9F7; border-left: 3px solid transparent; transition: border-color .2s ease, background .2s ease; }
        .qb-lp .ayuda-card:hover { border-left-color: var(--purple); background: #FDFCFF; }
        .qb-lp .ayuda-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        .qb-lp .ayuda-card h3::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--mint); flex-shrink: 0; }
        .qb-lp .ayuda-card p { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 0; }

        .qb-lp .sello-box { max-width: 780px; margin: 0 auto; text-align: center; background: #fff; border: 1.5px solid #E5E1F5; border-radius: 20px; padding: 48px 40px; position: relative; }
        .qb-lp .sello-box::before { content: ""; position: absolute; inset: 8px; border: 1px dashed rgba(127,119,221,0.3); border-radius: 14px; pointer-events: none; }
        .qb-lp .sello-icono { width: 60px; height: 60px; margin: 0 auto 18px; border-radius: 50%; background: var(--purple-deep); display: flex; align-items: center; justify-content: center; }
        .qb-lp .sello-icono svg { width: 26px; height: 26px; }
        .qb-lp .sello-box h2 { font-size: clamp(24px, 3vw, 32px); }
        .qb-lp .sello-box p.lead { max-width: 560px; margin: 14px auto 0; }
        .qb-lp .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 30px; }
        .qb-lp .chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--purple-deep); background: var(--bg-alt); border: 1px solid #E5E1F5; padding: 9px 16px 9px 12px; border-radius: 20px; }
        .qb-lp .chip .check-mini { width: 16px; height: 16px; border-radius: 50%; background: var(--mint); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

        .qb-lp .garantias { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 34px; padding-top: 30px; border-top: 1px dashed #E2DEF3; text-align: left; }
        .qb-lp .garantia { display: flex; flex-direction: column; gap: 8px; }
        .qb-lp .garantia .icono-g { width: 38px; height: 38px; border-radius: 10px; background: var(--bg-alt); display: flex; align-items: center; justify-content: center; }
        .qb-lp .garantia .icono-g svg { width: 18px; height: 18px; }
        .qb-lp .garantia .titulo-g { font-size: 15px; font-weight: 700; color: var(--ink); }
        .qb-lp .garantia .texto-g { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .qb-lp .sello-cta { margin-top: 32px; display: flex; flex-direction: column; align-items: center; gap: 10px; }

        .qb-lp .planes { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .qb-lp .plan-card { background: #fff; border: 1.5px solid #ECE9F7; border-radius: 14px; padding: 26px 22px; text-align: center; transition: border-color .2s ease; }
        .qb-lp .plan-card:hover { border-color: var(--purple-light); }
        .qb-lp .plan-card.destacado { border-color: var(--purple); box-shadow: 0 8px 22px rgba(127,119,221,0.14); }
        .qb-lp .plan-card .tag { font-family: var(--font-mono), monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--purple); font-weight: 600; }
        .qb-lp .plan-card h3 { font-size: 18px; margin: 10px 0 4px; }
        .qb-lp .plan-card .precio { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .qb-lp .plan-card .precio small { font-size: 12px; font-weight: 500; color: var(--muted); }
        .qb-lp .plan-card p.detalle { font-size: 13px; color: var(--muted); line-height: 1.5; }
        .qb-lp .planes-footer { text-align: center; margin-top: 28px; }
        .qb-lp .planes-footer a { color: var(--purple-deep); font-size: 14px; font-weight: 600; text-decoration: none; }

        .qb-lp .cta-final { background: var(--ink); border-radius: 20px; max-width: 1000px; margin: 0 auto; padding: 64px 40px; text-align: center; position: relative; overflow: hidden; }
        .qb-lp .cta-final::before { content: ""; position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 46px 46px 0; border-color: transparent var(--purple) transparent transparent; }
        .qb-lp .cta-final h2 { color: #fff; font-size: clamp(24px, 3.2vw, 34px); font-weight: 700; max-width: 560px; margin: 0 auto 28px; }
        .qb-lp .cta-final .btn-cta { background: var(--mint); box-shadow: 0 3px 0 rgba(0,0,0,0.2); }
        .qb-lp .cta-final .btn-cta:hover { background: #199469; }
        .qb-lp .cta-final .micro { color: rgba(255,255,255,0.6); }

        .qb-lp footer { padding: 40px 24px 60px; text-align: center; color: var(--muted); font-size: 13px; }
        .qb-lp footer a { color: var(--muted); text-decoration: underline; }

        @media (max-width: 860px) {
          .qb-lp .hero { grid-template-columns: 1fr; padding-top: 32px; }
          .qb-lp .hero p.sub { max-width: 100%; }
          .qb-lp .ayudas { grid-template-columns: 1fr; }
          .qb-lp .planes { grid-template-columns: 1fr; }
          .qb-lp .garantias { grid-template-columns: 1fr; }
          .qb-lp section { padding: 64px 20px; }
          .qb-lp .experiencia-grid { grid-template-columns: 1fr; gap: 0; }
          .qb-lp .panel-col { position: static; margin-bottom: 18px; }
          .qb-lp .paso-block { min-height: 0; padding: 20px 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qb-lp .recibo-linea, .qb-lp .recibo-linea.pend .nota::after, .qb-lp .panel-fade,
          .qb-lp .budget-fill, .qb-lp .creativo-card {
            animation: none !important;
          }
          .qb-lp .recibo-linea { width: 100% !important; }
          .qb-lp .budget-fill { width: 72% !important; }
          .qb-lp .qb-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>

      <div className="progreso-bar" style={{ width: `${progreso}%` }} />

      <nav className={navScrolled ? "scrolled" : ""}>
        <div className="brand">
          <img src="/marca/icono-quiubot.svg" alt="" />
          quiu<span className="acc">bot</span>
        </div>
        <Link href="/login" className="btn-cta">Iniciar prueba gratis</Link>
      </nav>

      <section className="hero" style={{ paddingBottom: 20 }}>
        <div>
          <p className="eyebrow">Publicidad con IA · Meta Ads</p>
          <h1>Tu próxima campaña <span className="grad">no la armas tú.</span></h1>
          <p className="sub">
            Estrategia, creativos y publicación para Meta Ads generados con IA — y un motor
            que vigila tus campañas todo el tiempo para que nunca quemes presupuesto sin darte cuenta.
          </p>
          <Link href="/login" className="btn-cta">Iniciar prueba gratuita de 7 días →</Link>
          <p className="micro">Sin tarjeta de crédito. Cancela cuando quieras.</p>
        </div>
        <div className="recibo-stage">
          <div className="recibo-shadow">
            <div className="recibo">
              <div className="recibo-top"><b>QUIUBOT</b><span>PEDIDO #00482</span></div>
              <div className="recibo-fecha">Hoy · Meta Ads</div>
              <div className="recibo-div" />
              {RECIBO_LINEAS.map((l) => (
                <div className={`recibo-linea ${l.estado === " " ? "pend" : ""}`} key={l.texto}>
                  <span className="box">[{l.estado}]</span>
                  <span className="rel-txt">{l.texto}</span>
                  <span className="dots">···········</span>
                  <span className="nota">{l.nota}</span>
                </div>
              ))}
              <div className="recibo-div" />
              <div className="recibo-total"><span>TOTAL</span><span>0 horas tuyas</span></div>
              <div className="recibo-code">* GRACIAS POR SU VISITA *</div>
            </div>
          </div>
        </div>
      </section>

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
          <h2>Baja y mira la app trabajar, paso a paso.</h2>
          <p className="lead">Esto es exactamente lo que ves al entrar — nada de mockups genéricos.</p>
        </div>

        <div className="experiencia-grid">
          <div className="pasos-col">
            {PASOS.map((p, i) => (
              <div
                className="paso-block"
                key={p.tab}
                data-paso={i}
                ref={(el) => { refs.current[i] = el; }}
              >
                <span className="paso-num">{p.eyebrow}</span>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </div>
            ))}
            <div className="ganancias qb-reveal">
              <h3>Lo que te regala Quiubot</h3>
              {GANANCIAS.map((g) => (
                <div className="ganancia-item" key={g}><span className="check">✓</span>{g}</div>
              ))}
            </div>
          </div>

          <div className="panel-col">
            <div className="panel-frame">
              <div className="panel-rail">
                {PASOS.map((p, i) => (
                  <div className={`rail-icon ${pasoActivo === i ? "activo" : ""}`} key={p.tab} title={p.tab}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {TAB_ICONS[i]}
                    </svg>
                  </div>
                ))}
              </div>
              <div className="panel-main">
                <div className="panel-topbar"><span /><span /><span /><b>{PASOS[pasoActivo].tab}</b></div>
                <div className="panel-body"><PanelContenido paso={pasoActivo} /></div>
              </div>
            </div>
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
              <div className="precio">{p.precio}{p.precio !== "Gratis" && <small> COP/mes</small>}</div>
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
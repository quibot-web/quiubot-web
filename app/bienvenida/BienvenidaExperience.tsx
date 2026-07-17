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

const HUD_LINEAS = [
  "Analizando tu categoria",
  "Calculando presupuesto ideal",
  "Auditando creativos",
  "Vigilando tu campaña",
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

function CoreOrb() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const colores = ["#7F77DD", "#4A3FAE", "#1FA97C", "#C4BFF0"];
    const particulas = Array.from({ length: 42 }).map(() => ({
      angulo: Math.random() * Math.PI * 2,
      radio: 26 + Math.random() * 92,
      velocidad: (Math.random() * 0.006 + 0.0025) * (Math.random() < 0.5 ? 1 : -1),
      tam: Math.random() * 2.2 + 1,
      color: colores[Math.floor(Math.random() * colores.length)],
      fase: Math.random() * Math.PI * 2,
    }));

    const pintar = () => {
      ctx.clearRect(0, 0, W, H);
      particulas.forEach((p) => {
        if (!reduce) {
          p.angulo += p.velocidad;
          p.fase += 0.02;
        }
        const r = p.radio + Math.sin(p.fase) * 6;
        const x = cx + Math.cos(p.angulo) * r;
        const y = cy + Math.sin(p.angulo) * r * 0.85;
        ctx.beginPath();
        ctx.arc(x, y, p.tam, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 9;
        ctx.globalAlpha = 0.78;
        ctx.fill();
      });
      if (!reduce) raf = requestAnimationFrame(pintar);
    };

    let raf = 0;
    pintar();
    if (reduce) return;
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={340} height={340} className="core-canvas" />;
}

function DisolucionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const contenedor = canvas?.parentElement;
    if (!canvas || !contenedor) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colores = ["#7F77DD", "#4A3FAE", "#1FA97C", "#C4BFF0"];
    const CICLO = 14;

    let W = 0;
    let H = 0;
    const medir = () => {
      W = contenedor.clientWidth;
      H = contenedor.clientHeight;
      canvas.width = W;
      canvas.height = H;
    };
    medir();
    window.addEventListener("resize", medir);

    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Muestrea los pixeles del logo real para que las particulas lo dibujen
    let puntosLogo: { x: number; y: number }[] = [];
    const img = new Image();
    img.src = "/marca/icono-quiubot.svg";
    img.onload = () => {
      const tam = 96;
      const off = document.createElement("canvas");
      off.width = tam;
      off.height = tam;
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(img, 0, 0, tam, tam);
      const data = octx.getImageData(0, 0, tam, tam).data;
      const pts: { x: number; y: number }[] = [];
      for (let y = 0; y < tam; y += 3) {
        for (let x = 0; x < tam; x += 3) {
          const alpha = data[(y * tam + x) * 4 + 3];
          if (alpha > 80) pts.push({ x: x / tam - 0.5, y: y / tam - 0.5 });
        }
      }
      puntosLogo = pts;
    };

    const origenesRel = [
      { dx: -0.24, dy: -0.24 },
      { dx: 0.08, dy: 0.02 },
      { dx: -0.26, dy: 0.22 },
    ];

    const particulas = Array.from({ length: 90 }).map(() => {
      const grupo = origenesRel[Math.floor(Math.random() * origenesRel.length)];
      const jitterX = (Math.random() - 0.5) * 0.08;
      const jitterY = (Math.random() - 0.5) * 0.08;
      const angulo = Math.random() * Math.PI * 2;
      return {
        origX: grupo.dx + jitterX,
        origY: grupo.dy + jitterY,
        anguloExplosion: angulo,
        distExplosion: 0.14 + Math.random() * 0.22,
        anguloOrbita: Math.random() * Math.PI * 2,
        radioOrbita: 0.045 + Math.random() * 0.09,
        tam: 1.4 + Math.random() * 2.6,
        color: colores[Math.floor(Math.random() * colores.length)],
        offsetFase: (Math.random() - 0.5) * 0.012,
        logoTarget: null as { x: number; y: number } | null,
      };
    });

    let raf = 0;
    const inicio = performance.now();

    const dibujar = (ahora: number) => {
      if (W && H) {
        ctx.clearRect(0, 0, W, H);
        const cx = W / 2;
        const cy = H * 0.46;
        const escala = Math.min(W, H);
        const escalaLogo = escala * 0.62;
        const transcurrido = reduce ? CICLO * 0.95 : (ahora - inicio) / 1000;
        const tGlobal = (transcurrido % CICLO) / CICLO;

        let glowAlpha = 0;

        particulas.forEach((p) => {
          const t = reduce ? 0.95 : Math.min(1, Math.max(0, tGlobal + p.offsetFase));
          const origX = cx + p.origX * escala;
          const origY = cy + p.origY * escala;
          const explX = origX + Math.cos(p.anguloExplosion) * p.distExplosion * escala;
          const explY = origY + Math.sin(p.anguloExplosion) * p.distExplosion * escala;

          if (!p.logoTarget && puntosLogo.length) {
            p.logoTarget = puntosLogo[Math.floor(Math.random() * puntosLogo.length)];
          }
          const orbX = cx + Math.cos(p.anguloOrbita) * p.radioOrbita * escala;
          const orbY = cy + Math.sin(p.anguloOrbita) * p.radioOrbita * escala * 0.85;
          const destX = p.logoTarget ? cx + p.logoTarget.x * escalaLogo : orbX;
          const destY = p.logoTarget ? cy + p.logoTarget.y * escalaLogo : orbY;

          let x = origX;
          let y = origY;
          let alpha = 0;

          if (t < 0.257) {
            alpha = 0;
          } else if (t < 0.354) {
            const p2 = easeOut((t - 0.257) / 0.097);
            x = lerp(origX, explX, p2);
            y = lerp(origY, explY, p2);
            alpha = p2;
          } else if (t < 0.476) {
            const p2 = easeInOut((t - 0.354) / 0.122);
            x = lerp(explX, destX, p2);
            y = lerp(explY, destY, p2);
            alpha = 1;
            glowAlpha = Math.max(glowAlpha, p2);
          } else if (t < 0.514) {
            x = destX;
            y = destY;
            alpha = 1;
            glowAlpha = 1;
          } else if (t < 0.571) {
            const p2 = (t - 0.514) / 0.057;
            x = destX;
            y = destY;
            alpha = 1 - p2;
            glowAlpha = 1 - p2;
          } else {
            alpha = 0;
            glowAlpha = 0;
          }

          if (alpha > 0.01) {
            ctx.beginPath();
            ctx.arc(x, y, p.tam, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.globalAlpha = alpha * 0.85;
            ctx.fill();
          }
        });

        if (glowAlpha > 0.01) {
          const r = escala * 0.22;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, `rgba(127,119,221,${0.3 * glowAlpha})`);
          grad.addColorStop(1, "rgba(127,119,221,0)");
          ctx.globalAlpha = 1;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (!reduce) raf = requestAnimationFrame(dibujar);
    };

    dibujar(performance.now());
    if (reduce) return () => window.removeEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", medir);
    };
  }, []);

  return <canvas ref={canvasRef} className="disolucion-canvas" />;
}

export default function BienvenidaExperience() {
  const [pasoActivo, setPasoActivo] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

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
    const id = setInterval(() => {
      setPasoActivo((p) => (p + 1) % PASOS.length);
    }, 4500);
    return () => clearInterval(id);
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

        /* ---- NUCLEO (brillo + profundidad) ---- */
        .qb-lp .core-stage { position: relative; width: 100%; max-width: 360px; aspect-ratio: 1 / 1; margin: 0 auto 46px; }
        .qb-lp .core-glow { position: absolute; inset: -6%; border-radius: 50%; background: radial-gradient(circle at 50% 42%, rgba(127,119,221,0.55), rgba(74,63,174,0.22) 42%, transparent 72%); filter: blur(26px); animation: qbCoreBreathe 5s ease-in-out infinite; }
        .qb-lp .core-glow::after { content: ""; position: absolute; inset: 14%; border-radius: 50%; background: radial-gradient(circle at 55% 60%, rgba(31,169,124,0.35), transparent 70%); filter: blur(20px); }
        @keyframes qbCoreBreathe { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.88; } }
        .qb-lp .core-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
        .qb-lp .core-ring { position: absolute; inset: 9%; border-radius: 50%; border: 1px solid rgba(127,119,221,0.3); }
        .qb-lp .core-ring::before { content: ""; position: absolute; inset: -1px; border-radius: 50%; border: 1px dashed rgba(127,119,221,0.18); animation: qbCoreSpin 40s linear infinite; }
        @keyframes qbCoreSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .qb-lp .core-mark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 20px; background: #fff; box-shadow: 0 10px 26px rgba(74,63,174,0.25); display: flex; align-items: center; justify-content: center; }
        .qb-lp .core-mark img { width: 34px; height: 34px; }
        .qb-lp .core-hud { position: absolute; left: 50%; bottom: -18px; transform: translateX(-50%); width: 88%; background: rgba(255,255,255,0.82); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.7); border-radius: 14px; padding: 14px 18px; box-shadow: 0 16px 36px rgba(23,21,43,0.14); font-family: var(--font-mono), monospace; }
        .qb-lp .hud-line { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12.5px; color: var(--muted); font-weight: 500; opacity: 0.45; animation: qbHudPulse 8s ease-in-out infinite; }
        .qb-lp .hud-line .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple); flex-shrink: 0; }
        .qb-lp .hud-line:nth-child(1) { animation-delay: 0s; }
        .qb-lp .hud-line:nth-child(2) { animation-delay: 2s; }
        .qb-lp .hud-line:nth-child(3) { animation-delay: 4s; }
        .qb-lp .hud-line:nth-child(4) { animation-delay: 6s; }
        @keyframes qbHudPulse {
          0% { opacity: 0.4; color: var(--muted); font-weight: 500; }
          6% { opacity: 1; color: var(--ink); font-weight: 600; }
          20% { opacity: 1; color: var(--ink); font-weight: 600; }
          26% { opacity: 0.4; color: var(--muted); font-weight: 500; }
          100% { opacity: 0.4; color: var(--muted); font-weight: 500; }
        }
        .qb-lp .hud-line:nth-child(1) .dot { background: var(--purple); }
        .qb-lp .hud-line:nth-child(2) .dot { background: var(--purple-deep); }
        .qb-lp .hud-line:nth-child(3) .dot { background: var(--purple); }
        .qb-lp .hud-line:nth-child(4) .dot { background: var(--mint); }

        .qb-lp section { padding: 88px 24px; position: relative; }
        .qb-lp .section-head { max-width: 640px; margin: 0 auto 48px; text-align: center; }
        .qb-lp .section-head h2 { font-size: clamp(26px, 3.4vw, 38px); font-weight: 700; }
        .qb-lp .section-head p.lead { font-size: 16px; color: var(--muted); margin-top: 14px; line-height: 1.55; }
        .qb-lp .alt { background: var(--bg-alt); }

        /* ---- CAOS -> OLEADA DE COLOR -> CALMA (ancho completo) ---- */
        .qb-lp .caos-calma-band { position: relative; width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); min-height: 420px; overflow: hidden; padding: 44px 24px; }
        .qb-lp .caos-calma-stage { position: relative; max-width: 640px; margin: 0 auto; min-height: 330px; animation: qbShake 14s ease-in-out infinite; z-index: 1; }
        @keyframes qbShake {
          0%, 20%, 29%, 100% { transform: translateX(0); }
          21.4% { transform: translateX(-3px); }
          23% { transform: translateX(3px); }
          24.5% { transform: translateX(-3px); }
          26% { transform: translateX(2px); }
        }
        .qb-lp .pain-notif { position: absolute; width: min(360px, 82vw); display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #F1EFF9; border-radius: 16px; padding: 14px 16px; box-shadow: 0 16px 32px rgba(23,21,43,0.14); opacity: 0; }
        .qb-lp .pn-1 { top: 0; left: 0; --rot: -3deg; animation: qbNotif1 14s ease-in-out infinite; }
        .qb-lp .pn-2 { top: 120px; left: 130px; --rot: 2.5deg; animation: qbNotif2 14s ease-in-out infinite; }
        .qb-lp .pn-3 { top: 246px; left: 12px; --rot: -1.5deg; animation: qbNotif3 14s ease-in-out infinite; }
        @keyframes qbNotif1 {
          0%, 100% { opacity: 0; transform: translateY(-22px) scale(0.92) rotate(var(--rot)); }
          5% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          25.7% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          30.7% { opacity: 0; transform: translateY(-8px) scale(0.96) rotate(var(--rot)); }
        }
        @keyframes qbNotif2 {
          0%, 100% { opacity: 0; transform: translateY(-22px) scale(0.92) rotate(var(--rot)); }
          12.9% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          25.7% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          30.7% { opacity: 0; transform: translateY(-8px) scale(0.96) rotate(var(--rot)); }
        }
        @keyframes qbNotif3 {
          0%, 100% { opacity: 0; transform: translateY(-22px) scale(0.92) rotate(var(--rot)); }
          20.7% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          25.7% { opacity: 1; transform: translateY(0) scale(1) rotate(var(--rot)); }
          30.7% { opacity: 0; transform: translateY(-8px) scale(0.96) rotate(var(--rot)); }
        }
        .qb-lp .pn-badge { position: absolute; top: -5px; right: -5px; width: 12px; height: 12px; border-radius: 50%; background: #C24545; box-shadow: 0 0 0 3px #fff; }
        .qb-lp .pn-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(194,69,69,0.1); color: #C24545; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .qb-lp .pn-icon svg { width: 18px; height: 18px; }
        .qb-lp .pn-body { min-width: 0; }
        .qb-lp .pn-meta { font-family: var(--font-mono), monospace; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
        .qb-lp .pn-title { font-size: 14.5px; font-weight: 700; color: var(--ink); line-height: 1.3; }
        .qb-lp .pn-sub { font-size: 12.5px; color: var(--muted); margin-top: 3px; line-height: 1.4; }

        .qb-lp .disolucion-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
        .qb-lp .logo-render { position: relative; z-index: 4; width: 68px; height: 68px; border-radius: 20px; background: #fff; box-shadow: 0 16px 40px rgba(74,63,174,0.32); display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; opacity: 0; transform: scale(0.7); animation: qbLogoRender 14s ease-in-out infinite; }
        .qb-lp .logo-render img { width: 38px; height: 38px; }
        @keyframes qbLogoRender {
          0%, 51% { opacity: 0; transform: scale(0.7); }
          57%, 85.5% { opacity: 1; transform: scale(1); }
          94%, 100% { opacity: 0; transform: scale(0.85); }
        }
        .qb-lp .calma-content { position: relative; z-index: 4; text-align: center; padding: 0 32px; opacity: 0; transform: translateY(10px); animation: qbCalmContent 14s ease-in-out infinite; pointer-events: none; }
        @keyframes qbCalmContent {
          0%, 54% { opacity: 0; transform: translateY(10px); }
          60%, 85% { opacity: 1; transform: translateY(0); }
          93%, 100% { opacity: 0; transform: translateY(-6px); }
        }
        .qb-lp .calma-content h4 { color: var(--ink); font-size: 21px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 8px; }
        .qb-lp .calma-content p { color: var(--muted); font-size: 13.5px; line-height: 1.5; max-width: 320px; margin: 0 auto; }

        /* ---- EXPERIENCIA AUTOMATICA (sin scroll forzado) ---- */
        .qb-lp .experiencia-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 0.85fr 1.05fr; gap: 60px; align-items: center; }
        .qb-lp .pasos-col { display: flex; flex-direction: column; gap: 28px; }
        .qb-lp .paso-progress { display: flex; gap: 6px; }
        .qb-lp .progress-seg { flex: 1; height: 3px; border-radius: 2px; background: #E5E1F5; overflow: hidden; }
        .qb-lp .progress-fill { height: 100%; width: 0; background: var(--purple-deep); border-radius: 2px; }
        .qb-lp .progress-fill.full { width: 100%; }
        .qb-lp .progress-fill.activo { animation: qbProgressFill 4.5s linear forwards; }
        @keyframes qbProgressFill { from { width: 0; } to { width: 100%; } }
        .qb-lp .paso-actual { min-height: 168px; animation: qbPanelFade .4s cubic-bezier(.16,.84,.44,1); }
        .qb-lp .paso-actual h3 { font-size: clamp(22px, 2.6vw, 30px); font-weight: 700; margin: 10px 0 12px; }
        .qb-lp .paso-actual p { font-size: 15.5px; color: var(--muted); line-height: 1.6; max-width: 420px; }
        .qb-lp .paso-num { font-family: var(--font-mono), monospace; font-size: 12px; color: var(--purple); letter-spacing: 0.08em; text-transform: uppercase; }

        .qb-lp .panel-col { align-self: center; }
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
          .qb-lp .caos-calma-band { min-height: 0; padding: 28px 16px; }
          .qb-lp .caos-calma-stage { min-height: 0; animation: none; }
          .qb-lp .pain-notif { position: static; width: 100%; margin-bottom: 12px; }
          .qb-lp .hero { grid-template-columns: 1fr; padding-top: 32px; }
          .qb-lp .hero p.sub { max-width: 100%; }
          .qb-lp .ayudas { grid-template-columns: 1fr; }
          .qb-lp .planes { grid-template-columns: 1fr; }
          .qb-lp .garantias { grid-template-columns: 1fr; }
          .qb-lp section { padding: 64px 20px; }
          .qb-lp .experiencia-grid { grid-template-columns: 1fr; gap: 0; }
          .qb-lp .panel-col { margin-bottom: 18px; }
          .qb-lp .core-stage { max-width: 280px; margin-bottom: 56px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .qb-lp .panel-fade, .qb-lp .budget-fill, .qb-lp .creativo-card,
          .qb-lp .core-glow, .qb-lp .core-ring::before, .qb-lp .hud-line,
          .qb-lp .progress-fill.activo, .qb-lp .paso-actual,
          .qb-lp .caos-calma-stage, .qb-lp .pain-notif,
          .qb-lp .logo-render, .qb-lp .calma-content {
            animation: none !important;
          }
          .qb-lp .budget-fill { width: 72% !important; }
          .qb-lp .progress-fill.activo { width: 100% !important; }
          .qb-lp .hud-line { opacity: 1 !important; color: var(--ink) !important; }
          .qb-lp .pain-notif { opacity: 0 !important; }
          .qb-lp .logo-render { opacity: 1 !important; transform: none !important; }
          .qb-lp .calma-content { opacity: 1 !important; transform: none !important; }
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
        <div className="core-stage">
          <div className="core-glow" />
          <CoreOrb />
          <div className="core-ring" />
          <div className="core-mark">
            <img src="/marca/icono-quiubot.svg" alt="Quiubot" />
          </div>
          <div className="core-hud">
            {HUD_LINEAS.map((linea) => (
              <div className="hud-line" key={linea}><span className="dot" />{linea}</div>
            ))}
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
        <div className="caos-calma-band">
          <div className="caos-calma-stage qb-reveal">
            <div className="pain-notif pn-1">
              <span className="pn-badge" />
              <div className="pn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                </svg>
              </div>
              <div className="pn-body">
                <div className="pn-meta">Meta Ads Manager · hace 2h</div>
                <div className="pn-title">Sigues editando el mismo anuncio 😮‍💨</div>
                <div className="pn-sub">Empezaste hace 2 horas. Todavía no publicas.</div>
              </div>
            </div>
            <div className="pain-notif pn-2">
              <span className="pn-badge" />
              <div className="pn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </div>
              <div className="pn-body">
                <div className="pn-meta">Alerta de gasto · hace 3 días</div>
                <div className="pn-title">Te gastaste $180.000 sin darte cuenta</div>
                <div className="pn-sub">Nadie ajustó la campaña a tiempo.</div>
              </div>
            </div>
            <div className="pain-notif pn-3">
              <span className="pn-badge" />
              <div className="pn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 16l5-5 4 4 5-6 4 5" />
                </svg>
              </div>
              <div className="pn-body">
                <div className="pn-meta">Diseñador · hace 4 días</div>
                <div className="pn-title">Los creativos no se parecen a tu marca</div>
                <div className="pn-sub">Y llevas 4 días esperando que lleguen.</div>
              </div>
            </div>
          </div>

          <DisolucionCanvas />
          <div className="logo-render">
            <img src="/marca/icono-quiubot.svg" alt="Quiubot" />
          </div>
          <div className="calma-content">
            <h4>Esto es tener a Quiubot de tu lado.</h4>
            <p>Cero horas tuyas, cero estrés — tu campaña vigilada y tus creativos listos, siempre.</p>
          </div>
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
            <div className="paso-progress">
              {PASOS.map((_, i) => (
                <div className="progress-seg" key={i}>
                  <div
                    className={`progress-fill ${i < pasoActivo ? "full" : i === pasoActivo ? "activo" : ""}`}
                    key={i === pasoActivo ? `activo-${pasoActivo}` : `quieto-${i}`}
                  />
                </div>
              ))}
            </div>
            <div className="paso-actual" key={pasoActivo}>
              <span className="paso-num">{PASOS[pasoActivo].eyebrow}</span>
              <h3>{PASOS[pasoActivo].titulo}</h3>
              <p>{PASOS[pasoActivo].texto}</p>
            </div>
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
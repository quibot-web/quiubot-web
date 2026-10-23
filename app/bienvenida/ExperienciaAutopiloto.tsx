"use client";
import { useEffect, useState } from "react";
import ConversacionDirector from "./ConversacionDirector";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { CtaLink, SeccionTestimonios } from "./compartido";
import { precioMensual, nombreVisiblePlan, PRECIO_FUNDADOR, DIAS_PRUEBA } from "@/app/lib/planesConfig";
import { PASOS_FACIL, PRECIOS_SECCION, CIERRE } from "./guionDirector";

// Experiencia completa de /bienvenida con AUTOPILOTO_PUBLICO encendido
// (o la vista previa de staging) -- reemplaza TODO lo que había debajo
// del nav en la Parte A (video, sección oscura, "Cómo funciona" con
// capturas, sello-box) por la conversación guiada con el Director,
// siguiendo docs/diseno/bienvenida_conversacion.html. Sin canvas, sigue
// siendo una página estática: todo el estado es de React normal, sin
// requestAnimationFrame ni dibujo manual.
export default function ExperienciaAutopiloto() {
  // Cupos de fundador: se piden UNA sola vez aquí y se reparten como
  // prop a la conversación y a la sección de precios, en vez de que
  // cada una llame al endpoint por su cuenta. null mientras carga o si
  // la llamada falla -- se trata igual que "no hay cupos" (nunca se
  // afirma el precio de fundador sin el número real).
  const [cuposFundador, setCuposFundador] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/billing/cupos-fundador")
      .then((r) => r.json())
      .then((data) => setCuposFundador(typeof data.restantes === "number" ? data.restantes : null))
      .catch(() => setCuposFundador(null));
  }, []);
  const hayFundador = cuposFundador !== null && cuposFundador > 0;

  const precioEscala = precioMensual("escala");
  const precioCrecimiento = precioMensual("crecimiento");
  const precioAutopilotoMostrado = hayFundador ? PRECIO_FUNDADOR : precioEscala;

  return (
    <div className="qb-conv">
      <style>{`
        .qb-conv {
          --bg: #0C0A17; --bg2: #141127; --card: #1B1733; --line: #2C2747;
          --ink: #F4F2FF; --muted: #B4AED3; --soft: #8E88B0;
          --brand: #7C6CF2; --brand-d: #6858E6; --ok: #5EE0A8; --gold: #F2B640;
          background: var(--bg);
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          line-height: 1.5;
          overflow-x: hidden;
        }
        .qb-conv a { color: #C9C2FF; }
        .qb-conv button { font: inherit; }
        .qb-conv h1, .qb-conv h2, .qb-conv h3 { margin: 0; letter-spacing: -.025em; line-height: 1.08; }
        .qb-conv .qbc-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 54px; padding: 0 26px; border-radius: 14px; border: 0; background: var(--brand); color: #fff; font-weight: 800; font-size: 16.5px; text-decoration: none; cursor: pointer; box-shadow: 0 14px 34px -14px var(--brand); transition: transform .15s, background .15s; }
        .qb-conv .qbc-cta:hover { background: var(--brand-d); transform: translateY(-1px); color: #fff; }

        .qb-conv .qbc-nav { display: flex; align-items: center; justify-content: space-between; height: 68px; max-width: 1080px; margin: 0 auto; padding: 0 20px; }
        .qb-conv .qbc-logo { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; font-size: 21px; text-decoration: none; }
        .qb-conv .qbc-logo img { width: 32px; height: 32px; border-radius: 9px; }
        .qb-conv .qbc-logo b { color: #C9C2FF; }
        .qb-conv .qbc-nav-mini { color: #fff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 0 16px; min-height: 44px; display: inline-flex; align-items: center; border-radius: 11px; border: 1px solid rgba(255,255,255,.2); }

        .qb-conv .qbc-escena { position: relative; isolation: isolate; }
        .qb-conv .qbc-escena::before { content: ""; position: absolute; inset: 0; z-index: -2; background: radial-gradient(60% 50% at 50% 18%, rgba(124,108,242,.32), transparent 70%), radial-gradient(40% 40% at 85% 80%, rgba(94,224,168,.10), transparent 70%), radial-gradient(40% 40% at 10% 70%, rgba(242,141,183,.10), transparent 70%); }
        .qb-conv .qbc-escena::after { content: ""; position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(70% 60% at 50% 30%, #000, transparent); }

        .qb-conv .qbc-titulo { text-align: center; padding: 18px 20px 6px; }
        .qb-conv .qbc-titulo p { margin: 0 0 12px; color: var(--ok); font-weight: 700; font-size: 13.5px; letter-spacing: .1em; text-transform: uppercase; }
        .qb-conv .qbc-titulo h1 { font-size: clamp(30px, 4.6vw, 52px); font-weight: 850; max-width: 900px; margin: 0 auto; }
        .qb-conv .qbc-titulo h1 em { font-style: normal; background: linear-gradient(90deg, #B9AEFF, #7FD8F0); -webkit-background-clip: text; background-clip: text; color: transparent; }

        .qb-conv .qbc-equipo { position: relative; display: flex; justify-content: center; align-items: flex-end; gap: clamp(8px, 2.2vw, 26px); padding: 26px 20px 8px; flex-wrap: nowrap; }
        .qb-conv .qbc-miembro { display: flex; flex-direction: column; align-items: center; gap: 8px; width: clamp(48px, 9vw, 92px); transition: transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s; }
        .qb-conv .qbc-miembro small { font-size: 12px; color: var(--soft); font-weight: 600; text-align: center; line-height: 1.2; transition: color .3s; }
        .qb-conv .qbc-equipo.qbc-enfoque .qbc-miembro { opacity: .38; transform: scale(.92); }
        .qb-conv .qbc-equipo .qbc-miembro.qbc-activo { opacity: 1; transform: translateY(-8px) scale(1.08); }
        .qb-conv .qbc-miembro.qbc-activo small { color: #fff; }
        .qb-conv .qbc-director { width: clamp(72px, 13vw, 132px); }

        .qb-conv .qbc-chat { width: min(720px, 100%); margin: 6px auto 0; padding: 0 20px 28px; }
        .qb-conv .qbc-hilo { display: flex; flex-direction: column; gap: 10px; padding: 10px 0; min-height: 120px; }
        .qb-conv .qbc-msg { display: flex; gap: 10px; align-items: flex-end; max-width: 92%; animation: qbcEntra .35s cubic-bezier(.2,.8,.2,1) both; }
        .qb-conv .qbc-av { width: 30px; flex: none; }
        .qb-conv .qbc-burbuja { background: var(--card); border: 1px solid var(--line); border-radius: 20px 20px 20px 6px; padding: 13px 16px; font-size: 16px; line-height: 1.55; color: #ECE9FF; }
        .qb-conv .qbc-burbuja strong { color: #fff; }
        .qb-conv .qbc-msg.qbc-yo { align-self: flex-end; flex-direction: row-reverse; }
        .qb-conv .qbc-msg.qbc-yo .qbc-burbuja { background: var(--brand); border-color: var(--brand); color: #fff; border-radius: 20px 20px 6px 20px; font-weight: 600; }
        .qb-conv .qbc-escribiendo .qbc-burbuja { display: flex; gap: 5px; padding: 16px 18px; }
        .qb-conv .qbc-escribiendo i { width: 7px; height: 7px; border-radius: 50%; background: #B4AED3; animation: qbcPunto 1.1s infinite; }
        .qb-conv .qbc-escribiendo i:nth-child(2) { animation-delay: .15s; }
        .qb-conv .qbc-escribiendo i:nth-child(3) { animation-delay: .3s; }
        @keyframes qbcPunto { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @keyframes qbcEntra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .qb-conv .qbc-cta-burbuja { margin-top: 12px; width: 100%; }
        .qb-conv .qbc-lista { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 7px; }
        .qb-conv .qbc-lista li { display: flex; gap: 10px; align-items: center; }
        .qb-conv .qbc-punto { width: 14px; height: 14px; border-radius: 50%; flex: none; }
        .qb-conv .qbc-punto-marca { background: radial-gradient(circle at 35% 30%, #F28DB7, #C94680); }
        .qb-conv .qbc-punto-estratega { background: radial-gradient(circle at 35% 30%, #7FB0FF, #2F6FDB); }
        .qb-conv .qbc-punto-creativo { background: radial-gradient(circle at 35% 30%, #FFB287, #EA7340); }
        .qb-conv .qbc-punto-publicador { background: radial-gradient(circle at 35% 30%, #6EE0AE, #1E9E6B); }
        .qb-conv .qbc-punto-analista { background: radial-gradient(circle at 35% 30%, #73DCE8, #1597A8); }
        .qb-conv .qbc-punto-optimizador { background: radial-gradient(circle at 35% 30%, #FFD780, #D99A1E); }
        .qb-conv .qbc-precio-msg { display: flex; align-items: baseline; gap: 8px; margin: 4px 0; }
        .qb-conv .qbc-precio-msg strong { font-size: 30px; letter-spacing: -.02em; color: #fff; }
        .qb-conv .qbc-precio-tachado { color: #8E88B0; }
        .qb-conv .qbc-planes-msg { display: grid; gap: 8px; }
        .qb-conv .qbc-pl { border: 1px solid #3A3460; border-radius: 14px; padding: 12px 14px; background: #211C3C; }
        .qb-conv .qbc-pl-top { border: 1.5px solid #8C7EF7; background: #2A2253; box-shadow: 0 0 24px -8px rgba(124,108,242,.7); }
        .qb-conv .qbc-pl-h { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .qb-conv .qbc-pl-h strong { color: #fff; font-size: 16px; }
        .qb-conv .qbc-pl-h span { color: #fff; font-weight: 800; }
        .qb-conv .qbc-pl em { display: inline-block; font-style: normal; font-size: 12px; font-weight: 800; color: #0C0A17; background: var(--ok); border-radius: 999px; padding: 2px 9px; margin-top: 6px; }
        .qb-conv .qbc-pl p { margin: 6px 0 0; color: #CFC9EC; font-size: 14.5px; line-height: 1.45; }
        .qb-conv .qbc-propuesta { margin-top: 10px; background: #231E40; border: 1px solid #3A3460; border-radius: 16px; padding: 14px; }
        .qb-conv .qbc-propuesta strong { display: block; margin-bottom: 6px; color: #fff; }
        .qb-conv .qbc-propuesta-detalle { color: #CFC9EC; font-size: 14.5px; }
        .qb-conv .qbc-propuesta-rs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .qb-conv .qbc-propuesta-rs span { padding: 8px 13px; border-radius: 10px; border: 1px solid #3F3966; font-weight: 700; font-size: 13.5px; }
        .qb-conv .qbc-rs-principal { background: var(--brand); border-color: var(--brand); }
        .qb-conv .qbc-propuesta-nota { margin-top: 8px; font-size: 12px; color: #8E88B0; }
        .qb-conv .qbc-opciones { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; padding-top: 12px; }
        .qb-conv .qbc-opcion { min-height: 46px; padding: 0 18px; border-radius: 999px; border: 1.5px solid #4A4380; background: rgba(124,108,242,.10); color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: background .15s, border-color .15s, transform .15s; animation: qbcEntra .35s both; }
        .qb-conv .qbc-opcion:hover, .qb-conv .qbc-opcion:focus-visible { background: rgba(124,108,242,.28); border-color: #8C7EF7; transform: translateY(-1px); }
        .qb-conv .qbc-opcion:focus-visible, .qb-conv .qbc-cta:focus-visible { outline: 3px solid #C9C2FF; outline-offset: 2px; }
        .qb-conv .qbc-fuerte { background: var(--brand); border-color: var(--brand); }
        .qb-conv .qbc-garantias { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 18px; color: var(--muted); font-size: 14px; padding: 6px 20px 48px; }
        .qb-conv .qbc-garantias span::before { content: "✓ "; color: var(--ok); font-weight: 800; }

        .qb-conv .qbc-franja { background: var(--bg2); border-top: 1px solid var(--line); padding: 72px 20px; }
        .qb-conv .qbc-franja h2 { font-size: clamp(26px, 3.6vw, 40px); font-weight: 800; text-align: center; max-width: 760px; margin: 0 auto; }
        .qb-conv .qbc-pasos { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin: 36px auto 0; max-width: 1080px; }
        .qb-conv .qbc-paso { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 24px; }
        .qb-conv .qbc-paso-n { font-size: 13px; font-weight: 800; color: var(--ok); letter-spacing: .08em; }
        .qb-conv .qbc-paso h3 { font-size: 20px; margin: 8px 0; }
        .qb-conv .qbc-paso p { margin: 0; color: var(--muted); font-size: 15.5px; }

        .qb-conv .qbc-precios-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
        .qb-conv .qbc-nota { text-align: center; color: var(--soft); font-size: 13.5px; margin: 18px auto 0; max-width: 680px; }
        .qb-conv .qbc-planes-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; margin-top: 36px; align-items: stretch; }
        .qb-conv .qbc-plan { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 26px; display: flex; flex-direction: column; gap: 10px; }
        .qb-conv .qbc-plan-top { border: 1.5px solid #8C7EF7; background: linear-gradient(180deg, #2A2253, #1B1733); box-shadow: 0 30px 60px -30px rgba(124,108,242,.6); }
        .qb-conv .qbc-plan h3 { font-size: 20px; }
        .qb-conv .qbc-plan .qbc-pr { font-size: 30px; font-weight: 850; letter-spacing: -.02em; }
        .qb-conv .qbc-plan .qbc-pr small { font-size: 14px; color: var(--muted); font-weight: 600; }
        .qb-conv .qbc-plan p { margin: 0; color: var(--muted); font-size: 15px; flex: 1; }
        .qb-conv .qbc-plan .qbc-tag { align-self: flex-start; font-size: 12px; font-weight: 800; color: #0C0A17; background: var(--ok); border-radius: 999px; padding: 3px 10px; }
        .qb-conv .qbc-plan a { min-height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 800; text-decoration: none; border: 1px solid #4A4380; color: #fff; }
        .qb-conv .qbc-plan-top a { background: var(--brand); border-color: var(--brand); }
        .qb-conv .qbc-plan s { color: var(--soft); font-size: 18px; font-weight: 600; margin-right: 4px; }
        .qb-conv .qbc-plan .qbc-fund { color: #7FE7B8; font-size: 13.5px; font-weight: 600; }

        .qb-conv .qbc-cierre { text-align: center; padding: 80px 20px 120px; }
        .qb-conv .qbc-cierre h2 { font-size: clamp(28px, 4vw, 46px); font-weight: 850; max-width: 760px; margin: 0 auto 22px; }
        .qb-conv .qbc-cierre p { color: var(--muted); margin: 16px 0 0; font-size: 14px; }

        .qb-conv .qbc-footer { border-top: 1px solid var(--line); color: var(--soft); font-size: 14px; padding: 22px 20px 100px; }
        .qb-conv .qbc-footer-inner { max-width: 1080px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }

        .qb-conv .qbc-fija { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); background: rgba(12,10,23,.92); backdrop-filter: blur(10px); border-top: 1px solid var(--line); display: none; }
        .qb-conv .qbc-fija .qbc-cta { width: 100%; }

        @media (max-width: 760px) {
          .qb-conv .qbc-nav-mini { display: none; }
          .qb-conv .qbc-equipo .qbc-miembro:not(.qbc-director) small { display: none; }
          .qb-conv .qbc-pasos { grid-template-columns: 1fr; }
          .qb-conv .qbc-planes-grid { grid-template-columns: 1fr; }
          .qb-conv .qbc-fija { display: block; }
          .qb-conv .qbc-msg { max-width: 100%; }
          .qb-conv .qbc-cierre { padding-bottom: 160px; }
        }
        @media (prefers-reduced-motion: reduce) { .qb-conv * { animation: none !important; transition: none !important; } }
      `}</style>

      <main className="qbc-escena">
        <nav className="qbc-nav" aria-label="Principal">
          <div className="qbc-logo">
            <img src="/marca/icono-quiubot.svg" alt="" />
            <span>quiu<b>bot</b></span>
          </div>
          <CtaLink href="/login" ubicacion="nav" className="qbc-nav-mini">
            Probar {DIAS_PRUEBA} días gratis
          </CtaLink>
        </nav>

        <ConversacionDirector hayFundador={hayFundador} />
      </main>

      <section className="qbc-franja">
        <h2>Así de fácil funciona</h2>
        <div className="qbc-pasos">
          {PASOS_FACIL.map((p) => (
            <div className="qbc-paso" key={p.titulo}>
              <span className="qbc-paso-n">{p.numero}</span>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="qbc-franja" style={{ borderTop: 0, paddingTop: 0 }}>
        <div className="qbc-precios-wrap">
          <h2>{PRECIOS_SECCION.titulo}</h2>
          <p className="qbc-nota" style={{ fontSize: 15.5, marginTop: 14 }}>{PRECIOS_SECCION.notaFreelancer}</p>
          <div className="qbc-planes-grid">
            <div className="qbc-plan">
              <h3>Arranque</h3>
              <div className="qbc-pr">Gratis</div>
              <p>{PRECIOS_SECCION.taglineArranque}</p>
              <CtaLink href="/login" ubicacion="plan_arranque">Empezar gratis</CtaLink>
            </div>
            <div className="qbc-plan qbc-plan-top">
              <span className="qbc-tag">Recomendado</span>
              <h3>{nombreVisiblePlan("escala")}</h3>
              <div className="qbc-pr">
                {hayFundador && <s>${precioEscala.toLocaleString("es-CO")}</s>} ${precioAutopilotoMostrado.toLocaleString("es-CO")} <small>/mes</small>
              </div>
              {hayFundador && <p className="qbc-fund">Precio de fundador para los primeros negocios, durante su primer año.</p>}
              <p>{PRECIOS_SECCION.taglineAutopiloto}</p>
              <CtaLink href="/login" ubicacion="plan_autopiloto">Probar {DIAS_PRUEBA} días gratis</CtaLink>
            </div>
            <div className="qbc-plan">
              <h3>Crecimiento</h3>
              <div className="qbc-pr">${precioCrecimiento.toLocaleString("es-CO")} <small>/mes</small></div>
              <p>{PRECIOS_SECCION.taglineCrecimiento}</p>
              <CtaLink href="/login" ubicacion="plan_crecimiento">Elegir Crecimiento</CtaLink>
            </div>
          </div>
          <p className="qbc-nota">{PRECIOS_SECCION.notaCostos}</p>
        </div>
      </section>

      <SeccionTestimonios claseSeccion="qbc-franja" ocultarSiVacio />

      <section className="qbc-cierre">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }} aria-hidden="true">
          <EsferaAsistente asistente="director" estado="normal" tamano={84} />
        </div>
        <h2>{CIERRE.h2}</h2>
        <CtaLink href="/login" ubicacion="cierre" className="qbc-cta">
          Empezar mis {DIAS_PRUEBA} días gratis →
        </CtaLink>
        <p>{CIERRE.micro}</p>
      </section>

      <footer className="qbc-footer">
        <div className="qbc-footer-inner">
          <span>© {new Date().getFullYear()} Quiubot · Hecho en Cali, para negocios colombianos.</span>
          <a href="/terminos">Términos y condiciones</a>
        </div>
      </footer>

      <div className="qbc-fija">
        <CtaLink href="/login" ubicacion="fija_celular" className="qbc-cta">
          Probar {DIAS_PRUEBA} días gratis →
        </CtaLink>
      </div>
    </div>
  );
}

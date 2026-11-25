"use client";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  ENLACE_COMUNIDAD,
  SUBTITULO_CLASE,
  TITULO_CLASE,
  enlaceGoogleCalendar,
  estadoClase,
  horaLocalSiDistinta,
  tiempoRestante,
} from "./evento";

const dos = (n: number) => String(n).padStart(2, "0");

// Íconos dibujados (nunca emoji ni glifos de fuente: no todas las fuentes
// los traen y en algunos celulares salen como cuadritos).
function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.05c0 2 .52 3.95 1.52 5.67L.58 23.3l5.72-1.5a11.33 11.33 0 0 0 5.43 1.38h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  );
}

function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function IconoFlecha({ abierto }: { abierto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function BotonComunidad() {
  return (
    <a className="btn-principal" href={ENLACE_COMUNIDAD} target="_blank" rel="noopener noreferrer" data-testid="boton-comunidad">
      <IconoWhatsApp />
      <span>Unirme a la comunidad</span>
    </a>
  );
}

function AgregarCalendario() {
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();
  return (
    <div className="calendario">
      <button type="button" className="btn-secundario" aria-expanded={abierto} aria-controls={idMenu} onClick={() => setAbierto((a) => !a)}>
        <IconoCalendario />
        <span>Agregar a mi calendario</span>
        <IconoFlecha abierto={abierto} />
      </button>
      <div id={idMenu} className="calendario-opciones" hidden={!abierto}>
        <a href={enlaceGoogleCalendar()} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        <a href="/clase/calendario.ics" download="clase-quiubot.ics">Apple, Outlook u otro (.ics)</a>
      </div>
    </div>
  );
}

function CuentaRegresiva({ ahora }: { ahora: number }) {
  const r = tiempoRestante(ahora);
  const unidades: [string, number][] = [
    ["días", r.dias],
    ["horas", r.horas],
    ["min", r.minutos],
    ["seg", r.segundos],
  ];
  return (
    <div className="panel" data-estado="antes">
      <p className="panel-etiqueta">La clase empieza en</p>
      {/* role="timer" sin aria-live: un lector de pantalla no anuncia cada segundo. */}
      <div className="reloj" role="timer" aria-label={`Faltan ${r.dias} días, ${r.horas} horas, ${r.minutos} minutos`}>
        {unidades.map(([nombre, valor]) => (
          <div className="unidad" key={nombre} aria-hidden="true">
            <span className="numero">{dos(valor)}</span>
            <span className="unidad-nombre">{nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const sinSuscripcion = () => () => {};
const horaLocalDelVisitante = () => horaLocalSiDistinta(Intl.DateTimeFormat().resolvedOptions().timeZone);

export default function ClaseEnVivo({ ahoraServidor }: { ahoraServidor: number }) {
  // Primer render con la hora del servidor (igual en servidor y cliente, sin
  // error de hidratación); apenas monta, pasa al reloj del visitante.
  const [ahora, setAhora] = useState(ahoraServidor);
  // La zona del visitante solo existe en el navegador: en el servidor es
  // null y no se muestra "En tu hora".
  const horaLocal = useSyncExternalStore(sinSuscripcion, horaLocalDelVisitante, () => null);

  useEffect(() => {
    const tic = () => {
      const n = Date.now();
      setAhora(n);
      // Se alinea al cambio de segundo exacto: sin saltos de 2 en 2.
      t = setTimeout(tic, 1000 - (n % 1000) + 15);
    };
    let t = setTimeout(tic, 0);
    return () => clearTimeout(t);
  }, []);

  const estado = estadoClase(ahora);

  return (
    <main className="qb-clase">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap"
        precedence="default"
      />
      <style>{ESTILOS}</style>

      <header className="barra">
        <a className="marca" href="https://quiubot.site" aria-label="Quiubot, ir al inicio">
          <img src="/marca/icono-quiubot.svg" alt="" width={32} height={32} />
          <span>quiu<span className="acento">bot</span></span>
        </a>
      </header>

      <div className="contenido">
        <section className="hero">
          <p className="eyebrow">
            <span className="punto" aria-hidden="true" />
            Clase gratuita · en vivo
          </p>
          <h1>{TITULO_CLASE}</h1>
          <p className="sub">{SUBTITULO_CLASE}</p>
          <p className="fecha-corta">
            <IconoCalendario />
            <span>Jueves 26 de noviembre · 8:00 p. m. <span className="suave">hora de Colombia</span></span>
          </p>
        </section>

        <section className="accion">
          {estado === "antes" && <CuentaRegresiva ahora={ahora} />}
          {estado === "en_vivo" && (
            <div className="panel" data-estado="en_vivo">
              <p className="en-vivo-chip"><span className="punto-vivo" aria-hidden="true" />En vivo</p>
              <h2 className="panel-titulo">¡La clase está en vivo!</h2>
            </div>
          )}
          {estado === "terminada" && (
            <div className="panel" data-estado="terminada">
              <h2 className="panel-titulo">La clase terminó. Únete a la comunidad para la próxima</h2>
            </div>
          )}

          <div className="botones">
            <BotonComunidad />
            <p className="nota">Se abre el grupo en WhatsApp, en una pestaña nueva.</p>
            {estado === "antes" && <AgregarCalendario />}
          </div>
        </section>

        <section className="cuando" aria-labelledby="titulo-cuando">
          <h2 id="titulo-cuando">Cuándo</h2>
          <dl>
            <div>
              <dt>Fecha</dt>
              <dd>Jueves 26 de noviembre de 2026</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>8:00 a 10:00 p. m., hora de Colombia</dd>
            </div>
            {horaLocal && (
              <div className="tu-hora">
                <dt>En tu hora</dt>
                <dd>{horaLocal}</dd>
              </div>
            )}
            <div>
              <dt>Precio</dt>
              <dd>Gratis</dd>
            </div>
          </dl>
        </section>

        <section className="pasos" aria-labelledby="titulo-pasos">
          <h2 id="titulo-pasos">Cómo participar</h2>
          <ol>
            <li><span className="paso-num" aria-hidden="true">1</span><span>Únete al grupo de WhatsApp de la comunidad.</span></li>
            <li><span className="paso-num" aria-hidden="true">2</span><span>Guarda la fecha en tu calendario.</span></li>
            <li><span className="paso-num" aria-hidden="true">3</span><span>Nos vemos el jueves 26 a las 8:00 p. m.</span></li>
          </ol>
        </section>
      </div>

      <footer className="pie">
        <span>quiu<span className="acento-pie">bot</span></span>
        <span aria-hidden="true">·</span>
        <a href="https://quiubot.site">quiubot.site</a>
      </footer>
    </main>
  );
}

// Colores de /bienvenida. Contrastes (WCAG): texto blanco sobre el verde del
// botón #11734F = 5.85:1 (el verde de marca #1FA97C solo da 2.99:1, por eso
// se oscureció); #6B6478 sobre #FAFAF8 = 5.40:1; #4A3FAE sobre #FAFAF8 =
// 7.69:1; #C4BFF0 sobre #17152B = 10.23:1.
const ESTILOS = `
.qb-clase {
  --bg: #FAFAF8; --bg-alt: #F1EFFB; --ink: #17152B; --muted: #6B6478;
  --purple-deep: #4A3FAE; --purple: #7F77DD; --purple-light: #C4BFF0;
  --verde: #11734F; --verde-hover: #0D5E40;
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  min-height: 100vh; min-height: 100dvh;
  background: var(--bg);
  background-image: radial-gradient(rgba(74,63,174,0.08) 1px, transparent 1px);
  background-size: 22px 22px;
  color: var(--ink);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  display: flex; flex-direction: column;
  overflow-x: hidden;
}
.qb-clase *, .qb-clase *::before, .qb-clase *::after { box-sizing: border-box; }
.qb-clase h1, .qb-clase h2 { font-family: var(--font-display); letter-spacing: -0.02em; margin: 0; }
.qb-clase a { color: inherit; }
.qb-clase :focus-visible { outline: 3px solid var(--purple-deep); outline-offset: 3px; border-radius: 10px; }

.qb-clase .barra { padding: 16px 20px; max-width: 1080px; width: 100%; margin: 0 auto; }
.qb-clase .marca { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; text-decoration: none; }
.qb-clase .marca img { width: 32px; height: 32px; border-radius: 9px; }
.qb-clase .acento { color: var(--purple); }

.qb-clase .contenido { width: 100%; max-width: 560px; margin: 0 auto; padding: 8px 20px 32px; display: grid; gap: 28px; flex: 1; }

.qb-clase .eyebrow { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 6px 12px; border-radius: 999px; background: var(--bg-alt); color: var(--purple-deep); font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.qb-clase .eyebrow .punto { width: 7px; height: 7px; border-radius: 50%; background: var(--purple-deep); }
.qb-clase h1 { font-size: clamp(30px, 8.4vw, 50px); line-height: 1.06; font-weight: 700; text-wrap: balance; }
.qb-clase .sub { font-size: 17px; line-height: 1.5; color: var(--muted); margin: 14px 0 0; text-wrap: pretty; }
.qb-clase .fecha-corta { display: flex; align-items: flex-start; gap: 8px; margin: 18px 0 0; font-weight: 600; font-size: 15.5px; line-height: 1.4; color: var(--purple-deep); }
.qb-clase .fecha-corta svg { flex-shrink: 0; margin-top: 1px; }
.qb-clase .fecha-corta .suave { font-weight: 500; color: var(--muted); }

.qb-clase .accion { display: grid; gap: 16px; }
.qb-clase .panel { background: var(--ink); color: #fff; border-radius: 20px; padding: 20px 16px 18px; box-shadow: 0 18px 40px rgba(23,21,43,0.18); position: relative; overflow: hidden; }
.qb-clase .panel::before { content: ""; position: absolute; inset: -40% -20% auto auto; width: 70%; height: 140%; background: radial-gradient(circle, rgba(127,119,221,0.35), transparent 65%); pointer-events: none; }
.qb-clase .panel > * { position: relative; }
.qb-clase .panel-etiqueta { margin: 0 0 12px; text-align: center; font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--purple-light); }
.qb-clase .reloj { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.qb-clase .unidad { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 12px 0 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
/* Ancho fijo por dígito (tabular + monoespaciada): el número no "baila"
   de un segundo a otro ni cuando termina de cargar la fuente. */
.qb-clase .numero { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; font-size: clamp(30px, 9.5vw, 46px); font-weight: 600; line-height: 1; min-width: 2.1ch; text-align: center; }
.qb-clase .unidad-nombre { font-size: 12.5px; font-weight: 600; color: var(--purple-light); }

.qb-clase .panel-titulo { font-size: clamp(22px, 6vw, 28px); line-height: 1.2; text-align: center; text-wrap: balance; padding: 6px 4px; }
.qb-clase .en-vivo-chip { display: flex; width: max-content; margin: 0 auto 10px; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; background: #B42318; color: #fff; font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
.qb-clase .punto-vivo { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: qbVivo 1.4s ease-in-out infinite; }
@keyframes qbVivo { 50% { opacity: 0.35; } }

.qb-clase .botones { display: grid; gap: 10px; }
.qb-clase .btn-principal { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 60px; padding: 16px 20px; border-radius: 14px; background: var(--verde); color: #fff; font-size: 18px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 0 rgba(23,21,43,0.22); transition: background .15s ease, transform .15s ease; -webkit-tap-highlight-color: transparent; }
.qb-clase .btn-principal:hover { background: var(--verde-hover); }
.qb-clase .btn-principal:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(23,21,43,0.22); }
.qb-clase .nota { margin: 0; text-align: center; font-size: 13.5px; color: var(--muted); }
.qb-clase .calendario { display: grid; gap: 8px; margin-top: 4px; }
.qb-clase .btn-secundario { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 52px; padding: 12px 18px; border-radius: 14px; background: #fff; border: 1.5px solid #D9D5EE; color: var(--purple-deep); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.qb-clase .btn-secundario:hover { background: var(--bg-alt); }
.qb-clase .calendario-opciones:not([hidden]) { display: grid; gap: 8px; }
.qb-clase .calendario-opciones a { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 10px 16px; border-radius: 12px; background: var(--bg-alt); color: var(--purple-deep); font-weight: 600; text-decoration: none; }
.qb-clase .calendario-opciones a:hover { text-decoration: underline; }

.qb-clase .cuando, .qb-clase .pasos { background: #fff; border: 1px solid #ECE9F7; border-radius: 18px; padding: 20px; }
.qb-clase .cuando h2, .qb-clase .pasos h2 { font-size: 18px; margin-bottom: 12px; }
.qb-clase dl { margin: 0; display: grid; gap: 10px; }
.qb-clase dl > div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: baseline; }
.qb-clase dt { font-size: 13.5px; color: var(--muted); font-weight: 600; }
.qb-clase dd { margin: 0; font-size: 15.5px; font-weight: 600; line-height: 1.4; }
.qb-clase dd::first-letter { text-transform: uppercase; }
.qb-clase .tu-hora dd { color: var(--purple-deep); }
.qb-clase ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.qb-clase li { display: flex; align-items: center; gap: 12px; font-size: 15.5px; line-height: 1.4; }
.qb-clase .paso-num { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; background: var(--bg-alt); color: var(--purple-deep); font-family: var(--font-mono); font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; }

.qb-clase .pie { display: flex; justify-content: center; gap: 8px; padding: 20px; font-size: 13.5px; color: var(--muted); }
.qb-clase .acento-pie { color: var(--purple-deep); }

@media (min-width: 920px) {
  .qb-clase .barra { padding: 24px 32px; }
  .qb-clase .contenido { max-width: 1080px; padding: 32px 32px 48px; grid-template-columns: 1.1fr 0.9fr; column-gap: 56px; row-gap: 24px; align-items: start; }
  .qb-clase .hero { grid-column: 1; grid-row: 1; padding-top: 12px; }
  .qb-clase .accion { grid-column: 2; grid-row: 1 / span 2; }
  .qb-clase .cuando { grid-column: 1; grid-row: 2; }
  .qb-clase .pasos { grid-column: 1; grid-row: 3; }
  .qb-clase .sub { font-size: 19px; max-width: 34ch; }
  .qb-clase .panel { padding: 28px 22px 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .qb-clase .punto-vivo { animation: none; }
  .qb-clase .btn-principal, .qb-clase .btn-secundario svg { transition: none; }
}
`;

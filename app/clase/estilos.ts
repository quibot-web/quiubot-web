// Estilos de /clase, con la paleta de la experiencia "autopilot" de
// /bienvenida (fondo #0C0A17, morado #7C6CF2, menta #5EE0A8).
//
// Contrastes (WCAG, calculados contra el punto MÁS CLARO del fondo donde cae
// cada texto, ~#33306A dentro de las tarjetas):
//   #F4F2FF texto principal ............ 10.7:1
//   #B4AED3 texto secundario ........... 5.6:1 (#8E88B0 de autopilot no
//                                        llega a 4.5 acá, no se usa)
//   #C9C2FF / #5EE0A8 / #7FD8F0 ........ ≥7.1:1
//   botón: #0C0A17 sobre el degradado #5EE0A8 → #7FD8F0 → #B9AEFF ≥ 9.8:1
//   chip en vivo: blanco sobre #B42318 . 6.6:1
//
// Rendimiento: solo se animan transform y opacity (las hace la tarjeta
// gráfica, sin repintar), cero imágenes de fondo (estrellas y planetas son
// degradados CSS) y los personajes son CSS puro. Con
// prefers-reduced-motion: reduce no se anima nada.
export const ESTILOS = `
:root:has(.qb-clase) { background: #0C0A17; }
.qb-clase {
  --bg: #0C0A17; --card: rgba(27,23,51,.78); --line: rgba(201,194,255,.18);
  --ink: #F4F2FF; --muted: #B4AED3; --lila: #C9C2FF; --brand: #7C6CF2; --menta: #5EE0A8; --cian: #7FD8F0;
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  position: relative; isolation: isolate;
  min-height: 100vh; min-height: 100dvh;
  background: linear-gradient(165deg, #0C0A17 0%, #1A1446 42%, #121A47 72%, #0C0A17 100%);
  color: var(--ink);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex; flex-direction: column;
  overflow-x: clip;
}
.qb-clase *, .qb-clase *::before, .qb-clase *::after { box-sizing: border-box; }
.qb-clase h1, .qb-clase h2 { font-family: var(--font-display); letter-spacing: -0.02em; margin: 0; }
.qb-clase a { color: inherit; }
.qb-clase :focus-visible { outline: 3px solid var(--lila); outline-offset: 3px; border-radius: 12px; }

/* ---------- Cielo ---------- */
.qb-clase .cielo { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.qb-clase .estrellas { position: absolute; inset: 0; }
.qb-clase .estrellas-1 {
  background-image:
    radial-gradient(1.4px 1.4px at 12% 18%, #fff, transparent),
    radial-gradient(1px 1px at 32% 72%, rgba(255,255,255,.8), transparent),
    radial-gradient(1.6px 1.6px at 58% 34%, #fff, transparent),
    radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,.7), transparent),
    radial-gradient(1.2px 1.2px at 88% 64%, #fff, transparent),
    radial-gradient(1px 1px at 46% 90%, rgba(255,255,255,.7), transparent);
  background-size: 260px 260px; opacity: .7;
}
.qb-clase .estrellas-2 {
  background-image:
    radial-gradient(1.8px 1.8px at 22% 42%, #E6E1FF, transparent),
    radial-gradient(1.2px 1.2px at 66% 82%, #CFF6FF, transparent),
    radial-gradient(1.5px 1.5px at 84% 28%, #fff, transparent),
    radial-gradient(1px 1px at 6% 86%, #fff, transparent);
  background-size: 380px 380px;
  animation: qbTitila 4.5s ease-in-out infinite alternate;
}
@keyframes qbTitila { from { opacity: .25; } to { opacity: .95; } }
.qb-clase .planeta { position: absolute; border-radius: 50%; }
.qb-clase .planeta-grande { width: 360px; height: 360px; left: -170px; bottom: -150px; opacity: .55;
  background: radial-gradient(circle at 62% 30%, #8C82F2 0%, #4A3FAE 38%, #221A63 66%, transparent 71%);
  animation: qbDeriva 26s ease-in-out infinite; }
.qb-clase .planeta-chico { width: 64px; height: 64px; right: 7%; top: 110px; opacity: .55;
  background: radial-gradient(circle at 35% 30%, #CFF6FF 0%, #2DB2C2 45%, #0D5E69 75%, transparent 77%);
  box-shadow: 0 0 40px rgba(127,216,240,.25);
  animation: qbDeriva 18s ease-in-out infinite reverse; }
.qb-clase .planeta-anillo { width: 96px; height: 96px; right: -26px; top: 58%; opacity: .5;
  background: radial-gradient(circle at 35% 30%, #FFD9E7 0%, #E06C9F 45%, #8C2E5C 75%, transparent 77%);
  animation: qbDeriva 22s ease-in-out infinite; }
.qb-clase .planeta-anillo i { position: absolute; left: -30%; top: 38%; width: 160%; height: 26%; border-radius: 50%;
  border: 2px solid rgba(255,184,210,.55); transform: rotate(-16deg); }
@keyframes qbDeriva { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(10px,-16px,0); } }

/* ---------- Barra ---------- */
.qb-clase .barra { padding: 16px 20px; max-width: 1120px; width: 100%; margin: 0 auto; }
.qb-clase .marca { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 19px; text-decoration: none; color: #fff; }
.qb-clase .marca img { width: 32px; height: 32px; border-radius: 9px; }
.qb-clase .acento { color: var(--lila); }

.qb-clase .contenido { width: 100%; max-width: 560px; margin: 0 auto; padding: 8px 20px 36px; display: grid; gap: 30px; flex: 1; align-content: start; }

/* ---------- Personajes ---------- */
.qb-clase .personaje { position: absolute; z-index: 3; animation: qbFlota 6s ease-in-out infinite; }
@keyframes qbFlota { 0%, 100% { transform: translate3d(0,0,0) rotate(0deg); } 50% { transform: translate3d(0,-9px,0) rotate(3deg); } }
.qb-clase .p-director { top: -18px; right: -18px; }
.qb-clase .p-marca { display: none; }
.qb-clase .p-creativo { top: -40px; left: -22px; animation-duration: 5.2s; animation-delay: -1.5s; }
.qb-clase .p-publicador { top: -40px; right: -22px; animation-duration: 6.6s; animation-delay: -3s; }
.qb-clase .p-estratega { top: -30px; right: -12px; animation-duration: 7s; animation-delay: -2s; }
@media (max-width: 359px) { .qb-clase .p-director { display: none; } }

/* ---------- Hero ---------- */
.qb-clase .hero { position: relative; padding-top: 8px; }
.qb-clase .chip { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 7px 13px; border-radius: 999px;
  font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  background: rgba(94,224,168,.12); border: 1px solid rgba(94,224,168,.42); color: var(--menta); }
.qb-clase .chip .punto { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor; }
.qb-clase .chip[data-estado="en_vivo"] { background: #B42318; border-color: #E5484D; color: #fff; }
.qb-clase .chip[data-estado="en_vivo"] .punto { animation: qbLate 1.3s ease-in-out infinite; }
.qb-clase .chip[data-estado="terminada"] { background: rgba(201,194,255,.12); border-color: rgba(201,194,255,.4); color: var(--lila); }
@keyframes qbLate { 50% { opacity: .3; } }
.qb-clase h1 { font-size: clamp(32px, 9vw, 58px); line-height: 1.04; font-weight: 700; text-wrap: balance; color: #fff; }
.qb-clase .resaltado { background: linear-gradient(95deg, #C9C2FF 0%, #7FD8F0 55%, #5EE0A8 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.qb-clase .sub { font-size: 17px; line-height: 1.5; color: var(--muted); margin: 16px 0 0; text-wrap: pretty; }
.qb-clase .fecha-corta { display: flex; align-items: flex-start; gap: 8px; margin: 18px 0 0; font-weight: 700; font-size: 15.5px; line-height: 1.4; color: #fff; }
.qb-clase .fecha-corta svg { flex-shrink: 0; margin-top: 1px; color: var(--cian); }
.qb-clase .fecha-corta .suave { font-weight: 500; color: var(--muted); }

/* ---------- Panel: cuenta regresiva / en vivo / terminó ---------- */
.qb-clase .accion { display: grid; gap: 16px; }
.qb-clase .panel { position: relative; border-radius: 24px; padding: 26px 14px 20px; margin-top: 12px;
  background: linear-gradient(160deg, rgba(124,108,242,.30), rgba(18,15,46,.92) 60%);
  border: 1px solid rgba(201,194,255,.28);
  box-shadow: 0 0 0 1px rgba(124,108,242,.12), 0 24px 60px -20px rgba(124,108,242,.55); }
.qb-clase .panel > :not(.panel-fondo):not(.personaje) { position: relative; z-index: 1; }
.qb-clase .panel-fondo { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
.qb-clase .panel-fondo::before { content: ""; position: absolute; width: 70%; height: 140%; right: -20%; top: -60%;
  background: radial-gradient(circle, rgba(127,216,240,.28), transparent 65%); }
.qb-clase .panel-etiqueta { margin: 0 0 14px; text-align: center; font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--lila); }
.qb-clase .reloj { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.qb-clase .unidad { background: rgba(12,10,23,.6); border: 1px solid rgba(185,174,255,.3); border-radius: 16px; padding: 14px 0 11px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* Ancho fijo por dígito (monoespaciada + tabular): el número no "baila" de
   un segundo a otro ni cuando termina de cargar la fuente. El brillo neón es
   text-shadow, que no mueve nada de lugar. */
.qb-clase .numero { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
  font-size: clamp(34px, 10.5vw, 56px); font-weight: 700; line-height: 1; min-width: 2.1ch; text-align: center; color: #fff;
  text-shadow: 0 0 6px rgba(201,194,255,.9), 0 0 18px rgba(124,108,242,.85), 0 0 38px rgba(127,216,240,.45); }
.qb-clase .unidad-nombre { font-size: 12.5px; font-weight: 700; color: var(--lila); }
.qb-clase .panel-titulo { font-size: clamp(24px, 6.6vw, 32px); line-height: 1.18; text-align: center; text-wrap: balance; padding: 8px 10px; color: #fff;
  text-shadow: 0 0 18px rgba(124,108,242,.7); }
.qb-clase .punto-vivo { display: inline-block; width: 14px; height: 14px; margin-right: 10px; vertical-align: .1em; border-radius: 50%; background: #FF5A5F; box-shadow: 0 0 14px #FF5A5F; animation: qbLate 1.3s ease-in-out infinite; }

/* ---------- Botón principal: lo que más se ve ---------- */
.qb-clase .botones { display: grid; gap: 10px; }
.qb-clase .btn-principal { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: center; justify-content: center;
  min-height: 66px; padding: 16px 20px; border-radius: 18px; text-decoration: none;
  background: linear-gradient(100deg, #5EE0A8 0%, #7FD8F0 52%, #B9AEFF 100%);
  color: #0C0A17; font-size: 19px; font-weight: 800; letter-spacing: -.01em;
  box-shadow: 0 0 0 1px rgba(255,255,255,.5) inset, 0 14px 36px -10px rgba(94,224,168,.75), 0 0 46px -6px rgba(127,216,240,.55);
  animation: qbPulso 2.6s ease-in-out infinite; -webkit-tap-highlight-color: transparent; }
.qb-clase .btn-principal::after { content: ""; position: absolute; z-index: 0; top: -10%; bottom: -10%; left: 0; width: 38%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.85), transparent);
  transform: translateX(-160%) skewX(-20deg); animation: qbBrillo 3.8s ease-in-out infinite; }
.qb-clase .btn-contenido { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 10px; }
.qb-clase .btn-principal:hover { filter: saturate(1.15) brightness(1.04); }
.qb-clase .btn-principal:active { transform: scale(.98); }
@keyframes qbPulso { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
@keyframes qbBrillo { 0%, 55% { transform: translateX(-160%) skewX(-20deg); } 85%, 100% { transform: translateX(330%) skewX(-20deg); } }
.qb-clase .nota { margin: 0; text-align: center; font-size: 13.5px; color: var(--muted); }

.qb-clase .calendario { display: grid; gap: 8px; margin-top: 4px; }
.qb-clase .btn-secundario { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 54px; padding: 12px 18px; border-radius: 16px;
  background: rgba(255,255,255,.06); border: 1.5px solid rgba(201,194,255,.45); color: var(--ink); font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
.qb-clase .btn-secundario:hover { background: rgba(255,255,255,.1); }
.qb-clase .btn-secundario svg { color: var(--lila); }
.qb-clase .flecha { display: inline-flex; transition: transform .2s ease; }
.qb-clase .flecha[data-abierto="true"] { transform: rotate(180deg); }
.qb-clase .calendario-opciones:not([hidden]) { display: grid; gap: 8px; }
.qb-clase .calendario-opciones a { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 10px 16px; border-radius: 14px;
  background: rgba(124,108,242,.22); border: 1px solid rgba(201,194,255,.25); color: #fff; font-weight: 700; text-decoration: none; }
.qb-clase .calendario-opciones a:hover { background: rgba(124,108,242,.36); }

/* ---------- Tarjetas ---------- */
.qb-clase .tarjeta { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 22px 20px; }
.qb-clase .tarjeta h2 { font-size: 20px; margin-bottom: 16px; color: #fff; }
.qb-clase .aprender ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
.qb-clase .aprender li { display: flex; align-items: center; gap: 14px; font-size: 16px; line-height: 1.4; font-weight: 600; color: var(--ink); }
.qb-clase .icono-aprender { flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #0C0A17; }
.qb-clase .icono-1 { background: linear-gradient(140deg, #AECBFF, #4F86F0); }
.qb-clase .icono-2 { background: linear-gradient(140deg, #FFB8D2, #E06C9F); }
.qb-clase .icono-3 { background: linear-gradient(140deg, #FFCBA8, #F08A55); }
.qb-clase .icono-4 { background: linear-gradient(140deg, #FFE3A6, #E5AE3A); }
.qb-clase dl { margin: 0; display: grid; gap: 12px; }
.qb-clase dl > div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: baseline; }
.qb-clase dt { font-size: 13.5px; color: var(--muted); font-weight: 600; }
.qb-clase dd { margin: 0; font-size: 15.5px; font-weight: 700; line-height: 1.4; color: var(--ink); }
.qb-clase dd::first-letter { text-transform: uppercase; }
.qb-clase .tu-hora dd { color: var(--cian); }
.qb-clase ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.qb-clase .pasos li { display: flex; align-items: center; gap: 12px; font-size: 15.5px; line-height: 1.4; color: var(--ink); }
.qb-clase .paso-num { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: rgba(124,108,242,.3); border: 1px solid rgba(201,194,255,.4); color: #fff; font-family: var(--font-mono); font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; }

.qb-clase .pie { display: flex; justify-content: center; gap: 8px; padding: 22px; font-size: 13.5px; color: var(--muted); }

/* ---------- Escritorio ---------- */
@media (min-width: 920px) {
  .qb-clase .barra { padding: 24px 32px; }
  .qb-clase .contenido { max-width: 1120px; padding: 36px 32px 56px; grid-template-columns: 1.08fr 0.92fr; column-gap: 64px; row-gap: 26px; }
  .qb-clase .hero { grid-column: 1; grid-row: 1; padding-top: 18px; }
  .qb-clase .accion { grid-column: 2; grid-row: 1 / span 3; position: sticky; top: 28px; align-self: start; }
  .qb-clase .aprender { grid-column: 1; grid-row: 2; }
  .qb-clase .cuando { grid-column: 1; grid-row: 3; }
  .qb-clase .pasos { grid-column: 1; grid-row: 4; }
  .qb-clase .sub { font-size: 19px; max-width: 36ch; }
  .qb-clase .p-director { top: -34px; right: 0; }
  .qb-clase .panel { padding: 34px 22px 26px; }
  .qb-clase .planeta-grande { width: 520px; height: 520px; left: -220px; bottom: -220px; }
  .qb-clase .planeta-chico { right: 14%; top: 70px; }
  .qb-clase .planeta-anillo { right: 3%; top: 64%; }
}

@media (min-width: 1240px) {
  .qb-clase .p-marca { display: block; left: -84px; top: 46%; animation-duration: 7.4s; animation-delay: -2.5s; }
}

@media (prefers-reduced-motion: reduce) {
  .qb-clase *, .qb-clase *::before, .qb-clase *::after { animation: none !important; transition: none !important; }
  .qb-clase .btn-principal::after { display: none; }
}
`;

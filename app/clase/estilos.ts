// Estilos de /clase (paleta de "autopilot" de /bienvenida). Una sola columna
// en todos los anchos: el botón es lo primero que ve el ojo.
//
// Contrastes (WCAG):
//   botón: #06170D sobre el degradado #3BEA84 → #25D366 ≥ 9.3:1, y el botón
//          contra el fondo #1A1446 ≥ 8.6:1
//   #F4F2FF texto ≥ 10.7:1 · #B4AED3 secundario ≥ 5.6:1 · #C9C2FF ≥ 7.1:1
//   estado en vivo: blanco sobre #B42318 = 6.6:1
// Rendimiento: solo se animan transform y opacity; cielo y personajes son
// CSS. prefers-reduced-motion: reduce apaga toda animación.
export const ESTILOS = `
:root:has(.qb-clase) { background: #0C0A17; }
.qb-clase {
  --ink: #F4F2FF; --muted: #B4AED3; --lila: #C9C2FF; --cian: #7FD8F0;
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
  background-size: 260px 260px; opacity: .6;
}
.qb-clase .estrellas-2 {
  background-image:
    radial-gradient(1.8px 1.8px at 22% 42%, #E6E1FF, transparent),
    radial-gradient(1.2px 1.2px at 66% 82%, #CFF6FF, transparent),
    radial-gradient(1.5px 1.5px at 84% 28%, #fff, transparent);
  background-size: 380px 380px;
  animation: qbTitila 4.5s ease-in-out infinite alternate;
}
@keyframes qbTitila { from { opacity: .25; } to { opacity: .9; } }
.qb-clase .planeta { position: absolute; border-radius: 50%; }
.qb-clase .planeta-grande { width: 360px; height: 360px; left: -190px; bottom: -190px; opacity: .45;
  background: radial-gradient(circle at 62% 30%, #8C82F2 0%, #4A3FAE 38%, #221A63 66%, transparent 71%); }
.qb-clase .planeta-chico { width: 56px; height: 56px; right: -30px; top: 44%; opacity: .45;
  background: radial-gradient(circle at 35% 30%, #CFF6FF 0%, #2DB2C2 45%, #0D5E69 75%, transparent 77%); }

/* ---------- Barra ---------- */
.qb-clase .barra { padding: 10px 20px; width: 100%; max-width: 600px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; }
.qb-clase .marca { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; text-decoration: none; color: #fff; }
.qb-clase .marca img { width: 28px; height: 28px; border-radius: 8px; }
.qb-clase .acento { color: var(--lila); }

/* ---------- Personajes: máximo 2, pequeños, en su propio espacio ---------- */
.qb-clase .personaje { position: relative; flex: none; animation: qbFlota 6s ease-in-out infinite; }
.qb-clase .p-estratega { animation-duration: 7s; animation-delay: -2s; }
@keyframes qbFlota { 0%, 100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-4px,0); } }

.qb-clase .contenido { width: 100%; max-width: 600px; margin: 0 auto; padding: 6px 20px 36px; display: grid; gap: 22px; flex: 1; align-content: start; }

/* ---------- Título y fecha ---------- */
.qb-clase h1 { font-size: clamp(30px, 8.6vw, 46px); line-height: 1.06; font-weight: 700; text-wrap: balance; color: #fff; }
.qb-clase .resaltado { background: linear-gradient(95deg, #C9C2FF 0%, #7FD8F0 55%, #5EE0A8 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.qb-clase .fecha { margin: 14px 0 0; font-size: 16px; font-weight: 700; color: #fff; white-space: nowrap; }
.qb-clase .tu-hora { margin: 4px 0 0; font-size: 14px; color: var(--cian); }
.qb-clase .tu-hora::first-letter { text-transform: uppercase; }

/* ---------- Estado: cuenta regresiva en una línea ---------- */
.qb-clase .accion { display: grid; gap: 12px; }
.qb-clase .estado { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0; padding: 10px 14px; border-radius: 14px;
  background: rgba(12,10,23,.55); border: 1px solid rgba(201,194,255,.22); font-weight: 700; font-size: 15px; color: #fff; text-align: center; }
.qb-clase .estado-etiqueta { font-family: var(--font-mono); font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--lila); white-space: nowrap; }
.qb-clase .reloj { display: inline-flex; gap: 8px; }
.qb-clase .unidad { display: inline-flex; align-items: baseline; gap: 1px; }
/* Ancho fijo por dígito: el número no salta de un segundo a otro. */
.qb-clase .numero { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; font-size: 20px; font-weight: 700; min-width: 2.1ch; text-align: right; color: #fff;
  text-shadow: 0 0 8px rgba(124,108,242,.8); }
.qb-clase .unidad-nombre { font-family: var(--font-mono); font-size: 12px; color: var(--lila); }
.qb-clase .estado[data-estado="en_vivo"] { background: #B42318; border-color: #E5484D; }
.qb-clase .punto-vivo { width: 10px; height: 10px; border-radius: 50%; background: #fff; flex: none; animation: qbLate 1.3s ease-in-out infinite; }
@keyframes qbLate { 50% { opacity: .3; } }

/* ---------- EL BOTÓN ---------- */
.qb-clase .btn-principal { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: center; justify-content: center;
  width: 100%; min-height: 66px; padding: 14px 20px; border-radius: 18px; text-decoration: none;
  background: linear-gradient(100deg, #3BEA84 0%, #25D366 100%);
  color: #06170D; font-size: clamp(19px, 5.6vw, 22px); font-weight: 800; letter-spacing: -.01em; white-space: nowrap;
  box-shadow: 0 0 0 2px rgba(255,255,255,.35) inset, 0 12px 34px -8px rgba(37,211,102,.8), 0 0 48px -4px rgba(59,234,132,.55);
  animation: qbPulso 2.4s ease-in-out infinite; -webkit-tap-highlight-color: transparent; }
.qb-clase .btn-principal::after { content: ""; position: absolute; z-index: 0; top: -10%; bottom: -10%; left: 0; width: 36%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.8), transparent);
  transform: translateX(-160%) skewX(-20deg); animation: qbBrillo 3.6s ease-in-out infinite; }
.qb-clase .btn-contenido { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 10px; }
.qb-clase .btn-principal:active { transform: scale(.98); }
@keyframes qbPulso { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes qbBrillo { 0%, 55% { transform: translateX(-160%) skewX(-20deg); } 85%, 100% { transform: translateX(330%) skewX(-20deg); } }

/* Calendario: un enlace pequeño. */
.qb-clase .calendario { text-align: center; }
.qb-clase .enlace-calendario { background: none; border: 0; padding: 6px 8px; font: inherit; font-size: 14px; font-weight: 600; color: var(--lila); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.qb-clase .calendario-opciones:not([hidden]) { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px 10px; font-size: 14px; color: var(--muted); }
.qb-clase .calendario-opciones a { color: var(--lila); font-weight: 600; padding: 4px 2px; }

/* ---------- Aprendizajes (sin tarjeta) ---------- */
.qb-clase .aprender-cabecera { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.qb-clase .aprender h2 { font-size: 18px; color: #fff; }
.qb-clase .aprender ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.qb-clase .aprender li { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; line-height: 1.4; color: var(--ink); }
.qb-clase .aprender li svg { flex: none; margin-top: 2px; color: #3BEA84; }

.qb-clase .pie { display: flex; justify-content: center; gap: 8px; padding: 0 22px 22px; font-size: 13.5px; color: var(--muted); }
/* Espacio al final de la página para la barra fija (celular): al llegar
   abajo, ningún texto queda debajo de ella. */
.qb-clase .espacio-barra { height: calc(88px + env(safe-area-inset-bottom)); flex: none; }

/* ---------- Barra fija de abajo (solo celular) ---------- */
.qb-clase .barra-fija { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: rgba(12,10,23,.94); border-top: 1px solid rgba(201,194,255,.2);
  transform: translateY(110%); transition: transform .25s ease; }
.qb-clase .barra-fija[data-visible="true"] { transform: translateY(0); }
.qb-clase .barra-fija .btn-principal { min-height: 64px; animation: none; }

@media (min-width: 920px) {
  .qb-clase .barra-fija, .qb-clase .espacio-barra { display: none; }
  .qb-clase .contenido { padding: 30px 20px 56px; }
}

@media (prefers-reduced-motion: reduce) {
  .qb-clase *, .qb-clase *::before, .qb-clase *::after { animation: none !important; transition: none !important; }
  .qb-clase .btn-principal::after { display: none; }
}
`;

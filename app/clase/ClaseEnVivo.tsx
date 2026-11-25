"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";
import { ESTILOS } from "./estilos";
import {
  ENLACE_COMUNIDAD,
  enlaceGoogleCalendar,
  estadoClase,
  horaLocalSiDistinta,
  tiempoRestante,
  type EstadoClase,
} from "./evento";

const dos = (n: number) => String(n).padStart(2, "0");

// Primera pantalla del celular: título, fecha, cuenta regresiva compacta y
// EL BOTÓN. Nada más compite con él.
export const TITULO_CORTO = "Clase gratis en vivo: cómo decide Meta qué anuncios mostrar";
export const TEXTO_BOTON = "Unirme gratis →";

// La línea de estado reemplaza la cuenta regresiva durante y después.
export const ESTADO_TEXTO: Record<Exclude<EstadoClase, "antes">, string> = {
  en_vivo: "¡La clase está en vivo!",
  terminada: "La clase terminó. Únete a la comunidad para la próxima",
};

export const LO_QUE_VAS_A_APRENDER = [
  "Meta y la subasta",
  "Por qué Instagram muestra unas publicaciones y otras no",
  "Anuncios que detienen el dedo",
] as const;

// Íconos dibujados (nunca emoji ni glifos de fuente).
function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.05c0 2 .52 3.95 1.52 5.67L.58 23.3l5.72-1.5a11.33 11.33 0 0 0 5.43 1.38h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  );
}

function Trazo({ children, tamano = 18 }: { children: ReactNode; tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IconoCheck = () => <Trazo><path d="M5 12.5l4.2 4.2L19 7" /></Trazo>;

// Un personaje de Quiubot, pequeño y decorativo (máximo 2 en la página).
function Personaje({ asistente, tamano, clase }: { asistente: AsistenteId; tamano: number; clase: string }) {
  return (
    <div className={`personaje ${clase}`} aria-hidden="true">
      <EsferaAsistente asistente={asistente} estado="normal" tamano={tamano} />
    </div>
  );
}

function BotonComunidad({ id, oculto = false }: { id?: string; oculto?: boolean }) {
  return (
    <a
      className="btn-principal"
      href={ENLACE_COMUNIDAD}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={id}
      tabIndex={oculto ? -1 : undefined}
      aria-hidden={oculto || undefined}
    >
      <span className="btn-contenido">
        <IconoWhatsApp />
        <span>{TEXTO_BOTON}</span>
      </span>
    </a>
  );
}

function AgregarCalendario() {
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();
  return (
    <div className="calendario">
      <button type="button" className="enlace-calendario" aria-expanded={abierto} aria-controls={idMenu} onClick={() => setAbierto((a) => !a)}>
        Agregar a mi calendario
      </button>
      <div id={idMenu} className="calendario-opciones" hidden={!abierto}>
        <a href={enlaceGoogleCalendar()} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        <span aria-hidden="true">·</span>
        <a href="/clase/calendario.ics" download="clase-quiubot.ics">Apple / Outlook (.ics)</a>
      </div>
    </div>
  );
}

function LineaEstado({ estado, ahora }: { estado: EstadoClase; ahora: number }) {
  if (estado !== "antes") {
    return (
      <p className="estado" data-testid="estado-clase" data-estado={estado}>
        {estado === "en_vivo" && <span className="punto-vivo" aria-hidden="true" />}
        {ESTADO_TEXTO[estado]}
      </p>
    );
  }
  const r = tiempoRestante(ahora);
  const unidades: [string, number][] = [["d", r.dias], ["h", r.horas], ["m", r.minutos], ["s", r.segundos]];
  return (
    <div className="estado" data-testid="estado-clase" data-estado="antes">
      <span className="estado-etiqueta">Empieza en</span>
      {/* role="timer" sin aria-live: un lector de pantalla no anuncia cada segundo. */}
      <span className="reloj" role="timer" aria-label={`Faltan ${r.dias} días, ${r.horas} horas, ${r.minutos} minutos`}>
        {unidades.map(([nombre, valor]) => (
          <span className="unidad" key={nombre} aria-hidden="true">
            <span className="numero">{dos(valor)}</span>
            <span className="unidad-nombre">{nombre}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

const sinSuscripcion = () => () => {};
const horaLocalDelVisitante = () => horaLocalSiDistinta(Intl.DateTimeFormat().resolvedOptions().timeZone);

export default function ClaseEnVivo({ ahoraServidor }: { ahoraServidor: number }) {
  // Primer render con la hora del servidor (igual en servidor y cliente);
  // apenas monta, pasa al reloj del visitante.
  const [ahora, setAhora] = useState(ahoraServidor);
  const horaLocal = useSyncExternalStore(sinSuscripcion, horaLocalDelVisitante, () => null);
  // Barra fija de abajo (celular): aparece cuando el botón principal sale
  // de la pantalla.
  const [conBarra, setConBarra] = useState(false);
  const refBoton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tic = () => {
      const n = Date.now();
      setAhora(n);
      t = setTimeout(tic, 1000 - (n % 1000) + 15);
    };
    let t = setTimeout(tic, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = refBoton.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setConBarra(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const estado = estadoClase(ahora);

  return (
    <ProveedorEsferas>
      <main className="qb-clase" data-estado={estado}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@600;700&display=swap"
          precedence="default"
        />
        <style>{ESTILOS}</style>

        <div className="cielo" aria-hidden="true">
          <span className="estrellas estrellas-1" />
          <span className="estrellas estrellas-2" />
          <span className="planeta planeta-grande" />
          <span className="planeta planeta-chico" />
        </div>

        <header className="barra">
          <a className="marca" href="https://quiubot.site" aria-label="Quiubot, ir al inicio">
            <img src="/marca/icono-quiubot.svg" alt="" width={28} height={28} />
            <span>quiu<span className="acento">bot</span></span>
          </a>
          <Personaje asistente="director" tamano={24} clase="p-director" />
        </header>

        <div className="contenido">
          <section className="hero">
            <h1>
              Clase gratis en vivo: <span className="resaltado">cómo decide Meta qué anuncios mostrar</span>
            </h1>
            <p className="fecha">{"Jueves 26 nov · 8:00 p. m. (Colombia)"}</p>
            {horaLocal && <p className="tu-hora">En tu hora: {horaLocal}</p>}
          </section>

          <section className="accion">
            <LineaEstado estado={estado} ahora={ahora} />
            <div ref={refBoton}>
              <BotonComunidad id="boton-comunidad" />
            </div>
            {estado === "antes" && <AgregarCalendario />}
          </section>

          {estado !== "terminada" && (
            <section className="aprender" aria-labelledby="titulo-aprender">
              <div className="aprender-cabecera">
                <h2 id="titulo-aprender">Lo que vas a aprender</h2>
                <Personaje asistente="estratega" tamano={22} clase="p-estratega" />
              </div>
              <ul>
                {LO_QUE_VAS_A_APRENDER.map((texto) => (
                  <li key={texto}><IconoCheck /><span>{texto}</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="pie">
          <span>quiu<span className="acento">bot</span></span>
          <span aria-hidden="true">·</span>
          <a href="https://quiubot.site">quiubot.site</a>
        </footer>

        <div className="espacio-barra" aria-hidden="true" />

        {/* Barra fija de abajo, solo en celular: el mismo botón. Mientras
            no se ve, sale del orden de tabulación y del lector de pantalla. */}
        <div className="barra-fija" data-visible={conBarra} data-testid="barra-fija" inert={!conBarra}>
          <BotonComunidad oculto={!conBarra} />
        </div>
      </main>
    </ProveedorEsferas>
  );
}

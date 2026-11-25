"use client";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";
import { ESTILOS } from "./estilos";
import {
  ENLACE_COMUNIDAD,
  SUBTITULO_CLASE,
  enlaceGoogleCalendar,
  estadoClase,
  horaLocalSiDistinta,
  tiempoRestante,
  type EstadoClase,
} from "./evento";

const dos = (n: number) => String(n).padStart(2, "0");
const HORA = "8:00 p. m.";

// El chip de arriba cambia con el estado: antes de la clase no puede decir
// "en vivo". Después no se sabe si habrá grabación, así que no se promete.
export const CHIP_POR_ESTADO: Record<EstadoClase, string> = {
  antes: "Clase gratuita · Online",
  en_vivo: "En vivo ahora",
  terminada: "Próxima clase en la comunidad",
};

export const LO_QUE_VAS_A_APRENDER = [
  "Cómo decide Meta qué anuncio mostrar y a quién.",
  "Por qué Instagram muestra unas publicaciones y otras no.",
  "Cómo diseñar anuncios y videos que detienen el dedo.",
  "Cómo usar mejor tu presupuesto en pauta.",
] as const;

// Íconos dibujados (nunca emoji ni glifos de fuente: no todas las fuentes
// los traen y en algunos celulares salen como cuadritos).
function IconoWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44m8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.05c0 2 .52 3.95 1.52 5.67L.58 23.3l5.72-1.5a11.33 11.33 0 0 0 5.43 1.38h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  );
}

function Trazo({ children, tamano = 20 }: { children: ReactNode; tamano?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamano} height={tamano} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IconoCalendario = () => (
  <Trazo>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
  </Trazo>
);

function IconoFlecha({ abierto }: { abierto: boolean }) {
  return (
    <span className="flecha" data-abierto={abierto}>
      <Trazo tamano={18}><path d="M6 9l6 6 6-6" /></Trazo>
    </span>
  );
}

// Uno por punto de "Lo que vas a aprender", en el mismo orden.
const ICONOS_APRENDER = [
  // Meta elige: una mira apuntando a una persona.
  <Trazo key="a" tamano={22}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="2.6" /><path d="M7.5 17.2c1-2 2.6-3 4.5-3s3.5 1 4.5 3" /></Trazo>,
  // Instagram reparte: un celular con un ojo.
  <Trazo key="b" tamano={22}><rect x="6" y="2.5" width="12" height="19" rx="2.8" /><path d="M8.8 12s1.2-2.3 3.2-2.3 3.2 2.3 3.2 2.3-1.2 2.3-3.2 2.3S8.8 12 8.8 12z" /><circle cx="12" cy="12" r=".6" /></Trazo>,
  // Detener el dedo: una mano que toca.
  <Trazo key="c" tamano={22}><path d="M9 11V4.8a1.6 1.6 0 0 1 3.2 0V10" /><path d="M12.2 9.6a1.6 1.6 0 0 1 3.2 0v1.2a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-.9a6 6 0 0 1-4.6-2.2l-2.4-3a1.7 1.7 0 0 1 2.5-2.3L9 15" /></Trazo>,
  // Presupuesto: monedas.
  <Trazo key="d" tamano={22}><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" /><path d="M9.5 16.3c.8.1 1.6.2 2.5.2 3 0 5.5-1.1 5.5-2.5v-1M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5M14.5 10.4c2.2.3 3.9 1.2 3.9 2.3v3.8c0 1.4-2.5 2.5-5.5 2.5-1 0-1.9-.1-2.7-.3" /></Trazo>,
];

// Un personaje de Quiubot flotando (los mismos de autopilot y del asistente
// flotante). Decorativo: aria-hidden; si se toca, se pone feliz.
function Personaje({ asistente, tamano, clase }: { asistente: AsistenteId; tamano: number; clase: string }) {
  return (
    <div className={`personaje ${clase}`} aria-hidden="true">
      <EsferaAsistente asistente={asistente} estado="normal" tamano={tamano} />
    </div>
  );
}

function BotonComunidad() {
  return (
    <a className="btn-principal" href={ENLACE_COMUNIDAD} target="_blank" rel="noopener noreferrer" data-testid="boton-comunidad">
      <span className="btn-contenido">
        <IconoWhatsApp />
        <span>Unirme a la comunidad</span>
      </span>
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
    <>
      {/* role="timer" sin aria-live: un lector de pantalla no anuncia cada segundo. */}
      <div className="reloj" role="timer" aria-label={`Faltan ${r.dias} días, ${r.horas} horas, ${r.minutos} minutos`}>
        {unidades.map(([nombre, valor]) => (
          <div className="unidad" key={nombre} aria-hidden="true">
            <span className="numero">{dos(valor)}</span>
            <span className="unidad-nombre">{nombre}</span>
          </div>
        ))}
      </div>
    </>
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
    <ProveedorEsferas>
      <main className="qb-clase" data-estado={estado}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@600;700&display=swap"
          precedence="default"
        />
        <style>{ESTILOS}</style>

        {/* Cielo: estrellas y planetas suaves, solo decoración. */}
        <div className="cielo" aria-hidden="true">
          <span className="estrellas estrellas-1" />
          <span className="estrellas estrellas-2" />
          <span className="planeta planeta-grande" />
          <span className="planeta planeta-chico" />
          <span className="planeta planeta-anillo"><i /></span>
        </div>

        <header className="barra">
          <a className="marca" href="https://quiubot.site" aria-label="Quiubot, ir al inicio">
            <img src="/marca/icono-quiubot.svg" alt="" width={32} height={32} />
            <span>quiu<span className="acento">bot</span></span>
          </a>
          {/* En celular el director vive en la barra, en su propio espacio:
              los personajes nunca se montan sobre textos ni botones. */}
          <Personaje asistente="director" tamano={30} clase="p-director-barra" />
        </header>

        <div className="contenido">
          <section className="hero">
            <Personaje asistente="director" tamano={58} clase="p-director" />
            <Personaje asistente="marca" tamano={40} clase="p-marca" />
            <p className="chip" data-testid="chip-estado" data-estado={estado}>
              <span className="punto" aria-hidden="true" />
              {CHIP_POR_ESTADO[estado]}
            </p>
            <h1>
              Clase en vivo: <span className="resaltado">cómo decide Meta qué anuncios mostrar</span>
            </h1>
            <p className="sub">{SUBTITULO_CLASE}</p>
            <p className="fecha-corta">
              <IconoCalendario />
              <span>Jueves 26 de noviembre · {HORA} <span className="suave">hora de Colombia</span></span>
            </p>
          </section>

          <section className="accion">
            <div className="panel" data-estado={estado}>
              {/* Personajes en la misma fila que el texto, cada uno en su
                  espacio (nunca encima del texto). */}
              <div className="panel-cabecera">
                <Personaje asistente="creativo" tamano={28} clase="p-creativo" />
                <div className="panel-centro">
                  {estado === "antes" && <p className="panel-etiqueta">La clase empieza en</p>}
                  {estado === "en_vivo" && (
                    <h2 className="panel-titulo"><span className="punto-vivo" aria-hidden="true" />¡La clase está en vivo!</h2>
                  )}
                  {estado === "terminada" && (
                    <h2 className="panel-titulo">La clase terminó. Únete a la comunidad para la próxima</h2>
                  )}
                </div>
                <Personaje asistente="publicador" tamano={28} clase="p-publicador" />
              </div>
              {estado === "antes" && <CuentaRegresiva ahora={ahora} />}
            </div>

            <div className="botones">
              <BotonComunidad />
              <p className="nota">Se abre el grupo en WhatsApp, en una pestaña nueva.</p>
              {estado === "antes" && <AgregarCalendario />}
            </div>
          </section>

          {estado !== "terminada" && (
            <section className="tarjeta aprender" aria-labelledby="titulo-aprender">
              <div className="tarjeta-cabecera">
                <h2 id="titulo-aprender">Lo que vas a aprender</h2>
                <Personaje asistente="estratega" tamano={30} clase="p-estratega" />
              </div>
              <ul>
                {LO_QUE_VAS_A_APRENDER.map((texto, i) => (
                  <li key={texto}>
                    <span className={`icono-aprender icono-${i + 1}`}>{ICONOS_APRENDER[i]}</span>
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="tarjeta cuando" aria-labelledby="titulo-cuando">
            <h2 id="titulo-cuando">Cuándo</h2>
            <dl>
              <div>
                <dt>Fecha</dt>
                <dd>Jueves 26 de noviembre de 2026</dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd>{"8:00 a 10:00 p. m."}, hora de Colombia</dd>
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

          {estado === "antes" && (
            <section className="tarjeta pasos" aria-labelledby="titulo-pasos">
              <h2 id="titulo-pasos">Cómo participar</h2>
              <ol>
                <li><span className="paso-num" aria-hidden="true">1</span><span>Únete al grupo de WhatsApp de la comunidad.</span></li>
                <li><span className="paso-num" aria-hidden="true">2</span><span>Guarda la fecha en tu calendario.</span></li>
                <li><span className="paso-num" aria-hidden="true">3</span><span>{`Nos vemos el jueves 26 a las ${HORA}`}</span></li>
              </ol>
            </section>
          )}
        </div>

        <footer className="pie">
          <span>quiu<span className="acento">bot</span></span>
          <span aria-hidden="true">·</span>
          <a href="https://quiubot.site">quiubot.site</a>
        </footer>
      </main>
    </ProveedorEsferas>
  );
}

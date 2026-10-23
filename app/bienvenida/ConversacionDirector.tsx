"use client";
import { useEffect, useRef, useState } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId } from "@/app/components/esferas/esferasShared";
import { trackCustom } from "@/app/components/MetaPixel";
import { CtaLink } from "./compartido";
import { precioMensual, nombreVisiblePlan, PRECIO_FUNDADOR, CUPOS_FUNDADOR, DIAS_PRUEBA } from "@/app/lib/planesConfig";
import {
  GUION,
  ETIQUETA_OPCION,
  OFERTA_MEDIO,
  LISTA_EQUIPO,
  EJEMPLO_PROPUESTA,
  NOMBRE_CORTO,
  ORDEN_EQUIPO,
  TITULO,
  GARANTIAS,
  type IdPregunta,
  type Mensaje,
  type ParteMensaje,
  type ValorToken,
} from "./guionDirector";

type IdOpcion = IdPregunta | "empezar";
type EntradaChat =
  | { tipo: "director"; id: string; mensaje: Mensaje }
  | { tipo: "yo"; id: string; texto: string }
  | { tipo: "oferta"; id: string };

const PREGUNTAS_POR_DEFECTO: IdOpcion[] = ["que", "ventas", "precio", "control", "novato", "necesito", "negocio", "cancelar"];

function resolverValor(cual: ValorToken, hayFundador: boolean): string {
  switch (cual) {
    case "precioAutopilotoPrincipal":
      return `$${(hayFundador ? PRECIO_FUNDADOR : precioMensual("escala")).toLocaleString("es-CO")}`;
    case "precioAutopilotoNormal":
      return `$${precioMensual("escala").toLocaleString("es-CO")}`;
    case "precioCrecimiento":
      return `$${precioMensual("crecimiento").toLocaleString("es-CO")}`;
    case "diasPrueba":
      return String(DIAS_PRUEBA);
    case "nombreAutopiloto":
      return nombreVisiblePlan("escala");
  }
}

function Partes({ partes, hayFundador }: { partes: ParteMensaje[]; hayFundador: boolean }) {
  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === "salto") return <br key={i} />;
        if (p.tipo === "fuerte") return <strong key={i}>{p.texto}</strong>;
        if (p.tipo === "valor") {
          const texto = resolverValor(p.cual, hayFundador);
          return p.fuerte ? <strong key={i}>{texto}</strong> : <span key={i}>{texto}</span>;
        }
        return <span key={i}>{p.texto}</span>;
      })}
    </>
  );
}

function BloqueLista() {
  return (
    <>
      <span>Así trabaja el equipo:</span>
      <ul className="qbc-lista">
        {LISTA_EQUIPO.map((item) => (
          <li key={item.id}>
            <span className={`qbc-punto qbc-punto-${item.id}`} aria-hidden="true" />
            <span>{item.texto}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function BloquePrecio({ hayFundador }: { hayFundador: boolean }) {
  const normal = precioMensual("escala");
  const principal = hayFundador ? PRECIO_FUNDADOR : normal;
  return (
    <>
      <span>El plan {nombreVisiblePlan("escala")}, con todo el equipo:</span>
      <div className="qbc-precio-msg">
        {hayFundador && <s className="qbc-precio-tachado">${normal.toLocaleString("es-CO")}</s>}
        <strong>${principal.toLocaleString("es-CO")}</strong>
        <span>al mes</span>
      </div>
      <div>
        {hayFundador
          ? `Precio de fundador para los primeros ${CUPOS_FUNDADOR} negocios, durante su primer año: menos de $10.000 al día por un equipo completo. Y los primeros ${DIAS_PRUEBA} días son gratis, sin tarjeta.`
          : `Menos de $${Math.round(normal / 30).toLocaleString("es-CO")} al día por un equipo completo. Y los primeros ${DIAS_PRUEBA} días son gratis, sin tarjeta.`}
      </div>
    </>
  );
}

function BloquePlanes({ hayFundador }: { hayFundador: boolean }) {
  const precioEscala = precioMensual("escala");
  const filas = [
    { nombre: "Arranque", precio: "Gratis", texto: "Para conocer Quiubot: 1 estrategia al mes.", top: false },
    { nombre: "Crecimiento", precio: `$${precioMensual("crecimiento").toLocaleString("es-CO")}/mes`, texto: "Lo haces tú con nuestras herramientas de IA.", top: false },
    {
      nombre: nombreVisiblePlan("escala"),
      precio: `$${(hayFundador ? PRECIO_FUNDADOR : precioEscala).toLocaleString("es-CO")}/mes`,
      texto: hayFundador
        ? `Precio de fundador (normal $${precioEscala.toLocaleString("es-CO")}). El equipo completo trabajando por tu meta, todos los días.`
        : "El equipo completo trabajando por tu meta, todos los días.",
      top: true,
    },
  ];
  return (
    <div className="qbc-planes-msg">
      {filas.map((f) => (
        <div className={`qbc-pl${f.top ? " qbc-pl-top" : ""}`} key={f.nombre}>
          <div className="qbc-pl-h">
            <strong>{f.nombre}</strong>
            <span>{f.precio}</span>
          </div>
          {f.top && <em>Recomendado · {DIAS_PRUEBA} días gratis</em>}
          <p>{f.texto}</p>
        </div>
      ))}
    </div>
  );
}

function BloquePropuesta() {
  return (
    <div className="qbc-propuesta">
      <strong>{EJEMPLO_PROPUESTA.titulo}</strong>
      <span className="qbc-propuesta-detalle">{EJEMPLO_PROPUESTA.texto}</span>
      <div className="qbc-propuesta-rs">
        {EJEMPLO_PROPUESTA.respuestas.map((r, i) => (
          <span key={r} className={i === 0 ? "qbc-rs-principal" : undefined}>
            {r}
          </span>
        ))}
      </div>
      <div className="qbc-propuesta-nota">Ejemplo de propuesta</div>
    </div>
  );
}

function ContenidoMensaje({ mensaje, hayFundador }: { mensaje: Mensaje; hayFundador: boolean }) {
  switch (mensaje.tipo) {
    case "texto":
      return <Partes partes={mensaje.partes} hayFundador={hayFundador} />;
    case "lista":
      return <BloqueLista />;
    case "precio":
      return <BloquePrecio hayFundador={hayFundador} />;
    case "planes":
      return <BloquePlanes hayFundador={hayFundador} />;
    case "propuesta":
      return <BloquePropuesta />;
  }
}

function AvatarDirector() {
  return (
    <div className="qbc-av" aria-hidden="true">
      <EsferaAsistente asistente="director" estado="normal" tamano={30} />
    </div>
  );
}

// Título + fila de 7 esferas (Director más grande, al centro) + el
// chat guiado + garantías -- todo junto, como en la maqueta, porque
// la fila de esferas y el chat están visualmente ligados (el chat
// decide cuáles esferas se encienden).
// hayFundador se recibe por prop (calculado una sola vez en
// ExperienciaAutopiloto a partir de /api/billing/cupos-fundador) para
// no repetir la misma llamada que también necesita la sección de
// precios más abajo en la página.
export default function ConversacionDirector({ hayFundador }: { hayFundador: boolean }) {
  const [hilo, setHilo] = useState<EntradaChat[]>(() => [
    { tipo: "director", id: "inicio-0", mensaje: GUION.inicio.mensajes[0] },
    { tipo: "director", id: "inicio-1", mensaje: GUION.inicio.mensajes[1] },
  ]);
  const [opciones, setOpciones] = useState<IdOpcion[]>([]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [enfocados, setEnfocados] = useState<AsistenteId[]>(["director"]);
  const [enEnfoque, setEnEnfoque] = useState(true);

  const vistasRef = useRef<Set<IdPregunta>>(new Set());
  const respuestasRef = useRef(0);
  const ofrecioCtaRef = useRef(false);
  const reduceRef = useRef(false);
  const contadorIdRef = useRef(0);
  const ultimoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    setOpciones(calcularOpciones(GUION.inicio.siguientes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ultimoRef.current?.scrollIntoView({ block: "nearest", behavior: reduceRef.current ? "auto" : "smooth" });
  }, [hilo, escribiendo]);

  const nuevoId = () => `m${contadorIdRef.current++}`;
  const agregar = (entrada: EntradaChat) => setHilo((h) => [...h, entrada]);
  const iluminar = (ids: AsistenteId[]) => {
    setEnfocados(ids);
    setEnEnfoque(true);
  };

  function calcularOpciones(sugeridas: IdOpcion[] | null): IdOpcion[] {
    const base = sugeridas ?? PREGUNTAS_POR_DEFECTO;
    let lista = base.filter((id) => id === "empezar" || !vistasRef.current.has(id as IdPregunta));
    lista = lista.slice(0, 4);
    if (!lista.includes("empezar") && respuestasRef.current >= 2) {
      lista = ["empezar", ...lista];
    }
    return lista;
  }

  // Revela los mensajes del Director de a uno, con el mismo cálculo de
  // espera que la maqueta (más largo el mensaje, más espera, tope de
  // 1300ms) -- con prefers-reduced-motion no hay "escribiendo", los
  // mensajes aparecen de una vez.
  function decir(mensajes: Mensaje[], alTerminar?: () => void) {
    let i = 0;
    const siguiente = () => {
      if (i >= mensajes.length) {
        alTerminar?.();
        return;
      }
      const mensaje = mensajes[i];
      if (reduceRef.current) {
        agregar({ tipo: "director", id: nuevoId(), mensaje });
        i++;
        siguiente();
        return;
      }
      const largo = JSON.stringify(mensaje).length;
      const espera = Math.min(1300, 450 + largo * 6);
      setEscribiendo(true);
      window.setTimeout(() => {
        setEscribiendo(false);
        agregar({ tipo: "director", id: nuevoId(), mensaje });
        i++;
        window.setTimeout(siguiente, 250);
      }, espera);
    };
    siguiente();
  }

  function agregarOferta(siguientesOpciones: IdOpcion[] | null) {
    window.setTimeout(
      () => {
        agregar({ tipo: "oferta", id: nuevoId() });
        ofrecioCtaRef.current = true;
        setOpciones(calcularOpciones(siguientesOpciones));
      },
      reduceRef.current ? 0 : 600
    );
  }

  function elegir(id: IdOpcion) {
    setOpciones([]);
    trackCustom("PreguntaDirector", { pregunta: id });

    if (id === "empezar") {
      agregar({ tipo: "yo", id: nuevoId(), texto: ETIQUETA_OPCION.empezar });
      iluminar(["director"]);
      window.setTimeout(
        () => {
          agregar({ tipo: "oferta", id: nuevoId() });
          ofrecioCtaRef.current = true;
          setOpciones(calcularOpciones(["mas"]));
        },
        reduceRef.current ? 0 : 500
      );
      return;
    }

    const entrada = GUION[id];
    vistasRef.current.add(id);
    respuestasRef.current += 1;
    agregar({ tipo: "yo", id: nuevoId(), texto: entrada.pregunta! });
    iluminar(entrada.luz);

    const mensajes = !hayFundador && entrada.mensajesSinFundador ? entrada.mensajesSinFundador : entrada.mensajes;

    decir(mensajes, () => {
      if (respuestasRef.current === 2 && !ofrecioCtaRef.current) {
        agregarOferta(entrada.siguientes);
      } else {
        setOpciones(calcularOpciones(entrada.siguientes));
      }
    });
  }

  return (
    <div className="qbc-escena">
      <div className="qbc-titulo">
        <p>{TITULO.eyebrow}</p>
        <h1>
          {TITULO.h1Inicio}
          <em>{TITULO.h1Enfasis}</em>
        </h1>
      </div>

      <div className={`qbc-equipo${enEnfoque ? " qbc-enfoque" : ""}`} aria-hidden="true">
        {ORDEN_EQUIPO.map((id) => {
          const activo = enfocados.includes(id);
          return (
            <div className={`qbc-miembro${id === "director" ? " qbc-director" : ""}${activo ? " qbc-activo" : ""}`} key={id}>
              <EsferaAsistente asistente={id} estado="normal" tamano={id === "director" ? 96 : 64} />
              <small>{NOMBRE_CORTO[id]}</small>
            </div>
          );
        })}
      </div>

      <section className="qbc-chat" aria-label="Conversación con el Director">
        <div className="qbc-hilo" aria-live="polite">
          {hilo.map((entrada, i) => {
            const esUltimo = i === hilo.length - 1;
            const ref = esUltimo ? ultimoRef : undefined;
            if (entrada.tipo === "yo") {
              return (
                <div className="qbc-msg qbc-yo" key={entrada.id} ref={ref}>
                  <div className="qbc-burbuja">{entrada.texto}</div>
                </div>
              );
            }
            if (entrada.tipo === "oferta") {
              return (
                <div className="qbc-msg" key={entrada.id} ref={ref}>
                  <AvatarDirector />
                  <div className="qbc-burbuja">
                    <div>
                      <Partes partes={OFERTA_MEDIO.partes} hayFundador={hayFundador} />
                    </div>
                    <CtaLink href="/login" ubicacion="chat_oferta" className="qbc-cta qbc-cta-burbuja">
                      Empezar mis {DIAS_PRUEBA} días gratis →
                    </CtaLink>
                  </div>
                </div>
              );
            }
            return (
              <div className="qbc-msg" key={entrada.id} ref={ref}>
                <AvatarDirector />
                <div className="qbc-burbuja">
                  <ContenidoMensaje mensaje={entrada.mensaje} hayFundador={hayFundador} />
                  {entrada.mensaje.tipo === "precio" && (
                    <CtaLink href="/login" ubicacion="chat_planes" className="qbc-cta qbc-cta-burbuja">
                      Empezar gratis →
                    </CtaLink>
                  )}
                </div>
              </div>
            );
          })}
          {escribiendo && (
            <div className="qbc-msg qbc-escribiendo" ref={ultimoRef}>
              <AvatarDirector />
              <div className="qbc-burbuja" aria-label="El Director está escribiendo">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
        <div className="qbc-opciones">
          {opciones.map((id) => (
            <button
              key={id}
              type="button"
              className={`qbc-opcion${id === "empezar" ? " qbc-fuerte" : ""}`}
              onClick={() => elegir(id)}
            >
              {id === "empezar" ? ETIQUETA_OPCION.empezar : GUION[id].pregunta}
            </button>
          ))}
        </div>
      </section>

      <div className="qbc-garantias">
        <span>
          {DIAS_PRUEBA} días gratis, sin tarjeta
        </span>
        {GARANTIAS.map((g) => (
          <span key={g}>{g}</span>
        ))}
      </div>
    </div>
  );
}

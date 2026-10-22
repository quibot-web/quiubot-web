"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./EsferaAsistente.module.css";
import { useRegistrarEsfera } from "./ProveedorEsferas";
import { calcularOffsetPath, claseEstado, type AsistenteId, type EstadoEsfera } from "./esferasShared";

type Props = {
  asistente: AsistenteId;
  estado: EstadoEsfera;
  tamano?: number;
};

// Misma estructura DOM que la función esfera(id, estado) de
// docs/diseno/esferas_v3.html -- no agrega ni quita elementos.
export default function EsferaAsistente({ asistente, estado, tamano = 120 }: Props) {
  const botRef = useRef<HTMLDivElement>(null);
  const gemaRef = useRef<HTMLSpanElement>(null);
  const timeoutFelizRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const registrar = useRegistrarEsfera();

  useEffect(() => {
    if (!registrar || !botRef.current) return;
    return registrar(botRef.current);
  }, [registrar]);

  // Recalcula el path de la órbita cuando esta esfera en particular
  // entra en "trabajando" (el resize global ya cubre el resto, ver
  // ProveedorEsferas, pero un cambio de estado no dispara resize).
  useEffect(() => {
    if (estado === "trabajando" && botRef.current && gemaRef.current) {
      gemaRef.current.style.offsetPath = calcularOffsetPath(botRef.current);
    }
  }, [estado, tamano]);

  const alTocar = () => {
    const bot = botRef.current;
    if (!bot || estado === "pausa") return;
    bot.classList.remove(styles.feliz);
    void bot.offsetWidth; // fuerza reflow para poder re-disparar la animación si ya estaba "feliz"
    bot.classList.add(styles.feliz);
    clearTimeout(timeoutFelizRef.current);
    timeoutFelizRef.current = setTimeout(() => bot.classList.remove(styles.feliz), 1300);
  };

  const claseEstadoActual = claseEstado(estado);
  const clasesBot = [styles.bot, styles[asistente], claseEstadoActual ? styles[claseEstadoActual] : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={botRef}
      className={clasesBot}
      style={{ "--size": `${tamano}px` } as CSSProperties}
      onClick={alTocar}
    >
      <span className={`${styles.anillo} ${styles.atras}`} />
      <div className={styles.cuerpo}>
        <div className={styles.orb} />
        <div className={styles.cara}>
          <div className={styles.ojos}>
            <span className={styles.ojo} />
            <span className={styles.ojo} />
          </div>
          <span className={`${styles.rubor} ${styles.izq}`} />
          <span className={`${styles.rubor} ${styles.der}`} />
          <span className={styles.boca} />
        </div>
      </div>
      <span className={`${styles.anillo} ${styles.frente}`} />
      <span
        ref={gemaRef}
        data-gema
        className={estado === "trabajando" ? `${styles.gema} ${styles.orbitando}` : styles.gema}
      />
      <span className={styles.zz}>z</span>
      <span className={styles.burbuja}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

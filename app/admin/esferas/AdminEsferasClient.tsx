"use client";
import { useRouter } from "next/navigation";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId, EstadoEsfera } from "@/app/components/esferas/esferasShared";
import styles from "./AdminEsferasClient.module.css";

const EQUIPO: { id: AsistenteId; nombre: string; corto: string; rol: string }[] = [
  { id: "director", nombre: "Director", corto: "Director", rol: "Coordina al equipo y cuida tu meta" },
  { id: "marca", nombre: "Analista de marca", corto: "Marca", rol: "Entiende tu estilo y tu ADN" },
  { id: "estratega", nombre: "Estratega", corto: "Estratega", rol: "Diseña las campañas y sus conceptos" },
  { id: "creativo", nombre: "Creativo", corto: "Creativo", rol: "Crea tus imágenes y anuncios" },
  { id: "publicador", nombre: "Publicador", corto: "Publicador", rol: "Lanza en Meta lo que apruebas" },
  { id: "analista", nombre: "Analista de campañas", corto: "Analista", rol: "Lee los resultados todos los días" },
  { id: "optimizador", nombre: "Optimizador", corto: "Optimizador", rol: "Mejora lo que funciona y corrige lo que no" },
];

const ESTADOS_DEMO: { id: AsistenteId; estado: EstadoEsfera; titulo: string; detalle: string; badge: "bTrab" | "bEsp" | "bPau"; etiqueta: string }[] = [
  { id: "estratega", estado: "trabajando", titulo: "Trabajando", detalle: "Piensa (burbuja con puntos), su gema recorre el anillo y el vidrio late", badge: "bTrab", etiqueta: "Trabajando" },
  { id: "publicador", estado: "esperando", titulo: "Te necesita", detalle: "Anillo dorado, ojos sonrientes y se mece para llamarte", badge: "bEsp", etiqueta: "Te necesita" },
  { id: "creativo", estado: "pausa", titulo: "En pausa", detalle: "Se duerme hasta que la vuelvas a activar", badge: "bPau", etiqueta: "En pausa" },
];

const FILA: { id: AsistenteId; estado: EstadoEsfera; texto: string; principal?: boolean }[] = [
  { id: "director", estado: "trabajando", texto: "Revisando tu meta", principal: true },
  { id: "marca", estado: "normal", texto: "Lista" },
  { id: "estratega", estado: "trabajando", texto: "2 conceptos nuevos" },
  { id: "creativo", estado: "normal", texto: "Listo" },
  { id: "publicador", estado: "esperando", texto: "Te necesita" },
  { id: "analista", estado: "trabajando", texto: "Leyendo resultados" },
  { id: "optimizador", estado: "pausa", texto: "En pausa" },
];

function Fila() {
  return (
    <div className={styles.fila}>
      {FILA.map((f) => {
        const a = EQUIPO.find((x) => x.id === f.id)!;
        return (
          <div key={f.id} className={styles.mini}>
            <span style={{ display: "block", marginTop: f.principal ? 0 : 10 }}>
              <EsferaAsistente asistente={f.id} estado={f.estado} tamano={f.principal ? 78 : 58} />
            </span>
            <b>{a.corto}</b>
            <span>{f.texto}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminEsferasClient() {
  const router = useRouter();

  return (
    <ProveedorEsferas>
      <div className={styles.pagina}>
        <div className={styles.wrap}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#a3a0b3", fontSize: 14, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            ← Volver al panel principal
          </button>
          <h1>El equipo de Quiubot</h1>
          <p className={styles.sub}>
            Esferas de vidrio con anillo de neón y una gema de luz, la firma de Quiubot. Sus ojos te siguen con el dedo
            o el cursor, parpadean a su propio ritmo, miran alrededor cuando estás quieto y se alegran si los tocas.
          </p>

          <div className={styles.grid}>
            {EQUIPO.map((a) => (
              <div key={a.id} className={styles.card}>
                <EsferaAsistente asistente={a.id} estado="normal" />
                <p className={styles.nombre}>{a.nombre}</p>
                <p className={styles.rol}>{a.rol}</p>
              </div>
            ))}
          </div>

          <h2>Cómo se expresan</h2>
          <div className={styles.grid}>
            {ESTADOS_DEMO.map((e) => (
              <div key={e.id} className={styles.card}>
                <EsferaAsistente asistente={e.id} estado={e.estado} />
                <p className={styles.nombre}>{e.titulo}</p>
                <p className={styles.rol}>{e.detalle}</p>
                <span className={`${styles.badge} ${styles[e.badge]}`}>{e.etiqueta}</span>
              </div>
            ))}
          </div>

          <h2>Así se vería el equipo en el inicio</h2>
          <div className={styles.equipo}>
            <Fila />
            <p className={styles.nota}>Toca cualquier esfera: salta y sonríe.</p>
          </div>

          <h2>Sobre fondo claro, como en la app hoy</h2>
          <div className={`${styles.equipo} ${styles.equipoClaro}`}>
            <Fila />
          </div>
        </div>
      </div>
    </ProveedorEsferas>
  );
}

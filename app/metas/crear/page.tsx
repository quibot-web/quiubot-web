"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Target, ShoppingCart, Calendar, Wallet, Clock } from "lucide-react";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import { hoyBogota } from "@/app/lib/fechaBogota";
import type { TipoMeta } from "@/app/lib/metas";

const DIAS_MINIMOS = 14;
const ROAS_MINIMO_SUGERIDO = "2";

type SaludPixel = { conectado: boolean; ultimo_disparo: string | null; compras_7d: number; compras_con_valor: boolean | null };

type Previsualizacion = {
  costoObjetivoCop: number;
  costoReferencia: { valorCop: number; fuente: "tu_historial" | "promedio_quiubot" | "referencia_admin" };
  realista: boolean;
  cantidadRealista: number;
  presupuestoRealista: number;
};

const FUENTE_LABEL: Record<Previsualizacion["costoReferencia"]["fuente"], string> = {
  tu_historial: "Basado en tu propio historial",
  promedio_quiubot: "Basado en el promedio de clientes de Quiubot",
  referencia_admin: "Valor de referencia",
};

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function fechaMinima(): string {
  const d = new Date(`${hoyBogota()}T00:00:00-05:00`);
  d.setDate(d.getDate() + DIAS_MINIMOS);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export default function CrearMetaPage() {
  const router = useRouter();
  const [puedeUsarAutopiloto, setPuedeUsarAutopiloto] = useState<boolean | null>(null);
  const [saludPixel, setSaludPixel] = useState<SaludPixel | null>(null);
  const [tiposYaActivos, setTiposYaActivos] = useState<Set<TipoMeta>>(new Set());

  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoMeta | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [roasMinimo, setRoasMinimo] = useState(ROAS_MINIMO_SUGERIDO);

  const [previsualizacion, setPrevisualizacion] = useState<Previsualizacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => setPuedeUsarAutopiloto(!!data.tieneAutopiloto))
      .catch(() => setPuedeUsarAutopiloto(false));
    // Si el pixel no está conectado o no ha visto compras en los
    // últimos 7 días, "Ventas en tu sitio web" se muestra pero
    // deshabilitada con la explicación -- nunca se oculta del todo,
    // para que el cliente entienda qué le falta en vez de preguntarse
    // por qué no está esa opción.
    fetch("/api/meta/pixel/salud")
      .then((r) => r.json())
      .then((data) => setSaludPixel(data))
      .catch(() => setSaludPixel({ conectado: false, ultimo_disparo: null, compras_7d: 0, compras_con_valor: false }));
    // El asistente solo ofrece los tipos que el usuario no tiene
    // activos todavía -- el índice único (user_id, tipo) WHERE
    // estado='activa' los dejaría crear igual y fallar con un 409, esto
    // evita que lleguen hasta ahí.
    fetch("/api/metas")
      .then((r) => (r.ok ? r.json() : { metas: [] }))
      .then((data) => setTiposYaActivos(new Set((data.metas ?? []).map((it: any) => it.meta.tipo))))
      .catch(() => {});
  }, []);

  if (puedeUsarAutopiloto === null) {
    return <CargandoQuiubot mensaje="Verificando tu acceso" />;
  }

  if (puedeUsarAutopiloto === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Clock size={28} color="#534AB7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>
            Autopiloto — Próximamente
          </h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
            Todavía estamos puliendo Autopiloto. Muy pronto lo abrimos para todos.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}
          >
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  const cantidadNum = Number(cantidad);
  const presupuestoNum = Number(presupuesto);
  const roasMinimoValido = tipo !== "ventas_web" || (Number.isFinite(Number(roasMinimo)) && Number(roasMinimo) > 0);

  async function pedirPrevisualizacion() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metas/previsualizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cantidad_objetivo: cantidadNum, presupuesto_maximo_cop: presupuestoNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo revisar la meta.");
      setPrevisualizacion(data);
    } catch (err: any) {
      setError(err.message || "Algo salió mal.");
    } finally {
      setCargando(false);
    }
  }

  async function crearMeta(cantidadFinal: number, presupuestoFinal: number) {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          cantidad_objetivo: cantidadFinal,
          fecha_fin: fechaFin,
          presupuesto_maximo_cop: presupuestoFinal,
          roas_minimo: tipo === "ventas_web" ? Number(roasMinimo) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la meta.");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Algo salió mal.");
      setCargando(false);
    }
  }

  const estiloCard: React.CSSProperties = {
    maxWidth: 560,
    width: "100%",
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e8e8e6",
    padding: "2.5rem 2rem",
    boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
  };

  const estiloBotonPrimario: React.CSSProperties = {
    padding: "13px 24px",
    borderRadius: 10,
    background: "#534AB7",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  };

  const estiloBotonSecundario: React.CSSProperties = {
    padding: "13px 24px",
    borderRadius: 10,
    background: "#fff",
    color: "#534AB7",
    fontSize: 14,
    fontWeight: 700,
    border: "1px solid #534AB7",
    cursor: "pointer",
  };

  const estiloInput: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 15,
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={estiloCard}>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#534AB7", margin: "0 0 6px", letterSpacing: "0.02em" }}>
          Paso {paso} de 4
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 20px" }}>Crear meta de Autopiloto</h1>

        {error && (
          <div style={{ background: "#FEF0EF", color: "#B3261E", padding: "10px 14px", borderRadius: 10, fontSize: 13.5, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {paso === 1 && (
          <div>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 18px" }}>¿Qué quieres lograr?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
              {[
                { id: "conversaciones_whatsapp" as TipoMeta, icono: MessageCircle, label: "Conversaciones de WhatsApp" },
                { id: "leads" as TipoMeta, icono: Target, label: "Leads (contactos)" },
                { id: "ventas_web" as TipoMeta, icono: ShoppingCart, label: "Ventas en tu sitio web" },
              ].map(({ id, icono: Icono, label }) => {
                const yaActivo = tiposYaActivos.has(id);
                const pixelOk = saludPixel?.conectado && saludPixel.compras_7d > 0;
                const habilitada = !yaActivo && (id !== "ventas_web" || pixelOk);
                const motivo = yaActivo
                  ? "Ya tienes una meta activa de este tipo."
                  : id === "ventas_web" && saludPixel && !pixelOk
                    ? !saludPixel.conectado
                      ? "Conecta tu pixel de Meta en Integraciones."
                      : "Tu pixel no ha recibido compras en los últimos 7 días."
                    : null;
                return (
                  <div key={id}>
                    <button
                      disabled={!habilitada}
                      onClick={() => habilitada && setTipo(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, width: "100%",
                        border: tipo === id ? "2px solid #534AB7" : "1px solid #ddd",
                        background: tipo === id ? "#F3F2FE" : habilitada ? "#fff" : "#f5f5f4",
                        cursor: habilitada ? "pointer" : "not-allowed",
                        opacity: habilitada ? 1 : 0.6,
                        textAlign: "left",
                      }}
                    >
                      <Icono size={20} color="#534AB7" />
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{label}</span>
                    </button>
                    {motivo && <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0 4px" }}>{motivo}</p>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: 14 }} />
            <button style={estiloBotonPrimario} disabled={!tipo} onClick={() => setPaso(2)}>
              Continuar →
            </button>
          </div>
        )}

        {paso === 2 && (
          <div>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 18px" }}>¿Cuántas quieres conseguir?</p>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 40"
              style={{ ...estiloInput, marginBottom: 24 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={estiloBotonSecundario} onClick={() => setPaso(1)}>← Atrás</button>
              <button style={estiloBotonPrimario} disabled={!cantidadNum || cantidadNum <= 0} onClick={() => setPaso(3)}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 10px" }}>¿En cuánto tiempo? (mínimo {DIAS_MINIMOS} días)</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <Calendar size={18} color="#534AB7" />
              <input
                type="date"
                min={fechaMinima()}
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={estiloInput}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={estiloBotonSecundario} onClick={() => setPaso(2)}>← Atrás</button>
              <button style={estiloBotonPrimario} disabled={!fechaFin || fechaFin < fechaMinima()} onClick={() => setPaso(4)}>
                Continuar →
              </button>
            </div>
          </div>
        )}

        {paso === 4 && !previsualizacion && (
          <div>
            <p style={{ fontSize: 14, color: "#666", margin: "0 0 18px" }}>¿Cuál es tu presupuesto máximo?</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <Wallet size={18} color="#534AB7" />
              <input
                type="number"
                min={1}
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                placeholder="Ej: 1500000"
                style={estiloInput}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={estiloBotonSecundario} onClick={() => setPaso(3)}>← Atrás</button>
              <button
                style={estiloBotonPrimario}
                disabled={!presupuestoNum || presupuestoNum <= 0 || cargando}
                onClick={pedirPrevisualizacion}
              >
                {cargando ? "Revisando..." : "Revisar meta →"}
              </button>
            </div>
          </div>
        )}

        {paso === 4 && previsualizacion && (
          <div>
            {tipo === "ventas_web" && (
              <div style={{ background: "#F9F8FD", border: "1px solid #E4E1F7", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>
                  ¿Cuánto debe devolverte cada peso invertido para que te sirva?
                </p>
                <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 10px", lineHeight: 1.5 }}>
                  Es tu retorno mínimo (ROAS): si inviertes $1.000 y pides 2, significa que esperas al menos $2.000 en ventas por cada $1.000 gastados en anuncios. Si tu venta promedio ya tiene buen margen, 2 es un punto de partida razonable.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={roasMinimo}
                    onChange={(e) => setRoasMinimo(e.target.value)}
                    style={{ ...estiloInput, width: 90 }}
                  />
                  <span style={{ fontSize: 13.5, color: "#666" }}>veces lo invertido</span>
                </div>
              </div>
            )}
            {previsualizacion.realista ? (
              <>
                <p style={{ fontSize: 14, color: "#1a1a1a", margin: "0 0 8px" }}>
                  Con {formatoCop(presupuestoNum)} para {cantidadNum} resultados, el costo objetivo es{" "}
                  {formatoCop(previsualizacion.costoObjetivoCop)} por resultado.
                </p>
                <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 24px" }}>
                  {FUENTE_LABEL[previsualizacion.costoReferencia.fuente]}: {formatoCop(previsualizacion.costoReferencia.valorCop)} por resultado.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={estiloBotonSecundario} onClick={() => setPrevisualizacion(null)}>← Atrás</button>
                  <button
                    style={estiloBotonPrimario}
                    disabled={cargando || !roasMinimoValido}
                    onClick={() => crearMeta(cantidadNum, presupuestoNum)}
                  >
                    {cargando ? "Creando..." : "Crear meta"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: "#1a1a1a", margin: "0 0 8px", fontWeight: 600 }}>
                  Con este presupuesto lo realista son ~{previsualizacion.cantidadRealista}, no {cantidadNum}.
                </p>
                <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 24px" }}>
                  {FUENTE_LABEL[previsualizacion.costoReferencia.fuente]}: {formatoCop(previsualizacion.costoReferencia.valorCop)} por resultado.
                  ¿Ajustamos la meta o el presupuesto?
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    style={estiloBotonPrimario}
                    disabled={cargando || !roasMinimoValido}
                    onClick={() => crearMeta(previsualizacion.cantidadRealista, presupuestoNum)}
                  >
                    Ajustar meta a ~{previsualizacion.cantidadRealista}
                  </button>
                  <button
                    style={estiloBotonPrimario}
                    disabled={cargando || !roasMinimoValido}
                    onClick={() => crearMeta(cantidadNum, previsualizacion.presupuestoRealista)}
                  >
                    Ajustar presupuesto a {formatoCop(previsualizacion.presupuestoRealista)}
                  </button>
                  <button
                    style={estiloBotonSecundario}
                    disabled={cargando || !roasMinimoValido}
                    onClick={() => crearMeta(cantidadNum, presupuestoNum)}
                  >
                    Crear igual
                  </button>
                  <button style={{ ...estiloBotonSecundario, border: "none", color: "#888" }} onClick={() => setPrevisualizacion(null)}>
                    ← Atrás
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

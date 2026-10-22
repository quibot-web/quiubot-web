"use client";
import { useEffect, useState } from "react";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId, EstadoEsfera } from "@/app/components/esferas/esferasShared";

const EQUIPO: { id: AsistenteId; corto: string; principal?: boolean }[] = [
  { id: "director", corto: "Director", principal: true },
  { id: "marca", corto: "Marca" },
  { id: "estratega", corto: "Estratega" },
  { id: "creativo", corto: "Creativo" },
  { id: "publicador", corto: "Publicador" },
  { id: "analista", corto: "Analista" },
  { id: "optimizador", corto: "Optimizador" },
];

// Bloque "equipo" del Inicio -- mismo diseño de tarjeta oscura que la
// sección "Así se vería el equipo en el inicio" de esferas_v3.html (el
// brillo de las esferas se pierde sobre blanco). Admin-only, igual que
// TarjetaMeta: si /api/metas no responde 200 (no-admin), no renderiza
// nada. El estado por asistente todavía es solo pausa/normal -- la
// bandeja de decisiones (próximo paso) traerá "esperando" real por
// propuestas pendientes de cada uno.
export default function TarjetaEquipo() {
  const [cargando, setCargando] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    fetch("/api/metas")
      .then((r) => {
        if (!r.ok) throw new Error();
        setVisible(true);
        return r.json();
      })
      .then((data) => setPausado(!!data.meta?.pausado_autopiloto))
      .catch(() => setVisible(false))
      .finally(() => setCargando(false));
  }, []);

  if (cargando || !visible) return null;

  const estado: EstadoEsfera = pausado ? "pausa" : "normal";

  return (
    <div style={{ background: "#17151f", border: "1px solid #26232f", borderRadius: 18, padding: "18px 18px 22px" }}>
      <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px", color: "#f2f1f7" }}>Mi equipo</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 2px", alignItems: "flex-start" }}>
        {EQUIPO.map((a) => (
          <div key={a.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 90, fontSize: 12, textAlign: "center" }}>
            <span style={{ display: "block", marginTop: a.principal ? 0 : 10 }}>
              <EsferaAsistente asistente={a.id} estado={estado} tamano={a.principal ? 78 : 58} />
            </span>
            <b style={{ fontWeight: 600, marginTop: 2, color: "#f2f1f7" }}>{a.corto}</b>
            <span style={{ color: "#a3a0b3" }}>{pausado ? "En pausa" : "Activo"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

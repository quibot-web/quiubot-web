"use client";
import { useEffect, useState } from "react";
import FilaMeta from "@/app/components/FilaMeta";
import type { AvanceMeta, Meta } from "@/app/lib/metas";

// La meta en el hilo del Director nunca guarda su propio texto/números
// fijos -- solo el metaId (ver contenido.metaId en
// app/lib/director/flujoCrearMeta.ts). Esta tarjeta trae el estado
// actual de /api/metas/[id] (la misma ruta y el mismo cálculo de
// avance que usan /metas y el Home) y reusa FilaMeta tal cual -- mismo
// componente, mismos botones de pausar/cancelar, en vez de duplicar
// ninguno de los dos.
export default function TarjetaMetaViva({ metaId }: { metaId: string }) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "error">("cargando");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [avance, setAvance] = useState<AvanceMeta | null>(null);

  function cargar() {
    fetch(`/api/metas/${metaId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.meta) throw new Error();
        setMeta(data.meta);
        setAvance(data.avance ?? null);
        setEstado("lista");
      })
      .catch(() => setEstado("error"));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaId]);

  if (estado === "cargando") {
    return (
      <div style={{ alignSelf: "flex-start", width: "min(300px, 100%)", marginLeft: 34, background: "#fff", border: "1.5px solid #E9E7EE", borderRadius: 16, padding: 16, fontSize: 12.5, color: "#999" }}>
        Cargando tu meta...
      </div>
    );
  }

  if (estado === "error" || !meta) {
    return (
      <div style={{ alignSelf: "flex-start", width: "min(300px, 100%)", marginLeft: 34, background: "#FEF0EF", border: "1px solid #F3C6C2", borderRadius: 16, padding: 16, fontSize: 12.5, color: "#B3261E" }}>
        No pude cargar esta meta en este momento.
      </div>
    );
  }

  return (
    <div style={{ alignSelf: "flex-start", width: "min(300px, 100%)", marginLeft: 34, background: "#fff", border: "1.5px solid #E9E7EE", borderRadius: 16, padding: 14 }}>
      <FilaMeta meta={meta} avance={avance} compacta onCambio={(metaActualizada) => setMeta(metaActualizada)} />
    </div>
  );
}

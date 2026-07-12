"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const STORAGE_KEY = "quiubot_job_creativos_activo";

export default function JobFlotante() {
  const router = useRouter();
  const pathname = usePathname();
  const [jobId, setJobId] = useState<string | null>(null);
  const pollingRef = useRef(false);

  // Al montar (en cualquier página), revisa si hay un job pendiente guardado
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado) setJobId(guardado);
  }, []);

  // También revisa cada vez que cambias de página, por si otro componente
  // (como /estrategia) acaba de guardar o borrar el job activo
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    setJobId(guardado);
  }, [pathname]);

  useEffect(() => {
    if (!jobId || pollingRef.current) return;
    pollingRef.current = true;

    const inicio = Date.now();
    const intervalo = setInterval(async () => {
      if (Date.now() - inicio > 10 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        setJobId(null);
        clearInterval(intervalo);
        pollingRef.current = false;
        return;
      }
      try {
        const res = await fetch(`/api/creativos-jobs/${jobId}`);
        const data = await res.json();
        if (data.estado === "listo" || data.estado === "error") {
          localStorage.removeItem(STORAGE_KEY);
          setJobId(null);
          clearInterval(intervalo);
          pollingRef.current = false;
        }
      } catch {
        // si falla la consulta puntual, simplemente reintenta en el próximo ciclo
      }
    }, 5000);

    return () => {
      clearInterval(intervalo);
      pollingRef.current = false;
    };
  }, [jobId]);

  // No mostrar el flotante si ya estás parado justo en la pantalla que retoma el job
  // (ahí ya ves el spinner grande, sería redundante)
  if (!jobId || pathname === "/estrategia") return null;

  return (
    <div
      onClick={() => router.push(`/estrategia?job=${jobId}`)}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "#534AB7",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 30,
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        boxShadow: "0 6px 20px rgba(83,74,183,0.35)",
        zIndex: 999,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          border: "2px solid rgba(255,255,255,0.4)",
          borderTop: "2px solid #fff",
          borderRadius: "50%",
          animation: "spin-flotante 1s linear infinite",
          flexShrink: 0,
        }}
      />
      Generando tus creativos... ver progreso
      <style>{`@keyframes spin-flotante { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
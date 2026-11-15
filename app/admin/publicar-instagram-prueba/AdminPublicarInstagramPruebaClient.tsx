"use client";
import { useEffect, useState } from "react";

// Solo diagnóstico -- publicar en sí ya es una función real para
// cualquier usuario (botón "Publicar en Instagram" en el panel de
// detalle de /album), no algo que se prueba solo acá. Esta pantalla se
// queda solo-admin porque expone el META_CONFIG_ID y la comparación
// cruda de campos/tokens que no tiene sentido mostrarle a un cliente.
type ProbeCampos = { instagram_business_account: string | null; connected_instagram_account: string | null; error: string | null };

type ResolucionCuenta =
  | { encontrada: true; igUserId: string; username: string | null; campo: string; tokenUsado: "usuario" | "pagina" }
  | { encontrada: false }
  | { tokenVencido: true };

type DiagnosticoCuenta = {
  pageId: string;
  conTokenUsuario: ProbeCampos;
  conTokenPagina: ProbeCampos | null;
  resolucion: ResolucionCuenta;
};

type Diagnostico = {
  meta_config_id: string | null;
  permisos: { permission: string; status: string }[];
  instagram: { conectado: boolean; igUserId: string | null; username: string | null; account_type: string | null } | null;
  diagnostico_cuenta?: DiagnosticoCuenta | null;
  error?: string;
};

export default function AdminPublicarInstagramPruebaClient() {
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [cargandoDiagnostico, setCargandoDiagnostico] = useState(true);

  async function cargarDiagnostico() {
    setCargandoDiagnostico(true);
    try {
      const res = await fetch("/api/admin/publicar-instagram-prueba");
      const data = await res.json();
      setDiagnostico(res.ok ? data : { meta_config_id: null, permisos: [], instagram: null, error: data.error });
    } catch {
      setDiagnostico({ meta_config_id: null, permisos: [], instagram: null, error: "No se pudo conectar con el servidor." });
    } finally {
      setCargandoDiagnostico(false);
    }
  }

  useEffect(() => {
    (async () => {
      await cargarDiagnostico();
    })();
  }, []);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#17152B", marginBottom: 4 }}>
        Diagnóstico de Instagram (solo admin)
      </h1>
      <p style={{ fontSize: 13, color: "#999", marginBottom: 28 }}>
        Revisa qué permisos tiene el token guardado y qué cuenta de Instagram resuelve la página
        conectada. Para publicar un reel de verdad, usa el botón &ldquo;Publicar en Instagram&rdquo; en el
        panel de detalle de cualquier video en <a href="/album" style={{ color: "#534AB7" }}>/album</a>.
      </p>

      <div style={{ border: "1px solid #e8e8e6", borderRadius: 10, padding: 14, background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#534AB7" }}>Diagnóstico de la conexión</span>
          <button
            type="button"
            onClick={cargarDiagnostico}
            disabled={cargandoDiagnostico}
            style={{ fontSize: 11, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {cargandoDiagnostico ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {cargandoDiagnostico && !diagnostico && <p style={{ fontSize: 12, color: "#666" }}>Cargando diagnóstico...</p>}

        {diagnostico && (
          <div style={{ fontSize: 12, color: "#333", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 6px" }}>
              <strong>META_CONFIG_ID de este ambiente:</strong> {diagnostico.meta_config_id || "no configurado"}
            </p>

            {diagnostico.error && <p style={{ color: "#b91c1c", margin: "0 0 6px" }}>{diagnostico.error}</p>}

            <p style={{ margin: "0 0 6px" }}>
              <strong>Cuenta de Instagram vinculada:</strong>{" "}
              {diagnostico.instagram?.conectado
                ? `@${diagnostico.instagram.username} · id ${diagnostico.instagram.igUserId}${diagnostico.instagram.account_type ? ` (${diagnostico.instagram.account_type})` : ""}`
                : "no conectada"}
            </p>

            {diagnostico.diagnostico_cuenta && (
              <div style={{ marginTop: 10, marginBottom: 10 }}>
                <strong>page_id activo:</strong> {diagnostico.diagnostico_cuenta.pageId}
                <table style={{ width: "100%", marginTop: 6, borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                      <th style={{ padding: "4px 6px" }}>Campo</th>
                      <th style={{ padding: "4px 6px" }}>Con token de usuario</th>
                      <th style={{ padding: "4px 6px" }}>Con token de la página</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 6px" }}>instagram_business_account</td>
                      <td style={{ padding: "4px 6px" }}>{diagnostico.diagnostico_cuenta.conTokenUsuario.instagram_business_account || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>{diagnostico.diagnostico_cuenta.conTokenPagina?.instagram_business_account || "—"}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 6px" }}>connected_instagram_account</td>
                      <td style={{ padding: "4px 6px" }}>{diagnostico.diagnostico_cuenta.conTokenUsuario.connected_instagram_account || "—"}</td>
                      <td style={{ padding: "4px 6px" }}>{diagnostico.diagnostico_cuenta.conTokenPagina?.connected_instagram_account || "—"}</td>
                    </tr>
                  </tbody>
                </table>
                {diagnostico.diagnostico_cuenta.conTokenUsuario.error && (
                  <p style={{ color: "#b91c1c", margin: "6px 0 0" }}>
                    Error con token de usuario: {diagnostico.diagnostico_cuenta.conTokenUsuario.error}
                  </p>
                )}
                {diagnostico.diagnostico_cuenta.conTokenPagina?.error && (
                  <p style={{ color: "#b91c1c", margin: "6px 0 0" }}>
                    Error con token de la página: {diagnostico.diagnostico_cuenta.conTokenPagina.error}
                  </p>
                )}
                <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
                  {"encontrada" in diagnostico.diagnostico_cuenta.resolucion && diagnostico.diagnostico_cuenta.resolucion.encontrada
                    ? `Id a usar para publicar: ${diagnostico.diagnostico_cuenta.resolucion.igUserId} (campo ${diagnostico.diagnostico_cuenta.resolucion.campo}, token de ${diagnostico.diagnostico_cuenta.resolucion.tokenUsado})`
                    : "tokenVencido" in diagnostico.diagnostico_cuenta.resolucion && diagnostico.diagnostico_cuenta.resolucion.tokenVencido
                      ? "El token de Meta venció -- reconecta."
                      : "Ningún campo trajo un id todavía -- revisa la tabla de arriba."}
                </p>
              </div>
            )}

            {diagnostico.permisos.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong>Permisos del token guardado (/me/permissions, nunca se muestra el token):</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {diagnostico.permisos.map((p) => (
                    <li key={p.permission} style={{ color: p.status === "granted" ? "#0F7A3C" : "#b91c1c" }}>
                      {p.permission}: {p.status === "granted" ? "concedido" : p.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

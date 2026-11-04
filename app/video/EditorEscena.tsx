"use client";

import { TRATAMIENTOS_MEDIA, type Escena, type TratamientoMedia } from "@/video/guion.schema";

type PiezaElegida = { id: string; url_imagen: string; tipo: string };

const estiloCampo: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
  marginBottom: 8,
  fontFamily: "inherit",
};
const estiloLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 3 };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={estiloLabel}>{label}</label>
      {children}
    </div>
  );
}

export default function EditorEscena({
  escena,
  piezas,
  tieneTextoPieza,
  onCambiar,
  onElegirPieza,
}: {
  escena: Escena;
  piezas: PiezaElegida[];
  // Si la pieza asignada a ESTA escena tiene texto (lo calcula la página,
  // que es quien tiene el análisis) -- limita las opciones de
  // tratamiento a tarjeta/celular, igual que el zod.
  tieneTextoPieza?: boolean;
  onCambiar: (nueva: Escena) => void;
  onElegirPieza: () => void;
}) {
  // Merge superficial de params -- cada caso de abajo conoce su propio
  // tipo de params, así que el "as any" queda acotado a esta única línea
  // compartida en vez de repetirse en cada campo.
  function cambiarParams(parcial: Record<string, unknown>) {
    onCambiar({ ...escena, params: { ...escena.params, ...parcial } } as Escena);
  }
  function cambiarDuracion(valor: number) {
    onCambiar({ ...escena, duracion_s: valor } as Escena);
  }
  function cambiarSubtitulo(campo: "texto" | "palabra_clave", valor: string) {
    const actual = escena.subtitulo || { texto: "", palabra_clave: "" };
    onCambiar({ ...escena, subtitulo: { ...actual, [campo]: valor } } as Escena);
  }

  const piezaElegida = (id: string | undefined) => piezas.find((p) => p.id === id);

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 12, marginBottom: 10, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase" }}>
          {escena.id} · {escena.tipo}
        </span>
        <Campo label="">
          <input
            type="number"
            step={0.1}
            min={1.5}
            max={5}
            value={escena.duracion_s}
            onChange={(e) => cambiarDuracion(Number(e.target.value))}
            style={{ width: 70, padding: "4px 6px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12 }}
            aria-label="Duración en segundos"
          />
          <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>s</span>
        </Campo>
      </div>

      {escena.tipo === "gancho_texto" && (
        <>
          <Campo label="Texto">
            <input style={estiloCampo} maxLength={60} value={escena.params.texto} onChange={(e) => cambiarParams({ texto: e.target.value })} />
          </Campo>
          <Campo label="Palabra clave">
            <input
              style={estiloCampo}
              maxLength={30}
              value={escena.params.palabra_clave}
              onChange={(e) => cambiarParams({ palabra_clave: e.target.value })}
            />
          </Campo>
          {escena.params.media_id && (
            <>
              <BotonPieza pieza={piezaElegida(escena.params.media_id)} onClick={onElegirPieza} />
              <SelectorTratamiento
                valor={escena.params.tratamiento}
                tieneTexto={tieneTextoPieza}
                onCambiar={(t) => cambiarParams({ tratamiento: t })}
              />
            </>
          )}
        </>
      )}

      {escena.tipo === "problema_dato" && escena.params.variante === "pregunta" && (
        <Campo label="Pregunta">
          <input style={estiloCampo} maxLength={60} value={escena.params.pregunta || ""} onChange={(e) => cambiarParams({ pregunta: e.target.value })} />
        </Campo>
      )}
      {escena.tipo === "problema_dato" && escena.params.variante !== "pregunta" && (
        <>
          <Campo label="Título">
            <input style={estiloCampo} maxLength={50} value={escena.params.titulo || ""} onChange={(e) => cambiarParams({ titulo: e.target.value })} />
          </Campo>
          <Campo label="Etiqueta">
            <input style={estiloCampo} maxLength={30} value={escena.params.etiqueta || ""} onChange={(e) => cambiarParams({ etiqueta: e.target.value })} />
          </Campo>
        </>
      )}

      {escena.tipo === "producto_hero" && (
        <>
          <Campo label="Nombre">
            <input style={estiloCampo} maxLength={40} value={escena.params.nombre} onChange={(e) => cambiarParams({ nombre: e.target.value })} />
          </Campo>
          <BotonPieza pieza={piezaElegida(escena.params.media_id)} onClick={onElegirPieza} />
          <SelectorTratamiento
            valor={escena.params.tratamiento}
            tieneTexto={tieneTextoPieza}
            onCambiar={(t) => cambiarParams({ tratamiento: t })}
          />
          <Campo label="Subtítulo (única escena que lo muestra)">
            <input
              style={estiloCampo}
              maxLength={80}
              value={escena.subtitulo?.texto || ""}
              onChange={(e) => cambiarSubtitulo("texto", e.target.value)}
              placeholder="Texto del subtítulo"
            />
          </Campo>
          <Campo label="Palabra clave del subtítulo">
            <input
              style={estiloCampo}
              maxLength={30}
              value={escena.subtitulo?.palabra_clave || ""}
              onChange={(e) => cambiarSubtitulo("palabra_clave", e.target.value)}
            />
          </Campo>
        </>
      )}

      {(escena.tipo === "beneficios_lista" || escena.tipo === "lista_numerada") && (
        <>
          <Campo label="Título">
            <input
              style={estiloCampo}
              maxLength={45}
              value={escena.params.titulo || ""}
              onChange={(e) => cambiarParams({ titulo: e.target.value })}
            />
          </Campo>
          <Campo label={`Ítems (${escena.params.items.length})`}>
            {escena.params.items.map((item, i) => (
              <input
                key={i}
                style={estiloCampo}
                maxLength={escena.tipo === "lista_numerada" ? 40 : 36}
                value={item}
                onChange={(e) => {
                  const nuevos = [...escena.params.items];
                  nuevos[i] = e.target.value;
                  cambiarParams({ items: nuevos });
                }}
              />
            ))}
          </Campo>
        </>
      )}

      {escena.tipo === "revelacion_marca" && (
        <Campo label="Frase">
          <input style={estiloCampo} maxLength={50} value={escena.params.frase} onChange={(e) => cambiarParams({ frase: e.target.value })} />
        </Campo>
      )}

      {escena.tipo === "oferta_precio" && (
        <>
          <Campo label="Precio (ej. $89.900)">
            <input style={estiloCampo} value={escena.params.precio} onChange={(e) => cambiarParams({ precio: e.target.value })} />
          </Campo>
          <Campo label="Precio antes (opcional)">
            <input style={estiloCampo} value={escena.params.precio_antes || ""} onChange={(e) => cambiarParams({ precio_antes: e.target.value })} />
          </Campo>
          <Campo label="Nota">
            <input style={estiloCampo} maxLength={30} value={escena.params.nota || ""} onChange={(e) => cambiarParams({ nota: e.target.value })} />
          </Campo>
        </>
      )}

      {escena.tipo === "objecion_respuesta" && (
        <>
          <Campo label="Objeción">
            <input style={estiloCampo} maxLength={40} value={escena.params.objecion} onChange={(e) => cambiarParams({ objecion: e.target.value })} />
          </Campo>
          <Campo label="Respuesta">
            <input style={estiloCampo} maxLength={40} value={escena.params.respuesta} onChange={(e) => cambiarParams({ respuesta: e.target.value })} />
          </Campo>
        </>
      )}

      {escena.tipo === "cta" && (
        <>
          <span style={{ fontSize: 11, color: "#888" }}>accion: {escena.params.accion} (la fija la receta del objetivo)</span>
          <Campo label="Texto del botón">
            <input
              style={estiloCampo}
              maxLength={28}
              value={escena.params.texto_boton}
              onChange={(e) => cambiarParams({ texto_boton: e.target.value })}
            />
          </Campo>
          {escena.params.accion === "whatsapp" && (
            <Campo label="Mensajes (hasta 3)">
              {(escena.params.mensajes || []).map((m, i) => (
                <input
                  key={i}
                  style={estiloCampo}
                  maxLength={32}
                  value={m}
                  onChange={(e) => {
                    const nuevos = [...(escena.params.mensajes || [])];
                    nuevos[i] = e.target.value;
                    cambiarParams({ mensajes: nuevos });
                  }}
                />
              ))}
            </Campo>
          )}
          {escena.params.accion === "seguir" && (
            <Campo label="@usuario">
              <input style={estiloCampo} value={escena.params.usuario || ""} onChange={(e) => cambiarParams({ usuario: e.target.value })} />
            </Campo>
          )}
          <Campo label="Subtexto">
            <input style={estiloCampo} maxLength={40} value={escena.params.subtexto || ""} onChange={(e) => cambiarParams({ subtexto: e.target.value })} />
          </Campo>
        </>
      )}
    </div>
  );
}

const ETIQUETA_TRATAMIENTO: Record<TratamientoMedia, string> = {
  tarjeta: "Tarjeta flotante",
  celular: "Dentro de un celular",
  completa: "Pantalla completa",
};

// Mismos colores que el badge del selector de piezas en page.tsx --
// "sin analizar" (undefined) no bloquea "completa" aquí en la UI (el
// zod sí la bloquea igual, ver guion.schema.ts: nunca "completa" sin un
// análisis que confirme tiene_texto: false), pero avisa que el dato es
// una suposición, no un análisis real.
function EtiquetaAnalisis({ tieneTexto }: { tieneTexto: boolean | undefined }) {
  if (tieneTexto === undefined) {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: "#e5e5e5", color: "#555" }}>
        sin analizar
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 999,
        background: tieneTexto ? "#fef3c7" : "#dcfce7",
        color: tieneTexto ? "#92400e" : "#166534",
      }}
    >
      {tieneTexto ? "con texto" : "foto limpia"}
    </span>
  );
}

// Si la pieza tiene texto (o no se pudo analizar), "completa" ni se
// ofrece -- el zod la rechaza igual, pero mejor no dejar elegir una
// opción que el servidor va a tumbar.
function SelectorTratamiento({
  valor,
  tieneTexto,
  onCambiar,
}: {
  valor: TratamientoMedia | undefined;
  tieneTexto: boolean | undefined;
  onCambiar: (t: TratamientoMedia) => void;
}) {
  const opciones = tieneTexto === false ? TRATAMIENTOS_MEDIA : TRATAMIENTOS_MEDIA.filter((t) => t !== "completa");
  return (
    <Campo label="Tratamiento de la imagen">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <EtiquetaAnalisis tieneTexto={tieneTexto} />
        <span style={{ fontSize: 11, color: "#666" }}>Quedó: {valor ? ETIQUETA_TRATAMIENTO[valor] : "sin elegir"}</span>
      </div>
      <select style={estiloCampo} value={valor || ""} onChange={(e) => onCambiar(e.target.value as TratamientoMedia)}>
        <option value="" disabled>
          Elige un tratamiento
        </option>
        {opciones.map((t) => (
          <option key={t} value={t}>
            {ETIQUETA_TRATAMIENTO[t]}
          </option>
        ))}
      </select>
      {tieneTexto !== false && (
        <span style={{ fontSize: 11, color: "#92400e" }}>
          {tieneTexto ? "Esta pieza tiene texto" : "Esta pieza no tiene análisis confirmado"} -- no se puede recortar a pantalla completa.
        </span>
      )}
    </Campo>
  );
}

function BotonPieza({ pieza, onClick }: { pieza: PiezaElegida | undefined; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      {pieza && (
        <img
          src={pieza.url_imagen}
          alt=""
          style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: "1px solid #ddd" }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, border: "1px solid #534AB7", background: "#F3F2FE", color: "#534AB7", cursor: "pointer" }}
      >
        Cambiar pieza del álbum
      </button>
    </div>
  );
}

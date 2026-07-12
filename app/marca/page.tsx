"use client";
import { useState, useEffect, useRef } from "react";

const COLORES_PRESET = [
  { nombre: "Rojo", hex: "#e63946" },
  { nombre: "Rosa", hex: "#f72585" },
  { nombre: "Naranja", hex: "#f4a261" },
  { nombre: "Amarillo", hex: "#ffd60a" },
  { nombre: "Verde", hex: "#2dc653" },
  { nombre: "Verde oscuro", hex: "#1b4332" },
  { nombre: "Azul", hex: "#4361ee" },
  { nombre: "Azul marino", hex: "#1a2b6d" },
  { nombre: "Celeste", hex: "#48cae4" },
  { nombre: "Morado", hex: "#7F77DD" },
  { nombre: "Violeta", hex: "#9d4edd" },
  { nombre: "Dorado", hex: "#c9a84c" },
  { nombre: "Café", hex: "#8B5E3C" },
  { nombre: "Negro", hex: "#1a1a1a" },
  { nombre: "Gris", hex: "#6c757d" },
  { nombre: "Blanco", hex: "#ffffff" },
];

function IconoGlobo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconoWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#fff"
        d="M23.47 8.52A9.86 9.86 0 0 0 16.06 5.5c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L6 25.5l5.28-1.39a9.9 9.9 0 0 0 4.78 1.22h.01c5.46 0 9.9-4.44 9.9-9.9a9.85 9.85 0 0 0-2.5-6.91zm-7.41 15.24h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.55 3.7-8.25 8.26-8.25a8.2 8.2 0 0 1 5.84 2.42 8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.25-8.27 8.25zm4.53-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31s-.87.85-.87 2.08.89 2.41 1.01 2.58c.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z"
      />
    </svg>
  );
}

const pasos = [
  { id: "nombre_marca", titulo: "¿Cuál es el nombre de tu marca?", descripcion: "El nombre oficial con el que tus clientes te conocen.", placeholder: "Ej: Café del Valle", tipo: "texto" },
  { id: "slogan", titulo: "¿Tienes un slogan o frase de marca?", descripcion: "Si no tienes uno, puedes dejarlo en blanco.", placeholder: "Ej: El sabor que te despierta", tipo: "texto" },
  { id: "sector", titulo: "¿En qué sector o industria opera tu marca?", descripcion: "Cuéntanos a qué se dedica tu empresa.", placeholder: "Ej: Alimentos y bebidas, moda, tecnología, salud...", tipo: "texto" },
  { id: "productos", titulo: "¿Qué productos o servicios vendes?", descripcion: "Descríbelos con detalle — esto ayuda a generar imágenes más precisas.", placeholder: "Ej: Café de origen colombiano, tamales artesanales, postres sin azúcar...", tipo: "textarea" },
  { id: "publico_objetivo", titulo: "¿Quién es tu cliente ideal?", descripcion: "Edad, género, intereses, ubicación — todo ayuda.", placeholder: "Ej: Mujeres de 25 a 40 años, profesionales, amantes del bienestar...", tipo: "textarea" },
  { id: "destino_venta", titulo: "¿A dónde quieres llevar a tus clientes?", descripcion: "Este es el destino al que llegará la gente cuando toque tus anuncios.", placeholder: "", tipo: "destino" },
  { id: "tono", titulo: "¿Cuál es el tono de comunicación de tu marca?", descripcion: "¿Cómo quieres que se sienta tu marca en las imágenes?", placeholder: "", tipo: "opciones", opciones: ["Elegante y sofisticado", "Fresco y juvenil", "Divertido y creativo", "Profesional y serio", "Natural y orgánico", "Minimalista y moderno", "Cálido y familiar", "Otro (escríbelo)"] },
  { id: "colores", titulo: "¿Cuáles son los colores principales de tu marca?", descripcion: "Selecciona hasta 4 colores. También puedes escribir un código hex personalizado.", placeholder: "", tipo: "colores" },
  { id: "tipografias", titulo: "¿Qué tipografías usa tu marca?", descripcion: "Si no lo sabes, describe el estilo: moderna, serif clásica, manuscrita...", placeholder: "Ej: Montserrat para títulos, Lato para textos. O: tipografía elegante serif.", tipo: "texto" },
  { id: "logo_url", titulo: "¿Tienes el logo de tu marca en PNG?", descripcion: "Pega la URL directa de tu logo (debe terminar en .png, .jpg o .webp).", placeholder: "https://postimg.cc/xxxxxxx", tipo: "logo" },
  { id: "info_adicional", titulo: "¿Hay algo más que debamos saber de tu marca?", descripcion: "Valores, historia, diferenciadores, restricciones visuales — cualquier detalle cuenta.", placeholder: "Ej: Somos una empresa familiar fundada en 1990. No usamos imágenes con animales.", tipo: "textarea" },
];

export default function MarcaPage() {
  const [pasoActual, setPasoActual] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [tonoOtro, setTonoOtro] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [errorDestino, setErrorDestino] = useState(false);
  const [coloresSeleccionados, setColoresSeleccionados] = useState<string[]>([]);
  const [colorCustom, setColorCustom] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch("/api/marca")
      .then(r => r.json())
      .then(data => {
        if (data && data.nombre_marca) {
          setRespuestas(data);
          if (data.colores) {
            setColoresSeleccionados(data.colores.split(", ").filter(Boolean));
          }
          if (data.completado) setCompletado(true);
        }
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
    setLogoError(false);
    setErrorDestino(false);
  }, [pasoActual]);

  const paso = pasos[pasoActual];
  const progreso = Math.round(((pasoActual) / pasos.length) * 100);

  const toggleColor = (hex: string) => {
    setColoresSeleccionados(prev => {
      const existe = prev.includes(hex);
      const nuevos = existe ? prev.filter(c => c !== hex) : prev.length < 4 ? [...prev, hex] : prev;
      setRespuestas(r => ({ ...r, colores: nuevos.join(", ") }));
      return nuevos;
    });
  };

  const agregarColorCustom = () => {
    if (!colorCustom) return;
    const hex = colorCustom.startsWith("#") ? colorCustom : `#${colorCustom}`;
    if (coloresSeleccionados.length < 4 && !coloresSeleccionados.includes(hex)) {
      const nuevos = [...coloresSeleccionados, hex];
      setColoresSeleccionados(nuevos);
      setRespuestas(r => ({ ...r, colores: nuevos.join(", ") }));
      setColorCustom("");
    }
  };

  const handleSiguiente = async () => {
    // Validación: en el paso de destino, al menos sitio_web o whatsapp_numero debe tener contenido
    if (paso.tipo === "destino") {
      const sitioVacio = !respuestas.sitio_web || !respuestas.sitio_web.trim();
      const whatsappVacio = !respuestas.whatsapp_numero || !respuestas.whatsapp_numero.trim();
      if (sitioVacio && whatsappVacio) {
        setErrorDestino(true);
        return;
      }
    }
    setErrorDestino(false);

    if (pasoActual < pasos.length - 1) {
      setPasoActual(p => p + 1);
    } else {
      setGuardando(true);
      await fetch("/api/marca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...respuestas, completado: true }),
      });
      setGuardando(false);
      setCompletado(true);
    }
  };

  const handleAnterior = () => {
    if (pasoActual > 0) setPasoActual(p => p - 1);
  };

  const handleOpcion = (opcion: string) => {
    if (opcion === "Otro (escríbelo)") {
      setTonoOtro(true);
      setRespuestas(r => ({ ...r, [paso.id]: "" }));
    } else {
      setTonoOtro(false);
      setRespuestas(r => ({ ...r, [paso.id]: opcion }));
    }
  };

  if (cargando) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#999" }}>
      Cargando...
    </div>
  );

  if (completado) return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: "0 1rem", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>¡Identidad de marca guardada!</h1>
        {respuestas.logo_url && !logoError && (
          <img
            src={respuestas.logo_url}
            alt="Logo"
            style={{ height: 64, objectFit: "contain", marginBottom: 16, borderRadius: 8 }}
            onError={() => setLogoError(true)}
          />
        )}
        <p style={{ fontSize: 14, color: "#666", marginBottom: "2rem" }}>
          A partir de ahora el generador usará la identidad de <strong>{respuestas.nombre_marca}</strong> para crear imágenes más precisas y consistentes.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a href="/" style={{ display: "block", background: "#7F77DD", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            ✨ Ir al panel principal
          </a>
          <button onClick={() => { setCompletado(false); setPasoActual(0) }} style={{ background: "transparent", border: "1px solid #e8e8e6", color: "#666", padding: "10px", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
            Editar identidad de marca
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e8e6", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ fontSize: 18, fontWeight: 700, textDecoration: "none", color: "#1a1a1a" }}>
          quiu<span style={{ color: "#7F77DD" }}>bot</span>
        </a>
        <div style={{ fontSize: 13, color: "#999" }}>Paso {pasoActual + 1} de {pasos.length}</div>
      </div>

      <div style={{ height: 3, background: "#e8e8e6" }}>
        <div style={{ height: "100%", background: "#7F77DD", width: `${progreso}%`, transition: "width 0.4s ease" }} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#7F77DD", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Identidad de marca
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3 }}>
              {paso.titulo}
            </h2>
            <p style={{ fontSize: 14, color: "#666" }}>{paso.descripcion}</p>
          </div>

          {/* ... (renderizado condicional según tipo) ... */}
          {paso.tipo === "texto" && (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={respuestas[paso.id] ?? ""}
              onChange={e => setRespuestas(r => ({ ...r, [paso.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleSiguiente()}
              placeholder={paso.placeholder}
              style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#7F77DD"}
              onBlur={e => e.target.style.borderColor = "#e0e0e0"}
            />
          )}

          {paso.tipo === "textarea" && (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={respuestas[paso.id] ?? ""}
              onChange={e => setRespuestas(r => ({ ...r, [paso.id]: e.target.value }))}
              placeholder={paso.placeholder}
              rows={4}
              style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#7F77DD"}
              onBlur={e => e.target.style.borderColor = "#e0e0e0"}
            />
          )}

          {paso.tipo === "opciones" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {paso.opciones?.map(opcion => (
                <button
                  key={opcion}
                  onClick={() => handleOpcion(opcion)}
                  style={{ padding: "12px 16px", borderRadius: 10, border: `2px solid ${respuestas[paso.id] === opcion || (opcion === "Otro (escríbelo)" && tonoOtro) ? "#7F77DD" : "#e0e0e0"}`, background: respuestas[paso.id] === opcion || (opcion === "Otro (escríbelo)" && tonoOtro) ? "#f3f2fe" : "#fff", color: "#333", fontSize: 14, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                >
                  {opcion}
                </button>
              ))}
              {tonoOtro && (
                <input
                  autoFocus
                  type="text"
                  value={respuestas[paso.id] ?? ""}
                  onChange={e => setRespuestas(r => ({ ...r, [paso.id]: e.target.value }))}
                  placeholder="Describe el tono de tu marca..."
                  style={{ width: "100%", border: "2px solid #7F77DD", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginTop: 4 }}
                />
              )}
            </div>
          )}

          {paso.tipo === "colores" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {coloresSeleccionados.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {coloresSeleccionados.map(hex => (
                    <div key={hex} onClick={() => toggleColor(hex)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "2px solid #7F77DD", borderRadius: 20, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: hex, border: "1px solid #ccc" }} />
                      <span style={{ color: "#333" }}>{hex}</span>
                      <span style={{ color: "#999", fontSize: 14 }}>×</span>
                    </div>
                  ))}
                </div>
              )}
              {coloresSeleccionados.length < 4 && (
                <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
                  Selecciona hasta {4 - coloresSeleccionados.length} color{4 - coloresSeleccionados.length !== 1 ? "es" : ""} más
                </p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
                {COLORES_PRESET.map(({ nombre, hex }) => (
                  <div
                    key={hex}
                    onClick={() => toggleColor(hex)}
                    title={nombre}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 8,
                      background: hex,
                      border: coloresSeleccionados.includes(hex) ? "3px solid #7F77DD" : "2px solid #e0e0e0",
                      cursor: coloresSeleccionados.length >= 4 && !coloresSeleccionados.includes(hex) ? "not-allowed" : "pointer",
                      opacity: coloresSeleccionados.length >= 4 && !coloresSeleccionados.includes(hex) ? 0.4 : 1,
                      boxSizing: "border-box",
                      transition: "transform 0.1s",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={colorCustom || "#000000"}
                  onChange={e => setColorCustom(e.target.value)}
                  style={{ width: 40, height: 40, borderRadius: 8, border: "2px solid #e0e0e0", cursor: "pointer", padding: 2 }}
                />
                <input
                  type="text"
                  value={colorCustom}
                  onChange={e => setColorCustom(e.target.value)}
                  placeholder="#000000 o nombre del color"
                  style={{ flex: 1, border: "2px solid #e0e0e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "monospace", outline: "none" }}
                  onFocus={e => e.target.style.borderColor = "#7F77DD"}
                  onBlur={e => e.target.style.borderColor = "#e0e0e0"}
                  onKeyDown={e => e.key === "Enter" && agregarColorCustom()}
                />
                <button
                  onClick={agregarColorCustom}
                  disabled={!colorCustom || coloresSeleccionados.length >= 4}
                  style={{ padding: "10px 16px", background: "#7F77DD", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, cursor: "pointer", opacity: !colorCustom || coloresSeleccionados.length >= 4 ? 0.5 : 1 }}
                >
                  Agregar
                </button>
              </div>
            </div>
          )}

          {paso.tipo === "destino" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "linear-gradient(135deg, #f3f2fe 0%, #eef9f2 100%)", border: "1px solid #e0defc", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20, lineHeight: 1 }}>💡</div>
                <p style={{ fontSize: 13, color: "#4b4b6b", margin: 0, lineHeight: 1.5 }}>
                  Cuando alguien toque tu anuncio en Facebook o Instagram, <strong>llegará aquí</strong>. Sin este dato, tus campañas no podrán publicarse. Puedes completar uno de los dos, o ambos si vendes por los dos canales.
                </p>
              </div>

              <div style={{ border: "2px solid #e0e0e0", borderRadius: 14, padding: "16px", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#f3f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconoGlobo />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Sitio web o tienda online</div>
                    <div style={{ fontSize: 12, color: "#999" }}>Para campañas de "Venta Directa"</div>
                  </div>
                </div>
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={respuestas.sitio_web ?? ""}
                  onChange={e => { setRespuestas(r => ({ ...r, sitio_web: e.target.value })); setErrorDestino(false); }}
                  placeholder="Ej: tienda.miempresa.com"
                  style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#7F77DD"}
                  onBlur={e => e.target.style.borderColor = "#e0e0e0"}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "-2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#e8e8e6" }} />
                <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>Y / O</span>
                <div style={{ flex: 1, height: 1, background: "#e8e8e6" }} />
              </div>

              <div style={{ border: "2px solid #e0e0e0", borderRadius: 14, padding: "16px", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "#e9fbf0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconoWhatsApp />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>WhatsApp de ventas</div>
                    <div style={{ fontSize: 12, color: "#999" }}>Para campañas de "Venta Directa (WhatsApp)"</div>
                  </div>
                </div>
                <input
                  type="text"
                  value={respuestas.whatsapp_numero ?? ""}
                  onChange={e => { setRespuestas(r => ({ ...r, whatsapp_numero: e.target.value })); setErrorDestino(false); }}
                  placeholder="Ej: 573001234567 (con indicativo)"
                  style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#25D366"}
                  onBlur={e => e.target.style.borderColor = "#e0e0e0"}
                />
              </div>

              {errorDestino && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                  ⚠️ Ingresa al menos tu sitio web o tu número de WhatsApp para continuar.
                </div>
              )}
            </div>
          )}

          {paso.tipo === "logo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="url"
                value={respuestas[paso.id] ?? ""}
                onChange={e => { setRespuestas(r => ({ ...r, [paso.id]: e.target.value })); setLogoError(false) }}
                onKeyDown={e => e.key === "Enter" && handleSiguiente()}
                placeholder={paso.placeholder}
                style={{ width: "100%", border: "2px solid #e0e0e0", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#7F77DD"}
                onBlur={e => e.target.style.borderColor = "#e0e0e0"}
              />
              {respuestas[paso.id] && !logoError && (
                <div style={{ border: "2px solid #e0e0e0", borderRadius: 12, padding: 16, background: "#fff", textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>Vista previa del logo:</div>
                  <img
                    src={respuestas[paso.id]}
                    alt="Logo preview"
                    style={{ maxHeight: 120, maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
                    onError={() => setLogoError(true)}
                  />
                </div>
              )}
              {logoError && respuestas[paso.id] && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
                  No se pudo cargar la imagen. La URL debe ser directa y terminar en .png, .jpg o .webp
                </div>
              )}
              <div style={{ background: "#f3f2fe", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#534AB7" }}>
                💡 <strong>¿Cómo obtener una URL directa de tu logo?</strong><br />
                1. Ve a <a href="https://postimages.org/" target="_blank" rel="noopener noreferrer" style={{ color: "#7F77DD" }}>postimages.org</a> y sube tu logo.<br />
                2. Una vez subido, copia el campo que dice <strong>"Enlace directo"</strong>.<br />
                3. La URL debe terminar en .png, .jpg o .webp.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: "1.5rem" }}>
            {pasoActual > 0 && (
              <button onClick={handleAnterior} style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #e0e0e0", background: "#fff", color: "#666", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                ← Anterior
              </button>
            )}
            <button
              onClick={handleSiguiente}
              disabled={guardando}
              style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: "#7F77DD", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1 }}
            >
              {guardando ? "Guardando..." : pasoActual === pasos.length - 1 ? "Guardar identidad de marca ✓" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
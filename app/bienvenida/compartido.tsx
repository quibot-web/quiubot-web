"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { trackEvento, trackCustom } from "@/app/components/MetaPixel";

// Piezas que usan tanto la Parte A (hoy, interruptor apagado) como la
// experiencia de Autopiloto (ConversacionDirector/ExperienciaAutopiloto)
// -- viven aquí para no duplicarlas entre los dos archivos.

/* CTA reutilizable con tracking incorporado.
   ubicacion = de dónde sale el clic (para saber qué CTA convierte más). */
export function CtaLink({
  href,
  ubicacion,
  className,
  children,
}: {
  href: string;
  ubicacion: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      data-cta-ubicacion={ubicacion}
      onClick={() => {
        trackCustom("ClicPruebaGratis", { ubicacion });
      }}
    >
      {children}
    </Link>
  );
}

export function idYoutube(url: string): string | null {
  if (url.includes("youtube.com/watch")) {
    try {
      return new URL(url).searchParams.get("v");
    } catch {
      return null;
    }
  }
  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1]?.split(/[?&]/)[0] || null;
  }
  return null;
}

export function embedVideo(url: string): string | null {
  const yt = idYoutube(url);
  if (yt) return `https://www.youtube.com/embed/${yt}?autoplay=1`;
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1]?.split(/[?&]/)[0];
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
  }
  return null;
}

export function miniaturaVideo(url: string): string | null {
  const yt = idYoutube(url);
  return yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null;
}

/* Modal reutilizable para reproducir un video (YouTube, Vimeo o .mp4).
   Lo usan tanto el video de presentacion como las tarjetas de testimonios,
   asi evitamos repetir el mismo bloque de JSX dos veces. */
export function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const embed = embedVideo(url);
  return (
    <div className="video-modal-backdrop" onClick={onClose}>
      <div className="video-modal" onClick={(e) => e.stopPropagation()}>
        <button className="video-modal-close" onClick={onClose}>✕</button>
        <div className="video-modal-frame">
          {embed ? (
            <iframe src={embed} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          ) : (
            <video src={url} controls autoPlay />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRUEBA SOCIAL — Testimonios en video
   ============================================================
   Se alimenta de /api/tutoriales-publicos/testimonios, que a su vez
   se administra desde /admin/testimonios. Si todavia no hay ningun
   testimonio activo, se muestra un placeholder honesto en vez de
   inventar citas o dejar la seccion vacia. */

export type TestimonioVideo = {
  id: string;
  nombre_empresa: string;
  imagen_url: string;
  url_video: string;
  cita: string | null;
};

export function SeccionTestimonios({
  onCargado,
  claseSeccion = "alt",
  ocultarSiVacio = false,
}: {
  onCargado?: (testimonios: TestimonioVideo[]) => void;
  claseSeccion?: string;
  // La Parte A siempre muestra la sección, con un placeholder honesto
  // si todavía no hay testimonios. La experiencia de Autopiloto la
  // pidió "si los hay" -- con esto en true, no se muestra nada (ni la
  // sección ni el placeholder) mientras no haya al menos uno real.
  ocultarSiVacio?: boolean;
}) {
  const [testimonios, setTestimonios] = useState<TestimonioVideo[] | null>(null);
  const [abierto, setAbierto] = useState<TestimonioVideo | null>(null);

  useEffect(() => {
    fetch("/api/tutoriales-publicos/testimonios")
      .then((r) => r.json())
      .then((data) => {
        const lista: TestimonioVideo[] = data.testimonios || [];
        setTestimonios(lista);
        onCargado?.(lista);
      })
      .catch(() => {
        setTestimonios([]);
        onCargado?.([]);
      });
  }, []);

  const hayTestimonios = !!testimonios && testimonios.length > 0;

  if (!hayTestimonios && ocultarSiVacio) return null;

  return (
    <section className={claseSeccion}>
      <div className="section-head qb-reveal">
        <p className="eyebrow" style={{ textAlign: "center" }}>Prueba social</p>
        <h2>Negocios como el tuyo ya lo están usando.</h2>
        <p className="lead">
          Estamos en las primeras semanas — cada testimonio de esta sección es de un negocio real,
          verificado personalmente por el fundador.
        </p>
      </div>

      {hayTestimonios ? (
        <div className="testimonios-grid">
          {testimonios!.map((t) => {
            const miniatura = miniaturaVideo(t.url_video);
            return (
              <button
                key={t.id}
                type="button"
                className="testimonio-card testimonio-card-video qb-reveal"
                onClick={() => {
                  trackEvento("ViewContent", { content_name: `testimonio_${t.nombre_empresa}` });
                  setAbierto(t);
                }}
              >
                <div className="testimonio-video-thumb">
                  {miniatura ? (
                    <img src={miniatura} alt="" />
                  ) : (
                    <img src={t.imagen_url} alt="" />
                  )}
                  <span className="testimonio-play">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#4A3FAE">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                {t.cita && <div className="testimonio-quote">"{t.cita}"</div>}
                <div className="testimonio-autor">
                  <img className="testimonio-avatar-img" src={t.imagen_url} alt="" />
                  <div className="testimonio-nombre">{t.nombre_empresa}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="testimonios-placeholder qb-reveal">
          <div className="placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p>
            Los primeros testimonios en video están en camino — mientras tanto, cada negocio nuevo
            lo revisa personalmente el fundador. Cuéntanos tu caso y podrías ser el primero en aparecer aquí.
          </p>
        </div>
      )}

      {abierto && <VideoModal url={abierto.url_video} onClose={() => setAbierto(null)} />}
    </section>
  );
}

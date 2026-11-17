// Fase B v2.0, ronda H (revisión de staging, 16 nov 2026). Lógica
// pura aparte (recibe niveles de dB ya calculados, no decodifica
// nada) -- mismo criterio que video/visuales/validarGeometriaMinima.ts
// (compararGeometria() separado de validarGeometriaMinima()): las
// constantes reales (un audio decodificado de verdad, en el
// navegador) solo se pueden "ver pasar", nunca "ver fallar", sin
// esto. Quien sí decodifica audio real (decodeAudioData, Web Audio
// API) vive en app/admin/reel-automatico-prueba/AdminReelAutomaticoPruebaClient.tsx
// (encontrarSilenciosLargosInterno) y solo arma el arreglo de niveles
// por ventana antes de delegar acá.
export type SilencioLargo = { inicio_s: number; fin_s: number };

export function silenciosLargosDesdeNivelesDb(nivelesDb: number[], ventana_s: number, umbralDb: number, duracionMinima_s: number): SilencioLargo[] {
  const silencios: SilencioLargo[] = [];
  let inicioSilencio_s: number | null = null;

  const cerrarSiAlcanza = (finSilencio_s: number) => {
    if (inicioSilencio_s !== null && finSilencio_s - inicioSilencio_s >= duracionMinima_s) {
      silencios.push({ inicio_s: inicioSilencio_s, fin_s: finSilencio_s });
    }
    inicioSilencio_s = null;
  };

  nivelesDb.forEach((db, i) => {
    const t = i * ventana_s;
    const esSilencio = db < umbralDb;
    if (esSilencio && inicioSilencio_s === null) {
      inicioSilencio_s = t;
    } else if (!esSilencio && inicioSilencio_s !== null) {
      cerrarSiAlcanza(t);
    }
  });
  cerrarSiAlcanza(nivelesDb.length * ventana_s);

  return silencios;
}

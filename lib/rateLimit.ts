import "server-only"

// Limitador simple en memoria, por clave (normalmente el email del usuario).
// Suficiente para un solo servidor (tu VPS con Coolify). Si algún día escalas
// a varios servidores en paralelo, esto habría que moverlo a Redis o similar,
// porque cada instancia tendría su propio conteo por separado.

type Registro = { conteo: number; inicioVentana: number };
const registros = new Map<string, Registro>();

/**
 * Devuelve true si la petición está permitida, false si se superó el límite.
 * @param clave Identificador único (ej: email del usuario + nombre de la ruta)
 * @param maxPeticiones Cuántas peticiones se permiten dentro de la ventana
 * @param ventanaMs Duración de la ventana en milisegundos
 */
export function verificarLimite(clave: string, maxPeticiones: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const registro = registros.get(clave);

  if (!registro || ahora - registro.inicioVentana > ventanaMs) {
    registros.set(clave, { conteo: 1, inicioVentana: ahora });
    return true;
  }

  if (registro.conteo >= maxPeticiones) {
    return false;
  }

  registro.conteo += 1;
  return true;
}
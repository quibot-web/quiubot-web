// Bogotá no tiene horario de verano (UTC-5 fijo todo el año), asi que un
// offset constante es seguro -- evitamos depender de la zona horaria del
// servidor (que en Coolify probablemente corre en UTC) para decidir a que
// "dia" pertenece cada snapshot, y para que esos dias coincidan con el
// date_preset=today/yesterday que Meta calcula sobre la cuenta publicitaria.
const OFFSET_BOGOTA = "-05:00";

export function fechaBogota(fecha: Date = new Date()): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // YYYY-MM-DD
}

export function hoyBogota(): string {
  return fechaBogota(new Date());
}

export function ayerBogota(): string {
  return fechaBogota(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

// Medianoche de una fecha YYYY-MM-DD en Bogotá, como instante real (Date) --
// para comparar contra corrida_en (timestamptz) cuando haga falta un rango.
export function inicioDiaBogota(fechaYMD: string): Date {
  return new Date(`${fechaYMD}T00:00:00${OFFSET_BOGOTA}`);
}

export function finDiaBogota(fechaYMD: string): Date {
  return new Date(`${fechaYMD}T23:59:59.999${OFFSET_BOGOTA}`);
}

// Dias calendario (Bogotá) entre dos fechas YYYY-MM-DD, ambos extremos
// incluidos -- para iterar la ventana de una meta sin reinventar esto en
// cada lugar que necesite "un dia por iteracion".
export function diasEntre(desdeYMD: string, hastaYMD: string): string[] {
  const dias: string[] = [];
  let actual = inicioDiaBogota(desdeYMD);
  const fin = inicioDiaBogota(hastaYMD);
  while (actual.getTime() <= fin.getTime()) {
    dias.push(fechaBogota(actual));
    actual = new Date(actual.getTime() + 24 * 60 * 60 * 1000);
  }
  return dias;
}

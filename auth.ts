import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { verificarLimite } from "@/lib/rateLimit";
const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 15;
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // Por defecto, NextAuth deja la sesion viva 30 dias y la renueva sola en
  // cada visita -- eso significa que alguien podia cerrar el navegador,
  // volver semanas despues, y seguir logueado indefinidamente. Con esto,
  // la sesion expira si pasa 1 dia SIN actividad (nadie visita la app) --
  // deliberadamente corto porque una sesion abierta puede publicar
  // campañas reales y mover presupuesto de clientes en Meta. Mientras se
  // use activamente (al menos 1 vez por hora), se sigue renovando sola
  // sin pedir login de nuevo a mitad de una sesion de trabajo.
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 1 dia de vida total desde la ultima renovacion
    updateAge: 60 * 60, // se renueva como maximo 1 vez por hora con uso activo
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        // Freno por cuenta: si alguien intenta adivinar la contraseña de un
        // correo especifico muchas veces seguidas, esto lo detiene sin
        // importar desde cuantas IPs distintas venga el ataque.
        const permitido = verificarLimite(`login:${email}`, 20, 15 * 60 * 1000);
        if (!permitido) return null;
        const { data: usuario } = await supabaseAdmin
          .from("usuarios")
          .select("id, email, nombre, password_hash, email_verificado, intentos_login_fallidos, bloqueado_hasta")
          .eq("email", email)
          .maybeSingle();
        // Mensaje siempre generico en el login: nunca se revela si el correo
        // existe, si falta verificar, o si la contraseña esta mal — todo
        // termina en el mismo "correo o contraseña incorrectos".
        if (!usuario || !usuario.password_hash) return null;
        if (!usuario.email_verificado) return null;
        if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
          return null;
        }
        const coincide = await bcrypt.compare(password, usuario.password_hash);
        if (!coincide) {
          const nuevosIntentos = (usuario.intentos_login_fallidos || 0) + 1;
          const actualizacion: Record<string, any> = { intentos_login_fallidos: nuevosIntentos };
          if (nuevosIntentos >= MAX_INTENTOS_FALLIDOS) {
            actualizacion.bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000).toISOString();
          }
          await supabaseAdmin.from("usuarios").update(actualizacion).eq("id", usuario.id);
          return null;
        }
        // Login correcto: se reinicia el contador de intentos.
        await supabaseAdmin
          .from("usuarios")
          .update({ intentos_login_fallidos: 0, bloqueado_hasta: null })
          .eq("id", usuario.id);
        return { id: usuario.id, email: usuario.email, name: usuario.nombre || usuario.email };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return true;
      // Este upsert es solo para el flujo de Google. El flujo de contraseña
      // ya crea y gestiona su propia fila desde /api/auth/registro.
      if (account?.provider === "google") {
        const { error } = await supabaseAdmin
          .from('usuarios')
          .upsert(
            { email: user.email, activo: false, email_verificado: true },
            { onConflict: 'email', ignoreDuplicates: true }
          );
        if (error) {
          console.error("Error al crear/verificar usuario en signIn:", error.message);
        }
      }
      return true;
    },
    async jwt({ token, account, user }) {
      // Solo se ejecuta esta consulta en el momento exacto del sign-in
      // (cuando "account" viene presente) -- no en cada request, para no
      // pegarle a Supabase de mas. Comparamos "creado_en" contra el reloj:
      // si la cuenta se creo hace menos de 2 minutos, es un registro nuevo
      // de verdad -- no alguien que ya tenia cuenta y solo volvio a entrar.
      // Esto es lo que le permite al cliente saber cuando disparar
      // CompleteRegistration en el Pixel de Meta sin inflar el conteo con
      // logins repetidos de usuarios existentes.
      if (account?.provider === "google" && user?.email) {
        const { data: fila } = await supabaseAdmin
          .from("usuarios")
          .select("creado_en")
          .eq("email", user.email)
          .maybeSingle();

        if (fila?.creado_en) {
          const edadMs = Date.now() - new Date(fila.creado_en).getTime();
          token.esRegistroNuevo = edadMs < 2 * 60 * 1000;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      (session.user as any).esRegistroNuevo = (token as any).esRegistroNuevo === true;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
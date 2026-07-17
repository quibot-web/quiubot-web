import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;

      // upsert con ignoreDuplicates evita la condición de carrera del select+insert:
      // si el usuario ya existe, no lo toca; si no existe, lo crea una sola vez,
      // incluso si dos peticiones llegan casi al mismo tiempo.
      const { error } = await supabaseAdmin
        .from('usuarios')
        .upsert(
          { email: user.email, activo: false },
          { onConflict: 'email', ignoreDuplicates: true }
        );

      if (error) {
        console.error("Error al crear/verificar usuario en signIn:", error.message);
        // No bloqueamos el login por un error aquí — si el usuario ya existía,
        // esto no debería ocurrir; si es un problema real de la base de datos,
        // preferimos dejarlo entrar y que se note el problema en otra pantalla,
        // antes que bloquear el acceso por completo.
      }

      return true;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabase"; // Importas tu cliente ya configurado

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
      if (user.email) {
        // Usamos supabaseAdmin para buscar al usuario
        const { data: existingUser } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('email', user.email)
          .single();

        // Si no existe, lo insertamos automáticamente
        if (!existingUser) {
          await supabaseAdmin.from('usuarios').insert([
            { email: user.email, activo: false }
          ]);
        }
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
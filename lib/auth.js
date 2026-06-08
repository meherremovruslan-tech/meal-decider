import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data: user } = await supabase
          .from('users')
          .select('id, email, password_hash, email_verified')
          .eq('email', credentials.email.toLowerCase().trim())
          .single();

        if (!user) return null;

        if (!user.email_verified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        if (!user.password_hash) return null;  // Google-only account — no password
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        const { data: existing, error: selectError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (selectError) {
          console.error('signIn SELECT error code:', selectError.code, 'message:', selectError.message);
        }

        if (existing) {
          user.id = existing.id;
          return true;
        }

        // Proceed to insert whether SELECT returned no rows or failed
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({ email, email_verified: true })
          .select('id')
          .single();

        if (insertError) {
          console.error('signIn INSERT error code:', insertError.code, 'message:', insertError.message);
          // Unique constraint — user exists, try SELECT again
          if (insertError.code === '23505') {
            const { data: retry } = await supabase
              .from('users').select('id').eq('email', email).single();
            if (retry) { user.id = retry.id; return true; }
          }
          return false;
        }

        user.id = newUser.id;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

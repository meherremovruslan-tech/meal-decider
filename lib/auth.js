import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';
import { randomAvatar } from './avatars';

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
          .select('id, avatar_emoji')
          .eq('email', email)
          .single();

        if (selectError) {
          console.error('signIn SELECT error code:', selectError.code, 'message:', selectError.message);
        }

        if (existing) {
          user.id = existing.id;
          user.avatar_emoji = existing.avatar_emoji;
          // Backfill avatar if missing (existing users before this feature)
          if (!existing.avatar_emoji) {
            await supabase.from('users').update({ avatar_emoji: randomAvatar() }).eq('id', existing.id);
          }
          return true;
        }

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({ email, email_verified: true, avatar_emoji: randomAvatar() })
          .select('id, avatar_emoji')
          .single();

        if (insertError) {
          console.error('signIn INSERT error code:', insertError.code, 'message:', insertError.message);
          if (insertError.code === '23505') {
            const { data: retry } = await supabase
              .from('users').select('id, avatar_emoji').eq('email', email).single();
            if (retry) { user.id = retry.id; user.avatar_emoji = retry.avatar_emoji; return true; }
          }
          return false;
        }

        user.id = newUser.id;
        user.avatar_emoji = newUser.avatar_emoji;
        return true;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if (user.avatar_emoji) token.avatar_emoji = user.avatar_emoji;
      }
      // Fetch fresh avatar_emoji and display_name from DB on every token refresh
      if (token.id && !token.avatar_emoji) {
        const { data } = await supabase
          .from('users')
          .select('avatar_emoji, display_name')
          .eq('id', token.id)
          .single();
        if (data) {
          token.avatar_emoji = data.avatar_emoji;
          token.display_name = data.display_name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id;
      if (token?.avatar_emoji) session.user.avatar_emoji = token.avatar_emoji;
      if (token?.display_name) session.user.display_name = token.display_name;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

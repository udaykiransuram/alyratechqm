import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectDB } from '@/lib/db';
import { getTenantModels } from '@/lib/db-tenant';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        schoolKey: { label: 'School Key', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.schoolKey) {
          console.log('Missing credentials');
          return null;
        }
        try {
          await connectDB();
          const { User } = await getTenantModels(credentials.schoolKey, ['User']);
          console.log('Fetched User model for tenant:', credentials.schoolKey);
          const user = await User.findOne({ email: credentials.email });
          console.log('Found user:', !!user, 'with passwordHash:', user ? !!user.passwordHash : 'no user');
          if (!user) {
            console.log('User not found for email:', credentials.email);
            return null;
          }
          console.log('Comparing passwords...');
          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          console.log('Password valid:', isValid);
          if (!isValid) {
            console.log('Invalid password for user:', credentials.email);
            return null;
          }
          console.log('Successful login for user:', credentials.email);
          return { id: user._id, name: user.name, email: user.email, role: user.role };
        } catch (error) {
          console.error('Error in authorize:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    async jwt({ token, user }: { token: import('next-auth/jwt').JWT; user: import('next-auth').User }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        console.log('JWT callback: Added id and role to token', { id: user.id, role: user.role });
      }
      return token;
    },
    async session({ session, token }: { session: import('next-auth').Session; token: import('next-auth/jwt').JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        console.log('Session callback: Added id and role to session', { id: token.id, role: token.role });
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};
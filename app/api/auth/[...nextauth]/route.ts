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
          return null;
        }
        await connectDB();
        const { User } = await getTenantModels(credentials.schoolKey, ['User']);
        const user = await User.findOne({ email: credentials.email });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        return { id: user._id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin', // Customize if you have a signin page
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
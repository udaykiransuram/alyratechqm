import { Session as DefaultSession, User as DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: 'admin' | 'teacher' | 'student';
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: 'admin' | 'teacher' | 'student';
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: 'admin' | 'teacher' | 'student';
  }
}
import { Session as DefaultSession, User as DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";
import type { AccountType, AppRole } from "@/lib/auth-types";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      accountType: AccountType;
      role: AppRole;
      schoolKey?: string;
      studentSessionId?: string;
      studentClassId?: string;
      studentAcademicSectionId?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    accountType: AccountType;
    role: AppRole;
    schoolKey?: string;
    studentSessionId?: string;
    studentClassId?: string;
    studentAcademicSectionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accountType: AccountType;
    role: AppRole;
    schoolKey?: string;
    studentSessionId?: string;
    studentClassId?: string;
    studentAcademicSectionId?: string;
  }
}

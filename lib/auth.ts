import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/db";
import { ensureBootstrapCompanyAdmin } from "@/lib/company-admin";
import { getTenantModels } from "@/lib/db-tenant";
import type { AccountType, AppRole, SchoolUserRole } from "@/lib/auth-types";
import { getNextAuthSecret } from "@/lib/auth-runtime";
import {
  findStudentsByRollNumber,
  normalizeEmail,
  normalizeRollNumber,
} from "@/lib/user-credentials";
import CompanyAdmin from "@/models/CompanyAdmin";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "company-admin",
      name: "Company Admin",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await connectDB();
          await ensureBootstrapCompanyAdmin();

          const email = String(credentials.email).trim().toLowerCase();
          const companyAdmin = await CompanyAdmin.findOne({
            email,
            isActive: true,
          });
          if (!companyAdmin?.passwordHash) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            companyAdmin.passwordHash,
          );
          if (!isValid) {
            return null;
          }

          return {
            id: String(companyAdmin._id),
            name: companyAdmin.name,
            email: companyAdmin.email,
            accountType: "company_admin" as AccountType,
            role: "company_admin" as AppRole,
          };
        } catch (error) {
          console.error("Error in company admin authorize:", error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "school-user",
      name: "School User",
      credentials: {
        identifier: { label: "Email or Roll Number", type: "text" },
        password: { label: "Password", type: "password" },
        schoolKey: { label: "School Key", type: "text" },
      },
      async authorize(credentials) {
        const rawIdentifier =
          credentials?.identifier ||
          (credentials as Record<string, string | undefined> | undefined)?.email;

        if (
          !rawIdentifier ||
          !credentials?.password ||
          !credentials?.schoolKey
        ) {
          return null;
        }
        try {
          await connectDB();
          const schoolKey = String(credentials.schoolKey).trim();
          const identifier = String(rawIdentifier).trim();
          const { User } = await getTenantModels(schoolKey, ["User"]);
          const email = normalizeEmail(identifier);
          let user = email ? await User.findOne({ email }) : null;

          if (!user) {
            const rollNumber = normalizeRollNumber(identifier);
            const matchingStudents = await findStudentsByRollNumber(
              User,
              rollNumber,
              { limit: 2 },
            );

            if (matchingStudents.length > 1) {
              throw new Error(
                "Multiple students share this roll number. Please contact your school admin.",
              );
            }

            user = matchingStudents[0] || null;
          }

          if (
            user?.role === "student" &&
            !user.passwordHash &&
            normalizeRollNumber(user.rollNumber) &&
            credentials.password === normalizeRollNumber(user.rollNumber)
          ) {
            user.passwordHash = await bcrypt.hash(credentials.password, 10);
            await user.save();
          }

          if (!user?.passwordHash) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash,
          );
          if (!isValid) {
            return null;
          }
          return {
            id: String(user._id),
            name: user.name,
            email: user.email || undefined,
            accountType: "school_user" as AccountType,
            role: user.role as SchoolUserRole,
            schoolKey,
          };
        } catch (error) {
          console.error("Error in school user authorize:", error);
          if (
            error instanceof Error &&
            error.message.includes("Multiple students share this roll number")
          ) {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: import("next-auth/jwt").JWT;
      user: import("next-auth").User;
    }) {
      if (user) {
        token.id = user.id;
        token.accountType = user.accountType;
        token.role = user.role;
        token.schoolKey = user.schoolKey;
      }
      return token;
    },
    async session({
      session,
      token,
    }: {
      session: import("next-auth").Session;
      token: import("next-auth/jwt").JWT;
    }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.accountType = token.accountType;
        session.user.role = token.role;
        session.user.schoolKey = token.schoolKey;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (url.startsWith(baseUrl)) {
        return url;
      }

      return baseUrl;
    },
  },
  secret: getNextAuthSecret(),
  pages: {
    signIn: "/auth/signin",
  },
};

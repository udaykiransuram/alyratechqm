import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { ensureBootstrapCompanyAdmin } from "@/lib/company-admin";
import { getTenantModels } from "@/lib/db-tenant";
import type { AccountType, AppRole, SchoolUserRole } from "@/lib/auth-types";
import { getNextAuthSecret } from "@/lib/auth-runtime";
import {
  claimStudentSession,
  clearStudentLoginRateLimit,
  clearStudentSessionIfMatch,
  consumeStudentLoginRateLimit,
} from "@/lib/redis";
import { createStudentSessionId, getStudentSessionFreshnessCutoff } from "@/lib/student-session";
import {
  findStudentsByRollNumber,
  normalizeEmail,
  normalizeRollNumber,
} from "@/lib/user-credentials";
import { isAllowedConfiguredSiteUrl } from "@/lib/site-url";
import { getPublicSchoolOptionByKey } from "@/lib/server/public-school-data";
import CompanyAdmin from "@/models/CompanyAdmin";

const STUDENT_ALREADY_SIGNED_IN_ERROR = "StudentAlreadySignedIn";
const STUDENT_SIGN_IN_RATE_LIMITED_ERROR = "StudentSignInRateLimited";

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
          const schoolKey = String(credentials.schoolKey).trim().toLowerCase();
          const school = await getPublicSchoolOptionByKey(schoolKey);
          if (!school) {
            return null;
          }

          const identifier = String(rawIdentifier).trim();
          const { User } = await getTenantModels(schoolKey, ["User"]);
          const email = identifier.includes("@")
            ? normalizeEmail(identifier)
            : undefined;
          const rollNumber = email ? "" : normalizeRollNumber(identifier);
          const isStudentIdentifier = !email && Boolean(rollNumber);

          if (isStudentIdentifier) {
            let rateLimit = null;
            try {
              rateLimit = await consumeStudentLoginRateLimit(
                schoolKey,
                rollNumber,
              );
            } catch (error) {
              console.error(
                "Failed to consume student login rate limit. Continuing without Redis rate limit:",
                error,
              );
            }
            if (rateLimit?.limited) {
              throw new Error(STUDENT_SIGN_IN_RATE_LIMITED_ERROR);
            }
          }

          let user = email
            ? await User.findOne({
                email,
                ...buildArchiveFilter(false),
              })
            : null;

          if (!user) {
            const matchingStudents = await findStudentsByRollNumber(
              User,
              rollNumber,
              { limit: 2 },
            );

            if (matchingStudents.length > 1) {
              return null;
            }

            user = matchingStudents[0] || null;
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

          let studentSessionId: string | undefined;
          if (user.role === "student") {
            const now = new Date();
            studentSessionId = createStudentSessionId();
            let claimedRedisSession: boolean | null = null;
            try {
              claimedRedisSession = await claimStudentSession(
                schoolKey,
                String(user._id),
                studentSessionId,
              );
            } catch (error) {
              console.error(
                "Failed to claim Redis student session. Falling back to DB session lock:",
                error,
              );
            }

            if (claimedRedisSession === false) {
              throw new Error(STUDENT_ALREADY_SIGNED_IN_ERROR);
            }

            if (claimedRedisSession !== true) {
              const sessionLockResult = await User.updateOne(
                {
                  _id: user._id,
                  role: "student",
                  $or: [
                    { activeStudentSessionId: { $exists: false } },
                    { activeStudentSessionId: null },
                    { activeStudentSessionId: "" },
                    { activeStudentSessionLastSeenAt: { $exists: false } },
                    {
                      activeStudentSessionLastSeenAt: {
                        $lt: getStudentSessionFreshnessCutoff(now),
                      },
                    },
                  ],
                },
                {
                  $set: {
                    activeStudentSessionId: studentSessionId,
                    activeStudentSessionLastSeenAt: now,
                  },
                },
              );

              if (sessionLockResult.matchedCount !== 1) {
                throw new Error(STUDENT_ALREADY_SIGNED_IN_ERROR);
              }
            } else {
              await User.updateOne(
                {
                  _id: user._id,
                  role: "student",
                },
                {
                  $set: {
                    activeStudentSessionId: studentSessionId,
                    activeStudentSessionLastSeenAt: now,
                  },
                },
              );
            }

            await clearStudentLoginRateLimit(schoolKey, rollNumber).catch(
              (error) => {
                console.error(
                  "Failed to clear student login rate limit after successful sign in:",
                  error,
                );
                return undefined;
              },
            );
          }

          return {
            id: String(user._id),
            name: user.name,
            email: user.email || undefined,
            accountType: "school_user" as AccountType,
            role: user.role as SchoolUserRole,
            schoolKey,
            studentSessionId,
            studentClassId:
              user.role === "student"
                ? String(user.class?._id || user.class || "").trim() || undefined
                : undefined,
            studentAcademicSectionId:
              user.role === "student"
                ? String(
                    user.academicSection?._id || user.academicSection || "",
                  ).trim() || undefined
                : undefined,
          };
        } catch (error) {
          console.error("Error in school user authorize:", error);
          if (
            error instanceof Error &&
            [
              STUDENT_ALREADY_SIGNED_IN_ERROR,
              STUDENT_SIGN_IN_RATE_LIMITED_ERROR,
            ].includes(error.message)
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
        token.studentSessionId = user.studentSessionId;
        token.studentClassId = user.studentClassId;
        token.studentAcademicSectionId = user.studentAcademicSectionId;
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
        session.user.studentSessionId = token.studentSessionId;
        session.user.studentClassId = token.studentClassId;
        session.user.studentAcademicSectionId =
          token.studentAcademicSectionId;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      if (isAllowedConfiguredSiteUrl(url, baseUrl)) {
        return url;
      }

      return baseUrl;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : undefined;
      const studentSessionId =
        typeof token?.studentSessionId === "string"
          ? token.studentSessionId.trim()
          : "";

      if (
        token?.accountType !== "school_user" ||
        token?.role !== "student" ||
        !token?.id ||
        !token?.schoolKey ||
        !studentSessionId
      ) {
        return;
      }

      try {
        await clearStudentSessionIfMatch(
          String(token.schoolKey),
          String(token.id),
          studentSessionId,
        ).catch((error) => {
          console.error("Failed to clear Redis student session on sign out:", error);
          return null;
        });

        const { User } = await getTenantModels(String(token.schoolKey), ["User"]);
        await User.updateOne(
          {
            _id: token.id,
            role: "student",
            activeStudentSessionId: studentSessionId,
          },
          {
            $unset: {
              activeStudentSessionId: 1,
              activeStudentSessionLastSeenAt: 1,
            },
          },
        );
      } catch (error) {
        console.error("Error clearing active student session on sign out:", error);
      }
    },
  },
  secret: getNextAuthSecret(),
  pages: {
    signIn: "/auth/signin",
  },
};

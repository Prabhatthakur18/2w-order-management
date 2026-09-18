import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otpId: z.string().min(1),
  otpCode: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otpId: { label: "OTP id", type: "text" },
        otpCode: { label: "Code", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password, otpId, otpCode } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { roles: true },
        });

        if (!user || !user.isActive) return null;

        const passwordOk = await bcrypt.compare(password, user.passwordHash);
        if (!passwordOk) return null;

        // Second factor: the OTP challenge must belong to this same user and
        // still be valid. The password check above already gates this, but
        // this is the actual session-issuing boundary, so it is re-checked
        // here rather than trusted from the earlier request-OTP step.
        const otp = await db.loginOtp.findUnique({ where: { id: otpId } });
        if (!otp || otp.userId !== user.id) return null;

        const result = await verifyOtp(otpId, otpCode);
        if (!result.ok) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
          dealerId: user.dealerId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = (user as { roles: Role[] }).roles;
        token.dealerId = (user as { dealerId: string | null }).dealerId;
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.roles = (token.roles ?? []) as Role[];
        session.user.dealerId = (token.dealerId ?? null) as string | null;
      }
      return session;
    },
  },
});

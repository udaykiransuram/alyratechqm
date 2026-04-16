import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { withRequestBudget } from "@/lib/server/request-governor";
import ContactMessage from "@/models/ContactMessage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withRequestBudget(
    {
      request,
      policy: "contactSend",
    },
    async () => {
      try {
        await connectDB();
        const body = await request.json();

        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim();
        const institution = String(body.institution || "").trim();
        const message = String(body.message || "").trim();

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
        if (!name || !emailRe.test(email) || !message) {
          return NextResponse.json(
            {
              success: false,
              error: "Please provide a valid name, email, and message.",
            },
            { status: 400 },
          );
        }

        const saved = await ContactMessage.create({
          name,
          email,
          institution,
          message,
        });
        return NextResponse.json({ success: true, id: saved._id });
      } catch (error: unknown) {
        return NextResponse.json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to send message.",
          },
          { status: 500 },
        );
      }
    },
  );
}

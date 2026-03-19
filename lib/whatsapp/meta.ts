import crypto from "crypto";

type SendDocumentParams = {
  to: string;
  link: string;
  filename?: string;
  caption?: string;
};

type SendTemplateParams = {
  to: string;
  templateName?: string;
  languageCode?: string;
};

type SendTextParams = {
  to: string;
  body: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getWhatsAppConfig() {
  return {
    token: requiredEnv("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: requiredEnv("WHATSAPP_PHONE_NUMBER_ID"),
    version: process.env.WHATSAPP_GRAPH_VERSION || "v21.0",
  };
}

async function postWhatsAppMessage(payload: Record<string, unknown>) {
  const { token, phoneNumberId, version } = getWhatsAppConfig();
  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const rawText = await res.text();
  let data: any = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }
  }

  if (!res.ok) {
    throw new Error(
      data?.error?.message || rawText || "Failed to send WhatsApp message",
    );
  }

  return data;
}

export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  const appSecret = requiredEnv("WHATSAPP_APP_SECRET");
  if (!signatureHeader) return false;

  const [scheme, providedSignature = ""] = signatureHeader.split("=", 2);
  if (scheme !== "sha256" || !providedSignature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");

  if (
    expectedBuffer.length === 0 ||
    expectedBuffer.length !== providedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function sendWhatsAppDocument({
  to,
  link,
  filename = "report.pdf",
  caption,
}: SendDocumentParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link,
      filename,
      ...(caption ? { caption } : {}),
    },
  });
}

export async function sendWhatsAppTemplate({
  to,
  templateName = process.env.WHATSAPP_FALLBACK_TEMPLATE_NAME || "hello_world",
  languageCode = process.env.WHATSAPP_FALLBACK_TEMPLATE_LANG || "en_US",
}: SendTemplateParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  });
}

export async function sendWhatsAppText({ to, body }: SendTextParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

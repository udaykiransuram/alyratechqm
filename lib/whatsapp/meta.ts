import crypto from "crypto";

type SendDocumentParams = {
  to: string;
  link: string;
  filename?: string;
  caption?: string;
  callbackData?: string;
};

type SendTemplateParams = {
  to: string;
  templateName?: string;
  languageCode?: string;
  callbackData?: string;
};

type SendTextParams = {
  to: string;
  body: string;
  callbackData?: string;
};

type PostWhatsAppMessagePayload = Record<string, unknown> & {
  biz_opaque_callback_data?: string;
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

async function postWhatsAppMessage(payload: PostWhatsAppMessagePayload) {
  const { token, phoneNumberId, version } = getWhatsAppConfig();
  let res: Response;

  try {
    res = await fetch(
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
  } catch (error: any) {
    const wrappedError = new Error(
      error?.message || "WhatsApp request failed before a provider response",
    );
    (wrappedError as any).transportFailure = true;
    throw wrappedError;
  }

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
    const error = new Error(
      data?.error?.message || rawText || "Failed to send WhatsApp message",
    );
    (error as any).providerRejected = true;
    (error as any).providerStatus = res.status;
    (error as any).providerPayload = data;
    throw error;
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
  callbackData,
}: SendDocumentParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "document",
    ...(callbackData ? { biz_opaque_callback_data: callbackData } : {}),
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
  callbackData,
}: SendTemplateParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "template",
    ...(callbackData ? { biz_opaque_callback_data: callbackData } : {}),
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  });
}

export async function sendWhatsAppText({
  to,
  body,
  callbackData,
}: SendTextParams) {
  return postWhatsAppMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    ...(callbackData ? { biz_opaque_callback_data: callbackData } : {}),
    text: { body },
  });
}

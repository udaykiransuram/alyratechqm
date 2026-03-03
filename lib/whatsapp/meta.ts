type SendDocumentParams = {
  to: string;
  link: string;
  filename?: string;
  caption?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function sendWhatsAppDocument({
  to,
  link,
  filename = "report.pdf",
  caption,
}: SendDocumentParams) {
  const token = requiredEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: {
          link,
          filename,
          ...(caption ? { caption } : {}),
        },
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to send WhatsApp document");
  }
  return data;
}

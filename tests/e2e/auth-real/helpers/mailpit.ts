type MailpitMessage = {
  ID?: string;
  id?: string;
  To?: Array<{ Address?: string; Mailbox?: string; Domain?: string }>;
  to?: Array<{ Address?: string; Mailbox?: string; Domain?: string }>;
  Subject?: string;
  subject?: string;
};

function normalizeRecipients(message: MailpitMessage): string[] {
  const recipients = message.To || message.to || [];
  return recipients
    .map((recipient) => {
      if (recipient.Address) return recipient.Address.toLowerCase();
      if (recipient.Mailbox && recipient.Domain) {
        return `${recipient.Mailbox}@${recipient.Domain}`.toLowerCase();
      }
      return "";
    })
    .filter(Boolean);
}

function pickMessageId(message: MailpitMessage): string | null {
  return message.ID || message.id || null;
}

export async function waitForLatestMail(options: {
  to: string;
  subjectPattern?: RegExp;
  timeoutMs?: number;
  intervalMs?: number;
  baseUrl?: string;
}): Promise<string> {
  const {
    to,
    subjectPattern,
    timeoutMs = Number(process.env.MAILPIT_INBOX_TIMEOUT_MS || "60000"),
    intervalMs = Number(process.env.MAILPIT_POLL_INTERVAL_MS || "2000"),
    baseUrl = process.env.MAILPIT_BASE_URL || "http://127.0.0.1:8025",
  } = options;

  const targetEmail = to.toLowerCase();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const listRes = await fetch(`${baseUrl}/api/v1/messages`);
    if (listRes.ok) {
      const payload = (await listRes.json()) as { messages?: MailpitMessage[] };
      const messages = payload.messages || [];

      for (const message of messages) {
        const recipients = normalizeRecipients(message);
        const subject = (message.Subject || message.subject || "").trim();
        const id = pickMessageId(message);
        if (!id) continue;
        if (!recipients.includes(targetEmail)) continue;
        if (subjectPattern && !subjectPattern.test(subject)) continue;
        return id;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Mailpit timeout: no mail for ${to} within ${timeoutMs}ms`);
}

export async function extractConfirmationLink(options: {
  messageId: string;
  baseUrl?: string;
}): Promise<string> {
  const { messageId, baseUrl = process.env.MAILPIT_BASE_URL || "http://127.0.0.1:8025" } = options;
  const detailRes = await fetch(`${baseUrl}/api/v1/message/${messageId}`);
  if (!detailRes.ok) {
    throw new Error(`Mailpit message fetch failed: ${detailRes.status}`);
  }

  const detail = (await detailRes.json()) as Record<string, unknown>;
  const raw = JSON.stringify(detail);
  const match = raw.match(/https?:\/\/[^"'\s\\]+\/auth\/verify[^"'\s\\]*/i);
  if (!match) {
    throw new Error("No confirmation URL found in Mailpit message payload");
  }

  return match[0].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

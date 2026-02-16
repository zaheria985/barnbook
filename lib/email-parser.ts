// Email parser for Venmo receipt HTML ingestion

export interface ParsedReceipt {
  amount: number;
  date: string;
  recipient: string;
  note: string | null;
  source: string;
}

export function parseVenmoReceipt(html: string): ParsedReceipt | null {
  try {
    // Extract amount: look for dollar amounts
    const amountMatch = html.match(/\$\s*([\d,]+\.?\d*)/);
    if (!amountMatch) return null;
    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

    // Extract date
    const dateMatch = html.match(
      /(\w+ \d{1,2},?\s*\d{4})|(\d{1,2}\/\d{1,2}\/\d{2,4})/
    );
    let date: string;
    if (dateMatch) {
      const parsed = new Date(dateMatch[0]);
      date = isNaN(parsed.getTime())
        ? new Date().toISOString().split("T")[0]
        : parsed.toISOString().split("T")[0];
    } else {
      date = new Date().toISOString().split("T")[0];
    }

    // Extract recipient: look for "to" or "paid" patterns
    const recipientMatch =
      html.match(/(?:paid|to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i) ||
      html.match(/recipient[:\s]+([^\n<]+)/i);
    const recipient = recipientMatch
      ? recipientMatch[1].trim()
      : "Unknown";

    // Extract note/memo
    const noteMatch =
      html.match(/note[:\s]+([^\n<]+)/i) ||
      html.match(/memo[:\s]+([^\n<]+)/i) ||
      html.match(/for[:\s]+([^\n<]+)/i);
    const note = noteMatch ? noteMatch[1].trim() : null;

    return {
      amount,
      date,
      recipient,
      note,
      source: "venmo_email",
    };
  } catch {
    return null;
  }
}

export function parseGenericReceipt(text: string): ParsedReceipt | null {
  try {
    const amountMatch = text.match(/\$\s*([\d,]+\.?\d*)/);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    const date = new Date().toISOString().split("T")[0];

    return {
      amount,
      date,
      recipient: "Unknown",
      note: text.slice(0, 200),
      source: "email",
    };
  } catch {
    return null;
  }
}

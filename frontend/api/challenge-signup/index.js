const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
]);

const seenEmails = new Set();
const ipTimestamps = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  const xreal = req.headers["x-real-ip"];
  if (typeof xreal === "string" && xreal.trim()) {
    return xreal.trim();
  }
  return "0.0.0.0";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const webhookUrl = (process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
    return res.status(200).json({ configured: Boolean(webhookUrl) });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ detail: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_e) {
      return res.status(400).json({ detail: "Invalid JSON payload." });
    }
  }
  body = body || {};

  // 1. Honeypot spam check
  if (String(body.website || "").trim()) {
    return res.status(400).json({ detail: "Invalid submission." });
  }

  // 2. Consent validation
  if (body.consent !== true) {
    return res.status(400).json({
      detail:
        "Please check the opt-in box to consent to receive early-access emails.",
    });
  }

  // 3. Score validation (integer 0..5)
  const score = body.score;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 5
  ) {
    return res.status(400).json({
      detail: "Challenge score must be an integer between 0 and 5.",
    });
  }

  // 4. Email normalization & validation
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RX.test(email)) {
    return res
      .status(400)
      .json({ detail: "Please enter a valid work email address." });
  }

  const domain = email.split("@").pop() || "";
  if (
    DISPOSABLE_DOMAINS.has(domain) ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    return res
      .status(400)
      .json({ detail: "Please enter a valid work email address." });
  }

  // 5. Source normalization
  const source =
    String(body.source || "Web Summit Lisbon QR")
      .trim()
      .slice(0, 120) || "Web Summit Lisbon QR";

  // 6. Rate limiting per IP
  const ip = getClientIp(req);
  const now = Date.now();
  const recent = (ipTimestamps.get(ip) || []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (recent.length >= MAX_PER_IP) {
    return res.status(429).json({
      detail:
        "Too many signup requests from this connection. Please try again later.",
    });
  }

  // 7. Ensure Google Sheets webhook URL is configured
  const webhookUrl = (process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    return res.status(503).json({
      detail:
        "Early-access email signup is temporarily unavailable until the Google Sheets integration is configured.",
    });
  }

  // 8. Duplicate email check
  if (seenEmails.has(email)) {
    return res.status(409).json({
      detail:
        "This email has already been registered for the Revenue Leak Challenge.",
    });
  }

  const submittedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const optInLabel = "Yes";
  const sheetPayload = {
    submitted_at: submittedAt,
    email,
    score,
    source,
    opt_in: optInLabel,
    consent: true,
    row: [submittedAt, email, score, source, optInLabel],
    headers: {
      "Submitted At (UTC)": submittedAt,
      Email: email,
      "Challenge Score": score,
      Source: source,
      "Email Opt-in": optInLabel,
    },
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sheetPayload),
      redirect: "follow",
    });

    if (!resp.ok) {
      return res.status(502).json({
        detail:
          "Could not record your signup to the sheet right now. Please try again shortly.",
      });
    }

    const text = await resp.text();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.ok === false) {
          return res.status(502).json({
            detail:
              "Could not record your signup to the sheet right now. Please try again shortly.",
          });
        }
      } catch (_e) {
        // Apps Script may return plain text or HTML redirect confirmation on 200 OK
      }
    }
  } catch (_err) {
    return res.status(502).json({
      detail:
        "Could not reach the signup service right now. Please try again shortly.",
    });
  }

  seenEmails.add(email);
  recent.push(now);
  ipTimestamps.set(ip, recent);

  return res.status(200).json({
    ok: true,
    saved: true,
    submitted_at: submittedAt,
    email,
    score,
    source,
    opt_in: optInLabel,
  });
};

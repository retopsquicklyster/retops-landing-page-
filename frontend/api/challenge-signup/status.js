module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ detail: "Method not allowed" });
  }
  const webhookUrl = (process.env.GOOGLE_SHEETS_WEBHOOK_URL || "").trim();
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ configured: Boolean(webhookUrl) });
};

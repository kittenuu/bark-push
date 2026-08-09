export default async function handler(req, res) {
  const SECRET = process.env.PUSH_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_KEY;

  const { secret, app, event } = req.query;

  if (secret !== SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!app || !event) {
    return res.status(400).json({ error: "app and event required" });
  }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_logs`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({ app_name: app, event: event })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: t });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

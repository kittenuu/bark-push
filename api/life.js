export default async function handler(req, res) {
  const SECRET = process.env.PUSH_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_KEY;

  const q = req.query || {};
  const b = req.body || {};
  const secret = q.secret || b.secret;

  if (secret !== SECRET) {
    return res.status(401).end("unauthorized");
  }

  if (!SB_URL || !SB_KEY) {
    return res.status(500).end("missing env: " + (!SB_URL ? "SUPABASE_URL " : "") + (!SB_KEY ? "SUPABASE_KEY" : ""));
  }

  const row = {
    battery: b.battery ?? q.battery ?? null,
    weather: b.weather ?? q.weather ?? null,
    brightness: b.brightness ?? q.brightness ?? null,
    volume: b.volume ?? q.volume ?? null,
    device: b.device ?? q.device ?? null,
    note: b.note ?? q.note ?? null
  };

  // 数值统一转成字符串，避免类型不匹配
  for (const k of Object.keys(row)) {
    if (row[k] !== null && typeof row[k] !== "string") row[k] = String(row[k]);
  }

  if (Object.values(row).every(v => v === null || v === "")) {
    return res.status(400).end("no data");
  }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/phone_life`, {
      method: "POST",
      headers: {
        "apikey": SB_KEY,
        "Authorization": `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify(row)
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(200).end(`SUPABASE ERROR ${r.status}: ${text}`);
    }
    return res.status(200).end("ok " + text);
  } catch (e) {
    return res.status(200).end("FETCH ERROR: " + String(e));
  }
}

export default async function handler(req, res) {
  const SECRET = process.env.PUSH_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_KEY;

  // secret 既可以放 query 也可以放 body
  const q = req.query || {};
  const b = req.body || {};
  const secret = q.secret || b.secret;

  if (secret !== SECRET) {
    return res.status(401).end("unauthorized");
  }

  const row = {
    battery: b.battery ?? q.battery ?? null,
    weather: b.weather ?? q.weather ?? null,
    brightness: b.brightness ?? q.brightness ?? null,
    volume: b.volume ?? q.volume ?? null,
    device: b.device ?? q.device ?? null,
    note: b.note ?? q.note ?? null
  };

  // 全空就不写
  if (Object.values(row).every(v => v === null || v === "")) {
    return res.status(400).end("no data");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const writing = fetch(`${SB_URL}/rest/v1/phone_life`, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(row),
    signal: controller.signal
  }).catch(e => {
    console.error("phone_life write failed:", String(e));
  }).finally(() => clearTimeout(timer));

  res.status(200).end("ok");
  await writing;
}

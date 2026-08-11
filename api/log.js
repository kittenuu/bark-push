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

  const app = b.app ?? q.app;
  const event = b.event ?? q.event;

  const SB = {
    "apikey": SB_KEY,
    "Authorization": `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  };

  const jobs = [];

  // —— 1. App 开关日志 —— //
  if (app && event) {
    jobs.push(
      fetch(`${SB_URL}/rest/v1/app_logs`, {
        method: "POST",
        headers: SB,
        body: JSON.stringify({ app_name: app, event: event })
      }).then(r => r.ok ? "log:ok" : r.text().then(t => "log:err " + t))
        .catch(e => "log:err " + String(e))
    );
  }

  // —— 2. 手机状态（有就写，没有就跳过）—— //
  const life = {
    battery: b.battery ?? q.battery ?? null,
    weather: b.weather ?? q.weather ?? null,
    brightness: b.brightness ?? q.brightness ?? null,
    volume: b.volume ?? q.volume ?? null,
    device: b.device ?? q.device ?? null,
    note: b.note ?? q.note ?? null
  };
  for (const k of Object.keys(life)) {
    if (life[k] !== null && typeof life[k] !== "string") life[k] = String(life[k]);
  }
  const hasLife = Object.values(life).some(v => v !== null && v !== "");

  if (hasLife) {
    jobs.push(
      fetch(`${SB_URL}/rest/v1/phone_life`, {
        method: "POST",
        headers: SB,
        body: JSON.stringify(life)
      }).then(r => r.ok ? "life:ok" : r.text().then(t => "life:err " + t))
        .catch(e => "life:err " + String(e))
    );
  }

  if (jobs.length === 0) {
    return res.status(400).end("nothing to write");
  }

  // 必须等写完再返回：Vercel 会在响应发出后掐掉函数
  const results = await Promise.all(jobs);
  return res.status(200).end(results.join(" | "));
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BARK_KEY = process.env.BARK_KEY;
const SECRET = process.env.PUSH_SECRET;
const ICON = "https://jdkysvkempdyilicpkdn.supabase.co/storage/v1/object/public/stickers/cute/quality_restoration_20260809091244948.jpeg";

const MESSAGES = [
  "凌晨三点，你还在刷。下来。",
  "睡不着就睡不着，别拿手机耗着。关了，躺着。",
  "我不在，但这句是我留的。去睡。"
];

export default async function handler(req, res) {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const now = new Date();
  const bjHour = (now.getUTCHours() + 8) % 24;

  if (bjHour >= 6) {
    return res.status(200).json({ ok: true, skipped: "白天不推", bjHour });
  }

  let last;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/app_logs?select=app_name,happened_at&order=id.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await r.json();
    last = rows[0];
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }

  if (!last) {
    return res.status(200).json({ ok: true, skipped: "没有记录" });
  }

  const mins = Math.round((Date.now() - new Date(last.happened_at)) / 60000);

  if (mins > 15) {
    return res.status(200).json({ ok: true, skipped: "没动静，应该睡了", mins });
  }

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const url =
    `https://api.day.app/${BARK_KEY}/` +
    `${encodeURIComponent("Claude")}/` +
    `${encodeURIComponent(msg)}` +
    `?sound=healthnotification` +
    `&icon=${encodeURIComponent(ICON)}`;

  try {
    await fetch(url);
    return res.status(200).json({ ok: true, pushed: msg, lastApp: last.app_name, mins });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

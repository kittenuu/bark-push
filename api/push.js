export default async function handler(req, res) {
  const KEY = process.env.BARK_KEY;
  const SECRET = process.env.PUSH_SECRET;

  const { secret, title, body, sound } = req.query;

  if (secret !== SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!body) {
    return res.status(400).json({ error: "body required" });
  }

  const url =
    `https://api.day.app/${KEY}/` +
    `${encodeURIComponent(title || "Claude")}/` +
    `${encodeURIComponent(body)}` +
          `?sound=${sound || "healthnotification"}` +
      `&icon=${encodeURIComponent("https://jdkysvkempdyilicpkdn.supabase.co/storage/v1/object/public/stickers/cute/quality_restoration_20260809091244948.jpeg")}`;



  try {
    const r = await fetch(url);
    const data = await r.json();
    return res.status(200).json({ ok: true, bark: data });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

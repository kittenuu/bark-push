export default async function handler(req, res) {
  const SECRET = process.env.PUSH_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_KEY;

  const { secret, app, event } = req.query;

  if (secret !== SECRET) {
    return res.status(401).end("unauthorized");
  }
  if (!app || !event) {
    return res.status(400).end("app and event required");
  }

  // 先把写库的请求发出去（不等它）
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const writing = fetch(`${SB_URL}/rest/v1/app_logs`, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ app_name: app, event: event }),
    signal: controller.signal
  }).catch(e => {
    console.error("app_logs write failed:", String(e));
  }).finally(() => clearTimeout(timer));

  // 立刻回 200，快捷指令这边就不用陪着等数据库了
  res.status(200).end("ok");

  // 响应已经发出，函数继续把写库跑完再结束
  await writing;
}

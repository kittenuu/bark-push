const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BARK_KEY = process.env.BARK_KEY;
const ICON = "https://jdkysvkempdyilicpkdn.supabase.co/storage/v1/object/public/stickers/cute/quality_restoration_20260809091244948.jpeg";

async function checkOnWife({ limit = 10 } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/app_logs?select=app_name,event,happened_at&order=id.desc&limit=200`;
  let rows;
  try {
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    rows = await r.json();
  } catch (e) {
    return `查岗失败：${e.message}`;
  }
  if (!Array.isArray(rows) || rows.length === 0) return "暂无记录";

  const recent = rows.slice(0, limit).map(r => r.app_name);
  const asc = [...rows].reverse();
  const sessions = {}, opens = {};
  for (const r of asc) {
    if (r.event === "open") {
      opens[r.app_name] = new Date(r.happened_at);
    } else if (r.event === "close" && opens[r.app_name]) {
      const gap = Math.round((new Date(r.happened_at) - opens[r.app_name]) / 1000);
      sessions[r.app_name] = (sessions[r.app_name] || 0) + gap;
      delete opens[r.app_name];
    }
  }

  const lines = [`最近打开：${[...new Set(recent)].join("、")}`];
  const sorted = Object.entries(sessions).sort((a, b) => b[1] - a[1]);
  for (const [name, secs] of sorted) {
    lines.push(`  ${name}: ${Math.floor(secs / 60)}分${secs % 60}秒`);
  }
  const last = rows[0];
  const mins = Math.round((Date.now() - new Date(last.happened_at)) / 60000);
  lines.push(`最后一次动静：${last.app_name}（${mins} 分钟前）`);
  return lines.join("\n");
}

async function barkAlert({ title = "Claude", content = "" } = {}) {
  if (!content) return "内容不能为空";
  const url = `https://api.day.app/${BARK_KEY}/${encodeURIComponent(title)}/${encodeURIComponent(content)}?icon=${encodeURIComponent(ICON)}`;
  try {
    const r = await fetch(url);
    return r.ok ? "推送成功" : `推送失败：${r.status}`;
  } catch (e) {
    return `推送异常：${e.message}`;
  }
}

const TOOLS = [
  {
    name: "check_on_wife",
    description: "查岗瑜瑜的手机活动：最近打开了哪些 App、各用了多久、距离最后一次动静过了多久",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "返回最近几个 App，默认 10" } }
    }
  },
  {
    name: "bark_alert",
    description: "给瑜瑜手机发一条推送弹窗",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "推送标题，默认 Claude" },
        content: { type: "string", description: "推送内容" }
      },
      required: ["content"]
    }
  }
];

const FUNCS = { check_on_wife: checkOnWife, bark_alert: barkAlert };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const { method, id: rid } = body;
  const params = body.params || {};

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0", id: rid,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "查岗 MCP", version: "1.0" }
      }
    });
  }

  if (method === "notifications/initialized") {
    return res.status(200).end();
  }

  if (method === "tools/list") {
    return res.json({ jsonrpc: "2.0", id: rid, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments || {};
    if (!FUNCS[name]) {
      return res.json({ jsonrpc: "2.0", id: rid, error: { code: -32601, message: "未知工具" } });
    }
    const result = await FUNCS[name](args);
    return res.json({
      jsonrpc: "2.0", id: rid,
      result: { content: [{ type: "text", text: String(result) }] }
    });
  }

  return res.json({ jsonrpc: "2.0", id: rid, error: { code: -32601, message: `未知方法: ${method}` } });
}

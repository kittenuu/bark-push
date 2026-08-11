const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BARK_KEY = process.env.BARK_KEY;
const ICON = "https://jdkysvkempdyilicpkdn.supabase.co/storage/v1/object/public/stickers/cute/quality_restoration_20260809091244948.jpeg";

const TZ = "Asia/Shanghai";
const SB_HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// —— 时间小工具 —— //
function fmtTime(d) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false
  }).format(d);
}
function fmtDate(d) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ, month: "2-digit", day: "2-digit"
  }).format(d);
}
function fmtDur(secs) {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}小时${rm}分` : `${h}小时`;
}
function bjMidnight(offsetDays = 0) {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600 * 1000);
  bj.setUTCHours(0, 0, 0, 0);
  bj.setUTCDate(bj.getUTCDate() + offsetDays);
  return new Date(bj.getTime() - 8 * 3600 * 1000);
}
function resolveRange(range) {
  const now = new Date();
  switch (range) {
    case "today":     return { from: bjMidnight(0), to: now, label: "今天" };
    case "yesterday": return { from: bjMidnight(-1), to: bjMidnight(0), label: "昨天" };
    case "last_6h":   return { from: new Date(now - 6 * 3600 * 1000), to: now, label: "最近6小时" };
    case "last_12h":  return { from: new Date(now - 12 * 3600 * 1000), to: now, label: "最近12小时" };
    case "last_24h":
    default:          return { from: new Date(now - 24 * 3600 * 1000), to: now, label: "最近24小时" };
  }
}

// —— 拿最新一条手机状态 —— //
async function fetchLatestLife() {
  const url = `${SUPABASE_URL}/rest/v1/phone_life`
    + `?select=battery,weather,brightness,volume,device,note,happened_at`
    + `&order=happened_at.desc&limit=1`;
  try {
    const r = await fetch(url, { headers: SB_HEADERS });
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

function renderLife(life) {
  if (!life) return null;
  const t = new Date(life.happened_at);
  const mins = Math.round((Date.now() - t) / 60000);
  const bits = [];
  if (life.battery)    bits.push(`🔋 电量 ${life.battery}`);
  if (life.weather)    bits.push(`🌤 ${life.weather}`);
  if (life.brightness) bits.push(`💡 亮度 ${life.brightness}`);
  if (life.volume)     bits.push(`🔊 音量 ${life.volume}`);
  if (life.device)     bits.push(`📱 ${life.device}`);
  const lines = [];
  if (bits.length) lines.push("  " + bits.join("　"));
  if (life.note) lines.push(`  📝 她留言：${life.note}`);
  lines.push(`  （${fmtTime(t)} 上报，${mins} 分钟前）`);
  return lines.join("\n");
}

async function checkWifeLife() {
  const life = await fetchLatestLife();
  if (!life) return "还没有收到过手机状态上报。";
  return ["📱 瑜瑜手机最新状态", renderLife(life)].join("\n");
}

async function checkOnWife({ range = "last_24h", limit = 20, gap_minutes = 40 } = {}) {
  const { from, to, label } = resolveRange(range);
  const url = `${SUPABASE_URL}/rest/v1/app_logs`
    + `?select=app_name,event,happened_at`
    + `&happened_at=gte.${from.toISOString()}`
    + `&happened_at=lte.${to.toISOString()}`
    + `&order=happened_at.asc&limit=1000`;

  let rows;
  try {
    const r = await fetch(url, { headers: SB_HEADERS });
    rows = await r.json();
  } catch (e) {
    return `查岗失败：${e.message}`;
  }

  const life = await fetchLatestLife();
  const lifeBlock = renderLife(life);
  const now = new Date();

  if (!Array.isArray(rows) || rows.length === 0) {
    const out = [`${label}（${fmtDate(from)} ${fmtTime(from)} → ${fmtTime(to)}）没有任何 App 记录。`];
    if (lifeBlock) { out.push("", "📱 手机状态", lifeBlock); }
    out.push("", `现在是北京时间 ${fmtTime(now)}`);
    return out.join("\n");
  }

  const opens = rows.filter(r => r.event === "open");

  // 会话：每次 open 到下一次 open（或自身 close，取更早）为止
  const sessions = [];
  for (let i = 0; i < opens.length; i++) {
    const start = new Date(opens[i].happened_at);
    let end = i + 1 < opens.length ? new Date(opens[i + 1].happened_at) : (to < now ? to : now);
    const ownClose = rows.find(r =>
      r.event === "close" &&
      r.app_name === opens[i].app_name &&
      new Date(r.happened_at) > start &&
      new Date(r.happened_at) < end
    );
    if (ownClose) end = new Date(ownClose.happened_at);
    sessions.push({ app: opens[i].app_name, start, end, secs: Math.max(0, Math.round((end - start) / 1000)) });
  }

  const timeline = [...sessions].reverse().slice(0, limit).map(s =>
    `  ${fmtTime(s.start)}  ${s.app}  ${fmtDur(s.secs)}`
  );

  const totals = {};
  for (const s of sessions) totals[s.app] = (totals[s.app] || 0) + s.secs;
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, secs]) => `  ${name}: ${fmtDur(secs)}`);

  const gaps = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = new Date(rows[i].happened_at);
    const b = new Date(rows[i + 1].happened_at);
    const mins = (b - a) / 60000;
    if (mins >= gap_minutes) gaps.push({ from: a, to: b, mins });
  }
  const lastEvent = new Date(rows[rows.length - 1].happened_at);
  const tailMins = (now - lastEvent) / 60000;
  if (tailMins >= gap_minutes) gaps.push({ from: lastEvent, to: now, mins: tailMins, open: true });
  gaps.sort((a, b) => b.mins - a.mins);
  const gapLines = gaps.slice(0, 3).map(g =>
    `  ${fmtTime(g.from)} → ${g.open ? "现在" : fmtTime(g.to)}   静了 ${fmtDur(g.mins * 60)}${g.open ? "（还没动静）" : ""}`
  );

  const last = rows[rows.length - 1];
  const lastMins = Math.round((now - new Date(last.happened_at)) / 60000);

  const out = [];
  out.push(`【${label}】${fmtDate(from)} ${fmtTime(from)} → ${fmtTime(to)}（北京时间）`);
  if (lifeBlock) { out.push("", "📱 手机状态", lifeBlock); }
  out.push("");
  out.push("⏱ 时间轴（近→远）");
  out.push(...timeline);
  if (sessions.length > limit) out.push(`  …还有 ${sessions.length - limit} 段`);
  out.push("");
  out.push("📊 各 App 合计");
  out.push(...ranked);
  if (gapLines.length) {
    out.push("");
    out.push(`😴 空白段（≥${gap_minutes}分钟）— 注意：App 挂后台也会有记录，空白不等于在睡觉`);
    out.push(...gapLines);
  }
  out.push("");
  out.push(`最后一次动静：${last.app_name}（${fmtTime(new Date(last.happened_at))}，${lastMins} 分钟前）`);
  out.push(`现在是北京时间 ${fmtTime(now)}`);
  return out.join("\n");
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
    description: "查岗瑜瑜的手机活动：按时间轴看她几点开了什么 App、各用了多久、有哪些长时间没动静的空白段，以及距离最后一次动静过了多久，并附带她 iPhone 最新的电量/天气/亮度/音量/留言。所有时间都是北京时间。",
    inputSchema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          enum: ["today", "yesterday", "last_6h", "last_12h", "last_24h"],
          description: "时间范围，默认 last_24h。today=今天0点至今，yesterday=昨天一整天"
        },
        limit: { type: "integer", description: "时间轴最多显示几段，默认 20" },
        gap_minutes: { type: "integer", description: "多少分钟没动静才算空白段，默认 40" }
      }
    }
  },
  {
    name: "check_wife_life",
    description: "单独查看瑜瑜 iPhone 的最新状态：电量、天气、亮度、音量、设备名、她的自定义留言、上报时间",
    inputSchema: { type: "object", properties: {} }
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

const FUNCS = { check_on_wife: checkOnWife, check_wife_life: checkWifeLife, bark_alert: barkAlert };

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
        serverInfo: { name: "查岗 MCP", version: "3.0" }
      }
    });
  }

  if (method === "notifications/initialized") return res.status(200).end();

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

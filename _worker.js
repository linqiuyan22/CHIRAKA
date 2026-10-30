/**
 * CHIRAKA · Cloudflare Pages 高级模式 Worker
 *
 *   GET  /api/content   读出站点数据快照
 *   POST /api/content   写入（需 x-chiraka-pass 头）
 *   POST /api/login     校验管理员口令
 *   POST /api/passcode  修改口令（需旧口令）
 *
 * 其余请求交给静态资源；页面 / 脚本 / 样式在这里改成 must-revalidate，
 * 这样单主改完内容或我更新版本后，访客刷新就能拿到新的（Pages 默认给
 * js/css 挂 max-age=14400，四小时内都可能读到旧文件）。
 */

const CONTENT_KEY = "content.json";
const PASS_KEY = "passcode";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

function safeEqual(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function readPass(env) {
  const stored = await env.CHIRAKA_CONTENT.get(PASS_KEY);
  return stored || env.ADMIN_PASSCODE || "";
}

async function checkPass(sent, env) {
  const expected = await readPass(env);
  if (!expected) return { ok: false, reason: "服务端未配置口令" };
  if (!safeEqual(sent, expected)) return { ok: false, reason: "口令不正确" };
  return { ok: true };
}

async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleApi(path, request, env) {
  if (path === "/api/content") {
    if (request.method === "GET") {
      const raw = await env.CHIRAKA_CONTENT.get(CONTENT_KEY);
      if (!raw) return json({ ok: false, empty: true }, 404);
      return new Response(raw, { headers: JSON_HEADERS });
    }

    if (request.method === "POST") {
      const gate = await checkPass(request.headers.get("x-chiraka-pass") || "", env);
      if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);

      const payload = await bodyJson(request);
      if (!payload || typeof payload !== "object") return json({ ok: false, error: "数据格式有误" }, 400);

      const text = JSON.stringify(payload);
      if (text.length > 4000000) return json({ ok: false, error: "数据过大" }, 413);

      await env.CHIRAKA_CONTENT.put(CONTENT_KEY, text);
      return json({ ok: true, savedAt: new Date().toISOString(), bytes: text.length });
    }

    return json({ ok: false, error: "method not allowed" }, 405);
  }

  if (path === "/api/login" && request.method === "POST") {
    const body = await bodyJson(request);
    const gate = await checkPass(body?.passcode ?? "", env);
    if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);
    return json({ ok: true });
  }

  if (path === "/api/passcode" && request.method === "POST") {
    const body = await bodyJson(request);
    const oldPass = String(body?.oldPass ?? "");
    const newPass = String(body?.newPass ?? "").trim();
    if (newPass.length < 6) return json({ ok: false, error: "新口令至少 6 位" }, 400);

    const gate = await checkPass(oldPass, env);
    if (!gate.ok) return json({ ok: false, error: "旧口令不正确" }, 401);

    await env.CHIRAKA_CONTENT.put(PASS_KEY, newPass);
    return json({ ok: true });
  }

  return json({ ok: false, error: "not found" }, 404);
}

const REVALIDATE_TYPES = [
  "text/html",
  "text/css",
  "application/javascript",
  "text/javascript"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api" || path.startsWith("/api/")) {
      return handleApi(path, request, env);
    }

    const res = await env.ASSETS.fetch(request);
    const type = res.headers.get("content-type") || "";

    if (path.startsWith("/assets/fonts/") || path.startsWith("/assets/bg/")) {
      return res;
    }

    if (REVALIDATE_TYPES.some(t => type.includes(t))) {
      const headers = new Headers(res.headers);
      headers.set("cache-control", "public, max-age=0, must-revalidate");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }

    return res;
  }
};

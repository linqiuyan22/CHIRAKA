/**
 * CHIRAKA 内容接口（Cloudflare Pages Functions · 高级模式）
 *
 *   GET  /api/content   读出站点数据快照
 *   POST /api/content   写入（需 x-chiraka-pass 头）
 *   POST /api/login     校验管理员口令
 *   POST /api/passcode  修改口令（需旧口令）
 *
 * 口令优先级：KV 里的 passcode > 环境变量 ADMIN_PASSCODE。
 * 其余请求一律交给静态资源。
 */

const CONTENT_KEY = "content.json";
const PASS_KEY = "passcode";

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra
    }
  });

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

async function requirePass(request, env) {
  const sent = request.headers.get("x-chiraka-pass") || "";
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/content") {
      if (request.method === "GET") {
        const raw = await env.CHIRAKA_CONTENT.get(CONTENT_KEY);
        if (!raw) return json({ ok: false, empty: true }, 404);
        return new Response(raw, {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }

      if (request.method === "POST") {
        const gate = await requirePass(request, env);
        if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);

        const payload = await bodyJson(request);
        if (!payload || typeof payload !== "object") return json({ ok: false, error: "数据格式有误" }, 400);

        const text = JSON.stringify(payload);
        if (text.length > 4_000_000) return json({ ok: false, error: "数据过大" }, 413);

        await env.CHIRAKA_CONTENT.put(CONTENT_KEY, text);
        return json({ ok: true, savedAt: new Date().toISOString(), bytes: text.length });
      }

      return json({ ok: false, error: "method not allowed" }, 405);
    }

    if (path === "/api/login" && request.method === "POST") {
      const body = await bodyJson(request);
      const gate = await requirePass(
        new Request(request.url, { headers: { "x-chiraka-pass": body?.passcode ?? "" } }),
        env
      );
      if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);
      return json({ ok: true });
    }

    if (path === "/api/passcode" && request.method === "POST") {
      const body = await bodyJson(request);
      const oldPass = String(body?.oldPass ?? "");
      const newPass = String(body?.newPass ?? "").trim();
      if (newPass.length < 6) return json({ ok: false, error: "新口令至少 6 位" }, 400);

      const gate = await requirePass(
        new Request(request.url, { headers: { "x-chiraka-pass": oldPass } }),
        env
      );
      if (!gate.ok) return json({ ok: false, error: "旧口令不正确" }, 401);

      await env.CHIRAKA_CONTENT.put(PASS_KEY, newPass);
      return json({ ok: true });
    }

    return env.ASSETS.fetch(request);
  }
};

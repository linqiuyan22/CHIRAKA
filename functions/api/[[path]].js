/**
 * CHIRAKA 内容接口（Cloudflare Pages Functions · 目录模式）
 * 路由：/api/*
 *
 *   GET  /api/content   读出站点数据快照
 *   POST /api/content   写入（需 x-chiraka-pass 头）
 *   POST /api/login     校验管理员口令
 *   POST /api/passcode  修改口令（需旧口令）
 *
 * 页面与静态资源由 Pages 直接托管，不经过这里，所以 _headers 规则能正常生效。
 */

const CONTENT_KEY = "content.json";
const PASS_KEY = "passcode";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
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

export async function onRequest({ request, env, params }) {
  const route = (params.path || []).join("/");
  const method = request.method.toUpperCase();

  if (route === "content") {
    if (method === "GET") {
      const raw = await env.CHIRAKA_CONTENT.get(CONTENT_KEY);
      if (!raw) return json({ ok: false, empty: true }, 404);
      return new Response(raw, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (method === "POST") {
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

  if (route === "login" && method === "POST") {
    const body = await bodyJson(request);
    const gate = await checkPass(body?.passcode ?? "", env);
    if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);
    return json({ ok: true });
  }

  if (route === "passcode" && method === "POST") {
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

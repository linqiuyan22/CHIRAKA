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
const SAVED_AT_KEY = "savedAt";

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
      const savedAt = (await env.CHIRAKA_CONTENT.get(SAVED_AT_KEY)) || "";
      return new Response(raw, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-chiraka-saved-at": savedAt
        }
      });
    }

    if (request.method === "POST") {
      const gate = await checkPass(request.headers.get("x-chiraka-pass") || "", env);
      if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);

      const payload = await bodyJson(request);
      if (!payload || typeof payload !== "object") return json({ ok: false, error: "数据格式有误" }, 400);

      const text = JSON.stringify(payload);
      if (text.length > 4000000) return json({ ok: false, error: "数据过大" }, 413);

      await env.CHIRAKA_CONTENT.put(CONTENT_KEY, text);
      const savedAt = new Date().toISOString();
      await env.CHIRAKA_CONTENT.put(SAVED_AT_KEY, savedAt);
      return json({ ok: true, savedAt, bytes: text.length });
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

async function handleNetease(url) {
  const songId = (url.searchParams.get("id") || "").trim();
  const playlistId = (url.searchParams.get("playlist") || "").trim();
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    referer: "https://music.163.com/",
    accept: "application/json, text/plain, */*"
  };

  try {
    if (/^\d+$/.test(songId)) {
      const api = `https://music.163.com/api/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
      const res = await fetch(api, { headers });
      const data = await res.json();
      const song = data?.songs?.[0];
      if (!song) return json({ ok: false, error: "没解析到这首歌，检查一下链接" }, 404);
      const durationMs = song.duration || 0;
      const mm = String(Math.floor(durationMs / 60000)).padStart(2, "0");
      const ss = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, "0");
      return json({
        ok: true,
        kind: "song",
        id: songId,
        title: song.name || "",
        artist: (song.artists || []).map(a => a.name).filter(Boolean).join(" / "),
        cover: song.album?.picUrl || "",
        duration: durationMs ? `${mm}:${ss}` : "",
        album: song.album?.name || ""
      });
    }

    if (/^\d+$/.test(playlistId)) {
      const api = `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=1000`;
      const res = await fetch(api, { headers });
      const data = await res.json();
      const pl = data?.playlist;
      if (!pl) return json({ ok: false, error: "没解析到这个歌单，检查一下链接" }, 404);
      return json({
        ok: true,
        kind: "playlist",
        id: playlistId,
        title: pl.name || "",
        trackCount: pl.trackCount || (pl.tracks || []).length || 0,
        cover: pl.coverImgUrl || "",
        creator: pl.creator?.nickname || ""
      });
    }

    return json({ ok: false, error: "链接里没找到歌曲或歌单 id" }, 400);
  } catch (e) {
    return json({ ok: false, error: "解析失败：" + String(e && e.message ? e.message : e) }, 502);
  }
}

/**
 * 媒体托管：直接复用已绑定的 KV（CHIRAKA_CONTENT），不额外开存储服务。
 *   POST /api/audio | /api/image   上传（需 x-chiraka-pass）
 *   GET  /api/audio/<key>  播放，自己按 Range 切片，所以能拖进度条
 *   GET  /api/image/<key>  直出图片，长缓存
 */
const BLOB_KINDS = {
  audio: {
    prefix: "audio/",
    maxBytes: 20 * 1024 * 1024,
    defaultType: "audio/mpeg",
    emptyError: "没有收到音频文件",
    sizeError: "单个音频请控制在 20MB 以内（约 20 分钟 mp3）"
  },
  image: {
    prefix: "image/",
    maxBytes: 12 * 1024 * 1024,
    defaultType: "image/jpeg",
    emptyError: "没有收到图片文件",
    sizeError: "单张图片请控制在 12MB 以内"
  }
};

async function handleBlob(kind, path, request, env) {
  const conf = BLOB_KINDS[kind];
  if (!conf) return json({ ok: false, error: "未知的媒体类型" }, 404);
  const apiBase = `/api/${kind}/`;
  const kv = env.CHIRAKA_CONTENT;
  if (!kv) return json({ ok: false, error: "存储未配置" }, 503);

  if (request.method === "GET" || request.method === "HEAD") {
    const rawKey = decodeURIComponent(path.slice(apiBase.length));
    if (!rawKey) return json({ ok: false, error: "缺少文件 key" }, 400);
    const key = rawKey.startsWith(conf.prefix) ? rawKey : conf.prefix + rawKey;

    const got = await kv.getWithMetadata(key, "arrayBuffer");
    if (!got || !got.value) return new Response("Not found", { status: 404 });

    const buf = got.value;
    const total = buf.byteLength;
    const meta = got.metadata || {};
    const type = meta.contentType || conf.defaultType;
    const baseHeaders = {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
      "accept-ranges": "bytes",
      "access-control-allow-origin": "*"
    };

    const range = request.headers.get("range");
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
    if (m && (m[1] || m[2])) {
      let start;
      let end;
      if (m[1]) {
        start = parseInt(m[1], 10);
        end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      } else {
        const suffix = parseInt(m[2], 10);
        start = Math.max(total - suffix, 0);
        end = total - 1;
      }
      if (start > end || start >= total) {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, "content-range": `bytes */${total}` }
        });
      }
      const chunk = buf.slice(start, end + 1);
      return new Response(request.method === "HEAD" ? null : chunk, {
        status: 206,
        headers: {
          ...baseHeaders,
          "content-range": `bytes ${start}-${end}/${total}`,
          "content-length": String(chunk.byteLength)
        }
      });
    }

    return new Response(request.method === "HEAD" ? null : buf, {
      headers: { ...baseHeaders, "content-length": String(total) }
    });
  }

  if (request.method === "POST") {
    const gate = await checkPass(request.headers.get("x-chiraka-pass") || "", env);
    if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);

    const contentType = request.headers.get("content-type") || "";
    let bytes;
    let filename = kind === "image" ? "art.jpg" : "audio.mp3";
    let type = conf.defaultType;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") return json({ ok: false, error: conf.emptyError }, 400);
      filename = file.name || filename;
      type = file.type || type;
      bytes = await file.arrayBuffer();
    } else {
      filename = request.headers.get("x-filename") || filename;
      type = contentType || type;
      bytes = await request.arrayBuffer();
    }

    if (!bytes || bytes.byteLength === 0) return json({ ok: false, error: "文件是空的" }, 400);
    if (bytes.byteLength > conf.maxBytes) {
      return json({ ok: false, error: conf.sizeError }, 413);
    }

    const safeName = filename.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(-48);
    const key = `${conf.prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    await kv.put(key, bytes, {
      metadata: { contentType: type, size: bytes.byteLength, filename: safeName, uploadedAt: new Date().toISOString() }
    });

    return json({ ok: true, url: `${apiBase}${encodeURIComponent(key.slice(conf.prefix.length))}`, key, size: bytes.byteLength });
  }

  return json({ ok: false, error: "method not allowed" }, 405);
}

function handleAudio(path, request, env) {
  return handleBlob("audio", path, request, env);
}

function handleImage(path, request, env) {
  return handleBlob("image", path, request, env);
}

/* 内网地址不允许抓取（避免被当成跳板去访问本机/内网） */
function isBlockedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "[::1]" || h === "0.0.0.0") return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * 外链转存：从别处（画加、图床之类）拖过来的图，抓回来存进自己的 KV。
 * 这样原站删图、加防盗链、签名过期，站上的图都不会跟着消失。
 *   POST /api/image-from-url  { url }  需 x-chiraka-pass
 */
async function handleImageFromUrl(request, env) {
  const kv = env.CHIRAKA_CONTENT;
  if (!kv) return json({ ok: false, error: "存储未配置" }, 503);
  if (request.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  const gate = await checkPass(request.headers.get("x-chiraka-pass") || "", env);
  if (!gate.ok) return json({ ok: false, error: gate.reason }, 401);

  const payload = await bodyJson(request);
  const raw = payload && typeof payload.url === "string" ? payload.url.trim() : "";
  if (!raw) return json({ ok: false, error: "缺少图片链接" }, 400);

  let target;
  try {
    target = new URL(raw);
  } catch (e) {
    return json({ ok: false, error: "图片链接格式不对" }, 400);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return json({ ok: false, error: "只支持 http / https 图片链接" }, 400);
  }
  if (isBlockedHost(target.hostname)) {
    return json({ ok: false, error: "这个地址不允许抓取" }, 400);
  }

  let res;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
  try {
    // 有些原站会挂住不回，用 race 兜底：到点就当作抓不到，别让页面一直转
    res = await Promise.race([
      fetch(target.toString(), {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        },
        redirect: "follow",
        signal: controller ? controller.signal : undefined
      }).catch(error => ({ __failed: error })),
      new Promise(resolve => setTimeout(() => resolve({ __timeout: true }), 12000))
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res || res.__timeout) {
    return json({ ok: false, error: "抓取超时，原站一直没回应" }, 504);
  }
  if (res.__failed) {
    const aborted = res.__failed && (res.__failed.name === "AbortError" || String(res.__failed).indexOf("abort") >= 0);
    return json({ ok: false, error: aborted ? "抓取超时，原站一直没回应" : "抓不到这张图，可能原站不让外链" }, 502);
  }

  if (!res.ok) return json({ ok: false, error: `原站返回 ${res.status}，抓不到图` }, 502);

  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) {
    return json({ ok: false, error: `这个链接不是图片（${type || "未知类型"}）` }, 415);
  }

  const declared = Number(res.headers.get("content-length") || 0);
  if (declared && declared > BLOB_KINDS.image.maxBytes) {
    return json({ ok: false, error: BLOB_KINDS.image.sizeError }, 413);
  }

  const bytes = await res.arrayBuffer();
  if (!bytes || !bytes.byteLength) return json({ ok: false, error: "抓回来是空的" }, 502);
  if (bytes.byteLength > BLOB_KINDS.image.maxBytes) {
    return json({ ok: false, error: BLOB_KINDS.image.sizeError }, 413);
  }

  let name = "external";
  try {
    const last = decodeURIComponent(target.pathname.split("/").pop() || "");
    if (last) name = last.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(-48) || "external";
  } catch (e) {}
  const key = `${BLOB_KINDS.image.prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
  await kv.put(key, bytes, {
    metadata: {
      contentType: type,
      size: bytes.byteLength,
      filename: name,
      sourceUrl: target.toString(),
      uploadedAt: new Date().toISOString()
    }
  });

  return json({
    ok: true,
    url: `/api/image/${encodeURIComponent(key.slice(BLOB_KINDS.image.prefix.length))}`,
    size: bytes.byteLength,
    contentType: type,
    sourceUrl: target.toString()
  });
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
      if (path === "/api/netease") return handleNetease(url);
      if (path === "/api/image-from-url") return handleImageFromUrl(request, env);
      if (path === "/api/audio" || path.startsWith("/api/audio/")) return handleAudio(path, request, env);
      if (path === "/api/image" || path.startsWith("/api/image/")) return handleImage(path, request, env);
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

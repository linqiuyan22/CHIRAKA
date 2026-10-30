const DEFAULT_DATA = JSON.parse(JSON.stringify(window.CHIRAKA_DATA || { home: {}, characters: [], news: [], gallery: [], stations: [], tracks: [] }));
const STORAGE_DATA_KEY = "chiraka_custom_data_v2";
const STORAGE_AUTH_KEY = "chiraka_auth_mode_v1";
const STORAGE_PASS_KEY = "chiraka_admin_pass_v1";
const STORAGE_API_KEY = "chiraka_remote_api_url_v1";

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeStorageSet(key, val) {
  try {
    window.localStorage.setItem(key, val);
    return true;
  } catch (e) {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) {}
}

function normalizeLoadedData(parsed, base) {
  if (!parsed || typeof parsed !== "object") return base;
  return {
    home: parsed.home ? { ...base.home, ...parsed.home, folders: Array.isArray(parsed.home.folders) ? parsed.home.folders : base.home.folders } : base.home,
    characters: Array.isArray(parsed.characters) ? parsed.characters : base.characters,
    news: Array.isArray(parsed.news) ? parsed.news : base.news,
    gallery: Array.isArray(parsed.gallery) ? parsed.gallery : base.gallery,
    stations: Array.isArray(parsed.stations) && parsed.stations.length ? parsed.stations : base.stations,
    tracks: Array.isArray(parsed.tracks) ? parsed.tracks : base.tracks
  };
}

function loadInitialData() {
  const base = JSON.parse(JSON.stringify(DEFAULT_DATA));
  const raw = safeStorageGet(STORAGE_DATA_KEY);
  if (!raw) return base;
  try {
    return normalizeLoadedData(JSON.parse(raw), base);
  } catch (e) {
    return base;
  }
}

const DATA = loadInitialData();
window.CHIRAKA_DATA = DATA;

const authState = {
  mode: safeStorageGet(STORAGE_AUTH_KEY) === "admin" ? "admin" : "guest",
  getPasscode() {
    return safeStorageGet(STORAGE_PASS_KEY) || "";
  },
  setPasscode(newPass) {
    if (newPass && newPass.trim()) {
      safeStorageSet(STORAGE_PASS_KEY, newPass.trim());
    }
  },
  getApiUrl() {
    return safeStorageGet(STORAGE_API_KEY) || window.CHIRAKA_DATA_CONFIG?.apiEndpoint || "/api/content";
  },
  setApiUrl(url) {
    if (url !== undefined) {
      safeStorageSet(STORAGE_API_KEY, url.trim());
    }
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function isPendingValue(val) {
  const s = String(val ?? "").trim();
  return !s || s.includes("待补充");
}

function wrapPendingHtml(val, editAttr = "") {
  const text = escapeHtml(val);
  if (isPendingValue(val)) {
    return `<span class="is-pending-field" ${editAttr} title="管理员模式下点击直接修改">${text || "待补充"}</span>`;
  }
  return text;
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function resolveImg(path) {
  if (!path) return "";
  return window.CHIRAKA_IMAGE_MAP?.[path] || path;
}

const PRESET_IMAGES = [
  { label: "落日天际线", path: "assets/bg/city-sunset.jpg" },
  { label: "西海岸街景", path: "assets/bg/city-street.jpg" },
  { label: "棕榈海滩", path: "assets/bg/city-beach-reference.jpg" },
  { label: "跨海大桥", path: "assets/bg/city-bridge-reference.jpg" },
  { label: "霓虹电视墙", path: "assets/bg/city-neon-tv.jpg" }
];

const TONE_OPTIONS = [
  { value: "pink", label: "落日洋红 (Pink)" },
  { value: "cyan", label: "海岸霓虹青 (Cyan)" },
  { value: "violet", label: "暮色紫罗兰 (Violet)" },
  { value: "orange", label: "琥珀落日橙 (Orange)" },
  { value: "mint", label: "薄荷苏打绿 (Mint)" },
  { value: "gold", label: "维加斯流金 (Gold)" }
];

function getCharacterById(charId) {
  if (!charId) return null;
  return (DATA.characters || []).find(c => c.id === charId) || null;
}

function getCharacterDisplayName(charObj) {
  if (!charObj) return "未绑定角色";
  if (!isPendingValue(charObj.name)) return `${charObj.label} · ${charObj.name}`;
  return charObj.label;
}

function navigateToCharacter(charId) {
  if (!charId) return;
  if (window.CHIRAKA_SPA_MODE) {
    openSpaCharacter(charId);
  } else {
    window.location.href = `character.html?id=${encodeURIComponent(charId)}`;
  }
}

function navigateToArticle(newsId) {
  if (!newsId) return;
  if (window.CHIRAKA_SPA_MODE) {
    openSpaArticle(newsId);
  } else {
    window.location.href = `article.html?id=${encodeURIComponent(newsId)}`;
  }
}

function navigateToRadioTrack(trackId) {
  const idx = (DATA.tracks || []).findIndex(t => t.id === trackId);
  if (window.CHIRAKA_SPA_MODE) {
    switchSpaView("radio");
    if (idx >= 0) chooseTrack(idx, true);
  } else {
    window.location.href = "radio.html";
  }
}

/* ---------- 远程数据分离同步层 (Data & Framework Separation) ---------- */
async function tryLoadFromRemoteServer() {
  if (window.CHIRAKA_SPA_MODE && window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return;
  }
  const apiUrl = authState.getApiUrl();
  if (!apiUrl) return;
  try {
    const res = await window.fetch(apiUrl, { cache: "no-store" });
    if (res && res.ok) {
      const remoteData = await res.json();
      const merged = normalizeLoadedData(remoteData, DEFAULT_DATA);
      Object.assign(DATA, merged);
      safeStorageSet(STORAGE_DATA_KEY, JSON.stringify(DATA));
      const syncEl = $("#admin-sync-indicator");
      if (syncEl) syncEl.textContent = "☁ 已连接远程数据接口 · 实时读写分离";
      refreshAllViews();
    }
  } catch (e) {
    // 静态托管或离线预览时自动使用独立 JSON 快照与本地存储
  }
}

async function syncDataToRemoteServer() {
  const apiUrl = authState.getApiUrl();
  const syncEl = $("#admin-sync-indicator");
  if (!apiUrl || window.location.protocol === "file:") return false;
  try {
    const res = await window.fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-chiraka-pass": authState.getPasscode()
      },
      body: JSON.stringify(DATA)
    });
    if (res && res.ok) {
      if (syncEl) syncEl.textContent = "☁ 已同步写入服务器 content-data.json";
      return true;
    }
  } catch (e) {}
  if (syncEl) syncEl.textContent = "☁ 数据与框架已分离 · 修改已自动持久化";
  return false;
}

/* 口令校验走服务端；返回 true/false/null（null = 服务端不可达，退回本地校验） */
async function verifyPasscodeOnServer(passcode) {
  const apiUrl = authState.getApiUrl();
  if (!apiUrl || window.location.protocol === "file:") return null;
  const loginUrl = apiUrl.replace(/\/content\/?$/, "/login");
  if (loginUrl === apiUrl) return null;
  try {
    const res = await window.fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode })
    });
    if (res.status === 401) return false;
    return !!(res && res.ok);
  } catch (e) {
    return null;
  }
}

async function changePasscodeOnServer(oldPass, newPass) {
  const apiUrl = authState.getApiUrl();
  if (!apiUrl || window.location.protocol === "file:") return null;
  const passUrl = apiUrl.replace(/\/content\/?$/, "/passcode");
  if (passUrl === apiUrl) return null;
  try {
    const res = await window.fetch(passUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPass, newPass })
    });
    return !!(res && res.ok);
  } catch (e) {
    return null;
  }
}

function saveSiteData(toastMsg = "✓ 修改已保存并同步至独立数据层") {
  safeStorageSet(STORAGE_DATA_KEY, JSON.stringify(DATA));
  refreshAllViews();
  syncDataToRemoteServer();
  if (toastMsg) showToast(toastMsg);
}

function getArchiveFolders() {
  if (!DATA.home) DATA.home = {};
  if (!Array.isArray(DATA.home.folders) || !DATA.home.folders.length) {
    DATA.home.folders = JSON.parse(JSON.stringify(DEFAULT_DATA.home.folders));
  }
  return DATA.home.folders;
}

let currentHomeDrawer = 0;
let slideTimeout = null;
let currentCharacterId = "ch-01";
let currentArticleId = "n-01";
let currentGalleryId = "g-01";

function countPendingItems() {
  const list = [];
  (DATA.characters || []).forEach(c => {
    const missing = [];
    if (isPendingValue(c.name)) missing.push("姓名");
    if (isPendingValue(c.gender)) missing.push("性别");
    if (isPendingValue(c.birthday)) missing.push("生日");
    if (isPendingValue(c.zodiac)) missing.push("星座");
    if (isPendingValue(c.identity)) missing.push("身份");
    if (!c.image) missing.push("立绘插画");
    if (isPendingValue(c.summary)) missing.push("档案摘要");
    if (isPendingValue(c.appearance)) missing.push("外观设定");
    if (missing.length) {
      list.push({
        type: "character",
        id: c.id,
        title: `【角色档案】${getCharacterDisplayName(c)}`,
        detail: `待补充：${missing.join("、")}`
      });
    }
  });

  (DATA.news || []).forEach(n => {
    const missing = [];
    if (isPendingValue(n.title)) missing.push("标题");
    if (isPendingValue(n.summary)) missing.push("摘要");
    if (!n.body || !n.body.length || n.body.some(p => isPendingValue(p))) missing.push("正文");
    if (missing.length) {
      list.push({
        type: "news",
        id: n.id,
        title: `【${n.postType === "forum" ? "街头论坛" : "城市新闻"}】${isPendingValue(n.title) ? n.id.toUpperCase() : n.title}`,
        detail: `待补充：${missing.join("、")}`
      });
    }
  });

  (DATA.gallery || []).forEach(g => {
    const missing = [];
    if (!g.src) missing.push("插画原图");
    if (isPendingValue(g.story)) missing.push("分镜故事");
    if (missing.length) {
      list.push({
        type: "gallery",
        id: g.id,
        title: `【插画画廊】${g.title}`,
        detail: `待补充：${missing.join("、")}`
      });
    }
  });

  (DATA.tracks || []).forEach((t, idx) => {
    if (!t.src) {
      list.push({
        type: "track",
        id: String(idx),
        title: `【城市电台】${t.title} — ${t.artist}`,
        detail: "待补充：音频文件 (src)"
      });
    }
  });

  return list;
}

function updateAuthUI() {
  const isAdmin = authState.mode === "admin";
  document.body.classList.toggle("is-admin", isAdmin);
  document.body.classList.toggle("is-guest", !isAdmin);

  const statusText = $("#auth-status-text");
  if (statusText) {
    statusText.textContent = isAdmin ? "管理员 · ADMIN" : "访客模式 · GUEST";
  }

  const guestCard = $("#auth-guest-card");
  const adminCard = $("#auth-admin-card");
  if (guestCard) guestCard.classList.toggle("is-current-mode", !isAdmin);
  if (adminCard) adminCard.classList.toggle("is-current-mode", isAdmin);

  const switchGuestBtn = $("#switch-guest-btn");
  if (switchGuestBtn) {
    switchGuestBtn.innerHTML = !isAdmin
      ? `<span>当前正在使用访客模式</span><b>✓</b>`
      : `<span>切回访客浏览模式</span><b>→</b>`;
  }

  const pendingList = countPendingItems();
  const countEl = $("#admin-pending-count");
  if (countEl) countEl.textContent = String(pendingList.length);
}

function setAuthMode(mode, silent = false) {
  authState.mode = mode === "admin" ? "admin" : "guest";
  safeStorageSet(STORAGE_AUTH_KEY, authState.mode);
  updateAuthUI();
  refreshAllViews();
  if (!silent) {
    showToast(
      authState.mode === "admin"
        ? "✦ 已进入管理员模式：可直接点击各处封面图、「待补充」或编辑按钮修改内容"
        : "👁 已切换至访客浏览模式（只读视图）"
    );
  }
}

/* ---------- 00 城市首页 ---------- */
function renderHomeHero() {
  const h = DATA.home || {};
  const overlineEl = $("#home-overline-text");
  if (overlineEl && h.overline) overlineEl.textContent = h.overline;
  const titleEl = $("#home-main-title-text");
  if (titleEl && h.title) titleEl.textContent = h.title;
  const subEl = $("#home-intro-script");
  if (subEl && h.subtitle) subEl.textContent = h.subtitle;
  const cnEl = $("#home-motto-cn");
  if (cnEl && h.mottoCn) {
    cnEl.innerHTML = escapeHtml(h.mottoCn).replace(/\n/g, "<br>");
  }
  const enEl = $("#home-motto-en");
  if (enEl && h.mottoEn) enEl.textContent = h.mottoEn;

  const backdropEl = $(".summer-backdrop");
  if (backdropEl && h.backdrop) {
    backdropEl.style.backgroundImage = `url('${resolveImg(h.backdrop)}')`;
  }
}

const DEFAULT_ENTER_TEXTS = {
  "01": "调阅人物卷宗 // DOSSIER",
  "02": "潜入新闻与论坛 // CITY BBS",
  "03": "展开视觉分镜 // GALLERY",
  "04": "接入午夜电台 // TUNE IN"
};

function selectHomeDrawer(index, instant = false) {
  const folders = getArchiveFolders();
  const folder = folders[index] || folders[0];
  if (!folder) return;
  currentHomeDrawer = index;

  const sheet = $("#file-sheet");
  const panel = $("#drawer-case");
  const clueBtns = $$("[data-mini-drawer]");

  clueBtns.forEach(btn => {
    btn.classList.toggle("is-active", Number(btn.dataset.miniDrawer) === index);
  });

  if (panel) panel.dataset.theme = folder.theme;
  if (sheet) {
    sheet.classList.remove("is-sliding");
    if (slideTimeout) window.clearTimeout(slideTimeout);
    if (!instant && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void sheet.offsetWidth;
      sheet.classList.add("is-sliding");
      slideTimeout = window.setTimeout(() => sheet.classList.remove("is-sliding"), 380);
    }
  }

  if ($("#file-num")) $("#file-num").textContent = folder.index;
  if ($("#file-heading")) $("#file-heading").textContent = folder.label;
  if ($("#file-english")) $("#file-english").textContent = folder.english;
  if ($("#file-description")) $("#file-description").textContent = folder.desc;
  if ($("#file-kicker")) $("#file-kicker").textContent = folder.kicker;
  if ($("#file-signature")) $("#file-signature").textContent = folder.signature;
  if ($("#file-counter")) $("#file-counter").textContent = `DOSSIER · ${folder.index} / 04`;
  if ($("#file-photo-label")) $("#file-photo-label").textContent = folder.photoLabel;

  const photoImg = $("#file-photo-img");
  if (photoImg && folder.photo) {
    photoImg.src = resolveImg(folder.photo);
  }

  const pillsHost = $("#file-pills");
  if (pillsHost) {
    pillsHost.innerHTML = (folder.pills || []).map(p => `<span class="sheet-pill">${escapeHtml(p)}</span>`).join("");
  }

  const enterBtn = $("#file-enter");
  if (enterBtn) {
    const btnLabel = folder.enterText || DEFAULT_ENTER_TEXTS[folder.index] || `进入${folder.label} // OPEN`;
    enterBtn.innerHTML = `${escapeHtml(btnLabel)} <span aria-hidden="true">↗</span>`;
    if (window.CHIRAKA_SPA_MODE) {
      enterBtn.setAttribute("href", `#${folder.view}`);
      enterBtn.dataset.spaTarget = folder.view;
    } else {
      enterBtn.setAttribute("href", folder.url);
    }
  }
}

/* ---------- 首页档案自动轮播 ---------- */
const homeCarousel = {
  timer: null,
  paused: false,
  intervalMs: 6500,
  userStopped: false
};

function playHomeCarousel() {
  stopHomeCarousel();
  if (homeCarousel.userStopped) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  homeCarousel.timer = window.setInterval(() => {
    if (homeCarousel.paused || document.hidden) return;
    if (document.querySelector("dialog[open]")) return;
    const folders = getArchiveFolders();
    if (folders.length < 2) return;
    selectHomeDrawer((currentHomeDrawer + 1) % folders.length, false);
  }, homeCarousel.intervalMs);
}

function stopHomeCarousel() {
  if (homeCarousel.timer) {
    window.clearInterval(homeCarousel.timer);
    homeCarousel.timer = null;
  }
}

function setHomeCarouselPaused(paused) {
  homeCarousel.paused = paused;
  const switcher = $(".board-clue-switcher");
  if (switcher) switcher.classList.toggle("is-paused", paused);
}

function initHomeCarousel() {
  const caseEl = $("#drawer-case");
  const switcher = $(".board-clue-switcher");
  if (switcher) switcher.style.setProperty("--home-carousel-ms", `${homeCarousel.intervalMs}ms`);

  // 鼠标悬停 / 键盘聚焦时暂停，走开继续
  caseEl?.addEventListener("pointerenter", () => setHomeCarouselPaused(true));
  caseEl?.addEventListener("pointerleave", () => setHomeCarouselPaused(false));
  caseEl?.addEventListener("focusin", () => setHomeCarouselPaused(true));
  caseEl?.addEventListener("focusout", () => {
    if (!caseEl.contains(document.activeElement)) setHomeCarouselPaused(false);
  });
  // 触摸设备按下时先停，抬手后继续
  caseEl?.addEventListener("touchstart", () => setHomeCarouselPaused(true), { passive: true });
  caseEl?.addEventListener("touchend", () => window.setTimeout(() => setHomeCarouselPaused(false), 2500), { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopHomeCarousel();
    else playHomeCarousel();
  });

  // 编辑弹窗开着时停转，避免关窗后卷宗已经换了内容对不上
  const editorDialog = $("#editor-dialog");
  if (editorDialog) {
    editorDialog.addEventListener("close", () => playHomeCarousel());
  }

  playHomeCarousel();
}

function initHome() {
  renderHomeHero();
  selectHomeDrawer(currentHomeDrawer, true);
  $$("[data-mini-drawer]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.miniDrawer);
      selectHomeDrawer(idx, false);
      playHomeCarousel(); // 手动切换后重置计时，避免刚点完就自动跳走
    });
  });
  initHomeCarousel();

  $("#edit-home-hero-btn")?.addEventListener("click", () => openEditorModal("home-hero"));
  $("#replace-home-bg-btn")?.addEventListener("click", () => openEditorModal("home-hero", null, "ed-home-backdrop"));
  $("#edit-home-folder-btn")?.addEventListener("click", () => openEditorModal("home-folder", currentHomeDrawer));
  $("#replace-home-cover-btn")?.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    openEditorModal("home-folder", currentHomeDrawer, "ed-folder-photo");
  });
}

/* ---------- 04 城市电台 (支持多频段电台管理 + 歌曲新增编辑 + 角色印象曲联动) ---------- */
const radio = {
  get tracks() {
    return DATA.tracks || [];
  },
  get stations() {
    if (!Array.isArray(DATA.stations) || !DATA.stations.length) {
      DATA.stations = JSON.parse(JSON.stringify(DEFAULT_DATA.stations));
    }
    return DATA.stations;
  },
  current: 0,
  playing: false,
  demo: false,
  synthActive: false,
  favorites: new Set([0]),
  stationFilter: "all",
  navMode: "all",
  demoProgress: 28,
  demoTimer: null,
  audio: new Audio()
};
radio.audio.preload = "none";

let synthCtx = null;
let synthInterval = null;

function startSunsetSynth() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    if (!synthCtx) synthCtx = new AC();
    if (synthCtx.state === "suspended") synthCtx.resume();
    stopSunsetSynth(false);

    const chords = [
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 392.0],
      [164.81, 196.0, 246.94, 329.63]
    ];
    let chordIdx = 0;

    const playChord = () => {
      if (!radio.synthActive || !(radio.playing || radio.demo)) return;
      const now = synthCtx.currentTime;
      const freqs = chords[chordIdx % chords.length];
      chordIdx++;
      freqs.forEach((f, i) => {
        const osc = synthCtx.createOscillator();
        const gain = synthCtx.createGain();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(f, now);
        const vol = (Number($("#volume-slider")?.value ?? 75) / 100) * 0.035;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
        osc.connect(gain);
        gain.connect(synthCtx.destination);
        osc.start(now);
        osc.stop(now + 2.7);
      });
    };

    playChord();
    synthInterval = window.setInterval(playChord, 2600);
  } catch (e) {}
}

function stopSunsetSynth(resetFlag = true) {
  if (synthInterval) {
    window.clearInterval(synthInterval);
    synthInterval = null;
  }
  if (resetFlag) radio.synthActive = false;
}

function startDemoTicker() {
  if (radio.demoTimer) window.clearInterval(radio.demoTimer);
  radio.demoTimer = window.setInterval(() => {
    if (!(radio.playing || radio.demo)) return;
    radio.demoProgress = (radio.demoProgress + 0.6) % 100;
    updateProgressUI();
  }, 300);
}

function parseDurationSeconds(str) {
  const parts = String(str || "03:42").split(":").map(Number);
  return (parts[0] || 3) * 60 + (parts[1] || 42);
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function updateProgressUI() {
  const bar = $("#progress-bar");
  const currentTime = $("#time-current");
  const totalTime = $("#time-total");
  const vinylTime = $("#vinyl-time-display");
  const track = radio.tracks[radio.current];
  const totalSec = parseDurationSeconds(track?.duration || "03:42");

  if (radio.audio.src && Number.isFinite(radio.audio.duration) && radio.audio.duration > 0) {
    const pct = (radio.audio.currentTime / radio.audio.duration) * 100;
    if (bar) bar.style.width = `${pct}%`;
    const curStr = formatTime(radio.audio.currentTime);
    const totStr = formatTime(radio.audio.duration);
    if (currentTime) currentTime.textContent = curStr;
    if (totalTime) totalTime.textContent = totStr;
    if (vinylTime) vinylTime.textContent = `${curStr} / ${totStr}`;
    return;
  }

  const pct = (radio.playing || radio.demo) ? radio.demoProgress : 24;
  if (bar) bar.style.width = `${pct}%`;
  const curSec = Math.floor((pct / 100) * totalSec);
  const curStr = (radio.playing || radio.demo) ? formatTime(curSec) : "00:00";
  const totStr = track?.duration || "03:42";
  if (currentTime) currentTime.textContent = curStr;
  if (totalTime) totalTime.textContent = totStr;
  if (vinylTime) vinylTime.textContent = `${curStr} / ${totStr}`;
}

function renderStationsSidebar() {
  const host = $("#sona-station-list") || $(".sona-playlists");
  if (!host) return;

  const stations = radio.stations;
  if (radio.stationFilter !== "all" && !stations.some(s => s.id === radio.stationFilter)) {
    radio.stationFilter = "all";
  }

  const totalCount = String(radio.tracks.length).padStart(2, "0");
  const allBtnHtml = `
    <button class="sona-station-btn${radio.stationFilter === "all" ? " active" : ""}" type="button" data-station="all">
      <span><b class="chip-suit">♠</b>All · 全部频段</span>
      <small>${totalCount}</small>
    </button>
  `;

  const stationBtnsHtml = stations.map(st => {
    const count = String(radio.tracks.filter(t => t.station === st.id).length).padStart(2, "0");
    const active = radio.stationFilter === st.id ? " active" : "";
    return `
      <button class="sona-station-btn${active}" type="button" data-station="${escapeHtml(st.id)}" title="${escapeHtml(st.freq || "FM 88.8")} · ${escapeHtml(st.desc || "")}">
        <span><b class="chip-suit">${escapeHtml(st.suit || "♥")}</b>${escapeHtml(st.name)}</span>
        <small>${count}</small>
      </button>
    `;
  }).join("");

  host.innerHTML = allBtnHtml + stationBtnsHtml;

  $$("[data-station]", host).forEach(btn => {
    btn.addEventListener("click", () => {
      radio.stationFilter = btn.dataset.station || "all";
      renderStationsSidebar();
      renderFullPlaylist();
      const activeSt = stations.find(s => s.id === radio.stationFilter);
      if (activeSt) {
        if ($(".vegas-mini-title")) $(".vegas-mini-title").textContent = activeSt.name;
        if ($(".vegas-mini-sub")) $(".vegas-mini-sub").textContent = `${activeSt.freq || "FM 88.8"} · ${activeSt.host || "CHIRAKA"}`;
      } else {
        if ($(".vegas-mini-title")) $(".vegas-mini-title").textContent = "Fabulous Chiraka";
        if ($(".vegas-mini-sub")) $(".vegas-mini-sub").textContent = "LAS VEGAS · FM 88.8";
      }
    });
  });
}

function renderRadioSceneGrid() {
  const grid = $("#scene-grid");
  if (!grid) return;
  const topTracks = radio.tracks.slice(0, 4);
  grid.innerHTML = topTracks.map((t, idx) => {
    const isBlackSuit = t.suit === "♠" || t.suit === "♣";
    const coverSrc = resolveImg(t.cover || "assets/bg/city-sunset.jpg");
    const shortScene = (t.scene || "Scene").split(" ")[0];
    return `
      <button class="scene-square${idx === radio.current ? " is-active" : ""}" type="button" data-scene-track="${idx}">
        <span class="scene-card-suit"${isBlackSuit ? ' style="color:#1b2748"' : ""}>${escapeHtml(t.rank || "A")}${escapeHtml(t.suit || "♥")}</span>
        <img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(t.title)}">
        <span class="scene-square-overlay"><small>${escapeHtml(shortScene)}</small><strong>${escapeHtml(t.title)}</strong></span>
      </button>
    `;
  }).join("");

  $$("[data-scene-track]", grid).forEach(btn => {
    btn.addEventListener("click", () => chooseTrack(Number(btn.dataset.sceneTrack), true));
  });
}

function renderFullPlaylist() {
  const list = $("#full-playlist");
  if (!list) return;

  const query = ($("#track-search")?.value || "").trim().toLowerCase();
  const items = radio.tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track, index }) => {
      if (radio.stationFilter !== "all" && track.station !== radio.stationFilter) return false;
      if (radio.navMode === "fav" && !radio.favorites.has(index)) return false;
      if (query && !`${track.title} ${track.artist} ${track.scene}`.toLowerCase().includes(query)) return false;
      return true;
    });

  if (!items.length) {
    list.innerHTML = `<li class="playlist-empty" style="padding:8px 12px;color:#4a5a88;">当前频段暂无曲目，管理员可点击右上角「+ 新增曲目」添加</li>`;
    return;
  }

  list.innerHTML = items.map(({ track, index }) => {
    const isCurrent = index === radio.current;
    const active = isCurrent && (radio.playing || radio.demo);
    const coverSrc = resolveImg(track.cover || "assets/bg/city-sunset.jpg");
    const stateLabel = active ? "正在播放" : (track.src ? "可播放" : "待补充");
    const stObj = radio.stations.find(s => s.id === track.station);
    const stName = stObj ? stObj.name : (track.station || "FM 88.8");
    const charObj = getCharacterById(track.characterId);
    const charTag = charObj ? ` · 🔗${charObj.label}` : "";
    return `
      <li style="display:flex;align-items:center;gap:6px">
        <button class="full-track${isCurrent ? " is-current" : ""}" style="flex:1" type="button" data-track="${index}" aria-current="${isCurrent ? "true" : "false"}">
          <img class="full-track-thumb" src="${escapeHtml(coverSrc)}" alt="${escapeHtml(track.title)}">
          <span class="full-track-copy">
            <strong>${escapeHtml(track.title)}</strong>
            <small>${escapeHtml(track.artist)} · ${escapeHtml(stName)} · ${escapeHtml(track.duration || "03:42")}${escapeHtml(charTag)}</small>
          </span>
          <span class="full-track-state${!track.src ? " is-pending-field" : ""}">${escapeHtml(stateLabel)}</span>
          <span class="full-track-rank">${escapeHtml(track.rank || "")}${escapeHtml(track.suit || "")}</span>
        </button>
        <button class="admin-edit-chip" type="button" data-edit-track="${index}" title="编辑此曲目">✎</button>
      </li>
    `;
  }).join("");

  $$("[data-track]", list).forEach(button => {
    button.addEventListener("click", () => chooseTrack(Number(button.dataset.track), true));
  });
  $$("[data-edit-track]", list).forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      openEditorModal("track", Number(button.dataset.editTrack));
    });
  });
}

function updatePlayer() {
  renderStationsSidebar();
  if (!radio.tracks.length) return;
  if (radio.current >= radio.tracks.length) radio.current = 0;
  const track = radio.tracks[radio.current];
  if (!track) return;

  const active = radio.playing || radio.demo;
  const status = track.src
    ? (radio.playing ? "正在播放" : "已暂停")
    : (active ? "正在播放" : "待补充");

  const stObj = radio.stations.find(s => s.id === track.station);
  const sceneWithStation = stObj ? `${track.scene || "Sunset Blvd"} · ${stObj.name} (${stObj.freq || "FM 88.8"})` : (track.scene || "Sunset Blvd");

  if ($("#now-title")) $("#now-title").textContent = track.title;
  if ($("#now-artist")) $("#now-artist").textContent = track.artist;
  if ($("#now-scene")) $("#now-scene").textContent = sceneWithStation;
  if ($("#now-bpm")) $("#now-bpm").textContent = track.bpm || "92 BPM · WEST COAST SYNTH";
  if ($("#radio-status")) $("#radio-status").textContent = status;

  const coverImg = $("#now-cover-img");
  if (coverImg && track.cover) {
    coverImg.src = resolveImg(track.cover);
  }

  const nextIndex = (radio.current + 1) % radio.tracks.length;
  const nextTrack = radio.tracks[nextIndex];
  if (nextTrack) {
    if ($("#upnext-title")) $("#upnext-title").textContent = `${nextTrack.title} — ${nextTrack.artist}`;
    if ($("#upnext-duration")) $("#upnext-duration").textContent = nextTrack.duration || "04:15";
    const upnextImg = $("#upnext-img");
    if (upnextImg && nextTrack.cover) upnextImg.src = resolveImg(nextTrack.cover);
  }

  const playButton = $("#radio-play");
  if (playButton) {
    playButton.classList.toggle("is-playing", active);
    playButton.setAttribute("aria-pressed", String(active));
    playButton.setAttribute("aria-label", active ? "暂停城市电台" : "播放城市电台");
  }

  $("#edge-play-btn")?.classList.toggle("is-active", active);
  $("#edge-pause-btn")?.classList.toggle("is-active", !active);

  const favBtn = $("#fav-btn");
  if (favBtn) {
    const isFav = radio.favorites.has(radio.current);
    favBtn.classList.toggle("is-favorite", isFav);
    favBtn.textContent = isFav ? "♥" : "♡";
  }

  const vinyl = $("#vinyl");
  if (vinyl) vinyl.classList.toggle("is-playing", active);
  document.body.classList.toggle("radio-playing", active);

  renderRadioSceneGrid();
  renderFullPlaylist();
  updateProgressUI();
}

function chooseTrack(index, autoplay = false) {
  if (!radio.tracks.length) return;
  const wasActive = radio.playing || radio.demo;
  radio.audio.pause();
  radio.audio.removeAttribute("src");
  radio.current = (index + radio.tracks.length) % radio.tracks.length;
  radio.demoProgress = 18;

  const track = radio.tracks[radio.current];
  if (track.src) radio.audio.src = track.src;

  radio.playing = false;
  radio.demo = false;
  updatePlayer();

  if (autoplay || wasActive) toggleRadio();
}

async function toggleRadio() {
  const track = radio.tracks[radio.current];
  if (!track) return;

  if (!track.src) {
    radio.demo = !radio.demo;
    radio.playing = false;
    if (radio.demo) {
      startDemoTicker();
      if (radio.synthActive) startSunsetSynth();
    } else {
      stopSunsetSynth(false);
    }
    updatePlayer();
    return;
  }

  if (radio.playing) {
    radio.audio.pause();
    radio.playing = false;
    updatePlayer();
    return;
  }

  try {
    await radio.audio.play();
    radio.playing = true;
    radio.demo = false;
    updatePlayer();
  } catch (e) {
    radio.demo = true;
    startDemoTicker();
    updatePlayer();
  }
}

function initRadioPage() {
  $("#radio-prev")?.addEventListener("click", () => chooseTrack(radio.current - 1, true));
  $("#radio-next")?.addEventListener("click", () => chooseTrack(radio.current + 1, true));
  $("#radio-play")?.addEventListener("click", toggleRadio);
  $("#upnext-btn")?.addEventListener("click", () => chooseTrack(radio.current + 1, true));

  $("#edge-play-btn")?.addEventListener("click", () => {
    if (!(radio.playing || radio.demo)) toggleRadio();
  });
  $("#edge-pause-btn")?.addEventListener("click", () => {
    if (radio.playing || radio.demo) toggleRadio();
  });

  $("#dice-shuffle-btn")?.addEventListener("click", () => {
    const nextIdx = (radio.current + 1 + Math.floor(Math.random() * Math.max(1, radio.tracks.length - 1))) % radio.tracks.length;
    chooseTrack(nextIdx, true);
    showToast(`🎲 幸运骰子已切至「${radio.tracks[nextIdx].title}」`);
  });

  $("#fav-btn")?.addEventListener("click", () => {
    if (radio.favorites.has(radio.current)) {
      radio.favorites.delete(radio.current);
    } else {
      radio.favorites.add(radio.current);
    }
    updatePlayer();
  });

  $("#synth-toggle")?.addEventListener("click", () => {
    radio.synthActive = !radio.synthActive;
    $("#synth-toggle")?.classList.toggle("is-active", radio.synthActive);
    if (radio.synthActive) {
      if (!(radio.playing || radio.demo)) {
        radio.demo = true;
        startDemoTicker();
      }
      startSunsetSynth();
    } else {
      stopSunsetSynth(true);
    }
    updatePlayer();
  });

  $("#progress-track")?.addEventListener("click", event => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    radio.demoProgress = pct;
    if (radio.audio.src && Number.isFinite(radio.audio.duration)) {
      radio.audio.currentTime = (pct / 100) * radio.audio.duration;
    }
    updateProgressUI();
  });

  $$("[data-radio-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      $$("[data-radio-nav]").forEach(b => b.classList.toggle("is-selected", b === btn));
      radio.navMode = btn.dataset.radioNav || "all";
      renderFullPlaylist();
    });
  });

  $("#track-search")?.addEventListener("input", renderFullPlaylist);
  $("#edit-current-track-btn")?.addEventListener("click", () => openEditorModal("track", radio.current));
  $("#replace-track-cover-btn")?.addEventListener("click", () => openEditorModal("track", radio.current, "ed-track-cover"));
  $("#add-track-btn")?.addEventListener("click", () => openEditorModal("track", -1));
  $("#manage-stations-btn")?.addEventListener("click", () => openEditorModal("stations"));

  updatePlayer();
}

/* ---------- 01 角色档案与独立卷宗 (含性别/生日/星座 + 外观插图画廊 + 故事线联动) ---------- */
function artImage(src, alt) {
  if (!src) return "";
  return `<img class="art-img" src="${escapeHtml(resolveImg(src))}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

function characterCard(character, index) {
  const hasImage = Boolean(character.image);
  const href = window.CHIRAKA_SPA_MODE ? `#character-${character.id}` : `character.html?id=${encodeURIComponent(character.id)}`;
  const metaLine = [
    character.gender && !isPendingValue(character.gender) ? character.gender : null,
    character.zodiac && !isPendingValue(character.zodiac) ? character.zodiac : null
  ].filter(Boolean).join(" · ");
  return `
    <a class="character-card" href="${href}" data-char-id="${escapeHtml(character.id)}">
      <span class="admin-edit-chip admin-card-floating" role="button" tabindex="0" data-edit-char="${escapeHtml(character.id)}" title="编辑 ${escapeHtml(character.label)}">✎ 编辑卷宗</span>
      <span class="character-art tone-${escapeHtml(character.tone || "pink")}${hasImage ? " has-image" : ""}">
        ${artImage(character.image, character.label)}
        <span class="art-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="art-slot">${hasImage ? "角色立绘" : "待补充立绘"}</span>
      </span>
      <span class="character-info">
        <span class="character-tag">CASE // ${escapeHtml(character.categoryLabel)} · ${escapeHtml(character.status)}</span>
        <strong class="character-name">${escapeHtml(character.label)}</strong>
        <small class="character-sub">姓名 / ${wrapPendingHtml(character.name)}${metaLine ? ` (${escapeHtml(metaLine)})` : ""}</small>
        <span class="character-link"><span>调阅调查卷宗</span><b>↗</b></span>
      </span>
    </a>
  `;
}

let currentCharFilter = "all";

function renderCharactersGrid() {
  const grid = $("#character-grid");
  if (!grid) return;

  const total = $("#character-total");
  if (total) total.textContent = String(DATA.characters.length).padStart(2, "0");

  const list = currentCharFilter === "all"
    ? DATA.characters
    : DATA.characters.filter(c => c.category === currentCharFilter);

  grid.innerHTML = list.map(c => characterCard(c, DATA.characters.indexOf(c))).join("");

  $$("[data-edit-char]", grid).forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openEditorModal("character", btn.dataset.editChar);
    });
  });

  if (window.CHIRAKA_SPA_MODE) {
    $$("[data-char-id]", grid).forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest("[data-edit-char]")) return;
        e.preventDefault();
        openSpaCharacter(card.dataset.charId);
      });
    });
  }
}

function initCharacters() {
  const grid = $("#character-grid");
  if (!grid) return;

  const filters = $$("#character-filters .filter-button[data-filter]");
  filters.forEach(button => {
    button.addEventListener("click", () => {
      filters.forEach(item => item.classList.toggle("is-selected", item === button));
      currentCharFilter = button.dataset.filter || "all";
      renderCharactersGrid();
    });
  });

  $("#add-character-btn")?.addEventListener("click", () => openEditorModal("character", "__new__"));
  renderCharactersGrid();
}

function renderCharacterDetailById(id) {
  const host = $("#character-detail");
  if (!host) return;

  const index = DATA.characters.findIndex(c => c.id === id);
  const character = DATA.characters[index] || DATA.characters[0];
  const actualIndex = index >= 0 ? index : 0;
  if (!character) return;
  currentCharacterId = character.id;

  const number = String(actualIndex + 1).padStart(2, "0");
  const fields = [
    ["姓名", character.name || "待补充", "name"],
    ["别称", character.alias || "待补充", "alias"],
    ["性别", character.gender || "待补充", "gender"],
    ["生日", character.birthday || "待补充", "birthday"],
    ["星座", character.zodiac || "待补充", "zodiac"],
    ["年龄", character.age || "待补充", "age"],
    ["身高", character.height || "待补充", "height"],
    ["身份", character.identity || "待补充", "identity"],
    ["所属", character.faction || "待补充", "faction"]
  ];

  const prev = DATA.characters[(actualIndex - 1 + DATA.characters.length) % DATA.characters.length];
  const next = DATA.characters[(actualIndex + 1) % DATA.characters.length];

  const subHeadingText = !isPendingValue(character.name)
    ? `${character.name}${!isPendingValue(character.alias) ? ` · ${character.alias}` : ""}`
    : "姓名待补充";

  // 联动获取该角色在画廊中的插画（含服装设定、角色立绘、分镜故事）
  const linkedGalleryItems = (DATA.gallery || []).filter(g => g.characterId === character.id);
  const costumeAndAppearanceGallery = linkedGalleryItems.filter(g => g.category === "costume" || g.category === "character");
  const customAppearanceImgs = Array.isArray(character.appearanceImages) ? character.appearanceImages : [];

  const appearanceCardsHtml = [
    ...customAppearanceImgs.map((imgObj, idx) => `
      <div class="appearance-thumb-card" data-preview-custom-img="${escapeHtml(imgObj.src || "")}" data-preview-title="${escapeHtml(imgObj.label || "外观设定图")}">
        <div class="appearance-thumb-visual">
          ${imgObj.src ? `<img src="${escapeHtml(resolveImg(imgObj.src))}" alt="${escapeHtml(imgObj.label || "外观设定")}">` : `<span class="art-slot">待上传设定图</span>`}
        </div>
        <div class="appearance-thumb-caption">
          <span>${escapeHtml(imgObj.label || `外观设定 0${idx + 1}`)}</span>
          <small>设定图</small>
        </div>
      </div>
    `),
    ...costumeAndAppearanceGallery.map(g => `
      <div class="appearance-thumb-card" data-open-linked-gallery="${escapeHtml(g.id)}">
        <div class="appearance-thumb-visual tone-${escapeHtml(g.tone || "pink")}">
          ${g.src ? `<img src="${escapeHtml(resolveImg(g.src))}" alt="${escapeHtml(g.title)}">` : `<span class="art-slot">待补充原图</span>`}
        </div>
        <div class="appearance-thumb-caption">
          <span>${escapeHtml(g.title)}</span>
          <small>${g.category === "costume" ? "服装设定" : "角色立绘"} ↗</small>
        </div>
      </div>
    `)
  ].join("");

  // 角色故事线节点
  const storylines = Array.isArray(character.storylines) && character.storylines.length
    ? character.storylines
    : [{ stage: "序章 · 档案记录", title: "待补充故事章节", content: "待补充角色主线或支线故事内容。" }];

  const storylinesHtml = storylines.map(st => `
    <div class="storyline-item">
      <div class="storyline-item-head">
        <span class="storyline-stage-badge">${escapeHtml(st.stage || "故事节点")}</span>
      </div>
      <h3>${wrapPendingHtml(st.title || "待补充标题", 'data-open-char-field="storylines"')}</h3>
      <p>${wrapPendingHtml(st.content || "待补充故事内容", 'data-open-char-field="storylines"')}</p>
    </div>
  `).join("");

  // 联动该角色相关的城市新闻/论坛帖与电台印象曲
  const linkedNews = (DATA.news || []).filter(n => Array.isArray(n.relatedCharacters) && n.relatedCharacters.includes(character.id));
  const linkedTracks = (DATA.tracks || []).filter(t => t.characterId === character.id);

  host.innerHTML = `
    <article class="dossier">
      <div class="dossier-top">
        <div class="dossier-portrait character-art tone-${escapeHtml(character.tone || "pink")}${character.image ? " has-image" : ""}">
          ${artImage(character.image, character.label)}
          <span class="art-number">${number}</span>
          <span class="art-slot${!character.image ? " is-pending-field" : ""}" data-focus-field="image">${character.image ? "角色立绘" : "待补充"}</span>
          <button class="cover-replace-btn" type="button" data-open-char-field="image">🖼 更换立绘</button>
        </div>
        <div class="dossier-info">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <p class="eyebrow" style="margin:0">CASE FILE // ${escapeHtml(character.id.toUpperCase())}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="admin-edit-chip" type="button" data-open-char-editor="${escapeHtml(character.id)}">✎ 编辑角色完整档案</button>
              <button class="admin-edit-chip" type="button" data-quick-add-char-gallery="${escapeHtml(character.id)}">+ 新增联动插画/服装图</button>
            </div>
          </div>
          <h1 class="dossier-title">${escapeHtml(character.label)}</h1>
          <p class="dossier-sub">${wrapPendingHtml(subHeadingText, 'data-open-char-field="name"')}</p>
          <div class="dossier-tags">
            <span class="tag">${escapeHtml(character.categoryLabel)}</span>
            <span class="tag">${wrapPendingHtml(character.status, 'data-open-char-field="status"')}</span>
          </div>
          <dl class="dossier-meta">
            ${fields.map(([label, value, fieldKey]) => `
              <div class="meta-item">
                <dt>${label}</dt>
                <dd>${wrapPendingHtml(value, `data-open-char-field="${fieldKey}"`)}</dd>
              </div>
            `).join("")}
          </dl>
          <div class="dossier-actions">
            <button class="button button-primary admin-only" type="button" data-open-char-editor="${escapeHtml(character.id)}"><span>✎ 编辑角色设定与故事线</span></button>
            <a class="button button-primary" href="${window.CHIRAKA_SPA_MODE ? "#radio" : "radio.html"}" data-spa-nav="radio"><span>打开城市电台</span><b>↗</b></a>
            <a class="button button-ghost" href="${window.CHIRAKA_SPA_MODE ? "#characters" : "characters.html"}" data-spa-nav="characters"><span>返回档案列表</span><b>↗</b></a>
          </div>
        </div>
      </div>

      <div class="dossier-body">
        <section class="dossier-section">
          <div class="dossier-section-head" style="justify-content:space-between">
            <div style="display:flex;align-items:baseline;gap:10px"><span>01</span><h2>人物设定与档案摘要</h2></div>
            <button class="admin-edit-chip" type="button" data-open-char-field="summary">✎ 编辑设定</button>
          </div>
          <p>${wrapPendingHtml(character.summary, 'data-open-char-field="summary"')}</p>
          <div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.16)">
            <small style="color:var(--cyan);font-weight:700;display:block;margin-bottom:4px">补充设定备注：</small>
            <p style="margin:0;font-size:13px">${wrapPendingHtml(character.notes, 'data-open-char-field="notes"')}</p>
          </div>
        </section>

        <section class="dossier-section" style="grid-column: span 2">
          <div class="dossier-section-head" style="justify-content:space-between;flex-wrap:wrap">
            <div style="display:flex;align-items:baseline;gap:10px"><span>02</span><h2>外观与服装设定 · APPEARANCE &amp; OUTFITS</h2></div>
            <div style="display:flex;gap:6px">
              <button class="admin-edit-chip" type="button" data-quick-add-costume="${escapeHtml(character.id)}">+ 上传外观/服装插图</button>
              <button class="admin-edit-chip" type="button" data-open-char-field="appearance">✎ 编辑外观文字</button>
            </div>
          </div>
          <p>${wrapPendingHtml(character.appearance, 'data-open-char-field="appearance"')}</p>
          <div class="appearance-gallery-grid">
            ${appearanceCardsHtml || `<div style="grid-column:1/-1;padding:12px;border:1px dashed rgba(255,255,255,0.25);color:rgba(255,240,250,0.7);font-size:12.5px">暂无外观插图，管理员可点击右上角「+ 上传外观/服装插图」添加（与插画画廊实时联动）。</div>`}
          </div>
        </section>

        <section class="dossier-section relation-section">
          <div class="dossier-section-head" style="justify-content:space-between;flex-wrap:wrap">
            <div style="display:flex;align-items:baseline;gap:10px"><span>03</span><h2>角色故事线与联动卷宗 · STORYLINE &amp; LINKED ARCHIVES</h2></div>
            <button class="admin-edit-chip" type="button" data-open-char-field="storylines">✎ 编辑故事线章节</button>
          </div>
          <div class="storyline-list">${storylinesHtml}</div>

          <div class="linked-hub-grid">
            <div class="linked-hub-box">
              <h4>🎨 联动插画与分镜故事 (${linkedGalleryItems.length})</h4>
              <div class="linked-pill-list">
                ${linkedGalleryItems.map(g => `
                  <button class="linked-jump-item" type="button" data-open-linked-gallery="${escapeHtml(g.id)}">
                    <span><strong>${escapeHtml(g.title)}</strong> · <small style="color:rgba(255,240,250,0.75)">${escapeHtml((g.story || "待补充").slice(0, 22))}${g.story && g.story.length > 22 ? "..." : ""}</small></span>
                    <b style="color:var(--gold)">查看 ↗</b>
                  </button>
                `).join("") || `<small style="color:rgba(255,240,250,0.6)">暂无关联画廊分镜</small>`}
              </div>
            </div>

            <div class="linked-hub-box">
              <h4>💬 关联城市新闻与街头论坛 (${linkedNews.length})</h4>
              <div class="linked-pill-list">
                ${linkedNews.map(n => `
                  <button class="linked-jump-item" type="button" data-jump-article="${escapeHtml(n.id)}">
                    <span>[${escapeHtml(n.category)}] ${escapeHtml(n.title)}</span>
                    <b style="color:var(--cyan)">↗</b>
                  </button>
                `).join("") || `<small style="color:rgba(255,240,250,0.6)">暂无关联新闻或论坛帖</small>`}
              </div>
            </div>

            <div class="linked-hub-box">
              <h4>🎵 角色印象曲 · FM 88.8 (${linkedTracks.length})</h4>
              <div class="linked-pill-list">
                ${linkedTracks.map(t => `
                  <button class="linked-jump-item" type="button" data-jump-track="${escapeHtml(t.id || "")}">
                    <span>${escapeHtml(t.rank || "A")}${escapeHtml(t.suit || "♥")} ${escapeHtml(t.title)} — ${escapeHtml(t.artist)}</span>
                    <b style="color:var(--pink)">▶</b>
                  </button>
                `).join("") || `<small style="color:rgba(255,240,250,0.6)">暂无绑定印象曲</small>`}
              </div>
            </div>
          </div>
        </section>

        <section class="dossier-section relation-section">
          <div class="dossier-section-head" style="justify-content:space-between">
            <div style="display:flex;align-items:baseline;gap:10px"><span>04</span><h2>红线关系调查板 · EVIDENCE BOARD</h2></div>
            <button class="admin-edit-chip" type="button" data-open-char-field="relations">✎ 编辑关系网</button>
          </div>
          ${renderRelationMap(character, actualIndex)}
        </section>
      </div>

      <nav class="detail-nav" aria-label="档案翻页">
        <a href="${window.CHIRAKA_SPA_MODE ? `#character-${prev.id}` : `character.html?id=${encodeURIComponent(prev.id)}`}" data-char-nav="${escapeHtml(prev.id)}"><small>上一份卷宗</small><strong>${escapeHtml(prev.label)}</strong></a>
        <a href="${window.CHIRAKA_SPA_MODE ? `#character-${next.id}` : `character.html?id=${encodeURIComponent(next.id)}`}" data-char-nav="${escapeHtml(next.id)}"><small>下一份卷宗</small><strong>${escapeHtml(next.label)}</strong></a>
      </nav>
    </article>
  `;

  $$("[data-open-char-editor]", host).forEach(btn => {
    btn.addEventListener("click", () => openEditorModal("character", character.id));
  });
  $$("[data-open-char-field]", host).forEach(el => {
    el.addEventListener("click", () => {
      if (authState.mode !== "admin") return;
      openEditorModal("character", character.id, el.dataset.openCharField);
    });
  });
  $$("[data-focus-field]", host).forEach(el => {
    el.addEventListener("click", () => {
      if (authState.mode !== "admin") return;
      openEditorModal("character", character.id, el.dataset.focusField);
    });
  });
  $$("[data-quick-add-costume]", host).forEach(btn => {
    btn.addEventListener("click", () => {
      openEditorModal("gallery", "__new__", null, { characterId: character.id, category: "costume" });
    });
  });
  $$("[data-quick-add-char-gallery]", host).forEach(btn => {
    btn.addEventListener("click", () => {
      openEditorModal("gallery", "__new__", null, { characterId: character.id, category: "character" });
    });
  });
  $$("[data-open-linked-gallery]", host).forEach(el => {
    el.addEventListener("click", () => openGalleryItem(el.dataset.openLinkedGallery));
  });
  $$("[data-jump-article]", host).forEach(btn => {
    btn.addEventListener("click", () => navigateToArticle(btn.dataset.jumpArticle));
  });
  $$("[data-jump-track]", host).forEach(btn => {
    btn.addEventListener("click", () => navigateToRadioTrack(btn.dataset.jumpTrack));
  });

  if (window.CHIRAKA_SPA_MODE) {
    $$("[data-char-nav]", host).forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        openSpaCharacter(link.dataset.charNav);
      });
    });
    $$("[data-spa-nav]", host).forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        switchSpaView(link.dataset.spaNav);
      });
    });
  }
}

function renderRelationMap(character, characterIndex) {
  const layouts = {
    1: [{ x: 50, y: 24 }],
    2: [{ x: 24, y: 34 }, { x: 76, y: 66 }],
    3: [{ x: 22, y: 28 }, { x: 78, y: 28 }, { x: 50, y: 80 }],
    4: [{ x: 18, y: 26 }, { x: 82, y: 22 }, { x: 15, y: 76 }, { x: 84, y: 78 }]
  };

  const relations = (character.relations || [])
    .map(rel => {
      const person = DATA.characters.find(item => item.id === rel.target);
      return person ? { ...rel, person } : null;
    })
    .filter(Boolean)
    .slice(0, 4);

  if (!relations.length) {
    return `<p data-open-char-field="relations" class="is-pending-field">关系网待补充（管理员模式下点击添加人物关联）。</p>`;
  }
  const positions = layouts[relations.length] || layouts[4];
  const centerNumber = String(characterIndex + 1).padStart(2, "0");

  const lines = relations.map((_, i) => `<line x1="50" y1="50" x2="${positions[i].x}" y2="${positions[i].y}" />`).join("");
  const nodes = relations.map((rel, i) => {
    const tIdx = DATA.characters.findIndex(item => item.id === rel.person.id);
    const tNum = String(tIdx + 1).padStart(2, "0");
    const href = window.CHIRAKA_SPA_MODE ? `#character-${rel.person.id}` : `character.html?id=${encodeURIComponent(rel.person.id)}`;
    return `
      <a class="relation-node" href="${href}" data-char-nav="${escapeHtml(rel.person.id)}" style="--x:${positions[i].x}%;--y:${positions[i].y}%">
        <span class="node-avatar">FILE ${tNum}</span>
        <strong>${escapeHtml(rel.person.label)}</strong>
        <small>${escapeHtml(rel.label)}</small>
      </a>
    `;
  }).join("");

  return `
    <div class="relation-canvas">
      <svg class="relation-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
      <div class="relation-node relation-center" style="--x:50%;--y:50%">
        <span class="node-avatar">TARGET ${centerNumber}</span>
        <strong>${escapeHtml(character.label)}</strong>
        <small>${escapeHtml(!isPendingValue(character.name) ? character.name : "核心卷宗")}</small>
      </div>
      ${nodes}
    </div>
  `;
}

function initCharacterDetail() {
  const id = new URLSearchParams(window.location.search).get("id") || currentCharacterId || "ch-01";
  renderCharacterDetailById(id);
}

/* ---------- 02 城市新闻 + 街头匿名论坛 (City Desk & Night BBS) ---------- */
function renderRelatedCharacterPills(charIds = []) {
  if (!Array.isArray(charIds) || !charIds.length) return "";
  return charIds
    .map(cid => getCharacterById(cid))
    .filter(Boolean)
    .map(c => `<span class="char-link-pill" role="button" tabindex="0" data-jump-char="${escapeHtml(c.id)}">@${escapeHtml(c.label)}</span>`)
    .join(" ");
}

function newsRow(item) {
  const href = window.CHIRAKA_SPA_MODE ? `#article-${item.id}` : `article.html?id=${encodeURIComponent(item.id)}`;
  const isForum = item.postType === "forum";
  const replyCount = Array.isArray(item.comments) ? item.comments.length : 0;
  const charPills = renderRelatedCharacterPills(item.relatedCharacters);
  return `
    <a class="news-row" href="${href}" data-news-id="${escapeHtml(item.id)}">
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
        <span class="post-type-badge ${isForum ? "is-forum" : "is-news"}">${isForum ? "💬 街头论坛" : "📰 官方报道"}</span>
        <span class="news-row-tag" style="background:#160f29;border:1px solid rgba(255,255,255,0.28)">${escapeHtml(item.category)}</span>
      </div>
      <span class="news-row-copy">
        <strong>${wrapPendingHtml(item.title)}</strong>
        <small>${wrapPendingHtml(item.summary)}</small>
        <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:11px;color:rgba(255,235,245,0.72)">
          <span>👤 ${escapeHtml(item.author || "匿名")} (${escapeHtml(item.authorRole || "市民")})</span>
          <span>· 💬 ${replyCount} 条跟帖</span>
          <span>· ♥ ${item.likes || 0}</span>
          ${charPills}
        </span>
      </span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="news-row-date">${wrapPendingHtml(item.date)}</span>
        <span class="admin-edit-chip" role="button" tabindex="0" data-edit-news="${escapeHtml(item.id)}">✎ 编辑</span>
      </span>
    </a>
  `;
}

let currentNewsFilter = "全部";

function renderNewsSection() {
  const list = $("#news-list");
  const leadHost = $("#news-lead");
  if (!list || !leadHost) return;

  const customCats = [...new Set(DATA.news.map(item => item.category))];
  const filterTabs = [
    ["全部", "全部动态"],
    ["type:news", "📰 官方新闻报道"],
    ["type:forum", "💬 街头匿名论坛 (BBS)"],
    ...customCats.map(c => [c, c])
  ];

  const filterHost = $("#news-filters");
  if (filterHost) {
    filterHost.innerHTML = filterTabs.map(([val, lbl]) => `
      <button class="filter-button${val === currentNewsFilter ? " is-selected" : ""}" type="button" data-news-filter="${escapeHtml(val)}">${escapeHtml(lbl)}</button>
    `).join("") + `
      <button class="filter-button admin-only" type="button" id="add-news-btn" style="margin-left:auto;border-color:var(--gold);color:var(--gold)">+ 发布报道 / 论坛新帖</button>
    `;

    $$("[data-news-filter]", filterHost).forEach(btn => {
      btn.addEventListener("click", () => {
        currentNewsFilter = btn.dataset.newsFilter || "全部";
        renderNewsSection();
      });
    });

    $("#add-news-btn", filterHost)?.addEventListener("click", () => openEditorModal("news", "__new__"));
  }

  const items = DATA.news.filter(i => {
    if (currentNewsFilter === "全部") return true;
    if (currentNewsFilter === "type:news") return i.postType !== "forum";
    if (currentNewsFilter === "type:forum") return i.postType === "forum";
    return i.category === currentNewsFilter;
  });

  const [lead, ...rest] = items;
  if (!lead) {
    leadHost.innerHTML = `<div class="empty-state">当前板块暂无帖子</div>`;
    list.innerHTML = "";
    return;
  }

  const leadHref = window.CHIRAKA_SPA_MODE ? `#article-${lead.id}` : `article.html?id=${encodeURIComponent(lead.id)}`;
  const leadImgHtml = lead.image
    ? `<img src="${escapeHtml(resolveImg(lead.image))}" alt="${escapeHtml(lead.title)}" style="width:100%;height:100%;object-fit:cover">`
    : `<span>待补充配图</span>`;
  const leadReplyCount = Array.isArray(lead.comments) ? lead.comments.length : 0;
  const isLeadForum = lead.postType === "forum";

  leadHost.innerHTML = `
    <a class="lead-story" href="${leadHref}" data-news-id="${escapeHtml(lead.id)}" style="position:relative">
      <span class="admin-edit-chip admin-card-floating" role="button" tabindex="0" data-edit-news="${escapeHtml(lead.id)}">✎ 编辑主帖</span>
      <span class="lead-visual" style="overflow:hidden">
        ${leadImgHtml}
        <span class="cover-replace-btn" role="button" tabindex="0" data-edit-news-cover="${escapeHtml(lead.id)}">🖼 更换配图</span>
      </span>
      <span class="lead-body">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="post-type-badge ${isLeadForum ? "is-forum" : "is-news"}">${isLeadForum ? "💬 街头论坛热帖" : "📰 头版头条报道"}</span>
          <span class="story-tag">${escapeHtml(lead.category)}</span>
          ${renderRelatedCharacterPills(lead.relatedCharacters)}
        </div>
        <h2>${wrapPendingHtml(lead.title)}</h2>
        <p>${wrapPendingHtml(lead.summary)}</p>
        <small style="color:#4d3859;font-weight:700;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>👤 ${wrapPendingHtml(lead.author)} (${escapeHtml(lead.authorRole || "记者")}) · ${wrapPendingHtml(lead.date)}</span>
          <span>🔥 热度 ${lead.views || 500} · ♥ ${lead.likes || 0} · 💬 ${leadReplyCount} 条回帖 ↗</span>
        </small>
      </span>
    </a>
  `;
  list.innerHTML = rest.map(newsRow).join("");

  $$("[data-edit-news]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openEditorModal("news", btn.dataset.editNews);
    });
  });

  $$("[data-edit-news-cover]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openEditorModal("news", btn.dataset.editNewsCover, "ed-news-image");
    });
  });

  $$("[data-jump-char]").forEach(pill => {
    pill.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      navigateToCharacter(pill.dataset.jumpChar);
    });
  });

  if (window.CHIRAKA_SPA_MODE) {
    $$("[data-news-id]").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.closest("[data-edit-news], [data-edit-news-cover], [data-jump-char]")) return;
        e.preventDefault();
        openSpaArticle(el.dataset.newsId);
      });
    });
  }
}

function initNews() {
  renderNewsSection();
}

function renderArticleById(id) {
  const host = $("#article-detail");
  if (!host) return;
  const item = DATA.news.find(entry => entry.id === id) || DATA.news[0];
  if (!item) return;
  currentArticleId = item.id;
  if (!Array.isArray(item.comments)) item.comments = [];

  const isForum = item.postType === "forum";
  const related = DATA.news.filter(entry => entry.id !== item.id).slice(0, 2);
  const coverBlock = item.image
    ? `<div style="position:relative;margin:14px 0 18px;border:2px solid #fff;border-radius:2px;overflow:hidden;max-height:380px">
         <img src="${escapeHtml(resolveImg(item.image))}" alt="${escapeHtml(item.title)}" style="width:100%;height:100%;object-fit:cover">
         <button class="cover-replace-btn" type="button" data-edit-article-cover="${escapeHtml(item.id)}">🖼 更换配图</button>
       </div>`
    : "";

  const commentsHtml = item.comments.map((c, idx) => {
    const linkedChar = getCharacterById(c.charId);
    return `
      <div class="bbs-floor-card">
        <div class="bbs-floor-head">
          <div class="bbs-author-wrap">
            <span class="bbs-floor-num">#${idx + 2}L</span>
            <strong style="color:#fff;font-size:14px">${escapeHtml(c.author || "匿名市民")}</strong>
            <span class="bbs-role-tag">${escapeHtml(c.role || "市民")}</span>
            ${linkedChar ? `<span class="char-link-pill" role="button" tabindex="0" data-jump-char="${escapeHtml(linkedChar.id)}">🔗 角色卷宗：${escapeHtml(linkedChar.label)} ↗</span>` : ""}
            <small style="color:rgba(255,235,245,0.6)">${escapeHtml(c.time || "刚刚")}</small>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="admin-tool-btn" type="button" data-like-comment="${idx}" style="padding:3px 9px;font-size:11px">♥ 赞 (${c.likes || 0})</button>
            <button class="admin-edit-chip" type="button" data-delete-comment="${idx}">× 删除此楼</button>
          </div>
        </div>
        <p style="margin:0;font-size:13.5px;line-height:1.65;color:rgba(252,246,255,0.92)">${escapeHtml(c.content)}</p>
      </div>
    `;
  }).join("");

  const charOptionsHtml = `<option value="">匿名市民 / 自定义昵称</option>` + (DATA.characters || []).map(
    c => `<option value="${escapeHtml(c.id)}">以角色身份回帖：${escapeHtml(getCharacterDisplayName(c))}</option>`
  ).join("");

  host.innerHTML = `
    <article class="article">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <a class="article-back" href="${window.CHIRAKA_SPA_MODE ? "#news" : "news.html"}" data-spa-nav="news">← 返回新闻与街头论坛</a>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="button button-ghost" type="button" id="like-main-post-btn" style="padding:8px 14px"><span>♥ 点赞主帖 (${item.likes || 0})</span></button>
          <button class="button button-primary admin-only" type="button" data-edit-article="${escapeHtml(item.id)}"><span>✎ 编辑主帖 / 关联角色</span></button>
        </div>
      </div>

      <header style="margin:18px 0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span class="post-type-badge ${isForum ? "is-forum" : "is-news"}">${isForum ? "💬 街头匿名论坛 · NIGHT BBS" : "📰 官方调查报道 · CITY DESK"}</span>
          <span class="story-tag">${escapeHtml(item.category)}</span>
          <span class="bbs-floor-num">#1L 楼主</span>
          ${renderRelatedCharacterPills(item.relatedCharacters)}
        </div>
        <h1 style="margin:10px 0 8px;font:900 30px/1.25 var(--cn)">${wrapPendingHtml(item.title, `data-edit-article="${escapeHtml(item.id)}"`)}</h1>
        <p style="color:var(--gold);margin:0;font-weight:700;font-size:13px">
          👤 ${wrapPendingHtml(item.author, `data-edit-article="${escapeHtml(item.id)}"`)} (${escapeHtml(item.authorRole || "楼主/记者")}) · 🕒 ${wrapPendingHtml(item.date, `data-edit-article="${escapeHtml(item.id)}"`)} · 🔥 浏览 ${item.views || 320}
        </p>
      </header>

      ${coverBlock}

      <div style="padding:18px 0;border-top:1px dashed rgba(255,255,255,.28);border-bottom:1px dashed rgba(255,255,255,.28);margin-bottom:22px;font-size:15px;line-height:1.8">
        ${(item.body || ["待补充"]).map(p => `<p>${wrapPendingHtml(p, `data-edit-article="${escapeHtml(item.id)}"`)}</p>`).join("")}
      </div>

      <!-- 街头跟帖盖楼区 -->
      <section class="bbs-comments-section" aria-label="街头跟帖盖楼">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h2 style="margin:0;font:900 19px/1.2 var(--cn);color:var(--cyan)">💬 街头跟帖盖楼 · NIGHT BBS REPLIES (${item.comments.length})</h2>
          <small style="color:rgba(255,235,245,0.7)">支持以市民或角色身份跟帖互动</small>
        </div>

        <div class="bbs-floor-list">
          ${commentsHtml || `<div style="padding:16px;background:#19102e;border:1px dashed rgba(255,255,255,0.22);color:rgba(255,235,245,0.7)">还没有人跟帖，来抢占 #2L 沙发吧！</div>`}
        </div>

        <form class="bbs-reply-box" id="bbs-reply-form">
          <h3 style="margin:0 0 12px;font:800 15px/1.2 var(--cn);color:var(--gold)">✦ 发表街头跟帖 / 盖楼回复</h3>
          <div class="form-grid" style="margin-bottom:10px">
            <div class="form-field">
              <label for="reply-char-select">选择回帖身份（可联动角色档案）</label>
              <select class="form-select" id="reply-char-select">${charOptionsHtml}</select>
            </div>
            <div class="form-field">
              <label for="reply-author-input">显示昵称 &amp; 身份铭牌</label>
              <div style="display:flex;gap:6px">
                <input class="form-input" id="reply-author-input" type="text" placeholder="昵称（如：夜行市民）" value="夜行市民">
                <input class="form-input" id="reply-role-input" type="text" placeholder="铭牌（如：吃瓜路人）" value="匿名市民" style="max-width:120px">
              </div>
            </div>
          </div>
          <div class="form-field" style="margin-bottom:12px">
            <textarea class="form-textarea" id="reply-content-input" placeholder="输入跟帖内容..." style="min-height:70px" required></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button class="button button-primary" type="submit"><span>发送回帖 // POST REPLY</span><b>↵</b></button>
          </div>
        </form>
      </section>

      <section style="margin-top:28px">
        <h2 style="font:800 18px/1.2 var(--cn);margin-bottom:12px">其他热门剪报与论坛帖</h2>
        <div class="news-list">${related.map(newsRow).join("")}</div>
      </section>
    </article>
  `;

  $("#like-main-post-btn", host)?.addEventListener("click", () => {
    item.likes = (item.likes || 0) + 1;
    saveSiteData("♥ 已为该帖点赞");
  });

  $$("[data-like-comment]", host).forEach(btn => {
    btn.addEventListener("click", () => {
      const cIdx = Number(btn.dataset.likeComment);
      if (item.comments[cIdx]) {
        item.comments[cIdx].likes = (item.comments[cIdx].likes || 0) + 1;
        saveSiteData("");
      }
    });
  });

  $$("[data-delete-comment]", host).forEach(btn => {
    btn.addEventListener("click", () => {
      const cIdx = Number(btn.dataset.deleteComment);
      item.comments.splice(cIdx, 1);
      saveSiteData("🗑 已删除该楼层回复");
    });
  });

  const charSelect = $("#reply-char-select", host);
  const authorInput = $("#reply-author-input", host);
  const roleInput = $("#reply-role-input", host);
  charSelect?.addEventListener("change", () => {
    const cid = charSelect.value;
    const cObj = getCharacterById(cid);
    if (cObj) {
      if (authorInput) authorInput.value = !isPendingValue(cObj.name) ? cObj.name : cObj.label;
      if (roleInput) roleInput.value = !isPendingValue(cObj.identity) ? cObj.identity : cObj.categoryLabel;
    } else {
      if (authorInput) authorInput.value = "夜行市民";
      if (roleInput) roleInput.value = "匿名市民";
    }
  });

  $("#bbs-reply-form", host)?.addEventListener("submit", e => {
    e.preventDefault();
    const content = ($("#reply-content-input", host)?.value || "").trim();
    if (!content) return;
    item.comments.push({
      id: `c-${Date.now().toString(36)}`,
      author: ($("#reply-author-input", host)?.value || "匿名市民").trim(),
      role: ($("#reply-role-input", host)?.value || "市民").trim(),
      charId: charSelect?.value || "",
      time: "刚刚",
      likes: 1,
      content
    });
    saveSiteData("💬 回帖成功！已盖上新楼层");
  });

  $$("[data-edit-article]", host).forEach(el => {
    el.addEventListener("click", () => {
      if (authState.mode !== "admin") return;
      openEditorModal("news", item.id);
    });
  });

  $$("[data-edit-article-cover]", host).forEach(btn => {
    btn.addEventListener("click", () => openEditorModal("news", item.id, "ed-news-image"));
  });

  $$("[data-edit-news]", host).forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openEditorModal("news", btn.dataset.editNews);
    });
  });

  $$("[data-jump-char]", host).forEach(pill => {
    pill.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      navigateToCharacter(pill.dataset.jumpChar);
    });
  });

  if (window.CHIRAKA_SPA_MODE) {
    $$("[data-spa-nav]", host).forEach(el => {
      el.addEventListener("click", e => {
        e.preventDefault();
        switchSpaView(el.dataset.spaNav);
      });
    });
    $$("[data-news-id]", host).forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.closest("[data-edit-news], [data-jump-char]")) return;
        e.preventDefault();
        openSpaArticle(el.dataset.newsId);
      });
    });
  }
}

function initArticle() {
  const id = new URLSearchParams(window.location.search).get("id") || currentArticleId || "n-01";
  renderArticleById(id);
}

/* ---------- 03 插画画廊 (精简元数据 + 关联角色与分镜故事双向联动) ---------- */
function galleryTile(item, index) {
  const span = item.span === "wide" ? " span-wide" : item.span === "tall" ? " span-tall" : "";
  const hasImage = Boolean(item.src);
  const linkedChar = getCharacterById(item.characterId);
  const storyText = item.story || item.meta || "待补充";
  return `
    <div class="gallery-tile${span}" role="button" tabindex="0" data-gallery-id="${escapeHtml(item.id)}">
      <span class="admin-edit-chip admin-card-floating" role="button" tabindex="0" data-edit-gallery="${escapeHtml(item.id)}">✎ 编辑分镜</span>
      <span class="tile-art tone-${escapeHtml(item.tone || "pink")}${hasImage ? " has-image" : ""}">
        ${artImage(item.src, item.title)}
        <span class="tile-mark">${String(index + 1).padStart(2, "0")}</span>
        <span class="tile-slot">${hasImage ? "查看画面与故事" : "待补充原图"}</span>
      </span>
      <span class="tile-info">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${linkedChar ? `🔗 ${escapeHtml(linkedChar.label)}` : wrapPendingHtml(storyText.slice(0, 10))}</small>
      </span>
    </div>
  `;
}

let currentGalleryFilter = "all";

function renderGallerySection() {
  const grid = $("#gallery-grid");
  if (!grid) return;

  const totalStat = $("#gallery-total-stat");
  if (totalStat) totalStat.textContent = String(DATA.gallery.length).padStart(2, "0");

  const categories = [
    ["all", "全部分镜"],
    ["character", "角色立绘"],
    ["group", "群像"],
    ["comic", "漫画分镜"],
    ["costume", "服装设定"]
  ];
  const filterHost = $("#gallery-filters");
  if (filterHost) {
    filterHost.innerHTML = categories.map(([val, lbl]) => `
      <button class="filter-button${val === currentGalleryFilter ? " is-selected" : ""}" type="button" data-gallery-filter="${val}">${lbl}</button>
    `).join("") + `
      <button class="filter-button admin-only" type="button" id="add-gallery-btn" style="margin-left:auto;border-color:var(--gold);color:var(--gold)">+ 新增画廊分镜</button>
    `;

    $$("[data-gallery-filter]", filterHost).forEach(btn => {
      btn.addEventListener("click", () => {
        currentGalleryFilter = btn.dataset.galleryFilter || "all";
        renderGallerySection();
      });
    });

    $("#add-gallery-btn", filterHost)?.addEventListener("click", () => openEditorModal("gallery", "__new__"));
  }

  const list = currentGalleryFilter === "all" ? DATA.gallery : DATA.gallery.filter(i => i.category === currentGalleryFilter);
  grid.innerHTML = list.map(i => galleryTile(i, DATA.gallery.indexOf(i))).join("");

  $$("[data-edit-gallery]", grid).forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openEditorModal("gallery", btn.dataset.editGallery);
    });
  });

  $$("[data-gallery-id]", grid).forEach(tile => {
    tile.addEventListener("click", e => {
      if (e.target.closest("[data-edit-gallery]")) return;
      openGalleryItem(tile.dataset.galleryId);
    });
    tile.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openGalleryItem(tile.dataset.galleryId);
      }
    });
  });
}

function initGallery() {
  renderGallerySection();
}

function openGalleryItem(id) {
  const item = DATA.gallery.find(entry => entry.id === id);
  const dialog = $("#gallery-dialog");
  if (!item || !dialog) return;
  currentGalleryId = item.id;

  const categoryLabels = {
    character: "角色立绘",
    group: "群像插画",
    comic: "漫画分镜",
    costume: "服装设定"
  };

  const linkedChar = getCharacterById(item.characterId);
  const storyContent = item.story || item.meta || "待补充（点击下方编辑按钮填写这幅画面背后的故事或设定说明）";

  const art = $("#lightbox-art");
  if (art) {
    art.className = `lightbox-art tile-art tone-${item.tone || "pink"}`;
    art.style.position = "relative";
    art.innerHTML = `
      ${artImage(item.src, item.title)}
      <span class="tile-slot">${item.src ? "原图预览" : "待补充原图"}</span>
      <button class="cover-replace-btn" type="button" id="lightbox-replace-img-btn">🖼 更换插画原图</button>
    `;
    $("#lightbox-replace-img-btn", art)?.addEventListener("click", () => {
      dialog.close();
      document.body.classList.remove("has-dialog");
      openEditorModal("gallery", item.id, "ed-gal-src");
    });
  }

  if ($("#lightbox-title")) $("#lightbox-title").textContent = item.title;
  if ($("#lightbox-category")) $("#lightbox-category").textContent = categoryLabels[item.category] || item.category;

  const metaEl = $("#lightbox-meta");
  if (metaEl) {
    metaEl.innerHTML = `
      <div style="border-bottom:none;padding-bottom:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${linkedChar
          ? `<button class="char-link-pill" type="button" id="lightbox-jump-char-btn">🔗 关联角色档案：${escapeHtml(getCharacterDisplayName(linkedChar))} ↗</button>`
          : `<span style="font-size:12px;color:rgba(255,235,245,0.65)">未绑定特定角色（可在编辑中绑定角色实现双向联动）</span>`
        }
      </div>
      <div class="lightbox-story-card" style="display:block;border-bottom:none">
        <strong style="display:block;font-size:12px;color:var(--gold);margin-bottom:6px;letter-spacing:0.08em">✦ 画面背后的故事 // STORY &amp; SCENE NOTE</strong>
        <div>${wrapPendingHtml(storyContent)}</div>
      </div>
    `;

    $("#lightbox-jump-char-btn", metaEl)?.addEventListener("click", () => {
      dialog.close();
      document.body.classList.remove("has-dialog");
      navigateToCharacter(linkedChar.id);
    });
  }

  let editWrap = $("#lightbox-admin-actions");
  if (!editWrap && $(".lightbox-info", dialog)) {
    editWrap = document.createElement("div");
    editWrap.id = "lightbox-admin-actions";
    editWrap.style.marginTop = "18px";
    $(".lightbox-info", dialog).appendChild(editWrap);
  }
  if (editWrap) {
    editWrap.innerHTML = `
      <button class="button button-primary admin-only" type="button" id="lightbox-edit-btn" style="width:100%;justify-content:center">
        <span>✎ 编辑插画、关联角色与分镜故事</span>
      </button>
    `;
    $("#lightbox-edit-btn", editWrap)?.addEventListener("click", () => {
      dialog.close();
      document.body.classList.remove("has-dialog");
      openEditorModal("gallery", item.id);
    });
  }

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

/* ---------- 全局视图刷新 ---------- */
function refreshAllViews() {
  renderHomeHero();
  selectHomeDrawer(currentHomeDrawer, true);
  renderCharactersGrid();
  renderCharacterDetailById(currentCharacterId);
  renderNewsSection();
  renderArticleById(currentArticleId);
  renderGallerySection();
  updatePlayer();
  updateAuthUI();
}

/* ---------- 图片读取与压缩辅助 ---------- */
function readImageFileAsDataUrl(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
      callback(dataUrl);
    };
    img.onerror = () => callback(e.target.result);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function buildImageFieldHtml(fieldId, labelText, currentVal) {
  const presetsHtml = PRESET_IMAGES.map(
    p => `<button class="preset-chip" type="button" data-preset-target="${fieldId}" data-preset-val="${escapeHtml(p.path)}">${escapeHtml(p.label)}</button>`
  ).join("");
  const hasFile = !!(currentVal && String(currentVal).trim());
  return `
    <div class="form-field span-2">
      <label for="${fieldId}">
        <span>${escapeHtml(labelText)}</span>
        <small>支持拖拽图片进来、点选本地图片、选择预设图或填写图片路径</small>
      </label>
      <input class="form-input" id="${fieldId}" name="${fieldId}" type="text" value="${escapeHtml(currentVal || "")}" placeholder="图片路径 / URL / 上传后自动生成数据">
      <div class="upload-row">
        <label class="upload-drop-zone${hasFile ? " is-has-file" : ""}" data-drop-target="${fieldId}">
          <span class="drop-inner">
            <span class="drop-badge" aria-hidden="true">🖼</span>
            <span class="drop-text">拖拽图片到这里<small> · 或点一下选本地图片</small></span>
          </span>
          <input type="file" accept="image/*" data-upload-target="${fieldId}" style="display:none">
        </label>
        <button class="preset-chip" type="button" data-clear-target="${fieldId}">清空图片</button>
        <div class="preset-chips">${presetsHtml}</div>
      </div>
    </div>
  `;
}

function applyPickedImage(file, inputEl, zoneEl, container) {
  if (!file) return;
  if (file.type && !file.type.startsWith("image/")) {
    showToast("⚠ 只能上传图片文件（jpg / png / webp）");
    return;
  }
  readImageFileAsDataUrl(file, dataUrl => {
    inputEl.value = dataUrl;
    if (zoneEl) zoneEl.classList.add("is-has-file");
    showToast("✓ 图片已就位，点击右下角【保存修改】即可生效");
  });
}

function wireImageUploadControls(container) {
  $$("[data-upload-target]", container).forEach(fileInput => {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      const targetId = fileInput.dataset.uploadTarget;
      const inputEl = $(`#${targetId}`, container);
      const zoneEl = $(`[data-drop-target="${targetId}"]`, container);
      if (file && inputEl) applyPickedImage(file, inputEl, zoneEl, container);
    });
  });

  // 拖拽上传（平板 / 桌面通用；拖到弹窗外不会误触发浏览器打开图片）
  $$("[data-drop-target]", container).forEach(zone => {
    const targetId = zone.dataset.dropTarget;
    const inputEl = $(`#${targetId}`, container);
    if (!inputEl) return;
    const setDrag = on => zone.classList.toggle("is-dragover", on);

    ["dragenter", "dragover"].forEach(evt => {
      zone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        setDrag(true);
      });
    });
    ["dragleave", "dragend"].forEach(evt => {
      zone.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        if (!zone.contains(e.relatedTarget)) setDrag(false);
      });
    });
    zone.addEventListener("drop", e => {
      e.preventDefault();
      e.stopPropagation();
      setDrag(false);
      applyPickedImage(e.dataTransfer?.files?.[0], inputEl, zone, container);
    });
  });

  // 兜底：文件拖到弹窗其它位置时不跳转离开页面
  if (container && !container.dataset.dropGuard) {
    container.dataset.dropGuard = "1";
    const hasFiles = e => Array.from(e.dataTransfer?.types || []).includes("Files");
    container.addEventListener("dragover", e => { if (hasFiles(e)) e.preventDefault(); });
    container.addEventListener("drop", e => { if (hasFiles(e)) e.preventDefault(); });
  }

  $$("[data-preset-target]", container).forEach(btn => {
    btn.addEventListener("click", () => {
      const inputEl = $(`#${btn.dataset.presetTarget}`, container);
      if (inputEl) {
        inputEl.value = btn.dataset.presetVal || "";
        $(`[data-drop-target="${btn.dataset.presetTarget}"]`, container)?.classList.add("is-has-file");
      }
    });
  });

  $$("[data-clear-target]", container).forEach(btn => {
    btn.addEventListener("click", () => {
      const inputEl = $(`#${btn.dataset.clearTarget}`, container);
      if (inputEl) {
        inputEl.value = "";
        $(`[data-drop-target="${btn.dataset.clearTarget}"]`, container)?.classList.remove("is-has-file");
      }
    });
  });
}

/* ---------- 管理员通用编辑器弹窗 (#editor-dialog) ---------- */
let activeEditorContext = null;

function openEditorModal(type, targetId = null, focusField = null, presetDefaults = {}) {
  if (authState.mode !== "admin") {
    openAuthModal();
    return;
  }

  const dialog = $("#editor-dialog");
  const titleEl = $("#editor-dialog-title");
  const kickerEl = $("#editor-dialog-kicker");
  const bodyEl = $("#editor-form-body");
  const footLeft = $("#editor-foot-left");
  if (!dialog || !bodyEl) return;

  activeEditorContext = { type, targetId };
  footLeft.innerHTML = "";
  if (typeof stopHomeCarousel === "function") stopHomeCarousel();

  if (type === "home-hero") {
    const h = DATA.home || {};
    kickerEl.textContent = "ARCHIVE 00 // CITY HOME HERO & BACKDROP";
    titleEl.textContent = "编辑城市首页标语与大背景图";
    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field span-2">
          <label for="ed-overline">顶部英文导语 (Overline)</label>
          <input class="form-input" id="ed-overline" value="${escapeHtml(h.overline || "A CITY OF STORIES & DESIRE")}">
        </div>
        <div class="form-field">
          <label for="ed-title">城市主标题</label>
          <input class="form-input" id="ed-title" value="${escapeHtml(h.title || "CHIRAKA")}">
        </div>
        <div class="form-field">
          <label for="ed-subtitle">手写体副标题</label>
          <input class="form-input" id="ed-subtitle" value="${escapeHtml(h.subtitle || "Vice Unity")}">
        </div>
        <div class="form-field span-2">
          <label for="ed-motto-cn">核心中文标语 (支持换行)</label>
          <textarea class="form-textarea" id="ed-motto-cn">${escapeHtml(h.mottoCn || "")}</textarea>
        </div>
        <div class="form-field span-2">
          <label for="ed-motto-en">英文注脚标语</label>
          <input class="form-input" id="ed-motto-en" value="${escapeHtml(h.mottoEn || "")}">
        </div>
        ${buildImageFieldHtml("ed-home-backdrop", "首页落日城市大背景图", h.backdrop || "assets/bg/city-sunset.jpg")}
      </div>
    `;
    wireImageUploadControls(bodyEl);
  } else if (type === "home-folder") {
    const folders = getArchiveFolders();
    const idx = Number(targetId) || 0;
    const f = folders[idx] || folders[0];
    const defaultEnter = f.enterText || DEFAULT_ENTER_TEXTS[f.index] || `进入${f.label} // OPEN`;
    kickerEl.textContent = `EVIDENCE BOARD // FOLDER ${f.index}`;
    titleEl.textContent = `编辑首页调查板卷宗与拍立得封面 (${f.index} ${f.label})`;
    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field">
          <label for="ed-folder-label">入口中文标题</label>
          <input class="form-input" id="ed-folder-label" value="${escapeHtml(f.label)}">
        </div>
        <div class="form-field">
          <label for="ed-folder-en">入口英文副标</label>
          <input class="form-input" id="ed-folder-en" value="${escapeHtml(f.english)}">
        </div>
        <div class="form-field">
          <label for="ed-folder-enter">专属入口按钮文字 (告别千篇一律的“打开卷宗”)</label>
          <input class="form-input" id="ed-folder-enter" value="${escapeHtml(defaultEnter)}" placeholder="例如：调阅人物卷宗 // DOSSIER">
        </div>
        <div class="form-field">
          <label for="ed-folder-photolabel">拍立得照片下方手写注记</label>
          <input class="form-input" id="ed-folder-photolabel" value="${escapeHtml(f.photoLabel)}">
        </div>
        ${buildImageFieldHtml("ed-folder-photo", "拍立得相框封面图片 (如 Vice Unity · 01)", f.photo)}
        <div class="form-field span-2">
          <label for="ed-folder-desc">入口简介文案</label>
          <textarea class="form-textarea" id="ed-folder-desc">${escapeHtml(f.desc)}</textarea>
        </div>
        <div class="form-field">
          <label for="ed-folder-pills">快捷标签胶囊 (逗号分隔)</label>
          <input class="form-input" id="ed-folder-pills" value="${escapeHtml((f.pills || []).join("，"))}">
        </div>
        <div class="form-field">
          <label for="ed-folder-sig">底部核验手写签名 (Verified By)</label>
          <input class="form-input" id="ed-folder-sig" value="${escapeHtml(f.signature)}">
        </div>
        <div class="form-field span-2">
          <label for="ed-folder-kicker">顶部档案编号栏 (Kicker)</label>
          <input class="form-input" id="ed-folder-kicker" value="${escapeHtml(f.kicker)}">
        </div>
      </div>
    `;
    wireImageUploadControls(bodyEl);
  } else if (type === "character") {
    const isNew = targetId === "__new__";
    const existing = !isNew ? DATA.characters.find(c => c.id === targetId) : null;
    const nextNum = String(DATA.characters.length + 1).padStart(2, "0");
    const charObj = existing || {
      id: `ch-${Date.now().toString(36).slice(-4)}`,
      label: `角色 ${nextNum}`,
      name: "待补充",
      alias: "待补充",
      gender: "待补充",
      birthday: "待补充",
      zodiac: "待补充",
      age: "待补充",
      height: "待补充",
      category: "core",
      categoryLabel: "核心角色",
      status: "待补充",
      identity: "待补充",
      faction: "待补充",
      tone: "pink",
      image: "",
      summary: "待补充",
      appearance: "待补充",
      appearanceImages: [],
      storylines: [
        { stage: "序章 · 档案记录", title: "待补充故事标题", content: "待补充角色故事线内容。" }
      ],
      notes: "待补充",
      relations: []
    };
    activeEditorContext.charObj = charObj;
    activeEditorContext.isNew = isNew;

    kickerEl.textContent = `ARCHIVE 01 // ${isNew ? "NEW CHARACTER DOSSIER" : charObj.id.toUpperCase()}`;
    titleEl.textContent = isNew ? "新增角色档案卷宗" : `编辑角色卷宗 · ${charObj.label}`;

    const toneOpts = TONE_OPTIONS.map(
      t => `<option value="${t.value}"${charObj.tone === t.value ? " selected" : ""}>${t.label}</option>`
    ).join("");

    const otherChars = DATA.characters.filter(c => c.id !== charObj.id);
    const renderRelationRow = (rel = { target: otherChars[0]?.id || "ch-01", label: "待补充" }) => {
      const charOpts = otherChars.map(
        c => `<option value="${escapeHtml(c.id)}"${c.id === rel.target ? " selected" : ""}>${escapeHtml(getCharacterDisplayName(c))}</option>`
      ).join("");
      return `
        <div class="relation-edit-row">
          <select class="form-select rel-target-select">${charOpts}</select>
          <input class="form-input rel-label-input" type="text" value="${escapeHtml(rel.label)}" placeholder="关系描述（如：宿敌 / 搭档 / 恋人 / 线人）">
          <button class="admin-tool-btn is-danger rel-remove-btn" type="button">删除</button>
        </div>
      `;
    };

    const renderStorylineRow = (st = { stage: "新章节", title: "待补充标题", content: "待补充故事内容" }) => `
      <div class="storyline-edit-row" style="padding:10px;background:#120b22;border:1px solid rgba(255,255,255,0.22);border-radius:2px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input st-stage-input" type="text" value="${escapeHtml(st.stage || "")}" placeholder="阶段（如：序章 / 第一幕）" style="max-width:160px">
          <input class="form-input st-title-input" type="text" value="${escapeHtml(st.title || "")}" placeholder="故事章节标题" style="flex:1">
          <button class="admin-tool-btn is-danger st-remove-btn" type="button">删除章节</button>
        </div>
        <textarea class="form-textarea st-content-input" style="min-height:60px" placeholder="填写该章节的故事线详情...">${escapeHtml(st.content || "")}</textarea>
      </div>
    `;

    const existingStories = Array.isArray(charObj.storylines) && charObj.storylines.length
      ? charObj.storylines
      : [{ stage: "序章 · 档案记录", title: "待补充故事标题", content: "待补充角色故事线内容。" }];

    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field">
          <label for="ed-char-label">卷宗代号 / 卡片主标题</label>
          <input class="form-input" id="ed-char-label" value="${escapeHtml(charObj.label)}" required>
        </div>
        <div class="form-field">
          <label for="ed-char-name">姓名</label>
          <input class="form-input" id="ed-char-name" name="name" value="${escapeHtml(charObj.name || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-alias">别称 / 街头代号</label>
          <input class="form-input" id="ed-char-alias" name="alias" value="${escapeHtml(charObj.alias || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-gender">性别</label>
          <input class="form-input" id="ed-char-gender" name="gender" value="${escapeHtml(charObj.gender || "待补充")}" placeholder="例如：女 / 男 / 其他">
        </div>
        <div class="form-field">
          <label for="ed-char-birthday">生日</label>
          <input class="form-input" id="ed-char-birthday" name="birthday" value="${escapeHtml(charObj.birthday || "待补充")}" placeholder="例如：11月24日">
        </div>
        <div class="form-field">
          <label for="ed-char-zodiac">星座</label>
          <input class="form-input" id="ed-char-zodiac" name="zodiac" value="${escapeHtml(charObj.zodiac || "待补充")}" placeholder="例如：天蝎座 / 射手座">
        </div>
        <div class="form-field">
          <label for="ed-char-age">年龄</label>
          <input class="form-input" id="ed-char-age" name="age" value="${escapeHtml(charObj.age || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-height">身高</label>
          <input class="form-input" id="ed-char-height" name="height" value="${escapeHtml(charObj.height || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-identity">身份 / 职业</label>
          <input class="form-input" id="ed-char-identity" name="identity" value="${escapeHtml(charObj.identity || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-faction">所属势力 / 阵营</label>
          <input class="form-input" id="ed-char-faction" name="faction" value="${escapeHtml(charObj.faction || "待补充")}">
        </div>
        <div class="form-field">
          <label for="ed-char-category">档案分类</label>
          <select class="form-select" id="ed-char-category">
            <option value="core"${charObj.category === "core" ? " selected" : ""}>核心角色 (Core)</option>
            <option value="side"${charObj.category === "side" ? " selected" : ""}>配角档案 (Side)</option>
          </select>
        </div>
        <div class="form-field">
          <label for="ed-char-status">当前状态</label>
          <input class="form-input" id="ed-char-status" name="status" value="${escapeHtml(charObj.status || "待补充")}">
        </div>
        <div class="form-field span-2">
          <label for="ed-char-tone">拍立得霓虹色调</label>
          <select class="form-select" id="ed-char-tone">${toneOpts}</select>
        </div>
        ${buildImageFieldHtml("ed-char-image", "角色主立绘 / 拍立得封面", charObj.image)}
        <div class="form-field span-2">
          <label for="ed-char-summary">01 · 人物设定与档案摘要 (Summary)</label>
          <textarea class="form-textarea" id="ed-char-summary" name="summary">${escapeHtml(charObj.summary)}</textarea>
        </div>
        <div class="form-field span-2">
          <label for="ed-char-appearance">
            <span>02 · 外观与服装文字设定 (Appearance)</span>
            <small>外观与服装插图可在角色页直接点击「+ 上传外观/服装插图」或通过画廊自动联动</small>
          </label>
          <textarea class="form-textarea" id="ed-char-appearance" name="appearance">${escapeHtml(charObj.appearance)}</textarea>
        </div>
        <div class="form-field span-2" id="ed-char-storylines-wrap">
          <label>
            <span>03 · 角色故事线章节 (Storylines)</span>
            <button class="admin-tool-btn is-gold" type="button" id="add-storyline-row-btn">+ 新增故事章节</button>
          </label>
          <div class="relations-editor-list" id="ed-storylines-list">
            ${existingStories.map(st => renderStorylineRow(st)).join("")}
          </div>
        </div>
        <div class="form-field span-2">
          <label for="ed-char-notes">补充设定备注 (Notes)</label>
          <textarea class="form-textarea" id="ed-char-notes" name="notes" style="min-height:60px">${escapeHtml(charObj.notes)}</textarea>
        </div>
        <div class="form-field span-2" id="ed-char-relations-wrap">
          <label>
            <span>04 · 红线关系调查板 (最多展示前 4 条核心关联)</span>
            <button class="admin-tool-btn is-gold" type="button" id="add-rel-row-btn">+ 添加关系线</button>
          </label>
          <div class="relations-editor-list" id="ed-relations-list">
            ${(charObj.relations || []).map(r => renderRelationRow(r)).join("")}
          </div>
        </div>
      </div>
    `;

    wireImageUploadControls(bodyEl);

    const relListEl = $("#ed-relations-list", bodyEl);
    const bindRelRemove = () => {
      $$(".rel-remove-btn", relListEl).forEach(btn => {
        btn.onclick = () => btn.closest(".relation-edit-row")?.remove();
      });
    };
    bindRelRemove();

    $("#add-rel-row-btn", bodyEl)?.addEventListener("click", () => {
      const temp = document.createElement("div");
      temp.innerHTML = renderRelationRow();
      relListEl.appendChild(temp.firstElementChild);
      bindRelRemove();
    });

    const stListEl = $("#ed-storylines-list", bodyEl);
    const bindStRemove = () => {
      $$(".st-remove-btn", stListEl).forEach(btn => {
        btn.onclick = () => btn.closest(".storyline-edit-row")?.remove();
      });
    };
    bindStRemove();

    $("#add-storyline-row-btn", bodyEl)?.addEventListener("click", () => {
      const temp = document.createElement("div");
      temp.innerHTML = renderStorylineRow();
      stListEl.appendChild(temp.firstElementChild);
      bindStRemove();
    });

    if (!isNew && DATA.characters.length > 1) {
      footLeft.innerHTML = `<button class="admin-tool-btn is-danger" type="button" id="delete-entity-btn">🗑 删除此角色卷宗</button>`;
      $("#delete-entity-btn", footLeft)?.addEventListener("click", () => {
        DATA.characters = DATA.characters.filter(c => c.id !== charObj.id);
        dialog.close();
        document.body.classList.remove("has-dialog");
        if (currentCharacterId === charObj.id && DATA.characters[0]) {
          currentCharacterId = DATA.characters[0].id;
        }
        saveSiteData(`🗑 已删除角色「${charObj.label}」`);
      });
    }
  } else if (type === "news") {
    const isNew = targetId === "__new__";
    const existing = !isNew ? DATA.news.find(n => n.id === targetId) : null;
    const newsObj = existing || {
      id: `n-${Date.now().toString(36).slice(-4)}`,
      postType: "forum",
      category: "街头论坛",
      tone: "cyan",
      title: "待补充帖子或报道标题",
      summary: "待补充摘要",
      date: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date()),
      author: "匿名市民",
      authorRole: "Night BBS 楼主",
      views: 360,
      likes: 12,
      image: "",
      relatedCharacters: [],
      body: ["待补充正文内容"],
      comments: []
    };
    activeEditorContext.newsObj = newsObj;
    activeEditorContext.isNew = isNew;

    kickerEl.textContent = `ARCHIVE 02 // ${isNew ? "NEW POST OR DISPATCH" : newsObj.id.toUpperCase()}`;
    titleEl.textContent = isNew ? "发布城市新闻报道 / 街头论坛新帖" : `编辑帖子 · ${newsObj.title}`;

    const toneOpts = TONE_OPTIONS.map(
      t => `<option value="${t.value}"${newsObj.tone === t.value ? " selected" : ""}>${t.label}</option>`
    ).join("");

    const relatedSet = new Set(newsObj.relatedCharacters || []);
    const charCheckboxesHtml = (DATA.characters || []).map(c => `
      <label style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:#1a1030;border:1px solid rgba(255,255,255,0.28);border-radius:2px;color:#fff;cursor:pointer">
        <input type="checkbox" class="ed-news-char-cb" value="${escapeHtml(c.id)}"${relatedSet.has(c.id) ? " checked" : ""}>
        <span>${escapeHtml(getCharacterDisplayName(c))}</span>
      </label>
    `).join("");

    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field">
          <label for="ed-news-posttype">发布类型 (新闻报道 / 街头论坛)</label>
          <select class="form-select" id="ed-news-posttype">
            <option value="news"${newsObj.postType !== "forum" ? " selected" : ""}>📰 官方城市新闻报道 (City Desk)</option>
            <option value="forum"${newsObj.postType === "forum" ? " selected" : ""}>💬 街头匿名论坛帖子 (Night BBS)</option>
          </select>
        </div>
        <div class="form-field">
          <label for="ed-news-category">所属板块 / 栏目</label>
          <input class="form-input" id="ed-news-category" value="${escapeHtml(newsObj.category)}" placeholder="头版 / 街头论坛 / 夜生活 / 公告 / 文化">
        </div>
        <div class="form-field span-2">
          <label for="ed-news-title">主标题 / 帖子标题</label>
          <input class="form-input" id="ed-news-title" value="${escapeHtml(newsObj.title)}" required>
        </div>
        <div class="form-field">
          <label for="ed-news-author">发帖人 / 署名记者</label>
          <input class="form-input" id="ed-news-author" value="${escapeHtml(newsObj.author)}">
        </div>
        <div class="form-field">
          <label for="ed-news-role">发帖人身份铭牌</label>
          <input class="form-input" id="ed-news-role" value="${escapeHtml(newsObj.authorRole || "匿名市民")}" placeholder="例如：官方记者 / Night BBS 楼主 / 街头线人">
        </div>
        <div class="form-field">
          <label for="ed-news-date">发布时间</label>
          <input class="form-input" id="ed-news-date" value="${escapeHtml(newsObj.date)}">
        </div>
        <div class="form-field">
          <label for="ed-news-tone">视觉色调</label>
          <select class="form-select" id="ed-news-tone">${toneOpts}</select>
        </div>
        <div class="form-field span-2">
          <label>关联角色档案 (勾选后将自动同步至对应角色的故事线与卷宗联动区)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">${charCheckboxesHtml}</div>
        </div>
        <div class="form-field span-2">
          <label for="ed-news-summary">列表导语摘要</label>
          <textarea class="form-textarea" id="ed-news-summary" style="min-height:60px">${escapeHtml(newsObj.summary)}</textarea>
        </div>
        ${buildImageFieldHtml("ed-news-image", "主帖/报道配图 (可选)", newsObj.image)}
        <div class="form-field span-2">
          <label for="ed-news-body">主帖正文内容 (每行代表一个自然段)</label>
          <textarea class="form-textarea" id="ed-news-body" style="min-height:140px">${escapeHtml((newsObj.body || []).join("\n"))}</textarea>
        </div>
      </div>
    `;

    wireImageUploadControls(bodyEl);

    if (!isNew && DATA.news.length > 1) {
      footLeft.innerHTML = `<button class="admin-tool-btn is-danger" type="button" id="delete-entity-btn">🗑 删除此篇报道/帖子</button>`;
      $("#delete-entity-btn", footLeft)?.addEventListener("click", () => {
        DATA.news = DATA.news.filter(n => n.id !== newsObj.id);
        dialog.close();
        document.body.classList.remove("has-dialog");
        if (currentArticleId === newsObj.id && DATA.news[0]) {
          currentArticleId = DATA.news[0].id;
        }
        saveSiteData(`🗑 已删除「${newsObj.title}」`);
      });
    }
  } else if (type === "gallery") {
    const isNew = targetId === "__new__";
    const existing = !isNew ? DATA.gallery.find(g => g.id === targetId) : null;
    const nextNum = String(DATA.gallery.length + 1).padStart(2, "0");
    const galObj = existing || {
      id: `g-${Date.now().toString(36).slice(-4)}`,
      category: presetDefaults.category || "character",
      title: `插画分镜 ${nextNum}`,
      characterId: presetDefaults.characterId || "",
      story: "待补充（写下这幅插画背后的小故事或设定注记，将与所选角色档案实时联动）",
      src: "",
      tone: "pink",
      span: "normal"
    };
    activeEditorContext.galObj = galObj;
    activeEditorContext.isNew = isNew;

    kickerEl.textContent = `ARCHIVE 03 // ${isNew ? "NEW GALLERY PANEL" : galObj.id.toUpperCase()}`;
    titleEl.textContent = isNew ? "新增插画分镜与故事" : `编辑画廊分镜 · ${galObj.title}`;

    const toneOpts = TONE_OPTIONS.map(
      t => `<option value="${t.value}"${galObj.tone === t.value ? " selected" : ""}>${t.label}</option>`
    ).join("");

    const charSelectOpts = `<option value="">不绑定特定角色（公共/独立群像）</option>` + (DATA.characters || []).map(
      c => `<option value="${escapeHtml(c.id)}"${galObj.characterId === c.id ? " selected" : ""}>${escapeHtml(getCharacterDisplayName(c))}</option>`
    ).join("");

    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field">
          <label for="ed-gal-title">插画 / 设定图标题</label>
          <input class="form-input" id="ed-gal-title" value="${escapeHtml(galObj.title)}" required>
        </div>
        <div class="form-field">
          <label for="ed-gal-charid">联动绑定角色档案 (双向同步外观与故事线)</label>
          <select class="form-select" id="ed-gal-charid">${charSelectOpts}</select>
        </div>
        <div class="form-field">
          <label for="ed-gal-category">分镜类型 (选「服装设定/角色立绘」将同步至角色外观栏)</label>
          <select class="form-select" id="ed-gal-category">
            <option value="character"${galObj.category === "character" ? " selected" : ""}>角色立绘 (Character)</option>
            <option value="costume"${galObj.category === "costume" ? " selected" : ""}>服装与外观设定 (Costume)</option>
            <option value="group"${galObj.category === "group" ? " selected" : ""}>群像插画 (Group)</option>
            <option value="comic"${galObj.category === "comic" ? " selected" : ""}>漫画剧情分镜 (Comic)</option>
          </select>
        </div>
        <div class="form-field">
          <label for="ed-gal-span">画廊网格尺寸</label>
          <select class="form-select" id="ed-gal-span">
            <option value="normal"${!galObj.span || galObj.span === "normal" ? " selected" : ""}>标准分镜 (1×1)</option>
            <option value="wide"${galObj.span === "wide" ? " selected" : ""}>宽幅横版分镜 (2×1)</option>
            <option value="tall"${galObj.span === "tall" ? " selected" : ""}>竖幅立绘分镜 (1×2)</option>
          </select>
        </div>
        <div class="form-field span-2">
          <label for="ed-gal-tone">底板霓虹色调</label>
          <select class="form-select" id="ed-gal-tone">${toneOpts}</select>
        </div>
        ${buildImageFieldHtml("ed-gal-src", "插画原图文件", galObj.src)}
        <div class="form-field span-2">
          <label for="ed-gal-story">画面背后的故事 / 设定说明 (精简展示，与角色卷宗同步)</label>
          <textarea class="form-textarea" id="ed-gal-story" style="min-height:100px">${escapeHtml(galObj.story || galObj.meta || "待补充")}</textarea>
        </div>
      </div>
    `;

    wireImageUploadControls(bodyEl);

    if (!isNew && DATA.gallery.length > 1) {
      footLeft.innerHTML = `<button class="admin-tool-btn is-danger" type="button" id="delete-entity-btn">🗑 删除此分镜</button>`;
      $("#delete-entity-btn", footLeft)?.addEventListener("click", () => {
        DATA.gallery = DATA.gallery.filter(g => g.id !== galObj.id);
        dialog.close();
        document.body.classList.remove("has-dialog");
        saveSiteData(`🗑 已删除画廊分镜「${galObj.title}」`);
      });
    }
  } else if (type === "stations") {
    kickerEl.textContent = "ARCHIVE 04 // RADIO STATIONS MANAGER";
    titleEl.textContent = "管理与新增城市电台频段";

    const renderStationRow = (st = { id: `st-${Date.now().toString(36).slice(-4)}`, name: "New Station", suit: "♠", freq: "FM 98.8", host: "Night DJ", desc: "新增自定义频段" }) => `
      <div class="station-edit-row" style="padding:12px;background:#120b22;border:1px solid rgba(255,255,255,0.25);border-radius:2px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;align-items:center">
        <input type="hidden" class="st-id-input" value="${escapeHtml(st.id)}">
        <div>
          <label style="font-size:10.5px;color:var(--cyan);display:block">频段名称</label>
          <input class="form-input st-name-input" type="text" value="${escapeHtml(st.name)}" required>
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--cyan);display:block">广播频率 (FM)</label>
          <input class="form-input st-freq-input" type="text" value="${escapeHtml(st.freq || "FM 88.8")}">
        </div>
        <div>
          <label style="font-size:10.5px;color:var(--cyan);display:block">筹码花色 &amp; DJ</label>
          <div style="display:flex;gap:6px">
            <select class="form-select st-suit-select" style="max-width:70px">
              <option value="♥"${st.suit === "♥" ? " selected" : ""}>♥</option>
              <option value="♠"${st.suit === "♠" ? " selected" : ""}>♠</option>
              <option value="♦"${st.suit === "♦" ? " selected" : ""}>♦</option>
              <option value="♣"${st.suit === "♣" ? " selected" : ""}>♣</option>
            </select>
            <input class="form-input st-host-input" type="text" value="${escapeHtml(st.host || "DJ")}" placeholder="DJ署名">
          </div>
        </div>
        <div style="grid-column:1/-1;display:flex;gap:8px;align-items:center">
          <input class="form-input st-desc-input" type="text" value="${escapeHtml(st.desc || "")}" placeholder="频段风格描述">
          <button class="admin-tool-btn is-danger st-del-btn" type="button" style="flex-shrink:0">删除频段</button>
        </div>
      </div>
    `;

    bodyEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <p style="margin:0;font-size:13px;color:rgba(255,235,245,0.85)">可自由修改现有电台频段名称、FM 频率与花色，或点击右侧按钮创建全新的电台频段：</p>
        <button class="admin-tool-btn is-gold" type="button" id="add-station-row-btn">+ 新增电台频段</button>
      </div>
      <div class="relations-editor-list" id="ed-stations-list">
        ${radio.stations.map(s => renderStationRow(s)).join("")}
      </div>
    `;

    const stListEl = $("#ed-stations-list", bodyEl);
    const bindStDel = () => {
      $$(".st-del-btn", stListEl).forEach(btn => {
        btn.onclick = () => {
          if ($$(".station-edit-row", stListEl).length <= 1) {
            showToast("⚠ 至少需要保留一个电台频段");
            return;
          }
          btn.closest(".station-edit-row")?.remove();
        };
      });
    };
    bindStDel();

    $("#add-station-row-btn", bodyEl)?.addEventListener("click", () => {
      const temp = document.createElement("div");
      temp.innerHTML = renderStationRow();
      stListEl.appendChild(temp.firstElementChild);
      bindStDel();
    });
  } else if (type === "track") {
    const idx = Number(targetId);
    const isNew = idx < 0 || Number.isNaN(idx) || !DATA.tracks[idx];
    const nextNum = String(DATA.tracks.length + 1).padStart(2, "0");
    const defaultStationId = radio.stations[0]?.id || "vice-unity";
    const trackObj = !isNew
      ? DATA.tracks[idx]
      : {
          id: `t-${Date.now().toString(36).slice(-4)}`,
          title: `曲目 ${nextNum}`,
          artist: "CHIRAKA FM",
          src: "",
          duration: "03:45",
          scene: "Sunset Strip",
          station: defaultStationId,
          characterId: "",
          suit: "♥",
          rank: "10",
          cover: "assets/bg/city-sunset.jpg",
          tone: "pink",
          bpm: "90 BPM · WEST COAST SYNTH"
        };
    activeEditorContext.trackIdx = idx;
    activeEditorContext.trackObj = trackObj;
    activeEditorContext.isNew = isNew;

    kickerEl.textContent = `ARCHIVE 04 // CHIRAKA FM 88.8`;
    titleEl.textContent = isNew ? "新增城市电台歌曲" : `编辑电台歌曲 · ${trackObj.title}`;

    const stationOptsHtml = radio.stations.map(
      st => `<option value="${escapeHtml(st.id)}"${trackObj.station === st.id ? " selected" : ""}>${escapeHtml(st.suit || "♥")} ${escapeHtml(st.name)} (${escapeHtml(st.freq || "FM 88.8")})</option>`
    ).join("");

    const charSelectOpts = `<option value="">不绑定特定角色（公共电台曲目）</option>` + (DATA.characters || []).map(
      c => `<option value="${escapeHtml(c.id)}"${trackObj.characterId === c.id ? " selected" : ""}>角色印象曲：${escapeHtml(getCharacterDisplayName(c))}</option>`
    ).join("");

    bodyEl.innerHTML = `
      <div class="form-grid">
        <div class="form-field">
          <label for="ed-track-title">歌曲名称</label>
          <input class="form-input" id="ed-track-title" value="${escapeHtml(trackObj.title)}" required>
        </div>
        <div class="form-field">
          <label for="ed-track-artist">艺术家 / 歌手署名</label>
          <input class="form-input" id="ed-track-artist" value="${escapeHtml(trackObj.artist)}">
        </div>
        <div class="form-field">
          <label for="ed-track-station">所属电台频段 <button type="button" id="jump-manage-stations-btn" style="color:var(--gold);font-size:11px;text-decoration:underline">管理/新增频段</button></label>
          <select class="form-select" id="ed-track-station">${stationOptsHtml}</select>
        </div>
        <div class="form-field">
          <label for="ed-track-charid">关联角色印象曲 (双向同步至角色卷宗)</label>
          <select class="form-select" id="ed-track-charid">${charSelectOpts}</select>
        </div>
        <div class="form-field">
          <label for="ed-track-scene">城市声景地点 (Scene)</label>
          <input class="form-input" id="ed-track-scene" value="${escapeHtml(trackObj.scene || "Sunset Blvd")}">
        </div>
        <div class="form-field">
          <label for="ed-track-bpm">BPM 与曲风描述</label>
          <input class="form-input" id="ed-track-bpm" value="${escapeHtml(trackObj.bpm || "92 BPM · WEST COAST SYNTH")}">
        </div>
        <div class="form-field">
          <label for="ed-track-duration">歌曲时长 (MM:SS)</label>
          <input class="form-input" id="ed-track-duration" value="${escapeHtml(trackObj.duration || "03:42")}">
        </div>
        <div class="form-field">
          <label>扑克牌点数 &amp; 花色</label>
          <div style="display:flex;gap:6px">
            <input class="form-input" id="ed-track-rank" value="${escapeHtml(trackObj.rank || "A")}" placeholder="A/K/Q/J" style="max-width:90px">
            <select class="form-select" id="ed-track-suit">
              <option value="♥"${trackObj.suit === "♥" ? " selected" : ""}>♥ 红桃</option>
              <option value="♠"${trackObj.suit === "♠" ? " selected" : ""}>♠ 黑桃</option>
              <option value="♦"${trackObj.suit === "♦" ? " selected" : ""}>♦ 方块</option>
              <option value="♣"${trackObj.suit === "♣" ? " selected" : ""}>♣ 梅花</option>
            </select>
          </div>
        </div>
        <div class="form-field span-2">
          <label for="ed-track-src">
            <span>音频文件地址 (src)</span>
            <small>填写 mp3/ogg 链接或上传本地音频试听</small>
          </label>
          <input class="form-input" id="ed-track-src" value="${escapeHtml(trackObj.src || "")}" placeholder="assets/audio/track-01.mp3 或 https://...">
          <div class="upload-row">
            <label class="upload-file-label">
              <span>🎵 选择本地音频文件试听</span>
              <input type="file" accept="audio/*" id="ed-track-audio-file" style="display:none">
            </label>
            <button class="preset-chip" type="button" id="ed-track-clear-audio">清空音频地址</button>
          </div>
        </div>
        ${buildImageFieldHtml("ed-track-cover", "单曲黑胶封面图", trackObj.cover)}
      </div>
    `;

    wireImageUploadControls(bodyEl);

    $("#jump-manage-stations-btn", bodyEl)?.addEventListener("click", () => {
      openEditorModal("stations");
    });

    $("#ed-track-audio-file", bodyEl)?.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const objUrl = URL.createObjectURL(file);
      const srcInput = $("#ed-track-src", bodyEl);
      if (srcInput) srcInput.value = objUrl;
      showToast(`🎵 已加载音频文件「${file.name}」，点击保存即可播放`);
    });

    $("#ed-track-clear-audio", bodyEl)?.addEventListener("click", () => {
      const srcInput = $("#ed-track-src", bodyEl);
      if (srcInput) srcInput.value = "";
    });

    if (!isNew && DATA.tracks.length > 1) {
      footLeft.innerHTML = `<button class="admin-tool-btn is-danger" type="button" id="delete-entity-btn">🗑 删除此歌曲</button>`;
      $("#delete-entity-btn", footLeft)?.addEventListener("click", () => {
        DATA.tracks.splice(idx, 1);
        if (radio.current >= DATA.tracks.length) radio.current = 0;
        dialog.close();
        document.body.classList.remove("has-dialog");
        saveSiteData(`🗑 已删除歌曲「${trackObj.title}」`);
      });
    }
  }

  if (focusField) {
    setTimeout(() => {
      const targetInput = $(`#${focusField}, [name="${focusField}"], #ed-char-${focusField}`, bodyEl);
      if (targetInput) {
        targetInput.focus();
        if (typeof targetInput.select === "function") targetInput.select();
      }
    }, 60);
  }

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

function handleEditorFormSubmit(e) {
  e.preventDefault();
  if (!activeEditorContext) return;
  const { type, targetId } = activeEditorContext;
  const dialog = $("#editor-dialog");

  if (type === "home-hero") {
    if (!DATA.home) DATA.home = {};
    DATA.home.overline = $("#ed-overline")?.value.trim() || "A CITY OF STORIES & DESIRE";
    DATA.home.title = $("#ed-title")?.value.trim() || "CHIRAKA";
    DATA.home.subtitle = $("#ed-subtitle")?.value.trim() || "Vice Unity";
    DATA.home.mottoCn = $("#ed-motto-cn")?.value.trim() || "";
    DATA.home.mottoEn = $("#ed-motto-en")?.value.trim() || "";
    DATA.home.backdrop = $("#ed-home-backdrop")?.value.trim() || "assets/bg/city-sunset.jpg";
    saveSiteData("✓ 城市首页标语与背景已更新");
  } else if (type === "home-folder") {
    const folders = getArchiveFolders();
    const idx = Number(targetId) || 0;
    const f = folders[idx];
    if (f) {
      f.label = $("#ed-folder-label")?.value.trim() || f.label;
      f.english = $("#ed-folder-en")?.value.trim() || f.english;
      f.enterText = $("#ed-folder-enter")?.value.trim() || f.enterText;
      f.kicker = $("#ed-folder-kicker")?.value.trim() || f.kicker;
      f.signature = $("#ed-folder-sig")?.value.trim() || f.signature;
      f.desc = $("#ed-folder-desc")?.value.trim() || f.desc;
      f.photoLabel = $("#ed-folder-photolabel")?.value.trim() || f.photoLabel;
      f.photo = $("#ed-folder-photo")?.value.trim() || f.photo;
      const rawPills = $("#ed-folder-pills")?.value || "";
      f.pills = rawPills.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      saveSiteData(`✓ 首页调查板「${f.label}」封面与入口文案已更新`);
    }
  } else if (type === "character") {
    const { charObj, isNew } = activeEditorContext;
    const cat = $("#ed-char-category")?.value || "core";
    charObj.label = $("#ed-char-label")?.value.trim() || charObj.label;
    charObj.name = $("#ed-char-name")?.value.trim() || "待补充";
    charObj.alias = $("#ed-char-alias")?.value.trim() || "待补充";
    charObj.gender = $("#ed-char-gender")?.value.trim() || "待补充";
    charObj.birthday = $("#ed-char-birthday")?.value.trim() || "待补充";
    charObj.zodiac = $("#ed-char-zodiac")?.value.trim() || "待补充";
    charObj.age = $("#ed-char-age")?.value.trim() || "待补充";
    charObj.height = $("#ed-char-height")?.value.trim() || "待补充";
    charObj.identity = $("#ed-char-identity")?.value.trim() || "待补充";
    charObj.faction = $("#ed-char-faction")?.value.trim() || "待补充";
    charObj.category = cat;
    charObj.categoryLabel = cat === "core" ? "核心角色" : "配角";
    charObj.status = $("#ed-char-status")?.value.trim() || "待补充";
    charObj.tone = $("#ed-char-tone")?.value || "pink";
    charObj.image = $("#ed-char-image")?.value.trim() || "";
    charObj.summary = $("#ed-char-summary")?.value.trim() || "待补充";
    charObj.appearance = $("#ed-char-appearance")?.value.trim() || "待补充";
    charObj.notes = $("#ed-char-notes")?.value.trim() || "待补充";

    const stRows = $$("#ed-storylines-list .storyline-edit-row");
    charObj.storylines = stRows.map(row => ({
      stage: $(".st-stage-input", row)?.value.trim() || "故事章节",
      title: $(".st-title-input", row)?.value.trim() || "待补充标题",
      content: $(".st-content-input", row)?.value.trim() || "待补充内容"
    }));

    const relRows = $$("#ed-relations-list .relation-edit-row");
    charObj.relations = relRows.map(row => ({
      target: $(".rel-target-select", row)?.value || "ch-01",
      label: $(".rel-label-input", row)?.value.trim() || "待补充"
    })).filter(r => r.target);

    if (isNew) {
      DATA.characters.push(charObj);
      currentCharacterId = charObj.id;
    }
    saveSiteData(`✓ 角色卷宗「${charObj.label}」已保存`);
  } else if (type === "news") {
    const { newsObj, isNew } = activeEditorContext;
    newsObj.postType = $("#ed-news-posttype")?.value || "news";
    newsObj.category = $("#ed-news-category")?.value.trim() || "城市";
    newsObj.tone = $("#ed-news-tone")?.value || "pink";
    newsObj.title = $("#ed-news-title")?.value.trim() || "待补充";
    newsObj.author = $("#ed-news-author")?.value.trim() || "匿名市民";
    newsObj.authorRole = $("#ed-news-role")?.value.trim() || "市民";
    newsObj.date = $("#ed-news-date")?.value.trim() || "待补充";
    newsObj.summary = $("#ed-news-summary")?.value.trim() || "待补充";
    newsObj.image = $("#ed-news-image")?.value.trim() || "";
    newsObj.relatedCharacters = $$(".ed-news-char-cb:checked").map(cb => cb.value);

    const rawBody = $("#ed-news-body")?.value || "";
    const paragraphs = rawBody.split(/\n+/).map(s => s.trim()).filter(Boolean);
    newsObj.body = paragraphs.length ? paragraphs : ["待补充"];

    if (isNew) {
      DATA.news.unshift(newsObj);
      currentArticleId = newsObj.id;
    }
    saveSiteData(`✓ 「${newsObj.title}」已保存`);
  } else if (type === "gallery") {
    const { galObj, isNew } = activeEditorContext;
    galObj.title = $("#ed-gal-title")?.value.trim() || galObj.title;
    galObj.characterId = $("#ed-gal-charid")?.value || "";
    galObj.category = $("#ed-gal-category")?.value || "character";
    galObj.span = $("#ed-gal-span")?.value || "normal";
    galObj.tone = $("#ed-gal-tone")?.value || "pink";
    galObj.story = $("#ed-gal-story")?.value.trim() || "待补充";
    galObj.meta = galObj.story;
    galObj.src = $("#ed-gal-src")?.value.trim() || "";

    if (isNew) {
      DATA.gallery.push(galObj);
    }
    saveSiteData(`✓ 画廊分镜「${galObj.title}」已保存并同步关联角色档案`);
  } else if (type === "stations") {
    const rows = $$("#ed-stations-list .station-edit-row");
    const updatedStations = rows.map(row => {
      const nameVal = $(".st-name-input", row)?.value.trim() || "Station";
      const rawId = $(".st-id-input", row)?.value.trim() || `st-${Date.now().toString(36).slice(-4)}`;
      return {
        id: rawId,
        name: nameVal,
        freq: $(".st-freq-input", row)?.value.trim() || "FM 88.8",
        suit: $(".st-suit-select", row)?.value || "♥",
        host: $(".st-host-input", row)?.value.trim() || "CHIRAKA",
        desc: $(".st-desc-input", row)?.value.trim() || ""
      };
    });
    if (updatedStations.length) {
      DATA.stations = updatedStations;
      saveSiteData("✓ 电台频段列表已更新");
    }
  } else if (type === "track") {
    const { trackObj, isNew } = activeEditorContext;
    trackObj.title = $("#ed-track-title")?.value.trim() || trackObj.title;
    trackObj.artist = $("#ed-track-artist")?.value.trim() || "CHIRAKA FM";
    trackObj.station = $("#ed-track-station")?.value || (radio.stations[0]?.id || "vice-unity");
    trackObj.characterId = $("#ed-track-charid")?.value || "";
    trackObj.scene = $("#ed-track-scene")?.value.trim() || "Sunset Blvd";
    trackObj.bpm = $("#ed-track-bpm")?.value.trim() || "92 BPM · WEST COAST SYNTH";
    trackObj.duration = $("#ed-track-duration")?.value.trim() || "03:42";
    trackObj.rank = $("#ed-track-rank")?.value.trim() || "A";
    trackObj.suit = $("#ed-track-suit")?.value || "♥";
    trackObj.src = $("#ed-track-src")?.value.trim() || "";
    trackObj.cover = $("#ed-track-cover")?.value.trim() || "assets/bg/city-sunset.jpg";

    if (isNew) {
      DATA.tracks.push(trackObj);
      radio.current = DATA.tracks.length - 1;
    }
    saveSiteData(`✓ 电台歌曲「${trackObj.title}」已保存`);
  }

  if (dialog) {
    dialog.close();
    document.body.classList.remove("has-dialog");
  }
}

/* ---------- 待补充清单 & 远程数据接口/备份中心 (#data-dialog) ---------- */
function downloadContentJsonFile() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "content-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("⬇ 已下载独立数据文件 content-data.json（可放置于服务器 data/ 目录）");
}

function openPendingChecklistModal() {
  const dialog = $("#data-dialog");
  const titleEl = $("#data-dialog-title");
  const kickerEl = $("#data-dialog-kicker");
  const bodyEl = $("#data-dialog-body");
  if (!dialog || !bodyEl) return;

  kickerEl.textContent = "PENDING ARCHIVE CHECKLIST // WCPD-88";
  const pendingList = countPendingItems();
  titleEl.textContent = `全站待补充内容清单（共 ${pendingList.length} 项）`;

  if (!pendingList.length) {
    bodyEl.innerHTML = `
      <div style="padding:28px;text-align:center;background:#21143a;border:1.5px solid var(--mint);border-radius:3px">
        <strong style="font-size:18px;color:var(--mint)">✦ 恭喜！全站所有“待补充”字段均已填写完毕！</strong>
        <p style="margin:8px 0 0;color:rgba(255,240,250,0.8)">你仍然可以随时点击任意卡片上的「✎ 编辑」按钮继续微调内容。</p>
      </div>
    `;
  } else {
    bodyEl.innerHTML = `
      <p style="margin:0;font-size:13px;color:rgba(255,240,250,0.85)">点击右侧「去补充 ✎」按钮，可直接打开对应条目的编辑窗口进行填写：</p>
      <div class="pending-list-grid">
        ${pendingList.map(item => `
          <div class="pending-item-row">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </div>
            <button class="admin-tool-btn is-gold" type="button" data-jump-type="${escapeHtml(item.type)}" data-jump-id="${escapeHtml(item.id)}">去补充 ✎</button>
          </div>
        `).join("")}
      </div>
    `;

    $$("[data-jump-type]", bodyEl).forEach(btn => {
      btn.addEventListener("click", () => {
        dialog.close();
        document.body.classList.remove("has-dialog");
        openEditorModal(btn.dataset.jumpType, btn.dataset.jumpId);
      });
    });
  }

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

function openBackupAndSettingsModal() {
  const dialog = $("#data-dialog");
  const titleEl = $("#data-dialog-title");
  const kickerEl = $("#data-dialog-kicker");
  const bodyEl = $("#data-dialog-body");
  if (!dialog || !bodyEl) return;

  kickerEl.textContent = "SEPARATED DATA LAYER & CLOUD API // WCPD-88";
  titleEl.textContent = "数据与框架分离配置 · 远程同步与备份";

  const jsonStr = JSON.stringify(DATA, null, 2);
  bodyEl.innerHTML = `
    <div class="form-grid">
      <div class="form-field span-2" style="padding:12px 14px;background:#21143a;border-left:3px solid var(--mint);border-radius:2px">
        <strong style="color:var(--mint);font-size:13px">☁ 架构说明：网站框架代码与动态数据已彻底分离</strong>
        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,240,250,0.84)">
          所有可编辑内容独立存放在 <code>data/content-data.json</code> 中。联网部署时运行随附的 <code>node server.js</code>（或配置下方远程 API 地址），管理员在网页上的每次保存都会直接写回服务器数据文件，无需手动导出替换代码。
        </p>
      </div>
      <div class="form-field span-2">
        <label for="remote-api-url-input">1. 联网部署数据读写接口地址 (Remote API Endpoint)</label>
        <div style="display:flex;gap:8px">
          <input class="form-input" id="remote-api-url-input" type="text" value="${escapeHtml(authState.getApiUrl())}" placeholder="/api/content 或 https://your-domain.com/api/content">
          <button class="admin-tool-btn is-gold" type="button" id="save-api-url-btn" style="flex-shrink:0">保存并同步</button>
        </div>
      </div>
      <div class="form-field span-2">
        <label>
          <span>2. 独立数据文件 (content-data.json) 备份与恢复</span>
          <div style="display:flex;gap:8px">
            <button class="admin-tool-btn is-gold" type="button" id="modal-download-json">⬇ 下载 content-data.json</button>
            <button class="admin-tool-btn" type="button" id="modal-copy-json">📋 复制 JSON</button>
          </div>
        </label>
        <textarea class="form-textarea" id="backup-json-textarea" style="min-height:115px;font-family:monospace;font-size:12px">${escapeHtml(jsonStr)}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px">
          <label class="upload-file-label">
            <span>📂 从本地上传 content-data.json 恢复</span>
            <input type="file" accept=".json,application/json" id="upload-json-file" style="display:none">
          </label>
          <button class="button button-primary" type="button" id="apply-json-import-btn" style="padding:8px 16px"><span>应用上方 JSON 数据</span><b>✓</b></button>
        </div>
      </div>
      <div class="form-field span-2" style="padding-top:10px;border-top:1px dashed rgba(255,255,255,0.22)">
        <label for="new-admin-pass-input">3. 修改管理员登录口令（由服务端统一校验）</label>
        <div style="display:flex;gap:10px">
          <input class="form-input" id="new-admin-pass-input" type="text" value="${escapeHtml(authState.getPasscode())}" placeholder="输入新的管理员口令">
          <button class="admin-tool-btn is-gold" type="button" id="save-new-pass-btn" style="flex-shrink:0">保存新口令</button>
        </div>
      </div>
    </div>
  `;

  $("#save-api-url-btn", bodyEl)?.addEventListener("click", async () => {
    const url = ($("#remote-api-url-input", bodyEl)?.value || "").trim() || "/api/content";
    authState.setApiUrl(url);
    const ok = await syncDataToRemoteServer();
    showToast(ok ? `☁ 已连接并同步至接口 ${url}` : `✓ 接口地址已设为 ${url}（本地预览已缓存）`);
  });

  $("#modal-download-json", bodyEl)?.addEventListener("click", downloadContentJsonFile);
  $("#modal-copy-json", bodyEl)?.addEventListener("click", () => {
    const ta = $("#backup-json-textarea", bodyEl);
    if (!ta) return;
    ta.select();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value);
      } else {
        document.execCommand("copy");
      }
    } catch (e) {
      document.execCommand("copy");
    }
    showToast("📋 已复制全站 JSON 数据至剪贴板");
  });

  $("#upload-json-file", bodyEl)?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const ta = $("#backup-json-textarea", bodyEl);
      if (ta) ta.value = ev.target.result;
      showToast("📂 已读取 JSON 文件，请点击【应用上方 JSON 数据】生效");
    };
    reader.readAsText(file);
  });

  $("#apply-json-import-btn", bodyEl)?.addEventListener("click", () => {
    const ta = $("#backup-json-textarea", bodyEl);
    if (!ta) return;
    try {
      const parsed = JSON.parse(ta.value);
      const merged = normalizeLoadedData(parsed, DEFAULT_DATA);
      Object.assign(DATA, merged);
      dialog.close();
      document.body.classList.remove("has-dialog");
      saveSiteData("✓ 已成功导入并同步档案数据");
    } catch (e) {
      showToast("⚠ JSON 格式有误，请检查后再试");
    }
  });

  $("#save-new-pass-btn", bodyEl)?.addEventListener("click", async () => {
    const val = $("#new-admin-pass-input", bodyEl)?.value.trim();
    if (!val) {
      showToast("⚠ 口令不能为空");
      return;
    }
    if (val.length < 6) {
      showToast("⚠ 新口令至少 6 位");
      return;
    }
    const oldPass = authState.getPasscode();
    const verdict = await changePasscodeOnServer(oldPass, val);
    if (verdict === false) {
      showToast("⚠ 旧口令校验失败，未修改（请确认当前口令）");
      return;
    }
    authState.setPasscode(val);
    showToast(verdict === null ? "✓ 已更新本地口令（服务端未连通）" : "✓ 管理员口令已更新，并已写入服务端");
  });

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

function openResetConfirmModal() {
  const dialog = $("#data-dialog");
  const titleEl = $("#data-dialog-title");
  const kickerEl = $("#data-dialog-kicker");
  const bodyEl = $("#data-dialog-body");
  if (!dialog || !bodyEl) return;

  kickerEl.textContent = "RESET CONFIRMATION // WCPD-88";
  titleEl.textContent = "确认恢复初始默认数据？";
  bodyEl.innerHTML = `
    <p style="margin:0;font-size:14px;line-height:1.7">此操作将把角色、新闻论坛、画廊与电台恢复为初始模板状态。建议先在「数据接口与备份」中下载一份 <code>content-data.json</code> 备份。</p>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:12px">
      <button class="button button-ghost" type="button" id="cancel-reset-btn">取消</button>
      <button class="button button-primary" type="button" id="confirm-reset-btn" style="background:#e6194b;border-color:#fff"><span>确认重置所有数据</span></button>
    </div>
  `;

  $("#cancel-reset-btn", bodyEl)?.addEventListener("click", () => {
    dialog.close();
    document.body.classList.remove("has-dialog");
  });

  $("#confirm-reset-btn", bodyEl)?.addEventListener("click", () => {
    safeStorageRemove(STORAGE_DATA_KEY);
    const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA));
    Object.assign(DATA, fresh);
    dialog.close();
    document.body.classList.remove("has-dialog");
    saveSiteData("↺ 已恢复为初始默认数据");
  });

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

function openQuickAddModal() {
  const dialog = $("#data-dialog");
  const titleEl = $("#data-dialog-title");
  const kickerEl = $("#data-dialog-kicker");
  const bodyEl = $("#data-dialog-body");
  if (!dialog || !bodyEl) return;
  kickerEl.textContent = "QUICK CREATE // ADMIN TERMINAL";
  titleEl.textContent = "选择要新增或管理的档案内容";
  bodyEl.innerHTML = `
    <div class="auth-mode-grid">
      <button class="auth-card" type="button" data-quick-create="character" style="text-align:left;cursor:pointer">
        <span class="auth-card-tag">01 CHARACTER</span>
        <h3>+ 新增角色卷宗</h3>
        <p>创建角色档案（含性别/生日/星座、立绘、外观插图、故事线与红线关系网）。</p>
      </button>
      <button class="auth-card" type="button" data-quick-create="news" style="text-align:left;cursor:pointer">
        <span class="auth-card-tag">02 CITY DESK &amp; BBS</span>
        <h3>+ 发布新闻 / 论坛新帖</h3>
        <p>撰写官方城市报道或街头匿名论坛热帖，绑定关联角色并开启盖楼互动。</p>
      </button>
      <button class="auth-card" type="button" data-quick-create="gallery" style="text-align:left;cursor:pointer">
        <span class="auth-card-tag">03 GALLERY</span>
        <h3>+ 新增插画与故事</h3>
        <p>上传角色立绘、服装设定或漫画分镜，写下画面背后的故事并自动同步至角色档案。</p>
      </button>
      <button class="auth-card" type="button" data-quick-create="track" style="text-align:left;cursor:pointer">
        <span class="auth-card-tag">04 FM 88.8 TRACK</span>
        <h3>+ 新增电台歌曲</h3>
        <p>为黑胶唱机添加新歌曲、绑定角色印象曲、更换封面与音频文件。</p>
      </button>
      <button class="auth-card" type="button" data-quick-create="stations" style="text-align:left;cursor:pointer">
        <span class="auth-card-tag">04 FM STATIONS</span>
        <h3>⚙ 管理/新增电台频段</h3>
        <p>自定义左侧电台频段列表、广播频率 (FM)、筹码花色与 DJ 署名。</p>
      </button>
    </div>
  `;
  $$("[data-quick-create]", bodyEl).forEach(btn => {
    btn.addEventListener("click", () => {
      dialog.close();
      document.body.classList.remove("has-dialog");
      const t = btn.dataset.quickCreate;
      if (t === "stations") openEditorModal("stations");
      else openEditorModal(t, t === "track" ? -1 : "__new__");
    });
  });
  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

/* ---------- 登录与模式切换弹窗逻辑 ---------- */
function openAuthModal() {
  const dialog = $("#auth-dialog");
  if (!dialog) return;
  updateAuthUI();
  const errEl = $("#auth-error-msg");
  if (errEl) errEl.textContent = "";
  const passInput = $("#admin-pass-input");
  if (passInput) passInput.value = "";

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
}

function initAuthAndAdminSystem() {
  updateAuthUI();

  $("#auth-trigger-btn")?.addEventListener("click", openAuthModal);

  $("#switch-guest-btn")?.addEventListener("click", () => {
    setAuthMode("guest");
    const dialog = $("#auth-dialog");
    if (dialog) {
      dialog.close();
      document.body.classList.remove("has-dialog");
    }
  });

  $("#fill-default-pass-btn")?.addEventListener("click", () => {
    const passInput = $("#admin-pass-input");
    if (passInput) {
      passInput.value = authState.getPasscode();
      passInput.focus();
    }
  });

  const tryAdminLogin = async () => {
    const passInput = $("#admin-pass-input");
    const errEl = $("#auth-error-msg");
    const entered = (passInput?.value || "").trim();
    if (!entered) {
      if (errEl) errEl.textContent = "⚠ 请输入管理员口令";
      return;
    }
    const closeAndEnter = () => {
      if (errEl) errEl.textContent = "";
      authState.setPasscode(entered);
      setAuthMode("admin");
      const dialog = $("#auth-dialog");
      if (dialog) {
        dialog.close();
        document.body.classList.remove("has-dialog");
      }
    };
    if (errEl) errEl.textContent = "⏳ 正在校验口令…";
    const serverVerdict = await verifyPasscodeOnServer(entered);
    if (serverVerdict === null) {
      if (entered === authState.getPasscode()) {
        closeAndEnter();
      } else if (errEl) {
        errEl.textContent = "⚠ 离线预览模式下仅本地口令可用";
      }
      return;
    }
    if (serverVerdict) {
      closeAndEnter();
    } else if (errEl) {
      errEl.textContent = "⚠ 通行口令不正确";
    }
  };

  $("#login-admin-btn")?.addEventListener("click", tryAdminLogin);
  $("#admin-pass-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryAdminLogin();
    }
  });

  $("#admin-pending-btn")?.addEventListener("click", openPendingChecklistModal);
  $("#admin-quick-add-btn")?.addEventListener("click", openQuickAddModal);
  $("#admin-backup-btn")?.addEventListener("click", openBackupAndSettingsModal);
  $("#admin-reset-btn")?.addEventListener("click", openResetConfirmModal);
  $("#admin-logout-btn")?.addEventListener("click", () => setAuthMode("guest"));

  $("#editor-form")?.addEventListener("submit", handleEditorFormSubmit);
}

/* ---------- SPA Direct 1-Click Navigation ---------- */
function switchSpaView(viewName) {
  if (!window.CHIRAKA_SPA_MODE) return;
  const views = $$("[data-spa-view]");
  views.forEach(v => {
    v.hidden = v.dataset.spaView !== viewName;
  });

  const pageMap = {
    home: "home",
    characters: "characters",
    character: "character",
    news: "news",
    article: "article",
    gallery: "gallery",
    radio: "radio"
  };
  const pageKey = pageMap[viewName] || "home";
  document.body.dataset.page = pageKey;
  document.body.className = `page-${pageKey} ${authState.mode === "admin" ? "is-admin" : "is-guest"}${radio.playing || radio.demo ? " radio-playing" : ""}`;

  const topKeyMap = { home: "home", characters: "characters", character: "characters", news: "news", article: "news", gallery: "gallery", radio: "radio" };
  const targetNav = topKeyMap[pageKey];
  $$(".nav-drawer-tab").forEach(tab => {
    const act = tab.dataset.navKey === targetNav;
    tab.classList.toggle("is-active", act);
    if (act) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSpaCharacter(charId) {
  renderCharacterDetailById(charId);
  switchSpaView("character");
}

function openSpaArticle(newsId) {
  renderArticleById(newsId);
  switchSpaView("article");
}

function initClock() {
  const date = $("#city-date");
  if (date) {
    date.textContent = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(new Date());
  }
}

function initDialogs() {
  $$("dialog").forEach(dialog => {
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        dialog.close();
        document.body.classList.remove("has-dialog");
      }
    });
    $$("[data-close-dialog]", dialog).forEach(btn => {
      btn.addEventListener("click", () => {
        dialog.close();
        document.body.classList.remove("has-dialog");
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initDialogs();
  initAuthAndAdminSystem();
  initHome();
  initCharacters();
  initCharacterDetail();
  initNews();
  initArticle();
  initGallery();
  initRadioPage();
  tryLoadFromRemoteServer();

  if (window.CHIRAKA_SPA_MODE) {
    $$("[data-spa-target]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        switchSpaView(btn.dataset.spaTarget || "characters");
      });
    });
    $$("[data-spa-nav]").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        switchSpaView(link.dataset.spaNav);
      });
    });
  }
});

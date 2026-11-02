import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Safe to expose: this is Supabase's public anon/publishable key, meant for client-side use.
// All access is governed by Row Level Security policies on the project.
const SUPABASE_URL = "https://mttopqljhujyhfxxtpdo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GjuVFNvSlQIps-WCC1fatg_n68vmHjX";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = () => window.gsap && !prefersReducedMotion;

const LIKER_TOKEN_KEY = "bottle_liker_token";
const LIKED_IDS_KEY = "bottle_liked_ids";

function getLikerToken() {
  let token = localStorage.getItem(LIKER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(LIKER_TOKEN_KEY, token);
  }
  return token;
}

function getLikedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_IDS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function setLiked(id, liked) {
  const ids = getLikedIds();
  if (liked) ids.add(id);
  else ids.delete(id);
  localStorage.setItem(LIKED_IDS_KEY, JSON.stringify([...ids]));
}

const likerToken = getLikerToken();

const stage = document.getElementById("stage");
const toast = document.getElementById("toast");
const tabs = [...document.querySelectorAll("[data-nav]")];

let lastShownId = null;
let passForward = false;

function showToast(text, icon = "ph-check-circle") {
  toast.innerHTML = `<i class="ph ${icon}"></i><span>${escapeHtml(text)}</span>`;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  clearTimeout(showToast._t);
  clearTimeout(showToast._hideT);
  showToast._t = setTimeout(() => {
    toast.classList.remove("is-visible");
    showToast._hideT = setTimeout(() => {
      toast.hidden = true;
    }, prefersReducedMotion ? 0 : 220);
  }, 2400);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(iso) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [label, secs] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return `${value} ${label}${value > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function setView(tab, { idle = false } = {}) {
  tabs.forEach((t) => {
    const active = t.dataset.nav === tab;
    t.classList.toggle("is-active", active);
    if (t.tagName === "BUTTON") t.setAttribute("aria-current", active ? "page" : "false");
  });
  document.body.classList.toggle("is-home", idle);
}

function shareUrl(id) {
  return `${location.origin}${location.pathname}?m=${id}`;
}

// ---------- stats + kindness tree ----------

let cachedStats = null;

async function fetchStats() {
  const { data, error } = await supabase.rpc("get_kindness_stats");
  if (error) {
    console.error(error);
    return cachedStats;
  }
  cachedStats = data;
  return data;
}

const FULL_AT = 150;
const MAX_LEAVES = 220;
const MAX_BLOSSOMS = 60;

const STAGES = [
  { min: 0, name: "Seedling", icon: "ph-plant" },
  { min: 10, name: "Sapling", icon: "ph-plant" },
  { min: 30, name: "Young tree", icon: "ph-tree" },
  { min: 75, name: "Leafy tree", icon: "ph-tree" },
  { min: 150, name: "Blossoming tree", icon: "ph-flower-lotus" },
];

function stageFor(n) {
  let index = 0;
  STAGES.forEach((s, i) => {
    if (n >= s.min) index = i;
  });
  return { ...STAGES[index], next: STAGES[index + 1] || null };
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function treeGeom(g) {
  const baseX = 200;
  const baseY = 330;
  const h = 50 + 140 * g;
  const w = 7 + 11 * g;
  const topY = baseY - h;
  const r = 30 + 70 * g;
  const blobs = [
    { x: baseX, y: topY - r * 0.35, r: r * 0.85, weight: 3 },
    { x: baseX - r * 0.75, y: topY + r * 0.05, r: r * 0.62, weight: 2 },
    { x: baseX + r * 0.75, y: topY + r * 0.05, r: r * 0.62, weight: 2 },
    { x: baseX - r * 0.42, y: topY - r * 0.85, r: r * 0.55, weight: 1.5 },
    { x: baseX + r * 0.42, y: topY - r * 0.8, r: r * 0.55, weight: 1.5 },
  ];
  const trunk = `M${baseX - w} ${baseY} C${baseX - w * 0.7} ${baseY - h * 0.5} ${baseX - w * 0.35} ${topY + h * 0.15} ${baseX - w * 0.3} ${topY} L${baseX + w * 0.3} ${topY} C${baseX + w * 0.35} ${topY + h * 0.15} ${baseX + w * 0.7} ${baseY - h * 0.5} ${baseX + w} ${baseY} Z`;
  const branches = [
    `M${baseX - w * 0.3} ${topY + h * 0.2} Q${baseX - r * 0.4} ${topY + r * 0.1} ${blobs[1].x + r * 0.1} ${blobs[1].y}`,
    `M${baseX + w * 0.3} ${topY + h * 0.24} Q${baseX + r * 0.4} ${topY + r * 0.12} ${blobs[2].x - r * 0.1} ${blobs[2].y}`,
    `M${baseX} ${topY + 4} Q${baseX - 4} ${topY - r * 0.4} ${blobs[3].x + 6} ${blobs[3].y + 6}`,
  ];
  return { blobs, trunk, branches, branchW: Math.max(2.5, w * 0.5) };
}

function pointInCanopy(blobs, rand) {
  const total = blobs.reduce((s, b) => s + b.weight, 0);
  let pick = rand() * total;
  let blob = blobs[0];
  for (const b of blobs) {
    pick -= b.weight;
    if (pick <= 0) {
      blob = b;
      break;
    }
  }
  const angle = rand() * Math.PI * 2;
  const dist = Math.sqrt(rand()) * blob.r * 0.9;
  return { x: blob.x + Math.cos(angle) * dist, y: blob.y + Math.sin(angle) * dist };
}

function buildTreeSVG(stats, { grow = true, newLeaf = null } = {}) {
  const messages = stats?.messages ?? 0;
  const likes = stats?.likes ?? 0;
  const g = Math.min(1, Math.max(0.08, Math.sqrt(messages / FULL_AT)));
  const geom = treeGeom(g);
  const ghost = treeGeom(1);

  const ghostShapes =
    `<path d="${ghost.trunk}"/>` +
    ghost.blobs.map((b) => `<circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="${b.r.toFixed(1)}"/>`).join("");

  const leafCount = Math.min(messages, MAX_LEAVES);
  const leafColors = ["var(--leaf-1)", "var(--leaf-2)", "var(--leaf-3)"];
  let leaves = "";
  for (let i = 0; i < leafCount; i++) {
    const rand = seeded(i * 7919 + 13);
    const p = pointInCanopy(geom.blobs, rand);
    const rot = Math.round(rand() * 180);
    const color = leafColors[Math.floor(rand() * 3)];
    const delay = Math.min(i * 14, 1100) + 200;
    const cls = i === newLeaf ? "leaf leaf-new" : "leaf";
    const x = p.x.toFixed(1);
    const y = p.y.toFixed(1);
    leaves += `<g transform="rotate(${rot} ${x} ${y})"><ellipse class="${cls}" style="--d:${delay}ms;fill:${color}" cx="${x}" cy="${y}" rx="9" ry="5.5"/></g>`;
  }

  const blossomCount = Math.min(likes, MAX_BLOSSOMS);
  let blossoms = "";
  for (let i = 0; i < blossomCount; i++) {
    const rand = seeded(i * 104729 + 7);
    const p = pointInCanopy(geom.blobs, rand);
    const delay = Math.min(leafCount * 14, 1100) + 260 + i * 20;
    blossoms += `<circle class="blossom" style="--d:${delay}ms" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.6"/>`;
  }

  return `
<svg viewBox="0 0 400 380" class="${grow ? "grow" : ""}" role="img" aria-label="Kindness tree with ${plural(messages, "leaf", "leaves")} and ${plural(likes, "blossom", "blossoms")}">
  <g class="tree-ghost">${ghostShapes}</g>
  <path class="tree-trunk" d="${geom.trunk}"/>
  <g stroke="var(--trunk)" stroke-width="${geom.branchW.toFixed(1)}" stroke-linecap="round" fill="none">
    ${geom.branches.map((d) => `<path d="${d}"/>`).join("")}
  </g>
  <g>${leaves}</g>
  <g>${blossoms}</g>
  <ellipse class="tree-island-shade" cx="200" cy="346" rx="150" ry="22"/>
  <ellipse class="tree-island" cx="200" cy="336" rx="162" ry="30"/>
</svg>`;
}

const WAVE_A = "M0 40 Q 180 0 360 40 T 720 40 T 1080 40 T 1440 40 T 1800 40 T 2160 40 T 2520 40 T 2880 40 V 120 H 0 Z";
const WAVE_B = "M0 50 Q 240 20 480 50 T 960 50 T 1440 50 T 1920 50 T 2400 50 T 2880 50 V 120 H 0 Z";
const waveSVG = (cls, d) => `<svg class="wave ${cls}" viewBox="0 0 2880 120" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;

// ---------- routing ----------

function currentRoute() {
  const params = new URLSearchParams(location.search);
  const sharedId = params.get("m");
  if (sharedId) return { name: "home", sharedId };
  return { name: location.hash.replace("#/", "") || "home", sharedId: null };
}

function transitionToView(renderFn) {
  if (prefersReducedMotion) {
    renderFn();
    return;
  }
  stage.classList.add("is-transitioning");
  setTimeout(() => {
    renderFn();
    window.scrollTo(0, 0);
    requestAnimationFrame(() => stage.classList.remove("is-transitioning"));
  }, 140);
}

function navigate(name, { replace = false, forward = false } = {}) {
  passForward = forward;
  const url = name === "home" ? `${location.pathname}` : `${location.pathname}#/${name}`;
  if (replace) history.replaceState({}, "", url);
  else history.pushState({}, "", url);
  transitionToView(render);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(tab.dataset.nav);
  });
});

window.addEventListener("popstate", () => transitionToView(render));

// ---------- Home ----------

const BOTTLE_SVG = `
<svg viewBox="0 0 120 170" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="44" y="4" width="32" height="16" rx="5" fill="var(--trunk)" />
  <path d="M48 18 H72 V46 C72 46 90 58 96 78 C102 98 102 118 102 132 C102 150 90 162 60 162 C30 162 18 150 18 132 C18 118 18 98 24 78 C30 58 48 46 48 46 Z" fill="rgba(255,255,255,0.35)" stroke="var(--ink-muted)" stroke-width="4" stroke-linejoin="round"/>
  <g transform="rotate(-10 60 104)">
    <rect x="38" y="90" width="44" height="24" rx="12" fill="#fff6e6" stroke="var(--accent)" stroke-width="3"/>
    <line x1="48" y1="99" x2="72" y2="99" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="48" y1="106" x2="66" y2="106" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <path d="M32 72 C28 92 27 112 30 130" stroke="white" stroke-opacity="0.7" stroke-width="4" stroke-linecap="round"/>
</svg>`;

function renderIdle() {
  setView("home", { idle: true });
  const n = cachedStats?.messages;

  stage.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <a class="live-chip" href="#/tree" id="liveChip">
          <span class="pulse-dot" aria-hidden="true"></span>
          <span id="liveText">${n != null ? `<b>${n}</b> kind words have grown our tree` : "Our kindness tree is growing"}</span>
        </a>
        <h1>A kind word <span class="hl">washed ashore<svg class="swash" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true"><path d="M4 12 C 60 2, 120 16, 180 8 S 270 4, 296 10"/></svg></span> for you.</h1>
        <p class="hero-sub">Open a note a stranger left behind. Then write one back, and watch our kindness tree grow a new leaf.</p>
        <div class="hero-ctas">
          <button class="btn btn-primary btn-lg" id="revealBtn"><i class="ph-bold ph-envelope-simple-open"></i> Open a bottle</button>
          <button class="btn btn-ghost btn-lg" id="browseBtn"><i class="ph ph-books"></i> Browse the gallery</button>
        </div>
      </div>
      <div class="hero-scene">
        <div class="sun" aria-hidden="true"></div>
        <a class="isle" href="#/tree" id="heroIsle" aria-label="See the kindness tree">${buildTreeSVG(cachedStats, { grow: false })}</a>
        <div class="bottle-wrap">
          <span class="bottle-hint">Tap to open</span>
          <div class="bottle-float" id="bottleIcon" role="button" tabindex="0" aria-label="Open a bottle">${BOTTLE_SVG}</div>
        </div>
      </div>
      <div class="hero-sea" aria-hidden="true">
        ${waveSVG("w-back", WAVE_A)}
        ${waveSVG("w-mid", WAVE_B)}
        ${waveSVG("w-front", WAVE_A)}
      </div>
    </section>
  `;

  const bottle = document.getElementById("bottleIcon");
  const start = () => popBottle(bottle, () => revealRandom());
  document.getElementById("revealBtn").addEventListener("click", start);
  document.getElementById("browseBtn").addEventListener("click", () => navigate("gallery"));
  document.getElementById("liveChip").addEventListener("click", (e) => {
    e.preventDefault();
    navigate("tree");
  });
  document.getElementById("heroIsle").addEventListener("click", (e) => {
    e.preventDefault();
    navigate("tree");
  });
  bottle.addEventListener("click", start);
  bottle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  });

  if (canAnimate()) {
    gsap.from(".hero-copy > *", { opacity: 0, y: 16, duration: 0.6, stagger: 0.08, ease: "power3.out" });
    gsap.from("#heroIsle", { opacity: 0, y: 30, duration: 0.8, delay: 0.15, ease: "power3.out" });
    gsap.from(".bottle-wrap", { opacity: 0, y: 40, x: -30, duration: 0.9, delay: 0.3, ease: "power3.out" });
  }

  fetchStats().then((stats) => {
    if (!stats || !document.getElementById("heroIsle")) return;
    document.getElementById("heroIsle").innerHTML = buildTreeSVG(stats, { grow: true });
    document.getElementById("liveText").innerHTML = `<b>${stats.messages}</b> kind words have grown our tree`;
  });
}

function popBottle(bottle, done) {
  if (!canAnimate()) {
    done();
    return;
  }
  bottle.classList.add("is-popping");
  gsap.timeline({ onComplete: done })
    .to(bottle, { rotate: -14, duration: 0.08, ease: "power1.out" })
    .to(bottle, { rotate: 10, duration: 0.1, ease: "power1.inOut" })
    .to(bottle, { rotate: -6, scale: 1.12, duration: 0.09, ease: "power1.inOut" })
    .to(bottle, { rotate: 0, scale: 1, y: -60, opacity: 0, duration: 0.26, ease: "power2.in" });
}

function renderLoading(text = "Uncorking a bottle") {
  setView("home");
  stage.innerHTML = `<div class="gallery-loading" style="min-height:50vh;justify-content:center">${text}&hellip;</div>`;
}

async function revealRandom() {
  renderLoading();
  const { data, error } = await supabase.rpc("get_random_message", { exclude_id: lastShownId });

  if (error) {
    console.error(error);
    showToast("Could not reach the sea. Try again.", "ph-warning-circle");
    renderIdle();
    return;
  }

  const msg = Array.isArray(data) ? data[0] : data;
  if (!msg) {
    stage.innerHTML = `
      <div class="view-head">
        <h1>The sea is <em>empty</em>.</h1>
        <p>Be the first to leave a message for someone else to find.</p>
      </div>
      <div class="gallery-empty"><button class="btn btn-primary" id="writeFirstBtn"><i class="ph-bold ph-feather"></i> Write a message</button></div>
    `;
    document.getElementById("writeFirstBtn").addEventListener("click", () => navigate("write"));
    return;
  }

  lastShownId = msg.id;
  history.replaceState({}, "", `${location.pathname}?m=${msg.id}`);
  renderMessage(msg);
}

async function loadSharedMessage(id) {
  renderLoading();
  const { data, error } = await supabase.from("messages").select("*").eq("id", id).single();

  if (error || !data) {
    showToast("That message could not be found.", "ph-warning-circle");
    navigate("home", { replace: true });
    return;
  }

  lastShownId = data.id;
  renderMessage(data);
}

function renderMessage(msg) {
  setView("home");
  const liked = getLikedIds().has(msg.id);

  stage.innerHTML = `
    <div class="message-wrap">
      <article class="message-card paper" id="messageCard">
        <span class="tape" aria-hidden="true"></span>
        <div class="message-eyebrow"><i class="ph ph-envelope-simple-open"></i> Found in a bottle</div>
        <p class="message-text" id="messageText">${escapeHtml(msg.content)}</p>
        <div class="message-meta">Left ${timeAgo(msg.created_at)} by a stranger</div>
      </article>
      <div class="message-actions">
        <button class="btn ${liked ? "is-liked" : ""}" id="likeBtn" aria-pressed="${liked}" aria-label="Give this note a heart">
          <i class="ph${liked ? "-fill" : ""} ph-heart"></i> <span id="likeCount">${msg.likes_count}</span>
        </button>
        <button class="btn" id="copyBtn"><i class="ph ph-link-simple"></i> Copy link</button>
        <button class="btn" id="nextBtn"><i class="ph ph-arrows-clockwise"></i> Another bottle</button>
        <button class="btn btn-primary" id="passBtn"><i class="ph-bold ph-feather"></i> Pass it forward</button>
      </div>
    </div>
  `;

  document.getElementById("likeBtn").addEventListener("click", () => toggleLike(msg));
  document.getElementById("copyBtn").addEventListener("click", () => copyLink(msg.id));
  document.getElementById("nextBtn").addEventListener("click", () => revealRandom());
  document.getElementById("passBtn").addEventListener("click", () => navigate("write", { forward: true }));

  if (canAnimate()) {
    const card = document.getElementById("messageCard");
    const text = document.getElementById("messageText");
    const actions = document.querySelectorAll(".message-actions .btn");

    gsap.set(text, { opacity: 0, filter: "blur(10px)" });
    gsap.set(actions, { opacity: 0, y: 10 });

    gsap.timeline({ defaults: { ease: "power3.out" } })
      .from(card, { opacity: 0, scaleY: 0.2, y: -20, transformOrigin: "50% 0%", duration: 0.6 })
      .to(text, { opacity: 1, filter: "blur(0px)", duration: 0.7 }, "-=0.25")
      .to(actions, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 }, "-=0.35");
  }
}

async function toggleLike(msg) {
  const liked = getLikedIds().has(msg.id);
  const btn = document.getElementById("likeBtn");
  btn.disabled = true;

  if (liked) {
    const { error } = await supabase
      .from("message_likes")
      .delete()
      .eq("message_id", msg.id)
      .eq("liker_token", likerToken);
    if (!error) {
      setLiked(msg.id, false);
      msg.likes_count = Math.max(msg.likes_count - 1, 0);
    }
  } else {
    const { error } = await supabase.from("message_likes").insert({ message_id: msg.id, liker_token: likerToken });
    if (!error) {
      setLiked(msg.id, true);
      msg.likes_count += 1;
    }
  }

  const nowLiked = getLikedIds().has(msg.id);
  btn.classList.toggle("is-liked", nowLiked);
  btn.setAttribute("aria-pressed", String(nowLiked));
  const icon = btn.querySelector("i");
  icon.className = `ph${nowLiked ? "-fill" : ""} ph-heart`;
  document.getElementById("likeCount").textContent = msg.likes_count;
  btn.disabled = false;

  if (nowLiked) {
    showToast("Your heart became a blossom on our tree", "ph-flower");
    if (!prefersReducedMotion && icon.animate) {
      icon.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35)", offset: 0.4 },
          { transform: "scale(0.92)", offset: 0.7 },
          { transform: "scale(1)" },
        ],
        { duration: 380, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
      );
    }
  }
}

async function copyLink(id) {
  const url = shareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied. Send this kindness onward.");
  } catch {
    showToast(url, "ph-link-simple");
  }
  supabase.rpc("increment_share_count", { target_id: id }).then(({ error }) => {
    if (error) console.error(error);
  });
}

// ---------- Gallery ----------

const PAPERS = ["var(--paper-1)", "var(--paper-2)", "var(--paper-3)", "var(--paper-4)"];

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function renderGallery() {
  setView("gallery");
  stage.innerHTML = `
    <div class="view-head">
      <h1>Notes from <em>strangers</em></h1>
      <p>Every note here washed ashore from someone who wanted a stranger to feel a little better.</p>
    </div>
    <div class="gallery-loading">Gathering notes&hellip;</div>
  `;

  if (canAnimate()) {
    gsap.from(".view-head > *", { opacity: 0, y: 12, duration: 0.5, stagger: 0.08, ease: "power3.out" });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    stage.querySelector(".gallery-loading").textContent = "Could not load the gallery right now.";
    return;
  }

  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.innerHTML = `
      <p>No notes yet. Be the first to write one.</p>
      <button class="btn btn-primary" id="emptyWriteBtn"><i class="ph-bold ph-feather"></i> Write the first one</button>
    `;
    stage.querySelector(".gallery-loading").replaceWith(empty);
    document.getElementById("emptyWriteBtn").addEventListener("click", () => navigate("write"));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "gallery-grid";
  grid.innerHTML = data
    .map((msg) => {
      const h = hashId(msg.id);
      const tilt = ((h % 7) - 3) * 0.55;
      const paper = PAPERS[h % PAPERS.length];
      return `
      <button class="gallery-card paper" data-id="${msg.id}" style="--tilt:${tilt}deg;--paper:${paper}">
        <span class="pin" aria-hidden="true"></span>
        <i class="ph ph-arrow-up-right open-cue" aria-hidden="true"></i>
        <p>${escapeHtml(msg.content)}</p>
        <div class="gallery-card-meta">
          <span>${timeAgo(msg.created_at)}</span>
          <span class="like"><i class="ph${msg.likes_count ? "-fill" : ""} ph-heart"></i> ${msg.likes_count}</span>
        </div>
      </button>`;
    })
    .join("");

  stage.querySelector(".gallery-loading").replaceWith(grid);

  grid.querySelectorAll(".gallery-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      history.pushState({}, "", `${location.pathname}?m=${id}`);
      transitionToView(() => loadSharedMessage(id));
    });
  });

  const cards = [...grid.querySelectorAll(".gallery-card")];
  if (prefersReducedMotion) {
    cards.forEach((c) => c.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((e) => e.isIntersecting);
      entering.forEach((entry, i) => {
        entry.target.style.transitionDelay = `${Math.min(i, 8) * 55}ms`;
        entry.target.classList.add("is-visible");
        entry.target.addEventListener("transitionend", () => (entry.target.style.transitionDelay = ""), { once: true });
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.1 }
  );
  cards.forEach((c) => io.observe(c));
}

// ---------- Tree ----------

async function renderTree() {
  setView("tree");
  stage.innerHTML = `
    <div class="view-head">
      <h1>Our <em>kindness tree</em></h1>
      <p>Every message sent grows a new leaf. Every heart given becomes a blossom.</p>
    </div>
    <div class="tree-layout">
      <div class="tree-stage">
        <div class="sun" aria-hidden="true"></div>
        <div class="stage-badge" id="stageBadge"><i class="ph ph-plant"></i> Growing&hellip;</div>
        <div class="isle" id="treeIsle">${buildTreeSVG(cachedStats, { grow: false })}</div>
        <div class="stage-sea" aria-hidden="true">${waveSVG("w-back", WAVE_A)}${waveSVG("w-front", WAVE_B)}</div>
      </div>
      <div class="tree-side" id="treeSide"></div>
    </div>
  `;

  if (canAnimate()) {
    gsap.from(".view-head > *", { opacity: 0, y: 12, duration: 0.5, stagger: 0.08, ease: "power3.out" });
    gsap.from(".tree-stage", { opacity: 0, y: 20, scale: 0.98, duration: 0.6, delay: 0.1, ease: "power3.out" });
  }

  const stats = await fetchStats();
  if (!stats || !document.getElementById("treeIsle")) return;

  const st = stageFor(stats.messages);
  document.getElementById("treeIsle").innerHTML = buildTreeSVG(stats, { grow: true });
  document.getElementById("stageBadge").innerHTML = `<i class="ph ${st.icon}"></i> ${st.name}`;

  const progress = st.next ? (stats.messages - st.min) / (st.next.min - st.min) : 1;
  const toGo = st.next ? st.next.min - stats.messages : 0;
  const nextLine = st.next
    ? `${plural(toGo, "more kind word", "more kind words")} until it becomes a <b>${st.next.name.toLowerCase()}</b>.`
    : "Fully grown. Every new kind word now fills it with more life.";

  document.getElementById("treeSide").innerHTML = `
    <div class="progress-card paper">
      <h2>${st.name}</h2>
      <p>${nextLine}</p>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress * 100)}" aria-label="Progress to next stage">
        <div class="progress-fill" id="progressFill"></div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat paper"><i class="ph-fill ph-leaf"></i><span class="num" data-count="${stats.messages}">0</span><span class="label">kind words written</span></div>
      <div class="stat paper"><i class="ph-fill ph-flower"></i><span class="num" data-count="${stats.likes}">0</span><span class="label">hearts given, now blossoms</span></div>
      <div class="stat paper"><i class="ph-fill ph-paper-plane-tilt"></i><span class="num" data-count="${stats.shares}">0</span><span class="label">notes sent onward</span></div>
      <div class="stat paper"><i class="ph-fill ph-sun"></i><span class="num" data-count="${stats.this_week}">0</span><span class="label">new leaves this week</span></div>
    </div>
    <p class="tree-meaning">That's ${plural(stats.messages, "moment", "moments")} where a stranger chose kindness for someone they'll never meet.</p>
    <div><button class="btn btn-primary btn-lg" id="growBtn"><i class="ph-bold ph-feather"></i> Grow the tree</button></div>
  `;

  document.getElementById("growBtn").addEventListener("click", () => navigate("write"));

  requestAnimationFrame(() => {
    document.getElementById("progressFill").style.setProperty("--p", progress.toFixed(3));
  });

  const nums = document.querySelectorAll(".stat .num");
  if (canAnimate()) {
    gsap.from("#treeSide > *", { opacity: 0, y: 14, duration: 0.5, stagger: 0.07, ease: "power3.out" });
    nums.forEach((el) => {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: Number(el.dataset.count),
        duration: 1.1,
        delay: 0.2,
        ease: "power2.out",
        onUpdate: () => (el.textContent = Math.round(counter.v)),
      });
    });
  } else {
    nums.forEach((el) => (el.textContent = el.dataset.count));
  }
}

// ---------- Write ----------

function renderWrite() {
  setView("write");
  const forward = passForward;

  stage.innerHTML = `
    <div class="write-wrap">
      <div class="view-head">
        <h1>${forward ? "Pass it <em>forward</em>" : "Write one for a <em>stranger</em>"}</h1>
        <p>Keep it kind. It might be exactly what someone needs today, and it grows a new leaf on our tree.</p>
      </div>
      <div class="write-card paper">
        <span class="tape" aria-hidden="true"></span>
        <div class="field">
          <label for="newMessage">Your message</label>
          <textarea id="newMessage" maxlength="500" placeholder="Dear stranger,"></textarea>
          <div class="field-foot">
            <span>Anonymous. No sign up needed.</span>
            <span id="charCount">0 / 500</span>
          </div>
          <div class="field-error" id="fieldError" role="alert"></div>
        </div>
        <div class="write-actions">
          <button class="btn" id="cancelBtn">Cancel</button>
          <button class="btn btn-primary" id="sendBtn"><i class="ph-bold ph-paper-plane-tilt"></i> Send message</button>
        </div>
      </div>
    </div>
  `;

  if (canAnimate()) {
    gsap.from(".view-head > *, .write-card", { opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: "power3.out" });
  }

  const textarea = document.getElementById("newMessage");
  const charCount = document.getElementById("charCount");
  const fieldError = document.getElementById("fieldError");
  const sendBtn = document.getElementById("sendBtn");

  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.classList.toggle("is-warning", len > 460);
    if (len) fieldError.textContent = "";
  });

  document.getElementById("cancelBtn").addEventListener("click", () => navigate("home"));

  sendBtn.addEventListener("click", async () => {
    const content = textarea.value.trim();
    if (!content) {
      fieldError.textContent = "Write something before sending it out.";
      textarea.focus();
      return;
    }
    fieldError.textContent = "";
    sendBtn.disabled = true;

    const { error } = await supabase.from("messages").insert({ content });

    sendBtn.disabled = false;

    if (error) {
      fieldError.textContent = "Something went wrong. Please try again.";
      return;
    }

    const stats = await fetchStats();
    renderWriteSuccess(stats);
  });
}

function renderWriteSuccess(stats) {
  const n = stats?.messages ?? null;
  const newLeaf = n && n <= MAX_LEAVES ? n - 1 : null;

  stage.innerHTML = `
    <div class="write-wrap">
      <div class="write-card paper write-success">
        <span class="tape" aria-hidden="true"></span>
        <div class="success-tree">${buildTreeSVG(stats, { grow: false, newLeaf })}</div>
        <h2>${n ? `You grew leaf <em>#${n}</em>.` : "Your message is adrift."}</h2>
        <p>Your note is out at sea, waiting for a stranger who needs it. Our kindness tree is one leaf fuller because of you.</p>
        <div class="write-actions" style="justify-content:center">
          <button class="btn" id="toTree"><i class="ph ph-tree"></i> See the tree</button>
          <button class="btn btn-primary" id="toHome"><i class="ph-bold ph-envelope-simple-open"></i> Open a bottle</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("toTree").addEventListener("click", () => navigate("tree"));
  document.getElementById("toHome").addEventListener("click", () => navigate("home"));

  if (canAnimate()) {
    gsap.from(".write-success h2, .write-success p, .write-success .write-actions", {
      opacity: 0,
      y: 10,
      duration: 0.45,
      stagger: 0.08,
      delay: 0.5,
      ease: "power2.out",
    });
  }
}

// ---------- render dispatch ----------

function render() {
  const route = currentRoute();

  if (route.sharedId) return loadSharedMessage(route.sharedId);
  if (route.name === "gallery") return renderGallery();
  if (route.name === "tree") return renderTree();
  if (route.name === "write") return renderWrite();
  renderIdle();
}

render();

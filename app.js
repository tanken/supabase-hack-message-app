import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Safe to expose: this is Supabase's public anon/publishable key, meant for client-side use.
// All access is governed by Row Level Security policies on the project.
const SUPABASE_URL = "https://mttopqljhujyhfxxtpdo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GjuVFNvSlQIps-WCC1fatg_n68vmHjX";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  toast.innerHTML = `<i class="ph ${icon}"></i><span>${text}</span>`;
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

function setActiveTab(name) {
  tabs.forEach((t) => {
    const active = t.dataset.nav === name;
    t.classList.toggle("is-active", active);
    if (t.tagName === "BUTTON") t.setAttribute("aria-current", active ? "page" : "false");
  });
}

function shareUrl(id) {
  return `${location.origin}${location.pathname}?m=${id}`;
}

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
    requestAnimationFrame(() => stage.classList.remove("is-transitioning"));
  }, 140);
}

function navigate(name, { replace = false } = {}) {
  passForward = false;
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

// ---------- Home / reveal ----------

const BOTTLE_SVG = `
<svg viewBox="0 0 120 170" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="44" y="4" width="32" height="16" rx="5" fill="var(--accent)" />
  <rect x="48" y="18" width="24" height="34" rx="6" stroke="var(--ink-muted)" stroke-width="3" fill="none" />
  <path d="M48 46 C48 46 30 58 24 78 C18 98 18 118 18 132 C18 150 30 162 60 162 C90 162 102 150 102 132 C102 118 102 98 96 78 C90 58 72 46 72 46 Z" stroke="var(--ink-muted)" stroke-width="3" fill="none" stroke-linejoin="round"/>
  <path d="M22 112 C40 104 80 104 98 112 L98 130 C98 148 86 158 60 158 C34 158 22 148 22 130 Z" fill="var(--accent)" opacity="0.18"/>
  <g stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round">
    <rect x="46" y="86" width="28" height="14" rx="7" fill="none" transform="rotate(-8 60 93)"/>
    <line x1="52" y1="90" x2="68" y2="90" transform="rotate(-8 60 93)"/>
    <line x1="52" y1="96" x2="68" y2="96" transform="rotate(-8 60 93)"/>
  </g>
  <path d="M32 70 C28 90 27 112 30 130" stroke="white" stroke-opacity="0.35" stroke-width="2.5" stroke-linecap="round" fill="none"/>
</svg>`;

function renderIdle() {
  setActiveTab("home");
  stage.innerHTML = `
    <div class="hero">
      <div class="bottle-stage">
        <div class="bottle-shadow" aria-hidden="true"></div>
        <div class="bottle-float" id="bottleIcon" role="button" tabindex="0" aria-label="Reveal a message">${BOTTLE_SVG}</div>
      </div>
      <h1>A kind word is waiting for you.</h1>
      <p>Someone wrote this for a stranger. That stranger might be you.</p>
      <button class="btn btn-primary" id="revealBtn">
        <i class="ph-bold ph-paper-plane-tilt"></i> Reveal a message
      </button>
      <div class="hero-links">
        <button class="btn btn-ghost" id="browseBtn"><i class="ph ph-books"></i> Or browse the gallery</button>
      </div>
    </div>
  `;
  const bottle = document.getElementById("bottleIcon");
  const start = () => popBottle(bottle, () => revealRandom());
  document.getElementById("revealBtn").addEventListener("click", start);
  document.getElementById("browseBtn").addEventListener("click", () => navigate("gallery"));
  bottle.addEventListener("click", start);
  bottle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  });

  if (window.gsap && !prefersReducedMotion) {
    gsap.from(".hero > *", {
      opacity: 0,
      y: 14,
      duration: 0.5,
      stagger: 0.08,
      ease: "power3.out",
    });
  }
}

function popBottle(bottle, done) {
  if (!window.gsap || prefersReducedMotion) {
    done();
    return;
  }
  bottle.classList.add("is-popping");
  gsap.timeline({ onComplete: done })
    .to(bottle, { rotate: -10, duration: 0.08, ease: "power1.out" })
    .to(bottle, { rotate: 8, duration: 0.1, ease: "power1.inOut" })
    .to(bottle, { rotate: -5, scale: 1.08, duration: 0.09, ease: "power1.inOut" })
    .to(bottle, { rotate: 0, scale: 1, y: -16, opacity: 0, duration: 0.22, ease: "power2.in" });
}

function renderLoading() {
  stage.innerHTML = `
    <div class="hero">
      <p>Uncorking a bottle&hellip;</p>
    </div>
  `;
}

async function revealRandom() {
  renderLoading();
  const { data, error } = await supabase.rpc("get_random_message", {
    exclude_id: lastShownId,
  });

  if (error) {
    console.error(error);
    showToast("Could not reach the sea. Try again.", "ph-warning-circle");
    renderIdle();
    return;
  }

  const msg = Array.isArray(data) ? data[0] : data;
  if (!msg) {
    stage.innerHTML = `
      <div class="hero">
        <h1>The sea is empty.</h1>
        <p>Be the first to leave a message for someone else to find.</p>
        <button class="btn btn-primary" id="writeFirstBtn"><i class="ph-bold ph-feather"></i> Write a message</button>
      </div>
    `;
    document.getElementById("writeFirstBtn").addEventListener("click", () => navigate("write"));
    return;
  }

  lastShownId = msg.id;
  history.replaceState({}, "", `${location.pathname}?m=${msg.id}`);
  renderMessage(msg, { animate: true });
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
  renderMessage(data, { animate: true });
}

function renderMessage(msg, { animate }) {
  setActiveTab("home");
  const liked = getLikedIds().has(msg.id);

  stage.innerHTML = `
    <div class="message-wrap">
      <article class="message-card" id="messageCard">
        <span class="message-quote" aria-hidden="true">&ldquo;</span>
        <p class="message-text" id="messageText">${escapeHtml(msg.content)}</p>
        <div class="message-meta">left ${timeAgo(msg.created_at)}</div>
      </article>
      <div class="message-actions">
        <button class="btn ${liked ? "is-liked" : ""}" id="likeBtn" aria-pressed="${liked}">
          <i class="ph${liked ? "-fill" : ""} ph-heart"></i> <span id="likeCount">${msg.likes_count}</span>
        </button>
        <button class="btn" id="copyBtn"><i class="ph ph-link-simple"></i> Copy link</button>
        <button class="btn" id="nextBtn"><i class="ph ph-arrows-clockwise"></i> Another message</button>
      </div>
      <div class="message-footer">
        <button class="btn btn-primary" id="passBtn"><i class="ph-bold ph-feather"></i> Pass it forward</button>
      </div>
    </div>
  `;

  document.getElementById("likeBtn").addEventListener("click", () => toggleLike(msg));
  document.getElementById("copyBtn").addEventListener("click", () => copyLink(msg.id));
  document.getElementById("nextBtn").addEventListener("click", () => revealRandom());
  document.getElementById("passBtn").addEventListener("click", () => {
    passForward = true;
    navigate("write");
  });

  if (animate && window.gsap && !prefersReducedMotion) {
    const card = document.getElementById("messageCard");
    const text = document.getElementById("messageText");
    const actions = document.querySelectorAll(".message-actions .btn, .message-footer .btn");

    gsap.set(card, { opacity: 0, y: 18, scale: 0.96 });
    gsap.set(text, { opacity: 0, filter: "blur(10px)" });
    gsap.set(actions, { opacity: 0, y: 10 });

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.55 })
      .to(text, { opacity: 1, filter: "blur(0px)", duration: 0.7 }, "-=0.35")
      .to(actions, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 }, "-=0.3");
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
    const { error } = await supabase
      .from("message_likes")
      .insert({ message_id: msg.id, liker_token: likerToken });
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

  if (nowLiked && !prefersReducedMotion && icon.animate) {
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

async function copyLink(id) {
  const url = shareUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied to clipboard");
  } catch {
    showToast(url, "ph-link-simple");
  }
  supabase.rpc("increment_share_count", { target_id: id }).then(({ error }) => {
    if (error) console.error(error);
  });
}

// ---------- Gallery ----------

async function renderGallery() {
  setActiveTab("gallery");
  stage.innerHTML = `
    <div class="view-head">
      <h1>Messages from strangers</h1>
      <p>Browse what others have left behind for someone to find.</p>
    </div>
    <div class="gallery-loading">Gathering messages&hellip;</div>
  `;

  if (window.gsap && !prefersReducedMotion) {
    gsap.from(".view-head", { opacity: 0, y: 10, duration: 0.4, ease: "power2.out" });
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
      <p>No messages yet. Be the first to write one.</p>
      <button class="btn btn-primary" id="emptyWriteBtn"><i class="ph-bold ph-feather"></i> Write the first one</button>
    `;
    stage.querySelector(".gallery-loading").replaceWith(empty);
    document.getElementById("emptyWriteBtn").addEventListener("click", () => navigate("write"));
    return;
  }

  const grid = document.createElement("div");
  grid.className = "gallery-grid";
  grid.innerHTML = data
    .map(
      (msg) => `
      <button class="gallery-card" data-id="${msg.id}">
        <i class="ph ph-arrow-up-right open-cue" aria-hidden="true"></i>
        <p>${escapeHtml(msg.content)}</p>
        <div class="gallery-card-meta">
          <span>${timeAgo(msg.created_at)}</span>
          <span class="like"><i class="ph ph-heart"></i> ${msg.likes_count}</span>
        </div>
      </button>
    `
    )
    .join("");

  stage.querySelector(".gallery-loading").replaceWith(grid);

  grid.querySelectorAll(".gallery-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      history.pushState({}, "", `${location.pathname}?m=${id}`);
      loadSharedMessage(id);
    });
  });

  if (prefersReducedMotion) {
    grid.querySelectorAll(".gallery-card").forEach((c) => c.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  grid.querySelectorAll(".gallery-card").forEach((c) => io.observe(c));
}

// ---------- Write ----------

function renderWrite() {
  setActiveTab("write");
  const forward = passForward;

  stage.innerHTML = `
    <div class="write-wrap">
      <div class="view-head">
        <h1>${forward ? "Pass it forward" : "Write one for a stranger"}</h1>
        <p>Keep it kind. It might be exactly what someone needs today.</p>
      </div>
      <div class="write-card">
        <div class="field">
          <label for="newMessage">Your message</label>
          <textarea id="newMessage" maxlength="500" placeholder="Dear stranger,"></textarea>
          <div class="field-foot">
            <span id="charCount">0 / 500</span>
          </div>
          <div class="field-error" id="fieldError"></div>
        </div>
        <div class="write-actions">
          <button class="btn" id="cancelBtn">Cancel</button>
          <button class="btn btn-primary" id="sendBtn"><i class="ph-bold ph-paper-plane-tilt"></i> Send message</button>
        </div>
      </div>
    </div>
  `;

  const textarea = document.getElementById("newMessage");
  const charCount = document.getElementById("charCount");
  const fieldError = document.getElementById("fieldError");
  const sendBtn = document.getElementById("sendBtn");

  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 500`;
    charCount.classList.toggle("is-warning", len > 460);
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

    renderWriteSuccess();
  });
}

function renderWriteSuccess() {
  stage.innerHTML = `
    <div class="write-wrap">
      <div class="write-card write-success">
        <i class="ph-fill ph-check-circle"></i>
        <h2>Your message is adrift.</h2>
        <p>Someone will find it soon. Thank you for passing on a kind word.</p>
        <div class="write-actions" style="justify-content:center">
          <button class="btn" id="toGallery"><i class="ph ph-books"></i> Browse gallery</button>
          <button class="btn btn-primary" id="toHome"><i class="ph-bold ph-paper-plane-tilt"></i> Back home</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("toGallery").addEventListener("click", () => navigate("gallery"));
  document.getElementById("toHome").addEventListener("click", () => navigate("home"));

  if (window.gsap && !prefersReducedMotion) {
    gsap.from(".write-success i", { scale: 0.5, opacity: 0, duration: 0.5, ease: "back.out(2)" });
    gsap.from(".write-success h2, .write-success p, .write-success .write-actions", {
      opacity: 0,
      y: 10,
      duration: 0.4,
      stagger: 0.08,
      delay: 0.15,
      ease: "power2.out",
    });
  }
}

// ---------- render dispatch ----------

function render() {
  const route = currentRoute();

  if (route.sharedId) {
    loadSharedMessage(route.sharedId);
    return;
  }

  if (route.name === "gallery") {
    renderGallery();
    return;
  }

  if (route.name === "write") {
    renderWrite();
    return;
  }

  renderIdle();
}

render();

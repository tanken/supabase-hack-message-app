import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Safe to expose: this is Supabase's public anon/publishable key, meant for client-side use.
// All access is governed by Row Level Security policies on the project.
const SUPABASE_URL = "https://mttopqljhujyhfxxtpdo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GjuVFNvSlQIps-WCC1fatg_n68vmHjX";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

const messageText = document.getElementById("messageText");
const timestamp = document.getElementById("timestamp");
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
const shareBtn = document.getElementById("shareBtn");
const nextBtn = document.getElementById("nextBtn");
const newMessage = document.getElementById("newMessage");
const charCount = document.getElementById("charCount");
const postBtn = document.getElementById("postBtn");
const postStatus = document.getElementById("postStatus");
const toast = document.getElementById("toast");

let current = null;

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function formatTime(iso) {
  const d = new Date(iso);
  return `left ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function renderMessage(msg) {
  current = msg;
  messageText.textContent = msg.content;
  timestamp.textContent = formatTime(msg.created_at);
  likeCount.textContent = msg.likes_count;
  const liked = getLikedIds().has(msg.id);
  likeBtn.setAttribute("aria-pressed", String(liked));
  likeBtn.querySelector(".icon").textContent = liked ? "❤️" : "🤍";
}

async function loadRandomMessage() {
  messageText.textContent = "Uncorking a bottle…";
  const { data, error } = await supabase.rpc("get_random_message", {
    exclude_id: current?.id ?? null,
  });

  if (error) {
    console.error(error);
    messageText.textContent = "Couldn't reach the sea right now. Try again in a moment.";
    return;
  }

  const msg = Array.isArray(data) ? data[0] : data;

  if (!msg) {
    messageText.textContent = "The sea is empty. Be the first to leave a message!";
    return;
  }

  renderMessage(msg);
}

async function toggleLike() {
  if (!current) return;
  const liked = getLikedIds().has(current.id);
  likeBtn.disabled = true;

  if (liked) {
    const { error } = await supabase
      .from("message_likes")
      .delete()
      .eq("message_id", current.id)
      .eq("liker_token", likerToken);
    if (!error) {
      setLiked(current.id, false);
      current.likes_count = Math.max(current.likes_count - 1, 0);
      renderMessage(current);
    }
  } else {
    const { error } = await supabase
      .from("message_likes")
      .insert({ message_id: current.id, liker_token: likerToken });
    if (!error) {
      setLiked(current.id, true);
      current.likes_count += 1;
      renderMessage(current);
    }
  }

  likeBtn.disabled = false;
}

async function shareCurrent() {
  if (!current) return;
  const url = `${location.origin}${location.pathname}#${current.id}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Message in a Bottle", text: current.content, url });
    } else {
      await navigator.clipboard.writeText(`"${current.content}" — ${url}`);
      showToast("Copied to clipboard!");
    }
    await supabase.rpc("increment_share_count", { target_id: current.id });
    current.share_count += 1;
  } catch (err) {
    if (err?.name !== "AbortError") console.error(err);
  }
}

function updateCharCount() {
  charCount.textContent = `${newMessage.value.length} / 500`;
}

async function postMessage() {
  const content = newMessage.value.trim();
  if (!content) {
    postStatus.textContent = "Write something before casting it away.";
    return;
  }

  postBtn.disabled = true;
  postStatus.textContent = "Sending your bottle out to sea…";

  const { error } = await supabase.from("messages").insert({ content });

  postBtn.disabled = false;

  if (error) {
    console.error(error);
    postStatus.textContent = "Something went wrong. Please try again.";
    return;
  }

  newMessage.value = "";
  updateCharCount();
  postStatus.textContent = "Your message is adrift. Someone will find it soon. 🌊";
  setTimeout(() => (postStatus.textContent = ""), 4000);
}

likeBtn.addEventListener("click", toggleLike);
shareBtn.addEventListener("click", shareCurrent);
nextBtn.addEventListener("click", loadRandomMessage);
newMessage.addEventListener("input", updateCharCount);
postBtn.addEventListener("click", postMessage);

updateCharCount();
loadRandomMessage();

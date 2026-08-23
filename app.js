const endpoint = "https://zxbmbbfrzbtuueysicoc.supabase.co/functions/v1/sqm-media-top-posts";
const postsRoot = document.querySelector("#post-list");
const statusRoot = document.querySelector("#data-status");

function formatViews(value) {
  return new Intl.NumberFormat("zh-TW").format(Number(value) || 0);
}

function showPosts(payload, fallback = false) {
  const posts = Array.isArray(payload?.data) ? payload.data.slice(0, 3) : [];
  postsRoot.replaceChildren();
  if (!posts.length) {
    postsRoot.textContent = "代表作暫時無法顯示。";
    return;
  }
  posts.forEach((post, index) => {
    const item = document.createElement("li");
    item.className = "post";
    const rank = document.createElement("span");
    rank.className = "post-rank";
    rank.textContent = `0${post.rank || index + 1}`.slice(-2);
    const copy = document.createElement("div");
    const link = document.createElement("a");
    link.className = "post-title";
    link.href = post.permalink;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = post.title || "查看 Threads 貼文";
    const excerpt = document.createElement("p");
    excerpt.className = "post-excerpt";
    excerpt.textContent = post.excerpt || "";
    copy.append(link, excerpt);
    const meta = document.createElement("div");
    meta.className = "post-meta";
    const views = document.createElement("strong");
    views.textContent = `${formatViews(post.views)} views`;
    const arrow = document.createElement("span");
    arrow.textContent = "Threads ↗";
    meta.append(views, arrow);
    item.append(rank, copy, meta);
    postsRoot.append(item);
  });
  if (fallback) statusRoot.textContent = "代表作快照（資料暫時更新中）";
  else if (payload?.meta?.stale) statusRoot.textContent = "資料更新中（顯示最近一次觀測）";
  else statusRoot.textContent = "依目前已同步內容的瀏覽數排序";
}

async function loadPosts() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("content unavailable");
    const payload = await response.json();
    showPosts(payload);
  } catch {
    showPosts(window.SQM_FALLBACK_POSTS, true);
  } finally {
    window.clearTimeout(timer);
  }
}

document.querySelector("#year").textContent = String(new Date().getFullYear());
loadPosts();

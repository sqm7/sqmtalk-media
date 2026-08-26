const endpoint = "https://zxbmbbfrzbtuueysicoc.supabase.co/functions/v1/sqm-media-top-posts?format=media-v3&view=content-totals-v1";
const postsRoot = document.querySelector("#post-list");
const statusRoot = document.querySelector("#data-status");
const showMoreButton = document.querySelector("#show-more");
const accountStatusRoot = document.querySelector("#account-data-status");
const accountSnapshotRoot = document.querySelector("#account-snapshot-at");
let activePayload = null;
let visibleCount = 3;

function formatViews(value) {
  return new Intl.NumberFormat("zh-TW").format(Number(value) || 0);
}

function formatSnapshotDate(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "尚未同步";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function withoutFullStops(value) {
  return String(value || "").replace(/[。．]/g, "");
}

function metricChip(icon, label, value) {
  const chip = document.createElement("span");
  const glyph = document.createElement("span");
  glyph.className = "metric-icon";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = icon;
  const text = document.createElement("span");
  text.textContent = `${label} ${formatViews(value)}`;
  chip.append(glyph, text);
  return chip;
}

function showAccountSummary(totals, fallback = false) {
  const accountData = totals && typeof totals === "object" ? totals : null;
  const metricKeys = ["views", "likes", "replies", "reposts", "quotes", "shares", "postsCount"];
  metricKeys.forEach((key) => {
    const target = document.querySelector(`[data-metric="${key}"]`);
    if (!target) return;
    const value = accountData?.[key];
    target.textContent = value === null || value === undefined ? "—" : formatViews(value);
  });
  if (accountSnapshotRoot) accountSnapshotRoot.textContent = formatSnapshotDate(accountData?.latestSnapshotAt);
  if (!accountStatusRoot) return;
  if (!accountData) {
    accountStatusRoot.textContent = "帳號總覽尚待同步";
  } else if (fallback) {
    accountStatusRoot.textContent = "總覽快照（資料暫時更新中）";
  } else {
    accountStatusRoot.textContent = "目前已同步貼文的最新成效加總";
  }
}

function showPosts(payload, fallback = false) {
  activePayload = payload;
  const allPosts = Array.isArray(payload?.data) ? payload.data : [];
  const posts = allPosts.slice(0, visibleCount);
  postsRoot.replaceChildren();
  if (!posts.length) {
    postsRoot.textContent = "作品集暫時無法顯示";
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
    link.rel = "noopener";
    link.textContent = withoutFullStops(post.title) || "查看 Threads 貼文";
    const excerpt = document.createElement("p");
    excerpt.className = "post-excerpt";
    excerpt.textContent = withoutFullStops(post.excerpt);
    const metricEntries = [
      ["♡", "喜歡", post.likes],
      ["◌", "回覆", post.replies],
      ["↻", "轉發", post.reposts],
      ["↗", "引用", post.quotes],
      ["⇧", "分享", post.shares],
    ].filter(([, , value]) => value !== undefined && value !== null);
    if (metricEntries.length) {
      const engagement = document.createElement("div");
      engagement.className = "post-engagement";
      metricEntries.forEach(([icon, label, value]) => engagement.append(metricChip(icon, label, value)));
      copy.append(link, excerpt, engagement);
    } else {
      copy.append(link, excerpt);
    }
    const meta = document.createElement("div");
    meta.className = "post-meta";
    const views = document.createElement("strong");
    views.className = "post-views";
    views.textContent = formatViews(post.views);
    const viewsUnit = document.createElement("small");
    viewsUnit.textContent = "VIEWS";
    views.append(viewsUnit);
    const threads = document.createElement("a");
    threads.className = "threads-badge";
    threads.href = post.permalink;
    threads.rel = "noopener";
    const threadsIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    threadsIcon.className = "threads-glyph";
    threadsIcon.setAttribute("viewBox", "0 0 24 24");
    threadsIcon.setAttribute("aria-hidden", "true");
    const threadsPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    threadsPath.setAttribute("d", "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z");
    threadsIcon.append(threadsPath);
    const threadsText = document.createElement("span");
    threadsText.textContent = "Threads ↗";
    threads.append(threadsIcon, threadsText);
    meta.append(views, threads);
    item.append(rank, copy, meta);
    postsRoot.append(item);
  });
  showMoreButton.hidden = fallback || allPosts.length <= 3 || visibleCount >= allPosts.length;
  if (fallback) {
    statusRoot.hidden = false;
    statusRoot.textContent = "作品集快照（資料暫時更新中）";
  } else if (payload?.meta?.stale) {
    statusRoot.hidden = false;
    statusRoot.textContent = "資料更新中（顯示最近一次觀測）";
  }
  else statusRoot.hidden = true;
}

showMoreButton.addEventListener("click", () => {
  visibleCount = 10;
  showPosts(activePayload);
  showMoreButton.focus();
});

async function loadPosts() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("content unavailable");
    const payload = await response.json();
    showPosts(payload);
    showAccountSummary(payload?.contentTotals ?? window.SQM_FALLBACK_ACCOUNT?.data, !payload?.contentTotals);
  } catch {
    showPosts(window.SQM_FALLBACK_POSTS, true);
    showAccountSummary(window.SQM_FALLBACK_ACCOUNT?.data, true);
  } finally {
    window.clearTimeout(timer);
  }
}

document.querySelector("#year").textContent = String(new Date().getFullYear());
showAccountSummary(null);
loadPosts();

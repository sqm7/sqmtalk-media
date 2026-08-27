const endpointBase = "https://zxbmbbfrzbtuueysicoc.supabase.co/functions/v1/sqm-media-top-posts";
const postsRoot = document.querySelector("#ranking-pools");
const poolSwitchRoot = document.querySelector("#pool-switch");
const metricSwitchRoot = document.querySelector("#metric-switch");
const statusRoot = document.querySelector("#data-status");
const showMoreButton = document.querySelector("#show-more");
const accountStatusRoot = document.querySelector("#account-data-status");
const accountSnapshotRoot = document.querySelector("#account-snapshot-at");
const METRICS = [
  ["views", "觀看數"],
  ["likes", "愛心數"],
  ["replies", "回覆數"],
  ["reposts", "轉發數"],
  ["quotes", "引用數"],
  ["shares", "分享數"],
];
let activePayload = null;
let activeMetric = "views";
let activePool = "all";
let visibleCount = 3;

function configureThreadsLink(link, permalink) {
  link.href = permalink;
  link.rel = "noopener";
}

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
    if (key === "postsCount") {
      target.textContent = value === null || value === undefined ? "—" : formatViews(value);
      return;
    }
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

function groupsFromPayload(payload) {
  if (Array.isArray(payload?.groups) && payload.groups.length) return payload.groups;
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return [{
    slug: "all",
    name: "全部排行",
    displayName: "熱門貼文",
    description: "所有已同步 Threads 貼文",
    isSystem: true,
    postCount: data.length,
    data,
  }];
}

function renderMetricSwitch() {
  if (!metricSwitchRoot) return;
  metricSwitchRoot.replaceChildren();
  METRICS.forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `switch-button${activeMetric === key ? " is-active" : ""}`;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(activeMetric === key));
    button.addEventListener("click", () => {
      if (activeMetric === key) return;
      activeMetric = key;
      visibleCount = 3;
      renderMetricSwitch();
      loadPosts();
    });
    metricSwitchRoot.append(button);
  });
}

function renderPoolSwitch(groups) {
  if (!poolSwitchRoot) return;
  poolSwitchRoot.replaceChildren();
  const choices = groups.map((group) => ({ slug: group.slug, label: group.displayName || group.name }));
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `switch-button${activePool === choice.slug ? " is-active" : ""}`;
    button.textContent = choice.label;
    button.setAttribute("aria-pressed", String(activePool === choice.slug));
    button.addEventListener("click", () => {
      activePool = choice.slug;
      visibleCount = 3;
      renderPoolSwitch(groups);
      showPosts(activePayload);
    });
    poolSwitchRoot.append(button);
  });
}

function makePostItem(post, index) {
  const item = document.createElement("li");
  item.className = "post";
  const rank = document.createElement("span");
  rank.className = "post-rank";
  rank.textContent = `0${post.rank || index + 1}`.slice(-2);
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "post-title";
  title.textContent = withoutFullStops(post.title) || "查看 Threads 貼文";
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
  const engagement = document.createElement("div");
  engagement.className = "post-engagement";
  metricEntries.forEach(([icon, label, value]) => engagement.append(metricChip(icon, label, value)));
  copy.append(title, excerpt, engagement);

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const metric = document.createElement("strong");
  metric.className = "post-views";
  metric.textContent = formatViews(post[activeMetric]);
  const metricUnit = document.createElement("small");
  metricUnit.textContent = METRICS.find(([key]) => key === activeMetric)?.[1] || "成效";
  metric.append(metricUnit);
  const threads = document.createElement("a");
  threads.className = "threads-badge";
  configureThreadsLink(threads, post.permalink);
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
  meta.append(metric, threads);
  item.append(rank, copy, meta);
  return item;
}

function showPosts(payload, fallback = false) {
  activePayload = payload;
  const groups = groupsFromPayload(payload);
  renderPoolSwitch(groups);
  const visibleGroups = groups.filter((group) => group.slug === activePool);
  postsRoot.replaceChildren();
  if (!visibleGroups.length) {
    postsRoot.textContent = "目前沒有可顯示的排行池";
    showMoreButton.hidden = true;
    return;
  }

  let hasMore = false;
  visibleGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "ranking-pool";
    const heading = document.createElement("div");
    heading.className = "ranking-pool-heading";
    const title = document.createElement("h3");
    title.textContent = group.displayName || group.name || "排行池";
    const count = document.createElement("span");
    count.textContent = `${Number(group.postCount ?? group.data?.length ?? 0).toLocaleString("zh-TW")} 篇`;
    heading.append(title, count);
    if (group.description) {
      const description = document.createElement("p");
      description.textContent = group.description;
      heading.append(description);
    }
    const list = document.createElement("ol");
    list.className = "post-list";
    const allPosts = Array.isArray(group.data) ? group.data : [];
    const posts = allPosts.slice(0, visibleCount);
    allPosts.length > visibleCount && (hasMore = true);
    posts.forEach((post, index) => list.append(makePostItem(post, index)));
    if (!posts.length) {
      const empty = document.createElement("li");
      empty.className = "post-loading";
      empty.textContent = "這個排行池目前尚無可顯示貼文";
      list.append(empty);
    }
    section.append(heading, list);
    postsRoot.append(section);
  });

  showMoreButton.hidden = fallback || !hasMore || visibleCount >= 10;
  showMoreButton.textContent = visibleCount >= 10 ? "" : "看第 4 名到第 10 名 ↓";
  if (fallback) {
    statusRoot.hidden = false;
    statusRoot.textContent = "作品集快照（資料暫時更新中）";
  } else if (payload?.meta?.stale) {
    statusRoot.hidden = false;
    statusRoot.textContent = "資料更新中（顯示最近一次觀測）";
  } else {
    statusRoot.hidden = true;
  }
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
    const response = await fetch(`${endpointBase}?metric=${encodeURIComponent(activeMetric)}`, { signal: controller.signal, headers: { accept: "application/json" } });
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

renderMetricSwitch();
document.querySelector("#year").textContent = String(new Date().getFullYear());
showAccountSummary(null);
loadPosts();

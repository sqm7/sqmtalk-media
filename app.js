const endpointBase = "https://zxbmbbfrzbtuueysicoc.supabase.co/functions/v1/sqm-media-top-posts";
const postsRoot = document.querySelector("#ranking-pools");
const poolSwitchRoot = document.querySelector("#pool-switch");
const metricSwitchRoot = document.querySelector("#metric-switch");
const windowSwitchRoot = document.querySelector("#window-switch");
const statusRoot = document.querySelector("#data-status");
const showMoreButton = document.querySelector("#show-more");
const accountStatusRoot = document.querySelector("#account-data-status");
const accountSnapshotRoot = document.querySelector("#account-snapshot-at");
const PAGE_SIZE = 10;
const METRICS = [["views", "觀看數"], ["likes", "愛心數"], ["replies", "回覆數"], ["reposts", "轉發數"], ["quotes", "引用數"], ["shares", "分享數"]];
const RANKING_WINDOWS = [["all", "全期間"], ["recent_30d", "近 30 天"]];
let activePayload = null;
let activeMetric = "views";
let activePool = "all";
let activeWindow = "all";
let activeRows = [];
let visibleCount = PAGE_SIZE;
let loadingMore = false;
let knownGroups = [];

function configureThreadsLink(link, permalink) { link.href = permalink; link.rel = "noopener"; }
function formatViews(value) { return new Intl.NumberFormat("zh-TW").format(Number(value) || 0); }
function formatSnapshotDate(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "尚未同步";
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
function withoutFullStops(value) { return String(value || "").replace(/[。．]/g, ""); }

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
  ["views", "likes", "replies", "reposts", "quotes", "shares", "postsCount"].forEach((key) => {
    const target = document.querySelector(`[data-metric="${key}"]`);
    if (target) target.textContent = accountData?.[key] === null || accountData?.[key] === undefined ? "—" : formatViews(accountData[key]);
  });
  if (accountSnapshotRoot) accountSnapshotRoot.textContent = formatSnapshotDate(accountData?.latestSnapshotAt);
  if (!accountStatusRoot) return;
  accountStatusRoot.textContent = !accountData ? "帳號總覽尚待同步" : fallback ? "總覽快照（資料暫時更新中）" : "目前已同步貼文的最新成效加總";
}

function groupsFromPayload(payload) {
  if (Array.isArray(payload?.groups) && payload.groups.length) return payload.groups;
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return [{ slug: "all", name: "全部排行", displayName: "熱門貼文", description: "所有已同步 Threads 貼文", isSystem: true, postCount: data.length, data }];
}
function selectedGroup(payload = activePayload) { return groupsFromPayload(payload).find((group) => group.slug === activePool) || null; }

function renderSwitch(root, choices, activeValue, onChange) {
  if (!root) return;
  root.replaceChildren();
  choices.forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `switch-button${activeValue === key ? " is-active" : ""}`;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(activeValue === key));
    button.addEventListener("click", () => key !== activeValue && onChange(key));
    root.append(button);
  });
}
function renderMetricSwitch() { renderSwitch(metricSwitchRoot, METRICS, activeMetric, (key) => { activeMetric = key; resetAndLoad(); }); }
function renderWindowSwitch() { renderSwitch(windowSwitchRoot, RANKING_WINDOWS, activeWindow, (key) => { activeWindow = key; resetAndLoad(); }); }
function renderPoolSwitch(groups) {
  renderSwitch(poolSwitchRoot, groups.map((group) => [group.slug, group.displayName || group.name]), activePool, (key) => { activePool = key; resetAndLoad(); });
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
  const engagement = document.createElement("div");
  engagement.className = "post-engagement";
  [["♡", "喜歡", post.likes], ["◌", "回覆", post.replies], ["↻", "轉發", post.reposts], ["↗", "引用", post.quotes], ["⇧", "分享", post.shares]]
    .filter(([, , value]) => value !== undefined && value !== null)
    .forEach(([icon, label, value]) => engagement.append(metricChip(icon, label, value)));
  copy.append(title, excerpt, engagement);

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const performance = document.createElement("div");
  const metric = document.createElement("strong");
  metric.className = "post-views";
  metric.textContent = formatViews(post[activeMetric]);
  const metricUnit = document.createElement("small");
  metricUnit.textContent = METRICS.find(([key]) => key === activeMetric)?.[1] || "成效";
  metric.append(metricUnit);
  const observed = document.createElement("small");
  observed.className = "post-observed-at";
  observed.textContent = `更新 ${formatSnapshotDate(post.observedAt)}`;
  performance.append(metric, observed);
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
  meta.append(performance, threads);
  item.append(rank, copy, meta);
  return item;
}

function showPosts(payload, fallback = false) {
  activePayload = payload;
  const groups = groupsFromPayload(payload);
  knownGroups = [...new Map([...knownGroups, ...groups].map((group) => [group.slug, group])).values()];
  renderPoolSwitch(knownGroups);
  postsRoot.replaceChildren();
  const group = selectedGroup();
  if (!group) {
    postsRoot.textContent = "目前沒有可顯示的排行池";
    showMoreButton.hidden = true;
    return;
  }
  const section = document.createElement("section");
  section.className = "ranking-pool";
  const heading = document.createElement("div");
  heading.className = "ranking-pool-heading";
  const title = document.createElement("h3");
  title.textContent = group.displayName || group.name || "排行池";
  const total = Number(group.postCount ?? activeRows.length ?? 0);
  const count = document.createElement("span");
  count.textContent = `前 ${Math.min(visibleCount, activeRows.length).toLocaleString("zh-TW")} 篇／共 ${total.toLocaleString("zh-TW")} 篇`;
  heading.append(title, count);
  if (group.description) {
    const description = document.createElement("p");
    description.textContent = group.description;
    heading.append(description);
  }
  const list = document.createElement("ol");
  list.className = "post-list";
  activeRows.slice(0, visibleCount).forEach((post, index) => list.append(makePostItem(post, index)));
  if (!activeRows.length) {
    const empty = document.createElement("li");
    empty.className = "post-loading";
    empty.textContent = "這個排行池目前尚無可顯示貼文";
    list.append(empty);
  }
  section.append(heading, list);
  postsRoot.append(section);

  showMoreButton.hidden = true;
  if (fallback) { statusRoot.hidden = false; statusRoot.textContent = "作品集快照（資料暫時更新中）"; }
  else if (payload?.meta?.stale) { statusRoot.hidden = false; statusRoot.textContent = "資料更新中（顯示最近一次觀測）"; }
  else statusRoot.hidden = true;
}

function resetAndLoad() {
  activeRows = [];
  visibleCount = PAGE_SIZE;
  renderMetricSwitch();
  renderWindowSwitch();
  loadPosts();
}

showMoreButton.addEventListener("click", async () => {
  if (loadingMore) return;
  if (visibleCount < activeRows.length) {
    visibleCount = Math.min(visibleCount + PAGE_SIZE, activeRows.length);
    showPosts(activePayload);
    showMoreButton.focus();
    return;
  }
  loadingMore = true;
  showMoreButton.disabled = true;
  try {
    await loadPosts({ append: true });
    visibleCount = Math.min(visibleCount + PAGE_SIZE, activeRows.length);
    showPosts(activePayload);
  } finally {
    loadingMore = false;
    showMoreButton.disabled = false;
    showMoreButton.focus();
  }
});

async function loadPosts({ append = false } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const params = new URLSearchParams({ metric: activeMetric, window: activeWindow, offset: String(append ? activeRows.length : 0), limit: String(PAGE_SIZE) });
    if (knownGroups.length) params.set("pool", activePool);
    const response = await fetch(`${endpointBase}?${params}`, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("content unavailable");
    const payload = await response.json();
    const group = selectedGroup(payload);
    const page = Array.isArray(group?.data) ? group.data : [];
    activeRows = append ? [...activeRows, ...page.filter((post) => !activeRows.some((row) => row.threadId === post.threadId))] : page;
    showPosts(payload);
    showAccountSummary(payload?.contentTotals ?? window.SQM_FALLBACK_ACCOUNT?.data, !payload?.contentTotals);
  } catch {
    if (!append) {
      const fallback = window.SQM_FALLBACK_POSTS;
      activeRows = Array.isArray(selectedGroup(fallback)?.data) ? selectedGroup(fallback).data : [];
      showPosts(fallback, true);
      showAccountSummary(window.SQM_FALLBACK_ACCOUNT?.data, true);
    }
  } finally { window.clearTimeout(timer); }
}

renderMetricSwitch();
renderWindowSwitch();
document.querySelector("#year").textContent = String(new Date().getFullYear());
showAccountSummary(null);
loadPosts();

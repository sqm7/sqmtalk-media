# 平米內參媒體名片

獨立部署於 `media.sqmtalk.com` 的靜態媒體名片站；不改動既有 `www.sqmtalk.com` 產品前端。

代表作區塊會讀取 `sqm-media-top-posts` 的固定、唯讀公開投影。若接口暫時無法讀取，頁面顯示清楚標示的隨站快照。

Threads 區塊的「已同步內容總覽」使用目前已同步貼文的最新成效快照加總，包含觀看、愛心、回覆、轉發、引用與分享；`fallback-account.js` 保存最後一次可用快照，未來公開投影回傳 `contentTotals` 後會自動改用動態資料。

## 部署

GitHub Pages 由 `main` branch 的根目錄發佈。`CNAME` 保留子網域設定。

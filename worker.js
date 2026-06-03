/**
 * 条漫生成器 — Cloudflare Workers 版本
 *
 * 部署方式：
 *   1. 打开 Cloudflare Dashboard → Workers & Pages → 创建 Worker
 *   2. 把本文件内容粘贴进去
 *   3. 设置环境变量：COZE_API_TOKEN、COZE_WORKFLOW_ID
 *   4. 部署，拿到 xxx.workers.dev 域名
 *
 * 环境变量（在 Worker 设置页 → Variables 里添加）：
 *   COZE_API_TOKEN     = pat_xxx
 *   COZE_WORKFLOW_ID    = 7592xxx
 */

const COZE_API = "https://api.coze.cn/v1";

// ── 工具：触发 Coze 工作流 ──
async function triggerWorkflow(token, workflowId) {
  const resp = await fetch(`${COZE_API}/workflow/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      parameters: {},
      is_async: true,
    }),
  });
  const json = await resp.json();
  if (json.code !== 0) {
    throw new Error(json.msg || "Coze API 调用失败");
  }
  return json.data.execute_id;
}

// ── 工具：查询工作流状态 ──
async function getStatus(token, workflowId, executeId) {
  const url = `${COZE_API}/workflows/${workflowId}/run_histories/${executeId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

// ── HTML 页面 ──
const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="条漫生成">
<title>条漫生成器</title>
<style>
  :root {
    --bg: #0f0f0f; --card: #1a1a1a; --accent: #ff6b35; --accent2: #f7c948;
    --text: #e8e8e8; --text2: #999; --green: #4ade80; --red: #f87171;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg); color: var(--text); min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; padding: 20px 16px 40px;
    -webkit-tap-highlight-color: transparent;
  }
  .header { text-align: center; margin-top: 24px; margin-bottom: 8px; }
  .header .icon { font-size: 56px; margin-bottom: 8px; }
  .header h1 { font-size: 22px; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .header p { color: var(--text2); font-size: 13px; margin-top: 4px; }
  .status-card { width: 100%; max-width: 420px; background: var(--card); border-radius: 16px; padding: 20px; margin: 16px 0; border: 1px solid #2a2a2a; }
  .status-row { display: flex; align-items: center; justify-content: space-between; }
  .status-label { font-size: 14px; color: var(--text2); }
  .status-badge { font-size: 12px; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
  .badge-idle { background: #2a2a2a; color: #888; }
  .badge-running { background: rgba(247,201,72,.15); color: var(--accent2); }
  .badge-done { background: rgba(74,222,128,.15); color: var(--green); }
  .badge-failed { background: rgba(248,113,113,.15); color: var(--red); }
  .btn { width: 100%; max-width: 420px; height: 56px; border: none; border-radius: 16px; font-size: 18px; font-weight: 700; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 8px; margin: 8px 0; }
  .btn:active { transform: scale(0.96); }
  .btn-primary { background: linear-gradient(135deg, var(--accent), #e55a2b); color: #fff; box-shadow: 0 4px 24px rgba(255,107,53,.35); }
  .btn-primary:disabled { opacity: .5; transform: none; box-shadow: none; }
  .btn-secondary { background: var(--card); color: var(--text2); border: 1px solid #2a2a2a; height: 44px; font-size: 14px; font-weight: 500; }
  .result-card { width: 100%; max-width: 420px; background: var(--card); border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a; margin-top: 12px; display: none; }
  .result-card.show { display: block; }
  .result-card img { width: 100%; display: block; }
  .result-body { padding: 16px; }
  .result-meta { font-size: 12px; color: var(--text2); margin-top: 4px; display: flex; align-items: center; gap: 6px; }
  .history { width: 100%; max-width: 420px; margin-top: 24px; }
  .history h3 { font-size: 14px; color: var(--text2); font-weight: 500; margin-bottom: 12px; }
  .history-item { background: var(--card); border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; border: 1px solid #2a2a2a; display: flex; align-items: center; gap: 10px; }
  .history-item:active { background: #222; }
  .history-item img { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
  .history-item .info { flex: 1; min-width: 0; }
  .history-item .time { font-size: 11px; color: var(--text2); }
  .history-item .preview { font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .history-empty { color: var(--text2); font-size: 13px; text-align: center; padding: 20px; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }
  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 10px 20px; border-radius: 10px; font-size: 14px; z-index: 999; opacity: 0; transition: opacity .3s; pointer-events: none; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<div class="header">
  <div class="icon">🎨</div>
  <h1>条漫生成器</h1>
  <p>不满意？一键重新生成</p>
</div>

<div class="status-card">
  <div class="status-row">
    <span class="status-label">当前状态</span>
    <span class="status-badge badge-idle" id="statusBadge">⏸ 空闲</span>
  </div>
</div>

<button class="btn btn-primary" id="btnGenerate" onclick="handleGenerate()">
  🔄 重新生成条漫
</button>
<button class="btn btn-secondary" id="btnRefresh" onclick="loadLastResult()" style="display:none;">
  🔍 查看最近结果
</button>

<div id="loadingArea" style="display:none; text-align:center; margin:20px 0; color:var(--text2);">
  <p class="pulse" style="font-size:14px;">⏳ 正在生成中，大约需要 30-60 秒...</p>
  <p style="font-size:12px; color:var(--text2); margin-top:4px;">生成完毕后也会推送到你微信</p>
</div>

<div class="result-card" id="resultCard">
  <div id="resultImages"></div>
  <div class="result-body">
    <div class="result-meta">
      <span>✅ 生成完成</span>
      <span id="resultTime"></span>
    </div>
  </div>
</div>

<div class="history">
  <h3>📋 历史记录</h3>
  <div id="historyList"><div class="history-empty">暂无记录</div></div>
</div>

<div class="toast" id="toast"></div>

<script>
let isRunning = false, pollTimer = null;
const $ = (id) => document.getElementById(id);

async function handleGenerate() {
  if (isRunning) return;
  isRunning = true; setUIState("running");
  try {
    const resp = await fetch("/api/regenerate", { method: "POST" });
    const data = await resp.json();
    if (!data.success) throw new Error(data.error || "触发失败");
    startPolling(data.execute_id);
  } catch (err) { showToast("❌ " + err.message); setUIState("idle"); }
}

function startPolling(executeId) {
  let attempts = 0;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    attempts++;
    try {
      const resp = await fetch("/api/status?execute_id=" + executeId);
      const data = await resp.json();
      if (data.status === "Success" || data.status === "success") {
        clearInterval(pollTimer); pollTimer = null;
        showResult(parseImages(data));
        saveToHistory(parseImages(data));
        setUIState("done"); showToast("✅ 生成完成！");
        return;
      }
      if (data.status === "Failed" || data.status === "failed") {
        throw new Error(data.error || "工作流执行失败");
      }
      $("loadingArea").querySelector("p").textContent = "⏳ 正在生成中，已等待 " + (attempts * 2) + " 秒...";
    } catch (err) { clearInterval(pollTimer); pollTimer = null; showToast("❌ " + err.message); setUIState("idle"); }
    if (attempts >= 90) { clearInterval(pollTimer); pollTimer = null; showToast("⏰ 超时，请检查 Coze"); setUIState("idle"); }
  }, 2000);
}

function parseImages(data) {
  let output = data.output || data.data?.output || {};
  if (typeof output === "string") { try { output = JSON.parse(output); } catch(e) {} }
  const images = [];
  for (let i = 1; i <= 4; i++) {
    const url = output?.["output" + i] || output?.["Output" + i] || "";
    if (url) images.push(url);
  }
  return images;
}

function showResult(images) {
  $("resultCard").classList.add("show");
  const c = $("resultImages");
  if (images && images.length > 0) {
    c.innerHTML = images.map(u => '<img src="' + escapeHtml(u) + '" alt="条漫" style="width:100%;display:block;" />').join("");
  } else {
    c.innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px;">暂无图片</p>';
  }
  $("resultTime").textContent = new Date().toLocaleString("zh-CN");
}

function saveToHistory(images) {
  const h = getHistory();
  h.unshift({ images: images || [], time: new Date().toLocaleString("zh-CN") });
  localStorage.setItem("comic_history", JSON.stringify(h.slice(0, 20)));
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem("comic_history") || "[]"); } catch { return []; }
}

function renderHistory() {
  const history = getHistory();
  const container = $("historyList");
  if (history.length === 0) { container.innerHTML = '<div class="history-empty">暂无记录</div>'; return; }
  container.innerHTML = history.map((item, i) => {
    const thumb = (item.images && item.images.length > 0) ? item.images[0] : "";
    const count = (item.images && item.images.length > 0) ? item.images.length + "张图" : "无图";
    return '<div class="history-item" onclick="showHistoryItem(' + i + ')">' +
      (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="条漫" onerror="this.style.display=\\'none\\'" />' : '<div style="width:60px;height:60px;border-radius:8px;background:#2a2a2a;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">🖼</div>') +
      '<div class="info"><div class="time">' + escapeHtml(item.time) + '</div><div class="preview">' + escapeHtml(count) + '</div></div></div>';
  }).join("");
}

function showHistoryItem(index) {
  const item = getHistory()[index];
  if (item) { showResult(item.images); $("resultTime").textContent = item.time; window.scrollTo({ top: $("resultCard").offsetTop - 20, behavior: "smooth" }); }
}

function loadLastResult() { const h = getHistory(); if (h.length > 0) showHistoryItem(0); else showToast("暂无历史记录"); }

function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }

function setUIState(state) {
  const badge = $("statusBadge"), btn = $("btnGenerate"), loading = $("loadingArea"), btnR = $("btnRefresh");
  switch (state) {
    case "idle": isRunning = false; badge.textContent = "⏸ 空闲"; badge.className = "status-badge badge-idle"; btn.disabled = false; btn.textContent = "🔄 重新生成条漫"; loading.style.display = "none"; break;
    case "running": badge.textContent = "⚡ 生成中"; badge.className = "status-badge badge-running pulse"; btn.disabled = true; btn.textContent = "⏳ 生成中..."; loading.style.display = "block"; $("resultCard").classList.remove("show"); break;
    case "done": isRunning = false; badge.textContent = "✅ 就绪"; badge.className = "status-badge badge-done"; btn.disabled = false; btn.textContent = "🔄 不满意？重新生成"; loading.style.display = "none"; btnR.style.display = "block"; break;
  }
}

function showToast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._timeout); t._timeout = setTimeout(() => t.classList.remove("show"), 2500); }

renderHistory();
</script>
</body>
</html>`;

// ── 路由 ──
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 首页
    if (path === "/" || path === "") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // API: 触发生成
    if (path === "/api/regenerate" && request.method === "POST") {
      try {
        if (!env.COZE_API_TOKEN || !env.COZE_WORKFLOW_ID) {
          return Response.json({ success: false, error: "未配置环境变量" }, { status: 500 });
        }
        const executeId = await triggerWorkflow(env.COZE_API_TOKEN, env.COZE_WORKFLOW_ID);
        return Response.json({ success: true, execute_id: executeId });
      } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // API: 查询状态
    if (path === "/api/status" && request.method === "GET") {
      const executeId = url.searchParams.get("execute_id");
      if (!executeId) {
        return Response.json({ error: "缺少 execute_id" }, { status: 400 });
      }
      try {
        const data = await getStatus(env.COZE_API_TOKEN, env.COZE_WORKFLOW_ID, executeId);
        if (data.code !== 0) {
          return Response.json({ status: "Failed", error: data.msg });
        }
        const h = data.data;
        return Response.json({
          status: h?.execute_status || "unknown",
          output: h?.output || null,
          error: h?.error_message || null,
        });
      } catch (err) {
        return Response.json({ status: "Failed", error: err.message }, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};

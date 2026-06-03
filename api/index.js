const express = require("express");

const app = express();
app.use(express.json());

// ============================================================
// 环境变量（部署到 Vercel 后在后台设置）
// ============================================================
const COZE_TOKEN = process.env.COZE_API_TOKEN;
const COZE_WORKFLOW_ID = process.env.COZE_WORKFLOW_ID;
const COZE_API = "https://api.coze.cn/v1";

// ============================================================
// 工具函数：调用 Coze API
// ============================================================

/** 异步触发 Coze 工作流，返回 execute_id */
async function triggerCozeWorkflow() {
  const resp = await fetch(`${COZE_API}/workflow/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COZE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: COZE_WORKFLOW_ID,
      parameters: {
        ref_image: "https://raw.githubusercontent.com/SMOYI-cell/aaa/main/images/ref_image.png"
      },
      is_async: true,         // 异步模式，立即返回
    }),
  });

  const json = await resp.json();

  if (json.code !== 0) {
    throw new Error(json.msg || "Coze API 调用失败");
  }

  return json.data.execute_id;
}

/** 查询工作流执行状态和结果 */
async function getCozeRunStatus(executeId) {
  const url = `${COZE_API}/workflows/${COZE_WORKFLOW_ID}/run_histories/${executeId}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${COZE_TOKEN}` },
  });
  return resp.json();
}

/** 从工作流输出中提取 4 张条漫图片 */
function parseWorkflowOutput(responseData) {
  // data 可能是数组 [{output: "..."}] 或对象 {output: "..."}
  let rawData = responseData.data;
  if (Array.isArray(rawData)) rawData = rawData[0];
  if (!rawData) return { images: [] };

  let output = rawData.output;
  if (typeof output === "string") {
    try { output = JSON.parse(output); } catch { /* keep as-is */ }
  }

  // output 里可能有 Output(大写O) 字段，里面才是真正的 output1~4
  let inner = output;
  if (output && output.Output) {
    if (typeof output.Output === "string") {
      try { inner = JSON.parse(output.Output); } catch { inner = output; }
    } else {
      inner = output.Output;
    }
  }

  const images = [];
  for (let i = 1; i <= 4; i++) {
    const url = inner?.[`output${i}`] || inner?.[`Output${i}`] || "";
    if (url) images.push(url);
  }

  return { images };
}

// ============================================================
// 页面：移动端首页
// ============================================================
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="条漫生成">
<link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎨</text></svg>">
<title>条漫生成器</title>
<style>
  :root {
    --bg: #0f0f0f;
    --card: #1a1a1a;
    --accent: #ff6b35;
    --accent2: #f7c948;
    --text: #e8e8e8;
    --text2: #999;
    --green: #4ade80;
    --red: #f87171;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 16px 40px;
    -webkit-tap-highlight-color: transparent;
  }

  /* ---- 头部 ---- */
  .header {
    text-align: center;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  .header .icon { font-size: 56px; margin-bottom: 8px; }
  .header h1 {
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header p { color: var(--text2); font-size: 13px; margin-top: 4px; }

  /* ---- 状态卡片 ---- */
  .status-card {
    width: 100%;
    max-width: 420px;
    background: var(--card);
    border-radius: 16px;
    padding: 20px;
    margin: 16px 0;
    border: 1px solid #2a2a2a;
  }
  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .status-label { font-size: 14px; color: var(--text2); }
  .status-badge {
    font-size: 12px;
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
  }
  .badge-idle    { background: #2a2a2a; color: #888; }
  .badge-running { background: rgba(247,201,72,.15); color: var(--accent2); }
  .badge-done    { background: rgba(74,222,128,.15); color: var(--green); }
  .badge-failed  { background: rgba(248,113,113,.15); color: var(--red); }

  /* ---- 主按钮 ---- */
  .btn {
    width: 100%;
    max-width: 420px;
    height: 56px;
    border: none;
    border-radius: 16px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all .2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 8px 0;
  }
  .btn:active { transform: scale(0.96); }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent), #e55a2b);
    color: #fff;
    box-shadow: 0 4px 24px rgba(255,107,53,.35);
  }
  .btn-primary:disabled {
    opacity: .5;
    transform: none;
    box-shadow: none;
  }
  .btn-secondary {
    background: var(--card);
    color: var(--text2);
    border: 1px solid #2a2a2a;
    height: 44px;
    font-size: 14px;
    font-weight: 500;
  }

  /* ---- 结果卡片 ---- */
  .result-card {
    width: 100%;
    max-width: 420px;
    background: var(--card);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid #2a2a2a;
    margin-top: 12px;
    display: none;
  }
  .result-card.show { display: block; }

  .result-card img {
    width: 100%;
    display: block;
    border-bottom: 1px solid #2a2a2a;
  }
  .result-body { padding: 16px; }
  .result-caption {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text);
    white-space: pre-wrap;
  }
  .result-meta {
    font-size: 12px;
    color: var(--text2);
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* ---- 历史记录 ---- */
  .history {
    width: 100%;
    max-width: 420px;
    margin-top: 24px;
  }
  .history h3 {
    font-size: 14px;
    color: var(--text2);
    font-weight: 500;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .history-item {
    background: var(--card);
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 8px;
    cursor: pointer;
    border: 1px solid #2a2a2a;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all .15s;
  }
  .history-item:active { background: #222; }
  .history-item img {
    width: 60px;
    height: 60px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .history-item .info { flex: 1; min-width: 0; }
  .history-item .time  { font-size: 11px; color: var(--text2); }
  .history-item .preview {
    font-size: 13px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }
  .history-empty { color: var(--text2); font-size: 13px; text-align: center; padding: 20px; }

  /* ---- 脉冲动画（运行中） ---- */
  @keyframes pulse {
    0%,100% { opacity: 1; }
    50%     { opacity: .5; }
  }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }

  /* ---- Toast ---- */
  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 14px;
    z-index: 999;
    opacity: 0;
    transition: opacity .3s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<!-- 头部 -->
<div class="header">
  <div class="icon">🎨</div>
  <h1>条漫生成器</h1>
  <p>不满意？一键重新生成</p>
</div>

<!-- 状态 -->
<div class="status-card">
  <div class="status-row">
    <span class="status-label">当前状态</span>
    <span class="status-badge badge-idle" id="statusBadge">⏸ 空闲</span>
  </div>
</div>

<!-- 主按钮 -->
<button class="btn btn-primary" id="btnGenerate" onclick="handleGenerate()">
  🔄 重新生成条漫
</button>
<button class="btn btn-secondary" id="btnRefresh" onclick="loadLastResult()" style="display:none;">
  🔍 查看最近结果
</button>

<!-- 加载中 -->
<div id="loadingArea" style="display:none; text-align:center; margin:20px 0; color:var(--text2);">
  <p class="pulse" style="font-size:14px;">⏳ 正在生成中，大约需要 30-60 秒...</p>
  <p style="font-size:12px; color:var(--text2); margin-top:4px;">生成完毕后也会推送到你微信</p>
</div>

<!-- 结果：竖排 4 格条漫 -->
<div class="result-card" id="resultCard">
  <div id="resultImages"></div>
  <div class="result-body">
    <div class="result-meta">
      <span>✅ 生成完成</span>
      <span id="resultTime"></span>
    </div>
  </div>
</div>

<!-- 历史记录 -->
<div class="history">
  <h3>📋 历史记录</h3>
  <div id="historyList"><div class="history-empty">暂无记录</div></div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
// ============================================================
// 全局状态
// ============================================================
let isRunning = false;
let pollTimer = null;

const $ = (id) => document.getElementById(id);

// ============================================================
// 点击「重新生成」
// ============================================================
async function handleGenerate() {
  if (isRunning) return;

  isRunning = true;
  setUIState("running");

  try {
    const resp = await fetch("/api/regenerate", { method: "POST" });
    const data = await resp.json();

    if (!data.success) {
      throw new Error(data.error || "触发失败");
    }

    // 开始轮询
    startPolling(data.execute_id);
  } catch (err) {
    showToast("❌ " + err.message);
    setUIState("idle");
  }
}

// ============================================================
// 轮询结果
// ============================================================
function startPolling(executeId) {
  let attempts = 0;
  const maxAttempts = 90; // 最多轮询 3 分钟 (90 × 2s)

  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    attempts++;

    try {
      const resp = await fetch("/api/status?execute_id=" + executeId);
      const data = await resp.json();

      if (data.status === "Success" || data.status === "success") {
        clearInterval(pollTimer);
        pollTimer = null;

        const { images } = parseOutput(data);
        showResult(images);
        saveToHistory(images);
        setUIState("done");
        showToast("✅ 生成完成！");
        return;
      }

      if (data.status === "Failed" || data.status === "failed") {
        throw new Error(data.error || data.msg || "工作流执行失败");
      }

      // 更新轮询计数
      $("loadingArea").querySelector("p").textContent =
        "⏳ 正在生成中，已等待 " + (attempts * 2) + " 秒...";

    } catch (err) {
      clearInterval(pollTimer);
      pollTimer = null;
      showToast("❌ " + err.message);
      setUIState("idle");
    }

    if (attempts >= maxAttempts) {
      clearInterval(pollTimer);
      pollTimer = null;
      showToast("⏰ 生成超时，请检查 Coze 工作流是否正常");
      setUIState("idle");
    }
  }, 2000); // 每 2 秒查一次
}

// ============================================================
// 解析工作流输出（output1~4 都是图片 URL）
// ============================================================
function parseOutput(data) {
  // 服务端 /api/status 已预解析 images，直接用
  if (data.images && data.images.length > 0) {
    return { images: data.images };
  }
  return { images: [] };
}

// ============================================================
// 显示结果
// ============================================================
function showResult(images) {
  const card = $("resultCard");
  card.classList.add("show");

  const container = $("resultImages");
  if (images && images.length > 0) {
    container.innerHTML = images.map(url =>
      '<img src="' + escapeHtml(url) + '" alt="条漫" style="width:100%;display:block;" />'
    ).join("");
  } else {
    container.innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px;">暂无图片</p>';
  }

  $("resultTime").textContent = new Date().toLocaleString("zh-CN");
}

// ============================================================
// 本地历史记录
// ============================================================
function saveToHistory(images) {
  const history = getHistory();
  history.unshift({
    images: images || [],
    time: new Date().toLocaleString("zh-CN"),
  });

  // 最多保留 20 条
  const trimmed = history.slice(0, 20);
  localStorage.setItem("comic_history", JSON.stringify(trimmed));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("comic_history") || "[]");
  } catch { return []; }
}

function renderHistory() {
  const history = getHistory();
  const container = $("historyList");

  if (history.length === 0) {
    container.innerHTML = '<div class="history-empty">暂无记录</div>';
    return;
  }

  container.innerHTML = history.map((item, i) => {
    const thumbUrl = (item.images && item.images.length > 0) ? item.images[0] : "";
    const imgCount = (item.images && item.images.length > 0) ? item.images.length + "张图" : "无图";
    return '<div class="history-item" onclick="showHistoryItem(' + i + ')">' +
      (thumbUrl
        ? '<img src="' + escapeHtml(thumbUrl) + '" alt="条漫" onerror="this.style.display=\\'none\\'" />'
        : '<div style="width:60px;height:60px;border-radius:8px;background:#2a2a2a;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">🖼</div>') +
      '<div class="info">' +
        '<div class="time">' + escapeHtml(item.time) + '</div>' +
        '<div class="preview">' + escapeHtml(imgCount) + '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}

function showHistoryItem(index) {
  const history = getHistory();
  const item = history[index];
  if (item) {
    showResult(item.images);
    $("resultTime").textContent = item.time;
    window.scrollTo({ top: $("resultCard").offsetTop - 20, behavior: "smooth" });
  }
}

function loadLastResult() {
  const history = getHistory();
  if (history.length > 0) {
    showHistoryItem(0);
  } else {
    showToast("暂无历史记录");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// UI 状态切换
// ============================================================
function setUIState(state) {
  const badge = $("statusBadge");
  const btn = $("btnGenerate");
  const loading = $("loadingArea");
  const btnRefresh = $("btnRefresh");

  switch (state) {
    case "idle":
      isRunning = false;
      badge.textContent = "⏸ 空闲";
      badge.className = "status-badge badge-idle";
      btn.disabled = false;
      btn.textContent = "🔄 重新生成条漫";
      loading.style.display = "none";
      break;

    case "running":
      badge.textContent = "⚡ 生成中";
      badge.className = "status-badge badge-running pulse";
      btn.disabled = true;
      btn.textContent = "⏳ 生成中...";
      loading.style.display = "block";
      $("resultCard").classList.remove("show");
      break;

    case "done":
      isRunning = false;
      badge.textContent = "✅ 就绪";
      badge.className = "status-badge badge-done";
      btn.disabled = false;
      btn.textContent = "🔄 不满意？重新生成";
      loading.style.display = "none";
      btnRefresh.style.display = "block";
      break;
  }
}

// ============================================================
// Toast 提示
// ============================================================
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove("show"), 2500);
}

// ============================================================
// 初始化
// ============================================================
renderHistory();

// 如果是微信点过来的（?auto=1），自动触发重新生成
if (window.location.search.includes('auto=1')) {
  setTimeout(() => handleGenerate(), 500);
}
</script>
</body>
</html>`);
});

// ============================================================
// API：触发重新生成
// ============================================================
app.post("/api/regenerate", async (_req, res) => {
  try {
    if (!COZE_TOKEN || !COZE_WORKFLOW_ID) {
      return res.status(500).json({
        success: false,
        error: "服务未配置，请设置 COZE_API_TOKEN 和 COZE_WORKFLOW_ID 环境变量",
      });
    }

    const executeId = await triggerCozeWorkflow();
    console.log("Workflow triggered:", executeId);

    res.json({ success: true, execute_id: executeId });
  } catch (err) {
    console.error("Trigger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// API：查询执行状态
// ============================================================
app.get("/api/status", async (req, res) => {
  const executeId = req.query.execute_id;
  if (!executeId) {
    return res.status(400).json({ error: "缺少 execute_id 参数" });
  }

  try {
    const data = await getCozeRunStatus(executeId);

    if (data.code !== 0) {
      return res.json({ status: "Failed", error: data.msg || "查询失败" });
    }

    // data 可能是数组 [{...}] 或对象 {...}
    let history = data.data;
    if (Array.isArray(history)) history = history[0];
    if (!history) return res.json({ status: "Failed", error: "无数据" });

    const status = history.execute_status || "unknown";

    // 解析嵌套的 output
    let images = [];
    if (status === "Success" && history.output) {
      images = parseWorkflowOutput(data).images;
    }

    res.json({
      status: status,
      output: history.output || null,
      images: images,
      error: history.error_message || null,
    });
  } catch (err) {
    console.error("Status error:", err);
    res.status(500).json({ status: "Failed", error: err.message });
  }
});

// ============================================================
// 导出给 Vercel
// ============================================================
module.exports = app;

// ============================================================
// 本地开发直接启动
// ============================================================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log("🎨 条漫生成器已启动 → http://localhost:" + PORT);
  });
}

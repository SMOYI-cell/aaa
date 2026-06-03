# 🎨 条漫自动生成 + 手机一键重生成

配合你已有的 **Coze 条漫工作流**，实现：

- ⏰ **每天 9:00** GitHub Actions 自动触发 → 推送到微信（Server酱）
- 📱 **不满意？** 手机打开网页点一下按钮 → 重新生成 → 推送到微信
- 💰 **零成本**：Coze 免费 + Vercel 免费 + Server酱 免费

---

## 整体架构

```
         ┌───────────────────────────┐
         │    GitHub Actions          │
         │    每天 9:00 (UTC+8)      │
         │    调用 Coze API           │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────────────────┐
         │           Coze（扣子）                  │
         │                                        │
         │  ┌──────────────┐                     │
         │  │ 条漫生成工作流 │  ← 你已有的工作流    │
         │  │  output1~4   │                     │
         │  └──────┬───────┘                     │
         │         │                              │
         │  ┌──────▼───────┐                     │
         │  │  HTTP 请求节点 │                     │
         │  │ → Server酱 API │                    │
         │  └──────┬───────┘                     │
         │         │                              │
         └─────────┼──────────────────────────────┘
                   │
          ┌────────▼─────────────────┐
          │   comic-auto-trigger     │
          │   部署在 Vercel           │
          │                          │
          │  📱 手机网页              │
          │  ┌──────────────────┐    │
          │  │  🔄 重新生成条漫  │    │
          │  │  [点一下就行]    │    │
          │  │                  │    │
          │  │  最近结果...     │    │
          │  │  [4格图片]       │    │
          │  └──────────────────┘    │
          └────────┬─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   Server酱       │
          │   你的微信        │
          │   📱 收到推送     │
          │   [4张竖排]      │
          └─────────────────┘
```

---

## 你需要准备的（5分钟搞定）

| 序号 | 准备事项 | 去哪里弄 | 耗时 |
|------|----------|---------|------|
| ① | **Server酱 SendKey** | [sct.ftqq.com](https://sct.ftqq.com) 微信扫码登录→「发送消息」页面复制 | 1分钟 |
| ② | **Coze API Token** | [coze.cn/open/oauth/pats](https://www.coze.cn/open/oauth/pats) → 新建令牌 → 复制 `pat_xxx` | 1分钟 |
| ③ | **Coze 工作流 ID** | 打开你的条漫工作流 → 浏览器地址栏 `workflow/` 后面的那串数字 | 30秒 |
| ④ | **GitHub 账号** | [github.com](https://github.com) 注册（已有就跳过） | 2分钟 |
| ⑤ | **Vercel 账号** | [vercel.com](https://vercel.com) 用 GitHub 登录 | 30秒 |

---

## 第一步：配置 Coze 工作流（核心）

> ⚠️ Coze 官方没有定时触发器组件，定时功能由 GitHub Actions 代劳（免费、稳定）。

### 1.1 添加 Server酱 推送节点

在工作流**末尾**添加一个 **HTTP 请求** 节点：

| 参数 | 值 |
|------|-----|
| **请求方法** | `POST` |
| **URL** | `https://sctapi.ftqq.com/你的SendKey.send` |
| **Content-Type** | `application/json` |

**Body（JSON）**：

```json
{
  "title": "📱 今日条漫已生成",
  "desp": "## 🎨 今日条漫\n\n![第1格]({{output1的变量}})\n![第2格]({{output2的变量}})\n![第3格]({{output3的变量}})\n![第4格]({{output4的变量}})\n\n> 🕐 生成时间：{{当前时间}}\n\n✅ 满意 → 去小红书发帖\n🔄 不满意 → 打开手机网页点「重新生成」"
}
```

> ⚠️ **关键**：`{{output1的变量}}` 到 `{{output4的变量}}` 要替换成你工作流里 4 个输出的实际变量名。在 Coze 编辑器里从变量面板直接拖入，格式类似 `{{结束节点.output1}}`。

### 1.2 发布工作流

编辑完以上后，点右上角「**发布**」。

---

## 第二步：设置 GitHub Actions 定时触发（代替 Coze 定时器）

GitHub Actions 会在每天 9:00 自动调用 Coze API 触发你的工作流。

> 代码已经写好了，在 `.github/workflows/daily-cron.yml`，你只需要配置密钥：

1. 打开你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点「**New repository secret**」，添加两个密钥：

| Name | Secret（你的值） |
|------|-------------------|
| `COZE_API_TOKEN` | `pat_nFstJegZQPzvYmzKxvVXkzFCPR1OtEsnPjcFuSixu0DpifxtGD352deOcSMlBB4q` |
| `COZE_WORKFLOW_ID` | `7592162373667389483` |

3. 点「**Actions**」标签 → 点「**每日9点触发生成条漫**」→ 点「**Run workflow**」手动测试一次

---

## 第三步：部署手机控制页面（Vercel）

### 3.1 上传代码到 GitHub

#### 方法A：在 GitHub 网页操作（推荐，最简单）

1. 打开 [github.com/new](https://github.com/new)
2. Repository name 填 `comic-auto-trigger`
3. 选 **Private**（私有）
4. 点「Create repository」
5. 点「uploading an existing file」
6. 把本项目的所有文件拖进去：
   - `api/index.js`
   - `package.json`
   - `vercel.json`
7. 点「Commit changes」

#### 方法B：用命令行（如果你会用 git）

```bash
cd C:/Users/lenovo/comic-auto-trigger
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/comic-auto-trigger.git
git push -u origin main
```

### 3.2 部署到 Vercel

1. 打开 [vercel.com/new](https://vercel.com/new)
2. 用 GitHub 账号登录
3. 导入你刚创建的 `comic-auto-trigger` 仓库
4. **关键步骤**：展开「**Environment Variables**」，添加两个变量：

   | 变量名 | 值 |
   |--------|-----|
   | `COZE_API_TOKEN` | `pat_xxxxxxxx`（第一步准备的） |
   | `COZE_WORKFLOW_ID` | `742000xxxx`（第一步准备的） |

5. 点「**Deploy**」
6. 等待 1 分钟部署完成
7. 你会得到一个网址，类似 `https://comic-auto-trigger-xxx.vercel.app`

### 3.3 添加到手机桌面

| 系统 | 操作 |
|------|------|
| **iPhone** | Safari 打开网址 → 底部「分享」→「添加到主屏幕」→ 命名「条漫生成」 |
| **Android** | Chrome 打开网址 → 右上角 ⋮ →「添加到主屏幕」 |

---

## 第四步：测试

### 4.1 测试手动重新生成

1. 手机打开你的 Vercel 网址
2. 点「🔄 重新生成条漫」
3. 等待 30-60 秒
4. 页面显示图片 + 文案
5. 微信也收到 Server酱 推送

### 4.2 测试定时自动生成

1. 打开 GitHub 仓库 → **Actions** → 点「**每日9点触发生成条漫**」
2. 点「**Run workflow**」→ 绿色按钮手动执行
3. 等 1 分钟左右，确认微信收到 Server酱 推送
4. 如果正常，每天 9:00 GitHub Actions 会自动执行

---

## 日常使用

| 场景 | 操作 |
|------|------|
| **每天 9:00** | 微信收到推送 → 满意就去小红书发帖 |
| **不满意** | 手机桌面点「条漫生成」App → 点「🔄 重新生成」→ 等新结果 |
| **还想再换** | 再点一次「🔄 重新生成」 |
| **查看之前的结果** | 页面下滑 → 历史记录 |

---

## 常见问题

### Q: Vercel 国内访问慢怎么办？
两个选择：
- **Cloudflare Workers**（国内访问更快）：我可以帮你改写
- **阿里云函数计算 FC**：免费额度，国内秒开，但部署稍复杂

### Q: Server酱 免费版一天能发几条？
免费版每天 **5 条**，对你的场景（每天 1 条 + 偶尔重生成）绰绰有余。

### Q: 生成一张图要多久？
取决于你的 Coze 工作流（生图模型的 API 速度），通常 20-60 秒。页面会自动轮询等待。

### Q: Coze 工作流改了输出变量名怎么办？
去 Vercel 项目后台 → Settings → Environment Variables → 更新配置 → Redeploy。

### Q: 安全吗？
- 你的 Coze Token 存在 Vercel 环境变量里，只有你能看到
- 网页是纯静态的，不经过第三方服务器
- 建议用 HTTPS（Vercel 默认开启）

---

## 进阶：如果你以后想完全自动化发小红书

目前小红书没有对个人开放的官方 API。但如果你以后：
- 认证了**企业号** → 可以申请开放平台 API → 我来改代码加上自动发帖
- 或者找到靠谱的**第三方代发平台** → 在 Server酱 推送节点后面再加一个 HTTP 节点即可

# A1–B2 西语备考工作台 · DELE & SIELE

纯静态单页应用（无需构建、无框架依赖），覆盖 DELE A1–B2 与 SIELE 备考全流程。

**线上地址**：<https://celina0503qq-lab.github.io/siele-workbench/>（当前版本 v38，2026-09-27）

## 功能模块

- 🏠 **仪表盘**：今日待办、每日签到、考试结构速览、能力雷达、快捷操作
- 🃏 **单词卡片**：4866 词，拉丁美洲口音 es-MX 发音、每 10 词默写测试、记忆花园
- 📚 **词汇库 / 📐 语法库**：词汇检索与 111 条语法点（RAE / FundéuRAE / DELE Ahora）
- 🎤 **跟读训练**：Web Speech API 五维度评分
- 🎯 **SIELE 专项**：口语 316 题逐题练习
- ✏️ **题库测验**：QDATA 四级各 1500 题，顺序/随机模式、搜索跳题、背题模式（管理员授权）
- ✍️ **写作 / 🗣 口语**：写作助手与口语话题练习
- 📅 **学习计划 / 🚨 错题集**：每日计划、错题自动归集（删除为墓碑机制，跨设备同步）
- 📰 **外刊阅读 / 📚 外刊精炼**：BBC Mundo / El País RSS + 阅读理解
- 📝 **DELE 专项**：A1–B2 四级（通用 + Nuevo 各 4 册），阅读/听力/写作/口语/全真模拟

## 技术架构

| 层 | 说明 |
|---|---|
| 前端 | `index.html` 单文件 SPA（~1.8MB）+ 数据外链 JS（`data/`、`dele_banks/` 等） |
| 后端 | 腾讯云 CloudBase 云函数 `siele-auth`（env `siele-prod-d2g15w3ug65796f47`）：登录鉴权、学习快照云同步、用户管理、功能授权（24 个 action） |
| 后台 | `admin.html` 管理端：用户管理、功能授权开关（背题/DELE专项/外刊精炼）、题库编辑 |
| 离线 | Service Worker `sw2.js` 缓存（版本与页内 `swVer` 成对顶版驱动全设备更新） |
| 存储 | 本地 localStorage（`dele_siele_wb_v3`）+ 云端 `learning_snapshots` 双轨 |

**云同步语义**：登录后按用户隔离数据；词卡/做题进度采用「进度靠前者赢」的前向游标仲裁（v31），错题删除走墓碑机制；同步状态看右下角芯片（已同步/仅本地/未登录）。

## 本地开发注意

- **改 `index.html` 前先取线上版作基线**（GitHub Contents API / git blobs；`raw.githubusercontent.com` 有 CDN 缓存不可作基线）。
- 推送一律走 **API + sha 保护**，推送前必跑 `node deploy-guard.js`（本地 git 落后远程，**不要本地 git push**）。
- 编辑时建议无痕窗口：西语助手等浏览器扩展会把注入 DOM 写进保存的文件（v38 已清理历史注入并上线 guard 检测）。

## 数据规模

词汇 4866 · 语法 111 · SIELE 口语 316 · DELE 专项四级（通用 + Nuevo 各 4 册）· QDATA 题库四级各 1500 题。

## 许可 / License

本项目代码与数据采用自定义许可：**允许学习与个人使用，禁止任何商业用途**。详见 [LICENSE](LICENSE)。

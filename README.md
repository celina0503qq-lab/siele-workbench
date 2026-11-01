<div align="center">

# Ñ

**A1–B2 西语备考工作台 — DELE & SIELE 全流程备考平台**

一个无框架、无构建步骤的单页应用，覆盖 4,815 词词汇记忆、6,000 题分级题库、
SIELE 口语五 Tarea 官方流程模拟、写作训练与每周自动更新的西语外刊精读，
内置账号体系与基于快照仲裁的跨设备同步。

[![Version](https://img.shields.io/badge/version-v97.12-blue)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Backend](https://img.shields.io/badge/sync-CloudBase_CloudFunctions-orange)](#同步架构)
[![Offline](https://img.shields.io/badge/offline-first-9cf)](#离线策略)

<https://celina0503qq-lab.github.io/siele-workbench/>

</div>

---

## 为什么是单文件应用

这个项目刻意停留在「浏览器原生」的边界内：没有框架、没有打包器、没有 node_modules。
全部逻辑由若干按模块拆分的原生 ES 脚本组成，`index.html` 之外都是数据文件。
这个决定的代价是手动管理依赖，收益是：

- **零构建链**——克隆即部署，不存在「本地能跑线上挂了」的构建漂移；
- **可审计**——每一行送达用户浏览器的代码都能在仓库里直接读到；
- **长寿命**——不依赖任何会停止维护的前端框架，五年后仍可打开。

功能密度因此变得很高：学习进度、错题救赎、断点续背、默写、番茄钟、成长树，
全部建立在同一个持久化状态对象上，由一条同步管道统一管理。

## 内容规模

| | 规模 | 备注 |
|---|---:|---|
| 词汇 | 4,815 | A1–B2 分级，主题类目，拉丁美洲口音预生成音频 |
| 题库 | 6,000 | A1/A2/B1/B2 × 1,500，语法与词汇双题型 |
| 口语 | 316 | SIELE Tarea 1–5 官方流程对齐，逐问预生成音频 |
| 语法 | 111 | 语法点 + 专项测验 |
| 外刊 | 周刊 | RSS 聚合 → 精读题 → 词汇卡 → 逐段跟读，自动化流水线出刊 |

## 同步架构

学习数据以**账号级快照**存于云端，客户端与服务器之间只传输增量：

```
            ┌──────────────────────────┐
            │   CloudBase Cloud Functions
            │   auth · revision 仲裁 · 受控数据集下发
            └────────────┬─────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
 learning_snapshots  content_edits       sync_tokens
 学习快照(按账号)      内容编辑(全站生效)    同步凭证(可撤销)
```

**写入路径有两条**，这是设计而非疏漏：

- 学员在主站学习，进度写入 `ST.vocabMastery`，经登录会话自动同步；
- 管理员在后台编辑，写入 `ADB.words.mastery`，经 `sync_tokens` 凭证同步。

仪表盘与看板的统计因此采用**双源合并**：同一词取两端较高的掌握度，
保证管理员代改与学员自学的记录互不覆盖。

**冲突仲裁**：每次推送携带 `revision`；服务端检测到过期版本时返回
`REVISION_CONFLICT` 与最新快照，客户端执行字段级合并后重试。
合并语义按字段类型分级——计数取较大值、集合取并集、
时间戳字段取最新——并以 `resetEpoch` 纪元机制防止「重置后被旧设备复活」。

**断网**：Service Worker 预缓存全部资源，同步失败时数据留在本地，
恢复后自动补推；同步健康状态（最近成功时间、连续失败次数）在界面实时可见。

## 离线策略

- Service Worker 对全部资源做安装期预缓存，断网后完整可用；
- 缓存版本与 `swVer` 绑定，发版即驱动所有客户端增量更新；
- 音频资产（TTS 预生成）走 CDN 直链，不占缓存配额。

## 管理端

独立管理页面提供：用户与功能授权管理、词库/题库内容编辑
（编辑经 `content_edits` 云端下发，全站即时生效）、
数据看板（与主站仪表盘**同口径**的可视化，含各等级进度与掌握度分布）、
设备迁移传输码签发与撤销。

## 本地运行

```bash
git clone https://github.com/celina0503qq-lab/siele-workbench.git
cd siele-workbench
python -m http.server 8080     # 或 npx serve .
```

完整的云同步与管理端需要自备 CloudBase 环境并配置账号体系。

## 版本

变更记录见 [CHANGELOG](CHANGELOG.md) —— 自 v92.1 起逐版编号，由推送护栏强制校验
（版本唯一性、严格降序、段头格式、与发布版本号一致性）。

## License

[MIT](LICENSE)

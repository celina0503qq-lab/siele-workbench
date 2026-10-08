# 更新日志 / CHANGELOG

格式参考 [Keep a Changelog](https://keepachangelog.com/)；日期为 2026 年。所有版本号以页脚与 `swVer`（Service Worker 缓存版本）为准。


## [v93.1] – 2026-10-08

### 跨设备删除同步彻底修复（手机删除 ⇄ 电脑残留 / 电脑删除 ⇄ 手机残留）

用户两轮真机实测暴露（lili 账号：手机 Edge 删 T1 记录电脑仍见；电脑删 T4 六条手机仍八条）。定位出 **v93.0 的三个缺陷**，本次全部修复：

1. **删除凭据永不上云**：`wbSnap()` 推送 payload 漏带 `sieleOralScoresDel`（按条删除表）⇒ 对端永远收不到删除凭据。修复：推送侧随 `sieleOralScoresTomb` 一并上行
2. **本端残留从不清理**：`_sieleMergeScoreTomb` 只用凭据挡"远端并回"，本端已删记录不主动清。修复：新增 `_sieleApplyTombLocally()`——整题级时间下限（墓碑/水线）+ 题内逐条过滤（Del 命中 / 无 ts 老记录 / ts≤下限）+ 聚合重算（bestScore/count/lastDate/last 八字段）
3. **整题直入绕过过滤**（e2e 挖出）：`mergeSieleOralScore` 的 `!local` 分支直接 `ST[id]=remoteEntry`，完全绕过 Del/墓碑过滤。修复：入库前逐条过滤并重算聚合

**水线 30 分钟新鲜度门（v93.1b）**：`_sieleWipeFresh()`——仅 30 分钟内的 `sieleOralScoresWipeAt` 参与本地清理，防历史污染水线误清真实做题记录；整题墓碑与按条删除表**不受门控**（删除修复主路径）。

**验证**：
- 单测 7+12 场景全 PASS（门控/墓碑/Del/聚合各维度）
- Playwright 双设备 e2e（本地 server + 真实云函数链路）：设备 A 注入 5 题 → 设备 B 逐题删除 → 设备 A2 拉取后老条全消失、新条保留 ✅（T1–T5 全覆盖）
- 线上字节级比对：index 1,366,766 B / blob 38fc5372ee67，12 项功能标记全 OK

**上线后自愈说明**：两端各刷新一次即可——电脑端 v93.1 首次自动同步会把本地留存的删除凭据推上云，手机拉取后自动清理，无需重新删除。

## [v93.0] – 2026-10-06

### P5 移动端响应式（SIELE 口语页 390px 横向溢出修复）

- **问题**（lili 真机实测发现）：viewport 390px 时文档实际 **634px**，横向滚动、Tarea 标签被截断
- **根因**：`.so-tabs` 5 个 tab 各 `min-width:118px` 不可收缩（min-content ≈578）→ 作为 `#main` 内容把 **grid 轨道**撑宽（`#main` 是 `.app` grid 的 `1fr` 项，`min-width:auto`）
- **修复**（≤760px 媒体查询）：
  - `.so-tabs{flex-wrap:wrap}` + `.so-tab{min-width:0;flex:1 1 40%}`（换行收缩）
  - `#main{min-width:0}`（允许 grid 项收缩）
  - `.so-stage` 单列堆叠、长词断行（`overflow-wrap:anywhere`）、评分大圆缩小、导航换行
- **验证**：390px 下 **T1–T5 全部 docW=390（无溢出）**；桌面 1280px 回归 **双列布局保留**（637px+307px）
- swVer / SW CACHE 成对顶版 `v93.0-2026100608`

## [v92.9] – 2026-10-06

### 🔴 根因修复：删除记录被云端复活（v92.7/v92.8 修复均因未触达真因）

- **真根因**：云同步的 **`hydrate()`** 里有一份白名单，对 `sieleOralScores` 走 **`ST[k]=rm[k]` 整体覆盖**，**完全绕过 `mergeSieleOralScore()`** ⇒ v92.7 的删除墓碑、v92.8 的按条删除表**全部失效**；每次 hydrate 都拿云端快照覆盖本地 ⇒ 删掉的必然复活（同理，本地新注入的记录也会被云端抹掉）
- **修复**：把 `sieleOralScores` 从 hydrate 白名单“整体赋值”中**移除**，改为调用 **`_sieleMergeScoreTomb(rm)` + 逐条 `mergeSieleOralScore`**（尊重墓碑与按条删除表）
- **真机 end-to-end 验证（lili 账号，线上）**：注入 3 条 → **保持 3 条（不再被 hydrate 抹掉）** → 删中间 1 条 → **刷新后仍为 2 条（keys 1001/1003）**，删掉的 1002 未并回 ✅
- 备份修复：v92.8（按条删除表）仍保留，用于覆盖“单条删除”粒度

## [v92.8] – 2026-10-06

### 修复「删除**单条**作答记录后被云端并回」

- v92.7 只覆盖“整题删除”；**删单条（✕）时题目仍在 ⇒ 无墓碑** ⇒ 合并时云端该条被并回
- 修复：新增**按条删除表** `ST.sieleOralScoresDel{id:[ts|date]}`；合并历史时跳过被删条；随推送/拉取双向同步；`_sieleClearOne`/`_sieleClearAllScores` 同步清理（上限 200 条/题）

## [v92.7] – 2026-10-06

### 修复「删除记录被云同步复活」+ 准备时间（官方节奏）+ 严谨考试模式

**A. 🔴 修复：删除口语记录后刷新被同步回来（v92.6 删除功能失效）**
- 根因：云同步合并函数  在本地无该 id 时**直接整体赋值远端条目**（并集语义）⇒ 删除的题被云端快照复活；且历史按 `date` 去重，同日多条互相覆盖
- 修复：
  - **删除墓碑** `ST.sieleOralScoresTomb{id:ts}` + **清空全部水线** `ST.sieleOralScoresWipeAt`
  - 合并时按 `_ts` 判定：远端条目 **早于墓碑** ⇒ 不复活；**晚于墓碑**（对端新练习）⇒ 正常接受
  - 推送携带墓碑；3 处合并点先合并墓碑
  - 历史去重键 `date` → `ts||date`
- 验证：5 场景（删后不复活 / 新数据仍接受 / 清空全部不复活 / 墓碑合并 / 同日多条共存）全过

**B. 准备时间（官方节奏）**
- 官方准备秒数写入 `SIELE_TAREAS[].prep`：**T1 50s · T2 150s · T3 20s · T4 60s · T5 120s**
- **练习模式（默认）**：点「⏱ 开始准备」→ 倒计时 → 结束**提示「可以开始录音了」，不强制**；可「跳过准备，直接录音」/「重来准备」
- **严谨考试模式**：点「开始准备」→ 倒计时结束**自动开始录音** → 作答倒计时结束**自动停止**
- 时长文案对齐官方（T2 2min30s 准备、T5 3min 作答等）

**C. 严谨模式开关 + 模考提示**
- `ST.sieleExamStrict`（默认关）；页头可切换
- **模考启动时**若未开严谨模式 → 一次性提示（可「不再提醒」`ST.sieleExamStrictHintOff`），**不强制**
- 严谨模式**隐藏**：看范例 / 看中文 / 智能换题（**「显示文字」仅 T1 隐藏**，T2–T5 保留）

- swVer / SW CACHE 成对顶版 `v92.7-2026100604`

## [v92.6] – 2026-10-06

### 口语练习记录管理 + 官方时长校正

**P1 记录管理（解决“记录越攒越多、无法删除”）**
- **最高分置顶**：每题记录卡顶部改为醒目大字行 `🏆 本题最高分 87`，次行 `已练 N 次 · 最近 日期 · 均分 X`
- **三层删除**：
  - **单条**：每条记录右侧 `✕`（删后**自动重算** bestScore / count / lastDate；清空则删除该题键）
  - **本题**：记录卡底部「🗑 清空本题记录」
  - **全部**：SIELE 口语页「🧹 口语记录管理（N 题 · 约 X KB）」→ 面板含逐题清 + 「清空全部口语记录」（二次确认）
- 识别全文**保留**（不裁剪）
- 新增 `_sieleDelOne / _sieleClearOne / _sieleClearAllScores / _sieleScoresToolsHtml / _sieleScoresAdminHtml`

**P4 官方时长校正（据 SIELE 公开备考资料）**
- **修复 Tarea 5 作答时长：240 秒 → 180 秒（官方 3 分钟）**
- T1–T5 `duration` / `desc` 校正为官方节奏，并新增 `prep` 准备时间字段：`T1 prep=50s · T2 prep=150s · T3 prep=20s · T4 prep=60s · T5 prep=120s`
- （`prep` 为数据先行，倒计时功能在 v92.7 实现）

- swVer / SW CACHE 成对顶版 `v92.6-2026100603`

## [v92.5] – 2026-10-06

### 回忆库增强（总体平均分 + 各题均分 + 历次逐题详情）+ 自主组题更好用

**A. 模考回忆库增强**
- 顶部新增 **总体平均分**（全部模考）大字 + 模考次数 + 最近一次均分
- 新增 **「各题均分」**（可折叠）：跨全部模考按题目汇总，**按 Tarea 分组、低分在前**，每题为 `名称 ×次数 均分`
- 历次记录表**每行可点击展开** → 该次**逐题详情**（Tarea · 题目 · 得分，未作答标灰）
- 数据源：`ST.sieleMockHistory[].steps`（v92.4 起已随每条记录保存）

**B. 自主组题更好用**
- 下拉改为**按分类分组**（`<optgroup>`）：T2 按场景主题、T3 按情境大类、T4/T5 按语义六组，组名带题数 → 长列表（T2 142 题）可快速定位
- 面板顶部加**固定结构说明**（官方：T1×4 / T2×1 / T3×2 / T4 三问 / T5×1）
- 标签更明确（如「T1 · 指定 1 问（另 3 问随机）」「T5 · 留空＝随 T4 同题」）
- 新增 **「🎲 全部随机」** 一键重置

- swVer / SW CACHE 成对顶版 `v92.5-2026100602`

## [v92.4] – 2026-10-06

### 模考回忆库（历次留存 + 按 Tarea 强弱）

- 每次全真模拟**结束时自动收录**一条记录：均分、已答步数、**各 Tarea 平均**、逐题明细（幂等：按 `ST.sieleMock.created` 去重；上限 20 次）
- 模考入口新增「📚 回忆库 (N)」按钮 → 展开面板：
  - **各 Tarea 平均**横向条（≥75 绿 / ≥55 橙 / <55 红）
  - **相对薄弱 / 相对最强 Tarea** 提示（💡）
  - 历次记录表（第 N 次、日期、均分、各 Tarea 分 1-5、已答/总步数）
  - 「清空」按钮
- 数据存 `ST.sieleMockHistory`（随云同步）；仅统计**本次模考期间**的作答（沿用 v92.3 的 `ts` 过滤，旧训练分不混入）
- 新增 `_sieleMockSaveHistory / _sieleMockHistHtml / _sieleMockHistClear`；swVer / SW CACHE 成对顶版 `v92.4-2026100601`

## [v92.3] – 2026-10-06

### 修复「范文打不开」+「模考显示旧成绩/均分被污染」+ T2 图片慢

**A. 范文（参考答案/重点）打不开**
- 根因：`.so-model{display:none}`，范文默认隐藏，**唯一打开方式是评分框里的「显示范例与重点」按钮**（→ `showSieleModel()`）。v92.1 改评分时**误删了 0 分档的该按钮** ⇒ **0 分后范文彻底无法打开**（用户反馈："T5 答题 0 分怎么看不了示例"）
- 修复：① 0 分档评分框**恢复该按钮** ② 动作行新增**常驻「看范例」按钮**（任何模式/任何分数都能打开，含模考）

**B. 模考显示历史旧成绩 + 均分被旧成绩污染**
- 根因：训练模式练过的题会把成绩存进 `ST.sieleOralScores[id]`；模考命中同一题时 `saved` 直接取到**训练旧成绩**并显示；模考报告 `_sieleMockScoreOf` 取 `bestScore`（历史最高）⇒ **模考均分混入训练分**
- 修复：评分记录加 `ts`；`saved` 在模考中**只认本次模考期间的作答**；`_sieleMockScoreOf` 加 `ts >= ST.sieleMock.created` 过滤（旧记录无 ts ⇒ 自然排除）
- ⚠️ 存量历史分数的 `history` 不受影响

**C. T2 图片加载慢**
- 根因：SW 为全站 **network-first** ⇒ 图片**每次刷新都走网络**；且 **2.7MB 雪碧图仍在 CORE_ASSETS 预缓存**（T2 已全部改用 `assets/images/t2-scenes/*.jpg` 本地小图，雪碧图成死重）
- 修复：sw2 ① CORE_ASSETS **移除雪碧图** ② 静态图片改**缓存优先 + 后台校验**（不再每次走网络）

**D. 其他**
- SIELE 页重渲染（换题/答题）**保留滚动位置**，避免跳回顶部

- 验证：本地浏览器（0 分档按钮✓ / 看范例✓ / 模考排除旧成绩✓ / 计入新成绩✓ / 无 pageerror）+ 线上复验 swVer v92.3
- swVer / SW CACHE 成对顶版 `v92.3-2026100600`

## [v92.2a] – 2026-10-05

### 修复 T4 存量题范文模板拼接缺空格（30 题）

- **缺陷**：T4 存量 34 题中 **30 题**的 `model` 存在句末缺空格，形如 `…medidas concretas.La mayor ventaja…`（应为 `…concretas. La…`）——由历史模板字符串拼接 `'…concretas.'+(t.ext4||'')` 造成
- **修复**：在 `siele_oral.js` 的 `_sieleT4V92Apply(bank)` 内加**幂等空格规整** `_sieleFixESSpacing()`（`/([.!?])(?=[A-ZÁÉÍÓÚÑ])/g → '$1 '`），对 `q.model` 与各 `subq.model` 生效；**静态库与云快照双分支**均覆盖
- **验证**：本地浏览器实测修复后 T4 全库 model 缺陷数 **30 → 0**，无 pageerror
- ⚠️ `siele_oral.js` 是外链、**不在 SW 预缓存** ⇒ 本修复**无需顶版**（仅推该文件）
- 备注：T4 三问结构（官方「3 个音频问题」）经实测**早已完整**——所有 44 题运行时均输出 3 个子问（显式 10 + 遗留自动拆分 34），本次不涉及结构调整

## [v92.2] – 2026-10-05

### SIELE T3 双 Bloque 演练（对齐官方 EIO 考场形态）

- T3 标签页新增「🎭 双 Bloque 演练」：随机组卷（2 段 × 二选一，共 4 题不重复），**连续 2 段**、每段给 2 个情境**二选一**，各含官方 3 个必做点
- 流程：入口按钮 → Bloque 1 二选一 → 自动跳到所选情境（复用现有录音/评分/必答项核对）→「进入 Bloque 2」→ 选段 → 「完成演练」；全程可「退出演练」
- 状态持久化 `ST.sieleT3Bloque={on,bloque,opts,chosen}`；选段时若被分类过滤挡住会自动清过滤
- 改动：新增 `_sieleT3BloqueState/_sieleT3BloqueStart/_sieleT3BloqueExit/_sieleT3Pick/_sieleT3BloqueNext/_sieleT3BloqueHtml`；在 T3 标签页 themes 块后注入面板。**T2/T5 零改动**（改前后回归逐项一致）
- swVer / SW CACHE 成对顶版 `v92.2-2026100523`；本地冒烟（入口/双段/选段跳题/段间推进/结束）+ 线上复验全过，无 pageerror

## [v92.1] – 2026-10-05

### SIELE 口语评分改造（官方必答项逐项核对 + 修复空录音地板）

- **修复**：此前各维度有无条件地板（content/fluency/vocab 35、grammar 45），**空录音也算出 37 分**。新增**有效性闸门**：识别词数 < 5 直接判 **0**（<3 提示"未检测到有效回答"，3–9 提示"回答过短"），且不计入 bestScore
- **维度分改为 0 起算**（去掉 35/45 地板），并给 vocab/grammar 加"约需 20 词才满分"的充分性因子，避免短答虚高
- **新增官方必答项逐项核对** `_sieleMustDo()`：T2 五维（人数关系/外貌衣着/动作状态/位置地点/其他物品）· T3 三点（开场来意/理由细节/请求致谢）· T5 四要素（立场/论证/举例/总结）· T1/T4 用题目 keys
- 评分框新增清单：`✅/⬜ 各必答项` + 「官方必答项覆盖 X/Y · 缺：…」；改进建议同步报缺失项
- 总分权重：content .26 / fluency .14 / vocab .10 / grammar .10 / **必答项 .40**
- swVer / SW CACHE 成对顶版 `v92.1-2026100521`；单元测试（空=0 / T2五维=83 / T5四要素=90 / T3=86）+ 本地冒烟 + 线上复验（空录音=0）全过

## [v92] – 2026-10-05

### SIELE 口语对齐官方 EIO（另一账号，v89–v92）

- v89 T2 同图超5题打散 + 新图；v90 T4/T5 扩题 hf31–hf40
- v91 T3 官方三段式题面（`SIELE_T3_META_V91`）+ T4 材料段（`SIELE_T45_PASSAGE_V91`）+ T5 双立场（`SIELE_T5_STANCE_V91`）+ 全真模拟考（`_sieleMockActive`，卷面 T1×4/T2×1/T3×2/T4×1/T5×1，T1 前2问15s后2问30s）
- v92 T3 +8 题、T4/T5 各 +10、T2 图片全部本地化（54 张 ~100KB）

## [v88.1] – 2026-10-05

### QDATA_PDF 外链懒加载兜底（首次数据减负，index −33%）

- 把内联的 `QDATA_PDF`（3000 题 / 617KB）拆出为外部文件 `qdata_pdf_fallback.js`（`window.QDATA_PDF`），**不再无条件 `push` 进 QDATA**
- 4×`tryReplace{L}Quiz` 的**失败分支**（各级 REPLACE 题库重试 35×80ms≈2.8s 仍未就绪时）改为按需动态 `<script>` 加载该兜底文件，并**仅注入缺失级别**的旧题
- 失败时弹 toast 提示：「⚠️ 网络异常：X 级题库已用旧题兜底（N 题），可刷新重试」
- 连带修复：`renderNetdisk` 的题库计数由 `QDATA_PDF.length` 改指运行时 `QDATA.length`（外链后原引用会变 0）
- **收益**：`index.html` **1,948,095 → 1,299,039 B（−649,056 B / −33.3%）**；正常网络下四级替换全成功 ⇒ 兜底永不加载，用户无感且省 617KB
- 外部 `.js` 不进 SW 预缓存（保持「改数据零发版」）；swVer / SW CACHE 成对顶版 `v88.1-2026100501`
- 验证：本地冒烟（正常=6000 / 屏蔽 quiz_b1_new.js→兜底 5250+toast）+ 线上 Pages 复验，均通过

## [v88] – 2026-10-04

### SIELE 五项优化（另一账号）

- T2 图片压缩 −56% + 骨架屏/淡入 + 预取；画面解读 chips 金底深棕高对比；T3 中…

## [v87] – 2026-10-04

### content_edits 读取函数加固（去重合并，防云端覆盖阴影）

- `getWritingTasks()` 由「云端有值即完全覆盖代码」改为**按下标去重合并**（代码 `WRITING_TASKS` 为基，云端同下标字段 `Object.assign` 覆盖同名、云端更长则追加新增）
- `getWritingEssays()` 改为**按 id 去重合并**（代码为基，云端同 id 覆盖、新 id 追加）；`getConjVerbs()` 本为合并型未动
- 背景：云端 `content_edits` 存过快照后代码新增对登录用户不可见（oralbank 化石事故同源）；v86 已加固 speakingTopics，本版补全 writing/essays
- swVer / SW CACHE 成对顶版 `v87-2026100423`；行为测试 8/8 通过

## [v86] – 2026-10-04

### speakingTopics 治理 + 读取函数加固（首例去重合并）

- `SPEAKING_TOPICS` **10 → 16 条**：并入原云端 6 条真扩充（mercado / oficina / reciclaje / tecnología / encuesta de lectura / biblioteca），`essay` 字段不预置（原文为早期自动生成劣质范文）
- `getSpeakingTopics()` 由「云端有值即完全覆盖」改为**按 topic 去重合并**（代码为基 + 云端同名覆盖 / 新增追加 + 跳过空键与垃圾键 `cf`）
- 同步清理云端 `content_edits.speakingTopics`（17 条 2026-08-14 旧快照，含 `cf` 垃圾）与 `oral`（5 tareas，与代码逐字一致），`edits` 置 `{}` 回落静态代码 —— 全量备份后执行，非破坏性
- swVer / SW CACHE 成对顶版 `v86-2026100422`；行为测试 3/3 通过

## [v85] – 2026-10-04

### 仓库品牌词清理（来源标注去品牌化）

- 全仓来源标注清理 **122 处**（第三方内容自认式表述 → 中性「复习资料」）
- ⚠️ git 历史仍含旧词（彻底清除需 force-push 重建历史）

## [v84] – 2026-10-04

### SIELE 口语 T2 同图题合并视图

- 142 题 → **51 卡片**（29 个多题组，最大 `oficina` 一图 17 个变体）
- 组内 A/B/C 切范文浏览

## [v83] – 2026-10-04

### SIELE 口语 T3 PDF 全文对标

- 39 题 `esTitle` / `zhExplain` 更新为 PDF 原文 + `q` / `model` 注入 PDF 原文
- 新增 3 题（换班级 / 取消周末计划 / 通知婚礼）

## [v82] – 2026-10-04

### 题库管理：一键恢复内置题库

- `_bankAdminTools` 新增「☁ 恢复内置题库」按钮（admin 一键写 `edits={bank:null}`，前端双分支回退内置 `SIELE_ORAL_BANK`）
- 修题库重音 3 处

## [v81] – 2026-10-04

### SIELE 口语 T2/T3 分类过滤视图 + 断链修复

- 新增分类过滤视图（`_sieleOralFilter` / `getSieleOralViewBank()`）
- 修 T2 断链 4 题（`t2-café`×3、`t2-balcón`×1）；修 id 笔误 `t2-libreria-82 → 83`
- 修 T4/T5 topic 重音匹配；`photo_mapping.json` → 47

## [v80] – 2026-10-04

### SIELE 口语 T3 全量补齐 + 音频先行修复

- T3 全量 73 题三件套（`SIELE_T3_META` 静态 / 云端双分支注入）
- 音频先行修复（进题零泄露）；删重复题 `plant-care`

## [v79] – 2026-10-04

### SIELE 口语 T3 补缺口 + 回忆卡限域

- T3 补 PDF 缺口新题 `t3-reject-offer`；删重复题 `pet-care`
- 回忆卡限 T2；双语标题 B 布局；`genSpeakingEssay` 停用低质模板预填

## [v78] – 2026-10-04

### index 阅读文系统性缺失重音修复（149 处）

- `READING_ARTICLES`（14 篇）+ `READING_LONGFORM`（4 篇）整数据集系统性缺重音（远超外部估计的 ~20 处）
- 修复 **149 处**（区域限定）：词边界整词 133 处（cafe→café、dia→día、mas→más×20、tambien、educacion、America…）+ 精确短语 16 处（`esta→está` 动词 8 处 / 指示词 3 处保留；`hacia→hacía` 动词 4 处 / 介词 1 处保留；`en si mismo→en sí mismo`×3）
- `solo`×17 按现代 RAE 不加重音（不动）；区域外残留经核实全为必须保留的代码标记
- swVer / SW CACHE `v78-2026100406`

## [v77] – 2026-10-04

### SIELE 口语 S6 P0 全量修复

- T2 虚拟式 **142 篇**、重音 **330 处**、主谓一致（`se aprecia→vemos` / `cabe destacar`）、T3 错字 31 处、T3 双语副题 + 连接词 25 篇 31 处
- ⚠️ 本版发现云端 `oralbank` 化石覆盖（v73 旧库遮蔽 v74–v77 修复，登录用户不可见）

## [v76] – 2026-10-04

### SIELE 口语 S4：进度游标跨设备

- 口语进度游标跨设备（T1–T5 按 qid、双通道 LWW 合并）；单元测试 10/10

## [v75] – 2026-10-04

### SIELE 口语 S3：T2 图片修复

- T2 图片 404 修复（2 处带重音路径）；T2 无图题 21 → 0（16 挂图 + AI 生成 5 张）
- 6 条占位改写；T2 主题 10 大类 + 按主题跳转

## [v74] – 2026-10-04

### SIELE 口语 S1+S2：数据重音 + 真实录音识别

- `siele_oral.js` **180 处**重音（23 类：fotografía×119、están×69…，CRLF 493 保真）
- DELE 口语接入真实录音识别（SpeechRecognition es-ES）

## [v73] – 2026-10-04

### DELE 批次 A+B

- 13 个题库文件 **540 处**重音 / 人名修正（mas→más / ano→año / Lucía / María…）
- DELE 口语文本评分 `_deleCalcSpeakingScore`、全真模拟计时条、A1 广告写作评分入口、form_fill 自动保存

## [v72.1] – 2026-10-04

### 测试报告 P1/P2 收尾（工程项续批）

- 错题空分类 tab 隐藏
- sw2 完整性校验（Content-Length 不符或 HTML 缺尾标记 → 不落缓存）

## [v72] – 2026-10-04

### 测试报告 P1 数据清洗 + P1 工程 + P2 批量

- **数据清洗**：断词连字 **342** 处（全落 QDATA 区，0 代码误伤）；`basico→básico` 248 处；主题标签合并 8 对；口语范文重音 **246** 处
- **工程**：判题文案统一 + 乱序后字母对齐；`updateStreak` 打卡日历纠偏（streak 重置口径）；`mergeWbSnapshot` 尾部定向刷新统计卡 DOM；SW 首访不 reload；同步芯片 25s 看门狗；learner 隐藏后台快捷入口
- **P2**：考试类型下拉 DELE/SIELE；toast err 红色 + 自定义时长参数；未授权提示 5s；西班牙按钮 nowrap；T2 模板提示全角标点；README 4866→4815
- 推送六文件（index / sw2 / siele_oral / vdata_batch2 / vdata_batch3 / README），全部 PUT 前重取线上 sha 保护

## [v71] – 2026-10-03

### 外部测试报告 3 个 P0 修复

- **P0-1 版本自检失效**：横幅「检测到新版本」全员永动误报 —— `window.swVer` 提为文档头部单一真源，SW 注册 / `pageVer` 回退 / 页脚两处全部动态引用（发版从此只改 `window.swVer` + sw2 CACHE 两处）
- **P0-2 题库第 1 题数据错位**：题干尾游离 `presentación` 删除；选项 `carta de` → `carta de presentación`
- **P0-3 版本号统一**：页脚 / 自检 / 注册全归 `window.swVer`
- 顺带修：词汇例句 `entre`、外刊 `vuelven→vuelve`（主谓一致）、词头前导空格

## [v70] – 2026-10-03

### 范文修复 + 听力 TTS + 口语 keys 对齐

- **范文修复**：wt5 56→76 词、wt10 68→76 词、wt13 62→78 词（14 篇平均 84.1）；提分杠杆 = 每 +1 种连接词 +4 / +1 虚拟触发 +4
- **听力 TTS 修复**：根因 = 按钮把含【听力】前缀的 `q.q` 直接传 `speak()` → mp3 key 不命中 → 华为硬闸「TTS不可用」；修法 = 按钮 `data-es` 存去前缀文本 + `_quizSpeakListening` helper；9 条现存题预生成 mp3
- **口语 keys 对齐**：T1 9 条补模板句；T2 4 条微调（`t2-grupo` 须改 `conclusion` 字段，`model` 由 `makeT2Model` 运行时重建）

## [v69] – 2026-10-03

### 共享评分核心 + RAE 词典扩充 + 管理员词典管理

- `_wbScore` 统一评分核心（`_WB_CONN` 102 连接词 + `_WB_SUBJ` 51 虚拟式）
- RAE 词典扩充 + 管理员词典管理面板（`lexicon` 命名空间，零发版）

## [v67–v68] – 2026-10-03

### 写作评分引擎修复 + 共享评分核心

- 写作评分引擎修复上线（lili 实测）；`_wbScore` 统一评分核心建立

## [v66] – 2026-10-03

### 写作练习 / SIELE 口语 评分动画

- 写作练习与 SIELE 口语评分动画上线

## [v65] – 2026-10-03

### 视觉动效升级（成长树美化 + 完成仪式 + 三态反馈）

- `celebrate()` / `cry()` 整函数替换为真实 Canvas 粒子引擎（火箭→爆炸→重力→衰减），五档烟花 + L2.5 救赎
- 选项三态：选中蓝脉冲 / 正确绿弹跳 / 错误红抖动；完成页按 pct 分档（≥90 / ≥60）
- 成长树：**emoji 本体一字不动**，仅追加第 10/11 阶树冠挂饰（🌸/🍎）+ 花瓣飘落（纯 CSS）
- **v65b hotfix**：`<style id="v65fx">` 与 canvas 撞 id → `getContext is not a function` 致动画全灭；改 id + 全链 try-catch + 恢复大号 emoji 弹跳（L0 😢 / L1 🎉 / L2 🎊 / L3 ✨ / L4 🏆）

## [v64] – 2026-10-03

### 外刊 TTS 音频回填 20 期 + 跨口音回退

- 08-02…09-18 共 20 期外刊段落/单词预生成 mp3（修微信内置浏览器无声：webview 无西语引擎）
- 每文本只留一种口音（djb2 奇偶确定选 la/es），删 1509 个重复口音文件 = **−87.4 MB** → 2012 个 mp3 / 109.7 MB
- `_ttsPlayMp3` 首选口音未命中 → 回退另一口音（跨口音回退）；swVer / CACHE `v64-2026100301`

## [v63] – 2026-10-03

### 重置纪元传播（根治数据复活）

- `_vocabWipeLocal(now)` 提取（纯 ST 域清空 + epoch + floor 键）
- `mergeWbSnapshot` / `hydrate` 开头加 epoch-adopt：`remote.vocabResetAt > 本端 floor` ⇒ 就地重置 + 采纳纪元（任何设备拉到新纪元自动归零，不再 max 合并保旧）
- 根因：僵尸标签页再推旧数据 + max/union 合并规则对「清空」天然不友好

## [v62] – 2026-10-03

### 默写本轮快照 + 重置守卫加固

- `ST.dictationPending`（本轮去重累积）：默写词表 = 自上次默写以来评过级的全部词，一字不差
- 重置守卫加固：`_vocabResetFloor()` = max(ST.vocabResetAt, localStorage `swa_vocab_reset_floor_v1`)；**hydrate 补守卫**（v61 只护 `mergeWbSnapshot`，hydrate 白名单曾整体绕过）
- swVer / CACHE `v62-2026100203`

## [v61] – 2026-10-02

### 天气徽章 + 单词卡片「重置学习进度」

- 成长树健康档由植物视觉改为**天气版**（阳光明媚 / 多云转晴 / 阴天 / 连日阴雨）
- 单词卡片新增「↺ 重置学习进度」按钮：`ST.vocabResetAt` 重置水线，`mergeWbSnapshot(remote, wbTs)` 第 2 参（3 个调用点全改），云端快照 ts 早于水线时剥离词卡域 11 字段

## [v60] – 2026-10-02

### 成长树 2.0（11 阶 + 健康窗 + 救赎）

- 成长树 2.0 上线：11 阶、健康窗、错词救赎链路；lili 线上实测全通过（救赎端到端：`redeemed` → mastery 2→3 → 待救赎 16→15）

## [v59] – 2026-10-01

### 番茄钟全面可爱化

- 进度动画鲜明化：「咬痕虚线」跟随切割位置移动（`tomatoBiteLine`）
- 脸跟番茄走（`tomatoFace` 移入 clip 组）；汁水阶段 `tomatoDizzy` 星星效果；按钮 emoji 化（🍅 开始 / 🔄 重置）；计数「今日🍅」

## [v58] – 2026-10-01

### 番茄钟可爱化 + v57 按钮状态 bug 修复

- 番茄 SVG 加「眯眯眼 + 腮红 + 微笑嘴」（避开中央时间文字区）；标题 ⏱→🍅
- 修 v57 授权按钮不绿：`adminListUsers` 返回用户对象硬编码三键 → 映射补 `sieleSpecial` / `writing` / `oral`

## [v57] – 2026-10-01

### 授权制扩展 + 资料地图管理员专属 + 跟读分页

- SIELE 专项 / 写作练习 / 口语话题 → 管理员授权制（云函数 `USER_FLAG_KEYS` +3 + `getUserFlags` +3 + NAV `reqFlag` + admin 勾选框）
- 资料地图改为管理员专属（非管理员踢回仪表盘）
- 跟读训练分页（每页 6 条 + 上/下一页 + 筛选重置页码）

## [v56] – 2026-10-01

### 跟读逐词分析渲染 + 后台备份补工作台进度

- `scoreShadow` 追加渲染 `${v2.wordDetail || ''}`（v53 起 `calcScore` 已返回 wordDetail HTML，从未渲染）
- 后台导出备份 payload 加 `wb` 域（`dele_siele_wb_v3`）；v:1→v:2；导入回写 + 提示刷新主站
- S2/S3 云函数加固（755 行版重建）：`_dbRateGuard` DB 层限流、register 邀请码 IP 限流、reset 防枚举（统一 `PWD_INVITE_MISMATCH`）、login 失败 IP 限流、全局 catch 回显移除

## [v55] – 2026-10-01

### 修「无西语语音设备发音 = 英语腔」根因 + 自检面板说真话

- 根因：`speak()` Tier 1 在无西语语音时无条件 `_ttsSpeakOne(text,null,spec.lang)` 交给系统按 lang 兜底 → 华为拿默认音色念西语
- `speak()` Tier 1 加硬闸：无西语语音 ⇒ `_ttsNoSpanishVoiceNotice()`，绝不落到系统默认音色；新增 `_ttsSpeakOnlineFallback`（Tier 1.5 在线取真西语音频）
- `ttsTestAccent()` 重写（如实反映真机发音路径）；自检面板文案改绿字「✔ 自动切换到内置西语音频」+ 来源标注

## [v54] – 2026-10-01

### T1 全流程：预生成 mp3 音频 + 前端 Tier 0 播放

- `gen_tts_audio.py`（edge-tts，双口音 la=es-MX-DaliaNeural / es=es-ES-ElviraNeural）：跟读 50 句 + 外刊 2026-09-25 期 = 276 mp3 / 12.2 MB
- `window.__TTS_MANIFEST` 外链 + `_ttsMp3Key` / `_ttsPlayMp3`（djb2 key 前后端一致）+ `speak()` Tier 0（命中 → Audio 播放）
- 音频 277 文件 Git Data API 原子提交；swVer / CACHE `v54-2026100101`

## [v50–v53] – 2026-10-01

### 外刊精炼跟读评分修复（三批上线）

- **v50 批 A**：P0 修复（sc 对象拼字符串、network 特判、每日/每周精选文案）
- **v51 hotfix**：修 v50a 回归（`recognition.onerror` 闭合 `};` 丢失 → 评分永不启动）
- **v52 批 B**：停止按钮 + `__refineScoreLaunch`（random / para 双入口）+ 段落 🎤 入口 + `lastFinalTs` 流利度口径 + 60s 强制截断
- **v53 批 C**：`scoreShadow` 升级 V2 引擎（`calcScore` 四维 35/25/25/15）+ `ST.refineShadowScores` 独立落盘全链路 + chip「最新」角标 + `hadError` 真实错误提示

## [v49] – 2026-10-01

### 移除 serena 后门

- `isAdmin` 前端后门（`index.html` 14140 行）删除；后端 `requireAdmin` 兜底完好
- swVer / CACHE 顶版；终验 44/0

## [v48] – 2026-09-30

### 动词变位三态角标（批 6：reír 类 + 不规则类型可视化）

- `verbconj` v1.6：IRREGULAR + reír / sonreír / freír 全精校（NULL 修复；freír participio=frito）；`irregularTypeOf` 三态（full 内置精校 / partial 命中覆盖表或 -cer/-cir zc 规则 / null 纯规则）；`conj()` 返回 `irregularType`
- index v48：`renderConjCard` 三态角标——不规则（橙 #d85a30）/ 部分不规则（琥珀）/ 规则（蓝 #185fa5）
- `stripPronoun` 支持重音 ír 结尾（reírse / freírse 代词式 NULL 存量 bug 修复）

## [v47] – 2026-09-29

### 单词卡片「默写退出选项」

- 每学 10 词强制弹听写，加「退出」按钮 + 勾选框「不喜欢这个模式？勾选并点退出后本设备不再自动弹出」
- 新函数 `exitDictation`（不计错 / 不入错词库 / 清 `_dictationState`）、`isDictAutoOff` / `setDictAutoOff`；`rateFlash` 触发守卫 `%10===0 && !isDictAutoOff()`
- 偏好键 localStorage `wb_dict_auto_off_v1`（设备级，不进云同步 schema）；手动听写入口不变
- swVer / CACHE 顶版 `v47-2026092901`

## [v46.1] – 2026-09-28

### 会话有效期 14 天 → 7 天（云函数）

- `siele-auth` 的 `TOKEN_TTL_SECONDS` 由 14 天改为 7 天：登录后 7 天需重新输密码
- 已签发的旧 token 不受影响（有效期编码在 token 内），新登录起按 7 天签发
- 部署方式：CLI `fn deploy`（代码+配置一体，SESSION_SECRET/PASSWORD_PEPPER/邀请码等环境变量原样保留）；部署后实测 lili 登录返回 token 有效期 7.00 天

## [v46] – 2026-09-28

### 主站导出/导入备份一级入口（UX 断层修复）

- **问题**：主站的「📥 导出备份 / 📤 导入备份」按钮一直存在，但藏在仪表盘「☁️ 云同步」弹层（旧 Gist 时代的 GitHub Token 设置面板）底部，实际不可发现——等于没有入口；v45 后台文案「可在主站菜单『导出备份』单独导出」也指引了这条不可发现的路径
- **修复**：仪表盘「快捷操作」卡新增「📥 导出备份」「📤 导入备份」两个一级按钮（直接调用既有 `exportData_` / `importDataPrompt_`，零新逻辑；导出/导入为本地操作，无需登录）；云同步弹层内原按钮保留
- **后台文案修正**：v45 说明更新为准确路径——「主站仪表盘『快捷操作』卡点『导出备份』按钮单独导出」
- **零函数改动**：`exportData_` / `importDataPrompt_` 函数本体未动（v44 的 quizResultsTs 导出/合并逻辑原样随行）；云函数零改动
- swVer / SW CACHE 顶版 `v46-2026092802`（index 改动按铁律成对顶版）
- README 精简（去数据来源标注与内部题库代号，版本指向 CHANGELOG）；LICENSE「数据资产」条款改中性表述（去除第三方内容自认式表述，增与考试官方机构无隶属声明）

## [v45] – 2026-09-28

### 后台导出说明澄清 + 词表 CSV 补列（纯文案/列追加，零功能改动）

- **导出说明澄清**：「导出备份」区注明完整备份覆盖的是后台六类数据（词库/题库/复习/计划/掌握度/设置），可在导入区恢复（「合并」或「完全覆盖」两种模式）；并注明主站工作台的刷题正确率、连续打卡、错题集等进度**不在此备份内**——它们随账号登录自动云同步，也可在主站菜单「导出备份」单独导出
- **云同步双链路说明**：云同步页注明「主站工作台进度走账号登录自动同步，后台数据走独立同步令牌同步」，两条链路相互独立、与登录密码不复用
- **单词表 CSV 补列**：既有七列（es/zh/pos/ex/lvl/t/mastery）末尾追加 `diff`（难度）/ `src`（来源 seed|user）/ `updatedAt`（最后修改时间，格式 YYYY/M/D HH:MM，未修改过显示空）三列；导入按表头名取列、多余列自动忽略，新旧 CSV 双向兼容
- **CSV 格式说明修正**：导入区帮助文案补齐实际支持的全部可选列（`pos,ex,lvl,t,mastery,diff,src,updatedAt`）
- **不顶版**：SW 为 network-first，admin.html 在线即达新版；index.html / sw2.js / 云函数本次零改动

## [v44] – 2026-09-27

### 测验结果合并丢数据修复
- **4 处丢数据路径修复**：跨设备同步的 3 处「取更长」合并（云快照合并 / 第二同步路径 / 备份导入）+ 1 处实勘新发现的 `hydrate` 盲覆盖（快照 ts 更新时整组替换，本机未推送的新成绩被直接抹掉）——全部改为**并集合并**
- **并行时间戳数组**：新增 `quizResultsTs` 与 `quizResults` 逐位并行；合并按「时间戳+分数」去重、按时间降序取最新 20 条，两台设备各有新成绩时不再互丢
- **旧数据/旧设备全兼容**：旧纯数字数据按 t=0 处理平滑过渡；未升级设备读到的仍是纯数字，仪表盘平均分/能力雷达/桥接记录零破坏（这也是弃用「对象数组」方案改用并行数组的原因，与既有 `sieleOralProgressTs` 模式一致）
- **零云函数改动**：wb 快照为整体拷贝，Ts 字段自动随行；admin 零改动
- swVer / SW CACHE 顶版 `v44-2026092708`

## [v43] – 2026-09-27

### DELE 专项编辑留痕 + 时区修正
- **DELE 留痕补齐**：DELE 专项（此前 v41/v42 两套留痕均未覆盖的第三套体系 `admin_edits`）保存编辑前自动抓「字段级改前快照」入 `__hist`（`v=null` = 原始内容，上限 5 版，>2 万字符降级仅记元数据）；后台「📝 题库编辑」tab 内新增 **DELE 专项分区**，支持还原原始字段 / 恢复历史版本（两段式确认，立即云同步）
- **遍历修复**：题目合并 / 还原判断 / 共享编辑三处遍历排除 `__hist` 元数据，杜绝留痕混入题目对象或误判「仍有编辑」
- **时区修正**：`todayStr()` 由 UTC（`toISOString`）改本地时区——修复中国时区每天 0–8 点练习把「今天」记成「昨天」导致的 streak 误断签
- **兜底退役**：移除 DELE 编辑的 GitHub Pages 静态 JSON 兜底（`dele_admin_edits.json` 恒为空、云函数通道为唯一真相源，省一次启动请求），空壳文件已从仓库删除
- **零云函数改动**：留痕复用既有 `setAdminEdits` / `getAdminEdits`（对象直传通道不变）
- swVer / SW CACHE 顶版 `v43-2026092707`

## [v42] – 2026-09-27

### 管理员编辑留痕 · 全域化（可回溯 + 一键回滚）
- **v42** 9 个业务域（写作任务/范文库/口语话题/口语 Tarea/SIELE 口语题库/考试结构/动词用法/动词变位/语法库）保存时自动抓「改前快照」入独立命名空间 `content_edits.__audit`；后台新增「🕘 编辑留痕」tab，可看时间线并一键回滚到该次修改前
- **零云函数改动**：namespace 为自由字符串，审计复用既有 `getContentEdits` / `setContentEdits`
- **拦截点唯一**：所有域的保存都经过 `_deleSyncContentEdits` 出口 ⇒ 无需改任何保存函数即可全域覆盖
- **容量保护**：最多 60 条 / 总量 ≤1.4MB；单条快照 >256KB 自动降级为「仅摘要」，确保不触发云端单文档 2MiB 上限
- **本地缓存 + 合并**：`wb_content_edits_audit_v1` 本地留存，拉取结果按 `id` 去重取并集，多设备不会互相清空历史
- quiz 域沿用 v41 的 `__hist`（其顶层键即题目本体，不能加审计键）
- swVer / SW CACHE 顶版 `v42-2026092706`

## [v41] – 2026-09-27

### 题库编辑留痕 + 后台总览
- **A2** 题库编辑留痕：保存前把「改之前的值」快照前置入每条记录 `__hist`（首次编辑即原始题目），上限 5 版
- **A1** 后台新增「📝 题库编辑」tab：已编辑题目列表、变更字段标签、历史版本时间线，支持「还原原始」与「恢复此版」
- 编辑弹窗新增历史版本载入（载入后需再点「保存并同步」才生效，防误触）
- 零云函数改动（复用 `content_edits.quiz` 通用域）

## [v40] – 2026-09-27

### 遗留批次收尾 + 本地备份脚本

- 题库搜索命中 / 答案显示改用编辑后内容（循环入口套用 quiz 编辑，跳转 key 不变）
- `--sans` / `--serif` 补 emoji 回退（guard 告警消除）
- 新增可复用备份脚本 `backups/backup_deploy.py`（swVer 自动探测命名 + zip 完整性校验 + 保留 5 份轮换）
- swVer / CACHE `v40-2026092704`；线上终验 7 项全绿

## [v39] – 2026-09-27

### 题库管理员编辑（quiz 命名空间打通）

- 云函数 `getContentEdits` / `setContentEdits` 按 namespace 透传（quiz 自动走通；requireAdmin / 2MiB / JSON 字符串存储口径不变）
- quiz 无原生 id，改用内容哈希 `quizQuestionKey`（`ex::type::q`）定位：编辑不改做题历史 / 游标 / 搜索 key
- 本地暂存键 `wb_content_edits_quiz_v1` + `__ts` LWW；编辑弹窗覆盖做题 / 背题两模式（仅管理员）
- swVer / CACHE `v39-2026092703`；线上终验 12 项全绿

## [v38] – 2026-09-27

### 仓库治理 · 第二批
- **S2** 清除西语助手（eusoft-eudic）浏览器扩展注入 3 处约 120KB（`<style>` 块 ×2 + 尾部 DOM 快照），恢复被吞的 `</head></body></html>` 结构
- **U2** 旧 Gist 同步角标（右上「⛔未配置」）默认下线，与 CloudBase 同步芯片双角标并存问题解决；保留可逆开关 `__WB_LEGACY_BADGE_OFF__`
- **E2** `go()` 页面白名单：未知页面 id（脏 hash / 注入调用）一律回落仪表盘
- **E3** URL hash 路由：启动恢复（如 `#quiz` 刷新直达）、`hashchange` 前进/后退跟随、`go()` 内 `history.replaceState` 同步地址栏
- **U1** 移动端（≤860px）导航改单行横向滚动，替代原竖排 14+ 按钮占半屏
- **README 重写**（对齐 v38 现状）+ 本 CHANGELOG 新建

### 仓库治理 · 第一批（同日）
- **S1** 云函数 v36 权威副本（24 actions）推送入库，消除「仓库缺 v36 接口」的灾难恢复隐患
- **deploy-guard v2.0** 上线：index/admin 标记、云函数 24 actions、SW 版本配对、数据文件完整性校验；API 推送通道 `api_push.py` 内置 guard + sha 保护
- **LICENSE** 添加（禁商用、允许学习）；`.gitignore` 矛盾文件清理（仓库 163 文件）

## [v37.1] – 2026-09-27
- 背题停驻记忆：刷新回到上次背的题，各等级/筛选组合独立记忆（`wb_quiz_back_pos_v1`，本机键不进云同步）

## [v37] – 2026-09-27
- 会话打通：登录了谁整站就是谁；后台/工作台任一处退出 = 整站退出（`wbLogout`），保留本机学习数据

## [v36] – 2026-09-27
- 功能授权制：云函数 `adminSetUserFlags`/`getUserFlags`；后台用户管理加授权开关（背题/DELE专项/外刊精炼）；工作台菜单与页面 🔒 守卫；背题模式改云端授权（静态授权码下线）

## [v35] – 2026-09-26
- 背题模式上线（原始顺序 + 答案标绿 + 解析直出，不写做题记录）
- 搜索结果直接显示答案（背题模式）
- 修复 v34 搜索跳转污染顺序做题游标的 bug（回看不再改游标）

## [v34] – 2026-09-26
- 题库搜索 + 键盘导航 + 一键跳题

## [v32–v33] – 2026-09-26
- `writing_*`/`readingProgress`/tasks 纳入云同步合并域；错题页快轮询；错题合并后统一时间戳降序

## [v31] – 2026-09-26
- 词卡/做题游标仲裁重构：由时间戳 LWW 改为「进度靠前者赢」前向游标（彻底解决双向互翻永不收敛）；非脏数据推送延迟 8s→2s

## [v30] – 2026-09-26

### 词卡页 30s 跟随轮询 + 补拉排队

- 词卡页 30s 跟随轮询与补拉排队（跨设备进度实时跟随）

## [v29] – 2026-09-26

### 页脚版本展示 + 顶版

- 页脚版本展示与 `swVer` / SW CACHE 同步顶升（`v29-2026092615`）

## [v28] – 2026-09-26

### admin 会话隔离回归修复 + 竞态收尾

- 修 admin 会话隔离修复引入的回归（工作台登录态被后台面板覆盖）
- 竞态收尾：`visibilitychange` → visible 分支首次 pull 后 8s 补拉一次（`_visRePullT` 防重入）
- swVer / CACHE `v28-2026092614`

## [v27] – 2026-09-26

### 翻词后主动推送（真根因修复）

- 根因：翻词后从不主动推送 → 远端永远拿不到新词的时间戳，表现为「修好了还不同步」
- 修法：`save()` 尾部派发 `wb-saved` DOM 事件 + 云模块监听防抖 2.5s → `doPush()`；`doPush` 内置 SIG 签名去重（含翻词游标），翻词后约 3.5s 上云、重复调用无副作用

## [v26] – 2026-09-26

### 词卡跨设备「最新单词不同」修复

- `mergeWbSnapshot` 合并域修复（时间戳 LWW 取新）；顺带定位云同步「服务暂不可用」根因 = 本机加速器接管全机流量
- swVer / CACHE `v26-2026092612`（旧代码未加载问题根治：SW 更新激活自动 reload + 刷新横幅 + 新查询串强制拉新 SW）


---
name: cloudbase-cross-device-sync
description: Complete guide for implementing CloudBase cross-device cloud sync in the
  SIELE workbench single-file web app. Covers three scenarios built on the same
  siele-auth cloud function: (1) admin DELE question edits synced to all users via
  getAdminEdits/setAdminEdits on the admin_edits collection, (2) per-user learning
  data synced across devices via pullLearningSession/pushLearningSession on the
  learning_snapshots collection with revision conflict detection and field-level
  mergeWbSnapshot merging, and (3) admin content editing (writing/speaking/essay
  library/topics/oral question bank) via getContentEdits/setContentEdits on the
  content_edits collection with a fully generic namespace. Includes the critical
  CloudBase NoSQL pitfalls (must createCollection first, update() deep-merge
  null-to-object error -> use set(), field-level merge to avoid data overwrite loss,
  calcSig signature must include every new wbSnap field or doPush silently skips)
  and the admin.html iframe postMessage bridge pattern. Use when the user asks to
  add/fix cross-device sync, cloud sync, admin edit propagation, content management
  edits, or learning data sync in this project.
agent_created: true
disable: true
---

# CloudBase 跨设备云同步 — 完整架构与踩坑指南

## Purpose

在 SIELE 备考工作台（单文件 HTML 应用）上实现三类跨设备云同步，三者共用同一个
CloudBase 云函数 `siele-auth` 和同一套 iframe postMessage 桥接：

1. **管理员 DELE 专项编辑覆盖所有用户**（全局共享一份，管理员写、所有用户读）
2. **用户学习数据跨设备/跨 IP 同步**（按 uid 隔离，登录即同步零配置，字段级合并）
3. **管理员内容管理编辑**（写作任务/口语 Tarea/范文库/口语话题/口语真题题库，namespace 通用，覆盖所有用户）

## When to Use

触发场景（含中文）：
- "管理员修改 DELE 题目后所有用户可见" / "管理员编辑同步" / "覆盖到所有用户"
- "跨设备云同步" / "换设备数据同步" / "多端同步学习记录"
- "云同步不生效" / "数据被覆盖丢失" / "错题集同步后消失"
- "管理员编辑写作/口语/范文库/口语话题/口语题库" / "内容管理编辑"
- "CloudBase 云函数" / "learning_snapshots" / "admin_edits" / "content_edits" / "sessionToken 同步"
- 涉及 `cloudfunctions/siele-auth/index.js`、`admin.html` iframe 桥接、主站 `cloudSync`/`mergeWbSnapshot`/`getContentEdits`

## 架构总览

### 关键文件
```
C:\Users\33835\Desktop\西班牙语SIELE\siele-workbench-deploy\
├── cloudfunctions/siele-auth/index.js   # 云函数（唯一后端，全部同步逻辑在此）
├── index.html                            # 主站（~15000 行，核心逻辑在 IIFE 内）
│   ├── 第 14225 行起 IIFE：cloudSync/mergeData/mergeWbSnapshot/AU/ADB（不挂 window）
│   ├── 第 12480 行起：_deleCloudBridgeInit/_delePostToBridge/_deleCloudCall（window.xxx 全局）
│   └── 第 14508 行起：mergeWbSnapshot 字段级合并 + cloudSync
├── admin.html                            # 后台（CloudBase init + iframe 桥接 handler）
└── cloudbaserc.json                      # 含 envVariables（被 .gitignore 忽略，不推仓库）
```

### 鉴权体系（云函数 siele-auth）
- `register`/`login` 返回 `sessionToken`（HMAC-SHA256 签名，14 天有效）
- 鉴权 helper：
  - `requireSession(event)` — 只验签名
  - `requireActiveSession(event)` — 验签名 + 查 user_profiles 确认 status='active'
  - `requireAdmin(event)` — requireActiveSession + role==='admin'
- sessionToken 从 `event.sessionToken || event.token || header.authorization` 读取

### 数据库集合（CloudBase NoSQL）
| 集合 | 用途 | 键 |
|------|------|-----|
| user_profiles | 账号（uid/username/passwordHash/role/status） | uid |
| invite_codes | 邀请码 | code |
| sync_tokens | 独立同步令牌（旧 syncToken 通道，现已基本不用） | tokenHash |
| learning_snapshots | 用户学习数据快照 | uid（revision 乐观锁） |
| admin_edits | 管理员 DELE 编辑（全局一份） | key:"global" |
| content_edits | 管理员内容管理编辑（写作/口语/范文库/话题/题库） | key:namespace 字符串 |

### 前端调用云函数的两条路径
- **主站 index.html 不直接 init CloudBase**（避免暴露 accessKey），通过隐藏 iframe `admin.html` 桥接：
  `index.html 的 window._deleCloudCall() → postMessage → admin.html 的 message handler → callSieleAuth() → app.callFunction({name:'siele-auth',data}) → postMessage 回传结果`
- **admin.html 直接 init CloudBase**（匿名 accessKey 硬编码在 SIELE_CLOUDBASE_CONFIG），`callSieleAuth(data)` 封装 callFunction。

---

## 场景 1：管理员 DELE 编辑覆盖所有用户

### 云函数（siele-auth/index.js）
```javascript
// getAdminEdits: 所有登录用户可读（requireActiveSession）
async function getAdminEdits(event) {
  await requireActiveSession(event);
  let edits = {};
  try {
    const result = await db.collection("admin_edits").where({ key: "global" }).limit(1).get();
    if (result.data.length && result.data[0].edits) edits = result.data[0].edits;
  } catch (e) { edits = {}; }
  return response(true, "ADMIN_EDITS", { edits });
}
// setAdminEdits: 仅管理员可写（requireAdmin），where+add/update 模式（勿用 doc("current")）
async function setAdminEdits(event) {
  await requireAdmin(event);
  const edits = event.edits;
  if (!edits || typeof edits !== "object") return response(false, "INVALID_PAYLOAD");
  if (Buffer.byteLength(JSON.stringify(edits), "utf8") > 1024*1024) return response(false, "PAYLOAD_TOO_LARGE");
  const existing = await db.collection("admin_edits").where({ key: "global" }).limit(1).get();
  if (existing.data.length) {
    await db.collection("admin_edits").doc(existing.data[0]._id).update({ edits, updatedAt: now() });
  } else {
    await db.collection("admin_edits").add({ key: "global", edits, updatedAt: now() });
  }
  return response(true, "ADMIN_EDITS_SAVED");
}
```

### admin.html iframe 桥接（message 事件内）
```javascript
if(ev.data&&ev.data.type==='siele-admin-edits-save'){
  (async function(){
    const token = ev.data.sessionToken || (cloudSession() && cloudSession().sessionToken);
    const result = await callSieleAuth({action:'setAdminEdits', sessionToken: token, edits: ev.data.edits||{}});
  })();
}
if(ev.data&&ev.data.type==='siele-admin-edits-fetch'){
  (async function(){
    const token = ev.data.sessionToken || (cloudSession() && cloudSession().sessionToken);
    const result = await callSieleAuth({action:'getAdminEdits', sessionToken: token});
    const edits = (result&&result.ok&&result.edits) ? result.edits : {};
    window.parent.postMessage({type:'siele-admin-edits-result', edits: edits}, location.origin);
  })();
}
```

### 主站渲染合并
- `_deleAdminEdits` 全局对象，`_deleAdminGetField(key, field, default)` 读取编辑覆盖值
- 编辑 key 格式：`{modelo}_P{prueba}_T{tarea}_Q{q}`（逐题）或 `{modelo}_P{prueba}_T{tarea}`（共享）
- 管理员检测（三重）：① session.role==='admin' ② isMainAdmin() ③ username==='serena'

---

## 场景 2：用户学习数据跨设备同步

### 云函数
```javascript
async function pullLearningSession(event) {
  const { session } = await requireActiveSession(event);
  const result = await db.collection("learning_snapshots").where({ uid: session.uid }).limit(1).get();
  return response(true, "LEARNING_DATA", { snapshot: result.data[0] || null });
}
async function pushLearningSession(event) {
  const { session } = await requireActiveSession(event);
  const uid = session.uid;
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return response(false, "INVALID_PAYLOAD");
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 3*1024*1024) return response(false, "PAYLOAD_TOO_LARGE");
  const revision = Number(event.revision || 0);
  const existing = await db.collection("learning_snapshots").where({ uid }).limit(1).get();
  if (existing.data.length) {
    const current = existing.data[0];
    if (revision !== Number(current.revision || 0)) return response(false, "REVISION_CONFLICT", { snapshot: current });
    const nextRevision = revision + 1;
    // 关键：用 set() 整文档覆盖，勿用 update()（见坑 2）
    await db.collection("learning_snapshots").doc(current._id).set({ uid, payload, revision: nextRevision, updatedAt: now() });
    return response(true, "LEARNING_SAVED", { revision: nextRevision });
  }
  await db.collection("learning_snapshots").add({ uid, payload, revision: 1, updatedAt: now() });
  return response(true, "LEARNING_SAVED", { revision: 1 });
}
```

### 主站 cloudSync（IIFE 内，第 14652 行附近）
流程：`pull → mergeData(ADB, payload) + mergeWbSnapshot(payload.wb.data) → 重序列化 ADB.wb → push（带 revision，REVISION_CONFLICT 时合并重试）`

```javascript
async function cloudSync(silent){
  if(!AU||!ADB||syncing)return;
  var token=window._deleGetSessionToken&&window._deleGetSessionToken();
  if(!token){setChip('local');return;}
  if(ADB.syncCfg&&ADB.syncCfg.provider!=='cloudbase'){await migrateLegacyGist();}
  syncing=true;setChip('ing');
  for(var a=1;a<=3;a++){
    try{
      var pull=await window._deleCloudCall('pull',{});
      if(!pull||pull.ok===false)throw new Error(cloudSyncErrMsg(pull&&pull.code));
      var remote=pull.snapshot;
      if(remote&&remote.payload&&remote.payload.v===1){
        mergeData(ADB,remote.payload);                       // words/questions/reviews/plans 字段级 LWW
        if(remote.payload.wb&&remote.payload.wb.data)mergeWbSnapshot(remote.payload.wb.data); // wb 字段级合并
        ADB.wb={ts:Date.now(),data:wbSnap()};
      }
      var revision=remote?Number(remote.revision||0):0;
      var push=await window._deleCloudCall('push',{revision:revision,payload:serializeCloud(ADB)});
      if(push&&push.ok===false&&push.code==='REVISION_CONFLICT'&&push.snapshot&&push.snapshot.payload){
        mergeData(ADB,push.snapshot.payload);
        if(push.snapshot.payload.wb&&push.snapshot.payload.wb.data)mergeWbSnapshot(push.snapshot.payload.wb.data);
        ADB.wb={ts:Date.now(),data:wbSnap()};
        var retry=await window._deleCloudCall('push',{revision:Number(push.snapshot.revision||0),payload:serializeCloud(ADB)});
        if(!retry||retry.ok===false)throw new Error(cloudSyncErrMsg(retry&&retry.code));
      }else if(!push||push.ok===false){ throw new Error(cloudSyncErrMsg(push&&push.code)); }
      ADB.meta.lastSync=Date.now();ADB.meta.lastPushTs=Date.now();
      lss(dataKey(AU),ADB); hydrate();
      syncing=false;setChip('ok'); return;
    }catch(e){lastErr=e;if(a<3)await new Promise(function(r){setTimeout(r,a*1500);});}
  }
  syncing=false;setChip('err',lastErr&&lastErr.message);
  if(!silent)toast('云同步失败：'+(lastErr&&lastErr.message||'网络异常')+'（已重试3次，点右上角同步角标可重试）','err');
}
```

### 登录后自动启用（activate 内）
```javascript
var _tk=window._deleGetSessionToken&&window._deleGetSessionToken();
if(_tk && !ADB.syncCfg){ ADB.syncCfg={provider:'cloudbase'}; lss(dataKey(AU),ADB); }
```

### iframe 桥接 Request/Response（index.html）
```javascript
window._deleCloudPending = {};
window._deleCloudCall = function(action, params){
  return new Promise(function(resolve, reject){
    var reqId = 'lc' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    window._deleCloudPending[reqId] = {resolve: resolve, reject: reject};
    setTimeout(function(){ if(window._deleCloudPending[reqId]){ delete window._deleCloudPending[reqId]; reject(new Error('云同步请求超时')); } }, 20000);
    window._deleCloudBridgeInit();
    window._delePostToBridge({type:'siele-learning-request', reqId: reqId, action: action, params: params||{}});
  });
};
// message 监听里 resolve：
// if(e.data.type==='siele-learning-result'){ pending=e.data.reqId; ... pending.resolve(e.data.result); }
```

---

## 场景 3：管理员内容管理编辑（content_edits，namespace 完全通用）

**这是最灵活的一层**：管理员对写作任务/口语 Tarea/范文库/口语话题/口语真题题库等任意内容的编辑，全部走同一个集合 `content_edits`，按 `namespace` 字符串分文档。**新增编辑模块时无需改云函数，只需前端加 namespace + activate 拉取 + 渲染合并。**

### 云函数（siele-auth/index.js）
```javascript
// getContentEdits: 所有登录用户可读（requireActiveSession）
async function getContentEdits(event) {
  await requireActiveSession(event);
  const namespace = event.namespace || 'default';
  let edits = {};
  try {
    const result = await db.collection("content_edits").where({ key: namespace }).limit(1).get();
    if (result.data.length && result.data[0].edits) edits = result.data[0].edits;
  } catch (e) { edits = {}; }
  return response(true, "CONTENT_EDITS", { namespace, edits });
}
// setContentEdits: 仅管理员可写（requireAdmin），where+update/add 模式
async function setContentEdits(event) {
  await requireAdmin(event);
  const namespace = event.namespace || 'default';
  const edits = event.edits;
  if (!edits || typeof edits !== "object") return response(false, "INVALID_PAYLOAD");
  if (Buffer.byteLength(JSON.stringify(edits), "utf8") > 2*1024*1024) return response(false, "PAYLOAD_TOO_LARGE");
  const existing = await db.collection("content_edits").where({ key: namespace }).limit(1).get();
  if (existing.data.length) {
    await db.collection("content_edits").doc(existing.data[0]._id).update({ edits, updatedAt: now() });
  } else {
    await db.collection("content_edits").add({ key: namespace, edits, updatedAt: now() });
  }
  return response(true, "CONTENT_EDITS_SAVED");
}
```

### admin.html 桥接（message 事件内，与 admin-edits 同模式）
```javascript
if(ev.data&&ev.data.type==='siele-content-edits-save'){
  (async function(){
    const token = ev.data.sessionToken || (cloudSession() && cloudSession().sessionToken);
    await callSieleAuth({action:'setContentEdits', sessionToken: token, namespace: ev.data.namespace, edits: ev.data.edits||{}});
  })();
}
if(ev.data&&ev.data.type==='siele-content-edits-fetch'){
  (async function(){
    const token = ev.data.sessionToken || (cloudSession() && cloudSession().sessionToken);
    const result = await callSieleAuth({action:'getContentEdits', sessionToken: token, namespace: ev.data.namespace});
    const edits = (result&&result.ok&&result.edits) ? result.edits : {};
    window.parent.postMessage({type:'siele-content-edits-result', namespace: ev.data.namespace, edits: edits}, location.origin);
  })();
}
```

### 主站（index.html）
```javascript
// 初始化（全局）
window._contentEdits = { writing:{tasks:null,essays:{}}, oral:{}, essays:{}, speakingTopics:{}, tareas:{}, oralbank:{}, verbUsage:{}, grammar:{} };
// 拉取（activate 内，登录后 setTimeout 逐个拉 namespace）
window._deleFetchContentEdits('writing'); // oral / essays / speakingTopics / tareas / oralbank / verbUsage / grammar
// 保存（管理员编辑面板 save 时调用）
window._deleSyncContentEdits(namespace, editsObj);
// 合并读取（每模块一个 getXxx()，edits > 默认）
function getSieleOralBank(){
  var ed = window._contentEdits && window._contentEdits.oralbank;
  if(ed && ed.bank && typeof ed.bank==='object'){ /* 用 ed.bank */ }
  return SIELE_ORAL_BANK;
}
```

### 已用 namespace 与模式（截至 2026-08-14）
| namespace | 内容 | 数据形状 |
|-----------|------|---------|
| writing | 写作任务列表 | `{tasks:[...], essays:{...}}` |
| oral | 口语模板库 SIELE_ORAL_TEMPLATES | `{tareas:[...]}` |
| tareas | 考试结构卡片 SIELE_TAREAS | `{tareas:[...]}` |
| essays | 范文库 SIELE_WRITING_ESSAYS | `{essays:[...]}` |
| speakingTopics | 16 个口语话题 | `{topics:[...]}`（含 essay 范文字段） |
| oralbank | 口语真题题库 SIELE_ORAL_BANK（约230题） | `{bank:{1:[],2:[],3:[],4:[],5:[]}}` 全量覆盖 |
| verbUsage | 动词用法详解·易混词辨析 VERB_USAGE（29条） | `{list:{词条:{zh,discrimination,collocations[],commonErrors,phrases[]}}}` 全量覆盖 |
| grammar | 语法库 GDATA+GRAMMAR_EXTRA（98点） | `{overrides:{标题:{d,ex,detail}}, added:[{lvl,t,...}], deleted:[标题]}` 增量 |

**标准模式**：`getXxx()`（edits>默认合并读取）+ `renderXxxAdmin()`/`saveXxxAdmin()`（批量页）+ `isContentAdmin()`（管理员按钮显隐）+ **就地编辑**（`_showEditModal` 通用弹框 + `_oralInlineSave` 按 `data-ns` 分发保存）。

**编辑粒度按数据形状选**：小数据集（verbUsage 29 条、oralbank 230 题）→ **整库覆盖**（`list`/`bank` 全量存）；分组/大结构（grammar 98 点 GDATA 分组）→ **overrides + added + deleted 增量**（不整库覆盖）。改标题类操作 = 旧键进 deleted + 新键进 added（overrides 用标题作键，改键会失配）。

### 关键规则：范文优先级 用户 > 管理员 > 默认
写作范文（`writing_essay_edit_<id>`）和口语话题范文（`essay` 字段）都是：**用户自编辑 > 管理员 content_edits > 系统默认**。管理员覆盖不得冲掉用户已编辑的内容。AI 生成范文走客户端模板（`generateModelEssay`），管理员点按钮即时生成填入文本框，无需后端。

---

## 字段级合并 mergeWbSnapshot（防数据丢失的核心）

**根因教训**：`wb` 字段（错题集 errors/打卡 checkIns/每日任务 dailyTodos/口语评分 sieleOralScores/掌握度 vocabMastery 等全部工作台状态）若用"整体覆盖"（谁 ts 新谁整个对象覆盖对方），会导致一端新增错题被另一端旧数据冲掉。

**正确做法**：逐字段智能合并（函数在 index.html 第 14508 行附近）：

| 字段 | 合并策略 |
|------|---------|
| errors 错题集 | question+date 去重，reviewed 取或，上限 200 |
| checkIns 打卡 | 并集去重排序 |
| dailyTodos 每日任务 | date-keyed map 合并（兼容旧数组格式） |
| vocabMastery/掌握度 | 逐词取 max |
| flashProgressByLevel 等进度 | 逐级取 max |
| vocabReviewCount 复习计数 | 逐桶取 max（兼容 nested/flat） |
| sieleOralScores 口语评分 | mergeSieleOralScore LWW |
| dictationErrorBank 错词库 | es+userAnswer 去重，上限 200 |
| recentlyStudiedWords | 并集，保留 10 个 |
| streak/totalStudy | 取 max |
| deleProgress | 按 scope LWW |
| refineQuizState 外刊做题统计 | date+level 取 submitted/correct 最大 |
| refineQuizData 外刊笔记+答案 | notes 按 notesTs LWW，attempts 按 id 并集，写回 RefineQuizDB |
| quizHistory 题库做题进度 | 按题目内容唯一键（quizQuestionKey）并集 + ts LWW |
| writing_* 用户写作 | 本地优先（本地已写保留，远端有且本地空才采用） |
| examDate/examType/targetLevel | 时间戳 LWW（examDateTs/examTypeTs/targetLevelTs），**不能"远端非空覆盖"** |
| weeklyPlan/weeklyGoals 周计划 | LWW（null=用默认） |

---

## 关键踩坑（务必牢记）

1. **新集合必须先 createCollection**：CloudBase 云函数 `add()` 不会自动建集合；`where` 查询不存在的集合直接抛异常。用 MCP `writeNoSqlDatabaseStructure(action=createCollection)` 或控制台先建 `learning_snapshots`/`admin_edits`。

2. **update() 深度合并坑 → 用 set()**：`doc(id).update({payload})` 对嵌套对象深度合并，字段从 `null` 变对象时报 `Cannot create field 'x' in element {field: null}` → `DATABASE_REQUEST_FAILED`。**解法：`doc(id).set({uid,payload,revision,updatedAt})` 整文档覆盖**（pushLearning 与 pushLearningSession 都已改）。

3. **wb 必须字段级合并，不能整体覆盖**（见上文 mergeWbSnapshot），否则跨设备数据互相冲掉。

4. **CloudBase 日志"调用成功"(HTTP 202) 是假象**：它只表示函数被触发，业务错误要看返回的 `code`。诊断要用 `tcb fn invoke` 看完整 `Return result`（含详细 message，如上面的 Cannot create field）。

5. **主站核心逻辑在 IIFE 内**（index.html 第 14225 行起），`let ST`/`cloudSync`/`mergeData`/`AU`/`ADB` 不挂 window；Playwright 测 ST 须用 `typeof ST!=='undefined'` 而非 `window.ST`。跨层调用要走 `window._deleCloudCall` 等 window.xxx 全局函数。

6. **Playwright 注入 localStorage 后 reload 会触发 beforeunload save() 覆盖**：注入数据须同时更新内存 ST（`ST.errors=...`），否则 save() 用旧内存值覆盖注入。

7. **revision 乐观锁**：push 带 revision，云端不一致返回 REVISION_CONFLICT + snapshot，前端 mergeData 后带新 revision 重试。

8. **云函数部署**：`tcb fn deploy siele-auth --dir cloudfunctions/siele-auth --env-id siele-prod-d2g15w3ug65796f47 --force`；CLI 在 `/c/Users/33835/.workbuddy/binaries/node/cli-connector-packages/tcb`；cloudbaserc.json 含 envVariables（SESSION_SECRET/PASSWORD_PEPPER 等，被 .gitignore 忽略，部署不会丢）。

9. **calcSig 签名漏项 → doPush 静默跳过**：`doPush()` 里用 `calcSig()` 判断 `s2===SIG` 认为"无变化"就提前 return。**任何进入 wbSnap 快照的新字段，必须同时：① 加入 calcSig 签名 ② 加入 mergeWbSnapshot 合并 ③ 若存独立 localStorage 键则加入 wbSnap 序列化读取。三处缺一即丢数据**（曾因漏 calcSig 导致外刊做题记录永远 push 不上云）。

10. **外刊精炼有三套存储**：`ST.refineQuizState`（做题统计）+ `RefineQuizDB`（localStorage `swa_quiz_v1`，笔记+答案历史）+ 旧 `refine_notes_v1`（遗留）。noteKey 是 `refine_note_<日期>_<级别>`，`split('_')` 只有 4 段（日期 `2026-08-13` 含 `-` 但不含 `_`），解析判断写 `>=5` 是 bug（应 `>=4`），会导致笔记永远走旧存储回退。

11. **低频设置字段必须时间戳 LWW**：examDate/examType/targetLevel 若用"远端非空就覆盖本地"，会导致本机刚设的新值在 cloudSync pull 时被云端旧值冲掉、新值永远推不上去。解法：设置时记 `xxxTs` 时间戳，合并时比较 ts。

12. **isMainAdmin 在 IIFE 内、模块在 IIFE 外**：写作/口语等全局渲染模块需要管理员判断时，必须用全局 `isContentAdmin()`（IIFE 外定义），不能用 IIFE 内的 `isMainAdmin()`，否则跨作用域 ReferenceError。

13. **题库/内容编辑用全量覆盖存储**：约 230 题的 SIELE_ORAL_BANK 等管理员编辑结果，直接整库覆盖存 content_edits（远小于 2MB 限制），比增量 diff 简单可靠、不易出边界 bug。合并读取用 `getXxx()`（edits > 默认）。

---

## 部署与验证

### 部署
```bash
cd "C:/Users/33835/Desktop/西班牙语SIELE/siele-workbench-deploy"
node --check cloudfunctions/siele-auth/index.js
"/c/Users/33835/.workbuddy/binaries/node/cli-connector-packages/tcb" fn deploy siele-auth --dir cloudfunctions/siele-auth --env-id siele-prod-d2g15w3ug65796f47 --force
```

### 云函数层验证（tcb invoke）
```bash
# login 拿 sessionToken（lili/123456）
tcb fn invoke siele-auth --env-id siele-prod-... --params '{"action":"login","username":"lili","password":"123456"}'
# pull（无 session 应返回 UNAUTHORIZED 而非 UNKNOWN_ACTION，证明 action 已注册）
tcb fn invoke siele-auth --params '{"action":"pullLearningSession"}'
# push（带 sessionToken + revision）
tcb fn invoke siele-auth --params '{"action":"pushLearningSession","sessionToken":"<TOKEN>","revision":0,"payload":{...}}'
```

### 端到端测试（Playwright，本地起服务器）
```bash
cd "C:/Users/33835/Desktop/西班牙语SIELE/siele-workbench-deploy"
python -m http.server 8765 --bind 127.0.0.1 &
cd "C:/Users/33835/Desktop/西班牙语SIELE/siele-test"
NODE_PATH="C:/Users/33835/.workbuddy/binaries/node/workspace/node_modules" \
  "/c/Users/33835/.workbuddy/binaries/node/versions/22.22.2/node.exe" test_cloud_sync_error_merge.js
```
- `test_cloud_sync_lili.js`：登录即同步 + 跨设备数据完整性（3词+复习记录+打卡恢复）
- `test_cloud_sync_error_merge.js`：字段级合并回归（本地4道错题 vs 云端2道 → 合并后4道不丢失）

### 已部署状态（截至 2026-08-14）
- 云函数 `siele-auth` 已含 pullLearningSession/pushLearningSession/getAdminEdits/setAdminEdits/getContentEdits/setContentEdits
- 集合 learning_snapshots、admin_edits、content_edits 均已创建
- 关键 commit：
  - 246a16a（sessionToken 通道切换）、372c207（set 修复 null→对象）
  - cc8d398（wb 字段级合并）、fa5aadf（content_edits + 考试日期 LWW + 做题进度 + 写作/口语编辑）
  - e969ae0（外刊笔记+做题记录同步三重断点修复）
  - 63dc606（11 项修复：倒数日期 LWW/口语 Tarea 编辑/DELE 菜单重构/周计划编辑等）
  - 26d5286（口语真题题库 CRUD + 口语话题范文）

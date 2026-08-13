---
name: cloudbase-cross-device-sync
description: Complete guide for implementing CloudBase cross-device cloud sync in the
  SIELE workbench single-file web app. Covers two scenarios built on the same
  siele-auth cloud function: (1) admin DELE question edits synced to all users via
  getAdminEdits/setAdminEdits on the admin_edits collection, and (2) per-user learning
  data synced across devices via pullLearningSession/pushLearningSession on the
  learning_snapshots collection with revision conflict detection and field-level
  mergeWbSnapshot merging. Includes the critical CloudBase NoSQL pitfalls (must
  createCollection first, update() deep-merge null-to-object error -> use set(),
  field-level merge to avoid data overwrite loss) and the admin.html iframe
  postMessage bridge pattern. Use when the user asks to add/fix cross-device sync,
  cloud sync, admin edit propagation, or learning data sync in this project.
agent_created: true
disable: false
---

# CloudBase 跨设备云同步 — 完整架构与踩坑指南

## Purpose

在 SIELE 备考工作台（单文件 HTML 应用）上实现两类跨设备云同步，二者共用同一个
CloudBase 云函数 `siele-auth` 和同一套 iframe postMessage 桥接：

1. **管理员 DELE 专项编辑覆盖所有用户**（全局共享一份，管理员写、所有用户读）
2. **用户学习数据跨设备/跨 IP 同步**（按 uid 隔离，登录即同步零配置，字段级合并）

## When to Use

触发场景（含中文）：
- "管理员修改 DELE 题目后所有用户可见" / "管理员编辑同步" / "覆盖到所有用户"
- "跨设备云同步" / "换设备数据同步" / "多端同步学习记录"
- "云同步不生效" / "数据被覆盖丢失" / "错题集同步后消失"
- "CloudBase 云函数" / "learning_snapshots" / "admin_edits" / "sessionToken 同步"
- 涉及 `cloudfunctions/siele-auth/index.js`、`admin.html` iframe 桥接、主站 `cloudSync`/`mergeWbSnapshot`

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
| admin_edits | 管理员编辑（全局一份） | key:"global" |

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

### 已部署状态（截至 2026-08-13）
- 云函数 `siele-auth` 已含 pullLearningSession/pushLearningSession/getAdminEdits/setAdminEdits
- 集合 learning_snapshots、admin_edits 均已创建
- 推送 commit：246a16a（通道切换）、372c207（set 修复）、cc8d398（字段级合并）

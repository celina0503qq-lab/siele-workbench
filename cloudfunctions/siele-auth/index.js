"use strict";

const cloudbase = require("@cloudbase/node-sdk");
const crypto = require("crypto");

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const cmd = db.command;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "https://celina0503qq-lab.github.io";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
// 邀请码从环境变量 INVITE_CODES 读取（逗号分隔），避免明文泄露在公开仓库源码中。
// 环境变量在 cloudbaserc.json 的 envVariables 里配置（该文件被 .gitignore 忽略，不入公开仓库）。
const INVITE_CODES = new Set(
  (process.env.INVITE_CODES || "").split(",").map(function(s){ return s.trim(); }).filter(Boolean)
);
// VERDE/ROJO 曾仅存于浏览器本地，无法证明历史占用归属；为防止再次被利用，首次云端初始化时永久停用。
const LEGACY_REVOKED_INVITES = new Set(["SIELE-2026-VERDE", "SIELE-2026-ROJO"]);

// ========================================================================
// 应用层 QPS 限流（滑动窗口）—— 缓解 accessKey 泄露后的滥用风险
// 设计：
//   - 全局 30 QPS（突发容忍）
//   - 单 IP 5 QPS（防单点滥用）
//   - 滑动窗口：保留每个 key 最近 1s 的请求时间戳
//   - 健康检查 / 限流豁免名单跳过限流
//   - 命中限流：返回 RATE_LIMITED + 同步写 security_audit
//   - 审计记录在并发下可能丢失个别条目，限流决策不受影响
// 注：实例级内存限流，在多实例部署下窗口精度受实例数影响。
//     目前是 1 实例运行，影响可控；如未来扩到多实例，
//     可将计数器下沉到 Redis/CloudBase Redis。
// ========================================================================
const RATE_LIMIT_CONFIG = {
  GLOBAL_QPS: 30,
  PER_IP_QPS: 5,
  WINDOW_MS: 1000,
  EXEMPT_ACTIONS: new Set(["health"])
};
const _rateBuckets = { global: [], perIp: new Map() };
// 限流审计队列：模块作用域，并发请求间共享。
// 竞态可能造成"被限流事件的审计记录"丢失，但不影响限流决策本身（_rateBuckets 是决策源）。
// 若需精准审计，可下沉到 DB collection.add 的乐观锁，但当前规模不必要。
let _rateAuditQueue = [];

function _extractClientIp(event) {
  const tryGet = (obj, keys) => {
    if (!obj || typeof obj !== "object") return null;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  };
  const ip = tryGet(event, ["clientIP", "clientIp", "ip"])
    || tryGet(event && event.headers, ["x-forwarded-for", "X-Forwarded-For", "x-real-ip", "X-Real-IP", "client-ip", "Client-IP"])
    || tryGet(event && event.queryStringParameters, ["clientIP", "clientIp", "ip"])
    || tryGet(event && event.context, ["sourceIp", "clientIp", "clientIP"])
    || tryGet(event && event.userInfo, ["clientIp", "clientIP"])
    || "unknown";
  return String(ip).split(",")[0].trim() || "unknown";
}

function _rateLimitCheck(clientIp) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_CONFIG.WINDOW_MS;
  const globalArr = _rateBuckets.global;
  while (globalArr.length && globalArr[0] < windowStart) globalArr.shift();
  const ipArr = _rateBuckets.perIp.get(clientIp) || [];
  const ipArrLive = [];
  for (let i = 0; i < ipArr.length; i++) {
    if (ipArr[i] >= windowStart) ipArrLive.push(ipArr[i]);
  }
  if (globalArr.length >= RATE_LIMIT_CONFIG.GLOBAL_QPS) {
    return { allowed: false, scope: "global", limit: RATE_LIMIT_CONFIG.GLOBAL_QPS };
  }
  if (ipArrLive.length >= RATE_LIMIT_CONFIG.PER_IP_QPS) {
    return { allowed: false, scope: "ip", limit: RATE_LIMIT_CONFIG.PER_IP_QPS, clientIp };
  }
  globalArr.push(now);
  _rateBuckets.perIp.set(clientIp, ipArrLive.concat([now]));
  if (_rateBuckets.perIp.size > 1000) {
    const keys = Array.from(_rateBuckets.perIp.keys());
    for (let i = 0; i < keys.length - 800; i++) {
      const k = keys[i];
      const arr = _rateBuckets.perIp.get(k);
      if (!arr || arr.length === 0 || arr[arr.length - 1] < windowStart) {
        _rateBuckets.perIp.delete(k);
      }
    }
  }
  return { allowed: true };
}

function _enqueueRateAudit(scope, clientIp, action) {
  // CloudBase 事件函数在 main 返回后可能冻结实例，因此必须 await 写完。
  // 用 fire-and-forget 队列记录"本次需要写"的事实，由 main 在限流分支里 await 完成。
  _rateAuditQueue.push({ scope, clientIp, action });
}

async function _flushRateAudit() {
  if (_rateAuditQueue.length === 0) return;
  const batch = _rateAuditQueue.splice(0, _rateAuditQueue.length);
  try {
    await db.collection("security_audit").add({ type: "rate_limited", scope: batch[0].scope, clientIp: batch[0].clientIp, action: batch[0].action, count: batch.length, at: Date.now() });
  } catch (e) {
    console.error("rate_limit_audit_write_failed", { count: batch.length, error: e && e.message });
  }
}

// 模块作用域状态缓存：uid -> { status, role, checkedAt }
// 用来在已签发 session 的高频请求里避免每次都打 DB。
// TTL 60s；命中 USER_DISABLED 时立即失效以保证响应迅速。
const USER_STATUS_CACHE = new Map();
const USER_STATUS_CACHE_TTL_MS = 60000;
function _getCachedUserStatus(uid) {
  const entry = USER_STATUS_CACHE.get(uid);
  if (!entry) return null;
  if (entry.status === "disabled") return entry; // 命中黑名单，永不自动过期
  if (Date.now() - entry.checkedAt > USER_STATUS_CACHE_TTL_MS) {
    USER_STATUS_CACHE.delete(uid);
    return null;
  }
  return entry;
}
function _setCachedUserStatus(uid, status, role) {
  USER_STATUS_CACHE.set(uid, { status, role: role || "learner", checkedAt: Date.now() });
}
function _invalidateUserStatus(uid) {
  if (uid) USER_STATUS_CACHE.delete(uid);
}
// 查 DB 拿 (status, role)；为避免每个 action 两次 DB 调用，缓存 60s。
async function _lookupUserStatus(uid) {
  const cached = _getCachedUserStatus(uid);
  if (cached) return cached;
  const result = await db.collection("user_profiles").where({ uid }).limit(1).get();
  if (!result.data.length) return null;
  const user = result.data[0];
  const entry = { status: user.status === "disabled" ? "disabled" : "active", role: user.role === "admin" ? "admin" : "learner", checkedAt: Date.now() };
  _setCachedUserStatus(uid, entry.status, entry.role);
  return entry;
}

function response(ok, code, data) { return { ok, code, ...(data || {}) }; }
function normalizeUsername(value) { return String(value || "").trim(); }
function normalizeInvite(value) { return String(value || "").trim().toUpperCase(); }
function validUsername(value) {
  return /^[\w\u4e00-\u9fa5]{2,20}$/.test(value) || /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}
function passwordHash(password, salt) {
  return crypto.scryptSync(String(password) + "::" + PASSWORD_PEPPER, salt, 64).toString("base64url");
}
function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}
function parseSession(token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return parsed.exp > Date.now() ? parsed : null; } catch (e) { return null; }
}
function issueSession(uid, username, role) {
  return signSession({ uid, username, role: role || "learner", exp: Date.now() + TOKEN_TTL_SECONDS * 1000 });
}
function tokenHash(value) { return crypto.createHash("sha256").update(value).digest("base64url"); }
function randomToken() { return "siele_sync_" + crypto.randomBytes(32).toString("base64url"); }
function now() { return Date.now(); }
function requireSession(event) {
  const token = event && (event.sessionToken || event.token || (event.headers && event.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  const session = parseSession(token);
  if (!session) { const err = new Error("UNAUTHORIZED"); err.code = "UNAUTHORIZED"; throw err; }
  return session;
}
// requireSession 的加强版：除签名外还会校验用户当前 status='active'。
// 停用用户的 session 立即失效；前端捕获 USER_DISABLED 后清理本地登录态。
async function requireActiveSession(event) {
  const session = requireSession(event);
  const profile = await _lookupUserStatus(session.uid);
  if (!profile) { const err = new Error("UNAUTHORIZED"); err.code = "UNAUTHORIZED"; throw err; }
  if (profile.status === "disabled") {
    const err = new Error("USER_DISABLED"); err.code = "USER_DISABLED"; throw err;
  }
  return { session, profile };
}
async function requireAdmin(event) {
  const { session, profile } = await requireActiveSession(event);
  if (profile.role !== "admin") { const err = new Error("FORBIDDEN"); err.code = "FORBIDDEN"; throw err; }
  return { uid: session.uid, session, profile };
}

async function ensureInviteSeed() {
  for (const code of INVITE_CODES) {
    const got = await db.collection("invite_codes").where({ code }).limit(1).get();
    if (!got.data.length) {
      const revoked = LEGACY_REVOKED_INVITES.has(code);
      await db.collection("invite_codes").add({ code, status: revoked ? "disabled" : "unused", usedBy: null, usedAt: revoked ? now() : null, createdAt: now(), reason: revoked ? "legacy_local_storage_status_unknown" : null });
    }
  }
}

async function register(event) {
  const username = normalizeUsername(event.username);
  const password = String(event.password || "");
  const inviteCode = normalizeInvite(event.inviteCode);
  if (!validUsername(username)) return response(false, "INVALID_USERNAME");
  if (password.length < 6) return response(false, "WEAK_PASSWORD");
  if (!INVITE_CODES.has(inviteCode)) return response(false, "INVALID_INVITE");
  const uid = "usr_" + crypto.randomUUID().replace(/-/g, "");
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = passwordHash(password, salt);
  try {
    await db.runTransaction(async transaction => {
      const existing = await transaction.collection("user_profiles").where({ username }).limit(1).get();
      if (existing.data.length) { const err = new Error("USERNAME_TAKEN"); err.code = "USERNAME_TAKEN"; throw err; }
      const invite = await transaction.collection("invite_codes").where({ code: inviteCode }).limit(1).get();
      if (!invite.data.length || invite.data[0].status !== "unused") { const err = new Error("INVITE_USED"); err.code = "INVITE_USED"; throw err; }
      await transaction.collection("invite_codes").doc(invite.data[0]._id).update({ status: "used", usedBy: uid, usedAt: now() });
      await transaction.collection("user_profiles").add({ uid, username, passwordSalt: salt, passwordHash: hash, inviteCode, createdAt: now(), lastLoginAt: now(), status: "active", role: "learner" });
      await transaction.collection("security_audit").add({ type: "register", uid, username, inviteCode, at: now() });
    });
    return response(true, "REGISTERED", { uid, username, role: "learner", sessionToken: issueSession(uid, username, "learner") });
  } catch (e) { return response(false, e.code || "REGISTER_FAILED"); }
}

// 登录失败锁定：同账号连续失败 5 次锁 15 分钟（防暴力破解）
// 登录失败锁定：同账号连续失败 5 次锁 15 分钟（防暴力破解）
// 计数持久化到 user_profiles 文档（failedLoginAttempts / lockedUntil 字段），
// 多实例/实例回收下依然准确（内存 Map 方案在多实例下计数会丢失，故弃用）。
// 锁定期内返回 LOCKED + retryAfterMs；登录成功即清除计数。
const LOGIN_LOCK_CONFIG = { MAX_ATTEMPTS: 5, LOCK_MS: 15 * 60 * 1000 };
async function _getLoginLock(username) {
  const found = await db.collection("user_profiles").where({ username }).limit(1).get();
  if (!found.data.length) return 0;
  const lockedUntil = found.data[0].lockedUntil || 0;
  if (lockedUntil > Date.now()) return lockedUntil;
  return 0;
}
// 记录一次登录失败；返回本次是否触发锁定（>0 表示已锁定，值为锁到期时间戳）
async function _recordLoginFail(username) {
  const found = await db.collection("user_profiles").where({ username }).limit(1).get();
  if (!found.data.length) return 0; // 不存在的账号不计数（爆破目标是有效账号）
  const u = found.data[0];
  const fail = (u.failedLoginAttempts || 0) + 1;
  let lockUntil = 0;
  if (fail >= LOGIN_LOCK_CONFIG.MAX_ATTEMPTS) {
    lockUntil = Date.now() + LOGIN_LOCK_CONFIG.LOCK_MS;
    await db.collection("user_profiles").doc(u._id).update({ failedLoginAttempts: 0, lockedUntil: lockUntil, lastFailedAt: Date.now() });
    try { await db.collection("security_audit").add({ type: "login_locked", username, at: Date.now() }); } catch (e) {}
  } else {
    await db.collection("user_profiles").doc(u._id).update({ failedLoginAttempts: fail, lastFailedAt: Date.now() });
  }
  return lockUntil;
}
async function _clearLoginLock(username) {
  const found = await db.collection("user_profiles").where({ username }).limit(1).get();
  if (!found.data.length) return;
  await db.collection("user_profiles").doc(found.data[0]._id).update({ failedLoginAttempts: 0, lockedUntil: null });
}

async function login(event) {
  const username = normalizeUsername(event.username);
  const password = String(event.password || "");
  const lockedUntil = await _getLoginLock(username);
  if (lockedUntil) return response(false, "LOCKED", { retryAfterMs: Math.max(0, lockedUntil - Date.now()) });
  const found = await db.collection("user_profiles").where({ username, status: "active" }).limit(1).get();
  if (!found.data.length) return response(false, "INVALID_CREDENTIALS");
  const user = found.data[0];
  const candidate = passwordHash(password, user.passwordSalt);
  if (candidate.length !== user.passwordHash.length || !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) {
    const newLock = await _recordLoginFail(username);
    if (newLock) return response(false, "LOCKED", { retryAfterMs: Math.max(0, newLock - Date.now()) });
    return response(false, "INVALID_CREDENTIALS");
  }
  await _clearLoginLock(username);
  await db.collection("user_profiles").doc(user._id).update({ lastLoginAt: now() });
  await db.collection("security_audit").add({ type: "login", uid: user.uid, username, at: now() });
  const role = user.role === "admin" ? "admin" : "learner";
  return response(true, "LOGGED_IN", { uid: user.uid, username: user.username, role, sessionToken: issueSession(user.uid, user.username, role) });
}

// 用原密码换新密码：要求已登录 + 旧密码哈希匹配 + 强密码约束
// 任何已签发 session 在改密后保留（session 本身没有密码信息），用户可在其他设备用新密码重登。
// 如需强制踢出其他设备，可继续调用 adminRevokeUserSyncTokens。
async function changePasswordWithOld(event) {
  const { session } = await requireActiveSession(event);
  const oldPassword = String(event.oldPassword || "");
  const newPassword = String(event.newPassword || "");
  if (newPassword.length < 6) return response(false, "WEAK_PASSWORD");
  if (oldPassword === newPassword) return response(false, "PWD_SAME_AS_OLD");
  const found = await db.collection("user_profiles").where({ uid: session.uid }).limit(1).get();
  if (!found.data.length) return response(false, "PWD_USER_NOT_FOUND");
  const user = found.data[0];
  if (user.status === "disabled") return response(false, "PWD_USER_DISABLED");
  const candidate = passwordHash(oldPassword, user.passwordSalt);
  if (candidate.length !== user.passwordHash.length || !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) return response(false, "PWD_OLD_MISMATCH");
  const newSalt = crypto.randomBytes(16).toString("base64url");
  const newHash = passwordHash(newPassword, newSalt);
  await db.collection("user_profiles").doc(user._id).update({ passwordSalt: newSalt, passwordHash: newHash, passwordUpdatedAt: now() });
  await db.collection("security_audit").add({ type: "password_changed", uid: session.uid, username: session.username, method: "old_password", at: now() });
  return response(true, "PASSWORD_CHANGED");
}

// 用注册时的邀请码重置密码（无 session 入口，专为忘记密码 / 新设备登录设计）
// 强约束：必须与该用户档案入库时使用的 inviteCode 严格一致（不区分大小写、走 normalizeInvite）
// 这样攻击者无法用自己持有的任何邀请码重置别人的密码。
async function resetPasswordWithInvite(event) {
  const username = normalizeUsername(event.username);
  const newPassword = String(event.newPassword || "");
  const inviteCode = normalizeInvite(event.inviteCode);
  if (!validUsername(username)) return response(false, "INVALID_USERNAME");
  if (newPassword.length < 6) return response(false, "WEAK_PASSWORD");
  if (!INVITE_CODES.has(inviteCode)) return response(false, "INVALID_INVITE");
  const found = await db.collection("user_profiles").where({ username }).limit(1).get();
  if (!found.data.length) return response(false, "PWD_USER_NOT_FOUND");
  const user = found.data[0];
  if (user.status === "disabled") return response(false, "USER_DISABLED");
  // 用户档案里的 inviteCode 是注册时使用的唯一标识，必须与本次输入严格匹配
  if (normalizeInvite(user.inviteCode || "") !== inviteCode) return response(false, "PWD_INVITE_MISMATCH");
  const newSalt = crypto.randomBytes(16).toString("base64url");
  const newHash = passwordHash(newPassword, newSalt);
  await db.collection("user_profiles").doc(user._id).update({ passwordSalt: newSalt, passwordHash: newHash, passwordUpdatedAt: now() });
  await db.collection("security_audit").add({ type: "password_reset", uid: user.uid, username, method: "invite_code", at: now() });
  return response(true, "PASSWORD_RESET");
}

async function createSyncToken(event) {
  const { session } = await requireActiveSession(event);
  const label = String(event.label || "未命名设备").slice(0, 60);
  const plainToken = randomToken();
  await db.collection("sync_tokens").add({ uid: session.uid, tokenHash: tokenHash(plainToken), label, createdAt: now(), lastUsedAt: null, revokedAt: null });
  await db.collection("security_audit").add({ type: "sync_token_created", uid: session.uid, label, at: now() });
  return response(true, "SYNC_TOKEN_CREATED", { syncToken: plainToken, label });
}
async function listSyncTokens(event) {
  const { session } = await requireActiveSession(event);
  const result = await db.collection("sync_tokens").where({ uid: session.uid }).orderBy("createdAt", "desc").get();
  return response(true, "SYNC_TOKENS", { tokens: result.data.map(t => ({ id: t._id, label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt })) });
}
async function revokeSyncToken(event) {
  const { session } = await requireActiveSession(event);
  const id = String(event.id || "");
  const item = await db.collection("sync_tokens").doc(id).get();
  if (!item.data || item.data.uid !== session.uid) return response(false, "NOT_FOUND");
  await db.collection("sync_tokens").doc(id).update({ revokedAt: now() });
  return response(true, "SYNC_TOKEN_REVOKED");
}
async function syncAuth(event) {
  const plainToken = String(event.syncToken || "");
  const found = await db.collection("sync_tokens").where({ tokenHash: tokenHash(plainToken), revokedAt: null }).limit(1).get();
  if (!found.data.length) return null;
  const item = found.data[0];
  // syncAuth 走的是 sync_token（不是 session），验证 token 有效后还要确认其所属用户仍处于 active。
  // 否则管理员停用后该用户仍可凭已签发的 sync_token 拉/推云端数据。
  const profile = await _lookupUserStatus(item.uid);
  if (!profile || profile.status === "disabled") return null;
  await db.collection("sync_tokens").doc(item._id).update({ lastUsedAt: now() });
  return item.uid;
}
async function pullLearning(event) {
  const uid = await syncAuth(event); if (!uid) return response(false, "INVALID_SYNC_TOKEN");
  const result = await db.collection("learning_snapshots").where({ uid }).limit(1).get();
  return response(true, "LEARNING_DATA", { snapshot: result.data[0] || null });
}
// 轻量心跳检查：主工作台每 60s 调一次，确认当前 session 对应的用户仍处于 active。
// 不返回敏感数据，只返回 {active:true|false}。disabled 时返回 USER_DISABLED 让前端踢出。
async function checkStatus(event) {
  const { session, profile } = await requireActiveSession(event);
  return response(true, "STATUS_OK", { active: true, role: profile.role, checkedAt: Date.now() });
}
async function adminListUsers(event) {
  await requireAdmin(event);
  // 部分 CloudBase 文档数据库运行时不支持无过滤条件的 orderBy；先读取受限集合，再在内存中稳定排序。
  const result = await db.collection("user_profiles").limit(100).get();
  const users = result.data.map((user) => ({
    id: user._id,
    uid: user.uid,
    username: user.username,
    role: user.role === "admin" ? "admin" : "learner",
    status: user.status === "disabled" ? "disabled" : "active",
    inviteCode: user.inviteCode || "",
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  })).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  return response(true, "ADMIN_USERS", { users });
}

// 管理员查询当前所有邀请码及其使用状态
async function adminListInvites(event) {
  await requireAdmin(event);
  const result = await db.collection("invite_codes").limit(100).get();
  const invites = result.data.map((doc) => ({
    code: doc.code,
    status: doc.status || "unused",
    usedBy: doc.usedBy || null,
    usedAt: doc.usedAt || null,
    createdAt: doc.createdAt || null
  })).sort((a, b) => {
    // unused 优先，然后按创建时间倒序
    if (a.status === "unused" && b.status !== "unused") return -1;
    if (a.status !== "unused" && b.status === "unused") return 1;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
  return response(true, "ADMIN_INVITES", { invites });
}
async function adminSetUserStatus(event) {
  const admin = await requireAdmin(event);
  const uid = String(event.uid || "");
  const status = event.status === "disabled" ? "disabled" : "active";
  if (!uid) return response(false, "INVALID_USER");
  if (uid === admin.uid && status === "disabled") return response(false, "CANNOT_DISABLE_SELF");
  const found = await db.collection("user_profiles").where({ uid }).limit(1).get();
  if (!found.data.length) return response(false, "USER_NOT_FOUND");
  await db.collection("user_profiles").doc(found.data[0]._id).update({ status, statusUpdatedAt: now() });
  // 关键：使该用户全部已签发 session 立即失效。
  // 通过清理模块作用域 USER_STATUS_CACHE，让下一次 requireActiveSession 直接打 DB 拿到 status='disabled' → USER_DISABLED。
  // 注意：HTTP session 是无状态的（仅靠 HMAC 签名校验过期时间），DB 查询是唯一的"撤销"手段。
  _invalidateUserStatus(uid);
  if (status === "disabled") {
    const tokens = await db.collection("sync_tokens").where({ uid, revokedAt: null }).get();
    await Promise.all(tokens.data.map((token) => db.collection("sync_tokens").doc(token._id).update({ revokedAt: now() })));
  }
  await db.collection("security_audit").add({ type: "admin_user_status", adminUid: admin.uid, targetUid: uid, status, at: now() });
  return response(true, "USER_STATUS_UPDATED", { uid, status });
}
async function adminRevokeUserSyncTokens(event) {
  const admin = await requireAdmin(event);
  const uid = String(event.uid || "");
  if (!uid) return response(false, "INVALID_USER");
  const tokens = await db.collection("sync_tokens").where({ uid, revokedAt: null }).get();
  await Promise.all(tokens.data.map((token) => db.collection("sync_tokens").doc(token._id).update({ revokedAt: now() })));
  await db.collection("security_audit").add({ type: "admin_sync_tokens_revoked", adminUid: admin.uid, targetUid: uid, count: tokens.data.length, at: now() });
  return response(true, "USER_SYNC_TOKENS_REVOKED", { uid, count: tokens.data.length });
}
async function pushLearning(event) {
  const uid = await syncAuth(event); if (!uid) return response(false, "INVALID_SYNC_TOKEN");
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return response(false, "INVALID_PAYLOAD");
  // 防止公开函数被用于存储任意超大文档；学习快照限制为 1 MiB。
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 1024 * 1024) return response(false, "PAYLOAD_TOO_LARGE");
  const revision = Number(event.revision || 0);
  const existing = await db.collection("learning_snapshots").where({ uid }).limit(1).get();
  if (existing.data.length) {
    const current = existing.data[0];
    if (revision !== Number(current.revision || 0)) return response(false, "REVISION_CONFLICT", { snapshot: current });
    const nextRevision = revision + 1;
    // 用 set 整文档覆盖，避免 update 深度合并时"null → 对象"报 Cannot create field 错误
    await db.collection("learning_snapshots").doc(current._id).set({ uid, payload, revision: nextRevision, updatedAt: now() });
    return response(true, "LEARNING_SAVED", { revision: nextRevision });
  }
  await db.collection("learning_snapshots").add({ uid, payload, revision: 1, updatedAt: now() });
  return response(true, "LEARNING_SAVED", { revision: 1 });
}

// ========================================================================
// 用户学习数据同步（sessionToken 通道，登录即同步、零配置）
//   pullLearningSession / pushLearningSession：用 requireActiveSession（sessionToken）鉴权，
//   读写 learning_snapshots 集合（与 syncToken 通道共用同一集合，按 uid 隔离）。
//   这样用户登录后仅凭账号密码即可跨设备/跨 IP 同步，无需额外配置 token。
//   快照上限放宽到 3 MiB，覆盖错题集/外刊阅读/口语评分等大字段。
// ========================================================================
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
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 3 * 1024 * 1024) return response(false, "PAYLOAD_TOO_LARGE");
  const revision = Number(event.revision || 0);
  const existing = await db.collection("learning_snapshots").where({ uid }).limit(1).get();
  if (existing.data.length) {
    const current = existing.data[0];
    if (revision !== Number(current.revision || 0)) return response(false, "REVISION_CONFLICT", { snapshot: current });
    const nextRevision = revision + 1;
    // 用 set 整文档覆盖，避免 update 深度合并时"null → 对象"报 Cannot create field 错误
    await db.collection("learning_snapshots").doc(current._id).set({ uid, payload, revision: nextRevision, updatedAt: now() });
    return response(true, "LEARNING_SAVED", { revision: nextRevision });
  }
  await db.collection("learning_snapshots").add({ uid, payload, revision: 1, updatedAt: now() });
  return response(true, "LEARNING_SAVED", { revision: 1 });
}

// ========================================================================
// DELE 管理员编辑（跨设备/跨用户同步）
//   getAdminEdits: 所有登录用户可读（requireActiveSession）
//   setAdminEdits: 仅管理员可写（requireAdmin）
// 存储于 admin_edits 集合，固定 doc id = "current"（全局唯一一份）
// ========================================================================
async function getAdminEdits(event) {
  await requireActiveSession(event);
  let edits = {};
  try {
    const result = await db.collection("admin_edits").where({ key: "global" }).limit(1).get();
    if (result.data.length && result.data[0].edits) {
      edits = result.data[0].edits;
    }
  } catch (e) {
    edits = {};
  }
  return response(true, "ADMIN_EDITS", { edits });
}
async function setAdminEdits(event) {
  await requireAdmin(event);
  const edits = event.edits;
  if (!edits || typeof edits !== "object") return response(false, "INVALID_PAYLOAD");
  if (Buffer.byteLength(JSON.stringify(edits), "utf8") > 1024 * 1024) return response(false, "PAYLOAD_TOO_LARGE");
  const existing = await db.collection("admin_edits").where({ key: "global" }).limit(1).get();
  if (existing.data.length) {
    await db.collection("admin_edits").doc(existing.data[0]._id).update({ edits, updatedAt: now() });
  } else {
    await db.collection("admin_edits").add({ key: "global", edits, updatedAt: now() });
  }
  return response(true, "ADMIN_EDITS_SAVED");
}

// ========================================================================
// 管理员内容编辑（写作练习 / SIELE 口语，跨设备/跨用户同步）
//   getContentEdits: 所有登录用户可读（requireActiveSession）
//   setContentEdits: 仅管理员可写（requireAdmin）
// 存储于 content_edits 集合，按 namespace 分文档：
//   { key: "writing", edits, updatedAt }  → 写作练习任务/范文编辑
//   { key: "oral", edits, updatedAt }     → SIELE 口语 Tarea1~5 编辑
// ========================================================================
async function getContentEdits(event) {
  await requireActiveSession(event);
  const namespace = String(event.namespace || "writing");
  let edits = {};
  try {
    const result = await db.collection("content_edits").where({ key: namespace }).limit(1).get();
    if (result.data.length && result.data[0].edits) {
      const raw = result.data[0].edits;
      // 新数据存 JSON 字符串（避免 MongoDB 对非 ASCII 字符键序列化失败），旧数据存对象，两者兼容
      edits = (typeof raw === 'string') ? JSON.parse(raw) : raw;
    }
  } catch (e) {
    edits = {};
  }
  return response(true, "CONTENT_EDITS", { namespace, edits });
}
async function setContentEdits(event) {
  await requireAdmin(event);
  const namespace = String(event.namespace || "writing");
  const editsRaw = event.edits;
  // 前端传 URL-safe base64(纯字母数字+-_)，兼容 url-safe base64/普通 base64/JSON字符串/对象四种
  let edits;
  if (typeof editsRaw === 'string') {
    let decoded = null;
    // URL-safe base64 还原
    try {
      let b64 = editsRaw.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch(e) { decoded = null; }
    if (decoded == null) {
      try { decoded = JSON.parse(Buffer.from(editsRaw, 'base64').toString('utf8')); }
      catch(e) { decoded = null; }
    }
    if (decoded != null) {
      edits = decoded;
    } else {
      try { edits = JSON.parse(editsRaw); }
      catch(e2) {
        return response(false, "INVALID_PAYLOAD", { rtype: typeof editsRaw, rlen: editsRaw ? editsRaw.length : 0, rhead: editsRaw ? editsRaw.slice(0, 200) : '' });
      }
    }
  } else if (editsRaw && typeof editsRaw === 'object') {
    edits = editsRaw;
  } else {
    return response(false, "INVALID_PAYLOAD");
  }
  const editsJson = JSON.stringify(edits);
  if (Buffer.byteLength(editsJson, "utf8") > 2 * 1024 * 1024) return response(false, "PAYLOAD_TOO_LARGE");
  const existing = await db.collection("content_edits").where({ key: namespace }).limit(1).get();
  if (existing.data.length) {
    // 存 JSON 字符串：edits.overrides 的键含点号/双引号/箭头/重音等特殊字符，
    // 直接存对象会被 CloudBase SDK 序列化失败(SERVER_ERROR/InvalidBSON)，字符串化后特殊字符转义为 \uXXXX 安全存储
    await db.collection("content_edits").doc(existing.data[0]._id).set({ key: namespace, edits: editsJson, updatedAt: now() });
  } else {
    await db.collection("content_edits").add({ key: namespace, edits: editsJson, updatedAt: now() });
  }
  return response(true, "CONTENT_EDITS_SAVED");
}

exports.main = async (event) => {
  const input = event && event.data && typeof event.data === "object" ? event.data : (event || {});
  const action = String(input.action || "");
  if (action === "health") return response(true, "HEALTHY", { service: "siele-auth" });
  // 应用层 QPS 限流（exempt action 已跳过）
  if (!RATE_LIMIT_CONFIG.EXEMPT_ACTIONS.has(action)) {
    const clientIp = _extractClientIp(event);
    const check = _rateLimitCheck(clientIp);
    if (!check.allowed) {
      _enqueueRateAudit(check.scope, check.clientIp || clientIp, action);
      try { await _flushRateAudit(); } catch (e) { console.error("rate_limit_audit_flush_failed", e && e.message); }
      return response(false, "RATE_LIMITED", { scope: check.scope, limit: check.limit, retryAfterMs: RATE_LIMIT_CONFIG.WINDOW_MS });
    }
  }
  try {
    await ensureInviteSeed();
    if (action === "register") return await register(input);
    if (action === "login") return await login(input);
    if (action === "createSyncToken") return await createSyncToken(input);
    if (action === "listSyncTokens") return await listSyncTokens(input);
    if (action === "revokeSyncToken") return await revokeSyncToken(input);
    if (action === "adminListUsers") return await adminListUsers(input);
    if (action === "adminListInvites") return await adminListInvites(input);
    if (action === "adminSetUserStatus") return await adminSetUserStatus(input);
    if (action === "adminRevokeUserSyncTokens") return await adminRevokeUserSyncTokens(input);
    if (action === "pullLearning") return await pullLearning(input);
    if (action === "pushLearning") return await pushLearning(input);
    if (action === "pullLearningSession") return await pullLearningSession(input);
    if (action === "pushLearningSession") return await pushLearningSession(input);
    if (action === "getAdminEdits") return await getAdminEdits(input);
    if (action === "setAdminEdits") return await setAdminEdits(input);
    if (action === "getContentEdits") return await getContentEdits(input);
    if (action === "setContentEdits") return await setContentEdits(input);
    if (action === "checkStatus") return await checkStatus(input);
    if (action === "changePasswordWithOld") return await changePasswordWithOld(input);
    if (action === "resetPasswordWithInvite") return await resetPasswordWithInvite(input);
    return response(false, "UNKNOWN_ACTION");
  } catch (e) {
    return response(false, (e && e.code) || "SERVER_ERROR", { detail: (e && e.message) || String(e) });
  }
};

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
const INVITE_CODES = new Set([
  "SIELE-2026-VERDE", "SIELE-2026-ROJO", "SIELE-2026-AZUL",
  "SIELE-2026-ORO", "SIELE-2026-LUNA", "SIELE-2026-SOL",
  "SIELE-2026-RIO-7K4M", "SIELE-2026-NUBE-9Q2X",
  "SIELE-2026-BOSQUE-6V8P", "SIELE-2026-MAR-3H7T",
  "SIELE-2026-AURORA-5L9C", "SIELE-2026-SIERRA-8D6N",
  "SIELE-2026-GLACIAR-4W6R", "SIELE-2026-ESTRELLA-2J8F"
]);
// VERDE/ROJO 曾仅存于浏览器本地，无法证明历史占用归属；为防止再次被利用，首次云端初始化时永久停用。
const LEGACY_REVOKED_INVITES = new Set(["SIELE-2026-VERDE", "SIELE-2026-ROJO"]);

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

async function login(event) {
  const username = normalizeUsername(event.username);
  const password = String(event.password || "");
  const found = await db.collection("user_profiles").where({ username, status: "active" }).limit(1).get();
  if (!found.data.length) return response(false, "INVALID_CREDENTIALS");
  const user = found.data[0];
  const candidate = passwordHash(password, user.passwordSalt);
  if (candidate.length !== user.passwordHash.length || !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(user.passwordHash))) return response(false, "INVALID_CREDENTIALS");
  await db.collection("user_profiles").doc(user._id).update({ lastLoginAt: now() });
  await db.collection("security_audit").add({ type: "login", uid: user.uid, username, at: now() });
  const role = user.role === "admin" ? "admin" : "learner";
  return response(true, "LOGGED_IN", { uid: user.uid, username: user.username, role, sessionToken: issueSession(user.uid, user.username, role) });
}

async function createSyncToken(event) {
  const session = requireSession(event);
  const label = String(event.label || "未命名设备").slice(0, 60);
  const plainToken = randomToken();
  await db.collection("sync_tokens").add({ uid: session.uid, tokenHash: tokenHash(plainToken), label, createdAt: now(), lastUsedAt: null, revokedAt: null });
  await db.collection("security_audit").add({ type: "sync_token_created", uid: session.uid, label, at: now() });
  return response(true, "SYNC_TOKEN_CREATED", { syncToken: plainToken, label });
}
async function listSyncTokens(event) {
  const session = requireSession(event);
  const result = await db.collection("sync_tokens").where({ uid: session.uid }).orderBy("createdAt", "desc").get();
  return response(true, "SYNC_TOKENS", { tokens: result.data.map(t => ({ id: t._id, label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt })) });
}
async function revokeSyncToken(event) {
  const session = requireSession(event);
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
  await db.collection("sync_tokens").doc(item._id).update({ lastUsedAt: now() });
  return item.uid;
}
async function pullLearning(event) {
  const uid = await syncAuth(event); if (!uid) return response(false, "INVALID_SYNC_TOKEN");
  const result = await db.collection("learning_snapshots").where({ uid }).limit(1).get();
  return response(true, "LEARNING_DATA", { snapshot: result.data[0] || null });
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
    await db.collection("learning_snapshots").doc(current._id).update({ payload, revision: nextRevision, updatedAt: now() });
    return response(true, "LEARNING_SAVED", { revision: nextRevision });
  }
  await db.collection("learning_snapshots").add({ uid, payload, revision: 1, updatedAt: now() });
  return response(true, "LEARNING_SAVED", { revision: 1 });
}

exports.main = async (event) => {
  const input = event && event.data && typeof event.data === "object" ? event.data : (event || {});
  const action = String(input.action || "");
  if (action === "health") return response(true, "HEALTHY", { service: "siele-auth" });
  try {
    await ensureInviteSeed();
    if (action === "register") return await register(input);
    if (action === "login") return await login(input);
    if (action === "createSyncToken") return await createSyncToken(input);
    if (action === "listSyncTokens") return await listSyncTokens(input);
    if (action === "revokeSyncToken") return await revokeSyncToken(input);
    if (action === "pullLearning") return await pullLearning(input);
    if (action === "pushLearning") return await pushLearning(input);
    return response(false, "UNKNOWN_ACTION");
  } catch (e) {
    console.error("siele-auth request failed", { action, code: e && e.code, message: e && e.message });
    return response(false, e.code || "SERVER_ERROR");
  }
};

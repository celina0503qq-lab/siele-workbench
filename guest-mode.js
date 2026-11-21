/* ============================================================
 * guest-mode.js — SIELE 工作台 · 游客模式（一期：纯前端）
 *
 * 设计口径（2026-11-21 站长定版）：
 *  - 游客 = 合成用户，权限走现行 flags 门禁（window._wbFlagsAllowed 同一道门）
 *  - 策略结构 global（全体默认）+ overrides（按 guestId 单个覆盖），
 *    与二期服务端下发的结构完全一致，一期只用 global 段
 *  - 额度 = 集中计数器 _guestConsume(feature)，按日滚动，存本地
 *  - 游客记录 siele_guest_v1：guestId / firstSeen / lastSeen / active
 *  - 内容取数统一口：_guestContent(feature) —— 一期本地直通，
 *    二期在此换成云端试用包（getDataBundle guest 层）
 *  - 二期接口占位（siele-auth 预留 action 名，一期为本地实现）：
 *    guestStart / guestSyncPolicy / guestReportUsage
 *  - 游客不建云端会话；管理员后台一期不可见（站长已知悉）
 * ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'siele_guest_v1';

  /* ---------- 策略（结构与二期服务端版一致，勿改形状） ---------- */
  window.GUEST_POLICY = {
    global: {
      flags: {
        quizBack: false,
        deleSpecial: false,
        sieleSpecial: false,
        refinePack: true,
        sieleSpecial: true, // 2026-11-21 站长加定：SIELE 专项开试用（每 Tarea 每天 1 题，组卷禁用）
        writingEnabled: false,
        oralEnabled: false,
        asrCloudEnabled: false
      },
      quotas: { cards: 50, quiz: 10, shadow: 10, refine: 1, sielePerTarea: 1 } // 每日上限；sielePerTarea = SIELE 每种 Tarea 每天可录音评分的题数
    },
    overrides: {} // { guestId: { flags:{...}, quotas:{...} } } —— 二期由后台下发
  };

  var FEATURE_LABEL = { cards: '单词卡', quiz: '题库', shadow: '跟读', refine: '外刊精炼' };

  /* ---------- 游客记录 ---------- */
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function newGuestId() {
    return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function loadRec() {
    try {
      var r = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (r && r.guestId) return r;
    } catch (e) { try { console.warn('[guest] 记录读取失败', e); } catch (_e) {} }
    return null;
  }
  function saveRec(r) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(r)); }
    catch (e) { try { console.warn('[guest] 记录保存失败', e); } catch (_e) {} }
  }
  function ensureRec() {
    var r = loadRec();
    var now = Date.now();
    if (!r) {
      r = { guestId: newGuestId(), firstSeen: now, lastSeen: now, active: false, day: todayStr(), counters: {}, countedDates: {}, keyed: {} };
    }
    r.lastSeen = now;
    if (r.day !== todayStr()) { r.day = todayStr(); r.counters = {}; r.countedDates = {}; r.keyed = {}; }
    if (!r.keyed) r.keyed = {};
    saveRec(r);
    return r;
  }
  function policyFor(guestId) {
    var g = window.GUEST_POLICY.global;
    var o = (window.GUEST_POLICY.overrides || {})[guestId] || {};
    return {
      flags: Object.assign({}, g.flags, o.flags || {}),
      quotas: Object.assign({}, g.quotas, o.quotas || {})
    };
  }
  function hasRealSession() {
    try {
      var s = JSON.parse(localStorage.getItem('swa_cloud_session_v1') || 'null');
      return !!(s && s.username && s.sessionToken);
    } catch (e) { return false; }
  }
  function isActive() {
    var r = loadRec();
    return !!(r && r.active) && !hasRealSession();
  }

  /* ---------- 额度计数器（单一入口，二期搬服务端） ---------- */
  function remaining(feature) {
    var r = ensureRec();
    var pol = policyFor(r.guestId);
    var cap = pol.quotas[feature];
    if (typeof cap !== 'number') return Infinity;
    return Math.max(0, cap - (r.counters[feature] || 0));
  }
  function consume(feature) {
    if (!isActive()) return true; // 非游客不拦
    if (remaining(feature) <= 0) { showWall(feature); return false; }
    var r = ensureRec();
    r.counters[feature] = (r.counters[feature] || 0) + 1;
    saveRec(r);
    renderBanner();
    return true;
  }
  /* 分键计数（如 SIELE 每种 Tarea 各自计数）：key 任意字符串，cap 为每日上限 */
  function consumeKey(key, cap, wallLabel) {
    if (!isActive()) return true;
    var r = ensureRec();
    if ((r.keyed[key] || 0) >= cap) { showWall(null, wallLabel); return false; }
    r.keyed[key] = (r.keyed[key] || 0) + 1;
    saveRec(r);
    renderBanner();
    return true;
  }
  /* 内容取数统一口：一期本地直通（内容随页面发布）；二期在此换云端试用包 */
  function guestContent(feature) { return true; }

  /* ---------- 额度墙 ---------- */
  function showWall(feature, labelOverride) {
    var label = labelOverride || FEATURE_LABEL[feature] || '该功能';
    var old = document.getElementById('guestWall');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'guestWall';
    d.style.cssText = 'position:fixed;inset:0;z-index:999990;background:rgba(20,12,6,.45);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML =
      '<div style="background:#fffdf8;border-radius:16px;max-width:340px;width:100%;padding:26px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.25)">' +
      '<div style="font-size:34px">🌱</div>' +
      '<h3 style="margin:8px 0 6px;font-size:17px">今日' + label + '试用额度用完啦</h3>' +
      '<p style="font-size:13px;color:#8a7a68;line-height:1.7;margin:0 0 16px">游客每天可以免费试用一部分内容。<br>注册正式账号后不限量，还能云端同步进度。</p>' +
      '<button id="guestWallReg" style="display:block;width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#c0392b,#e08e0b);color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:9px">免费注册 / 登录</button>' +
      '<button id="guestWallOk" style="display:block;width:100%;padding:10px;border:1px solid #e5ddd2;border-radius:10px;background:#fff;color:#6b5d4f;font-size:13px;cursor:pointer">明天再来</button>' +
      '</div>';
    document.body.appendChild(d);
    document.getElementById('guestWallOk').addEventListener('click', function () { d.remove(); });
    document.getElementById('guestWallReg').addEventListener('click', function () { d.remove(); guestGoLogin(); });
  }

  /* ---------- 游客条 ---------- */
  function renderBanner() {
    var bar = document.getElementById('guestBar');
    if (!isActive()) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'guestBar';
      bar.style.cssText = 'position:sticky;top:0;z-index:99990;background:linear-gradient(90deg,#3a2418,#5a3620);color:#f5e9d6;font-size:12px;padding:6px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 10px rgba(0,0,0,.25)';
      bar.innerHTML =
        '<b>👀 游客模式</b><span id="guestBarQuota" style="color:#ffe1a8"></span><span style="flex:1"></span>' +
        '<a href="javascript:void(0)" id="guestBarReg" style="color:#ffd98a;font-weight:700;text-decoration:none">免费注册 →</a>' +
        '<a href="javascript:void(0)" id="guestBarExit" style="color:#d8c4aa;text-decoration:none">退出游客</a>';
      document.body.insertBefore(bar, document.body.firstChild);
      document.getElementById('guestBarReg').addEventListener('click', guestGoLogin);
      document.getElementById('guestBarExit').addEventListener('click', function () { exitGuest(); });
    }
    var q = document.getElementById('guestBarQuota');
    if (q) {
      var n = function (f) { return '<b style="background:rgba(255,255,255,.93);color:#3a2418;font-weight:800;border-radius:6px;padding:0 6px;margin:0 1px">' + remaining(f) + '</b>'; };
      q.innerHTML = '今日剩余：单词卡 ' + n('cards') + ' · 题库 ' + n('quiz') + ' · 跟读 ' + n('shadow') + ' · 外刊 ' + n('refine') + ' · SIELE 每 Tarea 日限 1 题（进度只存本机）';
    }
  }

  /* ---------- 进入 / 退出 ---------- */
  var savedFlags = null;
  function applyGuestFlags() {
    var r = ensureRec();
    var pol = policyFor(r.guestId);
    if (savedFlags === null) {
      try { savedFlags = Object.assign({}, window._wbFlags || {}); } catch (e) { savedFlags = {}; }
    }
    window._wbFlags = Object.assign({}, pol.flags);
  }
  function restoreFlags() {
    if (savedFlags !== null) { window._wbFlags = savedFlags; savedFlags = null; }
    else if (typeof window._wbFlagsLoad === 'function') { try { window._wbFlagsLoad(); } catch (e) {} }
    if (hasRealSession() && typeof window._wbFlagsFetch === 'function') { try { window._wbFlagsFetch(true); } catch (e) {} }
  }
  function enterGuest(resume) {
    if (hasRealSession()) return false;
    var r = ensureRec();
    r.active = true; saveRec(r);
    window.__guestActive = true; // 渲染层游客开关（renderNav/renderMain 的无会话拦截据此放行）
    applyGuestFlags();
    try { if (typeof window._wbLandingHide === 'function') window._wbLandingHide(); } catch (e) {}
    var ld = document.getElementById('wbLanding'); if (ld) ld.style.display = 'none';
    var ov = document.getElementById('wbLoginOverlay'); if (ov) ov.classList.add('hide');
    try { document.body.style.overflow = ''; } catch (e) {}
    renderBanner();
    try { if (typeof renderNav === 'function') renderNav(); } catch (e) { try { console.warn('[guest] renderNav', e); } catch (_e) {} }
    try { if (typeof renderMain === 'function') renderMain(); } catch (e) { try { console.warn('[guest] renderMain', e); } catch (_e) {} }
    if (!resume && typeof toast === 'function') toast('👀 已进入游客模式，进度只保存在这台设备上', 'ok');
    return true;
  }
  function exitGuest() {
    var r = ensureRec();
    r.active = false; saveRec(r);
    window.__guestActive = false;
    restoreFlags();
    renderBanner();
    try { location.reload(); } catch (e) {}
  }
  function guestGoLogin() {
    window._guestLoginIntent = Date.now();
    window.__guestActive = false;
    var r = loadRec(); if (r) { r.active = false; saveRec(r); }
    restoreFlags();
    renderBanner();
    try { location.reload(); } catch (e) {}
  }

  /* ---------- 门禁与登录罩钩子 ---------- */
  var origFlagsAllowed = window._wbFlagsAllowed;
  if (typeof origFlagsAllowed === 'function') {
    window._wbFlagsAllowed = function (k) {
      if (isActive()) {
        var r = ensureRec();
        return !!policyFor(r.guestId).flags[k];
      }
      return origFlagsAllowed(k);
    };
  }
  var origShowLogin = window.showLoginOverlay;
  if (typeof origShowLogin === 'function') {
    window.showLoginOverlay = function () {
      if (isActive()) {
        var intent = window._guestLoginIntent && (Date.now() - window._guestLoginIntent < 1500);
        if (!intent) {
          try { if (typeof window._wbLandingHide === 'function') window._wbLandingHide(); } catch (e) {}
          var ld = document.getElementById('wbLanding'); if (ld) ld.style.display = 'none';
          var ov = document.getElementById('wbLoginOverlay'); if (ov) ov.classList.add('hide');
          return;
        }
      }
      return origShowLogin.apply(this, arguments);
    };
  }
  // 真登录/注册入口点击 = 明确意图（落地页与登录罩内的登录/注册按钮）
  document.addEventListener('click', function (ev) {
    try {
      var t = ev.target;
      while (t && t !== document) {
        if (t.id === 'wbGoReg') { window._guestLoginIntent = Date.now(); return; }
        t = t.parentNode;
      }
    } catch (e) {}
  }, true);

  // 游客版「未开通」页（原版文案是给学员的「联系管理员开通」，游客不适用）
  var origNoAccess = window._renderNoAccess;
  if (typeof origNoAccess === 'function') {
    window._renderNoAccess = function () {
      if (isActive()) {
        return '<div class="card" style="text-align:center;padding:40px 20px"><div style="font-size:40px">🔒</div><h3 style="margin:10px 0">游客试用未包含此功能</h3><p style="color:var(--soft);font-size:13px;line-height:1.8">写作、口语、SIELE/DELE 专项等完整功能只对注册用户开放。<br>注册免费，注册后可联系管理员为你开通。</p><button class="btn" style="margin-top:10px" onclick="window._guestGoLogin&&window._guestGoLogin()">免费注册 / 登录</button></div>';
      }
      return origNoAccess.apply(this, arguments);
    };
  }
  window._guestGoLogin = guestGoLogin;

  /* ---------- 计数钩子（包原函数，非游客直通） ---------- */
  function wrapCount(fnName, feature) {
    var orig = window[fnName];
    if (typeof orig !== 'function') { try { console.warn('[guest] 未找到计数点', fnName); } catch (e) {} return; }
    window[fnName] = function () {
      if (isActive() && !consume(feature)) return undefined;
      return orig.apply(this, arguments);
    };
  }
  wrapCount('rateFlash', 'cards');       // 单词卡评级
  wrapCount('answerQuiz', 'quiz');       // 题库答题
  wrapCount('scoreShadow', 'shadow');    // 跟读评分（录音走云识别时另有 asr 开关，游客为关）

  // 外刊精炼：按「期（日期）」计数——选新日期 / 首次渲染未计数的日期时扣 1
  var origSelectRefineDate = window.selectRefineDate;
  if (typeof origSelectRefineDate === 'function') {
    window.selectRefineDate = function (d) {
      if (isActive()) {
        var r = ensureRec();
        if (!r.countedDates['refine:' + d]) {
          if (!consume('refine')) return undefined;
          r = ensureRec(); r.countedDates['refine:' + d] = 1; saveRec(r);
        }
      }
      return origSelectRefineDate.apply(this, arguments);
    };
  }
  var origRenderRefineBody = window.renderRefineBody;
  if (typeof origRenderRefineBody === 'function') {
    window.renderRefineBody = async function () {
      var res = await origRenderRefineBody.apply(this, arguments);
      try {
        if (isActive() && typeof currentRefineDate !== 'undefined' && currentRefineDate) {
          var r = ensureRec();
          if (!r.countedDates['refine:' + currentRefineDate]) {
            if (remaining('refine') > 0) { consume('refine'); r = ensureRec(); r.countedDates['refine:' + currentRefineDate] = 1; saveRec(r); }
          }
        }
      } catch (e) { try { console.warn('[guest] refine 计数', e); } catch (_e) {} }
      return res;
    };
  }

  /* ---------- SIELE 专项试用（2026-11-21 站长加定） ----------
   * 每种 Tarea 每天可录音评分 1 题（在开始录音时按 Tarea 分键计数）；
   * 组卷/模考对游客禁用（入口卡换锁定卡 + 启动函数兜底拦截）。 */
  function sieleTareaNum() {
    try { return (typeof _sieleOralTarea !== 'undefined' && _sieleOralTarea) ? Number(_sieleOralTarea) : 0; } catch (e) { return 0; }
  }
  function sieleGate() {
    var r = ensureRec();
    var cap = policyFor(r.guestId).quotas.sielePerTarea;
    if (typeof cap !== 'number') cap = 1;
    return consumeKey('siele:T' + sieleTareaNum(), cap, 'SIELE Tarea ' + (sieleTareaNum() || ''));
  }
  var origStartSieleOral = window.startSieleOral;
  if (typeof origStartSieleOral === 'function') {
    window.startSieleOral = function () {
      if (isActive() && !sieleGate()) return undefined;
      return origStartSieleOral.apply(this, arguments);
    };
  }
  var origAsrSieleCloud = window._wbAsrSieleOralCloud;
  if (typeof origAsrSieleCloud === 'function') {
    window._wbAsrSieleOralCloud = function () {
      if (isActive() && !sieleGate()) return undefined;
      return origAsrSieleCloud.apply(this, arguments);
    };
  }
  var origMockEntry = window._sieleMockEntryHtml;
  if (typeof origMockEntry === 'function') {
    window._sieleMockEntryHtml = function () {
      if (isActive()) {
        return '<div class="card" style="padding:12px;text-align:center;margin-bottom:10px"><b>🧩 组卷 / 全真模考</b><div style="font-size:12px;color:var(--soft);margin:6px 0">组卷模考是注册用户功能。游客可以逐个 Tarea 试用（每种 Tarea 每天 1 题）。</div><button class="btn sm pr" onclick="window._guestGoLogin&&window._guestGoLogin()">免费注册 / 登录</button></div>';
      }
      return origMockEntry.apply(this, arguments);
    };
  }
  ['_sieleMockStartRandom', '_sieleMockStartCustom', 'toggleSieleMockPanel'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig === 'function') {
      window[fn] = function () {
        if (isActive()) { showLocked('组卷模考是注册用户功能', '游客可以逐个 Tarea 试用（每种 Tarea 每天 1 题）；<br>组卷、全真模考与完整题库请注册后使用。'); return undefined; }
        return orig.apply(this, arguments);
      };
    }
  });

  /* 通用「注册功能」锁定卡（非额度类拦截，如组卷模考） */
  function showLocked(title, msg) {
    var old = document.getElementById('guestWall');
    if (old) old.remove();
    var d = document.createElement('div');
    d.id = 'guestWall';
    d.style.cssText = 'position:fixed;inset:0;z-index:999990;background:rgba(20,12,6,.45);display:flex;align-items:center;justify-content:center;padding:20px';
    d.innerHTML =
      '<div style="background:#fffdf8;border-radius:16px;max-width:340px;width:100%;padding:26px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.25)">' +
      '<div style="font-size:34px">🔒</div>' +
      '<h3 style="margin:8px 0 6px;font-size:17px">' + title + '</h3>' +
      '<p style="font-size:13px;color:#8a7a68;line-height:1.7;margin:0 0 16px">' + msg + '</p>' +
      '<button id="guestWallReg" style="display:block;width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#c0392b,#e08e0b);color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:9px">免费注册 / 登录</button>' +
      '<button id="guestWallOk" style="display:block;width:100%;padding:10px;border:1px solid #e5ddd2;border-radius:10px;background:#fff;color:#6b5d4f;font-size:13px;cursor:pointer">知道了</button>' +
      '</div>';
    document.body.appendChild(d);
    document.getElementById('guestWallOk').addEventListener('click', function () { d.remove(); });
    document.getElementById('guestWallReg').addEventListener('click', function () { d.remove(); guestGoLogin(); });
  }

  /* ---------- 入口按钮注入 ---------- */
  function makeGuestBtn(big) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'guest-enter-btn';
    b.textContent = '👀 游客试用';
    b.style.cssText = big
      ? 'display:inline-flex;align-items:center;justify-content:center;border-radius:10px;font-weight:700;cursor:pointer;border:1.5px solid #C0392B;background:#fff;color:#C0392B;padding:10px 18px;font-size:14px;font-family:inherit'
      : 'display:inline-flex;align-items:center;justify-content:center;border-radius:10px;font-weight:700;cursor:pointer;border:1.5px solid #C0392B;background:#fff;color:#C0392B;padding:7px 13px;font-size:13px;font-family:inherit';
    b.addEventListener('click', function () { enterGuest(false); });
    return b;
  }
  function injectButtons() {
    try {
      var landing = document.getElementById('wbLanding');
      if (landing && !landing.querySelector('.guest-enter-btn')) {
        var nav = landing.querySelector('.ln-nav .in') || landing.querySelector('.ln-wrap');
        if (nav) nav.appendChild(makeGuestBtn(false));
      }
      var card = document.querySelector('#wbLoginOverlay .wb-login-card');
      if (card && !card.querySelector('.guest-enter-btn')) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:14px;text-align:center';
        wrap.appendChild(makeGuestBtn(true));
        var tip = document.createElement('div');
        tip.style.cssText = 'font-size:11px;color:#94a3b8;margin-top:7px';
        tip.textContent = '不用注册，先进来看看 · 进度保存在本机';
        wrap.appendChild(tip);
        card.appendChild(wrap);
      }
    } catch (e) { try { console.warn('[guest] 入口注入', e); } catch (_e) {} }
  }
  var mo = new MutationObserver(function () { injectButtons(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}

  /* ---------- 二期接口占位（一期本地实现，形状与服务端版一致） ---------- */
  window.GuestMode = {
    enter: enterGuest,
    exit: exitGuest,
    isActive: isActive,
    consume: consume,
    consumeKey: consumeKey,
    remaining: remaining,
    content: guestContent,
    record: function () { return loadRec(); },
    policy: function () { var r = ensureRec(); return policyFor(r.guestId); },
    api: {
      guestStart: function () { var r = ensureRec(); return { ok: true, guestId: r.guestId, firstSeen: r.firstSeen }; },
      guestSyncPolicy: function () { return { ok: true, policy: window.GUEST_POLICY }; },
      guestReportUsage: function () { var r = ensureRec(); return { ok: true, day: r.day, counters: r.counters, lastSeen: r.lastSeen }; }
    }
  };

  /* ---------- 启动：老游客自动恢复（留存） ---------- */
  function boot() {
    injectButtons();
    var r = loadRec();
    if (r && r.active && !hasRealSession()) enterGuest(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

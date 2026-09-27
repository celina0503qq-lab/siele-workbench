#!/usr/bin/env node
/**
 * deploy-guard.js — 推送前完整性校验（防旧版覆盖事故）
 *
 * 用法:
 *   node deploy-guard.js           # 常规校验
 *   node deploy-guard.js --strict  # 严格模式（警告也算失败）
 *
 * 校验项:
 *   1) git 工作区状态
 *   2) index.html 行数与关键功能标记（v33 → v37 全版本）
 *   3) admin.html 行数与后台功能标记
 *   4) cloudfunctions/siele-auth 的 action 完整性 ← 新增，防 S1 复发
 *   5) sw2.js 缓存版本号与 index.html 中 swVer 是否配对
 *   6) 数据文件存在性与条目数合理性
 *
 * 退出码:
 *   0 = 通过
 *   1 = 失败（禁止推送）
 *
 * 版本历史:
 *   v1.0  初版 — 仅校验 index.html 行数 + 6 个标记
 *   v2.0  2026-09-27 — 全量重写：
 *         · 阈值随实际行数上调（17500 → 18500）
 *         · 补齐 v34~v37 所有关键标记
 *         · 新增云函数 / 后台 / SW / 数据文件校验
 *         · 新增 --strict 模式
 *         · 输出改为分组展示，失败项集中汇总
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// 配置区
// ============================================================

const ROOT = __dirname;
const FILE = f => path.join(ROOT, f);
const STRICT = process.argv.includes('--strict');

/**
 * 行数阈值
 * 基线: index.html 18962 行（commit 34446006, v5.20260926，实测 18963 split 口径）
 * 阈值取 18700 —— v33 旧版 18698 行、v5.20260808 为 18467 行，均会被拦下
 */
const LIMITS = {
  'index.html': 18700,
  'admin.html': 2600,
  'cloudfunctions/siele-auth/index.js': 650,
};

/**
 * index.html 关键标记（按版本分组，便于定位回归）
 */
const INDEX_MARKERS = {
  // ---- 基础架构（v1 ~ v33）----
  'sessionToken':              { min: 5,  desc: '会话令牌' },
  '云同步':                     { min: 10, desc: '云同步文案' },
  '_contentEdits':             { min: 5,  desc: '内容编辑' },
  'VERB_USAGE_GROUPS':         { min: 1,  desc: '动词用法' },
  'GRAMMAR_DETAIL':            { min: 1,  desc: '语法详情' },
  'swa_cloud_session_v1':      { min: 5,  desc: '工作台会话键' },

  // ---- v34 / v35：题库搜索 ----
  'quizQuestionKey':           { min: 1,  desc: 'v35 题库搜索定位' },

  // ---- v36：用户功能授权 ----
  '_wbFlagsFetch':             { min: 1,  desc: 'v36 授权拉取' },
  '_wbFlagsAllowed':           { min: 1,  desc: 'v36 授权判定' },
  'wb_menu_flags_v1':          { min: 1,  desc: 'v36 授权缓存键' },
  'getUserFlags':              { min: 1,  desc: 'v36 授权接口调用' },
  'USER_FLAG_DEFS':            { min: 0,  desc: 'v36 授权定义（在 admin.html）', optional: true },

  // ---- v37：会话打通 + 背题停驻 ----
  'wbLogout':                  { min: 1,  desc: 'v37 退出登录' },
  'wb_quiz_back_pos_v1':       { min: 1,  desc: 'v37 背题停驻键' },

  // ---- v34~v37 铁律标记（项目记忆抽查清单子集，2026-09-27 补充）----
  '_deleTaskAudioText':        { min: 1,  desc: '口语/写作音频任务' },
  '_deleStOwnerGuard':         { min: 1,  desc: '存储 owner 兜底' },
  'quizOrderPos':              { min: 1,  desc: '顺序题游标' },
  '_wbSavePushT':              { min: 1,  desc: '防抖推送' },
  '_quizSearch':               { min: 1,  desc: 'v34 题库搜索' },
  '_quizJumpTo':               { min: 1,  desc: 'v34 搜索跳转' },
  '_quizBackMode':             { min: 1,  desc: 'v35 背题模式' },
  'wb_quiz_back_mode_v1':      { min: 1,  desc: 'v35 背题开关键' },
  'reqFlag':                   { min: 1,  desc: 'v36 菜单授权守卫' },
  'siele-workbench-logout':    { min: 1,  desc: 'v37 联动登出消息' },
  '20260808':                  { min: 1,  desc: '数据格式版本 _appVer（迁移依赖，不可动）' },
};

/**
 * admin.html 关键标记
 */
const ADMIN_MARKERS = {
  'USER_FLAG_DEFS':            { min: 1, desc: 'v36 授权定义' },
  'adminToggleUserFlag':       { min: 1, desc: 'v36 授权切换' },
  'storageReport':             { min: 1, desc: '存储空间管理' },
  'doLogout':                  { min: 1, desc: '后台登出' },
  'CLOUD_SESSION_KEY':         { min: 1, desc: '后台独立会话键' },
  'siele-workbench-logout':    { min: 1, desc: 'v37 会话联动通知' },
};

/**
 * 云函数必须存在的 action
 * ⚠️ 这一项是防 S1（仓库云函数落后于线上）复发的核心
 */
const FN_ACTIONS = [
  'health', 'register', 'login', 'checkStatus',
  'changePasswordWithOld', 'resetPasswordWithInvite',
  'createSyncToken', 'listSyncTokens', 'revokeSyncToken',
  'pullLearning', 'pushLearning',
  'pullLearningSession', 'pushLearningSession',
  'getAdminEdits', 'setAdminEdits',
  'getContentEdits', 'setContentEdits',
  'adminListUsers', 'adminSetUserStatus', 'adminListInvites',
  'adminListSecurityLogs', 'adminRevokeUserSyncTokens',
  // ---- v36 新增，最容易漏同步 ----
  'getUserFlags',
  'adminSetUserFlags',
];

/**
 * 云函数安全基础标记
 */
const FN_MARKERS = [
  { key: 'requireAdmin',  min: 1, desc: '管理员服务端校验' },
  { key: 'GLOBAL_QPS',    min: 1, desc: '全局限流' },
  { key: 'PER_IP_QPS',    min: 1, desc: '单 IP 限流' },
  { key: 'issueSession',  min: 1, desc: '会话签发' },
];

/**
 * 数据文件（存在性 + 最小体积，KB）
 */
const DATA_FILES = {
  'vdata_batch1.js':  50,
  'vdata_batch2.js':  50,
  'vdata_batch3.js':  50,
  'vdata_dele.js':    100,
  'grammar_data.js':  50,
  'siele_oral.js':    50,
  'refine_data.js':   5,
  'verbconj.js':      5,
};

// ============================================================
// 工具
// ============================================================

let failures = 0;
let warnings = 0;
const failLines = [];
const warnLines = [];

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};

const ok   = m => console.log(`${C.green}✅${C.reset} ${m}`);
const bad  = m => { failures++; failLines.push(m); console.log(`${C.red}❌${C.reset} ${m}`); };
const warn = m => { warnings++; warnLines.push(m); console.log(`${C.yellow}⚠️ ${C.reset} ${m}`); };
const info = m => console.log(`${C.dim}   ${m}${C.reset}`);
const head = m => console.log(`\n${C.bold}${C.blue}▸ ${m}${C.reset}`);

const read = f => fs.readFileSync(FILE(f), 'utf8');
const count = (src, k) => (src.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

// ============================================================
// 1. git 工作区
// ============================================================

function checkGit() {
  head('git 工作区状态');
  try {
    const st = execSync('git status --short', { cwd: ROOT, encoding: 'utf8' }).trim();
    if (st) {
      const n = st.split('\n').length;
      warn(`工作区有 ${n} 项未提交改动（不影响校验）`);
      st.split('\n').slice(0, 10).forEach(l => info(l));
      if (n > 10) info(`... 另有 ${n - 10} 项`);
    } else {
      ok('工作区干净');
    }
  } catch (e) {
    warn('git status 执行失败，跳过：' + e.message.split('\n')[0]);
  }
}

// ============================================================
// 2. 通用文件校验（行数 + 标记）
// ============================================================

function checkFile(file, markers, label) {
  const minLines = LIMITS[file];
  head(`${label} — ${file}`);

  if (!fs.existsSync(FILE(file))) {
    bad(`${file} 不存在！`);
    return '';
  }

  const src = read(file);
  const lines = src.split('\n').length;

  if (minLines) {
    if (lines >= minLines) {
      ok(`行数 ${lines} ≥ ${minLines}${C.dim}（余量 ${lines - minLines}）${C.reset}`);
    } else {
      bad(`行数仅 ${lines} < ${minLines}，疑似旧版覆盖！`);
    }
  }

  let missing = 0;
  for (const [key, cfg] of Object.entries(markers)) {
    if (cfg.optional) continue;
    const n = count(src, key);
    if (n < cfg.min) {
      bad(`缺少标记 ${key}（${cfg.desc}）— 实际 ${n}，需 ≥ ${cfg.min}`);
      missing++;
    }
  }
  if (!missing) ok(`${Object.keys(markers).filter(k => !markers[k].optional).length} 个关键标记齐全`);

  return src;
}

// ============================================================
// 3. 云函数 action 完整性  ← 防 S1 复发
// ============================================================

function checkCloudFunction() {
  head('云函数 siele-auth — action 完整性');
  const file = 'cloudfunctions/siele-auth/index.js';

  if (!fs.existsSync(FILE(file))) {
    bad(`${file} 不存在！`);
    return;
  }

  const src = read(file);

  // 提取实际存在的 action
  const found = new Set();
  const re = /action\s*===\s*["']([a-zA-Z]+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) found.add(m[1]);

  info(`检测到 ${found.size} 个 action`);

  const missing = FN_ACTIONS.filter(a => !found.has(a));
  if (missing.length) {
    bad(`云函数缺少 ${missing.length} 个 action：`);
    missing.forEach(a => info(`  · ${a}`));
    info('');
    info('⚠️ 这通常意味着：仓库代码落后于线上部署版本。');
    info('   请从 CloudBase 控制台导出最新代码后覆盖本文件。');
  } else {
    ok(`全部 ${FN_ACTIONS.length} 个必需 action 均在位`);
  }

  // 安全基础标记
  let badMark = 0;
  for (const { key, min, desc } of FN_MARKERS) {
    const n = count(src, key);
    if (n < min) { bad(`云函数缺少 ${key}（${desc}）`); badMark++; }
  }
  if (!badMark) ok('安全基础标记齐全（限流 + 权限校验）');
}

// ============================================================
// 4. Service Worker 版本配对
// ============================================================

function checkServiceWorker(indexSrc) {
  head('Service Worker 缓存版本配对');

  if (!indexSrc) { warn('index.html 未读取，跳过'); return; }

  const swMatch = indexSrc.match(/swVer\s*=\s*['"]([^'"]+)['"]/);
  if (!swMatch) { bad('index.html 中找不到 swVer'); return; }
  const swVer = swMatch[1];

  if (!fs.existsSync(FILE('sw2.js'))) { bad('sw2.js 不存在'); return; }
  const sw2 = read('sw2.js');
  const cacheMatch = sw2.match(/siele-suite-([a-z0-9-]+)/i);

  if (!cacheMatch) { bad('sw2.js 中找不到 CACHE 常量'); return; }
  const cache = cacheMatch[1];

  // swVer 形如 v37-2026092701；cache 形如 v37-2026092701（去掉前缀 siele-suite-）
  if (cache.includes(swVer)) {
    ok(`版本配对：swVer=${swVer} ↔ CACHE=siele-suite-${cache}`);
  } else {
    bad(`版本不配对！swVer=${swVer} 但 sw2.js CACHE=siele-suite-${cache}`);
    info('  两者必须同步更新，否则用户会拿到旧缓存。');
  }

  // 退役文件提醒
  if (fs.existsSync(FILE('sw.js'))) {
    const old = read('sw.js');
    const oldCache = (old.match(/siele-suite-([a-z0-9-]+)/i) || [])[1] || '?';
    warn(`sw.js 仍存在（缓存名 siele-suite-${oldCache}），已退役，建议删除`);
  }
}

// ============================================================
// 5. 数据文件
// ============================================================

function checkDataFiles() {
  head('数据文件完整性');
  let missing = 0;

  for (const [file, minKB] of Object.entries(DATA_FILES)) {
    if (!fs.existsSync(FILE(file))) {
      bad(`${file} 不存在`);
      missing++;
      continue;
    }
    const kb = fs.statSync(FILE(file)).size / 1024;
    if (kb < minKB) {
      bad(`${file} 仅 ${kb.toFixed(1)} KB < ${minKB} KB，内容可能被截断`);
      missing++;
    }
  }
  if (!missing) ok(`${Object.keys(DATA_FILES).length} 个数据文件体积正常`);

  // 词库条目数合理性（抽样）
  try {
    const v1 = read('vdata_batch1.js');
    const n1 = count(v1, '{"t":');
    if (n1 < 100) bad(`vdata_batch1.js 词条仅 ${n1} 条，疑似损坏`);
    else ok(`vdata_batch1.js 词条 ${n1} 条`);
  } catch (e) {
    warn('词条抽样失败：' + e.message.split('\n')[0]);
  }

  // 备份文件混入提醒
  try {
    const banks = fs.readdirSync(FILE('dele_banks'));
    const backups = banks.filter(f => /_backup|\.bak/i.test(f));
    if (backups.length) {
      warn(`dele_banks/ 含 ${backups.length} 个备份文件（建议清理或加入 .gitignore）：`);
      backups.slice(0, 5).forEach(b => info('  · ' + b));
    }
  } catch (e) { /* dele_banks 不存在则忽略 */ }
}

// ============================================================
// 6. 遗留问题提醒（不阻断推送）
// ============================================================

function checkKnownIssues(indexSrc) {
  head('已知问题提醒（不阻断）');

  if (indexSrc) {
    const ng = count(indexSrc, '_ngcontent');
    const ext = count(indexSrc, 'chrome-extension');
    if (ng > 0 || ext > 0) {
      warn(`检测到浏览器扩展注入痕迹（_ngcontent: ${ng} 处, chrome-extension: ${ext} 处）`);
      info('  编辑文件时请禁用扩展或无痕窗口操作。');
    }

    const gist = count(indexSrc, 'standaloneSyncBadge');
    if (gist > 0 && indexSrc.indexOf('__WB_LEGACY_BADGE_OFF__') === -1) {
      warn('仍存在 Gist 角标代码（standaloneSyncBadge）且 v38 U2 早退未生效, 会与 wbSyncChip 冲突');
    }

    if (!/Apple Color Emoji|Noto Color Emoji|Segoe UI Emoji/.test(indexSrc)) {
      warn('字体栈缺少 emoji 回退，部分平台会显示豆腐块');
    }
  }

  if (!fs.existsSync(FILE('LICENSE'))) {
    warn('仓库缺少 LICENSE 文件（无 LICENSE ≠ 保留所有权利）');
  }
}

// ============================================================
// 主流程
// ============================================================

function main() {
  console.log(`\n${C.bold}🔍 deploy-guard v2.0 — 推送前完整性校验${C.reset}`);
  console.log(`${C.dim}   目录: ${ROOT}${STRICT ? '  [严格模式]' : ''}${C.reset}`);

  checkGit();

  const indexSrc = checkFile('index.html', INDEX_MARKERS, '主站');
  checkFile('admin.html', ADMIN_MARKERS, '后台管理');
  checkCloudFunction();
  checkServiceWorker(indexSrc);
  checkDataFiles();
  checkKnownIssues(indexSrc);

  // ---- 汇总 ----
  console.log('\n' + '─'.repeat(56));

  if (failures) {
    console.log(`${C.red}${C.bold}🚫 校验未通过 — ${failures} 项失败${C.reset}`);
    failLines.forEach(l => console.log(`${C.red}   · ${l}${C.reset}`));
    console.log(`${C.dim}   已阻止推送。修复后重试。${C.reset}\n`);
    process.exit(1);
  }

  if (warnings) {
    console.log(`${C.yellow}${C.bold}⚠️  校验通过，但有 ${warnings} 项提醒${C.reset}`);
    warnLines.forEach(l => console.log(`${C.yellow}   · ${l}${C.reset}`));
    if (STRICT) {
      console.log(`${C.red}   严格模式下提醒视为失败。${C.reset}\n`);
      process.exit(1);
    }
    console.log(`${C.dim}   （提醒不阻断推送）${C.reset}\n`);
    process.exit(0);
  }

  console.log(`${C.green}${C.bold}🎉 校验全部通过，可以推送。${C.reset}\n`);
  process.exit(0);
}

main();

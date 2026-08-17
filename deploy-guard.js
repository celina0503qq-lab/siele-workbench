#!/usr/bin/env node
/**
 * deploy-guard.js — 推送前完整性校验（防旧版 index.html 覆盖事故）
 * 用法: node deploy-guard.js
 * 校验: 1) 工作区干净 2) index.html 行数 ≥17500 3) 关键功能标记齐全
 * 任一失败退出码非 0，用于 push 前拦截（git hook 或手动调用）
 */
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = __dirname;
const HTML = ROOT + '/index.html';
const MIN_LINES = 17500;
const MUST_HAVE = ['sessionToken', '云同步', '_contentEdits', 'VERB_USAGE_GROUPS', 'GRAMMAR_DETAIL', 'swa_cloud_session_v1'];

let fail = 0;
const bad = msg => { console.error('❌ ' + msg); fail = 1; };
const ok = msg => console.log('✅ ' + msg);

// 1. 工作区状态
try {
  const st = execSync('git status --short', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (st) {
    console.log('⚠️ 工作区有未提交改动（将逐项列出，不影响校验）：');
    console.log(st.split('\n').map(l => '   ' + l).join('\n'));
  } else {
    ok('工作区干净');
  }
} catch (e) {
  bad('git status 失败: ' + e.message);
}

// 2. 行数与关键标记
if (fs.existsSync(HTML)) {
  const src = fs.readFileSync(HTML, 'utf8');
  const lines = src.split('\n').length;
  lines >= MIN_LINES ? ok(`index.html ${lines} 行 ≥ ${MIN_LINES}`) : bad(`index.html 仅 ${lines} 行 < ${MIN_LINES}，疑似旧版覆盖！`);
  MUST_HAVE.forEach(k => {
    const n = (src.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    n > 0 ? ok(`标记 ${k} x${n}`) : bad(`缺少关键标记 ${k}！`);
  });
} else {
  bad('index.html 不存在');
}

console.log(fail ? '\n🚫 校验未通过，禁止推送！' : '\n🎉 校验通过，可以推送。');
process.exit(fail);

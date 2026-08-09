#!/usr/bin/env python3
"""
批量补丁脚本 v2：为外刊精炼独立 HTML 页面添加测验持久化 + 云同步功能。

策略：不再尝试部分匹配，而是完整替换目标代码块。
先检查文件是否已打过补丁，若已打过则跳过。
"""

import os
import sys

ARTICLES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'articles')
DATES = ['2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
         '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']

# ============================================================
# 1) 新 CSS（插在 </style> 之前）
# ============================================================
NEW_CSS = """

/* === Quiz \u6301\u4e45\u5316\u63a7\u4ef6 === */
.quiz-controls{display:flex;align-items:center;gap:10px;margin:0 0 12px;flex-wrap:wrap}
.quiz-reset-btn{padding:6px 14px;background:#fff;color:var(--brand);border:1px solid var(--brand);border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;transition:.15s}
.quiz-reset-btn:hover{background:var(--brand);color:#fff}
.quiz-stats{font-size:11.5px;color:var(--muted)}
.quiz-stats b{color:var(--brand)}
.quiz-notes-btn{padding:6px 14px;background:#fff;color:#7c3aed;border:1px solid #7c3aed;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;transition:.15s}
.quiz-notes-btn:hover{background:#7c3aed;color:#fff}
.quiz-notes-area{display:none;width:100%;margin-top:8px}
.quiz-notes-area.show{display:block}
.quiz-notes-area textarea{width:100%;min-height:60px;padding:8px 10px;border:1px solid #d4c4fc;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical;background:#fafaff;color:var(--ink);line-height:1.6}
.quiz-notes-saved{display:none;font-size:10px;color:#10b981;margin-top:4px}
.quiz-notes-saved.show{display:inline-block}
.quiz-section>h3{display:flex;align-items:center;gap:10px}
"""

# ============================================================
# 2) QuizData 对象（插在词汇数据注释之前）
# ============================================================
QUIZ_DATA_JS = """
// ========== \\u6d4b\\u9a8c\\u6301\\u4e45\\u5316\\u6a21\\u5757 ==========
const QuizData = {
  STORAGE_KEY: 'swa_quiz_v1',

  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return { version: 1, updatedAt: null, quizzes: {} };
      const data = JSON.parse(raw);
      if (!data.version) data.version = 1;
      if (!data.quizzes) data.quizzes = {};
      return data;
    } catch (e) { return { version: 1, updatedAt: null, quizzes: {} }; }
  },

  save(data) {
    try {
      data.updatedAt = new Date().toISOString();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { console.warn('localStorage \\u5199\\u5165\\u5931\\u8d25:', e); return false; }
  },

  getDate() {
    const m = document.title.match(/(\\d{4}-\\d{2}-\\d{2})/);
    return m ? m[1] : null;
  },

  getRecord(date, level) {
    const data = this.load();
    return data.quizzes?.[date]?.[level] || null;
  },

  getLatestAttempt(date, level) {
    const record = this.getRecord(date, level);
    return record?.attempts?.length ? record.attempts[0] : null;
  },

  getHistory(date, level) {
    const record = this.getRecord(date, level);
    return record?.attempts || [];
  },

  _sessionCache: {},

  recordAnswer(level, idx, chosen, isCorrect) {
    const date = this.getDate();
    if (!date) return;
    if (!this._sessionCache[date]) this._sessionCache[date] = {};
    if (!this._sessionCache[date][level]) {
      const totalQ = ARTICLES[level].quiz.length;
      this._sessionCache[date][level] = {
        answers: new Array(totalQ).fill(null).map(() => ({ chosen: null, correct: null }))
      };
    }
    this._sessionCache[date][level].answers[idx] = { chosen, correct: isCorrect };
    this._persistSession(date, level);
  },

  _persistSession(date, level) {
    const data = this.load();
    const cache = this._sessionCache[date]?.[level];
    if (!cache) return;
    if (!data.quizzes[date]) data.quizzes[date] = {};
    if (!data.quizzes[date][level]) {
      data.quizzes[date][level] = { totalQuestions: ARTICLES[level].quiz.length, attempts: [], notes: '' };
    }
    const attemptId = cache._attemptId || ('t_' + Date.now());
    cache._attemptId = attemptId;
    const attempt = {
      id: attemptId,
      timestamp: new Date().toISOString(),
      answers: cache.answers.slice(),
      score: cache.answers.filter(a => a.correct === true).length,
      completed: cache.answers.every(a => a.chosen !== null)
    };
    const record = data.quizzes[date][level];
    const existingIdx = record.attempts.findIndex(a => a.id === attemptId);
    if (existingIdx >= 0) {
      record.attempts[existingIdx] = attempt;
    } else {
      record.attempts.unshift(attempt);
    }
    this.save(data);
  },

  restoreQuizUI(date, level) {
    const attempt = this.getLatestAttempt(date, level);
    if (!attempt) return false;
    const quizItems = document.querySelectorAll('#' + level + '-quiz .quiz-item');
    quizItems.forEach((item, idx) => {
      if (idx >= attempt.answers.length) return;
      const ans = attempt.answers[idx];
      if (ans.chosen === null) return;
      const opts = item.querySelectorAll('.quiz-opts li');
      const explain = document.getElementById(level + '-explain-' + idx);
      const scoreEl = document.getElementById(level + '-score-' + idx);
      opts.forEach((li, j) => {
        li.classList.add('disabled');
        const correctAns = ARTICLES[level].quiz[idx].ans;
        if (j === correctAns) li.classList.add('correct');
        if (j === ans.chosen && j !== correctAns) li.classList.add('wrong');
      });
      if (explain) explain.classList.add('show');
      if (scoreEl) {
        scoreEl.textContent = ans.correct ? '\\u2713 \\u6b63\\u786e\\uff01' : '\\u2717 \\u9519\\u8bef\\uff0c\\u6b63\\u786e\\u7b54\\u6848\\u5df2\\u9ad8\\u4eae';
        scoreEl.className = 'quiz-score show ' + (ans.correct ? 'full' : 'zero');
      }
    });
    return true;
  },

  doResetQuiz(level) {
    if (!confirm('\\u786e\\u5b9a\\u8981\\u91cd\\u505a ' + level.toUpperCase() + ' \\u7684\\u5168\\u90e8\\u9898\\u76ee\\u5417\\uff1f\\n\\u5386\\u53f2\\u8bb0\\u5f55\\u5c06\\u88ab\\u4fdd\\u7559\\u3002')) return;
    const date = this.getDate();
    if (this._sessionCache[date]) delete this._sessionCache[date][level];
    const quizItems = document.querySelectorAll('#' + level + '-quiz .quiz-item');
    quizItems.forEach((item, idx) => {
      const opts = item.querySelectorAll('.quiz-opts li');
      const explain = document.getElementById(level + '-explain-' + idx);
      const scoreEl = document.getElementById(level + '-score-' + idx);
      opts.forEach(li => {
        li.classList.remove('disabled', 'correct', 'wrong', 'selected');
      });
      if (explain) explain.classList.remove('show');
      if (scoreEl) { scoreEl.textContent = ''; scoreEl.className = 'quiz-score'; }
    });
    bindQuizInteraction(level);
    renderQuizControls(level);
  },

  toggleNotes(level) {
    const date = this.getDate();
    const area = document.getElementById(level + '-notes-area');
    const saved = document.getElementById(level + '-notes-saved');
    if (!area) return;
    const isShowing = area.classList.toggle('show');
    if (isShowing) {
      const record = this.getRecord(date, level);
      const ta = area.querySelector('textarea');
      if (ta) ta.value = record?.notes || '';
      ta.focus();
    }
  },

  saveNotes(level) {
    const date = this.getDate();
    const ta = document.querySelector('#' + level + '-notes-area textarea');
    const saved = document.getElementById(level + '-notes-saved');
    if (!ta) return;
    const text = ta.value;
    const data = this.load();
    if (!data.quizzes[date]) data.quizzes[date] = {};
    if (!data.quizzes[date][level]) {
      data.quizzes[date][level] = { totalQuestions: ARTICLES[level].quiz.length, attempts: [], notes: '' };
    }
    data.quizzes[date][level].notes = text;
    this.save(data);
    if (saved) { saved.classList.add('show'); setTimeout(() => saved.classList.remove('show'), 2000); }
  }
};
"""

# ============================================================
# 3) renderQuizControls + bindQuizInteraction（替换原 quiz 交互代码块）
# ============================================================

# 原代码块起始标识
OLD_QUIZ_BLOCK_START = """// 给每个 quiz 绑定交互
['a1','a2','b1','b2'].forEach(level => {"""

# 原代码块结束标识（在 </script> 之前）
OLD_QUIZ_BLOCK_END = """});


"""

# 新代码块
NEW_QUIZ_BLOCK = """function renderQuizControls(level) {
  const section = document.getElementById(level + '-quiz');
  if (!section) return;
  const oldCtrl = section.querySelector('.quiz-controls');
  if (oldCtrl) oldCtrl.remove();
  const oldNotes = section.querySelector('.quiz-notes-area');
  if (oldNotes) oldNotes.remove();

  const date = QuizData.getDate();
  const record = QuizData.getRecord(date, level);
  const latest = QuizData.getLatestAttempt(date, level);
  const historyCount = record?.attempts?.length || 0;
  const totalQ = ARTICLES[level].quiz.length;

  const controls = document.createElement('div');
  controls.className = 'quiz-controls';
  controls.innerHTML =
    '<button class="quiz-reset-btn" onclick="QuizData.doResetQuiz(\\'' + level + '\\')">\\u{1F504} \\u91cd\\u505a</button>' +
    '<span class="quiz-stats">' +
      '\\u5df2\\u7b54\\u9898 <b>' + historyCount + '</b> \\u6b21' +
      (latest ? ' \\u00b7 \\u6700\\u8fd1\\u6b63\\u786e <b>' + latest.score + '/' + totalQ + '</b>' : '') +
    '</span>' +
    '<button class="quiz-notes-btn" onclick="QuizData.toggleNotes(\\'' + level + '\\')">\\u{1F4DD} \\u7b14\\u8bb0</button>';
  const h3 = section.querySelector('h3');
  if (h3) {
    h3.after(controls);
  } else {
    section.insertBefore(controls, section.firstChild);
  }

  const notesArea = document.createElement('div');
  notesArea.className = 'quiz-notes-area';
  notesArea.id = level + '-notes-area';
  notesArea.innerHTML =
    '<textarea placeholder="\\u8bb0\\u5f55\\u4f60\\u7684\\u5b66\\u4e60\\u7b14\\u8bb0..." oninput="QuizData.saveNotes(\\'' + level + '\\')">' + esc(record?.notes || '') + '</textarea>' +
    '<span class="quiz-notes-saved" id="' + level + '-notes-saved">\\u2713 \\u5df2\\u4fdd\\u5b58</span>';
  section.appendChild(notesArea);
}

// 给每个 quiz 绑定交互
function bindQuizInteraction(level) {
  const items = document.querySelectorAll('#' + level + '-quiz .quiz-item');
  items.forEach((item, idx) => {
    const submit = item.querySelector('.quiz-submit');
    const opts = item.querySelectorAll('.quiz-opts li');
    let chosen = -1;
    opts.forEach((li, j) => {
      const newLi = li.cloneNode(true);
      li.parentNode.replaceChild(newLi, li);
    });
    const freshOpts = item.querySelectorAll('.quiz-opts li');
    freshOpts.forEach((li, j) => {
      li.addEventListener('click', () => {
        if (li.classList.contains('disabled')) return;
        freshOpts.forEach(o => o.classList.remove('selected'));
        li.classList.add('selected');
        chosen = j;
      });
    });
    submit.onclick = () => {
      if (chosen === -1) {
        alert('\\u8bf7\\u5148\\u9009\\u62e9\\u4e00\\u4e2a\\u7b54\\u6848\\uff01');
        return;
      }
      const q = ARTICLES[level].quiz[idx];
      freshOpts.forEach((li, j) => {
        li.classList.add('disabled');
        if (j === q.ans) li.classList.add('correct');
        if (j === chosen && j !== q.ans) li.classList.add('wrong');
      });
      const explain = document.getElementById(level + '-explain-' + idx);
      explain.classList.add('show');
      const scoreEl = document.getElementById(level + '-score-' + idx);
      if (chosen === q.ans) {
        scoreEl.textContent = '\\u2713 \\u6b63\\u786e\\uff01';
        scoreEl.className = 'quiz-score show full';
      } else {
        scoreEl.textContent = '\\u2717 \\u9519\\u8bef\\uff0c\\u6b63\\u786e\\u7b54\\u6848\\u5df2\\u9ad8\\u4eae';
        scoreEl.className = 'quiz-score show zero';
      }
      QuizData.recordAnswer(level, idx, chosen, chosen === q.ans);
    };
  });
}

// 初始化
['a1','a2','b1','b2'].forEach(bindQuizInteraction);
"""


def patch_file(filepath):
    """对单个 HTML 文件执行所有补丁"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    patches_applied = 0

    # ---- 锚点 1: 在 </style> 之前插入新 CSS ----
    anchor1 = '</style>'
    if anchor1 in content and 'quiz-controls' not in content:
        content = content.replace(anchor1, NEW_CSS + '\n' + anchor1, 1)
        patches_applied += 1
        print(f"  [1] CSS \u6837\u5f0f\u5df2\u6ce8\u5165")

    # ---- 锚点 2: 在词汇数据注释之前插入 QuizData ----
    anchor2 = '/* ==================== \u8bcd\u6c47\u6570\u636e ==================== */'
    if anchor2 in content and 'const QuizData' not in content:
        content = content.replace(anchor2, QUIZ_DATA_JS + '\n' + anchor2, 1)
        patches_applied += 1
        print(f"  [2] QuizData \u5bf9\u8c61\u5df2\u6ce8\u5165")

    # ---- Anchor 3: Replace old quiz block with bindQuizInteraction + renderQuizControls ----
    # Replace everything from "// 给每个 quiz 绑定交互" to </script>
    if OLD_QUIZ_BLOCK_START in content and 'function bindQuizInteraction' not in content:
        start_pos = content.index(OLD_QUIZ_BLOCK_START)
        script_end = content.index('</script>', start_pos)
        content = content[:start_pos] + NEW_QUIZ_BLOCK + '\n' + content[script_end:]
        patches_applied += 1
        print(f"  [3] quiz interaction refactored to bindQuizInteraction + renderQuizControls")

    # ---- Anchor 4: Insert restore + controls after renderArticle init ----
    anchor4 = "['a1','a2','b1','b2'].forEach(renderArticle);"
    init_code = """
// ===== \\u6062\\u590d\\u5df2\\u4fdd\\u5b58\\u7684\\u7b54\\u9898\\u72b6\\u6001 + \\u6e32\\u67d3\\u63a7\\u4ef6 =====
const currentDate = QuizData.getDate();
['a1','a2','b1','b2'].forEach(level => {
  QuizData.restoreQuizUI(currentDate, level);
  renderQuizControls(level);
});"""
    if anchor4 in content and 'QuizData.restoreQuizUI(currentDate, level)' not in content:
        content = content.replace(anchor4, anchor4 + init_code, 1)
        patches_applied += 1
        print(f"  [4] \\u6062\\u590d+\\u63a7\\u4ef6\\u8c03\\u7528\\u5df2\\u6ce8\\u5165")

    if content == original:
        print(f"  \\u26a0 \\u8b66\\u544a\\uff1a\\u672a\\u68c0\\u6d4b\\u5230\\u4efb\\u4f55\\u53d8\\u5316\\uff01\\u6587\\u4ef6\\u53ef\\u80fd\\u5df2\\u6253\\u8fc7\\u8865\\u4e01\\u3002")
        return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  \\u2705 \\u5171\\u5e94\\u7528 {patches_applied} \\u4e2a\\u8865\\u4e01")
    return True


def main():
    print("=" * 60)
    print("\u5916\u520a\u6d4b\u9a8c\u6301\u4e45\u5316\u8865\u4e01\u811a\u672c v2")
    print("=" * 60)

    # 先还原已打补丁的文件（从 git）
    import subprocess
    for date in DATES:
        filepath = os.path.join(ARTICLES_DIR, f'{date}.html')
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                if 'const QuizData' in f.read():
                    print(f"\n\\u {date}.html \\u5df2\\u6253\\u8fc7\\u8865\\u4e01\\uff0c\\u6b63\\u5728\\u8fd8\\u539f...")
                    subprocess.run(['git', '-C', os.path.dirname(ARTICLES_DIR), 'checkout', '--', f'articles/{date}.html'],
                                   capture_output=True)

    success = 0
    for date in DATES:
        filepath = os.path.join(ARTICLES_DIR, f'{date}.html')
        if not os.path.exists(filepath):
            print(f"\n\\u274c \\u6587\\u4ef6\\u4e0d\\u5b58\\u5728: {filepath}")
            continue
        print(f"\n\\U0001f4c4 {date}.html")
        if patch_file(filepath):
            success += 1

    print(f"\n{'=' * 60}")
    print(f"\\u5b8c\\u6210\\uff1a{success}/{len(DATES)} \\u4e2a\\u6587\\u4ef6\\u4fee\\u6539\\u6210\\u529f")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()

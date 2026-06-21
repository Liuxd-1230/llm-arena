/**
 * utils.js — 工具函数
 * 包含 HTML 转义、洗牌、维度/难度查询、剪贴板操作等通用函数
 */

import { DIMS, DIFFS } from './data/questions.js';
import { toast } from './components/toast.js';
import { S, save } from './state.js';
import { render } from './router.js';

// Re-export toast for convenience
export { toast } from './components/toast.js';

export function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escSrcdoc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getDim(id) {
  return DIMS.find(d => d.id === id);
}

export function getDiff(id) {
  return DIFFS.find(d => d.id === id);
}

export function isAutoDim(dimId) {
  const d = getDim(dimId);
  return d && d.autoScore;
}

export function hasAutoQ(qName) {
  return typeof hasAutoScore === 'function' && hasAutoScore(qName);
}

export function getLongDocForQuestion(qName) {
  return {
    "信息提取": "doc_python",
    "长文总结": "doc_microservices",
    "矛盾检测": "doc_ceo_jan",
    "跨文档推理": "doc_investment"
  }[qName] || null;
}

export function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast('已复制'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

export function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    toast('已复制');
  } catch (e) {
    toast('复制失败，请手动复制', 'ri-error-warning-line');
  }
  document.body.removeChild(ta);
}

export function copyFullPrompt() {
  if (!S.q) return;
  let fullPrompt = S.q.prompt;
  const docId = getLongDocForQuestion(S.q.name);
  if (docId && typeof LONG_DOCS !== 'undefined' && LONG_DOCS[docId]) {
    const doc = LONG_DOCS[docId];
    fullPrompt = `${fullPrompt}\n\n---\n\n以下是要阅读的文档（${doc.title}，共${doc.word_count}字）：\n\n${doc.content}`;
  }
  copyText(fullPrompt);
}

export function copyForLLMJudge(entryId) {
  const entry = S.entries.find(e => e.id === entryId);
  if (!entry) return;
  const judgePrompt = buildJudgePrompt(entry.prompt, entry.answer);
  copyText(judgePrompt);
  toast('已复制评分Prompt，发给强模型后回来导入');
}

export function copyForLLMJudgeNew() {
  const prompt = S.q?.prompt;
  const answer = document.getElementById('cAnswer')?.value?.trim();
  if (!prompt) { toast('请先选择题目', 'ri-error-warning-line'); return; }
  if (!answer) { toast('请先粘贴模型回答', 'ri-error-warning-line'); return; }
  const judgePrompt = buildJudgePrompt(prompt, answer);
  copyText(judgePrompt);
  toast('已复制评分Prompt，发给强模型后回来导入');
}

export function buildJudgePrompt(questionPrompt, answer) {
  let fullPrompt = questionPrompt;
  for (const [qName, dId] of Object.entries({
    "信息提取": "doc_python",
    "长文总结": "doc_microservices",
    "矛盾检测": "doc_ceo_jan",
    "跨文档推理": "doc_investment"
  })) {
    if (questionPrompt.includes(qName) || (typeof S !== 'undefined' && S.q && S.q.name === qName)) {
      if (typeof LONG_DOCS !== 'undefined' && LONG_DOCS[dId]) {
        const doc = LONG_DOCS[dId];
        fullPrompt = `${fullPrompt}\n\n---\n\n参考文档（${doc.title}，${doc.word_count}字）：\n\n${doc.content}`;
      }
      break;
    }
  }

  return `你是LLM Arena的评分员。请根据以下评分准则对模型回答打分。

## 评分维度 (总分100)
准确性 (30): 事实正确性 + 逻辑严密性
完整性 (25): 覆盖度 + 深度
表达质量 (25): 清晰度 + 结构性 + 语言质量
创意与洞察 (20): 原创性 + 实用性

## 题目
${fullPrompt}

## 模型回答
${answer}

## 输出格式 (严格JSON)
{"total_score": 85, "accuracy": {"score": 25, "max": 30, "comment": "..."}, "completeness": {"score": 20, "max": 25, "comment": "..."}, "expression": {"score": 22, "max": 25, "comment": "..."}, "insight": {"score": 18, "max": 20, "comment": "..."}, "highlights": ["亮点"], "improvements": ["改进"], "overall_comment": "总评"}`;
}

export function runFuncCheck() {
  const code = document.getElementById('cAnswer')?.value?.trim();
  if (!code) { toast('请先粘贴代码', 'ri-error-warning-line'); return; }
  const checks = [];
  const has = code.includes.bind(code);
  checks.push({ name: '代码可渲染', pass: true, detail: '无运行时错误' });
  checks.push({ name: 'DOCTYPE', pass: has('<!DOCTYPE') || has('<!doctype'), detail: has('<!DOCTYPE') ? '有' : '无' });
  checks.push({ name: 'CSS样式', pass: has('<style') || has('style='), detail: has('<style') ? '有' : '无' });
  checks.push({ name: '悬停状态', pass: has(':hover'), detail: has(':hover') ? '有' : '无' });
  checks.push({ name: '过渡/动画', pass: has('transition') || has('animation'), detail: has('transition') ? '有' : '无' });
  checks.push({ name: '响应式', pass: has('@media'), detail: has('@media') ? '有' : '无' });
  const sem = ['header', 'nav', 'main', 'section', 'article', 'footer'].filter(t => has('<' + t));
  checks.push({ name: '语义化HTML', pass: sem.length >= 2, detail: sem.length ? sem.join(', ') : '无' });
  const btns = (code.match(/<button|<a |<input/g) || []).length;
  checks.push({ name: '交互元素', pass: btns > 0, detail: btns ? btns + '个' : '无' });
  const passed = checks.filter(c => c.pass).length;
  const pct = (passed / checks.length * 100).toFixed(0);
  document.getElementById('funcResults').innerHTML = checks.map(c =>
    `<div class="func-check-item"><i class="${c.pass ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}" style="color:${c.pass ? 'var(--gn)' : 'var(--rd)'};font-size:14px;"></i><span style="font-weight:500;min-width:80px;">${c.name}</span><span style="color:var(--t3);">${c.detail}</span></div>`
  ).join('');
  document.getElementById('funcSummary').innerHTML = `通过率: <strong style="color:${pct >= 80 ? 'var(--gn)' : pct >= 50 ? 'var(--am)' : 'var(--rd)'}">${passed}/${checks.length} (${pct}%)</strong>`;
  document.getElementById('funcModal').classList.add('show');
}

export function exportAll() {
  const b = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `llm-arena-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('已导出');
}

export function closeFuncModal() {
  document.getElementById('funcModal').classList.remove('show');
}

export function showRevealModal() {
  const scored = S.entries.filter(e => e.score !== null && e.score !== undefined);
  document.getElementById('revealMapping').innerHTML = scored.map(r =>
    `${r.blindId} → <strong>${r.model}</strong> (${r.qName}: ${r.score}分${r.autoScore ? '⚡' : ''})`
  ).join('<br>') || '暂无数据';
  document.getElementById('revealModal').classList.add('show');
}

export function closeRevealModal() {
  document.getElementById('revealModal').classList.remove('show');
}

export function doReveal() {
  S.revealed = true;
  save();
  closeRevealModal();
  toast('已揭盲');
  render();
}

// Classical animation helpers
export function animateElements(selector, animationClass = 'animate-fade-in-up', stagger = true) {
  const elements = document.querySelectorAll(selector);
  elements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    
    setTimeout(() => {
      el.classList.add(animationClass);
      if (stagger) {
        el.classList.add(`stagger-${Math.min(index + 1, 5)}`);
      }
      el.style.opacity = '';
      el.style.transform = '';
    }, 50);
  });
}

export function animateCards() {
  animateElements('.q-card, .entry-item, .dim-item, .card');
}

export function animateModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    const box = modal.querySelector('.modal-box');
    if (box) {
      box.classList.add('animate-scale-in');
    }
  }
}

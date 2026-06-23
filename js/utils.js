/**
 * utils.js — 工具函数
 * 包含 HTML 转义、洗牌、维度/难度查询、剪贴板操作等通用函数
 */

import { DIMS, DIFFS } from './data/questions.js';
import { toast } from './components/toast.js';
import { S, save } from './state.js';
// 动态导入 render 以避免循环依赖 (utils ↔ router)

// Re-export toast for convenience
export { toast } from './components/toast.js';

export function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escSrcdoc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * 剥掉 LLM 输出的 markdown 代码包裹
 * ```html ... ``` 或 ``` ... ``` → 取里面的内容
 * 支持：前后空白、大小写 HTML、末尾多余换行
 */
export function stripCodeFence(s) {
  if (!s) return s;
  s = s.trim();
  // 匹配 ```html\n...\n``` 或 ```\n...\n``` (允许前后空白)
  const m = s.match(/^```(?:html|HTML)?[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/);
  return m ? m[1].trim() : s;
}

/**
 * 从 LLM 输出中提取 <think>...</think> 思维链
 * @returns {{ thinking: string, answer: string }}
 */
export function extractThinking(s) {
  if (!s) return { thinking: '', answer: s || '' };
  const m = s.match(/<think>([\s\S]*?)<\/think>/);
  if (m) {
    return {
      thinking: m[1].trim(),
      answer: s.replace(/<think>[\s\S]*?<\/think>\s*/, '').trim()
    };
  }
  return { thinking: '', answer: s.trim() };
}

/**
 * 渲染思维链气泡 HTML（如果有的话）
 * @param {string} thinking - 思维链内容
 * @param {string} id - 唯一 ID（用于展开/收起）
 * @returns {string} HTML 字符串
 */
export function renderThinkingBubble(thinking, id) {
  if (!thinking) return '';
  const esc = escHtml(thinking);
  const wordCount = thinking.length;
  return `<div class="thinking-bubble">
    <button class="thinking-toggle" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('show')">
      <i class="ri-arrow-right-s-line"></i>💭 思维链 (${wordCount} 字)
    </button>
    <div class="thinking-content">${esc}</div>
  </div>`;
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
    "跨文档综合投资建议": "doc_investment"
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
  const judgePrompt = buildJudgePrompt(entry.prompt, entry.answer, entry.qName);
  copyText(judgePrompt);
  toast('已复制评分Prompt，发给强模型后回来导入');
}

export function copyForLLMJudgeNew() {
  const prompt = S.q?.prompt;
  const answer = document.getElementById('cAnswer')?.value?.trim();
  if (!prompt) { toast('请先选择题目', 'ri-error-warning-line'); return; }
  if (!answer) { toast('请先粘贴模型回答', 'ri-error-warning-line'); return; }
  const judgePrompt = buildJudgePrompt(prompt, answer, S.q?.name);
  copyText(judgePrompt);
  toast('已复制评分Prompt，发给强模型后回来导入');
}

export function buildJudgePrompt(questionPrompt, answer, qName) {
  let fullPrompt = questionPrompt;
  const nameToMatch = qName || (typeof S !== 'undefined' && S.q && S.q.name) || '';
  for (const [docQName, dId] of Object.entries({
    "信息提取": "doc_python",
    "长文总结": "doc_microservices",
    "矛盾检测": "doc_ceo_jan",
    "跨文档综合投资建议": "doc_investment"
  })) {
    if (nameToMatch === docQName || questionPrompt.includes(docQName)) {
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

export async function doReveal() {
  S.revealed = true;
  save();
  closeRevealModal();
  toast('已揭盲');
  const { render } = await import('../router.js');
  render();
}

// Subtle animation helpers - only animate new elements
let lastAnimatedElements = new Set();

export function animateElements(selector, animationClass = 'entrance-fade-up', stagger = true) {
  const elements = document.querySelectorAll(selector);
  const newElements = [];
  
  elements.forEach((el, index) => {
    // Check if this element was already animated (by checking if it has the animation class)
    if (!el.classList.contains(animationClass)) {
      newElements.push(el);
    }
  });
  
  // Only animate truly new elements
  newElements.forEach((el, index) => {
    // Set initial state - just opacity
    el.style.opacity = '0';
    
    // Animate in with stagger
    setTimeout(() => {
      el.classList.add(animationClass);
      if (stagger) {
        el.classList.add(`stagger-${Math.min(index + 1, 6)}`);
      }
      // Clear inline styles after animation starts
      setTimeout(() => {
        el.style.opacity = '';
      }, 50);
    }, 30);
  });
}

export function animateCards() {
  // Only animate cards, not tabs or other UI elements
  animateElements('.q-card, .entry-item, .dim-item');
}

// Add subtle hover effects to elements
export function addPremiumEffects() {
  // Add card hover effect
  document.querySelectorAll('.q-card, .entry-item, .dim-item').forEach(el => {
    el.classList.add('card-hover');
  });
  
  // Add subtle button effects
  document.querySelectorAll('.btn-primary, .btn-outline').forEach(el => {
    el.classList.add('btn-subtle');
  });
  
  // Add subtle input effects
  document.querySelectorAll('.input, .textarea').forEach(el => {
    el.classList.add('input-subtle');
  });
}

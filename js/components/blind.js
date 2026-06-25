/**
 * blind.js — 全屏盲测组件
 * 包含盲测流程：开始、展示、评分、跳过、退出
 */

import { S, save } from '../state.js';
import { getDim, getDiff, getLongDocForQuestion, escHtml, shuffle, stripCodeFence } from '../utils.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { render, showView } from '../router.js';

export function startBlind(dimFilter) {
  const queue = S.entries.filter(e => (e.score === null || e.score === undefined) && (!dimFilter || e.dimId === dimFilter));
  if (!queue.length) { toast('没有待测题目', 'ri-error-warning-line'); return; }
  S.blindQueue = shuffle([...queue]);
  S.blindIdx = 0;
  showBlindItem();
  document.getElementById('blindOverlay').classList.add('show');
}

export function showBlindItem() {
  if (S.blindIdx >= S.blindQueue.length) {
    exitBlind();
    toast('盲测完成！');
    showView('compare');
    return;
  }
  const item = S.blindQueue[S.blindIdx];
  const dim = getDim(item.dimId);
  const dm = getDiff(item.qDiff);
  document.getElementById('blindTitle').textContent = `${dim.name} · ${item.qName}`;
  document.getElementById('blindId').textContent = item.blindId;
  document.getElementById('blindProgressText').textContent = `${S.blindIdx + 1}/${S.blindQueue.length}`;
  document.getElementById('blindProgressFill').style.width = `${(S.blindIdx + 1) / S.blindQueue.length * 100}%`;
  document.getElementById('blindScoreMax').textContent = `/ ${dm.max}`;
  document.getElementById('blindScoreInput').max = dm.max;
  document.getElementById('blindScoreInput').value = '';
  document.getElementById('blindNoteInput').value = '';
  const frame = document.getElementById('blindFrame');
  if (item.dimId === 'code_frontend') {
    frame.style.display = 'block';
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(stripCodeFence(item.answer));
    doc.close();
    document.getElementById('btnToggleCode').style.display = '';
    document.getElementById('blindCodeArea').classList.remove('show');
  } else {
    const longDocId = getLongDocForQuestion(item.qName);
    frame.style.display = 'block';
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    if (longDocId && typeof LONG_DOCS !== 'undefined' && LONG_DOCS[longDocId]) {
      const ld = LONG_DOCS[longDocId];
      doc.write(`<!DOCTYPE html><html><head><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.8;font-size:15px;}.doc-s{background:#f8f9fa;border-left:3px solid #3b82f6;padding:20px;margin-bottom:24px;border-radius:0 8px 8px 0;}.doc-t{font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;margin-bottom:12px;}.doc-c{white-space:pre-wrap;font-size:13px;line-height:1.7;color:#374151;max-height:40vh;overflow:auto;}.ans{border-top:2px solid #e5e7eb;padding-top:20px;}.ans-t{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:12px;}pre{white-space:pre-wrap;font-size:14px;line-height:1.7;}</style></head><body><div class="doc-s"><div class="doc-t">📄 ${escHtml(ld.title)} (${ld.word_count}字)</div><div class="doc-c">${escHtml(ld.content)}</div></div><div class="ans"><div class="ans-t">模型回答</div><pre>${escHtml(item.answer)}</pre></div></body></html>`);
    } else {
      doc.write(`<!DOCTYPE html><html><head><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.8;}pre{white-space:pre-wrap;font-size:14px;line-height:1.7;}</style></head><body><pre>${escHtml(item.answer)}</pre></body></html>`);
    }
    doc.close();
    document.getElementById('btnToggleCode').style.display = 'none';
    document.getElementById('blindCodeArea').classList.remove('show');
  }
  setTimeout(() => document.getElementById('blindScoreInput').focus(), 100);
}

export function toggleCode() {
  const a = document.getElementById('blindCodeArea');
  if (a.classList.contains('show')) {
    a.classList.remove('show');
  } else {
    document.getElementById('blindCodePre').textContent = S.blindQueue[S.blindIdx].answer;
    a.classList.add('show');
  }
}

export function submitBlindScore() {
  const score = parseInt(document.getElementById('blindScoreInput').value);
  const note = document.getElementById('blindNoteInput').value.trim();
  if (isNaN(score)) { toast('请输入分数', 'ri-error-warning-line'); return; }
  const item = S.blindQueue[S.blindIdx];
  const dm = getDiff(item.qDiff);
  if (score < 0 || score > dm.max) { toast(`分数必须在 0-${dm.max} 之间`, 'ri-error-warning-line'); return; }
  const entry = S.entries.find(e => e.id === item.id);
  if (entry) {
    entry.score = score;
    entry.note = note;
    save();
  }
  S.blindIdx++;
  showBlindItem();
}

export function skipBlind() {
  S.blindIdx++;
  showBlindItem();
}

export function exitBlind() {
  // 保存已评分的进度
  const scoredCount = S.blindIdx;
  if (scoredCount > 0) {
    save();
    toast(`已保存 ${scoredCount} 条评分`);
  }
  document.getElementById('blindOverlay').classList.remove('show');
  renderSidebar();
  render();
}

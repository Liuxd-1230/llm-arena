/**
 * entries.js — 全部记录视图
 * 渲染所有已收集的评测记录列表，支持查看答案和全屏预览
 */

import { S } from '../state.js';
import { getDim, isAutoDim, escSrcdoc, escHtml } from '../utils.js';

// Toggle answer visibility
export function toggleAnswer(id) {
  const el = document.getElementById('answer-' + id);
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

// Open fullscreen preview for frontend code
export function openEntryPreview(id) {
  const entry = S.entries.find(e => e.id === id);
  if (!entry) return;
  
  // Create preview overlay
  const overlay = document.createElement('div');
  overlay.id = 'entryPreviewOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:200;background:var(--bg-primary);display:flex;flex-direction:column;';
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:var(--glass-bg);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur));border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="btn btn-ghost btn-sm" onclick="closeEntryPreview()"><i class="ri-close-line"></i> 关闭</button>
        <span style="font-size:14px;font-weight:600;">${entry.qName}</span>
        <span style="font-family:var(--mono);font-size:12px;padding:2px 8px;border-radius:100px;background:var(--bg-tertiary);color:var(--text-tertiary);">${entry.blindId}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('entryPreviewCode').style.display=document.getElementById('entryPreviewCode').style.display==='none'?'block':'none'"><i class="ri-code-s-slash-line"></i> 代码</button>
        ${entry.score !== null && entry.score !== undefined ? `<span style="font-size:14px;font-weight:700;color:var(--accent);">${entry.score}分</span>` : ''}
      </div>
    </div>
    <div style="flex:1;position:relative;overflow:hidden;">
      <iframe style="width:100%;height:100%;border:none;" srcdoc="${escSrcdoc(entry.answer)}"></iframe>
      <div id="entryPreviewCode" style="display:none;position:absolute;inset:0;background:var(--bg-primary);z-index:1;overflow:auto;padding:20px;">
        <pre style="font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;">${escHtml(entry.answer)}</pre>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

export function closeEntryPreview() {
  const overlay = document.getElementById('entryPreviewOverlay');
  if (overlay) overlay.remove();
}

export function renderEntries(el) {
  const unscored = S.entries.filter(e => e.score === null || e.score === undefined);
  const scored = S.entries.filter(e => e.score !== null && e.score !== undefined);
  el.innerHTML = `<div class="sec-head"><div class="sec-title"><i class="ri-list-check-3" style="margin-right:8px;"></i>全部记录</div>
    ${unscored.length > 0 ? `<button class="btn btn-primary" onclick="startBlind()"><i class="ri-play-line"></i> 盲测主观题 (${unscored.filter(e => !isAutoDim(e.dimId)).length})</button>` : ''}</div>
    ${S.entries.length === 0 ? '<div style="text-align:center;padding:60px 0;color:var(--t4);"><i class="ri-inbox-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>暂无数据</div>' : ''}
    ${unscored.length > 0 ? `<div class="label">待评分 (${unscored.length})</div><div class="entry-list" style="margin-bottom:24px;">${unscored.map(e => {
      const dim = getDim(e.dimId);
      const isCode = dim.isCode;
      return `<div class="entry-item" style="flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span class="entry-blind-id">${e.blindId}</span>
          <span style="font-size:13px;"><i class="${dim.icon}" style="color:${dim.color};font-size:14px;margin-right:4px;"></i>${dim.name}</span>
          <span style="font-size:13px;${S.revealed ? '' : 'filter:blur(4px);user-select:none;'}">${e.model}</span>
          <span style="font-size:12px;color:var(--t3);">${e.qName}</span>
          <span class="entry-status pending">待评分</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="toggleAnswer(${e.id})" title="查看答案"><i class="ri-eye-line"></i></button>
          ${isCode ? `<button class="btn btn-ghost btn-xs" onclick="openEntryPreview(${e.id})" title="全屏预览"><i class="ri-fullscreen-line"></i></button>` : ''}
          <button class="btn btn-ghost btn-xs" onclick="copyForLLMJudge(${e.id})" title="复制给强模型评分"><i class="ri-robot-line"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="openImportModal(${e.id})" title="导入评分"><i class="ri-braces-line"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button>
        </div>
        <div id="answer-${e.id}" style="display:none;width:100%;margin-top:8px;padding:12px;background:var(--bg-tertiary);border-radius:var(--r8);max-height:300px;overflow:auto;">
          <pre style="font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;">${escHtml(e.answer)}</pre>
        </div>
      </div>`;
    }).join('')}</div>` : ''}
    ${scored.length > 0 ? `<div class="label">已评分 (${scored.length})</div><div class="entry-list">${scored.map(e => {
      const dim = getDim(e.dimId);
      const isCode = dim.isCode;
      return `<div class="entry-item" style="flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <span class="entry-blind-id">${e.blindId}</span>
          <span style="font-size:13px;"><i class="${dim.icon}" style="color:${dim.color};font-size:14px;margin-right:4px;"></i>${dim.name}</span>
          <span style="font-size:13px;font-weight:600;">${e.model}</span>
          <span style="font-size:12px;color:var(--t3);">${e.qName}</span>
          <span class="entry-status scored">${e.score}分${e.autoScore ? '⚡' : e.note === '强模型评测' ? '🤖' : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
          <button class="btn btn-ghost btn-xs" onclick="toggleAnswer(${e.id})" title="查看答案"><i class="ri-eye-line"></i></button>
          ${isCode ? `<button class="btn btn-ghost btn-xs" onclick="openEntryPreview(${e.id})" title="全屏预览"><i class="ri-fullscreen-line"></i></button>` : ''}
          <button class="btn btn-ghost btn-xs" onclick="openImportModal(${e.id})" title="重新评分"><i class="ri-refresh-line"></i></button>
          <button class="btn btn-ghost btn-xs" onclick="deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button>
        </div>
        <div id="answer-${e.id}" style="display:none;width:100%;margin-top:8px;padding:12px;background:var(--bg-tertiary);border-radius:var(--r8);max-height:300px;overflow:auto;">
          <pre style="font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;">${escHtml(e.answer)}</pre>
        </div>
      </div>`;
    }).join('')}</div>` : ''}`;
}

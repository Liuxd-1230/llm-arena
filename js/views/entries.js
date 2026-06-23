/**
 * entries.js — 全部记录视图
 * 渲染所有已收集的评测记录，支持按模型分组、查看答案和全屏预览
 */

import { S } from '../state.js';
import { getDim, isAutoDim, escSrcdoc, escHtml, stripCodeFence } from '../utils.js';

// 视图模式：flat（平铺）| group（按模型分组）
let viewMode = 'group';
// 分组折叠状态
let collapsedModels = new Set();

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
      <iframe style="width:100%;height:100%;border:none;" srcdoc="${escSrcdoc(stripCodeFence(entry.answer))}"></iframe>
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

// Toggle view mode
export function toggleEntriesView() {
  viewMode = viewMode === 'flat' ? 'group' : 'flat';
  const el = document.getElementById('main');
  if (el) renderEntries(el);
}

// Toggle model group collapse
export function toggleModelGroup(model) {
  if (collapsedModels.has(model)) {
    collapsedModels.delete(model);
  } else {
    collapsedModels.add(model);
  }
  const el = document.getElementById('main');
  if (el) renderEntries(el);
}

// Render a single entry row
function renderEntryRow(e) {
  const dim = getDim(e.dimId);
  if (!dim) return '';
  const isCode = dim.isCode;
  const hasScore = e.score !== null && e.score !== undefined;
  const scoreDisplay = [];
  if (e.autoScore) scoreDisplay.push(`<span style="color:var(--success);">⚡${e.score}分</span>`);
  else if (e.llmScore) scoreDisplay.push(`<span style="color:var(--accent);">🤖${e.llmScore}分</span>`);
  else if (hasScore) scoreDisplay.push(`<span>${e.score}分</span>`);
  else scoreDisplay.push(`<span style="color:var(--text-muted);">待评分</span>`);

  return `<div class="entry-item" style="flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
      <span class="entry-blind-id">${e.blindId}</span>
      <span style="font-size:13px;"><i class="${dim.icon}" style="color:${dim.color};font-size:14px;margin-right:4px;"></i>${dim.name}</span>
      <span style="font-size:12px;color:var(--text-tertiary);">${e.qName}</span>
      <span style="font-size:11px;color:var(--text-muted);font-family:var(--mono);">${e.qDiff || ''}</span>
      <span style="margin-left:auto;font-size:12px;">${scoreDisplay.join(' ')}</span>
    </div>
    <div style="display:flex;align-items:center;gap:4px;">
      <button class="btn btn-ghost btn-xs" onclick="toggleAnswer(${e.id})" title="查看答案"><i class="ri-eye-line"></i></button>
      ${isCode ? `<button class="btn btn-ghost btn-xs" onclick="openEntryPreview(${e.id})" title="全屏预览"><i class="ri-fullscreen-line"></i></button>` : ''}
      <button class="btn btn-ghost btn-xs" onclick="copyForLLMJudge(${e.id})" title="复制给强模型评分"><i class="ri-robot-line"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="startApiJudge(${e.id})" title="API自动评价"><i class="ri-robot-2-line"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="openImportModal(${e.id})" title="${hasScore ? '重新评分' : '导入评分'}"><i class="${hasScore ? 'ri-refresh-line' : 'ri-braces-line'}"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button>
    </div>
    <div id="answer-${e.id}" style="display:none;width:100%;margin-top:8px;padding:12px;background:var(--bg-tertiary);border-radius:var(--r8);max-height:300px;overflow:auto;">
      <pre style="font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--text-secondary);white-space:pre-wrap;">${escHtml(e.answer)}</pre>
    </div>
  </div>`;
}

// Group entries by model
function groupByModel(entries) {
  const groups = {};
  for (const e of entries) {
    if (!groups[e.model]) groups[e.model] = [];
    groups[e.model].push(e);
  }
  return groups;
}

// Render grouped view
function renderGroupedView(entries) {
  const groups = groupByModel(entries);
  const models = Object.keys(groups).sort((a, b) => {
    // 按平均分降序
    const avgA = avgScore(groups[a]);
    const avgB = avgScore(groups[b]);
    return avgB - avgA;
  });

  return models.map(model => {
    const items = groups[model];
    const scored = items.filter(e => e.score !== null && e.score !== undefined);
    const avg = avgScore(items);
    const isCollapsed = collapsedModels.has(model);
    const dims = [...new Set(items.map(e => getDim(e.dimId)?.name).filter(Boolean))];

    return `<div class="model-group" style="margin-bottom:16px;">
      <div class="model-group-header" onclick="toggleModelGroup('${model.replace(/'/g, "\\'")}')" style="
        display:flex;align-items:center;gap:12px;padding:12px 16px;
        background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--r8);
        cursor:pointer;transition:all 0.15s;user-select:none;
      ">
        <i class="ri-arrow-${isCollapsed ? 'right' : 'down'}-s-line" style="font-size:16px;color:var(--text-muted);transition:transform 0.2s;"></i>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            ${S.revealed ? model : `<span style="filter:blur(3px);">${model}</span>`}
            <span style="font-size:11px;font-weight:400;color:var(--text-muted);">${dims.join(' · ')}</span>
          </div>
          <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">
            ${items.length} 条记录 · ${scored.length} 已评分${avg !== null ? ` · 均分 ${avg}` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${avg !== null ? `<span style="font-size:18px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;">${avg}</span>` : ''}
        </div>
      </div>
      ${isCollapsed ? '' : `<div style="padding:8px 0 0 24px;">${items.map(renderEntryRow).join('')}</div>`}
    </div>`;
  }).join('');
}

function avgScore(items) {
  const scored = items.filter(e => e.score !== null && e.score !== undefined);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length);
}

// Render flat view (original)
function renderFlatView(unscored, scored) {
  let html = '';
  if (unscored.length > 0) {
    html += `<div class="label">待评分 (${unscored.length})</div><div class="entry-list" style="margin-bottom:24px;">${unscored.map(renderEntryRow).join('')}</div>`;
  }
  if (scored.length > 0) {
    html += `<div class="label">已评分 (${scored.length})</div><div class="entry-list">${scored.map(renderEntryRow).join('')}</div>`;
  }
  return html;
}

export function renderEntries(el) {
  const unscored = S.entries.filter(e => e.score === null || e.score === undefined);
  const scored = S.entries.filter(e => e.score !== null && e.score !== undefined);
  const allEntries = [...unscored, ...scored];

  el.innerHTML = `<div class="sec-head">
    <div>
      <div class="sec-title"><i class="ri-list-check-3" style="margin-right:8px;"></i>全部记录</div>
      <div class="sec-desc">${S.entries.length} 条记录 · ${new Set(S.entries.map(e => e.model)).size} 个模型</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="tabs" style="margin-right:8px;">
        <div class="tab ${viewMode === 'group' ? 'active' : ''}" onclick="toggleEntriesView()"><i class="ri-folder-3-line" style="margin-right:4px;"></i>分组</div>
        <div class="tab ${viewMode === 'flat' ? 'active' : ''}" onclick="toggleEntriesView()"><i class="ri-list-unordered" style="margin-right:4px;"></i>平铺</div>
      </div>
      ${unscored.length > 0 ? `<button class="btn btn-primary" onclick="startBlind()"><i class="ri-play-line"></i> 盲测主观题 (${unscored.filter(e => !isAutoDim(e.dimId)).length})</button>` : ''}
      ${S.entries.filter(e => e.answer && !e.llmScore).length > 0 ? `<button class="btn btn-outline" onclick="openJudgeConfigModal()"><i class="ri-robot-2-line"></i> 批量API评价 (${S.entries.filter(e => e.answer && !e.llmScore).length})</button>` : ''}
    </div>
  </div>
  ${S.entries.length === 0 ? '<div style="text-align:center;padding:60px 0;color:var(--text-muted);"><i class="ri-inbox-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>暂无数据</div>' : ''}
  ${viewMode === 'group' ? renderGroupedView(allEntries) : renderFlatView(unscored, scored)}`;
}

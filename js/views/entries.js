/**
 * entries.js — 全部记录视图
 * 渲染所有已收集的评测记录列表
 */

import { S } from '../state.js';
import { getDim, isAutoDim } from '../utils.js';

export function renderEntries(el) {
  const unscored = S.entries.filter(e => e.score === null || e.score === undefined);
  const scored = S.entries.filter(e => e.score !== null && e.score !== undefined);
  el.innerHTML = `<div class="sec-head"><div class="sec-title"><i class="ri-list-check-3" style="margin-right:8px;"></i>全部记录</div>
    ${unscored.length > 0 ? `<button class="btn btn-primary" onclick="startBlind()"><i class="ri-play-line"></i> 盲测主观题 (${unscored.filter(e => !isAutoDim(e.dimId)).length})</button>` : ''}</div>
    ${S.entries.length === 0 ? '<div style="text-align:center;padding:60px 0;color:var(--t4);"><i class="ri-inbox-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>暂无数据</div>' : ''}
    ${unscored.length > 0 ? `<div class="label">待评分 (${unscored.length})</div><div class="entry-list" style="margin-bottom:24px;">${unscored.map(e => {
      const dim = getDim(e.dimId);
      return `<div class="entry-item"><span class="entry-blind-id">${e.blindId}</span><span style="font-size:13px;"><i class="${dim.icon}" style="color:${dim.color};font-size:14px;margin-right:4px;"></i>${dim.name}</span>
      <span style="font-size:13px;${S.revealed ? '' : 'filter:blur(4px);user-select:none;'}">${e.model}</span><span style="font-size:12px;color:var(--t3);">${e.qName}</span>
      <span class="entry-status pending">待评分</span>
      <button class="btn btn-ghost btn-xs" onclick="copyForLLMJudge(${e.id})" title="复制给强模型评分"><i class="ri-robot-line"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="openImportModal(${e.id})" title="导入评分"><i class="ri-braces-line"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button></div>`;
    }).join('')}</div>` : ''}
    ${scored.length > 0 ? `<div class="label">已评分 (${scored.length})</div><div class="entry-list">${scored.map(e => {
      const dim = getDim(e.dimId);
      return `<div class="entry-item"><span class="entry-blind-id">${e.blindId}</span><span style="font-size:13px;"><i class="${dim.icon}" style="color:${dim.color};font-size:14px;margin-right:4px;"></i>${dim.name}</span>
      <span style="font-size:13px;font-weight:600;">${e.model}</span><span style="font-size:12px;color:var(--t3);">${e.qName}</span>
      <span class="entry-status scored">${e.score}分${e.autoScore ? '⚡' : e.note === '强模型评测' ? '🤖' : ''}</span>
      <button class="btn btn-ghost btn-xs" onclick="openImportModal(${e.id})" title="重新评分"><i class="ri-refresh-line"></i></button>
      <button class="btn btn-ghost btn-xs" onclick="deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button></div>`;
    }).join('')}</div>` : ''}`;
}

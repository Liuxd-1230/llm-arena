/**
 * dim.js — 维度详情视图
 * 渲染维度页面、答案收集面板、添加/删除条目等
 */

import { DIMS, QS, DIFFS } from '../data/questions.js';
import { S, save } from '../state.js';
import { getDim, getDiff, hasAutoQ, getLongDocForQuestion } from '../utils.js';
import { toast } from '../components/toast.js';
import { renderSidebar } from '../components/sidebar.js';
import { render } from '../router.js';

export let submitMode = 'auto';

export function setSubmitMode(mode) {
  S.submitMode = mode;
  document.getElementById('modeAuto')?.classList.toggle('active', mode === 'auto');
  document.getElementById('modeQueue')?.classList.toggle('active', mode === 'queue');
  const btn = document.getElementById('submitBtn');
  if (btn) btn.innerHTML = mode === 'auto'
    ? '<i class="ri-add-line"></i> ⚡自动评分'
    : '<i class="ri-add-line"></i> 🤖提交待测区';
}

export function addEntry() {
  const model = document.getElementById('cModel')?.value?.trim();
  const answer = document.getElementById('cAnswer')?.value?.trim();
  if (!model) { toast('请输入模型名称', 'ri-error-warning-line'); return; }
  if (!answer) { toast('请粘贴模型回答', 'ri-error-warning-line'); return; }
  if (!S.q || !S.dim) { toast('请先选择题目', 'ri-error-warning-line'); return; }
  const dim = getDim(S.dim);
  const blindId = '#' + String(S.nextId).padStart(3, '0');
  const entry = {
    id: S.nextId, blindId, model, dimId: S.dim,
    qName: S.q.name, qDiff: S.q.diff, prompt: S.q.prompt,
    answer, score: null, note: '', autoScore: false
  };
  S.nextId++;

  // Auto-score if mode is auto AND question has auto-score
  if (S.submitMode === 'auto' && dim.autoScore && hasAutoQ(S.q.name)) {
    const result = autoScore(answer, S.q.name);
    if (result) {
      entry.score = result.total_score;
      entry.note = '自动评分';
      entry.autoScore = true;
      entry.autoDetail = result;
    }
  }

  S.entries.push(entry);
  save();
  document.getElementById('cModel').value = '';
  document.getElementById('cAnswer').value = '';
  toast(entry.autoScore ? `已评分 ${blindId}: ${entry.score}分⚡` : `已添加 ${blindId} → 待测区`);
  renderSidebar();
  render();
}

export function deleteEntry(id) {
  S.entries = S.entries.filter(e => e.id !== id);
  save();
  renderSidebar();
  render();
}

export function toggleEntryDetail(id) {
  const el = document.getElementById('detail-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

export function renderDim(el) {
  const dim = getDim(S.dim);
  const qs = QS.filter(q => q.dim === dim.id);
  const filtered = S.diff === 'all' ? qs : qs.filter(q => q.diff === S.diff);
  el.innerHTML = `
    <div class="sec-head"><div><div class="sec-title"><i class="${dim.icon}" style="color:${dim.color};margin-right:8px;"></i>${dim.name} ${dim.autoScore ? '<span style="font-size:12px;color:var(--gn);font-weight:400;">⚡自动评分</span>' : '<span style="font-size:12px;color:var(--am);font-weight:400;">👁️盲测</span>'}</div><div class="sec-desc">${dim.desc}</div></div></div>
    <div class="diff-row"><button class="diff-pill ${S.diff === 'all' ? 'active' : ''}" onclick="S.diff='all';render()">全部</button>${DIFFS.map(d => `<button class="diff-pill ${S.diff === d.id ? 'active' : ''}" onclick="S.diff='${d.id}';render()">${d.emoji} ${d.name}</button>`).join('')}</div>
    <div class="q-grid">${filtered.map(q => {
      const dm = getDiff(q.diff);
      return `<div class="q-card ${S.q?.name === q.name ? 'selected' : ''}" onclick="selectQ('${q.dim}','${q.diff}','${q.name.replace(/'/g, "\\'")}')">
      <div class="q-card-head"><span class="q-card-diff" style="background:${dim.color}15;color:${dim.color}">${dm.emoji} ${dm.name}</span><span style="margin-left:auto;font-size:11px;color:var(--t4);">上限${dm.max}分</span></div>
      <div class="q-card-name">${q.name}</div><div class="q-card-desc">${q.prompt.slice(0, 60)}...</div></div>`;
    }).join('')}</div>
    ${S.q ? renderCollectPanel() : ''}`;
}

export function renderCollectPanel() {
  const q = S.q;
  const dim = getDim(q.dim);
  const dm = getDiff(q.diff);
  const existing = S.entries.filter(e => e.qName === q.name);
  return `<div class="card" id="collectPanel" style="margin-top:20px;">
    <div class="card-header">
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
        <i class="${dim.icon}" style="color:${dim.color};font-size:16px;"></i> 收集答案
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;padding:3px 8px;border-radius:100px;background:var(--gn2);color:var(--gn);">⚡自动评分</span>
        <span style="font-size:11px;padding:3px 8px;border-radius:100px;background:var(--ac2);color:var(--ac);">🤖强模型评测</span>
      </div>
    </div>
    <div class="card-body">
      <div class="label">题目Prompt</div>
      <div style="background:var(--s2);border:1px solid var(--bdr);border-radius:var(--r8);padding:14px;font-size:13px;line-height:1.7;color:var(--t2);margin-bottom:12px;">${q.prompt}</div>
      <button class="btn btn-outline btn-sm" style="margin-bottom:16px;" onclick="copyFullPrompt()"><i class="ri-file-copy-line"></i> 复制完整Prompt</button>
      ${getLongDocForQuestion(q.name) ? `<div style="font-size:11px;color:var(--am);margin-bottom:12px;">📄 此题含长文档(${typeof LONG_DOCS !== 'undefined' && LONG_DOCS[getLongDocForQuestion(q.name)] ? LONG_DOCS[getLongDocForQuestion(q.name)].word_count : ''}字)，复制Prompt时自动包含</div>` : ''}
      <div class="label">模型名称</div>
      <input type="text" class="input" id="cModel" placeholder="如 GPT-4o / Claude-3.5 / Qwen-2.5" style="margin-bottom:12px;" list="modelList">
      <datalist id="modelList">${[...new Set(S.entries.map(e => e.model))].map(m => `<option value="${m}">`).join('')}</datalist>
      <div class="label">粘贴模型回答</div>
      <textarea class="textarea" id="cAnswer" placeholder="粘贴模型回答..." style="margin-bottom:12px;"></textarea>
      ${dim.autoScore ? `
      <div class="label">提交模式</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="diff-pill active" id="modeAuto" onclick="setSubmitMode('auto')"><i class="ri-flashlight-line"></i> ⚡自动评分</button>
        <button class="diff-pill" id="modeQueue" onclick="setSubmitMode('queue')"><i class="ri-robot-line"></i> 🤖提交待测区</button>
      </div>` : ''}
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn btn-primary" id="submitBtn" onclick="addEntry()"><i class="ri-add-line"></i> ${dim.autoScore ? '⚡自动评分' : '提交'}</button>
        ${dim.isCode ? `<button class="btn btn-outline" onclick="runFuncCheck()"><i class="ri-checkbox-circle-line"></i> 功能检测</button>` : ''}
        <button class="btn btn-outline" onclick="copyForLLMJudgeNew()" title="复制完整Prompt给强模型评分"><i class="ri-robot-line"></i> 复制给强模型</button>
        <button class="btn btn-outline" onclick="window._startApiRunForCurrent()" title="用配置的 API 自动回答当前问题" style="color:var(--ac);"><i class="ri-robot-2-line"></i> 🤖 自动答题</button>
      </div>
      ${existing.length > 0 ? `
      <div class="label" style="margin-top:16px;">已收集 (${existing.length})</div>
      <div style="font-size:11px;color:var(--t4);margin-bottom:8px;">⚡自动评分 | 🤖强模型评测 | 每条记录支持双轨评分</div>
      <div class="entry-list">${existing.map(e => {
        const hasAuto = e.autoScore || e.autoDetail;
        const hasLLM = e.llmDetail || e.note === '强模型评测';
        const scoreDisplay = [];
        if (hasAuto) scoreDisplay.push(`<span style="color:var(--gn);">⚡${e.score}分</span>`);
        if (hasLLM) scoreDisplay.push(`<span style="color:var(--ac);">🤖${e.llmScore || e.score}分</span>`);
        if (!hasAuto && !hasLLM && e.score !== null && e.score !== undefined) scoreDisplay.push(`<span>${e.score}分</span>`);
        if (e.score === null || e.score === undefined) scoreDisplay.push(`<span style="color:var(--t4);">待评分</span>`);
        return `
        <div style="background:var(--s2);border:1px solid var(--bdr);border-radius:var(--r8);margin-bottom:6px;">
          <div class="entry-item" style="flex-wrap:wrap;gap:8px;border:none;background:transparent;" onclick="toggleEntryDetail(${e.id})" style="cursor:pointer;">
            <span class="entry-blind-id">${e.blindId}</span>
            <span style="font-size:13px;font-weight:500;">${e.model}</span>
            <span style="font-size:12px;color:var(--t3);">${e.qName}</span>
            <span style="margin-left:auto;font-size:12px;">${scoreDisplay.join(' ')}</span>
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();copyForLLMJudge(${e.id})" title="复制Prompt给强模型"><i class="ri-robot-line"></i></button>
            ${!e.llmScore && e.answer ? `<button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();startApiJudge(${e.id})" title="API自动评价"><i class="ri-robot-2-line"></i></button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openImportModal(${e.id})" title="导入强模型评分"><i class="ri-braces-line"></i></button>
            <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();deleteEntry(${e.id})" title="删除"><i class="ri-delete-bin-line"></i></button>
          </div>
          <div id="detail-${e.id}" style="display:none;padding:0 16px 12px;">
            ${e.llmDetail ? `
              <div style="font-size:11px;font-weight:600;color:var(--ac);margin-bottom:8px;">🤖 强模型评语</div>
              ${e.llmDetail.highlights ? `<div style="font-size:12px;margin-bottom:6px;"><span style="color:var(--gn);">亮点：</span>${Array.isArray(e.llmDetail.highlights) ? e.llmDetail.highlights.join('；') : e.llmDetail.highlights}</div>` : ''}
              ${e.llmDetail.improvements ? `<div style="font-size:12px;margin-bottom:6px;"><span style="color:var(--am);">改进：</span>${Array.isArray(e.llmDetail.improvements) ? e.llmDetail.improvements.join('；') : e.llmDetail.improvements}</div>` : ''}
              ${e.llmDetail.overall_comment ? `<div style="font-size:12px;color:var(--t2);line-height:1.6;">${e.llmDetail.overall_comment}</div>` : ''}
              ${e.llmDetail.accuracy ? `<div style="font-size:11px;color:var(--t3);margin-top:6px;">准确性:${e.llmDetail.accuracy.score}/${e.llmDetail.accuracy.max} 完整性:${e.llmDetail.completeness?.score || '-'}/${e.llmDetail.completeness?.max || '-'} 表达:${e.llmDetail.expression?.score || '-'}/${e.llmDetail.expression?.max || '-'} 洞察:${e.llmDetail.insight?.score || '-'}/${e.llmDetail.insight?.max || '-'}</div>` : ''}
            ` : `<div style="font-size:12px;color:var(--t4);">暂无强模型评语</div>`}
            ${e.autoDetail ? `<div style="font-size:11px;font-weight:600;color:var(--gn);margin-top:8px;">⚡ 自动评分详情</div><div style="font-size:11px;color:var(--t3);">${JSON.stringify(e.autoDetail.breakdown || {})}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>` : ''}
      ${S.entries.filter(e => (e.score === null || e.score === undefined) && (e.dimId === dim.id)).length > 0 ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--bdr);">
        ${dim.id === 'code_frontend' ? `
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="startThumbView('${dim.id}')" style="flex:1;justify-content:center;"><i class="ri-image-line"></i> 缩略图盲测 (${S.entries.filter(e => (e.score === null || e.score === undefined) && (e.dimId === dim.id)).length}个待测)</button>
        </div>` : `
        <button class="btn btn-primary" onclick="startBlind('${dim.id}')" style="width:100%;justify-content:center;"><i class="ri-play-line"></i> 全屏盲测 (${S.entries.filter(e => (e.score === null || e.score === undefined) && (e.dimId === dim.id)).length}个待测)</button>`}
      </div>` : ''}
    </div>
  </div>`;
}

/**
 * import-modal.js — 导入评分弹窗组件
 * 支持JSON粘贴和手动打分两种导入模式
 */

import { S, save } from '../state.js';
import { getDim, getDiff } from '../utils.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { render } from '../router.js';

export let importTargetEntryId = null;

export function openImportModal(entryId) {
  importTargetEntryId = entryId;
  const entry = S.entries.find(e => e.id === entryId);
  if (!entry) return;
  const dim = getDim(entry.dimId);
  const dm = getDiff(entry.qDiff);
  document.getElementById('importTarget').innerHTML = `<strong>${entry.blindId}</strong> · ${dim.name} · ${entry.qName} · ${dm.emoji} 上限${dm.max}分 · 模型: ${entry.model}`;
  document.getElementById('importManualMax').textContent = `/ ${dm.max}`;
  document.getElementById('importManualScore').max = dm.max;
  document.getElementById('importManualScore').value = entry.score || '';
  document.getElementById('importManualNote').value = entry.note || '';
  document.getElementById('importJson').value = '';
  setImportMode('json');
  document.getElementById('importModal').classList.add('show');
}

export function closeImportModal() {
  document.getElementById('importModal').classList.remove('show');
  importTargetEntryId = null;
}

export function setImportMode(mode) {
  document.getElementById('importJsonWrap').style.display = mode === 'json' ? '' : 'none';
  document.getElementById('importManualWrap').style.display = mode === 'manual' ? '' : 'none';
  document.getElementById('btnJsonMode').classList.toggle('active', mode === 'json');
  document.getElementById('btnManualMode').classList.toggle('active', mode === 'manual');
}

export function doImportScore() {
  if (!importTargetEntryId) return;
  const entry = S.entries.find(e => e.id === importTargetEntryId);
  if (!entry) return;
  const dm = getDiff(entry.qDiff);

  const isManual = document.getElementById('importManualWrap').style.display !== 'none';
  if (isManual) {
    const score = parseInt(document.getElementById('importManualScore').value);
    const note = document.getElementById('importManualNote').value.trim();
    if (isNaN(score)) { toast('请输入分数', 'ri-error-warning-line'); return; }
    entry.llmScore = Math.min(score, dm.max);
    entry.llmNote = note || '手动评分';
    entry.llmDetail = null;
    if (!entry.autoScore) { entry.score = entry.llmScore; entry.note = entry.llmNote; }
    else { entry.note = '双轨评分'; }
  } else {
    const jsonStr = document.getElementById('importJson').value.trim();
    try {
      const data = JSON.parse(jsonStr);
      entry.llmScore = Math.min(data.total_score || 0, dm.max);
      entry.llmNote = data.overall_comment || data.comment || '强模型评测';
      entry.llmDetail = data;
      if (!entry.autoScore) { entry.score = entry.llmScore; entry.note = entry.llmNote; }
      else { entry.note = '双轨评分'; }
    } catch (e) {
      toast('JSON格式错误', 'ri-error-warning-line');
      return;
    }
  }
  if (entry.score === null || entry.score === undefined) {
    entry.score = entry.llmScore;
  }
  save();
  closeImportModal();
  const track = entry.autoScore ? `⚡${entry.score}+🤖${entry.llmScore}` : `🤖${entry.llmScore}`;
  toast(`已更新 ${entry.blindId}: ${track}`);
  renderSidebar();
  render();
}

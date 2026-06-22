/**
 * import-modal.js — 导入评分弹窗组件
 * 支持JSON粘贴、手动打分、AI自动评价三种导入模式
 */

import { S, save } from '../state.js';
import { getDim, getDiff } from '../utils.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { render } from '../router.js';

export let importTargetEntryId = null;

const API_CONFIG_KEY = 'llm_arena_api_config';

function loadApiProfiles() {
  try {
    return JSON.parse(localStorage.getItem(API_CONFIG_KEY)) || [];
  } catch { return []; }
}

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

  // Populate AI judge profile selector
  const profiles = loadApiProfiles();
  const profileSelect = document.getElementById('importJudgeProfile');
  if (profileSelect) {
    profileSelect.innerHTML = profiles.length === 0
      ? '<option value="">⚠️ 无 API 配置</option>'
      : profiles.map((p, i) => `<option value="${i}">${p.name} (${p.model})</option>`).join('');
  }

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
  document.getElementById('importJudgeWrap').style.display = mode === 'judge' ? '' : 'none';
  document.getElementById('btnJsonMode').classList.toggle('active', mode === 'json');
  document.getElementById('btnManualMode').classList.toggle('active', mode === 'manual');
  document.getElementById('btnJudgeMode').classList.toggle('active', mode === 'judge');
}

export function doImportScore() {
  if (!importTargetEntryId) return;
  const entry = S.entries.find(e => e.id === importTargetEntryId);
  if (!entry) return;
  const dm = getDiff(entry.qDiff);

  const isJudge = document.getElementById('importJudgeWrap').style.display !== 'none';
  const isManual = !isJudge && document.getElementById('importManualWrap').style.display !== 'none';

  if (isJudge) {
    // AI Judge mode — handled by doImportJudgeScore
    doImportJudgeScore(entry, dm);
    return;
  }

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
    if (!jsonStr) { toast('请粘贴JSON', 'ri-error-warning-line'); return; }
    try {
      const data = JSON.parse(jsonStr);
      // Handle multiple JSON formats
      let score = 0;
      let comment = '';
      
      if (data.total_score !== undefined) {
        score = data.total_score;
        comment = data.overall_comment || data.comment || '';
      } else if (data.score !== undefined) {
        score = data.score;
        comment = data.comment || data.note || '';
      } else if (data.total !== undefined) {
        score = data.total;
        comment = data.feedback || data.comment || '';
      } else if (typeof data === 'number') {
        score = data;
      } else {
        // Try to find any numeric value as score
        const keys = Object.keys(data);
        for (const key of keys) {
          if (typeof data[key] === 'number' && data[key] >= 0 && data[key] <= 100) {
            score = data[key];
            break;
          }
        }
      }
      
      entry.llmScore = Math.min(score, dm.max);
      entry.llmNote = comment || '强模型评测';
      entry.llmDetail = data;
      if (!entry.autoScore) { entry.score = entry.llmScore; entry.note = entry.llmNote; }
      else { entry.note = '双轨评分'; }
    } catch (e) {
      toast('JSON格式错误: ' + e.message, 'ri-error-warning-line');
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

// ==================== AI Judge tab ====================

async function doImportJudgeScore(entry, dm) {
  const profileSelect = document.getElementById('importJudgeProfile');
  const profileIdx = parseInt(profileSelect.value);
  if (isNaN(profileIdx)) {
    toast('请选择 API Profile', 'ri-error-warning-line');
    return;
  }

  const profiles = loadApiProfiles();
  const profile = profiles[profileIdx];
  if (!profile) {
    toast('无效的 Profile', 'ri-error-warning-line');
    return;
  }

  if (!entry.answer) {
    toast('该记录无回答内容', 'ri-error-warning-line');
    return;
  }

  // Show loading state on button
  const btn = document.querySelector('#importModal .modal-foot .btn-primary');
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<i class="ri-loader-4-line" style="animation:spin 1s linear infinite;"></i> 评价中...';
  btn.disabled = true;

  try {
    // Dynamically import to avoid circular deps
    const { startApiJudge } = await import('./api-judge.js');
    await startApiJudge(entry.id, profile);
    closeImportModal();
  } catch (err) {
    toast('评价失败: ' + err.message, 'ri-error-warning-line');
  } finally {
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
}

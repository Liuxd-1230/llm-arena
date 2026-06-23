/**
 * api-judge.js — API 自动评价（Judge）系统
 * 通过 API 将 judge prompt 发送到 LLM 评分模型，自动解析并导入分数
 */

import { S, save, getAuthHeaders } from '../state.js';
import { getDim, getDiff, buildJudgePrompt, escHtml } from '../utils.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { render } from '../router.js';


// ==================== API 配置管理 ====================

import { getJudgeProfile } from '../views/api-config.js';

// ==================== JSON 解析 ====================

function extractJsonFromResponse(text) {
  // Try direct parse first
  try {
    const data = JSON.parse(text);
    if (data.total_score !== undefined) return data;
  } catch {}

  // Try extracting from markdown code fences ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      const data = JSON.parse(fenceMatch[1].trim());
      if (data.total_score !== undefined) return data;
    } catch {}
  }

  // Try finding first { ... } block
  const braceMatch = text.match(/\{[\s\S]*"total_score"[\s\S]*\}/);
  if (braceMatch) {
    try {
      const data = JSON.parse(braceMatch[0]);
      if (data.total_score !== undefined) return data;
    } catch {}
  }

  return null;
}

// ==================== Progress Overlay ====================

function showJudgeProgress(message, progress) {
  let overlay = document.getElementById('judgeProgressOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'judgeProgressOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:300;
      background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:32px 40px;text-align:center;min-width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-size:32px;margin-bottom:16px;">🤖</div>
        <div id="judgeProgressMsg" style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">评价中...</div>
        <div style="background:var(--bg-tertiary);border-radius:100px;height:6px;overflow:hidden;margin-bottom:8px;">
          <div id="judgeProgressBar" style="height:100%;background:var(--accent);border-radius:100px;transition:width 0.3s;width:0%;"></div>
        </div>
        <div id="judgeProgressDetail" style="font-size:12px;color:var(--text-muted);"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  document.getElementById('judgeProgressMsg').textContent = message;
  document.getElementById('judgeProgressBar').style.width = progress + '%';
  document.getElementById('judgeProgressDetail').textContent = '';
}

function hideJudgeProgress() {
  const overlay = document.getElementById('judgeProgressOverlay');
  if (overlay) overlay.remove();
}

// ==================== 核心：单条评价 ====================

export async function startApiJudge(entryId, profile = null) {
  const entry = S.entries.find(e => e.id === entryId);
  if (!entry) { toast('未找到记录', 'ri-error-warning-line'); return; }
  if (!entry.answer) { toast('该记录无回答内容', 'ri-error-warning-line'); return; }

  if (!profile) {
    profile = getJudgeProfile();
    if (!profile) {
      toast('请先配置 API（在设置中添加 API Profile）', 'ri-error-warning-line');
      return;
    }
  }

  const judgePrompt = buildJudgePrompt(entry.prompt, entry.answer, entry.qName);
  const entryDim = getDim(entry.dimId);
  const entryDiff = getDiff(entry.qDiff);

  showJudgeProgress(`正在评价 ${entry.blindId}...`, 30);

  try {
    const body = {
      endpoint: profile.endpoint,
      api_key: profile.api_key,
      model: profile.model,
      messages: [{ role: 'user', content: judgePrompt }],
      max_tokens: profile.max_tokens || 1024,
      temperature: profile.temperature || 0.3,
    };

    const authHeaders = await getAuthHeaders();
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }

    const result = await resp.json();
    const content = result?.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('模型返回空内容');
    }

    showJudgeProgress(`正在解析评分 ${entry.blindId}...`, 70);

    const parsed = extractJsonFromResponse(content);
    if (!parsed) {
      // Parse failed — save raw response
      entry.llmDetail = { raw_response: content };
      entry.llmScore = null;
      entry.note = 'AI评价(解析失败)';
      save();
      hideJudgeProgress();
      toast(`${entry.blindId}: JSON解析失败，已保存原始回复`, 'ri-error-warning-line');
      return;
    }

    // Map parsed result to entry
    const maxScore = entryDiff ? entryDiff.max : 100;
    entry.llmScore = Math.min(parsed.total_score, maxScore);
    entry.llmDetail = parsed;
    entry.note = `AI评价 (${profile.model})`;

    // If no auto score yet, use LLM score as primary
    if (!entry.autoScore) {
      entry.score = entry.llmScore;
    } else {
      entry.note = '双轨评分';
    }

    showJudgeProgress(`评价完成 ${entry.blindId}: ${entry.llmScore}分`, 100);
    save();
    renderSidebar();

    await new Promise(r => setTimeout(r, 500));
    hideJudgeProgress();

    const track = entry.autoScore ? `⚡${entry.score}+🤖${entry.llmScore}` : `🤖${entry.llmScore}`;
    toast(`${entry.blindId}: ${track}`);
    render();
  } catch (err) {
    hideJudgeProgress();
    toast(`评价失败: ${err.message}`, 'ri-error-warning-line');
  }
}

// ==================== 批量评价 ====================

export async function startBatchJudge(entryIds, profile = null) {
  if (!entryIds || entryIds.length === 0) {
    toast('没有可评价的记录', 'ri-error-warning-line');
    return;
  }

  if (!profile) {
    profile = getJudgeProfile();
    if (!profile) {
      toast('请先配置 API（在设置中添加 API Profile）', 'ri-error-warning-line');
      return;
    }
  }
  const total = entryIds.length;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < total; i++) {
    const entryId = entryIds[i];
    const entry = S.entries.find(e => e.id === entryId);
    if (!entry || !entry.answer) {
      failCount++;
      continue;
    }

    const progress = Math.round(((i) / total) * 100);
    showJudgeProgress(`评价中 ${i + 1}/${total} · ${entry.blindId}...`, progress);

    try {
      const judgePrompt = buildJudgePrompt(entry.prompt, entry.answer, entry.qName);
      const entryDiff = getDiff(entry.qDiff);

      const authHeaders = await getAuthHeaders();
      const resp = await fetch('/api/llm', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          endpoint: profile.endpoint,
          api_key: profile.api_key,
          model: profile.model,
          messages: [{ role: 'user', content: judgePrompt }],
          max_tokens: profile.max_tokens || 1024,
          temperature: profile.temperature || 0.3,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
      const content = result?.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('空回复');

      const parsed = extractJsonFromResponse(content);
      if (!parsed) {
        entry.llmDetail = { raw_response: content };
        entry.llmScore = null;
        entry.note = 'AI评价(解析失败)';
        failCount++;
      } else {
        const maxScore = entryDiff ? entryDiff.max : 100;
        entry.llmScore = Math.min(parsed.total_score, maxScore);
        entry.llmDetail = parsed;
        entry.note = `AI评价 (${profile.model})`;
        if (!entry.autoScore) entry.score = entry.llmScore;
        else entry.note = '双轨评分';
        successCount++;
      }

      save();
    } catch (err) {
      failCount++;
      console.error(`[api-judge] Failed for entry ${entryId}:`, err);
    }

    // Brief pause between requests to avoid rate limits
    if (i < total - 1) await new Promise(r => setTimeout(r, 300));
  }

  showJudgeProgress(`批量评价完成 ${successCount}/${total}`, 100);
  await new Promise(r => setTimeout(r, 800));
  hideJudgeProgress();

  renderSidebar();
  render();
  toast(`批量评价完成: ${successCount}成功, ${failCount}失败`);
}

// ==================== Judge 配置弹窗 ====================

export function openJudgeConfigModal(preselectedEntryIds = null) {
  const profile = getJudgeProfile();
  const unscoredEntries = S.entries.filter(e => e.answer && !e.llmScore);
  const allScoredEntries = S.entries.filter(e => e.answer);

  let modal = document.getElementById('judgeConfigModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'judgeConfigModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box modal-classical" style="max-width:720px;">
        <h3><i class="ri-robot-line"></i> AI 自动评价</h3>
        <p>使用配置的评价模型自动评分。可在「API 配置」中切换。</p>
        <div id="judgeConfigContent"></div>
        <div class="modal-foot">
          <button class="btn btn-outline" onclick="closeJudgeConfigModal()">取消</button>
          <button class="btn btn-primary" id="judgeStartBtn" onclick="doStartJudgeFromModal()"><i class="ri-play-line"></i> 开始评价</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const content = document.getElementById('judgeConfigContent');

  const entriesToShow = preselectedEntryIds
    ? allScoredEntries.filter(e => preselectedEntryIds.includes(e.id))
    : unscoredEntries.length > 0 ? unscoredEntries : allScoredEntries;

  content.innerHTML = `
    <div style="margin-bottom:16px;padding:12px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--r8);">
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">评价模型（在 API 配置中修改）</div>
      <div style="font-size:14px;font-weight:600;color:var(--accent);">
        ${profile ? `${escHtml(profile.name)} — ${escHtml(profile.model)}` : '⚠️ 未配置，请先添加 API'}
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div class="label">
        待评价记录 (${entriesToShow.length})
        <button class="btn btn-ghost btn-xs" style="margin-left:8px;" onclick="toggleJudgeSelectAll()">
          <i class="ri-checkbox-line"></i> 全选/取消
        </button>
      </div>
      <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r8);background:var(--bg-tertiary);">
        ${entriesToShow.length === 0
          ? '<div style="padding:20px;text-align:center;color:var(--text-muted);">暂无待评价记录</div>'
          : entriesToShow.map(e => {
              const dim = getDim(e.dimId);
              return `
                <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px;">
                  <input type="checkbox" class="judge-entry-cb" value="${e.id}" ${preselectedEntryIds ? 'checked' : ''}>
                  <span class="entry-blind-id" style="font-size:11px;">${e.blindId}</span>
                  <i class="${dim?.icon || 'ri-file-line'}" style="font-size:13px;color:${dim?.color || 'var(--text-muted)'};"></i>
                  <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.qName}</span>
                  <span style="font-size:11px;color:var(--text-muted);">${e.model}</span>
                  ${e.llmScore ? `<span style="color:var(--accent);font-size:11px;">🤖${e.llmScore}</span>` : ''}
                </label>
              `;
            }).join('')}
      </div>
    </div>
    <div id="judgeConfigWarning" style="display:none;padding:8px 12px;background:var(--bg-error);border-radius:var(--r8);font-size:12px;color:var(--text-error);margin-bottom:8px;"></div>
  `;

  modal.classList.add('show');
}

window.toggleJudgeSelectAll = function() {
  const cbs = document.querySelectorAll('.judge-entry-cb');
  const allChecked = Array.from(cbs).every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
};

window.doStartJudgeFromModal = async function() {
  const profile = getJudgeProfile();
  if (!profile) {
    toast('请先配置评价模型（API 配置页面）', 'ri-error-warning-line');
    return;
  }

  const checkedCbs = document.querySelectorAll('.judge-entry-cb:checked');
  const entryIds = Array.from(checkedCbs).map(cb => parseInt(cb.value));

  if (entryIds.length === 0) {
    toast('请至少选择一条记录', 'ri-error-warning-line');
    return;
  }

  closeJudgeConfigModal();

  if (entryIds.length === 1) {
    await startApiJudge(entryIds[0], profile);
  } else {
    await startBatchJudge(entryIds, profile);
  }
};

window.closeJudgeConfigModal = function() {
  const modal = document.getElementById('judgeConfigModal');
  if (modal) modal.classList.remove('show');
};

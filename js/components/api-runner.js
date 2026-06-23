/**
 * api-runner.js — API 自动答题组件
 * 发送问题到配置好的 LLM API，支持流式显示答案
 */

import { S, save } from '../state.js';
import { render } from '../router.js';
import { renderSidebar } from '../components/sidebar.js';
import { toast } from '../components/toast.js';
import { getDim, getLongDocForQuestion } from '../utils.js';
import { getAnswerProfile } from '../views/api-config.js';
import { QS } from '../data/questions.js';

/**
 * 获取完整 prompt（包含长文档）
 */
function getFullPrompt(q) {
  let fullPrompt = q.prompt;
  const docId = getLongDocForQuestion(q.name);
  if (docId && typeof LONG_DOCS !== 'undefined' && LONG_DOCS[docId]) {
    const doc = LONG_DOCS[docId];
    fullPrompt = `${fullPrompt}\n\n---\n\n以下是要阅读的文档（${doc.title}，共${doc.word_count}字）：\n\n${doc.content}`;
  }
  return fullPrompt;
}

/**
 * 创建 API 运行遮罩层 HTML
 */
function createOverlayHTML(q, dim) {
  return `
    <div id="apiRunnerOverlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
      z-index:300;display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        background:var(--s1);border:1px solid var(--bdr);border-radius:var(--r16);
        width:90%;max-width:700px;max-height:80vh;overflow:hidden;
        display:flex;flex-direction:column;
      ">
        <!-- Header -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--ac2);display:flex;align-items:center;justify-content:center;">
            <i class="ri-robot-line" style="color:var(--ac);font-size:16px;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:var(--t1);">🤖 自动答题中</div>
            <div style="font-size:11px;color:var(--t4);" id="apiRunnerStatus">准备发送...</div>
          </div>
          <div style="font-size:12px;color:var(--t3);font-family:var(--mono);" id="apiRunnerTimer">0.0s</div>
        </div>

        <!-- Question Info -->
        <div style="padding:12px 20px;background:var(--s2);border-bottom:1px solid var(--bdr);">
          <div style="font-size:11px;color:var(--t4);margin-bottom:4px;">题目</div>
          <div style="font-size:13px;color:var(--t2);font-weight:500;">${dim.emoji || ''} ${q.name} (${q.diff})</div>
        </div>

        <!-- Streaming Answer -->
        <div style="flex:1;overflow-y:auto;padding:20px;min-height:200px;" id="apiRunnerContent">
          <div style="font-size:11px;color:var(--t4);margin-bottom:8px;">模型回答</div>
          <div style="font-size:13px;line-height:1.8;color:var(--t2);white-space:pre-wrap;word-break:break-word;" id="apiRunnerAnswer"></div>
        </div>

        <!-- Footer -->
        <div style="padding:12px 20px;border-top:1px solid var(--bdr);display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-outline btn-sm" onclick="window._apiRunner_cancel()">
            <i class="ri-close-line"></i> 取消
          </button>
        </div>
      </div>
    </div>
  `;
}

// 当前运行状态
let _currentAbort = null;
let _timerInterval = null;

/**
 * 启动自动答题
 * @param {string} dimId - 维度 ID
 * @param {string} diff - 难度
 * @param {string} qName - 题目名称
 */
export async function startApiRun(dimId, diff, qName) {
  const profile = getAnswerProfile();
  if (!profile) {
    toast('请先配置 API（侧边栏 → API 配置）', 'ri-error-warning-line');
    return;
  }
  if (!profile.endpoint || !profile.api_key || !profile.model) {
    toast('API 配置不完整，请检查 Endpoint、API Key 和模型名称', 'ri-error-warning-line');
    return;
  }

  const q = QS.find(q => q.dim === dimId && q.diff === diff && q.name === qName);
  if (!q) {
    toast('题目未找到', 'ri-error-warning-line');
    return;
  }

  const dim = getDim(dimId);
  const fullPrompt = getFullPrompt(q);

  // 显示遮罩
  document.body.insertAdjacentHTML('beforeend', createOverlayHTML(q, dim));

  const statusEl = document.getElementById('apiRunnerStatus');
  const answerEl = document.getElementById('apiRunnerAnswer');
  const timerEl = document.getElementById('apiRunnerTimer');

  // 计时器
  const startTime = Date.now();
  _timerInterval = setInterval(() => {
    if (timerEl) {
      timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    }
  }, 100);

  const controller = new AbortController();
  _currentAbort = controller;

  statusEl.textContent = '正在连接...';

  try {
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        endpoint: profile.endpoint,
        api_key: profile.api_key,
        model: profile.model,
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: profile.max_tokens || 2048,
        temperature: profile.temperature || 0.7,
        stream: true
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${resp.status}`);
    }

    statusEl.textContent = '接收回答中...';

    // 解析 SSE 流
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 保留未完成的行

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(dataStr);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            fullAnswer += delta;
            answerEl.textContent = fullAnswer;
            // 自动滚动到底部
            const contentEl = document.getElementById('apiRunnerContent');
            if (contentEl) contentEl.scrollTop = contentEl.scrollHeight;
          }
        } catch (e) {
          // 忽略解析错误的行
        }
      }
    }

    // 完成
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    statusEl.textContent = '完成！正在保存...';

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    timerEl.textContent = elapsed + 's';

    // 自动创建 entry
    if (fullAnswer.trim()) {
      _createApiEntry(dimId, q, profile.model, fullAnswer.trim());
      toast(`✅ ${q.name} 答题完成 (${elapsed}s)`);
    } else {
      toast('模型未返回有效回答', 'ri-error-warning-line');
    }

    // 关闭遮罩
    _removeOverlay();

  } catch (e) {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    if (e.name === 'AbortError') {
      statusEl.textContent = '已取消';
      setTimeout(_removeOverlay, 500);
      return;
    }
    statusEl.textContent = '错误';
    answerEl.textContent = `❌ 错误: ${e.message}\n\n请检查 API 配置是否正确。`;
    toast('自动答题失败: ' + e.message, 'ri-error-warning-line');
  } finally {
    _currentAbort = null;
  }
}

/**
 * 创建 API 答题 entry
 */
function _createApiEntry(dimId, q, modelName, answer) {
  const blindId = '#' + String(S.nextId).padStart(3, '0');
  const entry = {
    id: S.nextId,
    blindId,
    model: modelName,
    dimId: q.dim,
    qName: q.name,
    qDiff: q.diff,
    prompt: q.prompt,
    answer,
    score: null,
    note: 'API 自动答题',
    autoScore: false
  };
  S.nextId++;
  S.entries.push(entry);
  save();
  renderSidebar();
  render();
}

/**
 * 移除遮罩
 */
function _removeOverlay() {
  const overlay = document.getElementById('apiRunnerOverlay');
  if (overlay) overlay.remove();
}

/**
 * 取消当前运行
 */
window._apiRunner_cancel = function() {
  if (_currentAbort) {
    _currentAbort.abort();
    _currentAbort = null;
  }
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
  _removeOverlay();
  toast('已取消自动答题');
};

/**
 * 批量运行多个问题
 * @param {Array} questions - [{dimId, diff, qName}]
 */
export async function startBatchRun(questions) {
  const profile = getAnswerProfile();
  if (!profile) {
    toast('请先配置 API（侧边栏 → API 配置）', 'ri-error-warning-line');
    return;
  }
  if (!profile.endpoint || !profile.api_key || !profile.model) {
    toast('API 配置不完整', 'ri-error-warning-line');
    return;
  }

  if (!questions || questions.length === 0) {
    toast('没有需要运行的问题', 'ri-error-warning-line');
    return;
  }

  toast(`开始批量运行 ${questions.length} 个问题...`);

  let completed = 0;
  let failed = 0;

  for (const qInfo of questions) {
    const q = QS.find(q => q.dim === qInfo.dimId && q.diff === qInfo.diff && q.name === qInfo.qName);
    if (!q) { failed++; continue; }

    // 检查是否已有此题的回答
    const existing = S.entries.find(e => e.qName === q.name && e.model === profile.model);
    if (existing) {
      completed++;
      continue; // 跳过已有的
    }

    try {
      await _runSingleQuestion(q, profile);
      completed++;
    } catch (e) {
      console.error(`Failed: ${q.name}`, e);
      failed++;
    }

    // 间隔 500ms 避免限流
    await new Promise(r => setTimeout(r, 500));
  }

  toast(`批量完成: ${completed} 成功, ${failed} 失败`);
}

/**
 * 单题运行（无遮罩，用于批量）
 */
async function _runSingleQuestion(q, profile) {
  const fullPrompt = getFullPrompt(q);

  const resp = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: profile.endpoint,
      api_key: profile.api_key,
      model: profile.model,
      messages: [{ role: 'user', content: fullPrompt }],
      max_tokens: profile.max_tokens || 2048,
      temperature: profile.temperature || 0.7,
      stream: false
    })
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error('模型未返回回答');

  _createApiEntry(q.dim, q, profile.model, answer.trim());
}

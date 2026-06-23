/**
 * api-config.js — API 配置页面
 * 支持多 profile，可分别指定答题模型和评价模型
 */

import { S } from '../state.js';
import { toast } from '../components/toast.js';

const STORAGE_KEY = 'llm_arena_api_config';

function loadConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw) {
      // 兼容旧格式：如果没有 answerProfile/judgeProfile，初始化
      if (raw.answerProfile === undefined) raw.answerProfile = 0;
      if (raw.judgeProfile === undefined) raw.judgeProfile = raw.profiles.length > 1 ? 1 : 0;
      return raw;
    }
  } catch (e) {}
  return { profiles: [], activeProfile: 0, answerProfile: 0, judgeProfile: 0 };
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function getActiveProfile() {
  const cfg = loadConfig();
  if (cfg.profiles.length === 0) return null;
  return cfg.profiles[cfg.activeProfile] || cfg.profiles[0];
}

export function getAnswerProfile() {
  const cfg = loadConfig();
  if (cfg.profiles.length === 0) return null;
  return cfg.profiles[cfg.answerProfile] || cfg.profiles[0];
}

export function getJudgeProfile() {
  const cfg = loadConfig();
  if (cfg.profiles.length === 0) return null;
  return cfg.profiles[cfg.judgeProfile] || cfg.profiles[0];
}

export function getProfileNames() {
  return loadConfig().profiles.map(p => p.name);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function profileOptions(profiles, selectedIdx) {
  if (profiles.length === 0) return '<option value="">无配置</option>';
  return profiles.map((p, i) =>
    `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${esc(p.name)}${p.model ? ' — ' + esc(p.model) : ''}</option>`
  ).join('');
}

export function renderApiConfig(el) {
  const cfg = loadConfig();
  const profiles = cfg.profiles;

  el.innerHTML = `
    <div class="sec-head">
      <div>
        <div class="sec-title"><i class="ri-settings-3-line" style="color:var(--ac);margin-right:8px;"></i>API 配置</div>
        <div class="sec-desc">配置 API 后分别指定答题模型和评价模型</div>
      </div>
    </div>

    <!-- Profile Tabs -->
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
      ${profiles.map((p, i) => `
        <button class="diff-pill ${i === cfg.activeProfile ? 'active' : ''}"
                onclick="window._apiCfg_switch(${i})" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">
          ${esc(p.name)}${p.model ? `<span style="opacity:0.5;font-size:11px;margin-left:4px;">${esc(p.model)}</span>` : ''}
          ${profiles.length > 1 ? `<span style="margin-left:4px;font-size:11px;opacity:0.6;" onclick="event.stopPropagation();window._apiCfg_remove(${i})" title="删除">×</span>` : ''}
        </button>
      `).join('')}
      <button class="diff-pill" onclick="window._apiCfg_add()" style="border-style:dashed;"><i class="ri-add-line"></i> 添加</button>
    </div>

    <!-- Edit Current Profile -->
    ${profiles.length > 0 ? renderProfileForm(cfg) : `
      <div style="text-align:center;padding:40px 0;color:var(--text-muted);">
        <i class="ri-add-circle-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>
        点击上方「添加」创建 API 配置
      </div>
    `}

    <!-- Role Assignment -->
    ${profiles.length > 0 ? renderRoleAssignment(cfg) : ''}

    <!-- Usage Tips -->
    <div class="card" style="margin-top:16px;">
      <div class="card-header">
        <div style="font-size:13px;font-weight:600;"><i class="ri-lightbulb-line" style="color:var(--am);"></i> 使用说明</div>
      </div>
      <div class="card-body" style="font-size:12px;color:var(--t3);line-height:1.8;">
        <p>• API Key 仅保存在浏览器 localStorage，<strong style="color:var(--gn);">不会</strong>上传到服务器</p>
        <p>• 填好 Endpoint 和 Key 后点击「获取模型列表」自动拉取</p>
        <p>• <strong>答题模型</strong>：维度页「🤖 自动答题」使用的模型</p>
        <p>• <strong>评价模型</strong>：「🤖 API评价」和导入弹窗「AI评价」使用的 Judge 模型</p>
        <p>• 答题和评价可以用不同的 API（如 DeepSeek 答题，GPT-4o 评价）</p>
      </div>
    </div>
  `;
}

function renderProfileForm(cfg) {
  const p = cfg.profiles[cfg.activeProfile] || {};
  const models = p.models || [];

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
          <i class="ri-settings-3-line" style="color:var(--ac);"></i>
          <span>${esc(p.name || '未配置')}</span>
          <span id="apiCfgStatus" style="width:8px;height:8px;border-radius:50%;background:var(--t4);display:inline-block;" title="未测试"></span>
        </div>
        <button class="btn btn-outline btn-sm" onclick="window._apiCfg_test()"><i class="ri-wifi-line"></i> 测试</button>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <div class="label">名称</div>
            <input type="text" class="input" id="apiCfgName" value="${esc(p.name || '')}" placeholder="如 GPT-4o / DeepSeek">
          </div>
          <div>
            <div class="label">Endpoint</div>
            <input type="text" class="input" id="apiCfgEndpoint" value="${esc(p.endpoint || '')}" placeholder="https://api.openai.com">
          </div>
        </div>
        <div class="label">API Key</div>
        <div style="position:relative;margin-bottom:12px;">
          <input type="password" class="input" id="apiCfgKey" value="${esc(p.api_key || '')}" placeholder="sk-..." style="padding-right:40px;">
          <button class="btn btn-ghost btn-xs" onclick="window._apiCfg_toggleKey()" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);">
            <i class="ri-eye-line" id="apiCfgKeyIcon"></i>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <button class="btn btn-outline btn-sm" onclick="window._apiCfg_fetchModels()"><i class="ri-refresh-line"></i> 获取模型列表</button>
          <span id="apiModelStatus" style="font-size:11px;color:var(--t4);">输入 Endpoint 和 Key 后获取</span>
        </div>
        <div class="label">模型</div>
        <select class="input" id="apiCfgModel" style="margin-bottom:16px;">
          ${models.length > 0
            ? models.map(m => `<option value="${esc(m)}" ${m === p.model ? 'selected' : ''}>${esc(m)}</option>`).join('')
            : `<option value="${esc(p.model || '')}" selected>${esc(p.model || '请先获取模型列表')}</option>`}
        </select>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" onclick="window._apiCfg_save()"><i class="ri-save-line"></i> 保存</button>
          <button class="btn btn-outline" onclick="window._apiCfg_preset('openai')">OpenAI</button>
          <button class="btn btn-outline" onclick="window._apiCfg_preset('deepseek')">DeepSeek</button>
          <button class="btn btn-outline" onclick="window._apiCfg_preset('qwen')">通义千问</button>
        </div>
      </div>
    </div>
    <div id="apiTestResult" style="display:none;margin-bottom:16px;">
      <div class="card">
        <div class="card-body" id="apiTestContent" style="font-size:13px;color:var(--t2);white-space:pre-wrap;line-height:1.7;"></div>
      </div>
    </div>
  `;
}

function renderRoleAssignment(cfg) {
  const profiles = cfg.profiles;
  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div style="font-size:13px;font-weight:600;"><i class="ri-git-branch-line" style="color:var(--ac);"></i> 角色分配</div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--gn);">🤖 答题模型</div>
            <div style="font-size:11px;color:var(--t4);margin-bottom:8px;">「自动答题」使用的模型</div>
            <select class="input" id="apiCfgAnswerProfile" onchange="window._apiCfg_setRole('answer', this.value)">
              ${profileOptions(profiles, cfg.answerProfile)}
            </select>
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--ac);">⚖️ 评价模型</div>
            <div style="font-size:11px;color:var(--t4);margin-bottom:8px;">「API评价」使用的 Judge 模型</div>
            <select class="input" id="apiCfgJudgeProfile" onchange="window._apiCfg_setRole('judge', this.value)">
              ${profileOptions(profiles, cfg.judgeProfile)}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== 操作函数 ====================

window._apiCfg_switch = function(idx) {
  const cfg = loadConfig();
  saveFormToProfile(cfg);
  cfg.activeProfile = idx;
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
};

window._apiCfg_add = function() {
  const cfg = loadConfig();
  saveFormToProfile(cfg);
  cfg.profiles.push({ name: `Profile ${cfg.profiles.length + 1}`, endpoint: '', api_key: '', model: '', models: [] });
  cfg.activeProfile = cfg.profiles.length - 1;
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
  toast('已添加');
};

window._apiCfg_remove = function(idx) {
  const cfg = loadConfig();
  if (cfg.profiles.length <= 1) { toast('至少保留一个', 'ri-error-warning-line'); return; }
  cfg.profiles.splice(idx, 1);
  if (cfg.activeProfile >= cfg.profiles.length) cfg.activeProfile = cfg.profiles.length - 1;
  if (cfg.answerProfile >= cfg.profiles.length) cfg.answerProfile = 0;
  if (cfg.judgeProfile >= cfg.profiles.length) cfg.judgeProfile = 0;
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
  toast('已删除');
};

window._apiCfg_save = function() {
  const cfg = loadConfig();
  saveFormToProfile(cfg);
  saveConfig(cfg);
  toast('已保存');
};

window._apiCfg_toggleKey = function() {
  const input = document.getElementById('apiCfgKey');
  const icon = document.getElementById('apiCfgKeyIcon');
  if (input.type === 'password') { input.type = 'text'; icon.className = 'ri-eye-off-line'; }
  else { input.type = 'password'; icon.className = 'ri-eye-line'; }
};

window._apiCfg_preset = function(name) {
  const presets = {
    openai:   { endpoint: 'https://api.openai.com' },
    deepseek: { endpoint: 'https://api.deepseek.com' },
    qwen:     { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode' }
  };
  const p = presets[name];
  if (!p) return;
  const ep = document.getElementById('apiCfgEndpoint');
  if (ep) ep.value = p.endpoint;
  toast(`已加载 ${name} 预设，请填写 Key 后获取模型`);
};

window._apiCfg_setRole = function(role, val) {
  const cfg = loadConfig();
  const idx = parseInt(val);
  if (isNaN(idx)) return;
  if (role === 'answer') cfg.answerProfile = idx;
  else if (role === 'judge') cfg.judgeProfile = idx;
  saveConfig(cfg);
  toast(`${role === 'answer' ? '答题' : '评价'}模型已切换`);
};

window._apiCfg_fetchModels = async function() {
  const endpoint = document.getElementById('apiCfgEndpoint')?.value?.trim();
  const apiKey = document.getElementById('apiCfgKey')?.value?.trim();
  const statusEl = document.getElementById('apiModelStatus');

  if (!endpoint) { toast('请先填写 Endpoint', 'ri-error-warning-line'); return; }
  if (!apiKey) { toast('请先填写 API Key', 'ri-error-warning-line'); return; }

  statusEl.textContent = '正在获取...';
  statusEl.style.color = 'var(--am)';

  try {
    const resp = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, api_key: apiKey })
    });
    const data = await resp.json();

    if (data.error) {
      statusEl.textContent = '❌ ' + data.error;
      statusEl.style.color = 'var(--rd)';
      return;
    }

    const models = data.models || [];
    if (models.length === 0) {
      statusEl.textContent = '未获取到模型';
      statusEl.style.color = 'var(--am)';
      return;
    }

    const cfg = loadConfig();
    const idx = cfg.activeProfile || 0;
    if (cfg.profiles[idx]) {
      cfg.profiles[idx].models = models;
      if (!cfg.profiles[idx].model && models.length > 0) cfg.profiles[idx].model = models[0];
      saveConfig(cfg);
    }

    const select = document.getElementById('apiCfgModel');
    const currentModel = select?.value || '';
    if (select) {
      select.innerHTML = models.map(m =>
        `<option value="${esc(m)}" ${m === currentModel ? 'selected' : ''}>${esc(m)}</option>`
      ).join('');
    }

    statusEl.textContent = `✅ ${models.length} 个模型`;
    statusEl.style.color = 'var(--gn)';
    toast(`获取到 ${models.length} 个模型`);
  } catch (e) {
    statusEl.textContent = '❌ ' + e.message;
    statusEl.style.color = 'var(--rd)';
  }
};

window._apiCfg_test = async function() {
  const endpoint = document.getElementById('apiCfgEndpoint')?.value?.trim();
  const apiKey = document.getElementById('apiCfgKey')?.value?.trim();
  const model = document.getElementById('apiCfgModel')?.value?.trim();

  if (!endpoint || !apiKey || !model) { toast('请填写完整配置', 'ri-error-warning-line'); return; }

  const dot = document.getElementById('apiCfgStatus');
  const result = document.getElementById('apiTestResult');
  const content = document.getElementById('apiTestContent');

  dot.style.background = 'var(--am)';
  result.style.display = 'block';
  content.textContent = '测试中...';

  try {
    const t0 = Date.now();
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, api_key: apiKey, model, messages: [{ role: 'user', content: 'Say hi' }], max_tokens: 50 })
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const data = await resp.json();

    if (data.error) {
      dot.style.background = 'var(--rd)';
      content.innerHTML = `<span style="color:var(--rd);">❌ 失败 (${elapsed}s)</span>\n${esc(data.error)}`;
      return;
    }

    const reply = data.choices?.[0]?.message?.content || '(无)';
    dot.style.background = 'var(--gn)';
    content.innerHTML = `<span style="color:var(--gn);">✅ 成功 (${elapsed}s)</span>\n模型: ${esc(model)}\n回复: ${esc(reply)}`;
  } catch (e) {
    dot.style.background = 'var(--rd)';
    content.innerHTML = `<span style="color:var(--rd);">❌ 异常</span>\n${esc(e.message)}`;
  }
};

function saveFormToProfile(cfg) {
  if (cfg.profiles.length === 0) return;
  const p = cfg.profiles[cfg.activeProfile || 0];
  if (!p) return;
  const name = document.getElementById('apiCfgName')?.value?.trim();
  const endpoint = document.getElementById('apiCfgEndpoint')?.value?.trim();
  const apiKey = document.getElementById('apiCfgKey')?.value?.trim();
  const model = document.getElementById('apiCfgModel')?.value?.trim();
  if (name) p.name = name;
  if (endpoint) p.endpoint = endpoint;
  if (apiKey) p.api_key = apiKey;
  if (model) p.model = model;
}

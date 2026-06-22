/**
 * api-config.js — API 配置页面
 * 支持多 profile 的 LLM API 配置，测试连接，存储到 localStorage
 */

import { S } from '../state.js';
import { render } from '../router.js';
import { toast } from '../components/toast.js';

const STORAGE_KEY = 'llm_arena_api_config';

/** 加载配置 */
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { profiles: [], activeProfile: 0 };
}

/** 保存配置 */
function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

/** 获取当前激活的 profile */
export function getActiveProfile() {
  const cfg = loadConfig();
  if (cfg.profiles.length === 0) return null;
  return cfg.profiles[cfg.activeProfile] || cfg.profiles[0];
}

/** 获取所有 profile 名称 */
export function getProfileNames() {
  return loadConfig().profiles.map(p => p.name);
}

/** 渲染 API 配置页面 */
export function renderApiConfig(el) {
  const cfg = loadConfig();
  const activeIdx = cfg.activeProfile || 0;
  const profiles = cfg.profiles;
  const current = profiles[activeIdx] || {};

  el.innerHTML = `
    <div class="sec-head">
      <div>
        <div class="sec-title"><i class="ri-settings-3-line" style="color:var(--ac);margin-right:8px;"></i>API 配置</div>
        <div class="sec-desc">配置 OpenAI 兼容 API，用于自动答题和模型评测</div>
      </div>
    </div>

    <!-- Profile Tabs -->
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">
      ${profiles.map((p, i) => `
        <button class="diff-pill ${i === activeIdx ? 'active' : ''}"
                onclick="window._apiConfig_switchProfile(${i})"
                style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">
          ${esc(p.name)}
          ${profiles.length > 1 ? `<span style="margin-left:4px;font-size:11px;opacity:0.6;" onclick="event.stopPropagation();window._apiConfig_removeProfile(${i})" title="删除">×</span>` : ''}
        </button>
      `).join('')}
      <button class="diff-pill" onclick="window._apiConfig_addProfile()" style="border-style:dashed;">
        <i class="ri-add-line"></i> 添加
      </button>
    </div>

    <!-- Config Form -->
    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
          <i class="ri-settings-3-line" style="color:var(--ac);"></i>
          <span>${esc(current.name || '未配置')}</span>
          <span id="apiConfigStatus" style="width:8px;height:8px;border-radius:50%;background:var(--t4);display:inline-block;" title="未测试"></span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="window._apiConfig_test()">
            <i class="ri-wifi-line"></i> 测试连接
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="label">Profile 名称</div>
        <input type="text" class="input" id="apiCfgName" value="${esc(current.name || '')}"
               placeholder="如 GPT-4o / Claude-3.5 / Qwen-2.5" style="margin-bottom:12px;">

        <div class="label">API Endpoint URL</div>
        <input type="text" class="input" id="apiCfgEndpoint" value="${esc(current.endpoint || '')}"
               placeholder="如 https://api.openai.com 或 https://api.anthropic.com" style="margin-bottom:12px;">
        <div style="font-size:11px;color:var(--t4);margin-bottom:12px;">
          无需填写 /v1/chat/completions，服务端会自动拼接。支持 OpenAI / DeepSeek / 通义千问 / Moonshot / Groq 等兼容接口。
        </div>

        <div class="label">API Key</div>
        <div style="position:relative;margin-bottom:12px;">
          <input type="password" class="input" id="apiCfgKey" value="${esc(current.api_key || '')}"
                 placeholder="sk-..." style="padding-right:40px;">
          <button class="btn btn-ghost btn-xs" onclick="window._apiConfig_toggleKeyVisibility()"
                  style="position:absolute;right:4px;top:50%;transform:translateY(-50%);">
            <i class="ri-eye-line" id="apiCfgKeyIcon"></i>
          </button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <div class="label">模型名称</div>
            <input type="text" class="input" id="apiCfgModel" value="${esc(current.model || '')}"
                   placeholder="如 gpt-4o / claude-3-5-sonnet / qwen-plus">
          </div>
          <div>
            <div class="label">Max Tokens</div>
            <input type="number" class="input" id="apiCfgMaxTokens" value="${current.max_tokens || 2048}"
                   min="1" max="128000">
          </div>
          <div>
            <div class="label">Temperature</div>
            <input type="number" class="input" id="apiCfgTemp" value="${current.temperature || 0.7}"
                   min="0" max="2" step="0.1">
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn-primary" onclick="window._apiConfig_save()">
            <i class="ri-save-line"></i> 保存配置
          </button>
          <button class="btn btn-outline" onclick="window._apiConfig_loadPreset('openai')">
            <i class="ri-flashlight-line"></i> OpenAI 预设
          </button>
          <button class="btn btn-outline" onclick="window._apiConfig_loadPreset('deepseek')">
            <i class="ri-flashlight-line"></i> DeepSeek 预设
          </button>
          <button class="btn btn-outline" onclick="window._apiConfig_loadPreset('qwen')">
            <i class="ri-flashlight-line"></i> 通义千问预设
          </button>
        </div>
      </div>
    </div>

    <!-- Test Result -->
    <div id="apiTestResult" style="margin-top:16px;display:none;">
      <div class="card">
        <div class="card-header">
          <div style="font-size:13px;font-weight:600;"><i class="ri-chat-check-line"></i> 测试结果</div>
        </div>
        <div class="card-body" id="apiTestContent" style="font-size:13px;color:var(--t2);white-space:pre-wrap;line-height:1.7;"></div>
      </div>
    </div>

    <!-- Usage Tips -->
    <div class="card" style="margin-top:16px;">
      <div class="card-header">
        <div style="font-size:13px;font-weight:600;"><i class="ri-lightbulb-line" style="color:var(--am);"></i> 使用说明</div>
      </div>
      <div class="card-body" style="font-size:12px;color:var(--t3);line-height:1.8;">
        <p>• API Key 仅保存在浏览器 localStorage，<strong style="color:var(--gn);">不会</strong>上传到服务器 state.json</p>
        <p>• 服务端仅作为代理转发请求，避免浏览器 CORS 限制</p>
        <p>• 在维度详情页点击「🤖 自动答题」即可让模型自动回答当前问题</p>
        <p>• 支持 OpenAI、DeepSeek、通义千问、Moonshot、Groq 等 OpenAI 兼容接口</p>
      </div>
    </div>
  `;
}

// ==================== 操作函数 ====================

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window._apiConfig_switchProfile = function(idx) {
  const cfg = loadConfig();
  // 先保存当前表单
  saveFormToProfile(cfg);
  cfg.activeProfile = idx;
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
};

window._apiConfig_addProfile = function() {
  const cfg = loadConfig();
  saveFormToProfile(cfg);
  const newProfile = {
    name: `Profile ${cfg.profiles.length + 1}`,
    endpoint: '',
    api_key: '',
    model: '',
    max_tokens: 2048,
    temperature: 0.7
  };
  cfg.profiles.push(newProfile);
  cfg.activeProfile = cfg.profiles.length - 1;
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
  toast('已添加新 Profile');
};

window._apiConfig_removeProfile = function(idx) {
  const cfg = loadConfig();
  if (cfg.profiles.length <= 1) {
    toast('至少保留一个 Profile', 'ri-error-warning-line');
    return;
  }
  cfg.profiles.splice(idx, 1);
  if (cfg.activeProfile >= cfg.profiles.length) {
    cfg.activeProfile = cfg.profiles.length - 1;
  }
  saveConfig(cfg);
  renderApiConfig(document.getElementById('main'));
  toast('已删除 Profile');
};

window._apiConfig_save = function() {
  const cfg = loadConfig();
  saveFormToProfile(cfg);
  saveConfig(cfg);
  toast('配置已保存');
};

window._apiConfig_toggleKeyVisibility = function() {
  const input = document.getElementById('apiCfgKey');
  const icon = document.getElementById('apiCfgKeyIcon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ri-eye-off-line';
  } else {
    input.type = 'password';
    icon.className = 'ri-eye-line';
  }
};

window._apiConfig_loadPreset = function(preset) {
  const presets = {
    openai: {
      endpoint: 'https://api.openai.com',
      model: 'gpt-4o'
    },
    deepseek: {
      endpoint: 'https://api.deepseek.com',
      model: 'deepseek-chat'
    },
    qwen: {
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode',
      model: 'qwen-plus'
    }
  };
  const p = presets[preset];
  if (!p) return;
  const ep = document.getElementById('apiCfgEndpoint');
  const md = document.getElementById('apiCfgModel');
  if (ep) ep.value = p.endpoint;
  if (md) md.value = p.model;
  toast(`已加载 ${preset} 预设，请填写 API Key`);
};

window._apiConfig_test = async function() {
  const endpoint = document.getElementById('apiCfgEndpoint')?.value?.trim();
  const apiKey = document.getElementById('apiCfgKey')?.value?.trim();
  const model = document.getElementById('apiCfgModel')?.value?.trim();

  if (!endpoint || !apiKey || !model) {
    toast('请先填写 Endpoint、API Key 和模型名称', 'ri-error-warning-line');
    return;
  }

  const statusDot = document.getElementById('apiConfigStatus');
  const resultDiv = document.getElementById('apiTestResult');
  const contentDiv = document.getElementById('apiTestContent');

  statusDot.style.background = 'var(--am)';
  statusDot.title = '测试中...';
  resultDiv.style.display = 'block';
  contentDiv.textContent = '正在发送测试请求...';

  try {
    const startTime = Date.now();
    const resp = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        api_key: apiKey,
        model,
        messages: [{ role: 'user', content: 'Say "Hello from LLM Arena!" in one sentence.' }],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const data = await resp.json();

    if (data.error) {
      statusDot.style.background = 'var(--rd)';
      statusDot.title = '连接失败';
      contentDiv.innerHTML = `<span style="color:var(--rd);">❌ 连接失败 (${elapsed}s)</span>\n\n${esc(data.error)}`;
      return;
    }

    // 提取回复文本
    const reply = data.choices?.[0]?.message?.content || '(无内容)';
    statusDot.style.background = 'var(--gn)';
    statusDot.title = '连接成功';
    contentDiv.innerHTML = `<span style="color:var(--gn);">✅ 连接成功 (${elapsed}s)</span>\n\n模型: ${esc(model)}\n回复: ${esc(reply)}`;
  } catch (e) {
    statusDot.style.background = 'var(--rd)';
    statusDot.title = '请求异常';
    contentDiv.innerHTML = `<span style="color:var(--rd);">❌ 请求异常</span>\n\n${esc(e.message)}`;
  }
};

function saveFormToProfile(cfg) {
  if (cfg.profiles.length === 0) return;
  const idx = cfg.activeProfile || 0;
  const profile = cfg.profiles[idx];
  if (!profile) return;

  const name = document.getElementById('apiCfgName')?.value?.trim();
  const endpoint = document.getElementById('apiCfgEndpoint')?.value?.trim();
  const apiKey = document.getElementById('apiCfgKey')?.value?.trim();
  const model = document.getElementById('apiCfgModel')?.value?.trim();
  const maxTokens = parseInt(document.getElementById('apiCfgMaxTokens')?.value) || 2048;
  const temp = parseFloat(document.getElementById('apiCfgTemp')?.value) || 0.7;

  if (name) profile.name = name;
  if (endpoint) profile.endpoint = endpoint;
  if (apiKey) profile.api_key = apiKey;
  if (model) profile.model = model;
  profile.max_tokens = maxTokens;
  profile.temperature = temp;
}

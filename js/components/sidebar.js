/**
 * sidebar.js — 侧边栏组件
 * 包含 renderSidebar、toggleSidebar、closeSidebar
 */

import { DIMS, QS } from '../data/questions.js';
import { S } from '../state.js';
import { escHtml } from '../utils.js';

export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

export function renderSidebar() {
  document.getElementById('sidebar').innerHTML = `
    <div class="sb-section"><div class="sb-label">评估维度</div>
      ${DIMS.map(d => `<div class="sb-item ${S.dim === d.id ? 'active' : ''}" onclick="selectDim('${d.id}')"><i class="${d.icon}" style="color:${d.color}"></i><span>${d.name}</span><span class="badge">${QS.filter(q => q.dim === d.id).length}${d.autoScore ? ' ⚡' : ''}</span></div>`).join('')}
    </div>
    <div class="sb-section"><div class="sb-label">工具</div>
      <div class="sb-item ${S.view === 'entries' ? 'active' : ''}" onclick="showView('entries')"><i class="ri-list-check-3"></i> 待测列表 <span class="badge">${S.entries.filter(e => e.score === null || e.score === undefined).length}</span></div>
      <div class="sb-item ${S.view === 'compare' ? 'active' : ''}" onclick="showView('compare')"><i class="ri-bar-chart-grouped-line"></i> 模型对比</div>
      <div class="sb-item ${S.view === 'radar' ? 'active' : ''}" onclick="showView('radar')"><i class="ri-pie-chart-2-line"></i> 雷达图对比</div>
      <div class="sb-item ${S.view === 'prompt' ? 'active' : ''}" onclick="showView('prompt')"><i class="ri-file-text-line"></i> 评分Prompt</div>
      <div class="sb-item ${S.view === 'stats' ? 'active' : ''}" onclick="showView('stats')"><i class="ri-bar-chart-2-line"></i> 数据统计</div>
      <div class="sb-item ${S.view === 'api-config' ? 'active' : ''}" onclick="showView('api-config')"><i class="ri-settings-3-line"></i> API 配置</div>
    </div>
    <div style="padding:0 16px;margin-top:auto;"><div style="font-size:11px;color:var(--t4);line-height:1.6;"><i class="ri-lock-line"></i> 双盲模式<br>客观题⚡自动评分<br>主观题全屏盲测</div></div>
  `;
}

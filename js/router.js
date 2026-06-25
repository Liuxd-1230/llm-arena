/**
 * router.js — 视图路由分发
 * showView、selectDim、selectQ 负责状态切换，render() 分发到各视图渲染器
 */

import { QS } from './data/questions.js';
import { S } from './state.js';
import { renderSidebar, closeSidebar } from './components/sidebar.js';
import { renderWelcome } from './views/welcome.js';
import { renderDim, closeCollectPanel } from './views/dim.js';
import { renderEntries } from './views/entries.js';
import { renderCompare } from './views/compare.js';
import { renderRadar } from './views/radar.js';
import { renderPromptView } from './views/prompt.js';
import { renderStats } from './views/stats.js';
import { renderApiConfig } from './views/api-config.js';
import { animateCards, addPremiumEffects } from './utils.js';

export function showView(v) {
  S.view = v;
  S.dim = null;
  closeSidebar();
  renderSidebar();
  render();
}

export function selectDim(id) {
  S.dim = id;
  S.diff = 'all';
  S.q = null;
  S.view = 'dim';
  closeSidebar();
  renderSidebar();
  render();
}

export function selectQ(dim, diff, name) {
  // 保存当前表单状态（如果有的话）
  if (window._saveFormState) {
    window._saveFormState();
  }

  // 如果点击的是已选中的题目，则关闭收集面板
  if (S.q && S.q.dim === dim && S.q.diff === diff && S.q.name === name) {
    closeCollectPanel();
    return;
  }

  S.q = QS.find(q => q.dim === dim && q.diff === diff && q.name === name);
  S.submitMode = 'auto';
  render();
  setTimeout(() => {
    const p = document.getElementById('collectPanel');
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

export function render(el) {
  if (!el) el = document.getElementById('main');
  if (S.view === 'welcome') renderWelcome(el);
  else if (S.view === 'dim') renderDim(el);
  else if (S.view === 'entries') renderEntries(el);
  else if (S.view === 'compare') renderCompare(el);
  else if (S.view === 'radar') renderRadar(el);
  else if (S.view === 'prompt') renderPromptView(el);
  else if (S.view === 'stats') renderStats(el);
  else if (S.view === 'api-config') renderApiConfig(el);
  
  // Add premium animations and effects to rendered elements
  setTimeout(() => {
    animateCards();
    addPremiumEffects();
  }, 100);
}

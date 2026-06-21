/**
 * app.js — 应用入口
 * 导入所有模块，初始化应用，将需要的函数挂载到 window 供 inline onclick 使用
 */

// State (for inline onclick references like S.diff='all')
import { S } from './state.js';

// Router (showView, selectDim, selectQ, render)
import { showView, selectDim, selectQ, render } from './router.js';

// Sidebar
import { renderSidebar, toggleSidebar, closeSidebar } from './components/sidebar.js';

// Views
import { renderWelcome } from './views/welcome.js';
import { renderDim, setSubmitMode, addEntry, deleteEntry, toggleEntryDetail } from './views/dim.js';
import { renderCompare, getModelStats, resetModel } from './views/compare.js';
import { renderRadar, toggleRadarModel, radarShowAll, radarHideAll } from './views/radar.js';
import { renderEntries, toggleAnswer, openEntryPreview, closeEntryPreview } from './views/entries.js';
import { renderPromptView } from './views/prompt.js';

// Components
import { startBlind, showBlindItem, toggleCode, submitBlindScore, skipBlind, exitBlind } from './components/blind.js';
import { startThumbView, renderThumbGrid, exitThumbView, openPreview, calcPreviewTotal, togglePreviewCode, submitPreviewScore, previewPrev, previewNext, closePreview } from './components/thumb.js';
import { openImportModal, closeImportModal, setImportMode, doImportScore } from './components/import-modal.js';
import { toast } from './components/toast.js';

// Utils (clipboard, reveal modal, func check, export)
import {
  copyText, fallbackCopy, copyFullPrompt, copyForLLMJudge, copyForLLMJudgeNew,
  runFuncCheck, exportAll, closeFuncModal,
  showRevealModal, closeRevealModal, doReveal,
  escHtml, escSrcdoc, shuffle, getDim, getDiff, isAutoDim, hasAutoQ, getLongDocForQuestion,
  buildJudgePrompt,
  animateElements, animateCards, animateModal, addPremiumEffects
} from './utils.js';

// ============================================================
// Mount functions to window so inline onclick handlers work
// ============================================================
window.S = S;
window.showView = showView;
window.selectDim = selectDim;
window.selectQ = selectQ;
window.render = render;

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.renderSidebar = renderSidebar;

window.setSubmitMode = setSubmitMode;
window.addEntry = addEntry;
window.deleteEntry = deleteEntry;
window.toggleEntryDetail = toggleEntryDetail;

window.resetModel = resetModel;

// Entry view functions
window.toggleAnswer = toggleAnswer;
window.openEntryPreview = openEntryPreview;
window.closeEntryPreview = closeEntryPreview;

window.toggleRadarModel = toggleRadarModel;
window.radarShowAll = radarShowAll;
window.radarHideAll = radarHideAll;

window.startBlind = startBlind;
window.showBlindItem = showBlindItem;
window.toggleCode = toggleCode;
window.submitBlindScore = submitBlindScore;
window.skipBlind = skipBlind;
window.exitBlind = exitBlind;

window.startThumbView = startThumbView;
window.renderThumbGrid = renderThumbGrid;
window.exitThumbView = exitThumbView;
window.openPreview = openPreview;
window.calcPreviewTotal = calcPreviewTotal;
window.togglePreviewCode = togglePreviewCode;
window.submitPreviewScore = submitPreviewScore;
window.previewPrev = previewPrev;
window.previewNext = previewNext;
window.closePreview = closePreview;

window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.setImportMode = setImportMode;
window.doImportScore = doImportScore;

window.toast = toast;
window.copyText = copyText;
window.fallbackCopy = fallbackCopy;
window.copyFullPrompt = copyFullPrompt;
window.copyForLLMJudge = copyForLLMJudge;
window.copyForLLMJudgeNew = copyForLLMJudgeNew;
window.runFuncCheck = runFuncCheck;
window.exportAll = exportAll;
window.closeFuncModal = closeFuncModal;
window.showRevealModal = showRevealModal;
window.closeRevealModal = closeRevealModal;
window.doReveal = doReveal;
window.buildJudgePrompt = buildJudgePrompt;

// Animation functions
window.animateElements = animateElements;
window.animateCards = animateCards;
window.animateModal = animateModal;
window.addPremiumEffects = addPremiumEffects;

// ============================================================
// Initialize
// ============================================================

// Theme initialization
function initTheme() {
  const saved = localStorage.getItem('llm_arena_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('llm_arena_theme', next);
}

window.toggleTheme = toggleTheme;

// Initialize theme before rendering
initTheme();

// Initialize IndexedDB and load data
loadFromIndexedDB().then(() => {
  renderSidebar();
  render();
}).catch(e => {
  console.error('Failed to load from IndexedDB:', e);
  // Fallback to localStorage data
  renderSidebar();
  render();
});

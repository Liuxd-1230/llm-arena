/**
 * thumb.js — 缩略图盲测组件
 * 包含缩略图网格、全屏预览和浮动评分面板
 */

import { S, save } from '../state.js';
import { getDim, getDiff, shuffle } from '../utils.js';
import { toast } from './toast.js';
import { renderSidebar } from './sidebar.js';
import { render } from '../router.js';
import { startBlind } from './blind.js';

export let thumbQueue = [];
export let thumbIdx = 0;
export let previewCodeVisible = false;

export function startThumbView(dimFilter) {
  const queue = S.entries.filter(e => (e.score === null || e.score === undefined) && (!dimFilter || e.dimId === dimFilter));
  if (!queue.length) { toast('没有待测题目', 'ri-error-warning-line'); return; }
  thumbQueue = shuffle([...queue]);
  const dim = getDim(dimFilter || thumbQueue[0].dimId);
  document.getElementById('thumbTitle').innerHTML = `<i class="${dim.icon}" style="color:${dim.color}"></i> ${dim.name} - 缩略图盲测`;
  document.getElementById('thumbCount').textContent = `${thumbQueue.length}个待测`;
  renderThumbGrid();
  document.getElementById('thumbOverlay').classList.add('show');
}

export function renderThumbGrid() {
  const grid = document.getElementById('thumbGrid');
  grid.innerHTML = thumbQueue.map((item, idx) => {
    const dm = getDiff(item.qDiff);
    const scored = item.score !== null && item.score !== undefined;
    return `<div class="thumb-card ${scored ? 'thumb-card-scored' : ''}" ${scored ? `data-score="${item.score}分"` : ''} onclick="event.stopPropagation();openPreview(${idx})">
      <div class="thumb-frame-wrap"><iframe sandbox="" srcdoc="${escSrcdoc(item.answer)}" loading="lazy"></iframe></div>
      <div class="thumb-card-info">
        <span class="thumb-card-id">${item.blindId}</span>
        <span class="thumb-card-q">${item.qName}</span>
        <span class="thumb-card-dim">${dm.emoji} ${dm.name}</span>
      </div>
    </div>`;
  }).join('');
}

function escSrcdoc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function exitThumbView() {
  document.getElementById('thumbOverlay').classList.remove('show');
  renderSidebar();
  render();
}

export function switchToBlindFromThumb() {
  exitThumbView();
  const dimId = thumbQueue[0]?.dimId;
  if (dimId) startBlind(dimId);
}

export function openPreview(idx) {
  thumbIdx = idx;
  const item = thumbQueue[idx];
  if (!item) return;
  const dim = getDim(item.dimId);
  document.getElementById('previewTitle').innerHTML = `<i class="${dim.icon}" style="color:${dim.color}"></i> ${item.qName}`;
  document.getElementById('previewBlindId').textContent = item.blindId;
  document.getElementById('previewProgress').textContent = `${idx + 1} / ${thumbQueue.length}`;
  document.getElementById('previewFrame').srcdoc = item.answer;
  document.getElementById('previewCodePre').textContent = item.answer;
  document.getElementById('previewCodeArea').style.display = 'none';
  previewCodeVisible = false;
  
  // Generate rubric content dynamically
  const rubric = document.getElementById('previewRubric');
  rubric.innerHTML = `
    <h4><i class="ri-bar-chart-2-line"></i> 评分面板</h4>
    <div class="preview-rubric-item">
      <div class="preview-rubric-label">视觉设计</div>
      <div class="preview-rubric-desc">布局、配色、视觉层次</div>
      <div class="preview-score-row">
        <input type="number" class="preview-score-input" id="scoreVisual" min="0" max="25" placeholder="0">
        <span style="color:var(--t4);font-size:12px">/ 25</span>
      </div>
    </div>
    <div class="preview-rubric-item">
      <div class="preview-rubric-label">交互体验</div>
      <div class="preview-rubric-desc">可用性、响应性、动效</div>
      <div class="preview-score-row">
        <input type="number" class="preview-score-input" id="scoreInteract" min="0" max="25" placeholder="0">
        <span style="color:var(--t4);font-size:12px">/ 25</span>
      </div>
    </div>
    <div class="preview-rubric-item">
      <div class="preview-rubric-label">代码质量</div>
      <div class="preview-rubric-desc">结构、语义、可维护性</div>
      <div class="preview-score-row">
        <input type="number" class="preview-score-input" id="scoreCode" min="0" max="25" placeholder="0">
        <span style="color:var(--t4);font-size:12px">/ 25</span>
      </div>
    </div>
    <div class="preview-rubric-item">
      <div class="preview-rubric-label">创意完成度</div>
      <div class="preview-rubric-desc">创意性、完整性、独特性</div>
      <div class="preview-score-row">
        <input type="number" class="preview-score-input" id="scoreCreative" min="0" max="25" placeholder="0">
        <span style="color:var(--t4);font-size:12px">/ 25</span>
      </div>
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:600;">总分</span>
        <span class="preview-total" id="previewTotal">0</span>
      </div>
      <input type="text" class="preview-note" id="previewNote" placeholder="评分备注（可选）">
      <div class="preview-actions">
        <button class="btn btn-primary" onclick="submitPreviewScore()"><i class="ri-check-line"></i> 提交</button>
        <button class="btn btn-outline" onclick="previewNext()"><i class="ri-skip-forward-line"></i> 跳过</button>
      </div>
    </div>
  `;
  
  // Set initial values
  document.getElementById('scoreVisual').value = '';
  document.getElementById('scoreInteract').value = '';
  document.getElementById('scoreCode').value = '';
  document.getElementById('scoreCreative').value = '';
  document.getElementById('previewTotal').textContent = '0';
  document.getElementById('previewNote').value = '';
  if (item.score !== null && item.score !== undefined) {
    document.getElementById('previewTotal').textContent = item.score;
  }
  document.getElementById('previewOverlay').classList.add('show');
  ['scoreVisual', 'scoreInteract', 'scoreCode', 'scoreCreative'].forEach(id => {
    document.getElementById(id).oninput = calcPreviewTotal;
  });
}

export function calcPreviewTotal() {
  const v = parseInt(document.getElementById('scoreVisual').value) || 0;
  const i = parseInt(document.getElementById('scoreInteract').value) || 0;
  const c = parseInt(document.getElementById('scoreCode').value) || 0;
  const cr = parseInt(document.getElementById('scoreCreative').value) || 0;
  document.getElementById('previewTotal').textContent = Math.min(v + i + c + cr, 100);
}

export function togglePreviewCode() {
  const area = document.getElementById('previewCodeArea');
  previewCodeVisible = !previewCodeVisible;
  area.style.display = previewCodeVisible ? 'block' : 'none';
}

export function submitPreviewScore() {
  const total = parseInt(document.getElementById('previewTotal').textContent) || 0;
  if (total === 0) { toast('请先评分', 'ri-error-warning-line'); return; }
  const note = document.getElementById('previewNote').value.trim();
  const item = thumbQueue[thumbIdx];
  const entry = S.entries.find(e => e.id === item.id);
  if (entry) {
    entry.score = total;
    entry.note = note || `视觉${document.getElementById('scoreVisual').value || 0} 交互${document.getElementById('scoreInteract').value || 0} 代码${document.getElementById('scoreCode').value || 0} 创意${document.getElementById('scoreCreative').value || 0}`;
    entry.autoDetail = {
      breakdown: {
        visual: parseInt(document.getElementById('scoreVisual').value) || 0,
        interaction: parseInt(document.getElementById('scoreInteract').value) || 0,
        code_quality: parseInt(document.getElementById('scoreCode').value) || 0,
        creative: parseInt(document.getElementById('scoreCreative').value) || 0
      }
    };
    save();
  }
  item.score = total;
  renderThumbGrid();
  toast(`已评分 ${item.blindId}: ${total}分`);
  previewNext();
}

export function previewNext() {
  if (thumbIdx < thumbQueue.length - 1) {
    openPreview(thumbIdx + 1);
  } else {
    closePreview();
    toast('所有题目已评分！');
  }
}

export function closePreview() {
  document.getElementById('previewOverlay').classList.remove('show');
  renderThumbGrid();
}

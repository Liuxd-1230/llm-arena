/**
 * radar.js — 雷达图对比视图
 * 渲染10维雷达图和模型可见性控制
 */

import { DIMS } from '../data/questions.js';
import { getDiff } from '../utils.js';
import { getModelStats } from './compare.js';

export let radarVisible = {};

export function renderRadar(el) {
  const models = getModelStats();
  const sorted = Object.values(models).sort((a, b) => b.avgScore - a.avgScore);
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#6366f1'];
  sorted.forEach(m => { if (radarVisible[m.name] === undefined) radarVisible[m.name] = true; });
  el.innerHTML = `<div class="sec-head"><div class="sec-title"><i class="ri-pie-chart-2-line" style="margin-right:8px;"></i>10维雷达图对比</div></div>
    ${sorted.length < 1 ? '<div style="text-align:center;padding:60px 0;color:var(--t4);">至少需要1个已评分的模型</div>' : `
    <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
      <div style="flex:1;min-width:400px;display:flex;justify-content:center;"><svg id="radarSvg" viewBox="0 0 500 480" style="max-width:500px;"></svg></div>
      <div style="min-width:200px;">
        <div class="label" style="margin-bottom:8px;">模型选择</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${sorted.map((m, i) => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 10px;border-radius:var(--r6);background:${radarVisible[m.name] ? colors[i % colors.length] + '15' : 'transparent'};border:1px solid ${radarVisible[m.name] ? colors[i % colors.length] + '40' : 'var(--bdr)'};">
            <input type="checkbox" ${radarVisible[m.name] ? 'checked' : ''} onchange="toggleRadarModel('${m.name.replace(/'/g, "\\'")}',this.checked)" style="accent-color:${colors[i % colors.length]};">
            <span style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;"></span>
            <span style="flex:1;font-weight:${radarVisible[m.name] ? '600' : '400'};color:${radarVisible[m.name] ? 'var(--t1)' : 'var(--t4)'};">${m.name}</span>
            <span style="font-family:var(--mono);font-size:12px;color:var(--t3);">${m.avgScore}</span>
          </label>`).join('')}
        </div>
        <div style="margin-top:12px;display:flex;gap:6px;">
          <button class="btn btn-ghost btn-xs" onclick="radarShowAll()">全选</button>
          <button class="btn btn-ghost btn-xs" onclick="radarHideAll()">全不选</button>
        </div>
      </div>
    </div>`}`;
  drawRadar(sorted.filter(m => radarVisible[m.name]), colors);
}

export function toggleRadarModel(name, visible) {
  radarVisible[name] = visible;
  _redrawSvg();
  _updateLegend();
}

export function radarShowAll() {
  Object.keys(radarVisible).forEach(k => radarVisible[k] = true);
  _redrawSvg();
  _updateLegend();
}

export function radarHideAll() {
  Object.keys(radarVisible).forEach(k => radarVisible[k] = false);
  _redrawSvg();
  _updateLegend();
}

function _getRadarData() {
  const models = getModelStats();
  const sorted = Object.values(models).sort((a, b) => b.avgScore - a.avgScore);
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#6366f1'];
  return { sorted, colors };
}

function _redrawSvg() {
  const { sorted, colors } = _getRadarData();
  drawRadar(sorted.filter(m => radarVisible[m.name]), colors);
}

function _updateLegend() {
  const { sorted, colors } = _getRadarData();
  const container = document.querySelector('#main label');
  if (!container) return;
  // Update all legend labels' checked state and styling
  sorted.forEach((m, i) => {
    const checkbox = document.querySelector(`input[onchange*="${m.name}"]`);
    if (checkbox) {
      checkbox.checked = radarVisible[m.name];
      const label = checkbox.closest('label');
      if (label) {
        label.style.background = radarVisible[m.name] ? colors[i % colors.length] + '15' : 'transparent';
        label.style.borderColor = radarVisible[m.name] ? colors[i % colors.length] + '40' : 'var(--bdr)';
        const nameSpan = label.querySelector('span:nth-child(3)');
        if (nameSpan) {
          nameSpan.style.fontWeight = radarVisible[m.name] ? '600' : '400';
          nameSpan.style.color = radarVisible[m.name] ? 'var(--t1)' : 'var(--t4)';
        }
      }
    }
  });
}

export function drawRadar(models, colors) {
  const svg = document.getElementById('radarSvg');
  if (!svg) return;
  const cx = 250, cy = 230, r = 180, n = DIMS.length;
  const angles = DIMS.map((_, i) => (Math.PI * 2 * i / n) - Math.PI / 2);
  let html = '';
  // Grid
  for (let i = 1; i <= 5; i++) {
    const rr = r * i / 5;
    const pts = angles.map(a => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`).join(' ');
    html += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  }
  // Axes + labels
  angles.forEach((a, i) => {
    html += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    const lx = cx + (r + 28) * Math.cos(a), ly = cy + (r + 28) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    html += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" fill="${DIMS[i].color}" font-size="11" font-weight="600" font-family="var(--sans)">${DIMS[i].name}</text>`;
  });
  // Model polygons
  models.forEach((m, mi) => {
    const pts = DIMS.map((d, i) => {
      const max = getDiff('diamond').max;
      const val = (m.dimAvg[d.id] || 0) / max;
      return `${cx + r * Math.min(val, 1) * Math.cos(angles[i])},${cy + r * Math.min(val, 1) * Math.sin(angles[i])}`;
    }).join(' ');
    const scoredDims = Object.keys(m.dimAvg).length;
    const fillColor = scoredDims >= 2 ? `${colors[mi % colors.length]}30` : 'none';
    html += `<polygon points="${pts}" fill="${fillColor}" stroke="${colors[mi % colors.length]}" stroke-width="2" opacity="0.9"/>`;
    DIMS.forEach((d, i) => {
      const max = getDiff('diamond').max;
      const val = (m.dimAvg[d.id] || 0) / max;
      const px = cx + r * Math.min(val, 1) * Math.cos(angles[i]);
      const py = cy + r * Math.min(val, 1) * Math.sin(angles[i]);
      html += `<circle cx="${px}" cy="${py}" r="3" fill="${colors[mi % colors.length]}" stroke="#09090b" stroke-width="1.5"/>`;
    });
  });
  svg.innerHTML = html;
}

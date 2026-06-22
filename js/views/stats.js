/**
 * stats.js — 数据统计仪表板
 * 提供全面的数据概览、模型排行、维度分析、分数分布、难度表现和最近活动
 * 所有图表使用纯 SVG 绘制，无外部依赖
 */

import { DIMS, DIFFS } from '../data/questions.js';
import { S } from '../state.js';

// ==================== Helper Functions ====================

function calcModelAvg() {
  const models = {};
  S.entries.forEach(e => {
    if (e.score === null || e.score === undefined) return;
    if (!models[e.model]) models[e.model] = { name: e.model, total: 0, count: 0 };
    models[e.model].total += e.score;
    models[e.model].count++;
  });
  Object.values(models).forEach(m => {
    m.avg = m.count ? m.total / m.count : 0;
  });
  return Object.values(models).sort((a, b) => b.avg - a.avg);
}

function calcDimAvg() {
  const dims = {};
  DIMS.forEach(d => { dims[d.id] = { id: d.id, name: d.name, icon: d.icon, color: d.color, total: 0, count: 0 }; });
  S.entries.forEach(e => {
    if (e.score === null || e.score === undefined) return;
    if (!dims[e.dimId]) return;
    dims[e.dimId].total += e.score;
    dims[e.dimId].count++;
  });
  return DIMS.map(d => {
    const info = dims[d.id];
    return { ...info, avg: info.count ? Math.round(info.total / info.count * 10) / 10 : 0, count: info.count };
  });
}

function scoreToColor(score) {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#3b82f6';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function scoreToBgColor(score) {
  if (score >= 90) return 'rgba(34,197,94,0.15)';
  if (score >= 75) return 'rgba(59,130,246,0.15)';
  if (score >= 60) return 'rgba(245,158,11,0.15)';
  if (score >= 40) return 'rgba(249,115,22,0.15)';
  return 'rgba(239,68,68,0.15)';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ==================== Main Render ====================

export function renderStats(el) {
  const entries = S.entries;
  const scored = entries.filter(e => e.score !== null && e.score !== undefined);
  const models = calcModelAvg();
  const dimAvg = calcDimAvg();
  const totalEntries = entries.length;
  const modelCount = new Set(entries.map(e => e.model)).size;
  const avgScore = scored.length ? Math.round(scored.reduce((s, e) => s + e.score, 0) / scored.length * 10) / 10 : 0;
  const scoredPct = totalEntries ? Math.round(scored.length / totalEntries * 100) : 0;

  el.innerHTML = `
    <div class="sec-head">
      <div class="sec-title"><i class="ri-bar-chart-2-line" style="margin-right:8px;"></i>数据统计</div>
      <div class="sec-desc">全面的数据概览与分析</div>
    </div>

    <!-- A) Overview Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
      ${statCard('ri-database-2-line', '总记录数', totalEntries, '#6366f1')}
      ${statCard('ri-robot-2-line', '测试模型数', modelCount, '#3b82f6')}
      ${statCard('ri-percent-line', '平均分', avgScore, '#22c55e')}
      ${statCard('ri-file-check-line', '评分完成率', scoredPct + '%', '#f59e0b')}
    </div>

    <!-- B) Model Ranking Bar Chart -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-weight:600;margin-bottom:16px;font-size:15px;">
        <i class="ri-ranking-line" style="margin-right:6px;"></i>模型排行榜
      </div>
      ${models.length === 0 ? emptyState('ri-robot-2-line', '暂无评分数据') : renderModelBarChart(models)}
    </div>

    <!-- C) Dimension Summary -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-weight:600;margin-bottom:16px;font-size:15px;">
        <i class="ri-pie-chart-line" style="margin-right:6px;"></i>维度分析
      </div>
      ${renderDimChart(dimAvg)}
    </div>

    <!-- D) Score Distribution -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-weight:600;margin-bottom:16px;font-size:15px;">
        <i class="ri-bar-chart-line" style="margin-right:6px;"></i>分数分布
      </div>
      ${scored.length === 0 ? emptyState('ri-bar-chart-line', '暂无评分数据') : renderHistogram(scored)}
    </div>

    <!-- E) Difficulty Performance -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-weight:600;margin-bottom:16px;font-size:15px;">
        <i class="ri-vip-crown-line" style="margin-right:6px;"></i>难度表现
      </div>
      ${renderDiffTable(scored)}
    </div>

    <!-- F) Recent Activity -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-weight:600;margin-bottom:16px;font-size:15px;">
        <i class="ri-time-line" style="margin-right:6px;"></i>最近活动
      </div>
      ${renderRecent(entries)}
    </div>
  `;
}

// ==================== Component Renderers ====================

function statCard(icon, label, value, color) {
  return `<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--r8);padding:20px 16px;text-align:center;">
    <i class="${icon}" style="font-size:22px;color:${color};display:block;margin-bottom:8px;"></i>
    <div style="font-size:26px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${value}</div>
    <div style="font-size:12px;color:var(--text-tertiary);">${label}</div>
  </div>`;
}

function emptyState(icon, text) {
  return `<div style="text-align:center;padding:40px 0;color:var(--text-muted);">
    <i class="${icon}" style="font-size:32px;display:block;margin-bottom:12px;"></i>
    ${text}
  </div>`;
}

function renderModelBarChart(models) {
  const maxScore = 100;
  const barH = 28;
  const gap = 10;
  const labelW = 120;
  const barArea = 400;
  const totalW = labelW + barArea + 60;
  const totalH = models.length * (barH + gap) + 10;

  const bars = models.map((m, i) => {
    const y = i * (barH + gap) + 5;
    const w = (m.avg / maxScore) * barArea;
    const isTop3 = i < 3;
    const color = isTop3 ? ['#6366f1', '#3b82f6', '#22c55e'][i] : '#6b7280';
    return `
      <text x="${labelW - 8}" y="${y + barH / 2 + 5}" text-anchor="end"
        style="font-size:12px;fill:var(--text-primary);font-weight:${isTop3 ? '600' : '400'};">${escapeHtml(m.name)}</text>
      <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="6" ry="6"
        fill="${color}" opacity="0.85">
        <animate attributeName="width" from="0" to="${w}" dur="0.6s" fill="freeze" begin="0.${i}s" />
      </rect>
      <text x="${labelW + w + 8}" y="${y + barH / 2 + 5}"
        style="font-size:12px;fill:${color};font-weight:600;">${m.avg}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${totalW} ${totalH}" style="width:100%;max-width:700px;display:block;">${bars}</svg>`;
}

function renderDimChart(dimAvg) {
  const barH = 24;
  const gap = 10;
  const labelW = 110;
  const barArea = 320;
  const totalW = labelW + barArea + 60;
  const totalH = dimAvg.length * (barH + gap) + 10;

  const bars = dimAvg.map((d, i) => {
    const y = i * (barH + gap) + 5;
    const w = (d.avg / 100) * barArea;
    return `
      <text x="${labelW - 8}" y="${y + barH / 2 + 4}" text-anchor="end"
        style="font-size:12px;fill:var(--text-secondary);">${d.name}</text>
      <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="5" ry="5"
        fill="${d.color}" opacity="0.8">
        <animate attributeName="width" from="0" to="${w}" dur="0.5s" fill="freeze" begin="0.${i}s" />
      </rect>
      <text x="${labelW + w + 8}" y="${y + barH / 2 + 4}"
        style="font-size:12px;fill:${d.color};font-weight:600;">${d.avg}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${totalW} ${totalH}" style="width:100%;max-width:600px;display:block;">${bars}</svg>`;
}

function renderHistogram(scored) {
  const buckets = [
    { label: '0-20', min: 0, max: 20, count: 0 },
    { label: '21-40', min: 21, max: 40, count: 0 },
    { label: '41-60', min: 41, max: 60, count: 0 },
    { label: '61-80', min: 61, max: 80, count: 0 },
    { label: '81-100', min: 81, max: 100, count: 0 },
  ];
  scored.forEach(e => {
    const s = e.score;
    if (s <= 20) buckets[0].count++;
    else if (s <= 40) buckets[1].count++;
    else if (s <= 60) buckets[2].count++;
    else if (s <= 80) buckets[3].count++;
    else buckets[4].count++;
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const barW = 60;
  const gap = 20;
  const chartH = 200;
  const totalW = buckets.length * (barW + gap) + gap;
  const totalH = chartH + 40;

  const colors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'];

  const bars = buckets.map((b, i) => {
    const x = gap + i * (barW + gap);
    const h = maxCount ? (b.count / maxCount) * chartH : 0;
    const y = chartH - h;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" ry="6"
        fill="${colors[i]}" opacity="0.85">
        <animate attributeName="height" from="0" to="${h}" dur="0.5s" fill="freeze" begin="0.${i}s" />
        <animate attributeName="y" from="${chartH}" to="${y}" dur="0.5s" fill="freeze" begin="0.${i}s" />
      </rect>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle"
        style="font-size:12px;fill:var(--text-primary);font-weight:600;">${b.count}</text>
      <text x="${x + barW / 2}" y="${chartH + 18}" text-anchor="middle"
        style="font-size:11px;fill:var(--text-tertiary);">${b.label}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${totalW} ${totalH}" style="width:100%;max-width:500px;display:block;">${bars}</svg>`;
}

function renderDiffTable(scored) {
  if (scored.length === 0) return emptyState('ri-vip-crown-line', '暂无评分数据');

  const models = [...new Set(scored.map(e => e.model))];
  const cells = {};
  DIFFS.forEach(diff => {
    cells[diff.id] = {};
    models.forEach(m => {
      const entries = scored.filter(e => e.diffId === diff.id && e.model === m);
      cells[diff.id][m] = entries.length ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : null;
    });
  });

  return `<div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:600;">难度</th>
          ${models.map(m => `<th style="text-align:center;padding:8px 12px;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:600;white-space:nowrap;">${escapeHtml(m)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${DIFFS.map(diff => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid var(--border);font-weight:500;">${diff.emoji} ${diff.name}</td>
            ${models.map(m => {
              const s = cells[diff.id][m];
              if (s === null) return `<td style="text-align:center;padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text-muted);">-</td>`;
              return `<td style="text-align:center;padding:8px 12px;border-bottom:1px solid var(--border);">
                <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-weight:600;font-size:13px;color:${scoreToColor(s)};background:${scoreToBgColor(s)};">${s}</span>
              </td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderRecent(entries) {
  const recent = entries.slice(-10).reverse();
  if (recent.length === 0) return emptyState('ri-time-line', '暂无活动记录');

  return `<div style="display:flex;flex-direction:column;gap:0;">
    ${recent.map((e, i) => {
      const dimInfo = DIMS.find(d => d.id === e.dimId);
      const diffInfo = DIFFS.find(d => d.id === e.diffId);
      const hasScore = e.score !== null && e.score !== undefined;
      const color = hasScore ? scoreToColor(e.score) : 'var(--text-muted)';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < recent.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
        <div style="min-width:4px;height:4px;width:4px;border-radius:50%;background:${color};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-weight:500;font-size:13px;">${escapeHtml(e.model)}</span>
            <span style="font-size:11px;color:var(--text-tertiary);">${dimInfo ? dimInfo.name : e.dimId}</span>
            ${diffInfo ? `<span style="font-size:11px;">${diffInfo.emoji}</span>` : ''}
          </div>
          <div style="font-size:12px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escapeHtml(e.qName || '')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${hasScore ? `<span style="font-weight:600;font-size:14px;color:${color};">${e.score}</span>` : `<span style="font-size:12px;color:var(--text-muted);">未评分</span>`}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

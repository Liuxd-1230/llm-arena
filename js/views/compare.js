/**
 * compare.js — 模型对比视图
 * 渲染排行榜和模型统计数据
 */

import { DIMS } from '../data/questions.js';
import { S, save } from '../state.js';
import { renderSidebar } from '../components/sidebar.js';
import { render } from '../router.js';
import { escapeAttr } from '../utils.js';
import { toast } from '../components/toast.js';

/**
 * 标准化模型名称：统一大小写、去除多余空格
 */
function normalizeModelName(name) {
  if (!name) return '';
  return name.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9一-龥\s\-_.]/g, '')  // 保留字母数字中文和基本符号
    .trim();
}

export function getModelStats() {
  const models = {};
  S.entries.forEach(e => {
    if (e.score === null || e.score === undefined) return;
    const normalizedName = normalizeModelName(e.model);
    if (!normalizedName) return;

    // 使用标准化名称作为 key，但保留原始名称用于显示
    if (!models[normalizedName]) models[normalizedName] = {
      name: e.model,  // 保留第一个遇到的原始名称
      scores: {}, dimScores: {}, count: 0, totalScore: 0
    };
    const m = models[normalizedName];
    m.count++;
    m.totalScore += e.score;
    if (!m.dimScores[e.dimId]) m.dimScores[e.dimId] = [];
    m.dimScores[e.dimId].push(e.score);
    const key = e.qName;
    if (!m.scores[key]) m.scores[key] = [];
    m.scores[key].push(e.score);
  });
  Object.values(models).forEach(m => {
    m.avgScore = m.count ? Math.round(m.totalScore / m.count) : 0;
    m.dimAvg = {};
    Object.entries(m.dimScores).forEach(([dim, scs]) => {
      m.dimAvg[dim] = Math.round(scs.reduce((a, b) => a + b, 0) / scs.length);
    });
  });
  return models;
}

export function renderCompare(el) {
  const models = getModelStats();
  const sorted = Object.values(models).sort((a, b) => b.avgScore - a.avgScore);
  el.innerHTML = `<div class="sec-head"><div class="sec-title"><i class="ri-bar-chart-grouped-line" style="margin-right:8px;"></i>模型对比排行榜</div><div class="sec-desc">${S.revealed ? '已揭盲' : '同名模型自动合并，多次测量取平均'}</div></div>
    ${sorted.length === 0 ? '<div style="text-align:center;padding:60px 0;color:var(--t4);"><i class="ri-bar-chart-grouped-line" style="font-size:32px;display:block;margin-bottom:12px;"></i>暂无数据</div>' : `
    <div class="card"><table class="cmp-table"><thead><tr><th>排名</th><th>模型</th><th>平均分</th><th>测试数</th><th>各维度</th><th>操作</th></tr></thead><tbody>
      ${sorted.map((m, i) => {
        const rc = i < 3 ? `cmp-r${i + 1}` : '';
        return `<tr>
        <td><span class="cmp-rank ${rc}">${i + 1}</span></td>
        <td><strong>${m.name}</strong></td>
        <td><strong>${m.avgScore}</strong></td>
        <td style="color:var(--t3);">${m.count}题</td>
        <td>${DIMS.map(d => {
          const s = m.dimAvg[d.id];
          return s !== undefined ? `<span style="font-size:11px;color:${d.color};margin-right:6px;" title="${d.name}">${s}</span>` : '';
        }).join('')}</td>
        <td><button class="btn btn-ghost btn-xs" onclick="resetModel('${escapeAttr(m.name)}')" title="清除该模型所有评分"><i class="ri-delete-bin-line"></i></button></td>
      </tr>`;
      }).join('')}
    </tbody></table></div>`}`;
}

export function resetModel(name) {
  if (!confirm(`确认清除 "${name}" 的所有评分数据？`)) return;
  S.entries = S.entries.filter(e => e.model !== name);
  save();
  renderSidebar();
  render();
  toast(`已清除 ${name}`);
}

/**
 * welcome.js — 欢迎页视图
 * 渲染欢迎页面，显示模型和记录统计
 */

import { S } from '../state.js';

export function renderWelcome(el) {
  const total = S.entries.length;
  const scored = S.entries.filter(e => e.score !== null && e.score !== undefined).length;
  const models = new Set(S.entries.map(e => e.model)).size;
  el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;text-align:center;padding:24px 0;">
    <div style="font-size:48px;margin-bottom:16px;opacity:0.3;"><i class="ri-flask-line"></i></div>
    <div style="font-size:20px;font-weight:700;margin-bottom:8px;">选择一个评估维度</div>
    <div style="font-size:14px;color:var(--t3);max-width:440px;margin-bottom:24px;">从左侧选择维度开始。<br>⚡维度=客观题自动评分 | 其他=主观题盲测</div>
    ${total > 0 ? `<div style="display:flex;gap:16px;font-size:13px;color:var(--t2);">
      <span><strong>${models}</strong> 个模型</span><span><strong>${total}</strong> 条记录</span><span><strong>${scored}</strong> 已评分</span>
    </div>` : ''}
  </div>`;
}

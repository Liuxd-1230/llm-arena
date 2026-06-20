/**
 * prompt.js — 评分Prompt视图
 * 展示LLM裁判评分Prompt模板
 */

import { copyText } from '../utils.js';

export function renderPromptView(el) {
  const p = `你是一位顶级的AI能力评审专家。请对以下LLM回答评分。

## 评分维度 (总分100)
准确性 (30): 事实正确性 + 逻辑严密性
完整性 (25): 覆盖度 + 深度
表达质量 (25): 清晰度 + 结构性 + 语言质量
创意与洞察 (20): 原创性 + 实用性

## 输出格式 (严格JSON)
{"total_score":85,"accuracy":{"score":25,"max":30,"comment":"..."},"completeness":{"score":20,"max":25,"comment":"..."},"expression":{"score":22,"max":25,"comment":"..."},"insight":{"score":18,"max":20,"comment":"..."},"highlights":["亮点"],"improvements":["改进"],"overall_comment":"总评"}`;
  el.innerHTML = `<div class="sec-head"><div class="sec-title"><i class="ri-file-text-line" style="margin-right:8px;"></i>评分员Prompt</div><button class="btn btn-outline btn-sm" onclick="copyText(\`${p.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)"><i class="ri-file-copy-line"></i> 复制</button></div><div class="prompt-box">${p}</div>`;
}

/**
 * state.js — 全局状态管理
 * 包含共享状态对象 S 和 localStorage 持久化
 */

export let S = {
  view: 'welcome',
  dim: null,
  diff: 'all',
  q: null,
  entries: [],
  blindQueue: [],
  blindIdx: 0,
  revealed: false,
  nextId: 1,
  submitMode: 'auto'
};

// 从 localStorage 恢复状态
try {
  const s = localStorage.getItem('llm_arena');
  if (s) {
    const d = JSON.parse(s);
    S.entries = d.entries || [];
    S.nextId = d.nextId || 1;
    S.revealed = d.revealed || false;
  }
} catch (e) {}

export function save() {
  localStorage.setItem('llm_arena', JSON.stringify({
    entries: S.entries,
    nextId: S.nextId,
    revealed: S.revealed
  }));
}

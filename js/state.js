/**
 * state.js — 全局状态管理
 * 使用 IndexedDB (Dexie.js) 持久化，localStorage 作为同步备份
 */

import { initDB, saveState, loadState } from './db.js';

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

// 从 localStorage 恢复状态（同步备份）
try {
  const s = localStorage.getItem('llm_arena');
  if (s) {
    const d = JSON.parse(s);
    S.entries = d.entries || [];
    S.nextId = d.nextId || 1;
    S.revealed = d.revealed || false;
  }
} catch (e) {}

// 保存到 localStorage（同步备份）
export function save() {
  localStorage.setItem('llm_arena', JSON.stringify({
    entries: S.entries,
    nextId: S.nextId,
    revealed: S.revealed
  }));
  
  // 异步保存到 IndexedDB
  saveToIndexedDB().catch(e => console.error('IndexedDB save failed:', e));
}

// 异步保存到 IndexedDB
async function saveToIndexedDB() {
  try {
    await saveState({
      entries: S.entries,
      nextId: S.nextId,
      revealed: S.revealed,
      view: S.view,
      dim: S.dim,
      diff: S.diff,
      q: S.q,
      submitMode: S.submitMode
    });
  } catch (e) {
    console.error('IndexedDB save failed:', e);
  }
}

// 从 IndexedDB 加载状态（异步）
export async function loadFromIndexedDB() {
  try {
    await initDB();
    const state = await loadState();
    
    // Merge with current state (prefer IndexedDB data if it exists)
    if (state.entries && state.entries.length > 0) {
      S.entries = state.entries;
      S.nextId = state.nextId || 1;
      S.revealed = state.revealed || false;
      
      // Also update localStorage
      save();
      
      return true;
    }
    return false;
  } catch (e) {
    console.error('IndexedDB load failed:', e);
    return false;
  }
}

// Clear all data
export async function clearAllData() {
  S.entries = [];
  S.nextId = 1;
  S.revealed = false;
  save();
  
  // Also clear IndexedDB
  try {
    const { clearAllData: clearDB } = await import('./db.js');
    await clearDB();
  } catch (e) {
    console.error('IndexedDB clear failed:', e);
  }
}

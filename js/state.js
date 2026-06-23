/**
 * state.js — 全局状态管理
 * 双层存储：本地服务器 (data_storage/state.json) + localStorage 缓存
 * 服务器是主存储，清浏览器缓存不丢数据
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

// 是否有本地服务器（同源的 server.py）
const HAS_SERVER = location.protocol === 'http:' || location.protocol === 'https:';

// API Token（从服务器加载）
let _apiToken = null;

async function _getAuthHeaders() {
  if (!_apiToken && HAS_SERVER) {
    try {
      const resp = await fetch('/api/token', { signal: AbortSignal.timeout(1000) });
      if (resp.ok) {
        const data = await resp.json();
        _apiToken = data.token;
      }
    } catch {}
  }
  const headers = { 'Content-Type': 'application/json' };
  if (_apiToken) headers['Authorization'] = `Bearer ${_apiToken}`;
  return headers;
}

// ==================== localStorage 缓存 ====================
function loadFromCache() {
  try {
    const s = localStorage.getItem('llm_arena');
    if (s) {
      const d = JSON.parse(s);
      S.entries = d.entries || [];
      S.nextId = d.nextId || 1;
      S.revealed = d.revealed || false;
      return true;
    }
  } catch (e) {}
  return false;
}

function saveToCache() {
  try {
    localStorage.setItem('llm_arena', JSON.stringify({
      entries: S.entries,
      nextId: S.nextId,
      revealed: S.revealed
    }));
  } catch (e) {}
}

// ==================== 本地服务器 API ====================
async function loadFromServer() {
  if (!HAS_SERVER) return false;
  try {
    const headers = await _getAuthHeaders();
    const resp = await fetch('/api/state', { headers, signal: AbortSignal.timeout(2000) });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data && data.entries) {
      S.entries = data.entries || [];
      S.nextId = data.nextId || 1;
      S.revealed = data.revealed || false;
      // 同步到缓存
      saveToCache();
      console.log(`[server] 加载了 ${S.entries.length} 条记录`);
      return true;
    }
  } catch (e) {
    // 服务器不可用，静默降级到 localStorage
    console.log('[server] 不可用，使用 localStorage');
  }
  return false;
}

async function saveToServer() {
  if (!HAS_SERVER) return;
  try {
    const headers = await _getAuthHeaders();
    await fetch('/api/state', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        entries: S.entries,
        nextId: S.nextId,
        revealed: S.revealed
      })
    });
  } catch (e) {
    // 静默失败，数据已在 localStorage
  }
}

// ==================== 公开 API ====================

/**
 * 获取包含认证头的 headers 对象
 */
export { _getAuthHeaders as getAuthHeaders };

/**
 * 保存状态（同时写服务器 + localStorage）
 */
export function save() {
  saveToCache();
  saveToServer(); // 异步，不阻塞
}

/**
 * 加载状态（优先服务器，降级 localStorage）
 * 返回 Promise，调用方可以 await 后再 render
 */
export async function loadState() {
  // 先用 localStorage 快速渲染
  loadFromCache();
  // 再尝试从服务器获取最新数据
  const serverLoaded = await loadFromServer();
  return serverLoaded;
}

/**
 * 手动导出数据为 JSON 文件下载
 */
export function exportToFile() {
  const data = JSON.stringify({ entries: S.entries, nextId: S.nextId, revealed: S.revealed }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `llm-arena-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入数据
 */
export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') {
          reject(new Error('无效的备份文件：不是 JSON 对象'));
          return;
        }
        if (!Array.isArray(data.entries)) {
          reject(new Error('无效的备份文件：entries 不是数组'));
          return;
        }
        S.entries = data.entries;
        S.nextId = data.nextId || S.entries.length + 1;
        S.revealed = data.revealed || false;
        save();
        resolve(S.entries.length);
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}

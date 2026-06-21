/**
 * db.js — 数据持久化层
 * 使用 Dexie.js (IndexedDB) 存储评测数据
 */

// Import Dexie from CDN
const DB_NAME = 'llm_arena_db';
const DB_VERSION = 1;

let db = null;

// Initialize database
export async function initDB() {
  // Load Dexie from CDN if not already loaded
  if (typeof Dexie === 'undefined') {
    await loadScript('https://unpkg.com/dexie@3.2.4/dist/dexie.js');
  }
  
  db = new Dexie(DB_NAME);
  
  // Define schema
  db.version(DB_VERSION).stores({
    entries: '++id, blindId, model, dimId, qName, qDiff, score, autoScore',
    settings: 'key, value'
  });
  
  // Migrate from localStorage if needed
  await migrateFromLocalStorage();
  
  return db;
}

// Load script dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Migrate data from localStorage to IndexedDB
async function migrateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('llm_arena');
    if (saved) {
      const data = JSON.parse(saved);
      
      // Check if we already have data in IndexedDB
      const count = await db.entries.count();
      if (count === 0 && data.entries && data.entries.length > 0) {
        // Migrate entries
        await db.entries.bulkAdd(data.entries);
        console.log(`Migrated ${data.entries.length} entries from localStorage`);
      }
      
      // Migrate settings
      if (data) {
        const settingsToSave = [
          { key: 'nextId', value: data.nextId || 1 },
          { key: 'revealed', value: data.revealed || false },
          { key: 'view', value: data.view || 'welcome' },
          { key: 'dim', value: data.dim || null },
          { key: 'diff', value: data.diff || 'all' },
          { key: 'q', value: data.q || null },
          { key: 'submitMode', value: data.submitMode || 'auto' }
        ];
        
        for (const setting of settingsToSave) {
          await db.settings.put(setting);
        }
      }
      
      // Keep localStorage as backup (don't delete yet)
    }
  } catch (e) {
    console.error('Migration from localStorage failed:', e);
  }
}

// Save entries to IndexedDB
export async function saveEntries(entries) {
  if (!db) await initDB();
  
  // Clear and re-save all entries
  await db.entries.clear();
  if (entries.length > 0) {
    await db.entries.bulkAdd(entries);
  }
}

// Load entries from IndexedDB
export async function loadEntries() {
  if (!db) await initDB();
  return await db.entries.toArray();
}

// Save a setting
export async function saveSetting(key, value) {
  if (!db) await initDB();
  await db.settings.put({ key, value });
}

// Load a setting
export async function loadSetting(key, defaultValue = null) {
  if (!db) await initDB();
  const setting = await db.settings.get(key);
  return setting ? setting.value : defaultValue;
}

// Load all settings
export async function loadAllSettings() {
  if (!db) await initDB();
  const settings = await db.settings.toArray();
  const result = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }
  return result;
}

// Save full state
export async function saveState(state) {
  if (!db) await initDB();
  
  // Save entries
  await saveEntries(state.entries || []);
  
  // Save settings
  const settingsToSave = [
    { key: 'nextId', value: state.nextId },
    { key: 'revealed', value: state.revealed },
    { key: 'view', value: state.view },
    { key: 'dim', value: state.dim },
    { key: 'diff', value: state.diff },
    { key: 'q', value: state.q },
    { key: 'submitMode', value: state.submitMode }
  ];
  
  await db.settings.bulkPut(settingsToSave);
}

// Load full state
export async function loadState() {
  if (!db) await initDB();
  
  const entries = await loadEntries();
  const settings = await loadAllSettings();
  
  return {
    entries: entries,
    nextId: settings.nextId || 1,
    revealed: settings.revealed || false,
    view: settings.view || 'welcome',
    dim: settings.dim || null,
    diff: settings.diff || 'all',
    q: settings.q || null,
    submitMode: settings.submitMode || 'auto'
  };
}

// Clear all data
export async function clearAllData() {
  if (!db) await initDB();
  await db.entries.clear();
  await db.settings.clear();
  localStorage.removeItem('llm_arena');
}

// Export data as JSON
export async function exportData() {
  const state = await loadState();
  return JSON.stringify(state, null, 2);
}

// Import data from JSON
export async function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    await saveState(data);
    return true;
  } catch (e) {
    console.error('Import failed:', e);
    return false;
  }
}

/**
 * toast.js — Toast 通知组件
 * 显示短暂的提示消息
 */

// Toast 队列，防止快速覆盖
let _toastQueue = [];
let _toastTimer = null;

function _processQueue() {
  if (_toastQueue.length === 0) {
    _toastTimer = null;
    return;
  }
  const { msg, icon } = _toastQueue.shift();
  const t = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const iconEl = t?.querySelector('i');
  if (!t || !msgEl) {
    _toastTimer = null;
    return;
  }
  msgEl.textContent = msg;
  if (iconEl) iconEl.className = icon;
  t.classList.add('show');
  _toastTimer = setTimeout(() => {
    t.classList.remove('show');
    // 等淡出动画结束后处理下一个
    setTimeout(_processQueue, 200);
  }, 2500);
}

export function toast(msg, icon = 'ri-check-line') {
  _toastQueue.push({ msg, icon });
  // 最多保留 3 条，防止队列过长
  if (_toastQueue.length > 3) _toastQueue.shift();
  if (!_toastTimer) _processQueue();
}

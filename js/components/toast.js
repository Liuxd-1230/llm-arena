/**
 * toast.js — Toast 通知组件
 * 显示短暂的提示消息
 */

export function toast(msg, icon = 'ri-check-line') {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.querySelector('i').className = icon;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

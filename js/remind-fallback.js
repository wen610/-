/* 兜底：确保「温馨提醒」弹窗一定可以关闭，且不依赖主脚本 */
(function () {
  function hide() { var m = document.getElementById('remindMask'); if (m) m.hidden = true; }
  var ok = document.getElementById('remindOk');
  if (ok) ok.addEventListener('click', hide);
  var mask = document.getElementById('remindMask');
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) hide(); });
  // 若 5 秒后仍开着，自动关闭，避免卡死
  setTimeout(function () { var m = document.getElementById('remindMask'); if (m && !m.hidden) hide(); }, 5000);
})();

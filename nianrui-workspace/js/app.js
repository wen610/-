/* ===================================================================
   函瑞の专属工作台 · 交互逻辑
   =================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let S = Store.load();
const state = {
  page: 'home', calView: 'month', calRef: todayStr(),
  noteFolder: 'all', noteQ: '', cdFilter: 'all', ciTab: 'study',
  storageGroup: 'all',
};

/* ---------- 持久化 / 提示 / 弹窗 ---------- */
function persist() { Store.save(); }
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modalMask').hidden = false; }
function closeModal() { $('#modalMask').hidden = true; $('#modalBody').innerHTML = ''; }

/* ---------- 图片缩放 ---------- */
function resizeImage(file, maxDim = 720) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function filesToB64(files, max = 4) { return Promise.all(Array.from(files).slice(0, max).map(f => resizeImage(f))); }

/* ---------- 名称映射 ---------- */
function typeName(t) { return { course: '课程', practice: '实训', personal: '私事' }[t] || t; }
function typeColor(t) { return { course: '#2C5C43', practice: '#3E7C5A', personal: '#5C9B79' }[t] || '#3E7C5A'; }
function folderName(f) { return { study: '学习灵感', daily: '日常碎碎念', fandom: '饭圈素材' }[f] || f; }
function catName(c) { return { study: '学习打卡', idol: '追星打卡', life: '生活打卡' }[c] || c; }
function cdCatName(c) { return { star: '追星纪念', exam: '学习考试', life: '生活自律' }[c] || c; }

/* ===================================================================
   导航 & 页面分发
   =================================================================== */
function goPage(page) {
  state.page = page;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#page-' + page).classList.add('active');
  const titles = { home: '首页总览', plan: '日常规划', checkin: '打卡记录', countdown: '倒计时', note: '灵感速记', 'info-storage': '信息存储', stats: '个人数据统计看板', settings: '个性化设置' };
  $('#pageTitle').textContent = titles[page] || page;
  if (page === 'home') renderHome();
  if (page === 'plan') renderCalendar();
  if (page === 'checkin') renderCheckinPage();
  if (page === 'countdown') renderCountdown();
  if (page === 'note') renderNotes();
  if (page === 'info-storage') renderInfoStorage();
  if (page === 'stats') renderStats();
  if (page === 'settings') renderSettings();
}
$('#nav').addEventListener('click', e => { const i = e.target.closest('.nav-item'); if (i) goPage(i.dataset.page); });

/* ===================================================================
   顶部状态栏：实时时间 / 公历 / 星期 / 农历 / 天气
   =================================================================== */
function tick() {
  const n = new Date();
  $('#clkTime').textContent = `${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
  const wd = ['日', '一', '二', '三', '四', '五', '六'][n.getDay()];
  $('#clkDate').textContent = `${n.getFullYear()}年${n.getMonth() + 1}月${n.getDate()}日 周${wd}`;
  let lunar = '农历 —';
  try { if (window.solarlunar) { const l = solarlunar.solar2lunar(n.getFullYear(), n.getMonth() + 1, n.getDate()); lunar = '农历 ' + l.IMonthCn + l.IDayCn; } } catch (e) {}
  $('#clkLunar').textContent = lunar;
  $('#clkWeather').textContent = S.user.weather || '🌿 —';
}
setInterval(tick, 1000); tick();

/* ===================================================================
   首页总览
   =================================================================== */
function getEvents(dateStr) {
  const dt = new Date(dateStr + 'T00:00'); const jsDow = dt.getDay(); const out = [];
  S.schedules.forEach(s => { if (s.recurring) { if (dowJS(s.weekday) === jsDow) out.push(s); } else if (s.date === dateStr) out.push(s); });
  return out.sort((a, b) => parseTime(a.start) - parseTime(b.start));
}
function isDone(id, dateStr) { return S.doneKeys.includes(id + '|' + dateStr); }

function timerStatus(t) {
  const now = Date.now(); const tg = new Date(t.target).getTime();
  if (t.mode === 'down') {
    const diff = tg - now;
    if (diff <= 0) return { big: '已到期', sub: '目标 ' + t.target.replace('T', ' ') };
    const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000);
    return { big: `${d}<small> 天 </small>${h}<small> 时 </small>${m}<small> 分</small>`, sub: '目标 ' + t.target.replace('T', ' ') };
  } else {
    const diff = now - tg; const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000);
    return { big: `${d}<small> 天 </small>${h}<small> 时 </small>${m}<small> 分</small>`, sub: '起始 ' + t.target.replace('T', ' ') };
  }
}

function renderHome() {
  const today = todayStr();
  const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const todays = getEvents(today);
  const upcoming = todays.filter(s => parseTime(s.start) >= nowMin).slice(0, 3);
  const studyToday = S.checkins.some(c => c.category === 'study' && c.date === today);
  const pending = todays.filter(s => s.type === 'course' || s.type === 'practice');
  const notes = [...S.inspirations].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 3);
  const st = computeStats();
  const importantTimers = S.timers.filter(t => t.important).sort((a, b) => a.order - b.order);

  const schedCard = `
    <div class="home-card">
      <h3><span class="leaf-dot"></span>今日近期行程提醒</h3>
      <div class="sub">温柔提醒你接下来的安排</div>
      ${upcoming.length ? upcoming.map(s => `
        <div class="mini-row ${s.important ? 'important' : ''}">
          <div class="mini-main"><span class="mini-title">${esc(s.title)}</span>
            <span class="mini-meta">${s.start}–${s.end} · <span class="tag tag-${s.type}">${typeName(s.type)}</span>${s.important ? ' · 重要' : ''}</span></div>
          <span class="mini-go" data-action="go-plan">去查看 ›</span>
        </div>`).join('') : '<div class="empty">今天没有更多行程啦，好好休息 🌿</div>'}
    </div>`;

  const checkinCard = `
    <div class="home-card">
      <h3><span class="leaf-dot"></span>今日待完成打卡项</h3>
      <div class="sub">${studyToday ? '今日学习打卡已完成 ✓' : '还没有学习打卡哦'}</div>
      ${pending.length ? pending.map(s => `
        <div class="mini-row">
          <div class="mini-main"><span class="mini-title">${esc(s.title)}</span><span class="mini-meta">${s.start}–${s.end} · 可同步学习打卡</span></div>
          <span class="mini-go" data-action="sync-checkin" data-id="${s.id}" data-date="${today}">去打卡 ›</span>
        </div>`).join('') : '<div class="empty">暂无待打卡行程</div>'}
    </div>`;

  // 灵感板块已从首页移除，入口保留在左侧「灵感速记」导航

  const statsCard = `
    <div class="home-card">
      <h3><span class="leaf-dot"></span>本周学习打卡概览</h3>
      <div class="sub">轻量汇总，完整数据见看板</div>
      <div class="kpi-row">
        <div class="kpi"><div class="num">${st.weekCheckins}</div><div class="lab">本周打卡</div></div>
        <div class="kpi"><div class="num">${st.totalProblems}</div><div class="lab">累计刷题</div></div>
        <div class="kpi"><div class="num">${st.streak}</div><div class="lab">连续打卡(天)</div></div>
      </div>
    </div>`;

  const timerCard = `
    <div class="home-card wide">
      <h3><span class="leaf-dot"></span>纪念日计时 · 重要标记</h3>
      <div class="sub">仅展示标记为「重要」的计时条目（倒计时 / 正计时）</div>
      ${importantTimers.length ? importantTimers.map(t => {
        const s = timerStatus(t);
        return `<div class="mini-row important">
          <div class="mini-main"><span class="mini-title">${esc(t.name)}</span>
            <span class="mini-meta"><span class="tag tag-${t.mode === 'down' ? 'down' : 'up'}">${t.mode === 'down' ? '倒计时' : '正计时'}</span> <span class="tag tag-${t.category}">${cdCatName(t.category)}</span> · ${s.sub}</span></div>
          <div style="text-align:right"><div style="font-weight:700;color:var(--green-deep)">${s.big}</div><span class="mini-go" data-action="go-countdown">查看全部 ›</span></div>
        </div>`;
      }).join('') : '<div class="empty">还没有标记为重要的计时条目，去「倒计时」页面新建并开启重要标记吧 🌿</div>'}
    </div>`;

  $('#homeGrid').innerHTML = schedCard + checkinCard + statsCard + timerCard;
}

/* ===================================================================
   日常规划 · 日历
   =================================================================== */
function renderCalendar() {
  $$('.seg-btn', $('#viewSeg')).forEach(b => b.classList.toggle('active', b.dataset.view === state.calView));
  const ref = state.calRef; let range = '';
  if (state.calView === 'month') {
    const d = new Date(ref + 'T00:00'); range = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
    $('#calendar').innerHTML = monthHTML(ref);
  } else if (state.calView === 'week') {
    const mon = mondayOf(ref); range = `${mon.slice(5)} ~ ${addDays(mon, 6).slice(5)}`;
    $('#calendar').innerHTML = weekHTML(mon);
  } else {
    const d = new Date(ref + 'T00:00'); range = `${ref.slice(5)} 周${weekdayCN((d.getDay() + 6) % 7 + 1)}`;
    $('#calendar').innerHTML = dayHTML(ref);
  }
  $('#calRange').textContent = range;
}
function mondayOf(dateStr) { const d = new Date(dateStr + 'T00:00'); return addDays(dateStr, -((d.getDay() + 6) % 7)); }
function shiftRef(dir) {
  if (state.calView === 'month') { const d = new Date(state.calRef + 'T00:00'); d.setMonth(d.getMonth() + dir); return fmt(d); }
  if (state.calView === 'week') return addDays(mondayOf(state.calRef), dir * 7);
  return addDays(state.calRef, dir);
}

function monthHTML(ref) {
  const d = new Date(ref + 'T00:00'); const y = d.getFullYear(), m = d.getMonth();
  const startOff = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(y, m, 1 - startOff + i); const ds = fmt(cur);
    const inMonth = cur.getMonth() === m; const isToday = ds === todayStr();
    const evs = getEvents(ds); const more = evs.length - 3;
    cells.push(`<div class="day-cell ${inMonth ? '' : 'other'} ${isToday ? 'today' : ''}" data-action="day-click" data-date="${ds}">
        <div class="day-num">${cur.getDate()}</div>
        ${evs.slice(0, 3).map(s => `<div class="chip ${s.type} ${isDone(s.id, ds) ? 'done' : ''}" data-action="toggle-done" data-id="${s.id}" data-date="${ds}" title="${esc(s.title)}">
          <span class="dot" style="background:${typeColor(s.type)}"></span><span class="nm">${esc(s.title)}</span>
          <span class="chip-ops">
            <span class="op" data-action="copy-plan" data-id="${s.id}" title="复制这条规划">⧉</span>
            <span class="op danger" data-action="del-plan" data-id="${s.id}" title="删除这条规划">🗑</span>
          </span></div>`).join('')}
        ${more > 0 ? `<div class="more">+${more} 更多</div>` : ''}
      </div>`);
  }
  const wd = ['一', '二', '三', '四', '五', '六', '日'].map(w => `<div class="wd">${w}</div>`).join('');
  return `<div class="month">${wd}${cells.join('')}</div>`;
}
function weekHTML(mon) {
  const cols = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDays(mon, i); const isToday = ds === todayStr(); const evs = getEvents(ds);
    cols.push(`<div class="wk-col ${isToday ? 'today' : ''}">
        <div class="wk-head">周${weekdayCN(i + 1)}<br>${ds.slice(5)}</div>
        ${evs.map(s => `<div class="wk-ev ${s.type} ${isDone(s.id, ds) ? 'done' : ''}" data-action="toggle-done" data-id="${s.id}" data-date="${ds}">
          <span class="t">${s.start} ${esc(s.title)}</span>
          <div class="ev-actions">
            <span class="linkact" data-action="copy-plan" data-id="${s.id}">复制</span>
            <span class="linkact danger" data-action="del-plan" data-id="${s.id}">删除</span>
          </div></div>`).join('')}
        ${evs.length ? `<div class="ev-actions"><span class="linkact" data-action="sync-checkin" data-id="${evs[0].id}" data-date="${ds}">同步打卡</span></div>` : '<div class="empty" style="padding:6px">—</div>'}
      </div>`);
  }
  return `<div class="week">${cols.join('')}</div>`;
}
function dayHTML(ref) {
  const evs = getEvents(ref); const startH = 6, endH = 24, rowH = 54; const rows = [];
  for (let h = startH; h < endH; h++) rows.push(`<div class="tl-row"><div class="tl-time">${pad2(h)}:00</div><div class="tl-track"></div></div>`);
  let blocks = '';
  evs.forEach(s => {
    let top = (parseTime(s.start) - startH * 60) / 60 * rowH; let hgt = (parseTime(s.end) - parseTime(s.start)) / 60 * rowH;
    top = Math.max(0, top); hgt = Math.max(28, hgt); const done = isDone(s.id, ref);
    blocks += `<div class="tl-ev ${s.type}" style="top:${top + 4}px;height:${hgt - 8}px;${done ? 'opacity:.5' : ''}">
        <div class="t">${s.start}–${s.end} · ${esc(s.title)} ${done ? '✓' : ''}</div>
        <div class="tl-ops">
          <span class="op" data-action="toggle-done" data-id="${s.id}" data-date="${ref}" title="${done ? '取消完成' : '完成'}">✓</span>
          <span class="op" data-action="sync-checkin" data-id="${s.id}" data-date="${ref}" title="同步打卡">⤴</span>
          <span class="op" data-action="copy-plan" data-id="${s.id}" title="复制">⧉</span>
          <span class="op danger" data-action="del-plan" data-id="${s.id}" title="删除">🗑</span>
        </div></div>`;
  });
  return `<div class="dayview"><div>${rows.join('')}</div><div style="position:absolute;left:62px;right:0;top:0;bottom:0;pointer-events:none">${blocks}</div></div>`;
}

$('#viewSeg').addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (!b) return; state.calView = b.dataset.view; renderCalendar(); });
$('#calPrev').addEventListener('click', () => { state.calRef = shiftRef(-1); renderCalendar(); });
$('#calNext').addEventListener('click', () => { state.calRef = shiftRef(1); renderCalendar(); });
$('#calToday').addEventListener('click', () => { state.calRef = todayStr(); renderCalendar(); });

function toggleDone(id, dateStr) {
  const key = id + '|' + dateStr; const i = S.doneKeys.indexOf(key);
  if (i >= 0) S.doneKeys.splice(i, 1); else S.doneKeys.push(key);
  persist(); renderCalendar();
}

/* ---------- 新增行程 / 导入课表 ---------- */
function openScheduleModal(presetDate) {
  openModal('新增行程', `
    <div class="form-field"><label>标题</label><input id="f-title" placeholder="例如：编程实训 / 大学英语"></div>
    <div class="form-row">
      <div class="form-field"><label>类型</label><select id="f-type">
        <option value="course">课程（深绿）</option><option value="practice">实训（中绿）</option><option value="personal">私事（浅绿）</option></select></div>
      <div class="form-field"><label>重要</label><select id="f-important"><option value="no">否</option><option value="yes">是（浅绿高亮）</option></select></div>
    </div>
    <div class="form-field"><label>每周重复（课程/固定安排）</label><select id="f-recur"><option value="no">不重复（指定日期）</option><option value="yes">每周循环</option></select></div>
    <div class="form-row">
      <div class="form-field"><label>日期</label><input id="f-date" type="date" value="${presetDate || todayStr()}"></div>
      <div class="form-field"><label>星期（重复时）</label><select id="f-weekday">${[1,2,3,4,5,6,7].map(w => `<option value="${w}">周${weekdayCN(w)}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>开始时间</label><input id="f-start" type="time" value="10:00"></div>
      <div class="form-field"><label>结束时间</label><input id="f-end" type="time" value="11:40"></div>
    </div>
    <div class="form-field"><label>备注</label><input id="f-note" placeholder="地点 / 内容提示"></div>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-schedule">保存行程</button></div>`);
}
function openImportModal() {
  openModal('批量导入课表', `
    <p class="hint">填写完整上课课表，导入后自动锁定固定周期，每周循环展示。</p>
    <div id="importRows"></div>
    <button class="btn ghost sm" data-action="add-row" style="margin:6px 0 12px">+ 添加一行</button>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-import">导入课表</button></div>`);
  addImportRow();
}
function addImportRow() {
  const box = $('#importRows'); if (!box) return;
  const row = document.createElement('div'); row.className = 'form-row'; row.style.marginBottom = '8px';
  row.innerHTML = `<input class="imp-name" placeholder="课程名" style="flex:2;padding:8px 10px;border-radius:10px;border:1px solid var(--border)">
    <select class="imp-wd" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border)">${[1,2,3,4,5,6,7].map(w => `<option value="${w}">周${weekdayCN(w)}</option>`).join('')}</select>
    <input class="imp-s" type="time" value="08:00" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border)">
    <input class="imp-e" type="time" value="09:40" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border)">
    <button class="btn ghost sm" data-action="del-row">×</button>`;
  box.appendChild(row);
}
function saveSchedule() {
  const title = $('#f-title').value.trim(); if (!title) { toast('请填写标题'); return; }
  const recur = $('#f-recur').value === 'yes';
  S.schedules.push({ id: uid(), title, type: $('#f-type').value, important: $('#f-important').value === 'yes', recurring: recur,
    start: $('#f-start').value, end: $('#f-end').value, note: $('#f-note').value.trim(),
    date: recur ? '' : $('#f-date').value, weekday: recur ? Number($('#f-weekday').value) : null });
  persist(); closeModal(); renderCalendar(); toast('行程已添加 🌿');
}
function saveImport() {
  let n = 0; $$('#importRows .form-row').forEach(r => {
    const name = $('.imp-name', r).value.trim(); if (!name) return;
    S.schedules.push({ id: uid(), title: name, type: 'course', important: false, recurring: true,
      weekday: Number($('.imp-wd', r).value), start: $('.imp-s', r).value, end: $('.imp-e', r).value, note: '课程' }); n++;
  });
  persist(); closeModal(); renderCalendar(); toast(`已导入 ${n} 门课程，每周循环展示`);
}

/* ===================================================================
   打卡记录
   =================================================================== */
function renderCheckinPage() {
  const wrap = $('#page-checkin');
  wrap.innerHTML = `
    <div class="toolbar">
      <div class="checkin-tabs" id="ciTabs">
        <button class="ci-tab active" data-cat="study">学习打卡</button>
        <button class="ci-tab" data-cat="idol">追星打卡</button>
        <button class="ci-tab" data-cat="life">生活打卡</button>
      </div>
      <div class="toolbar-right"><button class="btn primary" data-action="open-checkin">+ 新增打卡</button></div>
    </div>
    <div id="ciList"></div>`;
  $('#ciList').innerHTML = checkinListHTML('study');
  $('#ciTabs').addEventListener('click', e => {
    const b = e.target.closest('.ci-tab'); if (!b) return;
    $$('.ci-tab', $('#ciTabs')).forEach(x => x.classList.toggle('active', x === b));
    state.ciTab = b.dataset.cat; $('#ciList').innerHTML = checkinListHTML(state.ciTab);
  });
}
function checkinListHTML(cat) {
  const items = S.checkins.filter(c => c.category === cat).sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return `<div class="empty">还没有「${catName(cat)}」记录，点右上角去打卡吧 🌿</div>`;
  return `<div class="ci-grid">${items.map(c => `
    <div class="ci-card">
      <div class="stamp">
        <div class="stamp-mark"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>
        <div><div style="font-weight:600;color:var(--green-deep)">${catName(c.category)}</div><div class="mini-meta">${c.date}</div></div>
      </div>
      ${c.note ? `<div class="ci-note">${esc(c.note)}</div>` : ''}
      ${metricChips(c.metrics)}
      ${c.images && c.images.length ? `<div class="ci-imgs">${c.images.filter(i => i && (i.startsWith('data:') || i.startsWith('http'))).map(i => `<img src="${i}" data-action="view-img" data-src="${i}">`).join('')}</div>` : ''}
      <div class="ci-acts">
        <span class="linkact" data-action="edit-checkin" data-id="${c.id}">编辑</span>
        <span class="linkact danger" data-action="del-checkin" data-id="${c.id}">删除</span>
      </div>
    </div>`).join('')}</div>`;
}
function metricChips(m) {
  const out = [];
  if (m.problems) out.push(`<span class="metric">刷题 <b>${m.problems}</b></span>`);
  if (m.codeTasks) out.push(`<span class="metric">代码 <b>${m.codeTasks}</b></span>`);
  if (m.studyMinutes) out.push(`<span class="metric">学习 <b>${m.studyMinutes}</b>分</span>`);
  if (m.exerciseMinutes) out.push(`<span class="metric">运动 <b>${m.exerciseMinutes}</b>分</span>`);
  if (m.items && m.items.length) m.items.forEach(x => out.push(`<span class="metric">${esc(x)}</span>`));
  return out.length ? `<div class="ci-metrics">${out.join('')}</div>` : '';
}
function openCheckinModal(presetCat, presetTitle, editId) {
  const eC = editId ? S.checkins.find(x => x.id === editId) : null;
  const cat = eC ? eC.category : (presetCat || state.ciTab);
  const metricHTML = {
    study: `<div class="form-row"><div class="form-field"><label>刷题数量</label><input id="m-problems" type="number" min="0" placeholder="0"></div>
        <div class="form-field"><label>代码完成题量</label><input id="m-code" type="number" min="0" placeholder="0"></div></div>
      <div class="form-field"><label>学习时长（分钟）</label><input id="m-study" type="number" min="0" placeholder="0"></div>`,
    life: `<div class="form-field"><label>运动时长（分钟）</label><input id="m-ex" type="number" min="0" placeholder="0"></div>
      <div class="form-field"><label>自律小事（可多选）</label><div>${['作息规律','三餐规律','运动','读书','早睡'].map(x => `<label style="display:inline-flex;gap:4px;margin-right:12px;color:var(--text-soft)"><input type="checkbox" class="m-item" value="${x}">${x}</label>`).join('')}</div></div>`,
    idol: `<div class="form-field"><label>今日应援（可多选）</label><div>${['日常签到','翻看物料','整理应援文案','存图打卡'].map(x => `<label style="display:inline-flex;gap:4px;margin-right:12px;color:var(--text-soft)"><input type="checkbox" class="m-item" value="${x}">${x}</label>`).join('')}</div></div>`,
  };
  openModal('新增打卡', `
    <div class="form-field"><label>打卡分类</label><select id="f-cat">
      <option value="study" ${cat==='study'?'selected':''}>学习打卡</option>
      <option value="idol" ${cat==='idol'?'selected':''}>追星打卡</option>
      <option value="life" ${cat==='life'?'selected':''}>生活打卡</option></select></div>
    <div class="form-field"><label>日期</label><input id="f-cdate" type="date" value="${eC ? eC.date : todayStr()}"></div>
    <div class="form-field"><label>文字备注</label><textarea id="f-cnote" placeholder="${presetTitle?esc(presetTitle):'记录这一刻…'}">${eC ? esc(eC.note||'') : (presetTitle?esc(presetTitle):'')}</textarea></div>
    <div class="form-field"><label>本地图片（可多张，留空则保留原图）</label><input id="f-cimg" type="file" accept="image/*" multiple></div>
    <div id="metricBox">${metricHTML[cat]}</div>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-checkin" ${editId?`data-id="${editId}"`:''}>${editId?'保存修改':'生成绿色印记'}</button></div>`);
  if (eC) {
    const m = eC.metrics || {};
    if (cat === 'study') { $('#m-problems').value = m.problems||''; $('#m-code').value = m.codeTasks||''; $('#m-study').value = m.studyMinutes||''; }
    else { $('#m-ex').value = m.exerciseMinutes||''; (m.items||[]).forEach(x => { const cb = $$('.m-item').find(el => el.value === x); if (cb) cb.checked = true; }); }
  }
  $('#f-cat').addEventListener('change', e => { state.ciTab = e.target.value; $('#metricBox').innerHTML = metricHTML[e.target.value]; });
}
function saveCheckin(id) {
  const cat = $('#f-cat').value; const date = $('#f-cdate').value; const note = $('#f-cnote').value.trim();
  const metrics = {};
  if (cat === 'study') { metrics.problems = Number($('#m-problems').value) || 0; metrics.codeTasks = Number($('#m-code').value) || 0; metrics.studyMinutes = Number($('#m-study').value) || 0; }
  else if (cat === 'life') { metrics.exerciseMinutes = Number($('#m-ex').value) || 0; metrics.items = $$('.m-item:checked').map(c => c.value); }
  else { metrics.items = $$('.m-item:checked').map(c => c.value); }
  const files = $('#f-cimg').files;
  const orig = id ? (S.checkins.find(x => x.id === id) || {}).images || [] : [];
  const finish = (imgs) => {
    if (id) {
      const c = S.checkins.find(x => x.id === id);
      if (c) { c.category = cat; c.date = date; c.note = note; c.metrics = metrics; if (imgs.length) c.images = imgs; }
    } else {
      S.checkins.push({ id: uid(), category: cat, date, note, metrics, images: imgs, createdAt: date + ' ' + new Date().toTimeString().slice(0, 5) });
    }
    persist(); closeModal(); toast(id ? '已保存修改 ✅' : '打卡成功，已生成绿色印记 ✅');
    if (state.page === 'checkin') renderCheckinPage();
    else if (state.page === 'stats') renderStats();
    else if (state.page === 'home') renderHome();
  };
  if (files && files.length) filesToB64(files).then(finish); else finish(orig);
}

/* ===================================================================
   倒计时（独立页面）
   =================================================================== */
function renderCountdown() {
  $$('.seg-btn', $('#cdFilter')).forEach(b => b.classList.toggle('active', b.dataset.cat === state.cdFilter));
  let list = [...S.timers].sort((a, b) => a.order - b.order);
  if (state.cdFilter !== 'all') list = list.filter(t => t.category === state.cdFilter);
  const box = $('#cdList');
  if (!list.length) { box.innerHTML = '<div class="empty">该分类还没有计时条目，点右上角新建吧 🌿</div>'; return; }
  box.innerHTML = list.map(t => {
    const s = timerStatus(t);
    return `<div class="cd-card ${t.important ? 'important' : ''}" draggable="true" data-id="${t.id}">
      <div class="cd-top">
        <div><div class="cd-name">${esc(t.name)}</div><div class="cd-mode"><span class="tag tag-${t.mode==='down'?'down':'up'}">${t.mode==='down'?'倒计时':'正计时'}</span> <span class="tag tag-${t.category}">${cdCatName(t.category)}</span></div></div>
        <span class="drag-h" title="拖拽排序">⠿</span>
      </div>
      <div class="cd-big">${s.big}</div>
      <div class="cd-count">${s.sub}${t.note ? ' · ' + esc(t.note) : ''}</div>
      <div class="cd-foot">
        <div class="switch-wrap"><span class="switch ${t.important?'on':''}" data-action="toggle-important" data-id="${t.id}"></span>标记为重要</div>
        <div class="cd-acts"><span class="linkact" data-action="edit-timer" data-id="${t.id}">编辑</span> <span class="linkact" data-action="del-timer" data-id="${t.id}" style="color:#C0584F">删除</span></div>
      </div>
    </div>`;
  }).join('');
}
$('#cdFilter').addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (!b) return; state.cdFilter = b.dataset.cat; renderCountdown(); });

function openTimerModal(editId) {
  const t = editId ? S.timers.find(x => x.id === editId) : null;
  const v = (k, d) => t ? t[k] : d;
  openModal(editId ? '编辑计时' : '新建计时', `
    <div class="form-field"><label>事件名称</label><input id="t-name" value="${esc(v('name',''))}" placeholder="例如：张函瑞演唱会 / 期末考 / 自律起始日"></div>
    <div class="form-row">
      <div class="form-field"><label>模式</label><select id="t-mode"><option value="down" ${v('mode','down')==='down'?'selected':''}>倒计时（距目标剩余）</option><option value="up" ${v('mode','up')==='up'?'selected':''}>正计时（已历经时长）</option></select></div>
      <div class="form-field"><label>分类</label><select id="t-cat"><option value="star" ${v('category','star')==='star'?'selected':''}>追星纪念</option><option value="exam" ${v('category','exam')==='exam'?'selected':''}>学习考试</option><option value="life" ${v('category','life')==='life'?'selected':''}>生活自律</option></select></div>
    </div>
    <div class="form-field"><label>目标日期时间</label><input id="t-target" type="datetime-local" value="${esc(v('target',''))}"></div>
    <div class="form-field"><label>文字备注</label><input id="t-note" value="${esc(v('note',''))}" placeholder="可选"></div>
    <div class="form-field"><label>标记为重要</label><select id="t-important"><option value="no" ${!v('important',false)?'selected':''}>否（仅本页显示）</option><option value="yes" ${v('important',false)?'selected':''}>是（同步首页计时卡）</option></select></div>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-timer" data-id="${editId||''}">${editId?'保存修改':'创建计时'}</button></div>`);
}
function saveTimer(editId) {
  const name = $('#t-name').value.trim(); if (!name) { toast('请填写事件名称'); return; }
  const target = $('#t-target').value.replace(' ', 'T'); if (!target) { toast('请选择目标时间'); return; }
  const data = { name, mode: $('#t-mode').value, category: $('#t-cat').value, target, note: $('#t-note').value.trim(), important: $('#t-important').value === 'yes' };
  if (editId) { const t = S.timers.find(x => x.id === editId); Object.assign(t, data); }
  else { data.id = uid(); data.order = S.timers.length ? Math.max(...S.timers.map(x => x.order)) + 1 : 0; S.timers.push(data); }
  persist(); closeModal(); renderCountdown(); toast(editId ? '已保存修改' : '计时已创建 🌿');
}
function toggleImportant(id) {
  const t = S.timers.find(x => x.id === id); if (!t) return;
  t.important = !t.important; persist(); renderCountdown();
  if (state.page === 'home') renderHome();
  toast(t.important ? '已标记为重要，已同步首页 ✓' : '已取消重要标记');
}
function delTimer(id) {
  if (!confirm('确定删除这条计时吗？')) return;
  S.timers = S.timers.filter(x => x.id !== id);
  S.timers.forEach((t, i) => t.order = i); persist(); renderCountdown();
}

/* 拖拽排序 */
let dragId = null;
$('#cdList').addEventListener('dragstart', e => { const c = e.target.closest('.cd-card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); });
$('#cdList').addEventListener('dragend', e => { const c = e.target.closest('.cd-card'); if (c) c.classList.remove('dragging'); });
$('#cdList').addEventListener('dragover', e => { e.preventDefault(); });
$('#cdList').addEventListener('drop', e => {
  e.preventDefault(); const c = e.target.closest('.cd-card'); if (!c || !dragId) return;
  const overId = c.dataset.id; if (overId === dragId) return;
  const from = S.timers.findIndex(t => t.id === dragId); const to = S.timers.findIndex(t => t.id === overId);
  const [moved] = S.timers.splice(from, 1); S.timers.splice(to, 0, moved);
  S.timers.forEach((t, i) => t.order = i); persist(); renderCountdown();
});

/* ===================================================================
   灵感速记
   =================================================================== */
function renderNotes() {
  const q = state.noteQ.trim().toLowerCase();
  let list = S.inspirations;
  if (state.noteFolder !== 'all') list = list.filter(n => n.folder === state.noteFolder);
  if (q) list = list.filter(n => (n.title + ' ' + n.content + ' ' + n.link).toLowerCase().includes(q));
  list = [...list].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  const box = $('#noteList');
  if (!list.length) { box.innerHTML = '<div class="empty">没有匹配的灵感，点右上角随手记一条吧 🌿</div>'; return; }
  box.innerHTML = list.map(n => `
    <div class="note-card ${n.pinned ? 'pinned' : ''}">
      ${n.pinned ? '<div class="pin-flag">📌 置顶</div>' : ''}
      <h4>${esc(n.title)}</h4>
      ${n.content ? `<div class="note-body">${esc(n.content)}</div>` : ''}
      ${n.image && (n.image.startsWith('data:') || n.image.startsWith('http')) ? `<img class="note-img" src="${n.image}" data-action="view-img" data-src="${n.image}">` : ''}
      ${n.link ? `<a class="note-link" href="${esc(n.link)}" target="_blank" rel="noopener">🔗 ${esc(n.link)}</a>` : ''}
      <div class="note-foot"><span class="note-date">${folderName(n.folder)} · ${n.createdAt || ''}</span>
        <span><span class="linkact" data-action="toggle-pin" data-id="${n.id}">${n.pinned ? '取消置顶' : '置顶'}</span> &nbsp;<span class="linkact" data-action="del-note" data-id="${n.id}" style="color:#C0584F">删除</span></span></div>
    </div>`).join('');
}
$('#noteTabs').addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (!b) return; state.noteFolder = b.dataset.folder; $$('.seg-btn', $('#noteTabs')).forEach(x => x.classList.toggle('active', x === b)); renderNotes(); });
$('#noteSearch').addEventListener('input', e => { state.noteQ = e.target.value; renderNotes(); });
function openNoteModal() {
  openModal('灵感速记', `
    <div class="form-field"><label>标题</label><input id="n-title" placeholder="一句话概括"></div>
    <div class="form-field"><label>分类</label><select id="n-folder"><option value="study">学习灵感</option><option value="daily">日常碎碎念</option><option value="fandom">饭圈素材</option></select></div>
    <div class="form-field"><label>内容</label><textarea id="n-content" placeholder="编程思路 / 文案构思 / 张函瑞语录…"></textarea></div>
    <div class="form-field"><label>链接（可选）</label><input id="n-link" placeholder="https://"></div>
    <div class="form-field"><label>图片（可选）</label><input id="n-img" type="file" accept="image/*"></div>
    <div class="form-field"><label>置顶</label><select id="n-pin"><option value="no">否</option><option value="yes">是（绿标置顶）</option></select></div>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-note">保存</button></div>`);
}
function saveNote() {
  const title = $('#n-title').value.trim(); if (!title) { toast('请填写标题'); return; }
  const img = $('#n-img').files[0];
  const finish = (imgData) => {
    S.inspirations.push({ id: uid(), folder: $('#n-folder').value, title, content: $('#n-content').value.trim(), link: $('#n-link').value.trim(),
      image: imgData || '', pinned: $('#n-pin').value === 'yes', createdAt: todayStr() + ' ' + new Date().toTimeString().slice(0, 5) });
    persist(); closeModal(); renderNotes(); toast('已记下灵感 🌿');
  };
  if (img) resizeImage(img).then(finish); else finish('');
}

/* ===================================================================
   信息存储（文件分组存储）
   =================================================================== */
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}
function fileIcon(type) {
  if (type.startsWith('image/')) return '🖼️';
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('excel') || type.includes('sheet')) return '📊';
  if (type.includes('powerpoint') || type.includes('presentation')) return '📽️';
  if (type.includes('video')) return '🎬';
  if (type.includes('audio')) return '🎵';
  if (type.includes('zip') || type.includes('compressed')) return '📦';
  return '📁';
}

async function renderInfoStorage() {
  const groups = await FileStore.getGroups();
  const tabs = $('#storageTabs');
  tabs.innerHTML = `<button class="seg-btn ${state.storageGroup === 'all' ? 'active' : ''}" data-action="switch-group" data-id="all">全部</button>` +
    groups.map(g => `<button class="seg-btn ${state.storageGroup === g.id ? 'active' : ''}" data-action="switch-group" data-id="${g.id}">${esc(g.name)}</button>`).join('');
  const files = await FileStore.getFiles(state.storageGroup === 'all' ? undefined : state.storageGroup);
  const box = $('#storageList');
  if (!files.length) { box.innerHTML = '<div class="empty">该分组还没有文件，点击右上角上传吧 🌿</div>'; return; }
  box.innerHTML = files.map(f => `
    <div class="file-card">
      <div class="file-preview" data-action="view-file" data-id="${f.id}">
        ${f.type.startsWith('image/') ? `<img src="${f.data}" alt="">` : `<div class="file-icon">${fileIcon(f.type)}</div>`}
      </div>
      <div class="file-info">
        <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="file-meta">${formatSize(f.size)} · ${f.createdAt.slice(5, 16).replace('T', ' ')}</div>
      </div>
      <div class="file-acts">
        <span class="linkact" data-action="download-file" data-id="${f.id}">下载</span>
        <span class="linkact" data-action="del-file" data-id="${f.id}" style="color:#C0584F">删除</span>
      </div>
    </div>`).join('');
}

function openUploadModal() {
  FileStore.getGroups().then(groups => {
    openModal('上传文件', `
      <div class="form-field"><label>选择分组</label><select id="uf-group">${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>
      <div class="form-field"><label>本地文件（支持图片、PDF、文档、压缩包等）</label><input id="uf-files" type="file" multiple></div>
      <div class="hint">文件会存储在浏览器本地（IndexedDB），换设备或清除数据会丢失，重要资料请额外备份。</div>
      <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-file">开始上传</button></div>`);
  });
}
function openGroupModal() {
  openModal('新建分组', `
    <div class="form-field"><label>分组名称</label><input id="g-name" placeholder="例如：学习资料 / 追星物料 / 生活文件"></div>
    <div class="form-actions"><button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="save-group">创建分组</button></div>`);
}

async function saveFile() {
  const groupId = $('#uf-group').value;
  const input = $('#uf-files');
  if (!input.files || !input.files.length) { toast('请选择文件'); return; }
  const files = Array.from(input.files);
  let done = 0;
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) { toast(`「${file.name}」超过 20MB，跳过`); continue; }
    const data = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
    await FileStore.saveFile({
      id: uid(), groupId, name: file.name, type: file.type || 'application/octet-stream',
      size: file.size, data,
      createdAt: new Date().toISOString().slice(0, 16),
    });
    done++;
  }
  closeModal(); toast(done ? `已上传 ${done} 个文件 🌿` : '没有文件被上传');
  if (state.page === 'info-storage') renderInfoStorage();
}
async function saveGroup() {
  const name = $('#g-name').value.trim(); if (!name) { toast('请填写分组名称'); return; }
  const groups = await FileStore.getGroups();
  await FileStore.saveGroup({ id: uid(), name, order: groups.length });
  closeModal(); toast('分组已创建 🌿');
  if (state.page === 'info-storage') renderInfoStorage();
}
async function deleteFile(id) {
  if (!confirm('确定删除该文件？')) return;
  await FileStore.deleteFile(id); toast('已删除');
  if (state.page === 'info-storage') renderInfoStorage();
}
async function downloadFile(id) {
  const files = await FileStore.getFiles('all');
  const f = files.find(x => x.id === id); if (!f) return;
  const a = document.createElement('a'); a.href = f.data; a.download = f.name; a.click();
}
async function viewFile(id) {
  const files = await FileStore.getFiles('all');
  const f = files.find(x => x.id === id); if (!f) return;
  if (f.type.startsWith('image/') && f.data && (f.data.startsWith('data:') || f.data.startsWith('http'))) {
    $('#imgBig').src = f.data; $('#imgBig').style.display = ''; $('#imgMask').hidden = false;
  } else { downloadFile(id); }
}

/* ===================================================================
   数据统计看板
   =================================================================== */
function computeStats() {
  const dates = new Set(S.checkins.map(c => c.date));
  const streak = consecutiveStreak(dates);
  const byCat = { study: 0, idol: 0, life: 0 }; S.checkins.forEach(c => byCat[c.category]++);
  let totalProblems = 0; S.checkins.forEach(c => totalProblems += (c.metrics.problems || 0) + (c.metrics.codeTasks || 0));
  const mon = mondayOf(todayStr());
  const weekCheckins = S.checkins.filter(c => c.date >= mon && c.date <= todayStr()).length;
  let totalOcc = 0, doneOcc = 0;
  for (let i = 6; i >= 0; i--) { const ds = addDays(todayStr(), -i); getEvents(ds).forEach(s => { totalOcc++; if (isDone(s.id, ds)) doneOcc++; }); }
  const completion = totalOcc ? Math.round(doneOcc / totalOcc * 100) : 0;
  const last7 = [];
  for (let i = 6; i >= 0; i--) { const ds = addDays(todayStr(), -i); let sum = 0; S.checkins.forEach(c => { if (c.date === ds) sum += (c.metrics.problems || 0) + (c.metrics.codeTasks || 0); }); last7.push({ ds, v: sum }); }
  return { streak, byCat, totalProblems, weekCheckins, completion, last7 };
}
function consecutiveStreak(dateSet) {
  let cur = new Date(); if (!dateSet.has(todayStr())) cur = new Date(Date.now() - 86400000);
  let count = 0; while (dateSet.has(fmt(cur))) { count++; cur = new Date(cur.getTime() - 86400000); } return count;
}
function lineChart(data) {
  const W = 320, H = 120, pad = 18; const max = Math.max(1, ...data.map(d => d.v));
  const pts = data.map((d, i) => { const x = pad + i * (W - pad * 2) / (data.length - 1); const y = H - pad - d.v / max * (H - pad * 2); return [x, y]; });
  const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = `${pad},${H - pad} ` + line + ` ${W - pad},${H - pad}`;
  const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="var(--green)"></circle><text x="${p[0].toFixed(1)}" y="${H - 4}" font-size="9" fill="var(--text-faint)" text-anchor="middle">${data[i].ds.slice(5)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:560px"><polygon points="${area}" fill="var(--mint-light)" opacity=".6"></polygon><polyline points="${line}" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>${dots}</svg>`;
}
function donutChart(pct) {
  const r = 42, c = 2 * Math.PI * r; const off = c * (1 - pct / 100);
  return `<svg viewBox="0 0 110 110" width="110" height="110"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--mint-light)" stroke-width="12"></circle>
    <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--green)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 55 55)"></circle>
    <text x="55" y="52" font-size="20" font-weight="700" fill="var(--green-deep)" text-anchor="middle">${pct}%</text>
    <text x="55" y="68" font-size="10" fill="var(--text-faint)" text-anchor="middle">完成率</text></svg>`;
}
function weeklyReview(st) {
  const tips = ['保持节奏，温柔前行 🌿', '小小的坚持，会被时间看见。', '今天也要对自己好一点～', '继续加油，函瑞也在为你打气！'];
  return `本周共打卡 <b>${st.weekCheckins}</b> 次，其中学习 <b>${st.byCat.study}</b> 次、追星 <b>${st.byCat.idol}</b> 次、生活 <b>${st.byCat.life}</b> 次；累计刷题 <b>${st.totalProblems}</b> 道，连续打卡已坚持 <b>${st.streak}</b> 天，行程完成率 <b>${st.completion}%</b>。${tips[st.weekCheckins % tips.length]}`;
}
function renderStats() {
  const st = computeStats();
  const maxCat = Math.max(st.byCat.study, st.byCat.idol, st.byCat.life, 1);
  const cats = [['study', '学习打卡'], ['idol', '追星打卡'], ['life', '生活打卡']];
  const catBars = cats.map(([k, name]) => `<div class="bar-row"><div class="bar-lab">${name}</div><div class="bar-track"><div class="bar-fill" style="width:${st.byCat[k] / maxCat * 100}%"></div></div><div class="bar-val">${st.byCat[k]}</div></div>`).join('');
  $('#statsContent').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><h3>连续打卡</h3><div class="big">${st.streak}<small>天</small></div><div class="set-hint">每一次坚持都算数</div></div>
      <div class="stat-card"><h3>行程完成率</h3>${donutChart(st.completion)}</div>
      <div class="stat-card"><h3>累计刷题</h3><div class="big">${st.totalProblems}<small>道</small></div><div class="set-hint">编程刷题 + 代码题量</div></div>
      <div class="stat-card wide"><h3>近 7 天刷题趋势</h3>${lineChart(st.last7)}</div>
      <div class="stat-card"><h3>本周打卡</h3><div class="big">${st.weekCheckins}<small>次</small></div><div class="set-hint">学习 / 追星 / 生活</div></div>
      <div class="stat-card full"><h3>三大板块打卡频次</h3>${catBars}</div>
      <div class="stat-card full"><h3>每周简易复盘</h3><div class="review">${weeklyReview(st)}</div></div>
    </div>`;
}

/* ===================================================================
   个性化设置
   =================================================================== */
function updateProfile() {
  $('#brandName').textContent = S.user.name || '张函瑞';
  $('#signature').textContent = S.user.signature || '';
  const img = $('#avatarImg'), fb = $('#avatarFallback');
  if (S.user.avatar) { img.src = S.user.avatar; img.hidden = false; fb.hidden = true; }
  else { img.hidden = true; fb.hidden = false; fb.textContent = (S.user.name || '函').slice(0, 1); }
}
function renderSettings() {
  const dark = S.settings.dark;
  $('#settingsContent').innerHTML = `
    <div class="card set-card">
      <h3 style="margin:0 0 8px;color:var(--green-deep)">个性化设置</h3>
      <div class="set-row"><label>昵称</label><input type="text" id="s-name" value="${esc(S.user.name)}"></div>
      <div class="set-row"><label>个性签名</label><input type="text" id="s-sign" value="${esc(S.user.signature)}"></div>
      <div class="set-row"><label>天气信息</label><input type="text" id="s-weather" value="${esc(S.user.weather)}"><span class="set-hint">顶部状态栏展示</span></div>
      <div class="set-row"><label>护眼模式</label><div class="switch ${dark?'on':''}" id="s-dark"></div><span class="set-hint">${dark?'当前：深色':'当前：浅色（默认）'}</span></div>
      <div class="set-row"><label>温馨提醒</label><div class="switch ${S.settings.reminders!==false?'on':''}" id="s-remind"></div><span class="set-hint">${S.settings.reminders!==false?'开启：临近行程/重要倒计时轻提示':'关闭：不再弹出任何提醒'}</span></div>
      <div class="set-row"><label>头像</label><div class="val">点击左上角头像即可自定义图片 🌿</div></div>
      <div class="form-actions"><button class="btn ghost" data-action="reset-data">重置全部数据</button><button class="btn primary" data-action="save-settings">保存设置</button></div>
    </div>
    <div class="card set-card" style="margin-top:20px">
      <h3 style="margin:0 0 10px;color:var(--green-deep)">🌿 简易上手教程</h3>
      <div class="set-hint" style="line-height:1.9">
        ① <b>首页总览</b>：一眼看清今日行程、待打卡项、近期灵感与重要纪念日计时。<br>
        ② <b>日常规划</b>：月/周/日视图切换；「新增行程」填起止时间，「导入课表」批量建固定周期课程；行程可「同步打卡」。<br>
        ③ <b>打卡记录</b>：学习 / 追星 / 生活三大类，可传图与量化数据，自动生成绿色印记与连续天数。<br>
        ④ <b>倒计时</b>：新建正/倒计时，开启「标记为重要」即同步首页；支持拖拽排序、编辑、删除。<br>
        ⑤ <b>灵感速记</b>：分文件夹记录，支持链接/图片，绿标置顶，全局关键词检索。<br>
        ⑥ <b>数据看板</b>：行程完成率、打卡频次、累计刷题、连续天数，全部绿色图表 + 每周复盘。<br>
        ⑦ <b>个性化设置</b>：自定义昵称、签名、天气与护眼模式，左上角可换头像。
      </div>
    </div>`;
  $('#s-dark').addEventListener('click', () => {
    S.settings.dark = !S.settings.dark; document.documentElement.dataset.theme = S.settings.dark ? 'dark' : 'light';
    persist(); renderSettings();
  });
  $('#s-remind').addEventListener('click', () => {
    S.settings.reminders = S.settings.reminders === false ? true : false;
    persist(); renderSettings();
  });
}
function saveSettings() {
  S.user.name = $('#s-name').value.trim() || '张函瑞';
  S.user.signature = $('#s-sign').value.trim();
  S.user.weather = $('#s-weather').value.trim() || '🌿 —';
  persist(); updateProfile(); toast('设置已保存 🌿');
}

/* 头像自定义 */
$('#avatarBtn').addEventListener('click', () => $('#avatarInput').click());
$('#avatarInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  resizeImage(f, 240).then(d => { S.user.avatar = d; persist(); updateProfile(); toast('头像已更新 🌿'); });
  e.target.value = '';
});

/* ===================================================================
   提醒引擎：临近行程 / 临近重要倒计时
   =================================================================== */
let remindOpen = false;
let remindAutoClose;
/* 温馨提醒改为非阻塞的角落提示，避免挡住整个界面、导致无法操作 */
function showRemind(title, text) {
  if (remindOpen) return; // 避免短时间重复弹出
  remindOpen = true;
  toast('🌿 ' + title + '：' + text.replace(/\n/g, ' '), 5000);
  setTimeout(() => { remindOpen = false; }, 60000); // 1 分钟内同一类提醒不重复
}
function closeRemind() { const m = $('#remindMask'); if (m) m.hidden = true; remindOpen = false; clearTimeout(remindAutoClose); }
function checkReminders() {
  if (S.settings.reminders === false) return; // 用户可在设置中关闭温馨提醒
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
  // 行程
  getEvents(todayStr()).forEach(s => {
    const diff = parseTime(s.start) - nowMin;
    const key = 's|' + s.id + '|' + todayStr();
    if (diff >= 0 && diff <= 10 && !S.reminded.includes(key)) {
      S.reminded.push(key); persist();
      showRemind('行程温馨提醒', `${s.title} 将在 ${diff === 0 ? '现在' : diff + ' 分钟后'} 开始啦～\n${s.start}–${s.end} · ${typeName(s.type)}`);
    }
  });
  // 重要倒计时
  S.timers.filter(t => t.important && t.mode === 'down').forEach(t => {
    const diff = new Date(t.target).getTime() - Date.now(); const key = 't|' + t.id;
    if (diff > 0 && diff < 24 * 3600000 && !S.reminded.includes(key)) {
      S.reminded.push(key); persist();
      const h = Math.floor(diff / 3600000);
      showRemind('纪念日温馨提醒', `「${t.name}」还剩 ${h} 小时就到啦，提前准备一下吧 🌿`);
    }
  });
}
setInterval(checkReminders, 20000); setTimeout(checkReminders, 2500);

/* ===================================================================
   全局事件委托
   =================================================================== */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action; const id = el.dataset.id; const date = el.dataset.date;
  switch (a) {
    case 'go-plan': goPage('plan'); break;
    case 'go-note': goPage('note'); break;
    case 'go-stats': goPage('stats'); break;
    case 'go-checkin': goPage('checkin'); break;
    case 'go-countdown': goPage('countdown'); break;
    case 'day-click': state.calView = 'day'; state.calRef = date; renderCalendar(); break;
    case 'toggle-done': toggleDone(id, date); break;
    case 'sync-checkin': { const s = S.schedules.find(x => x.id === id); openCheckinModal('study', s ? s.title : ''); break; }
    case 'open-schedule': openScheduleModal(); break;
    case 'open-import': openImportModal(); break;
    case 'add-row': addImportRow(); break;
    case 'del-row': el.closest('.form-row').remove(); break;
    case 'save-schedule': saveSchedule(); break;
    case 'save-import': saveImport(); break;
    case 'open-checkin': openCheckinModal(); break;
    case 'save-checkin': saveCheckin(id); break;
    case 'edit-checkin': openCheckinModal(null, null, id); break;
    case 'del-checkin': { if (confirm('删除这条打卡记录？')) { S.checkins = S.checkins.filter(x => x.id !== id); persist(); renderCheckinPage(); toast('已删除打卡 🌿'); } break; }
    case 'open-note': openNoteModal(); break;
    case 'save-note': saveNote(); break;
    case 'toggle-pin': { const n = S.inspirations.find(x => x.id === id); n.pinned = !n.pinned; persist(); renderNotes(); break; }
    case 'del-note': { if (confirm('删除这条灵感？')) { S.inspirations = S.inspirations.filter(x => x.id !== id); persist(); renderNotes(); } break; }
    case 'del-plan': { if (confirm('删除这条规划？')) { S.schedules = S.schedules.filter(x => x.id !== id); persist(); if (state.page === 'plan') renderCalendar(); else if (state.page === 'home') renderHome(); toast('已删除规划 🌿'); } break; }
    case 'copy-plan': { const s = S.schedules.find(x => x.id === id); if (s) { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.title = s.title + ' 副本'; S.schedules.push(c); persist(); if (state.page === 'plan') renderCalendar(); else if (state.page === 'home') renderHome(); toast('已复制规划 🌿'); } break; }
    case 'open-timer': openTimerModal(); break;
    case 'save-timer': saveTimer(id); break;
    case 'edit-timer': openTimerModal(id); break;
    case 'del-timer': delTimer(id); break;
    case 'toggle-important': toggleImportant(id); break;
    case 'view-img': { const src = el.dataset.src || ''; if (!src || (!src.startsWith('data:') && !src.startsWith('http'))) { toast('图片预览不可用 🌿'); break; } $('#imgBig').src = src; $('#imgBig').style.display = ''; $('#imgMask').hidden = false; break; }
    case 'close-modal': closeModal(); break;
    case 'save-settings': saveSettings(); break;
    case 'reset-data': if (confirm('将清空全部数据并恢复示例，确定？')) { Store.reset(); S = Store.load(); await FileStore.init(); await FileStore.ensureDefaultGroup(); updateProfile(); goPage(state.page); toast('已重置'); } break;
    case 'close-remind': closeRemind(); break;
    case 'open-upload': openUploadModal(); break;
    case 'open-group': openGroupModal(); break;
    case 'save-file': saveFile(); break;
    case 'save-group': saveGroup(); break;
    case 'del-file': deleteFile(id); break;
    case 'download-file': downloadFile(id); break;
    case 'view-file': viewFile(id); break;
    case 'switch-group': state.storageGroup = id; renderInfoStorage(); break;
  }
});
$('#modalClose').addEventListener('click', closeModal);
$('#modalMask').addEventListener('click', e => { if (e.target === $('#modalMask')) closeModal(); });
$('#imgMask').addEventListener('click', () => ($('#imgMask').hidden = true));
$('#imgClose').addEventListener('click', (e) => { e.stopPropagation(); $('#imgMask').hidden = true; });
$('#imgBig').addEventListener('error', () => { $('#imgBig').style.display = 'none'; toast('图片加载失败 🌿'); });

/* 按 Esc 关闭弹窗 */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const rm = $('#remindMask');
    if (rm && !rm.hidden) closeRemind();
    else if (!$('#imgMask').hidden) $('#imgMask').hidden = true;
    else if (!$('#modalMask').hidden) closeModal();
  }
});

/* ===================================================================
   启动
   =================================================================== */
(async function boot() {
  await FileStore.init();
  await FileStore.ensureDefaultGroup();
  updateProfile();
  document.documentElement.dataset.theme = S.settings.dark ? 'dark' : 'light';
  goPage('home');
})();

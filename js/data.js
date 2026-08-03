/* ===== 数据层：localStorage 持久化 + 首次种子数据 ===== */
const STORE_KEY = 'hanrui_workbench_v1';

/* 安全存储：file:// 下 localStorage 可能不可用时回退到内存 */
const safeStore = {
  mem: {},
  get(k) { try { return localStorage.getItem(k); } catch (e) { return this.mem[k] != null ? this.mem[k] : null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { this.mem[k] = v; } },
};

const Store = {
  data: null,
  load() {
    const raw = safeStore.get(STORE_KEY);
    if (raw) { try { this.data = JSON.parse(raw); } catch (e) { this.data = this.seed(); this.save(); } }
    else { this.data = this.seed(); this.save(); }
    return this.data;
  },
  save() { safeStore.set(STORE_KEY, JSON.stringify(this.data)); },
  reset() { this.data = this.seed(); this.save(); },

  seed() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const day = (off) => { const t = new Date(y, m, d + off); return fmt(t); };
    const weekdayOfToday = now.getDay();
    const dow = (jsDow) => (jsDow === 0 ? 7 : jsDow);

    const schedules = [
      { id: uid(), title: '数据结构 · 算法课', type: 'course', recurring: true, weekday: dow(weekdayOfToday), start: '10:00', end: '11:40', note: '教学楼 A302', important: true },
      { id: uid(), title: '编程实训：LeetCode 双周赛', type: 'practice', recurring: false, date: day(0), start: '14:30', end: '17:30', note: '完成 4 道中等题', important: true },
      { id: uid(), title: '大学英语', type: 'course', recurring: true, weekday: dow(weekdayOfToday), start: '19:00', end: '20:40', note: '线上' },
      { id: uid(), title: '取快递 + 买晚饭食材', type: 'personal', recurring: false, date: day(0), start: '12:30', end: '13:10', note: '菜鸟驿站' },
      { id: uid(), title: '操作系统', type: 'course', recurring: true, weekday: dow((weekdayOfToday + 2) % 7 || 7), start: '08:00', end: '09:40' },
      { id: uid(), title: '数据库原理', type: 'course', recurring: true, weekday: dow((weekdayOfToday + 3) % 7 || 7), start: '14:00', end: '15:40' },
      { id: uid(), title: '运动：慢跑 30 分钟', type: 'personal', recurring: true, weekday: dow((weekdayOfToday + 4) % 7 || 7), start: '21:00', end: '21:30' },
    ];

    const inspirations = [
      { id: uid(), folder: 'study', title: '并查集路径压缩思路', content: 'find(x) 时把路径上所有节点直接挂到根，压缩后查询接近 O(1)。刷题时用得上。', link: '', image: '', pinned: true, createdAt: day(0) + ' 09:20' },
      { id: uid(), title: '张函瑞今天笑起来真好看', folder: 'fandom', content: '存图打卡：新舞台直拍已存。应援文案：「光落在你肩上，我们也成了光。」', link: 'https://example.com', image: '', pinned: false, createdAt: day(-1) + ' 22:10' },
      { id: uid(), title: '周末想吃的火锅清单', folder: 'daily', content: '番茄锅 + 虾滑 + 宽粉，约函瑞一起？', link: '', image: '', pinned: false, createdAt: day(-2) + ' 18:40' },
      { id: uid(), title: 'React 状态管理选型', folder: 'study', content: '小项目用 Context + useReducer，大项目考虑 Zustand，少样板。', link: '', image: '', pinned: false, createdAt: day(-3) + ' 11:05' },
    ];

    const checkins = [];
    const mk = (cat, date, note, metrics) => checkins.push({ id: uid(), category: cat, date, note, metrics: metrics || {}, images: [], createdAt: date + ' 22:00' });
    mk('study', day(-5), '完成数组专题 8 题', { problems: 8, codeTasks: 8, studyMinutes: 120 });
    mk('life',  day(-5), '早睡 + 运动打卡', { exerciseMinutes: 30 });
    mk('idol',  day(-5), '翻看物料 + 存图', {});
    mk('study', day(-4), '二叉树递归整理', { problems: 5, codeTasks: 5, studyMinutes: 90 });
    mk('life',  day(-4), '三餐规律', {});
    mk('study', day(-3), '图论 BFS 模板', { problems: 6, codeTasks: 6, studyMinutes: 110 });
    mk('idol',  day(-3), '整理应援文案', {});
    mk('study', day(-2), '动态规划入门', { problems: 4, codeTasks: 4, studyMinutes: 100 });
    mk('life',  day(-2), '慢跑 30 分钟', { exerciseMinutes: 30 });
    mk('study', day(-1), '周赛复盘 + 补题', { problems: 7, codeTasks: 7, studyMinutes: 130 });
    mk('idol',  day(-1), '日常签到', {});
    mk('life',  day(-1), '自律小事：读书 20 页', {});
    mk('study', day(0),  '实训：完成 2 道中等题', { problems: 2, codeTasks: 2, studyMinutes: 60 });

    const t = (off) => { const d2 = new Date(y, m, d + off); return `${fmt(d2)}T${off < 0 ? '00:00' : '19:30'}`; };
    const timers = [
      { id: uid(), name: '张函瑞巡回演唱会', mode: 'down', target: t(45), category: 'star', important: true, note: '一起去看现场！', order: 0 },
      { id: uid(), name: '自律打卡起始日', mode: 'up', target: t(-60), category: 'life', important: true, note: '从这一天开始好好生活', order: 1 },
      { id: uid(), name: '操作系统期末考试', mode: 'down', target: t(80), category: 'exam', important: false, note: '重点复习死锁与调度', order: 2 },
      { id: uid(), name: 'React 项目 Deadline', mode: 'down', target: t(20), category: 'exam', important: false, note: '前端大作业提交', order: 3 },
    ];

    return {
      user: { name: '念瑞小栈', signature: '—— 今日份的温柔与努力 ——', avatar: '', weather: '🌿 微风 · 24°C' },
      settings: { dark: false, reminders: true },
      schedules, inspirations, checkins, timers,
      doneKeys: [], reminded: [],
    };
  }
};

/* ===== 文件存储：IndexedDB（离线分组存储各类文件） ===== */
const FileStore = {
  DB_NAME: 'hanrui_file_storage_v1',
  db: null,
  mem: { groups: [{ id: 'default', name: '默认分组', order: 0 }], files: [] },
  useMem: false,

  init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) { this.useMem = true; resolve(); return; }
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) {
          const fs = db.createObjectStore('files', { keyPath: 'id' });
          fs.createIndex('groupId', 'groupId', { unique: false });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = () => { this.useMem = true; resolve(); };
    });
  },

  _tx(store, mode) { return this.db.transaction(store, mode); },
  _getAll(store) { return new Promise((res, rej) => { const r = this._tx(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  _put(store, obj) { return new Promise((res, rej) => { const r = this._tx(store, 'readwrite').objectStore(store).put(obj); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },
  _del(store, id) { return new Promise((res, rej) => { const r = this._tx(store, 'readwrite').objectStore(store).delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); },

  async ensureDefaultGroup() {
    const groups = await this.getGroups();
    if (!groups.length) await this.saveGroup({ id: 'default', name: '默认分组', order: 0 });
  },

  async getGroups() {
    if (this.useMem || !this.db) return [...this.mem.groups].sort((a, b) => a.order - b.order);
    const list = await this._getAll('groups'); return list.sort((a, b) => a.order - b.order);
  },
  async saveGroup(g) { if (this.useMem || !this.db) { const i = this.mem.groups.findIndex(x => x.id === g.id); if (i >= 0) this.mem.groups[i] = g; else this.mem.groups.push(g); return; }
    await this._put('groups', g);
  },
  async deleteGroup(id) {
    if (id === 'default') return; // 保留默认分组
    if (this.useMem || !this.db) { this.mem.groups = this.mem.groups.filter(x => x.id !== id); this.mem.files = this.mem.files.filter(x => x.groupId !== id); return; }
    // 将该组文件移到默认分组后删除分组
    const files = await this.getFiles(id);
    for (const f of files) { f.groupId = 'default'; await this._put('files', f); }
    await this._del('groups', id);
  },

  async getFiles(groupId) {
    if (this.useMem || !this.db) {
      let list = this.mem.files;
      if (groupId && groupId !== 'all') list = list.filter(x => x.groupId === groupId);
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (groupId && groupId !== 'all') {
      const tx = this._tx('files', 'readonly'); const idx = tx.objectStore('files').index('groupId');
      return new Promise((res, rej) => { const r = idx.getAll(groupId); r.onsuccess = () => res(r.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); r.onerror = () => rej(r.error); });
    }
    const list = await this._getAll('files'); return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async saveFile(f) { if (this.useMem || !this.db) { const i = this.mem.files.findIndex(x => x.id === f.id); if (i >= 0) this.mem.files[i] = f; else this.mem.files.push(f); return; }
    await this._put('files', f);
  },
  async deleteFile(id) { if (this.useMem || !this.db) { this.mem.files = this.mem.files.filter(x => x.id !== id); return; }
    await this._del('files', id);
  }
};

/* 工具函数（全局） */
function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(dt) {
  const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function todayStr() { return fmt(new Date()); }
function parseTime(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }
function pad2(n) { return String(n).padStart(2, '0'); }
function timeStr(min) { return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`; }
function addDays(dateStr, n) { const [y, m, d] = dateStr.split('-').map(Number); return fmt(new Date(y, m - 1, d + n)); }
function weekdayCN(n) { return ['一', '二', '三', '四', '五', '六', '日'][n - 1]; }
function dowJS(n) { return n === 7 ? 0 : n; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

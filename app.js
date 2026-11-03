/* PharmaShift · แอปพนักงานและเจ้าของร้าน (เปิดผ่าน LINE LIFF) */
(function () {
  const { CFG, esc, ic, icons, t5, mins, hm, todayStr, nowMins, fmtTime, dow, addDays, dShort, dLong, monthLabel, baht, avatar, greet, dayArc, ribbon, toast, errMsg, DOW, TONES, confettiHTML } = window.PS;
  const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pharmashift-auth' } });
  const $main = document.getElementById('main'), $nav = document.getElementById('nav'), $top = document.getElementById('top'), $layer = document.getElementById('layer');
  const ROLE = { owner: 'เจ้าของร้าน', manager: 'ผู้จัดการ', pharmacist: 'เภสัชกร', assistant: 'ผู้ช่วยเภสัช' };
  const EMP = { owner: 'เจ้าของ', fulltime: 'ประจำ', parttime: 'พาร์ทไทม์' };
  const TONE_TH = { brand: 'คราม', teal: 'เขียวน้ำทะเล', sun: 'เหลือง', lilac: 'ม่วง', sky: 'ฟ้า', coral: 'ส้มอมชมพู' };

  const S = {
    profile: {}, orgs: [], me: null, org: null, tz: 'Asia/Bangkok', isOwner: false, tab: 'home', month: '', sel: '', filter: '0', ptMode: 'view',
    branches: [], members: [], pay: {}, invites: {}, shifts: [], open: [], claims: [], leaves: [], fixes: [], ot: [], att: [], avail: [], handover: [], myLast: null, pendingPS: null, outPS: null,
  };

  // ---------- helpers ----------
  const q = async (p) => { const { data, error } = await p; if (error) throw error; return data; };
  const rpc = (fn, args) => q(sb.rpc(fn, args));
  const today = () => todayStr(S.tz);
  const M = (id) => S.members.find((m) => m.id === id) || { display_name: '?', color: 'brand' };
  const B = (id) => S.branches.find((b) => b.id === id) || { name: '?', open_time: '09:00', close_time: '21:00' };
  const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`]; };
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const isPharm = (m) => ['pharmacist', 'owner', 'manager'].includes(m.role);
  const chipFor = (s, showB) => { const m = M(s.member_id); return `<span class="chip" style="background:var(--${tone(m.color)}-soft);color:var(--${tone(m.color)}-deep)"><svg class="tod"><use href="#${mins(s.start_time) >= 900 ? 'moonI' : 'sunI'}"/></svg><span class="txt">${showB ? esc(shortB(s.branch_id)) + ' ' : ''}${esc(shortName(m.display_name))}</span><span class="ini">${esc(shortName(m.display_name).slice(0, 1))}</span></span>`; };
  const tone = (t) => (TONES.includes(t) ? t : 'brand');
  const shortName = (n) => String(n || '').replace(/^(ภก\.|ภญ\.)\s*/, '');
  const shortB = (id) => { const b = S.branches.find((x) => x.id === id); if (!b) return ''; if (b.code) return b.code; const n = b.name.replace(/^สาขา\s*/, ''); return n.length > 14 ? n.slice(0, 13) + '…' : n; };
  const bIdx = (id) => Math.max(0, S.branches.findIndex((b) => b.id === id)) % 4;
  const DEF_PRESETS = [{ code: 'เต็มวัน', start: '09:00', end: '21:00' }, { code: 'เช้า', start: '09:00', end: '15:00' }, { code: 'บ่าย', start: '15:00', end: '21:00' }];
  const presets = () => (S.org && Array.isArray(S.org.presets) && S.org.presets.length ? S.org.presets : DEF_PRESETS);
  const presetOf = (s) => presets().find((p) => p.start === t5(s.start_time) && p.end === t5(s.end_time));
  const shiftName = (s) => { const p = presetOf(s); return p ? p.code : t5(s.start_time).replace(':00', '') + '–' + t5(s.end_time).replace(':00', ''); };
  const multiB = () => S.branches.filter((b) => b.active).length > 1;
  const shiftCode = (s) => shiftName(s) + (multiB() ? ' · ' + shortB(s.branch_id) : '');
  const MARK = { OFF: 'วันหยุด', AL: 'ลาพักร้อน', HD: 'วันหยุดนักขัตฤกษ์', SL: 'ลาป่วย', PL: 'ลากิจ' };
  const narrow = () => window.innerWidth < 760;
  const help = (t) => `<details class="hint"><summary>${ic('circle-help')}วิธีใช้</summary><div>${t}</div></details>`;
  const skel = (n = 3) => `<div class="skel-wrap">${Array.from({ length: n }, () => '<div class="skel"></div>').join('')}</div>`;
  const MARK_S = { OFF: 'หยุด', AL: 'พักร้อน', HD: 'นักขัตฯ', SL: 'ลาป่วย', PL: 'ลากิจ' };
  const markOf = (mid, d) => (S.marks || []).find((x) => x.member_id === mid && x.work_date === d);
  const lastAtt = () => { const o = {}; for (const a of S.att) o[a.member_id] = a; return o; };
  const isToday = (iso) => todayStr(S.tz, new Date(iso)) === today();
  const inNow = (last) => last && last.kind === 'in' && isToday(last.at);
  const forgotOut = (last) => last && last.kind === 'in' && !isToday(last.at) && Date.now() - new Date(last.at).getTime() < 7 * 86400e3;
  const grace = () => S.org?.grace_minutes ?? 15;
  // ---------- ตรวจตาราง: หาจุดเสี่ยงก่อนใช้งานจริง ----------
  const RULES = () => ({ cover: true, cover_mgr: true, week_h: 48, streak: 6, avail: true, ...((S.org && S.org.rules) || {}) });
  const gapsOf = (o, c, iv) => { const g = []; let cur = o; for (const [a, b] of [...iv].sort((x, y) => x[0] - y[0])) { if (a > cur) g.push([cur, Math.min(a, c)]); cur = Math.max(cur, b); if (cur >= c) break; } if (cur < c) g.push([cur, c]); return g.filter(([a, b]) => b > a); };
  function scheduleIssues(from, to, onlyMember) {
    const R = RULES(), t = today(), out = [];
    if (from < t) from = t; if (to < from) return out;
    const last = [...S.shifts, ...S.open].reduce((mx, s) => (s.work_date > mx ? s.work_date : mx), '');
    const isRx = (m) => !!m && (m.role === 'pharmacist' || (R.cover_mgr && (m.role === 'owner' || m.role === 'manager')));
    const nm = (id) => shortName(M(id).display_name);
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ds = S.shifts.filter((s) => s.work_date === d);
      if (R.cover && !onlyMember && last && d <= last) for (const br of S.branches.filter((b) => b.active)) {
        const iv = ds.filter((s) => s.branch_id === br.id && isRx(M(s.member_id))).map((s) => [mins(s.start_time), mins(s.end_time)]);
        const gaps = gapsOf(mins(br.open_time), mins(br.close_time), iv); if (!gaps.length) continue;
        const ops = S.open.filter((x) => x.work_date === d && x.branch_id === br.id).map((x) => [mins(x.start_time), mins(x.end_time)]);
        const left = gaps.flatMap(([a, b]) => gapsOf(a, b, ops));
        const txt = gaps.map(([a, b]) => `${hm(a)}–${hm(b)}`).join(', ');
        out.push({ sev: left.length ? 'alert' : 'warn', d, b: br.id, k: 'cover', text: `${br.name}: ไม่มีเภสัชกรช่วง ${txt}`, sub: left.length ? 'ร้านขายยาต้องมีเภสัชกรอยู่ตลอดเวลาที่เปิด · เพิ่มเวรหรือประกาศเวรว่าง' : 'ประกาศเวรว่างไว้แล้ว รอคนรับ' });
      }
      const byM = {}; ds.forEach((s) => { (byM[s.member_id] = byM[s.member_id] || []).push(s); });
      for (const [mid, arr] of Object.entries(byM)) {
        if (onlyMember && mid !== onlyMember) continue;
        arr.sort((x, y) => mins(x.start_time) - mins(y.start_time));
        for (let i = 1; i < arr.length; i++) if (mins(arr[i].start_time) < mins(arr[i - 1].end_time)) { out.push({ sev: 'alert', d, m: mid, k: 'dup', text: `${nm(mid)}: มีเวรซ้อนกัน`, sub: `${t5(arr[i - 1].start_time)}–${t5(arr[i - 1].end_time)} กับ ${t5(arr[i].start_time)}–${t5(arr[i].end_time)}` }); break; }
        const mk = markOf(mid, d); if (mk) out.push({ sev: 'alert', d, m: mid, k: 'mark', text: `${nm(mid)}: มีเวร แต่ลงไว้ว่า${MARK[mk.kind]}`, sub: 'ลบเวรหรือลบวันหยุด/วันลาออกอย่างใดอย่างหนึ่ง' });
        const m = M(mid);
        if (R.avail && m.employment === 'parttime' && S.avail.some((a) => a.member_id === mid) && !S.avail.some((a) => a.member_id === mid && a.work_date === d))
          out.push({ sev: 'warn', d, m: mid, k: 'avail', text: `${nm(mid)}: ไม่ได้แจ้งว่าว่างวันนี้`, sub: 'ถามเจ้าตัวก่อนว่ามาได้ไหม' });
      }
    }
    for (const m of S.members.filter((x) => x.active && (!onlyMember || x.id === onlyMember))) {
      const hrs = (d) => S.shifts.filter((s) => s.member_id === m.id && s.work_date === d).reduce((a, s) => a + (mins(s.end_time) - mins(s.start_time)) / 60, 0);
      if (R.week_h) for (let ws = addDays(from, -dow(from)); ws <= to; ws = addDays(ws, 7)) {
        let h = 0; for (let i = 0; i < 7; i++) h += hrs(addDays(ws, i));
        if (h > R.week_h) out.push({ sev: 'warn', d: ws < from ? from : ws, m: m.id, k: 'week', text: `${shortName(m.display_name)}: ${Math.round(h * 10) / 10} ชม. ในสัปดาห์ ${dShort(ws)}–${dShort(addDays(ws, 6))}`, sub: `เกินที่ตั้งไว้ ${R.week_h} ชม./สัปดาห์` });
      }
      if (R.streak) { let run = 0, told = false; for (let d = addDays(from, -R.streak); d <= to; d = addDays(d, 1)) {
        if (S.shifts.some((s) => s.member_id === m.id && s.work_date === d)) { run++; if (run > R.streak && !told && d >= from) { told = true; out.push({ sev: 'warn', d, m: m.id, k: 'streak', text: `${shortName(m.display_name)}: ทำงานติดกันเกิน ${R.streak} วัน`, sub: 'ควรมีวันหยุดอย่างน้อยสัปดาห์ละ 1 วัน' }); } }
        else { run = 0; told = false; } } }
    }
    return out.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : (x.sev === 'alert' ? -1 : 1)));
  }
  const issueRow = (x, showDay = true) => `<button class="iss-row ${x.sev}" data-act="goIssue" data-d="${x.d}"><span class="dotc"></span><span class="grow"><b>${esc(x.text)}</b><br><span class="tiny muted">${showDay ? dShort(x.d) + ' · ' : ''}${esc(x.sub || '')}</span></span>${showDay ? ic('chevron-right') : ''}</button>`;
  function issueCard() {
    if (!S.branches.length || !S.shifts.length) return '';
    const t = today(), list = scheduleIssues(t, addDays(t, 13)), al = list.filter((x) => x.sev === 'alert').length;
    if (!list.length) return `<div class="card iss-ok"><div class="row"><span class="icon-chip t-teal">${ic('shield-check')}</span><div class="grow"><b>ตาราง 14 วันข้างหน้าเรียบร้อย</b><br><span class="small muted">มีเภสัชกรครบทุกช่วงที่เปิด ไม่มีเวรชน ไม่มีใครทำงานเกิน</span></div></div></div>`;
    return `<div class="card"><div class="card-head"><div class="row"><span class="icon-chip ${al ? 't-coral' : 't-sun'}">${ic('shield-alert')}</span><div><h2>ตรวจตาราง</h2><span class="tiny muted">14 วันข้างหน้า</span></div></div><div class="row">${al ? `<span class="pill alert">ต้องแก้ ${al}</span>` : ''}${list.length - al ? `<span class="pill warn">ควรดู ${list.length - al}</span>` : ''}</div></div>
      <div class="stack" style="gap:6px">${list.slice(0, 4).map((x) => issueRow(x)).join('')}</div>${list.length > 4 ? `<button class="btn ghost" data-act="issuesAll">ดูทั้งหมด ${list.length} รายการ</button>` : ''}</div>`;
  }
  const fmtDist = (m) => (m < 1000 ? `${m} ม.` : `${(m / 1000).toFixed(1)} กม.`);
  function geoFlag(a) {
    if (!a || !isToday(a.at)) return '';
    const br = B(a.branch_id), r = br.gps_radius || 150;
    let h = '';
    if (a.distance_m != null && a.distance_m > r) h += `<span class="pill alert">${ic('map-pin-off')}สแกนห่างร้าน ${fmtDist(a.distance_m)}</span>`;
    else if (a.distance_m == null && br.lat != null && !a.via_static) h += `<span class="tiny muted">ไม่มีพิกัด GPS</span>`;
    if (a.via_static) h += `<span class="tiny muted">${ic('qr-code')} QR ติดผนัง</span>`;
    return h ? `<div class="row" style="flex-wrap:wrap;gap:6px;padding-left:46px">${h}</div>` : '';
  }
  function getPos() {
    return new Promise((res) => {
      if (!navigator.geolocation) { S.gpsErr = 'none'; return res(null); }
      navigator.geolocation.getCurrentPosition((p) => { S.gpsErr = null; res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); }, (e) => { S.gpsErr = e && e.code === 1 ? 'denied' : 'fail'; res(null); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
  }

  const lateKind = (lm) => lm == null ? null : lm <= 0 ? 'ok' : lm <= grace() ? 'warn' : 'alert';
  const LATE_TH = { ok: 'ตรงเวลา', warn: 'สายในเกณฑ์', alert: 'สายเกินเกณฑ์' };
  function leaveBal() {
    const q0 = M(S.me.member_id).leave_quota || {}; if (!Object.keys(q0).length) return '';
    const y = (S.yearMarks || []).filter((x) => x.member_id === S.me.member_id);
    return `<div class="small" style="background:var(--bg);border-radius:10px;padding:8px 10px">วันลาคงเหลือปีนี้: ${['AL', 'SL', 'PL'].filter((k) => q0[k] != null).map((k) => { const used = y.filter((x) => x.kind === k).reduce((a, x) => a + Number(x.days), 0); return `${MARK[k]} <b>${Number(q0[k]) - used}</b>/${q0[k]}`; }).join(' · ')}</div>`;
  }
  function gpsHelp() {
    sheet('เปิดตำแหน่ง (GPS) ให้ LINE', `<p class="small">${S.gpsErr === 'denied' ? 'เครื่องนี้ปิดสิทธิ์ตำแหน่งของ LINE ไว้ หน้าต่างขออนุญาตจึงไม่ขึ้น' : 'ยังอ่านตำแหน่งของเครื่องไม่ได้'} ทำตามนี้ครั้งเดียว:</p>
      <b class="small">iPhone</b><ol class="small" style="margin:0;padding-left:20px"><li>ตั้งค่า → ความเป็นส่วนตัวและความปลอดภัย → บริการหาตำแหน่ง → <b>เปิด</b></li><li>เลื่อนหา <b>LINE</b> → เลือก <b>ขณะใช้แอป</b> และเปิด <b>ตำแหน่งที่แม่นยำ</b></li></ol>
      <b class="small">Android</b><ol class="small" style="margin:0;padding-left:20px"><li>ดึงแถบบนลงมา → เปิด <b>ตำแหน่ง</b></li><li>ตั้งค่า → แอป → <b>LINE</b> → สิทธิ์ → ตำแหน่ง → <b>อนุญาตขณะใช้แอป</b></li></ol>
      <p class="small muted">จากนั้นปิดแอปนี้ แล้วสแกน QR ใหม่ ถ้ามีหน้าต่างถาม ให้กด "อนุญาต"</p>
      <button class="btn primary block" data-act="testGps">${ic('map-pin')}ทดสอบตำแหน่งตอนนี้</button>`);
  }
  function statusOf(s, last) {
    const st = mins(s.start_time), g = grace(), N = nowMins(S.tz);
    if (last && isToday(last.at)) {
      if (last.kind === 'out') return { c: 'ok', i: 'log-out', t: `ออกงาน ${fmtTime(last.at, S.tz)}` };
      const late = mins(fmtTime(last.at, S.tz)) - st;
      if (late <= 0) return { c: 'ok', i: 'check', t: `เข้างาน ${fmtTime(last.at, S.tz)} · ตรงเวลา` };
      return late <= g ? { c: 'warn', i: 'clock', t: `เข้างาน ${fmtTime(last.at, S.tz)} · สาย ${late} นาที (ในเกณฑ์)` } : { c: 'alert', i: 'clock-alert', t: `เข้างาน ${fmtTime(last.at, S.tz)} · สาย ${late} นาที (เกินเกณฑ์)` };
    }
    if (M(s.member_id)?.clock_free) return { c: 'ok', i: 'user-check', t: 'ไม่ต้องลงเวลา' };
    if (s.work_date > today() || N < st) return { c: 'wait', i: 'clock', t: `เริ่ม ${t5(s.start_time)}` };
    if (N - st <= g) return { c: 'wait', i: 'hourglass', t: `ยังไม่เข้า · ผ่อนผันถึง ${hm(st + g)}` };
    if (N > mins(s.end_time)) return { c: 'alert', i: 'circle-alert', t: 'ไม่ได้ลงเวลา' };
    return { c: 'warn', i: 'triangle-alert', t: `ยังไม่เข้า · เลยมา ${N - st - g} นาที`, warn: true };
  }

  function layer(html) { $layer.innerHTML = html; icons(); }
  function closeLayer() { $layer.innerHTML = ''; }
  function sheet(title, body) { layer(`<div class="sheet-bg" data-act="bgClose"><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="between"><h2>${esc(title)}</h2><button class="btn ghost" data-act="close" aria-label="ปิด">${ic('x')}</button></div>${body}</div></div>`); }
  function loading(msg) { $top.hidden = true; $nav.hidden = true; $main.className = 'main narrow'; $main.innerHTML = `<div class="empty" style="min-height:70vh;justify-content:center"><svg style="width:64px;height:64px"><use href="#logo"/></svg><div class="spinner"></div><span>${esc(msg)}</span></div>`; }
  function fatal(msg) { $top.hidden = true; $nav.hidden = true; $main.className = 'main narrow'; $main.innerHTML = `<div class="card" style="margin-top:20vh;text-align:center;align-items:center"><span class="icon-chip t-coral">${ic('circle-alert')}</span><h2>เปิดแอปไม่สำเร็จ</h2><p class="muted">${esc(msg)}</p><button class="btn primary" onclick="location.reload()">${ic('rotate-cw')}ลองใหม่</button></div>`; icons(); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว'); }
    catch (_) { sheet('คัดลอกข้อความนี้', `<textarea class="field" style="width:100%;min-height:120px;padding:10px;border-radius:12px;border:1.5px solid var(--line)" readonly onclick="this.select()">${esc(text)}</textarea>`); }
  }
  const val = (id) => (document.getElementById(id) || {}).value;

  // ---------- boot / login ----------
  async function boot() {
    loading('กำลังเปิด PharmaShift…');
    if (!CFG.SUPABASE_ANON_KEY || CFG.SUPABASE_ANON_KEY.startsWith('วาง')) return fatal('ยังไม่ได้ใส่ anon key ในไฟล์ config.js');
    try { await liff.init({ liffId: CFG.LIFF_ID }); } catch (e) { return fatal('เชื่อมต่อ LINE ไม่สำเร็จ: ' + errMsg(e)); }
    if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
    const params = new URLSearchParams(location.search);
    const ps = params.get('ps');
    if (ps && ps.startsWith('PS1|')) S.pendingPS = ps;
    if (params.has('ps')) { params.delete('ps'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); }
    const idt = liff.getDecodedIDToken() || {};
    S.profile = { name: idt.name || '', picture: idt.picture || '', sub: idt.sub };
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session || session.user?.user_metadata?.line_sub !== idt.sub) await lineLogin();
      sessionStorage.removeItem('ps_relogin');
      await loadOrgs();
    } catch (e) { if (e.message !== 'relogin') fatal(errMsg(e)); }
  }
  async function lineLogin() {
    const r = await fetch(CFG.SUPABASE_URL + '/functions/v1/line-login', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY }, body: JSON.stringify({ idToken: liff.getIDToken() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && !sessionStorage.getItem('ps_relogin')) { sessionStorage.setItem('ps_relogin', '1'); liff.logout(); liff.login({ redirectUri: location.href }); throw new Error('relogin'); }
      throw new Error((j.error || 'เข้าสู่ระบบไม่สำเร็จ') + (r.status === 401 ? ' (ตรวจ LINE_CHANNEL_ID ใน Supabase ว่าตรงกับ Channel ID)' : ''));
    }
    const { error } = await sb.auth.setSession({ access_token: j.session.access_token, refresh_token: j.session.refresh_token });
    if (error) throw error;
  }
  async function loadOrgs(pick) {
    S.orgs = await rpc('my_orgs');
    if (!S.orgs.length) return renderOnboard();
    if (pick) localStorage.setItem('ps_org', pick);
    const saved = localStorage.getItem('ps_org');
    S.me = S.orgs.find((o) => o.org_id === saved) || S.orgs[0];
    S.isOwner = ['owner', 'manager'].includes(S.me.role);
    S.org = await q(sb.from('orgs').select('*').eq('id', S.me.org_id).single());
    S.tz = S.org.timezone || 'Asia/Bangkok';
    S.month = today().slice(0, 7); S.sel = today(); S.tab = S.tab && S.tab !== 'onboard' ? S.tab : 'home';
    await loadData();
    try { subscribeRealtime(); } catch (_) {}
    if (S.isFriend == null && S.app && S.app.line_oa_id) { try { S.isFriend = (await liff.getFriendship()).friendFlag; } catch (_) { S.isFriend = null; } }
    render();
    if (S.pendingPS) { const p = S.pendingPS; S.pendingPS = null; handlePS(p); }
  }

  async function loadData() {
    const o = S.me.org_id, [a, b] = monthRange(S.month), t = today();
    const from = a < t ? a : t, to = b > addDays(t, 31) ? b : addDays(t, 31);
    const since = new Date(Date.now() - 20 * 3600e3).toISOString();
    const base = [
      sb.from('branches').select('*').eq('org_id', o).order('created_at'),
      sb.from('members').select('*').eq('org_id', o).order('created_at'),
      sb.from('shifts').select('*').eq('org_id', o).gte('work_date', from).lte('work_date', to).order('work_date').order('start_time'),
      sb.from('open_shifts').select('*').eq('org_id', o).eq('status', 'open').gte('work_date', from).lte('work_date', to).order('work_date'),
      sb.from('attendance').select('*').eq('member_id', S.me.member_id).order('at', { ascending: false }).limit(1),
      sb.from('member_pay').select('*'),
      sb.from('availability').select('*').gte('work_date', from).lte('work_date', to),
      sb.from('handover_notes').select('*').eq('org_id', o).order('created_at', { ascending: false }).limit(20),
    ];
    const extra = S.isOwner ? [
      sb.from('attendance').select('*').eq('org_id', o).gte('at', since).order('at'),
      sb.from('member_invites').select('*'),
      sb.from('shift_claims').select('*, open_shifts!inner(*)').eq('status', 'pending').eq('open_shifts.org_id', o).order('created_at'),
      sb.from('leave_requests').select('*').eq('org_id', o).eq('status', 'pending').order('created_at'),
      sb.from('attendance_fixes').select('*').eq('org_id', o).eq('status', 'pending').order('created_at'),
      sb.rpc('pending_ot', { p_org: o }),
    ] : [
      Promise.resolve({ data: [] }), Promise.resolve({ data: [] }),
      sb.from('shift_claims').select('*, open_shifts(*)').eq('member_id', S.me.member_id).order('created_at', { ascending: false }),
      sb.from('leave_requests').select('*').eq('member_id', S.me.member_id).order('created_at', { ascending: false }),
      sb.from('attendance_fixes').select('*').eq('member_id', S.me.member_id).order('created_at', { ascending: false }).limit(10),
      Promise.resolve({ data: [] }),
    ];
    const res = await Promise.all([...base, ...extra].map((p) => q(p)));
    [S.branches, S.members, S.shifts, S.open] = res;
    S.myLast = res[4][0] || null;
    S.pay = Object.fromEntries(res[5].map((p) => [p.member_id, Number(p.hourly_rate)]));
    const ids = new Set(S.members.map((m) => m.id));
    S.avail = res[6].filter((x) => ids.has(x.member_id));
    S.handover = res[7];
    S.att = res[8]; S.invites = Object.fromEntries(res[9].map((i) => [i.member_id, i.code]));
    S.claims = res[10]; S.leaves = res[11]; S.fixes = res[12]; S.ot = res[13] || [];
    try { S.swaps = await q(sb.from('shift_swaps').select('*').eq('org_id', o).gte('created_at', new Date(Date.now() - 45 * 86400e3).toISOString()).order('created_at', { ascending: false })); } catch (_) { S.swaps = []; }
    try { S.marks = await q(sb.from('day_marks').select('*').eq('org_id', o).gte('work_date', from).lte('work_date', to)); } catch (_) { S.marks = []; }
    try { const y = t.slice(0, 4); S.yearMarks = await q(sb.from('day_marks').select('member_id,kind,days,work_date').eq('org_id', o).gte('work_date', y + '-01-01').lte('work_date', y + '-12-31')); } catch (_) { S.yearMarks = []; }
    try { S.sreqs = await q(S.isOwner ? sb.from('shift_requests').select('*').eq('org_id', o).eq('status', 'pending').order('work_date') : sb.from('shift_requests').select('*').eq('member_id', S.me.member_id).gte('created_at', new Date(Date.now() - 45 * 86400e3).toISOString()).order('created_at', { ascending: false })); } catch (_) { S.sreqs = []; }
    try { const ws = addDays(t, -dow(t)); S.myAtt = await q(sb.from('attendance').select('kind,at,branch_id').eq('member_id', S.me.member_id).gte('at', new Date(new Date(ws + 'T00:00:00+07:00').getTime() - 864e5).toISOString()).order('at')); } catch (_) { S.myAtt = []; }
    if (S.app == null) { try { S.app = await rpc('app_public'); } catch (_) { S.app = {}; } }
  }
  const PEND = (w) => w.status === 'pending_peer' || w.status === 'pending_owner';
  const ownerSreqs = () => S.isOwner ? (S.sreqs || []).filter((r) => r.status === 'pending') : [];
  const ownerSwaps = () => (S.swaps || []).filter((w) => w.status === 'pending_owner');
  const swapLine = (w) => { const a = S.shifts.find((x) => x.id === w.shift_id), b = S.shifts.find((x) => x.id === w.to_shift_id), fm = M(w.from_member), tm = M(w.to_member);
    const sh = (x) => x ? `${dShort(x.work_date)} ${t5(x.start_time)}–${t5(x.end_time)} · ${esc(B(x.branch_id).name)}` : 'เวร';
    return `<span class="small">${esc(fm.display_name)}: ${sh(a)}</span><br><span class="small">${w.to_shift_id ? `⇄ ${esc(tm.display_name)}: ${sh(b)}` : `→ ยกให้ ${esc(tm.display_name)}`}</span>${w.note ? `<br><span class="small muted">หมายเหตุ: ${esc(w.note)}</span>` : ''}`; };
  function setupSteps() {
    const ls = (k) => { try { return localStorage.getItem(k + S.me.org_id) === '1'; } catch (_) { return false; } };
    const staff = S.members.filter((m) => m.active && m.role !== 'owner');
    const steps = [
      ['เพิ่มสาขาแรก', S.branches.length > 0, 'branch'],
      ['ตั้งตำแหน่งร้านทุกสาขา (กดตอนอยู่ที่ร้าน)', S.branches.length > 0 && S.branches.every((b) => b.lat != null), 'branch'],
      ['ตั้งเวรสำเร็จรูปของร้าน', ls('ps_presets_ok_') || JSON.stringify(presets()) !== JSON.stringify(DEF_PRESETS), 'preset'],
      ['เพิ่มพนักงานและส่งรหัสเชิญ', staff.length > 0, 'staff'],
      ['พนักงานเข้าร่วมด้วย LINE ครบ', staff.length > 0 && staff.every((m) => m.user_id || m.clock_free), 'staff'],
      ['จับคู่จอ QR ที่ร้าน หรือปริ้น QR ติดผนัง', ls('ps_kiosk_ok_') || S.branches.some((b) => b.allow_static), 'branch'],
      ['ลงเวรเดือนนี้', S.shifts.length > 0, null],
    ];
    if (S.app && S.app.line_oa_id) steps.push(['เพิ่มเพื่อน LINE ของระบบเพื่อรับแจ้งเตือน', S.isFriend !== false, 'friend']);
    return steps;
  }
  function setupCard(inSettings) {
    if (!S.isOwner) return '';
    const st = setupSteps(), done = st.filter((x) => x[1]).length;
    let hidden = false; try { hidden = localStorage.getItem('ps_setup_hide_' + S.me.org_id) === '1'; } catch (_) {}
    if (done === st.length || (hidden && !inSettings)) return '';
    return `<div class="card setup"><div class="between"><div><h3>ตั้งร้านให้พร้อมใช้</h3><span class="small muted">เสร็จแล้ว ${done} จาก ${st.length} ขั้น</span></div>${inSettings ? '' : `<button class="btn ghost" data-act="dismissSetup">ซ่อน</button>`}</div>
      <div class="hbar"><i style="width:${done / st.length * 100}%"></i></div>
      ${st.map(([t, ok, sec], i) => `<div class="step ${ok ? 'ok' : ''}"><span class="dot">${ok ? ic('check') : i + 1}</span><span class="grow small">${t}</span>${ok ? '' : sec === 'friend' ? `<a class="btn" href="https://line.me/R/ti/p/${encodeURIComponent(S.app.line_oa_id)}" target="_blank" rel="noopener">เพิ่มเพื่อน</a>` : sec ? `<button class="btn" data-act="tab" data-tab="set" data-sec="${sec}">ไปทำ</button>` : `<button class="btn" data-act="tab" data-tab="cal">ไปทำ</button>`}</div>`).join('')}</div>`;
  }
  function swapCards() {
    let h = '';
    for (const w of (S.swaps || []).filter((x) => x.status === 'pending_peer' && x.to_member === S.me.member_id)) h += `<div class="card" style="border:1.5px solid var(--brand)"><div class="row"><span class="icon-chip t-lilac">${ic('repeat')}</span><div class="grow"><b>${esc(M(w.from_member).display_name)} ขอ${w.to_shift_id ? 'แลก' : 'ยก'}เวรให้คุณ</b><br>${swapLine(w)}</div></div><div class="row"><button class="btn primary" data-act="respondSwap" data-id="${w.id}" data-ok="1">${ic('check')}ตกลง</button><button class="btn" data-act="respondSwap" data-id="${w.id}" data-ok="0">ไม่สะดวก</button></div><span class="tiny muted">ตกลงแล้วต้องรอเจ้าของร้านอนุมัติอีกครั้ง</span></div>`;
    for (const w of (S.swaps || []).filter((x) => x.from_member === S.me.member_id && PEND(x))) h += `<div class="card" style="flex-direction:row;align-items:center"><span class="icon-chip t-lilac">${ic('repeat')}</span><span class="grow small"><b>${w.status === 'pending_peer' ? `รอ ${esc(M(w.to_member).display_name)} ตอบ` : 'รอเจ้าของร้านอนุมัติ'}</b><br>${swapLine(w)}</span><button class="btn ghost" data-act="cancelSwap" data-id="${w.id}">ยกเลิก</button></div>`;
    return h;
  }
  function friendBanner() {
    const id = (S.app && S.app.line_oa_id) || ''; if (!id || S.isFriend !== false) return '';
    return `<a class="card" href="https://line.me/R/ti/p/${encodeURIComponent(id)}" target="_blank" rel="noopener" style="flex-direction:row;align-items:center;text-decoration:none;color:inherit;border:1.5px solid var(--brand)"><span class="icon-chip t-brand">${ic('bell-ring')}</span><span class="grow small"><b>เพิ่มเพื่อน PharmaShift ใน LINE</b><br>เพื่อรับแจ้งเตือนเวร คำขอ และสลิปค่าจ้าง</span>${ic('chevron-right')}</a>`;
  }
  async function refresh() { try { await loadData(); render(); } catch (e) { toast(errMsg(e), 'err'); } }

  // ---------- frame ----------
  function tabsFor() {
    if (S.isOwner) {
      const pend = S.claims.length + S.leaves.length + S.fixes.length + S.ot.length + ownerSwaps().length + ownerSreqs().length;
      return [['home', 'layout-dashboard', 'ภาพรวม'], ['cal', 'calendar-days', 'ปฏิทิน'], ['req', 'bell', 'คำขอ', pend], ['pay', 'wallet', 'ค่าจ้าง'], ['set', 'settings', 'ตั้งค่า']];
    }
    const me = M(S.me.member_id), t = [['home', 'house', 'หน้าแรก'], ['cal', 'calendar-days', 'ปฏิทิน'], ['req', 'inbox', 'คำขอ', (S.swaps || []).filter((w) => w.status === 'pending_peer' && w.to_member === S.me.member_id).length]];
    if (isPharm(me)) t.push(['open', 'megaphone', 'เวรว่าง', openForMe().filter((o) => !myClaim(o.id)).length]);
    if (me.employment === 'parttime') t.push(['money', 'wallet', 'รายได้']);
    return t;
  }
  function render() {
    const tabs = tabsFor();
    if (!tabs.some((t) => t[0] === S.tab)) S.tab = 'home';
    $top.hidden = false; $nav.hidden = false;
    $top.innerHTML = `<svg class="logo"><use href="#logo"/></svg><div class="name"><b>${esc(S.me.org_name)}</b><span>${esc(S.me.display_name)} · ${esc(ROLE[S.me.role] || '')}</span></div><button class="btn ghost" data-act="menu" aria-label="เมนูบัญชี" style="padding:4px;border-radius:50%">${avatar(S.me.display_name, M(S.me.member_id).color, 'sm', S.profile.picture)}</button>`;
    $nav.innerHTML = `<div class="in">${tabs.map((t) => `<button data-act="tab" data-tab="${t[0]}" aria-current="${S.tab === t[0]}">${ic(t[1])}${t[2]}${t[3] ? `<span class="badge">${t[3]}</span>` : ''}</button>`).join('')}</div>`;
    const views = S.isOwner ? { home: ownerHome, cal: ownerCal, req: ownerReq, pay: ownerPay, set: ownerSet } : { home: staffHome, cal: staffCal, req: staffReq, open: staffOpen, money: staffMoney };
    $main.className = 'main' + (S.isOwner && ['cal', 'set', 'pay', 'home'].includes(S.tab) ? '' : ' narrow');
    $main.innerHTML = views[S.tab]();
    if (S.tab === 'set' && S.setSec) $main.querySelectorAll('[data-sec]').forEach((el) => { el.hidden = el.dataset.sec !== S.setSec; });
    icons();
    if (S.tab === 'pay' && S.payView === 'report') loadReport(); else if (S.tab === 'pay' || S.tab === 'money') loadHours();
  }

  // ---------- onboarding ----------
  function renderOnboard() {
    $top.hidden = true; $nav.hidden = true; $main.className = 'main narrow';
    $main.innerHTML = `
      <div class="hello" style="margin-top:12px"><div class="stack"><svg style="width:52px;height:52px"><use href="#logo"/></svg><h1>ยินดีต้อนรับสู่ PharmaShift</h1><p class="muted">ลงเวร ลงเวลา ร้านยา ง่ายในไม่กี่แตะ</p></div></div>
      <div class="card"><div class="row"><span class="icon-chip t-brand">${ic('ticket')}</span><h2>มีรหัสเชิญจากร้าน</h2></div>
        <p class="small muted">เจ้าของร้านจะส่งรหัส 8 ตัวให้ ใส่ครั้งเดียวจบ</p>
        <label class="field">รหัสเชิญ<input id="inv" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="เช่น 7F3K9QAB"></label>
        <button class="btn primary block" data-act="acceptInvite">${ic('log-in')}เข้าร่วมร้าน</button></div>
      <div class="card"><div class="row"><span class="icon-chip t-sun">${ic('store')}</span><h2>เปิดร้านใหม่</h2></div>
        <p class="small muted">สำหรับเจ้าของร้าน คุณจะเป็นผู้ดูแลร้านนี้ และเพิ่มสาขากับพนักงานได้ทีหลัง</p>
        <label class="field">ชื่อร้าน<input id="orgName" placeholder="เช่น FIT & PHARM"></label>
        <label class="field">ชื่อที่แสดงของคุณ<input id="ownerName" value="${esc(S.profile.name)}"></label>
        <button class="btn block" data-act="createOrg">${ic('plus')}สร้างร้าน</button></div>`;
    icons();
  }

  // ---------- OWNER: home ----------
  function ownerHome() {
    const t = today(), la = lastAtt();
    const opens = S.branches.filter((b) => b.active);
    const o = opens.length ? opens.map((b) => t5(b.open_time)).sort()[0] : '09:00', c = opens.length ? opens.map((b) => t5(b.close_time)).sort().slice(-1)[0] : '21:00';
    const pend = S.claims.length + S.leaves.length + S.fixes.length + S.ot.length + ownerSwaps().length + ownerSreqs().length, fo = S.open.filter((x) => x.work_date >= t).length;
    let h = `<div class="hello"><div class="stack"><h1>${greet(S.tz)}ครับ</h1><p class="muted">${dLong(t)}</p></div><div class="arcbox">${dayArc(o, c, S.tz)}</div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <button class="card" data-act="tab" data-tab="cal" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-coral">${ic('calendar-x')}</span><span><b style="font:500 24px var(--display)">${fo}</b><br><span class="small muted">เวรว่างที่ยังไม่มีคนรับ</span></span></button>
        <button class="card" data-act="tab" data-tab="req" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-sun">${ic('bell-ring')}</span><span><b style="font:500 24px var(--display)">${pend}</b><br><span class="small muted">คำขอรออนุมัติ</span></span></button>
        <button class="card" data-act="tab" data-tab="set" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-lilac">${ic('users')}</span><span><b style="font:500 24px var(--display)">${S.members.filter((m) => m.active).length}</b><br><span class="small muted">คนในร้าน</span></span></button>
      </div>` + setupCard() + issueCard() + friendBanner() + swapCards();
    if (!S.branches.length) return h + `<div class="card" style="align-items:flex-start"><span class="icon-chip t-brand">${ic('map-pin')}</span><h2>เริ่มจากเพิ่มสาขาแรก</h2><p class="muted">ใส่ชื่อสาขาและเวลาเปิด–ปิด แล้วเพิ่มพนักงาน</p><button class="btn primary" data-act="tab" data-tab="set">${ic('settings')}ไปที่ตั้งค่าร้าน</button></div>`;
    h += `<div class="card"><div class="card-head"><div class="row"><span class="icon-chip t-brand">${ic('store')}</span><h2>ตอนนี้ที่ร้าน</h2></div><button class="btn ghost" data-act="refresh">${ic('rotate-cw')}รีเฟรช</button></div><div class="grid">`;
    for (const br of opens) {
      const N = nowMins(S.tz), isOpen = N >= mins(br.open_time) && N < mins(br.close_time);
      const sch = S.shifts.filter((s) => s.work_date === t && s.branch_id === br.id);
      const present = Object.values(la).filter((a) => a.branch_id === br.id && inNow(a) && !sch.some((s) => s.member_id === a.member_id));
      let rows = sch.map((s) => { const st = statusOf(s, la[s.member_id]); const m = M(s.member_id); return `<div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)}</b><br><span class="tiny muted">${esc(ROLE[m.role])} · ${t5(s.start_time)}–${t5(s.end_time)}</span></div><span class="pill ${st.c}">${ic(st.i)}${st.t}</span></div>${geoFlag(la[s.member_id])}`; }).join('');
      rows += present.map((a) => { const m = M(a.member_id); return `<div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)}</b><br><span class="tiny muted">${esc(ROLE[m.role])} · ไม่มีเวรในตาราง</span></div><span class="pill ok">${ic('check')}เข้างาน ${fmtTime(a.at, S.tz)}</span></div>${geoFlag(a)}`; }).join('');
      if (!rows) rows = `<p class="small muted">วันนี้ยังไม่มีเวรในตาราง</p>`;
      h += `<div class="card" style="box-shadow:none;border:1.5px solid var(--line)"><div class="row"><div class="grow"><h3>${esc(br.name)}</h3><span class="tiny muted">${t5(br.open_time)}–${t5(br.close_time)}</span></div><span class="open-badge ${isOpen ? '' : 'closed'}">${isOpen ? '<span class="pulse"></span>เปิดอยู่' : 'ปิดอยู่'}</span></div>${ribbon(br.open_time, br.close_time, S.tz)}${rows}</div>`;
    }
    return h + `</div></div>`;
  }

  // ---------- OWNER: calendar ----------
  function monthNav() {
    return `<div class="row"><button class="btn ghost" data-act="month" data-n="-1" aria-label="เดือนก่อน">${ic('chevron-left')}</button><h2 style="min-width:150px;text-align:center">${monthLabel(S.month)}</h2><button class="btn ghost" data-act="month" data-n="1" aria-label="เดือนถัดไป">${ic('chevron-right')}</button></div>`;
  }
  function agenda(owner) {
    const ws = addDays(S.sel, -dow(S.sel)), t = today(), me = M(S.me.member_id), fb = S.filter || '0';
    const ptLimited = !owner && me.employment === 'parttime' && !S.org.pt_see_all;
    let h = `<div class="card-head"><div class="row"><button class="btn ghost" data-act="week" data-n="-7" aria-label="สัปดาห์ก่อน">${ic('chevron-left')}</button><b style="min-width:150px;text-align:center">${dShort(ws)} – ${dShort(addDays(ws, 6))}</b><button class="btn ghost" data-act="week" data-n="7" aria-label="สัปดาห์ถัดไป">${ic('chevron-right')}</button></div>${owner ? `<select id="filter" data-change="filter" aria-label="เลือกสาขา"><option value="0">ทุกสาขา</option>${S.branches.map((br) => `<option value="${br.id}" ${fb === br.id ? 'selected' : ''}>${esc(br.name)}</option>`).join('')}</select>` : ''}</div><div class="agenda">`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      let ss = S.shifts.filter((x) => x.work_date === d && (fb === '0' || !owner || x.branch_id === fb));
      if (ptLimited) ss = ss.filter((x) => x.member_id === S.me.member_id);
      const os = S.open.filter((x) => x.work_date === d && (fb === '0' || !owner || x.branch_id === fb) && (owner || canBranch(me, x.branch_id)));
      const tot = ss.reduce((a, s) => a + mins(s.end_time) - mins(s.start_time), 0);
      h += `<div class="dh ${d === t ? 'today' : ''}"><span>${dLong(d)}</span><span class="tiny">${ss.length ? `${ss.length} คน · ${Math.round(tot / 6) / 10} ชม.` : ''}</span></div>`;
      const rows = [...ss.map((s) => ({ s, k: mins(s.start_time) })), ...os.map((o) => ({ o, k: mins(o.start_time) }))].sort((a, b) => a.k - b.k);
      const dm = (S.marks || []).filter((x) => x.work_date === d && (!ptLimited || x.member_id === S.me.member_id));
      if (!rows.length && !dm.length) h += `<div class="empty-day">ไม่มีเวร</div>`;
      if (dm.length) h += `<div class="empty-day">${ic('calendar-off')} ${dm.map((x) => `${esc(M(x.member_id).display_name)} · ${MARK[x.kind]}${Number(x.days) === 0.5 ? ' ครึ่งวัน' : ''}`).join(' · ')}</div>`;
      for (const r of rows) {
        if (r.o) { const o = r.o; h += `<button class="it" data-act="${owner ? 'editOpen' : 'pick'}" data-id="${o.id}" data-d="${d}"><span class="tm">${t5(o.start_time)}<br><span>${t5(o.end_time)}</span></span><span class="bar dash"></span><span class="who"><b style="color:var(--coral-deep)">เวรว่าง</b><span>${esc(B(o.branch_id).name)}${o.reason ? ' · ' + esc(o.reason) : ''}</span></span><span class="pill alert">${ic('megaphone')}รอคนรับ</span></button>`; continue; }
        const s = r.s, m = M(s.member_id), lv = S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending');
        let tag = '';
        if (lv) tag = `<span class="pill warn">${ic('plane')}ขอลา</span>`;
        else if (owner && d === t && S.att) { const st = statusOf(s, lastAtt()[s.member_id]); tag = `<span class="pill ${st.c}">${ic(st.i)}${st.t.replace(/^เข้างาน \d\d:\d\d · /, '')}</span>`; }
        else if (m.employment === 'fulltime' && s.paid) tag = `<span class="pill ok">เวรพิเศษ</span>`;
        h += `<button class="it" data-act="${owner && d >= t ? 'editShift' : 'pick'}" data-id="${s.id}" data-d="${d}"><span class="tm">${t5(s.start_time)}<br><span>${t5(s.end_time)}</span></span><span class="bar" style="background:var(--${tone(m.color)})"></span><span class="who"><b>${esc(m.display_name)}</b><span>${esc(B(s.branch_id).name)} · ${esc(ROLE[m.role] || '')}${s.note ? ' · ' + esc(s.note) : ''}</span></span>${tag}</button>`;
      }
    }
    return h + `</div>${owner ? '<p class="tiny muted">แตะเวรเพื่อแก้ไข · แตะเวรว่างเพื่อย้ายสาขาหรือมอบให้คน</p>' : ''}`;
  }
  const viewSeg = () => `<div class="seg" style="max-width:${S.isOwner ? 460 : 320}px"><button data-act="calView" data-v="month" aria-pressed="${!S.calView || S.calView === 'month'}">${ic('calendar-days')}รายเดือน</button><button data-act="calView" data-v="list" aria-pressed="${S.calView === 'list'}">${ic('list')}รายสัปดาห์</button>${S.isOwner ? `<button data-act="calView" data-v="grid" aria-pressed="${S.calView === 'grid'}">${ic('table-2')}ตารางแบบชีต</button>` : ''}</div>`;
  // ---------- ตารางแบบชีต (แถว = คน, คอลัมน์ = วัน) ----------
  function brushList() {
    const out = [], brs = S.branches.filter((b) => b.active);
    for (const p of presets()) for (const b of brs) out.push({ k: 's:' + p.code + ':' + b.id, type: 'shift', label: p.code + (brs.length > 1 ? ' · ' + shortB(b.id) : ''), sub: p.start + '–' + p.end, p, b });
    for (const k of Object.keys(MARK)) out.push({ k: 'm:' + k, type: 'mark', label: MARK_S[k], sub: MARK[k], kind: k });
    out.push({ k: 'clear', type: 'clear', label: 'ล้างช่อง', sub: 'ลบเวรหรือวันหยุด' });
    return out;
  }
  function gridView() {
    const [a, b] = monthRange(S.month), t = today(), nw = narrow(), ws = addDays(S.sel, -dow(S.sel));
    const days = []; if (nw) for (let i = 0; i < 7; i++) days.push(addDays(ws, i)); else for (let d = a; d <= b; d = addDays(d, 1)) days.push(d);
    const order = { fulltime: 0, parttime: 1, owner: 2 };
    const people = S.members.filter((m) => m.active && (m.role !== 'owner' || S.shifts.some((x) => x.member_id === m.id))).sort((x, y) => (order[x.employment] ?? 1) - (order[y.employment] ?? 1));
    const brs = S.branches.filter((x) => x.active);
    const bl = brushList(), cur = S.brush;
    const ISS = scheduleIssues(days[0], days[days.length - 1]), issD = new Set(ISS.filter((x) => x.sev === 'alert').map((x) => x.d)), issC = new Set(ISS.filter((x) => x.m).map((x) => x.m + x.d));
    let h = `<div class="card"><div class="card-head">${nw ? `<div class="row"><button class="btn ghost" data-act="week" data-n="-7" aria-label="สัปดาห์ก่อน">${ic('chevron-left')}</button><b>${dShort(ws)} – ${dShort(addDays(ws, 6))}</b><button class="btn ghost" data-act="week" data-n="7" aria-label="สัปดาห์ถัดไป">${ic('chevron-right')}</button></div>` : monthNav()}<span class="small muted">${cur ? 'โหมดลงเร็ว: แตะช่องไหนก็ลงทันที' : 'แตะช่องเพื่อเลือกเวร · หรือเลือกแบบด้านล่างแล้วแตะหลายช่องต่อกัน'}</span></div>
      <div class="brushes"><span class="tiny muted">ลงเร็ว:</span>${bl.map((x) => `<button data-act="brush" data-k="${x.k}" aria-pressed="${cur === x.k}" title="${esc(x.sub)}">${esc(x.label)}</button>`).join('')}${cur ? `<button data-act="brush" data-k="" style="border-color:var(--coral)">${ic('x')}เลิกลงเร็ว</button>` : ''}</div>
      ${ISS.length ? `<button class="iss-bar ${issD.size ? 'alert' : 'warn'}" data-act="issuesAll" data-a="${days[0]}" data-b="${days[days.length - 1]}">${ic('shield-alert')}<span class="grow">พบ ${ISS.length} จุดที่ควรตรวจในช่วงนี้${issD.size ? ` · วันที่มีจุดแดงต้องแก้` : ''}</span>${ic('chevron-right')}</button>` : (S.shifts.length ? `<div class="iss-bar ok">${ic('shield-check')}<span>ตารางช่วงนี้เรียบร้อย</span></div>` : '')}
      <div class="gridwrap" id="gw"><table class="sheetg"><thead><tr><th class="nm">ชื่อ</th>${days.map((d) => `<th class="${dow(d) === 0 || dow(d) === 6 ? 'we' : ''} ${d === t ? 'td' : ''} ${issD.has(d) ? 'issd' : ''}">${Number(d.slice(8))}<br><span class="tiny">${DOW[dow(d)].replace('.', '')}</span></th>`).join('')}${brs.length > 1 ? brs.map((x) => `<th title="${esc(x.name)}">${esc(shortB(x.id))}</th>`).join('') : '<th>เวร</th>'}<th>ชม.</th><th>หยุด</th><th>ลา</th></tr></thead><tbody>`;
    for (const m of people) {
      let row = `<tr><td class="nm" title="${esc(m.display_name)}">${esc(m.display_name)}<small>${esc(EMP[m.employment] || '')}</small></td>`, cnt = {}, hrs = 0, off = 0, lv = 0;
      for (const d of days) {
        const ss = S.shifts.filter((x) => x.member_id === m.id && x.work_date === d), mk = markOf(m.id, d);
        const lvq = ss.some((s) => S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending'));
        const rq = (S.sreqs || []).some((r) => r.member_id === m.id && r.work_date === d && r.status === 'pending');
        let lab = '', cls = '';
        if (ss.length) { lab = ss.map((x) => `<b>${esc(shiftName(x))}</b>${multiB() ? `<span>${esc(shortB(x.branch_id))}</span>` : ''}`).join(''); cls = 'b' + bIdx(ss[0].branch_id); ss.forEach((s) => { cnt[s.branch_id] = (cnt[s.branch_id] || 0) + 1; hrs += (mins(s.end_time) - mins(s.start_time)) / 60; }); }
        else if (mk) { lab = `<b>${MARK_S[mk.kind]}</b>${Number(mk.days) === 0.5 ? '<span>ครึ่งวัน</span>' : ''}`; cls = 'k-' + mk.kind; if (mk.kind === 'OFF') off++; else lv += Number(mk.days); }
        else if (rq) lab = '?';
        row += `<td><button class="gc ${cls} ${lvq ? 'lv' : ''} ${rq ? 'rq' : ''} ${issC.has(m.id + d) ? 'iss' : ''}" data-act="gridCell" data-m="${m.id}" data-d="${d}" aria-label="${esc(m.display_name)} ${dShort(d)}">${lab}</button></td>`;
      }
      row += (brs.length > 1 ? brs.map((x) => `<td class="sum">${cnt[x.id] || ''}</td>`).join('') : `<td class="sum">${Object.values(cnt).reduce((a2, v) => a2 + v, 0) || ''}</td>`) + `<td class="sum">${hrs ? Math.round(hrs) : ''}</td><td class="sum">${off || ''}</td><td class="sum">${lv || ''}</td></tr>`;
      h += row;
    }
    h += `<tr class="openrow"><td class="nm" style="background:var(--coral-soft)">เวรว่าง</td>${days.map((d) => { const n = S.open.filter((o) => o.work_date === d).length; return `<td>${n ? `<button class="gc" style="color:var(--coral-deep)" data-act="pick" data-d="${d}" data-v="month">${n}</button>` : ''}</td>`; }).join('')}<td colspan="${(brs.length > 1 ? brs.length : 1) + 3}"></td></tr>`;
    h += `</tbody></table></div>
      ${help(`แตะช่องเพื่อเลือกเวร วันหยุด หรือวันลา · ลงหลายช่องเร็วๆ: เลือกแบบในแถว "ลงเร็ว" แล้วแตะช่องต่อกัน · สีช่องแยกตามสาขา · กรอบเหลือง = มีคำขอลารออนุมัติ · ? = มีคนขอลงเวรรออนุมัติ · เวรสำเร็จรูป: ${presets().map((p) => `${esc(p.code)} ${p.start}–${p.end}`).join(', ')} (แก้ได้ที่ ตั้งค่า → เวรสำเร็จรูป)`)}</div>`;
    return h;
  }
  async function applyCell(k, mid, d) {
    const bl = brushList().find((x) => x.k === k); if (!bl) return;
    const ss = S.shifts.filter((x) => x.member_id === mid && x.work_date === d), mk = markOf(mid, d);
    try {
      if (bl.type === 'shift') {
        const row = { branch_id: bl.b.id, start_time: bl.p.start, end_time: bl.p.end };
        if (ss.length) { await q(sb.from('shifts').update(row).eq('id', ss[0].id)); Object.assign(ss[0], row, { start_time: row.start_time + ':00', end_time: row.end_time + ':00' }); }
        else { const n = await q(sb.from('shifts').insert({ ...row, org_id: S.me.org_id, member_id: mid, work_date: d }).select('*').single()); S.shifts.push(n); }
        if (mk) { await q(sb.from('day_marks').delete().eq('id', mk.id)); S.marks = S.marks.filter((x) => x.id !== mk.id); }
      } else {
        if (ss.length) { await q(sb.from('shifts').delete().in('id', ss.map((x) => x.id))); S.shifts = S.shifts.filter((x) => !ss.includes(x)); }
        if (bl.type === 'mark') {
          const n = await q(sb.from('day_marks').upsert({ org_id: S.me.org_id, member_id: mid, work_date: d, kind: bl.kind, days: 1 }, { onConflict: 'member_id,work_date' }).select('*').single());
          S.marks = (S.marks || []).filter((x) => !(x.member_id === mid && x.work_date === d)); S.marks.push(n);
        } else if (mk) { await q(sb.from('day_marks').delete().eq('id', mk.id)); S.marks = S.marks.filter((x) => x.id !== mk.id); }
      }
    } catch (e) { toast(errMsg(e), 'err'); await refresh(); return; }
    const gw = document.getElementById('gw'), sx = gw ? gw.scrollLeft : 0, sy = gw ? gw.scrollTop : 0, wy = window.scrollY;
    render(); const g2 = document.getElementById('gw'); if (g2) { g2.scrollLeft = sx; g2.scrollTop = sy; } window.scrollTo(0, wy);
    const nw2 = scheduleIssues(d, d).filter((x) => x.m === mid || x.k === 'cover').concat(scheduleIssues(addDays(d, -6), addDays(d, 6), mid).filter((x) => x.k === 'week' || x.k === 'streak'));
    if (nw2.length) toast('⚠ ' + nw2[0].text, nw2[0].sev === 'alert' ? 'err' : undefined);
  }
  function ownerCal() {
    if (S.calView === 'list') return viewSeg() + `<div class="card">${agenda(true)}</div>`;
    if (S.calView === 'grid') return viewSeg() + gridView();
    const [a, b] = monthRange(S.month), t = today(), fb = S.filter, all = fb === '0';
    const issM = scheduleIssues(a, b), issA = new Set(issM.filter((x) => x.sev === 'alert').map((x) => x.d)), issW = new Set(issM.map((x) => x.d));
    let g = DOW.map((x, i) => `<div class="dow ${i === 0 || i === 6 ? 'we' : ''}">${x.replace('.', '')}</div>`).join('');
    for (let i = 0; i < dow(a); i++) g += `<div class="cell blank"></div>`;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      let c = '';
      for (const br of S.branches) {
        if (!all && br.id !== fb) continue;
        for (const s of S.shifts.filter((x) => x.work_date === d && x.branch_id === br.id)) {
          const lv = S.leaves.find((l) => l.shift_id === s.id);
          c += lv ? `<span class="chip leave"><span class="txt">${esc(shortName(M(s.member_id).display_name))} ขอลา</span><span class="ini">ล</span></span>` : chipFor(s, all && S.branches.length > 1);
        }
        for (const o of S.open.filter((x) => x.work_date === d && x.branch_id === br.id)) c += `<span class="chip open"><span class="txt">${all && S.branches.length > 1 ? esc(shortB(br.id)) + ' ' : ''}ว่าง</span><span class="ini">!</span></span>`;
      }
      g += `<button class="cell ${d < t ? 'past' : ''} ${d === t ? 'today' : ''} ${d === S.sel ? 'sel' : ''}" data-act="pick" data-d="${d}" aria-label="${dLong(d)}"><span class="dnum">${Number(d.slice(8))}${issW.has(d) ? `<i class="idot ${issA.has(d) ? 'alert' : 'warn'}"></i>` : ''}</span>${c}</button>`;
    }
    const legend = S.members.filter((m) => m.active && m.role !== 'owner').map((m) => `<span><i style="background:var(--${tone(m.color)})"></i>${esc(shortName(m.display_name))}</span>`).join('') + `<span><i style="background:var(--coral-soft);outline:1.5px dashed var(--coral)"></i>เวรว่าง</span><span><i style="background:var(--warn-soft)"></i>ขอลา</span>`;
    return viewSeg() + `<div class="calgrid">
      <div class="card"><div class="card-head">${monthNav()}<select id="filter" data-change="filter" aria-label="เลือกสาขา"><option value="0">ทุกสาขา</option>${S.branches.map((br) => `<option value="${br.id}" ${fb === br.id ? 'selected' : ''}>${esc(br.name)}</option>`).join('')}</select></div>
        <div class="legend">${legend}</div><div class="cal">${g}</div>
        <p class="small muted">แตะวันเพื่อดูรายละเอียดและจัดเวร · ${S.branches.length > 1 ? 'ส1, ส2… คือลำดับสาขา' : ''}</p></div>
      <div class="card" id="day">${ownerDay()}</div></div>`;
  }
  function ownerDay() {
    const d = S.sel, t = today();
    let h = `<div class="card-head"><div><h2>${dShort(d)}</h2><span class="tiny muted">${dLong(d)}</span></div>${d >= t ? `<button class="btn primary" data-act="addShift">${ic('plus')}เพิ่มเวร</button>` : ''}</div>`;
    if (!S.branches.length) return h + `<p class="muted small">ยังไม่มีสาขา</p>`;
    { const di = scheduleIssues(d, d); if (di.length) h += `<div class="stack" style="gap:6px">${di.map((x) => issueRow(x, false)).join('')}</div>`; }
    const avl = new Set(S.avail.filter((x) => x.work_date === d).map((x) => x.member_id));
    for (const br of S.branches.filter((x) => x.active)) {
      const ss = S.shifts.filter((x) => x.work_date === d && x.branch_id === br.id), os = S.open.filter((x) => x.work_date === d && x.branch_id === br.id);
      h += `<div class="stack" style="background:var(--bg);border-radius:14px;padding:12px"><div class="between"><b>${esc(br.name)}</b><span class="tiny muted">${t5(br.open_time)}–${t5(br.close_time)}</span></div>`;
      if (!ss.length && !os.length) h += `<span class="small muted">ไม่มีเวร</span>`;
      for (const s of ss) { const m = M(s.member_id); h += `<div class="row">${avatar(m.display_name, m.color, 'sm')}<span class="small grow">${esc(m.display_name)}${m.employment === 'fulltime' && s.paid ? ' <span class="pill ok">เวรพิเศษ คิดรายชม.</span>' : ''}${s.note ? ` <span class="muted">· ${esc(s.note)}</span>` : ''}</span><span class="small muted">${t5(s.start_time)}–${t5(s.end_time)}</span>${d >= t ? `${s.member_id === S.me.member_id ? `<button class="btn ghost" data-act="swapSheet" data-id="${s.id}" aria-label="แลกเวร">${ic('repeat')}</button>` : ''}<button class="btn ghost" data-act="editShift" data-id="${s.id}" aria-label="แก้ไขเวร">${ic('pencil')}</button><button class="btn ghost" data-act="delShift" data-id="${s.id}" aria-label="ลบเวร">${ic('trash-2')}</button>` : ''}</div>`; }
      for (const o of os) {
        h += `<div class="small" style="color:var(--coral-deep)">${ic('circle-alert')} <b>เวรว่าง ${t5(o.start_time)}–${t5(o.end_time)}</b>${o.reason ? ' · ' + esc(o.reason) : ''}</div><div class="actions" style="display:flex;flex-wrap:wrap;gap:6px">`;
        for (const m of S.members.filter((x) => x.active && x.role === 'pharmacist' && canBranch(x, o.branch_id))) h += `<button class="btn ${avl.has(m.id) ? 'primary' : ''}" data-act="assign" data-open="${o.id}" data-m="${m.id}">${ic('user-plus')}${esc(shortName(m.display_name))}${avl.has(m.id) ? ' · ว่าง' : ''}</button>`;
        h += `<button class="btn ghost" data-act="editOpen" data-id="${o.id}">${ic('pencil')}แก้ / ย้ายสาขา</button><button class="btn ghost" data-act="cancelOpen" data-id="${o.id}">ยกเลิกเวรว่าง</button></div>`;
      }
      h += `</div>`;
    }
    const mks = (S.marks || []).filter((x) => x.work_date === d);
    if (mks.length) h += `<div class="small">${ic('calendar-off')} ${mks.map((x) => `${esc(shortName(M(x.member_id).display_name))} <b>${MARK[x.kind]}</b>${Number(x.days) === 0.5 ? ' ครึ่งวัน' : ''}`).join(' · ')}</div>`;
    for (const r of ownerSreqs().filter((x) => x.work_date === d)) h += sreqCard(r);
    const names = S.members.filter((m) => avl.has(m.id)).map((m) => esc(shortName(m.display_name)));
    return h + `<p class="small muted">${ic('hand')} แจ้งว่าว่างวันนี้: ${names.length ? names.join(', ') : 'ยังไม่มี'}</p>`;
  }
  function addShiftSheet(ed) {
    const d = ed ? ed.work_date : S.sel, br = ed ? B(ed.branch_id) : (S.branches.find((x) => x.active) || S.branches[0]);
    const people = S.members.filter((m) => m.active);
    sheet((ed ? (ed.isOpen ? 'แก้เวรว่าง · ' : 'แก้ไขเวร · ') : 'เพิ่มเวร · ') + dShort(d), `
      <label class="field">สาขา<select id="sBranch" data-change="sBranch">${S.branches.filter((x) => x.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field">ใครเข้าเวร<select id="sWho"><option value="open">— เวรว่าง (ให้ พาร์ทไทม์ กดรับ) —</option>${people.map((m) => `<option value="${m.id}">${esc(m.display_name)} · ${esc(ROLE[m.role])}</option>`).join('')}</select></label>
      <div class="fields"><label class="field">เริ่ม<input id="sStart" type="time" value="${t5(br.open_time)}"></label><label class="field">ถึง<input id="sEnd" type="time" value="${t5(br.close_time)}"></label></div>
      <label class="field">หมายเหตุ (ไม่บังคับ)<input id="sNote" placeholder="เช่น เจ้าของไม่อยู่"></label>
      <label class="row small"><input type="checkbox" id="sPaid" ${ed && ed.paid ? 'checked' : ''}> เวรพิเศษ คิดเงินรายชั่วโมง (สำหรับ พนักงานประจำ ที่มาแทน · พาร์ทไทม์ คิดรายชั่วโมงทุกเวรอยู่แล้ว)</label>
      ${ed ? '' : `<label class="row small"><input type="checkbox" id="sRepeat"> ทำซ้ำทุก${DOW[dow(d)].replace('.', '')}จนถึงสิ้นเดือน</label>`}
      <button class="btn primary block" data-act="saveShift" data-id="${ed && !ed.isOpen ? ed.id : ''}" data-open="${ed && ed.isOpen ? ed.id : ''}">${ic('check')}บันทึกเวร</button>`);
    if (ed) { document.getElementById('sBranch').value = ed.branch_id; document.getElementById('sWho').value = ed.isOpen ? 'open' : ed.member_id; document.getElementById('sStart').value = t5(ed.start_time); document.getElementById('sEnd').value = t5(ed.end_time); document.getElementById('sNote').value = (ed.isOpen ? ed.reason : ed.note) || ''; }
  }

  // ---------- OWNER: requests ----------
  const STAT = { pending: ['wait', 'รออนุมัติ'], pending_peer: ['wait', 'รออีกฝ่ายตอบ'], pending_owner: ['wait', 'รอเจ้าของอนุมัติ'], approved: ['ok', 'อนุมัติแล้ว'], rejected: ['alert', 'ไม่อนุมัติ'], cancelled: ['wait', 'ยกเลิกแล้ว'] };
  const statPill = (st) => { const x = STAT[st] || ['wait', st]; return `<span class="pill ${x[0]}">${x[1]}</span>`; };
  function reqItems(list) {
    const it = [];
    for (const l of list.leaves || []) it.push({ at: l.created_at, tag: `<span class="tag lv">${MARK[l.leave_type] || 'ลา'}${l.half ? ' ครึ่งวัน' : ''}</span>`, who: l.member_id, txt: `${esc(B(l.branch_id).name)} · ${dShort(l.work_date)} ${t5(l.start_time)}–${t5(l.end_time)}${l.reason ? ' · ' + esc(l.reason) : ''}`, st: l.status });
    for (const f of list.fixes || []) it.push({ at: f.created_at, tag: '<span class="tag fx">แก้เวลา</span>', who: f.member_id, txt: `${f.kind === 'in' ? 'เข้างาน' : 'ออกงาน'} ${dShort(todayStr(S.tz, new Date(f.requested_at)))} ${fmtTime(f.requested_at, S.tz)} · ${esc(f.reason)}`, st: f.status });
    for (const c of list.claims || []) { const o = c.open_shifts || {}; it.push({ at: c.created_at, tag: '<span class="tag cl">รับเวร</span>', who: c.member_id, txt: o.work_date ? `${esc(B(o.branch_id).name)} · ${dShort(o.work_date)} ${t5(o.start_time)}–${t5(o.end_time)}` : 'เวรว่าง', st: c.status }); }
    for (const w of list.swaps || []) it.push({ at: w.created_at, tag: `<span class="tag sw">${w.to_shift_id ? 'แลกเวร' : 'ยกเวร'}</span>`, who: w.from_member, txt: swapLine(w), st: w.status });
    for (const r of list.sreqs || []) it.push({ at: r.created_at, tag: '<span class="tag cl">ขอลงเวร</span>', who: r.member_id, txt: `${esc(B(r.branch_id).name)} · ${dShort(r.work_date)} ${t5(r.start_time)}–${t5(r.end_time)}${r.note ? ' · ' + esc(r.note) : ''}`, st: r.status });
    for (const o of list.ots || []) it.push({ at: o.decided_at, tag: '<span class="tag ot">OT</span>', who: o.member_id, txt: dShort(o.work_date), st: o.approved ? 'approved' : 'rejected' });
    it.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return it.length ? it.map((x) => { const m = M(x.who); return `<div class="req-it">${avatar(m.display_name, m.color, 'sm')}<div class="grow"><div class="between"><b class="small">${x.tag}${esc(m.display_name)}</b>${statPill(x.st)}</div><span class="small">${x.txt}</span><br><span class="tiny muted">${x.at ? dShort(todayStr(S.tz, new Date(x.at))) + ' ' + fmtTime(x.at, S.tz) : ''}</span></div></div>`; }).join('') : `<div class="empty">${ic('inbox', 'ic-lg')}<span class="small">ยังไม่มีรายการ</span></div>`;
  }
  const reqSeg = (pend) => `<div class="seg" style="max-width:420px"><button data-act="reqView" data-v="pending" aria-pressed="${S.reqView !== 'done'}">${ic('bell')}รออนุมัติ${pend ? ` (${pend})` : ''}</button><button data-act="reqView" data-v="done" aria-pressed="${S.reqView === 'done'}">${ic('history')}ประวัติ 60 วัน</button></div>`;
  function ownerReq() {
    const pend = S.claims.length + S.leaves.length + S.fixes.length + S.ot.length + ownerSwaps().length + ownerSreqs().length;
    if (S.reqView === 'done') {
      if (!S.hist) { loadHist(); return reqSeg(pend) + `<div class="card">${skel()}</div>`; }
      return reqSeg(pend) + `<div class="card">${reqItems(S.hist)}</div>`;
    }
    let h = `<h1>คำขอรออนุมัติ</h1>` + reqSeg(pend);
    if (!S.claims.length && !S.leaves.length && !S.fixes.length && !S.ot.length && !(S.swaps || []).some(PEND) && !ownerSreqs().length) return h + `<div class="card"><div class="empty">${ic('coffee', 'ic-lg')}<b>ไม่มีอะไรค้าง</b><span class="small">คำขอรับเวร ขอลา และขอแก้เวลาจะขึ้นที่นี่</span></div></div>`;
    for (const r of ownerSreqs()) h += sreqCard(r);
    for (const c of S.claims) { const o = c.open_shifts, m = M(c.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอรับเวร</b><br><span class="small">${esc(B(o.branch_id).name)} · ${dShort(o.work_date)} · ${t5(o.start_time)}–${t5(o.end_time)}</span></div></div><div class="row"><button class="btn primary" data-act="approveClaim" data-open="${o.id}" data-m="${c.member_id}">${ic('check')}อนุมัติ</button><button class="btn" data-act="rejectClaim" data-id="${c.id}">ไม่อนุมัติ</button></div></div>`; }
    for (const l of S.leaves) { const m = M(l.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอลา</b><br><span class="small">${esc(B(l.branch_id).name)} · ${dShort(l.work_date)} · ${t5(l.start_time)}–${t5(l.end_time)}</span>${l.reason ? `<br><span class="small muted">เหตุผล: ${esc(l.reason)}</span>` : ''}</div></div>${m.role === 'pharmacist' ? `<span class="tiny muted">อนุมัติแล้ว ระบบโพสต์เป็นเวรว่างให้ พาร์ทไทม์ อัตโนมัติ</span>` : ''}<div class="row"><button class="btn primary" data-act="decideLeave" data-id="${l.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideLeave" data-id="${l.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    for (const o of S.ot) { const m = M(o.member_id); const hrs = (n) => `${Math.floor(n / 60)} ชม. ${n % 60} นาที`;
      h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ทำงานเกินเวลาเวร (OT)</b><br><span class="small">${dShort(o.work_date)} · ลงเวลา ${fmtTime(o.first_in, S.tz)}–${fmtTime(o.last_out, S.tz)}</span><br><span class="small muted">ในเวลาเวร ${hrs(o.in_shift_min)} · เกินเวร <b>${hrs(o.extra_min)}</b>${o.in_shift_min === 0 ? ' (วันนี้ไม่มีเวรในตาราง)' : ''}</span></div></div>
        <span class="tiny muted">อนุมัติ = จ่ายตามเวลาจริงทั้งวัน · ไม่อนุมัติ = จ่ายเฉพาะในเวลาเวร</span>
        <div class="row"><button class="btn primary" data-act="decideOt" data-m="${o.member_id}" data-d="${o.work_date}" data-ok="1">${ic('check')}อนุมัติ OT</button><button class="btn" data-act="decideOt" data-m="${o.member_id}" data-d="${o.work_date}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    for (const w of (S.swaps || []).filter((x) => x.status === 'pending_peer' && x.to_member !== S.me.member_id && x.from_member !== S.me.member_id)) h += `<div class="card" style="flex-direction:row;align-items:center"><span class="icon-chip t-lilac">${ic('hourglass')}</span><span class="grow small"><b>รอ ${esc(M(w.to_member).display_name)} ตอบรับการ${w.to_shift_id ? 'แลก' : 'ยก'}เวร</b><br>${swapLine(w)}</span></div>`;
    h += swapCards();
    for (const w of ownerSwaps()) h += `<div class="card"><div class="row"><span class="icon-chip t-lilac">${ic('repeat')}</span><div class="grow"><b>ขอ${w.to_shift_id ? 'แลก' : 'ยก'}เวร (ทั้งสองคนตกลงแล้ว)</b><br>${swapLine(w)}</div></div><div class="row"><button class="btn primary" data-act="decideSwap" data-id="${w.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideSwap" data-id="${w.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`;
    for (const f of S.fixes) { const m = M(f.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอแก้เวลา${f.kind === 'in' ? 'เข้างาน' : 'ออกงาน'}</b><br><span class="small">${esc(B(f.branch_id).name)} · ${dShort(todayStr(S.tz, new Date(f.requested_at)))} ${fmtTime(f.requested_at, S.tz)}</span><br><span class="small muted">เหตุผล: ${esc(f.reason)}</span></div></div><div class="row"><button class="btn primary" data-act="decideFix" data-id="${f.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideFix" data-id="${f.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    return h;
  }

  function sreqCard(r) {
    const m = M(r.member_id), clash = S.shifts.find((s) => s.member_id === r.member_id && s.work_date === r.work_date && mins(s.start_time) < mins(r.end_time) && mins(r.start_time) < mins(s.end_time));
    const op = S.open.find((o) => o.branch_id === r.branch_id && o.work_date === r.work_date && mins(o.start_time) < mins(r.end_time) && mins(r.start_time) < mins(o.end_time));
    return `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอลงเวร</b><br><span class="small">${esc(B(r.branch_id).name)} · ${dShort(r.work_date)} · ${t5(r.start_time)}–${t5(r.end_time)}</span>${r.note ? `<br><span class="small muted">หมายเหตุ: ${esc(r.note)}</span>` : ''}${op ? `<br><span class="tiny" style="color:var(--ok)">ตรงกับเวรว่างที่ประกาศไว้ อนุมัติแล้วถือว่ามีคนรับ</span>` : ''}${clash ? `<br><span class="tiny" style="color:var(--coral-deep)">ชนกับเวรเดิมของเขา</span>` : ''}</div></div><div class="row"><button class="btn primary" data-act="decideSreq" data-id="${r.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideSreq" data-id="${r.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`;
  }
  async function loadHist() {
    const o = S.me.org_id, since = new Date(Date.now() - 60 * 86400e3).toISOString();
    try {
      const [leaves, fixes, claims, ots, sreqs] = await Promise.all([
        q(sb.from('leave_requests').select('*').eq('org_id', o).neq('status', 'pending').gte('created_at', since).order('created_at', { ascending: false })),
        q(sb.from('attendance_fixes').select('*').eq('org_id', o).neq('status', 'pending').gte('created_at', since)),
        q(sb.from('shift_claims').select('*, open_shifts!inner(*)').eq('open_shifts.org_id', o).neq('status', 'pending').gte('created_at', since)),
        q(sb.from('ot_approvals').select('*').gte('decided_at', since)),
        q(sb.from('shift_requests').select('*').eq('org_id', o).neq('status', 'pending').gte('created_at', since)),
      ]);
      S.hist = { leaves, fixes, claims, ots: ots.filter((x) => S.members.some((m) => m.id === x.member_id)), swaps: (S.swaps || []).filter((w) => !PEND(w)), sreqs };
    } catch (e) { S.hist = {}; toast(errMsg(e), 'err'); }
    if (S.tab === 'req') render();
  }
  function staffReq() {
    const mine = (x) => x.member_id === S.me.member_id;
    const pendN = S.leaves.filter((l) => mine(l) && l.status === 'pending').length + S.fixes.filter((f) => f.status === 'pending').length + S.claims.filter((c) => c.status === 'pending').length + (S.swaps || []).filter((w) => PEND(w) && (w.from_member === S.me.member_id || w.to_member === S.me.member_id)).length;
    let h = `<h1>คำขอ</h1>` + swapCards();
    h += `<div class="card"><b class="small">สร้างคำขอ</b><div class="row" style="flex-wrap:wrap"><button class="btn" data-act="tab" data-tab="cal">${ic('calendar-x')}ขอลา / แลกเวร</button><button class="btn" data-act="fixSheet">${ic('alarm-clock')}ขอแก้เวลา</button>${isPharm(M(S.me.member_id)) ? `<button class="btn" data-act="tab" data-tab="open">${ic('megaphone')}รับเวรว่าง</button><button class="btn" data-act="sreqSheet">${ic('calendar-plus')}ขอลงเวรเอง</button>` : ''}</div><span class="tiny muted">ขอลาและแลกเวร: แตะวันที่มีเวรในปฏิทิน</span></div>`;
    h += `<div class="card"><div class="between"><b>คำขอของฉัน</b>${pendN ? `<span class="pill wait">รออยู่ ${pendN}</span>` : ''}</div>${reqItems({ leaves: S.leaves.filter(mine), fixes: S.fixes, claims: S.claims, swaps: (S.swaps || []).filter((w) => w.from_member === S.me.member_id || w.to_member === S.me.member_id), sreqs: S.sreqs || [] })}</div>`;
    return h;
  }

  // ---------- OWNER: pay ----------
  function ownerPay() {
    const seg = `<div class="seg" style="max-width:360px"><button data-act="payView" data-v="pay" aria-pressed="${S.payView !== 'report'}">${ic('wallet')}ค่าจ้าง</button><button data-act="payView" data-v="report" aria-pressed="${S.payView === 'report'}">${ic('chart-column')}รายงานภาพรวมคน</button></div>`;
    if (S.payView === 'report') return seg + `<div class="card"><div class="card-head">${monthNav()}<button class="btn" data-act="exportReport">${ic('file-spreadsheet')}Excel รายงาน</button></div><div id="report">${skel()}</div></div>`;
    return seg + `<div class="card"><div class="card-head">${monthNav()}<span class="small muted">เห็นได้เฉพาะเจ้าของร้าน</span></div>
      <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="exportXlsx">${ic('file-spreadsheet')}ดาวน์โหลด Excel</button><button class="btn" data-act="sendSlips">${ic('send')}ส่งสลิปทาง LINE</button></div><div id="hours">${skel()}</div>
      <p class="small muted">${S.org.clip_to_shift ? 'คิดเงินเฉพาะเวลาที่อยู่ในเวร ส่วนที่เกินเป็น OT ต้องอนุมัติในแท็บคำขอ' : 'คิดเงินตามเวลาเข้า–ออกงานจริงทั้งหมด'} · แก้ค่าจ้างต่อชั่วโมงได้ในตาราง · ตั้งค่าได้ในแท็บตั้งค่า</p></div>`;
  }
  async function reportData() {
    const mo = S.month + '-01', [a, b] = monthRange(S.month);
    const [sum, det] = await Promise.all([rpc('month_hours', { p_org: S.me.org_id, p_month: mo }), rpc('month_detail', { p_org: S.me.org_id, p_month: mo }).catch(() => [])]);
    const y = S.month.slice(0, 4); let ym = S.yearMarks || [];
    if (!ym.length || (ym[0] && ym[0].work_date.slice(0, 4) !== y)) { try { ym = await q(sb.from('day_marks').select('member_id,kind,days,work_date').eq('org_id', S.me.org_id).gte('work_date', y + '-01-01').lte('work_date', y + '-12-31')); } catch (_) { ym = []; } }
    const rows = [];
    for (const m of S.members.filter((x) => x.role !== 'owner' || S.shifts.some((s) => s.member_id === x.id))) {
      const ss = S.shifts.filter((s) => s.member_id === m.id && s.work_date >= a && s.work_date <= b), h = sum.find((r) => r.member_id === m.id) || {};
      const dd = det.filter((r) => r.member_id === m.id), first = {}; dd.forEach((r) => { if (!first[r.work_date]) first[r.work_date] = r; });
      const L = { ok: 0, warn: 0, alert: 0 }; Object.values(first).forEach((r) => { const k = lateKind(r.late_min); if (k) L[k]++; });
      const mk = (S.marks || []).filter((x) => x.member_id === m.id && x.work_date >= a && x.work_date <= b), cnt = (arr, k) => arr.filter((x) => x.kind === k).reduce((s2, x) => s2 + Number(x.days), 0);
      const yr = ym.filter((x) => x.member_id === m.id), byB = {}; ss.forEach((s) => { const c = shortB(s.branch_id); byB[c] = (byB[c] || 0) + 1; });
      if (!m.active && !ss.length && !dd.length) continue;
      rows.push({ m, shifts: ss.length, byB, schH: ss.reduce((t2, s) => t2 + (mins(s.end_time) - mins(s.start_time)) / 60, 0), days: Object.keys(first).length, act: Number(h.actual_hours || 0), paid: Number(h.hours || 0), ot: Number(h.ot_pending_hours || 0), L,
        mon: { OFF: cnt(mk, 'OFF'), AL: cnt(mk, 'AL'), HD: cnt(mk, 'HD'), SL: cnt(mk, 'SL'), PL: cnt(mk, 'PL') }, yr: { AL: cnt(yr, 'AL'), SL: cnt(yr, 'SL'), PL: cnt(yr, 'PL'), HD: cnt(yr, 'HD') }, q: m.leave_quota || {} });
    }
    return rows;
  }
  async function loadReport() {
    const el = document.getElementById('report'); if (!el) return;
    let rows; try { rows = await reportData(); } catch (e) { el.innerHTML = `<p class="small" style="color:var(--coral-deep)">${esc(errMsg(e))}</p>`; return; }
    const f1 = (n) => n ? (Math.round(n * 10) / 10).toString() : '';
    const yq = (r, k) => r.q[k] != null ? `${f1(r.yr[k]) || 0}/${r.q[k]}` : f1(r.yr[k]);
    el.innerHTML = `<div class="gridwrap"><table class="sheetg"><thead><tr><th class="nm">ชื่อ</th><th>เวรตามตาราง</th><th>ชม.ตามตาราง</th><th>วันมาจริง</th><th>ชม.จริง</th><th>ชม.คิดเงิน</th><th>OT รอ</th><th>ตรง / สายใน / สายเกิน</th><th>หยุด</th><th>พักร้อน</th><th>นักขัตฯ</th><th>ลาป่วย</th><th>ลากิจ</th><th>พักร้อน (ปี)</th><th>ลาป่วย (ปี)</th><th>ลากิจ (ปี)</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="nm">${esc(r.m.display_name)}<small>${esc(EMP[r.m.employment] || '')}</small></td><td class="sum" style="text-align:left">${r.shifts ? `<b>${r.shifts}</b> <span class="tiny muted">${Object.entries(r.byB).map(([k, v]) => esc(k) + ' ' + v).join(' · ')}</span>` : ''}</td><td class="sum">${f1(r.schH)}</td><td class="sum">${r.days || ''}</td><td class="sum">${f1(r.act)}</td><td class="sum">${f1(r.paid)}</td><td class="sum">${f1(r.ot)}</td><td class="sum"><span class="pill ok">${r.L.ok}</span> <span class="pill warn">${r.L.warn}</span> <span class="pill alert">${r.L.alert}</span></td>${['OFF', 'AL', 'HD', 'SL', 'PL'].map((k) => `<td class="sum">${f1(r.mon[k])}</td>`).join('')}<td class="sum">${yq(r, 'AL')}</td><td class="sum">${yq(r, 'SL')}</td><td class="sum">${yq(r, 'PL')}</td></tr>`).join('')}</tbody></table></div>
      ${help('วันมาจริงนับจากการสแกนเข้า–ออกครบคู่ · ลา (ปี) แสดงเป็น ใช้ไป/โควตา ตั้งโควตาได้ในหน้าแก้ไขพนักงาน · วันหยุดและวันลามาจากตารางแบบชีตและคำขอลาที่อนุมัติแล้ว')}`;
  }
  async function loadHours() {
    const el = document.getElementById('hours') || document.getElementById('myhours'); if (!el) return;
    try {
      const rows = await rpc('month_hours', { p_org: S.me.org_id, p_month: S.month + '-01' });
      if (S.isOwner) {
        let det = []; try { det = await rpc('month_detail', { p_org: S.me.org_id, p_month: S.month + '-01' }); } catch (_) {}
        S.detail = det;
        const lateBy = {}; const seen = new Set();
        det.forEach((r) => { const k = r.member_id + r.work_date; if (seen.has(k)) return; seen.add(k); const lk = lateKind(r.late_min); if (!lk) return; (lateBy[r.member_id] = lateBy[r.member_id] || { ok: 0, warn: 0, alert: 0 })[lk]++; });
        S.lateBy = lateBy;
        const list = rows.filter((r) => M(r.member_id).role !== 'owner' && (!M(r.member_id).clock_free || Number(r.actual_hours) > 0 || Number(r.extras) !== 0));
        const total = list.reduce((a, r) => a + Number(r.amount || 0), 0);
        const lateCell = (id) => { const L = lateBy[id]; if (!L) return '<span class="muted">—</span>'; return `<span class="pill ok">${L.ok}</span> <span class="pill warn">${L.warn}</span> <span class="pill alert">${L.alert}</span>`; };
        if (narrow()) {
          el.innerHTML = list.map((r) => { const m = M(r.member_id); return `<div class="paycard"><div class="row">${avatar(m.display_name, m.color, 'sm')}<div class="grow"><b>${esc(m.display_name)}</b><br><span class="tiny muted">${esc(EMP[m.employment])}${m.employment === 'fulltime' ? ' · คิดเฉพาะเวรพิเศษ/OT' : ''}</span></div><b style="font:500 20px var(--display)">฿${baht(r.amount)}</b></div>
            <div class="paygrid"><span>คิดเงิน</span><b>${Number(r.hours).toFixed(2)} ชม.</b><span>เวลาจริง</span><b>${Number(r.actual_hours || 0).toFixed(2)} ชม.</b><span>บาท/ชม.</span><input class="rate" type="number" min="0" step="5" value="${r.hourly_rate ?? ''}" placeholder="—" data-change="rate" data-m="${r.member_id}" aria-label="ค่าจ้างต่อชั่วโมง"><span>เงินพิเศษ</span><button class="btn ghost" data-act="adjSheet" data-m="${r.member_id}">${Number(r.extras) ? '฿' + baht(r.extras) : ic('plus') + 'เพิ่ม'}</button></div>
            <div class="row" style="flex-wrap:wrap;gap:6px">${Number(r.ot_pending_hours) > 0 ? `<span class="pill warn">OT รอ ${Number(r.ot_pending_hours).toFixed(2)} ชม.</span>` : ''}${lateCell(r.member_id)}</div></div>`; }).join('') + `<div class="between" style="padding:10px 4px"><b>รวมทั้งหมด</b><b style="font:500 22px var(--display)">฿${baht(total)}</b></div>` + help(`การเข้างาน (นับวัน): เขียว = ตรงเวลา · เหลือง = สายในเกณฑ์ ≤ ${grace()} นาที · แดง = สายเกินเกณฑ์ · เงินพิเศษ เช่น ค่าเดินทาง Commission หรือหักประกันสังคม (ใส่ติดลบ)`);
          icons(); return;
        }
        el.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>ชื่อ</th><th class="r">คิดเงิน (ชม.)</th><th class="r">เวลาจริง</th><th class="r">บาท/ชม.</th><th class="r">เงินพิเศษ</th><th class="r">ยอด</th><th>การเข้างาน</th></tr></thead><tbody>${list.map((r) => { const m = M(r.member_id); return `<tr><td><div class="row">${avatar(m.display_name, m.color, 'sm')}<span>${esc(m.display_name)}<br><span class="tiny muted">${esc(EMP[m.employment])}${m.employment === 'fulltime' ? ' · คิดเฉพาะเวรพิเศษ/OT' : ''}</span></span></div></td><td class="r">${Number(r.hours).toFixed(2)}${Number(r.ot_pending_hours) > 0 ? `<br><span class="pill warn">OT รอ ${Number(r.ot_pending_hours).toFixed(2)}</span>` : ''}</td><td class="r muted">${Number(r.actual_hours || 0).toFixed(2)}</td><td class="r"><input class="rate" type="number" min="0" step="5" value="${r.hourly_rate ?? ''}" placeholder="—" data-change="rate" data-m="${r.member_id}" aria-label="ค่าจ้างต่อชั่วโมง ${esc(m.display_name)}"></td><td class="r"><button class="btn ghost" data-act="adjSheet" data-m="${r.member_id}">${Number(r.extras) ? '฿' + baht(r.extras) : ic('plus')}</button></td><td class="r"><b>฿${baht(r.amount)}</b></td><td style="white-space:nowrap">${lateCell(r.member_id)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="5"><b>รวม</b></td><td class="r"><b>฿${baht(total)}</b></td><td></td></tr></tfoot></table></div>
          ${help(`การเข้างาน (นับวัน): <span class="pill ok">ตรงเวลา</span> <span class="pill warn">สายในเกณฑ์ ≤ ${grace()} นาที</span> <span class="pill alert">สายเกินเกณฑ์</span> · เงินพิเศษ เช่น ค่าเดินทาง Commission หรือหักประกันสังคม (ใส่ติดลบ) กดที่ช่อง "เงินพิเศษ"`)}`;
      } else {
        const r = rows[0] || { hours: 0, hourly_rate: S.pay[S.me.member_id] || 0, amount: 0 };
        el.innerHTML = `<div class="shift-hero"><span class="small" style="opacity:.9">ยอดเดือน${monthLabel(S.month)}</span><div class="time">฿${baht(r.amount)}</div><span class="small" style="opacity:.9">${Number(r.hours).toFixed(2)} ชม. × ${baht(r.hourly_rate)} บาท</span>${Number(r.ot_pending_hours) > 0 ? `<span class="pill">${ic('hourglass')}OT ${Number(r.ot_pending_hours).toFixed(2)} ชม. รอเจ้าของอนุมัติ</span>` : ''}</div>`; icons();
      }
    } catch (e) { el.innerHTML = `<p class="small" style="color:var(--coral-deep)">${esc(errMsg(e))}</p>`; }
  }

  // ---------- OWNER: settings ----------
  function ownerSet() {
    if (S.setSec) return `<button class="btn ghost" data-act="setSec" data-v="" style="width:fit-content">${ic('chevron-left')}ตั้งค่าทั้งหมด</button>` + ownerSetAll();
    const br = S.branches, pend = S.members.filter((m) => m.active && !m.user_id).length, staff = S.members.filter((m) => m.active && m.role !== 'owner').length;
    const items = [
      ['shop', 'store', 't-brand', 'ร้านและกฎการลงเวลา', `${esc(S.org.name)} · ผ่อนผันสาย ${grace()} นาที${S.org.require_shift ? ' · สแกนเฉพาะวันมีเวร' : ''}`],
      ['branch', 'map-pin', 't-sky', 'สาขาและจอ QR', br.length ? `${br.length} สาขา · ตั้งตำแหน่งแล้ว ${br.filter((x) => x.lat != null).length}/${br.length}` : 'ยังไม่มีสาขา'],
      ['staff', 'users', 't-lilac', 'พนักงาน', `${staff} คน${pend ? ` · รอเข้าร่วม ${pend}` : ''}`],
      ['preset', 'clock', 't-teal', 'เวรสำเร็จรูป', presets().map((p) => esc(p.code)).join(' · ')],
      ['rules', 'shield-check', 't-coral', 'กฎตรวจตาราง', (() => { const R = RULES(); return [R.cover ? 'เภสัชกรครบทุกช่วง' : '', R.week_h ? `ไม่เกิน ${R.week_h} ชม./สัปดาห์` : '', R.streak ? `ติดกันไม่เกิน ${R.streak} วัน` : ''].filter(Boolean).join(' · ') || 'ปิดอยู่'; })()],
      ['notify', 'bell-ring', 't-sun', 'แจ้งเตือนทาง LINE', Object.values(S.org.notify || {}).filter((v) => v === false).length ? 'ปิดบางรายการ' : 'เปิดทั้งหมด'],
    ];
    if (S.me.role === 'owner') items.push(['reset', 'trash-2', 't-coral', 'ล้างข้อมูล / ลบร้าน', 'ใช้หลังสาธิต หรือก่อนเริ่มใช้งานจริง']);
    return `<h1>ตั้งค่า</h1>${setupCard(true)}<div class="card" style="padding:6px 14px">${items.map(([k, i, t, n, d]) => `<button class="setrow" data-act="setSec" data-v="${k}"><span class="icon-chip ${t}">${ic(i)}</span><span class="grow"><b>${n}</b><br><span class="small muted">${d}</span></span>${ic('chevron-right')}</button>`).join('')}</div><p class="tiny muted" style="text-align:center">เวอร์ชัน 3 พ.ย. 69 ลบสาขาได้ (ตรวจตาราง · ลบสาขา)</p>`;
  }
  function ownerSetAll() {
    const liffUrl = `https://liff.line.me/${CFG.LIFF_ID}`, kioskUrl = new URL('kiosk.html', location.href).href;
    let h = `<div class="grid" style="align-items:start">
      <div class="card" data-sec="shop"><div class="row"><span class="icon-chip t-brand">${ic('store')}</span><h2>ร้านและกฎการลงเวลา</h2></div>
        <label class="field">ชื่อร้าน<input id="oName" value="${esc(S.org.name)}"></label>
        <label class="field">เวลาผ่อนผันก่อนนับว่าสาย<select id="oGrace">${[0, 5, 10, 15, 20, 30].map((n) => `<option value="${n}" ${grace() === n ? 'selected' : ''}>${n ? n + ' นาที' : 'ไม่มี'}</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oReq" ${S.org.require_shift ? 'checked' : ''}> สแกนเข้างานได้เฉพาะวันที่มีเวร (เจ้าของร้านไม่ต้อง)</label>
        <label class="field">สแกนก่อนเวลาเวรได้<select id="oEarly">${[15, 30, 60, 120].map((n) => `<option value="${n}" ${(S.org.early_minutes ?? 60) === n ? 'selected' : ''}>${n} นาที</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oClip" ${S.org.clip_to_shift ? 'checked' : ''}> คิดชั่วโมงไม่เกินเวลาเวร (ทำเกินเวรเป็น OT ต้องอนุมัติก่อนจ่าย)</label>
        <label class="field">ไม่นับส่วนที่เกินเวรน้อยกว่า<select id="oOtMin">${[0, 10, 15, 30].map((n) => `<option value="${n}" ${(S.org.ot_min_minutes ?? 15) === n ? 'selected' : ''}>${n ? n + ' นาที' : 'นับทุกนาที'}</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oSelf" ${S.org.allow_self_approve ? 'checked' : ''}> ให้ผู้จัดการอนุมัติคำขอของตัวเองได้ (เจ้าของร้านอนุมัติได้เสมอ)</label>
        <label class="row small"><input type="checkbox" id="oPtAll" ${S.org.pt_see_all ? 'checked' : ''}> ให้ พาร์ทไทม์ เห็นตารางเวรของคนอื่น (ปิด = เห็นเฉพาะเวรตัวเองและเวรว่าง)</label>
        <label class="row small"><input type="checkbox" id="oGps" ${S.org.require_gps ? 'checked' : ''}> บังคับเปิดตำแหน่ง (GPS) ทุกครั้งที่สแกน (ไม่เปิด = สแกนไม่ได้)</label>
        <button class="btn primary" data-act="saveOrg">${ic('check')}บันทึก</button>
        <div class="stack small" style="border-top:1px solid var(--line);padding-top:12px"><b>ลิงก์แอปสำหรับพนักงาน</b><div class="row"><span class="code" style="font-size:12px;letter-spacing:0;overflow:hidden;text-overflow:ellipsis">${esc(liffUrl)}</span><button class="btn ghost" data-act="copy" data-text="${esc(liffUrl)}">${ic('copy')}</button></div>
        <b>ลิงก์จอที่ร้าน (เปิดบนโทรศัพท์ร้าน)</b><div class="row"><span class="code" style="font-size:12px;letter-spacing:0;overflow:hidden;text-overflow:ellipsis">${esc(kioskUrl)}</span><button class="btn ghost" data-act="copy" data-text="${esc(kioskUrl)}">${ic('copy')}</button></div><span class="muted" style="font-size:12px">เวอร์ชัน 3 พ.ย. 69 ลบสาขาได้ (ตรวจตาราง · ลบสาขา)</span></div></div>
      <div class="card" data-sec="branch"><div class="card-head"><div class="row"><span class="icon-chip t-sky">${ic('map-pin')}</span><h2>สาขา</h2></div><button class="btn" data-act="editBranch">${ic('plus')}เพิ่มสาขา</button></div>`;
    if (!S.branches.length) h += `<p class="small muted">ยังไม่มีสาขา กด "เพิ่มสาขา" เพื่อเริ่ม</p>`;
    for (const br of S.branches) h += `<div class="list-row" style="flex-wrap:wrap"><div class="grow"><b>${esc(br.name)}</b>${br.active ? '' : ' <span class="pill wait">ปิดใช้งาน</span>'}<br><span class="small muted">${t5(br.open_time)}–${t5(br.close_time)}${br.lat != null ? ' · ตั้งตำแหน่งแล้ว' : ' · ยังไม่ตั้งตำแหน่ง'}</span></div><button class="btn ghost" data-act="pairKiosk" data-id="${br.id}">${ic('monitor-smartphone')}จับคู่จอ QR</button>${br.allow_static ? `<a class="btn ghost" href="print.html?b=${br.id}" target="_blank" rel="noopener">${ic('printer')}ปริ้น QR ติดผนัง</a>` : ''}<button class="btn ghost" data-act="editBranch" data-id="${br.id}" aria-label="แก้ไขสาขา">${ic('pencil')}</button></div>`;
    h += `</div></div><div class="card" data-sec="staff"><div class="card-head"><div class="row"><span class="icon-chip t-lilac">${ic('users')}</span><h2>พนักงาน</h2></div><button class="btn primary" data-act="editMember">${ic('user-plus')}เพิ่มพนักงาน</button></div>`;
    for (const m of S.members) {
      const code = S.invites[m.id];
      h += `<div class="list-row" style="flex-wrap:wrap">${avatar(m.display_name, m.color, '', m.avatar_url)}<div class="grow"><b>${esc(m.display_name)}</b>${m.active ? '' : ' <span class="pill wait">ออกแล้ว</span>'}<br><span class="small muted">${esc(ROLE[m.role])} · ${esc(EMP[m.employment])}${m.home_branch_id ? ' · ' + esc(B(m.home_branch_id).name) : ''}${m.employment === 'parttime' && S.pay[m.id] != null ? ` · ${baht(S.pay[m.id])} บาท/ชม.` : ''}${m.clock_free ? ' · ไม่ต้องลงเวลา' : ''}</span></div>
        ${m.user_id ? `<span class="pill ok">${ic('check')}เชื่อม LINE แล้ว</span>` : code ? `<span class="code">${esc(code)}</span><button class="btn ghost" data-act="copyInvite" data-id="${m.id}">${ic('send')}ส่งรหัส</button>` : ''}
        ${m.id !== S.me.member_id && (m.role !== 'owner' || S.me.role === 'owner') ? `<button class="btn ghost" data-act="editMember" data-id="${m.id}" aria-label="แก้ไขพนักงาน">${ic('pencil')}</button>` : ''}</div>`;
    }
    h += `</div>`;
    const N = S.org.notify || {}, nk = [['requests', 'แจ้งเจ้าของเมื่อมีคำขอใหม่ (ลา รับเวร แก้เวลา แลกเวร)'], ['decisions', 'แจ้งพนักงานเมื่ออนุมัติ / ไม่อนุมัติ'], ['remind', 'เตือนพนักงานก่อนเข้าเวร 1 ชั่วโมง'], ['forgot', 'เตือนคนลืมกดออกงาน'], ['open', 'ประกาศเวรว่างให้ พาร์ทไทม์']];
    { const R = RULES(); h += `<div class="card" data-sec="rules"><div class="row"><span class="icon-chip t-coral">${ic('shield-check')}</span><h2>กฎตรวจตาราง</h2></div><span class="small muted">แอปจะเตือนในหน้าภาพรวมและในตารางทันทีเมื่อจัดเวรผิดกฎเหล่านี้</span>
      <label class="row small"><input type="checkbox" id="rCover" ${R.cover ? 'checked' : ''}> ต้องมีเภสัชกรอยู่ทุกช่วงที่สาขาเปิด</label>
      <label class="row small" style="padding-left:24px"><input type="checkbox" id="rMgr" ${R.cover_mgr ? 'checked' : ''}> นับเจ้าของร้านและผู้จัดการเป็นเภสัชกรด้วย</label>
      <label class="field">ชั่วโมงทำงานสูงสุดต่อสัปดาห์<select id="rWeek">${[0, 40, 44, 48, 54, 60].map((n) => `<option value="${n}" ${R.week_h === n ? 'selected' : ''}>${n ? n + ' ชม.' : 'ไม่ตรวจ'}</option>`).join('')}</select></label>
      <label class="field">ทำงานติดกันได้ไม่เกิน<select id="rStreak">${[0, 5, 6, 7, 10].map((n) => `<option value="${n}" ${R.streak === n ? 'selected' : ''}>${n ? n + ' วัน' : 'ไม่ตรวจ'}</option>`).join('')}</select></label>
      <label class="row small"><input type="checkbox" id="rAvail" ${R.avail ? 'checked' : ''}> เตือนเมื่อลงเวรพาร์ทไทม์ในวันที่เขาไม่ได้แจ้งว่าว่าง</label>
      ${help('กฎหมายแรงงานกำหนดชั่วโมงทำงานไม่เกิน 48 ชม./สัปดาห์ และให้มีวันหยุดอย่างน้อยสัปดาห์ละ 1 วัน · ร้านขายยาต้องมีเภสัชกรประจำตลอดเวลาที่เปิด · การเตือนไม่ได้ห้ามลงเวร แค่ช่วยให้เห็นจุดที่ควรแก้')}
      <button class="btn primary" data-act="saveRules">${ic('check')}บันทึก</button></div>`; }
    h += `<div class="card" data-sec="preset"><div class="row"><span class="icon-chip t-teal">${ic('clock')}</span><h2>เวรสำเร็จรูป</h2></div><span class="small muted">ชื่อเวรที่ใช้บ่อย เช่น เต็มวัน ช่วงเช้า ช่วงบ่าย</span>
      <div id="presetRows">${presets().map((p, i) => `<div class="row" style="gap:6px"><input class="pc" value="${esc(p.code)}" maxlength="12" style="width:110px" aria-label="ชื่อเวร"><input class="ps" type="time" value="${p.start}" aria-label="เริ่ม"><input class="pe" type="time" value="${p.end}" aria-label="ถึง"><button class="btn ghost" data-act="delPreset" data-i="${i}" aria-label="ลบ">${ic('trash-2')}</button></div>`).join('')}</div>
      <div class="row"><button class="btn" data-act="addPreset">${ic('plus')}เพิ่มเวร</button><button class="btn primary" data-act="savePresets">${ic('check')}บันทึก</button></div></div>`;
    h += `<div class="card" data-sec="notify"><div class="row"><span class="icon-chip t-sun">${ic('bell-ring')}</span><h2>แจ้งเตือนทาง LINE</h2></div>
      ${nk.map(([k, t]) => `<label class="row small"><input type="checkbox" data-nk="${k}" ${N[k] !== false ? 'checked' : ''}> ${t}</label>`).join('')}
      ${help('ทุกคนต้องเพิ่มเพื่อน LINE ของระบบก่อนถึงจะได้รับข้อความ · ปิดแจ้งเตือนรายคนได้ในหน้าแก้ไขพนักงาน')}
      <button class="btn primary" data-act="saveNotify">${ic('check')}บันทึก</button></div>`;
    if (S.me.role === 'owner') h += `<div class="card" data-sec="reset" style="border:1.5px solid var(--coral-soft)"><div class="row"><span class="icon-chip t-coral">${ic('trash-2')}</span><h2>ล้างข้อมูล</h2></div>
      <p class="small muted">ใช้หลังสาธิต หรือก่อนเริ่มใช้งานจริง · เฉพาะเจ้าของร้าน · ร้านอื่นในระบบไม่กระทบ</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="resetSheet" data-mode="data">${ic('eraser')}ล้างข้อมูลการใช้งาน</button><button class="btn danger" data-act="resetSheet" data-mode="org">${ic('trash-2')}ลบร้านนี้ทั้งร้าน</button></div></div>`;
    return h;
  }
  function branchSheet(id) {
    const br = S.branches.find((x) => x.id === id) || { name: '', open_time: '09:00', close_time: '21:00', active: true };
    sheet(id ? 'แก้ไขสาขา' : 'เพิ่มสาขา', `
      <div class="fields"><label class="field">ชื่อสาขา<input id="bName" value="${esc(br.name)}" placeholder="เช่น สาขาตลาดใหม่"></label><label class="field">ชื่อย่อ (ไม่บังคับ)<input id="bCode" value="${esc(br.code || '')}" maxlength="10" placeholder="ใช้ในตารางที่ช่องแคบ"></label></div>
      <div class="fields"><label class="field">เปิด<input id="bOpen" type="time" value="${t5(br.open_time)}"></label><label class="field">ปิด<input id="bClose" type="time" value="${t5(br.close_time)}"></label></div>
      <div class="stack" style="background:var(--bg);border-radius:14px;padding:12px">
        <b>ตำแหน่งร้าน (ใช้ตรวจ GPS)</b>
        <span class="small muted" id="bLocTxt">${br.lat != null ? `ตั้งแล้ว: ${Number(br.lat).toFixed(5)}, ${Number(br.lng).toFixed(5)}` : 'ยังไม่ได้ตั้ง'}</span>
        <input type="hidden" id="bLat" value="${br.lat ?? ''}"><input type="hidden" id="bLng" value="${br.lng ?? ''}">
        <button class="btn" data-act="useHere">${ic('locate-fixed')}ใช้ตำแหน่งปัจจุบัน (กดตอนยืนอยู่ในร้าน)</button>
        <label class="field">ระยะที่ยอมรับจากร้าน<select id="bRadius">${[100, 150, 200, 300, 500].map((n) => `<option value="${n}" ${(br.gps_radius || 150) === n ? 'selected' : ''}>${n} เมตร</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="bStatic" ${br.allow_static ? 'checked' : ''}> เปิดใช้ QR ปริ้นติดผนัง (สแกนได้เฉพาะเมื่ออยู่ในระยะ)</label>
        <span class="tiny muted">QR บนจอยังใช้ได้เสมอ ถ้าสแกนห่างร้านเกินระยะ ระบบยังบันทึกแต่ขึ้นธงเตือนให้เจ้าของเห็น</span>
      </div>
      ${id ? `<label class="row small"><input type="checkbox" id="bActive" ${br.active ? 'checked' : ''}> เปิดใช้งานสาขานี้</label>` : ''}
      <button class="btn primary block" data-act="saveBranch" data-id="${id || ''}">${ic('check')}บันทึก</button>
      ${id ? `<div class="stack small" style="border-top:1px solid var(--line);padding-top:12px"><b>โทรศัพท์ร้านหาย?</b><span class="muted">เปลี่ยนรหัสลับแล้วจอ QR เครื่องเก่าและ QR ที่ปริ้นไว้จะใช้ไม่ได้ทันที ต้องจับคู่จอใหม่และปริ้นใหม่</span><button class="btn danger" data-act="rotate" data-id="${id}">${ic('key-round')}เปลี่ยนรหัสลับของสาขา</button></div>${S.me.role === 'owner' ? `<div class="stack small" style="border-top:1px solid var(--line);padding-top:12px"><b>ลบสาขานี้</b><span class="muted">ลบสาขาพร้อมเวร เวรว่าง คำขอ และประวัติเข้า–ออกงานของสาขานี้ทั้งหมด กู้คืนไม่ได้ · ถ้าแค่หยุดใช้ชั่วคราว ให้เอาติ๊ก "เปิดใช้งานสาขานี้" ออกแทน (ประวัติยังอยู่)</span><label class="field">พิมพ์ชื่อสาขา "${esc(br.name)}" เพื่อยืนยัน<input id="bDelName" autocomplete="off"></label><button class="btn danger" data-act="delBranch" data-id="${id}">${ic('trash-2')}ลบสาขา</button></div>` : ''}` : ''}`);
  }
  function memberSheet(id) {
    const m = S.members.find((x) => x.id === id) || { display_name: '', role: 'pharmacist', employment: 'parttime', home_branch_id: '', color: TONES[S.members.length % TONES.length], active: true };
    sheet(id ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน', `
      <label class="field">ชื่อที่แสดง<input id="mName" value="${esc(m.display_name)}" placeholder="เช่น ภก.ดนัย"></label>
      <div class="fields"><label class="field">ตำแหน่ง<select id="mRole"><option value="pharmacist">เภสัชกร</option><option value="assistant">ผู้ช่วยเภสัช</option><option value="manager">ผู้จัดการ (ดูแลร้านได้)</option>${S.me.role === 'owner' ? '<option value="owner">เจ้าของร่วม</option>' : ''}</select></label>
        <label class="field">การจ้าง<select id="mEmp"><option value="parttime">พาร์ทไทม์</option><option value="fulltime">ประจำ</option></select></label></div>
      <div class="fields"><label class="field">สาขาหลัก<select id="mBranch"><option value="">— ไม่ระบุ —</option>${S.branches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <label class="field">ค่าจ้าง/ชม. (บาท)<input id="mRate" type="number" min="0" step="5" value="${S.pay[m.id] ?? ''}" placeholder="พาร์ทไทม์ หรือเวรพิเศษ/OT ของ พนักงานประจำ"></label></div>
      <label class="row small"><input type="checkbox" id="mFree" ${m.clock_free ? 'checked' : ''}> ไม่ต้องสแกนเข้า–ออกงาน (เช่น คนที่เปิด–ปิดร้านประจำ ไม่คิดค่าจ้างรายชั่วโมง)</label>
      ${S.branches.length > 1 ? `<div class="stack small" style="gap:4px"><b>สาขาที่ทำได้</b><span class="tiny muted">ใช้กับ พาร์ทไทม์: เห็นและได้แจ้งเตือนเวรว่างเฉพาะสาขาที่ติ๊ก · ไม่ติ๊กเลย = ทุกสาขา</span><div class="row" style="flex-wrap:wrap;gap:10px">${S.branches.map((b) => `<label class="row small"><input type="checkbox" data-mb="${b.id}" ${(m.branch_ids || []).includes(b.id) ? 'checked' : ''}> ${esc(b.name)}</label>`).join('')}</div></div>` : ''}
      <div class="stack small" style="gap:4px"><b>โควตาวันลาต่อปี (ไม่บังคับ)</b><div class="row" style="gap:6px">${['AL', 'SL', 'PL'].map((k) => `<label class="field" style="flex:1">${MARK[k]}<input type="number" min="0" step="0.5" data-lq="${k}" value="${(m.leave_quota || {})[k] ?? ''}" placeholder="—"></label>`).join('')}</div></div>
      <label class="row small"><input type="checkbox" id="mNotify" ${m.notify !== false ? 'checked' : ''}> ส่งแจ้งเตือนทาง LINE ให้คนนี้</label>
      <label class="field">สีประจำตัว<select id="mColor">${TONES.map((t) => `<option value="${t}">${TONE_TH[t]}</option>`).join('')}</select></label>
      ${id ? `<label class="row small"><input type="checkbox" id="mActive" ${m.active ? 'checked' : ''}> ยังทำงานอยู่ (เอาออกเพื่อปิดการเข้าถึง)</label>` : `<p class="small muted">บันทึกแล้วจะได้รหัสเชิญ 8 ตัว ส่งให้พนักงานใส่ในแอปครั้งเดียว</p>`}
      <button class="btn primary block" data-act="saveMember" data-id="${id || ''}">${ic('check')}บันทึก</button>`);
    document.getElementById('mRole').value = m.role === 'owner' && S.me.role !== 'owner' ? 'manager' : m.role;
    document.getElementById('mEmp').value = m.employment === 'owner' ? 'fulltime' : m.employment;
    document.getElementById('mBranch').value = m.home_branch_id || '';
    document.getElementById('mColor').value = tone(m.color);
  }

  // ---------- STAFF ----------
  const myShifts = () => S.shifts.filter((s) => s.member_id === S.me.member_id);
  const myClaim = (oid) => S.claims.find((c) => c.open_shift_id === oid && c.status === 'pending');
  const conflictFor = (o) => myShifts().find((s) => s.work_date === o.work_date && mins(s.start_time) < mins(o.end_time) && mins(o.start_time) < mins(s.end_time));
  const canBranch = (m, b) => !m || m.employment !== 'parttime' || !m.branch_ids || !m.branch_ids.length || m.branch_ids.includes(b);
  const openForMe = () => S.open.filter((o) => o.work_date >= today() && canBranch(M(S.me.member_id), o.branch_id));

  // ---------- สัปดาห์นี้ (แถบ 7 วัน + ชั่วโมง) ----------
  function workedMin(att) {
    let m = 0, inAt = null;
    for (const a of att) { if (a.kind === 'in') inAt = new Date(a.at); else if (inAt) { m += (new Date(a.at) - inAt) / 6e4; inAt = null; } }
    if (inAt && isToday(inAt.toISOString())) m += (Date.now() - inAt) / 6e4;
    return Math.round(m);
  }
  function weekCard() {
    const t = today(), ws = addDays(t, -dow(t)), mine = myShifts();
    let cells = '', sch = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i), ss = mine.filter((x) => x.work_date === d), lv = ss.some((s) => S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending'));
      ss.forEach((s) => { sch += mins(s.end_time) - mins(s.start_time); });
      cells += `<div class="${ss.length ? 'on' : ''} ${d === t ? 'today' : ''} ${lv ? 'lv' : ''}"><b>${DOW[i].replace('.', '')}</b>${ss.length ? ss.map((s) => `${t5(s.start_time)}<br>${t5(s.end_time)}`).join('<br>') : markOf(S.me.member_id, d) ? `<b style="color:var(--lilac-deep)">${MARK_S[markOf(S.me.member_id, d).kind]}</b>` : 'ไม่มี<br>เวร'}</div>`;
    }
    const wk = workedMin((S.myAtt || []).filter((a) => todayStr(S.tz, new Date(a.at)) >= ws)), pct = sch ? Math.min(100, wk / sch * 100) : (wk ? 100 : 0);
    const fmt = (m) => `${Math.floor(m / 60)} ชม.${m % 60 ? ' ' + (m % 60) + ' น.' : ''}`;
    return `<div class="card"><div class="between"><h3>สัปดาห์นี้</h3><span class="tiny muted">${dShort(ws)} – ${dShort(addDays(ws, 6))}</span></div><div class="wk">${cells}</div>
      ${M(S.me.member_id).clock_free ? '' : `<div class="between small"><span><b style="color:var(--teal-deep)">${fmt(wk)}</b> <span class="muted">ทำแล้ว</span></span><span class="muted">ตามตาราง ${fmt(sch)}</span></div><div class="hbar"><i class="${wk > sch && sch ? 'over' : ''}" style="width:${pct}%"></i></div>`}</div>`;
  }
  function staffHome() {
    const me = M(S.me.member_id), t = today(), mine = myShifts().filter((s) => s.work_date === t), on = inNow(S.myLast), free = me.clock_free && !on;
    const s0 = mine[0], night = s0 ? mins(s0.start_time) >= 900 : nowMins(S.tz) >= 17 * 60;
    let h = `<div class="between"><div><span class="small muted">${greet(S.tz)}</span><h1>คุณ${esc(shortName(S.me.display_name))}</h1></div>${avatar(S.me.display_name, me.color, 'lg', S.profile.picture)}</div>`;
    h += `<div class="shift-hero ${night ? 'night' : ''}"><div class="between"><span class="small" style="opacity:.9">${s0 ? 'เวรวันนี้ · ' + esc(B(s0.branch_id).name) : 'วันนี้ไม่มีเวรในตาราง'}</span>${on ? `<span class="pill">${ic('check')}เข้างานแล้ว ${fmtTime(S.myLast.at, S.tz)}</span>` : s0 ? (() => { const st = statusOf(s0, S.myLast); return `<span class="pill">${ic(st.i)}${st.t}</span>`; })() : ''}</div>
      <div class="time">${s0 ? `${t5(s0.start_time)} – ${t5(s0.end_time)}` : hm(nowMins(S.tz))}</div>
      ${free ? `<span class="small" style="opacity:.9;text-align:center">${ic('user-check')} คุณไม่ต้องสแกนเข้า–ออกงาน เจ้าของร้านตั้งไว้ให้แล้ว</span>` : on ? `<textarea id="note" placeholder="ฝากถึงคนเข้าเวรถัดไป (ไม่บังคับ) เช่น ยาใกล้หมด คนไข้นัดรับยา"></textarea><button class="go" data-act="scan" data-kind="out">${ic('log-out', 'ic-lg')}ออกงาน</button>`
        : `<button class="go" data-act="scan" data-kind="in">${ic('scan-line', 'ic-lg')}เข้างาน</button><span class="tiny" style="opacity:.9;text-align:center">${!s0 && S.org.require_shift && me.role !== 'owner' ? 'วันนี้ไม่มีเวร จะสแกนเข้างานได้เมื่อเจ้าของร้านเพิ่มเวรให้' : 'สแกน QR บนจอร้าน'}</span>`}</div>`;
    h += weekCard() + friendBanner() + swapCards();
    if (!me.clock_free && forgotOut(S.myLast)) h += `<div class="card" style="flex-direction:row;align-items:center;border:1.5px solid var(--warn)"><span class="icon-chip t-sun">${ic('alarm-clock')}</span><span class="grow small"><b>ลืมกดออกงานเมื่อ${dShort(todayStr(S.tz, new Date(S.myLast.at)))}</b><br>วันนั้นยังไม่ถูกนับชั่วโมง กดขอแก้เวลาออกงานเพื่อให้เจ้าของอนุมัติ</span><button class="btn" data-act="fixSheet" data-kind="out" data-date="${todayStr(S.tz, new Date(S.myLast.at))}">ขอแก้</button></div>`;
    const bId = s0?.branch_id || me.home_branch_id;
    const notes = S.handover.filter((n) => (!bId || n.branch_id === bId) && Date.now() - new Date(n.created_at).getTime() < 3 * 86400e3).slice(0, 3);
    if (notes.length) h += `<div class="card"><div class="row"><span class="icon-chip t-sun">${ic('notebook-pen')}</span><h3>บันทึกส่งเวรล่าสุด</h3></div>${notes.map((n) => `<div class="stack" style="gap:2px"><span class="small">${esc(n.body)}</span><span class="tiny muted">${esc(M(n.member_id).display_name)} · ${dShort(todayStr(S.tz, new Date(n.created_at)))} ${fmtTime(n.created_at, S.tz)}</span></div>`).join('')}</div>`;
    if (isPharm(me)) { const n = openForMe().filter((o) => !conflictFor(o) && !myClaim(o.id)).length; if (n) h += `<button class="card" data-act="tab" data-tab="open" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-coral">${ic('megaphone')}</span><span class="grow"><b>มีเวรว่าง ${n} เวรที่รับได้</b><br><span class="small muted">แตะเพื่อดูและกดรับ</span></span>${ic('chevron-right')}</button>`; }
    const up = myShifts().filter((s) => s.work_date > addDays(t, 6 - dow(t))).slice(0, 4);
    if (up.length) h += `<div class="card"><h3>เวรถัดไป</h3>${up.map((s) => `<div class="between small"><span>${dShort(s.work_date)} · ${esc(B(s.branch_id).name)}</span><span class="muted">${t5(s.start_time)}–${t5(s.end_time)}</span></div>`).join('')}</div>`;
    const pf = S.fixes.filter((f) => f.status === 'pending').length;
    h += `<div class="between small"><button class="link" data-act="fixSheet">${ic('alarm-clock')} ลืมลงเวลา? ขอแก้เวลา</button>${pf ? `<span class="pill warn">รออนุมัติ ${pf}</span>` : ''}</div>`;
    return h;
  }
  function staffCal() {
    const me = M(S.me.member_id), [a, b] = monthRange(S.month), t = today(), canAvail = isPharm(me) && me.employment === 'parttime';
    const availSet = S.ptMode === 'avail' && S.draft ? S.draft : new Set(S.avail.filter((x) => x.member_id === S.me.member_id).map((x) => x.work_date));
    let g = DOW.map((x) => `<div class="dow">${x.replace('.', '')}</div>`).join('');
    for (let i = 0; i < dow(a); i++) g += `<div class="mcell blank"></div>`;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const s = myShifts().find((x) => x.work_date === d), lv = s && S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending');
      let style = '', cls = '';
      if (lv) style = 'background:var(--warn-soft);color:var(--warn)';
      else if (s) style = `background:var(--${tone(me.color)});color:${tone(me.color) === 'sun' ? '#3B2700' : '#fff'};box-shadow:none`;
      if (canAvail && availSet.has(d)) cls += ' avail';
      if (d === S.sel && S.ptMode !== 'avail') cls += ' sel';
      const dot = isPharm(me) && d >= t && S.open.some((o) => o.work_date === d && !conflictFor(o) && canBranch(me, o.branch_id));
      g += `<button class="mcell ${d < t ? 'past' : ''} ${d === t ? 'today' : ''} ${cls}" style="${style}" data-act="${S.ptMode === 'avail' ? 'toggleAvail' : 'pick'}" data-d="${d}" aria-label="${dLong(d)}">${Number(d.slice(8))}${dot ? '<span class="od"></span>' : ''}</button>`;
    }
    if (S.calView === 'list' && S.ptMode !== 'avail') return viewSeg() + `<div class="card">${agenda(false)}</div>`;
    let h = viewSeg() + `<div class="between">${monthNav()}</div>`;
    if (canAvail) h += `<div class="seg"><button data-act="ptMode" data-m="view" aria-pressed="${S.ptMode !== 'avail'}">${ic('eye')}ดูเวร</button><button data-act="ptMode" data-m="avail" aria-pressed="${S.ptMode === 'avail'}">${ic('hand')}แจ้งวันว่าง</button></div>`;
    h += `<div class="card"><div class="mini">${g}</div><div class="legend"><span><i style="background:var(--${tone(me.color)})"></i>เวรของฉัน</span>${canAvail ? '<span><i style="box-shadow:inset 0 0 0 2px var(--brand)"></i>แจ้งว่าว่าง</span>' : ''}${isPharm(me) ? '<span><i style="background:var(--coral);border-radius:50%"></i>มีเวรว่าง</span>' : ''}<span><i style="background:var(--warn-soft)"></i>ขอลาแล้ว</span></div></div>`;
    if (S.ptMode === 'avail' && canAvail) {
      const mine = new Set(S.avail.filter((x) => x.member_id === S.me.member_id).map((x) => x.work_date)), dr = S.draft || mine;
      const changed = [...dr].some((x) => !mine.has(x)) || [...mine].some((x) => !dr.has(x) && x >= t);
      return h + `<div class="card small" style="flex-direction:row;align-items:center"><span class="icon-chip t-brand">${ic('hand')}</span>แตะเลือกวันที่สะดวกมาทำงาน (แตะซ้ำเพื่อเอาออก) แล้วกด "ยืนยันวันว่าง"</div>
        <div class="card" style="position:sticky;bottom:84px;z-index:5;flex-direction:row;align-items:center;gap:8px;border:1.5px solid var(--brand)"><span class="grow small">เลือกไว้ <b>${[...dr].filter((x) => x >= t).length}</b> วันในอนาคต${changed ? ' · <b>ยังไม่ได้บันทึก</b>' : ''}</span>${changed ? `<button class="btn" data-act="cancelAvail">ยกเลิก</button>` : ''}<button class="btn primary" data-act="saveAvail" ${changed ? '' : 'disabled'}>${ic('check')}ยืนยันวันว่าง</button></div>`;
    }
    const d = S.sel;
    h += `<h3>${dLong(d)}</h3>`;
    for (const s of myShifts().filter((x) => x.work_date === d)) {
      const lv = S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending');
      h += `<div class="card"><div class="between"><b>เวรของฉัน · ${esc(B(s.branch_id).name)}</b><span>${t5(s.start_time)}–${t5(s.end_time)}</span></div>${lv ? `<span class="pill warn">${ic('hourglass')}ขอลาแล้ว รออนุมัติ</span>` : (S.swaps || []).some((w) => PEND(w) && (w.shift_id === s.id || w.to_shift_id === s.id)) ? `<span class="pill warn">${ic('repeat')}มีคำขอแลกเวรค้างอยู่</span>` : d >= t ? `<div class="row" style="flex-wrap:wrap">${`<button class="btn" data-act="leaveSheet" data-id="${s.id}">${ic('calendar-x')}ขอลา</button>`}<button class="btn" data-act="swapSheet" data-id="${s.id}">${ic('repeat')}แลก / ยกเวร</button></div>` : ''}</div>`;
    }
    const myMk = markOf(S.me.member_id, d); if (myMk) h += `<div class="card" style="flex-direction:row;align-items:center"><span class="icon-chip t-lilac">${ic('calendar-off')}</span><span class="grow small"><b>${MARK[myMk.kind]}${Number(myMk.days) === 0.5 ? ' (ครึ่งวัน)' : ''}</b>${myMk.note ? '<br>' + esc(myMk.note) : ''}</span></div>`;
    for (const r of (S.sreqs || []).filter((x) => x.work_date === d && x.status === 'pending')) h += `<div class="card" style="flex-direction:row;align-items:center"><span class="icon-chip t-brand">${ic('hourglass')}</span><span class="grow small"><b>ขอลงเวรแล้ว รออนุมัติ</b><br>${esc(B(r.branch_id).name)} · ${t5(r.start_time)}–${t5(r.end_time)}</span><button class="btn ghost" data-act="cancelSreq" data-id="${r.id}">ยกเลิก</button></div>`;
    if (isPharm(me) && d >= t && !myShifts().some((x) => x.work_date === d) && !(S.sreqs || []).some((x) => x.work_date === d && x.status === 'pending')) h += `<button class="btn" data-act="sreqSheet" data-d="${d}">${ic('calendar-plus')}ขอลงเวรวันนี้ (เลือกสาขาและเวลา)</button>`;
    if (isPharm(me)) for (const o of S.open.filter((x) => x.work_date === d && x.work_date >= t && canBranch(me, x.branch_id))) h += openCard(o);
    const others = me.employment === 'parttime' && !S.org.pt_see_all ? [] : S.shifts.filter((x) => x.work_date === d && x.member_id !== S.me.member_id);
    if (others.length) h += `<div class="card"><b class="small">ใครอยู่ไหนวันนี้</b>${others.map((s) => { const m = M(s.member_id); return `<div class="row small">${avatar(m.display_name, m.color, 'sm')}<span class="grow">${esc(m.display_name)} · ${esc(B(s.branch_id).name)}</span><span class="muted">${t5(s.start_time)}–${t5(s.end_time)}</span></div>`; }).join('')}</div>`;
    return h;
  }
  function openCard(o) {
    const me = M(S.me.member_id), c = conflictFor(o), mine = myClaim(o.id), hrs = (mins(o.end_time) - mins(o.start_time)) / 60, rate = S.pay[S.me.member_id];
    return `<div class="card"><div class="row"><div class="dateblk"><b>${Number(o.work_date.slice(8))}</b><span class="tiny">${DOW[dow(o.work_date)]}</span></div><div class="grow"><b>${esc(B(o.branch_id).name)}</b><br><span class="small muted">${t5(o.start_time)}–${t5(o.end_time)} · ${hrs} ชม.${rate && me.employment === 'parttime' ? ` · ≈ ฿${baht(hrs * rate)}` : ''}</span>${o.reason ? `<br><span class="tiny muted">${esc(o.reason)}</span>` : ''}</div></div>
      ${mine ? `<span class="pill warn">${ic('hourglass')}ส่งคำขอแล้ว รอเจ้าของอนุมัติ</span>` : c ? `<button class="btn" disabled>${ic('ban')}ติดเวรที่${esc(B(c.branch_id).name)}</button>` : `<button class="btn primary" data-act="claim" data-id="${o.id}">${ic('hand')}รับเวรนี้</button>`}</div>`;
  }
  function staffOpen() {
    const list = openForMe();
    return `<h1>เวรว่าง</h1><button class="btn" data-act="sreqSheet">${ic('calendar-plus')}ขอลงเวรเอง (เลือกวัน สาขา เวลา)</button>`+`<p class="small muted">กดรับแล้วรอเจ้าของร้านอนุมัติ</p>` + (list.length ? list.map(openCard).join('') : `<div class="card"><div class="empty">${ic('coffee', 'ic-lg')}<b>ตอนนี้ไม่มีเวรว่าง</b><span class="small">มีเวรใหม่เมื่อไรจะขึ้นที่นี่</span></div></div>`);
  }
  function staffMoney() {
    const [a, b] = monthRange(S.month), t = today();
    const past = myShifts().filter((s) => s.work_date >= a && s.work_date <= b && s.work_date < t).reverse();
    return `<div class="between">${monthNav()}</div><div id="myhours">${skel()}</div>
      <div class="card"><b class="small">เวรในเดือนนี้ที่ผ่านมา</b>${past.length ? past.map((s) => `<div class="between small"><span>${dShort(s.work_date)} · ${esc(B(s.branch_id).name)}</span><span class="muted">${t5(s.start_time)}–${t5(s.end_time)}</span></div>`).join('') : '<span class="small muted">ยังไม่มี</span>'}</div>
      <p class="tiny muted">ยอดคิดจากเวลาเข้า–ออกงานจริง ค่าจ้างต่อชั่วโมงตั้งโดยเจ้าของร้าน</p>`;
  }

  // ---------- scan & clock ----------
  function extractPS(text) {
    if (!text) return null;
    if (text.startsWith('PS1|')) return text;
    try {
      const u = new URL(text); let p = u.searchParams.get('ps');
      if (!p && u.searchParams.get('liff.state')) p = new URL(u.searchParams.get('liff.state'), 'https://x.invalid').searchParams.get('ps');
      return p && p.startsWith('PS1|') ? p : null;
    } catch (_) { return null; }
  }
  async function scanQR() {
    if (liff.isInClient() && liff.isApiAvailable && liff.isApiAvailable('scanCodeV2')) {
      try { const r = await liff.scanCodeV2(); return r && r.value; } catch (e) { toast('เปิดกล้องไม่ได้: ' + errMsg(e), 'err'); return null; }
    }
    return cameraScan();
  }
  function cameraScan() {
    return new Promise(async (resolve) => {
      layer(`<div class="overlay dark"><b style="font-size:17px">เล็งกล้องที่ QR บนโทรศัพท์ร้าน</b><div class="vf"><video id="vid" playsinline muted></video><span class="line"></span></div><button class="btn" id="vidCancel">${ic('x')}ยกเลิก</button></div>`);
      let stream, done = false;
      const stop = (v) => { if (done) return; done = true; if (stream) stream.getTracks().forEach((t) => t.stop()); closeLayer(); resolve(v); };
      document.getElementById('vidCancel').onclick = () => stop(null);
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
      catch (e) { stop(null); toast('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง', 'err'); return; }
      const v = document.getElementById('vid'); v.srcObject = stream; await v.play().catch(() => {});
      const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
      const loop = () => {
        if (done) return;
        if (v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, c.width, c.height); const r = window.jsQR && jsQR(img.data, c.width, c.height); if (r && r.data) return stop(r.data); }
        requestAnimationFrame(loop);
      };
      loop();
    });
  }
  function handlePS(ps) {
    if (!inNow(S.myLast)) return doClock(ps, 'in');
    S.outPS = ps;
    sheet('ออกงาน', `<p class="muted">คุณเข้างานตั้งแต่ ${fmtTime(S.myLast.at, S.tz)} ต้องการออกงานตอนนี้ใช่ไหม</p><label class="field">ฝากถึงคนเข้าเวรถัดไป (ไม่บังคับ)<textarea id="note2" placeholder="เช่น ยาใกล้หมด คนไข้นัดรับยา"></textarea></label><button class="btn primary block" data-act="confirmOut">${ic('log-out')}ยืนยันออกงาน</button>`);
  }
  async function doClock(ps, kind, note) {
    layer(`<div class="overlay"><div class="spinner"></div><b>กำลังตรวจตำแหน่งและบันทึกเวลา…</b><span class="small muted">ถ้ามีหน้าต่างขอใช้ตำแหน่ง กด "อนุญาต"</span></div>`);
    try {
      const pos = await getPos();
      const r = await rpc('clock', { p_payload: ps, p_kind: kind, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_acc: pos?.acc ?? null });
      if (kind === 'out' && note && note.trim()) { try { await rpc('post_handover', { p_branch: ps.split('|')[1], p_body: note.trim() }); } catch (_) { /* ไม่ขัดการออกงาน */ } }
      layer(`<div class="overlay" data-act="close">${confettiHTML()}<svg class="okmark" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="var(--ok-soft)" stroke="var(--ok)" stroke-width="6"/><path d="M38 62l15 15 30-32" fill="none" stroke="var(--ok)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>${kind === 'in' ? 'เข้างานเรียบร้อย!' : 'ออกงานเรียบร้อย!'}</h1><div style="font:500 36px var(--display)">${fmtTime(r.at, S.tz)}</div><span class="muted">${esc(r.branch)} · ${kind === 'in' ? 'ขอให้วันนี้เป็นวันที่ดีนะ' : 'เดินทางกลับปลอดภัยนะ'}</span>${r.far ? `<span class="pill warn">${ic('map-pin-off')}ตำแหน่งห่างร้าน ${fmtDist(r.distance_m)} · เจ้าของร้านจะเห็นธงเตือน</span>` : ''}${!pos ? `<span class="pill warn">${ic('map-pin-off')}ไม่ได้ส่งตำแหน่ง · เจ้าของร้านจะเห็นว่าไม่มีพิกัด</span>` : ''}</div>`);
      if (!pos) setTimeout(() => { closeLayer(); gpsHelp(); }, 2500); else setTimeout(closeLayer, 2800);
      await refresh();
    } catch (e) { closeLayer(); const m = errMsg(e); if (/GPS|ตำแหน่ง/.test(m) && S.gpsErr) gpsHelp(); toast(m, 'err'); }
  }

  // ---------- actions ----------
  const busyBtn = (el, on) => { if (el && el.tagName === 'BUTTON') el.disabled = on; };
  const ACT = {
    tab: (d) => { if (d.sec !== undefined) S.setSec = d.sec || null; else if (d.tab !== 'set') S.setSec = null; S.tab = d.tab; if (S.tab !== 'cal') S.ptMode = 'view'; render(); window.scrollTo(0, 0); },
    close: () => closeLayer(),
    bgClose: (d, el, e) => { if (e.target === el) closeLayer(); },
    refresh: () => refresh(),
    month: async (d) => { S.month = shiftMonth(S.month, Number(d.n)); const [a] = monthRange(S.month); S.sel = S.month === today().slice(0, 7) ? today() : a; await refresh(); },
    goIssue: (d) => { closeLayer(); S.tab = 'cal'; S.sel = d.d; if (S.calView === 'list') S.calView = 'month'; const m = d.d.slice(0, 7); if (m !== S.month) { S.month = m; refresh().then(() => document.getElementById('day')?.scrollIntoView({ behavior: 'smooth' })); } else { render(); window.scrollTo(0, 0); if (S.calView !== 'grid') document.getElementById('day')?.scrollIntoView({ behavior: 'smooth' }); } },
    issuesAll: (d) => { const t = today(), a = d.a || t, b = d.b || addDays(t, 13), list = scheduleIssues(a, b); sheet(`ตรวจตาราง · ${dShort(a < t ? t : a)}–${dShort(b)}`, list.length ? `<div class="stack" style="gap:6px">${list.map((x) => issueRow(x)).join('')}</div>` : '<p class="muted">ไม่พบจุดที่ต้องแก้</p>'); },
    saveRules: async (d, el) => { busyBtn(el, true); const rules = { cover: document.getElementById('rCover').checked, cover_mgr: document.getElementById('rMgr').checked, week_h: Number(val('rWeek')), streak: Number(val('rStreak')), avail: document.getElementById('rAvail').checked };
      try { await q(sb.from('orgs').update({ rules }).eq('id', S.me.org_id)); S.org.rules = rules; toast('บันทึกแล้ว'); render(); } catch (e) { busyBtn(el, false); toast(/rules/.test(errMsg(e)) ? 'ต้องรัน SQL อัปเดต 010 ก่อน' : errMsg(e), 'err'); } },
    pick: (d) => { S.sel = d.d; render(); if (S.isOwner && innerWidth < 900) document.getElementById('day')?.scrollIntoView({ behavior: 'smooth' }); },
    setSec: (d) => { S.setSec = d.v || null; render(); window.scrollTo(0, 0); },
    dismissSetup: () => { try { localStorage.setItem('ps_setup_hide_' + S.me.org_id, '1'); } catch (_) {} render(); },
    payView: (d) => { S.payView = d.v; render(); },
    exportReport: async (d, el) => {
      busyBtn(el, true);
      try {
        if (!window.XLSX) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = () => no(new Error('โหลดตัวสร้าง Excel ไม่สำเร็จ')); document.head.appendChild(sc); });
        const rows = await reportData(), r1 = (n) => Math.round(n * 100) / 100;
        const A = [['ชื่อ', 'การจ้าง', 'เวรตามตาราง', 'แยกสาขา', 'ชม.ตามตาราง', 'วันมาจริง', 'ชม.จริง', 'ชม.คิดเงิน', 'OT รอ (ชม.)', 'ตรงเวลา', 'สายในเกณฑ์', 'สายเกินเกณฑ์', 'วันหยุด', 'ลาพักร้อน', 'นักขัตฤกษ์', 'ลาป่วย', 'ลากิจ', 'ลาพักร้อนทั้งปี', 'โควตาลาพักร้อน', 'ลาป่วยทั้งปี', 'โควตาลาป่วย', 'ลากิจทั้งปี', 'โควตาลากิจ']];
        rows.forEach((r) => A.push([r.m.display_name, EMP[r.m.employment] || '', r.shifts, Object.entries(r.byB).map(([k, v]) => k + ' ' + v).join(', '), r1(r.schH), r.days, r1(r.act), r1(r.paid), r1(r.ot), r.L.ok, r.L.warn, r.L.alert, r.mon.OFF, r.mon.AL, r.mon.HD, r.mon.SL, r.mon.PL, r.yr.AL, r.q.AL ?? '', r.yr.SL, r.q.SL ?? '', r.yr.PL, r.q.PL ?? '']));
        const [a, b] = monthRange(S.month), days = []; for (let x = a; x <= b; x = addDays(x, 1)) days.push(x);
        const G = [['ชื่อ', ...days.map((x) => Number(x.slice(8)))]];
        rows.forEach((r) => G.push([r.m.display_name, ...days.map((x) => { const ss = S.shifts.filter((s) => s.member_id === r.m.id && s.work_date === x); if (ss.length) return ss.map(shiftCode).join('/'); const mk = markOf(r.m.id, x); return mk ? MARK_S[mk.kind] + (Number(mk.days) === 0.5 ? ' ครึ่งวัน' : '') : ''; })]));
        const wb = XLSX.utils.book_new(), w1 = XLSX.utils.aoa_to_sheet(A), w2 = XLSX.utils.aoa_to_sheet(G);
        w1['!cols'] = A[0].map((x, i) => ({ wch: i === 0 ? 20 : i === 3 ? 22 : 11 })); w2['!cols'] = [{ wch: 20 }, ...days.map(() => ({ wch: 14 }))];
        XLSX.utils.book_append_sheet(wb, w1, 'รายงาน'); XLSX.utils.book_append_sheet(wb, w2, 'ตารางเวร');
        XLSX.writeFile(wb, `PharmaShift_รายงาน_${S.month}.xlsx`);
        busyBtn(el, false); toast('ดาวน์โหลดแล้ว');
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    reqView: (d) => { S.reqView = d.v; if (d.v === 'done') S.hist = null; render(); },
    calView: (d) => { S.calView = d.v; if (d.v !== 'month') S.ptMode = 'view'; if (d.v !== 'grid') S.brush = null; render(); },
    brush: (d) => { S.brush = d.k || null; render(); if (!S.brush && S.stale) { S.stale = false; refresh(); } },
    gridCell: (d) => {
      if (S.brush) return applyCell(S.brush, d.m, d.d);
      const m = M(d.m), ss = S.shifts.filter((x) => x.member_id === d.m && x.work_date === d.d), mk = markOf(d.m, d.d), curCode = ss[0] ? shiftCode(ss[0]) : mk ? MARK_S[mk.kind] : '';
      const rq = (S.sreqs || []).filter((r) => r.member_id === d.m && r.work_date === d.d && r.status === 'pending');
      sheet(`${m.display_name} · ${dShort(d.d)}`, `${ss.length > 1 ? `<span class="tiny muted">วันนี้มี ${ss.length} เวร: ${ss.map(shiftCode).join(', ')} (เลือกใหม่จะแก้เวรแรก)</span>` : ''}
        ${rq.map((r) => sreqCard(r)).join('')}
        <div class="optgrid">${brushList().map((x) => `<button class="${x.label === curCode ? 'cur' : ''}" data-act="cellPick" data-k="${x.k}" data-m="${d.m}" data-d="${d.d}">${esc(x.label)}<small>${esc(x.sub)}</small></button>`).join('')}</div>
        <div class="row" style="flex-wrap:wrap">${ss[0] ? `<button class="btn" data-act="editShift" data-id="${ss[0].id}">${ic('pencil')}แก้เวลาเอง / เวรพิเศษ</button>` : `<button class="btn" data-act="cellCustom" data-m="${d.m}" data-d="${d.d}">${ic('clock')}กำหนดเวลาเอง</button>`}${mk && mk.kind !== 'OFF' ? `<button class="btn" data-act="halfMark" data-id="${mk.id}">${Number(mk.days) === 0.5 ? 'เปลี่ยนเป็นเต็มวัน' : 'เปลี่ยนเป็นครึ่งวัน'}</button>` : ''}</div>`);
    },
    cellPick: async (d) => { closeLayer(); await applyCell(d.k, d.m, d.d); },
    cellCustom: (d) => { closeLayer(); S.sel = d.d; addShiftSheet(); const w = document.getElementById('sWho'); if (w) w.value = d.m; },
    halfMark: async (d) => { const mk = S.marks.find((x) => x.id === d.id); try { await q(sb.from('day_marks').update({ days: Number(mk.days) === 0.5 ? 1 : 0.5 }).eq('id', d.id)); closeLayer(); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    decideSreq: async (d, el) => { busyBtn(el, true); try { await rpc('decide_shift_request', { p_id: d.id, p_approve: d.ok === '1' }); closeLayer(); toast(d.ok === '1' ? 'อนุมัติแล้ว ลงเวรให้แล้ว' : 'ไม่อนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    cancelSreq: async (d, el) => { busyBtn(el, true); try { await rpc('cancel_shift_request', { p_id: d.id }); toast('ยกเลิกแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    sreqSheet: (d) => {
      const me = M(S.me.member_id), brs = S.branches.filter((b) => b.active && canBranch(me, b.id)), dd = d.d || addDays(today(), 1), p0 = presets().find((p) => p.code === 'P') || presets()[0];
      if (!brs.length) return toast('ยังไม่มีสาขาที่คุณทำได้ แจ้งเจ้าของร้าน', 'err');
      sheet('ขอลงเวร', `<p class="small muted">เลือกวัน สาขา และเวลาที่สะดวก เจ้าของร้านอนุมัติแล้วจะกลายเป็นเวรของคุณ</p>
        <label class="field">วันที่<input id="rqDate" type="date" value="${dd}" min="${today()}"></label>
        <label class="field">สาขา<select id="rqBranch">${brs.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <div class="row" style="flex-wrap:wrap">${presets().map((p) => `<button class="btn" data-act="rqPreset" data-s="${p.start}" data-e="${p.end}">${esc(p.code)} ${p.start}–${p.end}</button>`).join('')}</div>
        <div class="fields"><label class="field">เริ่ม<input id="rqStart" type="time" value="${p0.start}"></label><label class="field">ถึง<input id="rqEnd" type="time" value="${p0.end}"></label></div>
        <label class="field">หมายเหตุ (ไม่บังคับ)<input id="rqNote" placeholder="เช่น ขอเลิก 20:00"></label>
        <button class="btn primary block" data-act="sendSreq">${ic('send')}ส่งคำขอลงเวร</button>`);
    },
    rqPreset: (d) => { document.getElementById('rqStart').value = d.s; document.getElementById('rqEnd').value = d.e; },
    sendSreq: async (d, el) => {
      busyBtn(el, true);
      try { await rpc('request_shift', { p_branch: val('rqBranch'), p_date: val('rqDate'), p_start: val('rqStart'), p_end: val('rqEnd'), p_note: val('rqNote') || null }); closeLayer(); toast('ส่งคำขอแล้ว รอเจ้าของร้านอนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    week: async (d) => { S.sel = addDays(S.sel, Number(d.n)); const m = S.sel.slice(0, 7); if (m !== S.month) { S.month = m; await refresh(); } else render(); },
    ptMode: (d) => { if (S.draft && d.m !== 'avail') S.draft = null; S.ptMode = d.m; render(); },
    copy: (d) => copy(d.text),
    copyInvite: (d) => { const m = M(d.id); copy(`สวัสดีครับคุณ${shortName(m.display_name)} เชิญเข้าใช้ระบบลงเวร ลงเวลาของร้าน ${S.org.name}\n1) เปิดลิงก์นี้ใน LINE: https://liff.line.me/${CFG.LIFF_ID}\n2) กด "มีรหัสเชิญจากร้าน" แล้วใส่รหัส: ${S.invites[d.id]}`); },
    profile: async () => {
      const m = M(S.me.member_id), t = today(), a = t.slice(0, 8) + '01';
      let att = [], hrs = null;
      try { att = await q(sb.from('attendance').select('kind,at,branch_id').eq('member_id', m.id).gte('at', new Date(new Date(a + 'T00:00:00+07:00').getTime()).toISOString()).order('at')); } catch (_) {}
      try { const r = await rpc('month_hours', { p_org: S.me.org_id, p_month: a }); hrs = r.find((x) => x.member_id === m.id) || null; } catch (_) {}
      const days = {}; att.filter((x) => x.kind === 'in').forEach((x) => { const d = todayStr(S.tz, new Date(x.at)); if (!days[d]) days[d] = x; });
      const L = { ok: 0, warn: 0, alert: 0 }; const hist = [];
      Object.keys(days).sort().reverse().forEach((d) => { const s = myShifts().filter((y) => y.work_date === d).sort((p, q2) => mins(p.start_time) - mins(q2.start_time))[0]; const lm = s ? mins(fmtTime(days[d].at, S.tz)) - mins(s.start_time) : null; const k = lateKind(lm); if (k) L[k]++; hist.push({ d, at: days[d].at, k, lm, b: days[d].branch_id }); });
      const brs = m.branch_ids && m.branch_ids.length ? m.branch_ids.map((b) => B(b).name).join(', ') : 'ทุกสาขา';
      sheet('โปรไฟล์ของฉัน', `<div class="row">${avatar(m.display_name, m.color, 'lg', S.profile.picture)}<div><b>${esc(m.display_name)}</b><br><span class="small muted">${esc(ROLE[m.role] || '')} · ${esc(EMP[m.employment] || '')}${m.home_branch_id ? ' · ' + esc(B(m.home_branch_id).name) : ''}</span></div></div>
        <div class="small" style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px"><span class="muted">สาขาที่ทำได้</span><span>${esc(brs)}</span><span class="muted">ลงเวลา</span><span>${m.clock_free ? 'ไม่ต้องสแกน' : 'สแกน QR ที่ร้าน'}</span>${S.pay[m.id] != null ? `<span class="muted">ค่าจ้าง/ชม.</span><span>${baht(S.pay[m.id])} บาท</span>` : ''}</div>
        <b class="small">เดือน${monthLabel(t.slice(0, 7))}</b>
        <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:6px"><div class="card" style="padding:10px;align-items:center;box-shadow:none;background:var(--ok-soft)"><b>${L.ok}</b><span class="tiny">ตรงเวลา</span></div><div class="card" style="padding:10px;align-items:center;box-shadow:none;background:var(--warn-soft)"><b>${L.warn}</b><span class="tiny">สายในเกณฑ์</span></div><div class="card" style="padding:10px;align-items:center;box-shadow:none;background:var(--coral-soft)"><b>${L.alert}</b><span class="tiny">สายเกินเกณฑ์</span></div></div>
        ${hrs ? `<div class="between small"><span class="muted">เวลาลงจริง</span><b>${Number(hrs.actual_hours).toFixed(2)} ชม.</b></div>${Number(hrs.amount) || Number(hrs.hours) ? `<div class="between small"><span class="muted">ชั่วโมงคิดเงิน · ยอด</span><b>${Number(hrs.hours).toFixed(2)} ชม. · ฿${baht(hrs.amount)}</b></div>` : ''}` : ''}
        ${(() => { const y = (S.yearMarks || []).filter((x) => x.member_id === m.id), qq = m.leave_quota || {}; const used = (k) => y.filter((x) => x.kind === k).reduce((s2, x) => s2 + Number(x.days), 0); const ks = ['AL', 'SL', 'PL', 'HD'].filter((k) => used(k) || qq[k] != null); return ks.length ? `<b class="small">วันลาปีนี้</b><div class="small">${ks.map((k) => `${MARK[k]} <b>${used(k)}</b>${qq[k] != null ? '/' + qq[k] : ''}`).join(' · ')}</div>` : ''; })()}
        <b class="small">ประวัติเข้างานเดือนนี้</b>
        ${hist.length ? hist.slice(0, 15).map((x) => `<div class="between small"><span>${dShort(x.d)} · ${esc(B(x.b).name || '')}</span><span>${fmtTime(x.at, S.tz)} ${x.k ? `<span class="pill ${x.k}">${LATE_TH[x.k]}${x.lm > 0 ? ' ' + x.lm + ' น.' : ''}</span>` : '<span class="tiny muted">ไม่มีเวร</span>'}</span></div>`).join('') : '<span class="small muted">ยังไม่มีการเข้างานเดือนนี้</span>'}
        <button class="btn ghost" data-act="menu">${ic('settings')}บัญชีและร้าน</button>`);
    },
    menu: () => {
      sheet('บัญชีของฉัน', `<div class="row">${avatar(S.profile.name, 'brand', 'lg', S.profile.picture)}<div><b>${esc(S.profile.name)}</b><br><span class="small muted">เข้าสู่ระบบด้วย LINE</span></div></div>
        <button class="btn primary" data-act="profile">${ic('user-round')}โปรไฟล์และประวัติเข้างานของฉัน</button>
        ${S.orgs.length > 1 ? `<b class="small">สลับร้าน</b>${S.orgs.map((o) => `<button class="btn ${o.org_id === S.me.org_id ? 'primary' : ''}" data-act="switchOrg" data-id="${o.org_id}">${ic('store')}${esc(o.org_name)} · ${esc(ROLE[o.role])}</button>`).join('')}` : ''}
        <label class="field">เข้าร่วมร้านอื่นด้วยรหัสเชิญ<input id="inv" maxlength="12" placeholder="รหัส 8 ตัว"></label><button class="btn" data-act="acceptInvite">${ic('log-in')}เข้าร่วม</button>
        <button class="btn ghost" data-act="newOrgSheet">${ic('plus')}เปิดร้านใหม่</button>
        <button class="btn danger" data-act="logout">${ic('log-out')}ออกจากระบบ</button>`);
    },
    switchOrg: async (d) => { closeLayer(); loading('กำลังสลับร้าน…'); S.tab = 'home'; await loadOrgs(d.id); },
    newOrgSheet: () => sheet('เปิดร้านใหม่', `<label class="field">ชื่อร้าน<input id="orgName"></label><label class="field">ชื่อที่แสดงของคุณ<input id="ownerName" value="${esc(S.profile.name)}"></label><button class="btn primary block" data-act="createOrg">${ic('plus')}สร้างร้าน</button>`),
    logout: async () => { await sb.auth.signOut(); localStorage.removeItem('ps_org'); if (liff.isLoggedIn()) liff.logout(); location.reload(); },
    acceptInvite: async (d, el) => {
      const code = (val('inv') || '').trim(); if (!code) return toast('กรุณาใส่รหัสเชิญ', 'err');
      busyBtn(el, true);
      try { const r = await rpc('accept_invite', { p_code: code }); closeLayer(); toast('เข้าร่วมร้านเรียบร้อย'); S.tab = 'home'; await loadOrgs(r.org_id); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    createOrg: async (d, el) => {
      const name = (val('orgName') || '').trim(), owner = (val('ownerName') || '').trim() || S.profile.name;
      if (!name) return toast('กรุณาใส่ชื่อร้าน', 'err');
      busyBtn(el, true);
      try { const id = await rpc('create_org', { p_name: name, p_owner_name: owner }); closeLayer(); S.tab = 'set'; await loadOrgs(id); toast('สร้างร้านแล้ว เพิ่มสาขาแรกได้เลย'); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    scan: async (d) => { const note = val('note'); const text = await scanQR(); if (!text) return; const ps = extractPS(text); if (!ps) return toast('QR นี้ไม่ใช่ QR ลงเวลาของร้าน', 'err'); if (d.kind === 'out' || inNow(S.myLast)) return doClock(ps, 'out', note); return doClock(ps, 'in'); },
    confirmOut: () => { const note = val('note2'); doClock(S.outPS, 'out', note); },
    claim: async (d, el) => { busyBtn(el, true); try { await rpc('claim_open_shift', { p_open: d.id }); toast('ส่งคำขอรับเวรแล้ว รอเจ้าของอนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    toggleAvail: (d) => {
      if (d.d < today()) return;
      if (!S.draft) S.draft = new Set(S.avail.filter((x) => x.member_id === S.me.member_id).map((x) => x.work_date));
      if (S.draft.has(d.d)) S.draft.delete(d.d); else S.draft.add(d.d);
      const y = window.scrollY; render(); window.scrollTo(0, y);
    },
    cancelAvail: () => { S.draft = null; render(); },
    saveAvail: async (d, el) => {
      const t = today(), mine = new Set(S.avail.filter((x) => x.member_id === S.me.member_id).map((x) => x.work_date)), dr = S.draft || mine;
      const add = [...dr].filter((x) => !mine.has(x) && x >= t), del = [...mine].filter((x) => !dr.has(x) && x >= t);
      busyBtn(el, true);
      try {
        if (add.length) await q(sb.from('availability').insert(add.map((w) => ({ member_id: S.me.member_id, work_date: w }))));
        if (del.length) await q(sb.from('availability').delete().eq('member_id', S.me.member_id).in('work_date', del));
        S.draft = null; toast(`บันทึกวันว่างแล้ว (${[...dr].filter((x) => x >= t).length} วัน)`); await refresh();
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    testGps: async (d, el) => { busyBtn(el, true); const p = await getPos(); busyBtn(el, false); if (p) { closeLayer(); toast(`อ่านตำแหน่งได้แล้ว (แม่นยำ ±${Math.round(p.acc)} ม.)`); } else toast(S.gpsErr === 'denied' ? 'ยังถูกปิดสิทธิ์อยู่ ทำตามขั้นตอนด้านบนก่อน' : 'ยังอ่านตำแหน่งไม่ได้ ลองออกไปที่โล่งหรือเปิด Wi-Fi', 'err'); },
    leaveSheet: (d) => { const s = S.shifts.find((x) => x.id === d.id); sheet('ขอลา · ' + dShort(s.work_date), `<p class="small muted">${esc(B(s.branch_id).name)} · ${t5(s.start_time)}–${t5(s.end_time)}</p><label class="field">ประเภทการลา<select id="lvType"><option value="PL">ลากิจ</option><option value="SL">ลาป่วย</option><option value="AL">ลาพักร้อน</option></select></label><label class="row small"><input type="checkbox" id="lvHalf"> ลาครึ่งวัน</label><label class="field">เหตุผล (ไม่บังคับ)<input id="lvReason" placeholder="เช่น ธุระครอบครัว"></label>${leaveBal()}<span class="tiny muted">ลาวันนี้ได้เฉพาะลาป่วย · ลาประเภทอื่นต้องขอล่วงหน้า</span><button class="btn primary block" data-act="sendLeave" data-id="${s.id}">${ic('send')}ส่งคำขอลา</button>`); },
    sendLeave: async (d, el) => { busyBtn(el, true); try { await rpc('request_leave', { p_shift: d.id, p_reason: val('lvReason') || null, p_type: val('lvType') || 'PL', p_half: !!document.getElementById('lvHalf')?.checked }); closeLayer(); toast('ส่งคำขอลาแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    fixSheet: (d = {}) => {
      const me = M(S.me.member_id), s0 = myShifts().find((s) => s.work_date === today());
      sheet('ขอแก้เวลา', `<p class="small muted">ใช้เมื่อลืมสแกน เจ้าของร้านจะตรวจและอนุมัติ</p>
        <label class="field">สาขา<select id="fxB">${S.branches.map((b) => `<option value="${b.id}" ${(s0?.branch_id || me.home_branch_id) === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
        <div class="fields"><label class="field">ประเภท<select id="fxK"><option value="in">เข้างาน</option><option value="out" ${d.kind === 'out' ? 'selected' : ''}>ออกงาน</option></select></label><label class="field">วันที่<input id="fxD" type="date" value="${d.date || today()}" max="${today()}"></label><label class="field">เวลา<input id="fxT" type="time" value="${s0 ? t5(s0.start_time) : '09:00'}"></label></div>
        <label class="field">เหตุผล<input id="fxR" placeholder="เช่น ลืมสแกนตอนเข้างาน"></label>
        <button class="btn primary block" data-act="sendFix">${ic('send')}ส่งคำขอ</button>`);
    },
    sendFix: async (d, el) => {
      const at = `${val('fxD')}T${val('fxT')}:00+07:00`;
      busyBtn(el, true);
      try { await rpc('request_fix', { p_branch: val('fxB'), p_kind: val('fxK'), p_at: at, p_reason: val('fxR') }); closeLayer(); toast('ส่งคำขอแก้เวลาแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    // owner
    addShift: () => addShiftSheet(),
    saveShift: async (d, el) => {
      const b = val('sBranch'), who = val('sWho'), st = val('sStart'), en = val('sEnd'), note = (val('sNote') || '').trim() || null, rep = document.getElementById('sRepeat')?.checked, paid = document.getElementById('sPaid').checked;
      if (!st || !en || en <= st) return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'err');
      if (d.id || d.open) {
        busyBtn(el, true);
        try {
          const day = (S.shifts.find((x) => x.id === d.id) || S.open.find((x) => x.id === d.open)).work_date;
          if (d.id) {
            if (who === 'open') { busyBtn(el, false); return toast('ถ้าจะเปลี่ยนเป็นเวรว่าง ให้ลบเวรนี้แล้วเพิ่มเวรว่างใหม่', 'err'); }
            if (S.shifts.some((s) => s.id !== d.id && s.member_id === who && s.work_date === day && mins(s.start_time) < mins(en) && mins(st) < mins(s.end_time))) { busyBtn(el, false); return toast('ชนกับเวรอื่นของคนนี้', 'err'); }
            await q(sb.from('shifts').update({ branch_id: b, member_id: who, start_time: st, end_time: en, note, paid }).eq('id', d.id));
          } else {
            await q(sb.from('open_shifts').update({ branch_id: b, start_time: st, end_time: en, reason: note }).eq('id', d.open));
            if (who !== 'open') { const sid = await rpc('assign_open_shift', { p_open: d.open, p_member: who }); if (paid && sid) await q(sb.from('shifts').update({ paid: true }).eq('id', sid)); }
          }
          closeLayer(); toast('บันทึกแล้ว'); await refresh();
        } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
        return;
      }
      const [, last] = monthRange(S.sel.slice(0, 7)); const dates = [S.sel]; if (rep) for (let x = addDays(S.sel, 7); x <= last; x = addDays(x, 7)) dates.push(x);
      busyBtn(el, true);
      try {
        if (who === 'open') await q(sb.from('open_shifts').insert(dates.map((x) => ({ org_id: S.me.org_id, branch_id: b, work_date: x, start_time: st, end_time: en, reason: note }))));
        else {
          const clash = dates.filter((x) => S.shifts.some((s) => s.member_id === who && s.work_date === x && mins(s.start_time) < mins(en) && mins(st) < mins(s.end_time)));
          if (clash.length) { busyBtn(el, false); return toast('ชนกับเวรเดิมวันที่ ' + clash.map((x) => Number(x.slice(8))).join(', '), 'err'); }
          await q(sb.from('shifts').insert(dates.map((x) => ({ org_id: S.me.org_id, branch_id: b, member_id: who, work_date: x, start_time: st, end_time: en, note, paid }))));
        }
        closeLayer(); toast(dates.length > 1 ? `เพิ่มเวรแล้ว ${dates.length} วัน` : 'เพิ่มเวรแล้ว'); await refresh();
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    editShift: (d) => addShiftSheet(S.shifts.find((x) => x.id === d.id)),
    editOpen: (d) => addShiftSheet({ ...S.open.find((x) => x.id === d.id), isOpen: true }),
    delShift: async (d) => { try { await q(sb.from('shifts').delete().eq('id', d.id)); toast('ลบเวรแล้ว'); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    cancelOpen: async (d) => { try { await q(sb.from('open_shifts').update({ status: 'cancelled' }).eq('id', d.id)); toast('ยกเลิกเวรว่างแล้ว'); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    assign: async (d, el) => { busyBtn(el, true); try { await rpc('assign_open_shift', { p_open: d.open, p_member: d.m }); toast('มอบเวรให้ ' + M(d.m).display_name + ' แล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    approveClaim: async (d, el) => { busyBtn(el, true); try { await rpc('assign_open_shift', { p_open: d.open, p_member: d.m }); toast('อนุมัติแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    rejectClaim: async (d) => { try { await rpc('reject_claim', { p_claim: d.id }); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    decideLeave: async (d, el) => { busyBtn(el, true); try { await rpc('decide_leave', { p_id: d.id, p_approve: d.ok === '1' }); toast(d.ok === '1' ? 'อนุมัติลาแล้ว' : 'ไม่อนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    decideOt: async (d, el) => { busyBtn(el, true); try { await rpc('decide_ot', { p_member: d.m, p_date: d.d, p_approve: d.ok === '1' }); toast(d.ok === '1' ? 'อนุมัติ OT แล้ว' : 'ไม่อนุมัติ OT · คิดเฉพาะในเวลาเวร'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    decideFix: async (d, el) => { busyBtn(el, true); try { await rpc('decide_fix', { p_id: d.id, p_approve: d.ok === '1' }); toast('บันทึกแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    saveOrg: async (d, el) => { busyBtn(el, true); try { await q(sb.from('orgs').update({ name: val('oName').trim(), grace_minutes: Number(val('oGrace')), clip_to_shift: document.getElementById('oClip').checked, ot_min_minutes: Number(val('oOtMin')), allow_self_approve: document.getElementById('oSelf').checked, require_shift: document.getElementById('oReq').checked, early_minutes: Number(val('oEarly')), require_gps: document.getElementById('oGps').checked, pt_see_all: document.getElementById('oPtAll').checked }).eq('id', S.me.org_id)); toast('บันทึกแล้ว'); await loadOrgs(S.me.org_id); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    editBranch: (d) => branchSheet(d.id),
    delBranch: async (d, el) => { const br = B(d.id), v = val('bDelName').trim(); if (v !== br.name.trim()) return toast('พิมพ์ชื่อสาขาให้ตรงก่อน', 'err');
      busyBtn(el, true); try { await rpc('delete_branch', { p_branch: d.id, p_confirm: v }); closeLayer(); toast('ลบสาขาแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(/delete_branch/.test(errMsg(e)) ? 'ต้องรัน SQL อัปเดต 011 ก่อน' : errMsg(e), 'err'); } },
    useHere: async (d, el) => {
      busyBtn(el, true); const pos = await getPos(); busyBtn(el, false);
      if (!pos) return toast('อ่านตำแหน่งไม่ได้ กรุณาอนุญาตการใช้ตำแหน่งในเบราว์เซอร์', 'err');
      document.getElementById('bLat').value = pos.lat; document.getElementById('bLng').value = pos.lng;
      document.getElementById('bLocTxt').textContent = `ตั้งแล้ว: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (คลาดเคลื่อน ±${Math.round(pos.acc)} ม.)`;
      toast('ได้ตำแหน่งแล้ว กดบันทึกเพื่อใช้งาน');
    },
    saveBranch: async (d, el) => {
      const lat = val('bLat'), lng = val('bLng');
      const row = { name: (val('bName') || '').trim(), code: (val('bCode') || '').trim() || null, open_time: val('bOpen'), close_time: val('bClose'), lat: lat === '' ? null : Number(lat), lng: lng === '' ? null : Number(lng), gps_radius: Number(val('bRadius')) || 150, allow_static: !!document.getElementById('bStatic')?.checked };
      if (!row.name) return toast('กรุณาใส่ชื่อสาขา', 'err');
      if (row.allow_static && row.lat == null) return toast('ต้องตั้งตำแหน่งร้านก่อนเปิดใช้ QR ติดผนัง', 'err');
      if (row.close_time <= row.open_time) return toast('เวลาปิดต้องหลังเวลาเปิด', 'err');
      busyBtn(el, true);
      try {
        if (d.id) await q(sb.from('branches').update({ ...row, active: document.getElementById('bActive').checked }).eq('id', d.id));
        else await q(sb.from('branches').insert({ ...row, org_id: S.me.org_id }));
        closeLayer(); toast('บันทึกสาขาแล้ว'); await refresh();
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    pairKiosk: async (d, el) => {
      try { localStorage.setItem('ps_kiosk_ok_' + S.me.org_id, '1'); } catch (_) {}
      busyBtn(el, true);
      try {
        const code = await rpc('kiosk_create_pairing', { p_branch: d.id }); busyBtn(el, false);
        const url = new URL('kiosk.html', location.href).href;
        sheet('จับคู่โทรศัพท์ร้าน · ' + B(d.id).name, `<ol class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px"><li>บนโทรศัพท์ร้าน เปิด Chrome หรือ Safari ไปที่<br><span class="code" style="font-size:12px;letter-spacing:0">${esc(url)}</span> <button class="link" data-act="copy" data-text="${esc(url)}">คัดลอก</button></li><li>ใส่รหัสนี้ (ใช้ได้ 10 นาที)</li></ol><div style="text-align:center;font:600 44px var(--display);letter-spacing:.25em;padding:8px;background:var(--sunk);border-radius:16px">${esc(code)}</div><p class="tiny muted">ตั้งหน้าจอไม่ให้ดับ เสียบสายชาร์จ แล้ววางไว้ที่เคาน์เตอร์</p>`);
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    rotate: async (d, el) => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.innerHTML = ic('triangle-alert') + 'แตะอีกครั้งเพื่อยืนยัน'; icons(); return; }
      busyBtn(el, true);
      try { await rpc('rotate_branch_secret', { p_branch: d.id }); closeLayer(); toast('เปลี่ยนรหัสลับแล้ว กรุณาจับคู่โทรศัพท์ร้านใหม่'); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    addPreset: () => { const w = document.getElementById('presetRows'); w.insertAdjacentHTML('beforeend', `<div class="row" style="gap:6px"><input class="pc" maxlength="12" style="width:110px" placeholder="ชื่อเวร"><input class="ps" type="time" value="09:00"><input class="pe" type="time" value="17:00"><button class="btn ghost" data-act="delPreset" aria-label="ลบ">${ic('trash-2')}</button></div>`); icons(); },
    delPreset: (d, el) => el.closest('.row').remove(),
    savePresets: async (d, el) => {
      const rows = [...document.querySelectorAll('#presetRows .row')].map((r) => ({ code: r.querySelector('.pc').value.trim(), start: r.querySelector('.ps').value, end: r.querySelector('.pe').value })).filter((x) => x.code && x.start && x.end);
      if (rows.some((x) => x.end <= x.start)) return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'err');
      if (new Set(rows.map((x) => x.code)).size !== rows.length) return toast('ชื่อเวรซ้ำกัน', 'err');
      busyBtn(el, true); try { await q(sb.from('orgs').update({ presets: rows }).eq('id', S.me.org_id)); S.org.presets = rows; try { localStorage.setItem('ps_presets_ok_' + S.me.org_id, '1'); } catch (_) {} busyBtn(el, false); toast('บันทึกแล้ว'); render(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    saveNotify: async (d, el) => {
      const n = { ...(S.org.notify || {}) }; document.querySelectorAll('[data-nk]').forEach((x) => { n[x.dataset.nk] = x.checked; });
      busyBtn(el, true); try { await q(sb.from('orgs').update({ notify: n }).eq('id', S.me.org_id)); S.org.notify = n; busyBtn(el, false); toast('บันทึกแล้ว'); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    swapSheet: (d) => {
      const s = S.shifts.find((x) => x.id === d.id);
      const ppl = S.members.filter((m) => m.active && m.user_id && m.id !== S.me.member_id && m.role !== 'owner');
      if (!ppl.length) return toast('ยังไม่มีเพื่อนร่วมงานในร้าน', 'err');
      sheet('แลก / ยกเวร · ' + dShort(s.work_date), `<p class="small muted">เวรของคุณ: ${esc(B(s.branch_id).name)} · ${t5(s.start_time)}–${t5(s.end_time)}</p>
        <label class="field">แลกกับใคร<select id="swTo" data-change="swTo">${ppl.map((m) => `<option value="${m.id}">${esc(m.display_name)}</option>`).join('')}</select></label>
        <label class="field">แลกกับเวรไหนของเขา<select id="swShift"></select></label>
        <label class="field">หมายเหตุ (ไม่บังคับ)<input id="swNote" placeholder="เช่น ติดธุระ"></label>
        <p class="tiny muted">ขั้นตอน: เพื่อนกดตกลง → เจ้าของร้านอนุมัติ → เวรสลับให้อัตโนมัติ</p>
        <button class="btn primary block" data-act="sendSwap" data-id="${s.id}">${ic('send')}ส่งคำขอ</button>`);
      CHANGE.swTo(document.getElementById('swTo'));
    },
    sendSwap: async (d, el) => {
      busyBtn(el, true);
      try { await rpc('request_swap', { p_shift: d.id, p_to_member: val('swTo'), p_to_shift: val('swShift') || null, p_note: val('swNote') || null }); closeLayer(); toast('ส่งคำขอแล้ว รอเพื่อนตอบ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    respondSwap: async (d, el) => { busyBtn(el, true); try { await rpc('respond_swap', { p_id: d.id, p_accept: d.ok === '1' }); toast(d.ok === '1' ? 'ตกลงแล้ว รอเจ้าของร้านอนุมัติ' : 'ปฏิเสธแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    cancelSwap: async (d, el) => { busyBtn(el, true); try { await rpc('cancel_swap', { p_id: d.id }); toast('ยกเลิกคำขอแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    decideSwap: async (d, el) => { busyBtn(el, true); try { await rpc('decide_swap', { p_id: d.id, p_approve: d.ok === '1' }); toast(d.ok === '1' ? 'อนุมัติแล้ว สลับเวรให้แล้ว' : 'ไม่อนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    sendSlips: async (d, el) => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.innerHTML = ic('triangle-alert') + `ส่งสลิปเดือน${monthLabel(S.month)}? แตะอีกครั้ง`; icons(); return; }
      busyBtn(el, true);
      try { const n = await rpc('send_payslips', { p_org: S.me.org_id, p_month: S.month + '-01' }); busyBtn(el, false); el.dataset.confirm = ''; el.innerHTML = ic('send') + 'ส่งสลิปทาง LINE'; icons(); toast(n ? `ส่งสลิปให้ ${n} คนแล้ว (ถึงภายใน 1–2 นาที)` : 'เดือนนี้ยังไม่มีใครมีชั่วโมงคิดเงิน'); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    adjSheet: async (d) => {
      const m = M(d.m), [a, b] = monthRange(S.month);
      let list = []; try { list = await q(sb.from('pay_adjustments').select('*').eq('member_id', d.m).gte('work_date', a).lte('work_date', b).order('work_date')); } catch (e) { return toast(errMsg(e), 'err'); }
      sheet('เงินพิเศษ · ' + m.display_name, `<p class="small muted">เดือน${monthLabel(S.month)} · บวกเข้ายอดค่าจ้างและสลิป</p>
        ${list.length ? list.map((x) => `<div class="row small"><span class="grow">${dShort(x.work_date)} · ${esc(x.note)}</span><b>${Number(x.amount) > 0 ? '+' : ''}${baht(x.amount)}</b><button class="btn ghost" data-act="delAdj" data-id="${x.id}" data-m="${d.m}" aria-label="ลบ">${ic('trash-2')}</button></div>`).join('') : '<span class="small muted">ยังไม่มีรายการ</span>'}
        <div class="fields"><label class="field">วันที่<input id="adjDate" type="date" value="${S.month === today().slice(0, 7) ? today() : a}" min="${a}" max="${b}"></label><label class="field">จำนวนเงิน (บาท)<input id="adjAmt" type="number" step="10" placeholder="เช่น 150 (หักใช้ -)"></label></div>
        <label class="field">รายการ<input id="adjNote" list="adjNotes" placeholder="เช่น ค่าเดินทาง"><datalist id="adjNotes"><option value="ค่าเดินทาง"><option value="ค่าเวรฉุกเฉิน / โยกกะทันหัน"><option value="Commission"><option value="ประกันสังคม (หัก ใส่ติดลบ)"><option value="OT (เหมาจ่าย)"><option value="เบี้ยขยัน"><option value="โบนัส"></datalist></label>
        <button class="btn primary block" data-act="addAdj" data-m="${d.m}">${ic('plus')}เพิ่มรายการ</button>`);
    },
    addAdj: async (d, el) => {
      const amt = Number(val('adjAmt')), note = (val('adjNote') || '').trim(), dt = val('adjDate');
      if (!amt || !note || !dt) return toast('ใส่วันที่ จำนวนเงิน และรายการ', 'err');
      busyBtn(el, true);
      try { await q(sb.from('pay_adjustments').insert({ org_id: S.me.org_id, member_id: d.m, work_date: dt, amount: amt, note })); toast('เพิ่มแล้ว'); ACT.adjSheet({ m: d.m }); loadHours(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    delAdj: async (d) => { try { await q(sb.from('pay_adjustments').delete().eq('id', d.id)); toast('ลบแล้ว'); ACT.adjSheet({ m: d.m }); loadHours(); } catch (e) { toast(errMsg(e), 'err'); } },
    exportXlsx: async (d, el) => {
      busyBtn(el, true);
      try {
        if (!window.XLSX) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = () => no(new Error('โหลดตัวสร้าง Excel ไม่สำเร็จ')); document.head.appendChild(sc); });
        const [sum, det] = await Promise.all([rpc('month_hours', { p_org: S.me.org_id, p_month: S.month + '-01' }), rpc('month_detail', { p_org: S.me.org_id, p_month: S.month + '-01' })]);
        const rows = sum.filter((r) => M(r.member_id).role !== 'owner' && (!M(r.member_id).clock_free || Number(r.actual_hours) > 0 || Number(r.extras) !== 0));
        const [ma, mb] = monthRange(S.month); const adj = await q(sb.from('pay_adjustments').select('*').eq('org_id', S.me.org_id).gte('work_date', ma).lte('work_date', mb).order('work_date'));
        const lb = {}, sn = new Set(); det.forEach((r) => { const k = r.member_id + r.work_date; if (sn.has(k)) return; sn.add(k); const lk = lateKind(r.late_min); if (lk) (lb[r.member_id] = lb[r.member_id] || { ok: 0, warn: 0, alert: 0 })[lk]++; });
        const h2 = (n) => Math.round(Number(n || 0) * 100) / 100;
        const A = [['ชื่อ', 'การจ้าง', 'ชั่วโมงคิดเงิน', 'เวลาจริง (ชม.)', 'OT รออนุมัติ (ชม.)', 'บาท/ชม.', 'เงินพิเศษ (บาท)', 'ยอดรวม (บาท)', 'ตรงเวลา (วัน)', 'สายในเกณฑ์ (วัน)', 'สายเกินเกณฑ์ (วัน)']];
        rows.forEach((r) => { const L = lb[r.member_id] || { ok: 0, warn: 0, alert: 0 }; A.push([M(r.member_id).display_name, EMP[M(r.member_id).employment] || '', h2(r.hours), h2(r.actual_hours), h2(r.ot_pending_hours), r.hourly_rate == null ? '' : Number(r.hourly_rate), Number(r.extras || 0), Math.round(Number(r.amount || 0)), L.ok, L.warn, L.alert]); });
        A.push(['รวม', '', h2(rows.reduce((a, r) => a + Number(r.hours || 0), 0)), '', '', '', rows.reduce((a, r) => a + Number(r.extras || 0), 0), Math.round(rows.reduce((a, r) => a + Number(r.amount || 0), 0))]);
        const D = [['วันที่', 'ชื่อ', 'เวรเริ่ม', 'เข้างาน', 'ออกงาน', 'สาย (นาที)', 'สถานะ', 'เวลาจริง (ชม.)', 'ในเวลาเวร (ชม.)', 'คิดเงิน (ชม.)']];
        det.forEach((r) => D.push([r.work_date, r.display_name, r.shift_start ? t5(r.shift_start) : '-', fmtTime(r.in_at, S.tz), r.out_at ? fmtTime(r.out_at, S.tz) : 'ไม่ได้กดออก', r.late_min == null ? '' : Math.max(0, r.late_min), r.late_min == null ? 'ไม่มีเวร' : LATE_TH[lateKind(r.late_min)], h2(r.actual_min / 60), h2(r.in_shift_min / 60), h2(r.in_paid_min / 60)]));
        const E = [['วันที่', 'ชื่อ', 'รายการ', 'จำนวนเงิน (บาท)']]; adj.forEach((x) => E.push([x.work_date, M(x.member_id).display_name, x.note, Number(x.amount)]));
        const wb = XLSX.utils.book_new(), w1 = XLSX.utils.aoa_to_sheet(A), w2 = XLSX.utils.aoa_to_sheet(D), w3 = XLSX.utils.aoa_to_sheet(E);
        w1['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }]; w2['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 }]; w3['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, w1, 'สรุป'); XLSX.utils.book_append_sheet(wb, w2, 'รายวัน'); XLSX.utils.book_append_sheet(wb, w3, 'เงินพิเศษ');
        XLSX.writeFile(wb, `PharmaShift_${S.org.name.replace(/[^\p{L}\p{N}]+/gu, '_')}_${S.month}.xlsx`);
        busyBtn(el, false); toast(liff.isInClient() ? 'ถ้าในแอป LINE ไม่ดาวน์โหลด ให้เปิดลิงก์แอปบนคอมพิวเตอร์แล้วกดอีกครั้ง' : 'ดาวน์โหลดแล้ว');
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    resetSheet: (d) => {
      const all = d.mode === 'org';
      sheet(all ? 'ลบร้านนี้ทั้งร้าน' : 'ล้างข้อมูลการใช้งาน', `
        <p class="small">${all ? 'ลบทุกอย่างของร้านนี้: สาขา พนักงาน เวร เวลาเข้าออก ค่าจ้าง จอ QR และ QR ติดผนังจะใช้ไม่ได้ <b>กู้คืนไม่ได้</b>' : 'ลบเวลาเข้า–ออกงาน เวร เวรว่าง คำขอลา คำขอแก้เวลา OT วันว่าง และบันทึกส่งเวร<br>ร้าน สาขา พนักงาน ค่าจ้าง และจอ QR ยังอยู่ครบ <b>กู้คืนไม่ได้</b>'}</p>
        <label class="field"><span>พิมพ์ชื่อร้าน <b>${esc(S.org.name)}</b> เพื่อยืนยัน</span><input id="rConfirm" autocomplete="off"></label>
        <button class="btn danger block" data-act="doReset" data-mode="${d.mode}">${ic('trash-2')}${all ? 'ลบร้าน' : 'ล้างข้อมูล'}</button>`);
    },
    doReset: async (d, el) => {
      const txt = (val('rConfirm') || '').trim();
      if (txt !== S.org.name) return toast('พิมพ์ชื่อร้านไม่ตรง', 'err');
      busyBtn(el, true);
      try {
        if (d.mode === 'org') { await rpc('delete_org', { p_org: S.me.org_id, p_confirm: txt }); closeLayer(); localStorage.removeItem('ps_org'); toast('ลบร้านแล้ว'); S.tab = 'home'; await loadOrgs(); }
        else { await rpc('reset_org_data', { p_org: S.me.org_id, p_confirm: txt }); closeLayer(); toast('ล้างข้อมูลแล้ว'); await refresh(); }
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    editMember: (d) => memberSheet(d.id),
    saveMember: async (d, el) => {
      const row = { display_name: (val('mName') || '').trim(), role: val('mRole'), employment: val('mRole') === 'owner' ? 'owner' : val('mEmp'), home_branch_id: val('mBranch') || null, color: val('mColor'), clock_free: document.getElementById('mFree').checked, notify: document.getElementById('mNotify').checked, leave_quota: Object.fromEntries([...document.querySelectorAll('[data-lq]')].filter((x) => x.value !== '').map((x) => [x.dataset.lq, Number(x.value)])), branch_ids: (() => { const a = [...document.querySelectorAll('[data-mb]')].filter((x) => x.checked).map((x) => x.dataset.mb); return a.length ? a : null; })() };
      if (!row.display_name) return toast('กรุณาใส่ชื่อ', 'err');
      const rate = val('mRate');
      busyBtn(el, true);
      try {
        let id = d.id;
        if (id) await q(sb.from('members').update({ ...row, active: document.getElementById('mActive').checked }).eq('id', id));
        else id = (await q(sb.from('members').insert({ ...row, org_id: S.me.org_id }).select('id').single())).id;
        if (rate !== '' && rate != null) {
          if (S.pay[id] != null) await q(sb.from('member_pay').update({ hourly_rate: Number(rate) }).eq('member_id', id));
          else await q(sb.from('member_pay').insert({ member_id: id, hourly_rate: Number(rate) }));
        }
        closeLayer(); toast(d.id ? 'บันทึกแล้ว' : 'เพิ่มพนักงานแล้ว กด "ส่งรหัส" เพื่อส่งรหัสเชิญ'); await refresh();
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
  };
  const CHANGE = {
    swTo: (el) => {
      const sel = document.getElementById('swShift'); if (!sel) return;
      const t = today(), theirs = S.shifts.filter((x) => x.member_id === el.value && x.work_date >= t);
      sel.innerHTML = `<option value="">ไม่แลก — ยกเวรนี้ให้เขา</option>` + theirs.map((x) => `<option value="${x.id}">${dShort(x.work_date)} · ${t5(x.start_time)}–${t5(x.end_time)} · ${esc(B(x.branch_id).name)}</option>`).join('');
    },
    filter: (el) => { S.filter = el.value; render(); },
    sBranch: (el) => { const br = B(el.value); document.getElementById('sStart').value = t5(br.open_time); document.getElementById('sEnd').value = t5(br.close_time); },
    rate: async (el) => {
      const id = el.dataset.m, v = el.value === '' ? null : Number(el.value); if (v == null || v < 0) return;
      try {
        if (S.pay[id] != null) await q(sb.from('member_pay').update({ hourly_rate: v }).eq('member_id', id));
        else await q(sb.from('member_pay').insert({ member_id: id, hourly_rate: v }));
        S.pay[id] = v; toast('บันทึกค่าจ้างแล้ว'); loadHours();
      } catch (e) { toast(errMsg(e), 'err'); }
    },
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el, e); });
  document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el); });
  const idle = () => S.me && document.visibilityState === 'visible' && !$layer.innerHTML && !S.draft && !S.brush && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
  let rtTimer = null;
  const softRefresh = () => { clearTimeout(rtTimer); rtTimer = setTimeout(() => { if (idle()) { const y = window.scrollY; refresh().then(() => window.scrollTo(0, y)); } else S.stale = true; }, 700); };
  function subscribeRealtime() {
    if (S.rtOrg === S.me.org_id) return;
    try { if (S.rt) sb.removeChannel(S.rt); } catch (_) {}
    S.rtOrg = S.me.org_id;
    const ch = sb.channel('org-' + S.me.org_id);
    ['attendance', 'shifts', 'open_shifts', 'leave_requests', 'attendance_fixes', 'shift_swaps', 'handover_notes', 'day_marks', 'shift_requests'].forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'org_id=eq.' + S.me.org_id }, softRefresh));
    ['shift_claims', 'availability'].forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, softRefresh));
    S.rt = ch.subscribe();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me) refresh(); });
  setInterval(() => { if (idle() && (S.stale || S.tab === 'home' || S.tab === 'req')) { S.stale = false; const y = window.scrollY; refresh().then(() => window.scrollTo(0, y)); } }, 30000);

  boot();
})();

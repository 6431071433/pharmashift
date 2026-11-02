/* PharmaShift · แอปพนักงานและเจ้าของร้าน (เปิดผ่าน LINE LIFF) */
(function () {
  const { CFG, esc, ic, icons, t5, mins, hm, todayStr, nowMins, fmtTime, dow, addDays, dShort, dLong, monthLabel, baht, avatar, greet, dayArc, ribbon, toast, errMsg, DOW, TONES, confettiHTML } = window.PS;
  const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pharmashift-auth' } });
  const $main = document.getElementById('main'), $nav = document.getElementById('nav'), $top = document.getElementById('top'), $layer = document.getElementById('layer');
  const ROLE = { owner: 'เจ้าของร้าน', manager: 'ผู้จัดการ', pharmacist: 'เภสัชกร', assistant: 'ผู้ช่วยเภสัช' };
  const EMP = { owner: 'เจ้าของ', fulltime: 'ประจำ', parttime: 'Part-time' };
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
  const shortB = (id) => { const i = S.branches.findIndex((b) => b.id === id); return i >= 0 ? 'ส' + (i + 1) : ''; };
  const lastAtt = () => { const o = {}; for (const a of S.att) o[a.member_id] = a; return o; };
  const isToday = (iso) => todayStr(S.tz, new Date(iso)) === today();
  const inNow = (last) => last && last.kind === 'in' && isToday(last.at);
  const forgotOut = (last) => last && last.kind === 'in' && !isToday(last.at) && Date.now() - new Date(last.at).getTime() < 7 * 86400e3;
  const grace = () => S.org?.grace_minutes ?? 15;
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
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    });
  }

  function statusOf(s, last) {
    const st = mins(s.start_time), g = grace(), N = nowMins(S.tz);
    if (last && isToday(last.at)) {
      if (last.kind === 'out') return { c: 'ok', i: 'log-out', t: `ออกงาน ${fmtTime(last.at, S.tz)}` };
      const late = mins(fmtTime(last.at, S.tz)) - st - g;
      return late > 0 ? { c: 'warn', i: 'clock', t: `เข้างาน ${fmtTime(last.at, S.tz)} · สาย ${late} นาที` } : { c: 'ok', i: 'check', t: `เข้างาน ${fmtTime(last.at, S.tz)}` };
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
      sb.from('shift_claims').select('*').eq('member_id', S.me.member_id).order('created_at', { ascending: false }),
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
  }
  async function refresh() { try { await loadData(); render(); } catch (e) { toast(errMsg(e), 'err'); } }

  // ---------- frame ----------
  function tabsFor() {
    if (S.isOwner) {
      const pend = S.claims.length + S.leaves.length + S.fixes.length + S.ot.length;
      return [['home', 'layout-dashboard', 'ภาพรวม'], ['cal', 'calendar-days', 'ปฏิทิน'], ['req', 'bell', 'คำขอ', pend], ['pay', 'wallet', 'ค่าจ้าง'], ['set', 'settings', 'ตั้งค่า']];
    }
    const me = M(S.me.member_id), t = [['home', 'house', 'หน้าแรก'], ['cal', 'calendar-days', 'ปฏิทิน']];
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
    const views = S.isOwner ? { home: ownerHome, cal: ownerCal, req: ownerReq, pay: ownerPay, set: ownerSet } : { home: staffHome, cal: staffCal, open: staffOpen, money: staffMoney };
    $main.className = 'main' + (S.isOwner && ['cal', 'set', 'pay', 'home'].includes(S.tab) ? '' : ' narrow');
    $main.innerHTML = views[S.tab]();
    icons();
    if (S.tab === 'pay' || S.tab === 'money') loadHours();
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
    const pend = S.claims.length + S.leaves.length + S.fixes.length + S.ot.length, fo = S.open.filter((x) => x.work_date >= t).length;
    let h = `<div class="hello"><div class="stack"><h1>${greet(S.tz)}ครับ</h1><p class="muted">${dLong(t)}</p></div><div class="arcbox">${dayArc(o, c, S.tz)}</div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <button class="card" data-act="tab" data-tab="cal" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-coral">${ic('calendar-x')}</span><span><b style="font:500 24px var(--display)">${fo}</b><br><span class="small muted">เวรว่างที่ยังไม่มีคนรับ</span></span></button>
        <button class="card" data-act="tab" data-tab="req" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-sun">${ic('bell-ring')}</span><span><b style="font:500 24px var(--display)">${pend}</b><br><span class="small muted">คำขอรออนุมัติ</span></span></button>
        <button class="card" data-act="tab" data-tab="set" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-lilac">${ic('users')}</span><span><b style="font:500 24px var(--display)">${S.members.filter((m) => m.active).length}</b><br><span class="small muted">คนในร้าน</span></span></button>
      </div>`;
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
  function ownerCal() {
    const [a, b] = monthRange(S.month), t = today(), fb = S.filter, all = fb === '0';
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
      g += `<button class="cell ${d < t ? 'past' : ''} ${d === t ? 'today' : ''} ${d === S.sel ? 'sel' : ''}" data-act="pick" data-d="${d}" aria-label="${dLong(d)}"><span class="dnum">${Number(d.slice(8))}</span>${c}</button>`;
    }
    const legend = S.members.filter((m) => m.active && m.role !== 'owner').map((m) => `<span><i style="background:var(--${tone(m.color)})"></i>${esc(shortName(m.display_name))}</span>`).join('') + `<span><i style="background:var(--coral-soft);outline:1.5px dashed var(--coral)"></i>เวรว่าง</span><span><i style="background:var(--warn-soft)"></i>ขอลา</span>`;
    return `<div class="calgrid">
      <div class="card"><div class="card-head">${monthNav()}<select id="filter" data-change="filter" aria-label="เลือกสาขา"><option value="0">ทุกสาขา</option>${S.branches.map((br) => `<option value="${br.id}" ${fb === br.id ? 'selected' : ''}>${esc(br.name)}</option>`).join('')}</select></div>
        <div class="legend">${legend}</div><div class="cal">${g}</div>
        <p class="small muted">แตะวันเพื่อดูรายละเอียดและจัดเวร · ${S.branches.length > 1 ? 'ส1, ส2… คือลำดับสาขา' : ''}</p></div>
      <div class="card" id="day">${ownerDay()}</div></div>`;
  }
  function ownerDay() {
    const d = S.sel, t = today();
    let h = `<div class="card-head"><div><h2>${dShort(d)}</h2><span class="tiny muted">${dLong(d)}</span></div>${d >= t ? `<button class="btn primary" data-act="addShift">${ic('plus')}เพิ่มเวร</button>` : ''}</div>`;
    if (!S.branches.length) return h + `<p class="muted small">ยังไม่มีสาขา</p>`;
    const avl = new Set(S.avail.filter((x) => x.work_date === d).map((x) => x.member_id));
    for (const br of S.branches.filter((x) => x.active)) {
      const ss = S.shifts.filter((x) => x.work_date === d && x.branch_id === br.id), os = S.open.filter((x) => x.work_date === d && x.branch_id === br.id);
      h += `<div class="stack" style="background:var(--bg);border-radius:14px;padding:12px"><div class="between"><b>${esc(br.name)}</b><span class="tiny muted">${t5(br.open_time)}–${t5(br.close_time)}</span></div>`;
      if (!ss.length && !os.length) h += `<span class="small muted">ไม่มีเวร</span>`;
      for (const s of ss) { const m = M(s.member_id); h += `<div class="row">${avatar(m.display_name, m.color, 'sm')}<span class="small grow">${esc(m.display_name)}${s.note ? ` <span class="muted">· ${esc(s.note)}</span>` : ''}</span><span class="small muted">${t5(s.start_time)}–${t5(s.end_time)}</span>${d >= t ? `<button class="btn ghost" data-act="delShift" data-id="${s.id}" aria-label="ลบเวร">${ic('trash-2')}</button>` : ''}</div>`; }
      for (const o of os) {
        h += `<div class="small" style="color:var(--coral-deep)">${ic('circle-alert')} <b>เวรว่าง ${t5(o.start_time)}–${t5(o.end_time)}</b>${o.reason ? ' · ' + esc(o.reason) : ''}</div><div class="actions" style="display:flex;flex-wrap:wrap;gap:6px">`;
        for (const m of S.members.filter((x) => x.active && x.role === 'pharmacist')) h += `<button class="btn ${avl.has(m.id) ? 'primary' : ''}" data-act="assign" data-open="${o.id}" data-m="${m.id}">${ic('user-plus')}${esc(shortName(m.display_name))}${avl.has(m.id) ? ' · ว่าง' : ''}</button>`;
        h += `<button class="btn ghost" data-act="cancelOpen" data-id="${o.id}">ยกเลิกเวรว่าง</button></div>`;
      }
      h += `</div>`;
    }
    const names = S.members.filter((m) => avl.has(m.id)).map((m) => esc(shortName(m.display_name)));
    return h + `<p class="small muted">${ic('hand')} แจ้งว่าว่างวันนี้: ${names.length ? names.join(', ') : 'ยังไม่มี'}</p>`;
  }
  function addShiftSheet() {
    const d = S.sel, br = S.branches.find((x) => x.active) || S.branches[0];
    const people = S.members.filter((m) => m.active);
    sheet('เพิ่มเวร · ' + dShort(d), `
      <label class="field">สาขา<select id="sBranch" data-change="sBranch">${S.branches.filter((x) => x.active).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field">ใครเข้าเวร<select id="sWho"><option value="open">— เวรว่าง (ให้ part-time กดรับ) —</option>${people.map((m) => `<option value="${m.id}">${esc(m.display_name)} · ${esc(ROLE[m.role])}</option>`).join('')}</select></label>
      <div class="fields"><label class="field">เริ่ม<input id="sStart" type="time" value="${t5(br.open_time)}"></label><label class="field">ถึง<input id="sEnd" type="time" value="${t5(br.close_time)}"></label></div>
      <label class="field">หมายเหตุ (ไม่บังคับ)<input id="sNote" placeholder="เช่น เจ้าของไม่อยู่"></label>
      <label class="row small"><input type="checkbox" id="sRepeat"> ทำซ้ำทุก${DOW[dow(d)].replace('.', '')}จนถึงสิ้นเดือน</label>
      <button class="btn primary block" data-act="saveShift">${ic('check')}บันทึกเวร</button>`);
  }

  // ---------- OWNER: requests ----------
  function ownerReq() {
    let h = `<h1>คำขอรออนุมัติ</h1>`;
    if (!S.claims.length && !S.leaves.length && !S.fixes.length && !S.ot.length) return h + `<div class="card"><div class="empty">${ic('coffee', 'ic-lg')}<b>ไม่มีอะไรค้าง</b><span class="small">คำขอรับเวร ขอลา และขอแก้เวลาจะขึ้นที่นี่</span></div></div>`;
    for (const c of S.claims) { const o = c.open_shifts, m = M(c.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอรับเวร</b><br><span class="small">${esc(B(o.branch_id).name)} · ${dShort(o.work_date)} · ${t5(o.start_time)}–${t5(o.end_time)}</span></div></div><div class="row"><button class="btn primary" data-act="approveClaim" data-open="${o.id}" data-m="${c.member_id}">${ic('check')}อนุมัติ</button><button class="btn" data-act="rejectClaim" data-id="${c.id}">ไม่อนุมัติ</button></div></div>`; }
    for (const l of S.leaves) { const m = M(l.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอลา</b><br><span class="small">${esc(B(l.branch_id).name)} · ${dShort(l.work_date)} · ${t5(l.start_time)}–${t5(l.end_time)}</span>${l.reason ? `<br><span class="small muted">เหตุผล: ${esc(l.reason)}</span>` : ''}</div></div>${m.role === 'pharmacist' ? `<span class="tiny muted">อนุมัติแล้ว ระบบโพสต์เป็นเวรว่างให้ part-time อัตโนมัติ</span>` : ''}<div class="row"><button class="btn primary" data-act="decideLeave" data-id="${l.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideLeave" data-id="${l.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    for (const o of S.ot) { const m = M(o.member_id); const hrs = (n) => `${Math.floor(n / 60)} ชม. ${n % 60} นาที`;
      h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ทำงานเกินเวลาเวร (OT)</b><br><span class="small">${dShort(o.work_date)} · ลงเวลา ${fmtTime(o.first_in, S.tz)}–${fmtTime(o.last_out, S.tz)}</span><br><span class="small muted">ในเวลาเวร ${hrs(o.in_shift_min)} · เกินเวร <b>${hrs(o.extra_min)}</b>${o.in_shift_min === 0 ? ' (วันนี้ไม่มีเวรในตาราง)' : ''}</span></div></div>
        <span class="tiny muted">อนุมัติ = จ่ายตามเวลาจริงทั้งวัน · ไม่อนุมัติ = จ่ายเฉพาะในเวลาเวร</span>
        <div class="row"><button class="btn primary" data-act="decideOt" data-m="${o.member_id}" data-d="${o.work_date}" data-ok="1">${ic('check')}อนุมัติ OT</button><button class="btn" data-act="decideOt" data-m="${o.member_id}" data-d="${o.work_date}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    for (const f of S.fixes) { const m = M(f.member_id); h += `<div class="card"><div class="row">${avatar(m.display_name, m.color)}<div class="grow"><b>${esc(m.display_name)} ขอแก้เวลา${f.kind === 'in' ? 'เข้างาน' : 'ออกงาน'}</b><br><span class="small">${esc(B(f.branch_id).name)} · ${dShort(todayStr(S.tz, new Date(f.requested_at)))} ${fmtTime(f.requested_at, S.tz)}</span><br><span class="small muted">เหตุผล: ${esc(f.reason)}</span></div></div><div class="row"><button class="btn primary" data-act="decideFix" data-id="${f.id}" data-ok="1">${ic('check')}อนุมัติ</button><button class="btn" data-act="decideFix" data-id="${f.id}" data-ok="0">ไม่อนุมัติ</button></div></div>`; }
    return h;
  }

  // ---------- OWNER: pay ----------
  function ownerPay() {
    return `<div class="card"><div class="card-head">${monthNav()}<span class="small muted">เห็นได้เฉพาะเจ้าของร้าน</span></div><div id="hours"><div class="empty"><div class="spinner"></div></div></div>
      <p class="small muted">${S.org.clip_to_shift ? 'คิดเงินเฉพาะเวลาที่อยู่ในเวร ส่วนที่เกินเป็น OT ต้องอนุมัติในแท็บคำขอ' : 'คิดเงินตามเวลาเข้า–ออกงานจริงทั้งหมด'} · แก้ค่าจ้างต่อชั่วโมงได้ในตาราง · ตั้งค่าได้ในแท็บตั้งค่า</p></div>`;
  }
  async function loadHours() {
    const el = document.getElementById('hours') || document.getElementById('myhours'); if (!el) return;
    try {
      const rows = await rpc('month_hours', { p_org: S.me.org_id, p_month: S.month + '-01' });
      if (S.isOwner) {
        const list = rows.filter((r) => M(r.member_id).role !== 'owner' && (!M(r.member_id).clock_free || Number(r.actual_hours) > 0));
        const total = list.reduce((a, r) => a + Number(r.amount || 0), 0);
        el.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>ชื่อ</th><th class="r">คิดเงิน (ชม.)</th><th class="r">เวลาจริง</th><th class="r">บาท/ชม.</th><th class="r">ยอด</th></tr></thead><tbody>${list.map((r) => { const m = M(r.member_id); return `<tr><td><div class="row">${avatar(m.display_name, m.color, 'sm')}<span>${esc(m.display_name)}<br><span class="tiny muted">${esc(EMP[m.employment])}</span></span></div></td><td class="r">${Number(r.hours).toFixed(2)}${Number(r.ot_pending_hours) > 0 ? `<br><span class="pill warn" style="font-size:11px">OT รอ ${Number(r.ot_pending_hours).toFixed(2)}</span>` : ''}</td><td class="r muted">${Number(r.actual_hours).toFixed(2)}</td><td class="r"><input class="rate" type="number" min="0" step="5" value="${r.hourly_rate ?? ''}" placeholder="—" data-change="rate" data-m="${r.member_id}" aria-label="ค่าจ้างต่อชั่วโมง ${esc(m.display_name)}"></td><td class="r"><b>฿${baht(r.amount)}</b></td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="4"><b>รวม</b></td><td class="r"><b>฿${baht(total)}</b></td></tr></tfoot></table></div>`;
      } else {
        const r = rows[0] || { hours: 0, hourly_rate: S.pay[S.me.member_id] || 0, amount: 0 };
        el.innerHTML = `<div class="shift-hero"><span class="small" style="opacity:.9">ยอดเดือน${monthLabel(S.month)}</span><div class="time">฿${baht(r.amount)}</div><span class="small" style="opacity:.9">${Number(r.hours).toFixed(2)} ชม. × ${baht(r.hourly_rate)} บาท</span>${Number(r.ot_pending_hours) > 0 ? `<span class="pill">${ic('hourglass')}OT ${Number(r.ot_pending_hours).toFixed(2)} ชม. รอเจ้าของอนุมัติ</span>` : ''}</div>`; icons();
      }
    } catch (e) { el.innerHTML = `<p class="small" style="color:var(--coral-deep)">${esc(errMsg(e))}</p>`; }
  }

  // ---------- OWNER: settings ----------
  function ownerSet() {
    const liffUrl = `https://liff.line.me/${CFG.LIFF_ID}`, kioskUrl = new URL('kiosk.html', location.href).href;
    let h = `<div class="grid" style="align-items:start">
      <div class="card"><div class="row"><span class="icon-chip t-brand">${ic('store')}</span><h2>ร้าน</h2></div>
        <label class="field">ชื่อร้าน<input id="oName" value="${esc(S.org.name)}"></label>
        <label class="field">เวลาผ่อนผันก่อนนับว่าสาย<select id="oGrace">${[0, 5, 10, 15, 20, 30].map((n) => `<option value="${n}" ${grace() === n ? 'selected' : ''}>${n ? n + ' นาที' : 'ไม่มี'}</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oReq" ${S.org.require_shift ? 'checked' : ''}> สแกนเข้างานได้เฉพาะวันที่มีเวร (เจ้าของร้านไม่ต้อง)</label>
        <label class="field">สแกนก่อนเวลาเวรได้<select id="oEarly">${[15, 30, 60, 120].map((n) => `<option value="${n}" ${(S.org.early_minutes ?? 60) === n ? 'selected' : ''}>${n} นาที</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oClip" ${S.org.clip_to_shift ? 'checked' : ''}> คิดชั่วโมงไม่เกินเวลาเวร (ทำเกินเวรเป็น OT ต้องอนุมัติก่อนจ่าย)</label>
        <label class="field">ไม่นับส่วนที่เกินเวรน้อยกว่า<select id="oOtMin">${[0, 10, 15, 30].map((n) => `<option value="${n}" ${(S.org.ot_min_minutes ?? 15) === n ? 'selected' : ''}>${n ? n + ' นาที' : 'นับทุกนาที'}</option>`).join('')}</select></label>
        <label class="row small"><input type="checkbox" id="oSelf" ${S.org.allow_self_approve ? 'checked' : ''}> ให้ผู้จัดการอนุมัติคำขอของตัวเองได้ (เจ้าของร้านอนุมัติได้เสมอ)</label>
        <button class="btn primary" data-act="saveOrg">${ic('check')}บันทึก</button>
        <div class="stack small" style="border-top:1px solid var(--line);padding-top:12px"><b>ลิงก์แอปสำหรับพนักงาน</b><div class="row"><span class="code" style="font-size:12px;letter-spacing:0;overflow:hidden;text-overflow:ellipsis">${esc(liffUrl)}</span><button class="btn ghost" data-act="copy" data-text="${esc(liffUrl)}">${ic('copy')}</button></div>
        <b>ลิงก์จอที่ร้าน (เปิดบนโทรศัพท์ร้าน)</b><div class="row"><span class="code" style="font-size:12px;letter-spacing:0;overflow:hidden;text-overflow:ellipsis">${esc(kioskUrl)}</span><button class="btn ghost" data-act="copy" data-text="${esc(kioskUrl)}">${ic('copy')}</button></div><span class="muted" style="font-size:11px">เวอร์ชัน 2 พ.ย. 69 (GPS · OT · สแกนเฉพาะวันมีเวร)</span></div></div>
      <div class="card"><div class="card-head"><div class="row"><span class="icon-chip t-sky">${ic('map-pin')}</span><h2>สาขา</h2></div><button class="btn" data-act="editBranch">${ic('plus')}เพิ่มสาขา</button></div>`;
    if (!S.branches.length) h += `<p class="small muted">ยังไม่มีสาขา กด "เพิ่มสาขา" เพื่อเริ่ม</p>`;
    for (const br of S.branches) h += `<div class="list-row" style="flex-wrap:wrap"><div class="grow"><b>${esc(br.name)}</b>${br.active ? '' : ' <span class="pill wait">ปิดใช้งาน</span>'}<br><span class="small muted">${t5(br.open_time)}–${t5(br.close_time)}${br.lat != null ? ' · ตั้งตำแหน่งแล้ว' : ' · ยังไม่ตั้งตำแหน่ง'}</span></div><button class="btn ghost" data-act="pairKiosk" data-id="${br.id}">${ic('monitor-smartphone')}จับคู่จอ QR</button>${br.allow_static ? `<a class="btn ghost" href="print.html?b=${br.id}" target="_blank" rel="noopener">${ic('printer')}ปริ้น QR ติดผนัง</a>` : ''}<button class="btn ghost" data-act="editBranch" data-id="${br.id}" aria-label="แก้ไขสาขา">${ic('pencil')}</button></div>`;
    h += `</div></div><div class="card"><div class="card-head"><div class="row"><span class="icon-chip t-lilac">${ic('users')}</span><h2>พนักงาน</h2></div><button class="btn primary" data-act="editMember">${ic('user-plus')}เพิ่มพนักงาน</button></div>`;
    for (const m of S.members) {
      const code = S.invites[m.id];
      h += `<div class="list-row" style="flex-wrap:wrap">${avatar(m.display_name, m.color, '', m.avatar_url)}<div class="grow"><b>${esc(m.display_name)}</b>${m.active ? '' : ' <span class="pill wait">ออกแล้ว</span>'}<br><span class="small muted">${esc(ROLE[m.role])} · ${esc(EMP[m.employment])}${m.home_branch_id ? ' · ' + esc(B(m.home_branch_id).name) : ''}${m.employment === 'parttime' && S.pay[m.id] != null ? ` · ${baht(S.pay[m.id])} บาท/ชม.` : ''}${m.clock_free ? ' · ไม่ต้องลงเวลา' : ''}</span></div>
        ${m.user_id ? `<span class="pill ok">${ic('check')}เชื่อม LINE แล้ว</span>` : code ? `<span class="code">${esc(code)}</span><button class="btn ghost" data-act="copyInvite" data-id="${m.id}">${ic('send')}ส่งรหัส</button>` : ''}
        ${m.id !== S.me.member_id && (m.role !== 'owner' || S.me.role === 'owner') ? `<button class="btn ghost" data-act="editMember" data-id="${m.id}" aria-label="แก้ไขพนักงาน">${ic('pencil')}</button>` : ''}</div>`;
    }
    return h + `</div>`;
  }
  function branchSheet(id) {
    const br = S.branches.find((x) => x.id === id) || { name: '', open_time: '09:00', close_time: '21:00', active: true };
    sheet(id ? 'แก้ไขสาขา' : 'เพิ่มสาขา', `
      <label class="field">ชื่อสาขา<input id="bName" value="${esc(br.name)}" placeholder="เช่น สาขา 1 ถนนสุขุมวิท"></label>
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
      ${id ? `<div class="stack small" style="border-top:1px solid var(--line);padding-top:12px"><b>โทรศัพท์ร้านหาย?</b><span class="muted">เปลี่ยนรหัสลับแล้วจอ QR เครื่องเก่าและ QR ที่ปริ้นไว้จะใช้ไม่ได้ทันที ต้องจับคู่จอใหม่และปริ้นใหม่</span><button class="btn danger" data-act="rotate" data-id="${id}">${ic('key-round')}เปลี่ยนรหัสลับของสาขา</button></div>` : ''}`);
  }
  function memberSheet(id) {
    const m = S.members.find((x) => x.id === id) || { display_name: '', role: 'pharmacist', employment: 'parttime', home_branch_id: '', color: TONES[S.members.length % TONES.length], active: true };
    sheet(id ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน', `
      <label class="field">ชื่อที่แสดง<input id="mName" value="${esc(m.display_name)}" placeholder="เช่น ภก.ดนัย"></label>
      <div class="fields"><label class="field">ตำแหน่ง<select id="mRole"><option value="pharmacist">เภสัชกร</option><option value="assistant">ผู้ช่วยเภสัช</option><option value="manager">ผู้จัดการ (ดูแลร้านได้)</option>${S.me.role === 'owner' ? '<option value="owner">เจ้าของร่วม</option>' : ''}</select></label>
        <label class="field">การจ้าง<select id="mEmp"><option value="parttime">Part-time</option><option value="fulltime">ประจำ</option></select></label></div>
      <div class="fields"><label class="field">สาขาหลัก<select id="mBranch"><option value="">— ไม่ระบุ —</option>${S.branches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <label class="field">ค่าจ้าง/ชม. (บาท)<input id="mRate" type="number" min="0" step="5" value="${S.pay[m.id] ?? ''}" placeholder="เฉพาะ part-time"></label></div>
      <label class="row small"><input type="checkbox" id="mFree" ${m.clock_free ? 'checked' : ''}> ไม่ต้องสแกนเข้า–ออกงาน (เช่น คนที่เปิด–ปิดร้านประจำ ไม่คิดค่าจ้างรายชั่วโมง)</label>
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
  const openForMe = () => S.open.filter((o) => o.work_date >= today());

  function staffHome() {
    const me = M(S.me.member_id), t = today(), mine = myShifts().filter((s) => s.work_date === t), on = inNow(S.myLast), free = me.clock_free && !on;
    const s0 = mine[0], night = s0 ? mins(s0.start_time) >= 900 : nowMins(S.tz) >= 17 * 60;
    let h = `<div class="between"><div><span class="small muted">${greet(S.tz)}</span><h1>คุณ${esc(shortName(S.me.display_name))}</h1></div>${avatar(S.me.display_name, me.color, 'lg', S.profile.picture)}</div>`;
    h += `<div class="shift-hero ${night ? 'night' : ''}"><div class="between"><span class="small" style="opacity:.9">${s0 ? 'เวรวันนี้ · ' + esc(B(s0.branch_id).name) : 'วันนี้ไม่มีเวรในตาราง'}</span>${on ? `<span class="pill">${ic('check')}เข้างานแล้ว ${fmtTime(S.myLast.at, S.tz)}</span>` : s0 ? (() => { const st = statusOf(s0, S.myLast); return `<span class="pill">${ic(st.i)}${st.t}</span>`; })() : ''}</div>
      <div class="time">${s0 ? `${t5(s0.start_time)} – ${t5(s0.end_time)}` : hm(nowMins(S.tz))}</div>
      ${free ? `<span class="small" style="opacity:.9;text-align:center">${ic('user-check')} คุณไม่ต้องสแกนเข้า–ออกงาน เจ้าของร้านตั้งไว้ให้แล้ว</span>` : on ? `<textarea id="note" placeholder="ฝากถึงคนเข้าเวรถัดไป (ไม่บังคับ) เช่น ยาใกล้หมด คนไข้นัดรับยา"></textarea><button class="go" data-act="scan" data-kind="out">${ic('log-out', 'ic-lg')}ออกงาน</button>`
        : `<button class="go" data-act="scan" data-kind="in">${ic('scan-line', 'ic-lg')}เข้างาน</button><span class="tiny" style="opacity:.9;text-align:center">${!s0 && S.org.require_shift && me.role !== 'owner' ? 'วันนี้ไม่มีเวร จะสแกนเข้างานได้เมื่อเจ้าของร้านเพิ่มเวรให้' : 'สแกน QR บนจอร้าน'}</span>`}</div>`;
    if (!me.clock_free && forgotOut(S.myLast)) h += `<div class="card" style="flex-direction:row;align-items:center;border:1.5px solid var(--warn)"><span class="icon-chip t-sun">${ic('alarm-clock')}</span><span class="grow small"><b>ลืมกดออกงานเมื่อ${dShort(todayStr(S.tz, new Date(S.myLast.at)))}</b><br>วันนั้นยังไม่ถูกนับชั่วโมง กดขอแก้เวลาออกงานเพื่อให้เจ้าของอนุมัติ</span><button class="btn" data-act="fixSheet" data-kind="out" data-date="${todayStr(S.tz, new Date(S.myLast.at))}">ขอแก้</button></div>`;
    const bId = s0?.branch_id || me.home_branch_id;
    const notes = S.handover.filter((n) => (!bId || n.branch_id === bId) && Date.now() - new Date(n.created_at).getTime() < 3 * 86400e3).slice(0, 3);
    if (notes.length) h += `<div class="card"><div class="row"><span class="icon-chip t-sun">${ic('notebook-pen')}</span><h3>บันทึกส่งเวรล่าสุด</h3></div>${notes.map((n) => `<div class="stack" style="gap:2px"><span class="small">${esc(n.body)}</span><span class="tiny muted">${esc(M(n.member_id).display_name)} · ${dShort(todayStr(S.tz, new Date(n.created_at)))} ${fmtTime(n.created_at, S.tz)}</span></div>`).join('')}</div>`;
    if (isPharm(me)) { const n = openForMe().filter((o) => !conflictFor(o) && !myClaim(o.id)).length; if (n) h += `<button class="card" data-act="tab" data-tab="open" style="flex-direction:row;align-items:center;border:0;text-align:left;cursor:pointer"><span class="icon-chip t-coral">${ic('megaphone')}</span><span class="grow"><b>มีเวรว่าง ${n} เวรที่รับได้</b><br><span class="small muted">แตะเพื่อดูและกดรับ</span></span>${ic('chevron-right')}</button>`; }
    const up = myShifts().filter((s) => s.work_date > t).slice(0, 5);
    h += `<div class="card"><h3>เวรที่จะถึง</h3>${up.length ? up.map((s) => `<div class="between small"><span>${dShort(s.work_date)} · ${esc(B(s.branch_id).name)}</span><span class="muted">${t5(s.start_time)}–${t5(s.end_time)}</span></div>`).join('') : '<span class="small muted">ยังไม่มีเวรล่วงหน้า</span>'}</div>`;
    const pf = S.fixes.filter((f) => f.status === 'pending').length;
    h += `<div class="between small"><button class="link" data-act="fixSheet">${ic('alarm-clock')} ลืมลงเวลา? ขอแก้เวลา</button>${pf ? `<span class="pill warn">รออนุมัติ ${pf}</span>` : ''}</div>`;
    return h;
  }
  function staffCal() {
    const me = M(S.me.member_id), [a, b] = monthRange(S.month), t = today(), canAvail = isPharm(me) && me.employment === 'parttime';
    const availSet = new Set(S.avail.filter((x) => x.member_id === S.me.member_id).map((x) => x.work_date));
    let g = DOW.map((x) => `<div class="dow">${x.replace('.', '')}</div>`).join('');
    for (let i = 0; i < dow(a); i++) g += `<div class="mcell blank"></div>`;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const s = myShifts().find((x) => x.work_date === d), lv = s && S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending');
      let style = '', cls = '';
      if (lv) style = 'background:var(--warn-soft);color:var(--warn)';
      else if (s) style = `background:var(--${tone(me.color)});color:${tone(me.color) === 'sun' ? '#3B2700' : '#fff'};box-shadow:none`;
      if (canAvail && availSet.has(d)) cls += ' avail';
      if (d === S.sel && S.ptMode !== 'avail') cls += ' sel';
      const dot = isPharm(me) && d >= t && S.open.some((o) => o.work_date === d && !conflictFor(o));
      g += `<button class="mcell ${d < t ? 'past' : ''} ${d === t ? 'today' : ''} ${cls}" style="${style}" data-act="${S.ptMode === 'avail' ? 'toggleAvail' : 'pick'}" data-d="${d}" aria-label="${dLong(d)}">${Number(d.slice(8))}${dot ? '<span class="od"></span>' : ''}</button>`;
    }
    let h = `<div class="between">${monthNav()}</div>`;
    if (canAvail) h += `<div class="seg"><button data-act="ptMode" data-m="view" aria-pressed="${S.ptMode !== 'avail'}">${ic('eye')}ดูเวร</button><button data-act="ptMode" data-m="avail" aria-pressed="${S.ptMode === 'avail'}">${ic('hand')}แจ้งวันว่าง</button></div>`;
    h += `<div class="card"><div class="mini">${g}</div><div class="legend"><span><i style="background:var(--${tone(me.color)})"></i>เวรของฉัน</span>${canAvail ? '<span><i style="box-shadow:inset 0 0 0 2px var(--brand)"></i>แจ้งว่าว่าง</span>' : ''}${isPharm(me) ? '<span><i style="background:var(--coral);border-radius:50%"></i>มีเวรว่าง</span>' : ''}<span><i style="background:var(--warn-soft)"></i>ขอลาแล้ว</span></div></div>`;
    if (S.ptMode === 'avail' && canAvail) return h + `<div class="card small" style="flex-direction:row;align-items:center"><span class="icon-chip t-brand">${ic('hand')}</span>แตะวันที่สะดวกมาทำงาน แตะซ้ำเพื่อยกเลิก เจ้าของร้านจะเห็นตอนจัดเวร</div>`;
    const d = S.sel;
    h += `<h3>${dLong(d)}</h3>`;
    for (const s of myShifts().filter((x) => x.work_date === d)) {
      const lv = S.leaves.find((l) => l.shift_id === s.id && l.status === 'pending');
      h += `<div class="card"><div class="between"><b>เวรของฉัน · ${esc(B(s.branch_id).name)}</b><span>${t5(s.start_time)}–${t5(s.end_time)}</span></div>${lv ? `<span class="pill warn">${ic('hourglass')}ขอลาแล้ว รออนุมัติ</span>` : d > t ? `<button class="btn" data-act="leaveSheet" data-id="${s.id}">${ic('calendar-x')}ขอลาวันนี้</button>` : ''}</div>`;
    }
    if (isPharm(me)) for (const o of S.open.filter((x) => x.work_date === d && x.work_date >= t)) h += openCard(o);
    const others = S.shifts.filter((x) => x.work_date === d && x.member_id !== S.me.member_id);
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
    return `<h1>เวรว่าง</h1><p class="small muted">กดรับแล้วรอเจ้าของร้านอนุมัติ</p>` + (list.length ? list.map(openCard).join('') : `<div class="card"><div class="empty">${ic('coffee', 'ic-lg')}<b>ตอนนี้ไม่มีเวรว่าง</b><span class="small">มีเวรใหม่เมื่อไรจะขึ้นที่นี่</span></div></div>`);
  }
  function staffMoney() {
    const [a, b] = monthRange(S.month), t = today();
    const past = myShifts().filter((s) => s.work_date >= a && s.work_date <= b && s.work_date < t).reverse();
    return `<div class="between">${monthNav()}</div><div id="myhours"><div class="empty"><div class="spinner"></div></div></div>
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
        <h1>${kind === 'in' ? 'เข้างานเรียบร้อย!' : 'ออกงานเรียบร้อย!'}</h1><div style="font:500 36px var(--display)">${fmtTime(r.at, S.tz)}</div><span class="muted">${esc(r.branch)} · ${kind === 'in' ? 'ขอให้วันนี้เป็นวันที่ดีนะ' : 'เดินทางกลับปลอดภัยนะ'}</span>${r.far ? `<span class="pill warn">${ic('map-pin-off')}ตำแหน่งห่างร้าน ${fmtDist(r.distance_m)} · เจ้าของร้านจะเห็นธงเตือน</span>` : ''}</div>`);
      setTimeout(closeLayer, 2800);
      await refresh();
    } catch (e) { closeLayer(); toast(errMsg(e), 'err'); }
  }

  // ---------- actions ----------
  const busyBtn = (el, on) => { if (el && el.tagName === 'BUTTON') el.disabled = on; };
  const ACT = {
    tab: (d) => { S.tab = d.tab; if (S.tab !== 'cal') S.ptMode = 'view'; render(); window.scrollTo(0, 0); },
    close: () => closeLayer(),
    bgClose: (d, el, e) => { if (e.target === el) closeLayer(); },
    refresh: () => refresh(),
    month: async (d) => { S.month = shiftMonth(S.month, Number(d.n)); const [a] = monthRange(S.month); S.sel = S.month === today().slice(0, 7) ? today() : a; await refresh(); },
    pick: (d) => { S.sel = d.d; render(); if (S.isOwner && innerWidth < 900) document.getElementById('day')?.scrollIntoView({ behavior: 'smooth' }); },
    ptMode: (d) => { S.ptMode = d.m; render(); },
    copy: (d) => copy(d.text),
    copyInvite: (d) => { const m = M(d.id); copy(`สวัสดีครับคุณ${shortName(m.display_name)} เชิญเข้าใช้ระบบลงเวร ลงเวลาของร้าน ${S.org.name}\n1) เปิดลิงก์นี้ใน LINE: https://liff.line.me/${CFG.LIFF_ID}\n2) กด "มีรหัสเชิญจากร้าน" แล้วใส่รหัส: ${S.invites[d.id]}`); },
    menu: () => {
      sheet('บัญชีของฉัน', `<div class="row">${avatar(S.profile.name, 'brand', 'lg', S.profile.picture)}<div><b>${esc(S.profile.name)}</b><br><span class="small muted">เข้าสู่ระบบด้วย LINE</span></div></div>
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
    toggleAvail: async (d) => {
      if (d.d < today()) return;
      const has = S.avail.some((x) => x.member_id === S.me.member_id && x.work_date === d.d);
      try {
        if (has) { await q(sb.from('availability').delete().eq('member_id', S.me.member_id).eq('work_date', d.d)); S.avail = S.avail.filter((x) => !(x.member_id === S.me.member_id && x.work_date === d.d)); }
        else { await q(sb.from('availability').insert({ member_id: S.me.member_id, work_date: d.d })); S.avail.push({ member_id: S.me.member_id, work_date: d.d }); }
        render();
      } catch (e) { toast(errMsg(e), 'err'); }
    },
    leaveSheet: (d) => { const s = S.shifts.find((x) => x.id === d.id); sheet('ขอลา · ' + dShort(s.work_date), `<p class="small muted">${esc(B(s.branch_id).name)} · ${t5(s.start_time)}–${t5(s.end_time)}</p><label class="field">เหตุผล (ไม่บังคับ)<input id="lvReason" placeholder="เช่น ธุระครอบครัว"></label><button class="btn primary block" data-act="sendLeave" data-id="${s.id}">${ic('send')}ส่งคำขอลา</button>`); },
    sendLeave: async (d, el) => { busyBtn(el, true); try { await rpc('request_leave', { p_shift: d.id, p_reason: val('lvReason') || null }); closeLayer(); toast('ส่งคำขอลาแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
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
      const b = val('sBranch'), who = val('sWho'), st = val('sStart'), en = val('sEnd'), note = (val('sNote') || '').trim() || null, rep = document.getElementById('sRepeat')?.checked;
      if (!st || !en || en <= st) return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'err');
      const [, last] = monthRange(S.sel.slice(0, 7)); const dates = [S.sel]; if (rep) for (let x = addDays(S.sel, 7); x <= last; x = addDays(x, 7)) dates.push(x);
      busyBtn(el, true);
      try {
        if (who === 'open') await q(sb.from('open_shifts').insert(dates.map((x) => ({ org_id: S.me.org_id, branch_id: b, work_date: x, start_time: st, end_time: en, reason: note }))));
        else {
          const clash = dates.filter((x) => S.shifts.some((s) => s.member_id === who && s.work_date === x && mins(s.start_time) < mins(en) && mins(st) < mins(s.end_time)));
          if (clash.length) { busyBtn(el, false); return toast('ชนกับเวรเดิมวันที่ ' + clash.map((x) => Number(x.slice(8))).join(', '), 'err'); }
          await q(sb.from('shifts').insert(dates.map((x) => ({ org_id: S.me.org_id, branch_id: b, member_id: who, work_date: x, start_time: st, end_time: en, note }))));
        }
        closeLayer(); toast(dates.length > 1 ? `เพิ่มเวรแล้ว ${dates.length} วัน` : 'เพิ่มเวรแล้ว'); await refresh();
      } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); }
    },
    delShift: async (d) => { try { await q(sb.from('shifts').delete().eq('id', d.id)); toast('ลบเวรแล้ว'); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    cancelOpen: async (d) => { try { await q(sb.from('open_shifts').update({ status: 'cancelled' }).eq('id', d.id)); toast('ยกเลิกเวรว่างแล้ว'); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    assign: async (d, el) => { busyBtn(el, true); try { await rpc('assign_open_shift', { p_open: d.open, p_member: d.m }); toast('มอบเวรให้ ' + M(d.m).display_name + ' แล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    approveClaim: async (d, el) => { busyBtn(el, true); try { await rpc('assign_open_shift', { p_open: d.open, p_member: d.m }); toast('อนุมัติแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    rejectClaim: async (d) => { try { await rpc('reject_claim', { p_claim: d.id }); await refresh(); } catch (e) { toast(errMsg(e), 'err'); } },
    decideLeave: async (d, el) => { busyBtn(el, true); try { await rpc('decide_leave', { p_id: d.id, p_approve: d.ok === '1' }); toast(d.ok === '1' ? 'อนุมัติลาแล้ว' : 'ไม่อนุมัติ'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    decideOt: async (d, el) => { busyBtn(el, true); try { await rpc('decide_ot', { p_member: d.m, p_date: d.d, p_approve: d.ok === '1' }); toast(d.ok === '1' ? 'อนุมัติ OT แล้ว' : 'ไม่อนุมัติ OT · คิดเฉพาะในเวลาเวร'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    decideFix: async (d, el) => { busyBtn(el, true); try { await rpc('decide_fix', { p_id: d.id, p_approve: d.ok === '1' }); toast('บันทึกแล้ว'); await refresh(); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    saveOrg: async (d, el) => { busyBtn(el, true); try { await q(sb.from('orgs').update({ name: val('oName').trim(), grace_minutes: Number(val('oGrace')), clip_to_shift: document.getElementById('oClip').checked, ot_min_minutes: Number(val('oOtMin')), allow_self_approve: document.getElementById('oSelf').checked, require_shift: document.getElementById('oReq').checked, early_minutes: Number(val('oEarly')) }).eq('id', S.me.org_id)); toast('บันทึกแล้ว'); await loadOrgs(S.me.org_id); } catch (e) { busyBtn(el, false); toast(errMsg(e), 'err'); } },
    editBranch: (d) => branchSheet(d.id),
    useHere: async (d, el) => {
      busyBtn(el, true); const pos = await getPos(); busyBtn(el, false);
      if (!pos) return toast('อ่านตำแหน่งไม่ได้ กรุณาอนุญาตการใช้ตำแหน่งในเบราว์เซอร์', 'err');
      document.getElementById('bLat').value = pos.lat; document.getElementById('bLng').value = pos.lng;
      document.getElementById('bLocTxt').textContent = `ตั้งแล้ว: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} (คลาดเคลื่อน ±${Math.round(pos.acc)} ม.)`;
      toast('ได้ตำแหน่งแล้ว กดบันทึกเพื่อใช้งาน');
    },
    saveBranch: async (d, el) => {
      const lat = val('bLat'), lng = val('bLng');
      const row = { name: (val('bName') || '').trim(), open_time: val('bOpen'), close_time: val('bClose'), lat: lat === '' ? null : Number(lat), lng: lng === '' ? null : Number(lng), gps_radius: Number(val('bRadius')) || 150, allow_static: !!document.getElementById('bStatic')?.checked };
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
    editMember: (d) => memberSheet(d.id),
    saveMember: async (d, el) => {
      const row = { display_name: (val('mName') || '').trim(), role: val('mRole'), employment: val('mRole') === 'owner' ? 'owner' : val('mEmp'), home_branch_id: val('mBranch') || null, color: val('mColor'), clock_free: document.getElementById('mFree').checked };
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me) refresh(); });
  setInterval(() => { if (S.me && S.isOwner && S.tab === 'home' && document.visibilityState === 'visible' && !$layer.innerHTML) refresh(); }, 60000);

  boot();
})();

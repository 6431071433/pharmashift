/* PharmaShift · จอ QR บนโทรศัพท์ประจำร้าน */
(function () {
  const { CFG, esc, ic, icons, avatar, dayArc, qrPayload, errMsg, todayStr } = window.PS;
  const KEY = 'pharmashift_kiosk_v1';
  const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const root = document.getElementById('k');
  const TZ = 'Asia/Bangkok';
  let conf = null, step = 0, payload = '', status = null, taps = 0, wake = null;

  try { conf = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { conf = null; }

  function renderPair(msg = '') {
    root.innerHTML = `
      <div class="khead"><svg class="logo"><use href="#logo"/></svg><b>PharmaShift</b></div>
      <div class="pair">
        <h1>จับคู่โทรศัพท์ร้าน</h1>
        <p style="opacity:.85">ในแอปของเจ้าของร้าน ไปที่ ตั้งค่า → สาขา → "จับคู่โทรศัพท์ร้าน" แล้วใส่รหัส 6 หลักที่ได้</p>
        <input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="รหัสจับคู่ 6 หลัก">
        <div class="err" id="err">${esc(msg)}</div>
        <button class="btn" id="go">${ic('link')}จับคู่เครื่องนี้</button>
      </div>
      <p class="small" style="opacity:.7">ทำครั้งเดียว เครื่องจะจำสาขาไว้</p>`;
    icons();
    const inp = document.getElementById('code');
    inp.focus();
    const go = async () => {
      const code = inp.value.replace(/\D/g, '');
      if (code.length !== 6) { document.getElementById('err').textContent = 'กรุณาใส่รหัสให้ครบ 6 หลัก'; return; }
      document.getElementById('go').disabled = true;
      const { data, error } = await sb.rpc('kiosk_pair', { p_code: code });
      if (error) { document.getElementById('go').disabled = false; document.getElementById('err').textContent = errMsg(error); return; }
      conf = data; localStorage.setItem(KEY, JSON.stringify(conf)); start();
    };
    document.getElementById('go').onclick = go;
    inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  }

  function qrUrl(p) { return `https://liff.line.me/${CFG.LIFF_ID}?ps=${encodeURIComponent(p)}`; }

  function renderMain() {
    const open = status?.open || '09:00', close = status?.close || '21:00';
    const present = (status?.present || []).filter((p) => p.role !== 'assistant');
    const team = (status?.present || []);
    const sched = (status?.scheduled || []).filter((p) => p.role !== 'assistant');
    let duty;
    if (present.length) {
      duty = present.map((p) => `<div class="row">${avatar(p.name, p.color, 'lg')}<div class="grow"><span class="tiny" style="opacity:.75">เภสัชกรที่ปฏิบัติการขณะนี้</span><br><b style="font-family:var(--display);font-size:19px;font-weight:500">${esc(p.name)}</b><br><span class="tiny" style="opacity:.75">เข้างาน ${esc(p.since)}</span></div></div>`).join('');
    } else if (sched.length) {
      duty = `<div class="row"><span class="icon-chip" style="background:rgba(255,255,255,.15);color:#fff">${ic('clock')}</span><div class="grow"><span class="tiny" style="opacity:.75">เภสัชกรวันนี้</span><br><b>${sched.map((s) => esc(s.name) + ' ' + esc(s.start) + '–' + esc(s.end)).join(', ')}</b></div></div>`;
    } else {
      duty = `<div class="row"><span class="icon-chip" style="background:rgba(255,255,255,.15);color:#fff">${ic('store')}</span><div class="grow"><b>ยินดีต้อนรับ</b><br><span class="tiny" style="opacity:.75">สแกน QR เพื่อเข้างาน / ออกงาน</span></div></div>`;
    }
    const others = team.filter((p) => !present.includes(p));
    root.innerHTML = `
      <div class="khead"><svg class="logo" id="logoTap"><use href="#logo"/></svg><b>${esc(conf.org)} · ${esc(conf.branch)}</b><span class="net ${navigator.onLine ? '' : 'off'}" id="net"><span class="d"></span>${navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์'}</span></div>
      <div class="arcbox">${dayArc(open, close, TZ, 'k')}</div>
      <div class="qrcard"><img id="qr" alt="QR สำหรับเข้างานและออกงาน"><div class="qbar"><i id="qbar"></i></div><span class="tiny" id="qtxt"></span></div>
      <p class="small" style="opacity:.9">สแกนด้วยกล้องมือถือ หรือกด "เข้างาน" ในแอป PharmaShift บน LINE</p>
      <div class="duty">${duty}${others.length ? `<div class="row tiny" style="opacity:.85">${ic('users')}ทีมวันนี้: ${others.map((p) => esc(p.name)).join(', ')}</div>` : ''}</div>`;
    icons();
    drawQR();
    document.getElementById('logoTap').onclick = () => {
      if (++taps >= 7) { localStorage.removeItem(KEY); conf = null; taps = 0; renderPair('ยกเลิกการจับคู่แล้ว'); }
      setTimeout(() => (taps = 0), 4000);
    };
  }

  async function drawQR() {
    step = Math.floor(Date.now() / 30000);
    payload = await qrPayload(conf.branch_id, conf.secret, step);
    const q = qrcode(0, 'M'); q.addData(qrUrl(payload)); q.make();
    const img = document.getElementById('qr'); if (img) img.src = q.createDataURL(8, 0);
  }

  function tick() {
    if (!conf) return;
    const left = 30 - Math.floor((Date.now() / 1000) % 30);
    const bar = document.getElementById('qbar'), t = document.getElementById('qtxt');
    if (bar) bar.style.width = (left / 30 * 100) + '%';
    if (t) t.textContent = `QR ใหม่ใน ${left} วินาที`;
    if (Math.floor(Date.now() / 30000) !== step) drawQR();
  }

  async function refreshStatus() {
    if (!conf) return;
    const p = await qrPayload(conf.branch_id, conf.secret);
    const { data, error } = await sb.rpc('kiosk_status', { p_payload: p });
    if (error) {
      if (/ไม่พบสาขา|QR ไม่ถูกต้อง/.test(errMsg(error))) { localStorage.removeItem(KEY); conf = null; renderPair('รหัสลับของสาขาถูกเปลี่ยน กรุณาจับคู่ใหม่'); }
      return;
    }
    status = data; conf.org = data.org; conf.branch = data.branch; renderMain();
  }

  async function keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (_) { /* ไม่รองรับ */ }
  }

  function start() {
    renderMain(); refreshStatus(); keepAwake();
  }

  setInterval(tick, 1000);
  setInterval(refreshStatus, 60000);
  setInterval(() => { if (conf) { const a = document.querySelector('.arcbox'); if (a) a.innerHTML = dayArc(status?.open || '09:00', status?.close || '21:00', TZ, 'k'); } }, 60000);
  document.addEventListener('visibilitychange', keepAwake);
  window.addEventListener('online', () => conf && refreshStatus());
  window.addEventListener('offline', () => { const n = document.getElementById('net'); if (n) { n.classList.add('off'); n.lastChild.textContent = 'ออฟไลน์'; } });

  conf ? start() : renderPair();
})();

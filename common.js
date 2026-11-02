/* PharmaShift · ฟังก์ชันใช้ร่วมกันระหว่างแอปและจอที่ร้าน */
(function () {
  const CFG = window.PS_CONFIG;
  const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const DOWF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const MONTHSF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TONES = ['brand', 'teal', 'sun', 'lilac', 'sky', 'coral'];

  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <defs><linearGradient id="arcg" x1="0" x2="1"><stop offset="0" stop-color="#FFD48A"/><stop offset=".6" stop-color="#FF7A33"/><stop offset="1" stop-color="#7B6CF6"/></linearGradient></defs>
    <symbol id="logo" viewBox="0 0 48 48"><rect width="48" height="48" rx="14" fill="#1E2A80"/>
      <circle cx="38" cy="10" r="1.7" fill="#fff" opacity=".85"/><circle cx="41" cy="16" r="1" fill="#fff" opacity=".6"/><circle cx="9" cy="12" r="1.1" fill="#fff" opacity=".55"/>
      <g stroke="#FFB347" stroke-width="2.6" stroke-linecap="round"><path d="M24 9.5v3.5"/><path d="M13 14l2.5 2.5"/><path d="M35 14l-2.5 2.5"/></g>
      <path d="M10.5 31a13.5 13.5 0 0 1 27 0z" fill="#FFB347"/>
      <path d="M18.5 25.5l3.6 3.6 7.4-7.6" stroke="#1E2A80" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 31.5h32" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M16 37.5h16" stroke="#7D8BFF" stroke-width="3" stroke-linecap="round"/></symbol>
    <symbol id="sunI" viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.4" fill="#FF8A3D"/></symbol>
    <symbol id="moonI" viewBox="0 0 12 12"><path d="M9 8.6A4.2 4.2 0 0 1 4.4 2a4.3 4.3 0 1 0 4.6 6.6z" fill="#7B6CF6"/></symbol>
  </svg>`;
  if (document.body) document.body.insertAdjacentHTML('afterbegin', SPRITE); else document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('afterbegin', SPRITE));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, c = '') => `<i data-lucide="${n}" class="${c}"></i>`;
  const icons = () => { if (window.lucide) window.lucide.createIcons(); };
  const t5 = (t) => (t ? String(t).slice(0, 5) : '');
  const mins = (t) => { const [h, m] = t5(t).split(':').map(Number); return h * 60 + m; };
  const hm = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const todayStr = (tz = 'Asia/Bangkok', d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const nowMins = (tz = 'Asia/Bangkok') => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()); return mins(p); };
  const fmtTime = (iso, tz = 'Asia/Bangkok') => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const dateObj = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dow = (s) => dateObj(s).getDay();
  const addDays = (s, n) => { const d = dateObj(s); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dShort = (s) => { const d = dateObj(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const dLong = (s) => { const d = dateObj(s); return `วัน${DOWF[d.getDay()]}ที่ ${d.getDate()} ${MONTHSF[d.getMonth()]}`; };
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHSF[m - 1]} ${y + 543}`; };
  const baht = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const ini = (name) => String(name || '?').replace(/^(ภก\.|ภญ\.|ภก |ภญ )/, '').trim().slice(0, 1);
  const tone = (t) => (TONES.includes(t) ? t : 'brand');
  const avatar = (name, t, cls = '', url = '') => url
    ? `<span class="av ${cls}"><img src="${esc(url)}" alt=""></span>`
    : `<span class="av ${cls}" style="background:var(--${tone(t)}-soft);color:var(--${tone(t)}-deep)">${esc(ini(name))}</span>`;
  const greet = (tz) => { const n = nowMins(tz); return n < 12 * 60 ? 'สวัสดีตอนเช้า' : n < 17 * 60 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; };

  function dayArc(o, c, tz, cls = '', lbl = 'ปิดร้าน') {
    const O = mins(o), C = mins(c), N = nowMins(tz);
    const t = Math.max(0, Math.min(1, (N - O) / (C - O)));
    const th = Math.PI * (1 - t), x = (100 + 80 * Math.cos(th)).toFixed(1), y = (100 - 80 * Math.sin(th)).toFixed(1), left = Math.max(0, C - N);
    const sub = N < O ? `เปิด ${t5(o)}` : N >= C ? 'ปิดแล้ว' : `อีก ${Math.floor(left / 60)} ชม. ${left % 60} นาที ${lbl}`;
    return `<svg class="arc ${cls}" viewBox="0 0 200 120" role="img" aria-label="เวลาทำการ ${t5(o)}–${t5(c)}"><path class="trk" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 11"/>${t > 0 ? `<path d="M20 100 A80 80 0 0 1 ${x} ${y}" fill="none" stroke="url(#arcg)" stroke-width="8" stroke-linecap="round"/>` : ''}<circle class="glow" cx="${x}" cy="${y}" r="14" fill="#FFB347" opacity=".3"/><circle cx="${x}" cy="${y}" r="9" fill="#FFB347" stroke="#fff" stroke-width="3"/><text class="al" x="20" y="117" text-anchor="middle">${t5(o)}</text><text class="al" x="180" y="117" text-anchor="middle">${t5(c)}</text><text class="at" x="100" y="84" text-anchor="middle">${hm(N)}</text><text class="al" x="100" y="101" text-anchor="middle">${sub}</text></svg>`;
  }
  function ribbon(o, c, tz) {
    const O = mins(o), C = mins(c), N = nowMins(tz), t = Math.max(0, Math.min(1, (N - O) / (C - O))), left = Math.max(0, C - N);
    const mid = N < O ? `เปิด ${t5(o)}` : N >= C ? 'ปิดแล้ว' : `อีก ${Math.floor(left / 60)} ชม. ${left % 60} นาที ปิดร้าน`;
    return `<div class="ribbon"><div class="rb"><span class="rf" style="left:${(t * 100).toFixed(1)}%"></span><span class="rm" style="left:${(t * 100).toFixed(1)}%"></span></div><div class="rl"><span>${t5(o)}</span><span>${mid}</span><span>${t5(c)}</span></div></div>`;
  }
  function toast(msg, kind = 'ok') {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'toast' + (kind === 'err' ? ' err' : '');
    t.innerHTML = ic(kind === 'err' ? 'circle-alert' : 'check') + esc(msg); icons();
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), kind === 'err' ? 4200 : 2600);
  }
  const errMsg = (e) => (e && (e.message || e.error_description || e.error)) ? String(e.message || e.error_description || e.error).replace(/^.*?ERROR:\s*/, '') : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';

  async function hmacHex(key, msg) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // payload ต้องตรงกับฟังก์ชัน verify_qr ในฐานข้อมูล
  async function qrPayload(branchId, secret, step = Math.floor(Date.now() / 30000)) {
    const code = (await hmacHex(secret, `${branchId}.${step}`)).slice(0, 16);
    return `PS1|${branchId}|${step}|${code}`;
  }
  function confettiHTML() {
    const cols = ['#3346C8', '#FFC23D', '#F2694A', '#3B8AF5', '#8A6AEE', '#1C9C68']; let s = '';
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 110; s += `<span style="--c:${cols[i % cols.length]};--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r - 40).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg"></span>`; }
    return `<div class="confetti">${s}</div>`;
  }

  window.PS = { CFG, DOW, DOWF, MONTHS, MONTHSF, TONES, esc, ic, icons, t5, mins, hm, todayStr, nowMins, fmtTime, dateObj, dow, addDays, dShort, dLong, monthLabel, baht, ini, tone, avatar, greet, dayArc, ribbon, toast, errMsg, hmacHex, qrPayload, confettiHTML };
})();

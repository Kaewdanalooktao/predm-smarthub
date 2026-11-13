/* Pre-DM Smart Hub — Tele-physio consult (WebRTC; signalling via our Supabase Realtime) + admin dashboard.
   Loaded after app.js; uses window.PreDM helpers. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(d));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const thDate = (s, o = { day: "numeric", month: "short", year: "2-digit" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const store = () => A().store;

  /* =====================================================================
     Usage events (this device) — feeds the admin dashboard "this device" mode
     ===================================================================== */
  function logEvent(kind) {
    const ev = store().get("events", {}), d = todayISO();
    (ev[d] = ev[d] || {})[kind] = (ev[d][kind] || 0) + 1;
    const keys = Object.keys(ev).sort(); while (keys.length > 120) delete ev[keys.shift()];
    store().set("events", ev);
  }
  if (!sessionStorage.getItem("predm.sess")) { try { sessionStorage.setItem("predm.sess", "1"); } catch { /* ignore */ } logEvent("session"); }

  /* =====================================================================
     TELE-PHYSIO CONSULT
     ===================================================================== */
  const PTS = [
    { id: "pt1", name: "กภ.กันทรากรณ์ แก้วดานา", spec: "นักกายภาพบำบัด โรงพยาบาลนาแก", tags: ["ออกกำลังกายลดน้ำตาล", "ปวดกล้ามเนื้อและข้อ", "การทรงตัว"], days: [1, 2, 3, 4, 5], slots: ["09:00", "10:30", "13:30", "15:00", "18:30"], color: "#5b8cff" },
    { id: "pt2", name: "กภ.สราลี แสนวิเศษ", spec: "นักกายภาพบำบัด โรงพยาบาลนาแก", tags: ["ออกกำลังกายลดน้ำตาล", "ปวดกล้ามเนื้อและข้อ", "การทรงตัว"], days: [1, 3, 5, 6], slots: ["08:30", "10:00", "14:00", "16:00"], color: "#2fb37a" },
    { id: "pt3", name: "กภ.รัตนพร โยธรรม", spec: "นักกายภาพบำบัด โรงพยาบาลนาแก", tags: ["ออกกำลังกายลดน้ำตาล", "ปวดกล้ามเนื้อและข้อ", "การทรงตัว"], days: [2, 4, 6, 0], slots: ["09:30", "11:00", "13:00", "19:00"], color: "#f08a4b" },
  ];
  const AREAS = ["คอ บ่า ไหล่", "หลัง / เอว", "เข่า", "ข้อเท้า / เท้า", "ชาปลายมือ-ปลายเท้า", "ทรงตัวไม่ดี / กลัวล้ม", "ปวดหลังออกกำลังกาย", "อื่น ๆ"];
  const ptById = (id) => PTS.find((p) => p.id === id) || PTS[0];
  const appts = () => store().get("consults", []);
  const saveAppts = (a) => store().set("consults", a);
  const roomCode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join(""); };
  const ptLink = (room) => `${location.origin}${location.pathname}#consult/pt/${room}`;
  const initials = (n) => n.replace(/^กภ\.\s*/, "").slice(0, 1);
  const CS = { pt: "pt1", date: null, time: null };

  function healthSummary() {
    const pr = A().profile(), ri = store().get("riskInput", null), body = store().get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = body[body.length - 1], fit = store().get("fitness", []).slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    const since = addDays(todayISO(), -6), logs = store().get("logs", []).filter((l) => l.date >= since);
    const mins = logs.reduce((t, l) => t + (l.minutes || 0), 0), byType = {};
    logs.forEach((l) => (byType[l.type] = (byType[l.type] || 0) + (l.minutes || 0)));
    const rows = [["อายุ / เพศ", `${ri?.age || pr.age || "–"} ปี · ${(ri?.sex || pr.sex) === "f" ? "หญิง" : "ชาย"}`]];
    if (ri && A().calcRisk) { const r = A().calcRisk(ri); rows.push(["ความเสี่ยงเบาหวาน", `${r.score}/17 · ${r.level}`]); }
    if (last) rows.push(["Body Composition ล่าสุด", `${thDate(last.date)} · น้ำหนัก ${fmt(last.weight)} กก. · เอว ${fmt(last.waist, 0)} ซม.${last.fat ? ` · ไขมัน ${fmt(last.fat)}%` : ""}${last.height ? ` · BMI ${fmt(last.weight / (last.height / 100) ** 2)}` : ""}`]);
    rows.push(["ออกกำลังกาย 7 วันล่าสุด", `${mins} นาที${Object.keys(byType).length ? " (" + Object.entries(byType).map(([k, v]) => `${A().TYPE_TH?.[k] || k} ${v}`).join(", ") + ")" : ""}`]);
    if (fit) rows.push(["สมรรถภาพกายล่าสุด", `${thDate(fit.date)} · ลุก-นั่ง 30 วิ ${fit.chair30 ?? "–"} ครั้ง · TUG ${fit.tug ?? "–"} วิ · ยืนขาเดียว ${fit.sls ?? "–"} วิ`]);
    return rows;
  }
  const summaryHTML = (rows) => `<dl class="cs-sum">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`;

  function availDates(pt) { const out = []; for (let i = 0; out.length < 8 && i < 21; i++) { const d = addDays(todayISO(), i); if (pt.days.includes(new Date(d + "T00:00:00").getDay())) out.push(d); } return out; }
  function takenSlots(ptId, date) { return new Set(appts().filter((a) => a.pt === ptId && a.date === date && a.status !== "cancelled").map((a) => a.time)); }

  function renderConsult() {
    const root = $("#csRoot"); if (!root || CALL.active) return;
    const pt = ptById(CS.pt), dates = availDates(pt);
    if (!dates.includes(CS.date)) { CS.date = dates[0]; CS.time = null; }
    const taken = takenSlots(pt.id, CS.date);
    const now = new Date(), isToday = CS.date === todayISO();
    const slotOk = (t) => !taken.has(t) && (!isToday || t > `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    const list = appts().slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const upcoming = list.filter((a) => a.status === "booked"), past = list.filter((a) => a.status !== "booked").reverse().slice(0, 6);
    root.innerHTML = `
    <div class="cs-grid">
      <div class="cs-col">
        <section class="card"><div class="card-head"><h2>เลือกนักกายภาพบำบัด</h2><span class="pill demo">ข้อมูลตัวอย่าง</span></div>
          <div class="cs-pts" role="radiogroup" aria-label="นักกายภาพบำบัด">${PTS.map((p) => `
            <button type="button" class="cs-pt" role="radio" aria-checked="${p.id === CS.pt}" data-pt="${p.id}" style="--pc:${p.color}">
              <span class="cs-av">${initials(p.name)}</span>
              <span class="cs-pt-b"><b>${p.name}</b><small>${p.spec}</small><span class="cs-tags">${p.tags.map((t) => `<i>${t}</i>`).join("")}</span></span>
              <span class="cs-on">${p.days.includes(now.getDay()) ? "วันนี้มีคิว" : "นัดล่วงหน้า"}</span></button>`).join("")}
          </div>
        </section>
        <section class="card"><h2>นัดหมายของฉัน</h2>
          ${upcoming.length ? upcoming.map((a) => apptCard(a)).join("") : `<p class="lede">ยังไม่มีนัดหมาย เลือกนักกายภาพและเวลาที่สะดวกเพื่อจองคิว</p>`}
          ${past.length ? `<h3 class="cs-sub">ประวัติการปรึกษา</h3>${past.map((a) => apptCard(a)).join("")}` : ""}
        </section>
      </div>
      <form class="card form cs-form" id="csForm" novalidate>
        <h2>จองคิววิดีโอคอล <small>กับ ${pt.name}</small></h2>
        <label>วันที่</label>
        <div class="cs-dates">${dates.map((d) => `<button type="button" class="cs-date" aria-pressed="${d === CS.date}" data-date="${d}"><small>${thDate(d, { weekday: "short" })}</small><b>${thDate(d, { day: "numeric" })}</b><small>${thDate(d, { month: "short" })}</small></button>`).join("")}</div>
        <label>เวลา (ประมาณ 20–30 นาที)</label>
        <div class="cs-slots">${pt.slots.map((t) => `<button type="button" class="cs-slot" aria-pressed="${t === CS.time}" data-time="${t}" ${slotOk(t) ? "" : "disabled"}>${t}</button>`).join("")}</div>
        <fieldset class="cs-areas"><legend>อาการ / เรื่องที่ต้องการปรึกษา</legend>${AREAS.map((a) => `<label class="cs-chk"><input type="checkbox" name="area" value="${a}"><span>${a}</span></label>`).join("")}</fieldset>
        <label>ระดับความปวดตอนนี้ <b id="csPainV">3</b>/10
          <input type="range" id="csPain" min="0" max="10" value="3" step="1" aria-describedby="csPainHint"></label>
        <small class="cs-hint" id="csPainHint">0 = ไม่ปวดเลย · 10 = ปวดมากที่สุด</small>
        <label>เล่าอาการเพิ่มเติม<textarea id="csDetail" rows="3" maxlength="600" placeholder="เช่น ปวดเข่าขวาเวลาลุกจากเก้าอี้ เป็นมา 2 สัปดาห์ ท่าสควอทแล้วปวดมากขึ้น"></textarea></label>
        <label class="cs-chk solo"><input type="checkbox" id="csShare" checked><span>แนบสรุปข้อมูลสุขภาพจากแอปให้นักกายภาพดูระหว่างคอล</span></label>
        <details class="cs-prev"><summary>ดูข้อมูลที่จะแนบ</summary>${summaryHTML(healthSummary())}</details>
        <p class="form-error" id="csErr" role="alert" hidden></p>
        <button class="btn primary" type="submit">ยืนยันการจองคิว</button>
        <p class="cs-warn">⚠️ หากมีอาการเจ็บหน้าอก หายใจไม่ออก อ่อนแรงครึ่งซีก หรือหกล้มบาดเจ็บรุนแรง โทร <a href="tel:1669">1669</a> ทันที ไม่ต้องรอคิว</p>
      </form>
    </div>`;
  }
  function apptCard(a) {
    const p = ptById(a.pt), st = { booked: ["รอคอล", "wait"], done: ["ปรึกษาแล้ว", "done"], cancelled: ["ยกเลิก", "off"] }[a.status];
    return `<article class="cs-appt ${st[1]}" style="--pc:${p.color}">
      <span class="cs-av sm">${initials(p.name)}</span>
      <div class="cs-appt-b"><b>${p.name}</b><small>${thDate(a.date, { weekday: "short", day: "numeric", month: "short" })} · ${a.time} น. · <span class="st">${st[0]}</span>${a.dur ? ` · ${Math.max(1, Math.round(a.dur / 60))} นาที` : ""}</small>
        <span class="cs-tags">${(a.areas || []).map((t) => `<i>${esc(t)}</i>`).join("")}${a.pain != null ? `<i class="pain">ปวด ${a.pain}/10</i>` : ""}</span>
        ${a.status === "done" ? `<label class="cs-note">คำแนะนำจากนักกายภาพ (จดไว้กันลืม)<textarea data-note="${a.id}" rows="2" placeholder="เช่น ยืดน่องวันละ 3 รอบ งดสควอทลึก 1 สัปดาห์">${esc(a.note || "")}</textarea></label>` : ""}</div>
      ${a.status === "booked" ? `<div class="cs-appt-a"><button class="btn sm primary" type="button" data-join="${a.id}">🎥 เข้าห้องคอล</button><button class="btn sm" type="button" data-cancel="${a.id}">ยกเลิก</button></div>` : ""}
    </article>`;
  }
  function bookSubmit(e) {
    e.preventDefault();
    const err = $("#csErr"), areas = $$('#csForm input[name="area"]:checked').map((i) => i.value);
    const bad = [!CS.time && "เวลา", !areas.length && "อาการที่ต้องการปรึกษา"].filter(Boolean);
    if (bad.length) { err.textContent = "กรุณาเลือก" + bad.join(" และ "); err.hidden = false; err.focus?.(); return; }
    const a = { id: "c" + Date.now(), pt: CS.pt, date: CS.date, time: CS.time, areas, pain: +$("#csPain").value, detail: $("#csDetail").value.trim(), share: $("#csShare").checked, room: roomCode(), status: "booked", created: new Date().toISOString() };
    saveAppts([...appts(), a]); logEvent("consult:book"); CS.time = null;
    A().toast(`จองคิว ${ptById(a.pt).name} ${thDate(a.date)} ${a.time} น. แล้ว`); renderConsult();
  }
  function initConsult() {
    const root = $("#csRoot"); if (!root) return;
    root.addEventListener("click", (e) => {
      const p = e.target.closest("[data-pt]"); if (p) { CS.pt = p.dataset.pt; CS.time = null; return renderConsult(); }
      const d = e.target.closest("[data-date]"); if (d) { CS.date = d.dataset.date; CS.time = null; return renderConsult(); }
      const t = e.target.closest("[data-time]"); if (t && !t.disabled) { CS.time = t.dataset.time; $$(".cs-slot", root).forEach((b) => b.setAttribute("aria-pressed", String(b === t))); return; }
      const j = e.target.closest("[data-join]"); if (j) return startCall("patient", appts().find((a) => a.id === j.dataset.join));
      const c = e.target.closest("[data-cancel]"); if (c && confirm("ยกเลิกนัดหมายนี้?")) { saveAppts(appts().map((a) => (a.id === c.dataset.cancel ? { ...a, status: "cancelled" } : a))); renderConsult(); }
    });
    root.addEventListener("input", (e) => { if (e.target.id === "csPain") $("#csPainV").textContent = e.target.value; });
    root.addEventListener("change", (e) => { const n = e.target.dataset?.note; if (n) saveAppts(appts().map((a) => (a.id === n ? { ...a, note: e.target.value } : a))); });
    root.addEventListener("submit", (e) => { if (e.target.id === "csForm") bookSubmit(e); });
  }

  /* ---------- video call: WebRTC peer-to-peer; our own Supabase (Realtime broadcast) is the only signalling server ----------
     Picture, sound, chat and the health summary travel directly between the two devices (encrypted by WebRTC).
     Supabase only relays the short connection set-up messages (offer / answer / network candidates) for the room. */
  const CALL = { active: false };
  let RT = null;
  async function realtime() {
    if (RT) return RT;
    const cfg = window.PREDM_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล (Supabase) จึงยังใช้วิดีโอคอลไม่ได้");
    if (!window.supabase?.createClient) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/supabase.js"; sc.onload = res; sc.onerror = () => rej(new Error("โหลดระบบวิดีโอคอลไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต")); document.head.appendChild(sc); });
    RT = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "predm.rtc" } });
    return RT;
  }
  const rtcConfig = () => ({ iceServers: (window.PREDM_CONFIG || {}).iceServers || [] });
  const sig = (t, data = {}) => CALL.ch?.send({ type: "broadcast", event: "sig", payload: { t, from: CALL.me, ...data } });
  function newPC() {
    try { CALL.pc?.close(); } catch { /* ignore */ }
    const pc = new RTCPeerConnection(rtcConfig()); CALL.pc = pc; CALL.pendingIce = [];
    CALL.local.getTracks().forEach((t) => pc.addTrack(t, CALL.local));
    pc.onicecandidate = (e) => { if (e.candidate) sig("ice", { to: CALL.peerId, c: e.candidate.toJSON() }); };
    pc.ontrack = (e) => onRemote(e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (pc !== CALL.pc) return;
      if (pc.connectionState === "failed") { $("#csWaitT") && ($("#csWaitT").textContent = "เชื่อมต่อไม่สำเร็จ กำลังลองใหม่…"); $("#csWait") && ($("#csWait").hidden = false); if (CALL.role === "pt") setTimeout(() => CALL.active && dial(), 1500); }
      if (pc.connectionState === "disconnected") addChat("sys", "สัญญาณขาดช่วง กำลังเชื่อมต่อใหม่…");
    };
    return pc;
  }
  function bindDC(dc) {
    CALL.dc = dc;
    CALL.conn = { get open() { return dc.readyState === "open"; }, send: (m) => dc.send(JSON.stringify(m)) };
    dc.onopen = () => { if (CALL.role === "patient") sendData({ type: "hello", appt: { areas: CALL.appt.areas, pain: CALL.appt.pain, detail: CALL.appt.detail }, rows: CALL.appt.share ? healthSummary() : null }); };
    dc.onmessage = (e) => { try { onData(JSON.parse(e.data)); } catch { /* ignore bad message */ } };
  }
  async function dial() { // physiotherapist side: create the offer
    if (!CALL.active || !CALL.peerId) return;
    const pc = newPC(); bindDC(pc.createDataChannel("predm", { ordered: true }));
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    sig("offer", { to: CALL.peerId, sdp: pc.localDescription.toJSON() });
  }
  async function onSignal({ payload: m }) {
    if (!m || m.from === CALL.me || (m.to && m.to !== CALL.me)) return;
    if (m.t === "here" && CALL.role === "pt") { if (!CALL.peerId || CALL.peerId !== m.from || CALL.pc?.connectionState !== "connected") { CALL.peerId = m.from; clearInterval(CALL.retry); $("#csWaitT").textContent = "กำลังโทรหาผู้รับคำปรึกษา…"; dial(); } return; }
    if (m.t === "knock" && CALL.role === "patient") { sig("here"); return; }
    if (m.t === "offer" && CALL.role === "patient") {
      CALL.peerId = m.from; const pc = newPC(); pc.ondatachannel = (e) => bindDC(e.channel);
      await pc.setRemoteDescription(m.sdp); const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
      sig("answer", { to: m.from, sdp: pc.localDescription.toJSON() }); flushIce(); return;
    }
    if (m.t === "answer" && CALL.role === "pt" && CALL.pc && CALL.pc.signalingState === "have-local-offer") { await CALL.pc.setRemoteDescription(m.sdp); flushIce(); return; }
    if (m.t === "ice" && CALL.pc) { if (CALL.pc.remoteDescription) CALL.pc.addIceCandidate(m.c).catch(() => {}); else CALL.pendingIce.push(m.c); return; }
    if (m.t === "bye") endCall(false, "อีกฝ่ายวางสายแล้ว");
  }
  function flushIce() { (CALL.pendingIce || []).forEach((c) => CALL.pc.addIceCandidate(c).catch(() => {})); CALL.pendingIce = []; }
  function onRemote(stream) {
    const v = $("#csRemote"); if (v && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
    $("#csWait").hidden = true; $("#csLive").classList.add("on"); clearInterval(CALL.retry);
    if (!CALL.t0) { CALL.t0 = Date.now(); CALL.tick = setInterval(() => { const s2 = Math.floor((Date.now() - CALL.t0) / 1000); const el = $("#csTimer"); if (el) el.textContent = `${String(Math.floor(s2 / 60)).padStart(2, "0")}:${String(s2 % 60).padStart(2, "0")}`; }, 1000); addChat("sys", "เชื่อมต่อแล้ว"); }
  }
  function placeholderStream(label) {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480; const x = c.getContext("2d");
    const draw = () => { x.fillStyle = "#2b3560"; x.fillRect(0, 0, 640, 480); x.fillStyle = "#fff"; x.font = "bold 34px sans-serif"; x.textAlign = "center"; x.fillText(label, 320, 230); x.font = "20px sans-serif"; x.fillStyle = "#c9d2ff"; x.fillText("ไม่ได้เปิดกล้อง", 320, 272); };
    draw(); CALL.phTimer = setInterval(draw, 1000);
    return c.captureStream(4);
  }
  // ask for camera+mic; the user can skip (or it times out) so a pending permission prompt never blocks the call
  function withSkip(promise, ms) {
    let done = false;
    return new Promise((res, rej) => {
      const btn = $("#csSkip"); if (btn) { btn.hidden = false; btn.onclick = () => { if (!done) { done = true; rej(new Error("skip")); } }; }
      const t = setTimeout(() => { if (!done) { done = true; rej(new Error("timeout")); } }, ms);
      promise.then((v) => { clearTimeout(t); if (done) { v.getTracks().forEach((x) => x.stop()); return; } done = true; res(v); }, (e) => { clearTimeout(t); if (!done) { done = true; rej(e); } });
    }).finally(() => { const b = $("#csSkip"); if (b) b.hidden = true; });
  }
  async function getMedia(label) {
    CALL.noCam = false; CALL.noMic = false;
    if (navigator.mediaDevices?.getUserMedia) {
      try { return await withSkip(navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: { echoCancellation: true, noiseSuppression: true } }), 20000); }
      catch (e) {
        if (e.message !== "skip" && e.message !== "timeout") {
          try { const a = await withSkip(navigator.mediaDevices.getUserMedia({ audio: true }), 15000); CALL.noCam = true; const v = placeholderStream(label); a.getAudioTracks().forEach((t) => v.addTrack(t)); return v; } catch { /* fall through */ }
        }
      }
    }
    CALL.noCam = true; CALL.noMic = true; return placeholderStream(label);
  }
  function callShell(role, a) {
    const p = a ? ptById(a.pt) : null, me = role === "patient" ? "ผู้รับคำปรึกษา" : "นักกายภาพบำบัด";
    $("#csRoot").innerHTML = `
    <div class="cs-call">
      <div class="cs-stage">
        <video id="csRemote" autoplay playsinline></video>
        <div class="cs-wait" id="csWait"><span class="spin"></span><b id="csWaitT">กำลังเชื่อมต่อ…</b><button class="btn sm" type="button" id="csSkip" hidden>เข้าร่วมโดยไม่เปิดกล้อง</button>
          ${role === "patient" ? `<p>ส่งลิงก์นี้ให้นักกายภาพบำบัดเพื่อเข้าห้องคอล</p><div class="cs-link"><input id="csLink" readonly value="${ptLink(a.room)}" aria-label="ลิงก์ห้องคอลสำหรับนักกายภาพ"><button class="btn sm" type="button" id="csCopy">คัดลอก</button></div><small>รหัสห้อง <b>${a.room}</b></small>` : `<p>รหัสห้อง <b>${esc(CALL.room)}</b></p>`}
        </div>
        <video id="csLocal" autoplay playsinline muted></video>
        <div class="cs-top"><span class="live" id="csLive"></span><b>${role === "patient" ? esc(p.name) : "ผู้รับคำปรึกษา"}</b><span id="csTimer">00:00</span></div>
        <div class="cs-ctrls" role="toolbar" aria-label="ควบคุมการคอล">
          <button type="button" class="cc" id="ccMic" aria-pressed="false" title="ปิด/เปิดไมค์"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>ไมค์</span></button>
          <button type="button" class="cc" id="ccCam" aria-pressed="false" title="ปิด/เปิดกล้อง"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/></svg><span>กล้อง</span></button>
          ${role === "patient" ? `<button type="button" class="cc" id="ccShare" title="ส่งสรุปข้อมูลสุขภาพ"><svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h4"/></svg><span>ส่งข้อมูล</span></button>` : ""}
          <button type="button" class="cc end" id="ccEnd" title="วางสาย"><svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3.5-2v-2.5c-2-.7-4-.7-6 0V15.5l-3.5 2z"/></svg><span>วางสาย</span></button>
        </div>
      </div>
      <aside class="card cs-side">
        <h3>ข้อมูลการปรึกษา</h3>
        <div id="csInfo">${role === "patient" ? `<p><b>${esc(p.name)}</b><br><small>${p.spec}</small></p><div class="cs-tags">${a.areas.map((t) => `<i>${esc(t)}</i>`).join("")}<i class="pain">ปวด ${a.pain}/10</i></div>${a.detail ? `<p class="cs-det">${esc(a.detail)}</p>` : ""}` : `<p class="lede">ข้อมูลอาการจะแสดงเมื่อผู้รับคำปรึกษาเข้าห้อง</p>`}</div>
        <h3>แชท</h3>
        <div class="cs-chat" id="csChat" aria-live="polite"></div>
        <form class="cs-chatf" id="csChatF"><input id="csMsg" autocomplete="off" placeholder="พิมพ์ข้อความ…" aria-label="ข้อความแชท" maxlength="400"><button class="btn sm primary" type="submit">ส่ง</button></form>
        <p class="cs-priv">🔒 ภาพ เสียง แชท และข้อมูลสุขภาพส่งตรงระหว่างสองเครื่อง (WebRTC เข้ารหัส) ไม่ผ่านและไม่ถูกบันทึกที่เซิร์ฟเวอร์ใด เซิร์ฟเวอร์ของโครงการใช้แค่ช่วยจับคู่ตอนเริ่มต่อสาย</p>
      </aside>
    </div>`;
    $("#csCopy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#csLink").value); A().toast("คัดลอกลิงก์แล้ว"); } catch { $("#csLink").select(); } });
    $("#ccMic").addEventListener("click", (e) => toggleTrack("audio", e.currentTarget));
    $("#ccCam").addEventListener("click", (e) => toggleTrack("video", e.currentTarget));
    $("#ccShare")?.addEventListener("click", () => { sendData({ type: "summary", rows: healthSummary() }); addChat("sys", "ส่งสรุปข้อมูลสุขภาพให้นักกายภาพแล้ว"); });
    $("#ccEnd").addEventListener("click", () => endCall(true));
    $("#csChatF").addEventListener("submit", (e) => { e.preventDefault(); const t = $("#csMsg").value.trim(); if (!t) return; sendData({ type: "chat", text: t }); addChat("me", t); $("#csMsg").value = ""; });
  }
  function toggleTrack(kind, btn) {
    const tracks = CALL.local?.getTracks().filter((t) => t.kind === kind) || []; if (!tracks.length) return;
    const off = tracks[0].enabled; tracks.forEach((t) => (t.enabled = !off)); btn.setAttribute("aria-pressed", String(off)); btn.classList.toggle("off", off);
  }
  function addChat(who, text) {
    const box = $("#csChat"); if (!box) return;
    box.insertAdjacentHTML("beforeend", `<p class="m ${who}">${who === "sys" ? "" : `<small>${who === "me" ? "คุณ" : CALL.role === "patient" ? "นักกายภาพ" : "ผู้รับคำปรึกษา"}</small>`}${esc(text)}</p>`);
    box.scrollTop = box.scrollHeight;
  }
  const sendData = (msg) => { try { if (CALL.conn?.open) CALL.conn.send(msg); } catch { /* ignore */ } };
  function onData(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "chat") addChat("them", String(m.text || "").slice(0, 400));
    if (m.type === "hello" && CALL.role === "pt") {
      const a = m.appt || {};
      $("#csInfo").innerHTML = `<div class="cs-tags">${(a.areas || []).map((t) => `<i>${esc(t)}</i>`).join("")}${a.pain != null ? `<i class="pain">ปวด ${esc(a.pain)}/10</i>` : ""}</div>${a.detail ? `<p class="cs-det">${esc(a.detail)}</p>` : ""}${m.rows ? `<h4>สรุปข้อมูลสุขภาพ</h4>${summaryHTML(m.rows)}` : ""}`;
    }
    if (m.type === "summary" && CALL.role === "pt") { $("#csInfo").insertAdjacentHTML("beforeend", `<h4>สรุปข้อมูลสุขภาพ</h4>${summaryHTML(m.rows || [])}`); addChat("sys", "ได้รับสรุปข้อมูลสุขภาพแล้ว"); }
    if (m.type === "bye") endCall(false, "อีกฝ่ายวางสายแล้ว");
  }
  async function startCall(role, appt, room) {
    try {
      CALL.active = true; Object.assign(CALL, { role, appt, room: room || appt?.room, t0: 0, conn: null, call: null });
      callShell(role, appt);
      $("#csWaitT").textContent = "กำลังเปิดกล้องและไมค์… กรุณากด “อนุญาต” หากเบราว์เซอร์ถาม";
      CALL.local = await getMedia(role === "patient" ? "ผู้รับคำปรึกษา" : "นักกายภาพบำบัด");
      $("#csLocal").srcObject = CALL.local;
      if (CALL.noCam) $("#ccCam").disabled = true; if (CALL.noMic) $("#ccMic").disabled = true;
      $("#csWaitT").textContent = "กำลังเชื่อมต่อระบบคอล…";
      if (!window.RTCPeerConnection) throw new Error("เบราว์เซอร์นี้ไม่รองรับวิดีโอคอล ลองใช้ Chrome หรือ Safari รุ่นล่าสุด");
      const sb = await realtime();
      CALL.me = Math.random().toString(36).slice(2, 10); CALL.peerId = null;
      CALL.ch = sb.channel(`predm-call-${CALL.room}`, { config: { broadcast: { self: false, ack: false } } });
      CALL.ch.on("broadcast", { event: "sig" }, (msg) => onSignal(msg).catch(() => {}));
      CALL.ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (role === "patient") { $("#csWaitT").textContent = "รอนักกายภาพบำบัดเข้าห้อง…"; sig("here"); logEvent("consult:call"); }
          else { $("#csWaitT").textContent = "รอผู้รับคำปรึกษาเปิดห้อง… ระบบจะเชื่อมต่อให้อัตโนมัติ"; sig("knock"); CALL.retry = setInterval(() => sig("knock"), 3000); }
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") $("#csWaitT").textContent = "เชื่อมต่อระบบคอลไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
      });
    } catch (err) { $("#csWaitT") && ($("#csWaitT").textContent = err.message || String(err)); }
  }
  function endCall(byMe, msg) {
    if (!CALL.active) return;
    if (byMe) { sendData({ type: "bye" }); sig("bye"); }
    const dur = CALL.t0 ? Math.round((Date.now() - CALL.t0) / 1000) : 0;
    clearInterval(CALL.tick); clearInterval(CALL.retry); clearInterval(CALL.phTimer);
    setTimeout(() => { try { CALL.dc?.close(); CALL.pc?.close(); if (CALL.ch) RT?.removeChannel(CALL.ch); } catch { /* ignore */ } CALL.pc = null; CALL.ch = null; CALL.conn = null; }, 300);
    CALL.local?.getTracks().forEach((t) => t.stop());
    if (CALL.role === "patient" && CALL.appt) {
      if (dur > 0) { saveAppts(appts().map((a) => (a.id === CALL.appt.id ? { ...a, status: "done", dur } : a))); logEvent("consult:done"); }
      CALL.active = false; A().toast(msg || (dur ? `จบการคอล ${Math.max(1, Math.round(dur / 60))} นาที อย่าลืมจดคำแนะนำไว้` : "ออกจากห้องคอลแล้ว")); renderConsult();
    } else {
      CALL.active = false;
      $("#csRoot").innerHTML = `<section class="card cs-bye"><h2>จบการคอลแล้ว</h2><p class="lede">${dur ? `ระยะเวลา ${Math.max(1, Math.round(dur / 60))} นาที · ` : ""}${esc(msg || "ขอบคุณที่ให้คำปรึกษา")}</p><button class="btn" type="button" id="csRe">เข้าห้องอีกครั้ง</button></section>`;
      const room = CALL.room; $("#csRe").addEventListener("click", () => ptJoinScreen(room));
    }
  }
  function ptJoinScreen(room) {
    $("#csRoot").innerHTML = `<section class="card cs-bye"><span class="pill demo">สำหรับนักกายภาพบำบัด</span><h2>เข้าห้องให้คำปรึกษา</h2>
      <p class="lede">รหัสห้อง <b>${esc(room)}</b> · ระบบจะขอใช้กล้องและไมค์ ภาพและเสียงส่งตรงระหว่างสองเครื่อง</p>
      <button class="btn primary" type="button" id="csPtJoin">🎥 เข้าห้องคอล</button></section>`;
    $("#csPtJoin").addEventListener("click", () => startCall("pt", null, room));
  }
  function showConsult() {
    const m = location.hash.match(/^#consult\/pt\/([a-z0-9]{6,16})$/);
    if (m) { if (!CALL.active) ptJoinScreen(m[1]); return; }
    renderConsult();
  }
  window.addEventListener("beforeunload", () => { if (CALL.active) { sendData({ type: "bye" }); sig("bye"); } });

  /* ---------- wiring ---------- */
  function onView(v) {
    if (v === "consult") showConsult();
    if (v !== "consult" && CALL.active) endCall(true);
  }
  window.addEventListener("predm:view", (e) => { logEvent("view:" + e.detail); onView(e.detail); });
  window.addEventListener("hashchange", () => { if (/^#consult\/pt\//.test(location.hash)) showConsult(); });
  initConsult();
  const cur = ["consult"].find((v) => $("#view-" + v) && !$("#view-" + v).hidden); if (cur) onView(cur);
  const vis = [...document.querySelectorAll("main > .view")].find((s) => !s.hidden); if (vis) logEvent("view:" + vis.id.replace("view-", ""));
})();

/* Pre-DM Smart Hub — safety & habit helpers:
   1) PAR-Q+ style readiness screening before exercise (valid 12 months)
   2) install as an app (PWA) — install button + iPhone instructions
   3) training schedule & reminders — in-app/notification reminders + "add to calendar" (.ics) that works when the app is closed
   Uses window.PreDM (store, toast). Exposes window.PreDMCare = { gate, openParq }. */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = () => window.PreDM;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const thDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const loggedIn = () => !!A()?.store.get("session", null);

  /* ================= 1) PAR-Q+ readiness screening ================= */
  const PARQ = [
    "แพทย์เคยบอกว่าคุณมีโรคหัวใจ หรือความดันโลหิตสูง หรือไม่",
    "คุณมีอาการเจ็บหน้าอก ขณะพัก ขณะทำกิจวัตรประจำวัน หรือขณะออกกำลังกาย หรือไม่",
    "ใน 12 เดือนที่ผ่านมา คุณเคยเสียการทรงตัวเพราะเวียนศีรษะ หรือหมดสติ หรือไม่ (ตอบ “ไม่” ถ้าเวียนศีรษะเพราะหายใจเร็วระหว่างออกกำลังกายหนัก)",
    "แพทย์เคยวินิจฉัยว่าคุณมีโรคเรื้อรังอื่น นอกจากโรคหัวใจหรือความดันโลหิตสูง (เช่น เบาหวาน โรคไต โรคปอด) หรือไม่",
    "ปัจจุบันคุณกินยารักษาโรคเรื้อรังอยู่หรือไม่ (เช่น ยาลดน้ำตาล ยาลดความดัน)",
    "ปัจจุบันหรือใน 12 เดือนที่ผ่านมา คุณมีปัญหากระดูก ข้อต่อ กล้ามเนื้อ หรือเอ็น ที่อาจแย่ลงถ้าออกกำลังกายมากขึ้น หรือไม่",
    "แพทย์เคยบอกว่าคุณควรออกกำลังกายภายใต้การดูแลทางการแพทย์เท่านั้น หรือไม่",
  ];
  const parq = () => A()?.store.get("parq", null);
  const parqValid = () => { const p = parq(); return !!p && (Date.now() - new Date(p.date + "T12:00:00").getTime()) / 864e5 < 365 && (p.ok || p.ack); };
  let pending = null;
  function modal(html) {
    let m = $("#careModal");
    if (!m) { document.body.insertAdjacentHTML("beforeend", `<div class="care-modal" id="careModal" role="dialog" aria-modal="true" aria-labelledby="careTitle" hidden><div class="care-box" id="careBox"></div></div>`); m = $("#careModal");
      m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) closeModal(); }); }
    $("#careBox").innerHTML = html; m.hidden = false; document.body.classList.add("care-open");
    setTimeout(() => ($("#careBox [autofocus]") || $("#careBox button, #careBox input"))?.focus(), 30);
    return m;
  }
  function closeModal() { const m = $("#careModal"); if (m) m.hidden = true; document.body.classList.remove("care-open"); pending = null; }
  function openParq(cb) {
    pending = cb || null;
    const prev = parq()?.answers || [];
    modal(`<div class="care-head"><span class="care-ico">🩺</span><div><h2 id="careTitle">แบบคัดกรองความพร้อมก่อนออกกำลังกาย</h2><small>ตามแนวทาง PAR-Q+ · 7 ข้อ ใช้เวลาไม่ถึง 1 นาที · ทำปีละครั้ง</small></div><button type="button" class="care-x" data-care="close" aria-label="ปิด">✕</button></div>
      <form id="parqForm" class="parq" novalidate>
        <ol>${PARQ.map((q, i) => `<li><p>${q}</p><div class="yn" role="radiogroup" aria-label="ข้อ ${i + 1}">
          <label><input type="radio" name="q${i}" value="1" ${prev[i] === true ? "checked" : ""}><span>ใช่</span></label>
          <label><input type="radio" name="q${i}" value="0" ${prev[i] === false ? "checked" : ""}><span>ไม่ใช่</span></label></div></li>`).join("")}</ol>
        <p class="care-err" id="parqErr" role="alert" hidden></p>
        <div class="care-foot"><button type="button" class="btn" data-care="allno">ตอบ “ไม่ใช่” ทุกข้อ</button><button type="submit" class="btn primary">ดูผลการคัดกรอง</button></div>
        <small class="care-src">อ้างอิง: The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) · ใช้เพื่อคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย</small>
      </form>`);
  }
  function parqResult(ans) {
    const yes = ans.filter(Boolean).length;
    if (!yes) {
      A().store.set("parq", { date: localISO(), answers: ans, ok: true });
      const cb = pending; closeModal(); renderParqStatus(); A().toast("ผ่านการคัดกรอง พร้อมออกกำลังกายแล้ว 💪");
      return cb && cb();
    }
    modal(`<div class="care-head"><span class="care-ico">⚠️</span><div><h2 id="careTitle">ควรปรึกษาแพทย์ก่อนเพิ่มความหนัก</h2><small>คุณตอบ “ใช่” ${yes} ข้อ</small></div><button type="button" class="care-x" data-care="close" aria-label="ปิด">✕</button></div>
      <div class="parq-res">
        <p>ออกกำลังกายยังเป็นประโยชน์กับคุณ แต่ควร<b>ปรึกษาแพทย์หรือนักกายภาพบำบัด</b>ก่อนเพิ่มความหนัก ระหว่างนี้แนะนำให้</p>
        <ul><li>เริ่มที่ความหนักเบา (Zone 1–2) พูดคุยได้สบาย ครั้งละ 10–15 นาที</li><li>เลี่ยงท่าที่กลั้นหายใจหรือยกของหนัก</li>
          ${ans[4] ? "<li>ถ้ากินยาลดน้ำตาลหรือฉีดอินซูลิน ตรวจน้ำตาลก่อน-หลังออกกำลังกาย และพกลูกอมติดตัว</li>" : ""}
          <li>หยุดทันทีถ้าเจ็บหน้าอก ใจสั่น หน้ามืด หายใจไม่ทัน แล้วโทร 1669</li></ul>
        <label class="ack"><input type="checkbox" id="parqAck"> <span>ฉันเข้าใจคำแนะนำ และจะฝึกแบบเบา ๆ อย่างระมัดระวัง</span></label>
      </div>
      <div class="care-foot"><a class="btn" href="#consult" data-care="close">ปรึกษานักกายภาพ</a><button type="button" class="btn primary" data-care="ack">เริ่มฝึกแบบเบา ๆ</button></div>`);
    $("#careBox").dataset.ans = JSON.stringify(ans);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#careModal [data-care]"); if (!b) return;
    const a = b.dataset.care;
    if (a === "close") return closeModal();
    if (a === "allno") { PARQ.forEach((_, i) => { const r = $(`#parqForm input[name=q${i}][value="0"]`); if (r) r.checked = true; }); return; }
    if (a === "ack") {
      if (!$("#parqAck").checked) { $("#parqAck").focus(); return A().toast("กรุณาติ๊กว่าเข้าใจคำแนะนำก่อน"); }
      A().store.set("parq", { date: localISO(), answers: JSON.parse($("#careBox").dataset.ans || "[]"), ok: false, ack: true });
      const cb = pending; closeModal(); renderParqStatus(); return cb && cb();
    }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id !== "parqForm") return; e.preventDefault();
    const ans = PARQ.map((_, i) => { const r = $(`#parqForm input[name=q${i}]:checked`); return r ? r.value === "1" : null; });
    const miss = ans.findIndex((x) => x === null);
    if (miss >= 0) { const er = $("#parqErr"); er.textContent = `กรุณาตอบข้อ ${miss + 1}`; er.hidden = false; $(`#parqForm input[name=q${miss}]`).focus(); return; }
    parqResult(ans);
  });
  function renderParqStatus() {
    const el = $("#parqStatus"); if (!el) return;
    const p = parq(), valid = parqValid();
    el.innerHTML = !p || !valid
      ? `<div class="parq-chip todo"><span>🩺 ก่อนเริ่มฝึก ทำแบบคัดกรองความพร้อม 7 ข้อ (ไม่ถึง 1 นาที)</span><button type="button" class="btn sm primary" data-parq="open">ทำแบบคัดกรอง</button></div>`
      : p.ok ? `<div class="parq-chip ok"><span>✅ ผ่านการคัดกรองความพร้อม เมื่อ ${thDate(p.date)}</span><button type="button" class="btn sm" data-parq="open">ทำใหม่</button></div>`
      : `<div class="parq-chip warn"><span>⚠️ ฝึกแบบเบา ๆ (Zone 1–2) และควรปรึกษาแพทย์ก่อนเพิ่มความหนัก · คัดกรองเมื่อ ${thDate(p.date)}</span><button type="button" class="btn sm" data-parq="open">ทำใหม่</button></div>`;
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-parq=open]")) openParq(); });
  // used by the exercise player: run cb now if screened, otherwise screen first
  function gate(cb) { if (parqValid()) return cb(); openParq(cb); }

  /* ================= 2) install as an app (PWA) ================= */
  let deferred = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function paintInstall() { $$("[data-install]").forEach((b) => (b.hidden = standalone() || !(deferred || isIOS()))); }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; paintInstall(); });
  window.addEventListener("appinstalled", () => { deferred = null; paintInstall(); A()?.toast("ติดตั้งแอปเรียบร้อย เปิดจากหน้าจอโทรศัพท์ได้เลย"); });
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-install]")) return;
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; return paintInstall(); }
    modal(`<div class="care-head"><span class="care-ico">📲</span><div><h2 id="careTitle">ติดตั้ง Pre-DM บน iPhone / iPad</h2><small>ใช้ได้เหมือนแอป เปิดจากหน้าจอโฮม</small></div><button type="button" class="care-x" data-care="close" aria-label="ปิด">✕</button></div>
      <ol class="care-steps"><li>เปิดหน้านี้ด้วย <b>Safari</b></li><li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างจอ</li><li>เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> แล้วกด <b>เพิ่ม</b></li></ol>
      <div class="care-foot"><button type="button" class="btn primary" data-care="close" autofocus>เข้าใจแล้ว</button></div>`);
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1"))
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  /* ================= 3) training schedule & reminders ================= */
  const DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."], DAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const ICS_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const DEF = { days: [1, 3, 5], time: "18:00", meals: false, mealTimes: ["08:00", "12:30", "18:30"], notify: false };
  const rem = () => ({ ...DEF, ...(A()?.store.get("reminders", null) || {}) });
  const saveRem = (r) => { A().store.set("reminders", r); renderRemind(); renderHomeRemind(); };
  function nextSession(r = rem(), from = new Date()) {
    if (!r.days.length) return null;
    const [hh, mm] = r.time.split(":").map(Number);
    for (let k = 0; k < 8; k++) { const d = new Date(from); d.setDate(d.getDate() + k); d.setHours(hh, mm, 0, 0); if (r.days.includes(d.getDay()) && d > from) return d; }
    return null;
  }
  const trainedToday = () => (A()?.store.get("logs", []) || []).some((l) => l.date === localISO() || l.date === new Date().toISOString().slice(0, 10));
  function renderRemind() {
    const el = $("#remindRoot"); if (!el) return;
    const r = rem(), perm = "Notification" in window ? Notification.permission : "unsupported";
    el.innerHTML = `<section class="card remind" aria-labelledby="remH">
      <div class="card-head"><h2 id="remH">⏰ ตารางนัดฝึกและการแจ้งเตือน</h2></div>
      <p class="hint">ตั้งวันและเวลาที่สะดวก แนะนำอย่างน้อย 3–5 วัน/สัปดาห์ ไม่เว้นเกิน 2 วันติดกัน</p>
      <div class="rm-days" role="group" aria-label="วันที่จะฝึก">${DAYS.map((d, i) => `<button type="button" class="rm-day" data-rday="${i}" aria-pressed="${r.days.includes(i)}" aria-label="${DAYS_FULL[i]}">${d}</button>`).join("")}</div>
      <div class="rm-row"><label>เวลาฝึก<input type="time" id="rmTime" value="${esc(r.time)}"></label>
        <label class="rm-sw"><input type="checkbox" id="rmMeals" ${r.meals ? "checked" : ""}><span>เตือน “เดินหลังอาหาร 10–15 นาที” ทุกวัน (${r.mealTimes.join(" · ")} น.)</span></label></div>
      <p class="rm-next">${nextSession(r) ? `นัดฝึกครั้งถัดไป: <b>${DAYS_FULL[nextSession(r).getDay()]} ${r.time} น.</b>` : "ยังไม่ได้เลือกวันฝึก"}</p>
      <div class="rm-acts">
        ${perm === "unsupported" ? "" : perm === "granted" ? `<label class="rm-sw"><input type="checkbox" id="rmNotify" ${r.notify ? "checked" : ""}><span>แจ้งเตือนบนเครื่องนี้</span></label>` : perm === "denied" ? `<small class="hint">เบราว์เซอร์ปิดการแจ้งเตือนไว้ เปิดได้ในการตั้งค่าเว็บไซต์</small>` : `<button type="button" class="btn sm" data-rm="perm">🔔 เปิดการแจ้งเตือน</button>`}
        <button type="button" class="btn sm primary" data-rm="ics">📅 เพิ่มลงปฏิทินในโทรศัพท์</button>
      </div>
      <small class="hint">การแจ้งเตือนของแอปทำงานเมื่อเปิดแอปค้างไว้ · ถ้าต้องการให้เตือนแม้ปิดแอป ให้กด “เพิ่มลงปฏิทิน” ปฏิทินในโทรศัพท์จะเตือนตามเวลาให้</small>
    </section>`;
  }
  document.addEventListener("click", async (e) => {
    const d = e.target.closest("[data-rday]");
    if (d) { const r = rem(), k = +d.dataset.rday; r.days = r.days.includes(k) ? r.days.filter((x) => x !== k) : [...r.days, k].sort(); return saveRem(r); }
    const b = e.target.closest("[data-rm]"); if (!b) return;
    if (b.dataset.rm === "perm") { const p = await Notification.requestPermission().catch(() => "denied"); const r = rem(); r.notify = p === "granted"; saveRem(r); if (p === "granted") notify("เปิดการแจ้งเตือนแล้ว", "น้องอ่อนหวานจะเตือนเมื่อถึงเวลานัดฝึกนะคะ 💗"); }
    if (b.dataset.rm === "ics") downloadICS();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "rmTime" && e.target.value) { const r = rem(); r.time = e.target.value; saveRem(r); }
    if (e.target.id === "rmMeals") { const r = rem(); r.meals = e.target.checked; saveRem(r); }
    if (e.target.id === "rmNotify") { const r = rem(); r.notify = e.target.checked; saveRem(r); }
  });
  function downloadICS() {
    const r = rem(), now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const dt = (d, t) => `${localISO(d).replace(/-/g, "")}T${t.replace(":", "")}00`;
    const ev = (uid, start, t, rule, title, desc) => ["BEGIN:VEVENT", `UID:${uid}@predm-smarthub`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Bangkok:${dt(start, t)}`, "DURATION:PT30M", `RRULE:${rule}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:-PT10M", "END:VALARM", "END:VEVENT"];
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pre-DM Smart Hub//TH", "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE", "TZID:Asia/Bangkok", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0700", "TZOFFSETTO:+0700", "TZNAME:ICT", "END:STANDARD", "END:VTIMEZONE"];
    if (r.days.length) lines.push(...ev("train", nextSession(r) || now, r.time, `FREQ=WEEKLY;BYDAY=${r.days.map((k) => ICS_DAY[k]).join(",")}`, "ออกกำลังกาย · Pre-DM Smart Hub", "ถึงเวลาออกกำลังกายแล้ว เปิดแอป Pre-DM เพื่อฝึกตามโปรแกรม (ความหนักปานกลาง 30 นาที)"));
    if (r.meals) r.mealTimes.forEach((t, i) => lines.push(...ev("meal" + i, now, t, "FREQ=DAILY", "เดินหลังอาหาร 10–15 นาที", "เดินเบา ๆ หลังมื้ออาหาร ช่วยลดน้ำตาลหลังอาหาร")));
    lines.push("END:VCALENDAR");
    if (lines.length < 20) return A().toast("เลือกวันฝึก หรือเปิดเตือนเดินหลังอาหารก่อน");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "predm-schedule.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    A().toast("ดาวน์โหลดไฟล์ปฏิทินแล้ว เปิดไฟล์เพื่อเพิ่มนัดลงปฏิทินในโทรศัพท์");
  }
  async function notify(title, body) {
    A()?.toast(`⏰ ${title}`);
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification(title, { body, icon: "icon-192.png", badge: "icon-192.png", tag: "predm-" + title }); } catch { /* fall back */ }
    try { new Notification(title, { body, icon: "icon-192.png" }); } catch { /* not allowed */ }
  }
  // check every 30 s while the app is open
  setInterval(() => {
    const r = rem(); if (!loggedIn()) return;
    const now = new Date(), hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, day = localISO(now);
    const fired = A().store.get("remFired", {}) || {};
    const fire = (key, title, body) => { if (fired[key] === day) return; fired[key] = day; A().store.set("remFired", fired); if (r.notify) notify(title, body); else A().toast(`⏰ ${title}`); renderHomeRemind(); };
    if (r.days.includes(now.getDay()) && hm === r.time && !trainedToday()) fire("train", "ถึงเวลาออกกำลังกายแล้ว", "เปิดโปรแกรมแล้วขยับไปด้วยกันนะคะ 💪");
    if (r.meals) r.mealTimes.forEach((t, i) => { if (hm === t) fire("meal" + i, "เดินหลังอาหาร 10–15 นาที", "เดินเบา ๆ ช่วยลดน้ำตาลหลังอาหารค่ะ"); });
  }, 30000);
  function renderHomeRemind() {
    const el = $("#homeReminder"); if (!el) return;
    const r = rem(), today = r.days.includes(new Date().getDay()), nx = nextSession(r);
    if (!r.days.length) { el.innerHTML = `<a class="home-remind" href="#profile" data-goto-remind="1">⏰ ตั้งวันและเวลานัดฝึก เพื่อให้น้องอ่อนหวานช่วยเตือน <b>ตั้งค่า →</b></a>`; return; }
    el.innerHTML = trainedToday() ? `<div class="home-remind done">✅ วันนี้ออกกำลังกายแล้ว เก่งมากค่ะ · นัดถัดไป ${nx ? DAYS_FULL[nx.getDay()] + " " + r.time + " น." : "-"}</div>`
      : today ? `<a class="home-remind today" href="#exercise">⏰ วันนี้มีนัดฝึก <b>${r.time} น.</b> · กดเพื่อเริ่มฝึก →</a>`
      : `<div class="home-remind">📅 นัดฝึกครั้งถัดไป <b>${nx ? DAYS_FULL[nx.getDay()] + " " + r.time + " น." : "-"}</b> <a href="#profile" data-goto-remind="1">แก้ไข</a></div>`;
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-goto-remind]")) setTimeout(() => $("#remindRoot")?.scrollIntoView({ behavior: "smooth", block: "start" }), 250); });

  /* ================= wiring ================= */
  window.addEventListener("predm:view", (e) => {
    if (e.detail === "exercise") renderParqStatus();
    if (e.detail === "profile") renderRemind();
    paintInstall();
  });
  window.addEventListener("predm:home", () => { renderHomeRemind(); paintInstall(); });
  window.PreDMCare = { gate, openParq, parqValid };
  paintInstall();
})();

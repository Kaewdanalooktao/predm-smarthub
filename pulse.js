/* Pre-DM Smart Hub — "สอนวัดชีพจร": how to take your pulse at the wrist or neck, a guided 15 s / 30 s timer,
   then BPM → which exercise-intensity zone that is (HRmax from the same formula as the heart-rate card). Saved on this device. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const A = () => window.PreDM, M = () => window.PreDMMusic;
  const P = { site: "wrist", secs: 15, when: "after", count: 0, timer: 0, left: 0, phase: "learn" };

  const WRIST = `<svg viewBox="0 0 240 160" class="pz-svg" aria-hidden="true"><path d="M10 120c40-6 80-10 120-8l70-6c14-1 24 10 22 22-2 10-10 16-20 16l-88 4C70 150 40 150 10 146z" fill="#f2c9a5" stroke="#c99470" stroke-width="2"/>
    <path d="M150 112c8-24 30-40 52-46" stroke="#c99470" stroke-width="2" fill="none"/><path d="M200 108c10-6 24-6 30 2" stroke="#c99470" stroke-width="2" fill="none"/>
    <path d="M60 128c30 0 60-2 86-6" stroke="#d65a5a" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/>
    <g transform="translate(118 64) rotate(12)"><rect x="0" y="0" width="22" height="66" rx="11" fill="#e8b48c" stroke="#b9805a" stroke-width="2"/><rect x="26" y="4" width="22" height="70" rx="11" fill="#e8b48c" stroke="#b9805a" stroke-width="2"/></g>
    <circle cx="140" cy="126" r="9" fill="none" stroke="#e53935" stroke-width="3"><animate attributeName="r" values="7;12;7" dur="0.9s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.3;1" dur="0.9s" repeatCount="indefinite"/></circle>
    <text x="12" y="24" font-size="13" fill="#5a3a22" font-weight="700">หงายมือ · นิ้วชี้+นิ้วกลาง</text><text x="12" y="42" font-size="12" fill="#5a3a22">วางใต้โคนนิ้วโป้ง ด้านข้อมือ</text></svg>`;
  const NECK = `<svg viewBox="0 0 240 160" class="pz-svg" aria-hidden="true"><ellipse cx="96" cy="56" rx="44" ry="50" fill="#f2c9a5" stroke="#c99470" stroke-width="2"/><path d="M70 98c0 20-4 36-20 52h96c-16-16-20-32-20-52" fill="#f2c9a5" stroke="#c99470" stroke-width="2"/>
    <path d="M96 104v40" stroke="#d9a07a" stroke-width="6" stroke-linecap="round"/><path d="M118 108c4 14 6 26 6 38" stroke="#d65a5a" stroke-width="3" stroke-dasharray="6 5" opacity=".8"/>
    <g transform="translate(118 96) rotate(-28)"><rect x="0" y="0" width="20" height="62" rx="10" fill="#e8b48c" stroke="#b9805a" stroke-width="2"/><rect x="23" y="3" width="20" height="64" rx="10" fill="#e8b48c" stroke="#b9805a" stroke-width="2"/></g>
    <circle cx="120" cy="120" r="9" fill="none" stroke="#e53935" stroke-width="3"><animate attributeName="r" values="7;12;7" dur="0.9s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.3;1" dur="0.9s" repeatCount="indefinite"/></circle>
    <text x="150" y="40" font-size="12.5" fill="#5a3a22" font-weight="700">ข้างลูกกระเดือก</text><text x="150" y="58" font-size="12" fill="#5a3a22">ใต้มุมกราม</text><text x="150" y="76" font-size="12" fill="#c62828" font-weight="700">ทีละข้าง กดเบา ๆ</text></svg>`;

  function hrmax() { const h = A()?.store.get("hrInput", {}) || {}, age = h.age || A()?.profile?.()?.age || 50; return { age, max: Math.round((h.formula || "tanaka") === "tanaka" ? 208 - 0.7 * age : 220 - age), formula: h.formula || "tanaka" }; }
  function judge(bpm) {
    const { max } = hrmax(), pct = Math.round((bpm / max) * 100);
    if (P.when === "rest") {
      if (bpm < 50) return { cls: "warn", t: "ชีพจรขณะพักค่อนข้างช้า", d: "ถ้ามีอาการหน้ามืด เหนื่อยง่าย หรือใช้ยาลดความดัน/โรคหัวใจ ควรปรึกษาแพทย์", pct };
      if (bpm <= 100) return { cls: "ok", t: "ชีพจรขณะพักปกติ (60–100 ครั้ง/นาที)", d: "ยิ่งออกกำลังกายสม่ำเสมอ ชีพจรขณะพักมักลดลง แปลว่าหัวใจแข็งแรงขึ้น", pct };
      return { cls: "bad", t: "ชีพจรขณะพักเร็วกว่าปกติ (> 100)", d: "พักนั่งนิ่ง 5 นาทีแล้ววัดใหม่ ถ้ายังสูง หรือใจสั่น เจ็บหน้าอก ควรพบแพทย์ และยังไม่ควรออกกำลังกายหนัก", pct };
    }
    if (pct < 57) return { cls: "low", t: `เบามาก (${pct}% ของ HRmax)`, d: "เพิ่มความเร็วหรือแรงอีกนิด เช่น เดินเร็วขึ้น แกว่งแขนแรงขึ้น", pct };
    if (pct < 64) return { cls: "low", t: `เบา (${pct}%) ใกล้ถึงเป้าแล้ว`, d: "เร่งอีกเล็กน้อยจนหายใจเร็วขึ้นแต่ยังพูดเป็นประโยคได้", pct };
    if (pct <= 76) return { cls: "ok", t: `ปานกลาง ✓ อยู่ในเป้าหมาย (${pct}%)`, d: "ความหนักที่แนะนำสำหรับกลุ่มเสี่ยงเบาหวาน รักษาระดับนี้ 20–30 นาที", pct };
    if (pct <= 90) return { cls: "warn", t: `หนัก (${pct}%)`, d: "ทำได้ถ้าแข็งแรงและแพทย์อนุญาต ถ้าเพิ่งเริ่ม ให้ชะลอลงเล็กน้อย", pct };
    return { cls: "bad", t: `หนักมาก (${pct}%) ควรชะลอ/หยุดพัก`, d: "ลดความเร็วลงทันที ถ้าเจ็บหน้าอก หน้ามืด หายใจไม่ทัน ให้หยุดและขอความช่วยเหลือ", pct };
  }

  function modal() {
    if (!$("#pzModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="pzModal" role="dialog" aria-modal="true" aria-labelledby="pzTitle" hidden><div class="fq-box pz-box" id="pzBox"></div></div>`);
      $("#pzModal").addEventListener("click", onClick);
    }
    $("#pzModal").hidden = false; document.body.classList.add("care-open");
  }
  function close() { clearInterval(P.timer); $("#pzModal").hidden = true; document.body.classList.remove("care-open"); }
  const head = `<div class="fq-head"><span class="fq-av">💓</span><div><h2 id="pzTitle">วิธีวัดชีพจรด้วยตัวเอง</h2><small>ใช้ตรวจว่าออกกำลังกายหนักพอดีไหม</small></div><button type="button" class="care-x" data-pz="close" aria-label="ปิด">✕</button></div>`;
  function open() { P.phase = "learn"; modal(); draw(); }
  function draw() {
    const { max, age } = hrmax(), lo = Math.round(max * 0.64), hi = Math.round(max * 0.76), hist = (A()?.store.get("pulseLog", []) || []).slice(0, 5);
    let body = "";
    if (P.phase === "learn") body = `
      <div class="pz-tabs" role="tablist"><button type="button" role="tab" aria-pressed="${P.site === "wrist"}" data-site="wrist">✋ ที่ข้อมือ (แนะนำ)</button><button type="button" role="tab" aria-pressed="${P.site === "neck"}" data-site="neck">🧣 ที่คอ</button></div>
      <div class="pz-learn">${P.site === "wrist" ? WRIST : NECK}
        <ol>${(P.site === "wrist" ? ["นั่งหรือยืนนิ่ง หงายฝ่ามือขึ้น", "ใช้ <b>นิ้วชี้และนิ้วกลาง</b> วางที่ข้อมือ ใต้โคนนิ้วโป้ง (ห้ามใช้นิ้วโป้ง เพราะมีชีพจรของตัวเอง)", "กดเบา ๆ จนรู้สึกตุบ ๆ", "กดเริ่มจับเวลา แล้วนับจำนวนครั้งที่เต้น"]
          : ["ใช้นิ้วชี้และนิ้วกลาง วางข้างลูกกระเดือก ใต้มุมกราม", "<b>กดเบา ๆ ทีละข้างเท่านั้น</b> ห้ามกดสองข้างพร้อมกัน", "ถ้ารู้สึกเวียนหัว ให้หยุดและเปลี่ยนไปวัดที่ข้อมือ", "กดเริ่มจับเวลา แล้วนับจำนวนครั้งที่เต้น"]).map((x) => `<li>${x}</li>`).join("")}</ol></div>
      <div class="pz-zone"><div><small>HRmax ของคุณ (อายุ ${age})</small><b>${max}</b></div><div class="ok"><small>เป้าหมายขณะออกกำลังกาย (ปานกลาง)</small><b>${lo}–${hi}</b><small>ครั้ง/นาที</small></div><div><small>นับ 15 วินาที ควรได้</small><b>${Math.round(lo / 4)}–${Math.round(hi / 4)}</b><small>ครั้ง</small></div></div>
      <fieldset class="pz-opt"><legend>วัดตอนไหน</legend><button type="button" aria-pressed="${P.when === "after"}" data-when="after">🏃 ระหว่าง/ทันทีหลังออกกำลังกาย</button><button type="button" aria-pressed="${P.when === "rest"}" data-when="rest">🪑 ขณะพัก (ตื่นนอน/นั่งพัก 5 นาที)</button></fieldset>
      <fieldset class="pz-opt"><legend>นับนานเท่าไร</legend><button type="button" aria-pressed="${P.secs === 15}" data-secs="15">15 วินาที × 4</button><button type="button" aria-pressed="${P.secs === 30}" data-secs="30">30 วินาที × 2 (ถ้าชีพจรไม่สม่ำเสมอ)</button></fieldset>
      <p class="pz-tip">💡 วัดทันทีภายใน 10 วินาทีหลังหยุด เพราะชีพจรลดลงเร็ว · ถ้าไม่สะดวกจับชีพจร ใช้ “Talk test”: ความหนักปานกลาง = หายใจเร็วขึ้น พูดเป็นประโยคได้ แต่ร้องเพลงไม่ได้</p>
      ${hist.length ? `<div class="pz-hist"><b>ผลที่วัดไว้</b>${hist.map((h) => `<span class="${h.cls}">${esc(h.date.slice(5))} · ${h.bpm} ครั้ง/นาที · ${h.when === "rest" ? "ขณะพัก" : "ออกกำลังกาย"}</span>`).join("")}</div>` : ""}
      <div class="care-foot"><button type="button" class="btn primary" data-pz="ready">⏱️ เริ่มฝึกวัด</button></div>`;
    if (P.phase === "ready" || P.phase === "count") body = `
      <div class="pz-timer"><div class="pz-ring" style="--p:${P.phase === "count" ? (P.secs - P.left) / P.secs : 0}"><b>${P.phase === "count" ? P.left : P.secs}</b><small>วินาที</small></div>
        <p>${P.phase === "ready" ? `วางนิ้วที่${P.site === "wrist" ? "ข้อมือ" : "คอ"}ให้รู้สึกชีพจรก่อน แล้วกดเริ่ม · นับ “1” ที่จังหวะแรกหลังเริ่ม` : "นับจังหวะชีพจรในใจ… (มีเสียงติ๊กทุกวินาที)"}</p>
        ${P.phase === "ready" ? `<button type="button" class="btn primary pz-go" data-pz="go">▶ เริ่มจับเวลา ${P.secs} วินาที</button>` : `<button type="button" class="btn" data-pz="cancel">ยกเลิก</button>`}</div>`;
    if (P.phase === "enter") body = `
      <div class="pz-enter"><p>นับได้กี่ครั้งใน ${P.secs} วินาที?</p>
        <div class="pz-num"><button type="button" data-n="-5">−5</button><button type="button" data-n="-1">−1</button><output>${P.count}</output><button type="button" data-n="1">+1</button><button type="button" data-n="5">+5</button></div>
        <small>= ${P.count * (60 / P.secs)} ครั้ง/นาที</small>
        <div class="care-foot"><button type="button" class="btn" data-pz="ready">วัดใหม่</button><button type="button" class="btn primary" data-pz="calc">ดูผล ›</button></div></div>`;
    if (P.phase === "result") { const bpm = P.count * (60 / P.secs), j = judge(bpm); body = `
      <div class="pz-result ${j.cls}"><b class="pz-bpm">${bpm}</b><small>ครั้ง/นาที</small><h3>${esc(j.t)}</h3><p>${esc(j.d)}</p>
        ${P.when === "after" ? `<div class="pz-bar"><i style="left:57%"></i><i style="left:64%"></i><i style="left:76%"></i><i style="left:90%"></i><em style="left:${Math.min(100, j.pct)}%">▼</em></div><div class="pz-bar-l"><span>เบา</span><span>ปานกลาง ✓</span><span>หนัก</span><span>หนักมาก</span></div>` : ""}</div>
      <div class="care-foot"><button type="button" class="btn" data-pz="learn">กลับไปวิธีวัด</button><button type="button" class="btn" data-pz="ready">วัดอีกครั้ง</button><button type="button" class="btn primary" data-pz="save">💾 บันทึกผล</button></div>`; }
    $("#pzBox").innerHTML = head + body;
  }
  function start() {
    P.phase = "count"; P.left = P.secs; draw(); M()?.sfx("ok"); A()?.speak?.("เริ่ม", { force: true });
    clearInterval(P.timer);
    P.timer = setInterval(() => {
      P.left--; if (P.left > 0) { M()?.sfx("hover"); const ring = $(".pz-ring"); if (ring) { ring.style.setProperty("--p", (P.secs - P.left) / P.secs); ring.querySelector("b").textContent = P.left; } return; }
      clearInterval(P.timer); M()?.sfx("win"); A()?.speak?.("หยุด", { force: true }); P.count = P.secs === 15 ? 20 : 40; P.phase = "enter"; draw();
    }, 1000);
  }
  function onClick(e) {
    if (e.target.id === "pzModal") return close();
    const t = (s) => e.target.closest(s);
    if (t("[data-site]")) { P.site = t("[data-site]").dataset.site; return draw(); }
    if (t("[data-when]")) { P.when = t("[data-when]").dataset.when; return draw(); }
    if (t("[data-secs]")) { P.secs = +t("[data-secs]").dataset.secs; return draw(); }
    if (t("[data-n]")) { P.count = Math.max(0, Math.min(P.secs * 4, P.count + +t("[data-n]").dataset.n)); return draw(); }
    const b = t("[data-pz]"); if (!b) return;
    const a = b.dataset.pz;
    if (a === "close") return close();
    if (a === "learn") { P.phase = "learn"; return draw(); }
    if (a === "ready") { clearInterval(P.timer); P.phase = "ready"; return draw(); }
    if (a === "cancel") { clearInterval(P.timer); P.phase = "ready"; return draw(); }
    if (a === "go") return start();
    if (a === "calc") { P.phase = "result"; return draw(); }
    if (a === "save") {
      const bpm = P.count * (60 / P.secs), j = judge(bpm), log = A()?.store.get("pulseLog", []) || [];
      log.unshift({ date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), bpm, when: P.when, cls: j.cls, site: P.site });
      A()?.store.set("pulseLog", log.slice(0, 60)); A()?.toast?.(`บันทึกชีพจร ${bpm} ครั้ง/นาทีแล้ว`); P.phase = "learn"; return draw();
    }
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-pulse]")) { e.preventDefault(); open(); } });
  window.PreDMPulse = { open, judge };
})();

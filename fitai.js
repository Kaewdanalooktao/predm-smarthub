/* Pre-DM Smart Hub — AI-measured fitness tests (camera + MediaPipe Pose, processed on this device).
   Adds "📷 วัดด้วย AI" to supported tests on the fitness page; the result fills the form for the user to confirm. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const GUIDE = {
    chair30: { cam: "วางกล้องด้านข้าง ห่าง 2–3 เมตร ระดับสะโพก ให้เห็นทั้งตัวและเก้าอี้", steps: ["ใช้เก้าอี้มีพนักพิง สูงประมาณ 43 ซม. ชิดผนังกันลื่น", "นั่งกลางเก้าอี้ หลังตรง เท้าวางราบ กอดอก", "เมื่อได้ยิน “เริ่ม” ลุกขึ้นยืนตรงสุดแล้วนั่งลงให้สุด ทำให้มากที่สุดใน 30 วินาที"], safety: "หยุดทันทีถ้าเวียนศีรษะหรือเจ็บเข่า" },
    step2: { cam: "วางกล้องด้านหน้า ห่าง 2–3 เมตร ให้เห็นตั้งแต่ศีรษะถึงเท้า", steps: ["ยืนตรงนิ่ง ๆ ให้ระบบวัดความสูงเข่า (เส้นเหลือง = กึ่งกลางระหว่างเข่ากับสะโพก)", "เมื่อได้ยิน “เริ่ม” ย่ำเท้าอยู่กับที่ ยกเข่าให้ถึงเส้นเหลือง", "ระบบนับเฉพาะเข่าขวาที่ยกถึงเส้น ทำต่อเนื่อง 2 นาที พักได้ถ้าจำเป็น"], safety: "ยืนใกล้ผนังหรือโต๊ะไว้จับ หยุดถ้าเหนื่อยหอบมากหรือเจ็บหน้าอก" },
    sls: { cam: "วางกล้องด้านหน้า ห่าง 2–3 เมตร ให้เห็นเท้าทั้งสองข้าง", steps: ["ยืนตรง มือเท้าเอว ข้างโต๊ะหรือผนัง", "เมื่อได้ยิน “เริ่ม” ยกเท้าข้างหนึ่งให้พ้นพื้น ระบบเริ่มจับเวลาเอง", "เวลาหยุดเมื่อเท้าแตะพื้น (สูงสุด 60 วินาที)"], safety: "ต้องมีคนอยู่ใกล้ หรือยืนข้างโต๊ะที่จับได้ทันที" },
    tug: { cam: "วางกล้องด้านข้าง ห่าง 3–4 เมตร ให้เห็นเก้าอี้และกรวยที่ห่างออกไป 8 ฟุต (2.44 ม.)", steps: ["วางกรวย/ขวดน้ำห่างจากขอบเก้าอี้ 8 ฟุต (2.44 เมตร)", "นั่งเต็มเก้าอี้ มือวางบนต้นขา", "เมื่อได้ยิน “เริ่ม” ลุกเดินเร็วที่สุดอย่างปลอดภัย อ้อมกรวย แล้วกลับมานั่ง ระบบหยุดเวลาเมื่อนั่งลง (กด “หยุดเวลา” ได้ถ้าระบบจับไม่ทัน)"], safety: "ห้ามวิ่ง มีคนเดินข้าง ๆ ถ้าเสี่ยงล้ม" },
    sitreach: { cam: "วางกล้องด้านข้าง ห่าง 1.5–2 เมตร ระดับเก้าอี้ ให้เห็นมือและปลายเท้าชัด", steps: ["นั่งขอบเก้าอี้ หันข้างเข้ากล้อง ขาข้างที่ใกล้กล้องเหยียดตรง ส้นเท้าแตะพื้น ปลายเท้าชี้ขึ้น", "ขาอีกข้างงอ เท้าวางราบ", "เมื่อได้ยิน “เริ่ม” วางมือซ้อนกัน ค่อย ๆ โน้มตัวเอื้อมไปทางปลายเท้า ค้างไว้ 2 วินาที (ทำได้หลายครั้งใน 20 วินาที)"], safety: "ไม่กระตุก ไม่เด้งตัว หยุดถ้าเจ็บหลัง · ระยะเป็นค่าประมาณจากภาพ" },
  };
  const FA = { test: null, runner: null, last: null, spoke: {}, result: null };
  const say = (t, force) => { if ($("#faVoice")?.checked) A().speak?.(t, { force }); };

  function overlay() {
    let o = $("#faOverlay"); if (o) return o;
    o = document.createElement("div"); o.id = "faOverlay"; o.className = "fa-overlay"; o.hidden = true; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
    document.body.appendChild(o); return o;
  }
  function open(test) {
    const T = window.PreDMFit?.tests?.[test]; if (!T) return A().toast("กำลังโหลดระบบ AI ลองอีกครั้งในไม่กี่วินาที");
    const G = GUIDE[test], o = overlay(); FA.test = test; FA.result = null; FA.spoke = {};
    o.innerHTML = `<div class="fa-box">
      <div class="fa-head"><div><small>วัดสมรรถภาพด้วย AI · ประมวลผลในเครื่อง</small><h2>${esc(T.name)}</h2></div><button type="button" class="icon-btn" data-fa="close" aria-label="ปิด">✕</button></div>
      <div class="fa-body">
        <div class="fa-stage"><video id="faVideo" playsinline muted hidden></video><canvas id="faCanvas" width="640" height="480"></canvas>
          <div class="fa-msg" id="faMsg">กด “เริ่มวัด” เพื่อเปิดกล้อง</div>
          <div class="fa-count" id="faCount" hidden></div>
          <div class="fa-hud" id="faHud" hidden><span><small id="faValL">${T.unit === "ครั้ง" ? "นับได้" : T.unit === "ซม." ? "ระยะดีที่สุด" : "เวลา"}</small><b id="faVal">0</b><em>${T.unit}</em></span><span id="faTimeW"><small>เหลือ</small><b id="faTime">${T.dur}</b><em>วินาที</em></span></div>
        </div>
        <aside class="fa-side">
          <div class="fa-cam">📷 ${esc(G.cam)}</div>
          <ol class="fa-steps">${G.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          <p class="fa-safe">⚠️ ${esc(G.safety)}</p>
          <p class="fa-fb" id="faFb" aria-live="polite">—</p>
          <label class="switch"><input type="checkbox" id="faVoice" checked><span></span>เสียงบอก</label>
          <div class="fa-legend"><span><i class="dot w"></i>กำลังจับ</span><span><i class="dot g"></i>นับ/ถูกต้อง</span><span><i class="dot r"></i>ท่าไม่ถูก</span></div>
          <div class="fa-acts" id="faActs"><button class="btn primary" type="button" data-fa="start">▶ เริ่มวัด</button></div>
        </aside>
      </div></div>`;
    o.hidden = false; document.body.style.overflow = "hidden"; $("[data-fa='start']", o).focus();
  }
  function close() {
    FA.runner?.stop(); FA.runner = null; const o = $("#faOverlay"); if (o) { o.hidden = true; o.innerHTML = ""; } document.body.style.overflow = "";
  }
  async function start() {
    const T = window.PreDMFit.tests[FA.test];
    $("#faActs").innerHTML = `<button class="btn" type="button" data-fa="close">ยกเลิก</button>${FA.test === "tug" ? `<button class="btn primary" type="button" data-fa="stop">⏹ หยุดเวลา</button>` : ""}`;
    FA.runner = window.PreDMFit.create($("#faVideo"), $("#faCanvas"), $("#faMsg"));
    const pr = A().profile(), body = A().store.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    say(`${T.name} จัดท่าเริ่มต้นตามคำแนะนำ`, true);
    try { await FA.runner.start(FA.test, { height: body?.height || pr.height || 160 }, onUpdate); }
    catch (e) { $("#faMsg").textContent = "เปิดกล้องไม่ได้: " + (e.message || e) + " · ตรวจสิทธิ์กล้อง หรือกรอกผลเองในแบบฟอร์ม"; $("#faMsg").hidden = false; $("#faActs").innerHTML = `<button class="btn" type="button" data-fa="close">ปิด</button>`; }
  }
  function onUpdate(r) {
    FA.last = r; const T = window.PreDMFit.tests[FA.test];
    const fb = $("#faFb"); if (fb) { fb.textContent = r.msg || "—"; fb.dataset.state = r.state; }
    const cd = $("#faCount");
    if (r.countdown) { cd.hidden = false; cd.textContent = r.countdown; if (!FA.spoke["c" + r.countdown]) { FA.spoke["c" + r.countdown] = 1; say(String(r.countdown), true); } }
    else cd.hidden = true;
    if (r.go && !FA.spoke.go) { FA.spoke.go = 1; say("เริ่ม", true); }
    if (r.phase === "run" || r.done) {
      $("#faHud").hidden = false; $("#faVal").textContent = r.value ?? "–";
      const tw = $("#faTimeW"); if (FA.test === "tug") { tw.hidden = true; } else { const left = Math.ceil(r.left ?? 0); $("#faTime").textContent = left; if (left === 10 && !FA.spoke.t10 && T.dur >= 30) { FA.spoke.t10 = 1; say("อีก 10 วินาที", true); } }
      if (r.rep && FA.test !== "sitreach" && $("#faVoice")?.checked && typeof r.value === "number" && r.value % 5 === 0) say(String(r.value));
      if (r.state === "bad" && r.msg && FA.lastBad !== r.msg) { FA.lastBad = r.msg; say(r.msg); }
    }
    if (r.done && FA.result == null) finish(r.result);
  }
  function finish(val) {
    FA.result = val; FA.runner?.stop(); const T = window.PreDMFit.tests[FA.test];
    say(`เสร็จสิ้น ผลคือ ${val} ${T.unit}`, true);
    $("#faMsg").hidden = false; $("#faMsg").innerHTML = `<b class="fa-res">${esc(val)} <small>${T.unit}</small></b><span>ผลการวัดด้วย AI</span>`;
    $("#faActs").innerHTML = `<button class="btn primary" type="button" data-fa="use">✔ ใช้ค่านี้ในแบบฟอร์ม</button><button class="btn" type="button" data-fa="again">วัดใหม่</button>`;
    $("[data-fa='use']").focus();
  }
  document.addEventListener("click", (e) => {
    const ai = e.target.closest("[data-fitai]"); if (ai) { e.preventDefault(); return open(ai.dataset.fitai); }
    const b = e.target.closest("[data-fa]"); if (!b) return;
    const act = b.dataset.fa;
    if (act === "close") return close();
    if (act === "start") return start();
    if (act === "again") { const t = FA.test; close(); return open(t); }
    if (act === "stop") { const v = FA.last?.elapsed != null ? Math.round(FA.last.elapsed * 10) / 10 : null; if (v) finish(v); return; }
    if (act === "use") {
      const inp = $("#f-" + FA.test); if (inp) { inp.value = FA.result; inp.dispatchEvent(new Event("input", { bubbles: true })); inp.classList.add("fa-filled"); setTimeout(() => inp.classList.remove("fa-filled"), 2400); }
      const t = FA.test; close(); A().toast(`ใส่ผล ${window.PreDMFit.tests[t].name} = ${FA.result} แล้ว กด “บันทึกผลการประเมิน” เพื่อบันทึก`); inp?.focus();
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#faOverlay")?.hidden && $("#faOverlay")) close(); });
  window.addEventListener("predm:view", (e) => { if (e.detail !== "fitness" && FA.runner) close(); });

  // add the AI buttons next to supported tests
  function decorate() {
    Object.keys(GUIDE).forEach((k) => {
      const inp = document.getElementById("f-" + k); if (!inp || inp.closest(".fit-test").querySelector("[data-fitai]")) return;
      inp.closest(".fit-test").insertAdjacentHTML("beforeend", `<button type="button" class="btn sm fa-btn" data-fitai="${k}" aria-label="วัด ${k} ด้วย AI">📷 วัดด้วย AI</button>`);
    });
    const form = $("#fitForm"); if (form && !$(".fa-intro", form)) form.insertAdjacentHTML("afterbegin", `<p class="fa-intro">📷 <b>วัดด้วย AI ได้ 5 รายการ</b> ใช้กล้องนับครั้งและจับเวลาให้อัตโนมัติ (แรงบีบมือต้องใช้เครื่องวัด กรอกเอง)</p>`);
  }
  decorate(); window.addEventListener("predm:view", (e) => { if (e.detail === "fitness") decorate(); });
})();

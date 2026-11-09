/* Pre-DM Smart Hub — "น้องอ่อนหวานพาใช้งาน": a step-by-step how-to guide told by the mascot.
   Shown on the welcome page (before login) and on the home page until the user closes it.
   PreDMGuide.mount(el, { mode: "welcome" | "home" }) · PreDMGuide.reopen() brings it back on the home page. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const STEPS = [
    { ico: "👋", t: "สวัสดีค่ะ หนูชื่อน้องอ่อนหวาน", d: "หนูจะพาไปรู้จักวิธีใช้งาน Pre-DM Smart Hub ทีละขั้นนะคะ กด “ถัดไป” ได้เลยค่ะ" },
    { ico: "🔑", t: "เข้าสู่ระบบ", d: "กรอกเบอร์โทรกับรหัส PIN หรือกดบัญชีทดลองด้านขวาเพื่อลองใช้ (PIN 1234) ถ้าอยากให้ข้อมูลอยู่ทุกเครื่อง สมัคร “บัญชีจริง” ด้วยอีเมลได้ค่ะ", only: "welcome" },
    { ico: "🩺", t: "ประเมินความเสี่ยงเบาหวาน", d: "กรอกอายุ น้ำหนัก ส่วนสูง รอบเอว ใช้เวลาไม่ถึง 1 นาที จะรู้ระดับความเสี่ยง และสีบัตรสมาชิกจะเปลี่ยนตามผลค่ะ", href: "#risk", cta: "ไปประเมินความเสี่ยง" },
    { ico: "🏃", t: "เลือกโปรแกรมออกกำลังกาย", d: "มีแอโรบิก เสริมแรง ยืดเหยียด ทรงตัว และท่าสไตล์ไทย อีสาน ผ้าขาวม้า กด “▶ ฝึกท่านี้” แล้วทำตาม มีเสียงบรรยายนำค่ะ", href: "#exercise", cta: "ดูโปรแกรม" },
    { ico: "📷", t: "ให้ AI ช่วยนับท่า", d: "เปิดกล้องให้ AI นับครั้งและบอกว่าท่าถูกไหม ใช้วัดสมรรถภาพร่างกายและเล่นเกมออกกำลังกายได้ด้วยค่ะ", href: "#tracking", cta: "ลอง AI Tracking" },
    { ico: "🌳", t: "บันทึกและติดตามผล", d: "บันทึกน้ำหนัก รอบเอว และอาหารอีสาน ต้นไม้สุขภาพจะโตตามการฝึก ฝึกต่อเนื่องครบ 3 เดือนรับเกียรติบัตรค่ะ", href: "#tree", cta: "ดูต้นไม้สุขภาพ" },
    { ico: "💗", t: "สงสัยอะไร ถามหนูได้เลย", d: "กดปุ่มน้องอ่อนหวานมุมขวาล่างได้ทุกหน้า หรือปรึกษานักกายภาพบำบัดผ่านวิดีโอคอลก็ได้นะคะ", href: "#consult", cta: "ปรึกษานักกายภาพ", chat: true },
  ];
  const store = () => window.PreDM?.store;
  function mount(el, { mode = "home" } = {}) {
    if (!el) return;
    const steps = STEPS.filter((s) => !s.only || s.only === mode);
    let i = 0;
    const draw = () => {
      const s = steps[i], last = i === steps.length - 1;
      el.innerHTML = `<section class="og og-${mode}" aria-label="น้องอ่อนหวานแนะนำวิธีใช้งาน">
        <div class="og-av">${window.PreDMMascot ? PreDMMascot.svg({ wave: i === 0 || last }) : ""}</div>
        <div class="og-bubble">
          <div class="og-top"><small>น้องอ่อนหวานแนะนำวิธีใช้งาน · ${i + 1}/${steps.length}</small>${mode === "home" ? `<button type="button" class="og-x" data-og="close" aria-label="ปิดคำแนะนำ">✕</button>` : ""}</div>
          <div class="og-body" aria-live="polite"><h3><span aria-hidden="true">${s.ico}</span> ${s.t}</h3><p>${s.d}</p></div>
          <div class="og-foot">
            <div class="og-dots" aria-hidden="true">${steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
            ${mode === "home" && s.href ? `<a class="btn sm" href="${s.href}">${s.cta} →</a>` : ""}
            ${mode === "home" && s.chat ? `<button type="button" class="btn sm" data-og="chat">คุยกับน้องอ่อนหวาน</button>` : ""}
            <a class="og-man" href="manual.html" target="_blank" rel="noopener">📘 คู่มือฉบับเต็ม</a>
            <span class="og-nav"><button type="button" class="btn sm" data-og="prev" ${i ? "" : "disabled"} aria-label="ขั้นก่อนหน้า">‹</button>
            ${last ? (mode === "home" ? `<button type="button" class="btn sm primary" data-og="close">เข้าใจแล้ว ✓</button>` : `<button type="button" class="btn sm primary" data-og="first">ดูอีกครั้ง ↺</button>`) : `<button type="button" class="btn sm primary" data-og="next">ถัดไป ›</button>`}</span>
          </div>
        </div></section>`;
    };
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-og]"); if (!b) return;
      const a = b.dataset.og;
      if (a === "next" && i < steps.length - 1) i++;
      else if (a === "prev" && i > 0) i--;
      else if (a === "first") i = 0;
      else if (a === "chat") return window.PreDMChat?.open();
      else if (a === "close") { store()?.set("guideDone", true); el.hidden = true; window.PreDM?.toast?.("เปิดคำแนะนำอีกครั้งได้ที่ปุ่ม “วิธีใช้งาน” ในหน้าต่างแชทน้องอ่อนหวาน"); return; }
      draw(); (el.querySelector(`[data-og="${a}"]:not([disabled])`) || el.querySelector('[data-og="next"], [data-og="close"], [data-og="first"]'))?.focus();
    });
    draw();
    el._ogReset = () => { i = 0; draw(); };
  }
  function initHome() {
    const el = $("#homeGuide"); if (!el) return;
    if (!el.dataset.mounted) { mount(el, { mode: "home" }); el.dataset.mounted = "1"; }
    el.hidden = !!store()?.get("guideDone", false);
  }
  function reopen() { store()?.set("guideDone", false); $("#homeGuide")?._ogReset?.(); window.PreDMChat?.close(true); location.hash = "home"; setTimeout(() => { initHome(); $("#homeGuide")?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80); }
  window.PreDMGuide = { mount, reopen };
  document.addEventListener("DOMContentLoaded", () => mount($("#welcomeGuide"), { mode: "welcome" }));
  if (document.readyState !== "loading") mount($("#welcomeGuide"), { mode: "welcome" });
  window.addEventListener("predm:home", initHome);
})();

/* Pre-DM Smart Hub — LINE connection (profile page, #lineRoot).
   Opt-in only. The person adds the project's LINE Official Account, the app shows a one-time 8-digit code, and they send
   it in the LINE chat; the Edge Function "line" (supabase/functions/line) then knows which LINE user to remind.
   What LINE is used for: (1) exercise reminders at the time set in "ตารางนัดฝึก", (2) a gentle nudge after 3 days away.
   Messages never contain health values. Choices live in reminders.line = { ex, miss } and consent.line (both synced). */
(function () {
  "use strict";
  const A = () => window.PreDM, CFG = window.PREDM_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const OA = String(CFG.lineOaId || "").trim();
  const S = { status: null, code: null, expires: 0, busy: false, err: "", poll: null };
  const sess = () => A().store.get("session", null);
  const rem = () => A().store.get("reminders", null) || {};
  const prefs = () => ({ ex: true, miss: true, ...(rem().line || {}) });
  const db = () => window.PreDMDB;
  const ready = () => !!(db()?.enabled && db().user && sess()?.cloud);

  async function call(action, extra) {
    const { data, error } = await db().client.functions.invoke("line", { body: { action, ...extra } });
    if (error) {
      let msg = "";
      try { msg = (await error.context?.json?.())?.error || ""; } catch {}
      throw new Error(msg || "เชื่อมต่อระบบ LINE ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    }
    return data || {};
  }
  function setConsent(on) {
    const P = window.PreDMPDPA; if (!P) return;
    const c = P.consent(); if (!!c.line === on) return;
    P.saveConsent({ ...c, line: on, lineAt: new Date().toISOString() });
  }
  function stopPoll() { clearInterval(S.poll); S.poll = null; }
  async function refresh(quiet) {
    if (!OA || !ready()) return render();
    try {
      const d = await call("status"); S.status = d.linked ? "linked" : "none"; S.err = "";
      if (d.linked) { S.code = null; stopPoll(); setConsent(true); }
    } catch (e) { if (!quiet) { S.status = "error"; S.err = e.message; } }
    render();
  }

  function render() {
    const el = $("#lineRoot"); if (!el) return;
    const head = `<div class="card-head"><h2 id="lnH"><span class="ln-logo" aria-hidden="true">LINE</span> แจ้งเตือนผ่าน LINE</h2>${S.status === "linked" ? `<span class="ln-badge">เชื่อมต่อแล้ว</span>` : ""}</div>`;
    const wrap = (body) => { el.innerHTML = `<section class="card ln-card" aria-labelledby="lnH">${head}${body}</section>`; };
    if (!OA) return wrap(`<p class="hint">หน่วยงานยังไม่ได้เปิดใช้การแจ้งเตือนผ่าน LINE ระหว่างนี้ใช้ “เพิ่มลงปฏิทินในโทรศัพท์” ด้านบนเพื่อให้เตือนตามเวลาได้ค่ะ</p>`);
    if (!ready()) return wrap(`<p class="hint">การแจ้งเตือนผ่าน LINE ใช้ได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง (ไม่ใช่โหมดทดลองบนเครื่อง) เพราะระบบต้องจำว่าจะส่งข้อความถึงใคร</p>`);
    const p = prefs(), r = rem();
    const what = `<ul class="ln-what"><li>⏰ เตือนออกกำลังกายตามวันและเวลาใน “ตารางนัดฝึก” (${esc(r.time || "18:00")} น.)</li><li>💗 ทักทายเมื่อคุณไม่ได้เข้าใช้ 3 วันขึ้นไป</li><li>🛡️ ข้อความไม่มีค่าน้ำตาล น้ำหนัก หรือข้อมูลสุขภาพใด ๆ และยกเลิกได้ทุกเมื่อ</li></ul>`;
    if (S.status === "linked") return wrap(`${what}
      <label class="rm-sw"><input type="checkbox" data-lnp="ex" ${p.ex ? "checked" : ""}><span>เตือนออกกำลังกายตามตารางนัดฝึก</span></label>
      <label class="rm-sw"><input type="checkbox" data-lnp="miss" ${p.miss ? "checked" : ""}><span>ทักเมื่อไม่ได้เข้าใช้ 3 วันขึ้นไป</span></label>
      ${S.err ? `<p class="care-err" role="alert">${esc(S.err)}</p>` : ""}
      <div class="ln-acts"><button type="button" class="btn sm primary" data-ln="test" ${S.busy ? "disabled" : ""}>ส่งข้อความทดสอบ</button><button type="button" class="btn sm danger" data-ln="unlink" ${S.busy ? "disabled" : ""}>ยกเลิกการเชื่อมต่อ</button></div>`);
    if (S.code && Date.now() < S.expires) {
      const oa = encodeURIComponent(OA);
      return wrap(`<ol class="ln-steps">
        <li>เพิ่มเพื่อนบัญชีทางการของโครงการ <a class="btn sm ln-btn" href="https://line.me/R/ti/p/${oa}" target="_blank" rel="noopener">➕ เพิ่มเพื่อน ${esc(OA)}</a>
          <span class="ln-qr"><img src="line-qr.png" width="150" height="150" alt="คิวอาร์โค้ดเพิ่มเพื่อน LINE น้องอ่อนหวาน ${esc(OA)}" loading="lazy"><small>หรือสแกนด้วยแอป LINE ในโทรศัพท์</small></span></li>
        <li>ส่งรหัสนี้ในแชต LINE ของบัญชีนั้น <b class="ln-code" aria-label="รหัสเชื่อมต่อ">${esc(S.code)}</b>
          <a class="btn sm ln-btn" href="https://line.me/R/oaMessage/${oa}/?${encodeURIComponent(S.code)}" target="_blank" rel="noopener">💬 เปิด LINE พร้อมรหัส</a></li>
        <li>กลับมาหน้านี้ ระบบจะขึ้นว่า “เชื่อมต่อแล้ว” เอง <button type="button" class="btn sm" data-ln="check">ตรวจสอบอีกครั้ง</button></li></ol>
        <p class="hint">รหัสใช้ได้ 10 นาที และใช้ได้ครั้งเดียว · อย่าส่งรหัสนี้ให้ผู้อื่น</p>
        <div class="ln-acts"><button type="button" class="btn sm" data-ln="cancel">ยกเลิก</button></div>`);
    }
    wrap(`${what}
      <label class="rm-sw ln-agree"><input type="checkbox" id="lnAgree"><span>ฉันยินยอมให้ระบบเก็บรหัสผู้ใช้ LINE ของฉันเพื่อส่งข้อความเตือน (<a href="#privacy">อ่านนโยบาย</a>)</span></label>
      ${S.err ? `<p class="care-err" role="alert">${esc(S.err)}</p>` : ""}
      <div class="ln-acts"><button type="button" class="btn ln-btn" data-ln="start" disabled>${S.busy ? "กำลังขอรหัส…" : "เชื่อมต่อ LINE"}</button></div>`);
  }

  document.addEventListener("change", (e) => {
    if (e.target.id === "lnAgree") { const b = $('[data-ln="start"]'); if (b) b.disabled = !e.target.checked || S.busy; }
    const k = e.target.dataset?.lnp; if (!k) return;
    const r = { ...rem() }; r.line = { ...prefs(), [k]: e.target.checked }; A().store.set("reminders", r);
    A().toast(e.target.checked ? "เปิดการเตือนทาง LINE แล้ว" : "ปิดการเตือนทาง LINE แล้ว");
  });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ln]"); if (!b || S.busy) return; const k = b.dataset.ln;
    if (k === "cancel") { S.code = null; stopPoll(); return render(); }
    if (k === "check") return refresh();
    S.busy = true; S.err = ""; if (k !== "start") render();
    try {
      if (k === "start") {
        b.disabled = true; b.textContent = "กำลังขอรหัส…";
        const d = await call("code"); S.code = d.code; S.expires = Date.now() + (d.ttl || 600) * 1000;
        const r = { ...rem() }; r.line = prefs(); A().store.set("reminders", r); // make the choices explicit for the server
        stopPoll(); S.poll = setInterval(() => { if (Date.now() > S.expires || document.hidden) { if (Date.now() > S.expires) { stopPoll(); S.code = null; render(); } return; } refresh(true); }, 5000);
      }
      if (k === "test") { await call("test"); A().toast("ส่งข้อความทดสอบไปที่ LINE ของคุณแล้ว"); }
      if (k === "unlink") {
        if (!confirm("ยกเลิกการเชื่อมต่อ LINE? ระบบจะลบรหัสผู้ใช้ LINE ของคุณและหยุดส่งข้อความ")) { S.busy = false; return render(); }
        await call("unlink"); S.status = "none"; setConsent(false); A().toast("ยกเลิกการเชื่อมต่อ LINE แล้ว");
      }
    } catch (err) { S.err = err.message; }
    S.busy = false; render();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.code) refresh(true); });
  window.addEventListener("predm:view", (e) => { if (e.detail === "profile") { render(); refresh(true); } else stopPoll(); });
  if (document.querySelector("#view-profile:not([hidden])")) setTimeout(() => { render(); refresh(true); }, 0); // opened directly on this page
  window.PreDMLine = { render, refresh };
})();

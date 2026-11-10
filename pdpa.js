/* Pre-DM Smart Hub — PDPA: privacy notice, consent record, "download my data" and "delete my data".
   Consent is stored under the key "consent" ({ v, at, health, research, line }) and synced for real accounts (db.js),
   so there is a record of what the person agreed to and when. Nothing here sends data anywhere new. */
(function () {
  "use strict";
  const A = () => window.PreDM, CFG = window.PREDM_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KEY = "predm.v1.", VERSION = 1;
  const sess = () => A()?.store.get("session", null);
  const consent = () => A()?.store.get("consent", null) || {};
  const saveConsent = (c) => A().store.set("consent", { ...consent(), ...c, v: VERSION, at: new Date().toISOString() });
  const thDT = (s) => { try { return new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
  // never export or count these: sign-in state, keys, internal bookkeeping
  const PRIVATE_KEY = /(^|\.)(session|adminSession|_dirty|geminiKey|errlog|seeded|pendingRx)$|key$|token|(^|\.)admin/i;

  const DATA = [
    ["ข้อมูลบัญชี", "ชื่อ เบอร์โทร อีเมล (เฉพาะบัญชีจริง)", "ระบุตัวผู้ใช้และเข้าสู่ระบบ"],
    ["ข้อมูลสุขภาพ", "อายุ เพศ ส่วนสูง น้ำหนัก รอบเอว ผลประเมินความเสี่ยง สมรรถภาพกาย ค่าน้ำตาล/ความดันที่กรอกเอง", "ประเมินความเสี่ยงและติดตามผล"],
    ["พฤติกรรม", "บันทึกการออกกำลังกาย อาหาร เกม ต้นไม้สุขภาพ เป้าหมาย", "แนะนำโปรแกรมและแสดงความก้าวหน้า"],
    ["ผลประเมินก่อน–หลัง", "คำตอบแบบวัดความรู้ พฤติกรรม และค่าสุขภาพ", "วัดผลของการเข้าร่วม"],
    ["รูปภาพ", "รูปอาหาร รูปโปรไฟล์", "ประกอบบันทึกของคุณเอง"],
    ["การใช้งาน", "จำนวนครั้งที่เปิดแต่ละหน้าในแต่ละวัน (ไม่มีเนื้อหา)", "ปรับปรุงระบบและรายงานภาพรวม"],
  ];

  function render() {
    const el = $("#pdpaRoot"); if (!el) return;
    const s = sess(), c = consent(), cloud = !!s?.cloud, lineOn = !!c.line;
    const contact = CFG.privacyContact || "ผู้ดูแลระบบของหน่วยงานที่ให้คุณใช้งานแอปนี้";
    el.innerHTML = `${s ? "" : `<p><a class="btn sm" href="#welcome">← กลับหน้าเข้าสู่ระบบ</a></p>`}
      <section class="card pd-card"><div class="card-head"><h2>🛡️ สรุปสั้น ๆ</h2></div>
        <ul class="pd-list">
          <li><b>กล้องและ AI ทำงานในเครื่องของคุณ</b> ภาพจากกล้องตอนนับท่าและเล่นเกมไม่ถูกส่งออกไปไหน</li>
          <li><b>รูปอาหารเก็บในเครื่องนี้เท่านั้น</b> ไม่ขึ้นคลาวด์</li>
          <li>${!s ? "<b>บัญชีจริง</b> สำรองข้อมูลสุขภาพไว้ในฐานข้อมูลของโครงการเพื่อให้ทีมดูแลติดตามผล ส่วน<b>บัญชีทดลอง</b>เก็บข้อมูลไว้ในเบราว์เซอร์เครื่องนั้นเท่านั้น" : cloud ? "<b>คุณใช้บัญชีจริง</b> ข้อมูลสุขภาพและบันทึกถูกสำรองไว้ในฐานข้อมูลของโครงการ เพื่อใช้ได้หลายเครื่องและให้ทีมดูแลติดตามผล" : "<b>คุณใช้บัญชีทดลอง</b> ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์เครื่องนี้ ไม่ถูกส่งไปที่ใด"}</li>
          <li><b>ไม่ขายและไม่ใช้ข้อมูลเพื่อโฆษณา</b></li>
          <li>คุณ <b>ดาวน์โหลด</b> หรือ <b>ลบ</b> ข้อมูลของตัวเองได้ทุกเมื่อจากหน้านี้</li>
        </ul></section>

      <section class="card pd-card"><div class="card-head"><h2>📋 ข้อมูลที่เก็บและวัตถุประสงค์</h2></div>
        <div class="tbl-wrap"><table class="tbl pd-tbl"><thead><tr><th>ประเภท</th><th>รายละเอียด</th><th>ใช้เพื่อ</th></tr></thead>
          <tbody>${DATA.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint">ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตามมาตรา 26 ระบบจึงเก็บและใช้โดยอาศัย <b>ความยินยอมโดยชัดแจ้ง</b> ของคุณ</p></section>

      <section class="card pd-card"><div class="card-head"><h2>📍 เก็บที่ไหน ใครเห็นได้ เก็บนานแค่ไหน</h2></div>
        <ul class="pd-list">
          <li><b>ในเครื่องนี้:</b> ข้อมูลทั้งหมดของแอป และรูปอาหาร เห็นได้เฉพาะคนที่ใช้เครื่องนี้</li>
          <li><b>ฐานข้อมูลของโครงการ (บัญชีจริงเท่านั้น):</b> ข้อมูลสุขภาพและบันทึก ยกเว้นรูปอาหาร เห็นได้เฉพาะคุณ และนักกายภาพบำบัด/เจ้าหน้าที่ที่ได้รับมอบหมายให้ดูแลคุณ</li>
          <li><b>วิดีโอคอลปรึกษานักกายภาพ:</b> ภาพและเสียงส่งตรงระหว่างสองเครื่อง ระบบไม่บันทึกไว้</li>
          <li><b>LINE (เมื่อคุณเชื่อมต่อเอง):</b> ระบบเก็บรหัสผู้ใช้ LINE ของคุณเพื่อส่งข้อความเตือน ข้อความเตือนไม่มีค่าสุขภาพ และส่งผ่านบริษัท LINE</li>
          <li><b>ระยะเวลา:</b> เก็บตลอดเวลาที่คุณยังใช้งาน และลบเมื่อคุณสั่งลบหรือถอนความยินยอม</li>
        </ul></section>

      <section class="card pd-card" id="pdConsent"><div class="card-head"><h2>✅ ความยินยอมของฉัน</h2></div>
        <p class="hint">${c.at ? `บันทึกล่าสุด ${esc(thDT(c.at))}` : "ยังไม่ได้บันทึกความยินยอม"}</p>
        ${s ? `<label class="pd-sw"><input type="checkbox" checked disabled><span><b>เก็บและใช้ข้อมูลสุขภาพเพื่อดูแลสุขภาพของฉัน</b><small>จำเป็นต่อการใช้งานแอป ถอนได้โดยลบข้อมูลด้านล่าง</small></span></label>
        <label class="pd-sw"><input type="checkbox" id="pdResearch" ${c.research ? "checked" : ""}><span><b>ใช้ผลประเมินก่อน–หลังของฉันในรายงานภาพรวมแบบไม่ระบุตัวตน</b><small>ไม่บังคับ ไม่มีชื่อหรือเบอร์โทรในรายงาน ปิดได้ทุกเมื่อ</small></span></label>
        <div class="pd-sw"><span class="pd-dot" data-on="${lineOn}"></span><span><b>รับการแจ้งเตือนผ่าน LINE: ${lineOn ? "เปิดอยู่" : "ยังไม่ได้เชื่อมต่อ"}</b><small>เชื่อมต่อหรือยกเลิกได้ที่ <a href="#profile">โปรไฟล์ของฉัน</a></small></span></div>` : `<p class="lede">เข้าสู่ระบบเพื่อดูและแก้ไขความยินยอมของคุณ</p>`}
      </section>

      <section class="card pd-card"><div class="card-head"><h2>⚖️ สิทธิของคุณ</h2></div>
        <ul class="pd-list">
          <li>ขอดูและขอสำเนาข้อมูล · ขอแก้ไขให้ถูกต้อง · ขอลบ · ขอให้ระงับหรือคัดค้านการใช้ · ถอนความยินยอม</li>
          <li>ถอนความยินยอมได้ทุกเมื่อ โดยไม่กระทบสิทธิในการรับบริการสุขภาพตามปกติ</li>
          <li>ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ได้หากเห็นว่าข้อมูลถูกใช้ไม่ถูกต้อง</li>
          <li><b>ติดต่อเรื่องข้อมูลส่วนบุคคล:</b> ${esc(contact)}</li>
        </ul>
        ${s ? `<div class="pd-acts">
          <button type="button" class="btn primary" data-pd="export">⬇️ ดาวน์โหลดข้อมูลของฉัน</button>
          <button type="button" class="btn danger" data-pd="delete">🗑️ ลบข้อมูลของฉันทั้งหมด</button>
        </div><p class="hint">ไฟล์ที่ดาวน์โหลดเป็นข้อมูลของคุณทั้งหมดในรูปแบบ JSON · แก้ไขข้อมูลส่วนตัวได้ที่ <a href="#profile">โปรไฟล์ของฉัน</a></p>` : `<a class="btn primary" href="#welcome">← กลับหน้าเข้าสู่ระบบ</a>`}
      </section>
      <p class="hint pd-ver">ประกาศความเป็นส่วนตัว ฉบับที่ ${VERSION} · Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา)</p>`;
    if (!s) $("#pdConsent", el)?.remove(); // nothing to consent to before signing in
  }

  /* ---------- download my data ---------- */
  function collect() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k.startsWith(KEY)) continue;
      const name = k.slice(KEY.length); if (PRIVATE_KEY.test(name)) continue;
      try { out[name] = JSON.parse(localStorage.getItem(k)); } catch { out[name] = localStorage.getItem(k); }
    }
    return out;
  }
  function exportData() {
    const s = sess() || {}, body = { app: "Pre-DM Smart Hub", exportedAt: new Date().toISOString(), account: { name: s.name || "", phone: s.phone || "", type: s.cloud ? "cloud" : "demo" }, note: "รูปอาหารเก็บแยกในเครื่อง ไม่รวมในไฟล์นี้", data: collect() };
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `predm-my-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    A().toast("ดาวน์โหลดข้อมูลของคุณแล้ว");
  }

  /* ---------- delete my data ---------- */
  function modal(html, id) {
    $("#" + id)?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div class="care-modal pd-modal" id="${id}" role="dialog" aria-modal="true"><div class="care-box">${html}</div></div>`);
    return $("#" + id);
  }
  function askDelete() {
    const cloud = !!sess()?.cloud;
    const m = modal(`<div class="care-head"><span class="care-ico">🗑️</span><div><h2>ลบข้อมูลของฉันทั้งหมด</h2><small>ทำแล้วกู้คืนไม่ได้</small></div></div>
      <ul class="pd-list"><li>ลบบันทึกสุขภาพ การออกกำลังกาย อาหาร รูปอาหาร ผลประเมิน และการตั้งค่าในเครื่องนี้</li>
      ${cloud ? "<li>ลบข้อมูลและบัญชีของคุณออกจากฐานข้อมูลของโครงการ รวมถึงการเชื่อมต่อ LINE</li>" : ""}
      <li>แนะนำให้กด “ดาวน์โหลดข้อมูลของฉัน” เก็บไว้ก่อน</li></ul>
      <label class="pd-sw"><input type="checkbox" id="pdSure"><span><b>ฉันเข้าใจว่าข้อมูลจะถูกลบถาวร</b></span></label>
      <p class="care-err" id="pdErr" role="alert" hidden></p>
      <div class="care-foot"><button type="button" class="btn" data-pd="cancel">ยกเลิก</button><button type="button" class="btn danger" data-pd="confirm" disabled>ลบถาวร</button></div>`, "pdDel");
    $("#pdSure", m).addEventListener("change", (e) => ($("[data-pd=confirm]", m).disabled = !e.target.checked));
  }
  async function wipe() {
    const btn = $("#pdDel [data-pd=confirm]"), err = $("#pdErr"); btn.disabled = true; btn.textContent = "กำลังลบ…";
    const db = window.PreDMDB;
    if (db?.enabled && db.user && db.client) {
      if (!navigator.onLine) { err.textContent = "ต้องต่ออินเทอร์เน็ตเพื่อลบข้อมูลในฐานข้อมูล ลองใหม่เมื่อมีเน็ต"; err.hidden = false; btn.disabled = false; btn.textContent = "ลบถาวร"; return; }
      try {
        const uid = db.user.id;
        // preferred: one server call that removes the account and everything attached to it (supabase/pdpa_line.sql)
        const { error } = await db.client.rpc("delete_my_account");
        if (error) { // function not installed yet: remove the rows this person owns
          const a = await db.client.from("user_data").delete().eq("user_id", uid); if (a.error) throw a.error;
          const b = await db.client.from("usage_events").delete().eq("user_id", uid); if (b.error) throw b.error;
        }
        try { await db.client.auth.signOut(); } catch { /* account already gone */ }
      } catch (e) { err.textContent = "ลบข้อมูลในฐานข้อมูลไม่สำเร็จ: " + (e?.message || e) + " · ยังไม่ได้ลบอะไร ลองใหม่อีกครั้ง"; err.hidden = false; btn.disabled = false; btn.textContent = "ลบถาวร"; return; }
    }
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(KEY) || k === "predm.auth") keys.push(k); }
    keys.forEach((k) => localStorage.removeItem(k));
    try { await new Promise((res) => { const q = indexedDB.deleteDatabase("predm-foodpics"); q.onsuccess = q.onerror = q.onblocked = () => res(); }); } catch { /* no IndexedDB */ }
    try { sessionStorage.clear(); } catch { /* */ }
    location.hash = "welcome"; location.reload();
  }

  /* ---------- first use: ask for consent ---------- */
  function gate() {
    if (!sess() || consent().v === VERSION || $("#pdGate")) return;
    modal(`<div class="care-head"><span class="care-ico">🛡️</span><div><h2>ก่อนเริ่มใช้งาน ขอความยินยอมนะคะ</h2><small>ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</small></div></div>
      <ul class="pd-list"><li>แอปนี้เก็บ<b>ข้อมูลสุขภาพ</b>ของคุณ เช่น น้ำหนัก รอบเอว ผลประเมินความเสี่ยง การออกกำลังกาย และอาหาร เพื่อช่วยดูแลและติดตามผล</li>
      <li>กล้องและ AI ทำงานในเครื่อง รูปอาหารเก็บในเครื่องนี้เท่านั้น</li>
      <li>ดาวน์โหลดหรือลบข้อมูลได้ทุกเมื่อที่เมนู “ความเป็นส่วนตัว (PDPA)”</li></ul>
      <label class="pd-sw"><input type="checkbox" id="pgHealth"><span><b>ยินยอมให้เก็บและใช้ข้อมูลสุขภาพของฉันเพื่อดูแลสุขภาพ</b><small>จำเป็นต่อการใช้งาน</small></span></label>
      <label class="pd-sw"><input type="checkbox" id="pgResearch"><span><b>ยินยอมให้ใช้ผลประเมินก่อน–หลังในรายงานภาพรวมแบบไม่ระบุตัวตน</b><small>ไม่บังคับ</small></span></label>
      <p class="hint"><a href="#privacy" data-pd="read">อ่านประกาศฉบับเต็ม</a></p>
      <div class="care-foot"><button type="button" class="btn" data-pd="decline">ไม่ยินยอม (ออกจากระบบ)</button><button type="button" class="btn primary" data-pd="accept" disabled>ยินยอมและเริ่มใช้งาน</button></div>`, "pdGate");
    $("#pgHealth").addEventListener("change", (e) => ($("#pdGate [data-pd=accept]").disabled = !e.target.checked));
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pd]"); if (!b) return; const k = b.dataset.pd;
    if (k === "export") exportData();
    if (k === "delete") askDelete();
    if (k === "cancel") $("#pdDel")?.remove();
    if (k === "confirm") wipe();
    if (k === "accept") { saveConsent({ health: true, research: $("#pgResearch").checked }); $("#pdGate").remove(); A().toast("บันทึกความยินยอมแล้ว ขอบคุณค่ะ 💗"); render(); }
    if (k === "decline") { $("#pdGate").remove(); $("#logout")?.click(); }
    if (k === "read") { $("#pdGate").hidden = true; sessionStorage.setItem("predm.pdRead", "1"); }
  });
  document.addEventListener("change", (e) => { if (e.target.id === "pdResearch") { saveConsent({ research: e.target.checked }); A().toast(e.target.checked ? "เปิดการใช้ผลประเมินแบบไม่ระบุตัวตนแล้ว" : "ปิดแล้ว"); render(); } });

  window.addEventListener("predm:view", (e) => {
    if (e.detail === "privacy") { render(); return; }
    const g = $("#pdGate"); if (g) g.hidden = false; // came back from reading the full notice
    if (e.detail !== "welcome") setTimeout(gate, 400);
  });
  window.PreDMPDPA = { consent, saveConsent, render };
  // the first route runs before this script loads, so handle the view that is already open
  setTimeout(() => { const v = document.querySelector("main .view:not([hidden])")?.id; if (v === "view-privacy") render(); else if (v && v !== "view-welcome") gate(); }, 500);
})();

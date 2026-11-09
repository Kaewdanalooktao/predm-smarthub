/* Pre-DM Smart Hub — "โปรไฟล์ของฉัน": lanyard member ID card (drag to swing, tap to flip) + profile editor with photo.
   Photo is cropped to a square, resized to 400 px and stored locally (and synced for real accounts via db.js). */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const thDate = (s, o = { day: "numeric", month: "short", year: "numeric" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sess = () => A().store.get("session", null) || {};
  const prof = () => A().profile();
  function memberSince() { let d = A().store.get("memberSince", null); if (!d) { d = iso(new Date()); A().store.set("memberSince", d); } return d; }
  function memberId() {
    const s = sess(), seed = s.uid || s.phone || prof().name || "guest";
    let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const n = String((h >>> 0) % 1000000).padStart(6, "0");
    return `PDM-${memberSince().slice(2, 4)}${memberSince().slice(5, 7)}-${n}`;
  }
  // members: card colour follows the latest diabetes-risk level; staff keep their role colour
  const RISK_CARD = {
    low: { c: "#22a06b", th: "เสี่ยงต่ำ", dot: "🟢" },
    mod: { c: "#d4950f", th: "เสี่ยงปานกลาง", dot: "🟡" },
    high: { c: "#e8692c", th: "เสี่ยงสูง", dot: "🟠" },
    crit: { c: "#d43a3a", th: "เสี่ยงสูงมาก", dot: "🔴" },
    none: { c: "#7a869a", th: "ยังไม่ได้ประเมิน", dot: "⚪" },
  };
  function riskCard() { const r = stats().risk; return { key: r?.cls && RISK_CARD[r.cls] ? r.cls : "none", ...(RISK_CARD[r?.cls] || RISK_CARD.none) }; }
  function roleInfo() {
    const s = sess();
    if (s.role === "admin") return ["ผู้ดูแลระบบ", "ADMIN", "#7b5cff"];
    if (s.role === "physio") return ["นักกายภาพบำบัด", "PHYSIO", "#2fb37a"];
    if (s.staff) return ["อสม. / เจ้าหน้าที่", "STAFF", "#f08a4b"];
    return ["สมาชิกโครงการ", "MEMBER", riskCard().c];
  }
  const isMember = () => { const s = sess(); return !(s.role === "admin" || s.role === "physio" || s.staff); };
  function stats() {
    const S = A().store, logs = S.get("logs", []), dates = new Set(logs.map((l) => l.date));
    let streak = 0; const d = new Date(); if (!dates.has(iso(d))) d.setDate(d.getDate() - 1);
    while (dates.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
    const ri = S.get("riskInput", null); let risk = null;
    if (ri && A().calcRisk) { try { risk = A().calcRisk(ri); } catch { /* */ } }
    const body = S.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
    return { streak, days: dates.size, risk, body };
  }
  const initials = (n) => (n || "?").replace(/^(คุณ|อสม\.|กภ\.|นาย|นาง(สาว)?)\s*/, "").slice(0, 1) || "?";
  // barcode bars generated from the member id (decorative but unique per member)
  function barcode(id) {
    const digits = id.replace(/\D/g, ""); let bars = ""; let x = 0;
    for (const ch of digits + digits.split("").reverse().join("")) { const v = +ch; const w1 = 1 + (v % 3), gap = 1 + ((v >> 1) % 2); bars += `<rect x="${x}" y="0" width="${w1}" height="30"/>`; x += w1 + gap; }
    return `<svg class="pf-bar" viewBox="0 0 ${x} 30" preserveAspectRatio="none" aria-hidden="true"><g fill="currentColor">${bars}</g></svg>`;
  }

  /* ---------- render ---------- */
  // card front, shared by the profile page and the home page
  function frontFace() {
    const p = prof(), s = sess(), [role, roleEn] = roleInfo(), st = stats(), id = memberId(), photo = A().store.get("avatar", null);
    const name = p.name || s.name || "ผู้ใช้";
    return `<div class="pf-face pf-front">
                <div class="pf-slot"></div>
                <div class="pf-row"><span>PRE-DM SMART HUB</span><span class="pf-role">${roleEn}</span></div>
                <div class="pf-ava">${photo ? `<img src="${photo}" alt="รูปของ ${esc(name)}">` : `<span>${esc(initials(name))}</span>`}</div>
                <div class="pf-name">${esc(name)}</div>
                <div class="pf-meta">${role}${!isMember() && st.risk ? ` · เสี่ยง${st.risk.level.replace("ความเสี่ยง", "")}` : ""}</div>
                ${isMember() ? `<div class="pf-risk"><span>ระดับความเสี่ยงเบาหวาน</span><b>${riskCard().th}</b></div>` : ""}
                <div class="pf-id"><small>เลขประจำตัวสมาชิก</small><b>${id}</b></div>
                <div class="pf-mini"><div><b>${st.streak}</b><small>วันต่อเนื่อง</small></div><div><b>${st.days}</b><small>วันที่ฝึก</small></div><div><b>${st.risk ? st.risk.score : "–"}</b><small>Risk /17</small></div></div>
                ${barcode(id)}
                <div class="pf-since">สมาชิกตั้งแต่ ${thDate(memberSince())}</div>
              </div>`;
  }
  function render() {
    const root = $("#profileRoot"); if (!root) return;
    const p = prof(), s = sess(), [role, roleEn, rc] = roleInfo(), st = stats(), id = memberId(), photo = A().store.get("avatar", null);
    const name = p.name || s.name || "ผู้ใช้", bmi = st.body?.weight && (st.body.height || p.height) ? st.body.weight / ((st.body.height || p.height) / 100) ** 2 : null;
    root.innerHTML = `<div class="pf-grid">
      <section class="pf-stage" aria-label="บัตรสมาชิก">
        <div class="pf-lanyard" id="pfLanyard">
          <svg class="pf-strap" id="pfStrap" aria-hidden="true"></svg>
          <div class="pf-badge${isMember() ? " pf-riskcard" : ""}" id="pfBadge" style="--rc:${rc}" role="group" aria-roledescription="บัตรสมาชิก" aria-label="บัตรสมาชิก ${esc(name)} เลขประจำตัว ${id}">
            <div class="pf-inner">
              ${frontFace()}
              <div class="pf-face pf-back">
                <div class="pf-slot"></div>
                <div class="pf-row"><span>MEMBER INFO</span><span>${id}</span></div>
                <dl class="pf-dl">
                  <dt>ชื่อ</dt><dd>${esc(name)}</dd>
                  <dt>เบอร์โทร</dt><dd>${esc(s.phone || p.phone || "–")}</dd>
                  <dt>อายุ / เพศ</dt><dd>${p.age ? p.age + " ปี" : "–"} · ${p.sex === "f" ? "หญิง" : p.sex === "m" ? "ชาย" : "–"}</dd>
                  <dt>ส่วนสูง</dt><dd>${p.height ? p.height + " ซม." : "–"}</dd>
                  <dt>BMI ล่าสุด</dt><dd>${bmi ? bmi.toFixed(1) : "–"}</dd>
                  <dt>บัญชี</dt><dd>${s.cloud ? "☁️ บัญชีจริง" : "บัญชีทดลอง"}</dd>
                </dl>
                <div class="pf-sos">หากพบผู้ถือบัตรมีอาการผิดปกติ<br><b>โทร 1669</b> (การแพทย์ฉุกเฉิน)</div>
                <div class="pf-since">ผู้ถือบัตรเป็นกลุ่มเสี่ยงเบาหวานในโครงการ Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา)</div>
              </div>
            </div>
          </div>
        </div>
        <div class="pf-actions"><button class="btn sm" type="button" id="pfFlip">🔄 พลิกบัตร</button><span class="hint">ลากบัตรให้แกว่งได้ · แตะสองครั้งเพื่อพลิก</span></div>
        ${isMember() ? `<div class="pf-legend" aria-label="สีบัตรตามระดับความเสี่ยง"><small>สีบัตรตามระดับความเสี่ยงล่าสุด</small>${["low", "mod", "high", "crit"].map((k) => `<span class="${riskCard().key === k ? "on" : ""}" style="--lc:${RISK_CARD[k].c}"><i></i>${RISK_CARD[k].th}</span>`).join("")}${riskCard().key === "none" ? `<a href="#risk" class="pf-legend-go">ทำแบบประเมินความเสี่ยง →</a>` : ""}</div>` : ""}
      </section>
      <form class="card form pf-form" id="pfForm" novalidate>
        <h2>แก้ไขโปรไฟล์</h2>
        <div class="pf-photo">
          <div class="pf-photo-prev">${photo ? `<img src="${photo}" alt="">` : `<span>${esc(initials(name))}</span>`}</div>
          <div class="pf-photo-b"><label class="btn sm primary pf-up" for="pfFile">📷 เปลี่ยนรูป</label><input id="pfFile" type="file" accept="image/*">
            ${photo ? `<button class="btn sm" type="button" id="pfRemove">ลบรูป</button>` : ""}<small class="hint">รูปหน้าตรง ระบบจะครอปเป็นสี่เหลี่ยมจัตุรัสให้อัตโนมัติ</small></div>
        </div>
        <label>ชื่อ-สกุล<input id="pf-name" value="${esc(name)}" autocomplete="name"></label>
        <div class="row2"><label>เบอร์โทร<input id="pf-phone" inputmode="tel" value="${esc(s.phone || p.phone || "")}" ${s.cloud ? "" : "disabled"} placeholder="08xxxxxxxx"></label>
          <label>อายุ (ปี)<input id="pf-age" type="number" min="10" max="120" value="${p.age || ""}"></label></div>
        <div class="row2"><label>เพศ<select id="pf-sex"><option value="m" ${p.sex === "m" ? "selected" : ""}>ชาย</option><option value="f" ${p.sex === "f" ? "selected" : ""}>หญิง</option></select></label>
          <label>ส่วนสูง (ซม.)<input id="pf-height" type="number" min="80" max="230" step="0.1" value="${p.height || ""}"></label></div>
        ${s.cloud ? "" : `<p class="hint">บัญชีทดลองใช้เบอร์โทรเป็นรหัสเข้าระบบ จึงแก้เบอร์ไม่ได้</p>`}
        <p class="form-error" id="pfErr" role="alert" hidden></p>
        <button class="btn primary" type="submit">บันทึกโปรไฟล์</button>
      </form>
    </div>`;
    startLanyard();
  }

  /* ---------- lanyard physics (drag to swing) ---------- */
  const L = { x: 0, y: 0, vx: 0, vy: 0, drag: null, raf: 0, last: 0, moved: false };
  function startLanyard() {
    cancelAnimationFrame(L.raf);
    const box = $("#pfLanyard"), badge = $("#pfBadge"), strap = $("#pfStrap"); if (!box) return;
    const draw = () => {
      const W = box.clientWidth, ax = W / 2, top = badge.offsetTop, bx = ax + L.x, by = top + L.y + 4, sag = Math.min(60, Math.abs(L.x) * 0.25 + 10);
      const mx = (ax + bx) / 2 - L.x * 0.12, my = by / 2 + sag * 0.3, rc = getComputedStyle(badge).getPropertyValue("--rc").trim() || "#5b8cff";
      strap.innerHTML = `<defs><pattern id="pfsp" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="${rc}"/><rect width="22" height="5" fill="#fff" opacity=".18"/></pattern></defs>
        <path d="M${ax} 0 Q${mx} ${my} ${bx} ${by - 20}" fill="none" stroke="url(#pfsp)" stroke-width="22"/>
        <path d="M${ax} 0 Q${mx} ${my} ${bx} ${by - 20}" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="22" stroke-dasharray="1 999" />
        <rect x="${bx - 15}" y="${by - 26}" width="30" height="15" rx="4" fill="#c9ccd2"/><rect x="${bx - 8}" y="${by - 13}" width="16" height="11" rx="3" fill="#8b919b"/>`;
      const rot = Math.max(-22, Math.min(22, L.x * 0.06 + L.vx * 0.02));
      badge.style.transform = `translate(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    };
    const tick = (now) => {
      const dt = Math.min(0.032, (now - (L.last || now)) / 1000); L.last = now;
      if (!L.drag) { const k = 90, c = 9; L.vx += (-k * L.x - c * L.vx) * dt; L.vy += (-k * L.y - c * L.vy) * dt; L.x += L.vx * dt; L.y += L.vy * dt;
        if (Math.abs(L.x) < 0.05 && Math.abs(L.y) < 0.05 && Math.abs(L.vx) < 0.05 && Math.abs(L.vy) < 0.05) { L.x = L.y = L.vx = L.vy = 0; } }
      draw(); if ($("#pfLanyard") && !$("#view-profile").hidden) L.raf = requestAnimationFrame(tick);
    };
    badge.addEventListener("pointerdown", (e) => { badge.setPointerCapture(e.pointerId); L.drag = { sx: e.clientX - L.x, sy: e.clientY - L.y, lt: performance.now(), ox: e.clientX, oy: e.clientY }; L.moved = false; });
    badge.addEventListener("pointermove", (e) => {
      if (!L.drag) return; const nx = e.clientX - L.drag.sx, ny = e.clientY - L.drag.sy, now = performance.now(), dt = Math.max(1, now - L.drag.lt) / 1000;
      if (Math.hypot(e.clientX - L.drag.ox, e.clientY - L.drag.oy) > 6) L.moved = true;
      L.vx = ((nx - L.x) / dt) * 0.02; L.vy = ((ny - L.y) / dt) * 0.02; L.x = Math.max(-200, Math.min(200, nx)); L.y = Math.max(-100, Math.min(220, ny)); L.drag.lt = now;
    });
    const end = () => { if (L.drag) { L.drag = null; L.vx *= 50; L.vy *= 50; } };
    badge.addEventListener("pointerup", end); badge.addEventListener("pointercancel", end);
    badge.addEventListener("dblclick", () => flip());
    if (!reduce) { L.x = 70; L.vx = -40; } L.last = 0;
    L.raf = requestAnimationFrame(tick);
  }
  const flip = () => { const b = $("#pfBadge"); if (b) b.classList.toggle("flipped"); };

  /* ---------- photo: crop center square, 400 px JPEG ---------- */
  function loadPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return A().toast("กรุณาเลือกไฟล์รูปภาพ");
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement("canvas"); c.width = c.height = 400;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, Math.max(0, (img.height - s) / 2 - s * 0.08), s, s, 0, 0, 400, 400);
      URL.revokeObjectURL(url);
      const du = c.toDataURL("image/jpeg", 0.85);
      try { A().store.set("avatar", du); } catch { return A().toast("บันทึกรูปไม่สำเร็จ พื้นที่เก็บข้อมูลเต็ม"); }
      A().toast("เปลี่ยนรูปโปรไฟล์แล้ว"); render(); paintAvatar(); homeBadge();
    };
    img.onerror = () => A().toast("เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG");
    img.src = url;
  }
  async function save(e) {
    e.preventDefault();
    const err = $("#pfErr"), name = $("#pf-name").value.trim(), age = +$("#pf-age").value || null, height = +$("#pf-height").value || null, sex = $("#pf-sex").value, phone = ($("#pf-phone").value || "").replace(/\D/g, "");
    if (!name) { err.textContent = "กรุณากรอกชื่อ"; err.hidden = false; return; }
    if (age && (age < 10 || age > 120)) { err.textContent = "อายุ 10–120 ปี"; err.hidden = false; return; }
    if (height && (height < 80 || height > 230)) { err.textContent = "ส่วนสูง 80–230 ซม."; err.hidden = false; return; }
    err.hidden = true;
    A().store.set("profile", { ...prof(), name, age, sex, height });
    const s = sess(); if (s.cloud) { A().store.set("session", { ...s, name, phone: phone || s.phone });
      try { const sb = window.PreDMDB?.client; if (sb) { const { error } = await sb.from("profiles").update({ full_name: name, age, sex, height, phone: phone || null }).eq("id", s.uid); if (error) throw error; } }
      catch (x) { A().toast("บันทึกในเครื่องแล้ว แต่ซิงก์ฐานข้อมูลไม่สำเร็จ: " + (x.message || x)); } }
    else A().store.set("session", { ...s, name });
    A().toast("บันทึกโปรไฟล์แล้ว"); render(); paintAvatar(); homeBadge(); A().renderHome?.();
  }
  // home page: compact lanyard card (tap to open the profile)
  function homeBadge() {
    const box = $("#homeBadge"); if (!box) return;
    const [, , rc] = roleInfo();
    box.innerHTML = `<a class="hb" href="#profile" aria-label="บัตรสมาชิกของฉัน เลขประจำตัว ${memberId()} — แตะเพื่อดูหรือแก้ไขโปรไฟล์">
      <svg class="hb-strap" viewBox="0 0 60 70" aria-hidden="true"><defs><pattern id="hbsp" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${rc}"/><rect width="10" height="2.5" fill="#fff" opacity=".2"/></pattern></defs>
        <path d="M18 0 L26 52 M42 0 L34 52" stroke="url(#hbsp)" stroke-width="9"/><rect x="21" y="50" width="18" height="10" rx="3" fill="#c9ccd2"/><rect x="25" y="58" width="10" height="8" rx="2" fill="#8b919b"/></svg>
      <div class="hb-swing"><div class="hb-scale"><div class="pf-badge hb-card" style="--rc:${rc}"><div class="pf-inner">${frontFace()}</div></div></div></div>
      <span class="hb-cap">บัตรสมาชิกของฉัน · <b>แตะเพื่อแก้ไข</b></span></a>`;
  }
  // header avatar: photo if set
  function paintAvatar() {
    const el = $("#helloAvatar"); if (!el) return; const photo = A().store.get("avatar", null);
    el.classList.toggle("has-photo", !!photo); el.style.backgroundImage = photo ? `url("${photo}")` : "";
    if (photo) el.textContent = "";
    el.setAttribute("role", "link"); el.setAttribute("tabindex", "0"); el.setAttribute("aria-label", "โปรไฟล์ของฉัน"); el.removeAttribute("aria-hidden");
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#helloAvatar")) { location.hash = "profile"; return; }
    if (e.target.closest("#pfFlip")) flip();
    if (e.target.closest("#pfRemove")) { A().store.set("avatar", null); A().toast("ลบรูปแล้ว"); render(); paintAvatar(); A().renderHome?.(); }
  });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.id === "helloAvatar") { e.preventDefault(); location.hash = "profile"; } });
  document.addEventListener("change", (e) => { if (e.target.id === "pfFile") loadPhoto(e.target.files[0]); });
  document.addEventListener("submit", (e) => { if (e.target.id === "pfForm") save(e); });
  window.addEventListener("predm:view", (e) => { if (e.detail === "profile") render(); else cancelAnimationFrame(L.raf); });
  window.addEventListener("predm:home", () => { paintAvatar(); homeBadge(); });
  paintAvatar(); homeBadge(); if ($("#view-profile") && !$("#view-profile").hidden) render();
})();

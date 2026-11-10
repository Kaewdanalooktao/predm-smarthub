/* Pre-DM Smart Hub — "เป้าหมาย SMART": build health goals as cards (Specific · Measurable · Achievable · Relevant · Time-bound),
   track them in the app (exercise goals fill in automatically from the exercise log; others are ticked day by day),
   and print a goal card with a 4-week tick sheet for the patient to follow at home. Stored on this device. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const A = () => window.PreDM;
  const KEY = "smartGoals";
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const thDate = (s) => new Date(s + "T00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const LET = [["S", "Specific", "เฉพาะเจาะจง", "ทำอะไร ที่ไหน อย่างไร", "#5b8cff"], ["M", "Measurable", "วัดผลได้", "กี่นาที กี่ครั้ง กี่วัน", "#9d6bff"], ["A", "Achievable", "ทำได้จริง", "เริ่มจากเล็ก ๆ ค่อยเพิ่ม", "#2bb37f"], ["R", "Relevant", "เกี่ยวข้องกับสุขภาพฉัน", "ทำไปเพื่ออะไร", "#f6a23a"], ["T", "Time-bound", "มีกำหนดเวลา", "ภายในวันที่เท่าไร", "#e5534b"]];
  // templates: icon, name, S, M, A, R, weeks, tracking ("ex" = minutes from the exercise log per week / "tick" = tick days), weekly target
  const TPL = [
    ["🚶", "ออกกำลังกาย", "เดินเร็วรอบหมู่บ้านหลังอาหารเย็น", "30 นาทีต่อวัน 5 วันต่อสัปดาห์ (150 นาที/สัปดาห์)", "สัปดาห์แรกเริ่ม 15 นาที แล้วเพิ่มสัปดาห์ละ 5 นาที", "ช่วยลดน้ำตาลในเลือดและน้ำหนัก ป้องกันเบาหวาน", 4, "ex", 150, 5],
    ["💪", "เสริมแรง", "ทำท่าสควอทกับเก้าอี้และยกแขนตามโปรแกรมในแอป", "10 ครั้ง × 2 เซต สัปดาห์ละ 2 วัน", "ทำคู่กับคลิปในแอป ข้างเก้าอี้ที่จับได้", "กล้ามเนื้อช่วยใช้น้ำตาลได้ดีขึ้น", 4, "tick", 0, 2],
    ["🥗", "อาหาร", "ลดข้าวเหนียวมื้อเย็นเหลือครึ่งปั้น และเพิ่มผักครึ่งจาน", "ทำได้อย่างน้อย 5 วันต่อสัปดาห์", "เตรียมผักลวกไว้ในตู้เย็น บอกคนในบ้านช่วยเตือน", "ลดน้ำตาลในเลือดหลังอาหาร", 4, "tick", 0, 5],
    ["🧋", "เครื่องดื่ม", "เปลี่ยนชาเย็น/น้ำอัดลม เป็นน้ำเปล่าหรือชาไม่หวาน", "ไม่ดื่มเครื่องดื่มหวานเลย อย่างน้อย 6 วันต่อสัปดาห์", "พกขวดน้ำติดตัว สั่ง “หวาน 0%” ถ้าอยากดื่ม", "เครื่องดื่มหวาน 1 แก้ว มีน้ำตาลถึง 9 ช้อนชา", 4, "tick", 0, 6],
    ["⚖️", "น้ำหนัก / รอบเอว", "ลดน้ำหนักด้วยการคุมอาหารและออกกำลังกาย", "ลด 2 กิโลกรัม (ชั่งทุกเช้าวันจันทร์) รอบเอวลด 2 ซม.", "ลดไม่เกิน 0.5–1 กก./สัปดาห์", "ลดน้ำหนัก 5–7% ลดโอกาสเป็นเบาหวานได้ถึง 58%", 8, "tick", 0, 1],
    ["🩸", "ตรวจสุขภาพ", "ไปตรวจน้ำตาลในเลือดที่ รพ.สต. ใกล้บ้าน", "ตรวจ 1 ครั้ง และจดผลลงแอป", "นัดวันที่สะดวก ไปพร้อม อสม.", "รู้ระดับน้ำตาล เพื่อดูว่าการปรับพฤติกรรมได้ผล", 4, "tick", 0, 1],
    ["😴", "นอน / ความเครียด", "เข้านอนก่อน 4 ทุ่ม และยืดเหยียดผ่อนคลาย 10 นาทีก่อนนอน", "อย่างน้อย 5 คืนต่อสัปดาห์", "ปิดโทรศัพท์ 30 นาทีก่อนนอน", "นอนพอช่วยคุมความอยากอาหารและน้ำตาล", 4, "tick", 0, 5],
  ];
  const goals = () => A()?.store.get(KEY, []) || [];
  const saveAll = (g) => A()?.store.set(KEY, g);

  function exMinutes(from, to) { return (A()?.store.get("logs", []) || []).filter((l) => l.date >= from && l.date <= to && l.type !== "game").reduce((t, l) => t + (l.minutes || 0), 0); }
  function progress(g) { // this week's progress + overall
    const today = iso(new Date()), weekStart = addDays(today, -((new Date().getDay() + 6) % 7)), end = addDays(g.start, g.weeks * 7 - 1);
    const daysLeft = Math.max(0, Math.round((new Date(end + "T00:00") - new Date(today + "T00:00")) / 864e5));
    if (g.track === "ex") { const wk = exMinutes(weekStart, today), all = exMinutes(g.start, today); return { wk, wkTarget: g.target, pct: Math.min(100, Math.round((wk / g.target) * 100)), label: `สัปดาห์นี้ ${wk}/${g.target} นาที (จากบันทึกในแอป)`, total: `${all} นาทีตั้งแต่เริ่ม`, daysLeft, end }; }
    const ticks = g.ticks || {}, wk = Object.keys(ticks).filter((d) => d >= weekStart && d <= today).length, all = Object.keys(ticks).length;
    return { wk, wkTarget: g.perWeek, pct: Math.min(100, Math.round((wk / g.perWeek) * 100)), label: `สัปดาห์นี้ทำได้ ${wk}/${g.perWeek} วัน`, total: `รวม ${all} วัน`, daysLeft, end };
  }

  /* ---------------- UI ---------------- */
  let draft = null;
  function modal() {
    if (!$("#sgModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="sgModal" role="dialog" aria-modal="true" aria-labelledby="sgTitle" hidden><div class="fq-box sg-box" id="sgBox"></div></div>`);
      $("#sgModal").addEventListener("click", onClick); $("#sgModal").addEventListener("input", onInput);
    }
    $("#sgModal").hidden = false; document.body.classList.add("care-open");
  }
  function close() { $("#sgModal").hidden = true; document.body.classList.remove("care-open"); }
  const head = (sub) => `<div class="fq-head"><span class="fq-av">🎯</span><div><h2 id="sgTitle">เป้าหมาย SMART ของฉัน</h2><small>${sub}</small></div><button type="button" class="care-x" data-sg="close" aria-label="ปิด">✕</button></div>`;
  function open() { modal(); draft = null; list(); }
  function cardHTML(g, printMode) {
    const pr = progress(g), days = Array.from({ length: g.weeks * 7 }, (_, i) => addDays(g.start, i)), today = iso(new Date());
    const grid = `<div class="sg-grid" style="--w:${g.weeks}">${["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => `<span class="sg-gh">${d}</span>`).join("")}${(() => { const pad = (new Date(g.start + "T00:00").getDay() + 6) % 7; return Array.from({ length: pad }, () => `<span class="sg-gx"></span>`).join(""); })()}${days.map((d) => { const on = g.track === "ex" ? exMinutes(d, d) > 0 : !!(g.ticks || {})[d]; return printMode ? `<span class="sg-gd"><i>${+d.slice(8)}</i></span>` : `<button type="button" class="sg-gd${on ? " on" : ""}${d === today ? " today" : ""}" ${g.track === "ex" || d > today ? "disabled" : ""} data-tick="${g.id}|${d}" title="${thDate(d)}"><i>${+d.slice(8)}</i></button>`; }).join("")}</div>`;
    return `<article class="sg-card" style="--c:${g.color}">
      <header><span class="sg-ic">${g.icon}</span><div><b>${esc(g.title)}</b><small>${thDate(g.start)} – ${thDate(pr.end)} · ${g.weeks} สัปดาห์</small></div></header>
      <dl>${LET.map(([l, en, th], i) => `<div class="sg-row"><dt style="--lc:${LET[i][4]}"><b>${l}</b><small>${en}</small></dt><dd><small>${th}</small>${esc(g[l])}</dd></div>`).join("")}</dl>
      ${printMode ? "" : `<div class="sg-prog"><span>${esc(pr.label)} · ${esc(pr.total)} · เหลือ ${pr.daysLeft} วัน</span><i><em style="width:${pr.pct}%"></em></i></div>`}
      <div class="sg-track"><small>${g.track === "ex" ? "✅ วันที่ออกกำลังกาย (บันทึกจากแอปให้อัตโนมัติ)" : printMode ? "✏️ ทำได้วันไหน ขีด ✓ ลงช่องวันนั้น" : "✏️ แตะวันที่ทำได้ เพื่อขีด ✓"}</small>${grid}</div>
      ${printMode ? `<footer class="sg-sign"><span>ผู้ตั้งเป้าหมาย ............................................</span><span>ผู้ให้คำแนะนำ ............................................</span></footer>` : ""}
    </article>`;
  }
  function list() {
    const g = goals();
    $("#sgBox").innerHTML = head("ตั้งเป้าหมายแบบ S-M-A-R-T ทำตามได้จริง พิมพ์เป็นการ์ดติดบ้านได้") + `
      <div class="sg-explain">${LET.map(([l, en, th, hint, c]) => `<span style="--c:${c}"><b>${l}</b>${en}<small>${th} · ${hint}</small></span>`).join("")}</div>
      ${g.length ? `<div class="sg-list">${g.map((x) => `<div class="sg-item">${cardHTML(x)}<div class="sg-acts"><button type="button" class="btn sm" data-print="${x.id}">🖨️ พิมพ์การ์ด</button><button type="button" class="btn sm" data-edit="${x.id}">แก้ไข</button><button type="button" class="btn sm" data-del="${x.id}">ลบ</button></div></div>`).join("")}</div>`
        : `<p class="sg-empty">ยังไม่มีเป้าหมาย เริ่มจากเป้าหมายเล็ก ๆ 1–2 ข้อที่ทำได้จริงก่อนนะคะ</p>`}
      <div class="care-foot">${g.length > 1 ? `<button type="button" class="btn" data-sg="printall">🖨️ พิมพ์ทุกการ์ด</button>` : ""}<button type="button" class="btn primary" data-sg="new">+ ตั้งเป้าหมายใหม่</button></div>`;
  }
  function pickTemplate() {
    $("#sgBox").innerHTML = head("เลือกเรื่องที่อยากเปลี่ยน แล้วปรับรายละเอียดให้เป็นของคุณ") + `<div class="sg-tpl">${TPL.map((t, i) => `<button type="button" class="sg-tpl-b" data-tpl="${i}"><span>${t[0]}</span><b>${t[1]}</b><small>${esc(t[2])}</small></button>`).join("")}</div>
      <div class="care-foot"><button type="button" class="btn" data-sg="back">ย้อนกลับ</button></div>`;
  }
  function editor() {
    const d = draft, end = addDays(d.start, d.weeks * 7 - 1);
    d.T = `ภายใน ${d.weeks} สัปดาห์ (ถึงวันที่ ${thDate(end)})`;
    $("#sgBox").innerHTML = head("ปรับแต่ละข้อให้เป็นภาษาของคุณเอง") + `<div class="sg-form">
      <label class="sg-f-title">ชื่อเป้าหมาย<input data-f="title" value="${esc(d.title)}" maxlength="80"></label>
      ${LET.slice(0, 4).map(([l, en, th, hint, c]) => `<label class="sg-f" style="--c:${c}"><span><b>${l}</b> ${en} · ${th}</span><textarea data-f="${l}" rows="2" maxlength="200">${esc(d[l])}</textarea><small>${hint}</small></label>`).join("")}
      <div class="sg-f" style="--c:${LET[4][4]}"><span><b>T</b> Time-bound · มีกำหนดเวลา</span>
        <div class="sg-row2"><label>เริ่มวันที่<input type="date" data-f="start" value="${d.start}"></label><label>ระยะเวลา<select data-f="weeks">${[2, 4, 6, 8, 12].map((w) => `<option value="${w}" ${+d.weeks === w ? "selected" : ""}>${w} สัปดาห์</option>`).join("")}</select></label></div>
        <small>${esc(d.T)}</small></div>
      <div class="sg-f"><span>ติดตามผลแบบไหน</span><div class="sg-row2">
        <label><input type="radio" name="sgtrack" data-f="track" value="ex" ${d.track === "ex" ? "checked" : ""}> นับนาทีออกกำลังกายจากแอปอัตโนมัติ</label>
        <label><input type="radio" name="sgtrack" data-f="track" value="tick" ${d.track === "tick" ? "checked" : ""}> ขีด ✓ เองรายวัน</label></div>
        ${d.track === "ex" ? `<label>เป้าหมายต่อสัปดาห์ (นาที)<input type="number" min="30" max="600" step="10" data-f="target" value="${d.target}"></label>` : `<label>ทำได้กี่วันต่อสัปดาห์<input type="number" min="1" max="7" data-f="perWeek" value="${d.perWeek}"></label>`}</div>
    </div><div class="care-foot"><button type="button" class="btn" data-sg="back">ยกเลิก</button><button type="button" class="btn primary" data-sg="save">💾 บันทึกเป้าหมาย</button></div>`;
  }
  /* ---------- printing: a clean A5-style card per goal, printed from a hidden frame (works in the installed app too) ---------- */
  function print(ids) {
    const g = goals().filter((x) => ids.includes(x.id)); if (!g.length) return;
    const name = A()?.profile?.()?.name || "", css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>การ์ดเป้าหมาย SMART</title><link rel="stylesheet" href="${new URL("vendor/fonts/fonts.css", location.href).href}"><link rel="stylesheet" href="${new URL(document.querySelector('link[href*="styles.css"]').getAttribute("href"), location.href).href}"><style>
      @page { size: A5 portrait; margin: 10mm; } body { background: #fff !important; color: #111; font-family: "Anuphan", sans-serif; margin: 0; }
      .sg-page { page-break-after: always; } .sg-page:last-child { page-break-after: auto; }
      .sg-top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2bb37f; padding-bottom: 6px; margin-bottom: 8px; }
      .sg-top b { font-size: 15pt; } .sg-top small { display: block; color: #555; font-size: 8.5pt; } .sg-name { font-size: 10pt; }
      .sg-card { box-shadow: none !important; border: 1.5px solid #ccd; } .sg-row { grid-template-columns: 100px 1fr !important; gap: 8px !important; } .sg-row dd { font-size: 10.5pt; } .sg-gd { aspect-ratio: 1.3 !important; } .sg-gd { border: 1.2px solid #889 !important; background: #fff !important; } .sg-note { font-size: 8.5pt; color: #444; margin-top: 6px; }
    </style></head><body>${g.map((x) => `<section class="sg-page"><div class="sg-top"><div><b>🎯 การ์ดเป้าหมาย SMART</b><small>Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา · AONWANWITTHAYA)</small></div><div class="sg-name">ชื่อ ${esc(name) || "............................................"}</div></div>${cardHTML(x, true)}<p class="sg-note">💡 ติดการ์ดนี้ไว้ที่ตู้เย็นหรือข้างเตียง ทำได้วันไหนให้ขีด ✓ · ทำไม่ได้บางวันไม่เป็นไร เริ่มใหม่พรุ่งนี้ · เปิดแอปเพื่อบันทึกการออกกำลังกายและดูความก้าวหน้า</p></section>`).join("")}</body></html>`;
    let fr = $("#sgPrintFrame"); if (fr) fr.remove();
    fr = document.createElement("iframe"); fr.id = "sgPrintFrame"; fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(fr);
    const doc = fr.contentDocument; doc.open(); doc.write(html); doc.close();
    const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { A()?.toast?.("พิมพ์ไม่ได้ ลองเปิดในเบราว์เซอร์ Chrome/Safari"); } };
    if (doc.fonts?.ready) doc.fonts.ready.then(() => setTimeout(go, 300)); else setTimeout(go, 600);
    void css;
  }
  function onInput(e) {
    const f = e.target.dataset.f; if (!f || !draft) return;
    if (f === "track") { draft.track = e.target.value; return editor(); }
    if (f === "weeks" || f === "target" || f === "perWeek") { draft[f] = +e.target.value || draft[f]; if (f === "weeks") editor(); return; }
    if (f === "start") { draft.start = e.target.value || draft.start; return editor(); }
    draft[f] = e.target.value;
  }
  function onClick(e) {
    if (e.target.id === "sgModal") return close();
    const t = (s) => e.target.closest(s);
    if (t("[data-tpl]")) {
      const x = TPL[+t("[data-tpl]").dataset.tpl];
      draft = { id: "", icon: x[0], color: ["#2bb37f", "#5b8cff", "#3fbf6a", "#f6a23a", "#9d6bff", "#e5534b", "#4fa3d9"][+t("[data-tpl]").dataset.tpl], title: `${x[1]}: ${x[2]}`, S: x[2], M: x[3], A: x[4], R: x[5], weeks: x[6], track: x[7], target: x[8] || 150, perWeek: x[9], start: iso(new Date()), ticks: {} };
      return editor();
    }
    if (t("[data-tick]")) { const [id, d] = t("[data-tick]").dataset.tick.split("|"), all = goals(), g = all.find((x) => x.id === id); if (!g) return; g.ticks = g.ticks || {}; if (g.ticks[d]) delete g.ticks[d]; else { g.ticks[d] = 1; window.PreDMMusic?.sfx("pick"); } saveAll(all); return list(); }
    if (t("[data-print]")) return print([t("[data-print]").dataset.print]);
    if (t("[data-edit]")) { draft = { ...goals().find((x) => x.id === t("[data-edit]").dataset.edit) }; return editor(); }
    if (t("[data-del]")) { const id = t("[data-del]").dataset.del, b = t("[data-del]"); if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "ยืนยันลบ"; b.classList.add("danger"); return; } saveAll(goals().filter((x) => x.id !== id)); return list(); }
    const b = t("[data-sg]"); if (!b) return;
    const a = b.dataset.sg;
    if (a === "close") return close();
    if (a === "new") return pickTemplate();
    if (a === "back") { draft = null; return list(); }
    if (a === "printall") return print(goals().map((x) => x.id));
    if (a === "save") {
      const d = draft; if (!d.title.trim() || !d.S.trim() || !d.M.trim()) { A()?.toast?.("กรอกชื่อเป้าหมาย S และ M ให้ครบก่อนนะคะ"); return; }
      d.T = `ภายใน ${d.weeks} สัปดาห์ (ถึงวันที่ ${thDate(addDays(d.start, d.weeks * 7 - 1))})`;
      const all = goals(); if (d.id) all[all.findIndex((x) => x.id === d.id)] = d; else { d.id = "g" + Date.now().toString(36); all.unshift(d); }
      saveAll(all); draft = null; A()?.toast?.("บันทึกเป้าหมาย SMART แล้ว"); window.PreDMMusic?.sfx("ok"); return list();
    }
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-smartgoal]")) { e.preventDefault(); open(); } });
  window.PreDMSmart = { open, progress, print };
})();

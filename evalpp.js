/* Pre-DM Smart Hub — "ประเมินผลก่อน–หลัง": the same short assessment taken before starting and again after using the
   system (knowledge 10 items, behaviour in the last 7 days 5 items, optional health measures), then a side-by-side report.
   Stored under "evalpp" = { pre, post }, each { at, know[], beh[], m{} }; synced for real accounts so the care team can see it.
   Correct answers are only revealed after the post-test, so the pre-test does not teach the answers. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const thDate = (s) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const get = () => A().store.get("evalpp", null) || {};
  const RECOMMEND_DAYS = 84; // 12 weeks

  // [question, choices, index of the correct choice]
  const KNOW = [
    ["ภาวะก่อนเบาหวาน (Pre-DM) คืออะไร", ["เป็นเบาหวานแล้วแต่ยังไม่มีอาการ", "น้ำตาลในเลือดสูงกว่าปกติ แต่ยังไม่ถึงเกณฑ์เบาหวาน", "น้ำตาลในเลือดต่ำกว่าปกติ"], 1],
    ["น้ำตาลในเลือดหลังอดอาหาร (FPG) ระดับใดจัดเป็นภาวะก่อนเบาหวาน", ["100–125 มก./ดล.", "70–99 มก./ดล.", "126 มก./ดล. ขึ้นไป"], 0],
    ["ภาวะก่อนเบาหวานกลับมาเป็นปกติได้หรือไม่", ["ไม่ได้ ต้องเป็นเบาหวานแน่นอน", "ได้ แต่ต้องกินยาเท่านั้น", "ได้ ถ้าปรับอาหาร ออกกำลังกาย และคุมน้ำหนัก"], 2],
    ["ควรออกกำลังกายระดับปานกลางอย่างน้อยสัปดาห์ละกี่นาที", ["30 นาที", "150 นาที", "60 นาที"], 1],
    ["คนน้ำหนักเกินควรลดน้ำหนักอย่างน้อยเท่าใดจึงช่วยลดความเสี่ยงเบาหวานได้ชัดเจน", ["5–7% ของน้ำหนักตัว", "1% ของน้ำหนักตัว", "20% ของน้ำหนักตัว"], 0],
    ["จานสุขภาพ 2:1:1 หมายถึงอะไร", ["ข้าว 2 ส่วน ผัก 1 ส่วน เนื้อสัตว์ 1 ส่วน", "เนื้อสัตว์ 2 ส่วน ข้าว 1 ส่วน ผัก 1 ส่วน", "ผัก 2 ส่วน ข้าว-แป้ง 1 ส่วน เนื้อสัตว์ 1 ส่วน"], 2],
    ["เครื่องดื่มใดเหมาะที่สุดสำหรับผู้มีความเสี่ยงเบาหวาน", ["น้ำผลไม้กล่อง", "น้ำเปล่า", "ชาเขียวพร้อมดื่มรสหวาน"], 1],
    ["รอบเอวเท่าใดถือว่าเสี่ยง (อ้วนลงพุง) ตามเกณฑ์คนไทย", ["ชาย 100 ซม. หญิง 90 ซม. ขึ้นไป", "ชาย 80 ซม. หญิง 70 ซม. ขึ้นไป", "ชาย 90 ซม. หญิง 80 ซม. ขึ้นไป"], 2],
    ["การเดินเบา ๆ 10–15 นาทีหลังอาหารช่วยเรื่องใดมากที่สุด", ["ลดน้ำตาลในเลือดหลังอาหาร", "ทำให้หิวเร็วขึ้น", "ไม่มีผลต่อน้ำตาล"], 0],
    ["อาการใดควรไปพบแพทย์เพื่อตรวจน้ำตาล", ["ง่วงหลังกินข้าวเป็นบางวัน", "กระหายน้ำบ่อย ปัสสาวะบ่อย น้ำหนักลดโดยไม่ทราบสาเหตุ", "ปวดเมื่อยหลังออกกำลังกาย"], 1],
  ];
  // [question, true when more days is worse (scored in reverse)]
  const BEH = [
    ["ออกกำลังกายระดับปานกลางอย่างน้อย 30 นาที", false],
    ["ดื่มเครื่องดื่มรสหวาน (น้ำอัดลม ชานม กาแฟหวาน น้ำผลไม้)", true],
    ["กินผักอย่างน้อยครึ่งจานในมื้อหลัก", false],
    ["กินขนมหวานหรือของทอด", true],
    ["เดินหรือขยับร่างกายหลังอาหาร 10–15 นาที", false],
  ];
  const FREQ = ["ไม่เลย", "1–2 วัน", "3–4 วัน", "5–7 วัน"];
  // [key, label, unit, min, max, step]
  const MEAS = [
    ["weight", "น้ำหนัก", "กก.", 20, 300, 0.1], ["waist", "รอบเอว", "ซม.", 40, 200, 0.1], ["fpg", "น้ำตาลหลังอดอาหาร (FPG)", "มก./ดล.", 40, 600, 1],
    ["sys", "ความดันตัวบน", "มม.ปรอท", 60, 260, 1], ["dia", "ความดันตัวล่าง", "มม.ปรอท", 30, 160, 1],
  ];
  const knowScore = (r) => (r?.know || []).reduce((n, a, i) => n + (a === KNOW[i][2] ? 1 : 0), 0);
  const behScore = (r) => (r?.beh || []).reduce((n, a, i) => n + (BEH[i][1] ? 3 - a : a), 0);
  const F = { mode: null };

  function latestBody() { const b = (A().store.get("body", []) || []).slice().sort((x, y) => String(x.date).localeCompare(String(y.date))); return b[b.length - 1] || {}; }

  /* ---------- overview ---------- */
  function render() {
    const el = $("#evalRoot"); if (!el) return;
    if (F.mode) return renderForm(el);
    const e = get(), days = e.pre ? Math.floor((Date.now() - new Date(e.pre.at)) / 864e5) : 0;
    const step = (n, title, r, mode, lock) => `<div class="ev-step" data-done="${!!r}"><span class="ev-num">${r ? "✓" : n}</span><div><b>${title}</b>
        <small>${r ? `ทำแล้วเมื่อ ${esc(thDate(r.at))} · ความรู้ ${knowScore(r)}/10 · พฤติกรรม ${behScore(r)}/15` : lock || "ใช้เวลาประมาณ 5 นาที"}</small></div>
        ${lock && !r ? "" : `<button type="button" class="btn sm ${r ? "" : "primary"}" data-ev="${mode}">${r ? "ทำใหม่" : "เริ่มทำ"}</button>`}</div>`;
    el.innerHTML = `<section class="card ev-card"><div class="card-head"><h2>📝 แบบประเมิน 2 ครั้ง</h2></div>
        ${step(1, "ก่อนเข้าร่วม (Pre-test)", e.pre, "pre")}
        ${step(2, "หลังเข้าร่วม (Post-test)", e.post, "post", e.pre ? "" : "ทำแบบประเมินก่อนเข้าร่วมก่อน")}
        ${e.pre && !e.post ? `<p class="hint">ผ่านมาแล้ว <b>${days}</b> วันนับจากครั้งแรก · แนะนำให้ทำครั้งหลังเมื่อครบ ${RECOMMEND_DAYS} วัน (12 สัปดาห์) ${days >= RECOMMEND_DAYS ? "— ถึงเวลาแล้วค่ะ 🎉" : `อีก ${RECOMMEND_DAYS - days} วัน แต่ทำก่อนได้ถ้าต้องการ`}</p>` : ""}
      </section>
      ${e.pre && e.post ? report(e) : e.pre ? `<section class="card ev-card"><div class="card-head"><h2>ผลครั้งแรกของคุณ</h2></div>${bars("ความรู้เรื่องเบาหวาน", knowScore(e.pre), null, 10)}${bars("พฤติกรรมสุขภาพ 7 วันที่ผ่านมา", behScore(e.pre), null, 15)}<p class="hint">เฉลยคำตอบจะแสดงหลังทำแบบประเมินครั้งหลัง เพื่อให้วัดผลได้ตรงค่ะ</p></section>` : `<section class="card ev-card"><p class="lede">ยังไม่มีผลประเมิน เริ่มจากแบบ “ก่อนเข้าร่วม” เพื่อเก็บค่าตั้งต้นของคุณค่ะ</p></section>`}`;
  }

  /* ---------- the form ---------- */
  function renderForm(el) {
    const b = latestBody(), pre = F.mode === "pre";
    el.innerHTML = `<form class="card ev-card ev-form" id="evForm" novalidate>
      <div class="card-head"><h2>${pre ? "แบบประเมินก่อนเข้าร่วม" : "แบบประเมินหลังเข้าร่วม"}</h2><button type="button" class="btn sm" data-ev="back">← กลับ</button></div>
      <h3 class="ev-h">ส่วนที่ 1 · ความรู้ (10 ข้อ) <small>เลือกคำตอบที่คิดว่าถูกที่สุด ไม่ต้องเปิดหาคำตอบ</small></h3>
      ${KNOW.map((q, i) => `<fieldset class="ev-q" data-q="k${i}"><legend>${i + 1}. ${esc(q[0])}</legend>${q[1].map((c, j) => `<label class="ev-opt"><input type="radio" name="k${i}" value="${j}"><span>${esc(c)}</span></label>`).join("")}</fieldset>`).join("")}
      <h3 class="ev-h">ส่วนที่ 2 · พฤติกรรมใน 7 วันที่ผ่านมา <small>ทำสิ่งต่อไปนี้กี่วัน</small></h3>
      ${BEH.map((q, i) => `<fieldset class="ev-q" data-q="b${i}"><legend>${i + 1}. ${esc(q[0])}</legend><div class="ev-freq">${FREQ.map((c, j) => `<label class="ev-opt"><input type="radio" name="b${i}" value="${j}"><span>${c}</span></label>`).join("")}</div></fieldset>`).join("")}
      <h3 class="ev-h">ส่วนที่ 3 · ค่าสุขภาพ <small>กรอกเท่าที่มี เว้นว่างได้</small></h3>
      <div class="ev-meas">${MEAS.map((m) => `<label>${m[1]} <small>(${m[2]})</small><input type="number" inputmode="decimal" id="ev-${m[0]}" min="${m[3]}" max="${m[4]}" step="${m[5]}" value="${b[m[0]] != null && (m[0] === "weight" || m[0] === "waist") ? esc(b[m[0]]) : ""}"></label>`).join("")}</div>
      <p class="care-err" id="evErr" role="alert" hidden></p>
      <div class="ev-acts"><button type="submit" class="btn primary">บันทึกผลประเมิน</button></div>
    </form>`;
    window.scrollTo(0, 0);
  }
  function submit() {
    const f = $("#evForm"), err = $("#evErr"), pick = (n) => { const c = f.querySelector(`input[name="${n}"]:checked`); return c ? +c.value : null; };
    const know = KNOW.map((_, i) => pick("k" + i)), beh = BEH.map((_, i) => pick("b" + i));
    $$(".ev-q", f).forEach((q) => q.removeAttribute("data-miss"));
    const miss = [...know.map((v, i) => (v == null ? "k" + i : null)), ...beh.map((v, i) => (v == null ? "b" + i : null))].filter(Boolean);
    const m = {}, bad = [];
    MEAS.forEach((x) => { const i = $("#ev-" + x[0]); i.removeAttribute("aria-invalid"); if (i.value === "") return; const v = Number(i.value); if (!(v >= x[3] && v <= x[4])) { bad.push(x[1]); i.setAttribute("aria-invalid", "true"); } else m[x[0]] = v; });
    if (miss.length || bad.length) {
      miss.forEach((k) => f.querySelector(`[data-q="${k}"]`).setAttribute("data-miss", "1"));
      err.textContent = miss.length ? `ยังตอบไม่ครบ ${miss.length} ข้อ (ข้อที่มีกรอบสีแดง)` : "กรุณาตรวจค่า: " + bad.join(", "); err.hidden = false;
      (miss.length ? f.querySelector("[data-miss]") : f.querySelector("[aria-invalid]")).scrollIntoView({ block: "center", behavior: "smooth" }); return;
    }
    const e = get(); e[F.mode] = { at: new Date().toISOString(), know, beh, m };
    if (F.mode === "pre") delete e.post; // a new baseline starts a new comparison
    A().store.set("evalpp", e);
    A().toast(F.mode === "pre" ? "บันทึกผลก่อนเข้าร่วมแล้ว" : "บันทึกผลหลังเข้าร่วมแล้ว ดูผลเปรียบเทียบได้เลย");
    F.mode = null; render(); window.scrollTo(0, 0);
  }

  /* ---------- report ---------- */
  function bars(label, a, b, max, unit = "") {
    const w = (v) => Math.max(3, Math.round((v / max) * 100));
    return `<div class="ev-bar"><b>${label}</b>
      <div class="ev-row"><span>ก่อน</span><i><em style="width:${w(a)}%"></em></i><strong>${a}${unit || "/" + max}</strong></div>
      ${b == null ? "" : `<div class="ev-row post"><span>หลัง</span><i><em style="width:${w(b)}%"></em></i><strong>${b}${unit || "/" + max}</strong></div>`}</div>`;
  }
  function delta(a, b, lowerBetter, digits = 0) {
    const d = +(b - a).toFixed(digits); if (!d) return `<span class="ev-d same">เท่าเดิม</span>`;
    const good = lowerBetter ? d < 0 : d > 0;
    return `<span class="ev-d ${good ? "good" : "bad"}">${d > 0 ? "+" : ""}${d} ${good ? "ดีขึ้น" : "ควรปรับ"}</span>`;
  }
  function report(e) {
    const k0 = knowScore(e.pre), k1 = knowScore(e.post), b0 = behScore(e.pre), b1 = behScore(e.post);
    const weeks = Math.max(0, Math.round((new Date(e.post.at) - new Date(e.pre.at)) / (7 * 864e5)));
    const meas = MEAS.filter((m) => e.pre.m?.[m[0]] != null && e.post.m?.[m[0]] != null);
    const w0 = e.pre.m?.weight, w1 = e.post.m?.weight, pct = w0 && w1 ? +(((w0 - w1) / w0) * 100).toFixed(1) : null;
    const up = [k1 > k0, b1 > b0, pct != null && pct > 0].filter(Boolean).length;
    const nm = A().profile().name || "ผู้เข้าร่วม";
    return `<section class="card ev-card ev-report" id="evReport">
      <div class="card-head"><h2>📊 ผลเปรียบเทียบก่อน–หลัง</h2><span class="ev-noprint"><button type="button" class="btn sm" data-ev="print">🖨️ พิมพ์รายงาน</button> <button type="button" class="btn sm" data-ev="csv">⬇️ CSV (ไม่ระบุตัวตน)</button></span></div>
      <p class="ev-meta"><b>${esc(nm)}</b> · ก่อน ${esc(thDate(e.pre.at))} → หลัง ${esc(thDate(e.post.at))} (ห่างกัน ${weeks} สัปดาห์)</p>
      <div class="ev-grid">
        <div>${bars("ความรู้เรื่องเบาหวาน", k0, k1, 10)}${delta(k0, k1, false)}</div>
        <div>${bars("พฤติกรรมสุขภาพ 7 วันที่ผ่านมา", b0, b1, 15)}${delta(b0, b1, false)}</div>
      </div>
      ${meas.length ? `<div class="tbl-wrap"><table class="tbl ev-tbl"><thead><tr><th>ค่าสุขภาพ</th><th>ก่อน</th><th>หลัง</th><th>เปลี่ยนแปลง</th></tr></thead><tbody>
        ${meas.map((m) => `<tr><td>${m[1]} <small>(${m[2]})</small></td><td>${e.pre.m[m[0]]}</td><td>${e.post.m[m[0]]}</td><td>${delta(e.pre.m[m[0]], e.post.m[m[0]], true, 1)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">ไม่มีค่าสุขภาพที่กรอกทั้งสองครั้ง จึงเปรียบเทียบเฉพาะความรู้และพฤติกรรม</p>`}
      <p class="ev-sum">${pct != null && pct >= 5 ? `🎉 น้ำหนักลดลง ${pct}% ถึงเป้าหมาย 5–7% ที่ช่วยลดความเสี่ยงเบาหวานแล้วค่ะ ` : pct != null && pct > 0 ? `น้ำหนักลดลง ${pct}% (เป้าหมายคือ 5–7%) ` : ""}${up >= 2 ? "ภาพรวมดีขึ้นอย่างเห็นได้ชัด รักษาความสม่ำเสมอไว้นะคะ 💗" : up === 1 ? "มีด้านที่ดีขึ้นแล้ว ลองเพิ่มวันออกกำลังกายและลดเครื่องดื่มหวานอีกนิดนะคะ" : "ยังไม่เห็นการเปลี่ยนแปลงชัดเจน ลองตั้งเป้าหมาย SMART เล็ก ๆ แล้วทำต่อเนื่องอีก 4 สัปดาห์นะคะ"}</p>
      <details class="ev-key ev-noprint"><summary>ดูเฉลยแบบวัดความรู้</summary><ol>${KNOW.map((q, i) => `<li>${esc(q[0])}<br><b>✓ ${esc(q[1][q[2]])}</b> ${e.post.know[i] === q[2] ? "" : `<small class="ev-wrong">(คุณตอบ: ${esc(q[1][e.post.know[i]])})</small>`}</li>`).join("")}</ol></details>
      <p class="hint">ผลนี้เป็นการประเมินตนเองเพื่อติดตามความก้าวหน้า ไม่ใช่การวินิจฉัยโรค หากค่าน้ำตาลหรือความดันสูงขึ้น ควรปรึกษาเจ้าหน้าที่สาธารณสุข</p>
    </section>`;
  }
  function anonCode() {
    const s = A().store.get("session", null) || {}, seed = "ev:" + (s.uid || s.phone || "local");
    let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return "P" + String((h >>> 0) % 1000000).padStart(6, "0");
  }
  function csv() {
    const e = get(), p = A().profile(), row = (label, r) => [anonCode(), label, r.at.slice(0, 10), p.age ?? "", p.sex ?? "", knowScore(r), behScore(r), ...r.know.map((a, i) => (a === KNOW[i][2] ? 1 : 0)), ...r.beh, ...MEAS.map((m) => r.m?.[m[0]] ?? "")];
    const head = ["code", "round", "date", "age", "sex", "knowledge_10", "behaviour_15", ...KNOW.map((_, i) => "k" + (i + 1)), ...BEH.map((_, i) => "b" + (i + 1)), ...MEAS.map((m) => m[0])];
    const text = "﻿" + [head, row("pre", e.pre), row("post", e.post)].map((r) => r.join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = `predm-prepost-${anonCode()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    A().toast("ดาวน์โหลดไฟล์ CSV แล้ว (ไม่มีชื่อหรือเบอร์โทร)");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ev]"); if (!b) return; const k = b.dataset.ev;
    if (k === "pre" || k === "post") {
      if (k === "pre" && get().pre && !confirm("ทำแบบ “ก่อนเข้าร่วม” ใหม่จะล้างผลครั้งหลังด้วย ต้องการทำใหม่ไหม")) return;
      F.mode = k; render();
    }
    if (k === "back") { F.mode = null; render(); }
    if (k === "print") { document.body.classList.add("print-eval"); const done = () => { document.body.classList.remove("print-eval"); removeEventListener("afterprint", done); }; addEventListener("afterprint", done); window.print(); }
    if (k === "csv") csv();
  });
  document.addEventListener("submit", (e) => { if (e.target.id === "evForm") { e.preventDefault(); submit(); } });
  window.addEventListener("predm:view", (e) => { if (e.detail === "eval") { F.mode = null; render(); } });
  if (document.querySelector("#view-eval:not([hidden])")) setTimeout(render, 0); // opened directly on this page
  window.PreDMEval = { render, knowScore, behScore };
})();

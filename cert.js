/* Pre-DM Smart Hub — 3-month achievement certificate.
   Eligible when, within the last 90 days: training ≥3 days/week in ≥9 of 12 weeks, ≥2 of 4 outcomes improved,
   and weight did not rebound between measurements. Gold = ≥3 outcomes improved. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const thDate = (s, o = { day: "numeric", month: "long", year: "numeric" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  function evaluate() {
    const S = A().store, today = todayISO(), start = addDays(today, -89), inW = (d) => d >= start && d <= today;
    const days = new Set(S.get("logs", []).map((l) => l.date).filter(inW));
    const weeks = Array.from({ length: 12 }, (_, i) => { const we = addDays(today, -7 * i), ws = addDays(we, -6); let n = 0; for (let k = 0; k < 7; k++) if (days.has(addDays(ws, k))) n++; return n; }).reverse();
    const goodWeeks = weeks.filter((n) => n >= 3).length;
    const body = S.get("body", []).filter((b) => inW(b.date)).sort((a, b) => a.date.localeCompare(b.date));
    const fit = S.get("fitness", []).filter((b) => inW(b.date)).sort((a, b) => a.date.localeCompare(b.date));
    const b0 = body[0], b1 = body[body.length - 1], hasBody = body.length >= 2;
    const wDiff = hasBody && b0.weight && b1.weight ? b1.weight - b0.weight : null, wPct = wDiff != null ? (wDiff / b0.weight) * 100 : null;
    const waistDiff = hasBody && b0.waist && b1.waist ? b1.waist - b0.waist : null;
    let trend = hasBody; for (let i = 1; i < body.length; i++) if (body[i].weight && body[i - 1].weight && body[i].weight > body[i - 1].weight + 0.5) trend = false;
    const fitGains = [];
    if (fit.length >= 2) {
      const a = fit[0], z = fit[fit.length - 1], chk = (k, d, label, unit, lower) => { if (a[k] != null && z[k] != null && (lower ? a[k] - z[k] : z[k] - a[k]) >= d) fitGains.push(`${label} ${lower ? "−" : "+"}${f1(Math.abs(z[k] - a[k]))} ${unit}`); };
      chk("chair30", 2, "ลุก-นั่ง 30 วิ", "ครั้ง"); chk("step2", 5, "ยกเข่า 2 นาที", "ครั้ง"); chk("tug", 0.5, "TUG", "วิ", true); chk("sls", 5, "ยืนขาเดียว", "วิ"); chk("sitreach", 2, "เอื้อมแตะปลายเท้า", "ซม."); chk("grip", 2, "แรงบีบมือ", "กก.");
    }
    let risk0 = null, risk1 = null; const ri = S.get("riskInput", null), pr = A().profile();
    if (hasBody && A().calcRisk && b0.waist && b1.waist) {
      const base = { age: ri?.age || pr.age || 50, sex: ri?.sex || pr.sex || "m", htn: !!ri?.htn, fh: !!ri?.fh, ht: b1.height || pr.height || 165 };
      risk0 = A().calcRisk({ ...base, wt: b0.weight, waist: b0.waist }).score; risk1 = A().calcRisk({ ...base, wt: b1.weight, waist: b1.waist }).score;
    }
    const outcomes = [
      { k: "weight", label: "น้ำหนักลดลงอย่างน้อย 3% (หรือ 2 กก.)", ok: wDiff != null && (wPct <= -3 || wDiff <= -2), val: wDiff != null ? `${wDiff <= 0 ? "−" : "+"}${f1(Math.abs(wDiff))} กก. (${f1(wPct)}%)` : "ต้องบันทึก Body Composition อย่างน้อย 2 ครั้ง" },
      { k: "waist", label: "รอบเอวลดลงอย่างน้อย 3 ซม.", ok: waistDiff != null && waistDiff <= -3, val: waistDiff != null ? `${waistDiff <= 0 ? "−" : "+"}${f1(Math.abs(waistDiff))} ซม.` : "ต้องบันทึกรอบเอวอย่างน้อย 2 ครั้ง" },
      { k: "fit", label: "สมรรถภาพกายดีขึ้นอย่างน้อย 1 รายการ", ok: fitGains.length >= 1, val: fit.length >= 2 ? (fitGains.join(" · ") || "ยังไม่ถึงเกณฑ์") : "ต้องประเมินสมรรถภาพอย่างน้อย 2 ครั้ง" },
      { k: "risk", label: "คะแนนความเสี่ยงเบาหวานลดลง", ok: risk0 != null && risk1 < risk0, val: risk0 != null ? `${risk0} → ${risk1} คะแนน` : "ต้องมีน้ำหนักและรอบเอว 2 ครั้ง" },
    ];
    const nOk = outcomes.filter((o) => o.ok).length, consistent = goodWeeks >= 9;
    const eligible = consistent && nOk >= 2 && trend;
    return { start, today, days: days.size, weeks, goodWeeks, consistent, outcomes, nOk, trend, hasBody, eligible, tier: nOk >= 3 ? "gold" : "silver", b0, b1, wDiff, waistDiff, fitGains, risk0, risk1 };
  }
  const certNo = (name, date) => { let h = 2166136261; for (const c of name + date) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return "PDM-" + date.replace(/-/g, "").slice(2) + "-" + (h >>> 0).toString(36).toUpperCase().slice(0, 5); };

  /* ---------- certificate image (canvas, A4 landscape) ---------- */
  async function drawCert(E, opts = {}) {
    for (const f of ['700 60px "Pridi"', '500 30px "Pridi"', '400 30px "Pridi"', '700 60px "Charm"', '800 40px "Outfit"', '600 30px "Outfit"', '500 24px "Anuphan"']) { try { await document.fonts.load(f, "เกียรติบัตร Aa"); } catch { /* optional */ } }
    const W = 2000, H = 1414, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const gold = E.tier === "gold";
    const metal = (x0, y0, x1, y1) => { const g = x.createLinearGradient(x0, y0, x1, y1); (gold ? ["#7a5512", "#c9a14a", "#f7e7a6", "#d4ac52", "#8a6418"] : ["#5d6774", "#aeb8c4", "#f4f7fa", "#bcc6d1", "#66707d"]).forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col)); return g; };
    const ink = "#16352c", em1 = "#0d4436", em2 = "#16694f", tone = gold ? "#a77b22" : "#7b8794";
    const name = A().profile().name || A().store.get("session", {})?.name || "ผู้เข้าร่วมโปรแกรม", issued = opts.date || E.today, no = certNo(name, issued);
    const T = (txt, px, py, font, color, align = "center", ls = 0) => { x.font = font; x.fillStyle = color; x.textAlign = align; try { x.letterSpacing = ls + "px"; } catch { /* old browsers */ } x.fillText(txt, px, py); try { x.letterSpacing = "0px"; } catch { /* */ } };

    // ---- paper + guilloche ----
    const pg = x.createLinearGradient(0, 0, W, H); pg.addColorStop(0, "#fffdf6"); pg.addColorStop(1, "#f6efdc"); x.fillStyle = pg; x.fillRect(0, 0, W, H);
    x.save(); x.beginPath(); x.rect(480, 60, W - 540, H - 120); x.clip(); x.lineWidth = 1.2;
    for (let k = 0; k < 26; k++) { x.strokeStyle = `rgba(${gold ? "176,134,43" : "120,135,150"},${0.05 + (k % 3) * 0.015})`; x.beginPath();
      for (let px = 480; px <= W; px += 6) { const py = H * 0.52 + Math.sin(px * 0.006 + k * 0.42) * (150 + k * 9) * Math.sin(px * 0.0017 + k * 0.1); px === 480 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); }
    x.restore();

    // ---- emerald band with lotus pattern ----
    const bx = 60, bw = 420; const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, em1); bg.addColorStop(1, em2); x.fillStyle = bg; x.fillRect(bx, 60, bw, H - 120);
    x.save(); x.beginPath(); x.rect(bx, 60, bw, H - 120); x.clip(); x.globalAlpha = 0.13; x.strokeStyle = gold ? "#f3d27a" : "#dfe6ee"; x.lineWidth = 2;
    const petal = (cx, cy, s) => { for (let i = 0; i < 4; i++) { x.save(); x.translate(cx, cy); x.rotate((i * Math.PI) / 2); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(s * 0.5, -s * 0.5, 0, -s); x.quadraticCurveTo(-s * 0.5, -s * 0.5, 0, 0); x.stroke(); x.restore(); } };
    for (let r = 0; r < 18; r++) for (let q = 0; q < 6; q++) petal(bx + 35 + q * 70 + (r % 2) * 35, 90 + r * 74, 26);
    x.restore();
    x.fillStyle = metal(bx + bw - 10, 0, bx + bw + 10, 0); x.fillRect(bx + bw - 6, 60, 12, H - 120);

    // tree emblem (gold line art)
    const ex = bx + bw / 2, ey = 360; x.save(); x.translate(ex, ey);
    x.strokeStyle = metal(-110, -110, 110, 110); x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 128, 0, Math.PI * 2); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 112, 0, Math.PI * 2); x.stroke();
    x.fillStyle = metal(-60, -90, 60, 90);
    x.beginPath(); x.moveTo(-9, 78); x.quadraticCurveTo(-6, 20, -2, -10); x.lineTo(2, -10); x.quadraticCurveTo(6, 20, 9, 78); x.closePath(); x.fill();
    [[0, -38, 46], [-40, -14, 34], [40, -14, 34], [-24, -58, 30], [24, -58, 30], [0, -76, 26]].forEach(([cx, cy, r]) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); });
    x.strokeStyle = em1; x.lineWidth = 3; [[-2, -10, -34, -30], [2, -10, 34, -30], [0, -20, 0, -60]].forEach(([a, b, c2, d]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); });
    x.fillStyle = metal(-60, 80, 60, 90); x.beginPath(); x.ellipse(0, 84, 58, 9, 0, 0, Math.PI * 2); x.fill();
    x.restore();
    T("pre·DM", ex, 600, '800 64px "Outfit", sans-serif', "#ffffff");
    T("SMART HUB", ex, 648, '600 24px "Outfit", sans-serif', gold ? "#f3d27a" : "#dfe6ee", "center", 10);
    T("แพลตฟอร์มอ่อนหวานวิทยา", ex, 682, '600 20px "Anuphan", sans-serif', gold ? "#f3d27a" : "#dfe6ee");
    T("Know Your Risk.", ex, 722, '500 24px "Outfit", sans-serif', "rgba(255,255,255,.75)");
    T("Shape Your Future.", ex, 754, '500 24px "Outfit", sans-serif', "rgba(255,255,255,.75)");

    // rosette seal with ribbons
    const sx = ex, sy = 1030; x.save(); x.translate(sx, sy);
    x.fillStyle = gold ? "#8f1f2a" : "#2f4a7a"; [[-1, 1], [1, 1]].forEach(([d]) => { x.beginPath(); x.moveTo(d * 18, 40); x.lineTo(d * 78, 250); x.lineTo(d * 48, 228); x.lineTo(d * 30, 262); x.lineTo(d * 2, 60); x.closePath(); x.fill(); });
    for (let i = 0; i < 36; i++) { x.rotate(Math.PI / 18); x.fillStyle = metal(-20, -165, 20, -120); x.beginPath(); x.moveTo(0, -162); x.lineTo(13, -128); x.lineTo(-13, -128); x.closePath(); x.fill(); }
    x.fillStyle = metal(-130, -130, 130, 130); x.beginPath(); x.arc(0, 0, 132, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 112, 0, Math.PI * 2); x.stroke(); x.setLineDash([3, 7]); x.beginPath(); x.arc(0, 0, 100, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    const sealInk = gold ? "#5a3c08" : "#3b4552";
    T("★ ★ ★", 0, -52, '700 22px "Outfit", sans-serif', sealInk);
    T(gold ? "ระดับทอง" : "ระดับเงิน", 0, 6, '700 44px "Pridi", "Anuphan", serif', sealInk);
    T(gold ? "GOLD" : "SILVER", 0, 44, '800 26px "Outfit", sans-serif', sealInk, "center", 6);
    T("3 MONTHS", 0, 76, '600 18px "Outfit", sans-serif', sealInk, "center", 4);
    x.restore();

    // ---- frame ----
    x.strokeStyle = metal(0, 0, W, H); x.lineWidth = 8; x.strokeRect(36, 36, W - 72, H - 72);
    x.lineWidth = 2; x.strokeRect(60, 60, W - 120, H - 120);
    const orn = (cx, cy, sxx, syy) => { x.save(); x.translate(cx, cy); x.scale(sxx, syy); x.strokeStyle = tone; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 70); x.bezierCurveTo(0, 20, 20, 0, 70, 0); x.moveTo(14, 70); x.bezierCurveTo(14, 34, 34, 14, 70, 14); x.stroke(); x.fillStyle = tone; x.beginPath(); x.moveTo(30, 30); x.lineTo(40, 20); x.lineTo(50, 30); x.lineTo(40, 40); x.closePath(); x.fill(); x.restore(); };
    orn(W - 82, 82, -1, 1); orn(W - 82, H - 82, -1, -1);

    // ---- main text ----
    const cx = 1220;
    T("CERTIFICATE OF ACHIEVEMENT", cx, 200, '600 30px "Outfit", sans-serif', tone, "center", 12);
    T("เกียรติบัตร", cx, 345, '700 136px "Pridi", "Anuphan", serif', em1);
    T(gold ? "ระดับทอง · ผลลัพธ์สุขภาพดีเยี่ยมต่อเนื่อง 3 เดือน" : "ระดับเงิน · ผลลัพธ์สุขภาพดีต่อเนื่อง 3 เดือน", cx, 412, '500 34px "Pridi", "Anuphan", serif', tone);
    T("ขอมอบเกียรติบัตรนี้ไว้เพื่อแสดงว่า", cx, 478, '400 34px "Pridi", "Anuphan", serif', "#5b6660");
    const nf = name.length > 22 ? 70 : 92; x.font = `700 ${nf}px "Charm", "Pridi", serif`; x.textAlign = "center"; x.save(); x.shadowColor = "rgba(60,40,0,.28)"; x.shadowBlur = 3; x.shadowOffsetY = 2; if (gold) x.fillStyle = metal(cx - 400, 560, cx + 400, 650); else { const ng = x.createLinearGradient(cx - 400, 0, cx + 400, 0); ng.addColorStop(0, "#34404e"); ng.addColorStop(0.5, "#5f6c7c"); ng.addColorStop(1, "#34404e"); x.fillStyle = ng; } x.fillText(name, cx, 632); x.restore();
    x.fillStyle = gold ? "rgba(90,60,8,.0)" : "transparent";
    x.strokeStyle = tone; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 460, 690); x.lineTo(cx - 22, 690); x.moveTo(cx + 22, 690); x.lineTo(cx + 460, 690); x.stroke();
    x.fillStyle = tone; x.beginPath(); x.moveTo(cx, 678); x.lineTo(cx + 12, 690); x.lineTo(cx, 702); x.lineTo(cx - 12, 690); x.closePath(); x.fill();
    T("ได้ปฏิบัติตามโปรแกรมปรับเปลี่ยนพฤติกรรมเพื่อป้องกันโรคเบาหวานอย่างสม่ำเสมอครบ 3 เดือน", cx, 762, '400 33px "Pridi", "Anuphan", serif', ink);
    T(`ระหว่างวันที่ ${thDate(E.start)} ถึง ${thDate(E.today)} โดยมีผลลัพธ์สุขภาพที่ดีขึ้นอย่างต่อเนื่อง`, cx, 810, '400 33px "Pridi", "Anuphan", serif', ink);

    // stats row with gold hairlines
    const stats = [[`${E.days}`, "วันที่ออกกำลังกาย"], [`${E.goodWeeks}/12`, "สัปดาห์ที่ฝึกครบ"]];
    if (E.wDiff != null) stats.push([`${E.wDiff <= 0 ? "−" : "+"}${f1(Math.abs(E.wDiff))}`, "น้ำหนัก (กก.)"]);
    if (E.waistDiff != null) stats.push([`${E.waistDiff <= 0 ? "−" : "+"}${f1(Math.abs(E.waistDiff))}`, "รอบเอว (ซม.)"]);
    if (E.risk0 != null && E.risk1 < E.risk0) stats.push([`${E.risk0}→${E.risk1}`, "คะแนนเสี่ยงเบาหวาน"]);
    const st = stats.slice(0, 5), sw = 236, x0 = cx - (st.length * sw) / 2, sy0 = 868;
    x.strokeStyle = tone; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 600, sy0); x.lineTo(cx + 600, sy0); x.moveTo(cx - 600, sy0 + 150); x.lineTo(cx + 600, sy0 + 150); x.stroke();
    st.forEach(([v, l], i) => { const mx = x0 + sw * i + sw / 2; T(v, mx, sy0 + 86, '700 58px "Pridi", "Outfit", serif', em2); T(l, mx, sy0 + 124, '500 23px "Anuphan", sans-serif', "#6b7470");
      if (i) { x.strokeStyle = gold ? "rgba(167,123,34,.45)" : "rgba(123,135,148,.45)"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0 + sw * i, sy0 + 28); x.lineTo(x0 + sw * i, sy0 + 122); x.stroke(); } });

    // signatures + issue info
    [[cx - 330, "ผู้ดูแลโปรแกรม"], [cx + 330, "นักกายภาพบำบัด"]].forEach(([sx2, role]) => { x.strokeStyle = "#9aa39e"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(sx2 - 190, 1170); x.lineTo(sx2 + 190, 1170); x.stroke(); T(role, sx2, 1212, '500 28px "Pridi", "Anuphan", serif', ink); T("ลงนาม ................................", sx2, 1150, '400 20px "Anuphan", sans-serif', "rgba(0,0,0,.0)"); });
    T(`ออกให้ ณ วันที่ ${thDate(issued)}`, cx, 1290, '400 26px "Pridi", "Anuphan", serif', "#5b6660");
    T(`เลขที่ ${no}`, 520, H - 92, '500 22px "Outfit", sans-serif', "#9aa39e", "left", 2);
    if (opts.sample) { x.save(); x.translate(cx, H / 2); x.rotate(-0.32); T("ตัวอย่าง", 0, 90, '700 300px "Pridi", "Anuphan", serif', "rgba(200,56,43,.14)"); x.restore(); }
    return { canvas: c, no };
  }

  /* ---------- section in the tree page ---------- */
  function render() {
    const root = $("#certRoot"); if (!root) return;
    const E = evaluate(), certs = A().store.get("certs", []), last = certs[certs.length - 1];
    if (E.eligible && (!last || last.date < addDays(E.today, -80))) { certs.push({ date: E.today, tier: E.tier, nOk: E.nOk, days: E.days }); A().store.set("certs", certs); A().toast("🎉 ยินดีด้วย! คุณได้รับเกียรติบัตร 3 เดือน"); }
    const got = A().store.get("certs", []);
    const row = (ok, label, val) => `<li class="${ok ? "ok" : ""}"><span class="ck">${ok ? "✓" : ""}</span><span><b>${esc(label)}</b><small>${esc(val)}</small></span></li>`;
    root.innerHTML = `<section class="card ct-card ${E.eligible ? "won " + E.tier : ""}">
      <div class="ct-head"><div><h2>🏅 เกียรติบัตร 3 เดือน</h2><p class="lede">${E.eligible ? `ยินดีด้วย! คุณผ่านเกณฑ์ <b>${E.tier === "gold" ? "ระดับทอง" : "ระดับเงิน"}</b> ดาวน์โหลดเกียรติบัตรได้เลย` : "ฝึกต่อเนื่องและมีผลลัพธ์ดีขึ้นภายใน 3 เดือน เพื่อรับเกียรติบัตร"}</p></div>
        <div class="ct-acts">${E.eligible ? `<button class="btn primary" type="button" data-cert="get">⬇ ดาวน์โหลดเกียรติบัตร</button>` : ""}<button class="btn sm" type="button" data-cert="preview">👁 ดูตัวอย่างเกียรติบัตร</button></div></div>
      <div class="ct-grid">
        <div><h3>1. ฝึกสม่ำเสมอ ${E.consistent ? "✅" : ""}</h3><p class="hint">อย่างน้อย 3 วัน/สัปดาห์ ให้ได้ 9 จาก 12 สัปดาห์ · ตอนนี้ <b>${E.goodWeeks}/12</b> สัปดาห์ (${E.days} วันใน 90 วัน)</p>
          <div class="ct-weeks" aria-label="จำนวนวันที่ฝึกในแต่ละสัปดาห์ 12 สัปดาห์ล่าสุด">${E.weeks.map((n, i) => `<span class="${n >= 3 ? "ok" : n ? "part" : ""}" title="สัปดาห์ที่ ${i + 1}: ${n} วัน"><i style="height:${Math.min(100, (n / 7) * 100)}%"></i><small>${n}</small></span>`).join("")}</div></div>
        <div><h3>2. ผลลัพธ์ดีขึ้น ${E.nOk >= 2 ? "✅" : ""} <small>(${E.nOk}/4 · ต้องได้อย่างน้อย 2)</small></h3><ul class="ct-list">${E.outcomes.map((o) => row(o.ok, o.label, o.val)).join("")}</ul></div>
        <div><h3>3. ดีขึ้นต่อเนื่อง ${E.trend ? "✅" : ""}</h3><ul class="ct-list">${row(E.trend, "น้ำหนักไม่เด้งกลับขึ้นระหว่างการวัดแต่ละครั้ง", E.hasBody ? (E.trend ? "แนวโน้มลดลงต่อเนื่อง" : "มีช่วงที่น้ำหนักเพิ่มขึ้นเกิน 0.5 กก.") : "ต้องบันทึก Body Composition อย่างน้อย 2 ครั้ง")}</ul>
          <p class="hint">ระดับทอง: ผลลัพธ์ดีขึ้นตั้งแต่ 3 ด้าน · ระดับเงิน: 2 ด้าน</p>
          ${got.length ? `<h3>เกียรติบัตรที่ได้รับ</h3><ul class="ct-got">${got.slice().reverse().map((g) => `<li><span class="medal ${g.tier}">${g.tier === "gold" ? "🥇" : "🥈"}</span>${g.tier === "gold" ? "ระดับทอง" : "ระดับเงิน"} · ${thDate(g.date, { day: "numeric", month: "short", year: "2-digit" })}</li>`).join("")}</ul>` : ""}</div>
      </div></section>`;
  }
  async function show(sample) {
    const E = evaluate(); if (sample) { E.tier = "gold"; if (E.wDiff == null) { E.wDiff = -3.2; E.waistDiff = -4; } }
    const issued = sample ? E.today : (A().store.get("certs", []).slice(-1)[0]?.date || E.today);
    const { canvas, no } = await drawCert(E, { sample, date: issued });
    const box = document.createElement("div"); box.className = "ct-modal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "เกียรติบัตร");
    box.innerHTML = `<div class="ct-sheet"><img src="${canvas.toDataURL("image/png")}" alt="เกียรติบัตร ${sample ? "(ตัวอย่าง)" : ""}"><div class="ct-mbtns">${sample ? `<span class="hint">ตัวอย่างหน้าตาเกียรติบัตร (ข้อมูลจริงจะแทนที่เมื่อผ่านเกณฑ์)</span>` : `<button class="btn primary" type="button" data-cert="png">⬇ บันทึกเป็นรูปภาพ (PNG)</button><button class="btn" type="button" data-cert="print">🖨 พิมพ์</button>`}<button class="btn" type="button" data-cert="close">ปิด</button></div></div>`;
    document.body.appendChild(box); document.body.style.overflow = "hidden"; box.querySelector("[data-cert]").focus();
    box._canvas = canvas; box._no = no;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cert]"); const modal = $(".ct-modal");
    if (!b) { if (modal && e.target === modal) { modal.remove(); document.body.style.overflow = ""; } return; }
    const a = b.dataset.cert;
    if (a === "preview") return show(true);
    if (a === "get") return show(false);
    if (a === "close") { modal?.remove(); document.body.style.overflow = ""; return; }
    if (a === "png" && modal) { modal._canvas.toBlob((blob) => { const l = document.createElement("a"); l.href = URL.createObjectURL(blob); l.download = `predm-certificate-${modal._no}.png`; l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 2000); A().toast("บันทึกเกียรติบัตรแล้ว"); }); return; }
    if (a === "print" && modal) { const w = window.open("", "_blank"); if (!w) return A().toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์"); w.document.write(`<!doctype html><title>เกียรติบัตร</title><style>@page{size:A4 landscape;margin:0}body{margin:0}img{width:100%;display:block}</style><img src="${modal._canvas.toDataURL("image/png")}" onload="setTimeout(()=>print(),200)">`); w.document.close(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".ct-modal")) { $(".ct-modal").remove(); document.body.style.overflow = ""; } });
  window.addEventListener("predm:view", (e) => { if (e.detail === "tree") render(); });
  if ($("#view-tree") && !$("#view-tree").hidden) render();
  window.PreDMCert = { evaluate, draw: drawCert };
})();

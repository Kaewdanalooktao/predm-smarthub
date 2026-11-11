/* Pre-DM Smart Hub — ADMIN app (separate page): login, system dashboard, patients & exercise prescriptions.
   Uses the patient app's exercise catalogue via window.PreDMData (app.js loaded in data-only mode). */
(function () {
  "use strict";
  const A = () => window.PreDMData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(d));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const thDate = (s, o = { day: "numeric", month: "short", year: "2-digit" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const store = () => A().store;

  /* =====================================================================
     ADMIN DASHBOARD
     ===================================================================== */
  const FEAT = { home: "หน้าหลัก", risk: "ประเมินความเสี่ยง", exercise: "โปรแกรมออกกำลังกาย", tracking: "AI Tracking", game: "เกมส์", fitness: "สมรรถภาพกาย", body: "Body Composition", transform: "AI Transformation", chat: "แชทบอท", consult: "ปรึกษานักกายภาพ" };
  const CAT_TH = { aerobic: "แอโรบิก", strength: "เสริมแรง", flex: "ยืดเหยียด", balance: "ทรงตัว", thai: "สไตล์ไทย", isan: "สไตล์อีสาน", pakhaoma: "ผ้าขาวม้า", game: "เกมส์", other: "อื่น ๆ" };
  const CAT_COL = { aerobic: "#5b8cff", strength: "#f08a4b", flex: "#2fb37a", balance: "#b18cff", thai: "#e85d9a", isan: "#f2b233", pakhaoma: "#3fb6d6", game: "#8d6e63", other: "#9aa3b2" };
  const AD = { src: "sample", range: 30, charts: [] };
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const riskScore = (u, wt, waist) => (A().calcRisk ? A().calcRisk({ age: u.age, sex: u.sex, htn: u.htn, fh: u.fh, wt, ht: u.ht, waist }).score : 0);

  let SAMPLE = null;
  function sampleData() {
    if (SAMPLE) return SAMPLE;
    const R = mulberry(20261108), P = A().PROGRAMS || {}, N = 128, DAYS = 90, today = todayISO();
    const pick = (arr, w) => { let s = w.reduce((a, b) => a + b, 0) * R(); for (let i = 0; i < arr.length; i++) { s -= w[i]; if (s <= 0) return arr[i]; } return arr[arr.length - 1]; };
    const cats = ["aerobic", "strength", "flex", "balance", "thai", "isan", "pakhaoma", "game"], cw = [30, 16, 11, 12, 11, 8, 8, 6];
    const feats = Object.keys(FEAT), fw = [30, 6, 24, 9, 8, 4, 7, 4, 7, 2];
    const days = {}, logs = [], users = [], consults = [];
    for (let i = 0; i < N; i++) {
      const join = Math.floor(Math.pow(R(), 0.8) * DAYS), act = 0.12 + Math.pow(R(), 0.9) * 0.83, stop = R() < 0.3 ? Math.floor(R() * join) : -1, sex = R() < 0.55 ? "f" : "m", age = 38 + Math.floor(R() * 32), ht = sex === "f" ? 150 + R() * 15 : 160 + R() * 17;
      const bmi0 = 21.5 + Math.pow(R(), 1.2) * 10, wt0 = bmi0 * (ht / 100) ** 2, waist0 = (sex === "f" ? 78 : 86) + (bmi0 - 23) * 2.4 + R() * 6, fat0 = (sex === "f" ? 30 : 22) + (bmi0 - 23) * 1.2 + R() * 3;
      const u = { id: i, sex, age, ht, htn: R() < 0.25, fh: R() < 0.3, join: addDays(today, -join), act, active: new Set(), minutes: 0 };
      for (let d = join; d > stop; d--) {
        const date = addDays(today, -d), dayAct = act * (0.75 + 0.25 * Math.sin((d + i) / 6));
        if (R() < dayAct * 0.8) {
          const day = (days[date] = days[date] || { users: new Set(), sessions: 0, views: {} });
          day.users.add(i); u.active.add(date); day.sessions += 1 + (R() < 0.25 ? 1 : 0);
          const nv = 2 + Math.floor(R() * 6); for (let k = 0; k < nv; k++) { const f = pick(feats, fw); day.views[f] = (day.views[f] || 0) + 1; }
          if (R() < 0.78) {
            const ne = 2 + Math.floor(R() * 2.6);
            for (let k = 0; k < ne; k++) {
              const c = pick(cats, cw); let name, min;
              if (c === "game") { name = pick(["Bubble Pop", "นกกระพือปีก", "เตะดาว", "สควอทเป่าลูกโป่ง", "ยืนขาเดียวสู้ลม"], [5, 3, 3, 2, 2]); min = 4 + Math.floor(R() * 8); }
              else { const L = P[c]?.list || []; const e = L.length ? pick(L, L.map((_, j) => 1 / (j + 1.4))) : { n: c, m: 5 }; name = e.n; min = Math.max(6, Math.round((e.m || 3) * 2 + 6 + R() * 14)); }
              if (c === "aerobic") min = Math.round(20 + R() * 30);
              logs.push({ date, user: i, cat: c, name, minutes: min }); u.minutes += min;
            }
          }
          if (R() < 0.006) consults.push({ date, user: i });
        }
      }
      const eff = Math.min(1, u.active.size / 50) * (0.6 + R() * 0.6);
      const dW = -(0.2 + eff * 5.2) + (R() - 0.45) * 3.2, wt1 = wt0 + dW, waist1 = waist0 + dW * 1.05 + (R() - 0.5), fat1 = fat0 + dW * 0.55;
      u.base = { weight: wt0, waist: waist0, bmi: wt0 / (ht / 100) ** 2, fat: fat0, visc: 8 + (bmi0 - 23) * 0.9, risk: 0, chair30: 9 + Math.round(R() * 6), tug: 7.5 + R() * 2.5, sls: 6 + Math.round(R() * 14) };
      u.last = { weight: wt1, waist: waist1, bmi: wt1 / (ht / 100) ** 2, fat: fat1, visc: u.base.visc + dW * 0.35, risk: 0, chair30: u.base.chair30 + Math.round(eff * 5 + (R() - 0.35) * 3), tug: u.base.tug - eff * 1.3 + (R() - 0.6) * 0.9, sls: u.base.sls + Math.round(eff * 12 + (R() - 0.4) * 8) };
      u.base.risk = riskScore(u, wt0, waist0); u.last.risk = riskScore(u, wt1, waist1);
      users.push(u);
    }
    const impN = ["เดิน (Samsung Health)", "วิ่ง (Strava)", "ปั่นจักรยาน (Garmin)", "เดินเร็ว (Apple Fitness)"];
    const imports = logs.filter((l, i) => l.cat === "aerobic" && i % 11 === 0).map((l, i) => ({ date: l.date, user: l.user, who: "ผู้ใช้ตัวอย่าง #" + (l.user + 1), name: impN[i % impN.length], type: "aerobic", minutes: l.minutes }));
    SAMPLE = { users, days, logs, consults, imports, sample: true };
    return SAMPLE;
  }
  function localData() {
    const ev = store().get("events", {}), days = {};
    Object.entries(ev).forEach(([d, o]) => { const views = {}; Object.entries(o).forEach(([k, v]) => { if (k.startsWith("view:")) views[k.slice(5)] = v; }); days[d] = { users: new Set([0]), sessions: o.session || 0, views }; });
    const known = new Set(["aerobic", "strength", "flex", "balance", "game"]);
    const P = A().PROGRAMS || {}, nameCat = {}; Object.entries(P).forEach(([k, v]) => v.list.forEach((e) => (nameCat[e.n] = k)));
    const logs = store().get("logs", []).map((l) => ({ date: l.date, user: 0, cat: nameCat[l.name] || (known.has(l.type) ? l.type : "other"), name: l.name, minutes: l.minutes || 0 }));
    logs.forEach((l) => { days[l.date] = days[l.date] || { users: new Set([0]), sessions: 0, views: {} }; });
    const body = store().get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date)), fit = store().get("fitness", []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const pr = A().profile(), ri = store().get("riskInput", {}) || {};
    const u = { id: 0, age: ri.age || pr.age || 50, sex: ri.sex || pr.sex || "m", htn: !!ri.htn, fh: !!ri.fh, ht: body[body.length - 1]?.height || ri.ht || pr.height || 165, active: new Set(Object.keys(days)), join: Object.keys(days).sort()[0] || todayISO() };
    const mk = (b, f) => (b || f ? { weight: b?.weight, waist: b?.waist, bmi: b?.weight && (b.height || u.ht) ? b.weight / ((b.height || u.ht) / 100) ** 2 : undefined, fat: b?.fat, visc: b?.visc, risk: b?.weight && b?.waist ? riskScore(u, b.weight, b.waist) : undefined, chair30: f?.chair30, tug: f?.tug, sls: f?.sls } : null);
    if (body.length || fit.length) { u.base = mk(body[0], fit[0]); u.last = mk(body[body.length - 1], fit[fit.length - 1]); }
    const consults = store().get("consults", []).filter((c) => c.status === "done").map((c) => ({ date: c.date, user: 0 }));
    const imports = store().get("logs", []).filter((l) => l.source === "import" && !l.sample).map((l) => ({ date: l.date, user: 0, who: pr.name || "ผู้ใช้เครื่องนี้", name: l.name, type: l.type, minutes: Number(l.minutes) || 0 }));
    return { users: [u], days, logs, consults, imports, sample: false };
  }

  function aggregate(D, range) {
    const end = todayISO(), start = addDays(end, -(range - 1)), inR = (d) => d >= start && d <= end;
    const dates = []; for (let i = range - 1; i >= 0; i--) dates.push(addDays(end, -i));
    const daily = dates.map((d) => ({ d, dau: D.days[d]?.users.size || 0, ses: D.days[d]?.sessions || 0 }));
    const activeUsers = new Set(); Object.entries(D.days).forEach(([d, o]) => { if (inR(d)) o.users.forEach((u) => activeUsers.add(u)); });
    const impRows = (D.imports || []).filter((l) => inR(l.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
    const imp = { n: impRows.length, users: new Set(impRows.map((l) => l.user)).size, min: impRows.reduce((t, l) => t + (l.minutes || 0), 0), rows: impRows };
    const logs = D.logs.filter((l) => inR(l.date)), totalMin = logs.reduce((t, l) => t + l.minutes, 0), weeks = range / 7;
    const perUser = {}; logs.forEach((l) => (perUser[l.user] = (perUser[l.user] || 0) + l.minutes));
    const nAct = Math.max(1, activeUsers.size), avgWeek = totalMin / nAct / weeks, meet150 = Object.values(perUser).filter((m) => m / weeks >= 150).length;
    const sessions = daily.reduce((t, x) => t + x.ses, 0), views = {};
    Object.entries(D.days).forEach(([d, o]) => { if (inR(d)) Object.entries(o.views).forEach(([k, v]) => (views[k] = (views[k] || 0) + v)); });
    const byName = {}; logs.forEach((l) => { const k = l.name; (byName[k] = byName[k] || { n: k, cat: l.cat, c: 0, m: 0 }); byName[k].c++; byName[k].m += l.minutes; });
    const top = Object.values(byName).sort((a, b) => b.c - a.c).slice(0, 10);
    const byCat = {}; logs.forEach((l) => (byCat[l.cat] = (byCat[l.cat] || 0) + l.minutes));
    const wk = []; for (let w = Math.ceil(range / 7) - 1; w >= 0; w--) { const ws = addDays(end, -(w * 7 + 6)), we = addDays(end, -w * 7); const L = logs.filter((l) => l.date >= ws && l.date <= we); const us = new Set(); Object.entries(D.days).forEach(([d, o]) => { if (d >= ws && d <= we) o.users.forEach((u) => us.add(u)); }); wk.push({ label: thDate(we, { day: "numeric", month: "short" }), v: us.size ? L.reduce((t, l) => t + l.minutes, 0) / us.size : 0 }); }
    const M = [["weight", "น้ำหนัก", "กก.", -1, 1], ["waist", "รอบเอว", "ซม.", -1, 1], ["bmi", "BMI", "", -1, 1], ["fat", "ไขมันในร่างกาย", "%", -1, 1], ["visc", "ไขมันช่องท้อง", "ระดับ", -1, 1], ["risk", "คะแนนเสี่ยงเบาหวาน", "/17", -1, 1], ["chair30", "ลุก-นั่ง 30 วินาที", "ครั้ง", 1, 0], ["tug", "TUG (ลุกเดินไปกลับ)", "วินาที", -1, 1], ["sls", "ยืนขาเดียว", "วินาที", 1, 0]];
    const changes = M.map(([k, label, unit, good, dp]) => {
      const pairs = D.users.filter((u) => u.base && u.last && u.base[k] != null && u.last[k] != null);
      if (!pairs.length) return { k, label, unit, n: 0 };
      const b = pairs.reduce((t, u) => t + u.base[k], 0) / pairs.length, l = pairs.reduce((t, u) => t + u.last[k], 0) / pairs.length;
      const improved = pairs.filter((u) => (u.last[k] - u.base[k]) * good > 0).length;
      return { k, label, unit, good, dp, n: pairs.length, b, l, pct: b ? ((l - b) / b) * 100 : 0, improved };
    });
    const lv = (s) => (s <= 2 ? 0 : s <= 5 ? 1 : s <= 8 ? 2 : 3), rb = [0, 0, 0, 0], rl = [0, 0, 0, 0];
    D.users.forEach((u) => { if (u.base?.risk != null && u.last?.risk != null) { rb[lv(u.base.risk)]++; rl[lv(u.last.risk)]++; } });
    const consults = D.consults.filter((c) => inR(c.date)).length;
    const newUsers = D.users.filter((u) => u.join && inR(u.join)).length;
    const retained = D.users.filter((u) => { const a = [...u.active].filter(inR); return a.length >= 2 && a.some((d) => d >= addDays(end, -6)); }).length;
    return { dates, daily, total: D.users.length, active: activeUsers.size, newUsers, retained, sessions, totalMin, avgWeek, meet150, nAct, views, top, byCat, wk, changes, rb, rl, consults, logsN: logs.length, imp };
  }

  function chartTheme() { const cs = getComputedStyle(document.documentElement); return { ink: cs.getPropertyValue("--muted").trim() || "#6b7280", line: cs.getPropertyValue("--line").trim() || "#e5e7eb", text: cs.getPropertyValue("--ink").trim() || "#111" }; }
  function renderAdmin() {
    const root = $("#adRoot"); if (!root) return;
    if (AD.src === "cloud" && !CL.dash) {
      root.innerHTML = `<div class="card"><p class="lede">⏳ กำลังโหลดข้อมูลจริงจากฐานข้อมูล…</p></div>`;
      if (!CL.loadingD) { CL.loadingD = true; loadCloudDash().then(() => { CL.loadingD = false; renderAdmin(); }).catch((e) => { CL.loadingD = false; AD.src = "sample"; toast("โหลดข้อมูลจริงไม่สำเร็จ: " + (e.message || e)); renderAdmin(); }); }
      return;
    }
    const D = dashData(), G = aggregate(D, AD.range);
    const kpi = (lab, val, sub, tone = "") => `<div class="ad-kpi ${tone}"><small>${lab}</small><b>${val}</b><span>${sub}</span></div>`;
    const pctTxt = (c) => (c.n ? `${c.pct > 0 ? "+" : ""}${fmt(c.pct)}%` : "–");
    root.innerHTML = `
      <div class="ad-bar card">
        <div class="seg" role="radiogroup" aria-label="แหล่งข้อมูล">
          ${isCloud() ? `<button type="button" role="radio" aria-checked="${AD.src === "cloud"}" data-src="cloud">☁️ ข้อมูลจริง (ฐานข้อมูล)</button>` : ""}
          <button type="button" role="radio" aria-checked="${AD.src === "sample"}" data-src="sample">ข้อมูลตัวอย่าง (จำลอง ${sampleData().users.length} คน)</button>
          <button type="button" role="radio" aria-checked="${AD.src === "local"}" data-src="local">ข้อมูลเครื่องนี้</button>
        </div>
        <div class="seg" role="radiogroup" aria-label="ช่วงเวลา">${[7, 30, 90].map((r) => `<button type="button" role="radio" aria-checked="${AD.range === r}" data-range="${r}">${r} วัน</button>`).join("")}</div>
        <button class="btn sm" type="button" id="adCsv">⬇ ส่งออก CSV</button>
      </div>
      ${D.cloud ? `<p class="ad-note">☁️ ข้อมูลจริงจากฐานข้อมูล · ผู้ป่วย ${D.users.length} คน · โหลดเมื่อ ${CL.at ? CL.at.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-"} น. <button type="button" class="link" data-refresh>🔄 รีเฟรช</button></p>` : D.sample ? `<p class="ad-note">ℹ️ แอปเวอร์ชันนี้เก็บข้อมูลในเครื่องผู้ใช้แต่ละคน หน้านี้จึงแสดง <b>ข้อมูลจำลอง</b> เพื่อให้เห็นภาพรวมเมื่อเชื่อมต่อฐานข้อมูลกลาง เลือก “ข้อมูลเครื่องนี้” เพื่อดูข้อมูลจริงของเครื่องนี้</p>` : `<p class="ad-note">ℹ️ ข้อมูลจริงจากเครื่องนี้ (ผู้ใช้ 1 คน) · นับการเปิดหน้าตั้งแต่เปิดใช้ Dashboard</p>`}
      <div class="ad-kpis">
        ${kpi("ผู้ใช้ทั้งหมด", G.total.toLocaleString(), `ใหม่ ${G.newUsers} คนในช่วงนี้`)}
        ${kpi("ผู้ใช้งาน (Active)", G.active.toLocaleString(), `${G.total ? fmt((G.active / G.total) * 100, 0) : 0}% ของผู้ใช้ทั้งหมด`, "blue")}
        ${kpi("การเข้าใช้งาน", G.sessions.toLocaleString(), `เฉลี่ย ${fmt(G.sessions / AD.range, 1)} ครั้ง/วัน`)}
        ${kpi("ออกกำลังกายเฉลี่ย", `${fmt(G.avgWeek, 0)} <small>นาที/สัปดาห์</small>`, `ต่อผู้ใช้งาน 1 คน · เป้าหมาย 150`, G.avgWeek >= 150 ? "green" : "amber")}
        ${kpi("ผ่านเกณฑ์ 150 นาที", `${G.nAct ? fmt((G.meet150 / G.nAct) * 100, 0) : 0}%`, `${G.meet150} จาก ${G.active} คน`, "green")}
        ${kpi("ปรึกษานักกายภาพ", G.consults.toLocaleString(), `ครั้งในช่วง ${AD.range} วัน`, "pink")}
        ${kpi("อัปโหลดจากแอปอื่น", G.imp.n.toLocaleString(), `${G.imp.users} คน · รวม ${G.imp.min.toLocaleString()} นาที`, "green")}
      </div>
      <div class="ad-grid">
        <section class="card ad-wide"><h3>การใช้งานรายวัน</h3><div class="ad-chart"><canvas id="adDaily"></canvas></div></section>
        <section class="card"><h3>ฟีเจอร์ที่ใช้งาน <small>(จำนวนครั้งที่เปิด)</small></h3><div class="ad-chart"><canvas id="adFeat"></canvas></div></section>
        <section class="card"><h3>สัดส่วนเวลาออกกำลังกายตามประเภท</h3><div class="ad-chart"><canvas id="adCat"></canvas></div></section>
        <section class="card ad-wide"><h3>ท่าออกกำลังกายยอดนิยม Top 10 <small>(จำนวนครั้งที่ฝึก)</small></h3><div class="ad-chart tall"><canvas id="adTop"></canvas></div></section>
        <section class="card"><h3>เวลาออกกำลังกายเฉลี่ยต่อคน รายสัปดาห์</h3><div class="ad-chart"><canvas id="adWeek"></canvas></div></section>
        <section class="card"><h3>ระดับความเสี่ยงเบาหวาน: ครั้งแรก vs ล่าสุด</h3><div class="ad-chart"><canvas id="adRisk"></canvas></div></section>
        <section class="card ad-wide"><h3>📥 ผลออกกำลังกายที่ผู้ใช้อัปโหลดจากแอปอื่น <small>(${G.imp.n} รายการ · ${G.imp.users} คน · ${G.imp.min.toLocaleString()} นาที ในช่วง ${AD.range} วัน)</small></h3>
          ${G.imp.n ? `<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>วันที่</th><th>ผู้ใช้</th><th>กิจกรรม</th><th>ประเภท</th><th>นาที</th></tr></thead><tbody>
          ${G.imp.rows.slice(0, 50).map((l) => `<tr><td>${thDate(l.date)}</td><th scope="row">${esc(l.who || "–")}</th><td>${esc(l.name)}</td><td>${CAT_TH[l.type] || esc(l.type || "–")}</td><td>${l.minutes}</td></tr>`).join("")}
          </tbody></table></div>${G.imp.n > 50 ? `<p class="ad-foot">แสดง 50 รายการล่าสุด จากทั้งหมด ${G.imp.n} รายการ (ส่งออก CSV เพื่อดูทั้งหมด)</p>` : ""}` : `<p class="ad-imp-none">ยังไม่มีผู้ใช้อัปโหลดผลจากแอปอื่นในช่วงนี้</p>`}
          <p class="ad-foot">รายการเหล่านี้ผู้ใช้อัปโหลดเอง (รูปแคปหน้าจอหรือไฟล์จาก Samsung Health, Strava, Garmin ฯลฯ) และถูกนับรวมในนาทีออกกำลังกายด้านบนแล้ว</p>
        </section>
        <section class="card ad-wide"><h3>อัตราการเปลี่ยนแปลงของค่าต่าง ๆ <small>(ค่าเฉลี่ย ครั้งแรก → ล่าสุด)</small></h3>
          <div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>ตัวชี้วัด</th><th>ครั้งแรก</th><th>ล่าสุด</th><th>เปลี่ยนแปลง</th><th>ดีขึ้น</th><th>n</th></tr></thead><tbody>
          ${G.changes.map((c) => { const goodDir = c.n && (c.l - c.b) * c.good > 0; return `<tr><th scope="row">${c.label}${c.unit ? ` <small>(${c.unit})</small>` : ""}</th><td>${c.n ? fmt(c.b, c.dp) : "–"}</td><td>${c.n ? fmt(c.l, c.dp) : "–"}</td>
            <td><span class="ad-delta ${c.n ? (goodDir ? "up" : Math.abs(c.pct) < 0.05 ? "" : "down") : ""}">${c.n ? `${goodDir ? "▲" : "▼"} ${pctTxt(c)}` : "–"}</span></td>
            <td>${c.n ? `<span class="ad-meter"><i style="width:${fmt((c.improved / c.n) * 100, 0)}%"></i></span> ${fmt((c.improved / c.n) * 100, 0)}%` : "–"}</td><td>${c.n || "–"}</td></tr>`; }).join("")}
          </tbody></table></div>
          <p class="ad-foot">▲ เขียว = เปลี่ยนไปในทิศทางที่ดี (น้ำหนัก/รอบเอว/ไขมัน/TUG/คะแนนเสี่ยง ลดลง · ลุก-นั่ง/ยืนขาเดียว เพิ่มขึ้น) · “ดีขึ้น” = สัดส่วนผู้ใช้ที่ค่าดีขึ้น</p>
        </section>
      </div>`;
    drawAdminCharts(G);
  }
  function drawAdminCharts(G) {
    AD.charts.forEach((c) => c.destroy()); AD.charts = [];
    if (!window.Chart) { $$(".ad-chart").forEach((b) => (b.innerHTML = '<p class="lede">โหลดไลบรารีกราฟไม่สำเร็จ</p>')); return; }
    const T = chartTheme(), base = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { labels: { color: T.ink, boxWidth: 12, usePointStyle: true } }, tooltip: { mode: "index", intersect: false } } };
    const axes = (yTitle) => ({ x: { ticks: { color: T.ink, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: T.line } }, y: { beginAtZero: true, ticks: { color: T.ink, precision: 0 }, grid: { color: T.line }, title: { display: !!yTitle, text: yTitle, color: T.ink } } });
    const mk = (id, cfg) => { const el = $("#" + id); if (el) AD.charts.push(new window.Chart(el, cfg)); };
    mk("adDaily", { type: "line", data: { labels: G.daily.map((x) => thDate(x.d, { day: "numeric", month: "short" })), datasets: [
      { label: "ผู้ใช้งานต่อวัน", data: G.daily.map((x) => x.dau), borderColor: "#5b8cff", backgroundColor: "#5b8cff22", fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 },
      { label: "การเข้าใช้งาน", data: G.daily.map((x) => x.ses), borderColor: "#f08a4b", backgroundColor: "transparent", tension: 0.35, pointRadius: 0, borderWidth: 2, borderDash: [5, 4] }] }, options: { ...base, scales: axes(), interaction: { mode: "index", intersect: false } } });
    const fe = Object.keys(FEAT).map((k) => [FEAT[k], G.views[k] || 0]).sort((a, b) => b[1] - a[1]);
    mk("adFeat", { type: "bar", data: { labels: fe.map((x) => x[0]), datasets: [{ label: "ครั้ง", data: fe.map((x) => x[1]), backgroundColor: "#7b9cff", borderRadius: 6 }] }, options: { ...base, indexAxis: "y", plugins: { ...base.plugins, legend: { display: false } }, scales: { x: axes().y, y: { ticks: { color: T.ink }, grid: { display: false } } } } });
    const ce = Object.entries(G.byCat).sort((a, b) => b[1] - a[1]);
    mk("adCat", { type: "doughnut", data: { labels: ce.map(([k]) => CAT_TH[k] || k), datasets: [{ data: ce.map(([, v]) => v), backgroundColor: ce.map(([k]) => CAT_COL[k] || "#9aa3b2"), borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "#fff" }] },
      options: { ...base, cutout: "62%", plugins: { ...base.plugins, legend: { position: "right", labels: { color: T.ink, boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed.toLocaleString()} นาที (${fmt((c.parsed / Math.max(1, G.totalMin)) * 100, 0)}%)` } } } } });
    mk("adTop", { type: "bar", data: { labels: G.top.map((x) => x.n), datasets: [{ label: "จำนวนครั้ง", data: G.top.map((x) => x.c), backgroundColor: G.top.map((x) => CAT_COL[x.cat] || "#9aa3b2"), borderRadius: 6 }] },
      options: { ...base, indexAxis: "y", plugins: { ...base.plugins, legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} ครั้ง · ${G.top[c.dataIndex].m.toLocaleString()} นาที · ${CAT_TH[G.top[c.dataIndex].cat] || ""}` } } }, scales: { x: axes().y, y: { ticks: { color: T.text, font: { weight: 600 } }, grid: { display: false } } } } });
    mk("adWeek", { type: "bar", data: { labels: G.wk.map((x) => x.label), datasets: [{ label: "นาที/คน", data: G.wk.map((x) => Math.round(x.v)), backgroundColor: G.wk.map((x) => (x.v >= 150 ? "#2fb37a" : "#9cc0ff")), borderRadius: 6 }, { type: "line", label: "เป้าหมาย 150 นาที", data: G.wk.map(() => 150), borderColor: "#e05246", borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }] }, options: { ...base, scales: axes("นาที") } });
    const lvl = ["ต่ำ", "ปานกลาง", "สูง", "สูงมาก"];
    mk("adRisk", { type: "bar", data: { labels: lvl, datasets: [{ label: "ครั้งแรก", data: G.rb, backgroundColor: "#c9cfdb", borderRadius: 6 }, { label: "ล่าสุด", data: G.rl, backgroundColor: ["#2fb37a", "#f2b233", "#f08a4b", "#e05246"], borderRadius: 6 }] }, options: { ...base, scales: axes("จำนวนผู้ใช้") } });
  }
  function exportCsv() {
    const D = dashData(); if (!D) return; const G = aggregate(D, AD.range), rows = [["หมวด", "รายการ", "ค่า"]];
    rows.push(["สรุป", "ผู้ใช้ทั้งหมด", G.total], ["สรุป", "ผู้ใช้งาน", G.active], ["สรุป", "การเข้าใช้งาน", G.sessions], ["สรุป", "นาทีออกกำลังกายเฉลี่ย/สัปดาห์", fmt(G.avgWeek, 1)], ["สรุป", "ผ่านเกณฑ์ 150 นาที (คน)", G.meet150]);
    G.daily.forEach((x) => rows.push(["รายวัน", x.d, `${x.dau} ผู้ใช้ / ${x.ses} ครั้ง`]));
    G.top.forEach((x, i) => rows.push(["ท่ายอดนิยม", `${i + 1}. ${x.n}`, `${x.c} ครั้ง / ${x.m} นาที`]));
    G.imp.rows.forEach((l) => rows.push(["อัปโหลดจากแอปอื่น", `${l.date} · ${l.who || ""} · ${l.name}`, `${l.minutes} นาที`]));
    G.changes.forEach((c) => rows.push(["การเปลี่ยนแปลง", c.label, c.n ? `${fmt(c.b, 2)} → ${fmt(c.l, 2)} (${fmt(c.pct, 1)}%) n=${c.n}` : "–"]));
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `predm-dashboard-${AD.src}-${AD.range}d.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function initAdmin() {
    const root = $("#adRoot"); if (!root) return;
    root.addEventListener("click", (e) => {
      const s = e.target.closest("[data-src]"); if (s) { AD.src = s.dataset.src; return renderAdmin(); }
      const r = e.target.closest("[data-range]"); if (r) { AD.range = +r.dataset.range; return renderAdmin(); }
      if (e.target.closest("#adCsv")) exportCsv();
      if (e.target.closest("[data-refresh]")) { CL.dash = null; renderAdmin(); }
    });
  }

  /* =====================================================================
     SUPABASE (real accounts & data). Admin auth is stored separately from the patient app's session.
     ===================================================================== */
  const CFG = window.PREDM_CONFIG || {};
  const CL = { sb: null, on: !!(CFG.supabaseUrl && CFG.supabaseAnonKey), patients: null, rx: {}, dash: null, at: null, loadingD: false, loadingP: false };
  async function cloud() {
    if (!CL.on) return null; if (CL.sb) return CL.sb;
    if (!window.supabase?.createClient) await new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/supabase.js"; sc.onload = res; sc.onerror = () => rej(new Error("โหลดตัวเชื่อมฐานข้อมูลไม่สำเร็จ")); document.head.appendChild(sc); });
    CL.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "predm.admin.auth" } });
    return CL.sb;
  }
  const isCloud = () => !!adminSession()?.cloud;
  const isCloudAdmin = () => isCloud() && adminSession()?.rawRole === "admin";
  // Admin sign-in is two steps: (1) email + password, (2) a one-time code sent to that email.
  // Only the OTP session is kept, and the database grants staff access only to sessions signed in by OTP
  // (supabase/admin_otp.sql), so a stolen password alone cannot open patient data.
  const ADMIN_MAX_H = 12; // hours before an admin must sign in (and get a new code) again
  async function staffProfile(sb, uid) {
    const { data: prof, error } = await sb.from("profiles").select("full_name, role").eq("id", uid).maybeSingle(); if (error) throw error;
    if (!prof || !["physio", "admin"].includes(prof.role)) { await sb.auth.signOut(); throw new Error("บัญชีนี้ยังไม่มีสิทธิ์ผู้ดูแล — ให้ผู้ดูแลระบบตั้ง role เป็น physio หรือ admin ในฐานข้อมูลก่อน"); }
    return prof;
  }
  async function sendOtp(email) {
    const sb = await cloud();
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  }
  async function cloudLoginStep1(email, password) {
    const sb = await cloud(); const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error;
    await staffProfile(sb, data.user.id);
    await sb.auth.signOut(); // the password session is not kept; only the OTP session is
    await sendOtp(email);
  }
  async function cloudLoginStep2(email, token) {
    const sb = await cloud(); const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" }); if (error) throw error;
    const prof = await staffProfile(sb, data.user.id);
    store().set("adminSession", { cloud: true, otp: true, uid: data.user.id, name: prof.full_name || data.user.email, role: prof.role === "admin" ? "ผู้ดูแลระบบ" : "นักกายภาพบำบัด", rawRole: prof.role, at: Date.now() });
    CL.patients = null; CL.dash = null; CL.rx = {};
  }
  // The email may carry a sign-in link instead of a code (Supabase's default template). Opening it lands here with the
  // session in the URL hash; it is the same one-time email proof as typing the code, so finish the login the same way.
  const linkInUrl = () => CL.on && /(^|[#&])(access_token|error_description)=/.test(location.hash);
  async function cloudLoginLink() {
    const h = new URLSearchParams(location.hash.slice(1)), bad = h.get("error_description");
    const sb = await cloud(); const { data } = await sb.auth.getSession();
    history.replaceState(null, "", location.pathname + location.search);
    if (bad || !data.session) { // say which case it is, so the person (and support) can tell a used link from a setup problem
      const code = h.get("error_code") || (bad ? "link-error" : "no-session");
      throw new Error((code === "otp_expired" ? "ลิงก์นี้ถูกใช้ไปแล้ว หมดอายุ หรือไม่ใช่อีเมลฉบับล่าสุด (แต่ละลิงก์ใช้ได้ครั้งเดียว และเมื่อขออีเมลใหม่ ลิงก์เก่าจะใช้ไม่ได้ทันที)" : "เข้าสู่ระบบด้วยลิงก์ไม่สำเร็จ") + " — กรอกอีเมลและรหัสผ่านด้านบนอีกครั้ง รอรับอีเมลฉบับใหม่ แล้วกดลิงก์ในฉบับล่าสุดเพียงครั้งเดียว [" + code + "]");
    }
    const u = data.session.user, prof = await staffProfile(sb, u.id);
    store().set("adminSession", { cloud: true, otp: true, uid: u.id, name: prof.full_name || u.email, role: prof.role === "admin" ? "ผู้ดูแลระบบ" : "นักกายภาพบำบัด", rawRole: prof.role, at: Date.now() });
    CL.patients = null; CL.dash = null; CL.rx = {};
  }
  const authMsg = (x) => { const m = String(x?.message || x);
    return /Invalid login/i.test(m) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : /Email not confirmed/i.test(m) ? "ยังไม่ได้ยืนยันอีเมล"
      : /expired|invalid/i.test(m) && /token|otp/i.test(m) ? "รหัส OTP ไม่ถูกต้องหรือหมดอายุ ลองขอรหัสใหม่"
      : /rate limit|security purposes|only request/i.test(m) ? "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" : /Signups not allowed|not found/i.test(m) ? "ไม่พบบัญชีนี้" : m; };
  const maskEmail = (e) => e.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => a + "•••" + b);
  async function loadCloudPatients() {
    const sb = await cloud();
    const [ps, rxs] = await Promise.all([
      sb.from("profiles").select("id, full_name, phone, age, sex, created_at").eq("role", "patient").order("created_at", { ascending: false }),
      sb.from("prescriptions").select("id, patient_id, data, created_at, seen_at").order("created_at", { ascending: false }).limit(1000)]);
    if (ps.error) throw ps.error; if (rxs.error) throw rxs.error;
    const [staff, care] = await Promise.all([sb.from("profiles").select("id, full_name, role").in("role", ["physio", "admin"]).order("full_name"), sb.from("care_team").select("physio_id, patient_id")]);
    CL.staff = staff.data || []; CL.care = care.error ? null : care.data || []; CL.careErr = care.error?.message || "";
    CL.rx = {}; (rxs.data || []).forEach((r) => (CL.rx[r.patient_id] = CL.rx[r.patient_id] || []).push({ ...r.data, id: r.id, created: r.created_at, seen: !!r.seen_at }));
    CL.patients = (ps.data || []).map((x, i) => ({ phone: x.id, uid: x.id, tel: x.phone || "–", name: x.full_name || "(ไม่ระบุชื่อ)", age: x.age, sex: x.sex, cloud: true,
      code: (x.full_name || "?").replace(/^(คุณ|นาย|นาง(สาว)?)\s*/, "").slice(0, 2), tone: ["blue", "salmon", "green", "lav", "yellow"][i % 5] }));
  }
  async function loadCloudDash() {
    const sb = await cloud(), since = addDays(todayISO(), -120);
    const res = await Promise.all([
      sb.from("profiles").select("id, full_name, age, sex, height, created_at").eq("role", "patient"),
      sb.from("v_exercise_logs").select("user_id, day, name, type, minutes").gte("day", since).limit(20000),
      sb.from("v_body_records").select("user_id, day, weight, waist, fat, visc, height").order("day").limit(20000),
      sb.from("v_fitness_tests").select("user_id, day, chair30, tug, sls").order("day").limit(20000),
      sb.from("usage_events").select("user_id, day, kind, count").gte("day", since).limit(20000),
      sb.from("user_data").select("user_id, key, value").in("key", ["riskInput", "consults", "logs"])]);
    const bad = res.find((r) => r.error); if (bad) throw bad.error;
    const [pr, lg, bd, ft, ev, ud] = res.map((r) => r.data || []);
    const P = A().PROGRAMS || {}, nameCat = {}; Object.entries(P).forEach(([k, v]) => v.list.forEach((e) => (nameCat[e.n] = k)));
    const known = new Set(["aerobic", "strength", "flex", "balance", "game"]);
    const days = {}, dayOf = (d) => (days[d] = days[d] || { users: new Set(), sessions: 0, views: {} });
    ev.forEach((e) => { const o = dayOf(e.day); o.users.add(e.user_id); if (e.kind === "session") o.sessions += e.count; else if (e.kind.startsWith("view:")) { const k = e.kind.slice(5); o.views[k] = (o.views[k] || 0) + e.count; } });
    const logs = lg.map((l) => ({ date: l.day, user: l.user_id, cat: nameCat[l.name] || (known.has(l.type) ? l.type : "other"), name: l.name, minutes: Number(l.minutes) || 0 }));
    logs.forEach((l) => dayOf(l.date).users.add(l.user));
    const ri = {}, consults = [], imports = [], nameOf = {}; pr.forEach((x) => (nameOf[x.id] = x.full_name || "(ไม่ระบุชื่อ)"));
    ud.forEach((r) => { if (r.key === "logs" && Array.isArray(r.value)) r.value.filter((l) => l && l.source === "import" && !l.sample && nameOf[r.user_id]).forEach((l) => imports.push({ date: l.date, user: r.user_id, who: nameOf[r.user_id], name: l.name, type: l.type, minutes: Number(l.minutes) || 0 })); if (r.key === "riskInput") ri[r.user_id] = r.value || {}; if (r.key === "consults" && Array.isArray(r.value)) r.value.filter((c) => c.status === "done").forEach((c) => consults.push({ date: c.date, user: r.user_id })); });
    const group = (rows) => rows.reduce((m, r) => ((m[r.user_id] = m[r.user_id] || []).push(r), m), {});
    const B = group(bd), Fz = group(ft), num = (v) => (v == null || v === "" ? undefined : Number(v));
    const users = pr.map((x) => {
      const r = ri[x.id] || {}, b = B[x.id] || [], f = Fz[x.id] || [];
      const u = { id: x.id, age: r.age || x.age || 50, sex: r.sex || x.sex || "m", htn: !!r.htn, fh: !!r.fh, ht: num(b[b.length - 1]?.height) || r.ht || x.height || 160,
        join: (x.created_at || "").slice(0, 10), active: new Set(Object.entries(days).filter(([, o]) => o.users.has(x.id)).map(([d]) => d)) };
      const mk = (bb, ff) => (bb || ff ? { weight: num(bb?.weight), waist: num(bb?.waist), bmi: bb?.weight ? Number(bb.weight) / ((num(bb.height) || u.ht) / 100) ** 2 : undefined, fat: num(bb?.fat), visc: num(bb?.visc),
        risk: bb?.weight && bb?.waist ? riskScore(u, Number(bb.weight), Number(bb.waist)) : undefined, chair30: num(ff?.chair30), tug: num(ff?.tug), sls: num(ff?.sls) } : null);
      if (b.length || f.length) { u.base = mk(b[0], f[0]); u.last = mk(b[b.length - 1], f[f.length - 1]); }
      return u;
    });
    CL.dash = { users, days, logs, consults, imports, sample: false, cloud: true }; CL.at = new Date();
  }
  const dashData = () => (AD.src === "sample" ? sampleData() : AD.src === "cloud" ? CL.dash : localData());

  /* =====================================================================
     ADMIN LOGIN
     ===================================================================== */
  const ADMINS = [
    { user: "admin", pin: "1234", name: "ผู้ดูแลระบบ (บัญชีทดลอง)", role: "ผู้ดูแลระบบ" },
    { user: "pt01", pin: "1234", name: "กภ. นภัสสร (บัญชีทดลอง)", role: "นักกายภาพบำบัด" },
  ];
  const adminSession = () => store().get("adminSession", null);
  // step 2 of the real-account login: enter the code from the email
  function renderOtp(email) {
    const f = $("#apCloudF"); if (!f) return;
    f.outerHTML = `<form id="apOtpF" class="form ap-cloud ap-otp" novalidate><h3>🔒 ยืนยันตัวตนด้วยรหัส OTP</h3><div class="ap-steps" aria-hidden="true"><span>1 รหัสผ่าน ✓</span><span class="on">2 รหัส OTP</span></div>
      <p class="ap-otp-to">ส่งรหัสไปที่ <b>${maskEmail(email)}</b> แล้ว กรุณาเปิดอีเมล (หมดอายุภายใน 1 ชั่วโมง)</p>
      <p class="ap-otp-how"><b>ถ้าอีเมลเป็นปุ่ม/ลิงก์ “Sign in”</b> ให้กดลิงก์นั้นบนเครื่องที่จะใช้งาน ระบบจะเข้าสู่ระบบให้เอง ไม่ต้องกรอกรหัส<br><b>ถ้าอีเมลมีรหัสตัวเลข</b> ให้กรอกด้านล่าง</p>
      <label>รหัส OTP<input id="apOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••"></label>
      <p class="form-error" id="apOtpErr" role="alert" hidden></p>
      <button class="btn primary" type="submit" id="apOtpGo">ยืนยันและเข้าสู่ระบบ</button>
      <div class="ap-otp-row"><button type="button" id="apOtpBack">← เปลี่ยนบัญชี</button><button type="button" id="apOtpResend" disabled>ส่งรหัสอีกครั้ง</button></div>
      <small class="hint">ไม่เห็นอีเมล? ดูในโฟลเดอร์จดหมายขยะ · อย่าบอกรหัสนี้กับใคร เจ้าหน้าที่จะไม่ขอรหัสนี้</small></form>`;
    const inp = $("#apOtp"), er = $("#apOtpErr"), go = $("#apOtpGo"), rs = $("#apOtpResend"); inp.focus();
    let left = 60, t = null; const tick = () => { rs.disabled = left > 0; rs.textContent = left > 0 ? `ส่งรหัสอีกครั้ง (${left})` : "ส่งรหัสอีกครั้ง"; if (left-- <= 0) clearInterval(t); };
    const cool = () => { left = 60; clearInterval(t); tick(); t = setInterval(tick, 1000); }; cool();
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 8); });
    $("#apOtpF").addEventListener("submit", async (e) => {
      e.preventDefault(); er.hidden = true; const code = inp.value.trim();
      if (!/^\d{6,8}$/.test(code)) { er.textContent = "กรอกรหัส OTP ให้ครบ"; er.hidden = false; inp.focus(); return; }
      go.disabled = true; go.textContent = "กำลังยืนยัน…";
      try { await cloudLoginStep2(email, code); clearInterval(t); AD.src = "cloud"; boot(); }
      catch (x) { er.textContent = authMsg(x); er.hidden = false; go.disabled = false; go.textContent = "ยืนยันและเข้าสู่ระบบ"; inp.select(); }
    });
    rs.addEventListener("click", async () => { er.hidden = true; rs.disabled = true;
      try { await sendOtp(email); cool(); toast("ส่งรหัสใหม่แล้ว"); } catch (x) { er.textContent = authMsg(x); er.hidden = false; rs.disabled = false; } });
    $("#apOtpBack").addEventListener("click", () => { clearInterval(t); renderLogin(); });
  }
  function renderLogin() {
    document.body.classList.add("ap-locked");
    $("#apApp").innerHTML = `<section class="card ap-login">
      <div class="ap-brand big">pre<b>DM</b> <span>ADMIN</span></div><p class="ap-pl">Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา)</p>
      <h1>เข้าสู่ระบบผู้ดูแล</h1><p class="lede">สำหรับผู้ดูแลระบบและนักกายภาพบำบัด ดูภาพรวมการใช้งานและกำหนดโปรแกรมออกกำลังกายให้ผู้ป่วย</p>
      <form id="apLoginF" class="form" novalidate>
        <label>ชื่อผู้ใช้<input id="apUser" autocomplete="username" placeholder="admin"></label>
        <label>รหัส PIN<input id="apPin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••"></label>
        <p class="form-error" id="apLoginErr" role="alert" hidden></p>
        <button class="btn primary" type="submit">เข้าสู่ระบบ</button>
      </form>
      <div class="ap-demo"><small>บัญชีทดลอง (PIN 1234)</small>${ADMINS.map((a, i) => `<button type="button" class="demo" data-acc="${i}"><span class="code ${i ? "green" : "blue"}">${i ? "PT" : "AD"}</span><span><b>${a.name}</b><small>${a.user} · ${a.role}</small></span></button>`).join("")}</div>
      ${CL.on ? `<form id="apCloudF" class="form ap-cloud" novalidate><h3>☁️ บัญชีจริง (ฐานข้อมูล)</h3><div class="ap-steps" aria-hidden="true"><span class="on">1 รหัสผ่าน</span><span>2 รหัส OTP</span></div>
        <label>อีเมล<input id="apEmail" type="email" autocomplete="username" placeholder="physio@example.com"></label>
        <label>รหัสผ่าน<input id="apPass" type="password" autocomplete="current-password"></label>
        <p class="form-error" id="apCloudErr" role="alert" hidden></p>
        <button class="btn primary" type="submit" id="apCloudGo">ถัดไป: ส่งรหัส OTP ทางอีเมล</button>
        <small class="hint">🔒 ยืนยัน 2 ขั้น: รหัสผ่าน + รหัส OTP ที่ส่งไปทางอีเมล · ใช้บัญชีที่มีบทบาท physio หรือ admin</small></form>
      <details class="ap-signup" id="apSignup"><summary>🆕 ยังไม่มีบัญชี? สมัครบัญชีผู้ดูแล / เจ้าหน้าที่</summary>
        <form id="apSignF" class="form" novalidate>
          <label>ชื่อ-นามสกุล<input id="apSName" autocomplete="name"></label>
          <label>อีเมล<input id="apSEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>
          <label>ตั้งรหัสผ่าน (อย่างน้อย 8 ตัว)<input id="apSPass" type="password" autocomplete="new-password" minlength="8"></label>
          <label>พิมพ์รหัสผ่านอีกครั้ง<input id="apSPass2" type="password" autocomplete="new-password"></label>
          <label class="ap-check"><input type="checkbox" id="apSConsent"><span>ยินยอมให้เก็บชื่อและอีเมลเพื่อใช้ยืนยันตัวตน (<a href="index.html#privacy" target="_blank" rel="noopener">นโยบาย PDPA</a>)</span></label>
          <p class="form-error" id="apSignErr" role="alert" hidden></p>
          <p class="ap-ok" id="apSignOk" role="status" hidden></p>
          <button class="btn primary" type="submit" id="apSignGo">สมัครบัญชี</button>
          <small class="hint">หลังสมัคร บัญชีจะยังเข้าหน้าผู้ดูแลไม่ได้ จนกว่าเจ้าของระบบจะกำหนดสิทธิ์เป็น admin หรือ physio ให้</small>
        </form></details>` : ""}
      <p class="ap-warn">${CL.on ? "บัญชีทดลองด้านบนใช้ข้อมูลตัวอย่างในเบราว์เซอร์เท่านั้น" : "ระบบล็อกอินนี้เป็นแบบทดลองในเบราว์เซอร์ ก่อนใช้งานจริงต้องเชื่อมระบบยืนยันตัวตนและฐานข้อมูลฝั่งเซิร์ฟเวอร์"}</p>
      <a class="link" href="index.html">← กลับไปหน้าแอปผู้ใช้</a> · <a class="link" href="manual.html#staff" target="_blank" rel="noopener">📘 คู่มือสำหรับผู้ดูแล</a>
    </section>`;
    $("#apLoginF").addEventListener("submit", (e) => {
      e.preventDefault(); const u = $("#apUser").value.trim().toLowerCase(), p = $("#apPin").value, a = ADMINS.find((x) => x.user === u);
      const err = $("#apLoginErr"); if (!a || a.pin !== p) { err.textContent = "ชื่อผู้ใช้หรือรหัส PIN ไม่ถูกต้อง"; err.hidden = false; return; }
      store().set("adminSession", { user: a.user, name: a.name, role: a.role, at: Date.now() }); boot();
    });
    $("#apCloudF")?.addEventListener("submit", async (e) => {
      e.preventDefault(); const er = $("#apCloudErr"), go = $("#apCloudGo"); er.hidden = true;
      const email = $("#apEmail").value.trim(), pass = $("#apPass").value;
      if (!email || !pass) { er.textContent = "กรอกอีเมลและรหัสผ่าน"; er.hidden = false; return; }
      go.disabled = true; go.textContent = "กำลังตรวจสอบและส่งรหัส…";
      try { await cloudLoginStep1(email, pass); renderOtp(email); }
      catch (x) { er.textContent = authMsg(x); er.hidden = false; go.disabled = false; go.textContent = "ถัดไป: ส่งรหัส OTP ทางอีเมล"; }
    });
    $("#apSignF")?.addEventListener("submit", async (e) => {
      e.preventDefault(); const er = $("#apSignErr"), ok = $("#apSignOk"), go = $("#apSignGo"); er.hidden = true; ok.hidden = true;
      const fail = (m) => { er.textContent = m; er.hidden = false; };
      const full_name = $("#apSName").value.trim(), email = $("#apSEmail").value.trim(), pass = $("#apSPass").value;
      if (!full_name) return fail("กรอกชื่อ-นามสกุล");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("อีเมลไม่ถูกต้อง");
      if (pass.length < 8) return fail("รหัสผ่านต้องยาวอย่างน้อย 8 ตัว");
      if (pass !== $("#apSPass2").value) return fail("รหัสผ่านสองช่องไม่ตรงกัน");
      if (!$("#apSConsent").checked) return fail("กรุณาติ๊กยินยอมก่อนสมัคร");
      go.disabled = true; go.textContent = "กำลังสมัคร…";
      try {
        const sb = await cloud(); if (!sb) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name, consent: "true" }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data?.user && !(data.user.identities || []).length) throw new Error("already registered");
        const needConfirm = !data?.session; if (data?.session) await sb.auth.signOut();
        ok.innerHTML = "✅ สมัครสำเร็จ<br>" + (needConfirm ? "1) เปิดอีเมลแล้วกดลิงก์ยืนยัน<br>2) " : "1) ") + "ให้เจ้าของระบบกำหนดสิทธิ์ admin (รันไฟล์ setup-all.sql ใน Supabase)<br>" + (needConfirm ? "3) " : "2) ") + "กลับมาเข้าสู่ระบบที่ช่อง “บัญชีจริง” ด้านบน";
        ok.hidden = false; $("#apSignF").reset(); $("#apEmail").value = email; go.textContent = "สมัครแล้ว";
      } catch (x) { const m = String(x?.message || x); fail(/already registered/i.test(m) ? "อีเมลนี้มีบัญชีอยู่แล้ว ใช้ช่อง “บัญชีจริง” ด้านบนเข้าสู่ระบบได้เลย" : /rate limit/i.test(m) ? "ส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่" : /database error/i.test(m) ? "ฐานข้อมูลยังไม่ได้ติดตั้งตาราง กรุณารันไฟล์ setup-all.sql ใน Supabase ก่อน แล้วสมัครใหม่" : authMsg(x)); go.disabled = false; go.textContent = "สมัครบัญชี"; }
    });
    $$("[data-acc]").forEach((b) => b.addEventListener("click", () => { const a = ADMINS[+b.dataset.acc]; $("#apUser").value = a.user; $("#apPin").value = a.pin; $("#apPin").focus(); }));
  }

  /* =====================================================================
     PATIENTS & PRESCRIPTIONS
     ===================================================================== */
  const PROBLEMS = {
    "ภาวะก่อนเบาหวาน / น้ำตาลสูง": { add: [["aerobic", "เดินเร็ว"], ["aerobic", "เดินหลังอาหาร"], ["strength", "สควอทโดยใช้เก้าอี้"], ["strength", "วิดพื้นกับผนัง"], ["strength", "ดึงยางยืด"]], caution: ["ถ้าใช้ยาลดน้ำตาลหรืออินซูลิน ตรวจน้ำตาลก่อน-หลังออกกำลังกาย และพกลูกอมติดตัว"] },
    "น้ำหนักเกิน / อ้วนลงพุง": { add: [["aerobic", "เดินเร็ว"], ["aerobic", "ย่ำเท้ายกเข่า"], ["aerobic", "ปั่นจักรยาน"], ["strength", "สควอทโดยใช้เก้าอี้"], ["strength", "ยกสะโพก"]], caution: ["เพิ่มเวลาออกกำลังกายทีละน้อย ไม่เกินสัปดาห์ละ 10%"] },
    "ความดันโลหิตสูง": { add: [["aerobic", "เดินเร็ว"], ["aerobic", "ปั่นจักรยาน"], ["flex", "ยืดอก"], ["flex", "ยืดคอ"]], caution: ["ไม่กลั้นหายใจขณะออกแรง หลีกเลี่ยงท่าค้างเกร็งนานและท่าก้มศีรษะต่ำกว่าหัวใจ", "งดออกกำลังกายวันที่ความดันตั้งแต่ 180/110 มม.ปรอท ขึ้นไป"] },
    "ปวดเข่า / ข้อเข่าเสื่อม": { add: [["balance", "เตะขาไปด้านหน้า"], ["balance", "กางขาไปด้านข้าง"], ["balance", "งอเข่าไปด้านหลัง"], ["flex", "ยืดน่อง"], ["flex", "ยืดต้นขาด้านหน้า"], ["flex", "ยืดเอ็นหลังเข่า"], ["aerobic", "ปั่นจักรยาน"]], avoid: ["สควอทโดยใช้เก้าอี้", "เดินขึ้น-ลงบันได", "ท่าซ้อนกุ้ง", "ย่ำเท้ายกเข่า"], caution: ["หลีกเลี่ยงการย่อเข่าลึก กระโดด และขึ้น-ลงบันไดบ่อย", "ถ้าปวดเพิ่มนานเกิน 2 ชั่วโมงหลังฝึก ให้ลดจำนวนครั้งลง"] },
    "ปวดหลังส่วนล่าง": { add: [["flex", "ยืดหลังส่วนล่าง"], ["flex", "ยืดเอ็นหลังเข่า"], ["strength", "ยกสะโพก"], ["pakhaoma", "ยืดกล้ามเนื้อหลัง"], ["aerobic", "เดินเร็ว"]], avoid: ["ท่าดำนา", "กางแขนแตะขา"], caution: ["หลีกเลี่ยงการก้มยกของหนักและการก้มแตะปลายเท้าแบบกระแทก", "หยุดถ้ามีอาการชาร้าวลงขา"] },
    "ปวดคอ บ่า ไหล่": { add: [["flex", "ยืดคอ"], ["flex", "ยืดต้นแขน"], ["flex", "ยืดอก"], ["flex", "ยืดหลังส่วนบน"], ["pakhaoma", "ยกไหล่"], ["pakhaoma", "ยืดกล้ามเนื้อคอ"], ["thai", "ท่ายักไหล่"]], caution: ["ยืดช้า ๆ ไม่หมุนคอเร็ว หยุดถ้ามีอาการชาร้าวลงแขน"] },
    "ข้อไหล่ติด": { add: [["pakhaoma", "ยกเหยียด"], ["pakhaoma", "กางแขนบิดตัว"], ["pakhaoma", "ยืดกล้ามเนื้อหัวไหล่"], ["flex", "ยืดต้นแขน"], ["thai", "ท่าบัวตูมบัวบาน"]], caution: ["ยกแขนเท่าที่ไม่เจ็บ เพิ่มองศาทีละน้อยทุกวัน"] },
    "ทรงตัวไม่ดี / เสี่ยงหกล้ม": { add: [["balance", "เขย่งส้นเท้าขึ้น"], ["balance", "ยืนต่อเท้า"], ["balance", "เดินต่อเท้า"], ["balance", "ยืนขาเดียว"], ["balance", "เดินไปด้านข้าง"], ["balance", "นั่งแล้วลุกขึ้นยืน"]], avoid: ["ท่าซ้อนกุ้ง", "ท่านกขมิ้น"], caution: ["ฝึกข้างโต๊ะหรือเก้าอี้ที่มั่นคงเสมอ ช่วงแรกควรมีคนดูแลอยู่ใกล้"] },
    "ชาปลายเท้า / ปลายประสาทเสื่อม": { add: [["balance", "กระดกปลายเท้าขึ้น"], ["balance", "เขย่งส้นเท้าขึ้น"], ["balance", "ยืนต่อเท้า"], ["flex", "ยืดน่อง"], ["aerobic", "ปั่นจักรยาน"], ["pakhaoma", "บิดข้อมือ"]], avoid: ["ย่ำเท้ายกเข่า"], caution: ["สวมรองเท้าที่พอดีขณะฝึก ตรวจเท้าทุกวันว่ามีแผลหรือไม่", "หลีกเลี่ยงการกระโดดและการเดินเท้าเปล่า"] },
    "ผู้สูงอายุ / กล้ามเนื้อขาอ่อนแรง": { add: [["balance", "เตะขาไปด้านหน้า"], ["balance", "งอเข่าไปด้านหลัง"], ["balance", "กางขาไปด้านข้าง"], ["balance", "เขย่งส้นเท้าขึ้น"], ["balance", "นั่งแล้วลุกขึ้นยืน"], ["aerobic", "เดินเร็ว"]], caution: ["เริ่มจากจำนวนครั้งน้อย จับโต๊ะ 2 มือ แล้วค่อยเพิ่มระดับความยาก"] },
  };
  const DEFAULT_PROBS = { PRE: ["ภาวะก่อนเบาหวาน / น้ำตาลสูง"], OB: ["น้ำหนักเกิน / อ้วนลงพุง", "ปวดเข่า / ข้อเข่าเสื่อม"], HT: ["ความดันโลหิตสูง", "ทรงตัวไม่ดี / เสี่ยงหกล้ม"], FH: ["ภาวะก่อนเบาหวาน / น้ำตาลสูง", "ปวดหลังส่วนล่าง"] };
  const ORDER = ["flex", "pakhaoma", "thai", "isan", "aerobic", "strength", "balance"];
  const PROGS = () => A().PROGRAMS;
  function findEx(cat, name) { const L = PROGS()[cat]?.list || []; const i = L.findIndex((e) => e.n === name); return i < 0 ? null : { cat, idx: i, e: L[i] }; }
  function defTarget(e) { // mirrors the patient app's dose parser
    const dose = e.dose || "";
    if (e.track === "balance") { const t = dose.match(/(\d+)(?:–(\d+))?\s*(?:วิ|วินาที)/); return { kind: "secs", val: t ? +(t[2] || t[1]) : 30, sets: 1 }; }
    { const g = dose.match(/(\d+)\s*(?:ก้าว|รอบ)/); if (g && !/ครั้ง|วิ|นาที/.test(dose)) return { kind: "reps", val: +g[1], sets: 1 }; }
    let sets = 1; const ms = dose.match(/(\d+)(?:–\d+)?\s*(?:เซต|รอบ)/); if (ms) sets = Math.min(3, +ms[1]);
    const mr = dose.match(/(\d+)(?:–(\d+))?\s*ครั้ง/), mt = dose.match(/(\d+)(?:–(\d+))?\s*(?:วิ|วินาที)/), mm = dose.match(/(\d+)(?:–(\d+))?\s*นาที/);
    if (/ค้าง/.test(dose) && mt) return { kind: "secs", val: +(mt[2] || mt[1]), sets };
    if (mr) return { kind: "reps", val: +(mr[2] || mr[1]), sets };
    if (mt) return { kind: "secs", val: +(mt[2] || mt[1]), sets };
    if (mm) return { kind: "secs", val: Math.min(60 * +(mm[2] || mm[1]), 1800), sets };
    return { kind: "secs", val: Math.max(30, (e.m || 1) * 60), sets: 1 };
  }
  const mkItem = (cat, idx) => { const e = PROGS()[cat].list[idx]; return { cat, idx, n: e.n, ...defTarget(e), note: "" }; };
  function thumb(cat, idx) {
    const e = PROGS()[cat]?.list[idx]; if (!e) return "";
    if (e.img) return `<img src="${e.img}" alt="" loading="lazy">`;
    try { return A().fig(A().P[e.p], e.fx || "", idx, { noBlob: true }); } catch { return ""; }
  }
  const rxAll = () => (isCloud() ? CL.rx : store().get("rx", {}));
  const meta = () => store().get("adminPatientMeta", {});
  function patients() {
    const m = meta(), extra = store().get("adminPatients", []);
    if (isCloud()) return (CL.patients || []).map((x) => ({ ...x, problems: m[x.phone]?.problems ?? [] }));
    const base = (A().DEMO || []).map((d) => ({ phone: d.phone, name: d.name, age: d.age, sex: d.sex, tag: d.tag, code: d.code, tone: d.tone, demo: true }));
    return [...base, ...extra].map((p) => ({ ...p, problems: m[p.phone]?.problems ?? DEFAULT_PROBS[p.code] ?? p.problems ?? [] }));
  }
  const RX = { sel: null, draft: null, cat: "flex", q: "", link: "" };
  function newDraft(p) {
    const cur = (rxAll()[p.phone] || [])[0];
    if (cur) return JSON.parse(JSON.stringify({ ...cur, id: null }));
    return { id: null, name: "โปรแกรมเฉพาะบุคคล", problems: [...p.problems], items: [], freq: 3, weeks: 4, rest: 15, note: "", cautions: [] };
  }
  function suggest() {
    const d = RX.draft, avoid = new Set(), picks = [], seen = new Set(), cautions = [];
    d.problems.forEach((pr) => { const r = PROBLEMS[pr]; if (!r) return; (r.avoid || []).forEach((n) => avoid.add(n)); (r.caution || []).forEach((c) => cautions.includes(c) || cautions.push(c)); });
    d.problems.forEach((pr) => (PROBLEMS[pr]?.add || []).forEach(([cat, n]) => { if (avoid.has(n) || seen.has(n)) return; const f = findEx(cat, n); if (f) { seen.add(n); picks.push(f); } }));
    picks.sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat));
    d.items = picks.slice(0, 12).map((f) => mkItem(f.cat, f.idx)); d.cautions = cautions;
    if (!d.name || d.name === "โปรแกรมเฉพาะบุคคล") d.name = "โปรแกรม" + (d.problems[0] ? d.problems[0].split(" /")[0] : "เฉพาะบุคคล");
    return { avoid: [...avoid] };
  }
  const avoidList = () => [...new Set(RX.draft.problems.flatMap((pr) => PROBLEMS[pr]?.avoid || []))];

  function renderPatients() {
    if (isCloud() && !CL.patients) {
      $("#apPanel").innerHTML = `<div class="card"><p class="lede">⏳ กำลังโหลดรายชื่อผู้ป่วยจากฐานข้อมูล…</p></div>`;
      if (!CL.loadingP) { CL.loadingP = true; loadCloudPatients().then(() => { CL.loadingP = false; renderPatients(); }).catch((e) => { CL.loadingP = false; $("#apPanel").innerHTML = `<div class="card"><p class="form-error">โหลดรายชื่อผู้ป่วยไม่สำเร็จ: ${esc(e.message || e)}</p><button class="btn sm" type="button" data-prefresh>ลองใหม่</button></div>`; }); }
      return;
    }
    if (isCloud() && !CL.patients.length) { $("#apPanel").innerHTML = `<div class="card">${isCloudAdmin() ? `<h2>ยังไม่มีผู้ป่วยในฐานข้อมูล</h2><p class="lede">ผู้ป่วยสมัครบัญชีเองในแอป (หน้าเข้าสู่ระบบ → ☁️ บัญชีจริง) แล้วจะแสดงที่นี่</p>` : `<h2>ยังไม่มีผู้ป่วยที่มอบหมายให้คุณ</h2><p class="lede">ผู้ดูแลระบบต้องมอบหมายผู้ป่วยให้คุณก่อน (หน้า “ผู้ป่วยและโปรแกรม” → นักกายภาพผู้ดูแล) แล้วกดรีเฟรช</p>`}<button class="btn sm" type="button" data-prefresh>🔄 รีเฟรช</button></div>`; return; }
    const root = $("#apPanel"), list = patients(), all = rxAll();
    if (!RX.sel || !list.some((p) => p.phone === RX.sel)) RX.sel = list[0]?.phone;
    const p = list.find((x) => x.phone === RX.sel);
    if (p && (!RX.draft || RX.draft._for !== p.phone)) { RX.draft = { ...newDraft(p), _for: p.phone }; RX.link = ""; }
    const q = RX.q.trim();
    root.innerHTML = `<div class="ap-pgrid">
      <aside class="card ap-plist">
        <div class="card-head"><h2>ผู้ป่วย <small>${list.length} คน</small></h2>${isCloud() ? `<button class="btn sm" type="button" data-prefresh>🔄 รีเฟรช</button>` : `<button class="btn sm" type="button" data-pnew>+ เพิ่มผู้ป่วย</button>`}</div>
        <input class="ap-search" id="apQ" placeholder="ค้นหาชื่อหรือเบอร์โทร" value="${esc(RX.q)}" aria-label="ค้นหาผู้ป่วย">
        <div class="ap-prows">${list.filter((x) => !q || x.name.includes(q) || x.phone.includes(q)).map((x) => { const r = (all[x.phone] || [])[0];
          return `<button type="button" class="ap-prow" aria-pressed="${x.phone === RX.sel}" data-psel="${x.phone}"><span class="code ${x.tone || "lav"}">${esc(x.code || x.name.slice(0, 2))}</span>
            <span><b>${esc(x.name)}</b><small>${x.tel ?? x.phone} · ${x.age || "–"} ปี ${x.sex === "f" ? "หญิง" : "ชาย"}</small><small class="probs">${x.problems.slice(0, 2).map(esc).join(" · ") || "ยังไม่ระบุปัญหา"}</small></span>
            <i class="${r ? "on" : ""}">${r ? "มีโปรแกรม" : "ยังไม่มี"}</i>${isCloudAdmin() && CL.care ? `<em class="ap-care ${careOf(x.phone).length ? "" : "none"}">${careOf(x.phone).length ? "👤 " + careOf(x.phone).map((c) => esc(staffName(c))).join(", ") : "ยังไม่มีนักกายภาพ"}</em>` : ""}</button>`; }).join("")}</div>
        <form class="ap-pnew" id="apPNew" hidden novalidate>
          <h3>เพิ่มผู้ป่วยใหม่</h3>
          <label>ชื่อ-สกุล<input id="npName" required></label>
          <div class="row2"><label>เบอร์โทร<input id="npPhone" inputmode="numeric" maxlength="10" placeholder="08xxxxxxxx"></label><label>อายุ<input id="npAge" type="number" min="18" max="100"></label></div>
          <label>เพศ<select id="npSex"><option value="f">หญิง</option><option value="m">ชาย</option></select></label>
          <p class="form-error" id="npErr" hidden></p>
          <div class="btns"><button class="btn primary sm" type="submit">บันทึก</button><button class="btn sm" type="button" data-pcancel>ยกเลิก</button></div>
        </form>
      </aside>
      <section class="card ap-rx">${p ? rxEditor(p) : `<p class="lede">เลือกผู้ป่วยทางซ้าย</p>`}</section>
    </div>`;
  }
  function rxEditor(p) {
    const d = RX.draft, hist = rxAll()[p.phone] || [], av = avoidList(), cats = Object.entries(PROGS());
    const lib = PROGS()[RX.cat].list;
    const estMin = Math.max(1, Math.round((d.items.reduce((t, it) => t + (it.kind === "secs" ? it.val : it.val * 3) * it.sets, 0) + d.rest * Math.max(0, d.items.length - 1)) / 60));
    return `
      <div class="card-head"><div><h2>${esc(p.name)}</h2><p class="lede">${p.tel ?? p.phone} · ${p.age || "–"} ปี · ${p.sex === "f" ? "หญิง" : "ชาย"}${p.tag ? " · " + esc(p.tag) : ""}</p></div>
        ${hist.length ? `<span class="pill">ฉบับล่าสุด ${thDate(hist[0].created.slice(0, 10))}</span>` : `<span class="pill demo">ยังไม่มีโปรแกรม</span>`}</div>
      ${isCloudAdmin() ? careBlock(p) : ""}
      <h3 class="ap-h">1. ปัญหา / อาการของผู้ป่วย</h3>
      <div class="ap-probs">${Object.keys(PROBLEMS).map((pr) => `<label class="cs-chk"><input type="checkbox" data-prob="${esc(pr)}" ${d.problems.includes(pr) ? "checked" : ""}><span>${pr}</span></label>`).join("")}</div>
      <button class="btn sm primary" type="button" data-suggest>✨ แนะนำท่าตามปัญหา</button>
      ${av.length ? `<p class="ap-avoid">🚫 ควรหลีกเลี่ยง: ${av.map(esc).join(", ")}</p>` : ""}
      <h3 class="ap-h">2. ท่าในโปรแกรม <small>${d.items.length} ท่า · ประมาณ ${estMin} นาที/ครั้ง</small></h3>
      <div class="ap-items">${d.items.length ? d.items.map((it, i) => { const bad = av.includes(it.n); return `<div class="ap-item ${bad ? "bad" : ""}">
          <span class="ap-no">${i + 1}</span><span class="ap-th">${thumb(it.cat, it.idx)}</span>
          <span class="ap-in"><b>${esc(it.n)}</b><small>${PROGS()[it.cat]?.label || it.cat}${bad ? " · ⚠️ อยู่ในรายการควรหลีกเลี่ยง" : ""}</small>
            <input data-f="note" data-i="${i}" value="${esc(it.note || "")}" placeholder="หมายเหตุถึงผู้ป่วย เช่น ทำช้า ๆ ไม่ต้องย่อลึก" aria-label="หมายเหตุท่า ${esc(it.n)}"></span>
          <span class="ap-dose"><input type="number" min="1" max="1800" data-f="val" data-i="${i}" value="${it.val}" aria-label="จำนวน">
            <select data-f="kind" data-i="${i}" aria-label="หน่วย"><option value="reps" ${it.kind === "reps" ? "selected" : ""}>ครั้ง</option><option value="secs" ${it.kind === "secs" ? "selected" : ""}>วินาที</option></select>
            × <select data-f="sets" data-i="${i}" aria-label="จำนวนเซต">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${+it.sets === n ? "selected" : ""}>${n} เซต</option>`).join("")}</select></span>
          <span class="ap-mv"><button type="button" data-mv="-1" data-i="${i}" aria-label="เลื่อนขึ้น" ${i ? "" : "disabled"}>↑</button><button type="button" data-mv="1" data-i="${i}" aria-label="เลื่อนลง" ${i < d.items.length - 1 ? "" : "disabled"}>↓</button><button type="button" data-rm="${i}" aria-label="ลบท่า">✕</button></span>
        </div>`; }).join("") : `<div class="mine-empty">ยังไม่มีท่า กด “แนะนำท่าตามปัญหา” หรือเลือกจากคลังท่าด้านล่าง</div>`}</div>
      <details class="ap-lib" ${d.items.length ? "" : "open"}><summary>+ เพิ่มท่าจากคลังท่า</summary>
        <select id="apCat">${cats.map(([k, v]) => `<option value="${k}" ${k === RX.cat ? "selected" : ""}>${v.label} (${v.list.length})</option>`).join("")}</select>
        <div class="ap-libl">${lib.map((e, i) => `<div class="pick-row ${av.includes(e.n) ? "bad" : ""}"><span class="pick-fig">${thumb(RX.cat, i)}</span><span><b>${e.n}</b><small>${e.dose}${av.includes(e.n) ? " · ⚠️ ควรหลีกเลี่ยง" : ""}</small></span><button class="btn sm" type="button" data-add="${i}" ${d.items.some((x) => x.cat === RX.cat && x.idx === i) ? "disabled" : ""}>+ เพิ่ม</button></div>`).join("")}</div>
      </details>
      <h3 class="ap-h">3. รายละเอียดโปรแกรม</h3>
      <div class="ap-set">
        <label>ชื่อโปรแกรม<input id="rxName" value="${esc(d.name)}"></label>
        <label>ความถี่<select id="rxFreq">${[2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${+d.freq === n ? "selected" : ""}>${n} วัน/สัปดาห์</option>`).join("")}</select></label>
        <label>ระยะเวลา<select id="rxWeeks">${[2, 4, 6, 8, 12].map((n) => `<option value="${n}" ${+d.weeks === n ? "selected" : ""}>${n} สัปดาห์</option>`).join("")}</select></label>
        <label>พักระหว่างท่า<select id="rxRest">${[0, 10, 15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${+d.rest === n ? "selected" : ""}>${n ? n + " วินาที" : "ไม่พัก"}</option>`).join("")}</select></label>
      </div>
      <label class="ap-full">คำแนะนำถึงผู้ป่วย<textarea id="rxNote" rows="3" placeholder="เช่น ทำหลังตื่นนอนหรือเย็น ถ้าปวดเกิน 5/10 ให้หยุดและแจ้งนักกายภาพ">${esc(d.note || "")}</textarea></label>
      <div class="ap-cautions"><b>⚠️ ข้อควรระวังที่จะแสดงให้ผู้ป่วย</b>${d.cautions.length ? `<ul>${d.cautions.map((c, i) => `<li>${esc(c)} <button type="button" class="link" data-crm="${i}" aria-label="ลบข้อควรระวัง">ลบ</button></li>`).join("")}</ul>` : `<p class="lede">— กด “แนะนำท่าตามปัญหา” เพื่อเติมอัตโนมัติ หรือเพิ่มเอง —</p>`}
        <div class="ap-cadd"><input id="rxCaution" placeholder="เพิ่มข้อควรระวัง"><button class="btn sm" type="button" data-cadd>เพิ่ม</button></div></div>
      <p class="form-error" id="rxErr" role="alert" hidden></p>
      <div class="ap-save"><button class="btn primary" type="button" data-save>💾 บันทึกและมอบหมายให้ผู้ป่วย</button><button class="btn" type="button" data-reset>ล้างฟอร์ม</button></div>
      ${RX.link === "cloud" ? `<div class="ap-share"><b>✅ ส่งโปรแกรมถึงผู้ป่วยแล้ว</b><p>บันทึกลงฐานข้อมูลเรียบร้อย ผู้ป่วยจะเห็นที่แท็บ “🩺 จากนักกายภาพ” เมื่อเปิดแอป (อัปเดตทุก 2 นาที) ไม่ต้องส่งลิงก์</p></div>` : RX.link ? `<div class="ap-share"><b>✅ มอบหมายแล้ว</b><p>ถ้าผู้ป่วยใช้แอปในเบราว์เซอร์เครื่องนี้ จะเห็นโปรแกรมทันทีที่แท็บ “🩺 จากนักกายภาพ” · ถ้าใช้เครื่องอื่น ส่งลิงก์นี้ให้ผู้ป่วยเปิด (เช่น ทาง LINE)</p>
        <div class="cs-link"><input readonly value="${esc(RX.link)}" id="rxLink" aria-label="ลิงก์โปรแกรมสำหรับผู้ป่วย"><button class="btn sm primary" type="button" data-copy>คัดลอกลิงก์</button></div></div>` : ""}
      ${hist.length ? `<details class="ap-hist"><summary>ประวัติโปรแกรม (${hist.length})</summary>${hist.map((h, i) => `<div class="ap-hrow"><b>${esc(h.name)}</b><small>${thDate(h.created.slice(0, 10))} · ${h.items.length} ท่า · ${h.freq} วัน/สัปดาห์ · โดย ${esc(h.by || "-")}${i === 0 ? " · ใช้งานอยู่" : ""}${h.seen ? " · 👁 ผู้ป่วยเปิดดูแล้ว" : ""}</small><button class="btn sm" type="button" data-hload="${i}">โหลดมาแก้ไข</button></div>`).join("")}</details>` : ""}`;
  }
  const careOf = (pid) => (CL.care || []).filter((c) => c.patient_id === pid).map((c) => c.physio_id);
  const staffName = (id) => (CL.staff || []).find((x) => x.id === id)?.full_name || "(ไม่ระบุชื่อ)";
  function careBlock(p) {
    if (!CL.care) return `<p class="form-error">ยังไม่มีตาราง care_team — รันไฟล์ supabase/care_team.sql ก่อน (${esc(CL.careErr)})</p>`;
    const mine = careOf(p.phone), others = (CL.staff || []).filter((x) => !mine.includes(x.id));
    return `<div class="ap-careblk"><b>👤 นักกายภาพผู้ดูแล</b> <small>เห็นข้อมูลและส่งโปรแกรมให้ผู้ป่วยคนนี้ได้</small>
      <div class="ap-chips">${mine.length ? mine.map((id) => `<span class="ap-chip">${esc(staffName(id))}<button type="button" data-unassign="${id}" aria-label="เลิกมอบหมาย ${esc(staffName(id))}">✕</button></span>`).join("") : `<span class="ap-chip none">ยังไม่ได้มอบหมาย — นักกายภาพจะยังไม่เห็นผู้ป่วยคนนี้</span>`}</div>
      ${others.length ? `<div class="ap-assign"><select id="apAssignSel" aria-label="เลือกนักกายภาพ">${others.map((x) => `<option value="${x.id}">${esc(x.full_name || "(ไม่ระบุชื่อ)")} · ${x.role === "admin" ? "ผู้ดูแล" : "นักกายภาพ"}</option>`).join("")}</select><button class="btn sm primary" type="button" data-assign>+ มอบหมาย</button></div>` : `<small class="hint">ไม่มีนักกายภาพเพิ่มเติม — ตั้งบทบาทได้ที่แท็บ “ทีมและสิทธิ์”</small>`}</div>`;
  }
  async function setCare(patientId, physioId, on) {
    const sb = await cloud(), me = adminSession()?.uid;
    const r = on ? await sb.from("care_team").insert({ physio_id: physioId, patient_id: patientId, assigned_by: me }) : await sb.from("care_team").delete().eq("physio_id", physioId).eq("patient_id", patientId);
    if (r.error) return toast("บันทึกไม่สำเร็จ: " + r.error.message);
    CL.care = on ? [...CL.care, { physio_id: physioId, patient_id: patientId }] : CL.care.filter((c) => !(c.physio_id === physioId && c.patient_id === patientId));
    toast(on ? `มอบหมายให้ ${staffName(physioId)} แล้ว` : `เลิกมอบหมาย ${staffName(physioId)} แล้ว`); renderPatients();
  }
  const b64url = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  function saveRx() {
    const d = RX.draft, err = $("#rxErr"), p = patients().find((x) => x.phone === RX.sel);
    d.name = $("#rxName").value.trim(); d.note = $("#rxNote").value.trim();
    if (!d.name || !d.items.length) { err.textContent = !d.name ? "กรุณาตั้งชื่อโปรแกรม" : "เพิ่มท่าอย่างน้อย 1 ท่า"; err.hidden = false; return; }
    const s = adminSession(), rx = { id: "rx" + Date.now(), phone: p.phone, patient: p.name, name: d.name, problems: d.problems, items: d.items.map(({ cat, idx, n, kind, val, sets, note }) => ({ cat, idx, n, kind, val: +val, sets: +sets, note })), freq: +d.freq, weeks: +d.weeks, rest: +d.rest, note: d.note, cautions: d.cautions, by: s?.name || "นักกายภาพบำบัด", start: todayISO(), created: new Date().toISOString() };
    if (isCloud()) {
      const btn = $("[data-save]"); btn.disabled = true; btn.textContent = "กำลังบันทึก…";
      CL.sb.from("prescriptions").insert({ patient_id: p.uid, physio_id: s.uid, data: rx }).select("id, created_at").single().then(({ data, error }) => {
        if (error) { err.textContent = "บันทึกไม่สำเร็จ: " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "💾 บันทึกและมอบหมายให้ผู้ป่วย"; return; }
        const saved = { ...rx, id: data.id, created: data.created_at }; CL.rx[p.uid] = [saved, ...(CL.rx[p.uid] || [])];
        const m2 = meta(); m2[p.phone] = { ...(m2[p.phone] || {}), problems: d.problems }; store().set("adminPatientMeta", m2);
        RX.link = "cloud"; RX.draft = { ...JSON.parse(JSON.stringify(saved)), id: null, _for: p.phone };
        renderPatients(); toast(`ส่งโปรแกรม “${rx.name}” ให้ ${p.name} แล้ว`); $(".ap-share")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    const all = rxAll(); all[p.phone] = [rx, ...(all[p.phone] || [])].slice(0, 10); store().set("rx", all);
    const m = meta(); m[p.phone] = { ...(m[p.phone] || {}), problems: d.problems }; store().set("adminPatientMeta", m);
    RX.link = `${location.origin}${location.pathname.replace(/admin\.html$/, "index.html")}#rx=${b64url(rx)}`;
    RX.draft = { ...JSON.parse(JSON.stringify(rx)), id: null, _for: p.phone };
    renderPatients(); toast(`มอบหมาย “${rx.name}” ให้ ${p.name} แล้ว`);
    $(".ap-share")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function initPatients() {
    const root = $("#apPanel");
    root.addEventListener("click", (e) => {
      if (APP.tab !== "patients") return;
      const t = (s) => e.target.closest(s), d = RX.draft;
      if (t("[data-prefresh]")) { CL.patients = null; RX.draft = null; return renderPatients(); }
      if (t("[data-assign]")) { const v = $("#apAssignSel")?.value; if (v) setCare(RX.sel, v, true); return; }
      if (t("[data-unassign]")) { setCare(RX.sel, t("[data-unassign]").dataset.unassign, false); return; }
      if (t("[data-psel]")) { RX.sel = t("[data-psel]").dataset.psel; RX.draft = null; return renderPatients(); }
      if (t("[data-pnew]")) { $("#apPNew").hidden = false; $("#npName").focus(); return; }
      if (t("[data-pcancel]")) { $("#apPNew").hidden = true; return; }
      if (t("[data-suggest]")) { if (!d.problems.length) return toast("เลือกปัญหาของผู้ป่วยอย่างน้อย 1 ข้อ"); suggest(); renderPatients(); return toast(`แนะนำ ${d.items.length} ท่าตามปัญหาแล้ว ปรับเพิ่ม/ลดได้`); }
      if (t("[data-add]")) { d.items.push(mkItem(RX.cat, +t("[data-add]").dataset.add)); return renderPatients(); }
      if (t("[data-rm]")) { d.items.splice(+t("[data-rm]").dataset.rm, 1); return renderPatients(); }
      if (t("[data-mv]")) { const i = +t("[data-mv]").dataset.i, j = i + +t("[data-mv]").dataset.mv; [d.items[i], d.items[j]] = [d.items[j], d.items[i]]; return renderPatients(); }
      if (t("[data-crm]")) { d.cautions.splice(+t("[data-crm]").dataset.crm, 1); return renderPatients(); }
      if (t("[data-cadd]")) { const v = $("#rxCaution").value.trim(); if (v) { d.cautions.push(v); renderPatients(); } return; }
      if (t("[data-save]")) return saveRx();
      if (t("[data-reset]")) { const p = patients().find((x) => x.phone === RX.sel); RX.draft = { id: null, name: "โปรแกรมเฉพาะบุคคล", problems: [...p.problems], items: [], freq: 3, weeks: 4, rest: 15, note: "", cautions: [], _for: p.phone }; RX.link = ""; return renderPatients(); }
      if (t("[data-hload]")) { const h = rxAll()[RX.sel][+t("[data-hload]").dataset.hload]; RX.draft = { ...JSON.parse(JSON.stringify(h)), id: null, _for: RX.sel }; RX.link = ""; return renderPatients(); }
      if (t("[data-copy]")) { navigator.clipboard?.writeText($("#rxLink").value).then(() => toast("คัดลอกลิงก์แล้ว"), () => $("#rxLink").select()); }
    });
    root.addEventListener("change", (e) => {
      if (APP.tab !== "patients") return;
      const d = RX.draft, el = e.target;
      if (el.dataset.prob) { const pr = el.dataset.prob; d.problems = el.checked ? [...d.problems, pr] : d.problems.filter((x) => x !== pr); return renderPatients(); }
      if (el.dataset.f) { const it = d.items[+el.dataset.i]; it[el.dataset.f] = el.dataset.f === "note" || el.dataset.f === "kind" ? el.value : Math.max(1, +el.value || 1); if (el.dataset.f !== "note") renderPatients(); return; }
      if (el.id === "apCat") { RX.cat = el.value; return renderPatients(); }
      if (el.id === "rxFreq") d.freq = +el.value; if (el.id === "rxWeeks") d.weeks = +el.value; if (el.id === "rxRest") { d.rest = +el.value; renderPatients(); }
      if (el.id === "rxName") d.name = el.value; if (el.id === "rxNote") d.note = el.value;
    });
    root.addEventListener("input", (e) => {
      if (e.target.id === "apQ") { RX.q = e.target.value; const pos = e.target.selectionStart; renderPatients(); const q = $("#apQ"); q.focus(); q.setSelectionRange(pos, pos); }
      if (e.target.id === "rxName") RX.draft.name = e.target.value; if (e.target.id === "rxNote") RX.draft.note = e.target.value;
      if (e.target.dataset?.f === "note") RX.draft.items[+e.target.dataset.i].note = e.target.value;
    });
    root.addEventListener("submit", (e) => {
      if (e.target.id !== "apPNew") return; e.preventDefault();
      const name = $("#npName").value.trim(), phone = $("#npPhone").value.replace(/\D/g, ""), age = +$("#npAge").value, err = $("#npErr");
      if (!name || !/^0\d{9}$/.test(phone)) { err.textContent = !name ? "กรุณากรอกชื่อ" : "เบอร์โทร 10 หลัก ขึ้นต้นด้วย 0"; err.hidden = false; return; }
      if (patients().some((p) => p.phone === phone)) { err.textContent = "มีผู้ป่วยเบอร์นี้แล้ว"; err.hidden = false; return; }
      store().set("adminPatients", [...store().get("adminPatients", []), { phone, name, age: age || null, sex: $("#npSex").value, problems: [], code: name.replace(/^(คุณ|นาย|นาง(สาว)?)\s*/, "").slice(0, 2), tone: "lav" }]);
      RX.sel = phone; RX.draft = null; renderPatients(); toast("เพิ่มผู้ป่วยแล้ว");
    });
  }

  /* =====================================================================
     TEAM & ROLES (admin only, cloud)
     ===================================================================== */
  const ROLE_TH = { patient: "ผู้ป่วย", physio: "นักกายภาพบำบัด", admin: "ผู้ดูแลระบบ" };
  const TM = { rows: null, care: [], q: "" };
  async function loadTeam() {
    const sb = await cloud();
    const [pr, care] = await Promise.all([sb.from("profiles").select("id, full_name, phone, role, created_at").order("created_at", { ascending: false }), sb.from("care_team").select("physio_id, patient_id")]);
    if (pr.error) throw pr.error; TM.rows = pr.data || []; TM.care = care.data || [];
  }
  function renderTeam() {
    const root = $("#apPanel");
    if (!TM.rows) { root.innerHTML = `<div class="card"><p class="lede">⏳ กำลังโหลดรายชื่อผู้ใช้…</p></div>`; loadTeam().then(renderTeam).catch((e) => (root.innerHTML = `<div class="card"><p class="form-error">โหลดไม่สำเร็จ: ${esc(e.message || e)}</p></div>`)); return; }
    const me = adminSession()?.uid, q = TM.q.trim(), list = TM.rows.filter((r) => !q || (r.full_name || "").includes(q) || (r.phone || "").includes(q));
    const cnt = (role) => TM.rows.filter((r) => r.role === role).length;
    root.innerHTML = `<section class="card ap-team">
      <div class="card-head"><h2>ทีมและสิทธิ์ <small>${TM.rows.length} บัญชี · ผู้ป่วย ${cnt("patient")} · นักกายภาพ ${cnt("physio")} · ผู้ดูแล ${cnt("admin")}</small></h2><button class="btn sm" type="button" data-trefresh>🔄 รีเฟรช</button></div>
      <p class="hint">เปลี่ยนบทบาทได้ที่นี่ · นักกายภาพเห็นเฉพาะผู้ป่วยที่มอบหมายในหน้า “ผู้ป่วยและโปรแกรม” · ผู้ดูแลระบบเห็นทุกคน</p>
      <input class="ap-search" id="tmQ" placeholder="ค้นหาชื่อหรือเบอร์โทร" value="${esc(TM.q)}" aria-label="ค้นหาผู้ใช้">
      <div class="ad-table-wrap"><table class="ad-table ap-team-t"><thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th>สมัครเมื่อ</th><th>บทบาท</th><th>ผู้ป่วยที่ดูแล / นักกายภาพ</th></tr></thead><tbody>
      ${list.map((r) => { const careN = r.role === "patient" ? TM.care.filter((c) => c.patient_id === r.id).length : TM.care.filter((c) => c.physio_id === r.id).length;
        return `<tr><th scope="row">${esc(r.full_name || "(ไม่ระบุชื่อ)")}${r.id === me ? ' <small>(คุณ)</small>' : ""}</th><td>${esc(r.phone || "–")}</td><td>${thDate((r.created_at || "").slice(0, 10))}</td>
          <td><select data-role="${r.id}" ${r.id === me ? "disabled" : ""} aria-label="บทบาทของ ${esc(r.full_name || "")}">${Object.entries(ROLE_TH).map(([k, v]) => `<option value="${k}" ${r.role === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
          <td>${r.role === "patient" ? (careN ? `${careN} คน` : '<span class="ap-care none">ยังไม่มีนักกายภาพ</span>') : `${careN} คน`}</td></tr>`; }).join("")}
      </tbody></table></div></section>`;
  }
  function initTeam() {
    const root = $("#apPanel");
    root.addEventListener("click", (e) => { if (APP.tab === "team" && e.target.closest("[data-trefresh]")) { TM.rows = null; renderTeam(); } });
    root.addEventListener("input", (e) => { if (APP.tab === "team" && e.target.id === "tmQ") { TM.q = e.target.value; const pos = e.target.selectionStart; renderTeam(); const q = $("#tmQ"); q.focus(); q.setSelectionRange(pos, pos); } });
    root.addEventListener("change", async (e) => {
      const id = e.target.dataset?.role; if (APP.tab !== "team" || !id) return;
      const row = TM.rows.find((r) => r.id === id), to = e.target.value;
      if (!confirm(`เปลี่ยนบทบาทของ ${row.full_name || "ผู้ใช้"} เป็น “${ROLE_TH[to]}”?`)) { e.target.value = row.role; return; }
      const { error } = await (await cloud()).from("profiles").update({ role: to }).eq("id", id);
      if (error) { toast("เปลี่ยนไม่สำเร็จ: " + error.message); e.target.value = row.role; return; }
      row.role = to; CL.patients = null; CL.dash = null; toast(`ตั้ง ${row.full_name || "ผู้ใช้"} เป็น${ROLE_TH[to]}แล้ว`); renderTeam();
    });
  }

  /* =====================================================================
     SHELL
     ===================================================================== */
  const APP = { tab: "dash" };
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600); }
  function renderShell() {
    const s = adminSession();
    document.body.classList.remove("ap-locked");
    $("#apApp").innerHTML = `<header class="ap-top">
        <div class="ap-brand">pre<b>DM</b> <span>ADMIN</span></div>
        <nav class="ap-tabs" role="tablist" aria-label="เมนูผู้ดูแล">
          <button type="button" role="tab" aria-selected="${APP.tab === "dash"}" data-tab="dash">📊 ภาพรวมระบบ</button>
          <button type="button" role="tab" aria-selected="${APP.tab === "patients"}" data-tab="patients">🩺 ผู้ป่วยและโปรแกรม</button>
          ${isCloudAdmin() ? `<button type="button" role="tab" aria-selected="${APP.tab === "team"}" data-tab="team">👥 ทีมและสิทธิ์</button>` : ""}
        </nav>
        <div class="ap-user"><span><b>${esc(s.name)}</b><small>${esc(s.role)}</small></span>
          <button class="icon-btn" type="button" id="apTheme" aria-label="สลับโหมดสว่าง/มืด">◐</button>
          <button class="btn sm" type="button" id="apLogout">ออกจากระบบ</button></div>
      </header>
      <main class="ap-main">
        <div class="ap-head"><h1>${APP.tab === "dash" ? "Dashboard ภาพรวมระบบ" : APP.tab === "team" ? "ทีมและสิทธิ์การเข้าถึง" : "ผู้ป่วยและโปรแกรมออกกำลังกาย"}</h1>
          <p class="lede">${APP.tab === "team" ? "จัดการบทบาทผู้ใช้ (ผู้ป่วย / นักกายภาพ / ผู้ดูแลระบบ) และดูว่าใครดูแลผู้ป่วยกี่คน" : APP.tab === "dash" ? "การใช้งานระบบ เวลาออกกำลังกายเฉลี่ย ท่ายอดนิยม และอัตราการเปลี่ยนแปลงของค่าสุขภาพ" : "เลือกผู้ป่วย ระบุปัญหา ระบบแนะนำท่าที่เหมาะสมและท่าที่ควรหลีกเลี่ยง ปรับจำนวนครั้ง แล้วมอบหมายให้ผู้ป่วย"}</p></div>
        <div id="apPanel">${APP.tab === "dash" ? `<div id="adRoot"></div>` : ""}</div>
      </main>`;
    $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { APP.tab = b.dataset.tab; store().set("adminTab", APP.tab); renderShell(); }));
    $("#apLogout").addEventListener("click", async () => { if (isCloud()) { try { await (await cloud()).auth.signOut(); } catch { /* */ } CL.patients = null; CL.dash = null; CL.rx = {}; } store().set("adminSession", null); boot(); });
    $("#apTheme").addEventListener("click", () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark ? "light" : "dark"; store().set("theme", r.dataset.theme); renderShell(); });
    if (APP.tab === "team" && !isCloudAdmin()) APP.tab = "dash";
    if (APP.tab === "dash") { initAdmin(); renderAdmin(); } else if (APP.tab === "team") { initTeam(); renderTeam(); } else { initPatients(); renderPatients(); }
  }
  function boot() {
    const th = store().get("theme", null); if (th) document.documentElement.dataset.theme = th;
    APP.tab = store().get("adminTab", "dash");
    if (linkInUrl()) { // arrived from the sign-in link in the email
      document.body.classList.add("ap-locked");
      $("#apApp").innerHTML = `<section class="card ap-login"><h1>กำลังยืนยันตัวตน…</h1><p class="lede">กรุณารอสักครู่</p></section>`;
      cloudLoginLink().then(() => { AD.src = "cloud"; AD._srcSet = true; toast("เข้าสู่ระบบสำเร็จ"); boot(); })
        .catch((x) => { store().set("adminSession", null); history.replaceState(null, "", location.pathname + location.search); renderLogin(); const er = $("#apCloudErr"); if (er) { er.textContent = authMsg(x); er.hidden = false; er.scrollIntoView({ block: "center" }); } });
      return;
    }
    if (!adminSession()) return renderLogin();
    if (isCloud() && (!adminSession().otp || Date.now() - (adminSession().at || 0) > ADMIN_MAX_H * 3600e3)) { // old password-only login, or too old
      cloud().then((sb) => sb?.auth.signOut()).catch(() => {}); store().set("adminSession", null);
      toast("กรุณาเข้าสู่ระบบใหม่ด้วยรหัส OTP"); return renderLogin();
    }
    if (isCloud()) { // make sure the stored cloud login is still valid
      if (!AD._srcSet) { AD.src = "cloud"; AD._srcSet = true; }
      cloud().then(async (sb) => {
        const { data } = await sb.auth.getSession();
        if (!data.session) { store().set("adminSession", null); toast("หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่"); return boot(); }
        const { data: prof } = await sb.from("profiles").select("role").eq("id", data.session.user.id).maybeSingle(); // keep role current (it may have changed)
        const ses = adminSession(); if (prof && ses && ses.rawRole !== prof.role) {
          if (!["physio", "admin"].includes(prof.role)) { await sb.auth.signOut(); store().set("adminSession", null); toast("บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลแล้ว"); return boot(); }
          store().set("adminSession", { ...ses, rawRole: prof.role, role: prof.role === "admin" ? "ผู้ดูแลระบบ" : "นักกายภาพบำบัด" }); renderShell();
        }
      }).catch(() => {});
    }
    renderShell();
  }
  boot();
})();

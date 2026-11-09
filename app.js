/* Pre-DM Smart Hub — app logic (no framework). Data lives in localStorage on this device. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "predm.v1.";
  const store = {
    get(k, d) { try { const v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const thDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const fmt = (n, d = 1) => (n == null || n === "" || isNaN(n) ? "–" : Number(n).toFixed(d));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------- profile & logs ---------- */
  const profile = () => store.get("profile", { age: 48, sex: "m", height: 168 });
  const saveProfile = (p) => store.set("profile", { ...profile(), ...p });
  const TYPE_TH = { aerobic: "แอโรบิก", strength: "เสริมแรง", flex: "ยืดเหยียด", balance: "ทรงตัว", game: "เกมส์" };

  function seedIfEmpty() {
    if (store.get("seeded", false)) return;
    const d = (off) => { const x = new Date(); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); };
    store.set("logs", [
      { date: d(0), type: "aerobic", name: "เดินเร็ว", minutes: 30, sample: true },
      { date: d(1), type: "strength", name: "สควอทโดยใช้เก้าอี้", minutes: 15, reps: 36, sample: true },
      { date: d(1), type: "flex", name: "ยืดเหยียดทั้งตัว", minutes: 10, sample: true },
      { date: d(2), type: "aerobic", name: "ปั่นจักรยาน", minutes: 25, sample: true },
      { date: d(2), type: "balance", name: "ยืนขาเดียว", minutes: 5, sample: true },
    ]);
    store.set("body", [
      { date: "2026-08-10", height: 168, weight: 76.8, waist: 95, fat: 31.2, muscle: 27.9, visc: 12, bmr: 1545, sample: true },
      { date: "2026-09-14", height: 168, weight: 75.1, waist: 93, fat: 30.0, muscle: 28.3, visc: 11, bmr: 1532, sample: true },
      { date: "2026-10-19", height: 168, weight: 73.6, waist: 91, fat: 28.7, muscle: 28.8, visc: 10, bmr: 1528, sample: true },
    ]);
    store.set("fitness", [
      { date: "2026-08-12", age: 48, chair30: 12, step2: 78, sitreach: -3, tug: 7.1, sls: 14, grip: 29, sample: true },
      { date: "2026-10-20", age: 48, chair30: 16, step2: 92, sitreach: 1.5, tug: 6.0, sls: 26, grip: 31, sample: true },
    ]);
    store.set("seeded", true);
  }

  function addLog(entry) {
    const logs = store.get("logs", []);
    logs.unshift({ date: todayISO(), ...entry });
    store.set("logs", logs.slice(0, 500));
    renderHome(); renderBadges();
  }

  function weekStats() {
    const now = new Date(); const day = (now.getDay() + 6) % 7; // Monday start
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(now.getDate() - day);
    const logs = store.get("logs", []).filter((l) => new Date(l.date + "T00:00:00") >= start);
    const days = (t) => new Set(logs.filter((l) => l.type === t).map((l) => l.date)).size;
    return {
      aerobic: logs.filter((l) => l.type === "aerobic" || l.type === "game").reduce((s, l) => s + (l.minutes || 0), 0),
      strength: days("strength"), flex: days("flex"), balance: days("balance"),
    };
  }
  function streak() {
    const dates = new Set(store.get("logs", []).map((l) => l.date));
    let n = 0; const d = new Date();
    if (!dates.has(todayISO())) d.setDate(d.getDate() - 1);
    while (dates.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- router ---------- */
  const VIEWS = ["welcome", "home", "risk", "exercise", "tracking", "game", "fitness", "body", "transform", "consult", "tree", "food", "profile"];
  let lastView = null;
  function route() {
    const hx = location.hash.slice(1);
    if (hx === "chat") { // the chat is a floating window now: open it over the current page
      history.replaceState(null, "", "#" + (lastView || "home"));
      if (session()) setTimeout(() => window.PreDMChat?.open(), 0);
      if (lastView) return; return route();
    }
    if (hx.startsWith("rx=")) { store.set("pendingRx", hx.slice(3)); history.replaceState(null, "", "#ex-rx"); return route(); }
    if (session() && store.get("pendingRx", null)) importRx(store.get("pendingRx", null));
    if (hx.startsWith("ex-") && (PROGRAMS[hx.slice(3)] || hx === "ex-mine" || hx === "ex-rx")) { exTab = hx.slice(3); renderExercise(); }
    const ptLink = /^consult\/pt\/[a-z0-9]{6,16}$/.test(hx); // physiotherapist joins a call from a shared link (no patient login needed)
    let v = ptLink ? "consult" : hx.startsWith("ex-") ? "exercise" : VIEWS.includes(hx) ? hx : "home";
    if (!session() && v !== "welcome" && !ptLink) v = "welcome";
    document.body.classList.toggle("is-ptlink", ptLink && !session());
    if (session() && v === "welcome" && location.hash !== "#welcome") v = "home";
    document.body.classList.toggle("is-welcome", v === "welcome");
    VIEWS.forEach((x) => ($("#view-" + x).hidden = x !== v));
    $$(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
    if (v === "body") renderBody();
    if (v === "transform") renderTransform();
    if (v === "home") renderHome();
    if (PL.on && v !== "exercise") plClose();
    lastView = v; if (v === "welcome") window.PreDMChat?.close(true);
    window.dispatchEvent(new CustomEvent("predm:view", { detail: v }));
    window.scrollTo(0, 0);
  }

  /* ---------- home ---------- */
  const ICON = {
    play: '<path d="M9 7l8 5-8 5z" fill="currentColor"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    star: '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8L8 13.5l-4.3-4 5.8-.7z"/>',
    flame: '<path d="M12 3c1 4 5.5 5.6 5.5 10.3a5.5 5.5 0 0 1-11 0c0-2.3 1.1-3.8 2.2-4.8.1 2 1.1 3.2 2.3 3.2 0-3.2-1.2-5.3 1-8.7z"/>',
    aerobic: '<path d="M3 12h4l2.2-5 4.3 10 2.2-5H21"/>',
    strength: '<path d="M6 6v12M18 6v12M3 9.5v5M21 9.5v5M6 12h12"/>',
    flex: '<circle cx="12" cy="4.5" r="1.6"/><path d="M4.5 8.5l7.5 2 7.5-2M12 10.5v4.5l-4 6M12 15l4 6"/>',
    balance: '<circle cx="12" cy="4.5" r="1.6"/><path d="M5 9.5h14M12 9.5v5.5l-1 6M12 15l4.5 2.5"/>',
    chat: '<path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.8A8.5 8.5 0 1 1 21 12z"/>',
    camera: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    isan: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    pakhaoma: '<path d="M4 8c3-2 13-2 16 0v4c-3-2-13-2-16 0z"/><path d="M7 12v8M17 12v8M7 9.4v2M10 9v2.4M14 9v2.4M17 9.4v2"/>',
    thai: '<path d="M12 3c-1.6 1.8-2.4 4-2.4 6.4V15l-2.2 3.2a1.4 1.4 0 0 0 2.3 1.6L12 17l2.3 2.8a1.4 1.4 0 0 0 2.3-1.6L14.4 15V9.4C14.4 7 13.6 4.8 12 3z"/><path d="M12 3v14"/>',
  };
  const ic = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  function arc(p, color) {
    const c = Math.PI * 40;
    return `<svg viewBox="0 0 100 56" aria-hidden="true"><path d="M10 50a40 40 0 0 1 80 0" fill="none" stroke="var(--line)" stroke-width="11" stroke-linecap="round"/>
      <path d="M10 50a40 40 0 0 1 80 0" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * Math.min(1, Math.max(0.001, p))).toFixed(1)} ${c}"/></svg>`;
  }
  function spark(rows) {
    if (rows.length < 2) return `<p class="lede">บันทึกอย่างน้อย 2 ครั้งเพื่อดูแนวโน้ม</p>`;
    const W = 300, H = 120, pad = 18, vs = rows.map((r) => r.weight), mn = Math.min(...vs) - 0.5, mx = Math.max(...vs) + 0.5;
    const pts = rows.map((r, i) => [pad + (i * (W - 2 * pad)) / (rows.length - 1), 26 + (1 - (r.weight - mn) / (mx - mn)) * (H - 52)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="แนวโน้มน้ำหนัก">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].map((i) => `<line x1="${pad + i * ((W - 2 * pad) / 29)}" y1="${H - 22}" x2="${pad + i * ((W - 2 * pad) / 29)}" y2="${H - (i % 5 ? 18 : 14)}" stroke="var(--blue-ink)" stroke-opacity=".35" stroke-width="1"/>`).join("")}
      <path d="${d}" fill="none" stroke="var(--blue-ink)" stroke-width="2.5" stroke-linecap="round"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--card)" stroke="var(--blue-ink)" stroke-width="2"/><text x="${p[0]}" y="${p[1] - 10}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" font-size="10" fill="var(--blue-ink)" font-family="Outfit">${rows[i].weight} กก.</text>
        <text x="${p[0]}" y="${H - 2}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" font-size="9.5" fill="var(--muted)">${thDate(rows[i].date)}</text>`).join("")}
    </svg>`;
  }
  function renderHome() {
    queueMicrotask(() => window.dispatchEvent(new Event("predm:home")));
    const nm = profile().name || "คุณ"; $("#helloName").textContent = "สวัสดีครับ, " + nm; $("#helloAvatar").textContent = nm.replace(/^(คุณ|อสม\.)\s*/, "").charAt(0) || "ส";
    $("#today").textContent = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
    const w = weekStats(), risk = store.get("riskHistory", [])[0], body = store.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = body[body.length - 1], first = body[0];
    const bmi = last ? last.weight / (last.height / 100) ** 2 : null;
    const types = [["aerobic", "แอโรบิก"], ["strength", "เสริมแรง"], ["flex", "ยืดเหยียด"], ["balance", "ทรงตัว"], ["thai", "สไตล์ไทย"], ["isan", "สไตล์อีสาน"], ["pakhaoma", "ผ้าขาวม้า"]];
    const col1 = `
      <div class="tile blue hero">
        <span class="badge-pill">${ic("star").replace('class="ico"', 'class="ico" style="width:14px;height:14px"')}ความท้าทายวันนี้</span>
        <h2>สควอท 30 ครั้ง กับโค้ช AI</h2>
        <a class="go" href="#tracking">เริ่มเลย <span class="play">${ic("play")}</span></a>
        <div class="hero-fig">${fig(P.squat, chair, 0, { noBlob: true })}</div>
      </div>
      <div class="card">
        <div class="card-head"><h2>เลือกประเภทการออกกำลังกาย</h2></div>
        <div class="type-row">${types.map(([k, t], i) => `<a class="type-btn ${i === 0 ? "on" : ""}" href="#exercise" data-ex="${k}"><span class="c">${ic(k)}</span>${t}</a>`).join("")}</div>
      </div>
      <div class="tile green split">
        <div>
          <span class="round-ico">${ic("heart")}</span>
          <h3>ความเสี่ยงเบาหวาน</h3>
          <small style="opacity:.75;font-size:.76rem">${risk ? "ประเมินล่าสุด " + thDate(risk.date) : "ยังไม่ได้ประเมิน"}</small>
          <a class="outline-pill" href="#risk">${risk ? "ประเมินใหม่" : "เริ่มประเมิน"}</a>
        </div>
        <div class="fig-side">${heartArt}<div style="text-align:center"><div class="metric">${risk ? risk.score : "–"}<small>/17</small></div>${risk ? `<span class="pill ${risk.cls}">${risk.level}</span>` : ""}</div></div>
      </div>`;
    const col2 = `
      <div class="card">
        <div class="card-head"><div><h2 style="font-size:1.5rem;font-weight:500">กิจกรรมสัปดาห์นี้</h2><p>${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p></div></div>
        <div class="act-row"><span class="pill-big green">${ic("clock")}${w.aerobic} นาที</span><small>แอโรบิกสะสม</small></div>
        <div class="act-row"><span class="pill-big blue">${ic("flame")}${streak()} วัน</span><small>ออกกำลังต่อเนื่อง</small></div>
        <div class="act-row"><span class="pill-big salmon">${ic("star")}${store.get("bestScore", 0)} คะแนน</span><small>เกมส์สูงสุด</small></div>
        <div class="gauges">
          <div class="gauge-row"><div><span class="lbl">เป้าแอโรบิก 150 นาที</span><small>ตามแนวทาง ADA สำหรับกลุ่มเสี่ยง</small><b class="big">${Math.round(Math.min(1, w.aerobic / 150) * 100)}%</b></div>${arc(w.aerobic / 150, "var(--blue-ink)")}</div>
          <div class="gauge-row"><div><span class="lbl" style="--c:var(--salmon-ink)">เสริมแรง ${w.strength}/3 วัน</span><small>ยืดเหยียด ${w.flex}/3 · ทรงตัว ${w.balance}/3 วัน</small><b class="big">${Math.round(((w.strength + w.flex + w.balance) / 9) * 100)}%</b></div>${arc((w.strength + w.flex + w.balance) / 9, "var(--salmon-ink)")}</div>
        </div>
      </div>`;
    const col3 = `
      <div class="tile blue">
        <div class="card-head"><div><h3>น้ำหนัก</h3><div class="metric">${last ? fmt(last.weight) : "–"}<small>กก.</small></div></div>
          ${first && last && body.length > 1 ? `<span class="badge-pill">${last.weight <= first.weight ? "▼" : "▲"} ${fmt(Math.abs(first.weight - last.weight))} กก.</span>` : ""}</div>
        ${spark(body)}
        <a class="go" href="#body" style="margin-top:0">ดู Body Composition <span class="play" style="width:34px;height:34px">${ic("arrow")}</span></a>
      </div>
      <div class="mini">
        <div class="tile"><span class="round-ico" style="width:36px;height:36px">${ic("aerobic")}</span><small class="l">BMI</small><div class="metric">${fmt(bmi)}</div>${bmi ? `<span class="pill ${bmiClass(bmi)[1]}" style="align-self:flex-start">${bmiClass(bmi)[0]}</span>` : ""}</div>
        <div class="tile"><span class="round-ico" style="width:36px;height:36px">${ic("balance")}</span><small class="l">รอบเอว</small><div class="metric">${last && last.waist ? fmt(last.waist, 0) : "–"}<small>ซม.</small></div>${last && last.waist ? `<span class="pill ${last.waist / last.height >= 0.5 ? "high" : "low"}" style="align-self:flex-start">WHtR ${fmt(last.waist / last.height, 2)}</span>` : ""}</div>
      </div>
      <div class="coach-bar yellow">
        <span class="avatar mascot-av">${window.PreDMMascot ? PreDMMascot.svg() : ic("heart")}</span>
        <div><b>น้องอ่อนหวาน</b><small>ผู้ช่วยโค้ชสุขภาพ ถามได้ตลอด 24 ชม.</small></div>
        <span class="acts"><a class="icon-btn sm" href="#chat" aria-label="คุยกับน้องอ่อนหวาน">${ic("chat")}</a><a class="icon-btn sm" href="#tracking" aria-label="AI Tracking">${ic("camera")}</a></span>
      </div>`;
    $("#homeGrid").innerHTML = `<div class="home-col">${col1}</div><div class="home-col">${col2}</div><div class="home-col">${col3}</div>`;
    const logs = store.get("logs", []).slice(0, 8);
    $("#logTable").innerHTML = `<thead><tr><th>วันที่</th><th>ประเภท</th><th>กิจกรรม</th><th class="num">นาที</th><th class="num">ครั้ง/คะแนน</th></tr></thead><tbody>` +
      (logs.length ? logs.map((l) => `<tr><td>${thDate(l.date)}</td><td><span class="wtag ${l.type === "game" ? "aerobic" : l.type}">${TYPE_TH[l.type]}</span></td><td>${esc(l.name)}${l.sample ? '<span class="tag-sample">ตัวอย่าง</span>' : ""}</td><td class="num">${l.minutes ?? "–"}</td><td class="num">${l.reps ?? l.score ?? "–"}</td></tr>`).join("")
        : `<tr><td colspan="5" class="empty">ยังไม่มีบันทึก เริ่มจากโปรแกรมออกกำลังกายหรือ AI Tracking</td></tr>`) + "</tbody>";
  }
  const bmiClass = (b) => (b < 18.5 ? ["น้ำหนักน้อย", "mod"] : b < 23 ? ["ปกติ", "low"] : b < 25 ? ["ท้วม", "mod"] : b < 30 ? ["อ้วนระดับ 1", "high"] : ["อ้วนระดับ 2", "crit"]);

  /* ---------- risk (Thai Diabetes Risk Score) ---------- */
  function calcRisk(f) {
    const bmi = f.wt / (f.ht / 100) ** 2;
    const parts = [
      ["อายุ " + f.age + " ปี", f.age >= 50 ? 2 : f.age >= 45 ? 1 : 0],
      ["เพศ" + (f.sex === "m" ? "ชาย" : "หญิง"), f.sex === "m" ? 2 : 0],
      ["BMI " + bmi.toFixed(1), bmi >= 27.5 ? 5 : bmi >= 23 ? 3 : 0],
      ["รอบเอว " + f.waist + " ซม.", (f.sex === "m" ? f.waist >= 90 : f.waist >= 80) ? 2 : 0],
      ["ความดันโลหิตสูง", f.htn ? 2 : 0],
      ["ประวัติเบาหวานในครอบครัว", f.fh ? 4 : 0],
    ];
    const score = parts.reduce((s, p) => s + p[1], 0);
    const lv = score <= 2 ? ["ความเสี่ยงต่ำ", "low", "น้อยกว่า 5%"] : score <= 5 ? ["ความเสี่ยงปานกลาง", "mod", "5–10%"] : score <= 8 ? ["ความเสี่ยงสูง", "high", "11–20%"] : ["ความเสี่ยงสูงมาก", "crit", "มากกว่า 20%"];
    return { score, parts, bmi, level: lv[0], cls: lv[1], chance: lv[2] };
  }
  function labNote(fpg, a1c) {
    const out = [];
    if (fpg) out.push(fpg >= 126 ? `FPG ${fpg} มก./ดล. อยู่ในเกณฑ์เบาหวาน ควรพบแพทย์เพื่อตรวจยืนยัน` : fpg >= 100 ? `FPG ${fpg} มก./ดล. อยู่ในช่วงภาวะก่อนเบาหวาน (100–125)` : `FPG ${fpg} มก./ดล. ปกติ`);
    if (a1c) out.push(a1c >= 6.5 ? `HbA1c ${a1c}% อยู่ในเกณฑ์เบาหวาน ควรพบแพทย์` : a1c >= 5.7 ? `HbA1c ${a1c}% อยู่ในช่วงภาวะก่อนเบาหวาน (5.7–6.4%)` : `HbA1c ${a1c}% ปกติ`);
    return out;
  }
  function renderRisk(r, labs) {
    const pct = (r.score / 17) * 100;
    const advice = {
      low: ["ออกกำลังกายสม่ำเสมอ 150 นาที/สัปดาห์", "ประเมินซ้ำทุก 3 ปี"],
      mod: ["ออกกำลังกายแอโรบิก 150 นาที/สัปดาห์ ร่วมกับเสริมแรง 2–3 วัน", "ควบคุมน้ำหนักและรอบเอว", "ประเมินซ้ำทุก 1–3 ปี"],
      high: ["ตรวจระดับน้ำตาลในเลือด (FPG หรือ HbA1c) ภายในปีนี้", "ลดน้ำหนัก 5–7% ภายใน 6 เดือน", "เริ่มโปรแกรมออกกำลังกายครบ 4 แบบในแอปนี้"],
      crit: ["ควรตรวจระดับน้ำตาลในเลือดโดยเร็ว", "ปรึกษาบุคลากรสาธารณสุขก่อนเพิ่มความหนักการออกกำลังกาย", "ลดน้ำหนัก 5–7% และเดินหลังอาหารทุกมื้อ 10–15 นาที"],
    }[r.cls];
    $("#riskResult").innerHTML = `
      <h2>ผลการประเมิน</h2>
      <div class="risk-score ${r.cls}"><b>${r.level}</b><div class="score-big">${r.score}<small> / 17 คะแนน</small></div>
      <small>โอกาสเป็นเบาหวานใน 12 ปี ${r.chance}</small></div>
      <div class="gauge"><div class="gauge-bar"><div class="gauge-mark" style="left:${pct}%"></div></div>
        <div class="gauge-scale"><span>0</span><span>3</span><span>6</span><span>9</span><span>17</span></div></div>
      <ul class="breakdown">${r.parts.map((p) => `<li><span>${p[0]}</span><b>+${p[1]}</b></li>`).join("")}</ul>
      ${labs.length ? `<div class="advice"><b>ผลเลือด</b><ul>${labs.map((x) => `<li>${x}</li>`).join("")}</ul></div>` : ""}
      <div class="advice"><b>คำแนะนำ</b><ul>${advice.map((x) => `<li>${x}</li>`).join("")}</ul></div>
      <a class="btn primary" href="#exercise" style="text-align:center;text-decoration:none">ไปที่โปรแกรมออกกำลังกาย</a>`;
  }
  function initRisk() {
    $("#riskForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const num = (id) => ($(id).value === "" ? NaN : +$(id).value), pick = (n) => $(`input[name="${n}"]:checked`)?.value;
      const f = { age: num("#r-age"), sex: pick("r-sex"), wt: num("#r-wt"), ht: num("#r-ht"), waist: num("#r-waist"), htn: pick("r-ht2"), fh: pick("r-fh") };
      const checks = [
        [!(f.age >= 15 && f.age <= 100), "#r-age", "อายุ (15–100 ปี)"], [!f.sex, null, "เพศ"],
        [!(f.wt >= 25 && f.wt <= 250), "#r-wt", "น้ำหนัก (25–250 กก.)"], [!(f.ht >= 100 && f.ht <= 220), "#r-ht", "ส่วนสูง (100–220 ซม.)"],
        [!(f.waist >= 40 && f.waist <= 200), "#r-waist", "รอบเอว (40–200 ซม.)"], [!f.htn, null, "ประวัติความดันโลหิตสูง"], [!f.fh, null, "ประวัติเบาหวานในครอบครัว"],
      ];
      $$("#riskForm input").forEach((i) => i.removeAttribute("aria-invalid"));
      const bad = checks.filter((c) => c[0]);
      const err = $("#riskError");
      if (bad.length) {
        bad.forEach((c) => c[1] && $(c[1]).setAttribute("aria-invalid", "true"));
        err.textContent = "กรุณากรอกให้ครบ: " + bad.map((c) => c[2]).join(", "); err.hidden = false;
        (bad[0][1] ? $(bad[0][1]) : err).focus(); return;
      }
      err.hidden = true;
      f.htn = f.htn === "1"; f.fh = f.fh === "1";
      const r = calcRisk(f); const labs = labNote(+$("#r-fpg").value || 0, +$("#r-a1c").value || 0);
      renderRisk(r, labs);
      saveProfile({ age: f.age, sex: f.sex, height: f.ht }); store.set("riskInput", { age: f.age, sex: f.sex, htn: f.htn, fh: f.fh, waist: f.waist, wt: f.wt, ht: f.ht });
      const h = store.get("riskHistory", []); h.unshift({ date: todayISO(), score: r.score, level: r.level, cls: r.cls }); store.set("riskHistory", h.slice(0, 50));
      toast("บันทึกผลการประเมินแล้ว");
    });
    $("#riskForm").addEventListener("input", (e) => { if (e.target.matches("input")) e.target.removeAttribute("aria-invalid"); });
    $("#riskResult").innerHTML = `<h2>ผลการประเมิน</h2><p class="lede">กรอกข้อมูลของคุณให้ครบทุกข้อ แล้วกด “คำนวณความเสี่ยง” ผลจะแสดงที่นี่ เกณฑ์การให้คะแนนมีดังนี้</p>
      <ul class="breakdown"><li><span>อายุ 45–49 / ≥50 ปี</span><b>1 / 2</b></li><li><span>เพศชาย</span><b>2</b></li><li><span>BMI 23–27.4 / ≥27.5</span><b>3 / 5</b></li>
      <li><span>รอบเอว ชาย ≥90 / หญิง ≥80 ซม.</span><b>2</b></li><li><span>ความดันโลหิตสูง</span><b>2</b></li><li><span>ญาติสายตรงเป็นเบาหวาน</span><b>4</b></li></ul>`;
  }

  /* ---------- exercise programs ---------- */
  // Flat vector person built from joints: [head, neck, hip, lElbow, lHand, rElbow, rHand, lKnee, lFoot, rKnee, rFoot]
  // "r" limbs are drawn first in a deeper tone so the figure reads as 3-D.
  const PAL = [
    { shirt: "#e9785a", shorts: "#2c3a4a", skin: "#f0bf9a", hair: "#2a1f1b", bun: 1 },
    { shirt: "#3d84a8", shorts: "#26323b", skin: "#c98a62", hair: "#1d1612" },
    { shirt: "#7c6bd6", shorts: "#2c3a4a", skin: "#e9b08b", hair: "#3b2a20", bun: 1 },
    { shirt: "#2f9e6e", shorts: "#3a3f4a", skin: "#b97a54", hair: "#15110e" },
  ];
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.round(c * k).toString(16).padStart(2, "0"); return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
  // ---- flat 2D person: filled body shapes (torso, sleeves, shorts, tapered limbs, hands, shoes, face) built from joints ----
  const f1 = (v) => v.toFixed(1);
  const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const circ = (c, r) => `M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
  const ell = (c, rx, ry) => `M${f1(c[0] - rx)} ${f1(c[1])}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0`;
  function limb(a, b, wa, wb) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
    return `M${f1(a[0] + px * wa / 2)} ${f1(a[1] + py * wa / 2)}L${f1(b[0] + px * wb / 2)} ${f1(b[1] + py * wb / 2)}L${f1(b[0] - px * wb / 2)} ${f1(b[1] - py * wb / 2)}L${f1(a[0] - px * wa / 2)} ${f1(a[1] - py * wa / 2)}Z${circ(a, wa / 2)}${circ(b, wb / 2)}`;
  }
  // returns [{d, fill?, stroke?, sw?, op?}] in paint order; the count never changes so animation can reuse the elements
  // ---- skeleton with fixed, realistic bone lengths (≈ 7 heads tall; legs longer than torso; fingertips reach mid-thigh).
  // Every pose / motion frame is rebuilt from bone directions so proportions never drift; standing feet stay on the floor.
  const BONE = { torso: 30, head: 10.5, thigh: 20.5, shin: 20, ua: 15, fa: 13 };
  function normalizePose(J) {
    const [h, n, hp, le, lh, re, rh, lk, lf, rk, rf] = J;
    const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
    const add = (a, d, l) => [a[0] + d[0] * l, a[1] + d[1] * l];
    const frame = (nn, hh) => { const d = dir(nn, hh); return { px: -d[1], py: d[0], ux: d[0], uy: d[1] }; };
    const o = frame(n, hp), shO = (sd) => [n[0] + o.px * sd + o.ux * 2.5, n[1] + o.py * sd + o.uy * 2.5], hiO = (sd) => [hp[0] + o.px * sd + o.ux * 2.5, hp[1] + o.py * sd + o.uy * 2.5];
    const N = add(hp, dir(hp, n), BONE.torso), f2 = frame(N, hp);
    const shN = (sd) => [N[0] + f2.px * sd + f2.ux * 2.5, N[1] + f2.py * sd + f2.uy * 2.5], hiN = (sd) => [hp[0] + f2.px * sd + f2.ux * 2.5, hp[1] + f2.py * sd + f2.uy * 2.5];
    const H = add(N, dir(n, h), BONE.head);
    const LE = add(shN(10), dir(shO(10), le), BONE.ua), LH = add(LE, dir(le, lh), BONE.fa);
    const RE = add(shN(-10), dir(shO(-10), re), BONE.ua), RH = add(RE, dir(re, rh), BONE.fa);
    const LK = add(hiN(5.6), dir(hiO(5.6), lk), BONE.thigh), LF = add(LK, dir(lk, lf), BONE.shin);
    const RK = add(hiN(-5.6), dir(hiO(-5.6), rk), BONE.thigh), RF = add(RK, dir(rk, rf), BONE.shin);
    let out = [H, N, hp, LE, LH, RE, RH, LK, LF, RK, RF];
    const origFoot = Math.max(lf[1], rf[1]), newFoot = Math.max(LF[1], RF[1]);
    if (origFoot > 80) { const dy = origFoot - newFoot; out = out.map((q) => [q[0], q[1] + dy]); }
    return out;
  }
  // returns [{d, fill?, stroke?, sw?, op?}] in paint order; the count never changes so animation can reuse the elements
  function bodyParts(J0, c) {
    const J = normalizePose(J0);
    const [h, n, hp, le, lh, re, rh, lk, lf, rk, rf] = J;
    const ax = hp[0] - n[0], ay = hp[1] - n[1], L = Math.hypot(ax, ay) || 1, ux = ax / L, uy = ay / L, px = -uy, py = ux;
    const off = (p, sd, t = 0) => [p[0] + px * sd + ux * t, p[1] + py * sd + uy * t];
    const sk = c.skin, skB = shade(sk, 0.9), sh = c.shirt, shB = shade(sh, 0.85), pa = c.shorts, paB = shade(pa, 0.8), hair = c.hair;
    const shL = off(n, 10, 2.5), shR = off(n, -10, 2.5), hiL = off(hp, 5.6, 2.5), hiR = off(hp, -5.6, 2.5);
    const P = [], pt = (q) => `${f1(q[0])} ${f1(q[1])}`;
    const hand = (e, hd) => { const dx = hd[0] - e[0], dy = hd[1] - e[1], l = Math.hypot(dx, dy) || 1; return [hd[0] + dx / l * 1.6, hd[1] + dy / l * 1.6]; };
    const arm = (s, e, hd, front) => { const k = front ? sk : skB, sl = front ? sh : shB;
      P.push({ d: limb(e, hd, 4.4, 3.4), fill: k }, { d: limb(s, e, 5.6, 4.4), fill: k }, { d: limb(s, lerpP(s, e, 0.42), 7.2, 6.2), fill: sl }, { d: ell(hand(e, hd), 2.3, 2.8), fill: k }); };
    const leg = (hi, k, f, front) => { const kk = front ? sk : skB, p2 = front ? pa : paB, calf = lerpP(k, f, 0.38);
      P.push({ d: limb(k, calf, 6.4, 6.6) + limb(calf, f, 6.6, 4.2), fill: kk }, { d: limb(hi, k, 9.2, 6.6), fill: p2 }, { d: limb(k, lerpP(k, f, 0.62), 6.8, 5.6), fill: p2 },
        { d: `M${f1(f[0] - 4.3)} ${f1(f[1] + 3.3)}h8.6v1.4h-8.6z`, fill: "#f4f4f4" }, { d: ell([f[0], f[1] + 1.7], 4.3, 2.4), fill: front ? "#2a3240" : "#353d4c" }); };
    P.push({ d: ell([(lf[0] + rf[0]) / 2, Math.max(lf[1], rf[1]) + 4.8], 17, 2.2), fill: "#000", op: Math.max(lf[1], rf[1]) > 70 ? 0.1 : 0 });
    arm(shR, re, rh, false); leg(hiR, rk, rf, false);
    // pelvis (pants) + shirt: shoulders -> chest -> waist -> hem
    const hemL = off(hp, 9.2, 1.5), hemR = off(hp, -9.2, 1.5);
    P.push({ d: `M${pt(off(hp, 9.2, -1))}L${pt(off(hp, 10, 6))}Q${pt(off(hp, 0, 8.5))} ${pt(off(hp, -10, 6))}L${pt(off(hp, -9.2, -1))}Z`, fill: pa });
    const chL = off(n, 9.6, 8), chR = off(n, -9.6, 8), wL = off(n, 7.6, 19), wR = off(n, -7.6, 19);
    P.push({ d: `M${pt(shL)}Q${pt(off(n, 3.5, 0.4))} ${pt(off(n, 0, 1.2))}Q${pt(off(n, -3.5, 0.4))} ${pt(shR)}Q${pt(off(n, -11.4, 4))} ${pt(chR)}Q${pt(off(n, -8.6, 14))} ${pt(wR)}L${pt(hemR)}Q${pt(off(hp, 0, 2.6))} ${pt(hemL)}L${pt(wL)}Q${pt(off(n, 8.6, 14))} ${pt(chL)}Q${pt(off(n, 11.4, 4))} ${pt(shL)}Z`, fill: sh });
    P.push({ d: `M${pt(off(n, 3, 0.8))}Q${pt(off(n, 0, 3.6))} ${pt(off(n, -3, 0.8))}`, stroke: shade(sh, 0.72), sw: 1.1 });
    P.push({ d: `M${pt(off(n, 0, 9))}L${pt(off(n, 0, 24))}`, stroke: shade(sh, 0.9), sw: 0.6, op: 0.6 });
    leg(hiL, lk, lf, true);
    // neck + head (≈ 1/7 of height)
    P.push({ d: limb(lerpP(h, n, 0.62), off(n, 0, 1.2), 4, 4.6), fill: skB });
    P.push({ d: c.bun ? circ([h[0], h[1] - 6.6], 3.2) : "M0 0", fill: hair });
    P.push({ d: circ([h[0] - 5.6, h[1] + 0.8], 1.3) + circ([h[0] + 5.6, h[1] + 0.8], 1.3), fill: skB });
    P.push({ d: ell(h, 5.7, 6.7), fill: sk });
    P.push({ d: `M${f1(h[0] - 6)} ${f1(h[1] + 0.6)}C${f1(h[0] - 6.6)} ${f1(h[1] - 7.6)} ${f1(h[0] + 6.6)} ${f1(h[1] - 7.6)} ${f1(h[0] + 6)} ${f1(h[1] + 0.6)}C${f1(h[0] + 4.4)} ${f1(h[1] - 3.4)} ${f1(h[0] + 0.8)} ${f1(h[1] - 4.2)} ${f1(h[0] - 2)} ${f1(h[1] - 2.6)}C${f1(h[0] - 3.6)} ${f1(h[1] - 1.8)} ${f1(h[0] - 4.9)} ${f1(h[1] - 0.8)} ${f1(h[0] - 6)} ${f1(h[1] + 0.6)}Z`, fill: hair });
    P.push({ d: `M${f1(h[0] - 3.4)} ${f1(h[1] - 0.9)}l2 -0.4M${f1(h[0] + 3.4)} ${f1(h[1] - 0.9)}l-2 -0.4`, stroke: hair, sw: 0.7 });
    P.push({ d: ell([h[0] - 2.2, h[1] + 0.9], 0.72, 0.92) + ell([h[0] + 2.2, h[1] + 0.9], 0.72, 0.92), fill: "#2a1f1b" });
    P.push({ d: circ([h[0] - 3.5, h[1] + 3], 1.1) + circ([h[0] + 3.5, h[1] + 3], 1.1), fill: "#f08a7a", op: 0.35 });
    P.push({ d: `M${f1(h[0])} ${f1(h[1] + 1.6)}l-0.5 1.5h1`, stroke: shade(sk, 0.68), sw: 0.55 });
    P.push({ d: `M${f1(h[0] - 1.7)} ${f1(h[1] + 3.8)}q1.7 1.3 3.4 0`, stroke: "#8a3b2b", sw: 0.8 });
    arm(shL, le, lh, true);
    return P;
  }
  const partSVG = (q, i) => `<path${i != null ? ` data-p="${i}"` : ""} d="${q.d}" ${q.fill ? `fill="${q.fill}"` : `fill="none" stroke="${q.stroke}" stroke-width="${q.sw}" stroke-linecap="round" stroke-linejoin="round"`}${q.op != null ? ` opacity="${q.op}"` : ""}/>`;
  function fig(j, extra = "", v = 0, opts = {}) {
    const c = PAL[v % PAL.length];
    const blob = opts.noBlob ? "" : `<circle cx="52" cy="54" r="38" fill="#fff" opacity=".38"/>`;
    return `<svg viewBox="-4 -4 108 108" aria-hidden="true">${blob}<g fill="none">${extra}</g>${bodyParts(j, c).map((q) => partSVG(q)).join("")}${opts.front ? `<g fill="none">${opts.front}</g>` : ""}</svg>`;
  }
  // Pose-tracking look for the camera screens: bones + keypoints over a dark stage.
  function skeletonArt(j) {
    const [h, n, hp, le, lh, re, rh, lk, lf, rk, rf] = j;
    const B = [[n, hp], [n, le], [le, lh], [n, re], [re, rh], [hp, lk], [lk, lf], [hp, rk], [rk, rf]];
    return `<svg viewBox="-10 -6 120 112" aria-hidden="true"><circle cx="50" cy="52" r="44" fill="#3fbf85" opacity=".07"/>
      <g stroke="#3fbf85" stroke-width="2.4" stroke-linecap="round">${B.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`).join("")}</g>
      <circle cx="${h[0]}" cy="${h[1]}" r="7" fill="none" stroke="#3fbf85" stroke-width="2.4"/>
      ${[n, hp, le, lh, re, rh, lk, lf, rk, rf].map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#f0b440"/>`).join("")}
      <path d="M-4 8V-2h10M104 8V-2H94M-4 92v10h10M104 92v10H94" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/></svg>`;
  }
  const heartArt = `<svg viewBox="0 0 100 100" aria-hidden="true" class="heart-art">
    <circle cx="50" cy="54" r="40" fill="var(--green)" opacity=".55"/>
    <path d="M40 36V16a6 6 0 0 1 12 0v18" fill="none" stroke="#f2a891" stroke-width="9" stroke-linecap="round"/>
    <path d="M60 34V22a5 5 0 0 1 10 0v12" fill="none" stroke="#9cc9da" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M48 32C34 18 12 26 15 48c2 15 18 28 36 42 14-12 33-25 35-43 2-20-20-28-34-13z" fill="#e4705a"/>
    <path d="M24 44c1-8 8-12 15-10" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>
    <path d="M56 44c6 4 8 14 3 24" fill="none" stroke="#b9493a" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M10 60h18l5-10 7 20 6-14 4 4h40" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const P = {
    walk: [[50, 14], [50, 24], [50, 54], [42, 38], [40, 50], [58, 38], [62, 48], [42, 72], [36, 92], [56, 72], [60, 92]],
    march: [[50, 14], [50, 24], [50, 54], [40, 34], [44, 24], [60, 38], [60, 52], [62, 58], [62, 78], [52, 74], [52, 94]],
    bike: [[42, 18], [46, 28], [36, 56], [56, 36], [66, 44], [56, 38], [66, 46], [58, 62], [52, 82], [50, 66], [62, 80]],
    squat: [[46, 22], [48, 32], [36, 58], [60, 38], [74, 40], [60, 38], [74, 40], [58, 66], [52, 92], [58, 66], [52, 92]],
    pushup: [[70, 22], [64, 30], [44, 52], [74, 42], [80, 58], [74, 42], [80, 58], [32, 70], [22, 90], [32, 70], [22, 90]],
    row: [[50, 14], [50, 24], [50, 54], [36, 34], [40, 44], [64, 34], [60, 44], [46, 74], [44, 94], [54, 74], [56, 94]],
    calf: [[50, 10], [50, 20], [50, 50], [42, 34], [40, 48], [58, 34], [60, 48], [47, 70], [47, 88], [53, 70], [53, 88]],
    bridge: [[16, 78], [24, 76], [52, 62], [30, 86], [40, 90], [30, 86], [40, 90], [70, 58], [76, 88], [70, 58], [76, 88]],
    curl: [[50, 14], [50, 24], [50, 54], [42, 40], [42, 26], [58, 40], [58, 26], [46, 74], [44, 94], [54, 74], [56, 94]],
    reach: [[50, 22], [50, 32], [50, 62], [42, 18], [38, 4], [58, 18], [62, 4], [46, 80], [44, 96], [54, 80], [56, 96]],
    hamstring: [[66, 40], [60, 46], [40, 60], [70, 60], [80, 74], [70, 60], [80, 74], [62, 80], [84, 82], [40, 80], [30, 92]],
    calfstretch: [[64, 14], [60, 24], [50, 52], [72, 30], [86, 26], [72, 32], [86, 28], [62, 70], [64, 92], [38, 72], [24, 92]],
    chest: [[50, 14], [50, 24], [50, 54], [36, 30], [24, 38], [64, 30], [76, 38], [46, 74], [44, 94], [54, 74], [56, 94]],
    side: [[42, 16], [46, 26], [50, 56], [40, 12], [34, 2], [58, 36], [56, 52], [46, 76], [44, 96], [54, 76], [56, 96]],
    oneleg: [[50, 12], [50, 22], [50, 52], [38, 34], [28, 40], [62, 34], [72, 40], [50, 74], [50, 94], [60, 66], [56, 80]],
    tandem: [[50, 10], [50, 20], [50, 50], [38, 32], [30, 40], [62, 32], [70, 40], [50, 72], [48, 92], [52, 72], [54, 84]],
    shift: [[44, 12], [46, 22], [48, 52], [34, 30], [28, 42], [58, 30], [66, 40], [42, 72], [36, 94], [56, 72], [62, 94]],
    sitstand: [[48, 16], [48, 26], [42, 54], [58, 34], [66, 30], [58, 34], [66, 30], [60, 62], [58, 90], [60, 62], [58, 90]],
    // Thai-style set (สสส. 12 ท่าบริหารร่างกายสไตล์ไทย)
    wai: [[50, 14], [50, 24], [50, 54], [40, 38], [49, 28], [60, 38], [51, 28], [46, 74], [44, 94], [54, 74], [56, 94]],
    shrug: [[50, 11], [50, 22], [50, 54], [40, 38], [39, 52], [60, 38], [61, 52], [46, 74], [44, 94], [54, 74], [56, 94]],
    lotus: [[50, 16], [50, 26], [50, 56], [37, 28], [26, 16], [63, 28], [74, 16], [46, 75], [44, 94], [54, 75], [56, 94]],
    krathop: [[50, 12], [50, 22], [50, 52], [36, 26], [22, 28], [64, 26], [78, 28], [58, 66], [56, 82], [48, 72], [46, 92]],
    bamboo: [[40, 17], [44, 26], [50, 55], [38, 14], [30, 4], [54, 12], [34, 2], [47, 75], [45, 94], [55, 75], [57, 94]],
    bird: [[50, 12], [50, 22], [50, 52], [36, 26], [22, 24], [64, 26], [78, 24], [62, 60], [60, 76], [50, 73], [50, 94]],
    ramthai: [[50, 13], [50, 23], [50, 53], [62, 20], [62, 8], [38, 34], [28, 30], [56, 70], [66, 84], [47, 73], [46, 94]],
    boxing: [[52, 14], [52, 24], [50, 54], [66, 28], [82, 26], [58, 36], [60, 26], [58, 74], [64, 94], [44, 74], [36, 94]],
    rowboat: [[54, 16], [53, 26], [50, 56], [62, 38], [70, 46], [60, 33], [70, 30], [64, 70], [70, 92], [42, 74], [32, 92]],
    castnet: [[54, 15], [52, 25], [50, 55], [62, 20], [74, 8], [60, 26], [74, 14], [58, 72], [64, 94], [42, 72], [36, 94]],
    rice: [[72, 34], [64, 37], [44, 52], [66, 52], [68, 70], [61, 52], [62, 72], [50, 73], [54, 94], [40, 74], [36, 94]],
    sky: [[50, 16], [50, 26], [50, 56], [47, 12], [50, 1], [53, 12], [50, 1], [47, 74], [46, 91], [53, 74], [54, 91]],
    // front-facing poses (figure faces the trainee) used by the motion engine
    standF: [[50, 14], [50, 24], [50, 54], [40, 39], [39, 53], [60, 39], [61, 53], [46, 74], [45, 94], [54, 74], [55, 94]],
    pkN: [[50, 14], [50, 24], [50, 54], [41, 41], [45, 54], [59, 41], [55, 54], [46, 74], [45, 94], [54, 74], [55, 94]],
    squatF: [[50, 27], [50, 37], [50, 64], [40, 47], [46, 41], [60, 47], [54, 41], [38, 76], [42, 94], [62, 76], [58, 94]],
    walkL: [[50, 14], [50, 24], [50, 54], [40, 40], [38, 52], [60, 39], [59, 48], [46, 71], [45, 90], [54, 74], [55, 94]],
    marchL: [[50, 14], [50, 24], [50, 54], [40, 40], [38, 52], [61, 38], [57, 30], [45, 60], [45, 77], [54, 74], [55, 94]],
    bike2: [[42, 18], [46, 28], [36, 56], [56, 36], [66, 44], [56, 38], [66, 46], [50, 66], [62, 80], [58, 62], [52, 82]],
    wallA: [[50, 15], [50, 25], [50, 55], [43, 31], [44, 29], [57, 31], [56, 29], [46, 75], [45, 94], [54, 75], [55, 94]],
    wallB: [[50, 17], [50, 27], [50, 56], [33, 35], [41, 28], [67, 35], [59, 28], [46, 75], [45, 94], [54, 75], [55, 94]],
    rowA: [[50, 14], [50, 24], [50, 54], [43, 33], [45, 32], [57, 33], [55, 32], [46, 74], [45, 94], [54, 74], [55, 94]],
    rowB: [[50, 14], [50, 24], [50, 54], [31, 40], [38, 36], [69, 40], [62, 36], [46, 74], [45, 94], [54, 74], [55, 94]],
    tiptoe: [[50, 9], [50, 19], [50, 49], [40, 34], [39, 48], [60, 34], [61, 48], [46, 70], [45, 91], [54, 70], [55, 91]],
    bridgeDown: [[16, 80], [24, 79], [50, 79], [30, 86], [40, 90], [30, 86], [40, 90], [66, 64], [76, 88], [66, 64], [76, 88]],
    seatA: [[34, 20], [33, 30], [32, 56], [36, 44], [40, 56], [36, 44], [40, 56], [52, 57], [53, 92], [53, 57], [53, 92]],
    seatB: [[34, 20], [33, 30], [32, 56], [36, 44], [40, 56], [36, 44], [40, 56], [52, 57], [53, 92], [53, 57], [76, 53]],
    hamUp: [[56, 30], [54, 40], [40, 60], [62, 54], [72, 60], [62, 54], [72, 60], [62, 80], [84, 82], [40, 80], [30, 92]],
    chestF: [[50, 13], [50, 24], [50, 54], [38, 40], [45, 56], [62, 40], [55, 56], [46, 74], [45, 94], [54, 74], [55, 94]],
    sitUp: [[50, 12], [50, 22], [50, 52], [56, 36], [62, 44], [56, 36], [62, 44], [52, 72], [56, 92], [52, 72], [56, 92]],
    shrugF: [[50, 13], [50, 20], [50, 54], [41, 35], [40, 50], [59, 35], [60, 50], [46, 74], [45, 94], [54, 74], [55, 94]],
    bud: [[50, 15], [50, 25], [50, 55], [43, 40], [49, 32], [57, 40], [51, 32], [46, 74], [45, 94], [54, 74], [55, 94]],
    castLow: [[46, 25], [48, 34], [50, 58], [42, 50], [34, 62], [45, 48], [37, 60], [42, 74], [36, 94], [58, 74], [64, 94]],
    rowboatB: [[52, 16], [52, 26], [50, 56], [54, 40], [58, 44], [52, 36], [58, 34], [64, 70], [70, 92], [42, 74], [32, 92]],
    // สไตล์อีสาน (ชุมชนบ้านกลาง ต.คำพี้ อ.นาแก จ.นครพนม)
    isWai: [[50, 14], [50, 24], [50, 54], [40, 38], [49, 28], [60, 38], [51, 28], [46, 74], [44, 94], [54, 74], [56, 94]],
    isUp: [[50, 16], [50, 26], [50, 56], [45, 13], [50, 1], [55, 13], [50, 1], [46, 74], [44, 94], [54, 74], [56, 94]],
    isOut: [[50, 14], [50, 24], [50, 54], [36, 30], [22, 38], [64, 30], [78, 38], [46, 74], [44, 94], [54, 74], [56, 94]],
    isSeat: [[48, 16], [48, 26], [42, 54], [50, 42], [62, 44], [52, 42], [64, 46], [60, 62], [58, 90], [60, 62], [58, 90]],
    isChop: [[48, 16], [48, 26], [42, 54], [48, 38], [54, 30], [52, 42], [64, 46], [60, 62], [58, 90], [60, 62], [58, 90]],
    isFwd: [[48, 15], [49, 25], [50, 54], [63, 31], [78, 31], [61, 34], [76, 35], [42, 72], [37, 94], [58, 72], [63, 94]],
    isElbow: [[48, 15], [49, 25], [50, 54], [60, 38], [50, 31], [61, 33], [60, 38], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShoulder: [[52, 16], [51, 26], [49, 55], [40, 40], [46, 27], [60, 40], [54, 27], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShL: [[47, 15], [49, 25], [51, 55], [62, 32], [77, 33], [42, 40], [46, 27], [42, 72], [37, 94], [58, 72], [63, 94]],
    isShR: [[53, 15], [51, 25], [49, 55], [58, 40], [54, 27], [62, 33], [77, 34], [42, 72], [37, 94], [58, 72], [63, 94]],
    isScoop: [[44, 36], [47, 43], [53, 62], [58, 56], [66, 72], [55, 56], [63, 74], [66, 77], [77, 94], [42, 79], [33, 94]],
    isLift: [[50, 14], [50, 24], [50, 54], [41, 21], [31, 10], [45, 25], [37, 15], [46, 74], [44, 94], [54, 74], [56, 94]],
    isPokeUp: [[50, 15], [50, 25], [50, 55], [61, 23], [69, 11], [40, 40], [44, 51], [42, 72], [37, 94], [58, 72], [63, 94]],
    isPokeLow: [[46, 18], [48, 27], [51, 55], [41, 44], [31, 58], [44, 42], [35, 54], [42, 72], [37, 94], [58, 72], [63, 94]],
    // ผ้าขาวม้าพาฟิต (สสส.) 22 poses
    pk01: [[50, 14], [50, 24], [50, 54], [38, 40], [46, 52], [62, 40], [54, 52], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk02: [[50, 14], [50, 24], [50, 54], [42, 44], [45, 31], [58, 44], [55, 31], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk03: [[50, 14], [50, 24], [50, 54], [34, 27], [46, 26], [66, 27], [54, 26], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk04: [[50, 12], [50, 23], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk05: [[54, 14], [50, 24], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk06: [[45, 15], [50, 24], [50, 54], [41, 42], [44, 34], [59, 42], [56, 34], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk07: [[50, 14], [50, 24], [50, 54], [35, 27], [21, 27], [65, 27], [79, 27], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk08: [[34, 46], [40, 38], [52, 54], [42, 58], [46, 80], [46, 24], [54, 8], [46, 74], [38, 94], [58, 74], [64, 94]],
    pk09: [[41, 18], [46, 26], [50, 55], [40, 40], [37, 55], [50, 10], [38, 4], [44, 74], [40, 94], [56, 74], [60, 94]],
    pk10: [[50, 16], [50, 26], [50, 56], [45, 13], [43, 2], [55, 13], [57, 2], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk11: [[50, 15], [50, 25], [50, 55], [35, 18], [45, 9], [65, 18], [55, 9], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk12: [[50, 13], [50, 24], [50, 54], [41, 42], [44, 33], [59, 42], [56, 33], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk13: [[50, 14], [50, 24], [50, 54], [40, 40], [43, 33], [60, 40], [57, 33], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk14: [[50, 14], [50, 24], [50, 54], [38, 38], [47, 41], [62, 38], [53, 41], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk15: [[50, 14], [50, 24], [50, 54], [40, 44], [46, 56], [60, 44], [54, 56], [45, 73], [43, 94], [55, 73], [57, 94]],
    pk16: [[50, 14], [50, 24], [50, 54], [62, 36], [58, 48], [40, 48], [34, 64], [46, 74], [44, 94], [54, 74], [56, 94]],
    pk17: [[54, 15], [52, 25], [45, 54], [55, 40], [62, 57], [57, 40], [64, 57], [58, 71], [54, 93], [56, 72], [50, 94]],
    pk18: [[55, 15], [52, 25], [45, 53], [56, 42], [62, 66], [58, 42], [64, 66], [58, 70], [55, 93], [56, 71], [50, 94]],
    pk19: [[50, 14], [50, 24], [50, 53], [42, 40], [53, 46], [60, 40], [60, 46], [58, 63], [60, 80], [50, 74], [50, 94]],
    pk20: [[50, 14], [50, 24], [50, 53], [43, 40], [54, 44], [60, 40], [60, 44], [58, 60], [58, 78], [50, 74], [50, 94]],
    pk21: [[52, 14], [52, 24], [50, 54], [40, 14], [46, 20], [60, 40], [58, 52], [52, 74], [51, 94], [52, 76], [36, 66]],
    pk22: [[46, 14], [48, 24], [50, 54], [66, 24], [80, 20], [40, 32], [52, 30], [44, 74], [40, 94], [56, 74], [60, 94]],
  };
  // ผ้าขาวม้า (checked waistcloth) drawn along a path, in front of the body
  const cloth = (d) => `<path d="${d}" stroke="#2f6fd0" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="#ffffff" stroke-width="6.5" stroke-dasharray="1.6 2.4" stroke-linecap="butt" stroke-linejoin="round" opacity=".6"/><path d="${d}" stroke="#7fb0ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const arrow = (d) => `<path d="${d}" stroke="#2f6fd0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  // maroon/red Isan sash (ผ้าเบี่ยง / ผ้าขาวม้าแดง) and props
  const sashR = (d) => `<path d="${d}" stroke="#8e2a3a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="#f2c14e" stroke-width="5.5" stroke-dasharray="1.2 3" opacity=".7"/>`;
  const sash = sashR("M57 25L44 52") + sashR("M41 53h18M52 54l2 10");
  const shrimpNet = (hx, hy, nx, ny) => `<path d="M${hx} ${hy}L${nx} ${ny}" stroke="#8a6a4f" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="${nx}" cy="${ny}" rx="8" ry="5" stroke="#5a6378" stroke-width="1.6"/><path d="M${nx - 7} ${ny + 2}Q${nx} ${ny + 14} ${nx + 7} ${ny + 2}" stroke="#5a6378" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>`;
  const antNest = (hx, hy, nx, ny) => `<path d="M${hx} ${hy}L${nx} ${ny}" stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"/><circle cx="${nx + 3}" cy="${ny - 3}" r="7" fill="#6ab565"/><path d="M${nx - 2} ${ny - 7}l4 3M${nx + 5} ${ny - 9}l-2 4M${nx + 7} ${ny - 1}l-4-1" stroke="#3f8a4a" stroke-width="1.4" stroke-linecap="round"/><circle cx="${nx + 1}" cy="${ny + 5}" r="1.6" fill="#f2c14e"/><circle cx="${nx + 5}" cy="${ny + 6}" r="1.4" fill="#f2c14e"/>`;
  const chair = `<path d="M16 26v32M14 58h30M18 58l-2 34M42 58l2 34" stroke="#8a6a4f" stroke-width="3.2" stroke-linecap="round"/><path d="M14 54h30" stroke="#b08a68" stroke-width="5" stroke-linecap="round"/>`;
  const FX = { sash, net1: shrimpNet(64, 73, 74, 90), net2: shrimpNet(34, 12, 18, 2), nest1: antNest(69, 11, 80, 0), nest2: antNest(33, 56, 20, 74) };

  /* ---------- motion engine: front-facing figures that move smoothly between key poses ---------- */
  // Each move is a list of key poses; the figure holds each pose, then eases (in-out) to the next and loops,
  // so patients can see the exact path of the movement. "~" mirrors a pose for the other side.
  const MIRROR_IDX = [0, 1, 2, 5, 6, 3, 4, 9, 10, 7, 8];
  const mirrorJ = (j) => MIRROR_IDX.map((k) => [100 - j[k][0], j[k][1]]);
  const MO = {
    walk: ["walkL", "N", "~walkL", "N"], march: ["N", "marchL", "N", "~marchL"], bike: ["=", "bike2"], squat: ["N", "squatF"],
    pushup: ["wallA", "wallB"], kneeExt: ["seatA", "seatB"], row: ["rowA", "rowB"], calf: ["N", "tiptoe"], bridge: ["bridgeDown", "="], curl: ["N", "="], reach: ["N", "="],
    hamstring: ["hamUp", "="], calfstretch: ["="], chest: ["N", "chestF"], side: ["~=", "N", "="], oneleg: ["N", "=", "N", "~="], tandem: ["="],
    shift: ["=", "~="], sitstand: ["=", "sitUp"],
    wai: ["N", "isUp", "="], shrug: ["N", "shrugF"], lotus: ["bud", "="], krathop: ["=", "~="], bamboo: ["=", "N", "~="], bird: ["N", "=", "N", "~="],
    ramthai: ["=", "~="], boxing: ["=", "~="], rowboat: ["rowboatB", "="], castnet: ["castLow", "="], rice: ["N", "="], sky: ["N", "="],
    pk05: ["=", "~="], pk06: ["=", "~="], pk08: ["=", "~="], pk09: ["=", "~="], pk16: ["=", "~="], pk22: ["=", "~="], pk19: ["N", "=", "N", "~="], pk20: ["N", "=", "N", "~="], pk21: ["N", "=", "N", "~="],
  };
  const clothN = () => cloth("M45 54h10M45 55v12M55 55v12");
  function motionFor(cat, idx) {
    const e = PROGRAMS[cat].list[idx], extraAll = e.x && e.p !== "squat" ? e.x : "";
    const wrapM = (svg) => (svg ? `<g transform="translate(100 0) scale(-1 1)">${svg}</g>` : "");
    if (e.frames) return e.frames.map((f) => ({ j: P[f.p], front: f.fx ? FX[f.fx] : "", extra: f.x === "chair" ? chair : "" }));
    const seq = MO[e.p] || ["N", "="];
    return seq.map((tok) => {
      const m = tok.startsWith("~"), key = m ? tok.slice(1) : tok;
      let j, front = "";
      if (key === "=") { j = P[e.p]; front = e.fx || ""; }
      else if (key === "N") { j = cat === "pakhaoma" ? P.pkN : P.standF; front = cat === "pakhaoma" ? clothN() : ""; }
      else j = P[key];
      return { j: m ? mirrorJ(j) : j, front: m ? wrapM(front) : front, extra: extraAll };
    });
  }
  const ANIMS = new Set();
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animIO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((x) => { if (x.target._anim) x.target._anim.vis = x.isIntersecting; })) : null;
  class FigAnim {
    constructor(host, frames, v = 0, opts = {}) {
      this.host = host; this.frames = frames.filter((f) => f.j); this.t = 0; this.vis = true; this.c = PAL[v % PAL.length];
      this.hold = opts.hold ?? 0.7; this.move = opts.move ?? 1.1;
      const parts = bodyParts(this.frames[0].j, this.c);
      host.innerHTML = `<svg viewBox="-4 -4 108 108" aria-hidden="true">${opts.noBlob ? "" : `<circle cx="52" cy="54" r="38" fill="#fff" opacity=".38"/>`}
        ${this.frames.map((f, i) => `<g data-x="${i}" fill="none" opacity="${i ? 0 : 1}">${f.extra || ""}</g>`).join("")}
        ${parts.map((q, i) => partSVG(q, i)).join("")}
        ${this.frames.map((f, i) => `<g data-f="${i}" fill="none" opacity="${i ? 0 : 1}">${f.front || ""}</g>`).join("")}</svg>`;
      this.paths = [...host.querySelectorAll("[data-p]")];
      this.gx = [...host.querySelectorAll("[data-x]")]; this.gf = [...host.querySelectorAll("[data-f]")];
      host._anim = this; if (animIO) animIO.observe(host);
      const last = this.frames.length - 1;
      if (REDUCE || this.frames.length < 2) this.render(this.frames[last].j, this.frames.map((_, i) => (i === last ? 1 : 0)));
      else { this.step(0); ANIMS.add(this); }
    }
    step(dt) {
      const F = this.frames, n = F.length, per = this.hold + this.move; this.t += dt;
      const tt = this.t % (per * n), i = Math.floor(tt / per), r = tt - i * per, k = (i + 1) % n, w = F.map(() => 0);
      if (r < this.hold) { w[i] = 1; return this.render(F[i].j, w); }
      const u = (r - this.hold) / this.move, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      w[i] = 1 - e; w[k] = e;
      this.render(F[i].j.map((p, q) => [p[0] + (F[k].j[q][0] - p[0]) * e, p[1] + (F[k].j[q][1] - p[1]) * e]), w);
    }
    render(J, w) {
      bodyParts(J, this.c).forEach((q, i) => { const el = this.paths[i]; if (!el) return; el.setAttribute("d", q.d); if (q.op != null) el.setAttribute("opacity", q.op); });
      this.gx.forEach((g, i) => g.setAttribute("opacity", w[i].toFixed(2))); this.gf.forEach((g, i) => g.setAttribute("opacity", w[i].toFixed(2)));
    }
  }
  function mountAnims(root) {
    root.querySelectorAll("[data-mo]").forEach((el) => { const [cat, idx] = el.dataset.mo.split(":"); if (PROGRAMS[cat]?.list[+idx]) new FigAnim(el, motionFor(cat, +idx), +idx, { noBlob: el.dataset.noblob === "1" }); });
  }
  let animLast = performance.now();
  (function animLoop(now) {
    const dt = Math.min(0.1, (now - animLast) / 1000); animLast = now;
    ANIMS.forEach((a) => { if (!a.host.isConnected) { ANIMS.delete(a); animIO?.unobserve(a.host); return; } if (a.vis) a.step(dt); });
    requestAnimationFrame(animLoop);
  })(animLast);
  const PROGRAMS = {
    aerobic: {
      label: "แอโรบิก", why: "เพิ่มความไวต่ออินซูลิน ลดระดับน้ำตาลหลังอาหาร และช่วยลดน้ำหนัก",
      fitt: [["ความถี่", "3–7 วัน/สัปดาห์ ห้ามเว้นเกิน 2 วัน"], ["ความหนัก", "ปานกลาง: พูดได้แต่ร้องเพลงไม่ได้ (RPE 11–13)"], ["เวลา", "สะสม 150 นาที/สัปดาห์ ครั้งละ ≥10 นาที"], ["ชนิด", "เดินเร็ว ปั่นจักรยาน ว่ายน้ำ รำไม้พลอง"]],
      list: [
        { n: "เดินเร็ว", p: "walk", d: "ลำตัวตั้งตรง ก้าวเท้ายาวและเร็วขึ้น แกว่งแขนสลับกับขา (ขาซ้ายก้าว แขนขวาแกว่งไปหน้า) หายใจเร็วขึ้นแต่ยังพูดเป็นประโยคได้", dose: "30 นาที · 5 วัน", m: 30 },
        { n: "เดินหลังอาหาร", p: "walk", d: "เดินสบาย ๆ ไม่ต้องเร่ง ลำตัวตั้งตรง แกว่งแขนเบา ๆ เริ่มภายใน 30 นาทีหลังมื้ออาหาร ช่วยลดน้ำตาลหลังอาหารได้ชัดเจน", dose: "10–15 นาที · หลังทุกมื้อ", m: 15 },
        { n: "ย่ำเท้ายกเข่า", p: "march", d: "ยืนตัวตรงบนขาข้างหนึ่ง ยกเข่าอีกข้างขึ้นสูงระดับสะโพก พร้อมยกแขนฝั่งตรงข้ามขึ้น แล้วสลับข้างเป็นจังหวะ ทำในบ้านได้ (มีเก้าอี้ไว้จับถ้าทรงตัวไม่มั่นใจ)", dose: "3 นาที × 3–5 รอบ", m: 15, track: "march" },
        { n: "ปั่นจักรยาน", p: "bike", d: "นั่งหลังตรง มือจับแฮนด์ทั้งสองข้าง ปั่นด้วยฝ่าเท้าส่วนหน้า ให้เข่าเกือบเหยียดสุดเมื่อบันไดอยู่ต่ำสุด ใช้จักรยานอยู่กับที่หรือนอกบ้าน แรงต้านต่ำถึงปานกลาง ดีต่อผู้ที่ปวดเข่า", dose: "20–30 นาที", m: 25 },
      ],
    },
    strength: {
      label: "เสริมสร้างความแข็งแรง", why: "เพิ่มมวลกล้ามเนื้อ ซึ่งเป็นแหล่งใช้กลูโคสหลักของร่างกาย",
      fitt: [["ความถี่", "2–3 วัน/สัปดาห์ ไม่ติดกัน"], ["ความหนัก", "ปานกลาง ทำได้ 10–15 ครั้งแล้วรู้สึกล้า"], ["ปริมาณ", "1–3 เซต ท่าละ 10–15 ครั้ง พัก 1–2 นาที"], ["ชนิด", "น้ำหนักตัว ยางยืด ดัมเบล ขวดน้ำ"]],
      list: [
        { n: "สควอทโดยใช้เก้าอี้", p: "squat", x: chair, d: "ยืนหน้าเก้าอี้ เท้าแยกช่วงสะโพก เหยียดแขนไปด้านหน้าช่วยทรงตัว ย่อสะโพกไปด้านหลังจนก้นแตะเก้าอี้เบา ๆ แล้วลุกขึ้นยืนตรง หลังตรง เข่าไม่เลยปลายเท้า", dose: "2–3 เซต × 10–15 ครั้ง", m: 10, track: "squat" },
        { n: "วิดพื้นกับผนัง", p: "pushup", d: "ยืนห่างผนังประมาณหนึ่งช่วงแขน มือยันผนังระดับไหล่ ลำตัวตรงเป็นแนวเดียวตั้งแต่ศีรษะถึงส้นเท้า งอศอกให้อกเข้าใกล้ผนัง แล้วดันกลับ", dose: "2–3 เซต × 10–15 ครั้ง", m: 8 },
        { n: "ดึงยางยืด", p: "curl", d: "ยืนเหยียบกึ่งกลางยางยืด เท้าแยกช่วงไหล่ มือจับปลายยางทั้งสองข้าง ข้อศอกแนบลำตัว งอศอกดึงยางขึ้นมาระดับไหล่ แล้วค่อย ๆ ลดลง", dose: "2–3 เซต × 12 ครั้ง", m: 8 },
        { n: "เขย่งปลายเท้า", p: "calf", d: "ยืนตรงข้างเก้าอี้ มือจับพนักเก้าอี้ เขย่งส้นเท้าขึ้นช้า ๆ ให้สูงที่สุด ค้าง 2 วินาที แล้วลดลงช้า ๆ", dose: "2 เซต × 15 ครั้ง", m: 5 },
        { n: "ยกสะโพก", p: "bridge", d: "นอนหงายบนเสื่อ ชันเข่า เท้าวางราบ แขนวางข้างลำตัว เกร็งก้นและหน้าท้อง ยกสะโพกขึ้นจนไหล่ถึงเข่าเป็นแนวตรง ค้าง 2–3 วินาที แล้วลดลงช้า ๆ", dose: "2 เซต × 12 ครั้ง", m: 6 },
        { n: "นั่งแตะเข่า", p: "kneeExt", x: chair, d: "นั่งเก้าอี้หลังตรง มือจับขอบเก้าอี้ เหยียดเข่าข้างหนึ่งยกขาขึ้นจนตรง กระดกปลายเท้าเข้าหาตัว ค้าง 2–3 วินาที แล้ววางลงช้า ๆ ทำสลับข้าง (ใส่ถุงทรายที่ข้อเท้าเพื่อเพิ่มความยากได้)", dose: "ข้างละ 10–15 ครั้ง × 2 เซต", m: 6 },
      ],
    },
    flex: {
      label: "ยืดเหยียดกล้ามเนื้อ", why: "เพิ่มพิสัยการเคลื่อนไหวของข้อ ลดการบาดเจ็บ ทำหลังอบอุ่นร่างกายหรือหลังออกกำลังกาย",
      fitt: [["ความถี่", "2–3 วัน/สัปดาห์ หรือทุกวัน"], ["ความหนัก", "ตึงพอดี ไม่เจ็บ"], ["เวลา", "ค้างท่าละ 10–30 วินาที ทำ 2–4 ครั้ง"], ["ชนิด", "ยืดแบบค้างนิ่ง ไม่กระตุก"]],
      source: ["10 ท่าพื้นฐานยืดเหยียดร่างกาย · ศูนย์เรียนรู้สุขภาวะ (สสส.) / thaijoggingclub.or.th", "https://www.thaijoggingclub.or.th"],
      list: [
        { n: "ยืดคอ", p: "standF", type: "flex", d: "นั่งหรือยืนหลังตรง ตามองไปข้างหน้า ค่อย ๆ เอียงศีรษะไปด้านข้าง พยายามให้หูเข้าใกล้ไหล่ ไม่ยกไหล่ขึ้นตาม ค้างไว้แล้วสลับข้าง", dose: "ค้าง 15–30 วิ ข้างละ 2 ครั้ง", m: 1 },
        { n: "ยืดต้นแขน", p: "side", type: "flex", d: "ยกแขนข้างหนึ่งงอข้ามศีรษะ ใช้มืออีกข้างจับข้อศอกที่ข้ามศีรษะ ค่อย ๆ ดึงข้อศอกลงจนรู้สึกตึงต้นแขนด้านหลัง ค้างไว้แล้วสลับข้าง", dose: "ค้าง 15–30 วิ ข้างละ 2 ครั้ง", m: 1 },
        { n: "ยืดอก", p: "chest", type: "flex", d: "ประสานนิ้วมือไว้ด้านหลัง ค่อย ๆ ยกแขนขึ้นเท่าที่ทำได้ เปิดอก ไหล่ไม่ยก ค้างไว้แล้วปล่อยลง", dose: "ค้าง 15–30 วิ × 2 ครั้ง", m: 1 },
        { n: "ยืดหลังส่วนบน", p: "reach", type: "flex", d: "ประสานนิ้วมือ ยื่นแขนไปด้านหน้าระดับหัวไหล่ หันฝ่ามือออกด้านนอก ดันแขนให้ตึง ห่อไหล่เล็กน้อยให้หลังส่วนบนยืด", dose: "ค้าง 15–30 วิ × 2 ครั้ง", m: 1 },
        { n: "ยืดลำตัว", p: "side", type: "flex", d: "ยืนแยกขาประมาณช่วงไหล่ ยกแขนขึ้น จับข้อศอกไขว้กันเหนือศีรษะ แล้วโน้มตัวไปด้านข้างช้า ๆ ทีละข้าง ไม่บิดตัว", dose: "ค้าง 15–30 วิ ข้างละ 2 ครั้ง", m: 1 },
        { n: "ยืดต้นขาด้านหน้า", p: "oneleg", type: "flex", d: "ยืนหันหน้าเข้ากำแพงหรือจับพนักเก้าอี้ มือข้างหนึ่งเท้าไว้ อีกมือคว้าข้อเท้าข้างเดียวกันดึงขึ้นไปด้านหลัง เข่าชิดกัน ค้างไว้จนตึงหน้าขา", dose: "ค้าง 15–30 วิ ข้างละ 2 ครั้ง", m: 1 },
        { n: "ยืดน่อง", p: "calfstretch", type: "flex", d: "มือยันกำแพง หลังตรง เหยียดขาข้างที่ยืดไปด้านหลัง ส้นเท้าติดพื้น ค่อย ๆ ดันสะโพกไปด้านหน้าจนรู้สึกตึงที่น่อง", dose: "ค้าง 15–30 วิ ข้างละ 2 ครั้ง", m: 1 },
        { n: "ยืดต้นขาด้านใน", p: "sitUp", type: "flex", d: "นั่งพื้น หลังตรง ประกบฝ่าเท้าเข้าหากัน จับข้อเท้าไว้ ค่อย ๆ กดเข่าลงไปทางพื้นเท่าที่ทำได้ ไม่กระแทก", dose: "ค้าง 15–30 วิ × 2 ครั้ง", m: 1 },
        { n: "ยืดเอ็นหลังเข่า", p: "hamstring", type: "flex", d: "นั่งพื้นเหยียดเข่าให้ตรง มือจับปลายเท้า (หรือแตะหน้าแข้งถ้าเอื้อมไม่ถึง) ค่อย ๆ โน้มตัวให้เอวไปแตะต้นขา แขนและขาเหยียดตรง", dose: "ค้าง 15–30 วิ × 2 ครั้ง", m: 1 },
        { n: "ยืดหลังส่วนล่าง", p: "bridgeDown", type: "flex", d: "นอนหงาย สอดมือไว้หลังต้นขา ดึงเข่าทั้งสองข้างเข้ามาใกล้อก กดหลังส่วนล่างให้แนบติดพื้น หายใจปกติ", dose: "ค้าง 15–30 วิ × 2 ครั้ง", m: 1 },
      ],
    },
    balance: {
      label: "การทรงตัว", why: "Otago exercise — โปรแกรมออกกำลังกายป้องกันการหกล้มในผู้สูงอายุ ลดการล้มได้ 35–40% ประกอบด้วย 17 ท่า เพิ่มความแข็งแรงของกล้ามเนื้อขาและการทรงตัว เตรียมพร้อมกรณีปลายประสาทเสื่อมจากเบาหวานในอนาคต",
      source: ["Otago exercise · ศูนย์กายภาพบำบัด คณะกายภาพบำบัด ม.มหิดล (เรียบเรียงและภาพประกอบโดย กภ.พงศธร ปาลี)", "https://www.facebook.com/photo/?fbid=4394206064025428&set=pcb.4394213637358004"],
      full: { name: "Otago exercise ครบ 17 ท่า", minutes: 45, type: "balance" },
      fitt: [["ความถี่", "3 ครั้ง/สัปดาห์"], ["เวลา", "ครั้งละ 45 นาที แบ่งทำเป็นช่วง ๆ ได้"], ["ระดับความยาก", "1 จับด้วยมือ 2 ข้าง → 2 จับมือข้างเดียว → 3 ปล่อยมือ"], ["ข้อควรระวัง", "เก้าอี้/โต๊ะที่จับต้องมั่นคง ไม่กลั้นหายใจ หยุดทันทีถ้าปวดเพิ่ม วิงเวียน แน่นหน้าอก หายใจไม่สะดวก"]],
      list: [
        { n: "เตะขาไปด้านหน้า", p: "sitUp", type: "strength", d: "นั่งเก้าอี้หลังตรง มือจับขอบเก้าอี้ เตะขาข้างหนึ่งไปด้านหน้าจนเข่าเหยียดตรง ค้างสักครู่ แล้ววางลงช้า ๆ ทำทีละข้าง (ใส่ถุงทรายที่ข้อเท้าเพื่อเพิ่มความยากได้)", dose: "ข้างละ 10 ครั้ง", m: 2 },
        { n: "งอเข่าไปด้านหลัง", p: "hamUp", type: "strength", d: "ยืนจับโต๊ะหรือพนักเก้าอี้ งอเข่าข้างหนึ่งยกส้นเท้าขึ้นไปด้านหลัง ต้นขาตั้งตรง แล้ววางลงช้า ๆ ทำทีละข้าง", dose: "ข้างละ 10 ครั้ง", m: 2 },
        { n: "กางขาไปด้านข้าง", p: "shift", type: "strength", d: "ยืนตรงจับโต๊ะ มืออีกข้างเท้าเอว กางขาข้างหนึ่งออกด้านข้าง ลำตัวตรง ไม่เอียงตัว แล้วกลับท่าเดิม ทำทีละข้าง", dose: "ข้างละ 10 ครั้ง", m: 2 },
        { n: "เขย่งส้นเท้าขึ้น", p: "tiptoe", type: "strength", d: "ยืนตรงจับโต๊ะ เท้าแยกเล็กน้อย เขย่งส้นเท้าขึ้นให้สูงที่สุด แล้วค่อย ๆ ลดลง", dose: "20 ครั้ง", m: 2 },
        { n: "กระดกปลายเท้าขึ้น", p: "standF", type: "strength", d: "ยืนตรงจับโต๊ะ ยืนบนส้นเท้า กระดกปลายเท้าทั้งสองข้างขึ้น แล้วค่อย ๆ วางลง", dose: "20 ครั้ง", m: 2 },
        { n: "งอเข่าแล้วเหยียดตัวขึ้น", p: "squatF", type: "strength", d: "ยืนจับโต๊ะ ย่อเข่าลงเล็กน้อยโดยเข่าไม่เลยปลายเท้า หลังตรง แล้วเหยียดตัวขึ้นยืนตรง", dose: "10 ครั้ง", m: 2 },
        { n: "เดินถอยหลัง", p: "walk", type: "balance", d: "ยืนข้างโต๊ะหรือราวจับ เดินถอยหลังช้า ๆ ทีละก้าว มองตรงไปข้างหน้า แล้วหันกลับเดินไปข้างหน้า", dose: "10 ก้าว", m: 2 },
        { n: "เดินเป็นรูปเลขแปด", p: "walk", type: "balance", d: "เดินเป็นวงรูปเลขแปด ทั้งทวนเข็มและตามเข็มนาฬิกา เริ่มจากวงกว้าง ๆ เดินช้า ๆ มีคนดูแลอยู่ใกล้", dose: "10 รอบ", m: 3 },
        { n: "เดินไปด้านข้าง", p: "shift", type: "balance", d: "มือเท้าเอว เดินก้าวเท้าไปด้านข้างช้า ๆ 10 ก้าว แล้วเดินกลับอีกทาง ลำตัวตรง ไม่ไขว้เท้า", dose: "ข้างละ 10 ก้าว", m: 2 },
        { n: "ยืนต่อเท้า", p: "tandem", type: "balance", d: "ยืนข้างโต๊ะ วางเท้าหนึ่งไว้ข้างหน้าอีกเท้า ส้นเท้าชิดปลายเท้าเป็นเส้นตรง ค้างไว้ แล้วสลับเท้าหน้า", dose: "ค้าง 10 วิ สลับเท้า", m: 1 },
        { n: "เดินต่อเท้า", p: "tandem", type: "balance", d: "เดินข้างโต๊ะหรือราวจับ วางส้นเท้าหน้าชิดปลายเท้าหลังทุกก้าวเหมือนเดินบนเส้นตรง มองไปข้างหน้า", dose: "10 ก้าว", m: 2 },
        { n: "ยืนขาเดียว", p: "oneleg", type: "balance", d: "ยืนข้างโต๊ะ ยกเท้าข้างหนึ่งพ้นพื้น ค้างไว้ แล้วสลับข้าง เริ่มจากจับโต๊ะ 2 มือ แล้วค่อย ๆ ลดเป็นมือเดียวและปล่อยมือ", dose: "ค้าง 10 วิ ข้างละ", m: 1, track: "balance" },
        { n: "เดินด้วยส้นเท้า", p: "walk", type: "balance", d: "เดินข้างโต๊ะหรือราวจับ ยกปลายเท้าขึ้น เดินด้วยส้นเท้าช้า ๆ", dose: "10 ก้าว", m: 2 },
        { n: "เดินด้วยปลายเท้า", p: "tiptoe", type: "balance", d: "เดินข้างโต๊ะหรือราวจับ เขย่งเท้า เดินด้วยปลายเท้าช้า ๆ", dose: "10 ก้าว", m: 2 },
        { n: "เดินต่อเท้าถอยหลัง", p: "tandem", type: "balance", d: "เดินถอยหลังโดยวางปลายเท้าหลังชิดส้นเท้าหน้าทุกก้าว ทำช้า ๆ ข้างโต๊ะหรือราวจับ มีคนดูแลอยู่ใกล้", dose: "10 ก้าว", m: 2 },
        { n: "นั่งแล้วลุกขึ้นยืน", p: "sitstand", type: "strength", d: "นั่งเก้าอี้ที่มั่นคง เท้าวางราบ โน้มตัวไปข้างหน้าแล้วลุกขึ้นยืนตรง จากนั้นค่อย ๆ นั่งลง ระดับยากขึ้นให้ลุกโดยไม่ใช้มือ", dose: "10 ครั้ง", m: 2 },
        { n: "เดินขึ้น-ลงบันได", p: "march", type: "balance", d: "จับราวบันไดทุกครั้ง ก้าวขึ้น-ลงบันไดช้า ๆ ทีละขั้น เท่าที่ทำได้อย่างปลอดภัย", dose: "ขึ้น-ลงตามความสามารถ", m: 3 },
      ],
    },
    isan: {
      label: "สไตล์อีสาน", why: "ท่าออกกำลังกายสไตล์อีสานจากชุมชน เคลื่อนไหวตามจังหวะชีวิต ได้ทั้งร่างกายและสืบสานวัฒนธรรม ทำตามจังหวะกลองหรือแคน 4 จังหวะต่อการเปลี่ยนท่า เพื่อให้ออกกำลังกายได้สม่ำเสมอ 150 นาที/สัปดาห์ ลดระดับน้ำตาลและรอบเอว",
      source: ["โครงการส่งเสริมสุขภาพเพื่อป้องกันเบาหวานในกลุ่มเสี่ยง ชุมชนบ้านกลาง ม.6 ต.คำพี้ อ.นาแก จ.นครพนม (รพ.นาแก · รพ.สต.คำพี้ · สสส.)", ""],
      full: { name: "ออกกำลังกายสไตล์อีสาน ครบ 7 ท่า", minutes: 15, type: "aerobic" },
      fitt: [["จังหวะ", "ตามกลองหรือแคน 4 จังหวะต่อการเปลี่ยนท่า"], ["ความหนัก", "เบาถึงปานกลาง ยังพูดคุยได้"], ["เวลา", "ครบชุด 10–15 นาที ทำซ้ำได้ 2 รอบ"], ["เป้าหมาย", "สะสม 150 นาที/สัปดาห์ ลดน้ำตาลและรอบเอว"]],
      list: [
        { n: "ท่าเป่ามนต์", p: "isWai", type: "flex", frames: [{ p: "isWai" }, { p: "isUp" }, { p: "isOut" }], img: "assets/isan/01.jpg", wide: true, d: "① ยืนตรง พนมมือไว้ที่กลางอก หายใจเข้าลึก ๆ อย่างช้า ๆ ค่อย ๆ จนสุดลม ② หายใจเข้าพร้อมกับชูแขนขึ้นเหนือศีรษะ ③ เหยียดตัวให้ตรง หมุนไหล่และบ่า แล้วค่อย ๆ หมุนไหล่ออกด้านข้างลงมาจนสุด พร้อมหายใจออกทางปาก ค่อย ๆ เป่าลมออกมา (เหมือนการเป่ามนต์)", dose: "ทำช้า ๆ 5–8 ครั้ง", m: 1 },
        { n: "ท่าฟักลาบ", p: "isSeat", type: "strength", frames: [{ p: "isSeat", x: "chair" }, { p: "isChop", x: "chair" }], img: "assets/isan/02.jpg", wide: true, d: "(ฟักลาบก้อย) ① ยืนหลังตรง วางเท้าทั้งสองข้างให้มั่นคง แยกเท้ากว้างประมาณช่วงไหล่ มือทั้งสองกำหลวม ๆ ไว้ระดับอก ② งอศอกขวายกขึ้นหาไหล่ขวา พร้อมกระดกข้อมือขวาขึ้น ส่วนแขนซ้ายพักไว้ระดับอกเหมือนท่าแรก ③ สลับเป็นงอศอกซ้ายขึ้นหาไหล่ซ้าย พร้อมกระดกข้อมือซ้ายขึ้น ส่วนแขนขวาพักไว้ระดับอก ④ ทำสลับซ้าย-ขวาขึ้นลงอย่างต่อเนื่อง ควบคุมการเคลื่อนไหว ไม่เหวี่ยงแขนกว้าง (ทำแบบนั่งเก้าอี้ได้ถ้ายืนนานไม่ไหว)", dose: "สลับข้าง 10–16 ครั้ง", m: 1 },
        { n: "ท่าเซิ้งแตะศอก", p: "isFwd", type: "flex", frames: [{ p: "isFwd", fx: "sash" }, { p: "isElbow", fx: "sash" }], img: "assets/isan/03.jpg", wide: true, d: "① ยืนหรือนั่งหลังตรง แขนทั้งสองข้างอยู่ในท่าเตรียม (มือเท้าเอว) ② เหยียดข้อศอกทั้งสองข้างออกด้านหน้าให้ตรง ③ งอศอกซ้าย ใช้มือขวาแตะใต้ศอกซ้าย จากนั้นงอศอกขวา ใช้มือซ้ายแตะ สลับซ้าย-ขวาอย่างช้า ๆ แล้วกลับสู่ท่าเตรียม", dose: "สลับข้าง 8–10 ครั้ง", m: 1 },
        { n: "ท่าเซิ้งแตะไหล่สองข้าง", p: "isFwd", type: "aerobic", frames: [{ p: "isFwd", fx: "sash" }, { p: "isShoulder", fx: "sash" }], img: "assets/isan/04.jpg", wide: true, d: "① ยื่นแขนทั้งสองข้างไปด้านหน้า ระดับประมาณอก ② งอศอกให้ปลายมือแตะไหล่ทั้งสองข้างพร้อมกัน ③ โยกตัวและก้าวเท้าเล็ก ๆ ซ้าย-ขวาแบบเซิ้งอีสาน ทำซ้ำเป็นจังหวะต่อเนื่อง", dose: "ตามจังหวะเพลง 1–2 นาที", m: 2 },
        { n: "ท่าเซิ้งแตะไหล่สลับข้าง", p: "isShL", type: "aerobic", frames: [{ p: "isShL", fx: "sash" }, { p: "isFwd", fx: "sash" }, { p: "isShR", fx: "sash" }], img: "assets/isan/05.jpg", wide: true, d: "① ยืนแยกเท้าประมาณช่วงไหล่ เข่างอเล็กน้อย เหยียดแขนทั้งสองข้างไปด้านหน้าให้สุด ระดับประมาณอก ② งอศอกซ้ายแตะไหล่ซ้าย (แขนขวาเหยียดอยู่ข้างหน้า) แล้วสลับงอศอกขวาแตะไหล่ขวา (แขนซ้ายเหยียดอยู่ข้างหน้า) ③ ทำสลับซ้าย-ขวาอย่างต่อเนื่อง พร้อมโยกตัวและก้าวเท้าเล็กน้อยแบบเซิ้งอีสาน เพื่อความสนุก", dose: "ตามจังหวะเพลง 1–2 นาที", m: 2 },
        { n: "ท่าซ้อนกุ้ง", p: "isScoop", type: "strength", frames: [{ p: "isScoop", fx: "net1" }, { p: "isLift", fx: "net2" }], img: "assets/isan/06.jpg", wide: true, d: "① ก้าวเท้าขวาออก ย่อเข่าลงต่ำ ถ่ายน้ำหนักไปที่ขาขวา มือถือสวิงลดลงมาใกล้พื้นข้างเท้าขวา ② ใช้ขาขวาดันพื้นยืดเข่าขึ้น พร้อมยกสวิงจากต่ำด้านขวาขึ้นไปสูงด้านซ้ายเหนือไหล่ สายตามองตามมือ ③ เขย่าสวิงเบา ๆ 2 ครั้ง แกว่งขึ้น-ลง พร้อมเด้งเข่าตามจังหวะลีลาแบบอีสาน ④ ปล่อยแขนลง ดึงเท้าขวากลับมายืนตรง แล้วเปลี่ยนทำอีกข้าง", dose: "ข้างละ 5–8 ครั้ง", m: 2 },
        { n: "ท่าแหย่ไข่มดแดง", p: "isPokeUp", type: "aerobic", frames: [{ p: "isPokeUp", fx: "nest1" }, { p: "isPokeLow", fx: "nest2" }], img: "assets/isan/07.jpg", wide: true, d: "(ท่าแหย่ไข่แดง หรือเจิงแหย่ไข่แดง) ① ยืนแยกเท้ากว้างกว่าไหล่ เข่างอเล็กน้อย ② ยื่นมือขวาไปข้างหน้า นิ้วหัวแม่มือชี้ขึ้น เหมือนจะแหย่ไข่มดแดงที่อยู่ตรงหน้า พร้อมย่อเข่าลง ③ ดึงมือกลับ แล้วใช้มือซ้ายแหย่ไปด้านหน้า ทำสลับกัน ④ ทุก 4 จังหวะ ให้หมุนเอวเอียงไปด้านข้าง ⑤ แหย่ไม้ต่ำลง เหมือนไข่มดแดงอยู่กิ่งต่ำ เพื่อใช้ช่วงลำตัวและแกนกลางลำตัว", dose: "ตามจังหวะเพลง 1–2 นาที", m: 2 },
      ],
    },
    pakhaoma: {
      label: "ผ้าขาวม้าพาฟิต", why: "ใช้ผ้าขาวม้าผืนเดียวช่วยดึง ดัน เหนี่ยว และยืดกล้ามเนื้ออย่างช้า ๆ ไม่มีแรงกระแทก ช่วยพยุงกล้ามเนื้อและการทรงตัว เหมาะกับทุกวัยโดยเฉพาะผู้สูงอายุ เริ่มจากเบา ๆ แล้วค่อยเพิ่มเวลาจนทำได้ 30 นาที",
      source: ["สสส. · ขาวม้าพาฟิต เหยียดยืดร่างกายด้วยผ้าขาวม้า (พัฒนาท่าโดย อ.วิชิต ชี้เชิญ ครูภูมิปัญญาไทย)", ""],
      full: { name: "ผ้าขาวม้าพาฟิต ครบ 22 ท่า", minutes: 15, type: "flex" },
      fitt: [["อุปกรณ์", "ผ้าขาวม้า 1 ผืน (ราว 80×200 ซม.) พับตามยาว"], ["จำนวน", "ท่าละ 8 ครั้ง ส่วนใหญ่ทำ 2 รอบ"], ["เวลา", "ครบ 22 ท่า ประมาณ 10–15 นาที/รอบ"], ["ข้อควรระวัง", "ทำช้า ๆ หายใจออกขณะดึง ไม่กลั้นหายใจ"]],
      list: [
        { n: "บิดข้อมือ", p: "pk01", type: "flex", fx: `${cloth("M46 52h8M44 53l-3 17M56 53l3 17")}`, d: "ยืนแยกเท้าประมาณช่วงไหล่ จับผ้าด้วยสองมือระดับเอว บิดผ้าไปทางซ้ายและขวาสลับกันช้า ๆ บริหารข้อมือและนิ้วมือ", dose: "8 ครั้ง", m: 1 },
        { n: "พับศอก", p: "pk02", type: "flex", fx: `${cloth("M45 31h10M45 32l-3 15M55 32l3 15")}`, d: "จับผ้าระดับเอว พับศอกยกผ้าขึ้นมาระดับอกแล้วลดลง บริหารกล้ามเนื้อหน้าแขนและข้อศอก", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "ยกไหล่", p: "pk03", type: "flex", fx: `${cloth("M46 26h8M46 27v19M54 27v19")}`, d: "คว่ำมือจับผ้า ยกขึ้นระดับไหล่ ศอกขนานพื้น หายใจเข้าลึกขณะยกแขน แล้วผ่อนลง บริหารไหล่และขยายปอด", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "ก้มเงย", p: "pk04", type: "flex", fx: `${cloth("M44 34L46 22Q50 19 54 22L56 34M44 35v13M56 35v13")}${arrow("M38 12v-7M36 7l2-3 2 3")}`, d: "พาดผ้าที่คอ เงยหน้าช้า ๆ พร้อมดึงผ้าลงต้านไว้ กลับมาตั้งตรง แล้วก้มหน้าพร้อมดึงผ้า หายใจออกขณะดึง บริหารคอและนิ้วมือ", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "หันซ้าย-ขวา", p: "pk05", type: "flex", fx: `${cloth("M44 34L46 22Q50 19 54 22L56 34M44 35v13M56 35v13")}${arrow("M64 12h7M68 10l3 2-3 2")}`, d: "พาดผ้าที่ไหล่ หันหน้าไปข้างหนึ่งช้า ๆ พร้อมดึงผ้าลงให้ตึง กลับมาตั้งตรงแล้วหันอีกข้าง บริหารคอ ไหล่ และต้นแขน", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "เอียงคอซ้าย-ขวา", p: "pk06", type: "flex", fx: `${cloth("M44 34L46 22Q50 19 54 22L56 34M44 35v13M56 35v13")}${arrow("M36 8q-3 4 0 8")}`, d: "พาดผ้าที่ไหล่ เอียงคอไปข้างหนึ่งช้า ๆ พร้อมดึงผ้าลงต้าน กลับมาตั้งตรง แล้วเอียงอีกข้าง", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "กางแขนบิดตัว", p: "pk07", type: "flex", fx: `${cloth("M21 27L50 22L79 27M21 28v13M79 28v13")}`, d: "พาดผ้าที่ไหล่ กางแขนดึงผ้าให้ตึง บิดลำตัวไปข้างหนึ่งช้า ๆ กลับตรง แล้วบิดอีกข้าง ผ้าที่ตึงช่วยไม่ให้บิดเกินจนบาดเจ็บ", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "กางแขนแตะขา", p: "pk08", type: "flex", fx: `${cloth("M54 8L42 38L46 80")}`, d: "กางแขนดึงผ้าที่พาดไหล่ บิดลำตัวก้มลงให้มือแตะเท้าข้างตรงข้าม กลับตั้งตรงแล้วทำอีกข้าง บริหารเอว ไหล่ และการทรงตัว", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "กางแขนเอียงข้าง", p: "pk09", type: "flex", fx: `${cloth("M38 4L46 24L37 55")}`, d: "กางแขนดึงผ้าที่พาดไหล่ เอียงลำตัวไปด้านข้างช้า ๆ กลับตรงแล้วเอียงอีกข้าง ยืดลำตัวด้านข้างและสะโพก", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "ยกเหยียด", p: "pk10", type: "flex", fx: `${cloth("M43 2h14M43 3v15M57 3v15")}`, d: "คว่ำมือจับผ้า ชูแขนขึ้นจนสุด เอนไปข้างหลังเล็กน้อยพร้อมหายใจเข้า แล้วก้มตัวลงให้ลำตัวขนานพื้นพร้อมหายใจออก", dose: "8 ครั้ง × 2 รอบ", m: 1 },
        { n: "ยืดศีรษะหน้า-หลัง", p: "pk11", type: "strength", fx: `${cloth("M43 11Q50 7 57 11M45 9l-4 6M55 9l4 6")}`, d: "พาดผ้าที่หน้าผาก ดึงไปด้านหลังขณะศีรษะออกแรงต้าน ย่อเข่าเล็กน้อย แล้วผ่อน สลับพาดผ้าด้านหลังศีรษะแล้วดึงไปข้างหน้า", dose: "8 ครั้ง ต่อด้าน", m: 1 },
        { n: "ยืดกล้ามเนื้อคอ", p: "pk12", type: "strength", fx: `${cloth("M44 33L46 22Q50 19 54 22L56 33M44 34v14M56 34v14")}`, d: "พาดผ้าที่ต้นคอด้านหลัง ดึงผ้ามาด้านหน้าขณะเงยหน้าต้านแรง ย่อเข่าเล็กน้อย แล้วผ่อนผ้าพร้อมยืดเข่าขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดกล้ามเนื้อหัวไหล่", p: "pk13", type: "strength", fx: `${cloth("M43 33L44 25L56 25L57 33M43 34v18M57 34v18")}`, d: "พาดผ้าหลังไหล่ ดึงทั้งสองข้างมาด้านหน้าขณะเอนหลังต้านแรงผ้า ย่อเข่าเล็กน้อย แล้วผ่อนผ้ายืดเข่าขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดกล้ามเนื้อหลัง", p: "pk14", type: "strength", fx: `${cloth("M36 38L64 38M48 41v14M52 41v14")}`, d: "พาดผ้าที่หลังเหนือศอกเล็กน้อย ดึงมาด้านหน้าขณะเอนหลังต้านแรงผ้า ย่อเข่าเล็กน้อย แล้วผ่อนผ้ายืดเข่าขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดกล้ามเนื้อเอว", p: "pk15", type: "strength", fx: `${cloth("M40 54L60 54M48 57v13M52 57v13")}`, d: "เลื่อนผ้ามาพาดที่เอว ดึงทั้งสองข้างไปด้านหน้า ย่อเข่าทิ้งหลังต้านแรง แล้วผ่อนผ้ายืดเข่าขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดกล้ามเนื้อหน้าท้อง", p: "pk16", type: "strength", fx: `${cloth("M42 55h16M56 54l2-6M50 55l-16 9")}${arrow("M66 40l2-5 2 5")}`, d: "พับผ้าเป็นทางยาวผูกเอวเป็นโบ มือหนึ่งจับหูโบดึงขึ้น อีกมือจับปลายผ้าดึงลงทิศตรงข้าม แล้วเปลี่ยนข้าง", dose: "8 ครั้ง สลับข้าง", m: 1 },
        { n: "ยืดกล้ามเนื้อสะโพก", p: "pk17", type: "strength", fx: `${cloth("M42 57L63 58M62 58v15M64 58v15")}`, d: "เลื่อนผ้าลงมาที่สะโพก ดึงชายผ้าไปด้านหน้า ย่อเข่าให้สะโพกต้านแรงดึง แล้วผ่อนผ้ายืดเข่าขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดกล้ามเนื้อต้นขา", p: "pk18", type: "strength", fx: `${cloth("M46 64L63 67M62 67v14M64 67v14")}`, d: "เลื่อนผ้ามาที่ต้นขาด้านหลัง ดึงชายผ้าไปด้านหน้า ต้านด้วยขาที่ย่อลง แล้วผ่อนผ้ายืดขาขึ้น", dose: "8 ครั้ง", m: 1 },
        { n: "ยืดต้นขา แขน สะโพก", p: "pk19", type: "balance", fx: `${cloth("M53 46L55 66L61 66L60 46")}`, d: "คล้องผ้าที่ต้นขาด้านหลัง ดึงให้ตึงแล้วยกขาขึ้น พร้อมย่อเข่าข้างที่ยืน แล้วผ่อนผ้าปล่อยขาลง ยืนใกล้ผนังได้", dose: "8 ครั้ง สลับข้าง", m: 1, track: "balance" },
        { n: "ยืดเข่า สะโพก แขน ศอก", p: "pk20", type: "balance", fx: `${cloth("M54 44L57 61L60 44")}`, d: "พับขาข้างหนึ่ง ใช้ผ้าคล้องใต้หัวเข่าแล้วยกขึ้น ผ่อนผ้าปล่อยเข่าลงเป็นจังหวะ ฝึกการทรงตัวไปพร้อมกัน", dose: "8 ครั้ง สลับข้าง", m: 1 },
        { n: "ยืดข้อเท้า เข่า สะโพก", p: "pk21", type: "balance", fx: `${cloth("M46 20L40 40L36 66")}`, d: "มือหนึ่งไขว้ไปหลังต้นคอ ใช้ผ้าคล้องข้อเท้าที่งอไว้ด้านหลัง ย่อขาที่ยืนลงแล้วเหยียดขึ้นพร้อมดึงผ้าให้ตึง", dose: "8 ครั้ง สลับขา", m: 1 },
        { n: "ยิงธนู", p: "pk22", type: "flex", fx: `${cloth("M80 20L52 30M52 31l-2 14")}`, d: "ยืนแยกเท้า แขนหนึ่งชูผ้าไปด้านข้างให้ตึง อีกมือดึงปลายผ้าเฉียงเหมือนท่าน้าวธนู ย่อขาโยกตัวดึงแล้วผ่อน แล้วเปลี่ยนข้าง", dose: "8 ครั้ง สลับข้าง", m: 1 },
      ],
    },
    thai: {
      label: "สไตล์ไทย", why: "12 ท่าบริหารร่างกายสไตล์ไทยจาก สสส. ทำเป็นประจำช่วยให้ร่างกายแข็งแรง สดชื่น และถ้าทำต่อเนื่องเกิน 10 นาทีจะช่วยเผาผลาญพลังงานเพิ่มขึ้น ทำได้ทุกวัย ไม่ต้องใช้อุปกรณ์",
      source: ["สสส. · ลดพุง ลดโรค — 12 ท่าบริหารร่างกายสไตล์ไทย (ภาพประกอบทุกท่า)", "https://www.facebook.com/Thai.HealthyLifestyle/posts/1011123852346204/"],
      full: { name: "บริหารร่างกายสไตล์ไทย ครบ 12 ท่า", minutes: 12, type: "flex" },
      fitt: [["ความถี่", "ทุกวัน หรือพักระหว่างทำงานทุก 1–2 ชั่วโมง"], ["ความหนัก", "เบาถึงปานกลาง ไม่เจ็บ ไม่กลั้นหายใจ"], ["เวลา", "ครบ 12 ท่าประมาณ 10–15 นาที"], ["ชนิด", "ยืดเหยียด ทรงตัว และเสริมแรงแบบผสม"]],
      list: [
        { n: "ท่าสวัสดี", p: "wai", type: "flex", d: "หายใจเข้าพร้อมวาดแขนออกด้านข้างขึ้นเหนือศีรษะ แล้วหายใจออกพร้อมลดมือลงมาพนมไว้ระดับอก", dose: "ทำ 8 ครั้ง", m: 1 },
        { n: "ท่ายักไหล่", p: "shrug", type: "flex", x: '<path d="M33 25l4-6 4 6M59 25l4-6 4 6" stroke="#3d84a8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', d: "ยืนตรง ยกไหล่ขวาขึ้นหาหู แล้วลง สลับไหล่ซ้าย จากนั้นยกพร้อมกันสองข้าง ช่วยคลายบ่าและต้นคอ", dose: "ทำทั้งหมด 4 รอบ", m: 1 },
        { n: "ท่าบัวตูมบัวบาน", p: "lotus", type: "flex", d: "ยื่นแขนไปด้านหน้า ประกบหลังมือ ก้มศีรษะเล็กน้อยเป็นบัวตูม แล้วกางแขนออก แอ่นอก เงยหน้าเป็นบัวบาน", dose: "ทำ 8 ครั้ง", m: 1 },
        { n: "ท่ากระทบไม้", p: "krathop", type: "aerobic", x: '<path d="M4 98h92M4 102h92" stroke="#b08a68" stroke-width="3" stroke-linecap="round"/>', d: "กางแขนระดับไหล่ ยกเข่าสลับซ้าย-ขวาตามจังหวะ เหมือนเต้นลาวกระทบไม้ ช่วยให้หัวใจเต้นเร็วขึ้นเล็กน้อย", dose: "สลับขวา-ซ้าย 8 ครั้ง", m: 1 },
        { n: "ท่าไผ่ลู่ลม", p: "bamboo", type: "flex", d: "ประสานมือเหนือศีรษะ เอนลำตัวไปด้านข้างช้า ๆ ค้างไว้ 5 วินาที แล้วสลับอีกข้าง ยืดลำตัวด้านข้าง", dose: "ขวา 4 ครั้ง ซ้าย 4 ครั้ง", m: 1 },
        { n: "ท่านกขมิ้น", p: "bird", type: "balance", d: "ยืนตรง เหวี่ยงแขนมาด้านหน้า แล้วเหวี่ยงแขนไปด้านหลัง บีบสะบัก พร้อมยกเข่าขึ้นสูงระดับเอว เกร็งหน้าท้อง ทรงตัว จากนั้นเหวี่ยงแขนมาด้านหน้าพร้อมวางเท้าลง สลับข้าง", dose: "ยกเข่าสลับขวา-ซ้าย 16 ครั้ง", m: 1, track: "march" },
        { n: "ท่ารำไทย", p: "ramthai", type: "balance", d: "ตั้งวงมือจีบ แขนหนึ่งยกสูง อีกแขนวาดต่ำ ย่อเข่าเล็กน้อยและยกเท้าไปด้านหลัง ทำช้า ๆ สลับข้าง", dose: "รำสลับขวา-ซ้าย 16 ครั้ง", m: 1 },
        { n: "ท่าชกมวย", p: "boxing", type: "aerobic", d: "ยืนแยกเท้า ตั้งการ์ด ชกหมัดตรงสลับซ้าย-ขวา หายใจออกทุกครั้งที่ชก เพิ่มความเร็วได้เมื่อคล่อง", dose: "ชกสลับขวา-ซ้าย 16 ครั้ง", m: 1 },
        { n: "ท่าแจวเรือ", p: "rowboat", type: "strength", x: '<path d="M80 18L64 98" stroke="#8a6a4f" stroke-width="3.4" stroke-linecap="round"/>', d: "ก้าวขาไปข้างหน้า ย่อเข่า ทำมือจับไม้แจว ดึงเข้าหาลำตัวแล้วดันออก เหมือนพายเรือ ใช้แรงขาและแขน", dose: "ข้างละ 2 ครั้ง สลับกัน", m: 1 },
        { n: "ท่าเหวี่ยงแห", p: "castnet", type: "flex", d: "ย่อเข่า บิดลำตัวลงด้านหนึ่ง แล้วเหวี่ยงแขนขึ้นเฉียงไปอีกด้านเหมือนเหวี่ยงแห ช่วยยืดและบิดลำตัว", dose: "ขวา 4 ครั้ง ซ้าย 4 ครั้ง", m: 1 },
        { n: "ท่าดำนา", p: "rice", type: "strength", x: '<path d="M70 98v-8M74 98v-10M78 98v-7M66 98v-6" stroke="#5fa86b" stroke-width="2.4" stroke-linecap="round"/>', d: "ก้าวขาไปข้างหน้า หลังตรง โน้มตัวลงทำท่าปักดำกล้า แล้วยืดตัวขึ้นช้า ๆ ใช้กล้ามเนื้อสะโพกและหลัง", dose: "สลับขวา-ซ้าย 8 ครั้ง", m: 1 },
        { n: "ท่าท้องฟ้า", p: "sky", type: "balance", d: "ประสานมือ ยกแขนขึ้นเหนือศีรษะ เขย่งปลายเท้า ยืดตัวให้สูงที่สุด ค้าง 5 วินาที แล้วลดลง", dose: "ทำ 8 ครั้ง", m: 1 },
      ],
    },
  };
  // official สสส. illustrations for the Thai-style set (assets/thai/01–12.jpg, cover 00.jpg)
  // official สสส. illustrations: Thai-style (FB post) and ผ้าขาวม้าพาฟิต (A4 poster)
  [["aerobic", ""], ["strength", ""], ["thai", "สสส. (ลดพุง ลดโรค)"], ["pakhaoma", "โปสเตอร์ สสส. ขาวม้าพาฟิต"], ["flex", "ศูนย์เรียนรู้สุขภาวะ (สสส.) · thaijoggingclub.or.th"], ["balance", "ศูนย์กายภาพบำบัด คณะกายภาพบำบัด ม.มหิดล"]].forEach(([k, credit]) => {
    PROGRAMS[k].list.forEach((e, i) => { e.img = `assets/${k}/${String(i + 1).padStart(2, "0")}.jpg`; e.credit = credit; });
    PROGRAMS[k].cover = `assets/${k}/00.jpg`;
  });
  PROGRAMS.aerobic.list.forEach((e) => { e.img += "?v=3"; });
  PROGRAMS.strength.list.forEach((e) => { e.img += "?v=2"; }); // same card style as the aerobic set // infographic version of the aerobic cartoons
  // follow-along video with music (official สสส. YouTube channel)
  PROGRAMS.thai.video = { id: "CDMxpw1lj1I", min: 10, by: "สสส. · SocialMarketingTH",
    title: "ท่าบริหารร่างกายสไตล์ไทย ๆ ให้ร่างกายแข็งแรง สดชื่น และเพิ่มการเผาผลาญ 10 นาทีเต็ม" };
  // background music for the Isan set (a song to move to, not a follow-along video)
  PROGRAMS.isan.video = { id: "LyM1M-sR3dc", min: 15, music: true, title: "Studio Lam Plearn",
    by: "The Paradise Bangkok Molam International Band (YouTube)" };
  function videoCard(v) {
    if (v.music) return `<section class="vcard music" aria-label="เพลงประกอบการออกกำลังกาย">
      <div class="vframe" id="vframe"><button type="button" class="vthumb" data-yt="${v.id}" aria-label="เปิดเพลง ${esc(v.title)}">
        <span class="vthumb-ph" aria-hidden="true">${v.music ? "🎶" : "🎬"}<small>กดเล่นแล้วจึงเชื่อมต่อ YouTube</small></span><span class="vplay" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span class="vlen">🎵 หมอลำ</span></button></div>
      <div class="vinfo"><small class="k">🎶 เพลงประกอบการออกกำลังกาย</small><h3>${esc(v.title)}</h3>
        <p>เปิดเพลงหมอลำจังหวะสนุก แล้วทำท่าตามการ์ดด้านล่างไปทีละท่า ทุก 4 จังหวะเปลี่ยนท่า ครบชุด 7 ท่าประมาณ 10–15 นาที ทำซ้ำได้ 2 รอบ</p>
        <div class="ex-actions"><button class="btn sm primary" type="button" data-yt="${v.id}">▶ เปิดเพลง</button><button class="btn sm" type="button" data-vlog="1">บันทึกว่าฝึกครบชุดแล้ว (${v.min} นาที)</button>
        <a class="btn sm" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">เปิดใน YouTube ↗</a></div>
        <small class="vsrc">เพลง: ${esc(v.by)}</small></div></section>`;
    return `<section class="vcard" aria-label="วิดีโอและดนตรีประกอบการฝึก">
      <div class="vframe" id="vframe"><button type="button" class="vthumb" data-yt="${v.id}" aria-label="เล่นวิดีโอ ${esc(v.title)}">
        <span class="vthumb-ph" aria-hidden="true">${v.music ? "🎶" : "🎬"}<small>กดเล่นแล้วจึงเชื่อมต่อ YouTube</small></span><span class="vplay" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><span class="vlen">${v.min}:00</span></button></div>
      <div class="vinfo"><small class="k">🎵 วิดีโอและดนตรีประกอบการฝึก</small><h3>${esc(v.title)}</h3>
        <p>ฝึกตามวิดีโอพร้อมเพลงจังหวะสนุก ครบทุกท่าในชุด ${v.min} นาที เหมาะกับการทำต่อเนื่องเป็นแอโรบิกเบา ๆ ทำได้วันละ 1–3 รอบ</p>
        <div class="ex-actions"><button class="btn sm primary" type="button" data-yt="${v.id}">▶ ฝึกตามวิดีโอ</button><button class="btn sm" type="button" data-vlog="1">บันทึกว่าฝึกตามวิดีโอแล้ว (${v.min} นาที)</button>
        <a class="btn sm" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">เปิดใน YouTube ↗</a></div>
        <small class="vsrc">ที่มา: ${v.by}</small></div></section>`;
  }
  let exTab = "aerobic";
  setTimeout(() => { try { if (rxLatest() && !location.hash.startsWith("#ex-")) { exTab = "rx"; renderExercise(); } } catch { /* admin page */ } }, 0);
  /* ---------- voice guidance (Web Speech, Thai) ---------- */
  const VOICE = { last: "", at: 0 };
  function speak(text, opts = {}) {
    if (!("speechSynthesis" in window) || !text) return;
    const now = Date.now();
    if (!opts.force && ((text === VOICE.last && now - VOICE.at < 4000) || now - VOICE.at < 1500)) return;
    VOICE.last = text; VOICE.at = now;
    if (window.PreDMVoice?.play(text)) return; // a real human recording of this phrase exists (voice.js)
    if (!opts.queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "th-TH"; u.rate = opts.rate || 0.95; u.pitch = 1.05;
    const v = window.PreDMVoice?.bestVoice() || speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith("th")); if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function speakTrack(r) { if (r.rep) speak(String(r.count), { force: true }); else if (r.state === "bad") speak(r.msg); }

  /* ---------- training preferences ---------- */
  const prefs = () => store.get("trainPrefs", { mode: "auto", track: false, voice: true });
  const setPrefs = (p) => store.set("trainPrefs", { ...prefs(), ...p });
  function trainBar(playLabel) {
    const pf = prefs();
    return `<div class="trainbar">
      <div class="seg sm" role="group" aria-label="โหมดการฝึก"><button type="button" data-pref-mode="auto" aria-pressed="${pf.mode === "auto"}">Auto</button><button type="button" data-pref-mode="manual" aria-pressed="${pf.mode === "manual"}">Manual</button></div>
      <label class="switch"><input type="checkbox" data-pref="track" ${pf.track ? "checked" : ""}><span></span>AI Tracking (กล้อง)</label>
      <label class="switch"><input type="checkbox" data-pref="voice" ${pf.voice ? "checked" : ""}><span></span>เสียงบรรยาย</label>
      ${playLabel ? `<button class="btn primary" type="button" data-play="all">▶ ${playLabel}</button>` : ""}
      <p class="trainbar-note">${pf.mode === "auto" ? "Auto: ระบบนับเวลา นับครั้ง พัก และเปลี่ยนท่าให้อัตโนมัติ" : "Manual: ทำตามจังหวะตัวเอง กด “ทำเสร็จ ถัดไป” เมื่อพร้อม"}${pf.track ? " · กล้องจับท่า: <i class='dot w'></i>ขาว เริ่มจับ <i class='dot r'></i>แดง ทำผิด <i class='dot g'></i>เขียว ทำถูก" : ""}</p>
    </div>`;
  }
  function exFigHTML(cat, i) {
    const e = PROGRAMS[cat]?.list[i];
    if (e?.img) return `<button type="button" class="ex-fig photo${e.wide ? " wide" : ""}" data-zoom="${e.img}" data-cap="${esc(e.n)}" data-credit="${esc(e.credit || "")}" aria-label="ขยายภาพ${esc(e.n)}"><img src="${e.img}" alt="ภาพประกอบ${esc(e.n)}" loading="lazy"><span class="zoom-tip">แตะเพื่อขยาย</span></button>`;
    return `<div class="ex-fig mo" data-mo="${cat}:${i}"></div>`;
  }
  // default target for a library move, parsed from its dose text
  function defaultTarget(e) {
    const dose = e.dose || "";
    if (e.track === "balance") { const t = dose.match(/(\d+)(?:–(\d+))?\s*(?:วิ|วินาที)/); return { kind: "secs", val: t ? +(t[2] || t[1]) : 30, sets: 1 }; }
    { const g = dose.match(/(\d+)\s*(?:ก้าว|รอบ)/); if (g && !/ครั้ง|วิ|นาที/.test(dose)) return { kind: "reps", val: +g[1], sets: 1, unit: /ก้าว/.test(dose) ? "ก้าว" : "รอบ" }; }
    if (e.track === "march") { const r = dose.match(/(\d+)(?:–(\d+))?\s*ครั้ง/); return { kind: "reps", val: r ? +(r[2] || r[1]) : 20, sets: 1 }; }
    let sets = 1; const ms = dose.match(/(\d+)(?:–\d+)?\s*(?:เซต|รอบ)/); if (ms) sets = Math.min(3, +ms[1]);
    const mr = dose.match(/(\d+)(?:–(\d+))?\s*ครั้ง/), mt = dose.match(/(\d+)(?:–(\d+))?\s*(?:วิ|วินาที)/), mm = dose.match(/(\d+)(?:–(\d+))?\s*นาที/);
    if (/ค้าง/.test(dose) && mt) return { kind: "secs", val: +(mt[2] || mt[1]), sets };
    if (mr) return { kind: "reps", val: +(mr[2] || mr[1]), sets };
    if (mt) return { kind: "secs", val: +(mt[2] || mt[1]), sets };
    if (mm) return { kind: "secs", val: Math.min(60 * +(mm[2] || mm[1]), 1800), sets };
    return { kind: "secs", val: Math.max(30, (e.m || 1) * 60), sets: 1 };
  }
  function normItem(cat, idx, ov = {}) {
    const e = PROGRAMS[cat].list[idx], d = defaultTarget(e);
    return { cat, idx, e, name: e.n, type: e.type || cat, track: e.track || null, kind: ov.kind || d.kind, val: +ov.val || d.val, sets: +ov.sets || d.sets, unit: (ov.kind || d.kind) === d.kind ? d.unit : undefined };
  }
  const targetText = (it) => (it.kind === "reps" ? `${it.val} ${it.unit || "ครั้ง"}` : it.val >= 60 ? `${Math.round(it.val / 60)} นาที` : `${it.val} วินาที`) + (it.sets > 1 ? ` × ${it.sets} เซต` : "");
  const estSecs = (items, rest) => items.reduce((t, it) => t + (it.kind === "secs" ? it.val : it.val * 3) * it.sets, 0) + rest * Math.max(0, items.reduce((n, it) => n + it.sets, 0) - 1);

  /* ---------- session player (Auto / Manual, optional MediaPipe tracking + voice) ---------- */
  const PL = { on: false };
  const TRACK_REPS = ["squat", "arm", "march"];
  function openPlayer(title, items, rest = 15) {
    if (window.PreDMCare && !window.PreDMCare.parqValid()) return window.PreDMCare.gate(() => openPlayer(title, items, rest)); // PAR-Q+ first
    const pf = prefs();
    const list = []; items.forEach((it) => { for (let k = 1; k <= it.sets; k++) list.push({ ...it, setNo: k, setOf: it.sets }); });
    Object.assign(PL, { on: true, title, items: list, i: 0, rest, auto: pf.mode === "auto", track: pf.track, voice: pf.voice, phase: "ready", el: 0, dur: 5, reps: 0, trackCount: 0,
      reached: false, paused: false, done: [], lastTick: performance.now(), lastSpoken: null, state: "idle", fb: "" });
    $("#player").hidden = false; document.body.classList.add("pl-open");
    $("#plProg").textContent = title; $("#plModeBadge").textContent = PL.auto ? "Auto" : "Manual"; $("#plVoice").checked = PL.voice;
    $("#plSummary").hidden = true; $("#plMain").hidden = false;
    $("#plCam").hidden = !PL.track; $("#plStage").classList.toggle("cam", PL.track);
    plFig(); plRender();
    plSay(`เริ่ม${title} ${PL.auto ? "โหมดอัตโนมัติ" : "โหมดทำเอง"} ${list.length} ท่า เตรียมตัว`, true);
    if (PL.track) {
      if (!window.PreDMTrack) { toast("โมดูลกล้องยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง"); }
      else {
        PL.tracker = PL.tracker || window.PreDMTrack.create($("#plVideo"), $("#plCanvas"), $("#plMsg"));
        PL.trackOK = false;
        PL.tracker.start(list[0].track, plOnTrack).then(() => { PL.trackOK = true; if (PL.phase === "work") PL.tracker.setMode(PL.items[PL.i].track); })
          .catch((err) => { $("#plMsg").textContent = "เปิดกล้องไม่ได้: " + (err.message || err) + " · ระบบนับให้อัตโนมัติแทน"; toast("เปิดกล้องไม่ได้ ระบบจะนับให้อัตโนมัติแทน"); });
      }
    }
    clearInterval(PL.timer); PL.timer = setInterval(plTick, 200);
  }
  const plSay = (t, force) => { if (PL.voice) speak(t, { force }); };
  function plOnTrack(r) {
    PL.state = r.state; PL.fb = r.msg; PL.trackCount = r.count;
    const it = PL.items[PL.i];
    if (PL.phase === "work" && it && TRACK_REPS.includes(it.track) && it.kind === "reps") PL.reps = r.count;
    if (PL.voice && PL.phase === "work") speakTrack(r);
    const st = $("#plState"); st.dataset.state = r.state; st.textContent = r.state === "ok" ? "ทำถูก" : r.state === "bad" ? "ปรับท่า" : "กำลังจับท่า";
    $("#plFb").textContent = r.msg; $("#plFb").dataset.state = r.state;
  }
  function plFig() {
    const it = PL.phase === "rest" ? PL.items[PL.i] : PL.items[PL.i];
    $("#plFig").innerHTML = it ? exFigHTML(it.cat, it.idx) : ""; mountAnims($("#plFig"));
  }
  function plStartWork() {
    const it = PL.items[PL.i];
    Object.assign(PL, { phase: "work", el: 0, reps: 0, trackCount: 0, reached: false, lastSpoken: null });
    if (PL.track && PL.trackOK) PL.tracker.setMode(it.track);
    plFig(); plRender();
    const short = it.e.d.length > 90 ? it.e.d.slice(0, 90) : it.e.d;
    plSay(`${it.name}${it.setOf > 1 ? ` เซตที่ ${it.setNo}` : ""} ${targetText({ ...it, sets: 1 })} ${short}`, true);
  }
  function plFinishItem() {
    const it = PL.items[PL.i];
    PL.done.push({ ...it, secs: Math.max(5, PL.el), reps: PL.reps });
    if (PL.i >= PL.items.length - 1) return plEnd();
    PL.i++;
    if (PL.rest > 0) { Object.assign(PL, { phase: "rest", el: 0, dur: PL.rest, lastSpoken: null }); plFig(); plRender(); plSay(`เยี่ยมมาก พัก ${PL.rest} วินาที ท่าต่อไป ${PL.items[PL.i].name}`, true); }
    else plStartWork();
  }
  function plTick() {
    if (!PL.on || PL.paused) { PL.lastTick = performance.now(); return; }
    const now = performance.now(), dt = (now - PL.lastTick) / 1000; PL.lastTick = now; PL.el += dt;
    const it = PL.items[PL.i];
    if (PL.phase === "ready" || PL.phase === "rest") {
      const left = Math.ceil(PL.dur - PL.el);
      if (left <= 3 && left > 0 && left !== PL.lastSpoken) { PL.lastSpoken = left; plSay(String(left), true); }
      if (PL.el >= PL.dur && (PL.phase === "ready" || PL.auto)) plStartWork();
      return plRender();
    }
    const tracked = PL.track && PL.trackOK && it.track;
    if (it.kind === "secs") {
      const counted = tracked && it.track === "balance" ? PL.trackCount : PL.el;
      if (PL.auto) {
        const left = Math.ceil(it.val - counted);
        if (left <= 3 && left > 0 && left !== PL.lastSpoken) { PL.lastSpoken = left; plSay(String(left), true); }
        if (counted >= it.val) return plFinishItem();
      } else if (!PL.reached && counted >= it.val) { PL.reached = true; plSay("ครบเวลาแล้ว กดถัดไปได้เลย", true); }
    } else {
      const trackReps = tracked && TRACK_REPS.includes(it.track);
      if (!trackReps && PL.auto) {
        const n = Math.min(it.val, Math.floor(PL.el / 3));
        if (n > PL.reps) { PL.reps = n; plSay(String(n), true); }
        if (PL.reps >= it.val && PL.el >= it.val * 3 + 0.8) return plFinishItem();
      }
      if (trackReps && PL.reps >= it.val && !PL.reached) {
        PL.reached = true;
        if (PL.auto) { plSay("ครบแล้ว เยี่ยมมาก", true); setTimeout(() => PL.on && PL.items[PL.i] === it && PL.phase === "work" && plFinishItem(), 1200); }
        else plSay("ครบแล้ว กดถัดไปได้เลย", true);
      }
    }
    plRender();
  }
  function plRender() {
    const it = PL.items[PL.i], n = PL.items.length;
    $("#plStep").textContent = `ท่า ${PL.i + 1}/${n}`;
    $("#plBarFill").style.width = `${((PL.i + (PL.phase === "work" ? 0.5 : 0)) / n) * 100}%`;
    const ph = $("#plPhase"); ph.dataset.phase = PL.phase;
    ph.textContent = PL.phase === "ready" ? "เตรียมตัว" : PL.phase === "rest" ? "พัก" : PL.paused ? "หยุดชั่วคราว" : "กำลังฝึก";
    $("#plName").textContent = (PL.phase === "rest" ? "ต่อไป: " : "") + it.name + (it.setOf > 1 ? ` · เซต ${it.setNo}/${it.setOf}` : "");
    $("#plDesc").textContent = it.e.d;
    const big = $("#plBig"), unit = $("#plUnit"), tracked = PL.track && PL.trackOK && it.track;
    if (PL.phase !== "work") { big.textContent = Math.max(0, Math.ceil(PL.dur - PL.el)); unit.textContent = "วินาที"; }
    else if (it.kind === "secs") {
      const counted = tracked && it.track === "balance" ? PL.trackCount : PL.el;
      const secsV = PL.auto ? Math.max(0, Math.ceil(it.val - counted)) : Math.floor(counted), mmss = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
      big.textContent = it.val >= 60 ? mmss(secsV) : secsV; unit.textContent = PL.auto ? (it.val >= 60 ? "เหลือ (นาที:วินาที)" : "วินาทีที่เหลือ") : (it.val >= 60 ? "นาที:วินาที" : "วินาที");
    } else {
      const showReps = PL.auto || (tracked && TRACK_REPS.includes(it.track));
      big.textContent = showReps ? PL.reps : it.val; unit.textContent = showReps ? `/ ${it.val} ครั้ง` : "ครั้ง (นับเอง)";
    }
    $("#plTarget").textContent = `เป้าหมาย: ${targetText({ ...it, sets: 1 })}${tracked && TRACK_REPS.includes(it.track) ? " · AI นับให้" : tracked && it.track === "balance" ? " · AI จับเวลาเฉพาะตอนยืนขาเดียว" : ""}`;
    const nx = PL.items[PL.i + 1]; $("#plNext").textContent = nx && PL.phase === "work" ? `ถัดไป: ${nx.name}` : "";
    $("#plDone").textContent = PL.phase === "work" ? (PL.i >= n - 1 ? "จบการฝึก ✓" : "ทำเสร็จ ถัดไป ⏭") : "เริ่มท่านี้ ▶";
    $("#plPause").textContent = PL.paused ? "▶ ฝึกต่อ" : "⏸ หยุดชั่วคราว";
    $("#plPrev").disabled = PL.i === 0 && PL.phase !== "work";
    if (!PL.track) { $("#plFb").textContent = PL.phase === "work" ? (PL.auto ? "ทำตามภาพตัวอย่าง ระบบนับให้อัตโนมัติ" : "ทำตามภาพตัวอย่าง แล้วกดทำเสร็จเมื่อครบ") : ""; $("#plFb").dataset.state = "idle"; }
  }
  function plEnd() {
    PL.on = false; clearInterval(PL.timer); PL.tracker?.stop(); if ("speechSynthesis" in window) speechSynthesis.cancel();
    const byType = {}; let secs = 0, reps = 0;
    PL.done.forEach((d) => { byType[d.type] = (byType[d.type] || 0) + d.secs; secs += d.secs; reps += d.reps || 0; });
    Object.entries(byType).forEach(([type, sc]) => addLog({ type, name: `${PL.title} · ${PL.auto ? "Auto" : "Manual"}`, minutes: Math.max(1, Math.round(sc / 60)), reps: reps || undefined }));
    $("#plMain").hidden = true; $("#plSummary").hidden = false;
    $("#plSummary").innerHTML = PL.done.length ? `<div class="pl-done"><div class="pl-medal">★</div><h2>ฝึกเสร็จแล้ว เยี่ยมมาก!</h2>
      <div class="pl-stats"><div><b>${PL.done.length}</b><small>ท่า/เซต</small></div><div><b>${Math.max(1, Math.round(secs / 60))}</b><small>นาที</small></div><div><b>${reps || "–"}</b><small>ครั้ง (AI/อัตโนมัติ)</small></div></div>
      <p class="hint">บันทึกลงประวัติการออกกำลังกายแล้ว แยกตามประเภท: ${Object.keys(byType).map((t) => TYPE_TH[t]).join(", ")}</p>
      <button class="btn primary" type="button" id="plCloseDone">กลับไปหน้าโปรแกรม</button></div>`
      : `<div class="pl-done"><h2>ยังไม่ได้ฝึกท่าไหน</h2><p class="hint">ไม่มีการบันทึก</p><button class="btn primary" type="button" id="plCloseDone">ปิด</button></div>`;
    $("#plCloseDone").addEventListener("click", plClose);
    plSay(PL.done.length ? `ฝึกเสร็จแล้ว ${PL.done.length} ท่า ${Math.max(1, Math.round(secs / 60))} นาที เยี่ยมมาก` : "", true);
  }
  function plClose() { PL.on = false; clearInterval(PL.timer); PL.tracker?.stop(); $("#player").hidden = true; document.body.classList.remove("pl-open"); if ("speechSynthesis" in window) speechSynthesis.cancel(); renderHome(); }
  function initPlayer() {
    $("#plDone").addEventListener("click", () => { if (!PL.on) return; if (PL.phase === "work") plFinishItem(); else plStartWork(); });
    $("#plPrev").addEventListener("click", () => { if (!PL.on) return; if (PL.phase !== "work" && PL.i > 0) PL.i--; else if (PL.phase === "work" && PL.i > 0) PL.i--; plStartWork(); });
    $("#plPause").addEventListener("click", () => { if (!PL.on) return; PL.paused = !PL.paused; if (PL.paused && "speechSynthesis" in window) speechSynthesis.cancel(); plSay(PL.paused ? "หยุดชั่วคราว" : "ฝึกต่อ", true); plRender(); });
    $("#plClose").addEventListener("click", () => { if (PL.on && PL.done.length) plEnd(); else plClose(); });
    $("#plVoice").addEventListener("change", (e) => { PL.voice = e.target.checked; setPrefs({ voice: PL.voice }); if (!PL.voice && "speechSynthesis" in window) speechSynthesis.cancel(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#player").hidden) $("#plClose").click(); });
  }

  /* ---------- my programs (custom builder) ---------- */
  let draft = null, pickCat = "aerobic", delArm = null;
  const myProgs = () => store.get("myPrograms", null) ?? [{ id: "sample", sample: true, name: "โปรแกรมเช้า 15 นาที (ตัวอย่าง)", rest: 15,
    items: [{ cat: "aerobic", idx: 2 }, { cat: "strength", idx: 0 }, { cat: "strength", idx: 5 }, { cat: "balance", idx: 0 }, { cat: "isan", idx: 3 }, { cat: "flex", idx: 0 }] }];
  const progItems = (pg) => pg.items.filter((x) => PROGRAMS[x.cat]?.list[x.idx]).map((x) => normItem(x.cat, x.idx, x));
  /* ---------- prescribed program from the physiotherapist / admin ---------- */
  const myPhone = () => { const s = session(); return s?.phone || DEMO.find((d) => d.name === s?.name)?.phone || "local"; };
  const rxAll = () => store.get("rx", {});
  const rxLatest = () => (rxAll()[myPhone()] || [])[0] || null;
  function rxResolve(it) { // items reference (cat, idx) + name; fall back to name lookup if the catalogue changed
    let cat = it.cat, idx = it.idx;
    if (!PROGRAMS[cat] || PROGRAMS[cat].list[idx]?.n !== it.n) {
      const hit = Object.entries(PROGRAMS).flatMap(([k, v]) => v.list.map((e, i) => [k, i, e])).find(([, , e]) => e.n === it.n);
      if (hit) [cat, idx] = hit; else if (!PROGRAMS[cat]?.list[idx]) return null; // renamed move: keep its slot
    }
    return { ...normItem(cat, idx, { kind: it.kind, val: it.val, sets: it.sets }), note: it.note || "" };
  }
  function importRx(code) {
    store.set("pendingRx", null);
    try {
      const rx = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/")))));
      if (!rx || !Array.isArray(rx.items) || !rx.items.length) throw new Error("bad");
      const all = rxAll(), me = myPhone(), list = (all[me] || []).filter((x) => x.id !== rx.id);
      all[me] = [{ ...rx, seen: false, importedAt: new Date().toISOString() }, ...list].slice(0, 10); store.set("rx", all);
      exTab = "rx"; toast(`ได้รับโปรแกรม “${rx.name}” จาก ${rx.by || "นักกายภาพ"} แล้ว`);
    } catch { toast("ลิงก์โปรแกรมไม่ถูกต้องหรือไม่สมบูรณ์"); }
  }
  function rxWeekDone(rx) {
    const now = new Date(), day = (now.getDay() + 6) % 7, start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(now.getDate() - day);
    return new Set(store.get("logs", []).filter((l) => l.rx === rx.id && new Date(l.date + "T00:00:00") >= start).map((l) => l.date)).size;
  }
  function renderRx() {
    const rx = rxLatest();
    if (!rx) {
      $("#exPanel").innerHTML = `<div class="card rx-card"><h2>🩺 โปรแกรมจากนักกายภาพบำบัด</h2><div class="mine-empty">ยังไม่มีโปรแกรมที่นักกายภาพกำหนดให้ เมื่อนักกายภาพหรือผู้ดูแลระบบกำหนดโปรแกรมตามอาการของคุณ จะแสดงที่นี่ (หรือเปิดลิงก์โปรแกรมที่ได้รับ)<br><a class="btn sm" href="#consult" style="margin-top:12px">นัดปรึกษานักกายภาพ</a></div></div>`;
      return;
    }
    if (!rx.seen) { const all = rxAll(); all[myPhone()][0].seen = true; store.set("rx", all); }
    const its = rx.items.map(rxResolve).filter(Boolean), m = Math.max(1, Math.round(estSecs(its, rx.rest ?? 15) / 60)), done = rxWeekDone(rx);
    const end = rx.start && rx.weeks ? new Date(new Date(rx.start + "T00:00:00").getTime() + rx.weeks * 7 * 864e5) : null;
    $("#exPanel").innerHTML = `<div class="card rx-card">
      <div class="card-head"><div><h2>🩺 ${esc(rx.name)}</h2><p class="lede">กำหนดโดย <b>${esc(rx.by || "นักกายภาพบำบัด")}</b> · ${thDate((rx.created || "").slice(0, 10) || todayISO())}${end ? ` · ถึง ${thDate(end.toISOString().slice(0, 10))}` : ""}</p></div>
        <button class="btn primary" type="button" data-rx="play">▶ เริ่มฝึกทั้งโปรแกรม (${its.length} ท่า · ~${m} นาที)</button></div>
      ${rx.problems?.length ? `<div class="rx-probs">${rx.problems.map((p) => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
      <div class="rx-meta">
        <div class="fitt"><small>ความถี่</small><b>${rx.freq || 3} วัน/สัปดาห์</b></div>
        <div class="fitt"><small>สัปดาห์นี้ทำแล้ว</small><b>${done}/${rx.freq || 3} วัน ${done >= (rx.freq || 3) ? "✅" : ""}</b></div>
        <div class="fitt"><small>ระยะเวลาโปรแกรม</small><b>${rx.weeks || 4} สัปดาห์</b></div>
        <div class="fitt"><small>พักระหว่างท่า</small><b>${rx.rest ?? 15} วินาที</b></div>
      </div>
      ${rx.note ? `<div class="rx-note"><b>คำแนะนำจากนักกายภาพ</b><p>${esc(rx.note)}</p></div>` : ""}
      ${rx.cautions?.length ? `<div class="rx-caution"><b>⚠️ ข้อควรระวัง</b><ul>${rx.cautions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${trainBar("")}
      <div class="ex-list">${its.map((it, i) => `<div class="ex"><span class="rx-no">${i + 1}</span>${exFigHTML(it.cat, it.idx)}<h3>${esc(it.name)}</h3><p>${it.e.d}</p>
        <span class="dose">เป้าหมาย: <b>${targetText(it)}</b> · <span class="wtag ${it.type}">${TYPE_TH[it.type] || PROGRAMS[it.cat].label}</span></span>
        ${it.note ? `<p class="rx-inote">📝 ${esc(it.note)}</p>` : ""}
        <div class="ex-actions"><button class="btn sm primary" type="button" data-rxone="${i}">▶ ฝึกท่านี้</button>${it.track ? `<span class="ai-chip" title="รองรับ AI นับครั้งและตรวจท่า">AI</span>` : ""}</div></div>`).join("")}</div>
      <div class="rx-foot"><button class="btn" type="button" data-rx="log">✔ บันทึกว่าวันนี้ทำครบโปรแกรมแล้ว</button>
        ${(rxAll()[myPhone()] || []).length > 1 ? `<small>มีโปรแกรมเดิม ${(rxAll()[myPhone()] || []).length - 1} รายการ (แสดงเฉพาะฉบับล่าสุด)</small>` : ""}</div>
    </div>`;
    mountAnims($("#exPanel"));
  }
  function rxClick(e) {
    const rx = rxLatest(); if (!rx) return;
    const its = rx.items.map(rxResolve).filter(Boolean);
    const t = e.target.closest("[data-rx],[data-rxone]"); if (!t) return;
    if (t.dataset.rx === "play") return openPlayer(rx.name, its, rx.rest ?? 15);
    if (t.dataset.rxone != null) { const it = its[+t.dataset.rxone]; return openPlayer(it.name, [it], 0); }
    if (t.dataset.rx === "log") {
      if (store.get("logs", []).some((l) => l.rx === rx.id && l.date === todayISO())) return toast("วันนี้บันทึกโปรแกรมนี้แล้ว");
      addLog({ type: its[0]?.type || "flex", name: "โปรแกรมจากนักกายภาพ: " + rx.name, minutes: Math.max(1, Math.round(estSecs(its, rx.rest ?? 15) / 60)), rx: rx.id });
      toast("บันทึกแล้ว เก่งมาก!"); renderRx();
    }
  }
  function renderMine() {
    if (draft) return renderEditor();
    const progs = myProgs();
    $("#exPanel").innerHTML = `<div class="card mine"><div class="card-head"><div><h2>★ โปรแกรมของฉัน</h2><p class="lede">เลือกท่าจากทุกหมวด จัดลำดับ กำหนดจำนวนครั้งหรือเวลาเอง แล้วกดเริ่มฝึกแบบ Auto หรือ Manual</p></div><button class="btn primary" type="button" data-mine="new">+ สร้างโปรแกรมใหม่</button></div>
      ${trainBar("")}
      <div class="mine-list">${progs.length ? progs.map((pg) => { const its = progItems(pg), m = Math.max(1, Math.round(estSecs(its, pg.rest) / 60));
        return `<div class="mine-card"><div class="mine-info"><b>${esc(pg.name)}</b><small>${its.length} ท่า · ประมาณ ${m} นาที · พักระหว่างท่า ${pg.rest} วินาที</small>
          <div class="mine-chips">${its.map((it) => `<span class="wtag ${it.type}">${esc(it.name)} · ${targetText(it)}</span>`).join("")}</div></div>
          <div class="mine-acts"><button class="btn primary sm" type="button" data-mine="play" data-id="${pg.id}">▶ เริ่มฝึก</button><button class="btn sm" type="button" data-mine="edit" data-id="${pg.id}">แก้ไข</button>
          <button class="btn sm ${delArm === pg.id ? "danger" : ""}" type="button" data-mine="del" data-id="${pg.id}">${delArm === pg.id ? "ยืนยันลบ" : "ลบ"}</button></div></div>`; }).join("")
        : `<div class="mine-empty">ยังไม่มีโปรแกรม กด “+ สร้างโปรแกรมใหม่” เพื่อเลือกท่าที่ชอบ</div>`}</div></div>`;
  }
  function renderEditor() {
    const cats = Object.entries(PROGRAMS), list = PROGRAMS[pickCat].list;
    const its = draft.items.map((x) => normItem(x.cat, x.idx, x)), m = Math.max(1, Math.round(estSecs(its, draft.rest) / 60));
    $("#exPanel").innerHTML = `<div class="card mine"><div class="card-head"><h2>${draft.id ? "แก้ไขโปรแกรม" : "สร้างโปรแกรมใหม่"}</h2><span class="pill">${its.length} ท่า · ประมาณ ${m} นาที</span></div>
      <div class="row2"><label>ชื่อโปรแกรม<input id="mName" value="${esc(draft.name)}" placeholder="เช่น โปรแกรมหลังเลิกงาน"></label>
        <label>พักระหว่างท่า<select id="mRest">${[0, 10, 15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${+draft.rest === v ? "selected" : ""}>${v ? v + " วินาที" : "ไม่พัก"}</option>`).join("")}</select></label></div>
      <div class="mine-edit">
        <div class="picker"><h3>คลังท่า</h3><select id="mCat">${cats.map(([k, v]) => `<option value="${k}" ${k === pickCat ? "selected" : ""}>${v.label} (${v.list.length})</option>`).join("")}</select>
          <div class="pick-list">${list.map((e, i) => `<div class="pick-row"><span class="pick-fig">${fig(P[e.p], "", i, { noBlob: true })}</span><span><b>${e.n}</b><small>${e.dose}</small></span><button class="btn sm" type="button" data-add="${i}">+ เพิ่ม</button></div>`).join("")}</div></div>
        <div class="chosen"><h3>ท่าในโปรแกรม</h3>${its.length ? its.map((it, i) => `<div class="chosen-row"><span class="no">${i + 1}</span><span class="cn"><b>${esc(it.name)}</b><small>${PROGRAMS[it.cat].label}</small></span>
            <select data-k="kind" data-i="${i}" aria-label="ชนิดเป้าหมาย"><option value="reps" ${it.kind === "reps" ? "selected" : ""}>ครั้ง</option><option value="secs" ${it.kind === "secs" ? "selected" : ""}>วินาที</option></select>
            <input type="number" min="1" max="1800" data-k="val" data-i="${i}" value="${it.val}" aria-label="จำนวน">
            <label class="sets">× <input type="number" min="1" max="5" data-k="sets" data-i="${i}" value="${it.sets}" aria-label="จำนวนเซต"> เซต</label>
            <span class="mv"><button type="button" class="icon-btn sm" data-mv="-1" data-i="${i}" aria-label="เลื่อนขึ้น">↑</button><button type="button" class="icon-btn sm" data-mv="1" data-i="${i}" aria-label="เลื่อนลง">↓</button><button type="button" class="icon-btn sm" data-rm="${i}" aria-label="เอาออก">✕</button></span></div>`).join("")
          : `<div class="mine-empty">ยังไม่มีท่า เลือกจากคลังท่าด้านซ้าย</div>`}</div>
      </div>
      <p class="form-error" id="mErr" hidden></p>
      <div class="btns"><button class="btn primary" type="button" data-mine="save">บันทึกโปรแกรม</button><button class="btn" type="button" data-mine="cancel">ยกเลิก</button></div></div>`;
  }
  function mineClick(e) {
    const t = e.target.closest("[data-mine],[data-add],[data-mv],[data-rm]"); if (!t) return;
    const progs = myProgs();
    if (t.dataset.mine === "new") { draft = { id: null, name: "", rest: 15, items: [] }; return renderMine(); }
    if (t.dataset.mine === "edit") { const pg = progs.find((x) => x.id === t.dataset.id); draft = JSON.parse(JSON.stringify(pg)); if (pg.sample) { draft.sample = false; } return renderMine(); }
    if (t.dataset.mine === "del") { if (delArm !== t.dataset.id) { delArm = t.dataset.id; return renderMine(); } store.set("myPrograms", progs.filter((x) => x.id !== t.dataset.id)); delArm = null; toast("ลบโปรแกรมแล้ว"); return renderMine(); }
    if (t.dataset.mine === "play") { const pg = progs.find((x) => x.id === t.dataset.id), its = progItems(pg); if (!its.length) return toast("โปรแกรมนี้ยังไม่มีท่า"); return openPlayer(pg.name, its, +pg.rest); }
    if (t.dataset.mine === "cancel") { draft = null; return renderMine(); }
    if (t.dataset.mine === "save") {
      draft.name = $("#mName").value.trim();
      const err = $("#mErr");
      if (!draft.name || !draft.items.length) { err.textContent = !draft.name ? "กรุณาตั้งชื่อโปรแกรม" : "เพิ่มท่าอย่างน้อย 1 ท่า"; err.hidden = false; return; }
      const id = draft.id || "p" + Date.now(), rec = { id, name: draft.name, rest: +draft.rest, items: draft.items };
      const next = progs.filter((x) => x.id !== draft.id || !draft.id); const at = progs.findIndex((x) => x.id === draft.id);
      if (draft.id && at >= 0) next.splice(at, 0, rec); else next.push(rec);
      store.set("myPrograms", next.filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)); draft = null; toast("บันทึกโปรแกรมแล้ว"); return renderMine();
    }
    if (t.dataset.add != null) { draft.name = $("#mName").value; const d = defaultTarget(PROGRAMS[pickCat].list[+t.dataset.add]); draft.items.push({ cat: pickCat, idx: +t.dataset.add, ...d }); return renderEditor(); }
    if (t.dataset.rm != null) { draft.name = $("#mName").value; draft.items.splice(+t.dataset.rm, 1); return renderEditor(); }
    if (t.dataset.mv != null) { draft.name = $("#mName").value; const i = +t.dataset.i, j = i + +t.dataset.mv; if (j < 0 || j >= draft.items.length) return; [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]]; return renderEditor(); }
  }
  function mineChange(e) {
    const el = e.target;
    if (el.id === "mCat") { pickCat = el.value; draft.name = $("#mName").value; return renderEditor(); }
    if (el.id === "mRest") { draft.rest = +el.value; draft.name = $("#mName").value; return renderEditor(); }
    if (el.dataset.k) { const it = draft.items[+el.dataset.i]; it[el.dataset.k] = el.dataset.k === "kind" ? el.value : Math.max(1, +el.value || 1); if (el.dataset.k === "kind") { draft.name = $("#mName").value; renderEditor(); } }
  }

  /* ---------- Maximum heart rate & training zones (aerobic tab) ---------- */
  const HR_ZONES = [
    { z: 1, lo: 50, hi: 60, name: "เบามาก", use: "อบอุ่นร่างกาย / คลายกล้ามเนื้อ / ฟื้นตัว", feel: "หายใจสบาย พูดคุยได้ปกติ" },
    { z: 2, lo: 60, hi: 70, name: "เบา", use: "เผาผลาญไขมัน สร้างความทนทานพื้นฐาน", feel: "หายใจเร็วขึ้นเล็กน้อย ยังคุยได้ยาว ๆ", rec: true },
    { z: 3, lo: 70, hi: 80, name: "ปานกลาง", use: "พัฒนาหัวใจและปอด ช่วยคุมน้ำตาลได้ดี", feel: "พูดเป็นประโยคสั้น ๆ ได้ แต่ร้องเพลงไม่ได้", rec: true },
    { z: 4, lo: 80, hi: 90, name: "หนัก", use: "เพิ่มสมรรถภาพ สำหรับคนที่ฝึกสม่ำเสมอแล้ว", feel: "พูดได้ทีละคำ เหนื่อยชัดเจน" },
    { z: 5, lo: 90, hi: 100, name: "หนักมาก", use: "ช่วงสั้น ๆ สำหรับนักกีฬา ไม่แนะนำสำหรับกลุ่มเสี่ยง", feel: "พูดไม่ได้ หอบมาก" },
  ];
  function hrCalc({ age, formula }) {
    const max = Math.round(formula === "tanaka" ? 208 - 0.7 * age : 220 - age);
    const at = (pct) => Math.round((pct / 100) * max);
    return { max, at, mod: [at(64), at(76)] }; // ACSM moderate intensity: 64–76 %HRmax (inside zones 2–3)
  }
  function hrInputs() { const h = store.get("hrInput", {}); return { age: h.age || profile().age || 50, formula: h.formula || "tanaka" }; }
  function hrResult() {
    const inp = hrInputs(), r = hrCalc({ age: +inp.age, formula: inp.formula });
    const t15 = r.mod.map((v) => Math.round(v / 4));
    return `<div class="hr-top">
        <div class="hr-max"><small>อัตราการเต้นหัวใจสูงสุด (HRmax)</small><b>${r.max}</b><span>ครั้ง/นาที</span></div>
        <div class="hr-target"><small>🎯 เป้าหมายสำหรับกลุ่มเสี่ยงเบาหวาน (ความหนักปานกลาง)</small><b>${r.mod[0]}–${r.mod[1]} <span>ครั้ง/นาที</span></b>
          <span class="hr-15">จับชีพจร 15 วินาที ควรได้ <b>${t15[0]}–${t15[1]} ครั้ง</b></span></div>
      </div>
      <ol class="hr-zones">${HR_ZONES.map((z) => `<li class="hz z${z.z}${z.rec ? " rec" : ""}"><span class="hz-n">Zone ${z.z}</span>
        <div class="hz-main"><div class="hz-head"><b>${z.name}</b><small>${z.lo}–${z.hi}% HRmax</small>${z.rec ? `<em>แนะนำ</em>` : ""}</div><p>${z.use} · <i>${z.feel}</i></p>
        <div class="hz-bar" aria-hidden="true"><span style="width:${z.hi}%"></span></div></div>
        <span class="hz-bpm"><b>${r.at(z.lo)}–${z.z === 5 ? r.max : r.at(z.hi)}</b><small>ครั้ง/นาที</small></span></li>`).join("")}</ol>
      <p class="hint">${inp.formula === "tanaka" ? "สูตร Tanaka (208 − 0.7 × อายุ) เหมาะกับผู้ใหญ่และผู้สูงอายุ" : "สูตรดั้งเดิม 220 − อายุ"} · เป้าหมาย 64–76% ของ HRmax = ความหนักปานกลางตามแนวทาง ACSM (อยู่ใน Zone 2–3) · วิธีจับชีพจร: วางนิ้วชี้และนิ้วกลางที่ข้อมือด้านนิ้วโป้ง นับ 15 วินาทีแล้วคูณ 4 หรือดูจากนาฬิกาวัดชีพจร</p>`;
  }
  function hrCard() {
    const inp = hrInputs();
    return `<section class="hr-card" id="hrCard" aria-labelledby="hrTitle"><h3 id="hrTitle">❤️ คำนวณอัตราการเต้นหัวใจสูงสุด และโซนการออกกำลังกาย</h3>
      <div class="hr-form">
        <label>อายุ (ปี)<input id="hrAge" type="number" inputmode="numeric" min="15" max="100" value="${esc(String(inp.age))}"></label>
        <label>สูตรคำนวณ<select id="hrFormula"><option value="tanaka"${inp.formula === "tanaka" ? " selected" : ""}>208 − 0.7 × อายุ (Tanaka)</option><option value="classic"${inp.formula === "classic" ? " selected" : ""}>220 − อายุ</option></select></label>
      </div>
      <div id="hrOut" aria-live="polite">${hrResult()}</div>
      <p class="hr-warn">⚠️ ถ้ากินยาลดความดันกลุ่ม beta-blocker หรือมีโรคหัวใจ ชีพจรจะไม่ขึ้นตามปกติ ให้ใช้ “พูดได้แต่ร้องเพลงไม่ได้” (RPE 11–13) แทน และปรึกษาแพทย์ · หยุดทันทีถ้าเจ็บหน้าอก ใจสั่นผิดปกติ หน้ามืด หรือหายใจไม่ทัน</p>
    </section>`;
  }
  function hrUpdate() {
    const age = +$("#hrAge").value, formula = $("#hrFormula").value;
    if (!(age >= 15 && age <= 100)) { $("#hrAge").setAttribute("aria-invalid", "true"); return; }
    $("#hrAge").removeAttribute("aria-invalid");
    store.set("hrInput", { age, formula });
    $("#hrOut").innerHTML = hrResult();
  }
  const EQUIP = [
    ["assets/strength/eq1.jpg", "ยางยืดออกกำลังกาย", "ใช้กับท่าดึงยางยืด สีต่างกันคือแรงต้านต่างกัน เริ่มจากเส้นที่เบาที่สุด"],
    ["assets/strength/eq2.jpg", "ถุงทรายถ่วงข้อเท้า", "เพิ่มความยากท่านั่งแตะเข่าและยกขา เริ่ม 0.5–1 กก."],
    ["assets/strength/eq3.jpg", "ขวดน้ำ", "ขวด 600 มล. หนักประมาณ 0.6 กก. ใช้แทนดัมเบลได้"],
    ["assets/strength/eq4.jpg", "ดัมเบล", "เริ่ม 1–2 กก. ถือขณะสควอทหรือยกแขนเพื่อเพิ่มแรงต้าน"],
  ];
  function equipStrip() {
    return `<section class="equip" aria-labelledby="equipH"><h3 id="equipH">🏋️ อุปกรณ์ช่วยเพิ่มแรงต้าน <small>ไม่มีก็ฝึกได้ด้วยน้ำหนักตัว · แตะรูปเพื่อขยาย</small></h3>
      <div class="equip-row">${EQUIP.map(([src, n, t]) => `<figure class="equip-item"><button type="button" data-zoom="${src}" data-cap="${esc(n)}" data-credit="" aria-label="ขยายภาพ${esc(n)}"><img src="${src}" alt="${esc(n)}" loading="lazy"></button><figcaption><b>${n}</b><span>${t}</span></figcaption></figure>`).join("")}</div></section>`;
  }
  // "① … ② …" descriptions → short intro + numbered steps (easier to follow than one long paragraph)
  function descHTML(d) {
    if (!/[①-⑩]/.test(d)) return `<p>${d}</p>`;
    const [intro, ...steps] = d.split(/[①-⑩]/).map((x) => x.trim());
    return `${intro ? `<p class="ex-alt">${intro}</p>` : ""}<ol class="ex-steps">${steps.filter(Boolean).map((x) => `<li>${x}</li>`).join("")}</ol>`;
  }
  function renderExercise() {
    const myRx = rxLatest();
    $("#exTabs").innerHTML = [["rx", `🩺 จากนักกายภาพ${myRx && !myRx.seen ? " •" : ""}`], ["mine", "★ โปรแกรมของฉัน"], ...Object.entries(PROGRAMS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="tab ${k === "mine" ? "mine-tab" : k === "rx" ? "rx-tab" : ""}" role="tab" aria-selected="${k === exTab}" data-k="${k}">${l}</button>`).join("");
    if (exTab === "mine") return renderMine();
    if (exTab === "rx") return renderRx();
    const pr = PROGRAMS[exTab];
    $("#exPanel").innerHTML = `<div class="card ${["thai", "pakhaoma", "isan"].includes(exTab) ? "thai-set" : ""}"><div class="card-head"><h2>${pr.label}</h2>${pr.full ? `<button class="btn sm" data-full="1">บันทึกว่าทำครบชุด ${pr.list.length} ท่า</button>` : ""}</div><p class="lede">${pr.why}</p>
      ${trainBar(`เริ่มฝึกทั้งโปรแกรม (${pr.list.length} ท่า)`)}
      ${pr.video ? videoCard(pr.video) : ""}
      <div class="ex-intro">${pr.fitt.map((f) => `<div class="fitt"><small>${f[0]}</small><b>${f[1]}</b></div>`).join("")}</div>
      ${exTab === "aerobic" ? hrCard() : ""}
      ${exTab === "strength" ? equipStrip() : ""}
      ${pr.infos ? `<div class="info-imgs"><small class="k">อ่านก่อนฝึก · แตะเพื่อขยาย</small><div class="row">${pr.infos.map(([src, cap]) => `<button type="button" class="info-img" data-zoom="${src}" data-cap="${esc(cap)}" data-credit="${esc(pr.list[0].credit || "")}"><img src="${src}" alt="${esc(cap)}" loading="lazy"><span>${esc(cap)}</span></button>`).join("")}</div></div>` : ""}
      <div class="ex-list">${pr.list.map((e, i) => `<div class="ex" id="exCard${i}">${exFigHTML(exTab, i)}<h3>${e.n}</h3>${descHTML(e.d)}<span class="dose">${e.dose}${e.type && e.type !== exTab ? ` · <span class="wtag ${e.type}">${TYPE_TH[e.type]}</span>` : ""}</span>
        <div class="ex-actions"><button class="btn sm primary" type="button" data-play="${i}">▶ ฝึกท่านี้</button><button class="btn sm" type="button" data-log="${i}">บันทึกว่าทำแล้ว</button>${e.track ? `<span class="ai-chip" title="รองรับ AI นับครั้งและตรวจท่า">AI</span>` : ""}</div></div>`).join("")}</div>
      ${pr.source ? `<p class="hint">ท่าอ้างอิงจาก ${pr.source[1] ? `<a href="${pr.source[1]}" target="_blank" rel="noopener">${pr.source[0]}</a>` : `<b>${pr.source[0]}</b>`} · ${PROGRAMS[exTab].cover ? (exTab === "balance" ? "จำนวนครั้งตามภาพต้นฉบับ ทำช้า ๆ ข้างโต๊ะหรือเก้าอี้ที่มั่นคง จำนวนครั้งปรับตามความสามารถและคำแนะนำของนักกายภาพบำบัด" : exTab === "flex" ? "ภาพประกอบจากอินโฟกราฟิกต้นฉบับ แตะภาพเพื่อขยาย ค้างท่าให้รู้สึกตึง ไม่เจ็บ" : "จำนวนครั้งตามภาพต้นฉบับ แตะภาพเพื่อดูขั้นตอนเต็ม") : "คำอธิบายเรียบเรียงเพื่อใช้ในแอปนี้"}</p>` : ""}</div>`;
    mountAnims($("#exPanel"));
  }
  function initExercise() {
    renderExercise(); initPlayer();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(() => {
      $$(".ex-fig.anim").forEach((box) => { const fr = [...box.children], k = fr.findIndex((x) => x.classList.contains("on")); if (k < 0) return; fr[k].classList.remove("on"); fr[(k + 1) % fr.length].classList.add("on"); });
    }, 1100);
    $("#homeGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-ex]"); if (b) { exTab = b.dataset.ex; renderExercise(); } });
    $("#exTabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) { exTab = b.dataset.k; draft = null; renderExercise(); } });
    $("#exPanel").addEventListener("click", (e) => {
      const pm = e.target.closest("[data-pref-mode]"); if (pm) { setPrefs({ mode: pm.dataset.prefMode }); return renderExercise(); }
      if (exTab === "mine") return mineClick(e);
      if (exTab === "rx") return rxClick(e);
      const yt = e.target.closest("[data-yt]");
      if (yt) { const v = PROGRAMS[exTab].video, fr = $("#vframe");
        if (!fr.querySelector("iframe")) fr.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&playsinline=1" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        fr.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (e.target.closest("[data-vlog]")) { const v = PROGRAMS[exTab].video; addLog({ type: "aerobic", name: (v.music ? "ฝึกพร้อมเพลง " : "ฝึกตามวิดีโอ ") + PROGRAMS[exTab].label, minutes: v.min }); return toast(`บันทึกการฝึก${v.music ? "พร้อมเพลง" : "ตามวิดีโอ"} ${v.min} นาทีแล้ว`); }
      const pl = e.target.closest("[data-play]");
      if (pl) { const pr = PROGRAMS[exTab], idx = pl.dataset.play === "all" ? pr.list.map((_, i) => i) : [+pl.dataset.play];
        return openPlayer(pl.dataset.play === "all" ? pr.label : pr.list[idx[0]].n, idx.map((i) => normItem(exTab, i)), 15); }
      const b = e.target.closest("[data-log]"); if (b) { const ex = PROGRAMS[exTab].list[+b.dataset.log]; addLog({ type: ex.type || exTab, name: ex.n, minutes: ex.m }); toast(`บันทึก “${ex.n}” ${ex.m} นาทีแล้ว`); }
      const f = e.target.closest("[data-full]"); if (f) { const fu = PROGRAMS[exTab].full; addLog({ type: fu.type, name: fu.name, minutes: fu.minutes }); toast(`บันทึก “${fu.name}” ${fu.minutes} นาทีแล้ว`); }
    });
    $("#exPanel").addEventListener("input", (e) => { if (e.target.closest("#hrCard")) hrUpdate(); });
    $("#exPanel").addEventListener("change", (e) => {
      if (e.target.closest("#hrCard")) return hrUpdate();
      const pf = e.target.closest("[data-pref]"); if (pf) { setPrefs({ [pf.dataset.pref]: pf.checked }); return renderExercise(); }
      if (exTab === "mine" && draft) mineChange(e);
    });
    const W = [["จันทร์", "aerobic:เดินเร็ว 30 นาที", "strength:ช่วงล่าง 3 ท่า", "flex:ยืด 10 นาที"], ["อังคาร", "aerobic:ปั่นจักรยาน 30 นาที", "balance:ยืนขาเดียว + ต่อเท้า"],
      ["พุธ", "aerobic:เดินเร็ว 30 นาที", "strength:ช่วงบน 3 ท่า", "flex:ยืด 10 นาที"], ["พฤหัสบดี", "aerobic:ย่ำเท้า 5 × 3 นาที + เดิน 15", "flex:ผ้าขาวม้าพาฟิต 22 ท่า"],
      ["ศุกร์", "aerobic:เดินเร็ว 30 นาที", "strength:ทั้งตัว 5 ท่า", "flex:ยืด 10 นาที"], ["เสาร์", "aerobic:เซิ้งอีสาน 7 ท่า + เกมส์ Bubble Pop", "balance:ลุกนั่งช้า"], ["อาทิตย์", "flex:บริหารสไตล์ไทย 12 ท่า / พัก"]];
    $("#weekPlan").innerHTML = `<thead><tr>${W.map((d) => `<th>${d[0]}</th>`).join("")}</tr></thead><tbody><tr>${W.map((d) => `<td>${d.slice(1).map((x) => { const [t, s] = x.split(":"); return `<span class="wtag ${t}">${TYPE_TH[t]}</span><br>${s}`; }).join("<br>")}</td>`).join("")}</tr></tbody>`;
  }

  /* ---------- fitness assessment ---------- */
  // ref: {m:[poor, good], f:[...]}; lower=true means smaller is better. Approximate references for adults 40–69.
  const TESTS = [
    { k: "chair30", n: "ลุก-นั่งเก้าอี้ 30 วินาที", u: "ครั้ง", what: "ความแข็งแรงกล้ามเนื้อขา", ref: { m: [12, 17], f: [11, 15] } },
    { k: "step2", n: "ยกเข่าขึ้นลง 2 นาที", u: "ครั้ง", what: "ความทนทานของหัวใจและปอด", ref: { m: [87, 115], f: [75, 107] } },
    { k: "sitreach", n: "นั่งเก้าอี้เอื้อมแตะปลายเท้า", u: "ซม.", what: "ความอ่อนตัวต้นขาด้านหลัง", ref: { m: [-2.5, 10], f: [-1.3, 12.7] } },
    { k: "tug", n: "ลุกเดินไป-กลับ 8 ฟุต (TUG)", u: "วินาที", what: "ความคล่องแคล่วและการทรงตัว", lower: true, ref: { m: [8.5, 6], f: [8.5, 6.4] } },
    { k: "sls", n: "ยืนขาเดียวลืมตา", u: "วินาที", what: "การทรงตัวขณะอยู่นิ่ง", ref: { m: [10, 30], f: [10, 30] } },
    { k: "grip", n: "แรงบีบมือ", u: "กก.", what: "ความแข็งแรงโดยรวม (AWGS 2019)", ref: { m: [28, 36], f: [18, 24] } },
  ];
  function rate(t, v, sex) {
    if (v == null || v === "" || isNaN(v)) return null;
    const [a, b] = t.ref[sex] || t.ref.m;
    if (t.lower) return v > a ? ["ควรปรับปรุง", "high"] : v > b ? ["พอใช้", "mod"] : ["ดี", "low"];
    return v < a ? ["ควรปรับปรุง", "high"] : v < b ? ["พอใช้", "mod"] : ["ดี", "low"];
  }
  function renderFitness() {
    const rows = store.get("fitness", []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const sex = profile().sex, last = rows[rows.length - 1], prev = rows[rows.length - 2];
    $("#fitResult").innerHTML = last ? `<p class="lede">ครั้งล่าสุด ${thDate(last.date)}${prev ? ` เทียบกับ ${thDate(prev.date)}` : ""} · เกณฑ์อ้างอิงโดยประมาณ</p>` + TESTS.map((t) => {
      const r = rate(t, last[t.k], sex); const d = prev && last[t.k] != null && prev[t.k] != null ? last[t.k] - prev[t.k] : null;
      const better = d == null ? "" : (t.lower ? d < 0 : d > 0) ? "down" : d === 0 ? "" : "up";
      return `<div class="fit-row"><span>${t.n}<br><small style="color:var(--muted)">${t.what}</small></span><span class="val">${fmt(last[t.k], t.k === "tug" || t.k === "sitreach" ? 1 : 0)} ${t.u}${d != null ? ` <small class="${better}">${d > 0 ? "+" : ""}${fmt(d, 1)}</small>` : ""}</span>${r ? `<span class="pill ${r[1]}">${r[0]}</span>` : "<span></span>"}</div>`;
    }).join("") : `<p class="lede">ยังไม่มีผลการประเมิน</p>`;
    $("#fitTable").innerHTML = `<thead><tr><th>วันที่</th>${TESTS.map((t) => `<th class="num">${t.n.split(" ")[0]}<br>(${t.u})</th>`).join("")}</tr></thead><tbody>` +
      rows.slice().reverse().map((r) => `<tr><td>${thDate(r.date)}${r.sample ? '<span class="tag-sample">ตัวอย่าง</span>' : ""}</td>${TESTS.map((t) => `<td class="num">${r[t.k] ?? "–"}</td>`).join("")}</tr>`).join("") + "</tbody>";
  }
  function initFitness() {
    $("#fitFields").innerHTML = TESTS.map((t) => `<div class="fit-test"><div><b>${t.n}</b><p>${t.what}</p></div><label><span class="sr">${t.u}</span><input id="f-${t.k}" type="number" step="0.1" placeholder="${t.u}"></label></div>`).join("");
    $("#f-date").value = todayISO();
    $("#fitForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const r = { date: $("#f-date").value, age: +$("#f-age").value };
      let any = false; TESTS.forEach((t) => { const v = $("#f-" + t.k).value; if (v !== "") { r[t.k] = +v; any = true; } });
      if (!any) return toast("กรอกผลอย่างน้อย 1 รายการ");
      const rows = store.get("fitness", []).filter((x) => !x.sample); rows.push(r); store.set("fitness", rows);
      renderFitness(); toast("บันทึกผลสมรรถภาพกายแล้ว"); $("#fitForm").reset(); $("#f-date").value = todayISO();
    });
    renderFitness();
  }

  /* ---------- body composition ---------- */
  let chart;
  const METRIC = { weight: ["น้ำหนัก", "กก."], bmi: ["BMI", ""], fat: ["ไขมัน", "%"], muscle: ["มวลกล้ามเนื้อ", "กก."], waist: ["รอบเอว", "ซม."], visc: ["ไขมันช่องท้อง", ""] };
  const withBmi = (r) => ({ ...r, bmi: r.weight / (r.height / 100) ** 2, whtr: r.waist ? r.waist / r.height : null });
  function renderBody() {
    const rows = store.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date)).map(withBmi);
    $("#sampleBanner").hidden = !rows.some((r) => r.sample);
    const first = rows[0], last = rows[rows.length - 1];
    // goodWhenDown: weight, bmi, fat, waist, visc are better lower; muscle better higher
    const items = [["weight", "น้ำหนัก", "กก.", 1], ["bmi", "BMI", "", 1], ["fat", "ไขมันในร่างกาย", "%", 1], ["muscle", "มวลกล้ามเนื้อ", "กก.", 0], ["waist", "รอบเอว", "ซม.", 1], ["visc", "ไขมันช่องท้อง", "ระดับ", 1]];
    $("#bodyDelta").innerHTML = rows.length >= 2 ? items.map(([k, n, u, down]) => {
      const d = last[k] != null && first[k] != null ? last[k] - first[k] : null; const good = d == null || d === 0 ? "" : (down ? d < 0 : d > 0) ? "down" : "up";
      return `<div class="delta"><small>${n}</small><b>${fmt(last[k])}</b> <small style="display:inline">${u}</small><span class="${good}">${d == null ? "–" : (d > 0 ? "▲ +" : "▼ ") + fmt(d)} จากครั้งแรก</span></div>`;
    }).join("") + (first ? `<p class="hint" style="grid-column:1/-1">เทียบ ${thDate(first.date)} → ${thDate(last.date)} (${rows.length} ครั้ง) ${first.weight ? `· น้ำหนักลดลง ${fmt(((first.weight - last.weight) / first.weight) * 100)}% เป้าหมาย 5–7%` : ""}</p>` : "")
      : `<p class="lede" style="grid-column:1/-1">บันทึกอย่างน้อย 2 ครั้งเพื่อดูการเปลี่ยนแปลง</p>`;
    $("#bodyTable").innerHTML = `<thead><tr><th>วันที่</th><th class="num">น้ำหนัก</th><th class="num">BMI</th><th class="num">รอบเอว</th><th class="num">WHtR</th><th class="num">ไขมัน %</th><th class="num">กล้ามเนื้อ</th><th class="num">ไขมันช่องท้อง</th><th class="num">BMR</th><th class="num">น้ำ %</th><th class="num">อายุร่างกาย</th><th></th></tr></thead><tbody>` +
      (rows.length ? rows.slice().reverse().map((r, i, arr) => {
        const p = arr[i + 1]; const dd = (k, down) => { if (!p || r[k] == null || p[k] == null) return ""; const d = r[k] - p[k]; if (!d) return ""; return ` <small class="${(down ? d < 0 : d > 0) ? "down" : "up"}">${d > 0 ? "+" : ""}${fmt(d)}</small>`; };
        return `<tr><td>${thDate(r.date)}${r.sample ? '<span class="tag-sample">ตัวอย่าง</span>' : ""}</td><td class="num">${fmt(r.weight)}${dd("weight", 1)}</td><td class="num">${fmt(r.bmi)}</td><td class="num">${fmt(r.waist, 0)}${dd("waist", 1)}</td>
          <td class="num"><span class="pill ${r.whtr == null ? "" : r.whtr >= 0.5 ? "high" : "low"}">${fmt(r.whtr, 2)}</span></td><td class="num">${fmt(r.fat)}${dd("fat", 1)}</td><td class="num">${fmt(r.muscle)}${dd("muscle", 0)}</td><td class="num">${r.visc ?? "–"}</td><td class="num">${r.bmr ?? "–"}</td><td class="num">${r.water ?? "–"}</td><td class="num">${r.mage ?? "–"}</td>
          <td><button class="link" data-del="${r.date}">ลบ</button></td></tr>`;
      }).join("") : `<tr><td colspan="12" class="empty">ยังไม่มีข้อมูล บันทึกครั้งแรกจากแบบฟอร์มด้านบน</td></tr>`) + "</tbody>";
    drawChart(rows);
    liveInterp();
  }
  function drawChart(rows) {
    if (!window.Chart) { $(".chart-box").innerHTML = '<p class="lede">โหลดไลบรารีกราฟไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต</p>'; return; }
    const k = $("#bodyMetric").value, cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue("--muted").trim(), line = cs.getPropertyValue("--line").trim(), leaf = cs.getPropertyValue("--blue-ink").trim();
    const data = { labels: rows.map((r) => thDate(r.date)), datasets: [{ label: METRIC[k][0], data: rows.map((r) => (r[k] == null ? null : +(+r[k]).toFixed(1))), borderColor: leaf, backgroundColor: leaf + "22", fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: leaf }] };
    if (chart) chart.destroy();
    chart = new Chart($("#bodyChart"), { type: "line", data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: ink }, grid: { color: line } }, y: { ticks: { color: ink }, grid: { color: line }, title: { display: !!METRIC[k][1], text: METRIC[k][1], color: ink } } } } });
  }
  /* ---------- body composition: interpretation by age & sex ---------- */
  // Body fat: Gallagher et al. 2000 (used on Tanita charts). Skeletal muscle %: Omron reference.
  // BMI: WHO Asia-Pacific. Visceral fat: Tanita/Omron levels. Water: usual BIA ranges. BMR: vs Mifflin-St Jeor.
  const FAT_REF = { f: [[39, [21, 33, 39]], [59, [23, 34, 40]], [200, [24, 36, 42]]], m: [[39, [8, 20, 25]], [59, [11, 22, 28]], [200, [13, 25, 30]]] };
  const SMM_REF = { f: [[39, [24.3, 30.4, 35.4]], [59, [24.1, 30.2, 35.2]], [200, [23.9, 30.0, 35.0]]], m: [[39, [33.3, 39.4, 44.1]], [59, [33.1, 39.2, 43.9]], [200, [32.9, 39.0, 43.7]]] };
  const byAge = (tbl, age) => tbl.find(([max]) => age <= max)[1];
  const ageBand = (age) => (age <= 39 ? "20–39 ปี" : age <= 59 ? "40–59 ปี" : "60 ปีขึ้นไป");
  function interpRows(r) {
    const age = r.age, sex = r.sex, out = [];
    if (!age || !sex) return null;
    const S = (label, cls) => ({ label, cls });
    const bar = (min, max, cuts, colors, val) => ({ min, max, cuts, colors, val });
    if (r.weight && r.height) {
      const bmi = r.weight / (r.height / 100) ** 2, st = bmi < 18.5 ? S("น้ำหนักน้อย", "mod") : bmi < 23 ? S("ปกติ", "low") : bmi < 25 ? S("น้ำหนักเกิน", "mod") : bmi < 30 ? S("อ้วนระดับ 1", "high") : S("อ้วนระดับ 2", "crit");
      out.push({ k: "BMI", v: fmt(bmi), u: "kg/m²", st, ref: `ปกติ 18.5–22.9 (เกณฑ์คนเอเชีย)${age >= 65 ? " · ผู้สูงอายุ 22–27 ถือว่าเหมาะสม" : ""}`,
        bar: bar(15, 35, [18.5, 23, 25, 30], ["mod", "low", "mod", "high", "crit"], bmi), tip: bmi >= 23 ? `ลดน้ำหนัก 5–7% (${fmt(r.weight * 0.05)}–${fmt(r.weight * 0.07)} กก.) ช่วยลดความเสี่ยงเบาหวาน` : bmi < 18.5 ? "เพิ่มพลังงานและโปรตีน ร่วมกับเสริมแรง" : "รักษาน้ำหนักนี้ไว้" });
    }
    if (r.fat) {
      const [lo, hi, ob] = byAge(FAT_REF[sex], age), st = r.fat < lo ? S("ต่ำ", "mod") : r.fat < hi ? S("ปกติ", "low") : r.fat < ob ? S("สูง", "high") : S("สูงมาก (อ้วน)", "crit");
      out.push({ k: "ไขมันในร่างกาย", v: fmt(r.fat), u: "%", st, ref: `${sex === "m" ? "ชาย" : "หญิง"} ${ageBand(age)}: ปกติ ${lo}–${hi - 0.1}%, สูง ${hi}–${ob - 0.1}%, อ้วน ≥${ob}%`,
        bar: bar(lo - 8, ob + 8, [lo, hi, ob], ["mod", "low", "high", "crit"], r.fat), tip: r.fat >= hi ? "แอโรบิก 150–300 นาที/สัปดาห์ ร่วมกับคุมอาหาร ลดไขมันโดยไม่เสียกล้ามเนื้อ" : "ดีแล้ว รักษาการออกกำลังกายสม่ำเสมอ" });
    }
    if (r.muscle && r.weight) {
      if ((r.mtype || "smm") === "smm") {
        const pct = r.muscle / r.weight * 100, [lo, hi, vh] = byAge(SMM_REF[sex], age), st = pct < lo ? S("ต่ำ", "high") : pct < hi ? S("ปกติ", "low") : pct < vh ? S("ดี", "low") : S("ดีมาก", "low");
        out.push({ k: "กล้ามเนื้อลาย", v: fmt(pct), u: "% ของน้ำหนัก", st, ref: `${sex === "m" ? "ชาย" : "หญิง"} ${ageBand(age)}: ปกติ ${lo}–${hi}% (${fmt(r.muscle)} กก.)`,
          bar: bar(lo - 8, vh + 4, [lo, hi, vh], ["high", "low", "low", "low"], pct), tip: pct < lo ? `กล้ามเนื้อน้อย ${age >= 60 ? "เสี่ยงภาวะกล้ามเนื้อพร่อง " : ""}ควรเสริมแรง 2–3 วัน/สัปดาห์ และกินโปรตีนให้พอ` : "กล้ามเนื้อช่วยใช้กลูโคส รักษาไว้ด้วยการเสริมแรง" });
      } else out.push({ k: "มวลกล้ามเนื้อรวม", v: fmt(r.muscle), u: "กก.", st: S("ดูแนวโน้ม", ""), ref: "ค่ากล้ามเนื้อรวมต่างกันตามยี่ห้อเครื่อง ให้เทียบกับครั้งก่อนจากเครื่องเดิม", tip: "ควรเพิ่มขึ้นหรือคงที่เมื่อลดน้ำหนัก" });
    }
    if (r.visc) {
      const st = r.visc <= 9 ? S("ปกติ", "low") : r.visc <= 14 ? S("สูง", "high") : S("สูงมาก", "crit");
      out.push({ k: "ไขมันช่องท้อง", v: fmt(r.visc, 0), u: "ระดับ", st, ref: "ปกติ 1–9 · สูง 10–14 · สูงมาก ≥15", bar: bar(1, 20, [10, 15], ["low", "high", "crit"], r.visc),
        tip: r.visc >= 10 ? "ไขมันช่องท้องสัมพันธ์กับภาวะดื้ออินซูลินโดยตรง ลดได้ดีด้วยแอโรบิกและลดน้ำตาล" : "อยู่ในเกณฑ์ดี" });
    }
    if (r.waist) {
      const cut = sex === "m" ? 90 : 80, whtr = r.height ? r.waist / r.height : null, st = r.waist >= cut ? S("อ้วนลงพุง", "high") : S("ปกติ", "low");
      out.push({ k: "รอบเอว", v: fmt(r.waist, 0), u: "ซม.", st, ref: `${sex === "m" ? "ชาย" : "หญิง"} ไม่ควรเกิน ${cut} ซม.${whtr ? ` · WHtR ${fmt(whtr, 2)} (ไม่ควรเกิน 0.5 = ${fmt(r.height / 2, 0)} ซม.)` : ""}`,
        bar: bar(cut - 25, cut + 25, [cut], ["low", "high"], r.waist), tip: r.waist >= cut ? `ลดรอบเอวอีก ${fmt(r.waist - cut + 1, 0)} ซม. จะพ้นเกณฑ์อ้วนลงพุง` : "รักษาไว้" });
    }
    if (r.water) {
      const [lo, hi] = sex === "m" ? [50, 65] : [45, 60], st = r.water < lo ? S("ต่ำ", "mod") : r.water <= hi ? S("ปกติ", "low") : S("สูง", "mod");
      out.push({ k: "น้ำในร่างกาย", v: fmt(r.water), u: "%", st, ref: `${sex === "m" ? "ชาย" : "หญิง"}: ปกติ ${lo}–${hi}%`, bar: bar(lo - 10, hi + 8, [lo, hi], ["mod", "low", "mod"], r.water), tip: r.water < lo ? "ดื่มน้ำวันละ 6–8 แก้ว ค่านี้มักต่ำเมื่อไขมันสูง" : "อยู่ในเกณฑ์" });
    }
    if (r.bmr && r.weight && r.height) {
      const pred = 10 * r.weight + 6.25 * r.height - 5 * age + (sex === "m" ? 5 : -161), ratio = r.bmr / pred, st = ratio < 0.9 ? S("ต่ำกว่าคาด", "mod") : ratio <= 1.1 ? S("ตามเกณฑ์", "low") : S("สูงกว่าคาด", "low");
      out.push({ k: "BMR", v: fmt(r.bmr, 0), u: "kcal/วัน", st, ref: `ค่าคาดการณ์สำหรับอายุ ${age} ปี ≈ ${Math.round(pred)} kcal (สูตร Mifflin-St Jeor)`, tip: ratio < 0.9 ? "การเผาผลาญต่ำ เพิ่มกล้ามเนื้อด้วยการเสริมแรง" : "การเผาผลาญเหมาะสมกับอายุ" });
    }
    if (r.mage) {
      const d = r.mage - age, st = d <= 0 ? S("อ่อนกว่าอายุจริง", "low") : d <= 5 ? S("มากกว่าเล็กน้อย", "mod") : S("มากกว่าอายุจริง", "high");
      out.push({ k: "อายุร่างกาย", v: fmt(r.mage, 0), u: "ปี", st, ref: `อายุจริง ${age} ปี (${d > 0 ? "+" : ""}${d} ปี)`, tip: d > 0 ? "เพิ่มกล้ามเนื้อและลดไขมัน อายุร่างกายจะลดลง" : "ร่างกายแข็งแรงกว่าวัย" });
    }
    if (r.bone && r.weight) {
      const ref = sex === "m" ? (r.weight < 65 ? 2.66 : r.weight <= 95 ? 3.29 : 3.69) : (r.weight < 50 ? 1.95 : r.weight <= 75 ? 2.4 : 2.95);
      const st = r.bone < ref - 0.3 ? S("ต่ำกว่าเฉลี่ย", "mod") : S("ใกล้เคียงเฉลี่ย", "low");
      out.push({ k: "มวลกระดูก", v: fmt(r.bone), u: "กก.", st, ref: `ค่าเฉลี่ยสำหรับน้ำหนักนี้ ≈ ${ref} กก.`, tip: st.cls === "mod" ? "ออกกำลังกายแบบลงน้ำหนักและได้รับแคลเซียม วิตามินดี" : "อยู่ในเกณฑ์" });
    }
    return out;
  }
  function renderInterp(r, label) {
    const rows = r ? interpRows(r) : null;
    $("#interpFor").textContent = label || "";
    if (!rows) { $("#bodyInterp").innerHTML = `<p class="lede">กรอกอายุและเพศ พร้อมค่าอย่างน้อย 1 รายการ ระบบจะแปลผลตามเกณฑ์ของช่วงอายุคุณทันที</p>`; return; }
    if (!rows.length) { $("#bodyInterp").innerHTML = `<p class="lede">ยังไม่มีค่าที่แปลผลได้</p>`; return; }
    const barHtml = (b) => { if (!b) return ""; const span = b.max - b.min, pts = [b.min, ...b.cuts, b.max], pos = Math.max(0, Math.min(100, ((b.val - b.min) / span) * 100));
      return `<div class="ibar">${pts.slice(0, -1).map((x, i) => `<i class="${b.colors[i]}" style="flex:${pts[i + 1] - x}"></i>`).join("")}<b style="left:${pos}%"></b></div>`; };
    const bad = rows.filter((x) => ["high", "crit"].includes(x.st.cls)).length;
    $("#bodyInterp").innerHTML = `<div class="isum ${bad ? "warn" : "good"}">${bad ? `มี ${bad} ค่าที่ควรปรับปรุง` : "ทุกค่าอยู่ในเกณฑ์ดี"}</div>` + rows.map((x) => `<div class="irow">
      <div class="ihead"><span>${x.k}</span><b>${x.v} <small>${x.u}</small></b><span class="pill ${x.st.cls}">${x.st.label}</span></div>${barHtml(x.bar)}
      <p class="iref">${x.ref}</p><p class="itip">${x.tip}</p></div>`).join("");
  }
  function bodyFormValues() {
    const n = (id) => ($(id).value === "" ? null : +$(id).value);
    return { date: $("#b-date").value, age: n("#b-age"), sex: $('input[name="b-sex"]:checked')?.value || null, height: n("#b-ht"), weight: n("#b-wt"), waist: n("#b-waist"), fat: n("#b-fat"),
      muscle: n("#b-muscle"), mtype: $("#b-mtype").value, visc: n("#b-visc"), bmr: n("#b-bmr"), water: n("#b-water"), bone: n("#b-bone"), mage: n("#b-mage") };
  }
  function liveInterp() {
    const v = bodyFormValues(), hasAny = ["weight", "fat", "muscle", "visc", "waist", "water", "bmr", "mage"].some((k) => v[k] != null);
    if (hasAny) return renderInterp(v, "ค่าที่กำลังกรอก (ยังไม่ได้บันทึก)");
    const body = store.get("body", []).slice().sort((x, y) => x.date.localeCompare(y.date)), last = body[body.length - 1];
    if (last) { const pr = profile(), ri = store.get("riskInput", {}) || {}; renderInterp({ ...last, age: last.age || ri.age || pr.age, sex: last.sex || ri.sex || pr.sex }, `ผลวันที่ ${thDate(last.date)}${last.sample ? " (ข้อมูลตัวอย่าง)" : ""}`); }
    else renderInterp(null);
  }

  /* ---------- body composition: read values from a photo (Tesseract OCR, Thai + English) ---------- */
  const OCR_FIELDS = [
    ["#b-wt", [/weight|body\s*weight|น.{0,3}หนัก/i], 25, 250],
    ["#b-fat", [/pbf|percent\s*body\s*fat|body\s*fat|fat\s*%|%\s*fat|ไขมันในร่างกาย|เปอร์เซ็นต์ไขมัน|ไขมัน\s*\(%\)/i], 3, 70],
    ["#b-muscle", [/smm|skeletal\s*muscle|muscle\s*mass|muscle|กล้ามเนื้อ/i], 8, 100],
    ["#b-visc", [/visceral|vfl|ไขมันในช่องท้อง|ไขมันช่องท้อง|ไขมันอวัยวะภายใน/i], 1, 60],
    ["#b-bmr", [/bmr|basal\s*metabolic|การเผาผลาญ|อัตราการเผาผลาญ/i], 600, 4000],
    ["#b-water", [/tbw|body\s*water|water|น.{0,3}ในร่างกาย|ปริมาณน.{0,3}/i], 25, 80],
    ["#b-bone", [/bone|กระด.{0,2}ก/i], 0.5, 6],
    ["#b-mage", [/metabolic\s*age|body\s*age|อายุร่างกาย|อายุเมตาบอลิก|อายุการเผาผลาญ/i], 10, 100],
    ["#b-ht", [/height|ส.{0,2}วนสูง/i], 100, 220],
    ["#b-waist", [/waist|รอบเอว/i], 40, 200],
  ];
  function parseOcr(text) {
    const lines = text.replace(/,/g, ".").split(/\n+/).map((l) => l.trim()).filter(Boolean), found = {};
    const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    OCR_FIELDS.forEach(([id, pats, lo, hi]) => {
      for (let i = 0; i < lines.length && found[id] == null; i++) {
        const ln = lines[i]; let m = null; for (const p of pats) { m = ln.match(p); if (m) break; }
        if (!m) continue;
        if (id === "#b-muscle" && /fat|ไขมัน/i.test(ln.slice(0, m.index))) continue;
        if (id === "#b-fat" && /visceral|ช่องท้อง/i.test(ln)) continue;
        if (id === "#b-wt" && /target|ideal|control|เป้าหมาย|มาตรฐาน/i.test(ln)) continue;
        if (id === "#b-water" && /ไขมัน|fat|กล้าม/i.test(ln)) continue;
        const cand = [...nums(ln.slice(m.index + m[0].length)), ...nums(lines[i + 1] || "")].find((x) => x >= lo && x <= hi);
        if (cand != null) found[id] = cand;
      }
    });
    if (found["#b-mage"] != null && found["#b-mage"] === found["#b-wt"]) delete found["#b-mage"];
    return found;
  }
  let tessLoading = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tessLoading) tessLoading = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/tesseract/tesseract.min.js"; sc.onload = res; sc.onerror = () => rej(new Error("โหลดตัวอ่านข้อความไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต")); document.head.appendChild(sc); });
    return tessLoading;
  }
  async function readBodyPhoto(file) {
    if (!file || !file.type.startsWith("image/")) return toast("กรุณาเลือกไฟล์รูปภาพ");
    const url = URL.createObjectURL(file); $("#ocrThumb").src = url; $("#ocrThumb").hidden = false; $("#ocrText").hidden = true; $("#ocrDrop").classList.add("has");
    const prog = $("#ocrProg"), bar = $("#ocrBar"), st = $("#ocrStatus"), note = $("#ocrNote");
    prog.hidden = false; note.hidden = true; $("#ocrRawBox").hidden = true; bar.style.width = "4%"; st.textContent = "กำลังโหลดตัวอ่านข้อความ (ครั้งแรกอาจใช้เวลาสักครู่)…";
    $$("#bodyForm input").forEach((i) => i.classList.remove("auto"));
    try {
      await loadTesseract();
      const { data } = await Tesseract.recognize(url, "tha+eng", { workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href, corePath: new URL("vendor/tesseract/core", location.href).href, langPath: new URL("vendor/tesseract/lang", location.href).href, logger: (m) => { if (m.status === "recognizing text") { bar.style.width = Math.round(10 + m.progress * 90) + "%"; st.textContent = `กำลังอ่านค่าจากรูป ${Math.round(m.progress * 100)}%`; } else if (m.status) st.textContent = "กำลังเตรียม: " + m.status; } });
      const found = parseOcr(data.text);
      $("#ocrRaw").textContent = data.text.trim() || "(อ่านข้อความไม่ได้)"; $("#ocrRawBox").hidden = false;
      const names = { "#b-wt": "น้ำหนัก", "#b-fat": "ไขมัน %", "#b-muscle": "กล้ามเนื้อ", "#b-visc": "ไขมันช่องท้อง", "#b-bmr": "BMR", "#b-water": "น้ำในร่างกาย", "#b-bone": "มวลกระดูก", "#b-mage": "อายุร่างกาย", "#b-ht": "ส่วนสูง", "#b-waist": "รอบเอว" };
      Object.entries(found).forEach(([id, val]) => { $(id).value = val; $(id).classList.add("auto"); });
      if (/smm|skeletal/i.test(data.text)) $("#b-mtype").value = "smm"; else if (/tanita|xiaomi|mi\s*scale|muscle\s*mass/i.test(data.text)) $("#b-mtype").value = "total";
      const keys = Object.keys(found);
      note.hidden = false;
      note.className = "ocr-note " + (keys.length ? "ok" : "bad");
      note.innerHTML = keys.length ? `อ่านได้ ${keys.length} ค่า: <b>${keys.map((k) => names[k]).join(", ")}</b> · ช่องที่ไฮไลต์สีฟ้ามาจากรูป กรุณาตรวจสอบให้ตรงกับใบผลก่อนบันทึก และกรอกค่าที่ยังขาด`
        : "อ่านค่าจากรูปไม่ได้ ลองถ่ายใหม่ให้ตรงและชัดขึ้น หรือเลือก “กรอกเอง”";
      prog.hidden = true; liveInterp();
    } catch (err) { prog.hidden = true; note.hidden = false; note.className = "ocr-note bad"; note.textContent = err.message || String(err); }
  }
  function setBodyMode(mode) {
    $$("#bodyForm .seg button").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === mode));
    $("#ocrBox").hidden = mode !== "photo";
  }
  function initBody() {
    $("#b-date").value = todayISO();
    const ri = store.get("riskInput", null);
    if (ri) { if (ri.age) $("#b-age").value = ri.age; if (ri.sex) $(`input[name="b-sex"][value="${ri.sex}"]`).checked = true; if (ri.ht) $("#b-ht").value = ri.ht; }
    $$("#bodyForm .seg button").forEach((b) => b.addEventListener("click", () => setBodyMode(b.dataset.mode)));
    $("#b-photo").addEventListener("change", (e) => readBodyPhoto(e.target.files[0]));
    const drop = $("#ocrDrop");
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => readBodyPhoto(e.dataTransfer.files[0]));
    $("#bodyForm").addEventListener("input", (e) => { if (e.target.matches("input")) { e.target.removeAttribute("aria-invalid"); e.target.classList.remove("auto"); } liveInterp(); });
    $("#bodyForm").addEventListener("change", liveInterp);
    $("#bodyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const r = bodyFormValues(), err = $("#bodyError"), bad = [];
      if (!r.date) bad.push(["#b-date", "วันที่"]);
      if (!(r.weight >= 25 && r.weight <= 250)) bad.push(["#b-wt", "น้ำหนัก (25–250 กก.)"]);
      if (!(r.height >= 100 && r.height <= 220)) bad.push(["#b-ht", "ส่วนสูง (100–220 ซม.)"]);
      if (!(r.age >= 15 && r.age <= 100)) bad.push(["#b-age", "อายุ"]);
      if (!r.sex) bad.push([null, "เพศ"]);
      if (r.fat != null && !(r.fat >= 3 && r.fat <= 70)) bad.push(["#b-fat", "ไขมัน % (3–70)"]);
      if (r.muscle != null && r.weight && r.muscle >= r.weight) bad.push(["#b-muscle", "มวลกล้ามเนื้อ (ต้องน้อยกว่าน้ำหนัก)"]);
      $$("#bodyForm input").forEach((i) => i.removeAttribute("aria-invalid"));
      if (bad.length) { bad.forEach((x) => x[0] && $(x[0]).setAttribute("aria-invalid", "true")); err.textContent = "กรุณาตรวจสอบ: " + bad.map((x) => x[1]).join(", "); err.hidden = false; (bad[0][0] ? $(bad[0][0]) : err).focus(); return; }
      err.hidden = true;
      const rows = store.get("body", []).filter((x) => x.date !== r.date); rows.push(r); store.set("body", rows);
      saveProfile({ height: r.height, age: r.age, sex: r.sex });
      ["#b-wt", "#b-waist", "#b-fat", "#b-muscle", "#b-visc", "#b-bmr", "#b-water", "#b-bone", "#b-mage"].forEach((id) => { $(id).value = ""; $(id).classList.remove("auto"); });
      renderBody(); toast("บันทึก Body Composition และแปลผลแล้ว");
    });
    $("#bodyMetric").addEventListener("change", renderBody);
    $("#bodyTable").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { store.set("body", store.get("body", []).filter((x) => x.date !== b.dataset.del)); renderBody(); toast("ลบรายการแล้ว"); } });
    $("#clearSample").addEventListener("click", () => {
      ["body", "fitness", "logs"].forEach((k) => store.set(k, store.get(k, []).filter((x) => !x.sample)));
      renderBody(); renderFitness(); renderHome(); toast("ล้างข้อมูลตัวอย่างแล้ว");
    });
  }

  /* ---------- chatbot: 70+ question knowledge base (chatkb.js), keyword + similarity matching, personalised answers ---------- */
  const KB = window.PREDM_KB || [], KB_CATS = window.PREDM_KB_CATS || [];
  const kbNorm = (t) => String(t).toLowerCase().replace(/[\s?？!.,ๆ]+/g, "").replace(/ครับ|ค่ะ|คะ|นะ|ไหม$/g, "");
  const grams = (t) => { const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
  const sim = (a, b) => { const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0; let n = 0; A.forEach((x) => B.has(x) && n++); return n / (A.size + B.size - n); };
  function kbCtx() {
    const pr = profile(), ri = store.get("riskInput", {}) || {}, age = ri.age || pr.age || 50, hrMax = 220 - age;
    const w = weekStats(), risk = store.get("riskHistory", [])[0];
    const body = store.get("body", []).slice().sort((x, y) => x.date.localeCompare(y.date)), last = body[body.length - 1];
    const sex = ri.sex || pr.sex || "m", wt = last?.weight || ri.wt, ht = last?.height || ri.ht || pr.height, waist = last?.waist || ri.waist;
    const bmi = wt && ht ? wt / (ht / 100) ** 2 : null, cut = sex === "f" ? 80 : 90;
    return {
      age, hrMax, hrLow: Math.round(hrMax * 0.5), hrHigh: Math.round(hrMax * 0.7), mins: w.aerobic,
      left: w.aerobic >= 150 ? "ครบเป้า 150 นาทีแล้ว เยี่ยมมาก!" : `เหลืออีก ${150 - w.aerobic} นาทีจะครบเป้า`,
      riskText: risk ? `ผลประเมินล่าสุดของคุณ (${thDate(risk.date)}) ได้ ${risk.score}/17 คะแนน = ${risk.level}` : "คุณยังไม่ได้ทำแบบประเมินความเสี่ยง ลองประเมินใช้เวลาประมาณ 2 นาที",
      bmiText: bmi ? `BMI ล่าสุดของคุณคือ ${fmt(bmi)} = ${bmiClass(bmi)[0]}` : "ยังไม่มีข้อมูลน้ำหนักและส่วนสูง บันทึกได้ที่หน้า Body Composition",
      wtText: wt ? `จากน้ำหนัก ${fmt(wt)} กก. เป้าหมายของคุณคือลด ${fmt(wt * 0.05)}–${fmt(wt * 0.07)} กก. (เหลือ ${fmt(wt * 0.93)}–${fmt(wt * 0.95)} กก.)` : "เช่น หนัก 75 กก. ควรลด 3.8–5.3 กก.",
      waistText: `${sex === "f" ? "ผู้หญิง" : "ผู้ชาย"}ไม่ควรเกิน ${cut} ซม.${ht ? ` และไม่เกินครึ่งหนึ่งของส่วนสูง = ${fmt(ht / 2, 0)} ซม.` : ""}${waist ? ` · รอบเอวล่าสุดของคุณ ${fmt(waist, 0)} ซม. ${waist >= cut ? `ควรลดอีก ${fmt(waist - cut + 1, 0)} ซม.` : "อยู่ในเกณฑ์ดี"}` : ""}`,
      weekText: `สัปดาห์นี้คุณทำแอโรบิกแล้ว ${w.aerobic}/150 นาที · เสริมแรง ${w.strength}/3 วัน · ยืดเหยียด ${w.flex}/3 วัน · ทรงตัว ${w.balance}/3 วัน · ออกกำลังกายต่อเนื่อง ${streak()} วัน\n${w.aerobic >= 150 ? "ครบเป้าแอโรบิกแล้ว รักษาไว้นะครับ" : `เหลือแอโรบิกอีก ${150 - w.aerobic} นาที ลองเดินหลังอาหารวันละ 15 นาที`}`,
    };
  }
  const fill = (t, c) => t.replace(/\{(\w+)\}/g, (_, k) => (c[k] != null ? c[k] : ""));
  function kbFind(text) {
    const qn = kbNorm(text); if (!qn) return { best: null, near: [] };
    const scored = KB.map((e) => {
      let sc = 0; e.k.forEach((k) => { const kn = kbNorm(k); if (kn && qn.includes(kn)) sc += 2 + kn.length; });
      const sq = sim(qn, kbNorm(e.q)); sc += sq * 14; if (qn === kbNorm(e.q)) sc += 50;
      return { e, sc, sq };
    }).sort((x, y) => y.sc - x.sc);
    const best = scored[0] && scored[0].sc >= 4 ? scored[0].e : null;
    const near = scored.filter((x) => !x.e.hidden && x.e !== best).slice(0, 3).map((x) => x.e);
    return { best, near };
  }
  const chatLog = () => store.get("chatLog", []);
  function renderMsg(m) {
    if (m.who === "bot" && window.PreDMMascot) { const row = document.createElement("div"); row.className = "msg-row bot"; row.innerHTML = `<span class="msg-av">${PreDMMascot.svg()}</span>`; $("#msgs").appendChild(row); var host = row; }
    const box = document.createElement("div"); box.className = "msg " + m.who;
    const p = document.createElement("div"); p.className = "msg-text"; p.textContent = m.text; box.appendChild(p);
    if (m.go && m.go.length) { const g = document.createElement("div"); g.className = "msg-go"; m.go.forEach(([label, href]) => { const a = document.createElement("a"); a.href = href; a.className = "btn sm"; a.textContent = label + " →"; g.appendChild(a); }); box.appendChild(g); }
    (typeof host !== "undefined" && host ? host : $("#msgs")).appendChild(box); $("#msgs").scrollTop = 1e9;
  }
  function pushMsg(m) { const log = chatLog(); log.push(m); store.set("chatLog", log.slice(-40)); renderMsg(m); }
  function setChips(list) { $("#chatChips").innerHTML = list.map((e) => `<button type="button" data-kb="${e.id}">${esc(e.q)}</button>`).join(""); }
  const kbById = (id) => KB.find((e) => e.id === id);
  function botAnswer(e) {
    const c = kbCtx();
    pushMsg({ who: "bot", text: fill(e.a, c), go: e.go || [] });
    setChips((e.next || []).map(kbById).filter(Boolean));
  }
  function ask(text, forced) {
    const t = String(text || "").trim(); if (!t) return;
    pushMsg({ who: "me", text: t });
    const typing = document.createElement("div"); typing.className = "msg bot typing"; typing.innerHTML = "<span></span><span></span><span></span>"; $("#msgs").appendChild(typing); $("#msgs").scrollTop = 1e9;
    setTimeout(() => {
      typing.remove();
      const e = forced ? kbById(forced) : kbFind(t).best;
      if (e) return botAnswer(e);
      const near = kbFind(t).near;
      pushMsg({ who: "bot", text: "น้องอ่อนหวานยังไม่แน่ใจว่าคุณหมายถึงเรื่องไหน ลองเลือกคำถามที่ใกล้เคียงด้านล่าง หรือเลือกหัวข้อจากแท็บ 📚 คลังคำถามได้เลยนะ", go: [] });
      setChips(near.length ? near : ["s1", "d1", "o1"].map(kbById));
    }, 450);
  }
  function renderKbList(filter = "") {
    const fn = kbNorm(filter);
    const items = KB.filter((e) => !e.hidden && (!fn || kbNorm(e.q).includes(fn) || e.k.some((k) => kbNorm(k).includes(fn)) || sim(fn, kbNorm(e.q)) > 0.25));
    $("#kbList").innerHTML = KB_CATS.map(([cat, label], ci) => {
      const qs = items.filter((e) => e.cat === cat); if (!qs.length) return "";
      return `<details ${fn || ci < 2 ? "open" : ""}><summary><span class="kb-dot c${ci % 6}"></span>${label}<small>${qs.length}</small></summary>${qs.map((e) => `<button type="button" class="kb-q" data-kb="${e.id}">${esc(e.q)}</button>`).join("")}</details>`;
    }).join("") || `<p class="hint">ไม่พบคำถามที่ตรงกับ “${esc(filter)}” ลองพิมพ์ถามในแชทได้เลย</p>`;
  }
  function chatWelcome() {
    const nm = (profile().name || "").replace(/^(คุณ|อสม\.)\s*/, "");
    pushMsg({ who: "bot", text: `สวัสดีจ้า${nm ? " คุณ" + nm : ""} น้องอ่อนหวานเอง ผู้ช่วยโค้ชสุขภาพของ Pre-DM ตอบได้มากกว่า ${KB.filter((e) => !e.hidden).length} คำถาม เรื่องการออกกำลังกาย อาหาร น้ำหนัก ความเสี่ยงเบาหวาน และวิธีใช้แอป พิมพ์ถามได้เลย หรือเลือกจากคลังคำถามด้านซ้าย`, go: [] });
    setChips(["s1", "ap9", "o3", "p1", "sf2", "d3"].map(kbById).filter(Boolean));
  }
  function initChat() {
    renderKbList();
    const log = chatLog();
    if (log.length) { log.forEach(renderMsg); setChips(["s1", "ap9", "o1", "d3"].map(kbById).filter(Boolean)); } else chatWelcome();
    $("#chatChips").addEventListener("click", (e) => { const b = e.target.closest("[data-kb]"); if (b) ask(b.textContent, b.dataset.kb); });
    $("#kbList").addEventListener("click", (e) => { const b = e.target.closest("[data-kb]"); if (b) { ask(b.textContent, b.dataset.kb); if (matchMedia("(max-width: 900px)").matches) $("#chatInput").scrollIntoView({ behavior: "smooth", block: "center" }); } });
    $("#kbSearch").addEventListener("input", (e) => renderKbList(e.target.value));
    $("#chatForm").addEventListener("submit", (e) => { e.preventDefault(); ask($("#chatInput").value); $("#chatInput").value = ""; });
    $("#chatClear").addEventListener("click", () => { store.set("chatLog", []); $("#msgs").innerHTML = ""; chatWelcome(); });
  }

  /* ---------- floating chat window (น้องอ่อนหวาน) ---------- */
  function initChatDock() {
    const fab = $("#chatFab"), dock = $("#chatDock"); if (!fab || !dock) return;
    $$("[data-mascot]").forEach((el) => { el.innerHTML = window.PreDMMascot ? PreDMMascot.svg({ wave: el.dataset.mascot === "wave" }) : ""; });
    const tab = (k) => { $$("#chatDock [data-ctab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.ctab === k))); $$("#chatDock [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== k)); if (k === "kb") $("#kbSearch").focus(); };
    const open = () => { if (!session()) return; dock.hidden = false; document.body.classList.add("chat-open"); fab.setAttribute("aria-expanded", "true"); $("#chatTip").hidden = true; tab("chat"); $("#msgs").scrollTop = 1e9; setTimeout(() => $("#chatInput").focus(), 50); };
    const close = (quiet) => { if (dock.hidden) return; dock.hidden = true; document.body.classList.remove("chat-open"); fab.setAttribute("aria-expanded", "false"); if (!quiet) fab.focus(); };
    window.PreDMChat = { open, close };
    fab.addEventListener("click", () => (dock.hidden ? open() : close()));
    $("#chatClose").addEventListener("click", () => close());
    dock.addEventListener("click", (e) => { const t = e.target.closest("[data-ctab]"); if (t) tab(t.dataset.ctab); if (e.target.closest("[data-guide]")) window.PreDMGuide?.reopen(); });
    $("#kbList").addEventListener("click", (e) => { if (e.target.closest("[data-kb]")) tab("chat"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dock.hidden && $("#player").hidden) close(); });
    // hello bubble: shown a few seconds after the app opens and whenever the pointer rests on the button
    const tip = $("#chatTip"); let tipT = null;
    const showTip = (ms) => { if (!session() || !dock.hidden || document.body.classList.contains("is-welcome")) return; tip.hidden = false; clearTimeout(tipT); tipT = setTimeout(() => (tip.hidden = true), ms); };
    setTimeout(() => showTip(9000), 1500);
    let tipAt = Date.now(); // on page changes, at most once a minute so it never nags
    window.addEventListener("predm:view", (e) => { if (e.detail === "welcome") { tip.hidden = true; return; } if (Date.now() - tipAt > 60000) { tipAt = Date.now(); setTimeout(() => showTip(6000), 600); } });
    fab.addEventListener("mouseenter", () => showTip(4000));
    fab.addEventListener("focus", () => showTip(4000));
  }

  /* ---------- AI Body Transformation (photo reshape) ---------- */
  // 1) MediaPipe Pose finds shoulders, hips and knees in the uploaded photo.
  // 2) Body half-widths are estimated per row from those landmarks.
  // 3) A smooth horizontal "liquify" warp pulls the body edge inward by the target ratio
  //    (waist, hips, thighs, with a milder chest/arm change), leaving the area beyond ~1.9x the body width untouched.
  const TF = { img: null, src: null, lm: null };
  const tfNum = (id) => ($(id).value === "" ? NaN : +$(id).value);
  function tfLoadFile(file) {
    if (!file || !file.type.startsWith("image/")) return toast("กรุณาเลือกไฟล์รูปภาพ");
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      TF.src = c; TF.lm = null; $("#tfThumb").src = url; $("#tfThumb").hidden = false; $("#tfDropText").hidden = true; $("#tfDrop").classList.add("has");
    };
    img.onerror = () => toast("เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG");
    img.src = url;
  }
  function tfSuggest() {
    const wt = tfNum("#tf-wt"), loss = tfNum("#tf-loss"), w = tfNum("#tf-waist"), h = tfNum("#tf-hip"), ht = tfNum("#tf-ht");
    const parts = [];
    if (wt > 0 && loss > 0) { const pct = loss / wt * 100; parts.push(`ลด ${fmt(pct)}% ของน้ำหนักตัว${pct >= 5 && pct <= 10 ? " · อยู่ในช่วงเป้าหมาย 5–10%" : ""}`); }
    if (w > 0 && loss > 0) parts.push(`รอบเอวโดยประมาณ ${fmt(w - 0.95 * loss)} ซม.`);
    if (h > 0 && loss > 0) parts.push(`รอบสะโพก ${fmt(h - 0.7 * loss)} ซม.`);
    if (ht > 0 && wt > 0 && loss > 0) parts.push(`BMI ${fmt(wt / (ht / 100) ** 2)} → ${fmt((wt - loss) / (ht / 100) ** 2)}`);
    $("#tfSuggest").textContent = parts.length ? "ถ้าเว้นว่าง ระบบจะใช้ค่า: " + parts.join(" · ") : "";
  }
  function tfValidate() {
    const v = { wt: tfNum("#tf-wt"), ht: tfNum("#tf-ht"), waist: tfNum("#tf-waist"), hip: tfNum("#tf-hip"), loss: tfNum("#tf-loss"), tw: tfNum("#tf-twaist"), th: tfNum("#tf-thip") };
    const bad = [];
    if (!TF.src) bad.push([null, "รูปเต็มตัว"]);
    if (!(v.wt >= 25 && v.wt <= 250)) bad.push(["#tf-wt", "น้ำหนัก"]);
    if (!(v.ht >= 100 && v.ht <= 220)) bad.push(["#tf-ht", "ส่วนสูง"]);
    if (!(v.waist >= 40 && v.waist <= 200)) bad.push(["#tf-waist", "รอบเอว"]);
    if (!(v.hip >= 50 && v.hip <= 220)) bad.push(["#tf-hip", "รอบสะโพก"]);
    if (!(v.loss > 0 && v.loss < v.wt * 0.4)) bad.push(["#tf-loss", "น้ำหนักที่อยากลด"]);
    if (!isNaN(v.tw) && !(v.tw < v.waist && v.tw >= v.waist * 0.6)) bad.push(["#tf-twaist", "รอบเอวเป้าหมาย (ต้องน้อยกว่ารอบเอวปัจจุบัน)"]);
    if (!isNaN(v.th) && !(v.th < v.hip && v.th >= v.hip * 0.6)) bad.push(["#tf-thip", "รอบสะโพกเป้าหมาย (ต้องน้อยกว่ารอบสะโพกปัจจุบัน)"]);
    $$("#tfForm input").forEach((i) => i.removeAttribute("aria-invalid"));
    const err = $("#tfError");
    if (bad.length) {
      bad.forEach((x) => x[0] && $(x[0]).setAttribute("aria-invalid", "true"));
      err.textContent = "กรุณากรอกให้ถูกต้อง: " + bad.map((x) => x[1]).join(", "); err.hidden = false; (bad[0][0] ? $(bad[0][0]) : $("#tfDrop")).focus(); return null;
    }
    err.hidden = true;
    if (isNaN(v.tw)) v.tw = v.waist - 0.95 * v.loss;
    if (isNaN(v.th)) v.th = v.hip - 0.7 * v.loss;
    return v;
  }
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  const gauss = (y, mu, sig) => Math.exp(-((y - mu) ** 2) / (2 * sig * sig));
  function tfWarp(src, lm, v) {
    const W = src.width, H = src.height, sctx = src.getContext("2d"), sd = sctx.getImageData(0, 0, W, H).data;
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const octx = out.getContext("2d"), od = octx.createImageData(W, H), o = od.data;
    const P = (i) => lm[i], mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const sh = mid(P(11), P(12)), hp = mid(P(23), P(24)), kn = mid(P(25), P(26));
    const L = Math.max(20, hp.y - sh.y), hipJ = Math.abs(P(23).x - P(24).x) / 2, shW = Math.abs(P(11).x - P(12).x) / 2;
    const yW = sh.y + 0.68 * L, yH = hp.y + 0.08 * L, yK = Math.max(hp.y + 0.5 * L, kn.y);
    const eS = shW * 1.05, eH = Math.max(hipJ * 1.95, shW * 0.8), eW = Math.min(eS, eH) * 0.92;
    // target ratios (circumference ratio ≈ width ratio)
    const sW = Math.max(0.6, v.tw / v.waist), sHp = Math.max(0.6, v.th / v.hip);
    const massR = (v.wt - v.loss) / v.wt, sT = Math.max(0.7, Math.sqrt(massR) * 0.98), sC = 1 - (1 - sW) * 0.35;
    const torsoS = (y) => { const d = (1 - sW) * gauss(y, yW, 0.24 * L) + (1 - sHp) * gauss(y, yH, 0.2 * L) + (1 - sC) * gauss(y, sh.y + 0.32 * L, 0.18 * L); return Math.max(0.55, 1 - d); };
    const torsoE = (y) => (y < yW ? lerp(eS, eW, (y - sh.y) / (yW - sh.y)) : lerp(eW, eH, (y - yW) / (yH - yW)));
    const torsoC = (y) => lerp(sh.x, hp.x, (y - sh.y) / (hp.y - sh.y));
    const legStart = hp.y + 0.12 * L;
    const legs = [[P(23), P(25)], [P(24), P(26)]];
    // inverse map: output distance d from centre -> source distance (edge e*s moves to where e was)
    const inv = (d, e, s) => { const R = e * 1.9, ad = Math.abs(d), sg = Math.sign(d) || 1; if (ad >= R || s >= 0.999) return d;
      const es = e * s; return sg * (ad < es ? ad / s : e + (ad - es) * (R - e) / (R - es)); };
    for (let y = 0; y < H; y++) {
      let mode = 0, c1 = 0, c2 = 0, e = 0, s = 1, e2 = 0, s2 = 1;
      if (y > sh.y - 0.05 * L && y < legStart) { mode = 1; c1 = torsoC(y); e = torsoE(y); s = torsoS(y); }
      else if (y >= legStart && y < yK + 0.1 * L) {
        mode = 2; const t = (y - hp.y) / Math.max(1, yK - hp.y), fade = 1 - Math.max(0, Math.min(1, (y - (yK - 0.25 * L)) / (0.35 * L)));
        c1 = lerp(legs[0][0].x, legs[0][1].x, t); c2 = lerp(legs[1][0].x, legs[1][1].x, t);
        e = e2 = lerp(hipJ * 0.95, hipJ * 0.55, t); s = s2 = 1 - (1 - sT) * fade - (1 - sHp) * 0.5 * gauss(y, yH, 0.15 * L);
      }
      for (let x = 0; x < W; x++) {
        let sx = x;
        if (mode === 1) sx = c1 + inv(x - c1, e, s);
        else if (mode === 2) { const near1 = Math.abs(x - c1) < Math.abs(x - c2); sx = near1 ? c1 + inv(x - c1, e, s) : c2 + inv(x - c2, e2, s2); }
        sx = Math.max(0, Math.min(W - 1.001, sx));
        const x0 = sx | 0, f = sx - x0, i0 = (y * W + x0) * 4, i1 = i0 + 4, oi = (y * W + x) * 4;
        o[oi] = sd[i0] * (1 - f) + sd[i1] * f; o[oi + 1] = sd[i0 + 1] * (1 - f) + sd[i1 + 1] * f; o[oi + 2] = sd[i0 + 2] * (1 - f) + sd[i1 + 2] * f; o[oi + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    return { canvas: out, guide: { sh, hp, kn, yW, yH, eS, eW, eH, L } };
  }
  function tfDrawPts(ctx, lm, g) {
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = "#7ef0b8"; ctx.fillStyle = "#f0b440";
    [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [11, 13], [12, 14]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(lm[a].x, lm[a].y); ctx.lineTo(lm[b].x, lm[b].y); ctx.stroke(); });
    [11, 12, 23, 24, 25, 26, 27, 28, 13, 14].forEach((i) => { ctx.beginPath(); ctx.arc(lm[i].x, lm[i].y, 5, 0, 7); ctx.fill(); });
    ctx.setLineDash([6, 5]); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    [[g.yW, g.eW, "เอว"], [g.yH, g.eH, "สะโพก"]].forEach(([y, e, t]) => { const cx = (g.sh.x + g.hp.x) / 2; ctx.beginPath(); ctx.moveTo(cx - e, y); ctx.lineTo(cx + e, y); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif"; ctx.fillText(t, cx + e + 6, y + 5); });
    ctx.restore();
  }
  function tfPaint() {
    if (!TF.res) return;
    const show = $("#tf-showpts").checked, b = $("#tfBefore"), a = $("#tfAfter"), v = TF.v;
    b.width = TF.src.width; b.height = TF.src.height; a.width = TF.res.canvas.width; a.height = TF.res.canvas.height;
    b.getContext("2d").drawImage(TF.src, 0, 0); a.getContext("2d").drawImage(TF.res.canvas, 0, 0);
    $(".tf-pts").hidden = !!TF.res.ai; $("#tfOut .goal .ba-tag").textContent = TF.res.ai ? "เมื่อทำสำเร็จ · AI" : "เมื่อทำสำเร็จ";
    if (show && TF.res.guide && TF.lm) tfDrawPts(b.getContext("2d"), TF.lm, TF.res.guide);
    const bmi = (w) => w / (v.ht / 100) ** 2;
    $("#tfCapBefore").innerHTML = `<b>${fmt(v.wt)} กก.</b><span>เอว ${fmt(v.waist, 0)} · สะโพก ${fmt(v.hip, 0)} ซม.</span><span>BMI ${fmt(bmi(v.wt))}</span>`;
    $("#tfCapAfter").innerHTML = `<b>${fmt(v.wt - v.loss)} กก. <em>−${fmt(v.loss)}</em></b><span>เอว ${fmt(v.tw, 0)} <em>−${fmt(v.waist - v.tw, 0)}</em> · สะโพก ${fmt(v.th, 0)} <em>−${fmt(v.hip - v.th, 0)}</em> ซม.</span><span>BMI ${fmt(bmi(v.wt - v.loss))}</span>`;
  }
  function tfSummary(v) {
    const ri = store.get("riskInput", null) || {}, pr = profile();
    const base = { age: ri.age || pr.age || 50, sex: ri.sex || pr.sex || "m", htn: !!ri.htn, fh: !!ri.fh, ht: v.ht };
    const r0 = calcRisk({ ...base, wt: v.wt, waist: v.waist }), r1 = calcRisk({ ...base, wt: v.wt - v.loss, waist: v.tw });
    const bmi0 = v.wt / (v.ht / 100) ** 2, bmi1 = (v.wt - v.loss) / (v.ht / 100) ** 2;
    const chip = (t, a, z, u, d = 1) => `<div class="tf-chip"><small>${t}</small><b>${fmt(a, d)} → ${fmt(z, d)}</b><span>${u}</span></div>`;
    $("#tfSum").innerHTML = chip("น้ำหนัก", v.wt, v.wt - v.loss, "กก.") + chip("รอบเอว", v.waist, v.tw, "ซม.", 0) + chip("รอบสะโพก", v.hip, v.th, "ซม.", 0) + chip("BMI", bmi0, bmi1, bmiClass(bmi1)[0]) +
      `<div class="tf-chip risk ${r1.cls}"><small>ความเสี่ยงเบาหวาน</small><b>${r0.score} → ${r1.score}</b><span>${r1.level}</span></div>`;
    const wk1 = Math.ceil(v.loss / 1), wk2 = Math.ceil(v.loss / 0.5), pct = v.loss / v.wt * 100;
    const warn = bmi1 < 18.5 ? `<p class="form-error">น้ำหนักเป้าหมายทำให้ BMI ต่ำกว่า 18.5 ควรตั้งเป้าใหม่หรือปรึกษาบุคลากรสาธารณสุข</p>` : "";
    $("#tfTime").innerHTML = `${warn}<p><b>ระยะเวลาโดยประมาณ:</b> ${wk1 === wk2 ? wk1 : `${wk1}–${wk2}`} สัปดาห์ (ลดอย่างปลอดภัยสัปดาห์ละ 0.5–1 กก.) ${pct >= 5 ? `· ลด ${fmt(pct)}% ถึงเป้า 5–7% ที่ช่วยลดโอกาสเป็นเบาหวานได้ราว 58% (DPP)` : `· ลด ${fmt(pct)}% ลองตั้งเป้าอย่างน้อย 5% (${fmt(v.wt * 0.05)} กก.)`}</p>
      <p class="hint">แผนแนะนำ: แอโรบิก 150–300 นาที/สัปดาห์ เสริมแรง 2–3 วัน และลดพลังงานจากอาหารวันละ 300–500 kcal</p>`;
  }
  /* ---------- generative AI (Google Gemini image editing) ---------- */
  const tfEngine = () => $("#tfEngine [aria-checked='true']")?.dataset.engine || "ai";
  function tfPrompt(v) {
    const ri = store.get("riskInput", null) || {}, pr = profile();
    const sex = (ri.sex || pr.sex) === "f" ? "woman" : (ri.sex || pr.sex) === "m" ? "man" : "person", age = ri.age || pr.age;
    const wt1 = Math.round((v.wt - v.loss) * 10) / 10;
    return `Edit this photo realistically. It shows ${age ? `a ${age}-year-old ` : "a "}${sex}, ${v.ht} cm tall, currently ${v.wt} kg with a ${Math.round(v.waist)} cm waist and ${Math.round(v.hip)} cm hips.
Show how the SAME person would look after healthy, gradual weight loss to ${wt1} kg (minus ${v.loss} kg), with a ${Math.round(v.tw)} cm waist and ${Math.round(v.th)} cm hips.
Rules:
- Keep the exact same face, identity, skin tone, hairstyle, expression, pose, camera angle, framing, background and lighting.
- Keep the same outfit style and colours, re-fitted naturally to the slimmer body.
- Reduce belly, waist, hips, thighs, upper arms, face fullness and double chin only in proportion to this amount of weight loss: natural and believable, not exaggerated, not a bodybuilder, not underweight.
- Photorealistic, same aspect ratio. Fully clothed and family-friendly.
Return only the edited image.`;
  }
  async function tfJpeg(canvas, max = 1024) {
    const k = Math.min(1, max / Math.max(canvas.width, canvas.height)), c = document.createElement("canvas");
    c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k); c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }
  async function tfGemini(v, key, model) {
    const body = { contents: [{ role: "user", parts: [{ text: tfPrompt(v) }, { inline_data: { mime_type: "image/jpeg", data: await tfJpeg(TF.src) } }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] } };
    const res = window.PreDMAI ? await window.PreDMAI.call("transform", model, body, key) : { ok: false, status: 0, json: {}, code: "network" };
    const j = res.json || {};
    if (!res.ok && (res.cloud || res.code === "network")) throw new Error(window.PreDMAI?.cloudError(res) || "เชื่อมต่อ Google Gemini ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    if (!res.ok) {
      const m = j.error?.message || "", st = j.error?.status || "";
      if (res.status === 400 && /API key/i.test(m)) throw new Error("API key ไม่ถูกต้อง ตรวจสอบ key จาก Google AI Studio อีกครั้ง");
      if (res.status === 403) throw new Error("API key นี้ไม่มีสิทธิ์ใช้ Gemini API (เปิดใช้งาน API หรือสร้าง key ใหม่)");
      if (res.status === 404) throw new Error(`ไม่พบโมเดล ${model} ลองเลือกโมเดลอื่นในช่อง “โมเดล”`);
      if (res.status === 429) throw new Error("ใช้งานเกินโควตาของ API key แล้ว รอสักครู่หรือตรวจสอบโควตาใน Google AI Studio");
      throw new Error(`Gemini ตอบกลับข้อผิดพลาด (${res.status}${st ? " " + st : ""}) ${m}`.trim());
    }
    const cand = j.candidates?.[0], parts = cand?.content?.parts || [];
    const img = parts.filter((x) => !x.thought).map((x) => x.inlineData || x.inline_data).filter(Boolean).pop();
    if (!img) {
      const why = j.promptFeedback?.blockReason || cand?.finishReason || "";
      const txt = parts.map((x) => x.text).filter(Boolean).join(" ").slice(0, 200);
      throw new Error(`AI ไม่ได้ส่งภาพกลับมา${why ? ` (${why})` : ""}${txt ? ` · ${txt}` : ""} ลองใช้รูปอื่นที่เห็นทั้งตัวชัดเจน หรือกดสร้างอีกครั้ง`);
    }
    const im = new Image(); im.src = `data:${img.mimeType || img.mime_type || "image/png"};base64,${img.data}`;
    await im.decode();
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0);
    return c;
  }
  async function tfGenerate(e) {
    e.preventDefault();
    const v = tfValidate(); if (!v) return;
    $("#tfEmpty").hidden = true; $("#tfOut").hidden = true; $("#tfBusy").hidden = false; $("#tfGo").disabled = true;
    try {
      if (tfEngine() === "ai") {
        const key = $("#tf-key").value.trim(), model = $("#tf-model").value;
        if (!key && !window.PreDMAI?.cloud) { $("#tf-key").setAttribute("aria-invalid", "true"); throw new Error("กรุณาวาง Gemini API key ก่อน (หรือเลือก “ปรับสัดส่วนในเครื่อง”)"); }
        if (!$("#tf-consent").checked) throw new Error("กรุณาติ๊กยินยอมให้ส่งรูปไปยัง Google Gemini ก่อนสร้างภาพ");
        if (!window.PreDMAI?.cloud) store.set("geminiKey", $("#tf-remember").checked ? key : null); store.set("geminiModel", model);
        $("#tfBusyText").textContent = "AI กำลังสร้างภาพรูปร่างเป้าหมาย… (ประมาณ 10–40 วินาที)";
        TF.res = { canvas: await tfGemini(v, key, model), guide: null, ai: true }; TF.v = v;
        $("#tf-consent").checked = false;
        $("#tfBusy").hidden = true; $("#tfOut").hidden = false; tfPaint(); tfSummary(v);
        return;
      }
      if (!TF.lm) {
        $("#tfBusyText").textContent = "AI กำลังตรวจจับโครงร่างร่างกาย…";
        let tries = 0; while (!window.PreDMPose && tries++ < 50) await new Promise((r) => setTimeout(r, 200));
        if (!window.PreDMPose) throw new Error("โหลดโมเดล AI ไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ต");
        TF.lm = await window.PreDMPose.detect(TF.src);
        if (!TF.lm) throw new Error("ไม่พบร่างกายในรูป ลองรูปที่เห็นทั้งตัวชัดเจน ยืนหันหน้าตรง");
        const need = [11, 12, 23, 24, 25, 26];
        if (need.some((i) => TF.lm[i].v < 0.4)) throw new Error("เห็นไหล่ สะโพก หรือเข่าไม่ชัด ลองรูปเต็มตัวที่ยืนหันหน้าตรง");
      }
      $("#tfBusyText").textContent = "กำลังสร้างภาพรูปร่างเป้าหมาย…";
      await new Promise((r) => setTimeout(r, 30));
      TF.res = tfWarp(TF.src, TF.lm, v); TF.v = v;
      $("#tfBusy").hidden = true; $("#tfOut").hidden = false; tfPaint(); tfSummary(v);
    } catch (err) {
      $("#tfBusy").hidden = true; $("#tfEmpty").hidden = false; const er = $("#tfError"); er.textContent = err.message || String(err); er.hidden = false;
    } finally { $("#tfGo").disabled = false; }
  }
  function tfSave() {
    if (!TF.res) return;
    const W = TF.src.width, H = TF.src.height, R = TF.res.canvas, W2 = Math.round(R.width * H / R.height), c = document.createElement("canvas"); c.width = W + W2 + 30; c.height = H + 70;
    const x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(TF.src, 10, 50); x.drawImage(R, W + 20, 50, W2, H);
    x.fillStyle = "#17191b"; x.font = "bold 24px sans-serif"; x.fillText("ตอนนี้", 20, 34); x.fillText(`เมื่อทำสำเร็จ −${fmt(TF.v.loss)} กก.`, W + 30, 34);
    x.font = "14px sans-serif"; x.fillStyle = "#8b9094"; x.fillText(`Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา) · ${TF.res.ai ? "ภาพสร้างโดย AI (Google Gemini) · " : ""}ภาพจำลองโดยประมาณ`, 10, H + 64);
    c.toBlob((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pre-dm-body-transformation.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("บันทึกภาพแล้ว"); });
  }
  function renderTransform() {
    tfSuggest();
    const cloud = !!window.PreDMAI?.cloud; // real accounts use the server-side AI (no key needed)
    $("#tf-key").closest("label").hidden = cloud; $("#tf-remember").closest("label").hidden = cloud;
    let n = $("#tfCloudNote"); if (!n) { $("#tf-key").closest("label").insertAdjacentHTML("beforebegin", `<p class="hint" id="tfCloudNote"></p>`); n = $("#tfCloudNote"); }
    n.hidden = !cloud; n.textContent = "☁️ บัญชีจริงใช้ AI ของระบบได้เลย ไม่ต้องใส่ API key (วันละ 5 ภาพ)";
  }
  function initTransform() {
    $("#tf-photo").addEventListener("change", (e) => tfLoadFile(e.target.files[0]));
    const drop = $("#tfDrop");
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => tfLoadFile(e.dataTransfer.files[0]));
    $("#tfForm").addEventListener("input", (e) => { if (e.target.matches("input")) e.target.removeAttribute("aria-invalid"); tfSuggest(); });
    $("#tfForm").addEventListener("submit", tfGenerate);
    const k0 = store.get("geminiKey", null); if (k0) { $("#tf-key").value = k0; $("#tf-remember").checked = true; }
    const m0 = store.get("geminiModel", null); if (m0 && [...$("#tf-model").options].some((o) => o.value === m0)) $("#tf-model").value = m0;
    const setEngine = (en) => { $$("#tfEngine [data-engine]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.engine === en))); $("#tfAiBox").hidden = en !== "ai"; store.set("tfEngine", en); };
    setEngine(store.get("tfEngine", "ai"));
    // privacy mode (config.js loads after this file, so apply once the page has parsed)
    const privacy = () => { if (window.PREDM_CONFIG?.externalAI !== false || $(".privacy-note")) return; $("#tfEngine [data-engine='ai']").hidden = true; $("#tfEngine").insertAdjacentHTML("afterend", `<p class="hint privacy-note">🔒 โหมดความเป็นส่วนตัว: รูปของคุณประมวลผลในเครื่องนี้เท่านั้น ไม่ส่งออกไปภายนอก</p>`); setEngine("local"); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", privacy); else privacy();
    $("#tfEngine").addEventListener("click", (e) => { const b = e.target.closest("[data-engine]"); if (b) setEngine(b.dataset.engine); });
    $("#tf-remember").addEventListener("change", (e) => { if (!e.target.checked) store.set("geminiKey", null); });
    $("#tf-showpts").addEventListener("change", tfPaint);
    $("#tfSave").addEventListener("click", tfSave);
    $("#tfReset").addEventListener("click", () => { $("#tfOut").hidden = true; $("#tfEmpty").hidden = false; TF.res = null; $("#tfForm").scrollIntoView({ behavior: "smooth" }); });
    $("#tfFill").addEventListener("click", () => {
      const body = store.get("body", []).slice().sort((x, y) => x.date.localeCompare(y.date)), last = body[body.length - 1];
      if (!last) return toast("ยังไม่มีข้อมูล Body Composition");
      if (last.weight) $("#tf-wt").value = last.weight; if (last.height) $("#tf-ht").value = last.height; if (last.waist) $("#tf-waist").value = last.waist;
      tfSuggest(); toast(`ใช้ค่าจาก Body Composition ${thDate(last.date)} · กรอกรอบสะโพกเพิ่ม`);
    });
  }


  /* ---------- image lightbox ---------- */
  function initZoom() {
    const box = document.createElement("div"); box.className = "zoom"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="icon-btn" aria-label="ปิดภาพ">✕</button>`;
    document.body.appendChild(box);
    const close = () => { box.hidden = true; };
    document.addEventListener("click", (e) => {
      const z = e.target.closest("[data-zoom]");
      if (z) { e.preventDefault(); box.querySelector("img").src = z.dataset.zoom; box.querySelector("img").alt = z.dataset.cap || ""; box.querySelector("figcaption").textContent = `${z.dataset.cap || ""}${z.dataset.credit ? " · ภาพจาก " + z.dataset.credit : ""}`; box.hidden = false; box.querySelector("button").focus(); return; }
      if (!box.hidden && (e.target === box || e.target.closest(".zoom button"))) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) close(); });
  }
  /* ---------- illustrated page banners ---------- */
  function initBanners() {
    const F = (p, v, extra = "") => `<span class="b-fig">${fig(P[p], extra, v, { noBlob: true })}</span>`;
    const bubbles = `<circle cx="16" cy="18" r="8" fill="#5aaae6" opacity=".75"/><circle cx="86" cy="12" r="6" fill="#f0b440"/><circle cx="84" cy="40" r="7" fill="#e05246" opacity=".75"/>`;
    const icon = (svg) => `<span class="b-ico">${svg}</span>`;
    const watch = `<svg viewBox="0 0 64 64"><circle cx="32" cy="36" r="22" fill="#fff" stroke="#17191b" stroke-width="4"/><path d="M32 36V22M26 6h12M32 6v8" stroke="#17191b" stroke-width="4" stroke-linecap="round"/><path d="M32 36l9 6" stroke="#e9785a" stroke-width="4" stroke-linecap="round"/></svg>`;
    const scale = `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="46" rx="12" fill="#fff" stroke="#17191b" stroke-width="4"/><path d="M18 26a14 14 0 0 1 28 0" fill="none" stroke="#3d84a8" stroke-width="4"/><path d="M32 26l6-7" stroke="#e9785a" stroke-width="4" stroke-linecap="round"/></svg>`;
    const chatI = `<svg viewBox="0 0 64 64"><path d="M8 14h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H24l-10 9v-9H8a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6z" fill="#fff" stroke="#17191b" stroke-width="4" stroke-linejoin="round"/><circle cx="20" cy="29" r="3" fill="#17191b"/><circle cx="30" cy="29" r="3" fill="#17191b"/><circle cx="40" cy="29" r="3" fill="#17191b"/></svg>`;
    const gauge = `<svg viewBox="0 0 64 64"><path d="M8 44a24 24 0 0 1 48 0" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M8 44a24 24 0 0 1 30-23" fill="none" stroke="#e9785a" stroke-width="9" stroke-linecap="round"/><circle cx="32" cy="44" r="5" fill="#17191b"/><path d="M32 44l12-14" stroke="#17191b" stroke-width="4" stroke-linecap="round"/></svg>`;
    const B = {
      risk: ["#ffd9c9", "#ffeeb0", icon(gauge) + `<span class="b-heart">${heartArt}</span>`],
      exercise: ["#cfe8ff", "#e3dcff", F("squatF", 0) + F("reach", 1) + F("marchL", 2)],
      tracking: ["#c9f2dd", "#cfe8ff", F("squatF", 1, `<g fill="#2ecc71"><circle cx="40" cy="47" r="3"/><circle cx="60" cy="47" r="3"/><circle cx="38" cy="76" r="3"/><circle cx="62" cy="76" r="3"/><circle cx="50" cy="37" r="3"/></g>`) + `<span class="b-badge">AI</span>`],
      game: ["#fff0b0", "#ffd2c4", F("reach", 3, bubbles) + F("isUp", 0, bubbles)],
      fitness: ["#e3dcff", "#cfe8ff", icon(watch) + F("squatF", 2) + F("oneleg", 1)],
      body: ["#d6f2c9", "#fff0b0", icon(scale) + F("standF", 0) + F("curl", 1)],
      transform: ["#cfe8ff", "#d6f2c9", F("standF", 0) + `<span class="b-arrow">→</span>` + F("standF", 1)],
      chat: ["#e3dcff", "#ffd9c9", F("wai", 2) + icon(chatI)],
      consult: ["#d3f1ff", "#e3dcff", icon(`<svg viewBox="0 0 64 64"><rect x="6" y="14" width="38" height="36" rx="8" fill="#fff" stroke="#17191b" stroke-width="4"/><path d="M44 27l14-8v26l-14-8z" fill="#5b8cff" stroke="#17191b" stroke-width="4" stroke-linejoin="round"/><path d="M19 32h12M25 26v12" stroke="#e05246" stroke-width="5" stroke-linecap="round"/></svg>`) + F("oneleg", 1) + F("standF", 2)],
      _admin: ["#fff0b0", "#cfe8ff", icon(`<svg viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="48" rx="10" fill="#fff" stroke="#17191b" stroke-width="4"/><path d="M16 44V34M26 44V24M36 44V30M46 44V18" stroke="#5b8cff" stroke-width="6" stroke-linecap="round"/></svg>`) + icon(`<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#fff" stroke="#17191b" stroke-width="4"/><path d="M32 32V8a24 24 0 0 1 22 15z" fill="#2fb37a" stroke="#17191b" stroke-width="4" stroke-linejoin="round"/><path d="M32 32l22-9a24 24 0 0 1-8 26z" fill="#f2b233" stroke="#17191b" stroke-width="4" stroke-linejoin="round"/></svg>`)],
    };
    Object.entries(B).forEach(([k, [c1, c2, art]]) => {
      const head = document.querySelector(`#view-${k} .page-head`); if (!head || head.classList.contains("banner")) return;
      head.classList.add("banner"); head.style.setProperty("--b1", c1); head.style.setProperty("--b2", c2);
      head.insertAdjacentHTML("beforeend", `<div class="banner-art" aria-hidden="true">${art}</div>`);
    });
  }
  /* ---------- badges ---------- */
  function renderBadges() {
    const logs = store.get("logs", []).filter((l) => !l.sample), best = store.get("bestScore", 0), w = weekStats();
    const B = [["ก้าวแรก", "บันทึกการออกกำลังกายครั้งแรก", logs.length >= 1], ["นักแตกฟอง", "ได้ 30 คะแนนใน Bubble Pop", best >= 30],
      ["สายแข็ง", "สควอทสะสม 100 ครั้ง", logs.filter((l) => l.name.includes("สควอท")).reduce((s, l) => s + (l.reps || 0), 0) >= 100], ["ครบ 150", "แอโรบิกครบ 150 นาทีในสัปดาห์", w.aerobic >= 150],
      ["ต่อเนื่อง 7 วัน", "ออกกำลังกาย 7 วันติด", streak() >= 7], ["ครบ 4 แบบ", "ทำครบทั้ง 4 แบบในสัปดาห์", w.aerobic > 0 && w.strength && w.flex && w.balance]];
    $("#badges").innerHTML = B.map((b) => `<div class="badge ${b[2] ? "on" : ""}"><b>${b[2] ? "★ " : "☆ "}${b[0]}</b>${b[1]}</div>`).join("");
  }

  /* ---------- welcome / login ---------- */
  // Home scene: family member cheering while the user does chair squats in front of a phone that counts reps.
  function sceneArt() {
    const place = (x, y, s) => (p) => [x + ((p[0] + 4) / 108) * s, y + ((p[1] + 4) / 108) * s];
    const nest = (svg, x, y, s) => svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${s}" height="${s}" `);
    const cheer = [[54, 14], [51, 24], [50, 54], [62, 15], [66, 3], [40, 40], [45, 51], [53, 74], [56, 94], [45, 74], [42, 94]];
    const man = P.squat, mp = place(140, 58, 160);
    const bones = [[1, 2], [1, 3], [3, 4], [1, 5], [5, 6], [2, 7], [7, 8], [2, 9], [9, 10]];
    const skel = bones.map(([a, b]) => { const A = mp(man[a]), B = mp(man[b]); return `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}"/>`; }).join("");
    const dots = [1, 2, 3, 4, 7, 8].map((i) => { const A = mp(man[i]); return `<circle cx="${A[0].toFixed(1)}" cy="${A[1].toFixed(1)}" r="3.6"/>`; }).join("");
    const knee = mp(man[7]);
    const bubble = (x, y, w, txt, tail) => `<g class="float"><rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="#fff" stroke="#1f2550" stroke-width="1.6"/>
      <path d="M${tail} ${y + 23.2}l5 8 4-8" fill="#fff" stroke="#1f2550" stroke-width="1.6" stroke-linejoin="round"/><rect x="${tail - 1}" y="${y + 20}" width="12" height="4" fill="#fff"/>
      <text x="${x + w / 2}" y="${y + 16.5}" text-anchor="middle" font-size="11" font-weight="700" fill="#1f2550" font-family="Anuphan, sans-serif">${txt}</text></g>`;
    return `<svg class="scene" viewBox="0 0 400 250" role="img" aria-label="ภาพผู้ใช้ทำท่าสควอทกับเก้าอี้ที่บ้าน โดยมีลูกสาวเชียร์และโทรศัพท์นับจำนวนครั้ง">
      <defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe3c8"/><stop offset="1" stop-color="#f6cfa6"/></linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9dcef"/><stop offset="1" stop-color="#e3f4f9"/></linearGradient></defs>
      <rect width="400" height="250" fill="url(#wall)"/>
      <rect y="196" width="400" height="54" fill="#d9a066"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<path d="M${i * 50 - 20} 250l${30} -54" stroke="#c48a52" stroke-width="1.4"/>`).join("")}
      <rect y="192" width="400" height="6" fill="#b97d47"/>
      <!-- window -->
      <rect x="22" y="26" width="96" height="86" rx="4" fill="url(#sky)" stroke="#fff" stroke-width="5"/>
      <path d="M70 26v86M22 69h96" stroke="#fff" stroke-width="4"/>
      <path d="M26 112c10-14 22-18 34-12 8-10 22-12 30-2 10-6 20-2 24 14z" fill="#8fc77a"/>
      <circle cx="98" cy="44" r="8" fill="#ffe08a"/>
      <path d="M14 20h112" stroke="#b97d47" stroke-width="4" stroke-linecap="round"/>
      <path d="M16 22c0 30 4 60 10 96h10c-6-34-8-64-8-96z" fill="#e9785a"/><path d="M124 22c0 30-4 60-10 96h-10c6-34 8-64 8-96z" fill="#e9785a"/>
      <!-- frame + shelf -->
      <rect x="196" y="36" width="40" height="32" rx="3" fill="#fff" stroke="#b97d47" stroke-width="3"/><path d="M200 62l10-12 8 8 6-6 8 10z" fill="#8fc77a"/><circle cx="226" cy="45" r="3.5" fill="#ffd166"/>
      <rect x="318" y="92" width="70" height="5" rx="2" fill="#b97d47"/>
      <path d="M330 92l-4-14h16l-4 14z" fill="#e9785a"/><path d="M334 78c-8-8-10-16-4-20 2 6 4 8 4 12 0-8 4-14 10-14-2 8-4 14-10 22z" fill="#5fa86b"/>
      <rect x="356" y="70" width="7" height="22" rx="1.5" fill="#3d84a8"/><rect x="364" y="74" width="7" height="18" rx="1.5" fill="#f2c94c"/><rect x="372" y="66" width="7" height="26" rx="1.5" fill="#9b87d8"/>
      <!-- mat -->
      <ellipse cx="230" cy="212" rx="78" ry="11" fill="none" stroke="#e9785a" stroke-width="2" stroke-dasharray="6 5" opacity=".8"/>
      <!-- people -->
      ${nest(fig(cheer, `<circle cx="47" cy="12" r="5" fill="#2a1f1b"/>`, 0, { noBlob: true }), 26, 62, 152)}
      ${nest(fig(man, chair, 1, { noBlob: true }), 140, 58, 160)}
      <g stroke="#7ef0b8" stroke-width="2.6" stroke-linecap="round" opacity=".95">${skel}</g>
      <g fill="#ffffff" stroke="#3d84a8" stroke-width="1.6">${dots}</g>
      <g class="float"><rect x="${knee[0] + 8}" y="${knee[1] - 32}" width="34" height="18" rx="9" fill="#1f2550"/><text x="${knee[0] + 25}" y="${knee[1] - 19.5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="Outfit, sans-serif">92°</text></g>
      <path d="M${knee[0] + 50} ${knee[1] - 44}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f2c94c"/>
      <!-- side table + glucose meter + water -->
      <rect x="300" y="160" width="76" height="6" rx="2" fill="#b97d47"/><path d="M306 166v30M370 166v30" stroke="#a06a3b" stroke-width="4" stroke-linecap="round"/>
      <rect x="348" y="146" width="16" height="14" rx="3" fill="#fff" stroke="#1f2550" stroke-width="1.4"/><rect x="351" y="149" width="10" height="5" rx="1" fill="#c3e4ef"/><text x="356" y="153.4" text-anchor="middle" font-size="4.5" font-weight="700" fill="#1f2550" font-family="Outfit">98</text>
      <rect x="368" y="138" width="7" height="22" rx="3" fill="#bfe3ef" stroke="#3d84a8" stroke-width="1.2"/>
      <!-- phone on stand -->
      <path d="M326 160l8-10 8 10" fill="none" stroke="#1f2550" stroke-width="3" stroke-linejoin="round"/>
      <rect x="318" y="86" width="34" height="62" rx="6" fill="#1f2550"/><rect x="321" y="91" width="28" height="52" rx="3" fill="#24304f"/>
      <text x="335" y="102" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff" font-family="Outfit">12/15</text>
      <g stroke="#7ef0b8" stroke-width="1.6" stroke-linecap="round" fill="none"><circle cx="335" cy="110" r="3"/><path d="M335 113v12l-5 4v8M335 125l6 2v10M335 116l-6 4M335 116l7 1"/></g>
      ${bubble(70, 34, 76, "เก่งมาก พ่อ!", 104)}
      ${bubble(276, 52, 94, "ย่อได้ลึกขึ้นแล้ว", 322)}
      <!-- cat -->
      <g transform="translate(250 214)"><ellipse cx="24" cy="10" rx="20" ry="8" fill="#9aa3ad"/><circle cx="44" cy="6" r="7" fill="#9aa3ad"/><path d="M39 1l2-6 4 4zM46 0l4-5 1 6z" fill="#9aa3ad"/>
        <path d="M5 10c-8 2-10-6-4-8" fill="none" stroke="#9aa3ad" stroke-width="4" stroke-linecap="round"/><path d="M42 6h3M47 6h3" stroke="#3a3f45" stroke-width="1.3" stroke-linecap="round"/></g>
      <text class="zz" x="300" y="206" font-size="10" fill="#7a6a5a" font-family="Outfit" font-style="italic">z z</text>
    </svg>`;
  }
  const DEMO = [
    { code: "PRE", name: "คุณสมชาย ใจดี", phone: "0820000001", tag: "ภาวะก่อนเบาหวาน · FPG 112", age: 52, sex: "m", height: 168, tone: "blue" },
    { code: "OB", name: "คุณมาลี สุขใจ", phone: "0820000002", tag: "อ้วนลงพุง · รอบเอว 88 ซม.", age: 46, sex: "f", height: 156, tone: "salmon" },
    { code: "HT", name: "คุณวันดี รักษ์ดี", phone: "0820000003", tag: "ความดันโลหิตสูง", age: 58, sex: "f", height: 152, tone: "green" },
    { code: "FH", name: "คุณประเสริฐ มีสุข", phone: "0820000004", tag: "พ่อแม่เป็นเบาหวาน", age: 41, sex: "m", height: 172, tone: "lav" },
  ];
  const STAFF = [{ code: "อสม", name: "อสม. ศรีสุดา แก้วใส", phone: "0890000001", tag: "รพ.สต.บ้านสวน · ดูแล 32 คน", age: 45, sex: "f", height: 158, tone: "yellow", staff: true }];
  let role = "user";
  function renderDemo() {
    const list = role === "user" ? DEMO : STAFF;
    $("#demoList").innerHTML = list.map((d, i) => `<button type="button" class="demo" data-i="${i}"><span class="code ${d.tone}">${d.code}</span><span><b>${d.name}</b><small>${d.phone} · ${d.tag}</small></span></button>`).join("");
  }
  const DEMO_MODE = new URLSearchParams(location.search).has("demo"); // phone mockup on the landing page
  if (DEMO_MODE) document.documentElement.classList.add("demo-phone");
  const session = () => (DEMO_MODE ? { name: "คุณมาลี สุขใจ", phone: "0820000002", demo: true } : store.get("session", null));
  function login(d) {
    store.set("session", { name: d.name, phone: d.phone, staff: !!d.staff, at: Date.now() });
    saveProfile({ name: d.name, age: d.age, sex: d.sex, height: d.height });
    toast("ยินดีต้อนรับ " + d.name); location.hash = "home";
  }
  function initWelcome() {
    $("#sceneArt").innerHTML = sceneArt();
    renderDemo();
    $("#roleSwitch").addEventListener("click", (e) => {
      const b = e.target.closest("[data-role]"); if (!b) return;
      role = b.dataset.role; $$("#roleSwitch button").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderDemo();
    });
    $("#demoList").addEventListener("click", (e) => {
      const b = e.target.closest(".demo"); if (!b) return;
      const d = (role === "user" ? DEMO : STAFF)[+b.dataset.i]; $("#l-phone").value = d.phone; $("#l-pin").value = "1234"; $("#l-pin").focus();
    });
    $("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const ph = $("#l-phone").value.replace(/\D/g, ""), pin = $("#l-pin").value;
      const d = [...DEMO, ...STAFF].find((x) => x.phone === ph);
      if (!d) return toast("ไม่พบเบอร์นี้ในบัญชีทดลอง กดเลือกบัญชีด้านล่างได้");
      if (pin !== "1234") return toast("รหัส PIN ไม่ถูกต้อง บัญชีทดลองใช้ 1234");
      login(d);
    });
    ["#logout", "#logoutM"].forEach((id) => $(id).addEventListener("click", () => { store.set("session", null); location.hash = "welcome"; toast("ออกจากระบบแล้ว"); }));
    $$(".theme-btn").forEach((b) => b.addEventListener("click", () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = dark ? "light" : "dark"; store.set("theme", document.documentElement.dataset.theme);
      if (location.hash === "#body") renderBody();
    }));
  }
  const savedTheme = store.get("theme", null); if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  /* ---------- boot ---------- */
  window.PreDMData = { store, PROGRAMS, calcRisk, TYPE_TH, fig, P, profile, DEMO };
  if (!document.getElementById("view-home")) return; // admin page: data only, no patient UI
  seedIfEmpty();
  $("#tArt").innerHTML = skeletonArt(P.squat); $("#gArt").innerHTML = fig(P.reach, `<circle cx="18" cy="14" r="9" fill="#5aaae6" opacity=".7"/><circle cx="86" cy="10" r="7" fill="#f0b440" opacity=".85"/><circle cx="84" cy="40" r="8" fill="#e05246" opacity=".7"/><circle cx="12" cy="44" r="6" fill="#5aaae6" opacity=".6"/>`, 1, { noBlob: true });
  initZoom(); initBanners(); initWelcome(); initRisk(); initExercise(); initFitness(); initBody(); initTransform(); initChat(); initChatDock(); renderBadges();
  window.addEventListener("hashchange", route); route();
  window.PreDM = { store, addLog, toast, profile, renderBadges, renderHome, speak, speakTrack, calcRisk, PROGRAMS, TYPE_TH };
})();

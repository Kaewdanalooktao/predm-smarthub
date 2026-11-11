/* Pre-DM Smart Hub — "ดูแลตัวเองวันนี้": six small daily-care tools on the home page.
   1) sugar-in-drinks counter (teaspoons vs the 6-teaspoon daily limit)      store key "drinks"
   2) sleep & stress, two questions a day, charted next to body weight         store key "mood"
   3) 7-day missions with medals                                               store key "missions"
   4) blood-sugar test log + "time to test again" reminder (app + LINE)        store key "labs", reminders.lab
   5) monthly one-page summary to print / save as PDF for the doctor           (reads the keys above + body + logs)
   6) family helper: a relative records on the person's behalf, after the person consents (cloud accounts only;
      tables care_family / care_entries — see supabase/plus.sql). The helper never reads the person's health data.
   Everything is computed on this device. LINE messages carry no health values. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const A = () => window.PreDM, DB = () => window.PreDMDB;
  const get = (k, d) => A()?.store.get(k, d) ?? d, set = (k, v) => A()?.store.set(k, v);
  const toast = (t) => A()?.toast?.(t);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const addMonths = (s, n) => { const d = new Date(s + "T00:00"); d.setMonth(d.getMonth() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((new Date(a + "T00:00") - new Date(b + "T00:00")) / 864e5);
  const thDate = (s, o = { day: "numeric", month: "short", year: "2-digit" }) => new Date(s + "T00:00").toLocaleDateString("th-TH", o);
  const num = (v, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(new Date(s + "T00:00"));
  const r1 = (n) => Math.round(n * 10) / 10;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ================= 1) drinks ================= */
  const LIMIT = 6; // teaspoons of added sugar a day (WHO / Thai Ministry of Public Health)
  // [id, icon, name, teaspoons at normal sweetness, made to order (sweetness can be chosen), keeps ~1 tsp from milk/creamer at 0%]
  const DRINKS = [
    ["water", "💧", "น้ำเปล่า", 0], ["blackcoffee", "☕", "กาแฟดำ / ชาไม่ใส่น้ำตาล", 0], ["milk", "🥛", "นมจืด 1 กล่อง", 0], ["zero", "🥤", "น้ำอัดลมสูตรไม่มีน้ำตาล", 0],
    ["thaitea", "🧋", "ชาเย็น / ชานมเย็น 1 แก้ว", 9, 1, 1], ["greentea", "🍵", "ชาเขียวนมเย็น 1 แก้ว", 9, 1, 1], ["icedcoffee", "🥤", "กาแฟเย็น 1 แก้ว", 8, 1, 1],
    ["cocoa", "🍫", "โกโก้เย็น 1 แก้ว", 9, 1, 1], ["pinkmilk", "🌸", "นมเย็น (นมชมพู) 1 แก้ว", 10, 1, 1], ["boba", "🧋", "ชานมไข่มุก 1 แก้ว", 11, 1, 1],
    ["oliang", "🧊", "โอเลี้ยง / ชาดำเย็น 1 แก้ว", 7, 1], ["lemontea", "🍋", "ชามะนาว / น้ำมะนาว 1 แก้ว", 7, 1], ["soda", "🥤", "น้ำอัดลม 1 กระป๋อง (325 มล.)", 8.5],
    ["bottletea", "🍵", "ชาเขียวพร้อมดื่ม 1 ขวด (500 มล.)", 7], ["juice", "🧃", "น้ำผลไม้กล่อง (200 มล.)", 5], ["energy", "⚡", "เครื่องดื่มชูกำลัง 1 ขวด", 6],
    ["yakult", "🧴", "นมเปรี้ยวขวดเล็ก", 3], ["sweetmilk", "🥛", "นมรสหวาน / ช็อกโกแลต 1 กล่อง", 4.5], ["coffee3", "☕", "กาแฟ 3 อิน 1 (1 ซอง)", 2.5],
    ["cane", "🎋", "น้ำอ้อย 1 แก้ว", 8], ["coconut", "🥥", "น้ำมะพร้าว 1 ลูก", 4],
  ];
  const SWEET = [[0, "ไม่หวาน 0%"], [0.25, "หวานน้อย 25%"], [0.5, "หวานครึ่ง 50%"], [1, "หวานปกติ 100%"], [1.25, "หวานมาก 125%"]];
  const tspOf = (d, f) => (d[4] ? r1(Math.max(d[5] && d[3] ? 1 : 0, d[3] * f)) : d[3]);
  const drinks = () => get("drinks", []);
  const dayTsp = (day) => r1(drinks().filter((x) => x.date === day).reduce((t, x) => t + (x.tsp || 0), 0));
  const spoons = (n) => { const full = Math.min(12, Math.floor(n)); return "🥄".repeat(full) + (n - Math.floor(n) >= 0.5 && full < 12 ? "·" : "") + (n > 12 ? "+" : ""); };
  let dSel = null, dSweet = 1;
  function drinkView() {
    const t = dayTsp(today()), over = t > LIMIT, list = drinks().filter((x) => x.date === today());
    const pct = Math.min(100, Math.round((t / LIMIT) * 100)), sel = DRINKS.find((d) => d[0] === dSel);
    const wk = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6)).map((d) => [d, dayTsp(d)]);
    box(head("🧋", "น้ำตาลในเครื่องดื่มวันนี้", "ไม่ควรเกินวันละ 6 ช้อนชา (รวมทุกแก้ว)") + `
      <div class="px-meter ${over ? "over" : ""}"><div class="px-meter-n"><b>${t}</b><span>/ ${LIMIT} ช้อนชา</span></div><i><em style="width:${pct}%"></em></i>
        <p>${t === 0 ? "วันนี้ยังไม่มีน้ำตาลจากเครื่องดื่มเลย เยี่ยมมากค่ะ" : over ? `เกินมา ${r1(t - LIMIT)} ช้อนชาแล้วค่ะ แก้วต่อไปลองเป็นน้ำเปล่าหรือสั่ง “ไม่หวาน” นะคะ` : `เหลือได้อีก ${r1(LIMIT - t)} ช้อนชาค่ะ`}</p></div>
      <h3 class="px-h">ดื่มอะไรไปคะ แตะเพื่อเลือก</h3>
      <div class="px-drinks">${DRINKS.map((d) => `<button type="button" class="px-drink" aria-pressed="${d[0] === dSel}" data-px="dpick" data-id="${d[0]}"><span aria-hidden="true">${d[1]}</span><b>${esc(d[2])}</b><small>${d[3] ? "ประมาณ " + d[3] + " ช้อนชา" : "0 ช้อนชา"}</small></button>`).join("")}</div>
      ${sel ? `<div class="px-add">${sel[4] ? `<div class="px-chips" role="group" aria-label="ระดับความหวาน">${SWEET.map(([f, l]) => `<button type="button" class="px-chip" aria-pressed="${f === dSweet}" data-px="dsweet" data-f="${f}">${l}</button>`).join("")}</div>` : ""}
        <p><b>${esc(sel[2])}</b> = <b>${tspOf(sel, dSweet)}</b> ช้อนชา <span aria-hidden="true">${spoons(tspOf(sel, dSweet))}</span></p>
        <button type="button" class="btn primary" data-px="dadd">+ บันทึกแก้วนี้</button></div>` : ""}
      ${list.length ? `<h3 class="px-h">วันนี้ดื่มไปแล้ว</h3><ul class="px-list">${list.map((x) => `<li><span>${esc(x.name)}</span><b>${x.tsp} ช้อนชา</b><button type="button" class="px-del" data-px="ddel" data-id="${esc(x.id)}" aria-label="ลบ ${esc(x.name)}">✕</button></li>`).join("")}</ul>` : ""}
      <h3 class="px-h">7 วันที่ผ่านมา</h3>
      <div class="px-week" role="img" aria-label="น้ำตาลจากเครื่องดื่ม 7 วันที่ผ่านมา">${wk.map(([d, v]) => `<div class="${v > LIMIT ? "over" : ""}" style="--h:${Math.min(1, v / 12)}"><i></i><b>${v || ""}</b><small>${thDate(d, { weekday: "short" })}</small></div>`).join("")}<span class="px-week-line" aria-hidden="true"></span></div>
      <p class="px-note">ตัวเลขเป็นค่าประมาณของแก้วขนาดทั่วไป ร้านแต่ละร้านหวานไม่เท่ากัน · 1 ช้อนชา = น้ำตาล 4 กรัม</p>`);
  }

  /* ================= 2) sleep & stress ================= */
  const STRESS = [[1, "😌", "สบายมาก"], [2, "🙂", "สบาย"], [3, "😐", "เฉย ๆ"], [4, "😟", "เครียด"], [5, "😣", "เครียดมาก"]];
  const moods = () => get("mood", []);
  let mDraft = null, mChart = null;
  function moodView() {
    const all = moods().slice().sort((a, b) => a.date.localeCompare(b.date)), td = all.find((x) => x.date === today());
    if (!mDraft) mDraft = { sleep: td?.sleep ?? 7, stress: td?.stress ?? 0 };
    const last7 = all.filter((x) => x.date > addDays(today(), -7));
    const avg = (k) => (last7.length ? r1(last7.reduce((t, x) => t + x[k], 0) / last7.length) : null);
    box(head("😴", "การนอนและความเครียด", "วันละ 2 คำถาม ใช้เวลาไม่ถึง 10 วินาที") + `
      <div class="px-q"><b>1. เมื่อคืนนอนกี่ชั่วโมงคะ</b>
        <div class="px-step"><button type="button" data-px="msleep" data-d="-0.5" aria-label="ลดครึ่งชั่วโมง">−</button><output aria-live="polite"><b>${mDraft.sleep}</b> ชั่วโมง</output><button type="button" data-px="msleep" data-d="0.5" aria-label="เพิ่มครึ่งชั่วโมง">+</button></div></div>
      <div class="px-q"><b>2. วันนี้รู้สึกเครียดแค่ไหนคะ</b>
        <div class="px-faces" role="group" aria-label="ระดับความเครียด">${STRESS.map(([v, e, l]) => `<button type="button" aria-pressed="${mDraft.stress === v}" data-px="mstress" data-v="${v}"><span aria-hidden="true">${e}</span><small>${l}</small></button>`).join("")}</div></div>
      <div class="care-foot"><button type="button" class="btn primary" data-px="msave">${td ? "แก้ไขของวันนี้" : "บันทึกวันนี้"}</button></div>
      ${last7.length ? `<div class="px-stats"><div><small>นอนเฉลี่ย 7 วัน</small><b>${avg("sleep")} ชม.</b><em>${avg("sleep") >= 7 ? "เพียงพอ" : "ควรนอนให้ได้ 7–8 ชม."}</em></div><div><small>ความเครียดเฉลี่ย</small><b>${avg("stress")} / 5</b><em>${avg("stress") >= 3.5 ? "ลองหายใจลึก ๆ หรือยืดเหยียดก่อนนอนนะคะ" : "อยู่ในเกณฑ์ดี"}</em></div></div>` : ""}
      <h3 class="px-h">30 วันที่ผ่านมา เทียบกับน้ำหนัก</h3>
      <div class="px-chart"><canvas id="pxMoodChart" aria-label="กราฟชั่วโมงนอน ความเครียด และน้ำหนัก 30 วัน" role="img"></canvas></div>
      <p class="px-note">นอนน้อยและเครียดสะสมทำให้ร่างกายดื้ออินซูลินและอยากของหวานมากขึ้น · หากเครียดมากต่อเนื่องเกิน 2 สัปดาห์ โทรสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมงค่ะ</p>`);
    drawMood(all);
  }
  function drawMood(all) {
    const cv = $("#pxMoodChart"); if (!cv || !window.Chart) return;
    const days = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29)), by = new Map(all.map((x) => [x.date, x]));
    const body = new Map(get("body", []).map((b) => [b.date, b.weight]));
    const cs = getComputedStyle(document.documentElement), ink = cs.getPropertyValue("--muted").trim() || "#888", grid = cs.getPropertyValue("--line").trim() || "#ddd";
    mChart?.destroy();
    mChart = new window.Chart(cv, { type: "line", data: { labels: days.map((d) => thDate(d, { day: "numeric", month: "short" })), datasets: [
      { label: "นอน (ชม.)", data: days.map((d) => by.get(d)?.sleep ?? null), borderColor: "#5b6fe0", backgroundColor: "#5b6fe0", spanGaps: true, tension: .3, pointRadius: 3, yAxisID: "y" },
      { label: "ความเครียด (1–5)", data: days.map((d) => by.get(d)?.stress ?? null), borderColor: "#e0734f", backgroundColor: "#e0734f", borderDash: [5, 4], spanGaps: true, tension: .3, pointRadius: 3, yAxisID: "y" },
      { label: "น้ำหนัก (กก.)", data: days.map((d) => body.get(d) ?? null), borderColor: "#1f9d6b", backgroundColor: "#1f9d6b", spanGaps: true, pointRadius: 5, pointStyle: "rectRot", yAxisID: "w" }] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { color: ink, usePointStyle: true, boxWidth: 8 } } },
        scales: { x: { ticks: { color: ink, maxTicksLimit: 6 }, grid: { display: false } }, y: { min: 0, max: 12, ticks: { color: ink }, grid: { color: grid } }, w: { position: "right", ticks: { color: ink }, grid: { display: false } } } } });
  }

  /* ================= 3) missions ================= */
  // [id, icon, name, what to do each day, days needed out of 7, auto ("walk" = 30 minutes in the exercise log that day)]
  const MISSIONS = [
    ["nosweet", "🧋", "งดน้ำหวาน 7 วัน", "ไม่ดื่มชาเย็น กาแฟเย็น น้ำอัดลม ดื่มน้ำเปล่าหรือสั่งไม่หวานแทน", 7],
    ["walk30", "🚶", "เดิน 30 นาที 5 วัน", "เดินเร็วหรือออกกำลังกายรวม 30 นาทีในวันนั้น (นับจากบันทึกในแอปให้เอง)", 5, "walk"],
    ["veg", "🥬", "ผักครึ่งจาน 5 วัน", "มื้อหลักอย่างน้อย 1 มื้อ ให้ผักเต็มครึ่งจาน", 5],
    ["rice", "🍚", "ข้าวไม่เกิน 2 ทัพพี 5 วัน", "ทุกมื้อตักข้าวหรือข้าวเหนียวไม่เกิน 2 ทัพพี (ข้าวเหนียว 1 ปั้นเล็ก)", 5],
    ["sleep", "🌙", "เข้านอนก่อน 4 ทุ่ม 5 คืน", "ปิดจอและเข้านอนก่อน 22.00 น.", 5],
    ["water", "💧", "น้ำเปล่า 8 แก้ว 7 วัน", "ดื่มน้ำเปล่าให้ครบ 8 แก้วตลอดวัน", 7],
  ];
  const CHEER = ["เริ่มต้นได้สวยค่ะ น้องเชียร์อยู่นะคะ", "วันที่ 2 แล้ว ร่างกายเริ่มคุ้นแล้วค่ะ", "เกือบครึ่งทางแล้ว เก่งมากค่ะ", "เกินครึ่งแล้ว สู้ต่ออีกนิดนะคะ", "ใกล้ถึงเส้นชัยแล้วค่ะ", "อีกวันเดียวเท่านั้นค่ะ!", "ครบแล้ว! น้องภูมิใจในตัวคุณมากค่ะ 🎉"];
  const ms = () => { const m = get("missions", null) || {}; return { active: Array.isArray(m.active) ? m.active : [], medals: Array.isArray(m.medals) ? m.medals : [] }; };
  const walkDay = (d) => get("logs", []).filter((l) => l.date === d && l.type !== "game").reduce((t, l) => t + (l.minutes || 0), 0) >= 30;
  const mDone = (a, d) => !!a.ticks?.[d] || (MISSIONS.find((m) => m[0] === a.id)?.[5] === "walk" && walkDay(d));
  function mState(a) {
    const def = MISSIONS.find((m) => m[0] === a.id); if (!def) return null;
    const days = Array.from({ length: 7 }, (_, i) => addDays(a.start, i)), done = days.filter((d) => mDone(a, d)).length, t = today();
    return { def, days, done, need: def[4], won: done >= def[4], ended: t > days[6], dayNo: Math.min(7, diffDays(t, a.start) + 1) };
  }
  function settleMissions() { // award medals / retire finished missions
    const m = ms(); let changed = false, won = null;
    m.active = m.active.filter((a) => { const s = mState(a); if (!s) { changed = true; return false; }
      if (s.won) { m.medals.unshift({ id: a.id, at: today() }); changed = true; won = s.def; return false; }
      if (s.ended) { changed = true; a.failed = true; return true; } return true; });
    if (changed) set("missions", m);
    if (won) { toast(`🏅 ได้เหรียญ “${won[2]}” แล้วค่ะ!`); window.PreDMMusic?.sfx?.("ok"); }
    return m;
  }
  const tier = (n) => (n >= 10 ? ["💎", "ระดับเพชร"] : n >= 5 ? ["🥇", "ระดับทอง"] : n >= 3 ? ["🥈", "ระดับเงิน"] : n >= 1 ? ["🥉", "ระดับทองแดง"] : ["⭐", "ยังไม่มีเหรียญ"]);
  function missionStreak() { // consecutive days (up to today / yesterday) with at least one mission day done, across active + past
    const m = ms(), all = new Set(); m.active.forEach((a) => Array.from({ length: 7 }, (_, i) => addDays(a.start, i)).forEach((d) => { if (mDone(a, d)) all.add(d); }));
    (get("missionDays", []) || []).forEach((d) => all.add(d));
    let n = 0, d = today(); if (!all.has(d)) d = addDays(d, -1); while (all.has(d)) { n++; d = addDays(d, -1); } return n;
  }
  function missionView() {
    const m = settleMissions(), t = today(), tr = tier(m.medals.length), running = new Set(m.active.filter((a) => !a.failed).map((a) => a.id));
    const count = {}; m.medals.forEach((x) => (count[x.id] = (count[x.id] || 0) + 1));
    box(head("🏅", "ภารกิจ 7 วัน", "เลือกภารกิจเล็ก ๆ ทำให้ครบใน 7 วัน แล้วรับเหรียญสะสม") + `
      <div class="px-medal"><span class="px-medal-ic" aria-hidden="true">${tr[0]}</span><div><b>${m.medals.length} เหรียญ · ${tr[1]}</b><small>ทำต่อเนื่อง ${missionStreak()} วัน${m.medals.length < 10 ? ` · อีก ${[1, 3, 5, 10].find((x) => x > m.medals.length) - m.medals.length} เหรียญเลื่อนระดับ` : ""}</small></div></div>
      ${m.active.length ? `<h3 class="px-h">ภารกิจที่กำลังทำ</h3>${m.active.map((a) => { const s = mState(a); if (!s) return "";
        return `<article class="px-mis ${a.failed ? "failed" : ""}"><header><span aria-hidden="true">${s.def[1]}</span><div><b>${esc(s.def[2])}</b><small>${esc(s.def[3])}</small></div></header>
          <div class="px-days">${s.days.map((d, i) => { const on = mDone(a, d), can = !a.failed && !s.def[5] && (d === t || d === addDays(t, -1)); return `<button type="button" class="${on ? "on" : ""} ${d === t ? "today" : ""}" ${can ? `data-px="mtick" data-id="${a.id}" data-d="${d}"` : "disabled"} aria-label="วันที่ ${i + 1} ${thDate(d)} ${on ? "ทำแล้ว" : "ยังไม่ได้ทำ"}"><small>วัน ${i + 1}</small><b>${on ? "✓" : d > t ? "" : "·"}</b></button>`; }).join("")}</div>
          <p class="px-cheer">${a.failed ? `ครบ 7 วันแล้ว ทำได้ ${s.done}/${s.need} วัน ยังไม่ถึงเป้า ไม่เป็นไรค่ะ เริ่มใหม่ได้เสมอ` : `🧡 ${CHEER[Math.max(0, Math.min(6, s.done ? s.done - 1 : 0))]} · ทำได้ ${s.done}/${s.need} วัน (วันที่ ${s.dayNo} จาก 7)`}</p>
          <div class="care-foot">${a.failed ? `<button type="button" class="btn sm primary" data-px="mretry" data-id="${a.id}">เริ่มใหม่</button>` : s.def[5] ? `<a class="btn sm" href="#exercise" data-px="close">ไปออกกำลังกาย →</a>` : `<button type="button" class="btn sm primary" data-px="mtick" data-id="${a.id}" data-d="${t}">${mDone(a, t) ? "ยกเลิกของวันนี้" : "วันนี้ทำได้แล้ว ✓"}</button>`}<button type="button" class="btn sm" data-px="mquit" data-id="${a.id}">เลิกภารกิจนี้</button></div></article>`; }).join("")}` : ""}
      <h3 class="px-h">เลือกภารกิจใหม่</h3>
      <div class="px-mpick">${MISSIONS.map((d) => `<button type="button" data-px="mstart" data-id="${d[0]}" ${running.has(d[0]) ? "disabled" : ""}><span aria-hidden="true">${d[1]}</span><b>${esc(d[2])}</b><small>${running.has(d[0]) ? "กำลังทำอยู่" : count[d[0]] ? `🏅 × ${count[d[0]]}` : "ยังไม่เคยทำ"}</small></button>`).join("")}</div>
      <p class="px-note">ทำไม่ได้บางวันไม่เป็นไรค่ะ ภารกิจที่ต้องครบ 5 วันพลาดได้ 2 วัน · ย้อนขีดได้เฉพาะเมื่อวาน</p>`);
  }
  function rememberDay(d) { const s = new Set(get("missionDays", []) || []); s.add(d); set("missionDays", [...s].sort().slice(-120)); }

  /* ================= 4) blood test ================= */
  const labs = () => get("labs", []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const labPlan = () => ({ months: 12, line: true, ...(get("labPlan", null) || {}) });
  const labDue = () => { const l = labs()[0]; return l ? addMonths(l.date, labPlan().months) : null; };
  const fbsLv = (v) => (v == null ? null : v < 100 ? ["ปกติ", "ok"] : v < 126 ? ["เสี่ยงเบาหวาน (Pre-DM)", "warn"] : ["สูง ควรพบแพทย์", "crit"]);
  const a1cLv = (v) => (v == null ? null : v < 5.7 ? ["ปกติ", "ok"] : v < 6.5 ? ["เสี่ยงเบาหวาน (Pre-DM)", "warn"] : ["สูง ควรพบแพทย์", "crit"]);
  function syncLabReminder() { // the scheduler reads reminders.lab (a date only — no health value leaves the device for LINE)
    const r = { ...(get("reminders", null) || {}) }, due = labDue(), p = labPlan();
    const next = due ? { due, line: !!p.line } : null;
    if (JSON.stringify(r.lab || null) !== JSON.stringify(next)) { if (next) r.lab = next; else delete r.lab; set("reminders", r); }
  }
  function labStatus() {
    const due = labDue(); if (!due) return null; const left = diffDays(due, today());
    return { due, left, text: left < 0 ? `เลยกำหนดตรวจซ้ำมา ${-left} วันแล้ว` : left === 0 ? "ครบกำหนดตรวจซ้ำวันนี้" : left <= 30 ? `อีก ${left} วันครบกำหนดตรวจซ้ำ` : `ตรวจซ้ำ ${thDate(due, { day: "numeric", month: "long", year: "numeric" })}`, cls: left < 0 ? "crit" : left <= 30 ? "warn" : "ok" };
  }
  function labView() {
    const all = labs(), st = labStatus(), p = labPlan();
    box(head("🩸", "ตรวจน้ำตาลในเลือด", "จดผลตรวจ แล้วให้น้องช่วยนับวันตรวจซ้ำ") + `
      ${st ? `<div class="px-due ${st.cls}"><b>${st.text}</b><small>ตรวจล่าสุด ${thDate(all[0].date, { day: "numeric", month: "long", year: "numeric" })} · นัดตรวจซ้ำทุก ${p.months} เดือน</small></div>` : `<div class="px-due"><b>ยังไม่มีวันตรวจล่าสุด</b><small>กรอกวันที่ตรวจครั้งล่าสุดด้านล่าง ถ้ายังไม่เคยตรวจ ไปตรวจได้ที่ รพ.สต. หรือโรงพยาบาลใกล้บ้านค่ะ</small></div>`}
      <form class="px-form" id="pxLabForm" novalidate>
        <label>วันที่ตรวจ<input type="date" name="date" max="${today()}" value="${today()}" required></label>
        <label>น้ำตาลหลังอดอาหาร FBS (มก./ดล.) <small>ไม่ทราบเว้นว่างได้</small><input type="number" name="fbs" inputmode="numeric" min="40" max="500" step="1" placeholder="เช่น 105"></label>
        <label>น้ำตาลสะสม HbA1c (%) <small>ไม่ทราบเว้นว่างได้</small><input type="number" name="a1c" inputmode="decimal" min="3" max="18" step="0.1" placeholder="เช่น 5.9"></label>
        <button type="submit" class="btn primary">บันทึกผลตรวจ</button>
      </form>
      <div class="px-q"><b>ให้เตือนตรวจซ้ำทุก</b>
        <div class="px-chips" role="group" aria-label="ระยะเวลานัดตรวจซ้ำ">${[[3, "3 เดือน"], [6, "6 เดือน"], [12, "1 ปี"]].map(([m, l]) => `<button type="button" class="px-chip" aria-pressed="${p.months === m}" data-px="lmonths" data-m="${m}">${l}</button>`).join("")}</div>
        <small class="px-note">กลุ่มเสี่ยงเบาหวานควรตรวจซ้ำอย่างน้อยปีละครั้ง หรือตามที่แพทย์นัด</small>
        <label class="px-check"><input type="checkbox" id="pxLabLine" ${p.line ? "checked" : ""}> เตือนทาง LINE ด้วย (เมื่อผูก LINE กับแอปแล้ว) ข้อความจะไม่มีค่าผลตรวจ</label></div>
      ${all.length ? `<h3 class="px-h">ประวัติผลตรวจ</h3><div class="tbl-wrap"><table class="tbl px-tbl"><thead><tr><th>วันที่</th><th>FBS</th><th>HbA1c</th><th></th></tr></thead><tbody>${all.map((x) => { const f = fbsLv(x.fbs), a = a1cLv(x.a1c);
        return `<tr><td>${thDate(x.date)}${x.by ? ` <small>(ครอบครัวบันทึก)</small>` : ""}</td><td>${x.fbs != null ? `${x.fbs} <em class="px-lv ${f[1]}">${f[0]}</em>` : "–"}</td><td>${x.a1c != null ? `${x.a1c}% <em class="px-lv ${a[1]}">${a[0]}</em>` : "–"}</td><td><button type="button" class="px-del" data-px="ldel" data-d="${x.date}" aria-label="ลบผลตรวจวันที่ ${thDate(x.date)}">✕</button></td></tr>`; }).join("")}</tbody></table></div>` : ""}
      <p class="px-note">เกณฑ์อ้างอิง: FBS 100–125 หรือ HbA1c 5.7–6.4% = ภาวะเสี่ยงเบาหวาน · ผลในแอปเป็นข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัย โปรดปรึกษาแพทย์</p>`);
  }

  /* ================= 5) monthly report ================= */
  let repMonth = null;
  function reportData(ym) { // ym = "2026-11"
    const from = ym + "-01", to = iso(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0)), inM = (d) => d >= from && d <= to;
    const ndays = diffDays(to < today() ? to : today() < from ? from : today(), from) + 1;
    const body = get("body", []).filter((b) => !b.sample).slice().sort((a, b) => a.date.localeCompare(b.date));
    const bIn = body.filter((b) => inM(b.date)), bLast = bIn[bIn.length - 1] || body.filter((b) => b.date <= to).pop(), bPrev = body.filter((b) => b.date < from).pop() || bIn[0];
    const logs = get("logs", []).filter((l) => !l.sample && inM(l.date) && l.type !== "game"), mins = logs.reduce((t, l) => t + (l.minutes || 0), 0);
    const exDays = new Set(logs.map((l) => l.date)).size, byType = {}; logs.forEach((l) => (byType[l.type] = (byType[l.type] || 0) + (l.minutes || 0)));
    const dr = drinks().filter((x) => inM(x.date)), drDays = [...new Set(dr.map((x) => x.date))], drTot = drDays.map((d) => dr.filter((x) => x.date === d).reduce((t, x) => t + x.tsp, 0));
    const mo = moods().filter((x) => inM(x.date)), avg = (a, k) => (a.length ? r1(a.reduce((t, x) => t + x[k], 0) / a.length) : null);
    const risk = get("riskHistory", [])[0], pr = A()?.profile?.() || {};
    return { ym, from, to, ndays, pr, risk, body: { last: bLast, prev: bPrev && bLast && bPrev.date !== bLast.date ? bPrev : null, n: bIn.length },
      ex: { mins, days: exDays, perWeek: Math.round(mins / Math.max(1, ndays / 7)), byType }, labs: labs().filter((x) => x.date >= addMonths(to, -12) && x.date <= to).slice(0, 4), due: labDue(),
      drink: { days: drDays.length, avg: drTot.length ? r1(drTot.reduce((a, b) => a + b, 0) / drTot.length) : null, over: drTot.filter((v) => v > LIMIT).length },
      mood: { n: mo.length, sleep: avg(mo, "sleep"), stress: avg(mo, "stress") }, medals: ms().medals.filter((x) => inM(x.at)) };
  }
  function reportHTML(R) {
    const TH = A()?.TYPE_TH || {}, b = R.body.last, p = R.body.prev, bmi = (x) => (x?.weight && x?.height ? r1(x.weight / (x.height / 100) ** 2) : null);
    const delta = (a, c, unit) => { if (a == null || c == null) return ""; const d = r1(a - c); return d === 0 ? " (เท่าเดิม)" : ` (${d > 0 ? "+" : "−"}${Math.abs(d)} ${unit})`; };
    const row = (k, v, note = "") => `<tr><th scope="row">${k}</th><td>${v}</td><td>${note}</td></tr>`;
    const none = `<span class="rp-none">ไม่มีบันทึก</span>`;
    return `<div class="rp">
      <header class="rp-top"><div><b>สรุปสุขภาพประจำเดือน ${new Date(R.from + "T00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</b><small>Pre-DM Smart Hub (แพลตฟอร์มอ่อนหวานวิทยา · AONWANWITTHAYA) · สำหรับนำไปพบแพทย์หรือเจ้าหน้าที่สาธารณสุข</small></div></header>
      <p class="rp-who"><span>ชื่อ <b>${esc(R.pr.name) || "........................................"}</b></span><span>อายุ <b>${R.pr.age || "....."}</b> ปี</span><span>เพศ <b>${R.pr.sex === "m" ? "ชาย" : R.pr.sex === "f" ? "หญิง" : "....."}</b></span><span>ส่วนสูง <b>${b?.height || R.pr.height || "....."}</b> ซม.</span></p>
      <table class="rp-tbl"><caption>ร่างกาย</caption><tbody>
        ${row("น้ำหนัก", b ? `<b>${b.weight}</b> กก.${p ? delta(b.weight, p.weight, "กก.") : ""}` : none, b ? `วัดเมื่อ ${thDate(b.date)}${p ? ` · ก่อนหน้า ${p.weight} กก. (${thDate(p.date)})` : ""}` : "")}
        ${row("รอบเอว", b?.waist ? `<b>${b.waist}</b> ซม.${p?.waist ? delta(b.waist, p.waist, "ซม.") : ""}` : none, "เกณฑ์: ชาย &lt; 90 ซม. · หญิง &lt; 80 ซม.")}
        ${row("ดัชนีมวลกาย (BMI)", bmi(b) != null ? `<b>${bmi(b)}</b>` : none, "เกณฑ์คนเอเชีย: 18.5–22.9 ปกติ · 23–24.9 น้ำหนักเกิน · ≥ 25 อ้วน")}
        ${row("คะแนนความเสี่ยงเบาหวาน", R.risk ? `<b>${R.risk.score}</b> คะแนน · ${esc(R.risk.level || "")}` : none, R.risk?.date ? `ประเมินเมื่อ ${thDate(R.risk.date)} (แบบประเมินความเสี่ยงของไทย)` : "")}
      </tbody></table>
      <table class="rp-tbl"><caption>น้ำตาลในเลือด (ผลตรวจ 12 เดือนล่าสุด)</caption><tbody>
        ${R.labs.length ? R.labs.map((x) => row(thDate(x.date), `${x.fbs != null ? `FBS <b>${x.fbs}</b> มก./ดล.` : ""}${x.fbs != null && x.a1c != null ? " · " : ""}${x.a1c != null ? `HbA1c <b>${x.a1c}</b>%` : ""}${x.fbs == null && x.a1c == null ? "ตรวจแล้ว (ไม่ได้จดค่า)" : ""}`, [fbsLv(x.fbs)?.[0], a1cLv(x.a1c)?.[0]].filter(Boolean).join(" · "))).join("") : row("ผลตรวจ", none, "")}
        ${row("นัดตรวจซ้ำ", R.due ? thDate(R.due, { day: "numeric", month: "long", year: "numeric" }) : "–", "FBS 100–125 หรือ HbA1c 5.7–6.4% = ภาวะเสี่ยงเบาหวาน")}
      </tbody></table>
      <table class="rp-tbl"><caption>พฤติกรรมในเดือนนี้ (${R.ndays} วัน)</caption><tbody>
        ${row("ออกกำลังกาย", R.ex.mins ? `<b>${R.ex.mins}</b> นาที · ${R.ex.days} วัน` : none, R.ex.mins ? `เฉลี่ย ${R.ex.perWeek} นาที/สัปดาห์ (เป้าหมาย ≥ 150) ${Object.entries(R.ex.byType).map(([t, m]) => `· ${esc(TH[t] || t)} ${m} นาที`).join(" ")}` : "เป้าหมาย ≥ 150 นาที/สัปดาห์")}
        ${row("น้ำตาลจากเครื่องดื่ม", R.drink.avg != null ? `เฉลี่ย <b>${R.drink.avg}</b> ช้อนชา/วัน` : none, R.drink.avg != null ? `บันทึก ${R.drink.days} วัน · เกิน 6 ช้อนชา ${R.drink.over} วัน` : "เกณฑ์: ไม่เกิน 6 ช้อนชา/วัน")}
        ${row("การนอน", R.mood.sleep != null ? `เฉลี่ย <b>${R.mood.sleep}</b> ชั่วโมง/คืน` : none, R.mood.n ? `บันทึก ${R.mood.n} วัน · แนะนำ 7–8 ชั่วโมง` : "แนะนำ 7–8 ชั่วโมง")}
        ${row("ความเครียด", R.mood.stress != null ? `เฉลี่ย <b>${R.mood.stress}</b> / 5` : none, "1 = สบายมาก · 5 = เครียดมาก")}
        ${row("ภารกิจ 7 วันที่สำเร็จ", R.medals.length ? `<b>${R.medals.length}</b> ภารกิจ` : "–", R.medals.map((x) => esc(MISSIONS.find((m) => m[0] === x.id)?.[2] || "")).filter(Boolean).join(" · "))}
      </tbody></table>
      <div class="rp-notes"><b>บันทึกจากแพทย์ / เจ้าหน้าที่</b><i></i><i></i><i></i></div>
      <p class="rp-foot">ข้อมูลนี้ผู้ใช้บันทึกด้วยตนเองในแอป ใช้ประกอบการพูดคุยกับแพทย์ ไม่ใช่ผลวินิจฉัยทางการแพทย์ · พิมพ์เมื่อ ${thDate(today(), { day: "numeric", month: "long", year: "numeric" })}</p>
    </div>`;
  }
  const REP_CSS = `.rp { font-size: 10.5pt; line-height: 1.5; color: #111; } .rp-top { border-bottom: 2.5px solid #2f4aa0; padding-bottom: 6px; margin-bottom: 8px; } .rp-top b { display: block; font-size: 15pt; } .rp-top small { color: #555; font-size: 8.5pt; }
    .rp-who { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 0 0 8px; } .rp-tbl { width: 100%; border-collapse: collapse; margin: 0 0 10px; } .rp-tbl caption { text-align: left; font-weight: 700; color: #2f4aa0; padding: 2px 0 3px; font-size: 11pt; }
    .rp-tbl th, .rp-tbl td { border: 1px solid #c9ced8; padding: 5px 8px; text-align: left; vertical-align: top; } .rp-tbl th { width: 27%; background: #f2f4f9; font-weight: 600; } .rp-tbl td:nth-child(2) { width: 30%; } .rp-tbl td:last-child { color: #444; font-size: 9pt; }
    .rp-none { color: #888; } .rp-notes { border: 1px solid #c9ced8; padding: 6px 10px 12px; } .rp-notes i { display: block; border-bottom: 1px dotted #999; height: 24px; } .rp-foot { color: #666; font-size: 8pt; margin: 8px 0 0; }`;
  function reportView() {
    const t = today(), months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return iso(d).slice(0, 7); });
    if (!repMonth) repMonth = t.slice(8) <= "05" ? months[1] : months[0];
    box(head("📄", "สรุปผลรายเดือนสำหรับพบแพทย์", "หน้าเดียวจบ พิมพ์หรือบันทึกเป็นไฟล์ PDF ได้") + `
      <div class="px-reptools"><label>เดือน <select id="pxRepMonth">${months.map((m) => `<option value="${m}" ${m === repMonth ? "selected" : ""}>${new Date(m + "-01T00:00").toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</option>`).join("")}</select></label>
        <button type="button" class="btn primary" data-px="rprint">🖨️ พิมพ์ / บันทึกเป็น PDF</button></div>
      <div class="px-reppaper"><style>${REP_CSS}</style>${reportHTML(reportData(repMonth))}</div>
      <p class="px-note">วิธีบันทึกเป็น PDF: กดปุ่มด้านบน แล้วในหน้าพิมพ์เลือกเครื่องพิมพ์เป็น “บันทึกเป็น PDF” (Save as PDF) · ไฟล์ถูกสร้างในเครื่องของคุณ ไม่ถูกส่งไปที่ใด</p>`, "wide");
  }
  function printReport() {
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>สรุปสุขภาพ ${repMonth}</title><link rel="stylesheet" href="${new URL("vendor/fonts/fonts.css", location.href).href}"><style>@page { size: A4 portrait; margin: 14mm; } body { margin: 0; background: #fff; font-family: "Anuphan", "Sarabun", sans-serif; } ${REP_CSS}</style></head><body>${reportHTML(reportData(repMonth))}</body></html>`;
    $("#pxPrintFrame")?.remove();
    const fr = document.createElement("iframe"); fr.id = "pxPrintFrame"; fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(fr); const doc = fr.contentDocument; doc.open(); doc.write(html); doc.close();
    const go = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { toast("พิมพ์ไม่ได้ ลองเปิดในเบราว์เซอร์ Chrome/Safari"); } };
    (doc.fonts?.ready || Promise.resolve()).then(() => setTimeout(go, 250));
  }

  /* ================= 6) family helper (cloud accounts) ================= */
  const F = { links: null, err: "", busy: false, forId: null, sent: [] };
  const me = () => DB()?.user || null, sb = () => DB()?.client || null;
  async function loadFamily() {
    F.err = ""; const { data, error } = await sb().from("care_family").select("id, owner_id, caregiver_id, code, code_expires, owner_name, caregiver_name, linked_at").order("created_at", { ascending: false });
    if (error) { F.err = /care_family|schema cache|does not exist/i.test(error.message) ? "ระบบครอบครัวยังไม่ได้เปิดใช้ในฐานข้อมูล (ผู้ดูแลระบบต้องรันไฟล์ plus.sql ก่อน)" : error.message; F.links = []; return; }
    F.links = data || [];
  }
  function familyView() {
    if (!me()) return box(head("👨‍👩‍👧", "ครอบครัวช่วยบันทึก", "ให้ลูกหลานช่วยจดแทนได้") + `<div class="px-due"><b>ใช้ได้เมื่อเข้าสู่ระบบด้วยบัญชีจริง</b><small>ฟังก์ชันนี้ต้องส่งรายการที่ลูกหลานจดให้ข้ามเครื่อง จึงต้องใช้บัญชีจริง (อีเมลหรือ LINE) ทั้งสองฝ่ายค่ะ บัญชีทดลองเก็บข้อมูลไว้ในเครื่องนี้เท่านั้น</small></div>`);
    if (!F.links) { box(head("👨‍👩‍👧", "ครอบครัวช่วยบันทึก", "กำลังโหลด…") + `<p class="px-note">⏳ กรุณารอสักครู่</p>`); return loadFamily().then(() => { if (cur === "family") familyView(); }); }
    const id = me().id, mine = F.links.filter((l) => l.owner_id === id), helpers = mine.filter((l) => l.caregiver_id), pending = mine.find((l) => !l.caregiver_id && l.code && new Date(l.code_expires) > new Date());
    const iHelp = F.links.filter((l) => l.caregiver_id === id), sel = iHelp.find((l) => l.owner_id === F.forId);
    box(head("👨‍👩‍👧", "ครอบครัวช่วยบันทึก", "ลูกหลานช่วยจดแทนได้ เมื่อเจ้าของข้อมูลยินยอม") + `
      ${F.err ? `<p class="form-error">${esc(F.err)}</p>` : ""}
      <section class="px-fam"><h3 class="px-h">ให้คนในครอบครัวช่วยบันทึกให้ฉัน</h3>
        ${helpers.length ? `<ul class="px-list">${helpers.map((l) => `<li><span>👤 ${esc(l.caregiver_name || "ผู้ช่วย")}</span><b>ช่วยบันทึกได้</b><button type="button" class="btn sm" data-px="frevoke" data-id="${l.id}">ยกเลิกสิทธิ์</button></li>`).join("")}</ul>` : ""}
        ${pending ? `<div class="px-code"><small>บอกรหัสนี้กับคนที่จะช่วยบันทึก (ใช้ได้ถึง ${new Date(pending.code_expires).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.)</small><b>${esc(pending.code)}</b><button type="button" class="btn sm" data-px="frevoke" data-id="${pending.id}">ยกเลิกรหัส</button></div>`
          : `<label class="px-check"><input type="checkbox" id="pxFamOk"> ฉันยินยอมให้ผู้ที่ได้รับรหัสจากฉัน บันทึกน้ำหนัก รอบเอว เครื่องดื่ม การนอน การออกกำลังกาย และผลตรวจน้ำตาล <b>แทนฉัน</b>ได้ โดยเขาจะ<b>ไม่เห็น</b>ข้อมูลสุขภาพเดิมของฉัน และฉันยกเลิกได้ทุกเมื่อ</label>
             <button type="button" class="btn primary" data-px="fcode" ${F.busy ? "disabled" : ""}>ขอรหัสให้ครอบครัว</button>`}
      </section>
      <section class="px-fam"><h3 class="px-h">ฉันช่วยบันทึกให้คนในครอบครัว</h3>
        ${iHelp.length ? `<div class="px-chips">${iHelp.map((l) => `<button type="button" class="px-chip" aria-pressed="${l.owner_id === F.forId}" data-px="ffor" data-id="${l.owner_id}">👵 ${esc(l.owner_name || "ไม่ระบุชื่อ")}</button>`).join("")}</div>` : ""}
        ${sel ? `<form class="px-form" id="pxFamForm" novalidate><b>บันทึกแทน ${esc(sel.owner_name || "")}</b>
            <label>วันที่<input type="date" name="date" max="${today()}" value="${today()}" required></label>
            <label>บันทึกเรื่อง<select name="kind" id="pxFamKind"><option value="body">น้ำหนัก / รอบเอว</option><option value="drink">เครื่องดื่ม</option><option value="mood">การนอน / ความเครียด</option><option value="exercise">เดิน / ออกกำลังกาย</option><option value="lab">ผลตรวจน้ำตาลในเลือด</option></select></label>
            <div id="pxFamFields">${famFields("body")}</div>
            <button type="submit" class="btn primary" ${F.busy ? "disabled" : ""}>ส่งให้ ${esc(sel.owner_name || "")}</button>
            <small class="px-note">รายการจะไปรวมในแอปของเจ้าของข้อมูลเมื่อเขาเปิดแอปครั้งถัดไป</small></form>
            ${F.sent.length ? `<ul class="px-list">${F.sent.slice(0, 5).map((s) => `<li><span>✅ ${esc(s)}</span></li>`).join("")}</ul>` : ""}
            <div class="care-foot"><button type="button" class="btn sm" data-px="fleave" data-id="${sel.id}">เลิกช่วยบันทึกให้คนนี้</button></div>` : ""}
        <form class="px-form px-join" id="pxJoinForm" novalidate><label>${iHelp.length ? "เพิ่มอีกคน: " : ""}กรอกรหัส 6 หลักที่ได้จากเจ้าของข้อมูล<input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="000000" autocomplete="off"></label><button type="submit" class="btn" ${F.busy ? "disabled" : ""}>เชื่อมต่อ</button></form>
      </section>
      <p class="px-note">🔒 ผู้ช่วยบันทึกส่งรายการใหม่ได้อย่างเดียว ไม่เห็นประวัติสุขภาพของเจ้าของข้อมูล · ดูรายละเอียดใน<a href="#privacy" data-px="close">นโยบาย PDPA</a></p>`);
  }
  function famFields(kind) {
    if (kind === "body") return `<label>น้ำหนัก (กก.)<input type="number" name="weight" inputmode="decimal" min="25" max="250" step="0.1" required></label><label>รอบเอว (ซม.) <small>เว้นว่างได้</small><input type="number" name="waist" inputmode="decimal" min="40" max="200" step="0.5"></label>`;
    if (kind === "drink") return `<label>เครื่องดื่ม<select name="drink">${DRINKS.map((d) => `<option value="${d[0]}">${esc(d[2])} (${d[3]} ช้อนชา)</option>`).join("")}</select></label><label>ความหวาน (เฉพาะแก้วที่สั่งชง)<select name="sweet">${SWEET.map(([f, l]) => `<option value="${f}" ${f === 1 ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    if (kind === "mood") return `<label>นอนกี่ชั่วโมง<input type="number" name="sleep" inputmode="decimal" min="0" max="16" step="0.5" value="7" required></label><label>ความเครียด<select name="stress">${STRESS.map(([v, e, l]) => `<option value="${v}" ${v === 3 ? "selected" : ""}>${e} ${l}</option>`).join("")}</select></label>`;
    if (kind === "exercise") return `<label>ทำอะไร<input name="name" maxlength="40" value="เดินเร็ว" required></label><label>กี่นาที<input type="number" name="minutes" inputmode="numeric" min="1" max="300" step="1" value="30" required></label>`;
    return `<label>FBS (มก./ดล.) <small>เว้นว่างได้</small><input type="number" name="fbs" inputmode="numeric" min="40" max="500"></label><label>HbA1c (%) <small>เว้นว่างได้</small><input type="number" name="a1c" inputmode="decimal" min="3" max="18" step="0.1"></label>`;
  }
  // turn one helper entry into a clean record (also used on arrival: entries come from another account, so re-validate everything)
  function cleanEntry(kind, d) {
    if (!d || !isDate(d.date) || d.date > today()) return null;
    if (kind === "body") { const w = num(d.weight, 25, 250); return w == null ? null : { date: d.date, weight: w, waist: num(d.waist, 40, 200) }; }
    if (kind === "drink") { const def = DRINKS.find((x) => x[0] === d.drink); if (!def) return null; const f = SWEET.find((s) => s[0] === Number(d.sweet))?.[0] ?? 1; return { date: d.date, drink: def[0], sweet: f }; }
    if (kind === "mood") { const s = num(d.sleep, 0, 16), st = num(d.stress, 1, 5); return s == null || st == null ? null : { date: d.date, sleep: s, stress: Math.round(st) }; }
    if (kind === "exercise") { const m = num(d.minutes, 1, 300), n = String(d.name || "").trim().slice(0, 40); return m == null || !n ? null : { date: d.date, minutes: Math.round(m), name: n }; }
    if (kind === "lab") { const f = num(d.fbs, 40, 500), a = num(d.a1c, 3, 18); return { date: d.date, fbs: f, a1c: a }; }
    return null;
  }
  function applyEntry(kind, c) { // write a validated helper entry into this person's own records
    if (kind === "body") { const rows = get("body", []).slice(), i = rows.findIndex((x) => x.date === c.date), last = rows.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
      const base = i >= 0 ? rows[i] : { date: c.date, height: last?.height || A()?.profile?.()?.height || 160 }; const r = { ...base, weight: c.weight, ...(c.waist != null ? { waist: c.waist } : {}), by: "family" }; delete r.sample;
      if (i >= 0) rows[i] = r; else rows.push(r); set("body", rows); }
    else if (kind === "drink") { const def = DRINKS.find((x) => x[0] === c.drink), l = SWEET.find((s) => s[0] === c.sweet); set("drinks", [{ id: uid(), date: c.date, name: def[2] + (def[4] ? " · " + l[1] : ""), tsp: tspOf(def, c.sweet), by: "family" }, ...drinks()].slice(0, 600)); }
    else if (kind === "mood") set("mood", [...moods().filter((x) => x.date !== c.date), { date: c.date, sleep: c.sleep, stress: c.stress, by: "family" }].slice(-400));
    else if (kind === "exercise") { const logs = get("logs", []).slice(); logs.unshift({ date: c.date, type: "aerobic", name: c.name, minutes: c.minutes, by: "family" }); set("logs", logs.slice(0, 500)); }
    else if (kind === "lab") { set("labs", [...get("labs", []).filter((x) => x.date !== c.date), { date: c.date, fbs: c.fbs, a1c: c.a1c, by: "family" }]); syncLabReminder(); }
  }
  async function takeFamilyEntries() { // owner side: collect what helpers sent
    if (!me() || !sb() || takeFamilyEntries.busy) return; takeFamilyEntries.busy = true;
    try {
      const { data, error } = await sb().from("care_entries").select("id, kind, data").eq("owner_id", me().id).is("taken_at", null).order("created_at").limit(100);
      if (error || !data?.length) return;
      let n = 0; data.forEach((e) => { const c = cleanEntry(e.kind, e.data); if (c) { applyEntry(e.kind, c); n++; } });
      await sb().from("care_entries").update({ taken_at: new Date().toISOString() }).in("id", data.map((e) => e.id));
      if (n) { toast(`👨‍👩‍👧 ครอบครัวช่วยบันทึกให้ ${n} รายการ`); A()?.renderHome?.(); if (cur) VIEWS[cur]?.(); }
    } catch { /* offline: try again later */ } finally { takeFamilyEntries.busy = false; }
  }
  const famErr = (e) => { const m = String(e?.message || e); return /too_many/.test(m) ? "ลองผิดหลายครั้งเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่" : /bad_code/.test(m) ? "รหัสไม่ถูกต้องหรือหมดอายุแล้ว ขอรหัสใหม่จากเจ้าของข้อมูลนะคะ" : /care_family|care_entries|family_join|schema cache|does not exist/i.test(m) ? "ระบบครอบครัวยังไม่ได้เปิดใช้ในฐานข้อมูล (ผู้ดูแลระบบต้องรันไฟล์ plus.sql ก่อน)" : /fetch|network/i.test(m) ? "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้งนะคะ" : m; };
  async function famDo(fn) { if (F.busy) return; F.busy = true; F.err = ""; try { await fn(); await loadFamily(); } catch (e) { F.err = famErr(e); } F.busy = false; if (cur === "family") familyView(); }

  /* ================= home panel ================= */
  function home() {
    const host = $("#view-home"); if (!host || !A()) return;
    let el = $("#plusHome"); if (!el) { el = document.createElement("section"); el.id = "plusHome"; el.className = "px-home"; el.setAttribute("aria-label", "ดูแลตัวเองวันนี้"); ($(".home-acts", host) || $("#impRoot", host))?.after(el); }
    const t = today(), tsp = dayTsp(t), md = moods().find((x) => x.date === t), m = settleMissions(), act = m.active.filter((a) => !a.failed).map(mState).filter(Boolean)[0], st = labStatus();
    const tile = (k, ic, title, val, sub, cls = "") => `<button type="button" class="px-tile ${cls}" data-plus="${k}"><span class="px-tile-ic" aria-hidden="true">${ic}</span><span class="px-tile-t">${title}</span><b>${val}</b><small>${sub}</small></button>`;
    el.innerHTML = `<div class="px-home-head"><h2>ดูแลตัวเองวันนี้</h2><small>แตะการ์ดเพื่อบันทึก ใช้เวลาไม่ถึงนาที</small></div>
      ${st && st.left <= 14 ? `<button type="button" class="px-alert ${st.cls}" data-plus="lab">🩸 <b>${st.text}</b> <span>แตะเพื่อดูรายละเอียด →</span></button>` : ""}
      <div class="px-tiles">
        ${tile("drink", "🧋", "น้ำตาลในเครื่องดื่ม", `${tsp} / ${LIMIT} ช้อนชา`, tsp > LIMIT ? "เกินเกณฑ์วันนี้แล้ว" : tsp ? "ยังไม่เกินเกณฑ์" : "แตะเพื่อบันทึกแก้วแรก", tsp > LIMIT ? "crit" : "")}
        ${tile("mood", "😴", "การนอนและความเครียด", md ? `นอน ${md.sleep} ชม.` : "ยังไม่ได้บันทึก", md ? `ความเครียด ${STRESS[md.stress - 1]?.[2] || "-"}` : "ตอบ 2 คำถามสั้น ๆ")}
        ${tile("mission", "🏅", "ภารกิจ 7 วัน", act ? `${act.done}/${act.need} วัน` : `${m.medals.length} เหรียญ`, act ? esc(act.def[2]) : "เลือกภารกิจใหม่")}
        ${tile("lab", "🩸", "ตรวจน้ำตาลในเลือด", st ? (st.left < 0 ? "เลยกำหนดแล้ว" : `อีก ${st.left} วัน`) : "ยังไม่มีข้อมูล", st ? `ตรวจซ้ำ ${thDate(st.due)}` : "จดวันที่ตรวจล่าสุด", st?.cls === "crit" ? "crit" : "")}
        ${tile("report", "📄", "สรุปรายเดือน", "PDF พบแพทย์", "หน้าเดียว พิมพ์ได้")}
        ${tile("family", "👨‍👩‍👧", "ครอบครัวช่วยบันทึก", "ลูกหลานจดแทน", "ต้องยินยอมก่อน")}
      </div>`;
  }

  /* ================= modal plumbing ================= */
  let cur = null;
  const VIEWS = { drink: drinkView, mood: moodView, mission: missionView, lab: labView, report: reportView, family: familyView };
  const head = (ic, title, sub) => `<div class="px-head"><span class="px-av" aria-hidden="true">${ic}</span><div><h2 id="pxTitle">${title}</h2><small>${sub}</small></div><button type="button" class="care-x" data-px="close" aria-label="ปิด">✕</button></div>`;
  function box(html, cls = "") { const b = $("#pxBox"); if (!b) return; const y = b.scrollTop; b.className = "px-box " + cls; b.innerHTML = html; b.scrollTop = y; }
  function open(view) {
    if (!VIEWS[view]) return;
    if (!$("#pxModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal px-modal" id="pxModal" role="dialog" aria-modal="true" aria-labelledby="pxTitle" hidden><div class="px-box" id="pxBox" tabindex="-1"></div></div>`);
      const m = $("#pxModal"); m.addEventListener("click", onClick); m.addEventListener("submit", onSubmit); m.addEventListener("change", onChange);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) close(); });
    }
    if (cur !== view) { dSel = null; dSweet = 1; mDraft = null; if (view === "family") F.links = null; }
    cur = view; $("#pxModal").hidden = false; document.body.classList.add("care-open"); $("#pxBox").scrollTop = 0; VIEWS[view](); $("#pxBox").focus({ preventScroll: true });
    if (view === "family") takeFamilyEntries();
  }
  function close() { cur = null; mChart?.destroy(); mChart = null; $("#pxModal").hidden = true; document.body.classList.remove("care-open"); home(); }
  function onClick(e) {
    if (e.target.id === "pxModal") return close();
    const b = e.target.closest("[data-px]"); if (!b) return; const a = b.dataset.px, t = today();
    if (a === "close") return close();
    // drinks
    if (a === "dpick") { dSel = b.dataset.id; dSweet = 1; return drinkView(); }
    if (a === "dsweet") { dSweet = Number(b.dataset.f); return drinkView(); }
    if (a === "dadd") { const d = DRINKS.find((x) => x[0] === dSel); if (!d) return; const l = SWEET.find((s) => s[0] === dSweet);
      set("drinks", [{ id: uid(), date: t, name: d[2] + (d[4] ? " · " + l[1] : ""), tsp: tspOf(d, dSweet) }, ...drinks()].slice(0, 600)); dSel = null;
      const tot = dayTsp(t); toast(tot > LIMIT ? `วันนี้รวม ${tot} ช้อนชา เกินเกณฑ์แล้วค่ะ` : `บันทึกแล้ว วันนี้รวม ${tot} ช้อนชา`); return drinkView(); }
    if (a === "ddel") { set("drinks", drinks().filter((x) => x.id !== b.dataset.id)); return drinkView(); }
    // mood
    if (a === "msleep") { mDraft.sleep = Math.max(0, Math.min(16, mDraft.sleep + Number(b.dataset.d))); return moodView(); }
    if (a === "mstress") { mDraft.stress = Number(b.dataset.v); return moodView(); }
    if (a === "msave") { if (!mDraft.stress) return toast("เลือกระดับความเครียดก่อนนะคะ");
      set("mood", [...moods().filter((x) => x.date !== t), { date: t, sleep: mDraft.sleep, stress: mDraft.stress }].slice(-400)); toast("บันทึกแล้วค่ะ ขอบคุณที่ดูแลตัวเองนะคะ"); mDraft = null; return moodView(); }
    // missions
    if (a === "mstart" || a === "mretry") { const m = ms(); m.active = m.active.filter((x) => x.id !== b.dataset.id); if (m.active.filter((x) => !x.failed).length >= 3) return toast("ทำพร้อมกันได้ไม่เกิน 3 ภารกิจค่ะ");
      m.active.push({ id: b.dataset.id, start: t, ticks: {} }); set("missions", m); toast("เริ่มภารกิจแล้ว สู้ ๆ นะคะ 💪"); return missionView(); }
    if (a === "mtick") { const m = ms(), x = m.active.find((y) => y.id === b.dataset.id), d = b.dataset.d; if (!x || x.failed) return; x.ticks = x.ticks || {};
      if (x.ticks[d]) delete x.ticks[d]; else { x.ticks[d] = 1; rememberDay(d); } set("missions", m); return missionView(); }
    if (a === "mquit") { if (!confirm("เลิกภารกิจนี้ใช่ไหมคะ ความคืบหน้าจะหายไป")) return; const m = ms(); m.active = m.active.filter((x) => x.id !== b.dataset.id); set("missions", m); return missionView(); }
    // labs
    if (a === "lmonths") { set("labPlan", { ...labPlan(), months: Number(b.dataset.m) }); syncLabReminder(); return labView(); }
    if (a === "ldel") { if (!confirm("ลบผลตรวจรายการนี้ใช่ไหมคะ")) return; set("labs", get("labs", []).filter((x) => x.date !== b.dataset.d)); syncLabReminder(); return labView(); }
    // report
    if (a === "rprint") return printReport();
    // family
    if (a === "fcode") { if (!$("#pxFamOk")?.checked) return toast("กรุณาติ๊กยินยอมก่อนนะคะ");
      return famDo(async () => { const id = me().id; await sb().from("care_family").delete().eq("owner_id", id).is("caregiver_id", null);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        const { error } = await sb().from("care_family").insert({ owner_id: id, code, code_expires: new Date(Date.now() + 30 * 60000).toISOString(), owner_name: (A()?.profile?.()?.name || "").slice(0, 60) }); if (error) throw error; }); }
    if (a === "frevoke" || a === "fleave") { if (!confirm(a === "fleave" ? "เลิกช่วยบันทึกให้คนนี้ใช่ไหมคะ" : "ยกเลิกใช่ไหมคะ ผู้ช่วยจะบันทึกแทนคุณไม่ได้อีก")) return;
      return famDo(async () => { const { error } = await sb().from("care_family").delete().eq("id", b.dataset.id); if (error) throw error; if (a === "fleave") F.forId = null; }); }
    if (a === "ffor") { F.forId = b.dataset.id; F.sent = []; return familyView(); }
  }
  function onChange(e) {
    if (e.target.id === "pxRepMonth") { repMonth = e.target.value; return reportView(); }
    if (e.target.id === "pxLabLine") { set("labPlan", { ...labPlan(), line: e.target.checked }); return syncLabReminder(); }
    if (e.target.id === "pxFamKind") { $("#pxFamFields").innerHTML = famFields(e.target.value); }
  }
  function onSubmit(e) {
    e.preventDefault(); const f = e.target, v = Object.fromEntries(new FormData(f));
    if (f.id === "pxLabForm") {
      if (!isDate(v.date) || v.date > today()) return toast("เลือกวันที่ตรวจให้ถูกต้องก่อนนะคะ");
      const fbs = v.fbs === "" ? null : num(v.fbs, 40, 500), a1c = v.a1c === "" ? null : num(v.a1c, 3, 18);
      if ((v.fbs !== "" && fbs == null) || (v.a1c !== "" && a1c == null)) return toast("ค่าที่กรอกดูไม่ถูกต้อง ลองตรวจอีกครั้งนะคะ");
      set("labs", [...get("labs", []).filter((x) => x.date !== v.date), { date: v.date, fbs, a1c }]); syncLabReminder();
      const lv = fbsLv(fbs) || a1cLv(a1c); toast(lv?.[1] === "crit" ? "บันทึกแล้ว ค่าค่อนข้างสูง ควรพบแพทย์นะคะ" : "บันทึกผลตรวจแล้วค่ะ"); return labView();
    }
    if (f.id === "pxJoinForm") {
      const code = String(v.code || "").replace(/\D/g, ""); if (code.length !== 6) return toast("กรอกรหัสให้ครบ 6 หลักนะคะ");
      return famDo(async () => { const { data, error } = await sb().rpc("family_join", { p_code: code }); if (error) throw error; if (data?.error) throw new Error(data.error); F.forId = data?.owner_id || null; F.sent = []; toast("เชื่อมต่อแล้วค่ะ"); });
    }
    if (f.id === "pxFamForm") {
      const kind = v.kind, c = cleanEntry(kind, v); if (!c || (kind === "lab" && c.fbs == null && c.a1c == null)) return toast("กรอกข้อมูลให้ครบและถูกต้องก่อนนะคะ");
      const label = { body: `น้ำหนัก ${c.weight} กก.`, drink: DRINKS.find((d) => d[0] === c.drink)?.[2], mood: `นอน ${c.sleep} ชม.`, exercise: `${c.name} ${c.minutes} นาที`, lab: "ผลตรวจน้ำตาล" }[kind];
      return famDo(async () => { const { error } = await sb().from("care_entries").insert({ owner_id: F.forId, kind, data: c }); if (error) throw error; F.sent.unshift(`${thDate(c.date)} · ${label}`); toast("ส่งให้แล้วค่ะ"); });
    }
  }

  document.addEventListener("click", (e) => { const b = e.target.closest("[data-plus]"); if (b) { e.preventDefault(); open(b.dataset.plus); } });
  window.addEventListener("predm:home", home);
  // in-app nudge once a day when the re-test date is near, and pick up what family helpers sent
  function daily() {
    if (!A()) return; syncLabReminder();
    const st = labStatus(), k = "labNudge"; if (st && st.left <= 7 && get(k, "") !== today()) { set(k, today()); toast(`🩸 ${st.text} อย่าลืมนัดตรวจนะคะ`); }
  }
  let tries = 0, started = false; const boot = setInterval(() => { if (A() && !started) { started = true; home(); daily(); } if (me()) { clearInterval(boot); takeFamilyEntries(); setInterval(takeFamilyEntries, 180000); } else if (++tries > 20) clearInterval(boot); }, 1500);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") takeFamilyEntries(); });
  window.PreDMPlus = { open, home, reportData, labDue, dayTsp, cleanEntry };
})();

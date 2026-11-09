/* Pre-DM Smart Hub — "ต้นไม้สุขภาพ": a tree that grows with training consistency.
   Every training day waters the tree (+10, plus a streak bonus). Weight loss earns fertilizer, waist loss earns soil tilling. */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(d));
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  const dayDiff = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
  const thDate = (s, o = { day: "numeric", month: "short" }) => new Date(s + "T00:00:00").toLocaleDateString("th-TH", o);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STAGES = [
    [0, "เมล็ดพันธุ์", "เริ่มฝึกวันแรกเพื่อรดน้ำให้เมล็ดงอก"],
    [30, "ต้นอ่อนแตกยอด", "ยอดแรกโผล่แล้ว ฝึกต่อเนื่องเพื่อให้ใบงอกเพิ่ม"],
    [80, "ต้นกล้า", "ต้นกล้าแข็งแรงขึ้น รากเริ่มยึดดิน"],
    [160, "ต้นไม้เล็ก", "ลำต้นเริ่มเป็นเนื้อไม้ กิ่งแรกแตกออกแล้ว"],
    [280, "ต้นไม้วัยรุ่น", "กิ่งก้านแผ่กว้าง ใบหนาขึ้นเรื่อย ๆ"],
    [450, "ต้นไม้ใหญ่", "ให้ร่มเงาได้แล้ว ความต่อเนื่องของคุณเห็นผลชัด"],
    [700, "ต้นไม้ออกดอก", "ดอกบานเต็มต้น สุขภาพดีขึ้นอย่างต่อเนื่อง"],
    [1000, "ต้นไม้ออกผล", "ออกผลแล้ว! ยิ่งฝึกต่อเนื่อง ผลยิ่งดก"],
  ];
  const FERT = 30, TILL = 20;

  function compute() {
    const S = A().store, logs = S.get("logs", []), body = S.get("body", []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const dates = [...new Set(logs.map((l) => l.date))].sort(), today = todayISO();
    const events = []; let pts = 0, run = 0, best = 0, prev = null;
    dates.forEach((d) => {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run);
      const bonus = Math.min(run - 1, 10) * 2; pts += 10 + bonus;
      events.push({ date: d, kind: "water", pts: 10 + bonus, text: run > 1 ? `รดน้ำ (ฝึกต่อเนื่อง ${run} วัน)` : "รดน้ำ (ฝึกออกกำลังกาย)" }); prev = d;
    });
    const last = dates[dates.length - 1] || null, since = last ? dayDiff(last, today) : 99;
    const streak = last && since <= 1 ? run : 0;
    // rewards from body composition: each record lower than the previous one
    const earned = [];
    for (let i = 1; i < body.length; i++) {
      const a = body[i - 1], b = body[i];
      if (a.weight && b.weight && b.weight < a.weight - 0.05) earned.push({ id: "f-" + b.date, kind: "fert", date: b.date, why: `น้ำหนักลด ${fmt(a.weight - b.weight)} กก. (${fmt(a.weight)} → ${fmt(b.weight)})` });
      if (a.waist && b.waist && b.waist < a.waist - 0.05) earned.push({ id: "t-" + b.date, kind: "till", date: b.date, why: `รอบเอวลด ${fmt(a.waist - b.waist)} ซม. (${fmt(a.waist, 0)} → ${fmt(b.waist, 0)})` });
    }
    const used = S.get("tree", {}).used || {};
    Object.entries(used).forEach(([id, u]) => { pts += u.pts; events.push({ date: u.date, kind: id[0] === "f" ? "fert" : "till", pts: u.pts, text: id[0] === "f" ? "ใส่ปุ๋ย (น้ำหนักลด)" : "พรวนดิน (รอบเอวลด)" }); });
    const avail = earned.filter((e) => !used[e.id]);
    let si = 0; STAGES.forEach((s, i) => { if (pts >= s[0]) si = i; });
    const next = STAGES[si + 1], t = next ? (pts - STAGES[si][0]) / (next[0] - STAGES[si][0]) : Math.min(1, (pts - 1000) / 600);
    const wilt = since >= 6 ? 2 : since >= 3 ? 1 : 0;
    const now = new Date(), wd = (now.getDay() + 6) % 7, wStart = addDays(today, -wd);
    return { pts, si, t, next, streak, best, active: dates.length, week: dates.filter((d) => d >= wStart).length, last, since, wilt, earned, avail, used, events: events.sort((a, b) => b.date.localeCompare(a.date)), dates: new Set(dates) };
  }

  /* ---------- procedural SVG tree ---------- */
  function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function treeSVG(G, opts = {}) {
    const R = rng(7), W = 400, H = 360, gy = 300, cx = 200, s = G.si, g = G.pts, wilt = G.wilt;
    const leafC = wilt === 2 ? ["#b9a75a", "#a8904a", "#c4b06a", "#9c8a45"] : wilt === 1 ? ["#8fb85a", "#9fbf55", "#7fa94e", "#a9c26a"] : ["#4caf50", "#66c35a", "#3e9b4f", "#7ccf6a", "#58b368"];
    const droop = wilt * 0.12, br = [], tips = [], leaves = [], deco = [];
    let plant = "";
    if (s === 0) {
      plant = `<g class="tr-seed"><ellipse cx="${cx}" cy="${gy - 4}" rx="11" ry="8" fill="#8a5a33"/><path d="M${cx - 4} ${gy - 9} q4 -6 8 0" stroke="#c99a6b" stroke-width="2" fill="none"/>${G.active ? `<path d="M${cx} ${gy - 12} q2 -8 -2 -12" stroke="#6cbf5a" stroke-width="3" fill="none" stroke-linecap="round"/>` : ""}</g>`;
    } else if (s <= 2) {
      const h = s === 1 ? 26 + G.t * 22 : 52 + G.t * 34, n = s === 1 ? 2 : 4 + Math.round(G.t * 3);
      let p = `<path d="M${cx} ${gy} C ${cx - 4} ${gy - h * 0.4}, ${cx + 5} ${gy - h * 0.7}, ${cx} ${gy - h}" stroke="#5f9b3b" stroke-width="${s === 1 ? 3.5 : 5}" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < n; i++) {
        const y = gy - h * (0.35 + (i / Math.max(1, n - 1)) * 0.65), side = i % 2 ? 1 : -1, L = (s === 1 ? 16 : 20) + R() * 8, a = side * (0.9 + droop * 3);
        p += `<path d="M${cx} ${y} q ${side * L * 0.6} ${-L * 0.5 + droop * 30} ${side * L} ${-L * 0.15 + droop * 34} q ${-side * L * 0.5} ${L * 0.45} ${-side * L} ${L * 0.15 - droop * 34}z" fill="${leafC[i % leafC.length]}" transform="rotate(${a} ${cx} ${y})"/>`;
      }
      plant = `<g class="tr-sway">${p}</g>`;
    } else {
      const depth = Math.min(5, s - 1), trunk = 36 + (s - 3) * 7 + G.t * 7, w0 = 6 + (s - 3) * 2.2 + G.t * 1.8, lvl = (d) => depth - d;
      const grow = (x, y, len, ang, d, w) => {
        const x2 = x + len * Math.sin(ang), y2 = y - len * Math.cos(ang), mx = (x + x2) / 2 + (R() - 0.5) * len * 0.18, my = (y + y2) / 2;
        br.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke-width="${w.toFixed(1)}"/>`);
        if (d === 0) { tips.push([x2, y2]); return; }
        const k = d >= depth - 1 ? 2 : 2 + (R() < 0.45 ? 1 : 0), damp = Math.pow(0.82, lvl(d));
        for (let i = 0; i < k; i++) {
          const spread = (0.34 + R() * 0.26) * damp;
          let a = ang * 0.85 + (k === 2 ? (i ? spread : -spread) : (i - 1) * spread * 1.1) + (ang > 0 ? droop : ang < 0 ? -droop : 0);
          a = Math.max(-1.15, Math.min(1.15, a));
          grow(x2, y2, len * (0.72 + R() * 0.08), a, d - 1, w * 0.68);
        }
      };
      grow(cx, gy, trunk, 0, depth, w0);
      const rr = 10 + s * 1.9;
      tips.forEach(([x, y], i) => {
        const n = 3 + (s > 4 ? 2 : 0);
        for (let j = 0; j < n; j++) {
          const lx = x + (R() - 0.5) * rr * 1.5, ly = y + (R() - 0.6) * rr * 1.2 + droop * 18, r = rr * (0.55 + R() * 0.5);
          leaves.push(`<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${r.toFixed(1)}" fill="${leafC[(i + j) % leafC.length]}"/>`);
          if (s >= 6 && wilt < 2 && R() < 0.3) deco.push(`<g class="tr-flower" transform="translate(${(lx + (R() - 0.5) * r).toFixed(1)} ${(ly + (R() - 0.5) * r).toFixed(1)})">${[0, 72, 144, 216, 288].map((a) => `<circle r="2.6" cx="${(3.2 * Math.cos((a * Math.PI) / 180)).toFixed(1)}" cy="${(3.2 * Math.sin((a * Math.PI) / 180)).toFixed(1)}" fill="#ffc1dc"/>`).join("")}<circle r="1.8" fill="#ffd54a"/></g>`);
        }
      });
      if (s >= 7 && wilt < 2) {
        const nf = Math.min(16, 4 + Math.floor((g - 1000) / 50));
        for (let i = 0; i < nf; i++) { const [x, y] = tips[(i * 7) % tips.length]; deco.push(`<g class="tr-fruit"><path d="M${(x + 2).toFixed(1)} ${(y + 4).toFixed(1)} l0 5" stroke="#6b4a2b" stroke-width="1.4"/><circle cx="${(x + 2).toFixed(1)}" cy="${(y + 13).toFixed(1)}" r="5.5" fill="#ff9a3c"/><circle cx="${(x + 0.5).toFixed(1)}" cy="${(y + 11).toFixed(1)}" r="1.6" fill="#ffd2a0"/></g>`); }
      }
      plant = `<g class="tr-sway"><g class="tr-branches" stroke="url(#trBark${opts.id || ""})" fill="none" stroke-linecap="round">${br.join("")}</g><g class="tr-leaves">${leaves.join("")}</g>${deco.join("")}</g>`;
    }
    const tilled = Object.keys(G.used).some((k) => k[0] === "t"), fert = Object.keys(G.used).some((k) => k[0] === "f");
    const sky = wilt === 2 ? ["#d9d4c7", "#efe9dc"] : ["#bfe3ff", "#eef8ff"];
    return `<svg class="tr-svg ${opts.cls || ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="ต้นไม้สุขภาพ ระดับ ${STAGES[s][1]}">
      <defs><linearGradient id="trSky${opts.id || ""}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
        <linearGradient id="trBark${opts.id || ""}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a4f2c"/><stop offset=".55" stop-color="#9a6a3e"/><stop offset="1" stop-color="#6a4325"/></linearGradient>
        <radialGradient id="trSoil${opts.id || ""}" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="${tilled ? "#7b5434" : "#8d6a48"}"/><stop offset="1" stop-color="${tilled ? "#5a3a22" : "#6e5236"}"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#trSky${opts.id || ""})"/>
      ${wilt === 2 ? "" : `<g class="tr-sun"><circle cx="336" cy="62" r="26" fill="#ffd54a"/><circle cx="336" cy="62" r="38" fill="#ffd54a" opacity=".22"/></g>`}
      <g class="tr-cloud" fill="#fff" opacity=".9"><ellipse cx="80" cy="64" rx="30" ry="12"/><ellipse cx="102" cy="56" rx="20" ry="13"/><ellipse cx="60" cy="58" rx="16" ry="10"/></g>
      <path d="M0 ${gy + 6} Q 100 ${gy - 8} 200 ${gy + 2} T 400 ${gy} V ${H} H 0z" fill="${wilt === 2 ? "#b9b07a" : "#8fd07a"}"/>
      <ellipse cx="${cx}" cy="${gy + 6}" rx="78" ry="18" fill="url(#trSoil${opts.id || ""})"/>
      ${tilled ? [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${cx - 60 + i * 20} ${gy + 4} q 5 -4 10 0" stroke="#4a2f1b" stroke-width="2" fill="none" opacity=".55"/>`).join("") : ""}
      ${fert ? [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${cx - 48 + i * 19}" cy="${gy + 10 + (i % 2) * 4}" r="2.4" fill="#f4e7b5"/>`).join("") : ""}
      ${plant}
      ${wilt ? `<text x="${cx}" y="${gy + 44}" text-anchor="middle" font-size="13" font-weight="700" fill="#8a5a00">${wilt === 2 ? "ต้นไม้เหี่ยวมาก — กลับมาฝึกเพื่อรดน้ำ" : "ต้นไม้เริ่มเหี่ยว — ฝึกวันนี้เพื่อรดน้ำ"}</text>` : ""}
      <g class="tr-fx" aria-hidden="true"></g>
    </svg>`;
  }

  /* ---------- page ---------- */
  function calendar(G) {
    const today = todayISO(), wd = (new Date().getDay() + 6) % 7, start = addDays(today, -wd - 21), cells = [];
    for (let i = 0; i < 28; i++) { const d = addDays(start, i), on = G.dates.has(d), fut = d > today; cells.push(`<span class="tc ${on ? "on" : ""} ${d === today ? "today" : ""} ${fut ? "fut" : ""}" title="${thDate(d)}${on ? " · ฝึกแล้ว" : ""}">${on ? "💧" : new Date(d + "T00:00:00").getDate()}</span>`); }
    return `<div class="tcal"><div class="tcal-h">${["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((d) => `<small>${d}</small>`).join("")}</div><div class="tcal-g">${cells.join("")}</div></div>`;
  }
  function render() {
    const root = $("#treeRoot"); if (!root) return;
    const G = compute(), st = STAGES[G.si], nf = G.avail.filter((e) => e.kind === "fert"), nt = G.avail.filter((e) => e.kind === "till");
    const toNext = G.next ? G.next[0] - G.pts : 0;
    root.innerHTML = `<div class="tr-grid">
      <section class="card tr-stage">
        <div class="tr-scene" id="trScene">${treeSVG(G, { id: "Main" })}</div>
        <div class="tr-level"><span class="tr-badge">ระดับ ${G.si + 1}/8</span><h2>${st[1]}</h2><p class="lede">${G.wilt ? (G.since >= 99 ? "ยังไม่เริ่มฝึก" : `ไม่ได้ฝึกมา ${G.since} วัน ต้นไม้เริ่มเหี่ยว ฝึกวันนี้เพื่อให้กลับมาสดชื่น`) : st[2]}</p>
          <div class="tr-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(G.t * 100)}" aria-label="ความคืบหน้าสู่ระดับถัดไป"><i style="width:${Math.round(G.t * 100)}%"></i></div>
          <small>${G.next ? `อีก ${toNext} แต้ม จะเติบโตเป็น “${G.next[1]}”` : "ระดับสูงสุดแล้ว ฝึกต่อเพื่อให้ผลดกขึ้น"} · แต้มการเติบโต ${G.pts}</small></div>
      </section>
      <div class="tr-side">
        <section class="card tr-stats">
          <div><b>${G.streak}</b><small>วันต่อเนื่องตอนนี้ 🔥</small></div>
          <div><b>${G.best}</b><small>ต่อเนื่องสูงสุด</small></div>
          <div><b>${G.active}</b><small>วันที่ฝึกทั้งหมด</small></div>
          <div><b>${G.week}</b><small>วันในสัปดาห์นี้</small></div>
        </section>
        <section class="card tr-rewards"><h3>รางวัลจากผลลัพธ์ร่างกาย</h3>
          <div class="tr-acts">
            <button type="button" class="tr-act fert" data-use="fert" ${nf.length ? "" : "disabled"}><span class="ic">🌿</span><b>ใส่ปุ๋ย</b><small>มี ${nf.length} ถุง · +${FERT} แต้ม</small></button>
            <button type="button" class="tr-act till" data-use="till" ${nt.length ? "" : "disabled"}><span class="ic">⛏️</span><b>พรวนดิน</b><small>มี ${nt.length} ครั้ง · +${TILL} แต้ม</small></button>
          </div>
          <ul class="tr-earn">${G.earned.length ? G.earned.slice().reverse().map((e) => `<li class="${G.used[e.id] ? "used" : ""}"><span>${e.kind === "fert" ? "🌿" : "⛏️"}</span><span><b>${esc(e.why)}</b><small>${thDate(e.date, { day: "numeric", month: "short", year: "2-digit" })} · ${G.used[e.id] ? "ใช้แล้ว" : "พร้อมใช้"}</small></span></li>`).join("") : `<li class="none">บันทึก Body Composition ครั้งถัดไป ถ้าน้ำหนักลดจะได้ปุ๋ย 🌿 ถ้ารอบเอวลดจะได้พรวนดิน ⛏️</li>`}</ul>
          <a class="btn sm" href="#body">+ บันทึก Body Composition</a>
        </section>
      </div>
      <section class="card tr-cal"><h3>ปฏิทินรดน้ำ 4 สัปดาห์</h3>${calendar(G)}<p class="hint">💧 = วันที่ฝึกออกกำลังกาย (ต้นไม้ได้รับน้ำ)</p></section>
      <section class="card tr-how"><h3>ทำอย่างไรให้ต้นไม้โต</h3><ul>
        <li><b>💧 ฝึกออกกำลังกาย</b> วันละ +10 แต้ม (นับวันละครั้ง)</li>
        <li><b>🔥 ฝึกต่อเนื่อง</b> โบนัสเพิ่มวันละ +2 ต่อวันที่ต่อเนื่อง สูงสุด +20/วัน</li>
        <li><b>🌿 น้ำหนักลด</b> เทียบกับการบันทึกครั้งก่อน ได้ปุ๋ย 1 ถุง (+${FERT})</li>
        <li><b>⛏️ รอบเอวลด</b> ได้พรวนดิน 1 ครั้ง (+${TILL})</li>
        <li><b>🍂 หยุดฝึก 3 วันขึ้นไป</b> ต้นไม้จะเริ่มเหี่ยว (แต้มไม่หาย) กลับมาฝึกก็สดชื่นเหมือนเดิม</li></ul></section>
      <section class="card tr-log"><h3>บันทึกการเติบโต</h3><ul>${G.events.slice(0, 8).map((e) => `<li><span class="k ${e.kind}">${e.kind === "water" ? "💧" : e.kind === "fert" ? "🌿" : "⛏️"}</span><span>${esc(e.text)}<small>${thDate(e.date)}</small></span><b>+${e.pts}</b></li>`).join("") || `<li class="none">ยังไม่มีการเติบโต เริ่มฝึกวันนี้!</li>`}</ul></section>
    </div>`;
  }
  function use(kind) {
    const G = compute(), item = G.avail.find((e) => e.kind === kind); if (!item) return;
    const S = A().store, tr = S.get("tree", {}); tr.used = { ...(tr.used || {}), [item.id]: { date: todayISO(), pts: kind === "fert" ? FERT : TILL } }; S.set("tree", tr);
    const before = G.si, fx = $("#trScene .tr-fx");
    if (fx && !reduce) {
      fx.innerHTML = kind === "fert"
        ? Array.from({ length: 22 }, (_, i) => `<circle class="tr-grain" cx="${130 + (i * 37) % 140}" cy="${150 + (i * 13) % 40}" r="3" fill="#f4e7b5" stroke="#c9b27a" style="animation-delay:${(i % 8) * 70}ms"/>`).join("")
        : `<g class="tr-shovel"><path d="M150 230 l40 40" stroke="#6b4a2b" stroke-width="6" stroke-linecap="round"/><path d="M186 262 l18 4 l4 18 l-18 -4z" fill="#9aa3b2"/></g>${Array.from({ length: 14 }, (_, i) => `<circle class="tr-clod" cx="${150 + i * 7}" cy="304" r="3.5" fill="#5a3a22" style="animation-delay:${i * 40}ms"/>`).join("")}`;
    }
    setTimeout(() => {
      render(); const G2 = compute();
      const sc = $("#trScene"); if (sc && !reduce) { sc.classList.add("grow"); sc.insertAdjacentHTML("beforeend", `<span class="tr-plus">+${kind === "fert" ? FERT : TILL}</span>`); setTimeout(() => sc.classList.remove("grow"), 900); }
      A().toast(G2.si > before ? `🎉 ต้นไม้เติบโตเป็น “${STAGES[G2.si][1]}” แล้ว!` : kind === "fert" ? "ใส่ปุ๋ยแล้ว ต้นไม้โตขึ้น 🌿" : "พรวนดินแล้ว รากหายใจได้ดีขึ้น ⛏️");
      mini();
    }, reduce ? 0 : 1300);
  }
  function mini() {
    const box = $("#treeMini"); if (!box) return;
    const G = compute(), st = STAGES[G.si], n = G.avail.length;
    box.innerHTML = `<a class="card tr-mini" href="#tree" aria-label="ต้นไม้สุขภาพของฉัน ระดับ ${st[1]}">
      <span class="tr-mini-art">${treeSVG(G, { id: "Mini", cls: "mini" })}</span>
      <span class="tr-mini-b"><small>ต้นไม้สุขภาพของฉัน</small><b>${st[1]} <em>ระดับ ${G.si + 1}/8</em></b>
        <span class="tr-bar"><i style="width:${Math.round(G.t * 100)}%"></i></span>
        <span class="tr-mini-c"><span>🔥 ต่อเนื่อง ${G.streak} วัน</span>${n ? `<span class="hot">🎁 รางวัลรอใช้ ${n}</span>` : ""}${G.wilt ? `<span class="warn">🍂 เริ่มเหี่ยว</span>` : ""}</span></span>
      <span class="tr-mini-go" aria-hidden="true">→</span></a>`;
  }

  document.addEventListener("click", (e) => { const b = e.target.closest("#treeRoot [data-use]"); if (b && !b.disabled) use(b.dataset.use); });
  window.addEventListener("predm:view", (e) => { if (e.detail === "tree") render(); if (e.detail === "home") mini(); });
  window.addEventListener("predm:home", mini);
  mini(); if ($("#view-tree") && !$("#view-tree").hidden) render();
})();

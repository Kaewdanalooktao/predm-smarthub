/* Pre-DM Smart Hub — import exercise done in other apps (home page, #impRoot).
   The person picks a screenshot of a workout summary (Samsung Health, Strava, Garmin, Apple Fitness, Google Fit, …)
   or an activity file (.gpx / .tcx / .csv). Everything is read ON THIS DEVICE (bundled Tesseract for pictures) —
   nothing is uploaded. The result is shown for review and only then saved through PreDM.addLog, so it counts in
   "กิจกรรมสัปดาห์นี้" exactly like a session done in the app. Entries carry source: "import". */
(function () {
  "use strict";
  const A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const MAX_MIN = 600, MAX_ROWS = 60;

  /* ---------- pure parsers (also used by tests) ---------- */
  const KINDS = [ // first match wins
    [/ว่ายน้ำ|swim/i, "aerobic", "ว่ายน้ำ"],
    [/ปั่น|จักรยาน|cycl|bik|ride/i, "aerobic", "ปั่นจักรยาน"],
    [/เดินป่า|hik|trek/i, "aerobic", "เดินป่า"],
    [/วิ่ง|run|jog/i, "aerobic", "วิ่ง"],
    [/โยคะ|yoga|พิลาทิส|pilates|ยืด|stretch/i, "flex", "โยคะ/ยืดเหยียด"],
    [/ไทเก๊ก|ไทชิ|tai ?chi|ทรงตัว|balance/i, "balance", "ฝึกทรงตัว"],
    [/เวท|ยกน้ำหนัก|เสริมแรง|กล้ามเนื้อ|weight|strength|resistance|gym/i, "strength", "ฝึกกล้ามเนื้อ"],
    [/เต้น|แอโรบิก|danc|aerobic|zumba|ซุมบ้า/i, "aerobic", "เต้นแอโรบิก"],
    [/เครื่องเดินวงรี|elliptical|กระโดดเชือก|rope|row|กรรเชียง|hiit|cardio|คาร์ดิโอ/i, "aerobic", "คาร์ดิโอ"],
    [/เดิน|walk|ก้าว|steps?/i, "aerobic", "เดิน"],
  ];
  const APPS = [[/strava/i, "Strava"], [/garmin/i, "Garmin"], [/samsung|shealth/i, "Samsung Health"], [/google ?fit/i, "Google Fit"], [/fitbit/i, "Fitbit"], [/huawei/i, "Huawei Health"], [/zepp|mi ?fit|xiaomi/i, "Mi Fitness"], [/nike/i, "Nike Run Club"], [/apple|fitness\+?|workout summary/i, "Apple Fitness"]];
  const kindOf = (t) => KINDS.find((k) => k[0].test(t)) || null;
  const appOf = (t) => (APPS.find((a) => a[0].test(t)) || [])[1] || "";
  const clean = (t) => String(t || "").replace(/[๐-๙]/g, (d) => "๐๑๒๓๔๕๖๗๘๙".indexOf(d)).replace(/[：∶]/g, ":").replace(/ /g, " ").replace(/\r/g, "");
  const num = (s) => parseFloat(String(s).replace(/,(?=\d{3}\b)/g, "").replace(",", "."));

  // duration tokens inside one piece of text → seconds[]; pace ("6:25 /km") and clock times ("18:30 น.", "6:30 AM") are skipped
  function durTokens(s) {
    const out = [];
    s.replace(/(\d{1,2}):(\d{2}):(\d{2})(?!\s*(?:น\.|am|pm))/gi, (m, h, mi, se) => { out.push(+h * 3600 + +mi * 60 + +se); return " ".repeat(m.length); })
      .replace(/(^|[^\d:.])(\d{1,3}):([0-5]\d)(?![:\d])(?!\s*(?:\/|น\.|น\b|am|pm|a\.m|p\.m|["'’]))/gi, (m, pre, mi, se) => { out.push(+mi * 60 + +se); return m; });
    s.replace(/(\d+(?:\.\d+)?)\s*(?:ชม\.?|ชั่วโมง|hrs?|hours?|h\b)\s*(?:(\d{1,2})\s*(?:นาที|น\.|mins?|minutes?|m\b))?/gi, (m, h, mi) => { out.push(Math.round(+h * 3600) + (+mi || 0) * 60); return m; });
    s.replace(/(^|[^\d.:])(\d{1,3})\s*(?:นาที|mins?\b|minutes?)(?!\s*\/)/gi, (m, pre, mi) => { if (!/(?:ชม\.?|ชั่วโมง|hrs?|hours?|h)\s*$/i.test(s.slice(0, s.indexOf(m) + pre.length))) out.push(+mi * 60); return m; });
    s.replace(/(^|[^\d.:])(\d{1,3})\s*m(?:in)?\s*(\d{1,2})\s*s(?:ec)?\b/gi, (m, pre, mi, se) => { out.push(+mi * 60 + +se); return m; });
    return out.filter((x) => x > 0 && x <= MAX_MIN * 60);
  }
  const DUR_LABEL = /ระยะเวลา|เวลาออกกำลัง|เวลาที่ใช้|เวลาทั้งหมด|เวลาเคลื่อนไหว|เวลารวม|duration|moving time|elapsed|workout time|total time|active time|\btime\b|เวลา/i;
  const CLOCK = /เริ่ม|สิ้นสุด|เข้านอน|ตื่น|วันนี้|เมื่อวาน|\bstart|\bend\b|bed|wake|today|yesterday|\bat\b/i;
  function durationOf(text) {
    const L = text.split("\n");
    let best = 0;
    const clock = (ln) => CLOCK.test(ln) || !!dateOf(ln);
    L.forEach((ln, i) => { if (DUR_LABEL.test(ln) && !clock(ln)) durTokens(ln + (L[i + 1] && !clock(L[i + 1]) ? " \n " + L[i + 1] : "")).forEach((x) => { if (x > best) best = x; }); });
    // no label: accept h:mm:ss and worded durations anywhere, but a bare "18:05" is far more often the time of day
    if (!best) L.forEach((ln) => { if (!clock(ln)) durTokens(ln.replace(/(^|[^\d:])\d{1,3}:[0-5]\d(?![:\d])/g, "$1 ")).forEach((x) => { if (x > best) best = x; }); });
    return best;
  }
  const J = "[.\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E]{0,3}"; // dots and stray vowel/tone marks the reader inserts
  const TH_M = [["ม", "ค", "มกรา"], ["ก", "พ", "กุมภา"], ["มี", "ค", "มีนา"], ["เม", "ย", "เมษา"], ["พ", "ค", "พฤษภา"], ["มิ", "ย", "มิถุนา"], ["ก", "ค", "กรกฎา"], ["ส", "ค", "สิงหา"], ["ก", "ย", "กันยา"], ["ต", "ค", "ตุลา"], ["พ", "ย", "พฤศจิกา"], ["ธ", "ค", "ธันวา"]].map((m) => m[2] + "|" + m[0] + J + m[1] + "(?![ก-ฮ])");
  const TH_ORDER = [2, 5, 3, 0, 1, 4, 6, 7, 8, 9, 10, 11]; // "มี.ค." and "มิ.ย." before "ม.ค."
  const EN_M = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const fixYear = (y) => { y = +y; if (y < 100) y = y >= 43 ? 2500 + y : 2000 + y; return y > 2400 ? y - 543 : y; };
  function mkDate(y, m, d, now) { // m 1-12; no year → this year, or last year if that would be in the future
    m = +m; d = +d; if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    let yy = y ? fixYear(y) : now.getFullYear();
    let dt = new Date(yy, m - 1, d); if (dt.getMonth() !== m - 1) return "";
    if (!y && dt > now) dt = new Date(yy - 1, m - 1, d);
    if (dt > new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) || dt.getFullYear() < 2000) return "";
    return iso(dt);
  }
  function dateOf(text, now = new Date()) {
    let m;
    if ((m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) { const r = mkDate(m[1], m[2], m[3], now); if (r) return r; }
    if ((m = text.match(/(?:^|[^\d])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/))) { const r = mkDate(m[3], m[2], m[1], now); if (r) return r; }
    for (const i of TH_ORDER) if ((m = text.match(new RegExp("(\\d{1,2})\\s*(?:" + TH_M[i] + ")[ก-๙.]*\\s*(\\d{4}|\\d{2})?(?![\\d:])")))) { const r = mkDate(m[2], i + 1, m[1], now); if (r) return r; }
    for (let i = 0; i < 12; i++) {
      if ((m = text.match(new RegExp("(?:^|[^\\d:])(\\d{1,2})\\s+" + EN_M[i] + "[a-z]*\\.?,?\\s*(\\d{4})?", "i")))) { const r = mkDate(m[2], i + 1, m[1], now); if (r) return r; }
      if ((m = text.match(new RegExp("\\b" + EN_M[i] + "[a-z]*\\.?\\s+(\\d{1,2})(?![\\d:])(?:\\w{0,2},?\\s*(\\d{4}))?", "i")))) { const r = mkDate(m[2], i + 1, m[1], now); if (r) return r; }
    }
    if (/เมื่อวาน|yesterday/i.test(text)) return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return "";
  }
  function row(o) { // normalise one candidate
    const k = o.kind || kindOf(o.label || "") || null;
    const km = o.km > 0 && o.km < 500 ? Math.round(o.km * 100) / 100 : 0;
    const name = (o.title && o.title.trim().slice(0, 40)) || ((k ? k[2] : "ออกกำลังกาย") + (km ? ` ${km} กม.` : "") + (o.steps && !km ? ` ${o.steps.toLocaleString("en-US")} ก้าว` : ""));
    return { on: true, date: o.date || today(), type: k ? k[1] : "aerobic", name: name + (o.app ? ` (${o.app})` : ""), minutes: Math.min(MAX_MIN, Math.max(0, Math.round(o.minutes || 0))), est: o.est || "", noDate: !o.date };
  }
  // text of one workout summary (from OCR) → one row, or null when no useful number is found
  function parseText(raw, now = new Date()) {
    const t = clean(raw), flat = t.replace(/\n/g, " ");
    let m, km = 0, steps = 0;
    if ((m = flat.match(/(\d+(?:[.,]\d+)?)\s*(?:km\b|กม\.?|กิโลเมตร)(?!\s*\/)/i))) km = num(m[1]);
    else if ((m = flat.match(/(\d+(?:[.,]\d+)?)\s*(?:mi\b|miles?|ไมล์)/i))) km = num(m[1]) * 1.609;
    if ((m = flat.match(/(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:ก้าว|steps?)/i)) || (m = flat.match(/(?:จำนวนก้าว|ก้าว|steps?)\D{0,14}(\d{1,3}(?:,\d{3})+|\d{3,6})/i))) steps = Math.round(num(m[1]));
    const sec = durationOf(t);
    let minutes = sec ? Math.max(1, Math.round(sec / 60)) : 0, est = "";
    const kind = kindOf(flat);
    if (!minutes && steps >= 300) { minutes = Math.round(steps / 100); est = "ประมาณจากจำนวนก้าว (ราว 100 ก้าวต่อนาที)"; }
    else if (!minutes && km > 0) { const sp = kind && /ปั่น/.test(kind[2]) ? 4 : kind && /วิ่ง/.test(kind[2]) ? 7 : 12; minutes = Math.round(km * sp); est = "ประมาณจากระยะทาง"; }
    if (!minutes) return null;
    return row({ kind, km, steps, minutes, est, date: dateOf(t, now), app: appOf(flat) });
  }

  function csvRows(text) {
    const out = []; let cur = [], f = "", q = false;
    const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : (text.split("\n")[0].includes("\t") && !text.split("\n")[0].includes(",") ? "\t" : ",");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === sep) { cur.push(f); f = ""; }
      else if (c === "\n") { cur.push(f); out.push(cur); cur = []; f = ""; }
      else if (c !== "\r") f += c;
    }
    if (f || cur.length) { cur.push(f); out.push(cur); }
    return out.filter((r) => r.some((x) => x.trim()));
  }
  function anyDate(s, now) {
    const t = clean(s); const d = dateOf(t, now); if (d) return d;
    const p = Date.parse(t); if (!isNaN(p)) { const dt = new Date(p); if (dt.getFullYear() >= 2000 && dt <= new Date(now.getTime() + 864e5)) return iso(dt); }
    return "";
  }
  function parseCSV(text, now = new Date()) {
    let R = csvRows(clean(text).replace(/^﻿/, "")); if (R.length < 2) return [];
    if (R[0].length < 3 && R[1].length > R[0].length) R = R.slice(1); // Samsung Health puts a title line first
    const H = R[0].map((h) => h.trim().toLowerCase());
    const col = (...res) => { for (const re of res) { const i = H.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
    const cD = col(/activity date|start[ _]?time|^date$|วันที่|เวลาเริ่ม/, /date|time/), cT = col(/activity type|exercise[ _]?type|sport|ประเภท|^type$/, /type|กิจกรรม|^activity$/), cN = col(/activity name|title|^name$|ชื่อ/);
    const cU = col(/moving[ _]?time/, /elapsed[ _]?time/, /duration|ระยะเวลา|นาที|minutes/, /^time$|เวลา/), cK = col(/distance|ระยะทาง/);
    if (cU < 0) return [];
    const out = [];
    R.slice(1).forEach((r) => {
      const v = (r[cU] || "").trim(); if (!v) return;
      let sec;
      if (v.includes(":")) sec = durTokens(v)[0] || 0;
      else { const n = num(v); if (isNaN(n)) return; sec = /min|นาที/.test(H[cU]) ? n * 60 : n >= 100000 ? n / 1000 : n >= 300 ? n : n * 60; }
      const minutes = Math.round(sec / 60); if (minutes < 1 || minutes > MAX_MIN) return;
      const label = ((cT >= 0 ? r[cT] : "") + " " + (cN >= 0 ? r[cN] : "")).trim();
      let km = cK >= 0 ? num(r[cK]) : 0; if (km > 300) km = km / 1000; // metres
      out.push(row({ label, title: cN >= 0 && !kindOf(label) ? r[cN] : "", km: km || 0, minutes, date: cD >= 0 ? anyDate(r[cD], now) : "" }));
    });
    return out;
  }
  function parseXML(text, now = new Date()) { // .gpx / .tcx
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return [];
    const out = [], T = (n, s) => n.getElementsByTagName(s), txt = (n, s) => (T(n, s)[0]?.textContent || "").trim();
    for (const a of T(doc, "Activity")) { // TCX
      let sec = 0, m = 0; for (const l of T(a, "Lap")) { sec += parseFloat(txt(l, "TotalTimeSeconds")) || 0; m += parseFloat(txt(l, "DistanceMeters")) || 0; }
      if (sec >= 30) out.push(row({ label: a.getAttribute("Sport") || "", km: m / 1000, minutes: sec / 60, date: anyDate(txt(a, "Id"), now) }));
    }
    for (const k of T(doc, "trk")) { // GPX
      const P = [...T(k, "trkpt")]; const times = P.map((p) => Date.parse(txt(p, "time"))).filter((x) => !isNaN(x)); if (times.length < 2) continue;
      let m = 0; for (let i = 1; i < P.length; i++) { const a = [+P[i - 1].getAttribute("lat"), +P[i - 1].getAttribute("lon")], b = [+P[i].getAttribute("lat"), +P[i].getAttribute("lon")], r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; m += 12742000 * Math.asin(Math.sqrt(x)); }
      const sec = (Math.max(...times) - Math.min(...times)) / 1000; if (sec < 30) continue;
      out.push(row({ label: txt(k, "type") + " " + txt(k, "name"), km: m / 1000, minutes: sec / 60, date: iso(new Date(Math.min(...times))) }));
    }
    return out;
  }

  /* ---------- reading a file ---------- */
  const S = { open: false, busy: false, pct: 0, status: "", rows: [], msg: "", bad: false, thumb: "", raw: "" };
  let tessLoading = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tessLoading) tessLoading = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/tesseract/tesseract.min.js"; sc.onload = res; sc.onerror = () => { tessLoading = null; rej(new Error("โหลดตัวอ่านข้อความไม่สำเร็จ ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่")); }; document.head.appendChild(sc); });
    return tessLoading;
  }
  // bigger, grey, and dark-mode screenshots turned to dark-on-light: this roughly doubles what the reader gets right
  async function prep(file) {
    const bmp = await createImageBitmap(file); const k = bmp.width < 900 ? 1200 / bmp.width : bmp.width > 1600 ? 1600 / bmp.width : 1, w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
    const im = g.getImageData(0, 0, w, h), d = im.data; let sum = 0;
    for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10; d[i] = d[i + 1] = d[i + 2] = y; sum += y; }
    if (sum / (d.length / 4) < 115) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    g.putImageData(im, 0, 0); return c;
  }
  const progress = (pct, status) => { S.pct = pct; S.status = status; const b = $("#impBar"), s = $("#impStatus"); if (b) b.style.width = pct + "%"; if (s) s.textContent = status; };
  async function readFile(file) {
    if (!file || S.busy) return;
    const name = (file.name || "").toLowerCase(), isImg = (file.type || "").startsWith("image/");
    Object.assign(S, { busy: true, rows: [], msg: "", bad: false, raw: "", pct: 4, status: "กำลังเปิดไฟล์…" });
    if (S.thumb) URL.revokeObjectURL(S.thumb); S.thumb = isImg ? URL.createObjectURL(file) : "";
    render();
    try {
      let rows = [];
      if (isImg) {
        progress(6, "กำลังโหลดตัวอ่านข้อความ (ครั้งแรกอาจใช้เวลาสักครู่)…");
        await loadTesseract();
        let src; try { src = await prep(file); } catch { src = S.thumb; }
        // two passes: "auto" layout keeps the big headline numbers, "single block" reads small Thai labels better — the parser gets both
        let pass = 0;
        const w = await window.Tesseract.createWorker("tha+eng", 1, { workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href, corePath: new URL("vendor/tesseract/core", location.href).href, langPath: new URL("vendor/tesseract/lang", location.href).href, logger: (m) => { if (m.status === "recognizing text") progress(Math.round(10 + (pass + m.progress) * 45), `กำลังอ่านผลจากรูป ${Math.round((pass + m.progress) * 50)}%`); } });
        try {
          const parts = [];
          for (const psm of ["3", "6"]) { await w.setParameters({ tessedit_pageseg_mode: psm }); parts.push(((await w.recognize(src)).data.text || "").trim()); pass++; }
          S.raw = parts.join("\n\n");
        } finally { w.terminate(); }
        const r = parseText(S.raw); if (r) rows = [r];
      } else if (/\.(gpx|tcx)$/.test(name)) rows = parseXML(await file.text());
      else if (/\.(csv|tsv|txt)$/.test(name) || /csv|text/.test(file.type || "")) rows = parseCSV(await file.text());
      else if (/\.fit$/.test(name)) throw new Error("ยังอ่านไฟล์ .fit ไม่ได้ค่ะ ลองส่งออกเป็น .gpx / .tcx หรือใช้รูปแคปหน้าจอสรุปผลแทนนะคะ");
      else throw new Error("ไฟล์ชนิดนี้ยังอ่านไม่ได้ค่ะ ใช้ได้กับรูปแคปหน้าจอ และไฟล์ .gpx .tcx .csv");
      rows.sort((a, b) => (a.date < b.date ? 1 : -1));
      const lim = iso(new Date(Date.now() - 30 * 864e5));
      if (rows.length > 1) rows.forEach((r) => { r.on = r.date >= lim; });
      const more = rows.length > MAX_ROWS ? rows.length - MAX_ROWS : 0; S.rows = rows.slice(0, MAX_ROWS);
      if (!S.rows.length) { S.rows = [row({ minutes: 0 })]; S.rows[0].noDate = false; S.bad = true; S.msg = isImg ? "น้องอ่านเวลาออกกำลังกายจากรูปนี้ไม่ออกค่ะ กรอกเองในช่องด้านล่างได้เลย หรือลองรูปที่เห็นตัวเลขชัดขึ้นนะคะ" : "ไม่พบรายการออกกำลังกายในไฟล์นี้ค่ะ กรอกเองในช่องด้านล่างได้เลยนะคะ"; }
      else S.msg = `อ่านได้ ${S.rows.length} รายการ${more ? ` (แสดง ${MAX_ROWS} รายการล่าสุด)` : ""} · ตรวจและแก้ไขได้ก่อนกดบันทึกนะคะ`;
    } catch (e) { S.bad = true; S.msg = e.message || "อ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"; }
    S.busy = false; render();
  }

  /* ---------- UI ---------- */
  const TYPES = [["aerobic", "แอโรบิก (เดิน วิ่ง ปั่น ว่ายน้ำ)"], ["strength", "เสริมแรงกล้ามเนื้อ"], ["flex", "ยืดเหยียด / โยคะ"], ["balance", "ทรงตัว"]];
  function rowHtml(r, i) {
    return `<div class="imp-row${r.on ? "" : " off"}" data-row="${i}">
      <label class="imp-on"><input type="checkbox" data-i="${i}" data-f="on" ${r.on ? "checked" : ""} aria-label="เลือกรายการที่ ${i + 1}"></label>
      <label>วันที่<input type="date" data-i="${i}" data-f="date" value="${esc(r.date)}" max="${today()}"></label>
      <label>ประเภท<select data-i="${i}" data-f="type">${TYPES.map((t) => `<option value="${t[0]}" ${t[0] === r.type ? "selected" : ""}>${t[1]}</option>`).join("")}</select></label>
      <label>กิจกรรม<input type="text" data-i="${i}" data-f="name" value="${esc(r.name)}" maxlength="60"></label>
      <label>นาที<input type="number" inputmode="numeric" min="1" max="${MAX_MIN}" data-i="${i}" data-f="minutes" value="${r.minutes || ""}" placeholder="เช่น 30"></label>
      ${r.est || r.noDate ? `<p class="imp-flag">${r.est ? "⚠️ " + esc(r.est) + " กรุณาตรวจจำนวนนาที" : ""}${r.est && r.noDate ? " · " : ""}${r.noDate ? "📅 ไม่พบวันที่ จึงใส่เป็นวันนี้ แก้ได้ค่ะ" : ""}</p>` : ""}
    </div>`;
  }
  function render() {
    const el = $("#impRoot"); if (!el) return;
    const head = `<div class="card-head"><div><h2 id="impH">นำเข้าการออกกำลังกายจากแอปอื่น</h2><p>เดิน วิ่ง ปั่น จาก Samsung Health, Strava, Garmin, Apple Fitness ฯลฯ นับรวมในกิจกรรมสัปดาห์นี้</p></div>
      <button type="button" class="btn sm ${S.open ? "" : "primary"}" data-imp="toggle" aria-expanded="${S.open}">${S.open ? "ปิด" : "📥 อัปโหลดผลจากแอปอื่น"}</button></div>`;
    if (!S.open) { el.innerHTML = `<section class="card imp-card" aria-labelledby="impH">${head}</section>`; return; }
    const sel = S.rows.filter((r) => r.on), tot = sel.reduce((a, r) => a + (r.type === "aerobic" ? +r.minutes || 0 : 0), 0);
    el.innerHTML = `<section class="card imp-card" aria-labelledby="impH">${head}
      <label class="tf-drop imp-drop${S.thumb ? " has" : ""}" id="impDrop" for="impFile">
        ${S.thumb ? `<img src="${S.thumb}" alt="รูปที่เลือก">` : `<span><b>📷 แตะเพื่อเลือกรูปแคปหน้าจอ หรือไฟล์จากแอปอื่น</b><small>รูปสรุปผลการออกกำลังกาย (เห็นเวลา ระยะทาง หรือจำนวนก้าว) · หรือไฟล์ .gpx .tcx .csv</small></span>`}
        <input type="file" id="impFile" accept="image/*,.gpx,.tcx,.csv,.tsv,.txt" ${S.busy ? "disabled" : ""}>
      </label>
      <p class="hint">🛡️ รูปและไฟล์ถูกอ่านในเครื่องนี้เท่านั้น ไม่ถูกส่งออกไปที่ใด และไม่ถูกเก็บไว้</p>
      ${S.busy ? `<div class="ocr-prog"><div><span id="impBar" style="width:${S.pct}%"></span></div><small id="impStatus" role="status">${esc(S.status)}</small></div>` : ""}
      ${S.msg ? `<p class="ocr-note ${S.bad ? "bad" : "ok"}" role="status">${esc(S.msg)}</p>` : ""}
      ${S.rows.length && !S.busy ? `<div class="imp-rows">${S.rows.map(rowHtml).join("")}</div>
        <p class="hint" id="impSum">${sumText(sel.length, tot)}</p>
        <div class="imp-acts"><button type="button" class="btn primary" data-imp="save">บันทึกรวมกับกิจกรรมของฉัน</button><button type="button" class="btn sm" data-imp="add">+ เพิ่มรายการเอง</button><button type="button" class="btn sm" data-imp="clear">ล้าง</button></div>` : ""}
      ${!S.rows.length && !S.busy ? `<div class="imp-acts"><button type="button" class="btn sm" data-imp="add">✏️ กรอกเองโดยไม่ใช้รูป</button></div>` : ""}
      ${S.raw && !S.busy ? `<details class="imp-raw"><summary>ดูข้อความที่อ่านได้จากรูป</summary><pre>${esc(S.raw.slice(0, 1500))}</pre></details>` : ""}
    </section>`;
  }
  const sumText = (n, tot) => n ? `เลือก ${n} รายการ · แอโรบิกรวม ${tot} นาที (เป้าหมาย 150 นาทีต่อสัปดาห์) · ประเภทอื่นนับเป็นจำนวนวันที่ฝึก` : "ยังไม่ได้เลือกรายการ";
  function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
  function save() {
    const P = A(), sel = S.rows.filter((r) => r.on);
    if (!sel.length) return P.toast("ยังไม่ได้เลือกรายการค่ะ");
    const t = today();
    for (const r of sel) {
      const m = Math.round(+r.minutes);
      if (!(m >= 1 && m <= MAX_MIN)) return P.toast(`กรุณาใส่จำนวนนาที 1–${MAX_MIN} ให้ครบทุกรายการที่เลือก`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || r.date > t) return P.toast("กรุณาตรวจวันที่ (ต้องไม่เป็นวันในอนาคต)");
    }
    const logs = P.store.get("logs", []), key = (l) => `${l.date}|${l.type}|${l.minutes}|${l.name}`, have = new Set(logs.map(key));
    let n = 0, dup = 0, wk = 0; const ws = weekStart();
    sel.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((r) => {
      const e = { date: r.date, type: r.type, name: (r.name || "").trim().slice(0, 60) || "ออกกำลังกาย (นำเข้า)", minutes: Math.round(+r.minutes), source: "import" };
      if (have.has(key(e))) { dup++; return; }
      have.add(key(e)); P.addLog(e); n++; if (e.type === "aerobic" && e.date >= ws) wk += e.minutes;
    });
    if (S.thumb) URL.revokeObjectURL(S.thumb);
    Object.assign(S, { rows: [], thumb: "", raw: "", bad: !n, msg: n ? `บันทึกแล้ว ${n} รายการ${wk ? ` · เพิ่มแอโรบิกสัปดาห์นี้ ${wk} นาที` : ""}${dup ? ` · ข้าม ${dup} รายการที่เคยบันทึกแล้ว` : ""} เก่งมากค่ะ 🎉` : "รายการนี้เคยบันทึกไว้แล้วค่ะ จึงไม่ได้เพิ่มซ้ำ" });
    render(); if (n) P.toast(`นำเข้า ${n} รายการแล้ว`);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-imp]"); if (!b) return; const k = b.dataset.imp;
    if (k === "toggle") { S.open = !S.open; render(); if (S.open) $("#impRoot").scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    if (k === "add") { const r = row({ minutes: 0 }); r.noDate = false; S.rows.push(r); if (S.bad) { S.msg = ""; S.bad = false; } render(); const inp = $(`.imp-row[data-row="${S.rows.length - 1}"] [data-f="minutes"]`); if (inp) inp.focus(); }
    if (k === "clear") { if (S.thumb) URL.revokeObjectURL(S.thumb); Object.assign(S, { rows: [], msg: "", bad: false, thumb: "", raw: "" }); render(); }
    if (k === "save") save();
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "impFile") { const f = t.files && t.files[0]; t.value = ""; return readFile(f); }
    const f = t.dataset?.f, r = S.rows[+t.dataset?.i]; if (!f || !r || !t.closest("#impRoot")) return;
    if (f === "on") { r.on = t.checked; t.closest(".imp-row").classList.toggle("off", !r.on); }
    else if (f === "minutes") r.minutes = Math.round(+t.value) || 0;
    else r[f] = t.value;
    const sel = S.rows.filter((x) => x.on), s = $("#impSum"); if (s) s.textContent = sumText(sel.length, sel.reduce((a, x) => a + (x.type === "aerobic" ? +x.minutes || 0 : 0), 0));
  });
  document.addEventListener("input", (e) => { const t = e.target; if (t.dataset?.f === "minutes" && t.closest("#impRoot") && S.rows[+t.dataset.i]) S.rows[+t.dataset.i].minutes = Math.round(+t.value) || 0; });
  ["dragover", "dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => {
    const d = e.target.closest?.("#impDrop"); if (!d) return; e.preventDefault(); d.classList.toggle("over", ev === "dragover");
    if (ev === "drop") readFile(e.dataTransfer?.files?.[0]);
  }));
  window.addEventListener("predm:view", (e) => { if (e.detail === "home") render(); });
  if (document.querySelector("#view-home:not([hidden])")) setTimeout(render, 0);
  window.PreDMImport = { parseText, parseCSV, parseXML, dateOf, durationOf, open: () => { S.open = true; render(); } };
})();

/* Pre-DM Smart Hub — game narration with real human voice clips ("ชุดเสียงพากย์").
   Every fixed game phrase has an id. If a recorded clip exists it is played; otherwise the device's best Thai voice reads the text.
   Clips come from (1) vendor/voice/voicepack.json shipped with the site (same voice for everyone) and
   (2) recordings made on this device in "สตูดิโออัดเสียงพากย์" (kept in this browser, can be exported to make the site pack).
   Recording uses the microphone on this device only; nothing is uploaded. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PHRASES = [ // [id, text, group]
    ["n1", "หนึ่ง", "ตัวเลขนับ"], ["n2", "สอง", "ตัวเลขนับ"], ["n3", "สาม", "ตัวเลขนับ"], ["n4", "สี่", "ตัวเลขนับ"], ["n5", "ห้า", "ตัวเลขนับ"],
    ["n6", "หก", "ตัวเลขนับ"], ["n7", "เจ็ด", "ตัวเลขนับ"], ["n8", "แปด", "ตัวเลขนับ"], ["n9", "เก้า", "ตัวเลขนับ"], ["n10", "สิบ", "ตัวเลขนับ"],
    ["n15", "สิบห้า", "ตัวเลขนับ"], ["n20", "ยี่สิบ", "ตัวเลขนับ"], ["n25", "ยี่สิบห้า", "ตัวเลขนับ"], ["n30", "สามสิบ", "ตัวเลขนับ"],
    ["ready", "เตรียมตัวนะคะ", "เริ่ม-จบ"], ["go", "เริ่มเลยค่ะ!", "เริ่ม-จบ"], ["timeup", "หมดเวลาแล้วค่ะ", "เริ่ม-จบ"], ["gameover", "จบเกมแล้ว เก่งมากค่ะ", "เริ่ม-จบ"],
    ["record", "สถิติใหม่! เยี่ยมไปเลยค่ะ", "เริ่ม-จบ"], ["goal", "ครบเป้าหมายแล้ว เก่งมากค่ะ", "เริ่ม-จบ"], ["retry", "ไม่เป็นไรนะคะ ลองใหม่อีกครั้ง", "เริ่ม-จบ"],
    ["cheer1", "เก่งมากค่ะ", "เชียร์"], ["cheer2", "ดีมากค่ะ ทำต่อเลย", "เชียร์"], ["cheer3", "สุดยอดเลยค่ะ", "เชียร์"], ["cheer4", "อีกนิดเดียวค่ะ สู้ ๆ", "เชียร์"], ["combo", "คอมโบ! เก่งมากค่ะ", "เชียร์"],
    ["ar_mode", "เลือกโหมดออกกำลังกายได้เลยค่ะ", "AR ออกกำลังกาย"], ["ar_ex", "อยากฝึกท่าไหน ชี้เลยค่ะ", "AR ออกกำลังกาย"], ["ar_target", "ตั้งเป้าหมายกันค่ะ", "AR ออกกำลังกาย"],
    ["ar_body", "ถอยออกไปอีกนิด ให้กล้องเห็นทั้งตัวนะคะ", "AR ออกกำลังกาย"], ["ar_stop", "พักก่อนได้ค่ะ", "AR ออกกำลังกาย"],
    ["mk_menu", "เย็นนี้จะทำอะไรกินดีคะ", "ตลาดแตะมือ"], ["mk_go", "ไปตลาดกันค่ะ", "ตลาดแตะมือ"], ["mk_done", "ของครบตามรายการแล้วค่ะ", "ตลาดแตะมือ"],
    ["mk_bad", "ระวังนะคะ ของชิ้นนี้ไม่ค่อยดีต่อสุขภาพ", "ตลาดแตะมือ"], ["mk_money", "เงินไม่พอค่ะ", "ตลาดแตะมือ"], ["mk_pay", "จ่ายเงินกันค่ะ", "ตลาดแตะมือ"],
    ["pl_rice", "เลือกข้าวหนึ่งอย่างค่ะ", "จัดพาข้าว"], ["pl_pro", "เลือกกับข้าวโปรตีนหนึ่งอย่างค่ะ", "จัดพาข้าว"], ["pl_veg", "เลือกผักสองอย่างนะคะ", "จัดพาข้าว"],
    ["pl_drink", "เลือกเครื่องดื่มค่ะ", "จัดพาข้าว"], ["pl_serve", "เสิร์ฟพาข้าวได้เลยค่ะ", "จัดพาข้าว"],
    ["st_pick", "วันนี้ตำอะไรดีคะ เลือกได้เลยค่ะ", "ตำส้มตำ"], ["st_pound", "ตำเลยค่ะ ยกมือขึ้น ลง แรง ๆ", "ตำส้มตำ"], ["st_done", "ส้มตำเสร็จแล้ว น่ากินมากค่ะ", "ตำส้มตำ"],
    ["nd_open", "ร้านก๋วยเตี๋ยวเปิดแล้วค่ะ ลูกค้ามาแล้ว", "ร้านก๋วยเตี๋ยว"], ["nd_next", "ลูกค้าคนต่อไปมาแล้วค่ะ", "ร้านก๋วยเตี๋ยว"],
    ["nd_happy", "ลูกค้าชอบมากเลยค่ะ", "ร้านก๋วยเตี๋ยว"], ["nd_sad", "ลูกค้ายังไม่ค่อยพอใจนะคะ ลองปรุงใหม่", "ร้านก๋วยเตี๋ยว"],
  ];
  const BY_ID = Object.fromEntries(PHRASES.map((p) => [p[0], p]));
  const BY_TEXT = Object.fromEntries(PHRASES.map((p) => [p[1], p[0]]));
  // free text from older code → closest recorded phrase
  const RULES = [[/^(\d+)$/, (m) => ({ 1: "n1", 2: "n2", 3: "n3", 4: "n4", 5: "n5", 6: "n6", 7: "n7", 8: "n8", 9: "n9", 10: "n10", 15: "n15", 20: "n20", 25: "n25", 30: "n30" })[+m[1]]],
    [/สถิติใหม่/, () => "record"], [/จบเกม/, () => "gameover"], [/ครบเป้าหมาย/, () => "goal"], [/เตรียมตัว/, () => "ready"], [/^เริ่ม$/, () => "go"], [/หมดเวลา/, () => "timeup"]];

  /* ---------------- clip storage ---------------- */
  const CLIPS = {}; // id -> {url, src: "site"|"local"}
  let db = null;
  function idb() {
    if (db) return db;
    db = new Promise((res, rej) => { const r = indexedDB.open("predm-voice", 1); r.onupgradeneeded = () => r.result.createObjectStore("clips"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return db;
  }
  async function idbAll() { try { const d = await idb(); return await new Promise((res) => { const out = {}; const tx = d.transaction("clips"); const st = tx.objectStore("clips"); const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); }; c.onerror = () => res(out); }); } catch { return {}; } }
  async function idbPut(id, blob) { const d = await idb(); await new Promise((res, rej) => { const tx = d.transaction("clips", "readwrite"); tx.objectStore("clips").put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function idbDel(id) { const d = await idb(); await new Promise((res) => { const tx = d.transaction("clips", "readwrite"); tx.objectStore("clips").delete(id); tx.oncomplete = res; tx.onerror = res; }); }
  const b64ToBlob = (b64, type) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type }); };
  const blobToB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
  function setClip(id, blob, src) { if (CLIPS[id]?.url) URL.revokeObjectURL(CLIPS[id].url); CLIPS[id] = { url: URL.createObjectURL(blob), src, blob }; }
  async function load() {
    try { const r = await fetch("vendor/voice/voicepack.json", { cache: "no-cache" }); if (r.ok) { const j = await r.json(); Object.entries(j.clips || {}).forEach(([id, c]) => setClip(id, b64ToBlob(c.data, c.type), "site")); } } catch { /* no site pack yet */ }
    const local = await idbAll(); Object.entries(local).forEach(([id, blob]) => setClip(id, blob, "local"));
  }
  const ready = load();

  /* ---------------- playback ---------------- */
  let cur = null;
  function playId(id) {
    const c = CLIPS[id]; if (!c) return false;
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); cur?.pause(); cur = new Audio(c.url); cur.play().catch(() => {}); return true; } catch { return false; }
  }
  const resolve = (t) => { if (BY_ID[t]) return t; if (BY_TEXT[t]) return BY_TEXT[t]; for (const [re, f] of RULES) { const m = String(t).match(re); if (m) { const id = f(m); if (id) return id; } } return null; };
  // called by app.js speak(): true when a human clip was played
  function play(text) { const id = resolve(text); return id ? playId(id) : false; }
  // most natural Thai voice available on this device (premium / enhanced / neural first)
  let best = null;
  function bestVoice() {
    if (best) return best;
    const vs = ("speechSynthesis" in window ? speechSynthesis.getVoices() : []).filter((v) => v.lang && v.lang.toLowerCase().startsWith("th"));
    const score = (v) => (/premium|enhanced|natural|neural/i.test(v.name) ? 4 : 0) + (/kanya|narisa|premwadee|achara/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
    best = vs.sort((a, b) => score(b) - score(a))[0] || null; return best;
  }
  if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => { best = null; };
  const VKEY = "predm.v1.vrVoice";
  const on = () => { try { return localStorage.getItem(VKEY) !== "off"; } catch { return true; } };
  // games call this with a phrase id (or text): human clip if recorded, else the device voice
  function say(idOrText) {
    if (!on()) return;
    const id = resolve(idOrText); if (id && playId(id)) return;
    const text = BY_ID[idOrText]?.[1] || idOrText;
    if (window.PreDM?.speak) window.PreDM.speak(text, { force: true });
  }
  function toggle() { const v = !on(); try { localStorage.setItem(VKEY, v ? "on" : "off"); } catch { /* ignore */ } paintToggle(); window.PreDM?.toast?.(v ? "เปิดเสียงพากย์" : "ปิดเสียงพากย์"); }
  function paintToggle() { document.querySelectorAll("[data-voice]").forEach((b) => { b.textContent = on() ? "🗣️" : "🤐"; b.title = on() ? "ปิดเสียงพากย์" : "เปิดเสียงพากย์"; b.setAttribute("aria-pressed", String(on())); }); }

  /* ---------------- recording studio ---------------- */
  let rec = null;
  function studio() {
    if (!$("#vsModal")) {
      document.body.insertAdjacentHTML("beforeend", `<div class="fq-modal" id="vsModal" role="dialog" aria-modal="true" aria-labelledby="vsTitle" hidden><div class="fq-box vs-box"><div class="fq-head"><span class="fq-av">🎙️</span><div><h2 id="vsTitle">สตูดิโออัดเสียงพากย์เกม</h2><small>ใช้เสียงคนจริงแทนเสียงอ่านอัตโนมัติ</small></div><button type="button" class="care-x" data-vs="close" aria-label="ปิด">✕</button></div><div id="vsBody"></div></div></div>`);
      $("#vsModal").addEventListener("click", onStudio);
      $("#vsModal").addEventListener("change", onImport);
    }
    $("#vsModal").hidden = false; document.body.classList.add("care-open"); draw();
  }
  function draw() {
    const groups = [...new Set(PHRASES.map((p) => p[2]))], done = PHRASES.filter((p) => CLIPS[p[0]]).length;
    $("#vsBody").innerHTML = `
      <p class="vs-intro">กด ⏺ แล้วพูดประโยคด้วยน้ำเสียงเป็นธรรมชาติ อบอุ่น เหมือนคุยกับผู้สูงอายุ (พูดจบแล้วกด ⏹ หรือรอ 6 วินาที) เสียงเก็บในเครื่องนี้เท่านั้น
      ถ้าต้องการให้ทุกคนได้ยินเสียงนี้ ให้กด “ส่งออกชุดเสียง” แล้วนำไฟล์ไปวางที่ <code>vendor/voice/voicepack.json</code> ของเว็บไซต์</p>
      <div class="vs-bar"><b>อัดแล้ว ${done} / ${PHRASES.length} ประโยค</b><i><em style="width:${(100 * done) / PHRASES.length}%"></em></i></div>
      <div class="vs-list">${groups.map((g) => `<h3>${esc(g)}</h3>${PHRASES.filter((p) => p[2] === g).map(([id, text]) => `<div class="vs-row${CLIPS[id] ? " has" : ""}${rec?.id === id ? " rec" : ""}"><span class="vs-t">${esc(text)}</span><small>${CLIPS[id] ? (CLIPS[id].src === "site" ? "เสียงของเว็บไซต์" : "อัดในเครื่องนี้") : "ยังไม่ได้อัด (ใช้เสียงอ่านอัตโนมัติ)"}</small>
        <button type="button" class="vs-b" data-vsplay="${id}" aria-label="ฟัง ${esc(text)}">▶</button><button type="button" class="vs-b rec" data-vsrec="${id}" aria-label="อัด ${esc(text)}">${rec?.id === id ? "⏹" : "⏺"}</button>${CLIPS[id]?.src === "local" ? `<button type="button" class="vs-b" data-vsdel="${id}" aria-label="ลบเสียง ${esc(text)}">🗑</button>` : ""}</div>`).join("")}`).join("")}</div>
      <div class="care-foot"><label class="btn">📂 นำเข้าชุดเสียง<input type="file" accept="application/json,.json" id="vsImport" hidden></label><button type="button" class="btn primary" data-vs="export" ${done ? "" : "disabled"}>💾 ส่งออกชุดเสียง</button></div>`;
  }
  async function startRec(id) {
    if (rec) { stopRec(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" }); if (blob.size > 800) { await idbPut(id, blob); setClip(id, blob, "local"); playId(id); } rec = null; draw(); };
      rec = { id, mr, timer: setTimeout(stopRec, 6000) }; mr.start(); draw();
    } catch (err) { window.PreDM?.toast?.("เปิดไมโครโฟนไม่ได้: " + (err.name === "NotAllowedError" ? "ไม่ได้อนุญาตไมโครโฟน" : err.message || err)); rec = null; draw(); }
  }
  function stopRec() { if (!rec) return; clearTimeout(rec.timer); try { rec.mr.stop(); } catch { rec = null; draw(); } }
  async function exportPack() {
    const clips = {};
    for (const [id, c] of Object.entries(CLIPS)) clips[id] = { type: c.blob.type || "audio/webm", data: await blobToB64(c.blob), text: BY_ID[id]?.[1] || "" };
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, made: new Date().toISOString(), clips })], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "voicepack.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function onImport(e) {
    if (e.target.id !== "vsImport" || !e.target.files[0]) return;
    try { const j = JSON.parse(await e.target.files[0].text()); let n = 0; for (const [id, c] of Object.entries(j.clips || {})) { if (!BY_ID[id]) continue; const blob = b64ToBlob(c.data, c.type); await idbPut(id, blob); setClip(id, blob, "local"); n++; } window.PreDM?.toast?.(`นำเข้าเสียง ${n} ประโยคแล้ว`); }
    catch { window.PreDM?.toast?.("ไฟล์ชุดเสียงไม่ถูกต้อง"); }
    draw();
  }
  function onStudio(e) {
    const t = (s) => e.target.closest(s);
    if (e.target.id === "vsModal" || t("[data-vs=close]")) { stopRec(); $("#vsModal").hidden = true; document.body.classList.remove("care-open"); return; }
    if (t("[data-vs=export]")) return exportPack();
    if (t("[data-vsplay]")) { const id = t("[data-vsplay]").dataset.vsplay; if (!playId(id)) window.PreDM?.speak?.(BY_ID[id][1], { force: true }); return; }
    if (t("[data-vsrec]")) return startRec(t("[data-vsrec]").dataset.vsrec);
    if (t("[data-vsdel]")) { const id = t("[data-vsdel]").dataset.vsdel; idbDel(id).then(() => { if (CLIPS[id]?.url) URL.revokeObjectURL(CLIPS[id].url); delete CLIPS[id]; load().then(draw); }); }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-voicestudio]")) { e.preventDefault(); studio(); }
    if (e.target.closest("[data-voice]")) { e.preventDefault(); e.stopPropagation(); toggle(); }
  }, true);
  let pend = 0; new MutationObserver(() => { if (!pend) pend = requestAnimationFrame(() => { pend = 0; paintToggle(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  window.PreDMVoice = { say, play, bestVoice, studio, phrases: PHRASES, ready, get on() { return on(); } };
})();

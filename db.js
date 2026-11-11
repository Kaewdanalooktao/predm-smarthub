/* Pre-DM Smart Hub — Supabase connection: real accounts, cloud sync of the app's store, prescriptions, usage events.
   Works offline-first: the app keeps writing to localStorage; changes are pushed to Supabase when online.
   If no anon key is configured, this file only shows "local mode" and does nothing else. */
(function () {
  "use strict";
  const CFG = window.PREDM_CONFIG || {}, A = () => window.PreDM;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const KEY = "predm.v1.";
  // keys mirrored to the cloud (never secrets such as geminiKey, never session/admin state)
  const SYNC = ["profile", "riskInput", "riskHistory", "logs", "body", "fitness", "food", "tree", "certs", "myPrograms", "consults", "prefs", "bestScores", "bestScore", "showHands", "avatar", "memberSince", "parq", "reminders", "evalpp", "consent", "drinks", "mood", "missions", "missionDays", "labs", "labPlan"];
  const raw = { get: (k) => localStorage.getItem(KEY + k), set: (k, v) => localStorage.setItem(KEY + k, v), del: (k) => localStorage.removeItem(KEY + k) };
  const D = { sb: null, user: null, ready: false, pending: new Set(), timer: null, state: "local" };

  function setStatus(state, text) {
    D.state = state; const n = $(".nav-note"); if (!n) return;
    const T = { local: "💾 เก็บข้อมูลในเครื่องนี้", sync: "☁️ กำลังซิงก์…", ok: "☁️ ซิงก์กับฐานข้อมูลแล้ว", off: "📴 ออฟไลน์ · จะซิงก์เมื่อมีเน็ต", err: "⚠️ ซิงก์ไม่สำเร็จ จะลองใหม่" };
    n.textContent = text || T[state] || ""; n.dataset.state = state;
  }
  // AI calls: signed-in real accounts go through the Edge Function "ai" (server-side Gemini key + daily quota);
  // demo/local users call Gemini directly with their own key. Returns { ok, status, json, code, limit, cloud }.
  async function aiCall(task, model, request, key) {
    if (CFG.externalAI === false) return { ok: false, status: 0, json: {}, code: "off" }; // privacy mode: nothing leaves the device
    if (D.user && D.sb) {
      const { data, error } = await D.sb.functions.invoke("ai", { body: { task, model, request } });
      if (!error) return { ok: true, status: 200, json: data, cloud: true };
      let d = {}; const st = error.context?.status || 0; try { d = await error.context.json(); } catch { /* not JSON */ }
      return { ok: false, status: st, json: { error: { message: d.error || error.message } }, code: d.code || (st === 404 ? "missing" : st === 401 ? "auth" : "network"), limit: d.limit, cloud: true };
    }
    if (!key) return { ok: false, status: 0, json: {}, code: "nokey" };
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(request) });
      return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
    } catch { return { ok: false, status: 0, json: {}, code: "network" }; }
  }
  const CLOUD_AI_MSG = { off: () => "ปิดการส่งรูปไปยังบริการ AI ภายนอกไว้เพื่อความเป็นส่วนตัว", quota: (r) => `วันนี้ใช้ AI ครบ ${r.limit || ""} ครั้งแล้ว ลองใหม่พรุ่งนี้`, config: () => "ระบบยังไม่ได้ตั้งค่า AI (ผู้ดูแลต้องตั้ง GEMINI_API_KEY ใน Supabase)", missing: () => "ยังไม่ได้ติดตั้งบริการ AI บนเซิร์ฟเวอร์ (Edge Function \"ai\")", auth: () => "กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่", network: () => "เชื่อมต่อบริการ AI ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่", upstream: (r) => `Gemini ตอบกลับข้อผิดพลาด: ${r.json?.error?.message || ""}`, bad: (r) => `คำขอไม่ถูกต้อง: ${r.json?.error?.message || ""}` };
  window.PreDMAI = { call: aiCall, get cloud() { return !!D.user; }, cloudError: (r) => (CLOUD_AI_MSG[r.code] ? CLOUD_AI_MSG[r.code](r) : null) };
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) { setStatus("local"); window.PreDMDB = { enabled: false }; return; }

  function loadLib() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/supabase.js"; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.appendChild(s); });
  }

  /* ---------- push (debounced, retried) ---------- */
  const dirty = () => new Set(JSON.parse(raw.get("_dirty") || "[]"));
  const saveDirty = (s) => raw.set("_dirty", JSON.stringify([...s]));
  function mark(k) { const s = dirty(); s.add(k); saveDirty(s); clearTimeout(D.timer); D.timer = setTimeout(push, 1500); }
  async function push() {
    if (!D.user) return; const keys = [...dirty()]; if (!keys.length) return;
    if (!navigator.onLine) return setStatus("off");
    setStatus("sync");
    const rows = keys.filter((k) => SYNC.includes(k)).map((k) => { let v = null; try { v = JSON.parse(raw.get(k)); } catch { /* */ } return { user_id: D.user.id, key: k, value: v ?? null, updated_at: new Date().toISOString() }; }).filter((r) => r.value !== null);
    try {
      if (rows.length) { const { error } = await D.sb.from("user_data").upsert(rows); if (error) throw error; }
      if (keys.includes("events")) await pushEvents();
      const s = dirty(); keys.forEach((k) => s.delete(k)); saveDirty(s); setStatus("ok");
    } catch (e) { console.warn("[db] push failed", e?.message || e); setStatus("err"); clearTimeout(D.timer); D.timer = setTimeout(push, 15000); }
  }
  async function pushEvents() {
    let ev = {}; try { ev = JSON.parse(raw.get("events") || "{}"); } catch { /* */ }
    const days = Object.keys(ev).sort().slice(-3), rows = [];
    days.forEach((d) => Object.entries(ev[d]).forEach(([kind, count]) => rows.push({ user_id: D.user.id, day: d, kind: kind.slice(0, 40), count })));
    if (rows.length) { const { error } = await D.sb.from("usage_events").upsert(rows); if (error) throw error; }
  }
  // mirror the app's store writes
  function hookStore() {
    const st = A()?.store; if (!st || st._dbHooked) return; const orig = st.set.bind(st);
    st.set = (k, v) => { orig(k, v); if (D.user && (SYNC.includes(k) || k === "events")) mark(k); };
    st._dbHooked = true;
  }

  /* ---------- pull (on login / start) ---------- */
  async function pull({ replace } = {}) {
    setStatus("sync");
    const { data, error } = await D.sb.from("user_data").select("key,value");
    if (error) { setStatus("err"); return false; }
    if (replace) SYNC.forEach((k) => raw.del(k));
    (data || []).forEach((r) => { if (SYNC.includes(r.key)) raw.set(r.key, JSON.stringify(r.value)); });
    await pullRx(); setStatus("ok"); return true;
  }
  async function pullRx() {
    const { data, error } = await D.sb.from("prescriptions").select("id,data,seen_at,created_at,physio:physio_id(full_name)").eq("patient_id", D.user.id).order("created_at", { ascending: false }).limit(10);
    if (error || !data) return;
    const sess = JSON.parse(raw.get("session") || "null"), phoneKey = sess?.phone || "local";
    const list = data.map((r) => ({ ...r.data, id: r.id, by: r.data?.by || r.physio?.full_name || "นักกายภาพบำบัด", created: r.created_at, seen: !!r.seen_at }));
    const all = JSON.parse(raw.get("rx") || "{}"); all[phoneKey] = list; raw.set("rx", JSON.stringify(all));
  }

  /* ---------- account session <-> app session ---------- */
  async function adoptUser(user, { fresh } = {}) {
    D.user = user;
    const { data: prof } = await D.sb.from("profiles").select("full_name,phone,age,sex,height,role").eq("id", user.id).maybeSingle();
    const name = prof?.full_name || user.user_metadata?.full_name || user.email;
    const sess = { name, phone: prof?.phone || user.user_metadata?.phone || "", cloud: true, uid: user.id, role: prof?.role || "patient", at: Date.now() };
    if (fresh) await pull({ replace: true }); else await pull();
    // PDPA consent is asked once per account: it was given when signing up (or at the first-use screen) and is kept with the
    // account itself, so a new device, a fresh sign-in or a save that never reached user_data does not ask again.
    const m = user.user_metadata || {}; let c = null; try { c = JSON.parse(raw.get("consent") || "null"); } catch { /* */ }
    if (!c?.v && String(m.consent) === "true") { raw.set("consent", JSON.stringify({ v: +m.consent_v || 1, at: m.consent_at || user.created_at || new Date().toISOString(), health: true, research: String(m.consent_research) === "true" })); mark("consent"); }
    raw.set("session", JSON.stringify(sess));
    const p = JSON.parse(raw.get("profile") || "{}"); raw.set("profile", JSON.stringify({ ...p, name, ...(prof?.age ? { age: prof.age } : {}), ...(prof?.sex ? { sex: prof.sex } : {}), ...(prof?.height ? { height: prof.height } : {}) }));
    raw.set("seeded", "true");
    if (dirty().size) push();
    return sess;
  }
  // called when the person answers the consent screen or changes the research switch: save it now, with the account too
  async function consented(c) {
    if (!D.user || !c) return;
    clearTimeout(D.timer); push();
    try { await D.sb.auth.updateUser({ data: { consent: c.health ? "true" : "false", consent_v: c.v || 1, consent_at: c.at || new Date().toISOString(), consent_research: c.research ? "true" : "false" } }); } catch (e) { console.warn("[db] consent not saved with the account", e?.message || e); }
  }
  async function signIn(email, password) {
    const { data, error } = await D.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await adoptUser(data.user, { fresh: true });
    location.hash = "home"; location.reload();
  }
  async function signUp({ email, password, full_name, phone, consent }) {
    const { data, error } = await D.sb.auth.signUp({ email, password, options: { data: { full_name, phone, consent: consent ? "true" : "false" }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    if (!data.session) return "confirm"; // email confirmation required
    await adoptUser(data.user, { fresh: true }); location.hash = "home"; location.reload(); return "ok";
  }
  async function signOut() {
    try { await push(); await D.sb.auth.signOut(); } catch { /* */ }
    [...SYNC, "rx", "events", "_dirty", "session"].forEach((k) => raw.del(k)); // shared devices: leave nothing behind
    D.user = null; setStatus("local");
  }

  /* ---------- sign in with LINE (LINE Login channel + Edge Function "line-login") ---------- */
  const LINE_ID = String(CFG.lineLoginChannelId || "").trim(), LINE_KEY = "predm.lineLogin";
  const lineRedirect = () => location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html"; // not the bare folder address: that one opens the landing page
  // back from LINE with ?code=…&state=… : swap the code for a session. Returns true when signed in.
  async function lineReturn() {
    const q = new URLSearchParams(location.search); if (!q.has("state") || !(q.has("code") || q.has("error"))) return false;
    let saved = null; try { saved = JSON.parse(localStorage.getItem(LINE_KEY) || "null"); localStorage.removeItem(LINE_KEY); } catch { /* */ }
    history.replaceState(null, "", location.pathname + "#welcome");
    const fail = (t) => { D.lineErr = t; const m = $("#c-lmsg"); if (m) { m.textContent = t; m.hidden = false; } return false; };
    if (!saved || saved.st !== q.get("state") || Date.now() - saved.at > 15 * 60000) return fail("การเข้าสู่ระบบด้วย LINE หมดเวลาหรือไม่ได้เริ่มจากเครื่องนี้ กรุณากดปุ่มอีกครั้ง");
    if (q.has("error")) return fail("ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว");
    setStatus("local", "กำลังเข้าสู่ระบบด้วย LINE…");
    try {
      const { data, error } = await D.sb.functions.invoke("line-login", { body: { code: q.get("code"), redirect_uri: saved.redirect, nonce: saved.nonce } });
      if (error) { let msg = ""; try { msg = (await error.context?.json?.())?.error || ""; } catch { /* */ } throw new Error(msg || "เชื่อมต่อระบบ LINE ไม่ได้ กรุณาลองใหม่อีกครั้ง"); }
      const v = await D.sb.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" }); if (v.error) throw v.error;
      await adoptUser(v.data.user, { fresh: true }); location.hash = "home"; location.reload(); return true;
    } catch (e) { return fail(String(e?.message || e)); }
  }

  /* ---------- UI on the welcome page ---------- */
  function cloudUI() {
    const form = $("#l-phone")?.closest("form"); if (!form || $("#cloudBox")) return;
    form.insertAdjacentHTML("afterend", `<section class="card cloud-box" id="cloudBox"><h2 class="cloud-h">☁️ บัญชีจริง <small>ข้อมูลซิงก์กับฐานข้อมูล</small></h2>
      ${LINE_ID ? `<button type="button" class="btn line-login" id="c-line"><span class="ln-logo" aria-hidden="true">LINE</span> เข้าสู่ระบบด้วย LINE</button>
      <small class="cloud-note">กดครั้งเดียว ไม่ต้องจำรหัสผ่าน · ระบบได้รับเฉพาะชื่อและรหัสผู้ใช้ LINE ของคุณ (<a href="#privacy">นโยบาย PDPA</a>)</small>
      <p class="cloud-msg" id="c-lmsg" role="alert" hidden></p><div class="cloud-or"><span>หรือใช้อีเมล</span></div>` : ""}
      <div class="cloud-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-ct="in">เข้าสู่ระบบด้วยอีเมล</button><button type="button" role="tab" aria-selected="false" data-ct="up">สมัครบัญชีใหม่</button></div>
      <form id="cloudForm" class="cloud-form" novalidate>
        <div class="cloud-up" hidden><label>ชื่อ-สกุล<input id="c-name" autocomplete="name" placeholder="เช่น สมชาย ใจดี"></label><label>เบอร์โทร<input id="c-phone" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxx"></label></div>
        <label>อีเมล<input id="c-email" type="email" autocomplete="email" placeholder="you@example.com"></label>
        <label>รหัสผ่าน<input id="c-pass" type="password" autocomplete="current-password" placeholder="อย่างน้อย 8 ตัว"></label>
        <label class="cloud-consent cloud-up" hidden><input type="checkbox" id="c-consent"><span>ยินยอมให้เก็บและใช้ข้อมูลสุขภาพของฉัน (ผลประเมิน การออกกำลังกาย อาหาร สัดส่วนร่างกาย) เพื่อการดูแลสุขภาพ และให้นักกายภาพบำบัดในโครงการเข้าถึงได้ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล</span></label>
        <p class="cloud-msg" id="c-msg" role="alert" hidden></p>
        <button class="btn grad" type="submit" id="c-go">เข้าสู่ระบบ</button>
        <button type="button" class="link cloud-forgot" id="c-forgot">ลืมรหัสผ่าน?</button>
        <small class="cloud-note">☁️ บัญชีจริง: ข้อมูลซิงก์ขึ้นฐานข้อมูล ใช้ได้ทุกเครื่อง และรับโปรแกรมจากนักกายภาพอัตโนมัติ</small>
      </form></section>`);
    $("#c-line")?.addEventListener("click", () => {
      const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
      const st = rnd(), nonce = rnd(), redirect = lineRedirect();
      try { localStorage.setItem(LINE_KEY, JSON.stringify({ st, nonce, redirect, at: Date.now() })); } catch { /* */ }
      $("#c-line").disabled = true;
      location.href = "https://access.line.me/oauth2/v2.1/authorize?" + new URLSearchParams({ response_type: "code", client_id: LINE_ID, redirect_uri: redirect, state: st, scope: "profile openid", nonce, bot_prompt: "normal" });
    });
    if (D.lineErr) { const m = $("#c-lmsg"); if (m) { m.textContent = D.lineErr; m.hidden = false; } }
    // forgot password: Supabase emails a reset link that brings the user back here
    $("#c-forgot").addEventListener("click", async () => {
      const msg = $("#c-msg"), say = (t, ok) => { msg.textContent = t; msg.hidden = false; msg.dataset.ok = ok ? "1" : ""; };
      const email = $("#c-email").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { $("#c-email").focus(); return say("กรอกอีเมลของบัญชีก่อน แล้วกด “ลืมรหัสผ่าน?” อีกครั้ง"); }
      if (!D.sb) return say("ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
      $("#c-forgot").disabled = true;
      const { error } = await D.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      $("#c-forgot").disabled = false;
      if (error) return say(/rate limit|security purposes/i.test(error.message) ? "ขอรีเซ็ตบ่อยเกินไป กรุณารอสักครู่" : error.message);
      say("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว เปิดอีเมลแล้วกดลิงก์ (ดูในจดหมายขยะด้วย)", true);
    });
    let mode = "in";
    $("#cloudBox").addEventListener("click", (e) => { const t = e.target.closest("[data-ct]"); if (!t) return; mode = t.dataset.ct;
      document.querySelectorAll("[data-ct]").forEach((b) => b.setAttribute("aria-selected", String(b === t))); document.querySelectorAll(".cloud-up").forEach((x) => (x.hidden = mode !== "up"));
      $("#c-go").textContent = mode === "up" ? "สมัครและเข้าสู่ระบบ" : "เข้าสู่ระบบ"; $("#c-pass").autocomplete = mode === "up" ? "new-password" : "current-password"; });
    $("#cloudForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const msg = $("#c-msg"), say = (t, ok) => { msg.textContent = t; msg.hidden = false; msg.dataset.ok = ok ? "1" : ""; };
      const email = $("#c-email").value.trim(), password = $("#c-pass").value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return say("กรุณากรอกอีเมลให้ถูกต้อง");
      if (password.length < 8) return say("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      $("#c-go").disabled = true;
      try {
        if (mode === "up") {
          const full_name = $("#c-name").value.trim(), phone = $("#c-phone").value.replace(/\D/g, "");
          if (!full_name) throw new Error("กรุณากรอกชื่อ-สกุล");
          if (!$("#c-consent").checked) throw new Error("กรุณาให้ความยินยอมก่อนสมัคร");
          const r = await signUp({ email, password, full_name, phone, consent: true });
          if (r === "confirm") say("สมัครสำเร็จ! กรุณายืนยันอีเมลจากกล่องจดหมาย แล้วกลับมาเข้าสู่ระบบ", true);
        } else await signIn(email, password);
      } catch (err) {
        const m = String(err?.message || err);
        say(/Invalid login/i.test(m) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : /Email not confirmed/i.test(m) ? "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลก่อน" : /already registered/i.test(m) ? "อีเมลนี้สมัครแล้ว ลองเข้าสู่ระบบ" : m);
      } finally { $("#c-go").disabled = false; }
    });
  }

  function newPasswordUI() {
    if (document.getElementById("pwReset")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="care-modal" id="pwReset" role="dialog" aria-modal="true" aria-labelledby="pwH"><div class="care-box">
      <div class="care-head"><span class="care-ico">🔑</span><div><h2 id="pwH">ตั้งรหัสผ่านใหม่</h2><small>สำหรับบัญชีจริงของคุณ</small></div></div>
      <form id="pwForm" class="form" novalidate><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input id="pw1" type="password" autocomplete="new-password" autofocus></label>
        <label>ยืนยันรหัสผ่านใหม่<input id="pw2" type="password" autocomplete="new-password"></label>
        <p class="care-err" id="pwErr" role="alert" hidden></p><div class="care-foot"><button class="btn primary" type="submit">บันทึกรหัสผ่านใหม่</button></div></form></div></div>`);
    document.body.classList.add("care-open"); setTimeout(() => $("#pw1").focus(), 50);
    $("#pwForm").addEventListener("submit", async (e) => {
      e.preventDefault(); const er = $("#pwErr"), p1 = $("#pw1").value, p2 = $("#pw2").value;
      const bad = (t) => { er.textContent = t; er.hidden = false; };
      if (p1.length < 8) return bad("รหัสผ่านอย่างน้อย 8 ตัวอักษร"); if (p1 !== p2) return bad("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      const { error } = await D.sb.auth.updateUser({ password: p1 }); if (error) return bad(error.message);
      $("#pwReset").remove(); document.body.classList.remove("care-open"); history.replaceState(null, "", location.pathname + "#home");
      window.PreDM?.toast?.("ตั้งรหัสผ่านใหม่เรียบร้อย"); location.reload();
    });
  }

  /* ---------- start ---------- */
  async function start() {
    hookStore(); cloudUI();
    try { await loadLib(); } catch { setStatus("err", "⚠️ โหลดตัวเชื่อมฐานข้อมูลไม่สำเร็จ · ใช้ข้อมูลในเครื่อง"); return; }
    D.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "predm.auth" } });
    // came back from a password-reset email: ask for the new password
    D.sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") setTimeout(newPasswordUI, 300); });
    if (LINE_ID && await lineReturn()) return;
    const { data } = await D.sb.auth.getSession();
    const sess = JSON.parse(raw.get("session") || "null");
    if (data.session?.user) {
      const before = JSON.stringify(SYNC.map((k) => raw.get(k)));
      await adoptUser(data.session.user);
      const after = JSON.stringify(SYNC.map((k) => raw.get(k)));
      if (before !== after && !sessionStorage.getItem("predm.pulled")) { sessionStorage.setItem("predm.pulled", "1"); location.reload(); return; }
    } else if (sess?.cloud) { raw.del("session"); location.hash = "welcome"; } // token expired
    else setStatus("local", "💾 บัญชีทดลอง · เก็บข้อมูลในเครื่องนี้");
    D.ready = true;
    // logout buttons: also end the cloud session
    ["#logout", "#logoutM"].forEach((id) => $(id)?.addEventListener("click", () => { if (D.user) signOut(); }, true));
    addEventListener("online", push);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(); });
    if (D.user) setInterval(() => pullRx().catch(() => {}), 120000);
  }
  window.PreDMDB = { enabled: true, get user() { return D.user; }, get client() { return D.sb; }, get ready() { return !!D.ready; }, push, pull, signOut, consented };
  start();
})();

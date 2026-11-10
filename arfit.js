/* Pre-DM Smart Hub — "AR ออกกำลังกาย": a full-screen camera page where the user picks the exercise themselves by touching
   floating cards with a finger (VR style), then trains with live AI pose counting.
   Flow: เลือกโหมด (เสริมแรง / แอโรบิก / ทรงตัว / ยืดเหยียด-มือ / เกม AR) → เลือกท่า → เลือกเป้าหมาย → นับถอยหลัง → ฝึก → สรุปผล
   Uses the pose engine from pose.js (window.PreDMTrack). Camera images are processed on this device only. Mouse / touch also works. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ic = (n) => `<img class="ar-ic" src="vendor/fit3d/${n}.webp" alt="" draggable="false">`;
  const A = () => window.PreDM, M = () => window.PreDMMusic;
  const DWELL = 1000, STOP_DWELL = 2200;

  // exercises tracked inside this page: [mode, name, icon, unit, targets, type, tip]
  const EX = {
    squat: ["สควอท", "person_lifting_weights", "ครั้ง", [8, 12, 20], "strength", "ยืนกางเท้าเท่าไหล่ ย่อจนเข่างอประมาณ 90° แล้วยืดตรง หันข้างหรือหน้าเข้ากล้องให้เห็นทั้งตัว"],
    arm: ["ยกแขนเหนือศีรษะ", "raising_hands", "ครั้ง", [10, 15, 20], "strength", "หันหน้าเข้ากล้อง ยกแขนสองข้างขึ้นเหนือศีรษะจนสุด แล้วลดลงข้างลำตัว"],
    march: ["ย่ำเท้ายกเข่า", "person_walking", "ก้าว", [30, 60, 100], "aerobic", "ยกเข่าสลับซ้าย-ขวาให้สูงใกล้ระดับสะโพก ให้กล้องเห็นตั้งแต่สะโพกถึงเข่า"],
    balance: ["ยืนขาเดียว", "flamingo", "วินาที", [10, 20, 30], "balance", "ยืนข้างเก้าอี้ไว้จับกันล้ม ยกเท้าหนึ่งข้างให้พ้นพื้น นับเวลาเฉพาะตอนยืนขาเดียว"],
    fist: ["กำ-แบมือ", "raised_fist", "ครั้ง", [10, 20, 30], "flex", "ยกมือขึ้นระดับอก หันฝ่ามือเข้ากล้อง แบมือกางนิ้วให้สุด แล้วกำให้แน่น"],
  };
  const GAME_IC = { bubble: "bubbles", bird: "bird", kick: "glowing_star", squat: "balloon", balance: "wind_face", jack: "fireworks", march: "basket", punch: "boxing_glove", reach: "person_cartwheeling", dodge: "basket" };
  const MODES = [
    { id: "strength", n: "เสริมแรง", ic: "flexed_biceps", sub: "กล้ามเนื้อขา แขน", items: ["ex:squat", "ex:arm", "g:squat"] },
    { id: "aerobic", n: "แอโรบิก", ic: "red_heart", sub: "หัวใจ เผาผลาญน้ำตาล", items: ["ex:march", "g:jack", "g:march", "g:punch", "g:dodge"] },
    { id: "balance", n: "ทรงตัว", ic: "flamingo", sub: "ป้องกันการหกล้ม", items: ["ex:balance", "g:balance", "g:kick"] },
    { id: "flex", n: "ยืดเหยียด · มือ", ic: "person_in_lotus_position", sub: "ข้อต่อ นิ้วมือ", items: ["ex:fist", "ex:arm", "g:reach", "g:bird"] },
    { id: "game", n: "เกม AR", ic: "video_game", sub: "10 เกม เกมละ 60 วินาที", items: ["g:bubble", "g:bird", "g:kick", "g:squat", "g:balance", "g:jack", "g:march", "g:punch", "g:reach", "g:dodge"] },
  ];

  const GAME_LV = [[1, 30, "เริ่มต้น (นั่งเล่นได้)"], [2, 45, "ปานกลาง"], [3, 60, "ท้าทาย"]];
  const S = { phase: "mode", mode: null, ex: null, target: 0, page: 0, cards: [], hover: null, acc: 0, lock: false, slip: 0, sm: null, ptr: null, runner: null, cam: false, evalFn: null, last: null, t0: 0, lastF: 0, reps: 0 };

  function shell() {
    if ($("#arModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
    <div class="ar-modal hk-modal" id="arModal" role="dialog" aria-modal="true" aria-label="AR ออกกำลังกาย" hidden>
      <div class="hk-stage ar-stage" id="arStage">
        <video id="arVideo" playsinline muted hidden></video>
        <div class="hk-bg ar-bg" aria-hidden="true"></div>
        <canvas id="arCanvas" width="640" height="480"></canvas>
        <div class="hk-cards" id="arCards"></div>
        <div class="hk-fxl" id="arFx" aria-hidden="true"></div>
        <div class="hk-cursor" id="arCursor" hidden><i></i></div>
        <div class="hk-cursor alt" id="arCursor2" hidden><i></i></div>
        <div class="hk-hud">
          <button type="button" class="hk-x" data-ar="close" aria-label="ปิด AR">✕</button>
          <span class="hk-masc" id="arMasc" aria-hidden="true"></span>
          <div class="hk-title"><b id="arTitle">AR ออกกำลังกาย</b><span id="arSay">กำลังเปิดกล้อง…</span></div>
          <button type="button" class="ar-stopbtn" id="arStopBtn" data-ar="stop" hidden>⏹ หยุด</button>
          <button type="button" class="hk-x hk-mu" data-voice aria-label="เปิด/ปิดเสียงพากย์">🗣️</button><button type="button" class="hk-x hk-mu" data-music aria-label="เปิด/ปิดเพลง">🎵</button>
        </div>
        <div class="ar-live" id="arLive" hidden>
          <div class="ar-count"><b id="arN">0</b><small id="arUnit">ครั้ง</small><i><em id="arBar"></em></i><span id="arGoal"></span></div>
          <p class="ar-fb" id="arFb">—</p>
        </div>
        <div class="ar-big" id="arBig" hidden></div>
        <p class="ar-msg" id="arMsg" hidden></p>
      </div>
    </div>`);
    $("#arModal").addEventListener("click", onClick);
    const st = $("#arStage");
    st.addEventListener("pointermove", (e) => { const r = st.getBoundingClientRect(); S.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; });
    st.addEventListener("pointerleave", () => (S.ptr = null));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#arModal").hidden) close(); });
    if (window.PreDMMascot) $("#arMasc").innerHTML = PreDMMascot.svg();
  }

  const say = (t) => { $("#arSay").textContent = t; };
  function speak(t) { try { window.PreDMVoice ? window.PreDMVoice.say(t) : A()?.speak?.(t, { force: true }); } catch { /* voice optional */ } }

  async function open() {
    shell(); $("#arModal").hidden = false; document.body.classList.add("care-open");
    S.phase = "mode"; S.page = 0; layout();
    await startCam();
  }
  function close() {
    if (S.phase === "game") window.PreDMTrack?.arGame.stop(); clearInterval(S.cd); S.phase = "mode"; $("#arStopBtn") && ($("#arStopBtn").hidden = true);
    stopCam(); $("#arModal").hidden = true; document.body.classList.remove("care-open"); M()?.stop();
    $("#arLive").hidden = true; $("#arBig").hidden = true;
  }
  async function ready() { if (window.PreDMTrack?.Runner) return; await new Promise((res) => { window.addEventListener("predm:track-ready", res, { once: true }); setTimeout(res, 15000); }); }
  async function startCam() {
    try {
      await ready(); const T = window.PreDMTrack; if (!T?.Runner) throw new Error("ระบบ AI ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง");
      if (!S.runner) S.runner = new T.Runner($("#arVideo"), $("#arCanvas"), $("#arMsg"));
      S.runner.hands = true; $("#arMsg").hidden = false; $("#arMsg").textContent = "กำลังโหลด AI จับท่าทางและมือ…";
      await S.runner.start(onFrame); S.cam = true; $("#arStage").classList.add("cam");
      say(S.phase === "mode" ? "ชี้นิ้วชี้ค้างไว้ที่การ์ดเพื่อเลือก (หรือแตะด้วยเมาส์/นิ้วบนจอ)" : $("#arSay").textContent);
    } catch (err) {
      S.cam = false; $("#arMsg").hidden = false;
      $("#arMsg").textContent = `เปิดกล้องไม่ได้ (${err.name === "NotAllowedError" ? "ไม่ได้อนุญาตกล้อง" : err.message || err}) · เลือกท่าด้วยการแตะได้ แต่การนับท่าต้องใช้กล้อง`;
      say("แตะการ์ดเพื่อเลือกโหมด"); idleLoop();
    }
  }
  function stopCam() { try { S.runner?.stop(); } catch { /* ignore */ } S.cam = false; cancelAnimationFrame(S.idle); $("#arStage")?.classList.remove("cam"); }
  function idleLoop() { cancelAnimationFrame(S.idle); const f = () => { S.idle = requestAnimationFrame(f); if (!S.cam) pointerStep([]); }; f(); }

  /* ------------------------------------------------------------ cards */
  function items() {
    const T = window.PreDMTrack || {}, G = T.games || {};
    if (S.phase === "mode") {
      $("#arTitle").textContent = "🕶️ AR ออกกำลังกาย · เลือกโหมด";
      return MODES.map((m) => ({ id: "m:" + m.id, ic: m.ic, n: m.n, sub: m.sub }));
    }
    if (S.phase === "ex") {
      const m = MODES.find((x) => x.id === S.mode); $("#arTitle").textContent = `${m.n} · เลือกท่าที่จะฝึก`;
      say("ชี้นิ้วค้างไว้ที่ท่าที่อยากฝึก");
      const list = m.items.map((k) => { const [t, id] = k.split(":"); if (t === "ex") { const e = EX[id]; return { id: k, ic: e[1], n: e[0], sub: `AI นับ${e[2]}` }; } const g = G[id]; return g ? { id: k, ic: GAME_IC[id] || "video_game", n: g.name, sub: `เกม AR · ${g.part}` } : null; }).filter(Boolean);
      const per = 7, pages = Math.ceil(list.length / per), view = list.slice(S.page * per, S.page * per + per);
      return [{ id: "back", ic: "left_arrow", n: "ย้อนกลับ" }, ...view, ...(pages > 1 ? [{ id: "page", ic: "glowing_star", n: "ท่าอื่น ๆ", sub: `หน้า ${S.page + 1}/${pages}` }] : [])];
    }
    if (S.phase === "target") {
      const e = EX[S.ex]; $("#arTitle").textContent = `${e[0]} · ตั้งเป้าหมาย`; say(e[5]);
      return [{ id: "back", ic: "left_arrow", n: "ย้อนกลับ" }, ...e[3].map((n, i) => ({ id: "t:" + n, ic: ["bullseye", "stopwatch", "trophy"][i], n: `${n} ${e[2]}`, sub: ["เริ่มต้น", "ปานกลาง", "ท้าทาย"][i], big: i === 1 }))];
    }
    if (S.phase === "gtarget") {
      const g = (T.games || {})[S.game]; $("#arTitle").textContent = `${g.name} · เลือกระดับ`; say(g.how);
      return [{ id: "back", ic: "left_arrow", n: "ย้อนกลับ" }, ...GAME_LV.map(([lv, secs, n], i) => ({ id: `gl:${lv}:${secs}`, ic: ["bullseye", "stopwatch", "trophy"][i], n, sub: `${secs} วินาที`, big: i === 0 }))];
    }
    if (S.phase === "done") return [{ id: "again", ic: "fireworks", n: S.kind === "game" ? "เล่นเกมนี้อีกครั้ง" : "ฝึกท่าเดิมอีกครั้ง", big: true }, { id: "menu", ic: "glowing_star", n: S.kind === "game" ? "เลือกเกม/ท่าอื่น" : "เลือกท่าอื่น" }, { id: "close", ic: "stop_sign", n: "ปิด AR" }];
    return [];
  }
  function layout() {
    const box = $("#arCards"), list = items(), n = list.length, narrow = ($("#arStage").clientWidth || innerWidth) < 760;
    box.innerHTML = list.map((c, i) => {
      let x, y;
      if (narrow) { const cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), col = i - r * cols; x = 50 + (col - (inRow - 1) / 2) * (cols === 2 ? 42 : 32); y = rows === 1 ? 50 : 30 + (r * 46) / (rows - 1); }
      else { const t = n === 1 ? 0.5 : i / (n - 1), ang = Math.PI * (1.05 - 1.1 * t); x = 50 + Math.cos(ang) * 41; y = 68 - Math.sin(ang) * 48; }
      return `<div class="hk-card ar-card${c.big ? " big" : ""}" data-id="${esc(c.id)}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"><span class="hk-ring"></span><span class="hk-pic">${ic(c.ic)}</span><b>${esc(c.n)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</div>`;
    }).join("");
    S.cards = [...box.children]; Object.values(PTR).forEach((q) => { q.hover = null; q.acc = 0; });
    if (S.spoke !== S.phase && { mode: 1, ex: 1, target: 1, gtarget: 1 }[S.phase]) { S.spoke = S.phase; speak({ mode: "ar_mode", ex: "ar_ex", target: "ar_target", gtarget: "ar_target" }[S.phase]); }
    if (S.phase === "mode") say(S.cam ? "ชี้นิ้วชี้ค้างไว้ที่การ์ดเพื่อเลือก (หรือแตะด้วยเมาส์/นิ้วบนจอ)" : "แตะการ์ดเพื่อเลือกโหมด");
  }

  function choose(id, el) {
    M()?.sfx("pick"); if (el) fx(el); $("#arBig").hidden = true;
    if (id === "close") return close();
    if (id === "back") { S.phase = S.phase === "target" || S.phase === "gtarget" ? "ex" : "mode"; S.page = 0; return layout(); }
    if (id === "page") { const m = MODES.find((x) => x.id === S.mode); S.page = (S.page + 1) % Math.ceil(m.items.length / 7); return layout(); }
    if (id === "menu") { S.phase = "mode"; return layout(); }
    if (id === "again") return S.kind === "game" ? beginGame() : begin();
    if (id.startsWith("m:")) { S.mode = id.slice(2); S.phase = "ex"; S.page = 0; return layout(); }
    if (id.startsWith("g:")) { S.game = id.slice(2); S.phase = "gtarget"; return layout(); } // AR games play right here
    if (id.startsWith("gl:")) { const [, lv, secs] = id.split(":"); S.lv = +lv; S.secs = +secs; return beginGame(); }
    if (id.startsWith("ex:")) { S.ex = id.slice(3); S.phase = "target"; return layout(); }
    if (id.startsWith("t:")) { S.target = +id.slice(2); return begin(); }
  }

  /* ------------------------------------------------------------ training */
  function needCam() { if (S.cam) return false; say("ต้องเปิดกล้องก่อนจึงจะเล่นได้"); $("#arMsg").hidden = false; $("#arMsg").textContent = "ท่าออกกำลังกายและเกม AR ต้องใช้กล้อง กด ✕ แล้วเปิดใหม่ และอนุญาตให้ใช้กล้อง"; return true; }
  function stopCard() {
    $("#arStopBtn").hidden = false;
    $("#arCards").innerHTML = `<div class="hk-card ar-card ar-stop" data-id="stop" style="left:10%;top:24%"><span class="hk-ring"></span><span class="hk-pic">${ic("stop_sign")}</span><b>หยุด</b><small>ชี้ค้าง 2 วินาที</small></div>`;
    S.cards = [...$("#arCards").children]; Object.values(PTR).forEach((q) => { q.hover = null; q.acc = 0; q.lock = false; }); // stop card is far from the old cards and needs a long hold
  }
  function countdown(go) {
    let n = 3; const big = $("#arBig"); big.hidden = false; big.textContent = n; speak("ready"); $("#arStopBtn").hidden = false;
    clearInterval(S.cd);
    S.cd = setInterval(() => {
      n--; if (n > 0) { big.textContent = n; M()?.sfx("hover"); speak(String(n)); return; }
      clearInterval(S.cd); big.textContent = "เริ่ม!"; speak("go"); M()?.sfx("ok"); setTimeout(() => (big.hidden = true), 700); go();
    }, 1000);
  }
  function cancelCountdown() { clearInterval(S.cd); $("#arBig").hidden = true; $("#arStopBtn").hidden = true; $("#arLive").hidden = true; S.phase = S.kind === "game" ? "gtarget" : "target"; layout(); }
  function beginGame() {
    if (needCam()) return;
    const T = window.PreDMTrack, g = T.games[S.game]; S.kind = "game"; S.phase = "count"; layout();
    S.runner.setHands(T.arGame.handy(S.game));
    $("#arTitle").textContent = `${g.name} · ${S.secs} วินาที`; say(g.how);
    $("#arUnit").textContent = "คะแนน"; $("#arGoal").textContent = `เหลือ ${S.secs} วินาที`; $("#arN").textContent = 0; $("#arBar").style.width = "100%"; $("#arFb").textContent = g.how; $("#arFb").dataset.state = "idle";
    countdown(() => { T.arGame.start(S.game, S.lv, S.secs); S.phase = "game"; S.t0 = performance.now(); S.reps = 0; $("#arLive").hidden = false; M()?.start(); stopCard(); });
  }
  function finishGame() {
    const T = window.PreDMTrack, g = T.games[S.game], res = T.arGame.stop();
    S.phase = "done"; $("#arLive").hidden = true; $("#arStopBtn").hidden = true; M()?.stop(); S.runner.setHands(true);
    const st = res.score >= 30 ? 3 : res.score >= 15 ? 2 : res.score >= 5 ? 1 : 0; if (st >= 2) { confetti(); M()?.sfx("win"); }
    const big = $("#arBig"); big.hidden = false;
    big.innerHTML = `<div class="ar-res"><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div><b>${esc(g.name)} · ${res.score} คะแนน</b><small>${res.record ? "🏆 สถิติใหม่! · " : ""}ดีที่สุด ${res.best}${res.score > 0 ? " · บันทึกลงสมุดแล้ว" : ""}</small></div>`;
    speak(res.record ? "record" : res.score > 0 ? "gameover" : "retry");
    layout(); say("ชี้นิ้วค้างไว้ที่การ์ด เพื่อเล่นอีกครั้งหรือเลือกเกมอื่น");
  }
  function begin() {
    if (needCam()) return;
    const e = EX[S.ex], T = window.PreDMTrack;
    S.kind = "ex"; S.phase = "count"; layout(); S.last = null; S.reps = 0;
    S.runner.setHands(true); // MediaPipe Hand is always on (fingers drawn, either hand can press "หยุด")
    $("#arTitle").textContent = `${e[0]} · เป้าหมาย ${S.target} ${e[2]}`; say(e[5]);
    $("#arUnit").textContent = e[2]; $("#arGoal").textContent = `เป้าหมาย ${S.target}`; $("#arN").textContent = 0; $("#arBar").style.width = "0%"; $("#arFb").textContent = "เตรียมตัว";
    countdown(() => { S.evalFn = T.makeEval(S.ex); S.phase = "train"; S.t0 = performance.now(); $("#arLive").hidden = false; M()?.start(); stopCard(); });
  }
  function finish(early) {
    const e = EX[S.ex], n = S.last?.count || 0, mins = Math.max(1, Math.round((performance.now() - S.t0) / 60000));
    S.phase = "done"; S.evalFn = null; $("#arLive").hidden = true; $("#arStopBtn").hidden = true; M()?.stop();
    S.runner.setHands(true);
    if (n > 0) A()?.addLog?.({ type: e[4], name: `${e[0]} (AR)`, minutes: mins, reps: n });
    const ratio = n / S.target, st = ratio >= 1 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
    if (st >= 2) { confetti(); M()?.sfx("win"); }
    const best = A()?.store.get("arBest", {}) || {}; if (n > (best[S.ex] || 0)) { best[S.ex] = n; A()?.store.set("arBest", best); }
    const big = $("#arBig"); big.hidden = false;
    big.innerHTML = `<div class="ar-res"><div class="fq-stars">${[0, 1, 2].map((k) => `<span class="${k < st ? "on" : ""}">★</span>`).join("")}</div><b>${n} / ${S.target} ${esc(e[2])}</b><small>${["ลองใหม่นะคะ ค่อย ๆ ทำ", "ดีค่ะ ทำต่อเนื่องนะคะ", "เก่งมากค่ะ!", "ครบเป้าหมาย สุดยอด! 🎉"][st]} · ดีที่สุด ${best[S.ex] || n}${n > 0 ? " · บันทึกลงสมุดแล้ว" : ""}</small></div>`;
    speak(st === 3 ? "goal" : early && n === 0 ? "ar_stop" : ["retry", "cheer2", "cheer1"][st]);
    layout(); say("ชี้นิ้วค้างไว้ที่การ์ด เพื่อเล่นต่อหรือเลือกท่าอื่น");
  }

  /* ------------------------------------------------------------ per-frame */
  function onFrame(lms, ctx, w, h, now, hands) {
    if (S.phase === "train" && S.evalFn) {
      const T = window.PreDMTrack, r = S.evalFn(lms, now, hands), col = T.COLORS[r.state];
      if (lms) T.drawSkeleton(ctx, lms, w, h, col);
      if (hands) T.drawHands(ctx, hands, w, h, S.ex === "fist" ? col : null);
      if (r.count !== S.reps) { S.reps = r.count; M()?.sfx("pok"); bump(); if (S.reps % 5 === 0 && S.reps < S.target) speak(String(S.reps)); else if (S.reps === S.target - 2) speak("cheer4"); }
      if (!lms && now - (S.bodyTalk || 0) > 12000 && now - S.t0 > 4000) { S.bodyTalk = now; speak("ar_body"); }
      S.last = r; $("#arN").textContent = r.count; $("#arBar").style.width = `${Math.min(100, (r.count / S.target) * 100)}%`;
      const fb = $("#arFb"); fb.textContent = r.msg || "—"; fb.dataset.state = r.state;
      if (r.count >= S.target) finish(false);
    } else if (S.phase === "game") {
      const r = window.PreDMTrack.arGame.frame(lms, ctx, w, h, now, hands);
      if (r) {
        if (r.score !== S.reps) { if (r.score > S.reps) bump(); S.reps = r.score; }
        $("#arN").textContent = r.score; $("#arGoal").textContent = `เหลือ ${r.left} วินาที`; $("#arBar").style.width = `${(100 * r.left) / S.secs}%`;
        if (r.left <= 3 && r.left > 0 && r.left !== S.lastLeft) { S.lastLeft = r.left; speak(String(r.left)); }
        if (!r.running) finishGame();
      }
    } else if (hands && hands.length) window.PreDMTrack.drawHands(ctx, hands, w, h);
    pointerStep(fingertips(lms, hands));
  }
  function T_drawLight(ctx, hands, w, h) { ctx.fillStyle = "rgba(255,255,255,.8)"; hands.forEach((hd) => hd.pts.forEach((q) => { ctx.beginPath(); ctx.arc(q.x * w, q.y * h, 3.5, 0, 7); ctx.fill(); })); }
  // map a normalised point on the camera canvas to screen pixels (canvas is shown with object-fit: cover)
  function toScreen(q) {
    const c = $("#arCanvas"), st = $("#arStage"), W = st.clientWidth, H = st.clientHeight, vw = c.width, vh = c.height, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
    return { x: (W - dw) / 2 + q.x * dw, y: (H - dh) / 2 + q.y * dh };
  }
  // every visible hand points (both hands work); during training the pose's finger points stand in for hands
  function fingertips(lms, hands) {
    if (hands && hands.length) {
      const out = hands.slice(0, 2).map((hd) => ({ key: hd.side || "L", p: toScreen(hd.pts[8]) }));
      if (out.length === 2 && out[0].key === out[1].key) out[1].key = out[0].key === "L" ? "R" : "L";
      return out;
    }
    if (lms && S.phase !== "mode" && S.phase !== "ex") return [[19, "L"], [20, "R"]].filter(([i]) => lms[i] && lms[i].v > 0.5).map(([i, key]) => ({ key, p: toScreen(lms[i]) }));
    return [];
  }
  /* each hand (and the mouse) has its own cursor, smoothing and dwell timer */
  const PTR = {}; const ptr = (k) => (PTR[k] = PTR[k] || { sm: null, hover: null, acc: 0, slip: 0, lock: false });
  function lockAll() { Object.values(PTR).forEach((q) => { q.lock = true; q.hover?.classList.remove("hot"); q.hover = null; q.acc = 0; }); }
  function pointerStep(list) {
    const now = performance.now(), dt = Math.min(300, now - (S.lastF || now)); S.lastF = now;
    if (!list.length && S.ptr && now - S.ptr.t < 4000) list = [{ key: "m", p: S.ptr }]; // mouse / touch when no hand is seen
    const live = new Set(list.map((r) => r.key)), curs = [$("#arCursor"), $("#arCursor2")]; let ci = 0;
    Object.entries(PTR).forEach(([k, q]) => { if (!live.has(k)) q.sm = null; });
    list.slice(0, 2).forEach(({ key, p: raw }) => { const q = ptr(key); q.sm = q.sm ? { x: q.sm.x + (raw.x - q.sm.x) * 0.35, y: q.sm.y + (raw.y - q.sm.y) * 0.35 } : { x: raw.x, y: raw.y }; stepOne(q, q.sm, dt, now, curs[ci++]); });
    Object.entries(PTR).forEach(([k, q]) => { if (!live.has(k) && q.hover) stepOne(q, null, dt, now, curs[Math.min(ci, 1)]); }); // grace period for a hand that just dropped out
    for (; ci < 2; ci++) curs[ci].hidden = true;
  }
  function stepOne(q, p, dt, now, cur) {
    cur.hidden = !p; if (p) cur.style.transform = `translate(${p.x}px,${p.y}px)`;
    let hit = null, paused = false;
    if (p && S.cards.length && S.phase !== "count") {
      const sr = $("#arStage").getBoundingClientRect();
      const inside = (c, pad) => { const r = c.getBoundingClientRect(); return p.x >= r.left - sr.left - pad && p.x <= r.right - sr.left + pad && p.y >= r.top - sr.top - pad && p.y <= r.bottom - sr.top + pad; };
      if (q.hover && q.hover.isConnected && inside(q.hover, 40)) hit = q.hover;
      else for (const c of S.cards) if (inside(c, 14)) { hit = c; break; }
    }
    if (q.lock) { if (hit) hit = null; else if (p) q.lock = false; }
    if (!hit && q.hover && q.hover.isConnected && !q.lock) { q.slip = q.slip || now; if (now - q.slip < 450) { hit = q.hover; paused = true; } } else q.slip = 0;
    if (hit !== q.hover) { q.hover?.classList.remove("hot"); q.hover?.style.setProperty("--p", 0); q.hover = hit; q.acc = 0; if (hit) { hit.classList.add("hot"); M()?.sfx("hover"); } }
    if (hit) {
      if (!paused) q.acc += dt;
      const need = hit.dataset.id === "stop" ? STOP_DWELL : DWELL, k = Math.min(1, q.acc / need);
      hit.style.setProperty("--p", k); cur.style.setProperty("--p", k);
      if (k >= 1) { const id = hit.dataset.id; hit.classList.remove("hot"); lockAll(); if (id === "stop") stopNow(); else choose(id, hit); }
    } else cur.style.setProperty("--p", 0);
  }

  /* ------------------------------------------------------------ effects */
  function bump() { const b = $("#arN"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); const m = $("#arMasc"); m.classList.remove("cheer"); void m.offsetWidth; m.classList.add("cheer"); }
  function fx(el) {
    const layer = $("#arFx"), sr = $("#arStage").getBoundingClientRect(), r = el.getBoundingClientRect(), x = r.left + r.width / 2 - sr.left, y = r.top + r.height / 2 - sr.top, cs = ["#ffd23f", "#3fbf6a", "#7b5cff", "#ff6fa5", "#5bc0ff"];
    const wrap = document.createElement("div");
    wrap.innerHTML = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2, d = 60 + Math.random() * 50; return `<i class="hk-spark" style="left:${x}px;top:${y}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;background:${cs[i % cs.length]}"></i>`; }).join("");
    layer.appendChild(wrap); setTimeout(() => wrap.remove(), 900);
  }
  function confetti() {
    const layer = $("#arFx"), wrap = document.createElement("div"), cs = ["#ffd23f", "#3fbf6a", "#7b5cff", "#ff6fa5", "#5bc0ff", "#ff9f43"];
    wrap.innerHTML = Array.from({ length: 70 }, (_, i) => `<i class="hk-conf" style="left:${Math.random() * 100}%;background:${cs[i % cs.length]};animation-delay:${(Math.random() * 0.6).toFixed(2)}s;--rot:${Math.round(Math.random() * 720)}deg"></i>`).join("");
    layer.appendChild(wrap); setTimeout(() => wrap.remove(), 3200);
  }

  function stopNow() { // stop while counting down, training or playing; results so far are kept
    if (S.phase === "count") return cancelCountdown();
    if (S.phase === "train") return finish(true);
    if (S.phase === "game") return finishGame();
  }
  function onClick(e) {
    const b = e.target.closest("[data-ar]"); if (b && b.dataset.ar === "close") return close();
    if (b && b.dataset.ar === "stop") return stopNow();
    const c = e.target.closest(".hk-card"); if (!c) return;
    lockAll(); if (c.dataset.id === "stop") return stopNow();
    choose(c.dataset.id, c);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-arfit]")) { e.preventDefault(); open(); } });
  window.addEventListener("predm:view", () => { if ($("#arModal") && !$("#arModal").hidden) close(); });
  window.PreDMAR = { open, close };
})();

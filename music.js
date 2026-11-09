/* Pre-DM Smart Hub — game music, made live in the browser with the Web Audio API.
   An original cheerful Isan-style loop (khaen-like drone + pong-lang style melody + drum and ching) plus small sound effects.
   Nothing is downloaded or sent anywhere. One on/off switch (buttons with [data-music]) mutes music and effects; the choice is remembered. */
(function () {
  const KEY = "predm.v1.music";
  let on = true; try { on = localStorage.getItem(KEY) !== "off"; } catch { /* storage blocked: default on */ }
  let ctx = null, master = null, timer = 0, playing = false, next = 0, step = 0, drone = null;
  const BPM = 132, E8 = 60 / BPM / 2;
  // A minor pentatonic (the scale of lam / pong lang)
  const SC = [329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
  const PAT = [
    [2, 3, 4, 5, 4, 3, 2, -1], [5, 6, 7, 6, 5, 4, 5, -1], [4, 5, 4, 3, 2, 3, 4, 2], [2, -1, 2, 3, 1, 0, 2, -1],
    [2, 2, 4, 2, 5, 4, 3, -1], [5, 7, 6, 5, 4, 5, 3, -1], [3, 4, 5, 4, 3, 2, 1, 2], [0, 1, 2, -1, 2, 3, 2, -1],
  ];
  const BASS = [110, 110, 98, 110, 110, 130.81, 98, 110];

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function pluck(f, t, vol = 0.5, d = 0.32) { // pong-lang: wooden, quick decay
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = f; o2.type = "sine"; o2.frequency.value = f * 2.01;
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2).connect(g); o.connect(g).connect(master);
    env(g, t, 0.005, vol, d); o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  }
  function drum(t, f0 = 150, vol = 0.9) { // glong: pitch-dropping thump
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    o.connect(g).connect(master); env(g, t, 0.004, vol, 0.22); o.start(t); o.stop(t + 0.3);
  }
  let noiseBuf = null;
  function noise(t, hp = 6000, vol = 0.18, d = 0.06) { // ching / shaker
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; s.connect(f).connect(g).connect(master);
    env(g, t, 0.002, vol, d); s.start(t); s.stop(t + d + 0.05);
  }
  function startDrone() { // khaen-like reedy chord on A and E
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; g.gain.value = 0.0001;
    const os = [220, 329.63, 440].map((f, i) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = i * 4 - 4; o.connect(lp); o.start(); return o; });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4.6; lg.gain.value = 0.012; lfo.connect(lg).connect(g.gain); lfo.start();
    lp.connect(g).connect(master); g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 1.2);
    drone = { g, stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); [...os, lfo].forEach((o) => o.stop(t + 0.5)); } };
  }
  function tick() {
    while (next < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % PAT.length, i = step % 8, n = PAT[bar][i];
      if (n >= 0) pluck(SC[n], next, i % 2 ? 0.32 : 0.45);
      if (i % 4 === 0) { drum(next); pluck(BASS[bar], next, 0.35, 0.45); }
      if (i % 4 === 2) drum(next, 120, 0.45);
      if (i % 2 === 1) noise(next);
      next += E8; step++;
    }
  }
  function start() {
    if (!on || playing || !ac()) return;
    playing = true; step = 0; next = ctx.currentTime + 0.08; startDrone(); tick(); timer = setInterval(tick, 60);
  }
  function stop() { if (!playing) return; playing = false; clearInterval(timer); drone?.stop(); drone = null; }
  const SFX = {
    hover: (t) => pluck(1318.5, t, 0.12, 0.08),
    pick: (t) => { pluck(880, t, 0.5, 0.18); pluck(1318.5, t + 0.08, 0.5, 0.3); },
    ok: (t) => [659.25, 880, 1046.5].forEach((f, i) => pluck(f, t + i * 0.08, 0.45, 0.3)),
    bad: (t) => { pluck(329.63, t, 0.45, 0.25); pluck(311.1, t + 0.12, 0.45, 0.35); },
    pok: (t) => { drum(t, 110, 1); noise(t, 1500, 0.25, 0.05); },
    win: (t) => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => pluck(f, t + i * 0.09, 0.5, 0.4)),
  };
  function sfx(name) { if (!on || !SFX[name] || !ac()) return; SFX[name](ctx.currentTime + 0.01); }
  function paint() { document.querySelectorAll("[data-music]").forEach((b) => { b.textContent = on ? "🎵" : "🔇"; b.setAttribute("aria-pressed", String(on)); b.title = on ? "ปิดเพลง" : "เปิดเพลง"; }); }
  function toggle() {
    on = !on; try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
    if (on) { const inGame = document.querySelector(".fq-modal:not([hidden]), .hk-modal:not([hidden])"); if (inGame) start(); } else stop();
    paint();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-music]")) { e.preventDefault(); e.stopPropagation(); toggle(); } }, true);
  let pend = 0;
  new MutationObserver(() => { if (!pend) pend = requestAnimationFrame(() => { pend = 0; paint(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.PreDMMusic = { start, stop, sfx, toggle, get on() { return on; } };
})();

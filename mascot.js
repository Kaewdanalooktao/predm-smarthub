/* Pre-DM Smart Hub — "น้องอ่อนหวาน", the coach mascot: a soft pink drop (low sugar, "อ่อนหวาน") dressed for exercise:
   sporty headband, wristband, sneakers, a dumbbell she curls and a little sweat drop.
   PreDMMascot.svg({ wave, cls }) returns inline SVG; eyes blink, the dumbbell arm lifts and the free arm waves via CSS (.mz-*). */
(function () {
  let n = 0;
  function svg({ wave = false, cls = "" } = {}) {
    const id = "mz" + ++n;
    return `<svg class="mz ${cls}" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3c6"/><stop offset="1" stop-color="#ff7d9f"/></linearGradient>
    <radialGradient id="${id}h" cx=".35" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="60" cy="116" rx="32" ry="4" fill="#2a2340" opacity=".12"/>
  <!-- free arm (waves) with wristband -->
  <g class="mz-arm-l${wave ? " mz-wave" : ""}"><path d="M28 80c-9-4-14-11-15-19" stroke="#ff7d9f" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M10.5 66.5l8.5-3.2" stroke="#22a06b" stroke-width="5" stroke-linecap="round"/><circle cx="13" cy="58" r="6.5" fill="#ffb3c6"/></g>
  <!-- body -->
  <path d="M60 8C77 32 99 50 99 74a39 39 0 0 1-78 0C21 50 43 32 60 8z" fill="url(#${id}b)"/>
  <path d="M60 8C77 32 99 50 99 74a39 39 0 0 1-78 0C21 50 43 32 60 8z" fill="url(#${id}h)"/>
  <!-- sneakers -->
  <g class="mz-shoes" transform="translate(0 4)">
    <path d="M33 104c0-6 5-9 11-9s12 3 13 9v3H33z" fill="#fff" stroke="#e3e6ef" stroke-width="1.2"/><path d="M33 105h24v3.5a2 2 0 0 1-2 2H35a2 2 0 0 1-2-2z" fill="#5b8cff"/>
    <path d="M40 98l6 3M43 96.5l5 3" stroke="#ff6f93" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M63 104c1-6 7-9 13-9s11 3 11 9v3H63z" fill="#fff" stroke="#e3e6ef" stroke-width="1.2"/><path d="M63 105h24v3.5a2 2 0 0 1-2 2H65a2 2 0 0 1-2-2z" fill="#5b8cff"/>
    <path d="M72 96.5l5 3M75 98l6 3" stroke="#ff6f93" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <!-- headband -->
  <path d="M27 56c20-9 46-9 66 0l-2 9c-19-8-43-8-62 0z" fill="#22a06b"/>
  <path d="M90 58l12-6-4 10 6 6-13-3z" fill="#22a06b"/>
  <path d="M33 58c16-6 38-6 54 0" stroke="#fff" stroke-width="1.6" stroke-opacity=".55" fill="none"/>
  <!-- face -->
  <g class="mz-eyes"><ellipse cx="47" cy="77" rx="5.6" ry="7" fill="#2a2340"/><ellipse cx="73" cy="77" rx="5.6" ry="7" fill="#2a2340"/>
    <circle cx="49" cy="74" r="2" fill="#fff"/><circle cx="75" cy="74" r="2" fill="#fff"/></g>
  <ellipse cx="37" cy="88" rx="6" ry="3.6" fill="#ff4f7b" opacity=".38"/><ellipse cx="83" cy="88" rx="6" ry="3.6" fill="#ff4f7b" opacity=".38"/>
  <path d="M52 88q8 9 16 0" fill="#c2304f"/><path d="M55 90.5q5 3.5 10 0" fill="#ff8fa8"/>
  <!-- sweat drop -->
  <path class="mz-sweat" d="M24 44c3 4 5 6 5 8.5a5 5 0 0 1-10 0c0-2.5 2-4.5 5-8.5z" fill="#8fd0ff" stroke="#5aa9e6" stroke-width="1"/>
  <!-- dumbbell arm (curls) -->
  <g class="mz-lift"><path d="M93 82c7-3 11-9 12-16" stroke="#ff7d9f" stroke-width="9" stroke-linecap="round" fill="none"/>
    <g transform="rotate(-20 105 60)"><rect x="94" y="58" width="22" height="4" rx="2" fill="#6b7280"/>
      <rect x="90" y="52" width="6" height="16" rx="2.5" fill="#7a5cff"/><rect x="114" y="52" width="6" height="16" rx="2.5" fill="#7a5cff"/>
      <rect x="86.5" y="54.5" width="4" height="11" rx="1.8" fill="#9b84ff"/><rect x="119.5" y="54.5" width="4" height="11" rx="1.8" fill="#9b84ff"/></g>
    <circle cx="105" cy="62" r="6.5" fill="#ffb3c6"/></g>
  <!-- sparkle -->
  <path d="M84 20l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd166"/>
</svg>`;
  }
  window.PreDMMascot = { svg, name: "น้องอ่อนหวาน" };
})();

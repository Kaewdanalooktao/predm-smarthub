/* Pre-DM Smart Hub — large-text mode for older users. Loaded in <head> so the page never flashes small text.
   Three sizes: ปกติ / ใหญ่ / ใหญ่มาก. All app styles use rem, so one root size scales every page. Saved on this device. */
(function () {
  const KEY = "predm.v1.fontScale", SIZES = ["ปกติ", "ใหญ่", "ใหญ่มาก"];
  let lv = 0; try { lv = Math.max(0, Math.min(2, JSON.parse(localStorage.getItem(KEY)) || 0)); } catch { /* storage blocked */ }
  const apply = () => { const h = document.documentElement; h.classList.remove("fs-1", "fs-2"); if (lv) h.classList.add("fs-" + lv); paint(); };
  function paint() { document.querySelectorAll("[data-fontsize]").forEach((b) => { b.dataset.lv = lv; b.setAttribute("aria-label", `ขนาดตัวอักษร: ${SIZES[lv]} (แตะเพื่อเปลี่ยน)`); b.title = `ขนาดตัวอักษร: ${SIZES[lv]}`; const t = b.querySelector(".fs-t"); if (t) t.textContent = `ขนาดตัวอักษร: ${SIZES[lv]}`; }); }
  function cycle() { lv = (lv + 1) % 3; try { localStorage.setItem(KEY, JSON.stringify(lv)); } catch { /* ignore */ } apply(); window.PreDM?.toast?.(`ขนาดตัวอักษร: ${SIZES[lv]}`); }
  apply();
  const ICON = '<span class="fs-ic" aria-hidden="true">ก<small>ก</small></span>';
  function addButtons() { // one next to every light/dark button (sidebar, top bar, phone bar); pages without one get a floating button
    const themes = document.querySelectorAll(".theme-btn");
    themes.forEach((t) => { if (t.previousElementSibling?.matches?.("[data-fontsize]")) return; const b = document.createElement("button"); b.type = "button"; b.dataset.fontsize = ""; b.className = t.className.replace("theme-btn", "fs-btn"); b.innerHTML = ICON + (t.classList.contains("nav-btn") ? '<span class="fs-t"></span>' : ""); t.before(b); });
    if (!themes.length && !document.querySelector("[data-fontsize]")) { const b = document.createElement("button"); b.type = "button"; b.dataset.fontsize = ""; b.className = "fs-float"; b.innerHTML = ICON; document.body.appendChild(b); }
    paint();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-fontsize]")) { e.preventDefault(); cycle(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButtons); else addButtons();
  window.PreDMFont = { cycle, get level() { return lv; } };
})();

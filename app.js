/* Mosaic Bookcase Planner — plain JavaScript, no build step. */
(function () {
  "use strict";

  var STORAGE_KEY = "mosaic-bookcase-planner-v1";
  var PROGRESS_PREFIX = "mosaic-bookcase-progress:";
  var CHART_ROWS = 31;      // rows in every chart
  var BODY = 40;            // body stitches per chart
  var SHELF_ROWS = 3;       // SC rows between chart rows
  var PX = 8;               // canvas pixels per stitch

  var DEFAULTS = {
    cols: 4, rows: 6,
    colours: { A: "#2f5d9e", B: "#ffffff", C: "#7a4a2a" },
    shelf: "A", symbols: false, names: true, locked: false, view: "design",
    grid: [] // grid[chartRow][col]: chart name or null. chartRow 0 = bottom, col 0 = left.
  };

  var charts = [], byName = {}, byId = {}, issuesByChart = {}, validation = [], corrections = [];
  var state = loadLocal();
  var armedChart = null;    // chart chosen by tapping in the library (phone-friendly)

  var $ = function (id) { return document.getElementById(id); };
  function clampInt(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }

  /* ================= saving: this device + the page link ================= */
  function loadLocal() {
    var s = null;
    try { s = JSON.parse(lsGet(STORAGE_KEY)); } catch (e) { s = null; }
    var st = JSON.parse(JSON.stringify(DEFAULTS));
    if (s && typeof s === "object") {
      if (s.cols >= 1) st.cols = clampInt(s.cols, 1, 10);
      if (s.rows >= 1) st.rows = clampInt(s.rows, 1, 12);
      if (s.colours) ["A", "B", "C"].forEach(function (k) { if (/^#[0-9a-f]{6}$/i.test(s.colours[k] || "")) st.colours[k] = s.colours[k]; });
      if (s.shelf === "C") st.shelf = "C";
      st.symbols = !!s.symbols;
      st.names = s.names !== false;
      st.locked = !!s.locked;
      if (Array.isArray(s.grid)) st.grid = s.grid;
    }
    return st;
  }

  // The page address holds the whole layout, so a bookmark or Home Screen icon reopens it exactly.
  // ?l=4x6~1.2.2r.3~...  (chart rows bottom to top, charts left to right, "-" = empty)
  function layoutCode() {
    var parts = [state.cols + "x" + state.rows];
    for (var r = 0; r < state.rows; r++) {
      var ids = [];
      for (var c = 0; c < state.cols; c++) { var n = getCell(r, c); ids.push(n && byName[n] ? byName[n].id : "-"); }
      parts.push(ids.join("."));
    }
    return parts.join("~");
  }
  function buildUrl() {
    var p = new URLSearchParams();
    p.set("l", layoutCode());
    p.set("s", state.shelf);
    p.set("k", [state.colours.A, state.colours.B, state.colours.C].map(function (h) { return h.slice(1); }).join("."));
    if (state.locked) p.set("lock", "1");
    if (state.view === "track") p.set("view", "track");
    return location.pathname + "?" + p.toString().replace(/%7E/gi, "~");
  }
  function applyUrl() {
    var p = new URLSearchParams(location.search);
    var l = p.get("l");
    if (l) {
      var parts = l.split("~"), m = /^(\d+)x(\d+)$/.exec(parts[0] || "");
      if (m) {
        state.cols = clampInt(m[1], 1, 10); state.rows = clampInt(m[2], 1, 12);
        state.grid = [];
        for (var r = 0; r < state.rows; r++) {
          var ids = (parts[r + 1] || "").split(".");
          state.grid[r] = [];
          for (var c = 0; c < state.cols; c++) state.grid[r][c] = byId[ids[c]] ? byId[ids[c]].name : null;
        }
      }
    }
    if (p.get("s") === "C" || p.get("s") === "A") state.shelf = p.get("s");
    var k = (p.get("k") || "").split(".");
    ["A", "B", "C"].forEach(function (key, i) { if (/^[0-9a-f]{6}$/i.test(k[i] || "")) state.colours[key] = "#" + k[i].toLowerCase(); });
    if (p.has("l")) state.locked = p.get("lock") === "1";
    state.view = p.get("view") === "track" ? "track" : "design";
  }
  function save() {
    lsSet(STORAGE_KEY, JSON.stringify(state));
    try { history.replaceState(null, "", buildUrl()); } catch (e) { /* ignore */ }
  }

  /* Resize the grid, keeping placements that still fit (anchored at bottom-left). */
  function normaliseGrid() {
    var g = [];
    for (var r = 0; r < Math.max(state.rows, state.grid.length); r++) {
      var old = state.grid[r] || [];
      g[r] = [];
      for (var c = 0; c < Math.max(state.cols, old.length); c++) {
        var v = old[c];
        g[r][c] = (v && byName[v]) ? v : null;
      }
    }
    state.grid = g;
  }
  function getCell(r, c) { return (state.grid[r] && state.grid[r][c]) || null; }
  function setCell(r, c, name) { state.grid[r] = state.grid[r] || []; state.grid[r][c] = name || null; }

  /* ================= chart maths ================= */
  // 40 flags per row, index 0 = stitch 1 (worked first, drawn on the right).
  function expandRow(row) {
    var out = [];
    row.body.forEach(function (p) { for (var i = 0; i < p[0]; i++) out.push(p[1] === "DC"); });
    while (out.length < BODY) out.push(false);
    return out.slice(0, BODY);
  }
  // Mosaic rule: a cell takes the colour of the row directly above it when that row has a DC in the
  // same column; otherwise its own row's colour. Row 31 has nothing above it inside the chart.
  var colourCache = {};
  function chartColours(chart) {
    if (colourCache[chart.name]) return colourCache[chart.name];
    var dc = chart.rows.map(expandRow), col = [];
    for (var r = 0; r < CHART_ROWS; r++) {
      col[r] = [];
      for (var s = 0; s < BODY; s++) {
        var above = r + 1 < CHART_ROWS && dc[r + 1][s];
        col[r][s] = above ? chart.rows[r + 1].colour : chart.rows[r].colour;
      }
    }
    return (colourCache[chart.name] = { colours: col, dc: dc });
  }
  // Draw one chart into ctx at (ox, oy) with px pixels per stitch.
  function paintChart(ctx, chart, ox, oy, px, symbols) {
    var data = chartColours(chart);
    for (var r = 0; r < CHART_ROWS; r++) {
      var y = oy + (CHART_ROWS - 1 - r) * px;          // row 1 at the bottom
      for (var s = 0; s < BODY; s++) {
        ctx.fillStyle = state.colours[data.colours[r][s]];
        ctx.fillRect(ox + (BODY - 1 - s) * px, y, px, px);   // stitch 1 on the right
      }
    }
    if (!symbols) return;
    ctx.lineWidth = Math.max(1, px / 7);
    for (var r2 = 0; r2 < CHART_ROWS; r2++) {
      var y2 = oy + (CHART_ROWS - 1 - r2) * px;
      for (var s2 = 0; s2 < BODY; s2++) {
        if (!data.dc[r2][s2]) continue;
        var x2 = ox + (BODY - 1 - s2) * px, m = px * 0.2;
        ctx.strokeStyle = contrastFor(state.colours[data.colours[r2][s2]]);
        ctx.beginPath();
        ctx.moveTo(x2 + m, y2 + m); ctx.lineTo(x2 + px - m, y2 + px - m);
        ctx.moveTo(x2 + px - m, y2 + m); ctx.lineTo(x2 + m, y2 + px - m);
        ctx.stroke();
      }
    }
  }
  function drawChart(canvas, chart) {
    canvas.width = BODY * PX; canvas.height = CHART_ROWS * PX;
    paintChart(canvas.getContext("2d"), chart, 0, 0, PX, state.symbols);
  }
  function contrastFor(hex) {
    var n = parseInt(hex.slice(1), 16);
    var l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return l > 150 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
  }

  /* ================= row numbering + pattern model ================= */
  function rowWidth() { return BODY * state.cols + 3; }
  function chartRowStart(cr) { return 1 + cr * (CHART_ROWS + SHELF_ROWS); }
  function totalRows() { return state.rows * CHART_ROWS + (state.rows - 1) * SHELF_ROWS + 1; }
  function missingCells() {
    var m = [];
    for (var r = 0; r < state.rows; r++) for (var c = 0; c < state.cols; c++) if (!getCell(r, c)) m.push("chart row " + (r + 1) + ", column " + (c + 1));
    return m;
  }
  function s41Count(row) { var m = /^(\d+)/.exec(row.stitch41); return m ? +m[1] : 0; }
  function bodyCount(row) { return row.body.reduce(function (a, p) { return a + p[0]; }, 0); }
  function bodyText(row) { return "(" + row.body.map(function (p) { return p[0] + p[1]; }).join(" ") + ")"; }

  // Every row of the blanket, bottom to top. Used by both the written pattern and the follow-along view.
  function buildRows() {
    var W = rowWidth(), out = [], n = 1;
    for (var cr = 0; cr < state.rows; cr++) {
      if (cr > 0) for (var k = 0; k < SHELF_ROWS; k++) out.push({ n: n++, kind: "shelf", colour: state.shelf, shelfIndex: k, shelfStart: n - 1 - k, width: W });
      var row = [];
      for (var c = 0; c < state.cols; c++) row.push(byName[getCell(cr, c)]);
      var work = row.slice().reverse();               // rightmost chart is worked first
      for (var i = 0; i < CHART_ROWS; i++) {
        var colours = {};
        work.forEach(function (ch) { colours[ch.rows[i].colour] = true; });
        var lrow = row[0].rows[i];
        var count = 2 + s41Count(lrow) + work.reduce(function (a, ch) { return a + bodyCount(ch.rows[i]); }, 0);
        out.push({ n: n++, kind: "chart", chartRow: cr, chartRowNum: i + 1, colour: work[0].rows[i].colour,
          mixed: Object.keys(colours).length > 1, work: work, s41: lrow.stitch41, count: count, width: W });
      }
    }
    out.push({ n: n, kind: "final", colour: "A", width: W });
    return out;
  }
  function rowText(r) {
    return "BS " + r.work.map(function (ch) { return bodyText(ch.rows[r.chartRowNum - 1]); }).join(" ") + " " + r.s41 + " BS";
  }

  /* ================= design view rendering ================= */
  function renderStats() { $("stats").textContent = rowWidth() + " stitches per row · " + totalRows() + " rows in total"; }

  function renderLibrary() {
    var ul = $("library");
    ul.innerHTML = "";
    charts.forEach(function (ch) {
      var li = document.createElement("li");
      li.className = "lib-item" + (armedChart === ch.name ? " armed-item" : "");
      li.dataset.chart = ch.name;
      var img = document.createElement("img");
      img.alt = ""; img.draggable = false;
      img.src = "images/charts/" + encodeURIComponent(ch.name) + ".png";
      img.onerror = function () { img.remove(); };
      li.appendChild(img);
      var span = document.createElement("span");
      span.textContent = ch.name;
      li.appendChild(span);
      if (issuesByChart[ch.name]) {
        var f = document.createElement("span");
        f.className = "flag"; f.textContent = "!"; f.title = "Some rows didn’t pass the data check.";
        li.appendChild(f);
      }
      ul.appendChild(li);
    });
  }

  function band(colourKey, nRows, title) {
    var d = document.createElement("div");
    d.className = "band";
    d.style.background = state.colours[colourKey];
    d.style.aspectRatio = (BODY * state.cols) + " / " + nRows;
    d.title = title;
    return d;
  }
  function rowLabel(text) { var d = document.createElement("div"); d.className = "rowlabel"; d.textContent = text; return d; }

  var TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  function renderBlanket() {
    var b = $("blanket");
    b.innerHTML = "";
    b.style.gridTemplateColumns = "repeat(" + state.cols + ", 1fr)";
    b.classList.toggle("no-names", !state.names);
    var fitW = window.innerHeight * 0.82 * (BODY * state.cols) / (totalRows() + state.rows * 4);
    b.style.maxWidth = Math.max(300, Math.round(fitW)) + "px";
    var top = totalRows();
    b.appendChild(rowLabel("Row " + top + ": final row, SC in colour A"));
    b.appendChild(band("A", 1, "Row " + top + ": final SC row (colour A)"));
    for (var cr = state.rows - 1; cr >= 0; cr--) {
      var start = chartRowStart(cr);
      b.appendChild(rowLabel("Chart row " + (cr + 1) + " · rows " + start + "–" + (start + CHART_ROWS - 1)));
      for (var c = 0; c < state.cols; c++) b.appendChild(makeCell(cr, c));
      if (cr > 0) {
        var s0 = start - SHELF_ROWS;
        b.appendChild(rowLabel("Shelf · rows " + s0 + "–" + (s0 + 2)));
        b.appendChild(band(state.shelf, SHELF_ROWS, "Shelf rows " + s0 + "–" + (s0 + 2)));
      }
    }
  }

  function makeCell(r, c) {
    var d = document.createElement("div");
    d.dataset.r = r; d.dataset.c = c;
    var name = getCell(r, c);
    if (!name) {
      d.className = "cell empty";
      d.textContent = state.locked ? "" : (armedChart ? "Tap to place" : "+ Add chart");
      return d;
    }
    d.className = "cell";
    var cv = document.createElement("canvas");
    drawChart(cv, byName[name]);
    d.appendChild(cv);
    var lab = document.createElement("span");
    lab.className = "label"; lab.textContent = name;
    d.appendChild(lab);
    if (issuesByChart[name]) { var w = document.createElement("span"); w.className = "warn"; w.textContent = "!"; d.appendChild(w); }
    var t = document.createElement("button");
    t.type = "button"; t.className = "trash"; t.title = "Remove " + name; t.setAttribute("aria-label", "Remove " + name);
    t.innerHTML = TRASH_SVG;
    d.appendChild(t);
    d.title = name + " (chart row " + (r + 1) + ", column " + (c + 1) + " from the left)";
    return d;
  }

  function renderArmed() {
    var a = $("armed");
    if (!armedChart || state.locked) { a.hidden = true; a.innerHTML = ""; return; }
    a.hidden = false; a.innerHTML = "";
    var t = document.createElement("span");
    t.textContent = "Placing “" + armedChart + "”: tap any spot on the blanket.";
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ghost"; btn.textContent = "Done";
    btn.onclick = function () { armedChart = null; renderAll(); };
    a.appendChild(t); a.appendChild(btn);
  }

  function renderLockState() {
    document.body.classList.toggle("locked", state.locked);
    $("lock").checked = state.locked;
    $("lockNote").hidden = !state.locked;
    ["cols", "rows", "clearAll"].forEach(function (id) { $(id).disabled = state.locked; });
    if (state.locked) armedChart = null;
  }

  function renderDataCheck() {
    var body = $("dataCheckBody"), html = "";
    if (!validation.length) html += "<p>Every row in every chart has 40 body stitches, only SC and DC, and alternating colours. No problems found.</p>";
    else {
      html += "<p>These rows don’t pass the check. They are shown as printed in the PDF.</p><table><thead><tr><th>Chart</th><th>Row</th><th>Problem</th><th>As printed</th></tr></thead><tbody>";
      validation.forEach(function (v) { html += "<tr><td>" + esc(v.chart) + "</td><td>" + v.row + "</td><td>" + esc(v.issue) + "</td><td><code>" + esc(v.text) + "</code></td></tr>"; });
      html += "</tbody></table>";
    }
    if (corrections.length) {
      html += "<p>" + corrections.length + " rows had typos in the PDF and were corrected:</p><table><thead><tr><th>Chart</th><th>Row</th><th>Printed</th><th>Corrected</th></tr></thead><tbody>";
      corrections.forEach(function (v) { html += "<tr><td>" + esc(v.chart) + "</td><td>" + v.row + "</td><td><code>" + esc(v.printed) + "</code></td><td><code>" + esc(v.corrected) + "</code></td></tr>"; });
      html += "</tbody></table>";
    }
    body.innerHTML = html;
    $("dataCheck").querySelector("summary").textContent = validation.length
      ? "Data check (" + validation.length + " issue" + (validation.length === 1 ? "" : "s") + ")"
      : "Data check (all rows OK" + (corrections.length ? ", " + corrections.length + " PDF typos corrected" : "") + ")";
  }

  function renderAll() { renderLockState(); renderStats(); renderLibrary(); renderArmed(); renderBlanket(); }

  /* ================= toast ================= */
  var toastTimer = null;
  function toast(msg, actionLabel, action) {
    var t = $("toast");
    t.innerHTML = "";
    var s = document.createElement("span"); s.textContent = msg; t.appendChild(s);
    if (actionLabel) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = actionLabel;
      b.onclick = function () { t.hidden = true; action(); };
      t.appendChild(b);
    }
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, actionLabel ? 6000 : 3500);
  }

  /* ================= controls ================= */
  function syncInputs() {
    $("cols").value = state.cols; $("rows").value = state.rows;
    $("colA").value = state.colours.A; $("colB").value = state.colours.B; $("colC").value = state.colours.C;
    $("shelf").value = state.shelf; $("symbols").checked = state.symbols; $("names").checked = state.names;
  }
  function bindControls() {
    syncInputs();
    function sizeChange() {
      state.cols = clampInt($("cols").value, 1, 10);
      state.rows = clampInt($("rows").value, 1, 12);
      normaliseGrid(); save(); renderAll();
    }
    $("cols").addEventListener("change", sizeChange);
    $("rows").addEventListener("change", sizeChange);
    ["A", "B", "C"].forEach(function (k) {
      $("col" + k).addEventListener("input", function (e) { state.colours[k] = e.target.value; save(); renderBlanket(); });
    });
    $("shelf").addEventListener("change", function (e) { state.shelf = e.target.value; save(); renderBlanket(); });
    $("symbols").addEventListener("change", function (e) { state.symbols = e.target.checked; save(); renderBlanket(); });
    $("names").addEventListener("change", function (e) { state.names = e.target.checked; save(); renderBlanket(); });
    $("lock").addEventListener("change", function (e) { state.locked = e.target.checked; save(); renderAll(); });
    $("clearAll").addEventListener("click", function () {
      if (!confirm("Remove every chart from the blanket?")) return;
      state.grid = []; normaliseGrid(); save(); renderAll();
    });
    $("copyLink").addEventListener("click", function () {
      save();
      copyText(location.href, function (ok) {
        toast(ok ? "Link copied. Open it any time to get this exact layout back." : "Couldn’t copy. Copy the address from the address bar instead.");
      });
    });
    $("finish").addEventListener("click", finish);
    $("startTrack").addEventListener("click", function () { setView("track"); });
    $("closeResult").addEventListener("click", function () { $("result").close(); });
    $("copy").addEventListener("click", function () {
      copyText($("patternText").textContent, function (ok) { $("copyMsg").textContent = ok ? "Copied to the clipboard." : "Couldn’t copy automatically. Select the text and copy it."; });
    });
    $("download").addEventListener("click", downloadPattern);
    $("tabDesign").addEventListener("click", function () { setView("design"); });
    $("tabTrack").addEventListener("click", function () { setView("track"); });
    $("blanket").addEventListener("click", function (e) {
      var t = e.target.closest(".trash");
      if (!t || state.locked) return;
      var cell = t.closest(".cell"), r = +cell.dataset.r, c = +cell.dataset.c, name = getCell(r, c);
      setCell(r, c, null); save(); renderBlanket();
      toast("Removed " + name + ".", "Undo", function () { setCell(r, c, name); save(); renderBlanket(); });
    });
  }

  function setView(v) {
    state.view = v;
    $("viewDesign").hidden = v !== "design";
    $("viewTrack").hidden = v !== "track";
    $("tabDesign").setAttribute("aria-pressed", v === "design");
    $("tabTrack").setAttribute("aria-pressed", v === "track");
    save();
    if (v === "track") renderTrack(); else { releaseWake(); renderAll(); }
    window.scrollTo(0, 0);
  }

  /* ================= picker (tap a spot) ================= */
  var pickerTarget = null;
  function openPicker(r, c) {
    pickerTarget = { r: r, c: c };
    var sel = $("pickerSelect");
    sel.innerHTML = "";
    var none = document.createElement("option"); none.value = ""; none.textContent = "— empty —"; sel.appendChild(none);
    charts.forEach(function (ch) { var o = document.createElement("option"); o.value = ch.name; o.textContent = ch.name; sel.appendChild(o); });
    sel.value = getCell(r, c) || "";
    $("pickerTitle").textContent = "Chart row " + (r + 1) + ", column " + (c + 1) + " from the left";
    $("picker").showModal();
  }
  function bindPicker() {
    $("picker").addEventListener("close", function () {
      var v = $("picker").returnValue;
      if (!pickerTarget) return;
      if (v === "ok") setCell(pickerTarget.r, pickerTarget.c, $("pickerSelect").value || null);
      else if (v === "clear") setCell(pickerTarget.r, pickerTarget.c, null);
      pickerTarget = null;
      save(); renderBlanket();
    });
  }

  /* ================= drag and drop (mouse, pen and touch) ================= */
  var drag = null;
  function sourceFrom(el) {
    var li = el.closest(".lib-item");
    if (li) return { el: li, type: "lib", name: li.dataset.chart };
    var cell = el.closest(".cell");
    if (cell) return { el: cell, type: "cell", r: +cell.dataset.r, c: +cell.dataset.c, name: getCell(+cell.dataset.r, +cell.dataset.c) };
    return null;
  }
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (state.locked || state.view !== "design" || e.target.closest(".trash")) return;
    var src = sourceFrom(e.target);
    if (!src) return;
    drag = { src: src, x: e.clientX, y: e.clientY, started: false, touch: e.pointerType === "touch", timer: null, ghost: null, over: null };
    if (drag.touch && src.name) drag.timer = setTimeout(function () { if (drag) startDrag(drag.x, drag.y); }, 300);
  }
  function startDrag(x, y) {
    if (!drag.src.name) return;
    drag.started = true;
    var g = document.createElement("div");
    g.className = "ghost-drag"; g.textContent = drag.src.name;
    document.body.appendChild(g);
    drag.ghost = g;
    if (drag.src.type === "cell") drag.src.el.classList.add("dragging");
    var d0 = drag;
    d0.scroller = setInterval(function () {   // scroll when held near the top/bottom edge
      if (drag !== d0) { clearInterval(d0.scroller); return; }
      var edge = 70, step = 0;
      if (d0.lastY < edge) step = -14; else if (d0.lastY > window.innerHeight - edge) step = 14;
      if (step) { window.scrollBy(0, step); moveGhost(d0.lastX, d0.lastY); }
    }, 16);
    moveGhost(x, y);
  }
  function moveGhost(x, y) {
    drag.lastX = x; drag.lastY = y;
    drag.ghost.style.left = x + "px"; drag.ghost.style.top = y + "px";
    var el = document.elementFromPoint(x, y);
    var cell = el && el.closest(".cell");
    if (drag.over && drag.over !== cell) drag.over.classList.remove("drop-target");
    drag.over = cell || null;
    if (cell) cell.classList.add("drop-target");
  }
  function onMove(e) {
    if (!drag) return;
    var dist = Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    if (!drag.started) {
      if (drag.touch) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; }
      if (dist > 6) startDrag(e.clientX, e.clientY); else return;
    }
    if (drag && drag.started) moveGhost(e.clientX, e.clientY);
  }
  function onUp(e) {
    if (!drag) return;
    var d = drag; drag = null;
    clearTimeout(d.timer); clearInterval(d.scroller);
    if (d.started) {
      if (d.ghost) d.ghost.remove();
      d.src.el.classList.remove("dragging");
      if (d.over) d.over.classList.remove("drop-target");
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var cell = el && el.closest(".cell");
      if (cell) {
        var r = +cell.dataset.r, c = +cell.dataset.c;
        if (d.src.type === "lib") setCell(r, c, d.src.name);
        else if (r !== d.src.r || c !== d.src.c) { var other = getCell(r, c); setCell(r, c, d.src.name); setCell(d.src.r, d.src.c, other); }
        save(); renderBlanket();
      }
      return;
    }
    if (d.src.type === "lib") { armedChart = armedChart === d.src.name ? null : d.src.name; renderAll(); }
    else if (armedChart) { setCell(d.src.r, d.src.c, armedChart); save(); renderBlanket(); }
    else openPicker(d.src.r, d.src.c);
  }
  function onCancel() {
    if (!drag) return;
    clearTimeout(drag.timer); clearInterval(drag.scroller);
    if (drag.ghost) drag.ghost.remove();
    if (drag.src && drag.src.el) drag.src.el.classList.remove("dragging");
    if (drag.over) drag.over.classList.remove("drop-target");
    drag = null;
  }
  function bindDrag() {
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", function (e) { if (drag && drag.started) e.preventDefault(); }, { passive: false });
    document.addEventListener("contextmenu", function (e) { if (drag) e.preventDefault(); });
    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (drag) return; if (state.view === "design") renderBlanket(); else drawMini(); }, 200);
    });
  }

  /* ================= written pattern ================= */
  function buildPattern() {
    var W = rowWidth(), missing = missingCells();
    if (missing.length) return { error: "Every spot needs a chart before the pattern can be written. Empty: " + missing.join("; ") + "." };
    var shelfName = state.shelf === "C" ? "Colour C" : "Colour A";
    var lines = [], notes = [], used = {};
    lines.push("MOSAIC BOOKCASE BLANKET — WRITTEN PATTERN (US terms)");
    lines.push("Charts: Zigz Crochet, Mosaic Bookcase Extended Version");
    lines.push("Size: " + state.cols + " charts across × " + state.rows + " chart rows · " + W + " stitches per row · " + totalRows() + " rows");
    lines.push("Colours: A = " + state.colours.A + ", B = " + state.colours.B + (state.shelf === "C" ? ", C = " + state.colours.C + " (shelves)" : "") + " · Shelves: " + shelfName);
    lines.push("Abbreviations: SC = single crochet, DC = double crochet, BS = border stitch.");
    lines.push("Work every row right to left. Each bracket is one chart (40 stitches), rightmost chart first.");
    lines.push("Layout link: " + location.origin + buildUrl());
    lines.push("");
    lines.push("Layout (bottom to top, each line listed left to right as you look at the blanket):");
    for (var lr = 0; lr < state.rows; lr++) {
      var names = []; for (var lc = 0; lc < state.cols; lc++) names.push(getCell(lr, lc));
      lines.push("  Chart row " + (lr + 1) + ": " + names.join(" | "));
    }
    buildRows().forEach(function (r) {
      if (r.kind === "shelf") {
        if (r.shelfIndex === 0) { lines.push(""); lines.push("Rows " + r.n + "–" + (r.n + SHELF_ROWS - 1) + ": " + SHELF_ROWS + " rows SC (" + shelfName + "), " + W + " st each"); }
        return;
      }
      if (r.kind === "final") { lines.push(""); lines.push("Row " + r.n + " (A): SC in every stitch across  [" + W + " st]"); lines.push(""); lines.push("Fasten off. Total rows: " + r.n + "."); return; }
      if (r.chartRowNum === 1) { lines.push(""); lines.push("— Chart row " + (r.chartRow + 1) + " —"); }
      r.work.forEach(function (ch) { used[ch.name] = true; });
      if (r.mixed) notes.push("Row " + r.n + ": the charts in this row don’t agree on the colour. Showing " + r.colour + ".");
      var line = "Row " + r.n + " (" + r.colour + "): " + rowText(r) + "  [" + r.count + " st]";
      if (r.count !== W) line += "  ← check: expected " + W;
      lines.push(line);
    });
    var flagged = validation.filter(function (v) { return used[v.chart]; });
    if (flagged.length || notes.length) {
      lines.push(""); lines.push("NOTES — please check before you crochet:");
      flagged.forEach(function (v) { lines.push("  " + v.chart + ", chart row " + v.row + ": " + v.issue + ". Printed as: " + v.text); });
      notes.forEach(function (t) { lines.push("  " + t); });
    }
    return { text: lines.join("\n") };
  }
  function finish() {
    var res = buildPattern();
    if (res.error) { alert(res.error); return; }
    $("patternText").textContent = res.text;
    $("copyMsg").textContent = "";
    $("result").showModal();
  }
  function copyText(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { cb(true); }, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove(); cb(ok);
    }
  }
  function downloadPattern() {
    var blob = new Blob([$("patternText").textContent], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "mosaic-bookcase-pattern.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ================= follow-along view ================= */
  // One step = one section of one row (a single chart's 40 stitches), or one shelf / final row.
  var steps = [], rowsModel = [], progress = { step: 0, done: 0 };

  function progressKey() { return PROGRESS_PREFIX + layoutCode() + "|" + state.shelf; }
  function loadProgress() {
    var p = null;
    try { p = JSON.parse(lsGet(progressKey())); } catch (e) { p = null; }
    progress = (p && typeof p.step === "number") ? { step: p.step, done: p.done || 0 } : { step: 0, done: 0 };
    progress.step = Math.max(0, Math.min(steps.length - 1, progress.step));
  }
  function saveProgress() { lsSet(progressKey(), JSON.stringify(progress)); }

  function buildSteps() {
    steps = []; rowsModel = buildRows();
    rowsModel.forEach(function (r) {
      if (r.kind !== "chart") {
        steps.push({ row: r, tokens: [{ t: "SC across", n: r.width, plain: true }] });
        return;
      }
      var nSec = r.work.length;
      r.work.forEach(function (ch, s) {
        var cr = ch.rows[r.chartRowNum - 1], tokens = [];
        if (s === 0) tokens.push({ t: "BS", n: 1 });
        tokens.push({ open: true });
        cr.body.forEach(function (p) { tokens.push({ t: p[0] + p[1], n: p[0] }); });
        tokens.push({ close: true });
        if (s === nSec - 1) { tokens.push({ t: r.s41, n: s41Count(cr) }); tokens.push({ t: "BS", n: 1 }); }
        steps.push({ row: r, section: s, sections: nSec, chart: ch, tokens: tokens });
      });
    });
  }
  function stitchTokens(step) { return step.tokens.filter(function (t) { return t.t; }); }

  function renderTrack() {
    var missing = missingCells();
    $("trackEmpty").hidden = !missing.length;
    $("trackBody").hidden = !!missing.length;
    if (missing.length) {
      $("trackEmpty").innerHTML = "Fill every spot on the blanket first (" + missing.length + " empty). Then come back here to follow the pattern row by row.";
      return;
    }
    buildSteps(); loadProgress(); renderStep(); requestWake();
  }

  function renderStep() {
    var step = steps[progress.step], r = step.row, toks = stitchTokens(step);
    progress.done = Math.max(0, Math.min(toks.length, progress.done));
    var total = rowsModel.length;
    $("progressFill").style.width = ((progress.step + progress.done / Math.max(1, toks.length)) / steps.length * 100).toFixed(1) + "%";
    $("progressText").textContent = "Row " + r.n + " of " + total + " · " + Math.floor((r.n - 1) / total * 100) + "% of rows done";
    $("yarn").style.background = state.colours[r.colour === "C" ? "C" : r.colour];
    $("rowTitle").textContent = "Row " + r.n;
    var colourName = "Colour " + r.colour;
    if (r.kind === "chart") {
      $("rowSub").textContent = colourName + " · chart row " + (r.chartRow + 1) + ", row " + r.chartRowNum + " of 31";
      $("sectionLine").innerHTML = "Section <b>" + (step.section + 1) + " of " + step.sections + "</b>" +
        (step.sections > 1 ? (step.section === 0 ? " (rightmost)" : step.section === step.sections - 1 ? " (leftmost)" : "") : "") +
        " · <b>" + esc(step.chart.name) + "</b>";
    } else if (r.kind === "shelf") {
      $("rowSub").textContent = colourName + " · shelf row " + (r.shelfIndex + 1) + " of 3";
      $("sectionLine").innerHTML = "<b>Shelf</b> · single crochet in every stitch";
    } else {
      $("rowSub").textContent = colourName + " · last row of the blanket";
      $("sectionLine").innerHTML = "<b>Final row</b> · single crochet in every stitch";
    }

    // instruction chips
    var box = $("instr"), pieces = [], i = 0, doneSt = 0, totalSt = 0, openNext = false;
    step.tokens.forEach(function (t) {
      if (t.open) { openNext = true; return; }
      if (t.close) { pieces[pieces.length - 1] += '<span class="bracket">)</span>'; return; }
      var cls = i < progress.done ? "struck" : i === progress.done ? "current" : "";
      if (i < progress.done) doneSt += t.n;
      totalSt += t.n;
      pieces.push((openNext ? '<span class="bracket">(</span>' : "") +
        '<span class="chip ' + cls + '" data-i="' + i + '">' + esc(t.t) + (t.plain ? " (" + t.n + " st)" : "") + "</span>");
      openNext = false;
      i++;
    });
    var html = pieces.join(" ");
    var complete = progress.done >= toks.length;
    box.classList.toggle("complete", complete);
    if (complete) html += '<span class="done-msg">✓ Done. Tap again (or Next) for ' + (progress.step + 1 < steps.length ? describeStep(steps[progress.step + 1]) : "the end") + ".</span>";
    box.innerHTML = html;
    $("nextLine").innerHTML = complete ? doneSt + " of " + totalSt + " stitches in this section"
      : "Next: <b>" + esc(toks[progress.done].t) + "</b> · " + doneSt + " of " + totalSt + " stitches done in this section";

    $("prevStep").disabled = progress.step === 0 && progress.done === 0;
    $("undoTap").disabled = progress.done === 0;
    $("nextStep").disabled = progress.step >= steps.length - 1;
    $("nextStep").textContent = progress.step >= steps.length - 1 ? "Finished!" : (complete ? "Next ▶" : "Skip to next ▶");

    // whole row, with this section highlighted
    if (r.kind === "chart") {
      var parts = r.work.map(function (ch, s) {
        var t = esc(bodyText(ch.rows[r.chartRowNum - 1]));
        return s === step.section ? "<mark>" + t + "</mark>" : t;
      });
      $("wholeRow").innerHTML = "Row " + r.n + " (" + r.colour + "): BS " + parts.join(" ") + " " + esc(r.s41) + " BS [" + r.count + " st]";
    } else $("wholeRow").textContent = "Row " + r.n + " (" + r.colour + "): SC in every stitch across [" + r.width + " st]";
    $("gotoRow").max = rowsModel.length;
    $("gotoRow").placeholder = r.n;
    drawMini();
  }
  function describeStep(s) {
    if (s.row.kind === "chart") return "row " + s.row.n + ", section " + (s.section + 1);
    return "row " + s.row.n;
  }

  // Small picture of the current chart row with the current row and section outlined.
  function drawMini() {
    var cv = $("mini"), step = steps[progress.step];
    if (!step || state.view !== "track") return;
    var r = step.row;
    if (r.kind !== "chart") { cv.hidden = true; return; }
    cv.hidden = false;
    var px = 6, n = r.work.length, w = n * BODY * px, h = CHART_ROWS * px;
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d");
    var leftToRight = r.work.slice().reverse();
    leftToRight.forEach(function (ch, i) { paintChart(ctx, ch, i * BODY * px, 0, px, false); });
    // dim everything, then redraw the current row
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, 0, w, h);
    var y = (CHART_ROWS - r.chartRowNum) * px;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, w, px); ctx.clip();
    leftToRight.forEach(function (ch, i) { paintChart(ctx, ch, i * BODY * px, 0, px, false); });
    ctx.restore();
    var secX = (n - 1 - step.section) * BODY * px;
    ctx.strokeStyle = "#b5532f"; ctx.lineWidth = 3;
    ctx.strokeRect(secX + 1.5, y - 1.5, BODY * px - 3, px + 3);
    for (var i = 1; i < n; i++) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(i * BODY * px - 1, 0, 2, h); }
  }

  function markStarted() {
    if (!state.locked) {
      state.locked = true; save();
      toast("Layout locked so it can’t change by accident. You can unlock it in Design.");
    }
  }
  function tapInstr(e) {
    // The whole box is one big button: every tap crosses off just the next group,
    // no matter where in the box you tap. Use Undo to step back.
    var step = steps[progress.step], toks = stitchTokens(step);
    if (progress.done >= toks.length) return nextStep();
    progress.done++;
    markStarted(); saveProgress(); renderStep();
  }
  function nextStep() {
    if (progress.step >= steps.length - 1) return;
    progress.step++; progress.done = 0; markStarted(); saveProgress(); renderStep();
  }
  function prevStep() {
    if (progress.done > 0) progress.done = 0;
    else if (progress.step > 0) { progress.step--; progress.done = 0; }
    saveProgress(); renderStep();
  }
  function undoTap() { if (progress.done > 0) { progress.done--; saveProgress(); renderStep(); } }
  function gotoRow(n) {
    for (var i = 0; i < steps.length; i++) if (steps[i].row.n === n) { progress.step = i; progress.done = 0; saveProgress(); renderStep(); return true; }
    return false;
  }

  function bindTrack() {
    $("instr").addEventListener("click", tapInstr);
    $("instr").addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapInstr(e); } });
    $("nextStep").addEventListener("click", nextStep);
    $("prevStep").addEventListener("click", prevStep);
    $("undoTap").addEventListener("click", undoTap);
    $("gotoForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var n = parseInt($("gotoRow").value, 10);
      if (!gotoRow(n)) toast("There’s no row " + ($("gotoRow").value || "?") + ". Rows go from 1 to " + rowsModel.length + ".");
      else { $("gotoRow").value = ""; $("gotoRow").blur(); }
    });
    $("resetProgress").addEventListener("click", function () {
      if (!confirm("Go back to row 1 and clear your place?")) return;
      progress = { step: 0, done: 0 }; saveProgress(); renderStep();
    });
    $("wake").addEventListener("change", function (e) { if (e.target.checked) requestWake(); else releaseWake(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && state.view === "track") requestWake(); });
    document.addEventListener("keydown", function (e) {
      if (state.view !== "track" || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") nextStep(); else if (e.key === "ArrowLeft") prevStep();
    });
  }

  // Keep the screen on while following the pattern (where the browser supports it).
  var wakeLock = null;
  function requestWake() {
    if (!$("wake").checked || !("wakeLock" in navigator) || state.view !== "track") return;
    navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }, function () { /* not allowed right now */ });
  }
  function releaseWake() { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } }

  /* ================= start ================= */
  fetch("charts.json")
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      charts = data.charts;
      validation = data.validation || [];
      corrections = data.corrections || [];
      charts.forEach(function (ch) { byName[ch.name] = ch; byId[ch.id] = ch; });
      validation.forEach(function (v) { (issuesByChart[v.chart] = issuesByChart[v.chart] || []).push(v); });
      applyUrl();
      normaliseGrid();
      bindControls(); bindPicker(); bindDrag(); bindTrack();
      renderDataCheck();
      setView(state.view);
    })
    .catch(function (err) {
      var p = $("loadError");
      p.hidden = false;
      p.textContent = "Couldn’t load charts.json (" + err.message + "). If you opened index.html straight from your computer, " +
        "the browser blocks this: view the site on GitHub Pages instead (see the README).";
    });

  // exposed for testing only
  window.__mosaic = { buildPattern: buildPattern, chartColours: chartColours, state: function () { return state; }, setCell: setCell,
    steps: function () { return steps; }, progress: function () { return progress; }, save: save };
})();

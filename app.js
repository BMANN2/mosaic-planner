/* Mosaic Bookcase Planner — plain JavaScript, no build step. */
(function () {
  "use strict";

  var STORAGE_KEY = "mosaic-bookcase-planner-v1";
  var CHART_ROWS = 31;      // rows in every chart
  var BODY = 40;            // body stitches per chart
  var SHELF_ROWS = 3;       // SC rows between chart rows
  var PX = 8;               // canvas pixels per stitch

  var DEFAULTS = {
    cols: 4, rows: 6,
    colours: { A: "#2f5d9e", B: "#ffffff", C: "#7a4a2a" },
    shelf: "A", symbols: false, names: true,
    grid: [] // grid[chartRow][col]: chart name or null. chartRow 0 = bottom, col 0 = left.
  };

  var charts = [];          // from charts.json
  var byName = {};          // name -> chart
  var issuesByChart = {};   // name -> [issues]
  var validation = [];
  var state = load();
  var armedChart = null;    // chart chosen by tapping in the library (phone-friendly)

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- storage ---------- */
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { s = null; }
    var st = JSON.parse(JSON.stringify(DEFAULTS));
    if (s && typeof s === "object") {
      if (s.cols >= 1) st.cols = clampInt(s.cols, 1, 10);
      if (s.rows >= 1) st.rows = clampInt(s.rows, 1, 12);
      if (s.colours) { ["A", "B", "C"].forEach(function (k) { if (/^#[0-9a-f]{6}$/i.test(s.colours[k] || "")) st.colours[k] = s.colours[k]; }); }
      if (s.shelf === "C") st.shelf = "C";
      st.symbols = !!s.symbols;
      st.names = s.names !== false;
      if (Array.isArray(s.grid)) st.grid = s.grid;
    }
    return st;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: layout just won't persist */ }
  }
  function clampInt(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  /* Resize the grid, keeping placements that still fit (anchored at bottom-left). */
  function normaliseGrid() {
    var g = [];
    for (var r = 0; r < state.rows; r++) {
      g[r] = [];
      for (var c = 0; c < state.cols; c++) {
        var v = state.grid[r] && state.grid[r][c];
        g[r][c] = (v && byName[v]) ? v : null;
      }
    }
    // keep anything outside the visible size too, so shrinking then growing again restores it
    for (var r2 = 0; r2 < state.grid.length; r2++) {
      var old = state.grid[r2] || [];
      for (var c2 = 0; c2 < old.length; c2++) {
        if (r2 >= state.rows || c2 >= state.cols) { g[r2] = g[r2] || []; g[r2][c2] = old[c2]; }
      }
    }
    state.grid = g;
  }
  function getCell(r, c) { return (state.grid[r] && state.grid[r][c]) || null; }
  function setCell(r, c, name) { state.grid[r] = state.grid[r] || []; state.grid[r][c] = name || null; }

  /* ---------- chart maths ---------- */
  // Expand a row's body into 40 flags, index 0 = stitch 1 (worked first, drawn on the right).
  function expandRow(row) {
    var out = [];
    row.body.forEach(function (p) {
      for (var i = 0; i < p[0]; i++) out.push(p[1] === "DC");
    });
    // Rows that don't total 40 are listed in the data check; draw them padded/cut to 40 so the grid stays aligned.
    while (out.length < BODY) out.push(false);
    return out.slice(0, BODY);
  }

  // Returns colours[r][s] ('A' or 'B') for rows 0..30 (row 1..31) and stitches 0..39 (stitch 1..40),
  // plus the DC flags. Mosaic rule: a cell takes the colour of the row directly above it when that row
  // has a DC in the same column; otherwise it takes its own row's colour. Row 31 has nothing above it
  // inside the chart, so it always shows its own colour.
  var colourCache = {};
  function chartColours(chart) {
    if (colourCache[chart.name]) return colourCache[chart.name];
    var dc = chart.rows.map(expandRow);
    var col = [];
    for (var r = 0; r < CHART_ROWS; r++) {
      col[r] = [];
      for (var s = 0; s < BODY; s++) {
        var above = r + 1 < CHART_ROWS && dc[r + 1][s];
        col[r][s] = above ? chart.rows[r + 1].colour : chart.rows[r].colour;
      }
    }
    return (colourCache[chart.name] = { colours: col, dc: dc });
  }

  function drawChart(canvas, chart) {
    canvas.width = BODY * PX;
    canvas.height = CHART_ROWS * PX;
    var ctx = canvas.getContext("2d");
    var data = chartColours(chart);
    for (var r = 0; r < CHART_ROWS; r++) {
      var y = (CHART_ROWS - 1 - r) * PX;            // row 1 at the bottom
      for (var s = 0; s < BODY; s++) {
        var x = (BODY - 1 - s) * PX;                // stitch 1 on the right
        ctx.fillStyle = state.colours[data.colours[r][s]];
        ctx.fillRect(x, y, PX, PX);
      }
    }
    if (state.symbols) {
      ctx.lineWidth = 1.2;
      for (var r2 = 0; r2 < CHART_ROWS; r2++) {
        var y2 = (CHART_ROWS - 1 - r2) * PX;
        for (var s2 = 0; s2 < BODY; s2++) {
          if (!data.dc[r2][s2]) continue;
          var x2 = (BODY - 1 - s2) * PX;
          ctx.strokeStyle = contrastFor(state.colours[data.colours[r2][s2]]);
          ctx.beginPath();
          ctx.moveTo(x2 + 1.5, y2 + 1.5); ctx.lineTo(x2 + PX - 1.5, y2 + PX - 1.5);
          ctx.moveTo(x2 + PX - 1.5, y2 + 1.5); ctx.lineTo(x2 + 1.5, y2 + PX - 1.5);
          ctx.stroke();
        }
      }
    }
  }
  function contrastFor(hex) {
    var n = parseInt(hex.slice(1), 16);
    var l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return l > 150 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
  }

  /* ---------- row numbering ---------- */
  function rowWidth() { return BODY * state.cols + 3; }
  function chartRowStart(cr) { return 1 + cr * (CHART_ROWS + SHELF_ROWS); }
  function totalRows() { return state.rows * CHART_ROWS + (state.rows - 1) * SHELF_ROWS + 1; }

  /* ---------- rendering ---------- */
  function renderStats() {
    $("stats").textContent = rowWidth() + " stitches per row · " + totalRows() + " rows in total";
  }

  function renderLibrary() {
    var ul = $("library");
    ul.innerHTML = "";
    charts.forEach(function (ch) {
      var li = document.createElement("li");
      li.className = "lib-item" + (armedChart === ch.name ? " armed-item" : "");
      li.dataset.chart = ch.name;
      var img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.src = "images/charts/" + encodeURIComponent(ch.name) + ".png";
      img.onerror = function () { img.remove(); };
      li.appendChild(img);
      var span = document.createElement("span");
      span.textContent = ch.name;
      li.appendChild(span);
      if (issuesByChart[ch.name]) {
        var f = document.createElement("span");
        f.className = "flag"; f.textContent = "!";
        f.title = "Some rows in the PDF have printing errors. See Data check.";
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
  function rowLabel(text) {
    var d = document.createElement("div");
    d.className = "rowlabel";
    d.textContent = text;
    return d;
  }

  function renderBlanket() {
    var b = $("blanket");
    b.innerHTML = "";
    b.style.gridTemplateColumns = "repeat(" + state.cols + ", 1fr)";
    b.classList.toggle("no-names", !state.names);
    // Size the blanket so the whole thing fits on screen, like looking at the finished piece.
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
      d.textContent = armedChart ? "Tap to place" : "+ Add chart";
      return d;
    }
    d.className = "cell";
    var cv = document.createElement("canvas");
    drawChart(cv, byName[name]);
    d.appendChild(cv);
    var lab = document.createElement("span");
    lab.className = "label"; lab.textContent = name;
    d.appendChild(lab);
    if (issuesByChart[name]) {
      var w = document.createElement("span");
      w.className = "warn"; w.textContent = "!"; d.appendChild(w);
    }
    d.title = name + " (chart row " + (r + 1) + ", column " + (c + 1) + " from the left)";
    return d;
  }

  function renderArmed() {
    var a = $("armed");
    if (!armedChart) { a.hidden = true; a.innerHTML = ""; return; }
    a.hidden = false;
    a.innerHTML = "";
    var t = document.createElement("span");
    t.textContent = "Placing “" + armedChart + "”: tap any spot on the blanket.";
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ghost"; btn.textContent = "Done";
    btn.onclick = function () { armedChart = null; renderAll(); };
    a.appendChild(t); a.appendChild(btn);
  }

  function renderDataCheck() {
    var body = $("dataCheckBody");
    if (!validation.length) { body.innerHTML = "<p>Every row in every chart has 40 body stitches. No problems found.</p>"; return; }
    var html = "<p>These rows don’t pass the check, exactly as printed in the PDF. They are <strong>not</strong> corrected; " +
      "the written pattern shows them as printed. Check them against the picture charts in the PDF before you crochet.</p>" +
      "<table><thead><tr><th>Chart</th><th>Row</th><th>Problem</th><th>As printed</th></tr></thead><tbody>";
    validation.forEach(function (v) {
      html += "<tr><td>" + esc(v.chart) + "</td><td>" + v.row + "</td><td>" + esc(v.issue) + "</td><td><code>" + esc(v.text) + "</code></td></tr>";
    });
    body.innerHTML = html + "</tbody></table>";
    $("dataCheck").querySelector("summary").textContent = "Data check (" + validation.length + " issue" + (validation.length === 1 ? "" : "s") + " in the PDF)";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }

  function renderAll() {
    renderStats(); renderLibrary(); renderArmed(); renderBlanket();
  }

  /* ---------- controls ---------- */
  function bindControls() {
    $("cols").value = state.cols; $("rows").value = state.rows;
    $("colA").value = state.colours.A; $("colB").value = state.colours.B; $("colC").value = state.colours.C;
    $("shelf").value = state.shelf; $("symbols").checked = state.symbols; $("names").checked = state.names;

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
    $("clearAll").addEventListener("click", function () {
      if (!confirm("Remove every chart from the blanket?")) return;
      state.grid = []; normaliseGrid(); save(); renderAll();
    });
    $("finish").addEventListener("click", finish);
    $("closeResult").addEventListener("click", function () { $("result").close(); });
    $("copy").addEventListener("click", copyPattern);
    $("download").addEventListener("click", downloadPattern);
  }

  /* ---------- picker (tap a spot) ---------- */
  var pickerTarget = null;
  function openPicker(r, c) {
    pickerTarget = { r: r, c: c };
    var sel = $("pickerSelect");
    sel.innerHTML = "";
    var none = document.createElement("option");
    none.value = ""; none.textContent = "— empty —";
    sel.appendChild(none);
    charts.forEach(function (ch) {
      var o = document.createElement("option");
      o.value = ch.name; o.textContent = ch.name;
      sel.appendChild(o);
    });
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

  /* ---------- drag and drop (mouse, pen and touch) ---------- */
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
    var src = sourceFrom(e.target);
    if (!src) return;
    drag = { src: src, x: e.clientX, y: e.clientY, started: false, touch: e.pointerType === "touch", timer: null, ghost: null, over: null };
    if (drag.touch && src.name) {
      // On touch screens a short hold starts a drag, so the page can still scroll normally.
      drag.timer = setTimeout(function () { if (drag) startDrag(drag.x, drag.y); }, 300);
    }
  }
  function startDrag(x, y) {
    if (!drag.src.name) return;      // nothing to drag from an empty spot
    drag.started = true;
    var g = document.createElement("div");
    g.className = "ghost-drag"; g.textContent = drag.src.name;
    document.body.appendChild(g);
    drag.ghost = g;
    if (drag.src.type === "cell") drag.src.el.classList.add("dragging");
    var d0 = drag;
    // Scroll the page when the pointer is held near the top or bottom edge.
    d0.scroller = setInterval(function () {
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
      if (drag.touch) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; } // it's a scroll
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
        else if (r !== d.src.r || c !== d.src.c) {
          var other = getCell(r, c);
          setCell(r, c, d.src.name); setCell(d.src.r, d.src.c, other);   // swap
        }
        save(); renderBlanket();
      }
      return;
    }
    // A tap / click
    if (d.src.type === "lib") {
      armedChart = armedChart === d.src.name ? null : d.src.name;
      renderAll();
    } else if (armedChart) {
      setCell(d.src.r, d.src.c, armedChart); save(); renderBlanket();
    } else {
      openPicker(d.src.r, d.src.c);
    }
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
    // Stop the page scrolling while a touch drag is in progress.
    document.addEventListener("touchmove", function (e) { if (drag && drag.started) e.preventDefault(); }, { passive: false });
    document.addEventListener("contextmenu", function (e) { if (drag) e.preventDefault(); });
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (!drag) renderBlanket(); }, 200); });
  }

  /* ---------- written pattern ---------- */
  function bodyText(row) { return "(" + row.body.map(function (p) { return p[0] + p[1]; }).join(" ") + ")"; }
  function bodyCount(row) { return row.body.reduce(function (a, p) { return a + p[0]; }, 0); }
  function s41Count(row) { var m = /^(\d+)/.exec(row.stitch41); return m ? +m[1] : 0; }

  function buildPattern() {
    var W = rowWidth();
    var missing = [];
    for (var r = 0; r < state.rows; r++) for (var c = 0; c < state.cols; c++) if (!getCell(r, c)) missing.push("chart row " + (r + 1) + ", column " + (c + 1));
    if (missing.length) return { error: "Every spot needs a chart before the pattern can be written. Empty: " + missing.join("; ") + "." };

    var shelfName = state.shelf === "C" ? "Colour C" : "Colour A";
    var lines = [], notes = [], used = {};
    lines.push("MOSAIC BOOKCASE BLANKET — WRITTEN PATTERN (US terms)");
    lines.push("Charts: Zigz Crochet, Mosaic Bookcase Extended Version");
    lines.push("Size: " + state.cols + " charts across × " + state.rows + " chart rows · " + W + " stitches per row · " + totalRows() + " rows");
    lines.push("Colours: A = " + state.colours.A + ", B = " + state.colours.B + (state.shelf === "C" ? ", C = " + state.colours.C + " (shelves)" : "") + " · Shelves: " + shelfName);
    lines.push("Abbreviations: SC = single crochet, DC = double crochet, BS = border stitch.");
    lines.push("Work every row right to left. Each bracket is one chart (40 stitches), rightmost chart first.");
    lines.push("");
    lines.push("Layout (bottom to top, each line listed left to right as you look at the blanket):");
    for (var lr = 0; lr < state.rows; lr++) {
      var names = []; for (var lc = 0; lc < state.cols; lc++) names.push(getCell(lr, lc));
      lines.push("  Chart row " + (lr + 1) + ": " + names.join(" | "));
    }

    var n = 1;
    for (var cr = 0; cr < state.rows; cr++) {
      if (cr > 0) {
        lines.push("");
        lines.push("Rows " + n + "–" + (n + SHELF_ROWS - 1) + ": " + SHELF_ROWS + " rows SC (" + shelfName + "), " + W + " st each");
        n += SHELF_ROWS;
      }
      lines.push("");
      lines.push("— Chart row " + (cr + 1) + " —");
      var row = [];
      for (var c2 = 0; c2 < state.cols; c2++) row.push(byName[getCell(cr, c2)]);
      var workOrder = row.slice().reverse();      // rightmost chart is worked first
      var leftmost = row[0];
      for (var i = 0; i < CHART_ROWS; i++) {
        var colours = {};
        workOrder.forEach(function (ch) { colours[ch.rows[i].colour] = true; used[ch.name] = true; });
        var colour = workOrder[0].rows[i].colour;
        if (Object.keys(colours).length > 1) notes.push("Row " + n + ": the charts in this row don’t agree on the colour (" + Object.keys(colours).join("/") + "). Showing " + colour + ".");
        var parts = workOrder.map(function (ch) { return bodyText(ch.rows[i]); });
        var lrow = leftmost.rows[i];
        var count = 2 + s41Count(lrow) + workOrder.reduce(function (a, ch) { return a + bodyCount(ch.rows[i]); }, 0);
        var line = "Row " + n + " (" + colour + "): BS " + parts.join(" ") + " " + lrow.stitch41 + " BS  [" + count + " st]";
        if (count !== W) line += "  ← check: expected " + W;
        lines.push(line);
        n++;
      }
    }
    lines.push("");
    lines.push("Row " + n + " (A): SC in every stitch across  [" + W + " st]");
    lines.push("");
    lines.push("Fasten off. Total rows: " + n + ".");

    var flagged = validation.filter(function (v) { return used[v.chart]; });
    if (flagged.length || notes.length) {
      lines.push("");
      lines.push("NOTES — please check before you crochet:");
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
  function copyPattern() {
    var text = $("patternText").textContent;
    var done = function () { $("copyMsg").textContent = "Copied to the clipboard."; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      $("result").appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { $("copyMsg").textContent = "Couldn’t copy automatically. Select the text and copy it."; }
      ta.remove();
    }
  }
  function downloadPattern() {
    var blob = new Blob([$("patternText").textContent], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mosaic-bookcase-pattern.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- start ---------- */
  fetch("charts.json")
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      charts = data.charts;
      validation = data.validation || [];
      charts.forEach(function (ch) { byName[ch.name] = ch; });
      validation.forEach(function (v) { (issuesByChart[v.chart] = issuesByChart[v.chart] || []).push(v); });
      normaliseGrid();
      bindControls(); bindPicker(); bindDrag();
      renderAll(); renderDataCheck();
    })
    .catch(function (err) {
      var p = $("loadError");
      p.hidden = false;
      p.textContent = "Couldn’t load charts.json (" + err.message + "). If you opened index.html straight from your computer, " +
        "the browser blocks this: view the site on GitHub Pages instead (see the README).";
    });

  // exposed for testing only
  window.__mosaic = { buildPattern: buildPattern, chartColours: chartColours, state: function () { return state; }, setCell: setCell };
})();

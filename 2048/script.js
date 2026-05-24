/* ========================================================================
   2048 Game Engine — Decimal.js powered, arbitrary precision
   Architecture:
   - grid[N²]: {id, value:Decimal, exp:Number, el} | null
     · value  = exact Decimal (e.g. Decimal(2).pow(12))
     · exp    = integer log₂ value (for color & display, 0 if not power-of-2)
   - All arithmetic done via Decimal; JS Number only for layout math
   - Display: "2^n" for powers-of-2; abbreviated decimal for non-powers
   ======================================================================== */

(function() {
  'use strict';

  /* ====================================================================
     DECIMAL CONFIG
     precision = 10000  →  supports exact display of 2^n for n ≤ ~33200
     (2^33219 has exactly 10000 decimal digits)
     toExpNeg/Pos = ±9e15  →  toFixed(0) never uses scientific notation
     ==================================================================== */
  Decimal.set({ precision: 10000, toExpNeg: -9e15, toExpPos: 9e15 });

  /* Maximum exponent for which we store a full Decimal value.
     Above this, tile.value is a sentinel Decimal(1) and we rely solely on
     tile.exp for display and arithmetic bookkeeping.
     33000 * log10(2) ≈ 9934 digits — safely within precision=10000.       */
  var MAX_FULL_DECIMAL_EXP = 33000;

  var D2 = new Decimal(2);
  var D4 = new Decimal(4);

  /* ====================================================================
     BOARD CONFIG
     ==================================================================== */
  var BOARD_SIZE = 4;
  var CELLS      = BOARD_SIZE * BOARD_SIZE;
  var GAP_RATIO  = 0.025;

  /* ---- State ---- */
  var grid       = new Array(CELLS).fill(null);
  var score      = new Decimal(0);  /* Decimal score */
  var best       = new Decimal(0);  /* Decimal best  */
  var nextId     = 0;
  var won        = false;
  var over       = false;

  /* Score localStorage key stores a string representation */
  var _storedBest = localStorage.getItem('best2048v2') || '0';
  try { best = new Decimal(_storedBest); } catch(e) { best = new Decimal(0); }

  /* ---- Input queue ---- */
  var inputQueue    = [];
  var processing    = false;
  var INTER_MOVE_MS = 100;

  /* ---- DOM ---- */
  var tilesLayer       = document.getElementById('tilesLayer');
  var gridWrapper      = document.getElementById('gridWrapper');
  var gridBgEl         = document.querySelector('.grid-bg');
  var scoreEl          = document.getElementById('score');
  var bestEl           = document.getElementById('best');
  var overlayGO        = document.getElementById('overlayGameOver');
  var overlayWin       = document.getElementById('overlayWin');
  var overlaySub       = document.getElementById('overlaySub');
  var displayModeSelect = document.getElementById('displayModeSelect');

  bestEl.textContent = formatScore(best);

  /* ====================================================================
     DISPLAY HELPERS
     ==================================================================== */

  /* Display mode: "scientific" (2^n) or "normal" (full plain integer).
     Stored here so renderAll can pick it up without passing args everywhere. */
  var displayMode = 'scientific';

  /* Wire up the mode selector */
  displayModeSelect.value = displayMode;
  displayModeSelect.addEventListener('change', function() {
    displayMode = displayModeSelect.value;
    renderAll();  /* immediately re-render all tiles */
  });

  /**
   * Format a tile value for display.
   *   exp   : cell.exp (integer log₂, null if not a pure power-of-2)
   *   d     : Decimal value (used only when exp is null OR mode is "normal")
   *   mode  : displayMode override (optional)
   *
   * Scientific mode  → "2^n"         (for all power-of-2 tiles)
   * Normal mode      → full decimal string, auto-capped at MAX_DISPLAY_CHARS
   *                    to prevent DOM freeze on extreme exponents
   *
   * NEVER calls .ln() or any transcendental function — precision-safe.
   */
  /* Safety cap: prevents DOM/layout freeze when displaying huge plain numbers.
     2^1000 has ~302 decimal digits — we allow up to 500 chars before capping. */
  var MAX_DISPLAY_CHARS = 500;

  /**
   * Format a tile value for display.  NEVER calls .ln() or any transcendental
   * Decimal function — fully precision-safe for any exponent.
   *
   *   d    : Decimal  — the exact tile value
   *   exp  : Number   — cell.exp (integer log₂), null if not a pure power-of-2
   *   modeOverride : optional string, overrides global displayMode
   *
   * "scientific" mode → "2^n"  for power-of-2 tiles;  abbreviated digits otherwise
   * "normal"     mode → full plain integer string (capped at MAX_DISPLAY_CHARS)
   */
  function formatVal(d, exp, modeOverride) {
    var mode = modeOverride || displayMode;

    if (mode === 'scientific') {
      /* Power-of-2: always "2^n" */
      if (exp !== null && exp !== undefined) return '2^' + exp;
      /* Non-power-of-2 in scientific mode: show first 8 digits */
      var sf = d.toFixed(0);
      if (sf.length <= 8) return sf;
      return sf.slice(0, 8) + '\u2026';
    }

    /* Normal (plain) mode: full integer, never scientific notation.
       If exp is known but value is a sentinel (exp > MAX_FULL_DECIMAL_EXP),
       fall back to "2^n" — we cannot expand the full decimal without exceeding precision. */
    if (exp !== null && exp !== undefined && exp > MAX_FULL_DECIMAL_EXP) {
      return '2^' + exp + ' \u2020';  /* † marks that full digits unavailable */
    }

    var s = d.toFixed(0);  /* Decimal.toFixed(0) always returns plain digits, no 'e' */
    if (s.length <= MAX_DISPLAY_CHARS) return s;
    /* Extremely large numbers: cap with ellipsis to prevent DOM freeze */
    return s.slice(0, MAX_DISPLAY_CHARS) + '\u2026';
  }

  /**
   * Format score for score-box — always keep short regardless of mode.
   * exp may be null for non-power-of-2 scores.
   */
  function formatScore(d) {
    /* Try to express as 2^n by checking stored best/score which come from
       power-of-2 tile merges — but score is cumulative so usually not a
       pure power. Just abbreviate. */
    var s = d.toFixed(0);
    if (s.length <= 10) return s;
    return s.slice(0, 7) + '\u2026';
  }

  /**
   * Compute font-size (px) for a tile given its display string and tile width.
   * Works for both "2^512" and plain decimal strings.
   */
  function fontSize(displayStr, tileW) {
    var len = displayStr.length;
    if (len <= 3)  return Math.round(tileW * 0.46);
    if (len === 4) return Math.round(tileW * 0.38);
    if (len === 5) return Math.round(tileW * 0.32);
    if (len === 6) return Math.round(tileW * 0.27);
    if (len === 7) return Math.round(tileW * 0.23);
    if (len === 8) return Math.round(tileW * 0.20);
    if (len === 9) return Math.round(tileW * 0.18);
    if (len <= 12) return Math.round(tileW * 0.16);
    if (len <= 20) return Math.round(tileW * 0.13);
    if (len <= 40) return Math.round(tileW * 0.10);
    if (len <= 80) return Math.round(tileW * 0.08);
    return Math.round(tileW * 0.06);  /* very long plain numbers */
  }

  /* ====================================================================
     TILE COLOR SYSTEM
     ==================================================================== */

  /*
    Static CSS classes handle 2–2048 (classic) and 2^12–2^31 (extended).
    For 2^32+, we generate colors dynamically using a HSL color wheel
    that cycles with increasing saturation bands.
  */

  /* Map: exponent → CSS class name (static) */
  var EXP_CLASS = {
    1:  'tile-2',   2:  'tile-4',   3:  'tile-8',
    4:  'tile-16',  5:  'tile-32',  6:  'tile-64',
    7:  'tile-128', 8:  'tile-256', 9:  'tile-512',
    10: 'tile-1024',11: 'tile-2048',
    12: 'tile-e12', 13: 'tile-e13', 14: 'tile-e14', 15: 'tile-e15',
    16: 'tile-e16', 17: 'tile-e17', 18: 'tile-e18', 19: 'tile-e19',
    20: 'tile-e20', 21: 'tile-e21', 22: 'tile-e22', 23: 'tile-e23',
    24: 'tile-e24', 25: 'tile-e25', 26: 'tile-e26', 27: 'tile-e27',
    28: 'tile-e28', 29: 'tile-e29', 30: 'tile-e30', 31: 'tile-e31'
  };

  /**
   * Hue palette for dynamic colors (2^32+).
   * We cycle through 12 hue stops with 3 lightness bands,
   * giving 36 unique colors before repeating.
   */
  var DYN_HUES = [200, 160, 280, 320, 40, 80, 240, 0, 120, 260, 350, 60];
  var DYN_LIGHTNESS = [42, 35, 28];  /* light → dark within each band */

  /**
   * Get inline color style for exponents ≥ 32 (dynamic).
   * Returns {bg, fg} strings.
   */
  function dynColor(exp) {
    var idx   = (exp - 32) % (DYN_HUES.length * DYN_LIGHTNESS.length);
    var hIdx  = Math.floor(idx / DYN_LIGHTNESS.length) % DYN_HUES.length;
    var lIdx  = idx % DYN_LIGHTNESS.length;
    var hue   = DYN_HUES[hIdx];
    var light = DYN_LIGHTNESS[lIdx];
    var sat   = 55 + (exp % 5) * 5;  /* slight saturation drift: 55–75% */
    var bg    = 'hsl(' + hue + ',' + sat + '%,' + light + '%)';
    var fg    = light < 38 ? '#f9f6f2' : '#3c3a32';
    return { bg: bg, fg: fg };
  }

  /**
   * Apply color to a tile element given value (Decimal) and its exp.
   * exp may be null for non-power-of-2 tiles.
   */
  function applyTileColor(el, d, exp) {
    /* Reset any previously applied inline style */
    el.style.background = '';
    el.style.color = '';

    if (exp !== null && EXP_CLASS[exp]) {
      el.className = 'tile ' + EXP_CLASS[exp];
    } else if (exp !== null && exp >= 32) {
      el.className = 'tile';
      var c = dynColor(exp);
      el.style.background = c.bg;
      el.style.color = c.fg;
    } else {
      /* Non-power-of-2 value: derive a color from magnitude */
      var mag = d.toNumber();
      if (!isFinite(mag)) mag = 1e308;
      var rawExp = Math.floor(Math.log2(mag));
      if (rawExp >= 32) {
        var c2 = dynColor(rawExp);
        el.className = 'tile';
        el.style.background = c2.bg;
        el.style.color = c2.fg;
      } else {
        /* Small non-power-of-2: treat like the nearest power */
        var nearest = Math.max(1, Math.min(31, rawExp));
        if (EXP_CLASS[nearest]) {
          el.className = 'tile ' + EXP_CLASS[nearest];
        } else {
          el.className = 'tile tile-super';
        }
      }
    }
  }

  /* ====================================================================
     LAYOUT HELPERS
     ==================================================================== */

  function getMetrics() {
    var w = gridWrapper.clientWidth;
    var h = gridWrapper.clientHeight;
    var size = Math.min(w, h);
    var gap  = size * GAP_RATIO;
    var tileW = (size - gap * (BOARD_SIZE + 1)) / BOARD_SIZE;
    return { size: size, gap: gap, tileW: tileW };
  }

  function rebuildGridBg() {
    gridBgEl.innerHTML = '';
    var repeat = 'repeat(' + BOARD_SIZE + ', 1fr)';
    gridBgEl.style.gridTemplateColumns = repeat;
    gridBgEl.style.gridTemplateRows    = repeat;
    for (var i = 0; i < CELLS; i++) {
      var cell = document.createElement('div');
      cell.className = 'grid-cell';
      gridBgEl.appendChild(cell);
    }
  }

  function tileXY(idx) {
    var m   = getMetrics();
    var row = Math.floor(idx / BOARD_SIZE);
    var col = idx % BOARD_SIZE;
    return {
      x: col * (m.tileW + m.gap),
      y: row * (m.tileW + m.gap)
    };
  }

  /* Apply all visual properties to a tile element */
  function styleTile(el, cell, m) {
    var d   = cell.value;
    var exp = cell.exp;
    /* Pass exp directly — no transcendental math needed */
    var s   = formatVal(d, exp);
    var fs  = fontSize(s, m.tileW);

    applyTileColor(el, d, exp);
    el.textContent      = s;
    el.style.width      = m.tileW + 'px';
    el.style.height     = m.tileW + 'px';
    el.style.fontSize   = fs + 'px';
    el.style.lineHeight = '1.15';
    el.style.padding    = '3px';
    el.style.boxSizing  = 'border-box';
  }

  /* ====================================================================
     CORE: SLIDE & MERGE  (Decimal arithmetic)
     ==================================================================== */

  function slideLine(cells) {
    var tiles     = cells.filter(function(c) { return c !== null; });
    var gained    = new Decimal(0);
    var consumed  = [];
    var survivors = [];
    var pairs     = [];

    for (var i = 0; i < tiles.length - 1; i++) {
      if (tiles[i].value.equals(tiles[i + 1].value)) {
        var newVal = tiles[i].value.times(2);
        var newExp = tiles[i].exp !== null ? tiles[i].exp + 1 : null;
        tiles[i].value = newVal;
        tiles[i].exp   = newExp;
        gained = gained.plus(newVal);
        consumed.push(tiles[i + 1].id);
        survivors.push(tiles[i].id);
        pairs.push({ from: tiles[i + 1].id, to: tiles[i].id });
        tiles.splice(i + 1, 1);
      }
    }

    while (tiles.length < BOARD_SIZE) tiles.push(null);
    return { cells: tiles, gained: gained, consumed: consumed, survivors: survivors, pairs: pairs };
  }

  /* Check if all cells in a line are non-null and equal */
  function canFullMergeLine(cells) {
    for (var i = 0; i < cells.length; i++) {
      if (!cells[i]) return null;
    }
    var v = cells[0].value;
    for (var j = 1; j < cells.length; j++) {
      if (!cells[j].value.equals(v)) return null;
    }
    return { value: v, exp: cells[0].exp };
  }

  function computeMove(dir) {
    var newGrid      = new Array(CELLS).fill(null);
    var totalGained  = new Decimal(0);
    var allConsumed  = [];
    var allSurvivors = [];
    var allPairs     = [];
    var anyChanged   = false;

    if (dir === 'left' || dir === 'right') {
      for (var r = 0; r < BOARD_SIZE; r++) {
        var start = r * BOARD_SIZE;
        var row   = grid.slice(start, start + BOARD_SIZE);
        var fvm   = canFullMergeLine(row);

        if (fvm !== null) {
          /* Full-row merge */
          var newVal = fvm.value.times(BOARD_SIZE);
          var newExp = (fvm.exp !== null) ? (fvm.exp + Math.round(Math.log2(BOARD_SIZE))) : null;
          totalGained = totalGained.plus(newVal);
          var survId  = ++nextId;
          for (var ci = 0; ci < BOARD_SIZE; ci++) allConsumed.push(row[ci].id);
          allSurvivors.push(survId);
          for (var ci2 = 0; ci2 < BOARD_SIZE; ci2++) {
            allPairs.push({ from: row[ci2].id, to: survId });
          }
          var resultRow = new Array(BOARD_SIZE).fill(null);
          var pos = (dir === 'right') ? BOARD_SIZE - 1 : 0;
          resultRow[pos] = { id: survId, value: newVal, exp: newExp, el: null };
          for (var c = 0; c < BOARD_SIZE; c++) newGrid[start + c] = resultRow[c];
          anyChanged = true;
        } else {
          var rowCopy = row.slice();
          if (dir === 'right') rowCopy.reverse();
          var result = slideLine(rowCopy);
          if (dir === 'right') result.cells.reverse();
          totalGained = totalGained.plus(result.gained);
          allConsumed  = allConsumed.concat(result.consumed);
          allSurvivors = allSurvivors.concat(result.survivors);
          allPairs     = allPairs.concat(result.pairs);
          for (var c2 = 0; c2 < BOARD_SIZE; c2++) newGrid[start + c2] = result.cells[c2];
          for (var c3 = 0; c3 < BOARD_SIZE; c3++) {
            var oid = row[c3] ? row[c3].id : null;
            var nid = result.cells[c3] ? result.cells[c3].id : null;
            if (oid !== nid) { anyChanged = true; break; }
          }
        }
      }
    } else {
      for (var cc = 0; cc < BOARD_SIZE; cc++) {
        var col = [];
        for (var rr = 0; rr < BOARD_SIZE; rr++) col.push(grid[rr * BOARD_SIZE + cc]);
        var fvm2 = canFullMergeLine(col);

        if (fvm2 !== null) {
          var newVal2 = fvm2.value.times(BOARD_SIZE);
          var newExp2 = (fvm2.exp !== null) ? (fvm2.exp + Math.round(Math.log2(BOARD_SIZE))) : null;
          totalGained = totalGained.plus(newVal2);
          var survId2 = ++nextId;
          for (var ri = 0; ri < BOARD_SIZE; ri++) allConsumed.push(col[ri].id);
          allSurvivors.push(survId2);
          for (var ri2 = 0; ri2 < BOARD_SIZE; ri2++) {
            allPairs.push({ from: col[ri2].id, to: survId2 });
          }
          var resultCol = new Array(BOARD_SIZE).fill(null);
          var pos2 = (dir === 'down') ? BOARD_SIZE - 1 : 0;
          resultCol[pos2] = { id: survId2, value: newVal2, exp: newExp2, el: null };
          for (var rr3 = 0; rr3 < BOARD_SIZE; rr3++) newGrid[rr3 * BOARD_SIZE + cc] = resultCol[rr3];
          anyChanged = true;
        } else {
          var colCopy = col.slice();
          if (dir === 'down') colCopy.reverse();
          var res = slideLine(colCopy);
          if (dir === 'down') res.cells.reverse();
          totalGained = totalGained.plus(res.gained);
          allConsumed  = allConsumed.concat(res.consumed);
          allSurvivors = allSurvivors.concat(res.survivors);
          allPairs     = allPairs.concat(res.pairs);
          for (var rr2 = 0; rr2 < BOARD_SIZE; rr2++) newGrid[rr2 * BOARD_SIZE + cc] = res.cells[rr2];
          for (var rr4 = 0; rr4 < BOARD_SIZE; rr4++) {
            var oid2 = col[rr4] ? col[rr4].id : null;
            var nid2 = res.cells[rr4] ? res.cells[rr4].id : null;
            if (oid2 !== nid2) { anyChanged = true; break; }
          }
        }
      }
    }

    return {
      newGrid:     newGrid,
      gained:      totalGained,
      consumedIds: allConsumed,
      survivorIds: allSurvivors,
      mergePairs:  allPairs,
      changed:     anyChanged
    };
  }

  /* ====================================================================
     SPAWN
     ==================================================================== */

  function spawnTile(g) {
    var empty = [];
    for (var i = 0; i < CELLS; i++) { if (!g[i]) empty.push(i); }
    if (empty.length === 0) return null;

    var idx   = empty[Math.floor(Math.random() * empty.length)];
    var isTwo = Math.random() < 0.9;
    var val   = isTwo ? D2 : D4;
    var exp   = isTwo ? 1 : 2;
    var id    = ++nextId;
    var cell  = { id: id, value: val, exp: exp, el: null };
    g[idx]    = cell;
    return cell;
  }

  /* ====================================================================
     STATE CHECKS
     ==================================================================== */

  var WIN_VALUE = D2.pow(11);  /* 2048 = 2^11 */

  function isGameOver(g) {
    for (var i = 0; i < CELLS; i++) { if (!g[i]) return false; }
    for (var r = 0; r < BOARD_SIZE; r++) {
      for (var c = 0; c < BOARD_SIZE; c++) {
        var val = g[r * BOARD_SIZE + c].value;
        if (c < BOARD_SIZE - 1 && g[r * BOARD_SIZE + c + 1].value.equals(val)) return false;
        if (r < BOARD_SIZE - 1 && g[(r + 1) * BOARD_SIZE + c].value.equals(val)) return false;
      }
    }
    return true;
  }

  function checkState() {
    if (!won) {
      for (var i = 0; i < CELLS; i++) {
        if (grid[i] && grid[i].value.gte(WIN_VALUE)) {
          won = true;
          overlayWin.classList.remove('hidden');
          return;
        }
      }
    }
    if (isGameOver(grid)) {
      over = true;
      overlaySub.textContent = '最终得分: ' + formatScore(score);
      overlayGO.classList.remove('hidden');
    }
  }

  /* ====================================================================
     RENDERING
     ==================================================================== */

  function renderMove(consumedIds, survivorIds, spawnedId, mergePairs) {
    var m = getMetrics();

    var consumedSet = {};
    consumedIds.forEach(function(id) { consumedSet[id] = true; });

    /* Update / create tile elements */
    for (var i = 0; i < CELLS; i++) {
      var cell = grid[i];
      if (!cell) continue;
      var pos = tileXY(i);

      if (cell.el && cell.el.parentNode) {
        styleTile(cell.el, cell, m);
        cell.el.style.left   = pos.x + 'px';
        cell.el.style.top    = pos.y + 'px';
        cell.el.style.zIndex = '1';
        cell.el.classList.remove('tile-removing');
      } else {
        var el = document.createElement('div');
        styleTile(el, cell, m);
        el.style.left   = pos.x + 'px';
        el.style.top    = pos.y + 'px';
        el.style.zIndex = '1';
        el.setAttribute('data-tid', cell.id);
        tilesLayer.appendChild(el);
        cell.el = el;
        if (cell.id === spawnedId) el.classList.add('tile-new');
      }
    }

    /* Slide consumed tiles to merge destination */
    mergePairs.forEach(function(pair) {
      var survivorPos = null;
      for (var i2 = 0; i2 < CELLS; i2++) {
        if (grid[i2] && grid[i2].id === pair.to) { survivorPos = tileXY(i2); break; }
      }
      if (!survivorPos) return;
      var el2 = tilesLayer.querySelector('[data-tid="' + pair.from + '"]');
      if (el2) {
        el2.style.left   = survivorPos.x + 'px';
        el2.style.top    = survivorPos.y + 'px';
        el2.style.zIndex = '0';
      }
    });

    /* Merge-pop */
    setTimeout(function() {
      survivorIds.forEach(function(id) {
        for (var i3 = 0; i3 < CELLS; i3++) {
          if (grid[i3] && grid[i3].id === id && grid[i3].el) {
            void grid[i3].el.offsetWidth;
            grid[i3].el.classList.add('tile-merged');
            break;
          }
        }
      });
    }, INTER_MOVE_MS);

    /* Fade out consumed tiles */
    setTimeout(function() {
      consumedIds.forEach(function(tid) {
        var el3 = tilesLayer.querySelector('[data-tid="' + tid + '"]');
        if (!el3) return;
        el3.classList.add('tile-removing');
        var onEnd = function() {
          el3.removeEventListener('transitionend', onEnd);
          if (el3.parentNode) el3.remove();
        };
        el3.addEventListener('transitionend', onEnd);
        setTimeout(function() { if (el3.parentNode) el3.remove(); }, 150);
      });
    }, INTER_MOVE_MS);
  }

  function renderAll() {
    var m = getMetrics();
    tilesLayer.innerHTML = '';
    for (var i = 0; i < CELLS; i++) {
      var cell = grid[i];
      if (!cell) continue;
      var pos = tileXY(i);
      var el  = document.createElement('div');
      styleTile(el, cell, m);
      el.style.left = pos.x + 'px';
      el.style.top  = pos.y + 'px';
      el.setAttribute('data-tid', cell.id);
      tilesLayer.appendChild(el);
      cell.el = el;
    }
  }

  /* ====================================================================
     PUBLIC API
     ==================================================================== */

  function restart() {
    tilesLayer.innerHTML = '';
    BOARD_SIZE = BOARD_SIZE || 4;
    CELLS      = BOARD_SIZE * BOARD_SIZE;
    grid       = new Array(CELLS).fill(null);
    score      = new Decimal(0);
    nextId     = 0;
    won        = false;
    over       = false;
    inputQueue = [];
    processing = false;

    rebuildGridBg();
    scoreEl.textContent = '0';
    overlayGO.classList.add('hidden');
    overlayWin.classList.add('hidden');

    spawnTile(grid);
    spawnTile(grid);
    renderAll();
  }

  /* ====================================================================
     EXECUTE MOVE
     ==================================================================== */

  function executeMove(dir) {
    var result = computeMove(dir);
    if (!result.changed) return false;

    grid   = result.newGrid;
    score  = score.plus(result.gained);
    scoreEl.textContent = formatScore(score);

    if (score.gt(best)) {
      best = score;
      bestEl.textContent = formatScore(best);
      localStorage.setItem('best2048v2', best.toFixed(0));
    }

    var spawned   = spawnTile(grid);
    var spawnedId = spawned ? spawned.id : null;

    renderMove(result.consumedIds, result.survivorIds, spawnedId, result.mergePairs);
    checkState();
    return true;
  }

  /* ====================================================================
     INPUT QUEUE
     ==================================================================== */

  function processInputQueue() {
    if (processing) return;
    if (inputQueue.length === 0) return;

    if (!overlayWin.classList.contains('hidden')) {
      overlayWin.classList.add('hidden');
    }

    processing = true;
    var dir;
    while (inputQueue.length > 0) {
      dir = inputQueue.shift();
      if (over) { inputQueue = []; processing = false; return; }
    }

    var moved = executeMove(dir);
    if (!moved) {
      processing = false;
      processInputQueue();
      return;
    }

    setTimeout(function() {
      processing = false;
      processInputQueue();
    }, INTER_MOVE_MS);
  }

  function enqueueMove(dir) {
    if (over) return;
    inputQueue.push(dir);
    processInputQueue();
  }

  /* ====================================================================
     DEBUG API
     console 用法:
       game.debug.setCell(idx, exponent)   // idx=格子索引(0-15), exponent=n → 放入 2^n
       game.debug.setCell(0, 20)           // 放入 2^20 = 1048576
       game.debug.setCell(0, 1024)         // 放入 2^1024（任意大！）
       game.debug.getGrid()
       game.debug.forceWin()
     ==================================================================== */

  function debugGetGrid() {
    var result = [];
    for (var i = 0; i < CELLS; i++) {
      if (grid[i]) {
        result.push({
          idx:   i,
          value: grid[i].value.toFixed(0),
          exp:   grid[i].exp,
          id:    grid[i].id
        });
      } else {
        result.push(null);
      }
    }
    return result;
  }

  function debugGetScore() {
    return { score: score.toFixed(0), best: best.toFixed(0) };
  }

  function debugGetState() {
    return { won: won, over: over, processing: processing, queueLen: inputQueue.length };
  }

  /**
   * game.debug.setCell(idx, exponent)
   *   idx      — grid index 0..(CELLS-1)
   *   exponent — integer n, places 2^n in that cell
   *              pass 0 or negative to clear the cell
   */
  function debugSetCell(idx, exponent) {
    if (idx < 0 || idx >= CELLS) {
      console.warn('debug.setCell: 索引越界 (0-' + (CELLS - 1) + ')');
      return false;
    }
    if (grid[idx] && grid[idx].el && grid[idx].el.parentNode) {
      grid[idx].el.remove();
    }
    if (exponent > 0) {
      var val;
      if (exponent <= MAX_FULL_DECIMAL_EXP) {
        /* Exact Decimal: 2^exponent stored at full precision */
        val = D2.pow(exponent);
      } else {
        /* Exponent too large for precision budget — store sentinel.
           Arithmetic (merge) still works via exp field; display uses 2^n. */
        val = new Decimal(1);  /* sentinel — only exp matters for display */
        console.info('debug.setCell: exp=' + exponent + ' exceeds MAX_FULL_DECIMAL_EXP=' +
          MAX_FULL_DECIMAL_EXP + '; stored as sentinel Decimal(1), display = 2^' + exponent);
      }
      var id = ++nextId;
      grid[idx] = { id: id, value: val, exp: exponent, el: null };
    } else {
      grid[idx] = null;
    }
    renderAll();
    return true;
  }

  function debugClearCell(idx) {
    return debugSetCell(idx, 0);
  }

  function debugForceWin() {
    won = true;
    overlayWin.classList.remove('hidden');
  }

  function debugForceLose() {
    over = true;
    overlaySub.textContent = '最终得分: ' + formatScore(score);
    overlayGO.classList.remove('hidden');
    overlayWin.classList.add('hidden');
  }

  function debugForceRender() { renderAll(); }

  function debugResetInput() {
    inputQueue = [];
    processing = false;
  }

  function debugSetScore(val) {
    try { score = new Decimal(val); } catch(e) { score = new Decimal(0); }
    scoreEl.textContent = formatScore(score);
    if (score.gt(best)) {
      best = score;
      bestEl.textContent = formatScore(best);
      localStorage.setItem('best2048v2', best.toFixed(0));
    }
  }

  function debugSetBoardSize(rows) {
    rows = parseInt(rows, 10) || 4;
    if (rows < 2 || rows > 8) {
      console.warn('setBoardSize: 请输入 2–8 之间的数字');
      return false;
    }
    BOARD_SIZE = rows;
    CELLS      = BOARD_SIZE * BOARD_SIZE;
    tilesLayer.innerHTML = '';
    grid       = new Array(CELLS).fill(null);
    score      = new Decimal(0);
    best       = new Decimal(0);
    nextId     = 0;
    won        = false;
    over       = false;
    inputQueue = [];
    processing = false;
    scoreEl.textContent = '0';
    bestEl.textContent  = '0';
    overlayGO.classList.add('hidden');
    overlayWin.classList.add('hidden');
    rebuildGridBg();
    spawnTile(grid);
    spawnTile(grid);
    renderAll();
    console.log('Board size set to ' + BOARD_SIZE + 'x' + BOARD_SIZE);
    return true;
  }

  /* Expose */
  window.game = {
    restart:     restart,
    setBoardSize: debugSetBoardSize,
    settings: {
      /* game.settings.setDisplayMode('normal' | 'scientific') */
      setDisplayMode: function(mode) {
        if (mode !== 'normal' && mode !== 'scientific') {
          console.warn('setDisplayMode: 参数应为 "normal" 或 "scientific"');
          return;
        }
        displayMode = mode;
        displayModeSelect.value = mode;
        renderAll();
      },
      get numberDisplayMode() { return displayMode; }
    },
    debug: {
      getGrid:      debugGetGrid,
      getScore:     debugGetScore,
      getState:     debugGetState,
      /* setCell(idx, exponent)           — idx = 0-based flat index
         setCell(row, col, exponent)      — row/col = 0-based row/column */
      setCell: function(a, b, c) {
        if (c !== undefined) {
          /* 3-arg form: (row, col, exponent) */
          var idx = a * BOARD_SIZE + b;
          return debugSetCell(idx, c);
        }
        /* 2-arg form: (idx, exponent) */
        return debugSetCell(a, b);
      },
      clearCell:    debugClearCell,
      forceWin:     debugForceWin,
      forceLose:    debugForceLose,
      forceRender:  debugForceRender,
      resetInput:   debugResetInput,
      setScore:     debugSetScore,
      setBoardSize: debugSetBoardSize
    }
  };

  /* ====================================================================
     INPUT HANDLING  (unchanged)
     ==================================================================== */

  document.addEventListener('keydown', function(e) {
    var key = e.key;
    if (key === 'ArrowUp'    || key === 'w' || key === 'W') { e.preventDefault(); enqueueMove('up'); }
    if (key === 'ArrowDown'  || key === 's' || key === 'S') { e.preventDefault(); enqueueMove('down'); }
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { e.preventDefault(); enqueueMove('left'); }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { e.preventDefault(); enqueueMove('right'); }
  });

  window.addEventListener('keydown', function(e) {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].indexOf(e.key) !== -1) {
      if (document.activeElement === document.body) e.preventDefault();
    }
  });

  (function() {
    var sx = 0, sy = 0, tracking = false;
    function onStart(x, y) {
      if (over) return;
      if (!overlayWin.classList.contains('hidden')) overlayWin.classList.add('hidden');
      sx = x; sy = y; tracking = true;
    }
    function onEnd(x, y) {
      if (!tracking) return;
      tracking = false;
      var dx = x - sx, dy = y - sy;
      var minSwipe = 20;
      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        enqueueMove(dx > 0 ? 'right' : 'left');
      } else {
        enqueueMove(dy > 0 ? 'down' : 'up');
      }
    }
    gridWrapper.addEventListener('mousedown',  function(e) { onStart(e.clientX, e.clientY); });
    document.addEventListener('mouseup',       function(e) { onEnd(e.clientX, e.clientY); });
    gridWrapper.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    gridWrapper.addEventListener('touchend',   function(e) { var t = e.changedTouches[0]; onEnd(t.clientX, t.clientY); });
  })();

  document.getElementById('btnNewGame').addEventListener('click', restart);
  document.getElementById('btnContinue').addEventListener('click', function() {
    overlayWin.classList.add('hidden');
  });

  window.addEventListener('resize', function() { renderAll(); });

  /* ====================================================================
     BOOT
     ==================================================================== */
  rebuildGridBg();
  spawnTile(grid);
  spawnTile(grid);
  renderAll();

})();
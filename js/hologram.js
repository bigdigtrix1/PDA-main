/* ==========================================================================
   PDA — holographic hexagon backdrop
   Canvas 2D field of drifting wireframe hexagons with scroll & mouse
   parallax. Renders a single static frame when reduced motion is requested.
   ========================================================================== */

(function () {
  "use strict";

  var container = document.getElementById("holo-bg");
  if (!container) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sparse = document.body.dataset.holo === "sparse";

  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  container.appendChild(canvas);

  var TAU = Math.PI * 2;
  var dpr = 1;
  var w = 0;
  var h = 0;
  var margin = 120; // hexes wrap this far past the viewport edge
  var hexes = [];
  var motes = [];
  var mouseX = 0.5;
  var running = false;

  var CYAN = "56, 223, 255";
  var STEEL = "125, 147, 168";

  function rand(min, max) { return min + Math.random() * (max - min); }

  function makeHex() {
    var big = Math.random() < 0.22;
    return {
      x: rand(-margin, w + margin),
      y: rand(-margin, h + margin),
      r: big ? rand(46, 96) : rand(9, 40),
      depth: rand(0.25, 1),
      rot: rand(0, TAU),
      rotV: rand(-0.0028, 0.0028),
      vx: rand(-0.05, 0.05),
      vy: -rand(0.04, 0.22),
      pulse: rand(0, TAU),
      pulseV: rand(0.006, 0.018),
      steel: Math.random() < 0.3,
      nested: Math.random() < 0.35,
      filled: Math.random() < 0.22
    };
  }

  function makeMote() {
    return {
      x: rand(0, 1),
      y: rand(0, 1),
      r: rand(0.6, 1.8),
      depth: rand(0.4, 1),
      vy: -rand(0.00008, 0.00030),
      pulse: rand(0, TAU),
      pulseV: rand(0.01, 0.03)
    };
  }

  function populate() {
    var density = sparse ? 26000 : 17000;
    var count = Math.max(14, Math.min(44, Math.round((w * h) / density)));
    hexes = [];
    for (var i = 0; i < count; i++) hexes.push(makeHex());

    var moteCount = Math.round(count * 1.6);
    motes = [];
    for (var j = 0; j < moteCount; j++) motes.push(makeMote());
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = container.clientWidth;
    h = container.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    populate();
    if (reducedMotion) drawFrame(0);
  }

  function hexPath(x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = rot + (i * TAU) / 6;
      var px = x + r * Math.cos(a);
      var py = y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawFrame(scrollY) {
    ctx.clearRect(0, 0, w, h);

    var span = h + margin * 2;
    var mouseShift = (mouseX - 0.5) * 30;
    var i, m, px, py, alpha, color;

    for (i = 0; i < motes.length; i++) {
      m = motes[i];
      py = m.y * span - scrollY * 0.18 * m.depth;
      py = ((py % span) + span) % span - margin;
      px = m.x * (w + margin * 2) - margin + mouseShift * m.depth * 0.6;
      alpha = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(m.pulse))) * m.depth * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, m.r, 0, TAU);
      ctx.fillStyle = "rgba(" + CYAN + ", " + alpha.toFixed(3) + ")";
      ctx.fill();
    }

    for (i = 0; i < hexes.length; i++) {
      var hx = hexes[i];
      py = hx.y - scrollY * 0.14 * hx.depth;
      py = ((py % span) + span) % span - margin;
      px = hx.x + mouseShift * hx.depth;

      alpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(hx.pulse))) * hx.depth;
      color = hx.steel ? STEEL : CYAN;
      var lineAlpha = alpha * (hx.steel ? 0.4 : 0.55);

      // faked glow: one wide, faint stroke under a thin bright one
      hexPath(px, py, hx.r, hx.rot);
      ctx.lineWidth = Math.min(6, 1.5 + hx.r * 0.09);
      ctx.strokeStyle = "rgba(" + color + ", " + (lineAlpha * 0.22).toFixed(3) + ")";
      ctx.stroke();

      if (hx.filled) {
        ctx.fillStyle = "rgba(" + color + ", " + (lineAlpha * 0.10).toFixed(3) + ")";
        ctx.fill();
      }

      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "rgba(" + color + ", " + lineAlpha.toFixed(3) + ")";
      ctx.stroke();

      if (hx.nested) {
        hexPath(px, py, hx.r * 0.55, -hx.rot * 1.4);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(" + color + ", " + (lineAlpha * 0.65).toFixed(3) + ")";
        ctx.stroke();
      }
    }
  }

  function step() {
    var i;
    for (i = 0; i < hexes.length; i++) {
      var hx = hexes[i];
      hx.x += hx.vx * hx.depth;
      hx.y += hx.vy * hx.depth;
      hx.rot += hx.rotV;
      hx.pulse += hx.pulseV;
      if (hx.x < -margin) hx.x = w + margin;
      if (hx.x > w + margin) hx.x = -margin;
      if (hx.y < -margin) hx.y = h + margin;
    }
    for (i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.y += m.vy * m.depth;
      m.pulse += m.pulseV;
      if (m.y < 0) m.y = 1;
    }
  }

  function loop() {
    if (!running) return;
    step();
    drawFrame(window.scrollY || 0);
    requestAnimationFrame(loop);
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function stop() { running = false; }

  window.addEventListener("resize", resize);

  window.addEventListener("mousemove", function (e) {
    mouseX = e.clientX / Math.max(1, window.innerWidth);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  resize();
  start();
})();

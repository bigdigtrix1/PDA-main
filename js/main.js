/* ==========================================================================
   PDA — page interactions
   Nav toggle, scroll-reveal for holo cards, per-card float + scroll
   parallax, and a light hover tilt. All motion respects
   prefers-reduced-motion.
   ========================================================================== */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- mobile nav toggle ---- */

  var navToggle = document.getElementById("navToggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    navLinks.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- nav background on scroll ---- */

  var siteNav = document.getElementById("siteNav");

  function onNavScroll() {
    if (!siteNav) return;
    siteNav.classList.toggle("scrolled", (window.scrollY || 0) > 10);
  }

  window.addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();

  /* ---- active section highlight (index page only) ---- */

  var sectionLinks = document.querySelectorAll(".nav-links a[data-nav]");
  if (sectionLinks.length) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        sectionLinks.forEach(function (link) {
          link.classList.toggle("active", link.dataset.nav === entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px" });

    sectionLinks.forEach(function (link) {
      var target = document.getElementById(link.dataset.nav);
      if (target) sectionObserver.observe(target);
    });
  }

  /* ---- scroll-reveal for cards ---- */

  var cards = Array.prototype.slice.call(document.querySelectorAll(".holo-card"));

  if (reducedMotion) {
    cards.forEach(function (card) { card.classList.add("visible"); });
  } else if (cards.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });

    cards.forEach(function (card) { revealObserver.observe(card); });
  }

  /* ---- float + scroll parallax on card wrappers ---- */

  var floaters = Array.prototype.slice.call(document.querySelectorAll(".holo[data-float]"));

  if (!reducedMotion && floaters.length) {
    var items = floaters.map(function (el, i) {
      return {
        el: el,
        drift: parseFloat(el.dataset.drift || "18"),
        phase: i * 1.7,
        speed: 0.9 + (i % 3) * 0.25,
        amp: 5 + (i % 3) * 2
      };
    });

    function updateFloaters(time) {
      var vh = window.innerHeight;
      var t = time / 1000;

      items.forEach(function (item) {
        var rect = item.el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        // -1 (above viewport center) … +1 (below): cards lag behind the
        // scroll slightly, which reads as hovering in front of the backdrop
        var progress = Math.max(-1, Math.min(1, (center - vh / 2) / vh));
        var parallax = progress * item.drift;
        var bob = Math.sin(t * item.speed + item.phase) * item.amp;
        item.el.style.transform = "translate3d(0, " + (parallax + bob).toFixed(2) + "px, 0)";
      });

      requestAnimationFrame(updateFloaters);
    }

    requestAnimationFrame(updateFloaters);
  }

  /* ---- hover tilt (fine pointers only) ---- */

  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!reducedMotion && finePointer) {
    cards.forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        if (!card.classList.contains("visible")) return;
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transition = "transform 0.12s ease-out";
        card.style.transform =
          "perspective(800px) rotateX(" + (-y * 3).toFixed(2) + "deg)" +
          " rotateY(" + (x * 3).toFixed(2) + "deg)";
      });

      card.addEventListener("pointerleave", function () {
        card.style.transition = "transform 0.5s ease";
        card.style.transform = "";
      });
    });
  }
})();

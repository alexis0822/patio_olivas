/* Patio Olivas — site interactions
   - Nav: transparent over hero → solid on scroll
   - Hamburger: full-screen slide-in overlay (Esc / link click closes)
   - Rotating word in overlay
   - Scroll reveal (IntersectionObserver)
   - Hero parallax
   - Scroll-spy for nav + menu-page sub-nav
   - Back-to-top button, dynamic year
*/
(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Nav scrolled state ---------- */
  const nav = $("#nav");
  const onScrollNav = () => {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* ---------- Overlay menu ---------- */
  const overlay = $("#overlay");
  const burger = $("#burger");
  const overlayClose = $("#overlayClose");
  let lastFocus = null;

  const openOverlay = () => {
    if (!overlay) return;
    lastFocus = document.activeElement;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    burger && burger.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
    setTimeout(() => overlayClose && overlayClose.focus(), 350);
  };
  const closeOverlay = () => {
    if (!overlay || !overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    burger && burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
    lastFocus && lastFocus.focus && lastFocus.focus();
  };

  burger && burger.addEventListener("click", openOverlay);
  overlayClose && overlayClose.addEventListener("click", closeOverlay);
  overlay && $$("a", overlay).forEach((a) => a.addEventListener("click", closeOverlay));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });

  /* ---------- Rotating word ---------- */
  const rotator = $(".rotator");
  if (rotator && !reduceMotion) {
    const words = (rotator.dataset.words || "").split(",").map((w) => w.trim()).filter(Boolean);
    let i = 0;
    if (words.length > 1) {
      setInterval(() => {
        rotator.classList.add("is-swapping");
        setTimeout(() => {
          i = (i + 1) % words.length;
          rotator.textContent = words[i];
          rotator.classList.remove("is-swapping");
        }, 260);
      }, 1800);
    }
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = $$(".reveal");
  if (reveals.length) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach((el) => io.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add("is-visible"));
    }
  }

  /* ---------- Hero parallax ---------- */
  const heroBg = $(".hero__bg");
  if (heroBg && !reduceMotion) {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        heroBg.style.transform = `translateY(${y * 0.25}px) scale(1.05)`;
      }
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* ---------- Scroll-spy (nav links on index, subnav on menu page) ---------- */
  const spyLinks = $$(".nav__links a[href^='#'], .subnav a[href^='#']");
  if (spyLinks.length && "IntersectionObserver" in window) {
    const targets = spyLinks
      .map((a) => $(a.getAttribute("href")))
      .filter(Boolean);

    const setActive = (id) => {
      spyLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
      // keep active subnav link in view on narrow screens
      const active = $(`.subnav a[href='#${id}']`);
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
      }
    };

    const spy = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] });

    targets.forEach((t) => spy.observe(t));
  }

  /* ---------- Back to top ---------- */
  const toTop = $(".to-top");
  if (toTop) {
    const toggle = () => toTop.classList.toggle("is-visible", window.scrollY > 600);
    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
    toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  }

  /* ---------- Year ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();

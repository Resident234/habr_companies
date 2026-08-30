// ==========================================================
// Techarin Creative Agency Template — Main JS
// ----------------------------------------------------------
// This script centralizes all interactive behaviors used
// across pages, so you can:
// - Maintain one source of truth for animations and smooth scroll
// - Easily add/remove sections without editing multiple files
//
// Dependencies (loaded via CDN in HTML):
// - GSAP 3.x (https://greensock.com/gsap/)
// - GSAP ScrollTrigger plugin
// - Lenis smooth scroll (https://github.com/studio-freight/lenis)
//
// All code is written in plain ES6 and does not rely on
// frameworks. Feel free to modularize if you introduce a
// bundler (Vite, Webpack, etc.) later.
// ==========================================================

(function () {
  // Guard clause for environments without window (SSR / pre-render)
  if (typeof window === 'undefined') return;

  // --------------------------------------------------------
  // 1. Lenis Smooth Scrolling
  // --------------------------------------------------------
  let lenis;

  function initLenis() {
    if (typeof Lenis === 'undefined') {
      //console.warn('[Techarin] Lenis not found. Smooth scrolling disabled.');
      return;
    }

    lenis = new Lenis({
      // Tweak these to taste
      duration: 1.1,
      smoothWheel: true,
      smoothTouch: false,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    // Keep ScrollTrigger in sync with Lenis scroll positions
    lenis.on('scroll', () => {
      if (window.ScrollTrigger) {
        ScrollTrigger.update();
      }
    });

    // Use GSAP's ticker if available to drive Lenis;
    // fall back to requestAnimationFrame otherwise.
    if (window.gsap && gsap.ticker) {
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }

    // Expose globally in case you want to debug
    window.__lenis = lenis;
  }

  // --------------------------------------------------------
  // 2. Animate-on-scroll helpers (powered by GSAP + ScrollTrigger)
  // --------------------------------------------------------

  /**
   * Build animation props based on data-animate attribute.
   * Extend this switch with your own animation styles.
   */
  function getAnimationConfig(type) {
    const base = {
      duration: 0.8,
      ease: 'power2.out',
      opacity: 0,
    };

    switch (type) {
      case 'fade-up':
        return { ...base, y: 40 };
      case 'fade-down':
        return { ...base, y: -40 };
      case 'fade-left':
        return { ...base, x: 40 };
      case 'fade-right':
        return { ...base, x: -40 };
      case 'scale-in':
        return { ...base, scale: 0.9 };
      case 'blur-in':
        return { ...base, filter: 'blur(8px)' };
      default:
        return base;
    }
  }

  function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('[Techarin] GSAP or ScrollTrigger not found. Animations disabled.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Animate any element with [data-animate]
    const animatedElements = document.querySelectorAll('[data-animate]');

    animatedElements.forEach((el) => {
      const type = el.getAttribute('data-animate') || 'fade-up';
      const delay = parseFloat(el.getAttribute('data-delay')) || 0;
      const config = getAnimationConfig(type);

      // Set initial state
      gsap.set(el, {
        opacity: 0,
        y: config.y || 0,
        x: config.x || 0,
        scale: config.scale || 1,
        filter: config.filter || 'blur(0px)',
      });

      // Create ScrollTrigger animation
      gsap.to(el, {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: config.duration,
        ease: config.ease,
        delay,
        scrollTrigger: {
          trigger: el,
          start: 'top 80%', // when element's top hits 80% of viewport
          toggleActions: 'play none none reverse',
        },
      });
    });
  }

  // --------------------------------------------------------
  // 3. Parallax items in hero
  // --------------------------------------------------------
  function initParallaxItems() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const items = document.querySelectorAll('[data-parallax-item]');
    if (!items.length) return;

    items.forEach((item) => {
      const depth = parseFloat(item.getAttribute('data-parallax-depth') || '0.3');

      gsap.to(item, {
        yPercent: depth * -30,
        ease: 'none',
        scrollTrigger: {
          trigger: item,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });
  }

  // --------------------------------------------------------
  // 4. Mobile navigation toggle
  // --------------------------------------------------------
  function initMobileNav() {
    const toggle = document.querySelector('[data-mobile-nav-toggle]');
    const panel = document.querySelector('[data-mobile-nav-panel]');

    if (!toggle || !panel) return;

    let isOpen = false;
    const collapsedStyles = {
      maxHeight: 0,
      opacity: 0,
    };
    const expandedStyles = {
      maxHeight: panel.scrollHeight,
      opacity: 1,
    };

    const applyStyles = (styles) => {
      Object.keys(styles).forEach((key) => {
        panel.style[key] = typeof styles[key] === 'number' ? `${styles[key]}px` : String(styles[key]);
      });
    };

    toggle.addEventListener('click', () => {
      isOpen = !isOpen;
      if (isOpen) {
        applyStyles(expandedStyles);
      } else {
        applyStyles(collapsedStyles);
      }
    });

    // Close menu when clicking any internal link
    panel.querySelectorAll('a[href^="#"], a[href$=".html"]').forEach((link) => {
      link.addEventListener('click', () => {
        isOpen = false;
        applyStyles(collapsedStyles);
      });
    });
  }

  // --------------------------------------------------------
  // 5. Dynamic year in footer
  // --------------------------------------------------------
  function setCurrentYear() {
    const yearEls = document.querySelectorAll('#year');
    if (!yearEls.length) return;
    const currentYear = new Date().getFullYear();
    yearEls.forEach((el) => {
      el.textContent = String(currentYear);
    });
  }

  // --------------------------------------------------------
  // 6. Init on DOMContentLoaded
  // --------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    try {
      initLenis();
      //initScrollAnimations();
      initParallaxItems();
      initMobileNav();
      setCurrentYear();
    } catch (error) {
      console.error('[Techarin] Initialization error:', error);
    }
  });
})();

// Go to top (safe)
document.addEventListener("DOMContentLoaded", function () {
var mybutton = document.getElementById("GoToTop");
if (!mybutton) return; // Exit if button not found

// Show/hide button on scroll
window.addEventListener("scroll", function () {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    mybutton.style.opacity = "1";
    mybutton.style.right = "30px";
    mybutton.style.bottom = "90px";
    mybutton.style.transform = "translate3d(1%,1%,0)";
  } else {
    mybutton.style.opacity = "0";
    mybutton.style.right = "0px";
    mybutton.style.bottom = "0px";
    mybutton.style.transform = "translate3d(0,1%,0)";
  }
});

// Scroll to top when clicked
mybutton.addEventListener("click", function () {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE, Opera
});
});



document.querySelectorAll("details").forEach((el) => {
  const summary = el.querySelector("summary");
  const content = el.querySelector("p");

  // Set initial state
  if (!el.hasAttribute("open")) {
    content.style.height = "0px";
  }

  summary.addEventListener("click", (e) => {
    e.preventDefault();

    const isOpen = el.hasAttribute("open");
    el.classList.add("animating");

    if (isOpen) {
      // CLOSE
      const height = content.scrollHeight;
      content.style.height = height + "px";

      requestAnimationFrame(() => {
        content.style.height = "0px";
        content.style.opacity = "0";
      });

      setTimeout(() => {
        el.removeAttribute("open");
        el.classList.remove("animating");
      }, 350);

    } else {
      // OPEN
      el.setAttribute("open", "");
      const height = content.scrollHeight;

      content.style.height = "0px";
      content.style.opacity = "0";

      requestAnimationFrame(() => {
        content.style.height = height + "px";
        content.style.opacity = "1";
      });

      setTimeout(() => {
        content.style.height = "auto";
        el.classList.remove("animating");
      }, 350);
    }
  });
});

/*Mobile Menu*/
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.querySelector("[data-mobile-nav-toggle]");
  const sidebar = document.getElementById("mobileSidebar");
  const overlay = document.getElementById("mobileOverlay");
  const closeBtn = document.getElementById("closeSidebar");

  if (!openBtn || !sidebar || !overlay || !closeBtn) return;

  function openSidebar() {
    sidebar.style.right = "0";
    overlay.classList.remove("opacity-0", "pointer-events-none");
  }

  function closeSidebar() {
    sidebar.style.right = "-100%";
    overlay.classList.add("opacity-0", "pointer-events-none");
  }

  openBtn.addEventListener("click", openSidebar);
  closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
});

/*Mobile Menu*/
// Mobile main menu toggle
document.querySelectorAll("[data-mobile-nav-toggle]").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = document.querySelector("[data-mobile-nav-panel]");
    const open = panel.style.maxHeight && panel.style.maxHeight !== "0px";
    panel.style.maxHeight = open ? "0px" : panel.scrollHeight + "px";
    panel.style.opacity = open ? "0" : "1";
  });
});

// Mobile dropdown inside menu
document.querySelectorAll(".mobile-dd-toggle").forEach(toggle => {
  toggle.addEventListener("click", () => {
    const panel = toggle.nextElementSibling;
    toggle.querySelector("svg").classList.toggle("rotate-180");
    panel.classList.toggle("hidden");
  });
});


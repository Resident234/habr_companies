gsap.registerPlugin(ScrollTrigger);

const TextFx = (() => {
  const EFFECTS = {};
  const EFFECT_GROUPS = {
    minimal: [],
    advanced: [],
    crazy: []
  };

  // ---------- Helpers ----------

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function parseBool(v, fallback = false) {
    if (v === undefined) return fallback;
    return v === "true" || v === true;
  }

  function parseNum(v, fallback) {
    if (v === undefined) return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }

  // ---------- Splitters ----------

  function splitChars(el) {
  // FIX 1: Trim leading/trailing whitespace
  // FIX 2: Replace multiple spaces with a single space
  // FIX 3: Remove line breaks & tabs from inner text
  const text = el.textContent
    .replace(/\s+/g, " ") // normalize spaces
    .trim(); // remove edge spaces

  el.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const span = document.createElement("span_anim");
    span.classList.add("fx-char");
    span.style.display = "inline-block";

    // Keep normal spaces but no extra
    span.textContent = ch === " " ? "\u00A0" : ch;

    frag.appendChild(span);
  }

  el.appendChild(frag);
  return el.querySelectorAll(".fx-char");
}


  function splitWords(el) {
    const text = el.textContent.trim().replace(/\s+/g, " ");
    el.innerHTML = "";
    const frag = document.createDocumentFragment();
    const words = text.split(" ");

    words.forEach((word, i) => {
      const span = document.createElement("span_anim");
      span.classList.add("fx-word");
      span.style.display = "inline-block";
      span.textContent = word;
      frag.appendChild(span);
      if (i < words.length - 1) {
        frag.appendChild(document.createTextNode(" "));
      }
    });

    el.appendChild(frag);
    return el.querySelectorAll(".fx-word");
  }

  // Simple line splitter (based on <br> only)
  function splitLines(el) {
    const html = el.innerHTML;
    const parts = html.split(/<br\s*\/?>/i);
    el.innerHTML = "";
    const frag = document.createDocumentFragment();

    parts.forEach((chunk, i) => {
      const span = document.createElement("span_anim");
      span.classList.add("fx-line");
      span.style.display = "block";
      span.innerHTML = chunk;
      frag.appendChild(span);
      if (i < parts.length - 1) {
        const br = document.createElement("br");
        frag.appendChild(br);
      }
    });

    el.appendChild(frag);
    return el.querySelectorAll(".fx-line");
  }

  function splitElement(el, mode) {
    switch (mode) {
      case "words":  return splitWords(el);
      case "lines":  return splitLines(el);
      case "chars":
      default:       return splitChars(el);
    }
  }

  // ---------- Register effect helper ----------

  function registerEffect(name, group, fn) {
    EFFECTS[name] = fn;
    if (group && EFFECT_GROUPS[group]) {
      EFFECT_GROUPS[group].push(name);
    }
  }

  // ---------- Define Effects ----------

  // Minimal group
  registerEffect("fade-in", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      duration: opts.duration || 0.8,
      stagger: opts.stagger || 0.03,
      ease: "power2.out"
    });
  });

  registerEffect("fade-up", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 40,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.035,
      ease: "power3.out"
    });
  });

  registerEffect("fade-down", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: -40,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.035,
      ease: "power3.out"
    });
  });

  registerEffect("slide-left", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: -50,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.03,
      ease: "power2.out"
    });
  });

  registerEffect("slide-right", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: 50,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.03,
      ease: "power2.out"
    });
  });

  registerEffect("soft-scale", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 0.9,
      duration: opts.duration || 0.7,
      stagger: opts.stagger || 0.03,
      ease: "power2.out"
    });
  });

  registerEffect("blur-in", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 15,
      filter: "blur(10px)",
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.035,
      ease: "power3.out"
    });
  });

  registerEffect("typewriter", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      duration: opts.duration || 0.03,
      stagger: opts.stagger || 0.03,
      ease: "none"
    });
  });

  registerEffect("letter-spread", "minimal", (targets, tl, opts) => {
    tl.fromTo(targets, {
      opacity: 0,
      x: -20
    }, {
      opacity: 1,
      x: 0,
      duration: opts.duration || 0.8,
      stagger: opts.stagger || 0.03,
      ease: "power3.out"
    });
  });

  // Word-based minimal
  registerEffect("word-fade-up", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 30,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.06,
      ease: "power2.out"
    });
  });

  registerEffect("word-slide-in", "minimal", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: 40,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.07,
      ease: "power3.out"
    });
  });

  // Advanced group
  registerEffect("rotate-x", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      rotateX: -90,
      transformOrigin: "top",
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.04,
      ease: "back.out(1.7)"
    });
  });

  registerEffect("rotate-y", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      rotateY: 90,
      transformOrigin: "center",
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.04,
      ease: "power4.out"
    });
  });

  registerEffect("flip-in", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      rotateY: -180,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.05,
      ease: "power3.out"
    });
  });

  registerEffect("zoom-in", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 0.2,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.05,
      ease: "elastic.out(1, 0.4)"
    });
  });

  registerEffect("zoom-out", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 2.5,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.05,
      ease: "power4.out"
    });
  });

  registerEffect("bounce-up", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 80,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.04,
      ease: "bounce.out"
    });
  });

  registerEffect("fall-down", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: -120,
      rotateZ: -15,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.04,
      ease: "power3.out"
    });
  });

  registerEffect("skew-in", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: -40,
      skewX: 25,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.035,
      ease: "power3.out"
    });
  });

  registerEffect("wave", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: (i) => Math.sin(i * 0.5) * 25,
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.03,
      ease: "power2.out"
    });
  });

  registerEffect("center-pop", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 2,
      duration: opts.duration || 0.8,
      stagger: {
        each: opts.stagger || 0.04,
        from: "center"
      },
      ease: "back.out(2)"
    });
  });

  registerEffect("from-edges", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 40,
      duration: opts.duration || 0.8,
      stagger: {
        each: opts.stagger || 0.04,
        from: "edges"
      },
      ease: "power3.out"
    });
  });

  // Line-based advanced
  registerEffect("line-slide-up", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: 40,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.12,
      ease: "power3.out"
    });
  });

  registerEffect("line-mask", "advanced", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: -60,
      duration: opts.duration || 0.9,
      stagger: opts.stagger || 0.12,
      ease: "power3.out"
    });
  });

  // Crazy group
  registerEffect("random-scatter", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: () => gsap.utils.random(-150, 150),
      y: () => gsap.utils.random(-150, 150),
      rotateZ: () => gsap.utils.random(-45, 45),
      duration: opts.duration || 1.2,
      stagger: opts.stagger || 0.035,
      ease: "expo.out"
    });
  });

  registerEffect("magnet", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: () => gsap.utils.random(-200, 200),
      y: () => gsap.utils.random(-200, 200),
      duration: opts.duration || 1.5,
      stagger: opts.stagger || 0.03,
      ease: "elastic.out(1, 0.4)"
    });
  });

  registerEffect("glitch", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: () => gsap.utils.random(-5, 5),
      y: () => gsap.utils.random(-5, 5),
      filter: "blur(4px)",
      duration: opts.duration || 0.4,
      stagger: opts.stagger || 0.02,
      ease: "steps(2)"
    }).to(targets, {
      x: 0,
      y: 0,
      filter: "blur(0px)",
      duration: 0.3,
      stagger: opts.stagger || 0.02,
      ease: "power2.out"
    }, ">-0.2");
  });

  registerEffect("neon-flicker", "crazy", (targets, tl, opts) => {
    tl.fromTo(targets, {
      opacity: 0
    }, {
      opacity: 1,
      duration: opts.duration || 0.7,
      stagger: {
        each: opts.stagger || 0.03,
        from: "random"
      },
      ease: "steps(3)"
    });
  });

  registerEffect("shake-pop", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 0,
      x: () => gsap.utils.random(-10, 10),
      y: () => gsap.utils.random(-10, 10),
      duration: opts.duration || 1,
      stagger: opts.stagger || 0.04,
      ease: "elastic.out(1, 0.4)"
    });
  });

  registerEffect("elastic-drop", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      y: -200,
      duration: opts.duration || 1.4,
      stagger: opts.stagger || 0.05,
      ease: "elastic.out(1, 0.4)"
    });
  });

  registerEffect("spin-in", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      scale: 0,
      rotateZ: 360,
      duration: opts.duration || 1.2,
      stagger: opts.stagger || 0.04,
      ease: "power3.out"
    });
  });

  registerEffect("warp", "crazy", (targets, tl, opts) => {
    tl.from(targets, {
      opacity: 0,
      x: () => gsap.utils.random(-120, 120),
      y: () => gsap.utils.random(-80, 80),
      skewX: () => gsap.utils.random(-25, 25),
      duration: opts.duration || 1.2,
      stagger: opts.stagger || 0.03,
      ease: "expo.out"
    });
  });

  /* ---------------------- EXTRA MINIMAL EFFECTS ---------------------- */

        registerEffect("fade-left", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 30,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("fade-rotate", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 25,
            rotateZ: 8,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("soft-float", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 20,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power1.out"
          }).to(targets, {
            y: "-=6",
            duration: 1.4,
            repeat: 0,
            yoyo: true,
            ease: "sine.inOut"
          }, "<");
        });

        registerEffect("clip-up", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            y: 20,
            clipPath: "inset(100% 0% 0% 0%)"
          }, {
            opacity: 1,
            y: 0,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("blur-soft", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            filter: "blur(8px)"
          }, {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("letter-jump", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 15,
            duration: opts.duration || 0.4,
            stagger: opts.stagger || 0.03,
            ease: "back.out(2)"
          });
        });

        /* word-based minimal extras */
        registerEffect("word-fade-rotate", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: -8,
            y: 20,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.06,
            ease: "power3.out"
          });
        });

        registerEffect("word-scale-in", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0.8,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.06,
            ease: "power2.out"
          });
        });


        /* ---------------------- EXTRA ADVANCED EFFECTS ---------------------- */

        registerEffect("perspective-up", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 40,
            rotateX: 45,
            transformOrigin: "bottom center",
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "power3.out"
          });
        });

        registerEffect("tilt-in-left", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: -60,
            rotateZ: -10,
            skewX: 5,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("parallax-layer", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: (i) => 50 + i * 8,
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("ripple-in", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0.6,
            duration: opts.duration || 0.9,
            stagger: {
              each: opts.stagger || 0.05,
              from: "center"
            },
            ease: "back.out(1.7)"
          });
        });

        registerEffect("orbit", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 40,
            y: -40,
            rotateZ: 20,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "power3.out"
          });
        });

        registerEffect("line-reveal-down", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: -50,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.12,
            ease: "power3.out"
          });
        });

        registerEffect("line-fade-scale", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0.9,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.1,
            ease: "power2.out"
          });
        });


        /* ---------------------- EXTRA CRAZY EFFECTS ---------------------- */

        registerEffect("spiral-in", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0,
            rotateZ: -180,
            x: (i) => gsap.utils.random(-80, 80),
            y: (i) => gsap.utils.random(-80, 80),
            duration: opts.duration || 1.4,
            stagger: opts.stagger || 0.04,
            ease: "expo.out"
          });
        });

        registerEffect("explode-in", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 3,
            x: () => gsap.utils.random(-200, 200),
            y: () => gsap.utils.random(-200, 200),
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.04,
            ease: "power4.out"
          });
        });

        registerEffect("jelly", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scaleX: 1.4,
            scaleY: 0.6,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.04,
            ease: "elastic.out(1, 0.3)"
          });
        });

        registerEffect("swing-in", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: -30,
            transformOrigin: "top left",
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.04,
            ease: "back.out(2)"
          });
        });

        registerEffect("heartbeat", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.04,
            ease: "back.out(2)"
          }).to(targets, {
            scale: 1.1,
            duration: 0.2,
            repeat: 1,
            yoyo: true,
            stagger: opts.stagger || 0.04,
            ease: "power1.inOut"
          }, ">-0.2");
        });

        registerEffect("zigzag-in", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: (i) => (i % 2 === 0 ? -40 : 40),
            y: 40,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("warp-rotate", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-120, 120),
            y: () => gsap.utils.random(-80, 80),
            rotateZ: () => gsap.utils.random(-90, 90),
            duration: opts.duration || 1.3,
            stagger: opts.stagger || 0.03,
            ease: "expo.out"
          });
        });
        
        registerEffect("fade-zoom-soft", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 1.1,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("smooth-rise", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 18,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "sine.out"
          });
        });

        registerEffect("fade-diagonal", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: -20,
            y: 20,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("float-up", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 25,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.03,
            ease: "sine.out"
          });
        });

        registerEffect("soft-wipe-right", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            clipPath: "inset(0 100% 0 0)"
          }, {
            opacity: 1,
            clipPath: "inset(0 0% 0 0)",
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("soft-wipe-up", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            clipPath: "inset(100% 0 0 0)"
          }, {
            opacity: 1,
            clipPath: "inset(0 0 0 0)",
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("fade-tilt", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: -6,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("micro-pop", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0.95,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.02,
            ease: "back.out(1.6)"
          });
        });

        registerEffect("flow-up", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 35,
            rotateX: 10,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("nano-slide", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 10,
            duration: opts.duration || 0.5,
            stagger: opts.stagger || 0.02,
            ease: "power1.out"
          });
        });        
        
        registerEffect("rotate-z-in", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: 45,
            scale: 0.8,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("perspective-right", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateY: -60,
            x: -50,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "power3.out"
          });
        });

        registerEffect("perspective-left", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateY: 60,
            x: 50,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "power3.out"
          });
        });

        registerEffect("depth-rise", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            z: -200,
            scale: 0.7,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "expo.out"
          });
        });

        registerEffect("flip-x-soft", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: -120,
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.05,
            ease: "back.out(2)"
          });
        });

        registerEffect("flip-z", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: 180,
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.05,
            ease: "power4.out"
          });
        });

        registerEffect("parallax-drop", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: (i) => -80 - i * 10,
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.04,
            ease: "expo.out"
          });
        });

        registerEffect("skew-zoom", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            skewX: 25,
            scale: 0.8,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("twist-in", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: (i) => i % 2 ? -20 : 20,
            y: 40,
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.06,
            ease: "power4.out"
          });
        });

        registerEffect("line-wipe", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            clipPath: "inset(0 0 100% 0)",
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.1,
            ease: "power2.out"
          });
        });
        
        registerEffect("chaos-fall", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: () => gsap.utils.random(-90, 90),
            y: () => gsap.utils.random(-150, -250),
            duration: opts.duration || 1.3,
            stagger: opts.stagger || 0.03,
            ease: "bounce.out"
          });
        });

        registerEffect("blast-center", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 4,
            rotateZ: () => gsap.utils.random(-180, 180),
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.03,
            ease: "power4.out"
          });
        });

        registerEffect("jitter", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-20, 20),
            y: () => gsap.utils.random(-20, 20),
            rotateZ: () => gsap.utils.random(-10, 10),
            duration: opts.duration || 0.4,
            stagger: opts.stagger || 0.02,
            ease: "steps(3)"
          });
        });

        registerEffect("frenzy-pop", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0,
            rotateZ: () => gsap.utils.random(-60, 60),
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.03,
            ease: "elastic.out(1, 0.4)"
          });
        });

        registerEffect("squash-stretch", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scaleX: 1.8,
            scaleY: 0.3,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.04,
            ease: "elastic.out(1, 0.4)"
          });
        });

        registerEffect("planet-orbit", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-80, 80),
            y: () => gsap.utils.random(-80, 80),
            rotateZ: 180,
            duration: opts.duration || 1.3,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("spin-bounce", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0.2,
            rotateZ: 360,
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.04,
            ease: "bounce.out"
          });
        });

        registerEffect("random-snap", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-150, 150),
            y: () => gsap.utils.random(-150, 150),
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.02,
            ease: "steps(4)"
          });
        });

        registerEffect("shockwave", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.04,
            ease: "power4.out"
          }).to(targets, {
            scale: 1.2,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            stagger: opts.stagger || 0.04,
            ease: "power4.inOut"
          }, ">-0.2");
        });

        registerEffect("whirlwind", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: () => gsap.utils.random(-720, 720),
            scale: 0.3,
            duration: opts.duration || 1.3,
            stagger: opts.stagger || 0.03,
            ease: "expo.out"
          });
        });
        
        registerEffect("fade-soft-top", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: -25,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "power1.out"
          });
        });

        registerEffect("fade-soft-bottom", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: 25,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "power1.out"
          });
        });

        registerEffect("fade-zoom-tiny", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 1.05,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.02,
            ease: "power2.out"
          });
        });

        registerEffect("hover-rise", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            y: 18
          }, {
            opacity: 1,
            y: 0,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "circ.out"
          });
        });

        registerEffect("slide-diagonal-up-right", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 25,
            y: 25,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("slide-diagonal-up-left", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: -25,
            y: 25,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("fade-scale-up", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            scale: 0.95
          }, {
            opacity: 1,
            scale: 1,
            duration: opts.duration || 0.75,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("blur-lift", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            filter: "blur(6px)",
            y: 15,
            duration: opts.duration || 0.85,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("subtle-tilt-left", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: -4,
            y: 12,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("subtle-tilt-right", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: 4,
            y: 12,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("stretch-in", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scaleX: 0.8,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.03,
            ease: "back.out(2)"
          });
        });

        registerEffect("small-flip", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: 25,
            duration: opts.duration || 0.65,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("soft-pulse", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            opacity: 0,
            scale: 0.98
          }, {
            opacity: 1,
            scale: 1,
            duration: opts.duration || 0.8,
            stagger: opts.stagger || 0.03,
            ease: "sine.out"
          });
        });

        registerEffect("fade-in-left-small", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: -15,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("fade-in-right-small", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 15,
            duration: opts.duration || 0.6,
            stagger: opts.stagger || 0.03,
            ease: "power2.out"
          });
        });

        registerEffect("clip-from-left", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            clipPath: "inset(0 100% 0 0)",
            opacity: 0
          }, {
            clipPath: "inset(0 0% 0 0)",
            opacity: 1,
            duration: opts.duration || 0.85,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("clip-from-bottom", "minimal", (targets, tl, opts) => {
          tl.fromTo(targets, {
            clipPath: "inset(100% 0 0 0)",
            opacity: 0
          }, {
            clipPath: "inset(0 0 0 0)",
            opacity: 1,
            duration: opts.duration || 0.85,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("soft-glide", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: -10,
            y: 10,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "sine.out"
          });
        });

        registerEffect("soft-shift", "minimal", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: 10,
            y: -10,
            duration: opts.duration || 0.7,
            stagger: opts.stagger || 0.03,
            ease: "sine.out"
          });
        });        
        
        registerEffect("rotate-lens", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: 45,
            rotateY: -45,
            scale: 0.8,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("depth-zoom", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            z: -300,
            scale: 0.6,
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.04,
            ease: "expo.out"
          });
        });

        registerEffect("fold-in-half", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: 90,
            transformOrigin: "top center",
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "back.out(2)"
          });
        });

        registerEffect("fold-from-bottom", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: -90,
            transformOrigin: "bottom center",
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "back.out(2)"
          });
        });

        registerEffect("spin-up", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: 180,
            y: 40,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("spin-down", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateY: 180,
            y: -40,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("parallax-twist", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: (i) => 40 + i * 8,
            rotateZ: (i) => i * 5,
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.04,
            ease: "power2.out"
          });
        });

        registerEffect("skew-zoom-lift", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            skewY: 20,
            scale: 0.85,
            y: 20,
            duration: opts.duration || 0.9,
            stagger: opts.stagger || 0.04,
            ease: "power3.out"
          });
        });

        registerEffect("layer-unfold", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateY: 45,
            scale: 0.9,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.04,
            ease: "power2.out"
          });
        });

        registerEffect("3d-tilt-reveal", "advanced", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateX: -20,
            rotateY: 20,
            y: 20,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.05,
            ease: "power3.out"
          });
        });       

        
        
        registerEffect("chaotic-spin", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: () => gsap.utils.random(-540, 540),
            scale: 0.2,
            duration: opts.duration || 1.3,
            stagger: opts.stagger || 0.03,
            ease: "expo.out"
          });
        });

        registerEffect("explosion-outwards", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-250, 250),
            y: () => gsap.utils.random(-250, 250),
            scale: 2.5,
            duration: opts.duration || 1,
            stagger: opts.stagger || 0.03,
            ease: "power4.out"
          });
        });

        registerEffect("hurricane", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: () => gsap.utils.random(-720, 720),
            x: () => gsap.utils.random(-120, 120),
            y: () => gsap.utils.random(-120, 120),
            duration: opts.duration || 1.5,
            stagger: opts.stagger || 0.03,
            ease: "expo.out"
          });
        });

        registerEffect("shake-intense", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-25, 25),
            y: () => gsap.utils.random(-25, 25),
            rotateZ: () => gsap.utils.random(-20, 20),
            duration: opts.duration || 0.35,
            stagger: opts.stagger || 0.03,
            ease: "steps(3)"
          });
        });

        registerEffect("bomb-drop", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            y: -180,
            rotateZ: () => gsap.utils.random(-25, 25),
            scale: 0.5,
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.03,
            ease: "bounce.out"
          });
        });

        registerEffect("ripple-chaos", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: () => gsap.utils.random(0.2, 1.4),
            rotateZ: () => gsap.utils.random(-90, 90),
            duration: opts.duration || 0.9,
            stagger: {
              each: opts.stagger || 0.03,
              from: "center"
            },
            ease: "power3.out"
          });
        });

        registerEffect("wild-zoom-blast", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: () => gsap.utils.random(0.1, 2.5),
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.03,
            ease: "elastic.out(1, 0.3)"
          });
        });

        registerEffect("scatter-spin", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            x: () => gsap.utils.random(-200, 200),
            y: () => gsap.utils.random(-200, 200),
            rotateZ: () => gsap.utils.random(-360, 360),
            duration: opts.duration || 1.1,
            stagger: opts.stagger || 0.03,
            ease: "power3.out"
          });
        });

        registerEffect("drunk-fall", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            rotateZ: () => gsap.utils.random(-45, 45),
            x: () => gsap.utils.random(-30, 30),
            y: -150,
            duration: opts.duration || 1.2,
            stagger: opts.stagger || 0.03,
            ease: "power4.out"
          });
        });

        registerEffect("flash-pop", "crazy", (targets, tl, opts) => {
          tl.from(targets, {
            opacity: 0,
            scale: 0,
            filter: "brightness(300%)",
            duration: opts.duration || 0.5,
            stagger: opts.stagger || 0.03,
            ease: "back.out(2)"
          }).to(targets, {
            filter: "brightness(100%)",
            duration: 0.3
          }, ">-0.2");
        });


  // ---------- Core runner ----------

  function applyToElement(el) {
    const dataset = el.dataset;

    const splitMode = dataset.split || "chars";        // chars | words | lines
    const effectNameAttr = dataset.effect || "fade-up"; // name | random
    const effectGroup = dataset.effectGroup || "";     // minimal | advanced | crazy
    const once = parseBool(dataset.once, false);
    const scrub = dataset.scrub ? (dataset.scrub === "true" ? true : Number(dataset.scrub)) : false;

    const start = dataset.start || "top 90%";
    const end = dataset.end || "top 10%";

    const duration = parseNum(dataset.duration, undefined);
    const stagger = parseNum(dataset.stagger, undefined);

    // Choose effect
    let effectName = effectNameAttr;
    if (effectNameAttr === "random") {
      if (effectGroup && EFFECT_GROUPS[effectGroup] && EFFECT_GROUPS[effectGroup].length) {
        effectName = pickRandom(EFFECT_GROUPS[effectGroup]);
      } else {
        const all = Object.keys(EFFECTS);
        effectName = pickRandom(all);
      }
    }

    const effectFn = EFFECTS[effectName];
    if (!effectFn) {
      console.warn(`[TextFx] Effect "${effectName}" not found on element:`, el);
      return;
    }

    const targets = splitElement(el, splitMode);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start,
        end,
        scrub,
        toggleActions: scrub ? "play none none reverse" : "play reverse play reverse",
        markers: false,
        once
      }
    });

    const opts = { duration, stagger };
    effectFn(targets, tl, opts);
  }

  function init(selector = ".text-anim") {
    document.querySelectorAll(selector).forEach(applyToElement);
  }

  // Expose for extensions
  return {
    init,
    registerEffect,
    EFFECTS,
    EFFECT_GROUPS
  };
})();

// Auto-init
document.addEventListener("DOMContentLoaded", () => {
  TextFx.init(); // looks for .heading-anim-flow by default
});

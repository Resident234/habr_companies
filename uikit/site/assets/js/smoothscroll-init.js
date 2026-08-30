(function rootSmooth() {
  'use strict';

  // ---------- Defaults ----------
  const BASE_CONFIG = {
    // core scroll
    frameRate: 150,
    animationTime: 400,
    stepSize: 100,
    // pulse
    pulseAlgorithm: true,
    pulseScale: 4,
    pulseNormalize: 1,
    // accel
    accelerationDelta: 50,
    accelerationMax: 3,
    // keyboard
    keyboardSupport: true,
    arrowScroll: 50
  };

  const cfg = Object.assign({}, BASE_CONFIG);

  // ---------- internal state ----------
  let isInit = false;
  let inFrame = false;
  let lastDir = { x: 0, y: 0 };
  let docRoot = document.documentElement;
  let activeNode = null;
  let mutationObs = null;
  let resizeRefresh = null;
  let deltaStore = [];
  let deltaTimer = null;
  const runningQueue = [];
  let queuePending = false;
  let lastScrollTime = Date.now();
  let cachedX = {};
  let cachedY = {};
  let behaviorCache = {};
  let clearCacheTimer = null;

  const isMac = /^Mac/.test(navigator.platform);

  // ---------- utils ----------
  const add = (t, fn, opts) => window.addEventListener(t, fn, opts || false);
  const rem = (t, fn, opts) => window.removeEventListener(t, fn, opts || false);
  const isName = (el, tag) => el && (el.nodeName || '').toLowerCase() === tag.toLowerCase();

  const uid = (() => {
    let c = 0;
    return (el) => el.uniqueID || (el.uniqueID = c++);
  })();

  // persistent detection for requestAnimationFrame fallback
  const rAF = (window.requestAnimationFrame ||
               window.webkitRequestAnimationFrame ||
               window.mozRequestAnimationFrame ||
               function (cb) { window.setTimeout(cb, cb.delay || (1000 / 60)); });

  const MutationObserverImpl = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;

  // ---------- feature detection ----------
  const userAgent = window.navigator.userAgent;
  const isEdge = /Edge/.test(userAgent);
  const isChrome = /chrome/i.test(userAgent) && !isEdge;
  const isSafari = /safari/i.test(userAgent) && !isEdge;
  const isFirefox = /firefox/i.test(userAgent);
  const isMobile = /mobile/i.test(userAgent);
  const isOldSafari = isSafari && (/Version\/8/i.test(userAgent) || /Version\/9/i.test(userAgent));

  let supportsPassive = false;
  try {
    window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
      get: function () { supportsPassive = true; }
    }));
  } catch (e) { /* ignore */ }

  const wheelOptions = supportsPassive ? { passive: false } : false;
  const wheelEventName = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';

  // ---------- init checks ----------
  function attachKeyboardIfNeeded() {
    if (cfg.keyboardSupport) add('keydown', handleKeydown);
  }

  function initializeOnce() {
    if (isInit || !document.body) return;
    isInit = true;

    const body = document.body;
    const html = document.documentElement;
    docRoot = (document.compatMode.indexOf('CSS') >= 0) ? html : body;
    activeNode = body;

    attachKeyboardIfNeeded();

    // running in iframe?
    if (top !== self) inFrame = true;

    // Safari 8/9 layout fix (preserve original behavior)
    if (!inFrame && isOldSafari && body.scrollHeight > window.innerHeight &&
        (body.offsetHeight <= window.innerHeight || html.offsetHeight <= window.innerHeight)) {

      const sentinel = document.createElement('div');
      sentinel.style.cssText = 'position:absolute; z-index:-10000; top:0; left:0; right:0; height:' + docRoot.scrollHeight + 'px';
      document.body.appendChild(sentinel);

      let scheduled;
      resizeRefresh = function () {
        if (scheduled) return;
        scheduled = setTimeout(function () {
          if (isExcluded) return;
          sentinel.style.height = '0';
          sentinel.style.height = docRoot.scrollHeight + 'px';
          scheduled = null;
        }, 500);
      };

      setTimeout(resizeRefresh, 10);
      add('resize', resizeRefresh);

      const config = { attributes: true, childList: true, characterData: false };
      mutationObs = new MutationObserverImpl(resizeRefresh);
      mutationObs.observe(body, config);

      if (docRoot.offsetHeight <= window.innerHeight) {
        const cf = document.createElement('div');
        cf.style.clear = 'both';
        body.appendChild(cf);
      }
    }
  }

  // ---------- cleanup ----------
  function destroyAll() {
    mutationObs && mutationObs.disconnect();
    if (wheelEventName) rem(wheelEventName, handleWheel, wheelOptions);
    rem('mousedown', handleMousedown);
    rem('keydown', handleKeydown);
    rem('resize', resizeRefresh);
    rem('load', initializeOnce);
  }

  // ---------- queueing & stepper ----------
  function resetDirectionIfChanged(nx, ny) {
    nx = nx > 0 ? 1 : -1;
    ny = ny > 0 ? 1 : -1;
    if (lastDir.x !== nx || lastDir.y !== ny) {
      lastDir.x = nx;
      lastDir.y = ny;
      runningQueue.length = 0;
      lastScrollTime = 0;
    }
  }

  function getScrollContainer() {
    // returns the document scrolling element (cached)
    return (function cachedRoot() {
      let SR = document.scrollingElement;
      if (!SR) {
        const probe = document.createElement('div');
        probe.style.cssText = 'height:10000px;width:1px;';
        document.body.appendChild(probe);
        const bodyTop = document.body.scrollTop;
        const docTop = document.documentElement.scrollTop;
        window.scrollBy(0, 3);
        if (document.body.scrollTop !== bodyTop) SR = document.body; else SR = document.documentElement;
        window.scrollBy(0, -3);
        document.body.removeChild(probe);
        document.scrollingElement = SR;
      }
      return SR;
    })();
  }

  function scheduleFrame(stepFn, element, delay) {
    stepFn.delay = delay;
    return rAF(stepFn, element);
  }

  function scrollQueue(targetEl, dx, dy) {
    resetDirectionIfChanged(dx, dy);

    if (cfg.accelerationMax !== 1) {
      const now = Date.now();
      let elapsed = now - lastScrollTime;
      if (elapsed < cfg.accelerationDelta) {
        let factor = (1 + (50 / elapsed)) / 2;
        if (factor > 1) {
          factor = Math.min(factor, cfg.accelerationMax);
          dx *= factor;
          dy *= factor;
        }
      }
      lastScrollTime = Date.now();
    }

    // push
    runningQueue.push({
      x: dx,
      y: dy,
      lastX: (dx < 0) ? 0.99 : -0.99,
      lastY: (dy < 0) ? 0.99 : -0.99,
      start: Date.now()
    });

    if (queuePending) return;

    const scrollRoot = getScrollContainer();
    const isWindow = (targetEl === scrollRoot || targetEl === document.body);

    // if element has CSS smooth behavior, temporarily disable it
    if (targetEl.$savedScrollBehavior == null && checkSmoothBehavior(targetEl)) {
      targetEl.$savedScrollBehavior = targetEl.style.scrollBehavior;
      targetEl.style.scrollBehavior = 'auto';
    }

    const stepper = function stepper() {
      const now = Date.now();
      let moveX = 0, moveY = 0;

      for (let i = 0; i < runningQueue.length; i++) {
        const item = runningQueue[i];
        const elapsed = now - item.start;
        const done = (elapsed >= cfg.animationTime);
        let pos = done ? 1 : elapsed / cfg.animationTime;
        if (cfg.pulseAlgorithm) pos = applyPulse(pos);
        const ix = (item.x * pos - item.lastX) >> 0;
        const iy = (item.y * pos - item.lastY) >> 0;
        moveX += ix; moveY += iy;
        item.lastX += ix; item.lastY += iy;
        if (done) { runningQueue.splice(i, 1); i--; }
      }

      if (isWindow) {
        window.scrollBy(moveX, moveY);
      } else {
        if (moveX) targetEl.scrollLeft += moveX;
        if (moveY) targetEl.scrollTop  += moveY;
      }

      if (!dx && !dy) runningQueue.length = 0;

      if (runningQueue.length) {
        scheduleFrame(stepper, targetEl, (1000 / cfg.frameRate + 1));
      } else {
        queuePending = false;
        if (targetEl.$savedScrollBehavior != null) {
          targetEl.style.scrollBehavior = targetEl.$savedScrollBehavior;
          targetEl.$savedScrollBehavior = null;
        }
      }
    };

    scheduleFrame(stepper, targetEl, 0);
    queuePending = true;
  }

  // ---------- overflow detection & caching ----------
  function scheduleCacheClear() {
    clearTimeout(clearCacheTimer);
    clearCacheTimer = setInterval(function () {
      cachedX = cachedY = behaviorCache = {};
    }, 1000);
  }

  function setCache(elems, overflowEl, horizontal) {
    const cache = horizontal ? cachedX : cachedY;
    for (let i = elems.length; i--;) cache[uid(elems[i])] = overflowEl;
    return overflowEl;
  }

  function getCached(el, horizontal) {
    return (horizontal ? cachedX : cachedY)[uid(el)];
  }

  function isOverflowingContent(el) {
    return (el.clientHeight + 10 < el.scrollHeight);
  }

  function cssOverflowNotHidden(el) {
    const overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
    return (overflow !== 'hidden');
  }

  function cssOverflowAutoOrScroll(el) {
    const overflow = getComputedStyle(el, '').getPropertyValue('overflow-y');
    return (overflow === 'scroll' || overflow === 'auto');
  }

  function checkSmoothBehavior(el) {
    const id = uid(el);
    if (behaviorCache[id] == null) {
      const sb = getComputedStyle(el, '')['scroll-behavior'];
      behaviorCache[id] = ('smooth' === sb);
    }
    return behaviorCache[id];
  }

  function findOverflowAncestor(el) {
    const collected = [];
    const body = document.body;
    const rootScrollH = docRoot.scrollHeight;

    while (el) {
      const cached = getCached(el, false);
      if (cached) return setCache(collected, cached);
      collected.push(el);

      if (rootScrollH === el.scrollHeight) {
        const topNotHidden = cssOverflowNotHidden(docRoot) && cssOverflowNotHidden(body);
        const isOverflowCss = topNotHidden || cssOverflowAutoOrScroll(docRoot);
        if (inFrame && isContentOverflowing(docRoot) || !inFrame && isOverflowCss) {
          return setCache(collected, getScrollContainer());
        }
      } else if (isOverflowingContent(el) && cssOverflowAutoOrScroll(el)) {
        return setCache(collected, el);
      }

      el = el.parentElement || (el.getRootNode && el.getRootNode().host);
    }
    return null;
  }

  // ---------- wheel handler ----------
  function handleWheel(e) {
    if (!isInit) initializeOnce();

    const target = deepEventTarget(e);

    if (e.defaultPrevented || e.ctrlKey) return true;

    // leave embedded objects alone
    if (isName(activeNode, 'embed') ||
        (isName(target, 'embed') && /\.pdf/i.test(target.src)) ||
        isName(activeNode, 'object')) {
      return true;
    }

    // compute deltas
    let dX = -e.wheelDeltaX || e.deltaX || 0;
    let dY = -e.wheelDeltaY || e.deltaY || 0;

    if (isMac) {
      if (e.wheelDeltaX && isDivisibleBy(e.wheelDeltaX, 120))
        dX = -120 * (e.wheelDeltaX / Math.abs(e.wheelDeltaX));
      if (e.wheelDeltaY && isDivisibleBy(e.wheelDeltaY, 120))
        dY = -120 * (e.wheelDeltaY / Math.abs(e.wheelDeltaY));
    }

    if (!dX && !dY) dY = -e.wheelDelta || 0;

    if (e.deltaMode === 1) { dX *= 40; dY *= 40; }

    const overflowing = findOverflowAncestor(target);
    if (!overflowing) {
      if (inFrame && isChrome) {
        Object.defineProperty(e, "target", { value: window.frameElement });
        return parent.wheel(e);
      }
      return true;
    }

    if (isTouchpadUse(dY)) return true;

    // scale
    if (Math.abs(dX) > 1.2) dX *= cfg.stepSize / 120;
    if (Math.abs(dY) > 1.2) dY *= cfg.stepSize / 120;

    scrollQueue(overflowing, dX, dY);
    e.preventDefault();
    scheduleCacheClear();
  }

  // ---------- keyboard handler ----------
  function handleKeydown(e) {
    const target = deepEventTarget(e);
    const modifier = e.ctrlKey || e.altKey || e.metaKey || (e.shiftKey && e.code !== 'Space');

    if (!document.body.contains(activeNode)) activeNode = document.activeElement;

    const inputNames = /^(textarea|select|embed|object)$/i;
    const buttonTypes = /^(button|submit|radio|checkbox|file|color|image)$/i;
    if (e.defaultPrevented ||
        inputNames.test(target.nodeName) ||
        (isName(target, 'input') && !buttonTypes.test(target.type)) ||
        isName(activeNode, 'video') ||
        isInsideYouTube(e) ||
        target.isContentEditable ||
        modifier) {
      return true;
    }

    if ((isName(target, 'button') ||
         (isName(target, 'input') && buttonTypes.test(target.type))) &&
         e.code === 'Space') {
      return true;
    }

    if (isName(target, 'input') && target.type === 'radio' &&
        (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      return true;
    }

    let x = 0, y = 0, shift;
    const overflowing = findOverflowAncestor(activeNode);
    if (!overflowing) {
      return (inFrame && isChrome) ? parent.keydown(e) : true;
    }

    let clientH = overflowing === document.body ? window.innerHeight : overflowing.clientHeight;
    if (overflowing === document.body) clientH = window.innerHeight;

    switch (e.code) {
      case 'ArrowUp': y = -cfg.arrowScroll; break;
      case 'ArrowDown': y = cfg.arrowScroll; break;
      case 'Space':
        shift = e.shiftKey ? 1 : -1;
        y = -shift * clientH * 0.9;
        break;
      case 'PageUp': y = -clientH * 0.9; break;
      case 'PageDown': y = clientH * 0.9; break;
      case 'Home':
        if (overflowing === document.body && document.scrollingElement) overflowing = document.scrollingElement;
        y = -overflowing.scrollTop;
        break;
      case 'End':
        {
          const remaining = overflowing.scrollHeight - overflowing.scrollTop - clientH;
          y = (remaining > 0) ? remaining + 10 : 0;
        }
        break;
      case 'ArrowLeft': x = -cfg.arrowScroll; break;
      case 'ArrowRight': x = cfg.arrowScroll; break;
      default: return true;
    }

    scrollQueue(overflowing, x, y);
    e.preventDefault();
    scheduleCacheClear();
  }

  // ---------- mouse down (to update active element) ----------
  function handleMousedown(e) { activeNode = deepEventTarget(e); }

  function deepEventTarget(ev) {
    return ev.composedPath ? ev.composedPath()[0] : ev.target;
  }

  // ---------- touchpad heuristic ----------
  try {
    if (localStorage.SS_deltaBuffer) deltaStore = localStorage.SS_deltaBuffer.split(',');
  } catch (ex) { /* ignore */ }

  function isTouchpadUse(dy) {
    if (!dy) return false;
    if (!deltaStore.length) deltaStore = [dy, dy, dy];
    dy = Math.abs(dy);
    deltaStore.push(dy);
    deltaStore.shift();
    clearTimeout(deltaTimer);
    deltaTimer = setTimeout(function () {
      try { localStorage.SS_deltaBuffer = deltaStore.join(','); } catch (e) {}
    }, 1000);
    const dpiScaled = dy > 120 && allDivisibleBy(dy);
    const tp = !allDivisibleBy(120) && !allDivisibleBy(100) && !dpiScaled;
    if (dy < 50) return true;
    return tp;
  }

  function isDivisibleBy(n, d) { return Math.floor(n / d) === n / d; }
  function allDivisibleBy(div) {
    return isDivisibleBy(deltaStore[0], div) &&
           isDivisibleBy(deltaStore[1], div) &&
           isDivisibleBy(deltaStore[2], div);
  }

  function isDivisibleBy120(n) { return isDivisibleBy(n, 120); }

  // ---------- youtube helper ----------
  function isInsideYouTube(ev) {
    let el = deepEventTarget(ev);
    let found = false;
    if (document.URL.indexOf('www.youtube.com/watch') !== -1) {
      do {
        found = (el.classList && el.classList.contains('html5-video-controls'));
        if (found) break;
      } while ((el = el.parentNode));
    }
    return found;
  }

  // ---------- pulse easing (same algorithm) ----------
  function viscousPulse(x) {
    let val, start, expx;
    x = x * cfg.pulseScale;
    if (x < 1) {
      val = x - (1 - Math.exp(-x));
    } else {
      start = Math.exp(-1);
      x -= 1;
      expx = 1 - Math.exp(-x);
      val = start + (expx * (1 - start));
    }
    return val * cfg.pulseNormalize;
  }

  function applyPulse(x) {
    if (x >= 1) return 1;
    if (x <= 0) return 0;
    if (cfg.pulseNormalize === 1) cfg.pulseNormalize /= viscousPulse(1);
    return viscousPulse(x);
  }

  // ---------- helpers used in wheel handler ----------
  function isDivisible(n, divisor) { return Math.floor(n / divisor) === n / divisor; }

  // ---------- init listeners ----------
  if (wheelEventName) {
    add(wheelEventName, handleWheel, wheelOptions);
    add('mousedown', handleMousedown);
    add('load', initializeOnce);
  }

  // ---------- public API ----------
  function ReworkedSmoothScroll(opts) {
    for (const k in opts) {
      if (Object.prototype.hasOwnProperty.call(BASE_CONFIG, k)) cfg[k] = opts[k];
    }
  }
  ReworkedSmoothScroll.destroy = destroyAll;

  if (window.SmoothScrollOptions) ReworkedSmoothScroll(window.SmoothScrollOptions);

  if (typeof define === 'function' && define.amd) {
    define(function () { return ReworkedSmoothScroll; });
  } else if (typeof exports === 'object') {
    module.exports = ReworkedSmoothScroll;
  } else {
    window.SmoothScroll = ReworkedSmoothScroll;
  }

})();

SmoothScroll({
  frameRate: 150,
  animationTime: 1000,
  stepSize: 100,
  pulseAlgorithm: 1,
  pulseScale: 4,
  pulseNormalize: 1,
  accelerationDelta: 50,
  accelerationMax: 3,
  keyboardSupport: 1,
  arrowScroll: 50
});

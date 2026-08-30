// Easing function
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Animate one counter
function animateCounter(el, from, to, duration, decimals) {
  const start = performance.now();

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(progress);
    const value = from + (to - from) * eased;

    el.textContent = value.toFixed(decimals);

    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Handle ALL counters on page
function initCounters() {
  document.querySelectorAll(".counter").forEach(counter => {
    const numberEl = counter.querySelector(".count");

    const start   = parseFloat(counter.dataset.start || 0);
    const end     = parseFloat(counter.dataset.end || 100);
    const duration = parseInt(counter.dataset.duration || 2000, 10);
    const decimals = parseInt(counter.dataset.decimals || 0, 10);

    // Add your scale/blur ready animation
    requestAnimationFrame(() => counter.classList.add("ready"));

    // Start animation
    animateCounter(numberEl, start, end, duration, decimals);
  });
}

// Auto-run on DOM load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCounters);
} else {
  initCounters();
}


(function () {
      // safe helper: hide preloader with fade, then remove from DOM after transition
      function hidePreloader() {
        var pre = document.getElementById('preloader');
        if (!pre || pre.classList.contains('hidden')) return;

        // remove the loading class from body to restore scroll
        document.body.classList.remove('loading');

        // add hidden class to trigger CSS opacity & visibility transition
        pre.classList.add('hidden');

        // remove from DOM after transition completes to avoid pointer/voiceover confusion
        var duration = 500; // slightly longer than CSS fade to be safe
        setTimeout(function () {
          if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
        }, duration);
      }

      // Hide after full load (images, fonts, etc.)
      if (document.readyState === 'complete') {
        // page already loaded (e.g., injected), hide now
        hidePreloader();
      } else {
        // normal case: wait for load event
        window.addEventListener('load', hidePreloader, { once: true, passive: true });

        // fallback: if load doesn't fire (rare), timeout after 8s
        setTimeout(hidePreloader, 8000);
      }

      // Optional: if user hits Escape, allow them to dismiss the preloader for accessibility
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hidePreloader();
      }, { passive: true });
    })();
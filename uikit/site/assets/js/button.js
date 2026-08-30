const wraps = document.querySelectorAll('.magnetic-wrap');

wraps.forEach((wrap) => {
  const btn = wrap.querySelector('.magnetic-btn');
  const strength = 0.4; // 寄り具合

  wrap.addEventListener('mousemove', (e) => {
    const rect = wrap.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);

    gsap.to(btn, {
      x: relX * strength,
      y: relY * strength,
      duration: 0.25,
      // duration: 0.4,
      ease: "power3.out"
    });
  });

  wrap.addEventListener('mouseleave', () => {
    gsap.to(btn, {
      x: 0,
      y: 0,
      duration: 0.35,
      // duration: 0.4,
      // ease: "power3.out"
			ease: "elastic.out(1, 0.5)"
    });
  });
});

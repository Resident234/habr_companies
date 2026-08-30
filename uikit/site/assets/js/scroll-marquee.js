gsap.registerPlugin(ScrollTrigger);

const slider = document.querySelector("#slider"),
  first = document.querySelector("#first"),
  second = document.querySelector("#second");

let xPercent = 0;
let direction = -1;

const animate = () => {
  if (xPercent < -100) {
    xPercent = 0;
  } else if (xPercent > 0) {
    xPercent = -100;
  }

  gsap.set(first, { xPercent });
  gsap.set(second, { xPercent });
  requestAnimationFrame(animate);
  xPercent += 0.1 * direction;
};

document.addEventListener("DOMContentLoaded", (event) => {
  gsap.set(second, {
    left: second.getBoundingClientRect().width
  });

  gsap.to(slider, {
    scrollTrigger: {
      trigger: document.documentElement,
      scrub: 0.5,
      start: 0,
      end: window.innerHeight,
      onUpdate: (e) => (direction = e.direction * -1)
    },

    x: "-500px"
  });

  requestAnimationFrame(animate);
});
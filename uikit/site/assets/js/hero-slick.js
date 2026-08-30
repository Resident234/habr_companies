/*
 ** With Slick Slider Plugin : https://github.com/marvinhuebner/slick-animation
 ** And Slick Animation Plugin : https://github.com/marvinhuebner/slick-animation
 */

// Init slick slider + animation
$('.slider').slick({
  autoplay: false,
  speed: 800,
  lazyLoad: 'progressive',
  arrows: true,
  dots: false,
  prevArrow: `
    <button class="slick-nav prev-arrow" aria-label="Previous">
      <span class="arrow-icon">←</span>
      <svg viewBox="0 0 100 100" class="arrow-ring">
        <circle cx="50" cy="50" r="48"></circle>
      </svg>
    </button>
  `,
  nextArrow: `
    <button class="slick-nav next-arrow" aria-label="Next">
      <span class="arrow-icon">→</span>
      <svg viewBox="0 0 100 100" class="arrow-ring">
        <circle cx="50" cy="50" r="48"></circle>
      </svg>
    </button>
  `
}).slickAnimation();


$('.slick-nav').on('click touch', function (e) {

  e.preventDefault();

  let arrow = $(this);

  if (!arrow.hasClass('animate')) {
    arrow.addClass('animate');
    setTimeout(() => {
      arrow.removeClass('animate');
    }, 1600);
  }

});

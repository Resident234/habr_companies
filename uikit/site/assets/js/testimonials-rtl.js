$(document).ready(function () {
  $('.testimonial-slider').slick({
    rtl: true,               // 👈 enable RTL
    dots: true,
    arrows: false,
    autoplay: true,
    autoplaySpeed: 4000,
    infinite: true,
    speed: 500,
    fade: false,
    cssEase: 'ease-in-out'
  });
});

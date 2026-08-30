const mainImage = document.getElementById("mainProductImage");
  const thumbs = document.querySelectorAll(".product-thumb");

  thumbs.forEach(thumb => {
    thumb.addEventListener("click", () => {
      const newSrc = thumb.dataset.image;

      // Fade out
      mainImage.classList.add("opacity-0");

      setTimeout(() => {
        mainImage.src = newSrc;

        // Fade in
        mainImage.classList.remove("opacity-0");
      }, 150);

      // Active state
      thumbs.forEach(t => {
        t.classList.remove("border-primary");
        t.classList.add("border-slate-800");
      });

      thumb.classList.remove("border-slate-800");
      thumb.classList.add("border-primary");
    });
  });
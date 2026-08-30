/*Filter Button*/
document.addEventListener("DOMContentLoaded", () => {

  const iso = new Isotope(".isotope-container", {
    itemSelector: ".work-item",
    layoutMode: "fitRows",
    transitionDuration: "0.45s"
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {

      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.dataset.filter;
      const selector = filter === "all" ? "*" : `[data-category~="${filter}"]`;

      iso.arrange({ filter: selector });

    });
  });

});

/*Cursor Text*/
document.querySelectorAll(".work-item").forEach(card => {
  const txt = card.dataset.cursorText;

  card.addEventListener("mouseenter", () => {
    // Show text
    cursor.setAttribute("data-text", txt);

    // Activate text mode + grow mode
    cursor.classList.add("cursor--active-text", "cursor--grow", "cursor--bg-shift");
    cursor2.classList.add("cursor2--active-text", "cursor2--grow");
  });

  card.addEventListener("mouseleave", () => {
    // Remove text
    cursor.removeAttribute("data-text");

    // Remove grow + background shift
    cursor.classList.remove("cursor--active-text", "cursor--grow", "cursor--bg-shift");
    cursor2.classList.remove("cursor2--active-text", "cursor2--grow");
  });
});
/*Cursor Text*/
document.querySelectorAll(".featured-project-card").forEach(card => {
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
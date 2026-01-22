// Swipe handler for switching between US and THEM views on mobile

let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe
const VERTICAL_THRESHOLD = 30; // Max vertical movement to consider it a horizontal swipe

function handleSwipe() {
  const deltaX = touchEndX - touchStartX;
  const deltaY = Math.abs(touchEndY - touchStartY);

  // Only consider horizontal swipes (vertical movement should be minimal)
  if (deltaY > VERTICAL_THRESHOLD) {
    return;
  }

  const currentView = window.getCurrentView();

  // Swipe right (moving from left to right) - go to US view
  if (deltaX > SWIPE_THRESHOLD && currentView === "them") {
    window.switchView("us");
  }
  // Swipe left (moving from right to left) - go to THEM view
  else if (deltaX < -SWIPE_THRESHOLD && currentView === "us") {
    window.switchView("them");
  }
}

function initSwipeHandler() {
  const usView = document.getElementById("view-us");
  const themView = document.getElementById("view-them");

  [usView, themView].forEach((view) => {
    if (!view) return;

    view.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true },
    );

    view.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      },
      { passive: true },
    );
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSwipeHandler);
} else {
  initSwipeHandler();
}

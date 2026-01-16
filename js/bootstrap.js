const COPY_FEEDBACK_TIMEOUT = 1200;
let feedbackTimer = null;

function preventIOSZoom() {
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.scale !== 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}

function toggleFeedback(show) {
  const feedback = document.getElementById("room-id-copied");
  if (!feedback) return;

  feedback.classList.toggle("is-visible", show);
  if (show) {
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(
      () => feedback.classList.remove("is-visible"),
      COPY_FEEDBACK_TIMEOUT
    );
  }
}

function fallbackCopy(roomId) {
  const tempInput = document.createElement("input");
  tempInput.value = roomId;
  document.body.appendChild(tempInput);
  tempInput.select();
  tempInput.setSelectionRange(0, 9999);
  try {
    document.execCommand("copy");
    toggleFeedback(true);
  } catch (error) {
    console.error("Unable to copy room ID", error);
  }
  document.body.removeChild(tempInput);
}

function copyRoomIdToClipboard() {
  const label = document.getElementById("room-id-label");
  if (!label) return;

  const roomId = label.textContent.trim();
  if (!roomId || roomId === "----") return;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(roomId).then(() => toggleFeedback(true));
    return;
  }

  fallbackCopy(roomId);
}

function bindRoomIdCopy() {
  const label = document.getElementById("room-id-label");
  const icon = document.getElementById("room-id-copy-icon");

  if (!label && !icon) return;
  [label, icon]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("click", copyRoomIdToClipboard));
}

function bootstrap() {
  preventIOSZoom();
  bindRoomIdCopy();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

import { gameManager } from "./GameManager.js";

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

function buildInviteText(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

function resolveRoomId() {
  const raw =
    gameManager.roomId ||
    document.getElementById("room-id-label")?.textContent?.trim() ||
    document.getElementById("mini-room-id")?.textContent?.trim() ||
    document.getElementById("mini-room-id2")?.textContent?.trim() ||
    "";

  const cleaned = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
  return /^[A-Z]{4}$/.test(cleaned) ? cleaned : null;
}

function fallbackCopy(textToCopy) {
  const tempInput = document.createElement("input");
  tempInput.value = textToCopy;
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

function copyRoomCodeToClipboard() {
  const roomId = resolveRoomId();
  if (!roomId) return;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(roomId).then(() => toggleFeedback(true));
    return;
  }

  fallbackCopy(roomId);
}

function copyInviteLinkToClipboard() {
  const roomId = resolveRoomId();
  if (!roomId) return;

  const inviteText = buildInviteText(roomId);

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(inviteText).then(() => toggleFeedback(true));
    return;
  }

  fallbackCopy(inviteText);
}

function bindRoomIdCopy() {
  const label = document.getElementById("room-id-label");
  const icon = document.getElementById("room-id-copy-icon");

  const bottomBtnUs = document.getElementById("btn-room-id");
  const bottomBtnThem = document.getElementById("btn-room-id2");

  const inviteLinkRow = document.getElementById("invite-link-copy");

  if (!label && !icon && !bottomBtnUs && !bottomBtnThem && !inviteLinkRow)
    return;

  [label, icon]
    .filter(Boolean)
    .forEach((node) => node.addEventListener("click", copyRoomCodeToClipboard));

  [bottomBtnUs, bottomBtnThem, inviteLinkRow]
    .filter(Boolean)
    .forEach((node) =>
      node.addEventListener("click", copyInviteLinkToClipboard)
    );
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

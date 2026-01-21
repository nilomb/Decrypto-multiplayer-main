/**
 * Modals Module
 * Handles code modal, code button interactions, and placeholder displays
 */

import { gameManager } from "../GameManager.js";

let codeModalEl = null;

/**
 * Get current view (US or THEM)
 */
function getCurrentView() {
  const usView = document.getElementById("view-us");
  const themView = document.getElementById("view-them");

  if (usView && !usView.classList.contains("hidden")) return usView;
  if (themView && !themView.classList.contains("hidden")) return themView;
  return null;
}

/**
 * Show center code display
 */
function showCenterCodeDisplay(currentCode, roundNumber) {
  const currentView = getCurrentView();
  if (!currentView || currentView.id !== "view-us") return;

  const codeDisplay = currentView.querySelector(".code-display");
  if (!codeDisplay) return;

  const roundLabel = codeDisplay.querySelector("#current-round-label");
  if (roundLabel) {
    roundLabel.textContent = `ROUND ${roundNumber}`;
  }

  const codeElement = codeDisplay.querySelector("#current-round-code");
  if (codeElement) {
    codeElement.textContent = currentCode || "---";
  }

  codeDisplay.classList.add("show");
}

/**
 * Hide center code display
 */
function hideCenterCodeDisplay() {
  document.querySelectorAll(".code-display").forEach((display) => {
    display.classList.remove("show");
  });
}

/**
 * Show codes in input placeholders (hold CODE button)
 */
export function showCodesInPlaceholders(selectedRoundUI) {
  const myWords = gameManager.getMyTeamWords();
  const myCodes = gameManager.getMyTeamCodes();

  if (myWords.length !== 4) return;

  const currentView = getCurrentView();
  if (!currentView || currentView.id !== "view-us") return;

  const currentRoundIndex = (selectedRoundUI || 1) - 1;
  const currentCode = myCodes[currentRoundIndex];

  if (!currentCode) {
    return;
  }

  const codeNumbers = currentCode.split(".").map((n) => {
    const parsed = parseInt(n, 10);
    return Number.isFinite(parsed) ? parsed - 1 : null;
  });
  const clueInputs = currentView.querySelectorAll(
    'input[type="text"][id*="clueword"]',
  );

  clueInputs.forEach((input, index) => {
    const codeIndex = codeNumbers[index];
    if (index < 3 && codeIndex !== null && codeIndex >= 0 && codeIndex < 4) {
      if (!input.dataset.originalPlaceholder) {
        input.dataset.originalPlaceholder = input.placeholder;
      }
      const word = myWords[codeIndex];
      if (word) {
        input.placeholder = `${codeIndex + 1}. ${word}`;
        input.classList.add("showing-code");
      }
    }
  });

  showCenterCodeDisplay(currentCode, selectedRoundUI || 1);
}

/**
 * Hide codes from input placeholders
 */
export function hideCodesFromPlaceholders() {
  const currentView = getCurrentView();
  if (!currentView) return;

  const clueInputs = currentView.querySelectorAll(
    'input[type="text"][id*="clueword"]',
  );

  clueInputs.forEach((input) => {
    const hasOriginal = input.dataset.originalPlaceholder !== undefined;

    if (hasOriginal || input.classList.contains("showing-code")) {
      // Remove placeholder entirely to avoid grey text remnants
      delete input.dataset.originalPlaceholder;
      input.removeAttribute("placeholder");
      input.classList.remove("showing-code");
    }
  });

  hideCenterCodeDisplay();
}

/**
 * Render codes modal content
 */
export function renderCodesModal(selectedRoundUI) {
  if (!codeModalEl) return;

  const myTeam = gameManager.players[gameManager.playerId]?.team || "A";
  const codesObj = gameManager.codes?.[myTeam] || {};

  // Codes are now stored as { round_1: "1.3.2", round_2: "4.1.2", ... }
  const roundKey = `round_${selectedRoundUI}`;
  const code = codesObj[roundKey] || "—";

  const disp = codeModalEl.querySelector("#single-code-display");
  if (disp) disp.textContent = code;

  const rl = codeModalEl.querySelector("#code-round-label");
  if (rl) rl.textContent = selectedRoundUI;
}

/**
 * Open codes modal
 */
function openCodes(selectedRoundUI) {
  renderCodesModal(selectedRoundUI);
  codeModalEl.classList.remove("hidden");
}

/**
 * Close codes modal
 */
function closeCodes() {
  codeModalEl.classList.add("hidden");
}

/**
 * Initialize code modal
 */
export function initCodeModal(selectedRoundUI) {
  codeModalEl = document.getElementById("code-modal");

  if (!codeModalEl) {
    codeModalEl = document.createElement("div");
    codeModalEl.id = "code-modal";
    codeModalEl.className = "hidden code-modal-overlay";
    codeModalEl.innerHTML = `
    <div class="code-modal">
      <div class="code-modal-header">
        <h2>Codice Round <span id="code-round-label">1</span></h2>
        <button class="code-close" aria-label="Close">×</button>
      </div>
      <div class="code-modal-body">
        <div class="single-code-wrapper"><div id="single-code-display" class="single-code-display">—</div></div>
        <div class="note small">Il codice mostrato cambia col round selezionato (barra 1‑8).</div>
      </div>
    </div>`;
    document.body.appendChild(codeModalEl);
  }

  codeModalEl.addEventListener("click", (e) => {
    if (e.target === codeModalEl) closeCodes();
    if (e.target.closest(".code-close")) closeCodes();
  });

  return { openCodes: () => openCodes(selectedRoundUI), closeCodes };
}

/**
 * Bind code button interactions (hold to show codes)
 */
export function bindCodeButtons(showCodesCallback, hideCodesCallback) {
  const b1 = document.getElementById("btn-code");

  [b1].forEach((b) => {
    if (b && !b.__codeBound) {
      b.__codeBound = true;

      let isShowingCodes = false; // placeholders shown
      let isShowingModal = false; // modal shown (only during hold)
      let lastTap = 0;
      let wordsLocked = false; // toggled via double click/tap

      const showWordsOnly = () => {
        showCodesCallback();
        isShowingCodes = true;
        hideCenterCodeDisplay();
        isShowingModal = false;
      };

      const hideAll = () => {
        hideCodesCallback();
        isShowingCodes = false;
        isShowingModal = false;
      };

      const showFull = () => {
        showCodesCallback();
        isShowingCodes = true;
        isShowingModal = true;
      };

      const startHold = (e) => {
        if (e) e.preventDefault();
        showFull();
      };

      const endHold = (e) => {
        if (e) e.preventDefault();
        // If words are locked, keep only words visible; otherwise hide all
        if (wordsLocked) {
          showWordsOnly();
        } else {
          hideAll();
        }
      };

      // Mouse: hold shows modal+words; release hides
      b.addEventListener("mousedown", startHold);
      b.addEventListener("mouseup", endHold);
      b.addEventListener("mouseleave", endHold);

      // Double click toggles words-only lock (modal never involved)
      b.addEventListener("dblclick", (e) => {
        e.preventDefault();
        wordsLocked = !wordsLocked;
        if (wordsLocked) {
          showWordsOnly();
        } else {
          hideAll();
        }
      });

      // Single click no-op (handled via hold/double-click)
      b.addEventListener("click", (e) => {
        e.preventDefault();
      });

      // Keyboard: Space/Enter emulate hold (keydown show, keyup hide)
      b.addEventListener("keydown", (e) => {
        if (
          e.key === " " ||
          e.key === "Spacebar" ||
          e.code === "Space" ||
          e.key === "Enter"
        ) {
          startHold(e);
        }
      });
      b.addEventListener("keyup", (e) => {
        if (
          e.key === " " ||
          e.key === "Spacebar" ||
          e.code === "Space" ||
          e.key === "Enter"
        ) {
          endHold(e);
        }
      });

      // Touch: press-and-hold (touchstart/touchend). Double-tap toggles words-only.
      b.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          startHold(e);
        },
        { passive: false },
      );

      b.addEventListener(
        "touchend",
        (e) => {
          const now = Date.now();
          const delta = now - lastTap;
          lastTap = now;
          if (delta < 300) {
            // double tap toggle words-only lock
            wordsLocked = !wordsLocked;
            if (wordsLocked) {
              showWordsOnly();
            } else {
              hideAll();
            }
          } else {
            endHold(e);
          }
        },
        { passive: true },
      );

      b.addEventListener(
        "touchcancel",
        (e) => {
          endHold(e);
        },
        { passive: true },
      );
    }
  });
}

/**
 * Update code button visibility based on active player status
 */
export function updateCodeButtonVisibility() {
  const isActive = gameManager.isActivePlayer();

  const btnCodeUs = document.getElementById("btn-code");
  if (btnCodeUs) {
    if (isActive) {
      btnCodeUs.classList.remove("hidden");
    } else {
      btnCodeUs.classList.add("hidden");
    }
  }
}

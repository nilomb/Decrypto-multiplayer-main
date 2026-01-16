/**
 * Rounds Navigation Module
 * Handles round selection and navigation (1-8)
 */

import { gameManager } from "../GameManager.js";
import {
  updateCluesDisplay,
  updateGuessesDisplay,
  updateConfDisplay,
  updateTGuessesDisplay,
  updateTConfDisplay,
} from "./phase-display.js";
import { updateTeamTopBar } from "./phase-words.js";

let selectedRoundUI = 1;

/**
 * Get currently selected round in UI
 */
export function getSelectedRound() {
  return selectedRoundUI;
}

/**
 * Set the selected round in UI (called when game round changes)
 */
export function setSelectedRound(r) {
  selectedRoundUI = r;
}

/**
 * Select a specific round
 */
export function selectRound(r, renderCodesModal) {
  const myTeam = gameManager.getMyTeam();
  const maxAllowed = gameManager.getUnlockedRound(myTeam || "A");
  if (r > maxAllowed) return;

  [...document.querySelectorAll("#us-round-switch button")].forEach((btn) =>
    btn.classList.remove("active")
  );
  [...document.querySelectorAll("#them-round-switch button")].forEach((btn) =>
    btn.classList.remove("active")
  );

  const usButton = document.querySelector(
    `#us-round-switch button[data-round="${r}"]`
  );
  const themButton = document.querySelector(
    `#them-round-switch button[data-round="${r}"]`
  );

  if (usButton) usButton.classList.add("active");
  if (themButton) themButton.classList.add("active");

  selectedRoundUI = r;
  gameManager.setSelectedRound(r);

  updateCluesDisplay(r);
  updateGuessesDisplay(r);
  updateConfDisplay(r);
  updateTGuessesDisplay(r);
  updateTConfDisplay(r);
  updateTeamTopBar();
  updateRoundButtons();

  if (typeof renderCodesModal === "function") {
    renderCodesModal(r);
  }
}

export function updateRoundButtons() {
  const selectedRound = selectedRoundUI || gameManager.round || 1;
  const myTeam = gameManager.getMyTeam();
  const maxAllowed = gameManager.getUnlockedRound(myTeam || "A");

  const navButtons = [
    ...document.querySelectorAll(
      "#us-round-switch button, #them-round-switch button"
    ),
  ];

  navButtons.forEach((btn) => {
    const roundAttr = btn.getAttribute("data-round") || btn.textContent;
    const roundNumber = parseInt(roundAttr, 10);
    if (!Number.isFinite(roundNumber)) return;

    const disabled = roundNumber > maxAllowed;
    btn.disabled = disabled;
    btn.classList.toggle("disabled", disabled);
    btn.classList.remove("next-round-ready");
    btn.classList.toggle("active", roundNumber === selectedRound);
  });
}

/**
 * Initialize round navigation click handlers
 */
export function initRoundNavigation(selectRoundCallback) {
  // US round switch (top navigation)
  const usRoundSwitch = document.getElementById("us-round-switch");
  if (usRoundSwitch && !usRoundSwitch.__roundBound) {
    usRoundSwitch.__roundBound = true;
    usRoundSwitch.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-round]");
      if (!btn) return;
      const r = parseInt(btn.getAttribute("data-round"), 10);

      if (Number.isFinite(r)) selectRoundCallback(r);
      [...usRoundSwitch.querySelectorAll("button")].forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
  }

  // THEM round switch (top navigation)
  const themRoundSwitch = document.getElementById("them-round-switch");
  if (themRoundSwitch && !themRoundSwitch.__roundBound) {
    themRoundSwitch.__roundBound = true;
    themRoundSwitch.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-round]");
      if (!btn) return;
      const r = parseInt(btn.getAttribute("data-round"), 10);

      if (Number.isFinite(r)) selectRoundCallback(r);
      [...themRoundSwitch.querySelectorAll("button")].forEach((b) =>
        b.classList.toggle("active", b === btn)
      );
    });
  }
}

/**
 * Enable the next round button when both teams reach review_round
 */
export function enableNextRoundButton() {
  updateRoundButtons();
}

/**
 * Restore normal click handlers to round switch buttons after advancing
 * Called when round changes to restore selectRound behavior
 */
export function restoreRoundSwitchHandlers(selectRoundCallback) {
  // No-op with free round navigation; kept for API compatibility
}

/**
 * Clue Word Modal - Shows the corresponding word when clicking on a clue input
 */

import { gameManager } from "../GameManager.js";

let modal = null;
let label = null;
let confirmBtn = null;

/**
 * Get the word corresponding to a clue input based on the current code
 */
function getWordForClueInput(clueInputElement) {
  const me = gameManager.players[gameManager.playerId];
  if (!me?.team) return null;

  const myTeam = me.team;
  const myWords = gameManager.words[myTeam] || [];

  // Get the clue row index (1, 2, or 3)
  const clueId = clueInputElement.id; // e.g., "clueword1", "clueword2", "clueword3"
  const clueIndex = parseInt(clueId.replace("clueword", "")) - 1; // 0, 1, or 2

  // Get the current round's code
  const currentRound = gameManager.round || 1;
  const roundKey = `round_${currentRound}`;
  const codesObj = gameManager.codes?.[myTeam] || {};
  const code = codesObj[roundKey]; // e.g., "1.3.2"

  if (!code) return null;

  // Parse the code to get the word indices
  const codeNumbers = code.split(".").map((n) => parseInt(n, 10) - 1); // Convert to 0-based indices

  // Get the word index for this clue
  const wordIndex = codeNumbers[clueIndex];

  if (wordIndex === undefined || wordIndex < 0 || wordIndex >= myWords.length) {
    return null;
  }

  return myWords[wordIndex];
}

/**
 * Show the modal with the word
 */
function showModal(word) {
  if (!modal || !label) return;

  label.textContent = word || "—";
  modal.classList.remove("hidden");
}

/**
 * Hide the modal
 */
function hideModal() {
  if (!modal) return;
  modal.classList.add("hidden");
}

/**
 * Handle clue input click
 */
function handleClueInputClick(event) {
  const clueInput = event.target;

  // Only show modal if input is a clue-input
  if (!clueInput.classList.contains("clue-input")) return;

  const word = getWordForClueInput(clueInput);
  if (word) {
    showModal(word);
  }
}

/**
 * Initialize the clue word modal
 */
export function initClueWordModal() {
  modal = document.getElementById("clue-word-modal");
  label = document.getElementById("clue-word-label");
  confirmBtn = document.getElementById("clue-word-confirm");

  if (!modal || !label || !confirmBtn) {
    return;
  }

  // Add click listener to confirm button
  confirmBtn.addEventListener("click", hideModal);

  // Add click listeners to all clue inputs (using event delegation)
  document.addEventListener("click", (event) => {
    if (event.target.classList.contains("clue-input")) {
      handleClueInputClick(event);
    }
  });

  // Also add focus listener as alternative trigger
  document.addEventListener(
    "focus",
    (event) => {
      if (event.target.classList.contains("clue-input")) {
        handleClueInputClick(event);
      }
    },
    true
  );
}

export { showModal, hideModal };

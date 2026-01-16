/**
 * Clues Phase Module
 * Handles clue input and submission for active players
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Initialize clues phase handlers
 */
export function initCluesPhase(showToast, updateClueInputs) {
  const btnSubmitClues = document.getElementById("btn-submit-clues");

  btnSubmitClues?.addEventListener("click", () => {
    const me = gameManager.players[gameManager.playerId];
    const myTeam = me?.team;

    if (!myTeam || gameManager.teamPhases?.[myTeam] !== "clues") {
      return;
    }

    // Collect clues
    const clue1 = document.getElementById("clueword1")?.value.trim();
    const clue2 = document.getElementById("clueword2")?.value.trim();
    const clue3 = document.getElementById("clueword3")?.value.trim();

    if (!clue1 || !clue2 || !clue3) {
      alert("Inserisci tutte le 3 clues.");
      return;
    }

    const clues = [clue1, clue2, clue3];

    // Save clues to Firebase
    if (!gameManager.saveClues(clues, getSelectedRound())) {
      return;
    }

    showToast("Clues inviate. Ora compagni indovinano.");

    // Phase advance is handled automatically by Firebase listeners
    setTimeout(() => updateClueInputs(), 100);
  });
}

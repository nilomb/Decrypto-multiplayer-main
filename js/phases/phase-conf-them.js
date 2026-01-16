/**
 * Conf Them Phase Module
 * Handles confirmation of guesses about opponent's code (active player)
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Initialize conf_them phase handlers
 */
export function initConfThemPhase(showToast, updateClueInputs) {
  const btnSubmitConf = document.getElementById("btn-submit-conf-them");

  if (!btnSubmitConf) return;

  // Add click handler (will be checked in phase-inputs for phase distinction)
  btnSubmitConf.addEventListener("click", () => {
    const me = gameManager.players[gameManager.playerId];
    const myTeam = me?.team;
    const currentPhase = gameManager.teamPhases?.[myTeam];

    // Only handle conf_them phase here (conf_us is handled in phase-conf-us.js)
    if (!myTeam || currentPhase !== "conf_them") {
      return;
    }

    // Check if user is active player
    const isActive = gameManager.isActivePlayer();
    if (!isActive) {
      alert("Only the active player can submit tconf.");
      return;
    }

    // Collect tconf from US page
    const tconf1 = document.getElementById("tconf1")?.value;
    const tconf2 = document.getElementById("tconf2")?.value;
    const tconf3 = document.getElementById("tconf3")?.value;

    if (!tconf1 || !tconf2 || !tconf3) {
      alert("Inserisci tutti i tconf.");
      return;
    }

    const tconfs = [parseInt(tconf1), parseInt(tconf2), parseInt(tconf3)];

    // Validate tconfs (1-4, no duplicates)
    if (tconfs.some((c) => c < 1 || c > 4)) {
      alert("Tconf devono essere 1-4.");
      return;
    }

    if (tconfs.some((num, idx) => tconfs.indexOf(num) !== idx)) {
      alert("Tconf must have unique numbers.");
      return;
    }

    // Save tconf to Firebase
    if (!gameManager.saveTConf(tconfs, getSelectedRound())) {
      return;
    }

    showToast("TConf inviati.");
    setTimeout(() => updateClueInputs(), 100);

    // Disable inputs after submission
    ["tconf1", "tconf2", "tconf3"].forEach((id) => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.disabled = true;
        inp.classList.add("disabled-clue");
      }
    });

    btnSubmitConf.disabled = true;
  });
}

/**
 * Get the conf_them button handler (for use in main UI)
 */
export function getConfThemHandler() {
  const btnSubmitConf = document.getElementById("btn-submit-conf-them");
  return btnSubmitConf?.__confThemHandler;
}

/**
 * Conf Us Phase Module
 * Handles confirmation of own team's guesses (active player)
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Initialize conf_us phase handlers
 */
export function initConfUsPhase(showToast, updateClueInputs) {
  const btnSubmitConf = document.getElementById("btn-submit-conf-us");

  btnSubmitConf?.addEventListener("click", () => {
    const me = gameManager.players[gameManager.playerId];
    const myTeam = me?.team;
    const currentPhase = gameManager.teamPhases?.[myTeam];

    if (!myTeam || currentPhase !== "conf_us") {
      return;
    }

    // Collect confirmations
    const conf1 = document.getElementById("conf1")?.value;
    const conf2 = document.getElementById("conf2")?.value;
    const conf3 = document.getElementById("conf3")?.value;

    if (!conf1 || !conf2 || !conf3) {
      alert("Inserisci tutti i conf.");
      return;
    }

    const confs = [parseInt(conf1), parseInt(conf2), parseInt(conf3)];

    // Validate confirmations (1-4)
    if (confs.some((c) => c < 1 || c > 4)) {
      alert("Conf devono essere 1-4.");
      return;
    }

    // Save confirmations to Firebase
    if (!gameManager.saveConf(confs, getSelectedRound())) {
      return;
    }

    showToast("Conf inviati.");

    // Phase advance is handled automatically by Firebase listeners
    setTimeout(() => updateClueInputs(), 100);

    // Disable conf inputs after submission
    const confInputs = document.querySelectorAll("#view-us .conf-input");
    confInputs.forEach((inp) => {
      inp.disabled = true;
      inp.classList.add("disabled-clue");
    });
    btnSubmitConf.disabled = true;
  });
}

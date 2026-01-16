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

    const round = getSelectedRound();
    const roundKey = `round_${round}`;
    const otherTeam = myTeam === "A" ? "B" : "A";
    const codeStr = gameManager.codes?.[myTeam]?.[roundKey] || "";
    const tconfs = codeStr
      .toString()
      .split("")
      .map((d) => parseInt(d, 10))
      .filter((n) => Number.isFinite(n));

    if (tconfs.length < 3) {
      alert("Codice non disponibile per questo round.");
      return;
    }

    // Save tconf to Firebase
    if (!gameManager.saveTConf(tconfs, round)) {
      return;
    }

    console.log("[TCONF][SEND]", {
      round,
      team: myTeam,
      about: otherTeam,
      code: tconfs,
    });

    showToast("TConf inviati.");
    setTimeout(() => updateClueInputs(), 100);

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

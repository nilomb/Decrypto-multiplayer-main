/**
 * Guess Them Phase Module
 * Handles guessing opponent's code (active player only)
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Initialize guess_them phase handlers
 */
export function initGuessThemPhase(showToast) {
  const btnSubmitTGuess = document.getElementById("btn-submit-tguess");

  btnSubmitTGuess?.addEventListener("click", () => {
    // Prevent double submission
    btnSubmitTGuess.disabled = true;

    const me = gameManager.players[gameManager.playerId];
    const myTeam = me?.team;
    const currentPhase = gameManager.teamPhases?.[myTeam];

    if (!myTeam || currentPhase !== "guess_them") {
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Check if user is active player
    const isActive = gameManager.isActivePlayer();
    if (!isActive) {
      alert("Only the active player can submit the final guess.");
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Collect tguesses from THEM view
    const tguess1 = document.getElementById("guessthem1")?.value || "";
    const tguess2 = document.getElementById("guessthem2")?.value || "";
    const tguess3 = document.getElementById("guessthem3")?.value || "";

    if (!tguess1 || !tguess2 || !tguess3) {
      const emptyFields = [];
      if (!tguess1) emptyFields.push("guessthem1");
      if (!tguess2) emptyFields.push("guessthem2");
      if (!tguess3) emptyFields.push("guessthem3");
      alert(`Inserisci tutti i tguess. Campi vuoti: ${emptyFields.join(", ")}`);
      btnSubmitTGuess.disabled = false;
      return;
    }

    const tguesses = [parseInt(tguess1), parseInt(tguess2), parseInt(tguess3)];

    // Validate tguesses (1-4)
    if (tguesses.some((g) => g < 1 || g > 4)) {
      alert("Tguess devono essere 1-4.");
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Save tguesses to Firebase
    if (!gameManager.saveTGuess(tguesses, getSelectedRound())) {
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Advance to conf_them phase
    if (currentPhase !== "conf_them") {
      gameManager.advanceTeamPhase(myTeam, "conf_them", getSelectedRound());
    }

    // Disable tguess inputs after submission
    const tguessInputs = document.querySelectorAll(
      "#view-them .guessthem-input"
    );
    tguessInputs.forEach((inp) => {
      inp.disabled = true;
      inp.classList.add("disabled-clue");
    });

    // In single-player mode, advance to conf_them immediately
    const otherTeam = myTeam === "A" ? "B" : "A";
    const otherTeamMembers = gameManager.teams[otherTeam] || [];

    if (otherTeamMembers.length === 0) {
      gameManager.advanceTeamPhase(myTeam, "conf_them");
    }
  });
}

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
    const selectedRound = getSelectedRound();
    const currentPhase = gameManager.getRoundPhase(myTeam, selectedRound);

    if (
      !myTeam ||
      (currentPhase !== "guess_them" && currentPhase !== "conf_them")
    ) {
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Check if user is active player
    const isActive = gameManager.isActivePlayer();
    const otherTeam = myTeam === "A" ? "B" : "A";
    const roundKey = `round_${selectedRound}`;
    const existingTGuess =
      gameManager.tguessesData?.[roundKey]?.[`${myTeam}_about_${otherTeam}`];
    const hasExistingTGuess =
      Array.isArray(existingTGuess) && existingTGuess.length > 0;

    if (hasExistingTGuess) {
      alert("A guess for this round has already been submitted.");
      btnSubmitTGuess.disabled = false;
      return;
    }

    // Allow non-active teammates to backfill guesses on past rounds if nothing was submitted yet
    const canSubmit =
      currentPhase === "guess_them" ||
      (currentPhase === "conf_them" && !hasExistingTGuess);
    if (!canSubmit) {
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
    if (!gameManager.saveTGuess(tguesses, selectedRound)) {
      btnSubmitTGuess.disabled = false;
      return;
    }

    console.log("[TGUESS][SAVE]", {
      round: selectedRound,
      team: myTeam,
      about: otherTeam,
      tguesses,
    });

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
    const otherTeamMembers = gameManager.teams[otherTeam] || [];

    if (otherTeamMembers.length === 0) {
      gameManager.advanceTeamPhase(myTeam, "conf_them");
    }
  });
}

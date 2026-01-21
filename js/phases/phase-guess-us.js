/**
 * Guess Us Phase Module
 * Handles guessing own team's code (non-active players)
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Initialize guess_us phase handlers
 */
export function initGuessUsPhase(
  showToast,
  updateClueInputs,
  updateGuessInputs,
) {
  const btnSubmitGuess = document.getElementById("btn-submit-guess");

  btnSubmitGuess?.addEventListener("click", () => {
    const me = gameManager.players[gameManager.playerId];
    const myTeam = me?.team;

    if (!myTeam || gameManager.teamPhases?.[myTeam] !== "guess_us") {
      return;
    }

    // Collect guesses
    const guess1 = document.getElementById("guess1")?.value;
    const guess2 = document.getElementById("guess2")?.value;
    const guess3 = document.getElementById("guess3")?.value;

    if (!guess1 || !guess2 || !guess3) {
      alert("Inserisci tutti i guess.");
      return;
    }

    const guesses = [parseInt(guess1), parseInt(guess2), parseInt(guess3)];

    // Validate guesses (1-4)
    if (guesses.some((g) => g < 1 || g > 4)) {
      alert("Guess devono essere 1-4.");
      return;
    }

    // Save guesses to Firebase
    if (!gameManager.saveGuess(guesses, getSelectedRound())) {
      return;
    }

    showToast("Guess inviati.");

    // Phase advance is handled automatically by Firebase listeners
    setTimeout(() => {
      updateGuessInputs();
      updateClueInputs();
    }, 100);

    // Disable guess inputs after submission
    const guessInputs = document.querySelectorAll("#view-us .guess-input");
    guessInputs.forEach((inp) => {
      inp.disabled = true;
      inp.classList.add("disabled-clue");
    });
    btnSubmitGuess.disabled = true;

    // After submitting guesses, move team to conf_us so active sees the confirm button
    gameManager.advanceTeamPhase(myTeam, "conf_us", getSelectedRound());
  });
}

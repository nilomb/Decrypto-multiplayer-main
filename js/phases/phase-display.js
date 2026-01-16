/**
 * Clues Display Module
 * Handles displaying received clues from teammates and opponents
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Update display of received clues in US view (from teammates)
 * and THEM view (from opponents)
 * @param {number} [round] - Optional round number to display. If not provided, uses selected round from UI
 */
export function updateCluesDisplay(round) {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  // Check if cluesData exists
  if (!gameManager.cluesData) return;

  const displayRound = round !== undefined ? round : getSelectedRound();
  const roundKey = `round_${displayRound}`;

  const cluesData = gameManager.cluesData[roundKey]?.[myTeam];

  // Populate own team clues in US view (read-only for non-active players)
  const usContainer = document.getElementById("view-us");
  if (usContainer) {
    const clueInputs = usContainer.querySelectorAll(".clue-input");

    if (cluesData && cluesData.clues) {
      cluesData.clues.forEach((clue, idx) => {
        if (clueInputs[idx]) {
          clueInputs[idx].value = clue;
          clueInputs[idx].setAttribute("readonly", "readonly");
        }
      });
    } else {
      // Clear all clue inputs when no data exists
      clueInputs.forEach((input) => {
        input.value = "";
        input.removeAttribute("readonly");
      });
    }
  }

  // Populate opponent clues in THEM view
  const teamPhase = gameManager.teamPhases?.[myTeam] || "lobby";
  if (teamPhase !== "lobby") {
    const otherTeam = myTeam === "A" ? "B" : "A";
    const otherCluesData = gameManager.cluesData[roundKey]?.[otherTeam];

    if (otherCluesData && otherCluesData.clues) {
      const themContainer = document.getElementById("view-them");
      if (themContainer) {
        // Populate clueword inputs in THEM view
        const cluewordInputs =
          themContainer.querySelectorAll(".clueword-input");
        otherCluesData.clues.forEach((clue, idx) => {
          if (cluewordInputs[idx]) {
            cluewordInputs[idx].value = clue;
          }
        });

        // Populate opponent's tconf (their guesses about our code)
        if (gameManager.tconfData) {
          const tconfKey = `${otherTeam}_about_${myTeam}`;
          const tconfData = gameManager.tconfData[roundKey]?.[tconfKey];

          if (tconfData) {
            let receivedTConf = null;
            if (Array.isArray(tconfData)) {
              receivedTConf = tconfData;
            } else if (tconfData && typeof tconfData === "object") {
              // Fallback for old format with playerId keys
              const firstPlayerId = Object.keys(tconfData)[0];
              receivedTConf = firstPlayerId ? tconfData[firstPlayerId] : null;
            }

            if (receivedTConf && Array.isArray(receivedTConf)) {
              const tconfInputs =
                themContainer.querySelectorAll(".confthem-input");
              receivedTConf.forEach((conf, idx) => {
                if (tconfInputs[idx]) {
                  tconfInputs[idx].value = conf;
                  tconfInputs[idx].disabled = true;
                  tconfInputs[idx].classList.add("disabled-clue");
                }
              });
            } else {
              // Clear confthem inputs if no valid tconf data for this round
              const tconfInputs =
                themContainer.querySelectorAll(".confthem-input");
              tconfInputs.forEach((input) => {
                input.value = "";
                input.disabled = false;
                input.classList.remove("disabled-clue");
              });
            }
          } else {
            // Clear confthem inputs if no tconf data for this round
            const tconfInputs =
              themContainer.querySelectorAll(".confthem-input");
            tconfInputs.forEach((input) => {
              input.value = "";
              input.disabled = false;
              input.classList.remove("disabled-clue");
            });
          }
        } else {
          // Clear confthem inputs if tconfData doesn't exist at all
          const tconfInputs = themContainer.querySelectorAll(".confthem-input");
          tconfInputs.forEach((input) => {
            input.value = "";
            input.disabled = false;
            input.classList.remove("disabled-clue");
          });
        }

        // Populate THEM panels with opponent's clues (accumulated from all rounds)
        // Use THEIR tconf (otherTeam about otherTeam) because THEY mapped THEIR clues to THEIR words
        // Populate panels when:
        // 1. Opponent's mapping (their tconf about themselves) exists for this round
        // 2. We are in review_round
        // 3. We are viewing a past round
        // Opponent panels should appear only after THEY send us their confirmation
        // (tconf otherTeam_about_myTeam = they tell us the right code for our words)
        const theirConfirmToUs =
          gameManager.tconfData?.[roundKey]?.[`${otherTeam}_about_${myTeam}`];
        const hasTheirConfirmToUs = Array.isArray(theirConfirmToUs);

        // Show only when their confirmation to us exists, and the round is current/past
        const shouldPopulatePanels =
          hasTheirConfirmToUs && displayRound <= (gameManager.round || 1);

        if (shouldPopulatePanels) {
          const otherTeamWords = gameManager.words?.[otherTeam] || [];
          const panels = themContainer.querySelectorAll(".panel");

          panels.forEach((panel) => {
            const panelNum = parseInt(panel.getAttribute("data-panel"));
            const top = panel.querySelector(".panel-top");
            const ul = top?.querySelector("ul");

            if (!ul) return;

            // Clear existing clues
            ul.innerHTML = "";

            // Accumulate opponent clues from all rounds up to the displayed round
            // Show cumulative history only up to the round being viewed
            const maxRound = displayRound;
            for (let r = 1; r <= maxRound; r++) {
              const rKey = `round_${r}`;
              const roundOtherClues =
                gameManager.cluesData?.[rKey]?.[otherTeam];

              // Use THEIR mapping (otherTeam's tconf about their own code)
              // tconfData structure: {round_X: {teamA_about_teamB: [...], teamB_about_teamA: [...]}}
              // We need otherTeam's tconf about themselves (not about us)
              const theirTConfKey = `${otherTeam}_about_${otherTeam}`;
              const roundTheirTConf =
                gameManager.tconfData?.[rKey]?.[theirTConfKey];

              if (!roundOtherClues?.clues || !roundTheirTConf) continue;

              // Find which clue index maps to this panel number
              // tconf is [num1, num2, num3] where each num is the panel (1-4)
              // clues are [clue1, clue2, clue3]
              // If tconf[0] === panelNum, then clues[0] goes to this panel
              roundTheirTConf.forEach((mappedPanelNum, clueIndex) => {
                if (
                  mappedPanelNum === panelNum &&
                  roundOtherClues.clues[clueIndex]
                ) {
                  const li = document.createElement("li");
                  li.textContent = roundOtherClues.clues[clueIndex];
                  ul.appendChild(li);
                }
              });
            }

            // Populate panel-bottom with the word (only once, doesn't change)
            // Each panel has a fixed word: panel 1 → word[0], panel 2 → word[1], etc.
            if (panelNum >= 1 && panelNum <= 4) {
              const wordIndex = panelNum - 1; // Convert panel number (1-4) to array index (0-3)
              if (otherTeamWords[wordIndex]) {
                const bottom = panel.querySelector(".word-panel");
                if (bottom) {
                  bottom.textContent = otherTeamWords[wordIndex];
                }
              }
            }
          });
        } // End of shouldPopulatePanels
      }

      // Also populate opponent clues in US view (opponent-inputs-container)
      const usContainer = document.getElementById("view-us");
      if (usContainer) {
        const opponentCluewordInputs = usContainer.querySelectorAll(
          ".opponent-clueword-input"
        );
        otherCluesData.clues.forEach((clue, idx) => {
          if (opponentCluewordInputs[idx]) {
            opponentCluewordInputs[idx].value = clue;
          }
        });
      }
    } else {
      // No opponent clues data - clear all THEM view fields

      const themContainer = document.getElementById("view-them");
      if (themContainer) {
        // Clear clueword inputs in THEM view
        const cluewordInputs =
          themContainer.querySelectorAll(".clueword-input");
        cluewordInputs.forEach((input) => {
          input.value = "";
        });

        // Clear confthem inputs (opponent's guesses about our code)
        const tconfInputs = themContainer.querySelectorAll(".confthem-input");
        tconfInputs.forEach((input) => {
          input.value = "";
          input.disabled = false;
          input.classList.remove("disabled-clue");
        });

        // Clear all panel clues in THEM view
        const panels = themContainer.querySelectorAll(".panel");
        panels.forEach((panel) => {
          const top = panel.querySelector(".panel-top");
          const ul = top?.querySelector("ul");
          if (ul) {
            ul.innerHTML = "";
          }
        });
      }

      // Also clear opponent clues in US view (opponent-inputs-container)
      const usContainer = document.getElementById("view-us");
      if (usContainer) {
        const opponentCluewordInputs = usContainer.querySelectorAll(
          ".opponent-clueword-input"
        );
        opponentCluewordInputs.forEach((input) => {
          input.value = "";
        });
      }
    }
  }
}

/**
 * Update display of received guesses from teammates
 * @param {number} [round] - Optional round number to display. If not provided, uses selected round from UI
 */
export function updateGuessesDisplay(round) {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  // Check if guessesData exists
  if (!gameManager.guessesData) return;

  const displayRound = round !== undefined ? round : getSelectedRound();
  const roundKey = `round_${displayRound}`;

  const guesses = gameManager.guessesData[roundKey]?.[myTeam];
  const phaseForRound = gameManager.getRoundPhase(myTeam, displayRound);
  const liveRound = gameManager.getUnlockedRound(myTeam);

  const usContainer = document.getElementById("view-us");
  if (!usContainer) return;

  const guessInputs = usContainer.querySelectorAll(".guess-input");

  if (!guesses) {
    // Clear all guess inputs when no data exists
    guessInputs.forEach((input) => {
      input.value = "";
      input.disabled = false;
      input.classList.remove("disabled-clue");
    });

    // Re-enable submit button
    const btnSubmitGuess = document.getElementById("btn-submit-guess");
    if (btnSubmitGuess) btnSubmitGuess.disabled = false;
    return;
  }

  // Avoid overwriting in-progress guess_us for the current playable round
  const isLiveGuessRound =
    displayRound === liveRound && phaseForRound === "guess_us";
  if (isLiveGuessRound) return;

  const playerIds = Object.keys(guesses);

  if (playerIds.length > 0) {
    const playerId = playerIds[0]; // Show first player's guesses
    guessInputs.forEach((inp, idx) => {
      if (
        guesses[playerId] &&
        Array.isArray(guesses[playerId]) &&
        guesses[playerId][idx] !== undefined
      ) {
        inp.value = guesses[playerId][idx];
        inp.disabled = true;
        inp.classList.add("disabled-clue");
      }
    });
  }

  // Disable submit button if any player has complete guess
  const hasCompleteGuess = playerIds.some(
    (pid) =>
      guesses[pid] && Array.isArray(guesses[pid]) && guesses[pid].length === 3
  );

  if (hasCompleteGuess) {
    const btnSubmitGuess = document.getElementById("btn-submit-guess");
    if (btnSubmitGuess) btnSubmitGuess.disabled = true;
  }
}

/**
 * Update display of confirmed answers
 * @param {number} [round] - Optional round number to display. If not provided, uses selected round from UI
 */
export function updateConfDisplay(round) {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  // Check if confData exists
  if (!gameManager.confData) return;

  const displayRound = round !== undefined ? round : getSelectedRound();
  const roundKey = `round_${displayRound}`;
  const conf = gameManager.confData[roundKey]?.[myTeam];

  const usContainer = document.getElementById("view-us");
  if (!usContainer) return;

  const confInputs = usContainer.querySelectorAll(".conf-input");

  if (!conf) {
    // Keep prefilled code values; ensure read-only state
    confInputs.forEach((input) => {
      input.setAttribute("readonly", "readonly");
      input.classList.remove("disabled-clue");
      input.removeAttribute("disabled");
    });
    const btnSubmitConfUs = document.getElementById("btn-submit-conf-us");
    if (btnSubmitConfUs) btnSubmitConfUs.disabled = false;
    // Don't return - still need to populate panels with previous rounds
  } else {
    if (Array.isArray(conf)) {
      conf.forEach((val, idx) => {
        if (confInputs[idx]) {
          confInputs[idx].value = val;
          confInputs[idx].disabled = true;
          confInputs[idx].classList.add("disabled-clue");
        }
      });
    } else if (typeof conf === "object") {
      // Fallback for old format
      const firstPlayerId = Object.keys(conf)[0];
      if (firstPlayerId && Array.isArray(conf[firstPlayerId])) {
        conf[firstPlayerId].forEach((val, idx) => {
          if (confInputs[idx]) {
            confInputs[idx].value = val;
            confInputs[idx].disabled = true;
            confInputs[idx].classList.add("disabled-clue");
          }
        });
      }
    }

    const btnSubmitConfUs = document.getElementById("btn-submit-conf-us");
    if (btnSubmitConfUs) btnSubmitConfUs.disabled = true;
  }

  // Always populate US panels with cumulative clues from all rounds
  // This should happen regardless of whether conf exists for current round
  const panels = usContainer.querySelectorAll(".panel");
  panels.forEach((panel) => {
    const panelNum = parseInt(panel.getAttribute("data-panel"));
    const top = panel.querySelector(".panel-top");
    const ul = top?.querySelector("ul");

    if (!ul) return;

    // Clear existing clues
    ul.innerHTML = "";

    // Accumulate clues from all rounds up to the displayed round
    // Show cumulative history only up to the round being viewed
    const maxRound = displayRound;
    for (let r = 1; r <= maxRound; r++) {
      const rKey = `round_${r}`;
      const roundCluesData = gameManager.cluesData?.[rKey]?.[myTeam];
      const roundConfData = gameManager.confData?.[rKey]?.[myTeam];

      if (!roundCluesData?.clues || !roundConfData) continue;

      // Convert conf to array if needed
      const roundConfArray = Array.isArray(roundConfData)
        ? roundConfData
        : typeof roundConfData === "object" &&
            Object.keys(roundConfData).length > 0
          ? roundConfData[Object.keys(roundConfData)[0]]
          : null;

      if (!roundConfArray) continue;

      // Find which clue corresponds to this panel number
      const clueIndex = roundConfArray.findIndex((num) => num === panelNum);

      if (clueIndex !== -1 && roundCluesData.clues[clueIndex]) {
        const li = document.createElement("li");
        li.textContent = roundCluesData.clues[clueIndex];
        ul.appendChild(li);
      }
    }
  });
}

/**
 * Update display of opponent's guesses about our code (tguesses)
 * @param {number} [round] - Optional round number to display. If not provided, uses selected round from UI
 */
export function updateTGuessesDisplay(round) {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  // Check if tguessesData exists
  if (!gameManager.tguessesData) return;

  const displayRound = round !== undefined ? round : getSelectedRound();
  const roundKey = `round_${displayRound}`;
  const otherTeam = myTeam === "A" ? "B" : "A";
  const tguessKey = `${otherTeam}_about_${myTeam}`;
  const tguesses = gameManager.tguessesData[roundKey]?.[tguessKey];

  const usContainer = document.getElementById("view-us");
  if (!usContainer) return;

  const tguessInputs = usContainer.querySelectorAll(".tguess-input");

  if (!tguesses || !Array.isArray(tguesses)) {
    // Clear all tguess inputs when no data exists
    tguessInputs.forEach((input) => {
      input.value = "";
      input.removeAttribute("readonly");
      input.classList.remove("disabled-clue");
    });
    return;
  }

  console.log("[TGUESS][DISPLAY]", {
    round: displayRound,
    myTeam,
    from: otherTeam,
    tguesses,
  });

  tguesses.forEach((val, idx) => {
    if (tguessInputs[idx]) {
      tguessInputs[idx].value = val;
      tguessInputs[idx].setAttribute("readonly", "readonly");
      tguessInputs[idx].classList.add("disabled-clue");
    }
  });
}

/**
 * Update display of own tconf guesses (guesses about opponent's code)
 * The tconf-input fields in US view show the user's own guesses about the opponent's code
 * @param {number} [round] - Optional round number to display. If not provided, uses selected round from UI
 */
export function updateTConfDisplay() {
  // tconf inputs removed from US view; kept for API compatibility
  const btnSubmitConfThem = document.getElementById("btn-submit-conf-them");
  if (btnSubmitConfThem) btnSubmitConfThem.disabled = false;
}

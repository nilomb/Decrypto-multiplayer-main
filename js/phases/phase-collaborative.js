/**
 * Collaborative Input Module
 * Handles real-time collaborative editing of tguess inputs
 */

import { gameManager } from "../GameManager.js";

/**
 * Initialize collaborative tguess input handlers
 */
export function initCollaborativeInputs() {
  // Listener for collaborative tguess inputs (guess_us phase - collaborative guessing of own team's words)
  document.querySelectorAll(".guess-input").forEach((input) => {
    let typingTimeout;

    input.addEventListener("input", () => {
      // Read all guess-input values
      const guessValues = Array.from(
        document.querySelectorAll(".guess-input"),
      ).map((inp) => inp.value || "");

      gameManager.updateCollaborativeGuessUs(guessValues);

      // Set typing indicator
      gameManager.setTypingIndicator(true);

      // Clear previous timeout
      clearTimeout(typingTimeout);

      // Clear typing indicator after 1 second of no input
      typingTimeout = setTimeout(() => {
        gameManager.setTypingIndicator(false);
      }, 1000);
    });

    input.addEventListener("blur", () => {
      clearTimeout(typingTimeout);
      gameManager.setTypingIndicator(false);
    });
  });

  // Listener for collaborative tguess inputs (guess_them phase)
  document.querySelectorAll(".guessthem-input").forEach((input) => {
    let typingTimeout;

    input.addEventListener("input", () => {
      // Determine which inputs to read based on current input's ID
      let inputIds;
      if (input.id.startsWith("guessthem")) {
        // THEM page guessthem inputs
        inputIds = ["guessthem1", "guessthem2", "guessthem3"];
      } else if (input.id.startsWith("tguess")) {
        // US page tguess inputs
        inputIds = ["tguess1", "tguess2", "tguess3"];
      } else {
        return; // Unknown input
      }

      // Update collaborative data
      const tguess = inputIds.map(
        (id) => document.getElementById(id)?.value || "",
      );
      gameManager.updateCollaborativeTGuess(tguess);

      // Set typing indicator
      gameManager.setTypingIndicator(true);

      // Clear previous timeout
      clearTimeout(typingTimeout);

      // Clear typing indicator after 1 second of no input
      typingTimeout = setTimeout(() => {
        gameManager.setTypingIndicator(false);
      }, 1000);
    });

    input.addEventListener("blur", () => {
      // Clear typing indicator when input loses focus
      clearTimeout(typingTimeout);
      gameManager.setTypingIndicator(false);
    });
  });
}

/**
 * Update collaborative guesses for guess_us phase
 */
export function updateCollaborativeGuessUs() {
  const myTeam = gameManager.getMyTeam();
  if (!myTeam) {
    return;
  }

  const roundKey = `round_${gameManager.round}`;
  const currentPhase = gameManager.teamPhases?.[myTeam];

  if (currentPhase === "guess_us") {
    // Only update live for "us" page (intra-team collaboration)
    if (!document.getElementById("guess1")) {
      return;
    }

    const collabData = gameManager.collabGuessUsData?.[roundKey]?.[myTeam];

    if (collabData?.values && Array.isArray(collabData.values)) {
      const inputsToUpdate = ["guess1", "guess2", "guess3", "guess4"];

      inputsToUpdate.forEach((id, i) => {
        const inp = document.getElementById(id);
        if (inp && !inp.disabled) {
          const newValue = collabData.values[i] || "";
          // Only update if different to avoid cursor jumping
          if (inp.value !== newValue) {
            inp.value = newValue;
          }
        }
      });
    }
  }
}

/**
 * Update collaborative tguesses from Firebase
 */
export function updateCollaborativeTGuesses() {
  const myTeam = gameManager.getMyTeam();
  if (!myTeam) {
    return;
  }

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${gameManager.round}`;
  const currentPhase = gameManager.teamPhases?.[myTeam];

  // Keep teammates in sync while typing guesses about them.
  if (currentPhase === "guess_them" || currentPhase === "conf_them") {
    // Only update live for "them" page (intra-team collaboration)
    if (!document.getElementById("guessthem1")) {
      return;
    }

    const tguessKey = `${myTeam}_about_${otherTeam}`;
    const collabData = gameManager.collabTGuessesData?.[roundKey]?.[tguessKey];

    const inputsToUpdate = ["guessthem1", "guessthem2", "guessthem3"];

    if (collabData?.values && Array.isArray(collabData.values)) {
      inputsToUpdate.forEach((id, i) => {
        const inp = document.getElementById(id);
        if (inp && !inp.disabled) {
          const newValue = collabData.values[i] || "";
          // Only update if different to avoid cursor jumping
          if (inp.value !== newValue) {
            inp.value = newValue;
          }
        }
      });
    } else {
      // No collaborative data for this round - clear inputs if they are editable
      inputsToUpdate.forEach((id) => {
        const inp = document.getElementById(id);
        if (inp && !inp.disabled && !inp.hasAttribute("readonly")) {
          inp.value = "";
        }
      });
    }
  }
}

/**
 * Update typing indicators to show who is typing
 */
export function updateTypingIndicators() {
  const me = gameManager.players[gameManager.playerId];
  if (!me?.team) return;

  const myTeam = me.team;
  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${gameManager.round}`;

  const typingKey = `${myTeam}_about_${otherTeam}`;
  const typingData =
    gameManager.typingIndicators?.[roundKey]?.[typingKey] || {};

  // Remove existing typing indicators
  document.querySelectorAll(".typing-indicator").forEach((el) => el.remove());

  // Add typing indicators for active typers (excluding self)
  const typingPlayers = Object.keys(typingData).filter(
    (playerId) =>
      playerId !== gameManager.playerId &&
      typingData[playerId]?.isTyping &&
      Date.now() - typingData[playerId]?.timestamp < 3000, // Only show if recent
  );

  if (typingPlayers.length > 0) {
    const inputContainer = document.querySelector("#view-them .input-row");
    if (inputContainer) {
      const indicator = document.createElement("div");
      indicator.className = "typing-indicator";
      indicator.textContent = `${typingPlayers.length} teammate${
        typingPlayers.length > 1 ? "s" : ""
      } typing...`;

      // Insert after the first input or append to container
      const firstInput = inputContainer.querySelector("input");
      if (firstInput && firstInput.parentNode) {
        firstInput.parentNode.appendChild(indicator);
      }
    }
  }
}

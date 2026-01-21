/**
 * Input Management Phase Module
 * Handles enabling/disabling inputs based on game phase and player role
 */

import { gameManager } from "../GameManager.js";
import { getSelectedRound } from "./phase-rounds.js";

/**
 * Check if we have received valid tguesses from opponents
 */
function hasReceivedTGuesses() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${getSelectedRound?.() || gameManager.round}`;
  const tguessKey = `${otherTeam}_about_${myTeam}`;
  const tguesses = gameManager.tguessesData[roundKey]?.[tguessKey];

  return tguesses && Array.isArray(tguesses) && tguesses.length > 0;
}

/**
 * Check if we have already sent tconf
 */
function hasSentTConf() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${getSelectedRound?.() || gameManager.round}`;
  const tconfKey = `${myTeam}_about_${otherTeam}`;
  const tconf = gameManager.tconfData[roundKey]?.[tconfKey];

  return tconf && Array.isArray(tconf) && tconf.length > 0;
}

/**
 * Check if we have already sent conf
 */
function hasSentConf() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const roundKey = `round_${getSelectedRound?.() || gameManager.round}`;
  const conf = gameManager.confData[roundKey]?.[myTeam];

  return conf && Array.isArray(conf) && conf.length > 0;
}

/**
 * Check if opponent clues for the current round are available
 */
function hasOpponentClues() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${getSelectedRound?.() || gameManager.round}`;
  const opponentClues = gameManager.cluesData?.[roundKey]?.[otherTeam];

  if (!opponentClues) return false;
  return Object.values(opponentClues).some((v) => {
    if (typeof v === "string") return v.trim().length > 0;
    return Boolean(v);
  });
}

/**
 * Check if opponent team has confirmed their own code (conf_us completed)
 */
function hasOpponentConf() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${getSelectedRound?.() || gameManager.round}`;
  const opponentConf = gameManager.confData?.[roundKey]?.[otherTeam];
  return Array.isArray(opponentConf) && opponentConf.length > 0;
}

/**
 * Toggle input fields based on enabled state
 */
function toggleInputs(selector, enable, container = document) {
  container.querySelectorAll(selector).forEach((inp) => {
    inp.disabled = !enable;
    inp.classList.toggle("disabled-clue", !enable);
    if (enable) {
      inp.removeAttribute("disabled");
      inp.removeAttribute("readonly");
    } else {
      inp.setAttribute("readonly", "readonly");
      inp.removeAttribute("disabled");
    }
  });
}

/**
 * Update all clue/guess/conf inputs based on current phase and player role
 */
export function updateClueInputs() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  const isActive = gameManager.isActivePlayer();
  const selectedRound = getSelectedRound?.() || gameManager.round || 1;
  const isRoundOne = selectedRound === 1;
  const teamPhase = gameManager.getRoundPhase(myTeam, selectedRound);
  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${selectedRound}`;
  const myTGuess =
    gameManager.tguessesData?.[roundKey]?.[`${myTeam}_about_${otherTeam}`];
  const hasMyTGuess = Array.isArray(myTGuess) && myTGuess.length > 0;
  const hasTGuesses = hasMyTGuess; // use our submitted tguesses for gating conf_them
  const opponentCodeDigits = (gameManager.codes?.[otherTeam]?.[roundKey] || "")
    .toString()
    .replace(/\D/g, "")
    .split("")
    .map((d) => parseInt(d, 10))
    .filter((n) => Number.isFinite(n))
    .slice(0, 3);

  const enables = {
    clues: isActive && teamPhase === "clues",
    guess: myTeam && !isActive && teamPhase === "guess_us",
    // conf inputs are auto-filled with our code and kept read-only
    conf: false,
    tguess: false, // tguess are always read-only
    tconf: false,
  };

  const usContainer = document.getElementById("view-us");
  if (usContainer) {
    toggleInputs(".clue-input", enables.clues, usContainer);
    const roundKey = `round_${selectedRound}`;
    const myCodes = gameManager.codes?.[myTeam]?.[roundKey] || "";
    const codeDigits = myCodes
      .toString()
      .split("")
      .map((d) => parseInt(d, 10))
      .filter((n) => Number.isFinite(n));
    const confAlreadySent = hasSentConf();

    const guessInputs = usContainer.querySelectorAll(".guess-input");
    const confInputs = usContainer.querySelectorAll(".conf-input");
    const tguessInputs = usContainer.querySelectorAll(".tguess-input");

    const setState = (nodes, { editable, bg }) => {
      nodes.forEach((inp) => {
        if (editable) {
          inp.removeAttribute("readonly");
          inp.removeAttribute("disabled");
          inp.classList.remove("disabled-clue");
        } else {
          inp.setAttribute("readonly", "readonly");
          inp.classList.add("disabled-clue");
          inp.removeAttribute("disabled");
        }
        if (bg) inp.style.backgroundColor = bg;
      });
    };

    // Defaults
    setState(guessInputs, { editable: false, bg: "#eee" });
    setState(confInputs, { editable: false, bg: "#eee" });
    setState(tguessInputs, { editable: false, bg: "#eee" });

    // Phase-specific rules
    switch (teamPhase) {
      case "clues": {
        // Active: all gray, show code only to active; Others: all gray, code hidden
        confInputs.forEach((inp, idx) => {
          if (isActive && codeDigits[idx] !== undefined) {
            inp.value = codeDigits[idx];
          } else if (!confAlreadySent) {
            inp.value = "";
          }
        });
        break;
      }
      case "guess_us": {
        if (!isActive) {
          // Teammates: first column editable white
          setState(guessInputs, { editable: true, bg: "#fff" });
        }
        // Code visible only to active; teammates see blank until conf sent
        confInputs.forEach((inp, idx) => {
          if ((isActive || confAlreadySent) && codeDigits[idx] !== undefined) {
            inp.value = codeDigits[idx];
          } else if (!confAlreadySent) {
            inp.value = "";
          }
        });
        break;
      }
      case "conf_us": {
        if (confAlreadySent || isActive) {
          confInputs.forEach((inp, idx) => {
            if (codeDigits[idx] !== undefined) inp.value = codeDigits[idx];
          });
        }
        break;
      }
      default:
        break;
    }

    // Ensure active player cannot edit guess inputs in guess_us phase
    if (teamPhase === "guess_us" && isActive) {
      usContainer
        .querySelectorAll("*[type='number'], *[type='text']")
        .forEach((inp) => {
          // Skip chat inputs - they should always be editable
          if (inp.id === "chat-input" || inp.id === "opponent-chat-input") {
            return;
          }
          inp.setAttribute("readonly", "readonly");
          inp.classList.add("disabled-clue");
          inp.removeAttribute("disabled");
        });
      usContainer.querySelectorAll(".guess-input").forEach((inp) => {
        // keep guess inputs styling
      });
    }

    const btnSubmitConfUs = document.getElementById("btn-submit-conf-us");
    if (btnSubmitConfUs) {
      const show = teamPhase === "conf_us";
      btnSubmitConfUs.style.display = show ? "block" : "none";
      btnSubmitConfUs.classList.remove("hidden");
      if (show) {
        const confAlreadySent = hasSentConf();
        const disabled = confAlreadySent || !isActive;
        btnSubmitConfUs.disabled = disabled;
        btnSubmitConfUs.classList.toggle("disabled-clue", disabled);
      }
    }

    const btnSubmitConfThem = document.getElementById("btn-submit-conf-them");
    if (btnSubmitConfThem) {
      const show = teamPhase === "conf_them" && !isRoundOne; // round 1 auto-handled
      btnSubmitConfThem.style.display = show ? "inline-block" : "none";
      let tconfAlreadySent = false;
      if (show) {
        tconfAlreadySent = hasSentTConf();
        const disabled = !hasTGuesses || tconfAlreadySent;
        btnSubmitConfThem.disabled = disabled;
        btnSubmitConfThem.classList.toggle("disabled-clue", disabled);
      }
    }
  }

  const themContainer = document.getElementById("view-them");
  if (themContainer) {
    // Allow writing guesses when this round is in guess_them OR in conf_them but we haven't submitted our guess yet
    const isInGuessThem = teamPhase === "guess_them";
    const isInConfThem = teamPhase === "conf_them";
    const showThemData =
      isInGuessThem ||
      isInConfThem ||
      teamPhase === "review_round" ||
      selectedRound < (gameManager.round || 1); // Show for review and past rounds
    const opponentCluesReady = hasOpponentClues();
    const opponentConfDone = hasOpponentConf();
    const allowGuessInputs =
      opponentCluesReady &&
      opponentConfDone &&
      (isInGuessThem || (isInConfThem && !hasMyTGuess)); // allow backfill in conf_them if not sent and only once clues + their conf are present

    const guessthemInputs = themContainer.querySelectorAll(".guessthem-input");
    guessthemInputs.forEach((inp) => {
      // Hide in round 1, always show from round 2 onwards
      if (isRoundOne) {
        inp.value = "";
        inp.style.display = "none";
        return;
      }

      inp.style.display = "";

      if (allowGuessInputs) {
        inp.removeAttribute("disabled");
        inp.removeAttribute("readonly");
        inp.classList.remove("disabled-clue");
        inp.style.backgroundColor = "#fff";
      } else {
        // When not in guess phase or clues not ready, clear and disable
        // Only clear if we haven't submitted our tguess for this round
        if (!hasMyTGuess) {
          inp.value = "";
        }
        inp.setAttribute("readonly", "readonly");
        inp.classList.add("disabled-clue");
        inp.removeAttribute("disabled");
        inp.style.backgroundColor = "#eee";
      }
    });

    // confthem inputs: writable ONLY when active in conf_them
    const confThem = themContainer.querySelectorAll(".confthem-input");
    confThem.forEach((inp, idx) => {
      // Always readonly; show gray background; in round 1 we already set values
      if (!showThemData) {
        inp.value = "";
        inp.style.display = "";
        inp.setAttribute("readonly", "readonly");
        inp.classList.add("disabled-clue");
        inp.removeAttribute("disabled");
        inp.style.backgroundColor = "#eee";
        return;
      }

      if (isRoundOne) {
        inp.value = opponentCodeDigits[idx] ?? "";
      } else if (hasTGuesses || hasSentTConf()) {
        // Show submitted guesses/confirmations when available
        const myTConf =
          gameManager.tconfData?.[roundKey]?.[`${myTeam}_about_${otherTeam}`];
        const digits = Array.isArray(myTConf) ? myTConf : myTGuess;
        if (Array.isArray(digits) && digits[idx] !== undefined) {
          inp.value = digits[idx];
        } else {
          inp.value = ""; // Clear if no data for this index
        }
      } else {
        // Clear confthem when no tguess or tconf data for this round
        inp.value = "";
      }

      inp.setAttribute("readonly", "readonly");
      inp.classList.add("disabled-clue");
      inp.removeAttribute("disabled");
      inp.style.backgroundColor = "#eee";
      inp.style.display = "";
    });

    // Clue text on THEM page: keep empty until conf_them
    const cluewordInputs = themContainer.querySelectorAll(".clueword-input");
    if (!showThemData) {
      cluewordInputs.forEach((inp) => {
        inp.value = "";
      });
    }
  }

  // Update hint inputs based on current phase
  updateHintInputStates();
}

/**
 * Clear all input fields (used on game reset)
 */
export function clearAllInputs() {
  const allInputs = document.querySelectorAll(
    "input[type='text'], input[type='number']",
  );
  allInputs.forEach((input) => {
    input.value = "";
    input.disabled = false;
    input.classList.remove("disabled-clue");
  });

  const buttons = document.querySelectorAll("button");
  buttons.forEach((btn) => {
    if (btn.id !== "btn-reset") {
      btn.disabled = false;
      btn.classList.remove("working");
    }
  });
}

/**
 * Setup numeric validation for number inputs (1-4 only)
 * This should be called ONCE on page load, not on every phase change
 */
export function setupNumericValidation() {
  // Skip if already initialized globally
  if (window.__numericValidationInitialized) {
    // Only update hint input states, don't re-setup listeners
    updateHintInputStates();
    return;
  }
  window.__numericValidationInitialized = true;

  const numberInputs = document.querySelectorAll("input[type='number']");
  numberInputs.forEach((input) => {
    if (input.__validationBound) return;
    input.__validationBound = true;

    input.addEventListener("input", (e) => {
      let val = e.target.value;
      if (val === "") return;

      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 4) {
        e.target.value = "";
      } else {
        e.target.value = num;
      }
    });
  });

  // Setup hint system ONCE (listeners are permanent)
  setupHintSystemForContainer(document.getElementById("view-them"));
  setupHintSystemForContainer(document.getElementById("view-us"));

  // Enable/disable hint inputs based on phase
  updateHintInputStates();

  // Listen for Firebase hint changes and re-render them
  attachHintListener();
}

/**
 * Update hint input enable/disable based on current phase
 * HINTS ARE ALWAYS ENABLED - they are personal notes for the team
 */
export function updateHintInputStates() {
  const hintInputs = document.querySelectorAll(".hint-input");
  hintInputs.forEach((inp) => {
    // ALWAYS ENABLED - hints are personal notes that can be used anytime
    inp.disabled = false;
    inp.removeAttribute("disabled");
    inp.removeAttribute("readonly");
    inp.classList.remove("disabled-clue");
  });
}

/**
 * Listen for Firebase hint changes and re-render panels in real-time
 */
function attachHintListener() {
  // Store the previous hints to detect changes
  let previousHints = JSON.stringify(gameManager.hints || {});

  // Register a callback for when gameManager emits changes
  if (!gameManager.__hintListenerAttached) {
    gameManager.__hintListenerAttached = true;
    gameManager.onChange(() => {
      const currentHints = JSON.stringify(gameManager.hints || {});
      if (currentHints !== previousHints) {
        previousHints = currentHints;

        // Re-render all hint panels
        const them = document.getElementById("view-them");
        const us = document.getElementById("view-us");

        [1, 2, 3, 4].forEach((panelNum) => {
          if (them) {
            const container = them.querySelector(`#hints-${panelNum}`);
            if (container) {
              loadHintsFromFirebase(container, panelNum);
            }
          }
          if (us) {
            const container = us.querySelector(`#hints-${panelNum}`);
            if (container) {
              loadHintsFromFirebase(container, panelNum);
            }
          }
        });
      }
    });
  }
}

function setupHintSystemForContainer(container) {
  if (!container) return;

  const hintInputs = container.querySelectorAll(".hint-input");

  hintInputs.forEach((input) => {
    // Skip if already setup (prevent duplicate listeners)
    if (input.hasAttribute("data-hint-listener-attached")) {
      return;
    }
    input.setAttribute("data-hint-listener-attached", "true");

    const panelNumber = parseInt(input.getAttribute("data-panel"), 10);
    const hintsContainer = container.querySelector(`#hints-${panelNumber}`);

    if (!hintsContainer) {
      console.warn(
        "[HINT SYSTEM] No hints container found for panel",
        panelNumber,
      );
      return;
    }

    // Load hints from Firebase
    loadHintsFromFirebase(hintsContainer, panelNumber);

    // Attach keypress listener ONCE
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const text = input.value.trim();
        if (text) {
          addHintToPanel(hintsContainer, text, panelNumber);
          input.value = "";
        }
      }
    });
  });
}

function loadHintsFromFirebase(hintsContainer, panelNumber) {
  const roundKey = `round_${gameManager.round}`;
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  // Load hints only for my team
  const hints = gameManager.hints?.[roundKey]?.[myTeam] || {};
  const panelNum = parseInt(panelNumber, 10);
  const isActive = gameManager.isActivePlayer();
  hintsContainer.innerHTML = "";

  // Load all hints for this panel
  Object.entries(hints).forEach(([key, hint]) => {
    const hintPanel = parseInt(hint?.panel, 10);
    if (hintPanel === panelNum) {
      renderHintFromData(hintsContainer, hint, key, panelNum);
    }
  });
}

function renderHintFromData(hintsContainer, hintData, hintKey, panelNumber) {
  const hintItem = document.createElement("div");
  hintItem.className = "hint-item";
  hintItem.setAttribute("data-hint-key", hintKey);

  const isCrossed = hintData.crossed ? "crossed" : "";

  hintItem.innerHTML = `
    <span class="hint-text ${isCrossed}">${escapeHtml(hintData.text)}</span>
    <div class="hint-buttons">
      <button class="hint-btn check" title="Toggle strikethrough">✓</button>
      <button class="hint-btn delete" title="Delete hint">🗑</button>
    </div>
  `;

  const checkBtn = hintItem.querySelector(".check");
  const deleteBtn = hintItem.querySelector(".delete");
  const hintText = hintItem.querySelector(".hint-text");

  checkBtn.addEventListener("click", () => {
    hintText.classList.toggle("crossed");
    gameManager.updateHintState(hintKey, panelNumber, {
      text: hintData.text,
      crossed: hintText.classList.contains("crossed"),
    });
  });

  deleteBtn.addEventListener("click", () => {
    hintItem.remove();
    gameManager.deleteHint(hintKey, panelNumber);
  });

  hintsContainer.appendChild(hintItem);
}

function addHintToPanel(container, text, panelNumber) {
  // Just save to Firebase - let the listener re-render for everyone
  // This ensures all team members see it at the same time via Firebase
  gameManager.addHint(text, panelNumber);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Input Management Phase Module
 * Handles enabling/disabling inputs based on game phase and player role
 */

import { gameManager } from "../GameManager.js";

/**
 * Check if we have received valid tguesses from opponents
 */
function hasReceivedTGuesses() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return false;

  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${gameManager.round}`;
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
  const roundKey = `round_${gameManager.round}`;
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

  const roundKey = `round_${gameManager.round}`;
  const conf = gameManager.confData[roundKey]?.[myTeam];

  return conf && Array.isArray(conf) && conf.length > 0;
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
  const teamPhase = gameManager.teamPhases?.[myTeam] || "lobby";

  const enables = {
    clues: isActive && teamPhase === "clues",
    guess: myTeam && !isActive && teamPhase === "guess_us",
    conf: isActive && teamPhase === "conf_us",
    tguess: false, // tguess are always read-only
    tconf: isActive && teamPhase === "conf_them",
  };

  const usContainer = document.getElementById("view-us");
  if (usContainer) {
    toggleInputs(".clue-input", enables.clues, usContainer);
    toggleInputs(".guess-input", enables.guess, usContainer);
    toggleInputs(".conf-input", enables.conf, usContainer);

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
        inp.style.backgroundColor = "#eee";
      });
    }

    // Show tguess inputs for active player (read-only)
    const shouldShowTGuess = isActive && teamPhase !== "lobby";
    usContainer.querySelectorAll(".tguess-input").forEach((inp) => {
      inp.style.display = shouldShowTGuess ? "block" : "none";
      if (shouldShowTGuess) {
        inp.setAttribute("readonly", "readonly");
        inp.classList.add("disabled-clue");
        inp.removeAttribute("disabled");
        if (!hasReceivedTGuesses()) {
          inp.value = "";
        }
      }
    });

    // Show tconf inputs for active player
    // Enable when: active + (guess_them OR conf_them) + received tguesses
    const shouldShowTConf = isActive && teamPhase !== "lobby";
    const hasTGuesses = hasReceivedTGuesses();
    const enableTConf =
      isActive &&
      (teamPhase === "guess_them" || teamPhase === "conf_them") &&
      hasTGuesses;

    usContainer.querySelectorAll(".tconf-input").forEach((inp) => {
      inp.style.display = shouldShowTConf ? "block" : "none";

      if (shouldShowTConf) {
        if (enableTConf) {
          // Writable when tguesses received in guess_them or conf_them
          inp.removeAttribute("readonly");
          inp.removeAttribute("disabled");
          inp.classList.remove("disabled-clue");
        } else {
          // Read-only in other phases or when tguesses not yet received
          inp.setAttribute("readonly", "readonly");
          inp.classList.add("disabled-clue");
          inp.removeAttribute("disabled");
        }
      }
    });

    // Enable/disable confirm buttons based on phase
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
      const show = teamPhase === "conf_them";
      btnSubmitConfThem.style.display = show ? "block" : "none";
      if (show) {
        const tconfAlreadySent = hasSentTConf();
        const disabled = !isActive || !hasTGuesses || tconfAlreadySent;
        btnSubmitConfThem.disabled = disabled;
        btnSubmitConfThem.classList.toggle("disabled-clue", disabled);
      }
    }
  }

  const themContainer = document.getElementById("view-them");
  if (themContainer) {
    const otherTeam = myTeam === "A" ? "B" : "A";
    const otherTeamPhase = gameManager.teamPhases?.[otherTeam] || "lobby";

    // guessthem inputs: writable only in guess_them when active
    // COLLABORATIVO: tutti i membri della squadra possono scrivere in guess_them
    const isInGuessThem = teamPhase === "guess_them";
    const isInConfThem = teamPhase === "conf_them" && isActive;

    const guessThem = themContainer.querySelectorAll(".guessthem-input");
    guessThem.forEach((inp) => {
      if (isInGuessThem) {
        // Writable in guess_them per TUTTA LA SQUADRA (collaborativo)
        inp.removeAttribute("disabled");
        inp.removeAttribute("readonly");
        inp.classList.remove("disabled-clue");
      } else if (isInConfThem) {
        // Readonly in conf_them (keep values visible)
        inp.setAttribute("readonly", "readonly");
        inp.classList.add("disabled-clue");
        inp.removeAttribute("disabled");
      } else {
        // Hidden/disabled in other fasi
        inp.disabled = true;
        inp.classList.add("disabled-clue");
      }
    });

    // confthem inputs: writable ONLY when active in conf_them
    const confThem = themContainer.querySelectorAll(".confthem-input");
    confThem.forEach((inp) => {
      if (isInConfThem && isActive) {
        // Writable ONLY when ACTIVE in conf_them
        inp.removeAttribute("readonly");
        inp.removeAttribute("disabled");
        inp.classList.remove("disabled-clue");
      } else {
        // Readonly in other cases
        inp.setAttribute("readonly", "readonly");
        inp.classList.add("disabled-clue");
        inp.removeAttribute("disabled");
      }
    });
  }

  // Update hint inputs based on current phase
  updateHintInputStates();
}

/**
 * Clear all input fields (used on game reset)
 */
export function clearAllInputs() {
  const allInputs = document.querySelectorAll(
    "input[type='text'], input[type='number']"
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
        panelNumber
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
  console.log("[ADD HINT] Adding hint:", text, "to panel:", panelNumber);

  // Just save to Firebase - let the listener re-render for everyone
  // This ensures all team members see it at the same time via Firebase
  gameManager.addHint(text, panelNumber);

  console.log("[ADD HINT] Hint saved to Firebase, listener will re-render");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

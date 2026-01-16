/**
 * UI Core - Main Coordinator
 * Imports and coordinates all phase modules
 */

import { STORAGE, TOTAL_ROUNDS } from "./constants.js";
import { gameManager } from "./GameManager.js";
import { ensureFirebaseReady, getDb } from "./firebase-init.js";
import { teamChat } from "./TeamChat.js";
import { opponentChat } from "./OpponentChat.js";

// Phase modules
import { initLobbyPhase, updateRoomLobby } from "./phases/phase-lobby.js";
import {
  updateClueInputs,
  clearAllInputs,
  setupNumericValidation,
} from "./phases/phase-inputs.js";
import {
  updateCluesDisplay,
  updateGuessesDisplay,
  updateConfDisplay,
  updateTGuessesDisplay,
  updateTConfDisplay,
} from "./phases/phase-display.js";
import { initCluesPhase } from "./phases/phase-clues.js";
import { initGuessUsPhase } from "./phases/phase-guess-us.js";
import { initConfUsPhase } from "./phases/phase-conf-us.js";
import { initGuessThemPhase } from "./phases/phase-guess-them.js";
import { initConfThemPhase } from "./phases/phase-conf-them.js";
import {
  initCollaborativeInputs,
  updateCollaborativeTGuesses,
  updateCollaborativeGuessUs,
  updateTypingIndicators,
} from "./phases/phase-collaborative.js";
import {
  loadWordList,
  pickUniqueWords,
  renderWords,
  updateTeamTopBar,
  updateTeamDisplays,
} from "./phases/phase-words.js";
import {
  selectRound,
  updateRoundButtons,
  initRoundNavigation,
  getSelectedRound,
  setSelectedRound,
  enableNextRoundButton,
  restoreRoundSwitchHandlers,
} from "./phases/phase-rounds.js";
import {
  initCodeModal,
  bindCodeButtons,
  showCodesInPlaceholders,
  hideCodesFromPlaceholders,
  renderCodesModal,
  updateCodeButtonVisibility,
} from "./phases/phase-modals.js";
import { initClueWordModal } from "./phases/phase-clue-word-modal.js";
import { initLogsModal } from "./phases/phase-logs.js";

// Global state
let currentView = "us";
let gameStarted = false;
let lastResetAt = 0;
let lastRoomId = null;
let hasInitialized = false;

// Toast notification
function showToast(message, duration = 3000) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// View management
const views = {
  lobby: document.getElementById("view-lobby"),
  createjoin: document.getElementById("view-createjoin"),
  join: document.getElementById("view-join"),
  room: document.getElementById("view-room"),
  us: document.getElementById("view-us"),
  them: document.getElementById("view-them"),
};

function show(id) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  const active = views[id];
  if (!active) return;

  active.classList.remove("hidden");
  if (id === "us" || id === "them") currentView = id;
  updatePhaseStatus();

  const candidate = active.querySelector("[data-autofocus]");
  if (candidate) {
    requestAnimationFrame(() => {
      candidate.focus();
      if (candidate.select) candidate.select();
    });
  }
}

function switchView(target) {
  show(target);
  if (target === "us" || target === "them") {
    setupNumericValidation();
    updateCodeButtonVisibility();
  }
}

function resetInputs(selectors = []) {
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((input) => {
      input.value = "";
      input.disabled = false;
      input.classList.remove("disabled-clue");
    });
  });
}

// Chat button visibility - hide for active player
function updateChatButtonVisibility(isVisible = true) {
  const chatBtns = document.querySelectorAll("#btn-chat, #btn-chat2");
  chatBtns.forEach((btn) => {
    if (isVisible) {
      btn.style.display = ""; // show
    } else {
      btn.style.display = "none"; // hide
    }
  });
}

// Phase status display
function updatePhaseStatus() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  const phaseStatusUs = document.getElementById("phase-status-us");
  const phaseStatusThem = document.getElementById("phase-status-them");
  const currentPhase = gameManager.teamPhases?.[myTeam] || "lobby";

  if (phaseStatusUs) {
    phaseStatusUs.textContent = currentPhase;
  }

  if (phaseStatusThem) {
    phaseStatusThem.textContent = currentPhase;
  }
}

// Action bar management
function updateActionBar() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  const teamPhase = gameManager.teamPhases?.[myTeam] || "lobby";
  const isActive = gameManager.isActivePlayer();
  const activeId = gameManager.getActivePlayer(myTeam, gameManager.round);
  const activeName = activeId ? gameManager.players[activeId]?.name : "Someone";

  // Hide chat button if player is active (can't participate in team chat)
  updateChatButtonVisibility(!isActive);

  const elements = {
    actionTextUs: document.getElementById("action-text-us"),
    actionTextThem: document.getElementById("action-text-them"),
    btnSubmitClues: document.getElementById("btn-submit-clues"),
    btnSubmitGuess: document.getElementById("btn-submit-guess"),
    btnSubmitConfUs: document.getElementById("btn-submit-conf-us"),
    btnSubmitConfThem: document.getElementById("btn-submit-conf-them"),
    btnSubmitTGuess: document.getElementById("btn-submit-tguess"),
  };

  const buttons = [
    elements.btnSubmitClues,
    elements.btnSubmitGuess,
    elements.btnSubmitConfUs,
    elements.btnSubmitConfThem,
    elements.btnSubmitTGuess,
  ];

  const hideButtons = () =>
    buttons
      .filter((el) => el?.style)
      .forEach((btn) => (btn.style.display = "none"));

  const showButton = (btn, enabled = true) => {
    if (btn) {
      btn.style.display = "inline";
      btn.disabled = !enabled;
    }
  };

  const actions = {
    clues: {
      us: isActive
        ? `${me.name}, Type your clues and send:`
        : `${activeName} is providing clues`,
      them: isActive
        ? `${me.name}, Type your clues and send:`
        : `${activeName} is providing clues`,
      buttons: isActive ? [elements.btnSubmitClues] : [],
    },
    guess_us: {
      us: isActive ? "your teammates are guessing" : "Guess the code",
      them: "Waiting for teammates guesses",
      buttons: !isActive ? [elements.btnSubmitGuess] : [],
    },
    conf_us: {
      us: isActive
        ? "Confirm the code"
        : `${activeName} is typing the right code...`,
      them: "Waiting for your code confirmation",
      buttons: [elements.btnSubmitConfUs],
    },
    guess_them: {
      us: isActive
        ? "Guess opponents clues (or go to THEM page)"
        : "Teammates are guessing opponents clues",
      them: isActive
        ? `Guess Team ${myTeam === "A" ? "B" : "A"}'s words`
        : "Teammates are guessing opponents clues",
      buttons: isActive ? [elements.btnSubmitTGuess] : [],
    },
    conf_them: {
      us: "Send to the opponent the right code",
      them: "Send to the opponent the right code",
      buttons: [elements.btnSubmitConfThem],
    },
    review_round: {
      us: "Round complete! Click next round to continue",
      them: "Round complete! Review opponent's clues, then click next round",
      buttons: [],
    },
  };

  const phase = actions[teamPhase] || {
    us: "Waiting...",
    them: "Waiting...",
    buttons: [],
  };

  hideButtons();
  if (elements.actionTextUs) {
    elements.actionTextUs.textContent = phase.us;
    elements.actionTextUs.style.display = "block";
    elements.actionTextUs.classList.remove("hidden");
  }
  if (elements.actionTextThem) {
    elements.actionTextThem.textContent = phase.them;
    elements.actionTextThem.style.display = "block";
    elements.actionTextThem.classList.remove("hidden");
  }
  phase.buttons.forEach((btn) => showButton(btn));

  // Keep conf buttons visibility in sync even if previous phases hid them
  const roundKey = `round_${gameManager.round || 1}`;
  const otherTeam = myTeam === "A" ? "B" : "A";
  const hasTGuesses = Array.isArray(
    gameManager.tguessesData?.[roundKey]?.[`${otherTeam}_about_${myTeam}`]
  )
    ? gameManager.tguessesData[roundKey][`${otherTeam}_about_${myTeam}`]
        .length > 0
    : false;

  if (elements.btnSubmitConfUs) {
    const conf = gameManager.confData?.[roundKey]?.[myTeam];
    const confSent = Array.isArray(conf) && conf.length > 0;
    const showConfUs = teamPhase === "conf_us";
    elements.btnSubmitConfUs.style.display = showConfUs ? "block" : "none";
    elements.btnSubmitConfUs.classList.remove("hidden");
    if (showConfUs) {
      const disabled = confSent || !isActive;
      elements.btnSubmitConfUs.disabled = disabled;
      elements.btnSubmitConfUs.classList.toggle("disabled-clue", disabled);
    }
  }

  if (elements.btnSubmitConfThem) {
    const tconf =
      gameManager.tconfData?.[roundKey]?.[`${myTeam}_about_${otherTeam}`];
    const tconfSent = Array.isArray(tconf) && tconf.length > 0;
    const showConfThem = teamPhase === "conf_them";
    elements.btnSubmitConfThem.style.display = showConfThem ? "block" : "none";
    elements.btnSubmitConfThem.classList.remove("hidden");
    if (showConfThem) {
      const disabled = tconfSent || !hasTGuesses || !isActive;
      elements.btnSubmitConfThem.disabled = disabled;
      elements.btnSubmitConfThem.classList.toggle("disabled-clue", disabled);
    }
  }

  // Control opponent-inputs-container visibility
  const opponentContainer = document.querySelector(
    ".opponent-inputs-container"
  );
  if (opponentContainer) {
    const shouldShow = teamPhase === "guess_them" || teamPhase === "conf_them";
    opponentContainer.style.display = shouldShow ? "block" : "none";
  }
}

// Sync room ID badges
function syncRoomIdBadges() {
  document.getElementById("mini-room-id").textContent =
    gameManager.roomId || "----";
  document.getElementById("mini-room-id2").textContent =
    gameManager.roomId || "----";
}

// Guess inputs update
function updateGuessInputs() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  const roundKey = `round_${gameManager.round}`;
  const guesses = gameManager.guessesData[roundKey]?.[myTeam];
  if (!guesses) return;

  const usContainer = document.getElementById("view-us");
  if (usContainer) {
    const guessInputs = usContainer.querySelectorAll(".guess-input");
    const playerIds = Object.keys(guesses);

    if (playerIds.length > 0) {
      const playerId = playerIds[0];
      guessInputs.forEach((inp, idx) => {
        if (
          guesses[playerId] &&
          Array.isArray(guesses[playerId]) &&
          guesses[playerId][idx] !== undefined
        ) {
          inp.value = guesses[playerId][idx];
        }
      });
    }
  }
}

// Initialize UI
function initUI() {
  if (hasInitialized) return;
  hasInitialized = true;
  // Initialize lobby phase
  initLobbyPhase(show, updateRoomLobby, updateGuessInputs);

  // Initialize game phases
  initCluesPhase(showToast, updateClueInputs);
  initGuessUsPhase(showToast, updateClueInputs, updateGuessInputs);
  initConfUsPhase(showToast, updateClueInputs);
  initGuessThemPhase(showToast);
  initConfThemPhase(showToast, updateClueInputs);

  // Initialize collaborative inputs
  initCollaborativeInputs();

  // Initialize clue word modal
  initClueWordModal();

  // Initialize code modal
  const { openCodes, closeCodes } = initCodeModal(getSelectedRound());
  bindCodeButtons(
    () => showCodesInPlaceholders(getSelectedRound()),
    hideCodesFromPlaceholders
  );

  // Initialize logs modal
  initLogsModal();

  // Initialize round navigation
  initRoundNavigation((r) =>
    selectRound(r, () => renderCodesModal(getSelectedRound()))
  );

  // US / THEM navigation
  const viewButtons = [
    { view: "us", ids: ["btn-nav-us", "btn-nav-us2"] },
    { view: "them", ids: ["btn-nav-them", "btn-nav-them2"] },
  ];

  viewButtons.forEach(({ view, ids }) => {
    ids.forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", () => switchView(view));
    });
  });

  // Start game button
  const btnStart = document.getElementById("btn-start-game");
  btnStart?.addEventListener("click", async () => {
    if (gameManager.isCreator) {
      if (!gameManager.words.A.length && !gameManager.words.B.length) {
        try {
          await loadWordList();
          const picked = pickUniqueWords(8);
          const wordsA = picked.slice(0, 4);
          const wordsB = picked.slice(4, 8);
          gameManager.setWords("A", wordsA);
          gameManager.setWords("B", wordsB);
        } catch (error) {
          console.error("[UI-CORE] Error setting words:", error);
          return;
        }
      }
      gameManager.startGame();
    }
  });

  // Exit buttons
  [...document.querySelectorAll("[data-exit]")].forEach((btn) =>
    btn.addEventListener("click", () => {
      const store = window.sessionStorage || window.localStorage;
      store.removeItem(STORAGE.room);
      show("lobby");
    })
  );

  // Reset button
  const btnResetGlobal = document.getElementById("btn-reset");
  if (btnResetGlobal && !btnResetGlobal.__bound) {
    btnResetGlobal.__bound = true;
    btnResetGlobal.addEventListener("click", async () => {
      if (!gameManager.isCreator) return;
      if (btnResetGlobal.__busy) return;

      const conferma = confirm(
        "Resetta la partita? Verranno cancellati indizi, mapping e parole sostituite. Giocatori invariati."
      );
      if (!conferma) return;

      try {
        btnResetGlobal.__busy = true;
        btnResetGlobal.disabled = true;
        btnResetGlobal.classList.add("working");
        await gameManager.resetGame();
      } finally {
        btnResetGlobal.__busy = false;
        btnResetGlobal.disabled = false;
        btnResetGlobal.classList.remove("working");
      }
    });
  }

  // Track last round to detect round changes
  let lastRound = gameManager.round;
  let lastPhase = { A: null, B: null };

  // GameManager onChange handler
  gameManager.onChange(() => {
    const myTeam = gameManager.myTeam;
    const myPhase = gameManager.teamPhases?.[myTeam];

    // Check for review_round phase -> switch to THEM view and populate panels
    if (myPhase === "review_round" && lastPhase[myTeam] !== "review_round") {
      lastPhase[myTeam] = "review_round";

      // Switch to THEM view to show opponent's clues
      switchView("them");

      // Force update of displays to populate THEM panels with opponent clues
      updateCluesDisplay();
      updateTGuessesDisplay();
    }

    // Check if both teams are in review_round -> enable next round button
    const bothInReview =
      gameManager.teamPhases?.A === "review_round" &&
      gameManager.teamPhases?.B === "review_round";

    if (bothInReview) {
      // Check if we just entered this state (at least one team wasn't in review before)
      const justEnteredReview =
        lastPhase.A !== "review_round" || lastPhase.B !== "review_round";

      if (justEnteredReview) {
        // Both teams are in review_round, enable the next round button
        enableNextRoundButton();

        // Update tracking for both teams
        lastPhase.A = "review_round";
        lastPhase.B = "review_round";
      }
    } else {
      // Reset lastPhase if not both in review
      if (gameManager.teamPhases?.A !== "review_round")
        lastPhase.A = gameManager.teamPhases?.A;
      if (gameManager.teamPhases?.B !== "review_round")
        lastPhase.B = gameManager.teamPhases?.B;
    }

    // Check for round change
    if (gameManager.round !== lastRound) {
      lastRound = gameManager.round;

      // Restore normal selectRound handlers on round switch buttons
      restoreRoundSwitchHandlers(selectRound);

      // Update selected round UI to match new game round (after handlers are restored)
      selectRound(gameManager.round);

      // Switch to US view for the new round and re-enable numeric validation
      switchView("us");

      // Clear all clue, guess, conf, tguess, and tconf inputs for the new round
      resetInputs([
        ".clue-input",
        ".guess-input",
        ".conf-input",
        ".tguess-input",
        ".guessthem-input",
        ".tconf-input",
        ".confthem-input",
      ]);

      // Update round buttons to reflect new round
      updateRoundButtons();
    }

    // Check for reset
    if (gameManager.resetAt && gameManager.resetAt !== lastResetAt) {
      lastResetAt = gameManager.resetAt;
      clearAllInputs();
    }

    // Phase transition -> show US only on first game start
    if (gameManager.phase === "clues" && !gameStarted) {
      switchView("us");
      gameStarted = true;
      syncRoomIdBadges();
    } else if (gameManager.phase === "clues") {
      syncRoomIdBadges();
      setupNumericValidation();
    }

    // Update UI components
    updateCodeButtonVisibility();
    hideCodesFromPlaceholders();
    updateClueInputs();
    updateCluesDisplay();
    updateGuessesDisplay();
    updateConfDisplay();
    updateTGuessesDisplay();
    updateTConfDisplay();
    updateCollaborativeTGuesses();
    updateCollaborativeGuessUs();
    updateTypingIndicators();
    updateActionBar();
    updateTeamDisplays();

    // Room lobby lists refresh if visible
    if (!views.room.classList.contains("hidden")) {
      updateRoomLobby();
    }

    // Room delegation for quick reassignment buttons
    const roomView = document.getElementById("view-room");
    if (roomView && !roomView.__moveBound) {
      roomView.addEventListener("click", (e) => {
        const btn = e.target.closest(".mini-move");
        if (!btn) return;
        const playerId = btn.getAttribute("data-player");
        const target = btn.getAttribute("data-move");
        if (playerId && target) {
          gameManager.reassignPlayer(playerId, target);
        }
      });
      roomView.__moveBound = true;
    }

    // Words always re-render
    renderWords();
    updateTeamTopBar();
    updateClueInputs();
    updateRoundButtons();
  });

  // Pre-load wordlist in idle
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(
      () => {
        try {
          loadWordList();
        } catch (_) {}
      },
      { timeout: 2000 }
    );
  } else {
    setTimeout(() => {
      try {
        loadWordList();
      } catch (_) {}
    }, 800);
  }

  // Clean up chat when leaving rooms
  gameManager.onChange(() => {
    if (lastRoomId && lastRoomId !== gameManager.roomId) {
      teamChat.cleanup();
    }
    lastRoomId = gameManager.roomId;
  });

  // On load show lobby
  show("lobby");

  // Initialize Firebase then team chat
  ensureFirebaseReady().then((ready) => {
    if (ready) {
      // Initialize team chat and opponent chat after Firebase is ready
      teamChat.init().catch(console.error);
      opponentChat.init().catch(console.error);
    }
  });
}

// Export for global access
window.initUI = initUI;

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

/**
 * UI Core - Main Coordinator
 * Imports and coordinates all phase modules
 */

import { STORAGE, TOTAL_ROUNDS, DEFAULT_LANGUAGE } from "./constants.js";
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

// Simple i18n support
const TRANSLATION_URL = "assets/i18n/translation_en_it.json";
const translationCache = {};
let currentLang = DEFAULT_LANGUAGE;
const defaultTexts = {
  "common.back": "Back",
  "landing.title": "Decrypto Multiplayer",
  "landing.tagline": "Realtime multiplayer word deduction • 8 rounds • 2 teams",
  "landing.namePlaceholder": "Your Name",
  "landing.languageLabel": "Language",
  "landing.play": "OK",
  "createJoin.title": "Multiplayer",
  "createJoin.playerLabel": "Player:",
  "createJoin.createRoom": "+ Create Room",
  "createJoin.joinRoom": "Join Room",
  "createJoin.note": "Create a new room or join an existing one.",
  "createJoin.exit": "Exit",
  "join.title": "Join Room",
  "join.codePlaceholder": "ABCD",
  "join.joinButton": "Join Room",
  "join.note": "Enter the room code to join.",
  "join.exit": "Exit",
  "room.title": "Room Lobby",
  "room.roomLabel": "Room:",
  "room.inviteLink": "Click here for the invite link",
  "room.teamA": "Team A",
  "room.teamB": "Team B",
  "room.joinA": "Join A",
  "room.joinB": "Join B",
  "room.startGame": "START GAME",
  "room.waitingPlayers": "Waiting for players... (2+ to start)",
  "room.copiedRoomId": "Copied!",
  "room.waiting": "Waiting",
  "buttons.submitClues": "Send",
  "buttons.submitGuess": "Send Guess",
  "buttons.submitConfUs": "Team Confirm",
  "buttons.submitConfThem": "Send",
  "buttons.submitTGuess": "Send Guess",
  "actions.clues_active": "{name}, Type your clues and send:",
  "actions.clues_passive": "{name} is providing clues",
  "actions.guess_us_active": "your teammates are guessing",
  "actions.guess_us_passive": "Guess the code",
  "actions.guess_us_them": "Waiting for teammates guesses",
  "actions.guess_them_active_us": "Guess opponents clues (or go to THEM page)",
  "actions.guess_them_passive_us": "Teammates are guessing opponents clues",
  "actions.guess_them_active_them": "Guess Team {team}'s words",
  "actions.guess_them_passive_them": "Teammates are guessing opponents clues",
  "actions.conf_us_active": "Confirm the code",
  "actions.conf_us_passive": "{name} is typing the right code...",
  "actions.conf_us_them": "Waiting for your code confirmation",
  "actions.conf_them": "Send your guesses to the opponent",
  "actions.review_round_us": "Round complete! Click next round to continue",
  "actions.review_round_them":
    "Round complete! Review opponent's clues, then click next round",
  "actions.waiting": "Waiting...",
};

function formatString(str, params = {}) {
  if (typeof str !== "string") return str;
  return Object.entries(params).reduce(
    (acc, [key, val]) => acc.replaceAll(`{${key}}`, val),
    str,
  );
}

async function loadTranslations(lang) {
  if (translationCache[lang] !== undefined) return translationCache[lang];
  if (!lang || !lang.startsWith("it")) {
    translationCache[lang] = null;
    return null;
  }
  const res = await fetch(TRANSLATION_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch translations (${res.status})`);
  const json = await res.json();
  translationCache[lang] = json;
  return json;
}

function translate(key, lang = currentLang) {
  const data = translationCache[lang];
  if (!data) return null;
  return key
    .split(".")
    .reduce(
      (acc, part) => (acc && acc[part] !== undefined ? acc[part] : null),
      data,
    );
}

function getText(key, lang = currentLang) {
  const translated = translate(key, lang);
  if (translated !== null && translated !== undefined) return translated;
  return defaultTexts[key] || null;
}

function applyTranslations(lang = currentLang) {
  currentLang = lang;
  const t = (key, fallback = null) => getText(key, lang) || fallback;

  const setText = (selector, key, fallback = null) => {
    const el = document.querySelector(selector);
    if (el && t(key) !== null) el.textContent = t(key, fallback);
  };

  const setPlaceholder = (selector, key) => {
    const el = document.querySelector(selector);
    if (el && t(key) !== null) el.placeholder = t(key);
  };

  setText(
    "#view-language .big-title",
    "landing.title",
    defaultTexts["landing.title"],
  );
  setText(
    "#view-lobby .big-title",
    "landing.title",
    defaultTexts["landing.title"],
  );
  setText(
    "#view-lobby .tagline",
    "landing.tagline",
    defaultTexts["landing.tagline"],
  );
  // keep intro play button glyph static to avoid initial flashes
  setText(
    "#btn-enter-createjoin",
    "landing.play",
    defaultTexts["landing.play"],
  );
  setPlaceholder("#lobby-player-name", "landing.namePlaceholder");
  setText("#btn-back-language", "common.back", defaultTexts["common.back"]);

  setText(
    "#view-createjoin h1",
    "createJoin.title",
    defaultTexts["createJoin.title"],
  );
  setText(
    "#btn-create-room",
    "createJoin.createRoom",
    defaultTexts["createJoin.createRoom"],
  );
  setText(
    "#btn-go-join",
    "createJoin.joinRoom",
    defaultTexts["createJoin.joinRoom"],
  );
  setText(
    "#view-createjoin .note",
    "createJoin.note",
    defaultTexts["createJoin.note"],
  );
  setText(
    "#view-createjoin [data-exit]",
    "createJoin.exit",
    defaultTexts["createJoin.exit"],
  );

  setText("#view-join h1", "join.title", defaultTexts["join.title"]);
  setPlaceholder("#join-code", "join.codePlaceholder");
  setText("#btn-join-room", "join.joinButton", defaultTexts["join.joinButton"]);
  setText("#view-join .note", "join.note", defaultTexts["join.note"]);
  setText("#view-join [data-exit]", "join.exit", defaultTexts["join.exit"]);

  setText("#view-room h1", "room.title", defaultTexts["room.title"]);
  setText(
    "#invite-link-copy",
    "room.inviteLink",
    defaultTexts["room.inviteLink"],
  );
  setText("#btn-join-a", "room.joinA", defaultTexts["room.joinA"]);
  setText("#btn-join-b", "room.joinB", defaultTexts["room.joinB"]);
  setText("#btn-start-game", "room.startGame", defaultTexts["room.startGame"]);
  setText(
    "#view-room .note",
    "room.waitingPlayers",
    defaultTexts["room.waitingPlayers"],
  );
  setText(
    "#room-id-copied",
    "room.copiedRoomId",
    defaultTexts["room.copiedRoomId"],
  );

  const roomHeader = document.querySelector(".room-header");
  const roomLabelText = t("room.roomLabel") || defaultTexts["room.roomLabel"];
  if (roomHeader && roomLabelText) {
    const firstText = Array.from(roomHeader.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE,
    );
    if (firstText) firstText.textContent = `${roomLabelText} `;
  }

  const teamATitle = document.querySelector("#view-room .team:nth-child(1) h2");
  const teamBTitle = document.querySelector("#view-room .team:nth-child(2) h2");
  if (teamATitle)
    teamATitle.textContent =
      t("room.teamA") || defaultTexts["room.teamA"] || teamATitle.textContent;
  if (teamBTitle)
    teamBTitle.textContent =
      t("room.teamB") || defaultTexts["room.teamB"] || teamBTitle.textContent;

  const waitingBox = document.getElementById("unassigned-box");
  if (waitingBox) {
    const h2 = waitingBox.querySelector("h2");
    const waitText = t("room.waiting") || defaultTexts["room.waiting"];
    if (h2 && waitText) h2.textContent = waitText;
  }

  const playerLabel = document.querySelector(".player-name-display");
  if (playerLabel) {
    const span = playerLabel.querySelector("span");
    const labelText =
      t("createJoin.playerLabel") || defaultTexts["createJoin.playerLabel"];
    playerLabel.textContent = labelText ? `${labelText} ` : "";
    if (span) playerLabel.appendChild(span);
  }

  // Action buttons (US/THEM)
  setText(
    "#btn-submit-clues",
    "buttons.submitClues",
    defaultTexts["buttons.submitClues"],
  );
  setText(
    "#btn-submit-guess",
    "buttons.submitGuess",
    defaultTexts["buttons.submitGuess"],
  );
  setText(
    "#btn-submit-conf-us",
    "buttons.submitConfUs",
    defaultTexts["buttons.submitConfUs"],
  );
  setText(
    "#btn-submit-conf-them",
    "buttons.submitConfThem",
    defaultTexts["buttons.submitConfThem"],
  );
  setText(
    "#btn-submit-tguess",
    "buttons.submitTGuess",
    defaultTexts["buttons.submitTGuess"],
  );
}

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
  language: document.getElementById("view-language"),
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

// Intro language picker wiring
function initLanguageIntro() {
  const introSelect = document.getElementById("sel-language-intro");
  const flagButtons = Array.from(document.querySelectorAll(".flag-btn"));
  const continueBtn = document.getElementById("btn-language-continue");
  const lobbySelect = document.getElementById("sel-language");
  const store = window.sessionStorage || window.localStorage;
  const allowed = ["it", "en"];

  const applyLang = async (lang) => {
    const safeLang = allowed.includes(lang) ? lang : DEFAULT_LANGUAGE;
    if (introSelect) introSelect.value = safeLang;
    if (lobbySelect) lobbySelect.value = safeLang;
    flagButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.lang === safeLang),
    );
    gameManager.language = safeLang;
    if (!gameManager.roomId) {
      gameManager.roomLanguage = safeLang;
    }
    store.setItem(STORAGE.lang, safeLang);
    try {
      await loadTranslations(safeLang);
    } catch (err) {
      console.warn("[i18n] Unable to load translations", err);
    }
    applyTranslations(safeLang);
  };

  // Default to Italian unless a room language is already set (e.g., joining a room)
  const initialLang = gameManager.roomLanguage || DEFAULT_LANGUAGE;
  applyLang(initialLang);

  introSelect?.addEventListener("change", (e) => {
    applyLang(e.target.value);
  });

  lobbySelect?.addEventListener("change", (e) => {
    applyLang(e.target.value);
  });

  flagButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });

  continueBtn?.addEventListener("click", () => {
    show("lobby");
    const nameInput = document.getElementById("lobby-player-name");
    if (nameInput) {
      requestAnimationFrame(() => {
        nameInput.focus();
        if (nameInput.select) nameInput.select();
      });
    }
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

  const selectedRound = getSelectedRound?.() || gameManager.round || 1;
  const teamPhase = gameManager.getRoundPhase(myTeam, selectedRound);
  const isActive = gameManager.isActivePlayer();
  const activeId = gameManager.getActivePlayer(myTeam, selectedRound);
  const activeName = activeId ? gameManager.players[activeId]?.name : "Someone";
  const otherTeam = myTeam === "A" ? "B" : "A";
  const roundKey = `round_${selectedRound}`;

  const myTGuesses =
    gameManager.tguessesData?.[roundKey]?.[`${myTeam}_about_${otherTeam}`];
  const hasMyTGuesses = Array.isArray(myTGuesses) && myTGuesses.length > 0;
  const allowSubmitGuessThem =
    (teamPhase === "guess_them" ||
      (teamPhase === "conf_them" && !hasMyTGuesses)) &&
    !hasMyTGuesses;

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
        ? formatString(
            translate("actions.clues_active", currentLang) ||
              `${me.name}, Type your clues and send:`,
            { name: me.name },
          )
        : formatString(
            translate("actions.clues_passive", currentLang) ||
              `${activeName} is providing clues`,
            { name: activeName },
          ),
      them: isActive
        ? formatString(
            translate("actions.clues_active", currentLang) ||
              `${me.name}, Type your clues and send:`,
            { name: me.name },
          )
        : formatString(
            translate("actions.clues_passive", currentLang) ||
              `${activeName} is providing clues`,
            { name: activeName },
          ),
      buttons: isActive ? [elements.btnSubmitClues] : [],
    },
    guess_us: {
      us: isActive
        ? translate("actions.guess_us_active", currentLang) ||
          "your teammates are guessing"
        : translate("actions.guess_us_passive", currentLang) ||
          "Guess the code",
      them:
        translate("actions.guess_us_them", currentLang) ||
        "Waiting for teammates guesses",
      buttons: !isActive ? [elements.btnSubmitGuess] : [],
    },
    conf_us: {
      us: isActive
        ? translate("actions.conf_us_active", currentLang) || "Confirm the code"
        : formatString(
            translate("actions.conf_us_passive", currentLang) ||
              `${activeName} is typing the right code...`,
            { name: activeName },
          ),
      them:
        translate("actions.conf_us_them", currentLang) ||
        "Waiting for your code confirmation",
      buttons: [elements.btnSubmitConfUs],
    },
    guess_them: {
      us: isActive
        ? translate("actions.guess_them_active_us", currentLang) ||
          "Guess opponents clues (or go to THEM page)"
        : translate("actions.guess_them_passive_us", currentLang) ||
          "Teammates are guessing opponents clues",
      them: isActive
        ? formatString(
            translate("actions.guess_them_active_them", currentLang) ||
              `Guess Team ${myTeam === "A" ? "B" : "A"}'s words`,
            { team: myTeam === "A" ? "B" : "A" },
          )
        : translate("actions.guess_them_passive_them", currentLang) ||
          "Teammates are guessing opponents clues",
      buttons: allowSubmitGuessThem ? [elements.btnSubmitTGuess] : [],
    },
    conf_them: {
      us:
        translate("actions.conf_them", currentLang) ||
        "Send your guesses to the opponent",
      them:
        translate("actions.conf_them", currentLang) ||
        "Send your guesses to the opponent",
      buttons: [elements.btnSubmitConfThem],
    },
    review_round: {
      us:
        translate("actions.review_round_us", currentLang) ||
        "Round complete! Click next round to continue",
      them:
        translate("actions.review_round_them", currentLang) ||
        "Round complete! Review opponent's clues, then click next round",
      buttons: [],
    },
  };

  const effectivePhase =
    teamPhase === "conf_them" && !hasMyTGuesses ? "guess_them" : teamPhase;

  const phase = actions[effectivePhase] || {
    us: translate("actions.waiting", currentLang) || "Waiting...",
    them: translate("actions.waiting", currentLang) || "Waiting...",
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

  // Debug visibility for conf_them button
  if (elements.btnSubmitConfThem) {
    console.log("[UI] conf_them button state", {
      selectedRound,
      teamPhase,
      display: elements.btnSubmitConfThem.style.display,
      disabled: elements.btnSubmitConfThem.disabled,
      classList: [...elements.btnSubmitConfThem.classList],
    });
  }

  // Keep conf buttons visibility in sync even if previous phases hid them
  // Use our submitted tguesses (myTeam_about_otherTeam) when gating conf_them
  const hasTGuesses = Array.isArray(myTGuesses) ? myTGuesses.length > 0 : false;

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
      const disabled = tconfSent || !hasTGuesses;
      elements.btnSubmitConfThem.disabled = disabled;
      elements.btnSubmitConfThem.classList.toggle("disabled-clue", disabled);
    }
  }

  // Control opponent-inputs-container visibility
  const opponentContainer = document.querySelector(
    ".opponent-inputs-container",
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
  initLanguageIntro();
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

  // Initialize code modal
  const { openCodes, closeCodes } = initCodeModal(getSelectedRound());
  bindCodeButtons(
    () => showCodesInPlaceholders(getSelectedRound()),
    hideCodesFromPlaceholders,
  );

  // Initialize logs modal
  initLogsModal();

  // Initialize round navigation
  initRoundNavigation((r) =>
    selectRound(r, () => renderCodesModal(getSelectedRound())),
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
          const lang = gameManager.roomLanguage || gameManager.language;
          await loadWordList(lang);
          const picked = pickUniqueWords(8);
          if (picked.length < 8) {
            // Fallback to legacy default list if language list was insufficient
            await loadWordList("ita");
            picked.splice(0, picked.length, ...pickUniqueWords(8));
          }
          const wordsA = picked.slice(0, 4);
          const wordsB = picked.slice(4, 8);
          gameManager.setWords("A", wordsA);
          gameManager.setWords("B", wordsB);
        } catch (error) {
          console.error("[UI-CORE] Error setting words:", error);
          if (
            (gameManager.roomLanguage || gameManager.language || "").startsWith(
              "en",
            )
          ) {
            alert(
              `Failed to load English word list. Returning to lobby.\n${error?.message || ""}`,
            );
            show("lobby");
          }
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
    }),
  );

  // Back to language picker
  const backLang = document.getElementById("btn-back-language");
  backLang?.addEventListener("click", () => show("language"));

  // Reset button
  const btnResetGlobal = document.getElementById("btn-reset");
  if (btnResetGlobal && !btnResetGlobal.__bound) {
    btnResetGlobal.__bound = true;
    btnResetGlobal.addEventListener("click", async () => {
      if (!gameManager.isCreator) return;
      if (btnResetGlobal.__busy) return;

      const conferma = confirm(
        "Resetta la partita? Verranno cancellati indizi, mapping e parole sostituite. Giocatori invariati.",
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

  // Pre-load wordlist in idle using room/host language
  const preloadLang = () => gameManager.roomLanguage || gameManager.language;
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(
      () => {
        try {
          loadWordList(preloadLang());
        } catch (_) {}
      },
      { timeout: 2000 },
    );
  } else {
    setTimeout(() => {
      try {
        loadWordList(preloadLang());
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
  show("language");

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

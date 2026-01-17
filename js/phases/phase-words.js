/**
 * Words Module
 * Handles word list loading, selection, and rendering
 */

import { gameManager } from "../GameManager.js";

// Word list cache keyed by language code ("ita" | "eng")
const WORD_LIST_CACHE = {};
let WORD_LIST = null;
let CURRENT_LANG = null;

function parseWordText(txt) {
  return txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("#") &&
        !/^<!?doctype/i.test(l) &&
        !/^<html/i.test(l) &&
        !l.includes("<")
    );
}

async function fetchWordlist(path) {
  const attempts = [];

  const tryFetch = async (urlLike) => {
    const res = await fetch(urlLike, {
      cache: "no-cache",
      mode: "same-origin",
    });
    if (!res.ok)
      throw new Error(
        `wordlist fetch failed (${res.status} ${res.statusText}): ${urlLike}`
      );
    const txt = await res.text();
    const parsed = parseWordText(txt);
    if (!parsed.length)
      throw new Error(`wordlist empty or invalid: ${urlLike}`);
    return parsed;
  };

  // Try relative path first
  try {
    return await tryFetch(path);
  } catch (e) {
    attempts.push(e.message);
  }

  // Then try absolute URL from origin
  try {
    const url = new URL(path, window.location.origin).toString();
    return await tryFetch(url);
  } catch (e2) {
    attempts.push(e2.message);
  }

  throw new Error(attempts.join(" | "));
}

/**
 * Load word list from wordlist.txt file
 */
export async function loadWordList(lang) {
  const selectedLang = (
    lang ||
    gameManager.roomLanguage ||
    gameManager.language ||
    "ita"
  ).toLowerCase();
  const langKey = selectedLang.startsWith("en") ? "eng" : "ita";
  if (WORD_LIST_CACHE[langKey]) {
    WORD_LIST = WORD_LIST_CACHE[langKey];
    CURRENT_LANG = langKey;
    return WORD_LIST;
  }

  try {
    const filename =
      langKey === "eng" ? "wordlist-eng.txt" : "wordlist-ita.txt";
    WORD_LIST = await fetchWordlist(filename);
    WORD_LIST_CACHE[langKey] = WORD_LIST;
    CURRENT_LANG = langKey;
  } catch (e) {
    console.warn("Failed to load wordlist", e);
    // If English was requested, do not fallback: bubble up so caller can handle (e.g., return to lobby)
    if (langKey === "eng") {
      throw e;
    }
    // Try fallback to opposite language, then legacy default
    try {
      const fallbackFile =
        langKey === "eng" ? "wordlist-ita.txt" : "wordlist-eng.txt";
      WORD_LIST = await fetchWordlist(fallbackFile);
      WORD_LIST_CACHE[langKey] = WORD_LIST;
      CURRENT_LANG = langKey;
    } catch (err) {
      console.warn("Fallback wordlist failed, trying legacy", err);
      try {
        WORD_LIST = await fetchWordlist("wordlist.txt");
        WORD_LIST_CACHE[langKey] = WORD_LIST;
        CURRENT_LANG = langKey;
      } catch (legacyErr) {
        console.warn("Legacy wordlist fallback failed", legacyErr);
        WORD_LIST = [];
        throw legacyErr;
      }
    }
  }

  return WORD_LIST;
}

/**
 * Pick n unique random words from the word list
 */
export function pickUniqueWords(n) {
  if (!WORD_LIST || WORD_LIST.length < n) return [];

  const indices = new Set();
  while (indices.size < n && indices.size < WORD_LIST.length) {
    indices.add(Math.floor(Math.random() * WORD_LIST.length));
  }

  return [...indices].slice(0, n).map((i) => WORD_LIST[i]);
}

/**
 * Render words in panel displays (both US and THEM views)
 */
export function renderWords() {
  const usPanels = document.querySelectorAll("#us-panels .panel-bottom");
  const themPanels = document.querySelectorAll("#them-panels .word-panel");
  const myTeam = gameManager.players[gameManager.playerId]?.team || "A";
  const myWords = gameManager.words?.[myTeam] || [];

  // Render in US view
  usPanels.forEach((panel, idx) => {
    const word = myWords[idx] || "—";
    panel.textContent = word;
  });

  // Render in THEM view
  const otherTeam = myTeam === "A" ? "B" : "A";
  const otherWords = gameManager.words?.[otherTeam] || [];

  themPanels.forEach((panel, idx) => {
    const word = otherWords[idx] || "—";
    panel.textContent = word;
  });
}

/**
 * Update team badge display
 */
function updateTeamBadge() {
  const el = document.getElementById("team-badge");
  const elThem = document.getElementById("team-badge-them");

  const myTeam = gameManager.players[gameManager.playerId]?.team || "A";
  const teamText = myTeam; // display single-letter team badge

  if (el) {
    el.textContent = teamText;
    el.classList.toggle("team-a", myTeam === "A");
    el.classList.toggle("team-b", myTeam === "B");
  }

  if (elThem) {
    elThem.textContent = teamText;
    elThem.classList.toggle("team-a", myTeam === "A");
    elThem.classList.toggle("team-b", myTeam === "B");
  }
}

/**
 * Update team top bar with player info and teammates
 * @param {number} [round] - Optional round number to display. If not provided, uses current round
 */
export function updateTeamTopBar(round) {
  updateTeamBadge();

  const me = gameManager.players[gameManager.playerId];
  const pill = document.getElementById("player-name-pill");
  const pillThem = document.getElementById("player-name-pill-them");
  const matesSpan = document.getElementById("team-mates");

  const activeId = me?.team ? gameManager.activePlayers?.[me.team] : null;
  const activePlayer = activeId ? gameManager.players[activeId] : null;
  const isActiveSelf = activeId && activeId === gameManager.playerId;
  const isHostSelf = gameManager.creatorId === gameManager.playerId;
  const selfName = me?.name ? (isHostSelf ? `(${me.name})` : me.name) : "";

  // Update player name pill (US page)
  if (pill) {
    pill.textContent = selfName;
    pill.classList.toggle("is-active", !!isActiveSelf);
    pill.classList.toggle("is-host", !!isHostSelf);

    pill.classList.remove("team-a", "team-b");
    if (me && me.team) {
      pill.classList.add(me.team === "A" ? "team-a" : "team-b");
    }
  }

  // Update player name pill (THEM page - identical to US)
  if (pillThem) {
    pillThem.textContent = selfName;
    pillThem.classList.toggle("is-active", !!isActiveSelf);
    pillThem.classList.toggle("is-host", !!isHostSelf);

    pillThem.classList.remove("team-a", "team-b");
    if (me && me.team) {
      pillThem.classList.add(me.team === "A" ? "team-a" : "team-b");
    }
  }

  // Show/hide reset button (only in US view and if host)
  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    const usView = document.getElementById("view-us");
    const inUs = usView && !usView.classList.contains("hidden");
    btnReset.classList.toggle("hidden", !(inUs && gameManager.isCreator));
  }

  // Update teammates list
  if (matesSpan) {
    if (me && me.team) {
      const ids = gameManager.teams[me.team] || [];

      const mates = ids
        .filter((id) => id !== gameManager.playerId)
        .map((id) => {
          const name = gameManager.players[id]?.name;
          if (!name) return null;
          const isActiveMate = activeId && id === activeId;
          return `<span class="mate-name${isActiveMate ? " active" : ""}">${name}</span>`;
        })
        .filter(Boolean);

      matesSpan.innerHTML = mates.length ? mates.join(", ") : "—";
    } else {
      matesSpan.textContent = "";
    }
  }

  // Update teammates list on THEM page (identical to US)
  const matesSpanThem = document.getElementById("team-mates-them");
  if (matesSpanThem) {
    if (me && me.team) {
      const ids = gameManager.teams[me.team] || [];

      const mates = ids
        .filter((id) => id !== gameManager.playerId)
        .map((id) => {
          const name = gameManager.players[id]?.name;
          if (!name) return null;
          const isActiveMate = activeId && id === activeId;
          return `<span class="mate-name${isActiveMate ? " active" : ""}">${name}</span>`;
        })
        .filter(Boolean);

      matesSpanThem.innerHTML = mates.length ? mates.join(", ") : "—";
    } else {
      matesSpanThem.textContent = "";
    }
  }

  // Hide end turn button (turns last entire round)
  const btnEnd = document.getElementById("btn-end-turn");
  if (btnEnd) {
    btnEnd.classList.add("hidden");
  }

  // Update round indicator - use provided round or current round
  const roundIndicator = document.getElementById("round-indicator");
  const roundIndicatorThem = document.getElementById("round-indicator-them");
  const displayRound = round !== undefined ? round : gameManager.round || 1;

  if (roundIndicator) {
    roundIndicator.textContent = `Round ${displayRound}`;
  }

  if (roundIndicatorThem) {
    roundIndicatorThem.textContent = `Round ${displayRound}`;
  }
}

/**
 * Update team displays in both US and THEM views
 */
export function updateTeamDisplays() {
  const me = gameManager.players[gameManager.playerId];
  const myTeam = me?.team;
  if (!myTeam) return;

  const isActive = gameManager.activePlayers?.[myTeam] === gameManager.playerId;

  // Update team-mates in us view
  const teamMatesUs = document.getElementById("team-mates");
  if (teamMatesUs) {
    const mates = gameManager.teams[myTeam]
      .filter((pid) => pid !== gameManager.playerId)
      .map((pid) => gameManager.players[pid]?.name || "—")
      .join(", ");
    teamMatesUs.textContent = mates || "—";
  }

  // Update team-mates in them view
  const teamMatesThem = document.getElementById("team-mates-them");
  if (teamMatesThem) {
    const mates = gameManager.teams[myTeam]
      .filter((pid) => pid !== gameManager.playerId)
      .map((pid) => gameManager.players[pid]?.name || "—")
      .join(", ");
    teamMatesThem.textContent = mates || "—";
  }

  // Update team badge
  const teamBadge = document.getElementById("team-badge");
  if (teamBadge) {
    teamBadge.textContent = myTeam;
    teamBadge.className = `team-badge team-${myTeam.toLowerCase()}`;
  }

  const teamBadgeThem = document.getElementById("team-badge-them");
  if (teamBadgeThem) {
    teamBadgeThem.textContent = myTeam;
    teamBadgeThem.className = `team-badge team-${myTeam.toLowerCase()}`;
  }

  // Update player name pill
  const playerNamePill = document.getElementById("player-name-pill");
  if (playerNamePill) {
    playerNamePill.textContent = me.name;
    playerNamePill.classList.toggle("is-active", isActive);
  }

  const playerNamePillThem = document.getElementById("player-name-pill-them");
  if (playerNamePillThem) {
    playerNamePillThem.textContent = me.name;
    playerNamePillThem.classList.toggle("is-active", isActive);
  }

  // Apply is-host class to US layout container
  const usLayout = document.getElementById("view-us");
  if (usLayout) {
    const isHost = gameManager.isCreator;
    usLayout.classList.toggle("is-host", isHost);
    usLayout.classList.toggle("is-active", isActive);
  }

  // Update phase status
  updatePhaseStatus();
}

/**
 * Update phase status display
 */
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

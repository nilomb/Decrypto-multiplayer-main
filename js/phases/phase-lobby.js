/**
 * Lobby Phase Module
 * Handles player name entry, room creation/joining, team assignment
 */

import { STORAGE, DEFAULT_LANGUAGE } from "../constants.js";
import { gameManager } from "../GameManager.js";
import { getDb } from "../firebase-init.js";

export function initLobbyPhase(show, updateRoomLobby, updateGuessInputs) {
  const joinCodeInput = document.getElementById("join-code");
  const btnJoinRoom = document.getElementById("btn-join-room");

  const rawInvite =
    new URL(window.location.href).searchParams.get("room") || "";
  const inviteCode = rawInvite.toUpperCase().trim();
  const hasInviteCode = /^[A-Z]{4}$/.test(inviteCode);

  const prefillInviteCode = () => {
    if (hasInviteCode && joinCodeInput) {
      joinCodeInput.value = inviteCode;
    }
  };

  const autoJoinFromInvite = () => {
    if (!hasInviteCode) return false;
    prefillInviteCode();
    btnJoinRoom?.click();
    return true;
  };

  // Lobby: Player name entry
  const playBtn = document.getElementById("btn-enter-createjoin");
  const lobbyNameInput = document.getElementById("lobby-player-name");

  playBtn?.addEventListener("click", () => {
    const rawName = (lobbyNameInput?.value || "").trim();
    if (!rawName) {
      alert("Inserisci un nome prima di continuare.");
      lobbyNameInput?.focus();
      return;
    }
    gameManager.setName(rawName);
    const cjLabel = document.getElementById("player-name-label");
    if (cjLabel) cjLabel.textContent = gameManager.playerName;

    if (hasInviteCode) {
      document.getElementById("join-player-label").textContent =
        "Player: " + gameManager.playerName;
      show("join");
      autoJoinFromInvite();
      return;
    }

    show("createjoin");
  });

  // Language selection
  const selLang = document.getElementById("sel-language");
  if (selLang) {
    const store = window.sessionStorage || window.localStorage;
    const allowed = ["it", "en"];
    const initial = gameManager.roomLanguage || DEFAULT_LANGUAGE;
    selLang.value = initial;
    gameManager.language = initial;
    store.setItem(STORAGE.lang, initial);
    selLang.addEventListener("change", (e) => {
      const val = e.target.value;
      store.setItem(STORAGE.lang, val);
      gameManager.language = val;
      // If host hasn't created room yet, prep room language
      if (!gameManager.roomId) {
        gameManager.roomLanguage = val;
      } else if (gameManager.isCreator && gameManager.phase === "lobby") {
        gameManager.roomLanguage = val;
        const db = getDb();
        if (db && gameManager.roomId) {
          db.ref(`rooms/${gameManager.roomId}/language`).set(val);
        }
      }
    });
  }

  // Player name label
  const nameLabel = document.getElementById("player-name-label");
  if (nameLabel) {
    const store = window.sessionStorage || window.localStorage;
    const nm = store.getItem(STORAGE.name) || gameManager.playerName || "";
    if (nm) nameLabel.textContent = nm;
  }

  // Validate player name
  const validatePlayerName = () => {
    const name = gameManager.playerName;
    if (!name) {
      alert("Missing player name (go back)");
      return false;
    }
    return true;
  };

  // Create room
  const btnCreate = document.getElementById("btn-create-room");
  btnCreate?.addEventListener("click", () => {
    if (!validatePlayerName()) return;
    const code = gameManager.createRoom();
    updateRoomLobby();
    show("room");
  });

  // Go to join screen
  const btnGoJoin = document.getElementById("btn-go-join");
  btnGoJoin?.addEventListener("click", () => {
    if (!validatePlayerName()) return;
    document.getElementById("join-player-label").textContent =
      "Player: " + gameManager.playerName;
    prefillInviteCode();
    show("join");
  });

  // Join room
  btnJoinRoom?.addEventListener("click", () => {
    const code = (joinCodeInput.value || "").toUpperCase().trim();
    if (!/^[A-Z]{4}$/.test(code)) {
      alert("Room Code must be 4 letters (A-Z).");
      return;
    }

    const prevRoom = gameManager.roomId;
    gameManager.joinRoom(code);

    setTimeout(() => {
      if (gameManager.roomId === code) {
        show("room");
      } else {
        show("join");
      }
    }, 50);

    // Prefetch room data
    const db = getDb();
    if (db) {
      const playersRef = db.ref(`rooms/${code}/players`);
      const teamsRef = db.ref(`rooms/${code}/teams`);
      const creatorRef = db.ref(`rooms/${code}/creatorId`);

      playersRef.once("value", (ps) => {
        const val = ps.val();
        if (val) {
          gameManager.players = val;
          if (!gameManager.creatorId) {
            creatorRef.once("value", (cSnap) => {
              const cid = cSnap.val();
              if (cid) gameManager.creatorId = cid;
              else gameManager.creatorId = Object.keys(val)[0] || null;
            });
          }
        }

        teamsRef.once("value", (ts) => {
          const tv = ts.val();
          if (tv) {
            gameManager.teams.A = tv.A || [];
            gameManager.teams.B = tv.B || [];
          } else if (val) {
            const A = [];
            const B = [];
            Object.entries(val).forEach(([pid, info]) => {
              if (info && info.team === "B") B.push(pid);
              else A.push(pid);
            });
            gameManager.teams.A = A;
            gameManager.teams.B = B;
          }
          updateRoomLobby();
        });
      });

      // Listener for guesses
      const guessesRef = db.ref(`rooms/${code}/guesses`);
      guessesRef.on("value", (snap) => {
        gameManager.guessesData = snap.val() || {};
        updateGuessInputs();
      });
    } else {
      updateRoomLobby();
    }
  });

  if (hasInviteCode) {
    prefillInviteCode();
  }

  // Team selection buttons
  const btnJoinA = document.getElementById("btn-join-a");
  const btnJoinB = document.getElementById("btn-join-b");

  btnJoinA?.addEventListener("click", () => {
    if (gameManager.phase !== "lobby") return;
    gameManager.moveToTeam("A");
    updateRoomLobby();
  });

  btnJoinB?.addEventListener("click", () => {
    if (gameManager.phase !== "lobby") return;
    gameManager.moveToTeam("B");
    updateRoomLobby();
  });

  // Host move player buttons (event delegation for dynamic buttons)
  document.body.addEventListener("click", (e) => {
    const moveBtn = e.target.closest(".mini-move");
    if (moveBtn) {
      const playerId = moveBtn.getAttribute("data-pid");
      const targetTeam = moveBtn.getAttribute("data-to");

      if (!playerId || !targetTeam) return;
      if (!gameManager.isCreator) return; // Only host can move players
      if (gameManager.phase !== "lobby") return;

      // Move player to target team using existing method
      gameManager.reassignPlayer(playerId, targetTeam);
      updateRoomLobby();
      return;
    }

    const kickBtn = e.target.closest(".mini-kick");
    if (!kickBtn) return;

    const playerId = kickBtn.getAttribute("data-pid");
    const playerName = kickBtn.getAttribute("data-name") || "this player";

    if (!playerId) return;
    if (!gameManager.isCreator) return; // Only host can kick
    if (gameManager.phase !== "lobby") return;
    if (playerId === gameManager.creatorId) return; // cannot kick host

    const confirmed = confirm(`Remove ${playerName} from the lobby?`);
    if (!confirmed) return;

    gameManager.kickPlayer(playerId);
    updateRoomLobby();
  });
}

export function updateRoomLobby() {
  // Update room code display
  const roomIdLabel = document.getElementById("room-id-label");
  if (roomIdLabel && gameManager.roomId) {
    roomIdLabel.textContent = gameManager.roomId.split("").join(" ");
  }

  const aList = document.getElementById("team-a-list");
  const bList = document.getElementById("team-b-list");
  const unassignedList = document.getElementById("unassigned-list");
  const unassignedBox = document.getElementById("unassigned-box");

  const unassigned = Object.entries(gameManager.players)
    .filter(([pid, p]) => !p.team && pid !== gameManager.creatorId)
    .map(([pid, p]) => ({ pid, name: p.name }));

  if (unassignedList) {
    unassignedList.innerHTML = unassigned
      .map(({ pid, name }) => {
        const isSelf = pid === gameManager.playerId;
        const isHost = pid === gameManager.creatorId;
        const kickBtn = gameManager.isCreator
          ? `<button class="mini-kick" data-pid="${pid}" data-name="${name}">Kick</button>`
          : "";
        return `<li class="${isSelf ? "self" : ""} ${
          isHost ? "creator" : ""
        }">${name}${isHost ? " (Host)" : ""} ${kickBtn}</li>`;
      })
      .join("");
  }

  if (unassignedBox) {
    unassignedBox.classList.toggle("hidden", unassigned.length === 0);
  }

  aList.innerHTML = gameManager.teams.A.map((pid) => {
    const p = gameManager.players[pid];
    if (!p) return "";
    const isSelf = pid === gameManager.playerId;
    const isHost = pid === gameManager.creatorId;
    const moveBtn = gameManager.isCreator
      ? `<button class="mini-move" data-pid="${pid}" data-to="B">→B</button>`
      : "";
    const kickBtn =
      gameManager.isCreator && pid !== gameManager.creatorId
        ? `<button class="mini-kick" data-pid="${pid}" data-name="${p.name}">Kick</button>`
        : "";
    return `<li class="${isSelf ? "self" : ""} ${isHost ? "creator" : ""}">${
      p.name
    }${isHost ? " (Host)" : ""} ${moveBtn} ${kickBtn}</li>`;
  }).join("");

  bList.innerHTML = gameManager.teams.B.map((pid) => {
    const p = gameManager.players[pid];
    if (!p) return "";
    const isSelf = pid === gameManager.playerId;
    const isHost = pid === gameManager.creatorId;
    const moveBtn = gameManager.isCreator
      ? `<button class="mini-move" data-pid="${pid}" data-to="A">→A</button>`
      : "";
    const kickBtn =
      gameManager.isCreator && pid !== gameManager.creatorId
        ? `<button class="mini-kick" data-pid="${pid}" data-name="${p.name}">Kick</button>`
        : "";
    return `<li class="${isSelf ? "self" : ""} ${isHost ? "creator" : ""}">${
      p.name
    }${isHost ? " (Host)" : ""} ${moveBtn} ${kickBtn}</li>`;
  }).join("");

  // Start button: show only for host, enable when 2+ players
  const btnStart = document.getElementById("btn-start-game");
  if (btnStart) {
    const totalPlayers =
      gameManager.teams.A.length + gameManager.teams.B.length;
    if (gameManager.isCreator) {
      btnStart.classList.remove("hidden");
      btnStart.disabled = totalPlayers < 2;
    } else {
      btnStart.classList.add("hidden");
    }
  }
}

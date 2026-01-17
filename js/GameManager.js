/**
 * GameManager - Core game state and Firebase synchronization
 * Manages room lifecycle, player data, team assignments, rounds, and game phases.
 * All game state changes flow through this singleton instance.
 */

import {
  STORAGE,
  generateRoomCode,
  ensurePlayerId,
  TOTAL_ROUNDS,
  DEFAULT_LANGUAGE,
} from "./constants.js";
import { getDb } from "./firebase-init.js";

class GameManager {
  constructor() {
    // Nota: usiamo sessionStorage per isolare le istanze per tab/finestra.
    // Così due finestre dello stesso browser possono avere playerName/roomId diversi.
    this.playerId = ensurePlayerId();
    const store = window.sessionStorage || window.localStorage;
    this.playerName = store.getItem(STORAGE.name) || "";
    this.language = store.getItem(STORAGE.lang) || DEFAULT_LANGUAGE; // user preference
    this.roomLanguage = null; // authoritative language set by host for the room
    this.roomId = store.getItem(STORAGE.room) || null;
    this.players = {}; // {playerId:{name,team}}
    this.teams = { A: [], B: [] };
    this.isCreator = false;
    this.creatorId = null;
    this.words = { A: [], B: [] }; // 4 per team
    this.hints = {}; // { round: [ {id,text,by} ] } per opponent view (semplificato)
    this.codes = { A: {}, B: {} }; // { round_1: "code", round_2: "code", ... } - un codice casuale per round
    this.cluesData = {}; // { round: { team: { clues: [], mapping: [] } } }
    this.guessesData = {}; // { round: { team: [] } }
    this.tguessesData = {}; // { round: { teamA_about_teamB: [] } }
    this.collabTGuessesData = {}; // { round: { teamA_about_teamB: { values: [], lastUpdated, updatedBy } } }
    this.collabGuessUsData = {}; // { round: { teamA: { values: [], lastUpdated, updatedBy } } }
    this.typingIndicators = {}; // { round: { teamA_about_teamB: { playerId: { isTyping, timestamp } } } }
    this.confData = {}; // { round: { team: [] } }
    this.clueLogs = {}; // { round: { team: { playerName, playerId, clues, timestamp } } }
    // Turni (implementazione minimale): un active per team, ruota solo su richiesta esplicita
    this.activePlayers = { A: null, B: null };
    this.round = 1; // round selezionato nel client (non vincolato all'altra squadra)
    this.roundPhases = this._defaultRoundPhases(); // mappa per-round: { A: {round_1:"clues"}, B:{round_1:"clues"} }
    this.unlockedRounds = this._defaultUnlockedRounds(); // { A:1, B:1 } abilita round selezionabili per team
    this.phase = "lobby";
    this.teamPhases = { A: "lobby", B: "lobby" }; // alias per la fase del round selezionato
    this.resetAt = null; // timestamp ultimo reset
    this._listeners = [];
    this._subscribers = new Set();
    this._startGameInProgress = false; // Blocca chiamate multiple a startGame()
    this._userSelectedRound = false;
  }

  setName(name) {
    this.playerName = name.trim();
    const store = window.sessionStorage || window.localStorage;
    store.setItem(STORAGE.name, this.playerName);
  }

  createRoom(customCode) {
    this.roomId =
      (customCode && /^[A-Z]{4}$/.test(customCode) && customCode) ||
      generateRoomCode();
    const store = window.sessionStorage || window.localStorage;
    store.setItem(STORAGE.room, this.roomId);
    // Host's language becomes authoritative for the room
    this.roomLanguage = this.language || DEFAULT_LANGUAGE;
    this.isCreator = true;
    this.creatorId = this.playerId;
    // Host assegnato direttamente a Team A
    this.players[this.playerId] = { name: this.playerName, team: "A" };
    this.teams.A = [this.playerId];
    this.teams.B = [];
    this._writeInitialRoom();
    this._attachRoomListeners();
    return this.roomId;
  }

  joinRoom(code) {
    this.roomId = code;
    const store = window.sessionStorage || window.localStorage;
    store.setItem(STORAGE.room, code);
    const db = getDb();
    if (db) {
      // Prima leggi i dati della stanza per determinare: creatorId, nomi occupati, eventuale team precedente.
      db.ref(`rooms/${this.roomId}`).once("value", (snap) => {
        const room = snap.val();
        if (!room) return; // stanza non esistente
        // Adopt host language if available
        if (room.language) {
          this.roomLanguage = room.language;
          this.language = room.language;
          store.setItem(STORAGE.lang, room.language);
        }
        const existingPlayers = room.players || {};
        const phase = room.state?.phase || "lobby";
        const gameStarted = phase !== "lobby";
        if (gameStarted) {
          if (!existingPlayers[this.playerId]) {
            // Tentativo di nuovo device / nuova tab: se il nome coincide con un player esistente permetti rejoin adottando il suo playerId
            const targetName = (this.playerName || "").toLowerCase();
            const matched = Object.entries(existingPlayers).find(
              ([pid, p]) => (p.name || "").toLowerCase() === targetName
            );
            if (matched) {
              const [adoptPid] = matched;
              // Adotta l'ID esistente in modo che i listener continuino a funzionare come rejoin
              this.playerId = adoptPid;
              store.setItem(STORAGE.playerId, adoptPid);
              if (adoptPid === room.creatorId) this.isCreator = true;
              // NON creare nuovi nodi: proceed
            } else {
              this.roomId = null;
              store.removeItem(STORAGE.room);
              try {
                alert(
                  "La partita è già iniziata: non è possibile entrare con un nome nuovo."
                );
              } catch (e) {}
              return;
            }
          }
        }
        this.creatorId = room.creatorId || null;
        // Se il nostro playerId coincide col creatorId allora siamo di nuovo il creatore (rejoin dopo refresh)
        if (this.creatorId === this.playerId) {
          this.isCreator = true;
        }
        // Enforce unicità nome: se il nome esiste ma appartiene a noi (stesso playerId) ok; se appartiene ad altro id, generiamo variante.
        if (this.playerName) {
          const lowerTarget = this.playerName.toLowerCase();
          // Cerca player esistente con stesso nome (case-insensitive)
          const sameNameEntry = Object.entries(existingPlayers).find(
            ([pid, p]) => (p.name || "").toLowerCase() === lowerTarget
          );
          if (sameNameEntry) {
            const [existingPid, existingData] = sameNameEntry;
            if (existingPid !== this.playerId) {
              // Adotta l'ID esistente invece di rinominare (rejoin)
              this.playerId = existingPid;
              store.setItem(STORAGE.playerId, existingPid);
              if (existingPid === this.creatorId) this.isCreator = true;
            }
            // Mantieni nome identico (nessun (2))
            this.playerName = existingData.name;
            store.setItem(STORAGE.name, this.playerName);
          } else {
            // Nessun duplicato -> lascia tutto com'è (nessun rename automatico con suffisso)
          }
        }
        // Recupera team precedente (solo se già esistente e non null)
        const rejoinRecord = existingPlayers[this.playerId];
        const isRejoin = !!rejoinRecord;
        let team =
          rejoinRecord?.team ?? existingPlayers[this.playerId]?.team ?? null;
        if (isRejoin) {
          // Se l'utente ha digitato un nome diverso da quello registrato, avvisa e mantieni quello registrato
          const entered = (this.playerName || "").trim();
          const remoteName = rejoinRecord.name || "";
          if (
            entered &&
            remoteName &&
            entered.toLowerCase() !== remoteName.toLowerCase()
          ) {
            try {
              alert(
                `Sei già in partita come "${remoteName}". Il nome inserito "${entered}" è stato ignorato.`
              );
            } catch (e) {}
          }
          // NON sovrascrivere il nome: mantieni quello salvato nel DB ignorando quello digitato dopo refresh
          this.playerName = rejoinRecord.name;
          store.setItem(STORAGE.name, this.playerName);
          this.players[this.playerId] = { name: this.playerName, team };
          // Non riscrivere il nodo player (evita rename accidentale)
        } else {
          // Nuovo player (fase lobby): crea nodo con nome richiesto
          this.players[this.playerId] = { name: this.playerName, team };
          db.ref(`rooms/${this.roomId}/players/${this.playerId}`).set({
            name: this.playerName,
            team,
          });
        }
        // NON inserire in teams finché non sceglie
        this._attachRoomListeners();
        // Seconda guardia post-listener per eventuale race (fase cambiata nel frattempo)
        setTimeout(() => {
          if (this.phase !== "lobby") {
            const stillThere = !!this.players[this.playerId];
            if (!stillThere) {
              // Player non ammesso: cleanup
              const r = this.roomId;
              this.roomId = null;
              store.removeItem(STORAGE.room);
              try {
                alert("Partita già avviata: accesso nuovo nome bloccato.");
              } catch (e) {}
              console.warn(
                "[JOIN-BLOCK] late join prevented for new name into",
                r
              );
            }
          }
        }, 250);
      });
    }
  }

  moveToTeam(team) {
    if (!["A", "B"].includes(team)) return;
    // remove from old
    ["A", "B"].forEach((t) => {
      this.teams[t] = this.teams[t].filter((id) => id !== this.playerId);
    });
    if (!this.players[this.playerId]) {
      this.players[this.playerId] = { name: this.playerName, team: team };
    } else {
      this.players[this.playerId].team = team;
    }
    if (!this.teams[team].includes(this.playerId)) {
      this.teams[team].push(this.playerId);
    }
    const db = getDb();
    if (db && this.roomId) {
      db.ref(`rooms/${this.roomId}/players/${this.playerId}/team`).set(team);
      // Scrive set completo; l'ordine manterrà l'esistente più il player spostato in coda.
      db.ref(`rooms/${this.roomId}/teams`).set({
        A: this.teams.A,
        B: this.teams.B,
      });
    }
  }

  reassignPlayer(playerId, team) {
    if (!this.isCreator) return; // solo host
    if (this.phase !== "lobby") return; // non dopo start
    if (!["A", "B"].includes(team)) return;
    // (Opzionale) Mantieni host sempre in A
    if (playerId === this.creatorId && team !== "A") return;
    const db = getDb();
    // Rimuovi da liste attuali
    ["A", "B"].forEach((t) => {
      this.teams[t] = this.teams[t].filter((id) => id !== playerId);
    });
    if (!this.teams[team].includes(playerId)) this.teams[team].push(playerId);
    if (!this.players[playerId]) return; // sicurezza
    this.players[playerId].team = team;
    if (db && this.roomId) {
      db.ref(`rooms/${this.roomId}/players/${playerId}/team`).set(team);
      db.ref(`rooms/${this.roomId}/teams`).set({
        A: this.teams.A,
        B: this.teams.B,
      });
    }
    this._emit();
  }

  kickPlayer(playerId) {
    if (!this.isCreator) return false;
    if (this.phase !== "lobby") return false;
    if (!playerId || playerId === this.creatorId) return false;
    if (!this.roomId) return false;

    // Remove from local state
    ["A", "B"].forEach((t) => {
      this.teams[t] = this.teams[t].filter((id) => id !== playerId);
    });
    delete this.players[playerId];

    const db = getDb();
    if (db) {
      db.ref(`rooms/${this.roomId}/players/${playerId}`).remove();
      db.ref(`rooms/${this.roomId}/teams`).set({
        A: this.teams.A,
        B: this.teams.B,
      });
    }

    this._emit();
    return true;
  }

  getTeamList(team) {
    return this.teams[team].map((id) => this.players[id]?.name || "—");
  }

  getMyTeam() {
    if (!this.playerId) {
      return null;
    }
    if (this.teams.A.includes(this.playerId)) {
      return "A";
    }
    if (this.teams.B.includes(this.playerId)) {
      return "B";
    }
    return null;
  }

  getActivePlayer(team, round = this.round || 1) {
    if (!team || !["A", "B"].includes(team)) return null;
    const list = this.teams[team] || [];
    if (!list.length) return null;
    const idx = (Math.max(1, round) - 1) % list.length;
    return list[idx] || null;
  }

  _defaultRoundPhases() {
    const base = {};
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
      base[`round_${r}`] = "clues";
    }
    return { A: { ...base }, B: { ...base } };
  }

  _defaultUnlockedRounds() {
    return { A: 1, B: 1 };
  }

  _normalizeRoundPhases(raw) {
    const fallback = this._defaultRoundPhases();
    if (!raw || typeof raw !== "object") return fallback;
    ["A", "B"].forEach((team) => {
      fallback[team] = { ...fallback[team], ...(raw[team] || {}) };
    });
    return fallback;
  }

  _normalizeUnlockedRounds(raw) {
    const fallback = this._defaultUnlockedRounds();
    if (!raw || typeof raw !== "object") return fallback;
    return {
      A: Number.isFinite(raw.A)
        ? Math.min(Math.max(1, raw.A), TOTAL_ROUNDS)
        : 1,
      B: Number.isFinite(raw.B)
        ? Math.min(Math.max(1, raw.B), TOTAL_ROUNDS)
        : 1,
    };
  }

  getRoundPhase(team, round) {
    if (!team || !Number.isFinite(round)) return "clues";
    const key = `round_${round}`;
    return this.roundPhases?.[team]?.[key] || "clues";
  }

  getUnlockedRound(team) {
    if (!team || !["A", "B"].includes(team)) return 1;
    return this.unlockedRounds?.[team] || 1;
  }

  _syncTeamPhaseAlias(selectedRound = this.round || 1) {
    this.teamPhases = {
      A: this.getRoundPhase("A", selectedRound),
      B: this.getRoundPhase("B", selectedRound),
    };
    this._updateActivePlayersForRound(selectedRound);
  }

  setSelectedRound(round) {
    if (!Number.isFinite(round)) return;
    if (round < 1 || round > TOTAL_ROUNDS) return;
    this._userSelectedRound = true;
    const myTeam = this.getMyTeam();
    const maxRound = this.getUnlockedRound(myTeam || "A");
    if (round > maxRound) return;
    this.round = round;
    this._syncTeamPhaseAlias(round);
    this._emit();
  }

  _updateActivePlayersForRound(round = this.round || 1) {
    const next = {
      A: this.getActivePlayer("A", round),
      B: this.getActivePlayer("B", round),
    };
    const changed =
      this.activePlayers.A !== next.A || this.activePlayers.B !== next.B;
    this.activePlayers = next;
    if (changed) {
      const db = getDb();
      if (db && this.roomId) {
        db.ref(`rooms/${this.roomId}/state/activePlayers`).set(next);
      }
    }
  }

  _setRoundPhase(team, round, phase) {
    if (!team || !["A", "B"].includes(team)) return;
    if (!phase) return;
    if (!Number.isFinite(round) || round < 1 || round > TOTAL_ROUNDS) return;
    const key = `round_${round}`;
    this.roundPhases[team] = this.roundPhases[team] || {};
    this.roundPhases[team][key] = phase;

    if (round === this.round) {
      this.teamPhases[team] = phase;
    }

    const db = getDb();
    if (db && this.roomId) {
      db.ref(`rooms/${this.roomId}/state/roundPhases/${team}/${key}`).set(
        phase
      );
      db.ref(`rooms/${this.roomId}/state/teamPhases/${team}`).set(
        this.teamPhases[team]
      );
    }
  }

  _unlockNextRound(team, currentRound) {
    if (!team || !["A", "B"].includes(team)) return;
    const nextRound = currentRound + 1;
    if (nextRound > TOTAL_ROUNDS) return;
    const currentUnlocked = this.getUnlockedRound(team);
    if (nextRound <= currentUnlocked) return;
    this.unlockedRounds[team] = nextRound;
    const db = getDb();
    if (db && this.roomId) {
      db.ref(`rooms/${this.roomId}/state/unlockedRounds/${team}`).set(
        nextRound
      );
    }
    // Se questo client è del team, passa automaticamente al prossimo round
    if (this.getMyTeam() === team) {
      this.setSelectedRound(nextRound);
    }
  }

  // Getter for easier access
  get myTeam() {
    return this.getMyTeam();
  }

  isActivePlayer() {
    const myTeam = this.getMyTeam();
    if (!myTeam) return false;
    return this.getActivePlayer(myTeam, this.round) === this.playerId;
  }

  getNextActivePlayer(team) {
    if (!team || !["A", "B"].includes(team)) return null;
    const teamPlayers = this.teams[team] || [];
    if (teamPlayers.length === 0) return null;
    const currentActive = this.getActivePlayer(team, this.round);
    const currentIndex = teamPlayers.indexOf(currentActive);
    const nextIndex = (currentIndex + 1) % teamPlayers.length;
    return teamPlayers[nextIndex];
  }

  getMyTeamWords() {
    const myTeam = this.getMyTeam();
    if (!myTeam) return [];
    return this.words[myTeam] || [];
  }

  getMyTeamCodes() {
    const myTeam = this.getMyTeam();
    if (!myTeam) return [];

    // Converti l'oggetto { round_1: "code", round_2: "code" } in array
    const codesObj = this.codes[myTeam] || {};
    const codesArray = [];
    for (let r = 1; r <= TOTAL_ROUNDS; r++) {
      const key = `round_${r}`;
      codesArray.push(codesObj[key] || "");
    }
    return codesArray;
  }

  onChange(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }
  _emit() {
    this._subscribers.forEach((fn) => {
      try {
        fn(this);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  saveClues(clues, roundOverride) {
    if (clues.some((str, idx) => clues.indexOf(str) !== idx)) {
      alert("Clues must be unique.");
      return false;
    }
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const team = me.team;

    // Save clues
    db.ref(`rooms/${this.roomId}/clues/${roundKey}/${team}`).set({ clues });

    // Save log entry for this clue submission
    const logEntry = {
      round: this.round,
      team: team,
      playerName: me.name,
      playerId: this.playerId,
      clues: clues,
      timestamp: Date.now(),
    };
    db.ref(`rooms/${this.roomId}/logs/clues/${roundKey}/${team}`).set(logEntry);

    return true;
  }

  saveGuess(guess, roundOverride) {
    if (guess.some((num, idx) => guess.indexOf(num) !== idx)) {
      alert("Guess must have unique numbers.");
      return false;
    }
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const team = me.team;
    db.ref(
      `rooms/${this.roomId}/guesses/${roundKey}/${team}/${this.playerId}`
    ).set(guess);
    return true;
  }

  saveConf(conf, roundOverride) {
    if (conf.some((num, idx) => conf.indexOf(num) !== idx)) {
      alert("Conf must have unique numbers.");
      return false;
    }
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const myTeam = me.team;

    // Save conf (for internal tracking)
    db.ref(`rooms/${this.roomId}/conf/${roundKey}/${myTeam}`).set(conf);

    // ALSO save as tconf (myTeam_about_myTeam) so opponents can see our mapping
    // This allows THEM panels to populate with our clues mapped to our words
    const tconfPath = `rooms/${this.roomId}/tconf/${roundKey}/${myTeam}_about_${myTeam}`;
    db.ref(tconfPath).set(conf);

    console.log(
      `[SAVE CONF] Team ${myTeam} saved conf and tconf (${myTeam}_about_${myTeam}):`,
      conf
    );

    return true;
  }

  saveTGuess(tguess, roundOverride) {
    if (tguess.some((num, idx) => tguess.indexOf(num) !== idx)) {
      alert("Tguess must have unique numbers.");
      return false;
    }
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const myTeam = me.team;
    const otherTeam = myTeam === "A" ? "B" : "A";
    const tguessPath = `rooms/${this.roomId}/tguesses/${roundKey}/${myTeam}_about_${otherTeam}`;
    // Save final team guess (only active player can do this)
    db.ref(tguessPath).set(tguess, (error) => {
      if (error) {
      }
    });
    return true;
  }

  // Collaborative tguess input methods
  updateCollaborativeTGuess(tguess, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId) {
      return false;
    }
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) {
      return false;
    }
    const myTeam = me.team;
    const otherTeam = myTeam === "A" ? "B" : "A";
    const collabPath = `rooms/${this.roomId}/collab_tguesses/${roundKey}/${myTeam}_about_${otherTeam}`;
    db.ref(collabPath).set({
      values: tguess,
      lastUpdated: Date.now(),
      updatedBy: this.playerId,
    });
    return true;
  }

  updateCollaborativeGuessUs(guesses, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId) {
      return false;
    }
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) {
      return false;
    }
    const myTeam = me.team;
    const collabPath = `rooms/${this.roomId}/collab_guess_us/${roundKey}/${myTeam}`;
    db.ref(collabPath).set({
      values: guesses,
      lastUpdated: Date.now(),
      updatedBy: this.playerId,
    });
    return true;
  }

  setTypingIndicator(isTyping, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const myTeam = me.team;
    const otherTeam = myTeam === "A" ? "B" : "A";
    const typingPath = `rooms/${this.roomId}/typing/${roundKey}/${myTeam}_about_${otherTeam}/${this.playerId}`;
    if (isTyping) {
      db.ref(typingPath).set({
        isTyping: true,
        timestamp: Date.now(),
      });
      // Auto-clear typing after 3 seconds
      setTimeout(() => {
        db.ref(typingPath).remove();
      }, 3000);
    } else {
      db.ref(typingPath).remove();
    }
    return true;
  }

  saveTConf(tconf, roundOverride) {
    console.log(
      `[SAVE TCONF] Team ${
        this.players[this.playerId]?.team
      } saving tconf about ${
        this.players[this.playerId]?.team === "A" ? "B" : "A"
      }:`,
      tconf
    );
    if (tconf.some((num, idx) => tconf.indexOf(num) !== idx)) {
      alert("Tconf must have unique numbers.");
      return false;
    }
    const db = getDb();
    if (!db || !this.roomId) return false;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    if (!me || !me.team) return false;
    const myTeam = me.team;
    const otherTeam = myTeam === "A" ? "B" : "A";
    const path = `rooms/${this.roomId}/tconf/${roundKey}/${myTeam}_about_${otherTeam}`;
    db.ref(path).set(tconf);
    return true;
  }

  addHint(text, panelNumber, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId) return;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    const myTeam = me?.team;
    if (!myTeam) return;

    const hintObj = {
      text,
      panel: panelNumber,
      team: myTeam,
      by: this.playerId,
      ts: Date.now(),
      crossed: false,
    };

    // Save hints per team, so each team only sees their own hints
    const ref = db
      .ref(`rooms/${this.roomId}/hints/${roundKey}/${myTeam}`)
      .push(hintObj);
    return ref.key; // Return the Firebase key for later reference
  }

  updateHintState(hintKey, panelNumber, state, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId || !hintKey) return;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    const myTeam = me?.team;
    if (!myTeam) return;

    // Update using the per-team path
    db.ref(
      `rooms/${this.roomId}/hints/${roundKey}/${myTeam}/${hintKey}`
    ).update({
      crossed: state.crossed,
    });
  }

  deleteHint(hintKey, panelNumber, roundOverride) {
    const db = getDb();
    if (!db || !this.roomId || !hintKey) return;
    const round = roundOverride || this.round || 1;
    const roundKey = `round_${round}`;
    const me = this.players[this.playerId];
    const myTeam = me?.team;
    if (!myTeam) return;

    // Delete using the per-team path
    db.ref(
      `rooms/${this.roomId}/hints/${roundKey}/${myTeam}/${hintKey}`
    ).remove();
  }

  setWords(team, wordsArray) {
    const db = getDb();
    if (!db || !this.roomId) return;
    db.ref(`rooms/${this.roomId}/words/${team}`).set(wordsArray.slice(0, 4));
  }

  startGame() {
    console.log("[START GAME] startGame() called");
    console.log(
      "[START GAME] isCreator:",
      this.isCreator,
      "phase:",
      this.phase
    );

    // Blocca se già in corso
    if (this._startGameInProgress) {
      console.log("[START GAME] ❌ BLOCKED - startGame already in progress");
      return;
    }

    // Solo il creatore può avviare; evita ri-avvio
    if (!this.isCreator || this.phase !== "lobby") {
      console.log("[START GAME] ❌ BLOCKED - Not creator or not in lobby");
      return;
    }

    this._startGameInProgress = true;

    const db = getDb();
    if (!db || !this.roomId) {
      console.log("[START GAME] ❌ BLOCKED - No db or roomId");
      this._startGameInProgress = false;
      return;
    }

    console.log("[START GAME] Teams:", this.teams);
    if (!(this.teams.A.length && this.teams.B.length)) {
      console.log("[START GAME] ❌ BLOCKED - Teams not valid");
      this._startGameInProgress = false;
      try {
        alert("Ogni team deve avere almeno un giocatore.");
      } catch (e) {}
      return;
    }

    // Genera codici per tutti gli 8 round se non già presenti
    console.log("[START GAME] Current codes:", this.codes);
    const hasAllCodesA =
      this.codes.A &&
      typeof this.codes.A === "object" &&
      Object.keys(this.codes.A).length === TOTAL_ROUNDS;
    const hasAllCodesB =
      this.codes.B &&
      typeof this.codes.B === "object" &&
      Object.keys(this.codes.B).length === TOTAL_ROUNDS;
    console.log(
      "[START GAME] hasAllCodesA:",
      hasAllCodesA,
      "hasAllCodesB:",
      hasAllCodesB
    );

    if (!hasAllCodesA || !hasAllCodesB) {
      console.log("[START GAME] Generating unique codes for all 8 rounds...");
      const codesA = this._generateUniqueCodesForTeam();
      const codesB = this._generateUniqueCodesForTeam();
      console.log(`[START GAME] Generated codes for team A:`, codesA);
      console.log(`[START GAME] Generated codes for team B:`, codesB);
      db.ref(`rooms/${this.roomId}/codes/A`).set(codesA);
      db.ref(`rooms/${this.roomId}/codes/B`).set(codesB);
    } else {
      console.log("[START GAME] All codes already exist, skipping generation");
    }

    const actives = {
      A: this.getActivePlayer("A", 1),
      B: this.getActivePlayer("B", 1),
    };
    console.log("[START GAME] Setting active players:", actives);
    this.activePlayers = actives;

    // Reset per-round phases for a fresh start
    this.roundPhases = this._defaultRoundPhases();
    this.unlockedRounds = this._defaultUnlockedRounds();
    this._syncTeamPhaseAlias(1);

    console.log("[START GAME] Setting state to Firebase...");
    db.ref(`rooms/${this.roomId}/state`)
      .set({
        round: 1,
        phase: "clues",
        teamPhases: { A: "clues", B: "clues" },
        roundPhases: this.roundPhases,
        unlockedRounds: this.unlockedRounds,
        activePlayers: {
          A: this.getActivePlayer("A", 1),
          B: this.getActivePlayer("B", 1),
        },
      })
      .then(() => {
        console.log("[START GAME] ✓ State set successfully");
        this._startGameInProgress = false;
      })
      .catch((err) => {
        console.log("[START GAME] ❌ Error setting state:", err);
        this._startGameInProgress = false;
      });
  }

  async resetGame() {
    if (!this.isCreator || !this.roomId) return;
    const db = getDb();
    if (!db) return;
    this.roomLanguage = this.roomLanguage || this.language || DEFAULT_LANGUAGE;
    const langKey = (this.roomLanguage || this.language || DEFAULT_LANGUAGE)
      .toLowerCase()
      .startsWith("en")
      ? "eng"
      : "ita";
    const wordlistPath =
      langKey === "eng" ? "wordlist-eng.txt" : "wordlist-ita.txt";
    // Carica wordlist e genera nuove 8 parole (4 per team)
    let aWords = [];
    let bWords = [];
    try {
      const parseList = (txt) =>
        txt
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(
            (l) =>
              l &&
              !l.startsWith("#") &&
              !/^<!?doctype/i.test(l) &&
              !/^<html/i.test(l) &&
              !l.includes("<")
          );

      const fetchList = async (path) => {
        const resp = await fetch(path, { cache: "no-cache" });
        if (!resp.ok) throw new Error(`wordlist fetch failed: ${path}`);
        const txt = await resp.text();
        const lines = parseList(txt);
        if (!lines.length) throw new Error(`wordlist empty: ${path}`);
        return lines;
      };

      let lines = await fetchList(wordlistPath);
      // Se vuota, prova fallback opposto, poi legacy
      if (!lines.length) {
        const fallback =
          langKey === "eng" ? "wordlist-ita.txt" : "wordlist-eng.txt";
        lines = await fetchList(fallback);
      }
      if (!lines.length) {
        lines = await fetchList("wordlist.txt");
      }
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      const unique = Array.from(new Set(lines));
      if (unique.length >= 8) {
        aWords = unique.slice(0, 4).map((w) => w.toUpperCase());
        bWords = unique.slice(4, 8).map((w) => w.toUpperCase());
      }
    } catch (e) {
      console.warn("[resetGame] wordlist fetch failed", e);
    }
    // Fallback se non trovate parole sufficienti: tieni quelle esistenti o riusa placeholder
    if (aWords.length !== 4)
      aWords = this.words.A.slice(0, 4) || ["A1", "A2", "A3", "A4"]; // non ideal ma evita rotture
    if (bWords.length !== 4)
      bWords = this.words.B.slice(0, 4) || ["B1", "B2", "B3", "B4"]; // idem

    const resetAt = Date.now();
    this.roundPhases = this._defaultRoundPhases();
    this.unlockedRounds = this._defaultUnlockedRounds();
    const updates = {};
    updates[`rooms/${this.roomId}/words/A`] = aWords;
    updates[`rooms/${this.roomId}/words/B`] = bWords;
    updates[`rooms/${this.roomId}/language`] =
      this.roomLanguage || this.language || DEFAULT_LANGUAGE;
    updates[`rooms/${this.roomId}/hints`] = {};
    updates[`rooms/${this.roomId}/clues`] = {};
    updates[`rooms/${this.roomId}/guesses`] = {};
    updates[`rooms/${this.roomId}/tguesses`] = {};
    updates[`rooms/${this.roomId}/tconf`] = {};
    updates[`rooms/${this.roomId}/collab_tguesses`] = {};
    updates[`rooms/${this.roomId}/collab_guess_us`] = {};
    updates[`rooms/${this.roomId}/typing`] = {};
    updates[`rooms/${this.roomId}/state`] = {
      round: 1,
      phase: "clues",
      teamPhases: { A: "clues", B: "clues" },
      roundPhases: this.roundPhases,
      unlockedRounds: this.unlockedRounds,
      resetAt,
      activePlayers: {
        A: this.getActivePlayer("A", 1),
        B: this.getActivePlayer("B", 1),
      },
    };
    // Rigenera sempre nuovi codici per il nuovo ciclo di 8 round
    // Solo il round 1 viene generato; gli altri verranno generati quando si avanza
    const codeA1 = this._generateSingleCode();
    const codeB1 = this._generateSingleCode();
    updates[`rooms/${this.roomId}/codes`] = {
      A: { round_1: codeA1 },
      B: { round_1: codeB1 },
    };
    console.log(
      `[RESET GAME] Generated new codes for round_1 - A: ${codeA1}, B: ${codeB1}`
    );
    db.ref().update(updates);
  }

  canJoin(roomSnapshot) {
    // roomSnapshot: oggetto stanza letto da firebase prima del join
    if (!roomSnapshot) return false;
    const phase = roomSnapshot.state?.phase || "lobby";
    if (phase !== "lobby") {
      // Permesso solo se già presente
      return !!roomSnapshot.players?.[this.playerId];
    }
    return true;
  }

  _writeInitialRoom() {
    const db = getDb();
    if (!db) return;
    // Genera solo il codice per il round 1 iniziale
    const codeA1 = this._generateSingleCode();
    const codeB1 = this._generateSingleCode();
    const base = {
      createdAt: Date.now(),
      creatorId: this.playerId,
      players: { [this.playerId]: { name: this.playerName, team: "A" } },
      teams: { A: [this.playerId], B: [] },
      words: { A: [], B: [] },
      codes: {
        A: { round_1: codeA1 },
        B: { round_1: codeB1 },
      },
      language: this.roomLanguage || this.language || DEFAULT_LANGUAGE,
      hints: {},
      clues: {},
      guesses: {},
      state: {
        round: 1,
        phase: "lobby",
        teamPhases: { A: "lobby", B: "lobby" },
        roundPhases: this.roundPhases,
        unlockedRounds: this.unlockedRounds,
        activePlayers: {
          A: this.getActivePlayer("A", 1),
          B: this.getActivePlayer("B", 1),
        },
      },
    };
    db.ref(`rooms/${this.roomId}`).set(base);
  }

  _generateCodes() {
    // Genera tutte le permutazioni di 3 numeri distinti da 1..4 (4P3 = 24) e ne prende 8 casuali
    const nums = [1, 2, 3, 4];
    const perms = [];
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        if (b === a) continue;
        for (let c = 0; c < 4; c++) {
          if (c === a || c === b) continue;
          perms.push(`${nums[a]}.${nums[b]}.${nums[c]}`);
        }
      }
    }
    // shuffle
    for (let i = perms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perms[i], perms[j]] = [perms[j], perms[i]];
    }
    return perms.slice(0, 8);
  }

  /**
   * Genera un singolo codice casuale (3 numeri distinti da 1..4)
   */
  _generateSingleCode() {
    const nums = [1, 2, 3, 4];
    // Shuffle
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    // Prendi i primi 3
    return `${nums[0]}.${nums[1]}.${nums[2]}`;
  }

  /**
   * Generate 8 unique codes for a team
   * Returns object like { round_1: "1.2.3", round_2: "2.3.4", ... }
   */
  _generateUniqueCodesForTeam() {
    const codesObj = {};
    const usedCodes = new Set();

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      let code;
      let attempts = 0;
      // Keep generating until we get a unique code (max 100 attempts to avoid infinite loop)
      do {
        code = this._generateSingleCode();
        attempts++;
      } while (usedCodes.has(code) && attempts < 100);

      if (attempts >= 100) {
        console.warn(
          `[GENERATE CODES] Could not generate unique code for round ${round} after 100 attempts`
        );
      }

      usedCodes.add(code);
      codesObj[`round_${round}`] = code;
    }

    return codesObj;
  }

  // --- NUOVA LOGICA TURNI MINIMALE ---
  _ensureActiveIntegrity() {
    if (this.phase === "lobby") return; // in lobby ignoriamo
    this._updateActivePlayersForRound(this.round);
  }

  passTurn() {
    // DISABLED: Active player rotation disabled - fixed per round
    // Turn rotation only occurs between rounds, not during gameplay
    return;
  }

  advanceTeamPhase(team, newPhase, round = this.round || 1) {
    if (!["A", "B"].includes(team)) return;
    if (!Number.isFinite(round) || round < 1 || round > TOTAL_ROUNDS) return;
    const allowedPhases = [
      "lobby",
      "clues",
      "guess_us",
      "conf_us",
      "guess_them",
      "conf_them",
      "review_round",
    ];
    if (!allowedPhases.includes(newPhase)) return;

    const currentPhase = this.getRoundPhase(team, round);
    const validTransitions = {
      lobby: ["clues"],
      clues: ["guess_us"],
      guess_us: ["conf_us"],
      conf_us: ["lobby", "clues", "guess_them"],
      guess_them: ["conf_them"],
      conf_them: ["lobby", "clues", "review_round"],
      review_round: ["clues"],
    };
    if (!validTransitions[currentPhase]?.includes(newPhase)) {
      console.warn(
        `[ADVANCE BLOCKED] Cannot advance from ${currentPhase} to ${newPhase} on round ${round}`
      );
      return;
    }
    console.log(
      `[ADVANCE] Team ${team} from ${currentPhase} to ${newPhase} on round ${round}`
    );

    // Ensure listeners are attached whenever phase changes
    if (!this._uiListeners || this._uiListeners.length === 0) {
      console.log(
        "[PHASE CHANGE] No listeners detected, attempting to attach..."
      );
      setTimeout(() => {
        this._attachUIListeners();
        if (!this._uiListeners || this._uiListeners.length === 0) {
          console.log("[PHASE CHANGE] Creating manual listeners...");
          this._createManualListeners();
        }
      }, 100);
    }

    this._setRoundPhase(team, round, newPhase);
    this._emit();
  }

  _attachRoomListeners() {
    const db = getDb();
    if (!db || !this.roomId) return;
    this._detachAll();
    // players
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/players`).on("value", (snap) => {
        const val = snap.val() || {};
        this.players = val;
        // Non ridefinire creatorId arbitrariamente: se non impostato, prova a leggere nodo dedicato.
        if (!this.creatorId) {
          db.ref(`rooms/${this.roomId}/creatorId`).once("value", (s2) => {
            const cid = s2.val();
            if (cid) this.creatorId = cid;
          });
        }
        // Rimosso auto-assegnazione: un player resta senza team finché non sceglie.
        // Guard addizionale: se fase > lobby e il nostro playerId non esiste (nuovo nome) => abort locale
        if (this.phase !== "lobby" && !this.players[this.playerId]) {
          const store = window.sessionStorage || window.localStorage;
          const r = this.roomId;
          this.roomId = null;
          store.removeItem(STORAGE.room);
          try {
            alert("Accesso non consentito: partita già avviata.");
          } catch (e) {}
          console.warn(
            "[JOIN-BLOCK-LISTENER] prevented late new-name join for room",
            r
          );
          return; // evita emit per client non più valido
        }
        this._emit();
      })
    );
    // language
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/language`).on("value", (snap) => {
        const lang = snap.val();
        if (lang) {
          this.roomLanguage = lang;
          this.language = lang;
          const store = window.sessionStorage || window.localStorage;
          store.setItem(STORAGE.lang, lang);
        }
        this._emit();
      })
    );
    // teams
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/teams`).on("value", (snap) => {
        const val = snap.val();
        if (val) {
          this.teams.A = val.A || [];
          this.teams.B = val.B || [];
        }
        if (this.phase !== "lobby") this._ensureActiveIntegrity();
        this._emit();
      })
    );
    // words
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/words`).on("value", (snap) => {
        const val = snap.val() || {};
        this.words.A = val.A || [];
        this.words.B = val.B || [];
        this._emit();
      })
    );
    // hints (all rounds)
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/hints`).on("value", (snap) => {
        const val = snap.val() || {};
        this.hints = val;
        this._emit();
      })
    );
    // state
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/state`).on("value", (snap) => {
        const s = snap.val();
        if (s) {
          if (!this._userSelectedRound) {
            this.round = s.round || this.round || 1;
          }
          this.phase = s.phase;
          this.roundPhases = this._normalizeRoundPhases(s.roundPhases);
          this.unlockedRounds = this._normalizeUnlockedRounds(s.unlockedRounds);
          this._syncTeamPhaseAlias(this.round);
          this.resetAt = s.resetAt || this.resetAt;
          this._updateActivePlayersForRound(this.round);
        }
        // Dopo aver ricevuto nuovo stato, se la lista team è cambiata altrove, riallinea
        this._ensureActiveIntegrity();
        this._emit();
      })
    );
    // codes
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/codes`).on("value", (snap) => {
        const val = snap.val();
        if (val) {
          // Nuova struttura: { A: { round_1: "code", round_2: "code" }, B: {...} }
          this.codes.A = val.A || {};
          this.codes.B = val.B || {};
        }
        this._emit();
      })
    );
    // clues
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/clues`).on("value", (snap) => {
        const val = snap.val() || {};
        this.cluesData = val;
        Object.entries(val).forEach(([roundKey, roundValue]) => {
          const roundNumber = parseInt(roundKey.split("_")[1], 10);
          ["A", "B"].forEach((team) => {
            if (roundValue?.[team]) {
              const phase = this.getRoundPhase(team, roundNumber);
              if (phase === "clues") {
                this.advanceTeamPhase(team, "guess_us", roundNumber);
              }
            }
          });
        });
        this._emit();
      })
    );
    // guesses
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/guesses`).on("value", (snap) => {
        const val = snap.val() || {};
        this.guessesData = val;
        Object.entries(val).forEach(([roundKey, roundValue]) => {
          const roundNumber = parseInt(roundKey.split("_")[1], 10);

          ["A", "B"].forEach((team) => {
            const teamGuesses = roundValue?.[team] || {};
            const teamMembers = this.teams[team] || [];
            const nonActiveMembers = teamMembers.filter(
              (id) => id !== this.getActivePlayer(team, roundNumber)
            );

            if (
              this.getRoundPhase(team, roundNumber) === "guess_us" &&
              nonActiveMembers.length > 0 &&
              Object.keys(teamGuesses).length === nonActiveMembers.length
            ) {
              this.advanceTeamPhase(team, "conf_us", roundNumber);
            }

            const otherTeam = team === "A" ? "B" : "A";
            const otherTeamMembers = this.teams[otherTeam] || [];
            if (
              otherTeamMembers.length > 0 &&
              Object.keys(teamGuesses).length === otherTeamMembers.length &&
              this.getRoundPhase(team, roundNumber) === "guess_us"
            ) {
              this.advanceTeamPhase(team, "conf_them", roundNumber);
            }
          });
        });
        this._emit();
      })
    );
    // conf
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/conf`).on("value", (snap) => {
        const val = snap.val() || {};
        this.confData = val;
        Object.entries(val).forEach(([roundKey, roundValue]) => {
          const roundNumber = parseInt(roundKey.split("_")[1], 10);

          ["A", "B"].forEach((team) => {
            if (
              roundValue?.[team] &&
              this.getRoundPhase(team, roundNumber) === "conf_us"
            ) {
              const otherTeam = team === "A" ? "B" : "A";
              if (this.teams[otherTeam].length > 0) {
                this.advanceTeamPhase(team, "guess_them", roundNumber);
              }
              // Sblocco round successivo dopo conf_us
              this._unlockNextRound(team, roundNumber);
            }
          });
        });
        this._emit();
      })
    );

    // tguesses (opponent guessing) - final submissions
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/tguesses`).on("value", (snap) => {
        const val = snap.val() || {};
        this.tguessesData = val;
        Object.entries(val).forEach(([roundKey, roundValue]) => {
          const roundNumber = parseInt(roundKey.split("_")[1], 10);

          ["A", "B"].forEach((team) => {
            const otherTeam = team === "A" ? "B" : "A";
            const teamTGuesses = roundValue?.[`${team}_about_${otherTeam}`];
            const teamMembers = this.teams[team] || [];

            if (teamTGuesses && Array.isArray(teamTGuesses)) {
              this._populateTGuessFields(otherTeam, teamTGuesses);
            }

            // When opponents send guesses about us, WE (otherTeam) must confirm
            if (
              teamTGuesses &&
              Array.isArray(teamTGuesses) &&
              this.getRoundPhase(otherTeam, roundNumber) === "guess_them"
            ) {
              this.advanceTeamPhase(otherTeam, "conf_them", roundNumber);
            }
          });
        });
        this._emit();
      })
    );

    // Collaborative tguesses (live input)
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/collab_tguesses`).on("value", (snap) => {
        const val = snap.val() || {};
        this.collabTGuessesData = val;
        this._emit();
      })
    );

    // Collaborative guess_us (live input)
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/collab_guess_us`).on("value", (snap) => {
        const val = snap.val() || {};
        this.collabGuessUsData = val;
        this._emit();
      })
    );

    // Typing indicators
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/typing`).on("value", (snap) => {
        const val = snap.val() || {};
        this.typingIndicators = val;
        this._emit();
      })
    );

    // tconf (opponent confirmation)
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/tconf`).on("value", (snap) => {
        const val = snap.val() || {};
        this.tconfData = val;
        Object.entries(val).forEach(([roundKey, roundValue]) => {
          const roundNumber = parseInt(roundKey.split("_")[1], 10);

          const tconfA = roundValue?.A_about_B;
          const tconfB = roundValue?.B_about_A;
          const phaseA = this.getRoundPhase("A", roundNumber);
          const phaseB = this.getRoundPhase("B", roundNumber);

          console.log(`[TCONF CHECK] Round ${roundNumber}:`, {
            tconfA: tconfA ? "✓" : "✗",
            tconfB: tconfB ? "✓" : "✗",
            phaseA,
            phaseB,
          });

          if (
            tconfA &&
            tconfB &&
            phaseA === "conf_them" &&
            phaseB === "conf_them"
          ) {
            console.log(
              `[TCONF] Both teams completed - moving to review_round for round ${roundNumber}`
            );
            this._setRoundPhase("A", roundNumber, "review_round");
            this._setRoundPhase("B", roundNumber, "review_round");
          }
        });
        this._emit();
      })
    );

    // Clue logs (for log page)
    this._listeners.push(
      db.ref(`rooms/${this.roomId}/logs/clues`).on("value", (snap) => {
        const val = snap.val() || {};
        this.clueLogs = val;
        this._emit();
      })
    );
  }

  _populatePanelsForTeam(team) {
    // Popola i 4 pannelli per il team che inizia il round
    if (!this.words[team] || this.words[team].length < 4) return;

    const db = getDb();
    if (!db || !this.roomId) return;

    // Aggiorna i pannelli con le parole del team
    const panels = {};
    for (let i = 1; i <= 4; i++) {
      panels[i] = this.words[team][i - 1] || "";
    }

    db.ref(`rooms/${this.roomId}/panels/${team}`).set(panels);
  }

  _populateTGuessFields(targetTeam, tguessValues) {
    // Popola i campi tguess (box arancioni) dell'active player del team target
    if (
      !tguessValues ||
      !Array.isArray(tguessValues) ||
      tguessValues.length < 3
    )
      return;

    // Emette un evento per far aggiornare l'UI con i tguess ricevuti
    this.receivedTGuesses = this.receivedTGuesses || {};
    this.receivedTGuesses[targetTeam] = tguessValues;

    console.log(
      `[POPULATE TGUESS] Target team ${targetTeam} receives tguesses:`,
      tguessValues
    );
    this._emit();
  }

  _detachAll() {
    // Using compat SDK; .off without args detaches listeners if stored references unnecessary.
    // For cleanliness no-op here (listeners overwritten). Could be extended if memory becomes issue.
  }

  _createManualListeners() {
    const db = getDb();
    if (!db || !this.roomId) return;

    console.log("[MANUAL LISTENERS] Creating fallback listeners...");

    this._uiListeners = this._uiListeners || [];

    // Manual tguesses listener
    const tguessRef = db.ref(`rooms/${this.roomId}/tguesses`);
    tguessRef.on("value", (snap) => {
      const prevData = JSON.stringify(this.tguessesData);
      this.tguessesData = snap.val() || {};
      const newData = JSON.stringify(this.tguessesData);

      if (prevData !== newData) {
        console.log(
          "[MANUAL LISTENER] TGuesses data changed:",
          this.tguessesData
        );
        console.log("[MANUAL LISTENER] Calling UI update functions...");

        if (typeof updateGuessInputs === "function") {
          updateGuessInputs();
        }
        if (typeof updateReceivedTGuesses === "function") {
          updateReceivedTGuesses();
          console.log("[MANUAL LISTENER] updateReceivedTGuesses called");
        } else {
          console.log("[MANUAL LISTENER] updateReceivedTGuesses not available");
        }
      }
    });

    this._uiListeners.push("manual-tguess-listener");
    console.log(
      "[MANUAL LISTENERS] Created " +
        this._uiListeners.length +
        " manual listeners"
    );
  }

  _attachUIListeners() {
    // UI-specific listeners for realtime updates
    const db = getDb();
    if (!db || !this.roomId) return;
    // Listener for guesses
    this._uiListeners = this._uiListeners || [];
    this._uiListeners.push(
      db.ref(`rooms/${this.roomId}/guesses`).on("value", (snap) => {
        this.guessesData = snap.val() || {};
        // Call updateGuessInputs if defined (legacy UI fallback)
        if (typeof updateGuessInputs === "function") updateGuessInputs();
      })
    );
    // Listener for tguesses
    this._uiListeners.push(
      db.ref(`rooms/${this.roomId}/tguesses`).on("value", (snap) => {
        this.tguessesData = snap.val() || {};
        if (typeof updateGuessInputs === "function") updateGuessInputs();
      })
    );
    // Listener for collaborative tguesses
    // Removed: now handled within ui-core's onChange pipeline to ensure teams are loaded
    // this._uiListeners.push(
    //   db.ref(`rooms/${this.roomId}/collab_tguesses`).on("value", (snap) => {
    //     this.collabTGuessesData = snap.val() || {};
    //     console.log(
    //       "[FIREBASE] Collaborative TGuesses updated:",
    //       this.collabTGuessesData
    //     );
    //     if (typeof updateCollaborativeTGuesses === "function")
    //       updateCollaborativeTGuesses();
    //   })
    // );
    // Listener for typing indicators
    this._uiListeners.push(
      db.ref(`rooms/${this.roomId}/typing`).on("value", (snap) => {
        this.typingIndicators = snap.val() || {};
        if (typeof updateTypingIndicators === "function")
          updateTypingIndicators();
      })
    );
    // Listener for teamPhases
    this._uiListeners.push(
      db.ref(`rooms/${this.roomId}/state/teamPhases`).on("value", (snap) => {
        const val = snap.val();
        if (val) this.teamPhases = val;
        this._syncTeamPhaseAlias(this.round);
        if (typeof updateGuessInputs === "function") updateGuessInputs();
        this._emit(); // Notify UI of teamPhases changes
      })
    );
  }

  /**
   * Avanza al round successivo dopo review_round
   * Chiamato quando i giocatori hanno visto i pannelli THEM
   */
  advanceToNextRound() {
    console.log("[ADVANCE ROUND] advanceToNextRound() called");
    console.log(
      "[ADVANCE ROUND] isCreator:",
      this.isCreator,
      "playerId:",
      this.playerId,
      "creatorId:",
      this.creatorId
    );

    // Guard: solo l'host può avanzare il round
    if (!this.isCreator) {
      console.log("[ADVANCE ROUND] ❌ BLOCKED - Only host can advance rounds");
      return;
    }

    // Guard: solo da review_round si può avanzare
    const me = this.players[this.playerId];
    const myTeam = me?.team;
    const myPhase = this.teamPhases?.[myTeam];
    console.log("[ADVANCE ROUND] My team:", myTeam, "My phase:", myPhase);

    if (!myTeam) {
      console.log("[ADVANCE ROUND] ❌ BLOCKED - Player has no team");
      return;
    }

    if (myPhase !== "review_round") {
      console.log(
        "[ADVANCE ROUND] ❌ BLOCKED - Not in review_round (current phase: " +
          myPhase +
          ")"
      );
      return;
    }

    const db = getDb();
    if (!db || !this.roomId) {
      console.error("[ADVANCE ROUND] No db or roomId!");
      return;
    }

    const nextRound = this.round + 1;
    console.log(`[ADVANCE ROUND] Current: ${this.round}, Next: ${nextRound}`);

    if (nextRound > TOTAL_ROUNDS) {
      // Fine gioco
      console.log("[ADVANCE ROUND] Game finished!");
      this.phase = "finished";
      db.ref(`rooms/${this.roomId}/state`).update({
        phase: "finished",
        round: this.round,
      });
    } else {
      // Nuovo round: entrambi i team ripartono da clues
      console.log(
        `[ADVANCE ROUND] Moving to round ${nextRound}, setting both teams to clues`
      );

      // Genera nuovi codici casuali per il prossimo round
      const codeA = this._generateSingleCode();
      const codeB = this._generateSingleCode();
      const roundKey = `round_${nextRound}`;

      console.log(
        `[ADVANCE ROUND] Generated new codes for ${roundKey} - A: ${codeA}, B: ${codeB}`
      );

      // Active player deterministico per round
      const nextActiveA = this.getActivePlayer("A", nextRound);
      const nextActiveB = this.getActivePlayer("B", nextRound);

      // NON modificare this.round localmente - lascia che il listener Firebase lo aggiorni
      // this.round = nextRound;
      // this.teamPhases.A = "clues";
      // this.teamPhases.B = "clues";

      // Aggiorna Firebase con nuovo round, fasi, codici e active players
      const updates = {};
      updates[`rooms/${this.roomId}/state/round`] = nextRound;
      updates[`rooms/${this.roomId}/state/teamPhases`] = {
        A: "clues",
        B: "clues",
      };
      updates[`rooms/${this.roomId}/state/activePlayers`] = {
        A: nextActiveA,
        B: nextActiveB,
      };
      updates[`rooms/${this.roomId}/codes/A/${roundKey}`] = codeA;
      updates[`rooms/${this.roomId}/codes/B/${roundKey}`] = codeB;

      db.ref()
        .update(updates)
        .then(() => {
          console.log(
            `[ADVANCE ROUND] Firebase updated successfully to round ${nextRound} with new codes and rotated active players`
          );
        })
        .catch((error) => {
          console.error("[ADVANCE ROUND] Firebase update failed:", error);
        });
    }
  }
}

// singleton
export const gameManager = new GameManager();

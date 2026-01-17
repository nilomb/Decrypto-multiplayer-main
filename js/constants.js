/**
 * Game Constants and Configuration
 * Central location for all game configuration, storage keys, and phase definitions.
 */

export const APP_NAME = "Decrypto";
export const TOTAL_ROUNDS = 8;

export const STORAGE = Object.freeze({
  name: "dc_name",
  room: "dc_room",
  lang: "dc_lang",
  playerId: "dc_pid",
});

export const DEFAULT_LANGUAGE = "it"; // "it" | "en"

export const PHASES = Object.freeze({
  LOBBY: "lobby",
  CLUES: "clues",
  GUESS: "guess",
  REVIEW: "review",
});

export const ROUND_KEY_PREFIX = "round_";

export function generateRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++)
    code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

export function ensurePlayerId() {
  const store = window.sessionStorage || window.localStorage;
  let id = store.getItem(STORAGE.playerId);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    store.setItem(STORAGE.playerId, id);
  }
  return id;
}

/**
 * Game Logs Module
 * Displays clue submission logs organized by round and team
 */

import { gameManager } from "../GameManager.js";

/**
 * Initialize logs modal and button handler
 */
export function initLogsModal() {
  const btnLogs = document.getElementById("btn-logs2");
  const btnLogs1 = document.getElementById("btn-logs"); // Also check for btn-logs on US page

  if (btnLogs) {
    btnLogs.addEventListener("click", showLogsModal);
  }
  if (btnLogs1) {
    btnLogs1.addEventListener("click", showLogsModal);
  }
}

/**
 * Show the logs modal with all clue submissions
 */
function showLogsModal() {
  // Create modal overlay if it doesn't exist
  let overlay = document.getElementById("logs-overlay");
  if (!overlay) {
    overlay = createLogsOverlay();
    document.body.appendChild(overlay);
  }

  // Populate logs
  populateLogs();

  // Show overlay
  overlay.classList.remove("hidden");
}

/**
 * Create the logs modal overlay HTML
 */
function createLogsOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "logs-overlay";
  overlay.className = "chat-overlay hidden";
  overlay.innerHTML = `
    <div class="chat-container">
      <div class="chat-header">
        <h3>📋 Game Logs - Clue History</h3>
        <button id="btn-close-logs" class="close-btn">✕</button>
      </div>
      <div class="chat-messages" id="logs-content" style="padding: 1rem;">
        <p style="text-align: center; color: #666;">Loading logs...</p>
      </div>
    </div>
  `;

  // Close button handler
  const closeBtn = overlay.querySelector("#btn-close-logs");
  closeBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
  });

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
    }
  });

  return overlay;
}

/**
 * Populate the logs content with clue submissions
 */
function populateLogs() {
  const logsContent = document.getElementById("logs-content");
  if (!logsContent) return;

  const logs = gameManager.clueLogs || {};

  // Check if there are any logs
  if (!logs || Object.keys(logs).length === 0) {
    logsContent.innerHTML = `
      <p style="text-align: center; color: #666; padding: 2rem;">
        No clues submitted yet. Logs will appear here once players submit their clues.
      </p>
    `;
    return;
  }

  // Build HTML for logs organized by round
  let html = '<div style="max-width: 800px; margin: 0 auto;">';

  // Sort rounds numerically (DESCENDING - most recent first)
  const rounds = Object.keys(logs).sort((a, b) => {
    const numA = parseInt(a.replace("round_", ""));
    const numB = parseInt(b.replace("round_", ""));
    return numB - numA; // Inverted to show latest rounds first
  });

  rounds.forEach((roundKey) => {
    const roundNum = roundKey.replace("round_", "");
    const roundLogs = logs[roundKey];

    html += `
      <div style="margin-bottom: 2rem; border: 2px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background: #f5f5f5; padding: 0.75rem; font-weight: bold; font-size: 1.1rem;">
          🎯 Round ${roundNum}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #ddd;">
    `;

    // Team A
    const teamALog = roundLogs.A;
    html += '<div style="background: white; padding: 1rem;">';
    html +=
      '<div style="font-weight: bold; color: #e74c3c; margin-bottom: 0.5rem;">🔴 Team A</div>';
    if (teamALog) {
      html += `<div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">${escapeHtml(
        teamALog.playerName
      )}</div>`;
      html += '<div style="border-top: 2px solid #eee; padding-top: 0.5rem;">';
      teamALog.clues.forEach((clue, idx) => {
        html += `<div style="margin: 0.25rem 0;">▪ ${escapeHtml(clue)}</div>`;
      });
      html += "</div>";
    } else {
      html += '<div style="color: #999; font-style: italic;">Waiting...</div>';
    }
    html += "</div>";

    // Team B
    const teamBLog = roundLogs.B;
    html += '<div style="background: white; padding: 1rem;">';
    html +=
      '<div style="font-weight: bold; color: #3498db; margin-bottom: 0.5rem;">🔵 Team B</div>';
    if (teamBLog) {
      html += `<div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">${escapeHtml(
        teamBLog.playerName
      )}</div>`;
      html += '<div style="border-top: 2px solid #eee; padding-top: 0.5rem;">';
      teamBLog.clues.forEach((clue, idx) => {
        html += `<div style="margin: 0.25rem 0;">▪ ${escapeHtml(clue)}</div>`;
      });
      html += "</div>";
    } else {
      html += '<div style="color: #999; font-style: italic;">Waiting...</div>';
    }
    html += "</div>";

    html += "</div></div>";
  });

  html += "</div>";

  logsContent.innerHTML = html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup Firebase listener for clue logs
 */
export function setupLogsListener() {
  const db = window.firebase?.database();
  if (!db || !gameManager.roomId) return;

  db.ref(`rooms/${gameManager.roomId}/logs/clues`).on("value", (snap) => {
    gameManager.clueLogs = snap.val() || {};
    // If logs modal is open, refresh it
    const logsOverlay = document.getElementById("logs-overlay");
    if (logsOverlay && !logsOverlay.classList.contains("hidden")) {
      populateLogs();
    }
  });
}

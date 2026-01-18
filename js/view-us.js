// Dynamically mounts the US page view markup extracted from index.html
// Keeps previous IDs so existing ui-core logic continues to work.

const usContainer = document.querySelector("[data-us-mount]");
if (usContainer) {
  usContainer.innerHTML = `
    <!-- Rounds (otto numeri a sinistra) -->
    <div class="round-wrapper">
      <div class="round-container" id="us-round-container">
        <div class="round-screen" data-round="1">
          <div class="top-area">
            <div class="top-box">
              <div class="team-topbar">
                <span id="team-badge" class="team-badge">A</span>
                <span id="player-name-pill" class="player-name-pill">Player</span>
                <span id="team-mates" class="team-mates">—</span>
                <div id="phase-status-us" class="phase-status">lobby</div>
              </div>
              <div class="nav-row">
                <div class="round-switch" id="us-round-switch" data-name="rounds">
                  <button data-round="1" class="active">1</button><button data-round="2">2</button><button data-round="3">3</button><button data-round="4">4</button><button data-round="5">5</button><button data-round="6">6</button><button data-round="7">7</button><button data-round="8">8</button>
                </div>
                <div class="mode-nav">
                  <button class="active" id="btn-nav-us">US</button><button id="btn-nav-them">THEM</button>
                </div>
              </div>
              <!-- Clues and guessing section -->
              <div class="clues-section">
                <div class="clues-container">
                  <!-- Our clue rows -->
                  <div class="row" id="clue1" data-clue-row="1">
                    <input type="text" placeholder="" id="clueword1" class="clue-input" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number guess-input" id="guess1" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number conf-input" id="conf1" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number tguess-input active-only" id="tguess1" placeholder="" />
                  </div>
                  <div class="row" id="clue2" data-clue-row="2">
                    <input type="text" placeholder="" id="clueword2" class="clue-input" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number guess-input" id="guess2" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number conf-input" id="conf2" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number tguess-input active-only" id="tguess2" placeholder="" />
                  </div>
                  <div class="row" id="clue3" data-clue-row="3">
                    <input type="text" placeholder="" id="clueword3" class="clue-input" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number guess-input" id="guess3" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number conf-input" id="conf3" placeholder="" />
                    <input type="number" min="1" max="4" inputmode="numeric" class="map-number tguess-input active-only" id="tguess3" placeholder="" />
                  </div>
                </div>
              </div>
            </div>
            <!-- Action Bar -->
            <div class="action-bar" id="action-bar-us">
              <span id="action-text-us">Send Clues</span>
              <div class="action-buttons">
                <button id="btn-submit-clues" style="display: inline;">Send</button>
                <button id="btn-submit-guess" style="display: none;">Send Guess</button>
                <button id="btn-submit-conf-us" class="conf-btn" style="display:none;">Team Confirm</button>
                <button id="btn-submit-conf-them" class="conf-btn" style="display:none;">Send</button>
              </div>
            </div>
          </div>
          <!-- US Panels (layout placeholder - content removed) -->
          <div class="grid" id="us-panels" style="opacity: 1;">
            <div class="panel" data-panel="1">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">1</span></div>
              <div class="panel-bottom" data-panel-index="0"></div>
            </div>
            <div class="panel" data-panel="2">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">2</span></div>
              <div class="panel-bottom" data-panel-index="1"></div>
            </div>
            <div class="panel" data-panel="3">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">3</span></div>
              <div class="panel-bottom" data-panel-index="2"></div>
            </div>
            <div class="panel" data-panel="4">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">4</span></div>
              <div class="panel-bottom" data-panel-index="3"></div>
            </div>
          </div>
          <!-- Code display overlay -->
          <div class="code-display" id="code-display">
            <div class="single-code-container">
              <div class="round-label" id="current-round-label">ROUND 1</div>
              <div class="single-round-code" id="current-round-code">1.2.3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <nav class="bottom-bar alt-bottom-bar">
      <button id="btn-reset" class="hidden host-only"><span class="icon"><img src="assets/imgs/reset.png" alt="Reset" /></span><span>Reset</span></button>
      <button id="btn-chat"><span class="icon"><img src="assets/imgs/chat.png" alt="Chat" /></span><span>Chat</span><span id="chat-unread-badge" class="unread-badge hidden">0</span></button>
      <button id="btn-room-id"><span class="icon"><img src="assets/imgs/id.png" alt="Room" /></span><span><span id="mini-room-id">----</span></span></button>
      <button id="btn-code" class="active-only"><span class="icon"><img src="assets/imgs/code.png" alt="Code" /></span><span>Code</span></button>
      <button id="btn-next-round" class="hidden host-only"><span class="icon"><img src="assets/imgs/log.png" alt="Next" /></span><span class="btn-label">Prossimo Round</span></button>
    </nav>

    <!-- Team Chat Overlay -->
    <div id="team-chat-overlay" class="chat-overlay hidden">
      <div class="chat-container">
        <div class="chat-header">
          <h3 id="chat-team-title">Chat Squadra</h3>
          <button id="chat-close-btn" class="chat-close">&times;</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <!-- Messages will be populated here -->
        </div>
        <div class="chat-input-area">
          <button id="chat-voice-btn" class="voice-btn" type="button">Voice</button>
          <input type="text" id="chat-input" placeholder="Scrivi un messaggio..." maxlength="200">
          <button id="chat-send-btn">Invia</button>
        </div>
      </div>
    </div>

    <!-- Clue Word Modal -->
    <div id="clue-word-modal" class="clue-word-modal hidden">
      <div class="clue-word-content">
        <div class="clue-word-label" id="clue-word-label">WORD</div>
        <button id="clue-word-confirm" class="clue-word-confirm">✓</button>
      </div>
    </div>

    <!-- Voice permission modal (one-time guidance) -->
    <div id="voice-permission-modal" class="voice-modal hidden">
      <div class="voice-modal-content">
        <h3>Abilita microfono</h3>
        <p>Quando premi "Voice", il browser chiede il permesso microfono. Premi "Consenti", poi parla vicino al microfono e usa "Stop" per fermare la dettatura.</p>
        <div class="voice-modal-actions">
          <button id="voice-modal-cancel" class="voice-btn-secondary" type="button">Annulla</button>
          <button id="voice-modal-accept" class="voice-btn-primary" type="button">Ho capito</button>
        </div>
      </div>
    </div>
  `;
}

export {}; // module harmless side-effect

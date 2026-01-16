// Dynamically mounts the THEM page view markup extracted from index.html

const themMount = document.querySelector("[data-them-mount]");
if (themMount) {
  themMount.innerHTML = `
    <!-- Rounds (otto numeri a sinistra) -->
    <div class="round-wrapper">
      <div class="round-container" id="them-round-container">
        <div class="round-screen" data-round="1">
          <div class="top-box">
            <div class="team-topbar">
              <span id="team-badge-them" class="team-badge">T</span>
              <span id="player-name-pill-them" class="player-name-pill">Player</span>
              <span id="team-mates-them" class="team-mates">—</span>
              <div id="phase-status-them" class="phase-status">lobby</div>
            </div>
            <div class="nav-row">
              <div class="round-switch" id="them-round-switch" data-name="rounds">
                <button data-round="1" class="active">1</button><button data-round="2">2</button><button data-round="3">3</button><button data-round="4">4</button><button data-round="5">5</button><button data-round="6">6</button><button data-round="7">7</button><button data-round="8">8</button>
              </div>
              <div class="mode-nav">
                <button id="btn-nav-us2">US</button><button class="active" id="btn-nav-them2">THEM</button>
              </div>
            </div>
            <!-- Clues and guessing section -->
            <div class="clues-section">
              <div class="clues-container">
                <!-- Their clue rows (readonly) -->
                <div class="row" id="clue1-them" data-clue-row="1">
                  <input type="text" placeholder="" id="clueword1-them" class="clueword-input" readonly />
                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number guessthem-input" id="guessthem1" placeholder="" />

                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number confthem-input" id="confthem1" placeholder="" />
                </div>
                <div class="row" id="clue2-them" data-clue-row="2">
                  <input type="text" placeholder="" id="clueword2-them" class="clueword-input" readonly />
                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number guessthem-input" id="guessthem2" placeholder="" />

                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number confthem-input" id="confthem2" placeholder="" />
                </div>
                <div class="row" id="clue3-them" data-clue-row="3">
                  <input type="text" placeholder="" id="clueword3-them" class="clueword-input" readonly />
                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number guessthem-input" id="guessthem3" placeholder="" />

                  <input type="number" min="1" max="4" inputmode="numeric" class="map-number confthem-input" id="confthem3" placeholder="" />
                </div>
              </div>
            </div>
          </div>
          <!-- Action Bar -->
          <div class="action-bar" id="action-bar-them">
            <span id="action-text-them">Waiting for opponents clues</span>
            <button id="btn-submit-tguess" style="display: none;">Send Guess</button>
          </div>
          <div class="grid" id="them-panels">
            <div class="panel" data-panel="1">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">1</span></div>
              <div class="panel-bottom" data-panel-index="0">
                <div class="hints-container" id="hints-1"></div>
                <input type="text" class="hint-input" placeholder="Type here..." data-panel="1" />
              </div>
            </div>
            <div class="panel" data-panel="2">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">2</span></div>
              <div class="panel-bottom" data-panel-index="1">
                <div class="hints-container" id="hints-2"></div>
                <input type="text" class="hint-input" placeholder="Type here..." data-panel="2" />
              </div>
            </div>
            <div class="panel" data-panel="3">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">3</span></div>
              <div class="panel-bottom" data-panel-index="2">
                <div class="hints-container" id="hints-3"></div>
                <input type="text" class="hint-input" placeholder="Type here..." data-panel="3" />
              </div>
            </div>
            <div class="panel" data-panel="4">
              <div class="panel-top"><ul></ul></div>
              <div class="panel-center"><span class="panel-number">4</span></div>
              <div class="panel-bottom" data-panel-index="3">
                <div class="hints-container" id="hints-4"></div>
                <input type="text" class="hint-input" placeholder="Type here..." data-panel="4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <nav class="bottom-bar alt-bottom-bar">
      <button id="btn-room-id2"><span class="icon"><img src="assets/imgs/id.png" alt="Room" /></span><span><span id="mini-room-id2">----</span></span></button>
      <button id="btn-opponent-chat"><span class="icon"><img src="assets/imgs/chat.png" alt="Chat" /></span><span>Chat</span><span id="opponent-chat-unread-badge" class="unread-badge hidden">0</span></button>
      <button id="btn-logs2"><span class="icon"><img src="assets/imgs/log.png" alt="Logs" /></span><span>Logs</span></button>
    </nav>

    <!-- Team Chat Overlay (for team members to discuss our clues) -->
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
          <input type="text" id="chat-input" placeholder="Scrivi un messaggio..." maxlength="200">
          <button id="chat-send-btn">Invia</button>
        </div>
      </div>
    </div>

    <!-- Opponent Chat Overlay (for all squad members to discuss opponent clues) -->
    <div id="opponent-chat-overlay" class="chat-overlay hidden">
      <div class="chat-container">
        <div class="chat-header">
          <h3 id="opponent-chat-team-title">Chat Avversari</h3>
          <button id="opponent-chat-close-btn" class="chat-close">&times;</button>
        </div>
        <div class="chat-messages" id="opponent-chat-messages">
          <!-- Messages will be populated here -->
        </div>
        <div class="chat-input-area">
          <input type="text" id="opponent-chat-input" placeholder="Scrivi un messaggio..." maxlength="200">
          <button id="opponent-chat-send-btn">Invia</button>
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
  `;
}

export {};

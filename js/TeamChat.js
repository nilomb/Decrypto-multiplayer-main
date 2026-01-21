/**
 * TeamChat - Real-time team messaging system
 * Manages chat messages between teammates with Firebase Realtime Database integration.
 * Provides message display, input handling, and auto-scroll functionality.
 */

import { gameManager } from "./GameManager.js";
import { getDb } from "./firebase-init.js";

class TeamChat {
  constructor() {
    this.db = null;
    this.currentRoomId = null;
    this.currentTeam = null;
    this.chatRef = null;
    this.chatListener = null;
    this.overlay = null;
    this.messagesContainer = null;
    this.input = null;
    this.sendBtn = null;
    this.closeBtn = null;
    this.teamTitle = null;
    this.isVisible = false;
    this.unreadCount = 0;
    this.lastReadTimestamp = 0;
    this.backgroundListener = null;
    this.typingRef = null;
    this.typingListener = null;
    this.typingTimeout = null;
    this.typingIndicator = null;
    this.voiceBtn = null;
    this.recognition = null;
    this.isListening = false;
  }

  async init() {
    try {
      this.db = getDb();
      if (!this.db) {
        console.warn("[TeamChat] Database not available during init");
        return;
      }
      this.setupDOM();
      this.setupEventListeners();
      this.startBackgroundListener();
    } catch (error) {}
  }

  setupDOM() {
    this.overlay = document.getElementById("team-chat-overlay");
    this.messagesContainer = document.getElementById("chat-messages");
    this.input = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("chat-send-btn");
    this.voiceBtn = document.getElementById("chat-voice-btn");
    this.closeBtn = document.getElementById("chat-close-btn");
    this.teamTitle = document.getElementById("chat-team-title");

    // Create typing indicator element
    this.typingIndicator = document.createElement("div");
    this.typingIndicator.className = "typing-indicator hidden";
    this.typingIndicator.innerHTML = '<span class="typing-text"></span>';

    // Insert typing indicator before input area
    const inputArea = this.overlay?.querySelector(".chat-input-area");
    if (inputArea) {
      inputArea.parentNode.insertBefore(this.typingIndicator, inputArea);
    }
  }

  setupEventListeners() {
    // Use event delegation on body to handle chat buttons from both views
    document.body.addEventListener("click", (e) => {
      const target = e.target.closest("#btn-chat, #btn-chat2");
      if (target) {
        e.preventDefault();
        this.openChat();
      }
    });
  }

  startBackgroundListener() {
    try {
      gameManager.onChange(() => {
        if (gameManager.roomId && gameManager.getMyTeam()) {
          this.startUnreadCountListener();
        } else {
          this.stopUnreadCountListener();
        }
      });
    } catch (error) {}
  }

  startUnreadCountListener() {
    if (!gameManager.roomId || !gameManager.getMyTeam()) return;
    if (this.backgroundListener || this.isVisible) return;
    if (!this.db) return;

    try {
      const chatPath = `rooms/${
        gameManager.roomId
      }/teamChats/${gameManager.getMyTeam()}`;
      this.backgroundListener = this.db
        .ref(chatPath)
        .on("value", (snapshot) => {
          this.updateUnreadCount(snapshot.val() || {});
        });
    } catch (error) {}
  }

  stopUnreadCountListener() {
    if (this.backgroundListener && this.db) {
      try {
        const chatPath = `rooms/${this.currentRoomId}/teamChats/${this.currentTeam}`;
        this.db.ref(chatPath).off("value", this.backgroundListener);
      } catch (error) {}
      this.backgroundListener = null;
    }
    this.clearUnreadBadge();
  }

  async openChat() {
    if (!gameManager.roomId || !gameManager.getMyTeam()) {
      alert(
        "Devi essere in una stanza e assegnato a una squadra per usare la chat.",
      );
      return;
    }

    this.currentRoomId = gameManager.roomId;
    this.currentTeam = gameManager.getMyTeam();

    // Clean up existing listeners first (from previous view)
    this.cleanupListeners();

    // Re-acquire DOM elements (view might have changed)
    this.overlay = document.getElementById("team-chat-overlay");
    this.messagesContainer = document.getElementById("chat-messages");
    this.input = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("chat-send-btn");
    this.voiceBtn = document.getElementById("chat-voice-btn");
    this.closeBtn = document.getElementById("chat-close-btn");
    this.teamTitle = document.getElementById("chat-team-title");

    if (!this.overlay) {
      console.warn("[TeamChat] Overlay not found");
      return;
    }

    // Setup voice recognition button (recreated per view)
    this.setupVoiceButton();

    // Recreate typing indicator (view may have changed)
    const existingIndicator = this.overlay.querySelector(".typing-indicator");
    if (existingIndicator) {
      existingIndicator.remove();
    }
    this.typingIndicator = document.createElement("div");
    this.typingIndicator.className = "typing-indicator hidden";
    this.typingIndicator.innerHTML = '<span class="typing-text"></span>';
    const inputArea = this.overlay?.querySelector(".chat-input-area");
    if (inputArea) {
      inputArea.parentNode.insertBefore(this.typingIndicator, inputArea);
    }

    // Attach event listeners directly (will be cleaned up on view change)
    const closeBtnHandler = () => this.closeChat();
    this.closeBtn?.addEventListener("click", closeBtnHandler);

    const overlayClickHandler = (e) => {
      if (e.target === this.overlay) {
        this.closeChat();
      }
    };
    this.overlay.addEventListener("click", overlayClickHandler);

    const containerClickHandler = (e) => {
      e.stopPropagation();
    };
    this.overlay
      .querySelector(".chat-container")
      ?.addEventListener("click", containerClickHandler);

    const sendBtnHandler = () => this.sendMessage();
    this.sendBtn?.addEventListener("click", sendBtnHandler);

    const inputKeyHandler = (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    };
    this.input?.addEventListener("keypress", inputKeyHandler);

    const inputChangeHandler = () => {
      this.handleTypingStart();
    };
    this.input?.addEventListener("input", inputChangeHandler);

    const inputFocusHandler = () => {
      this.handleTypingStart();
    };
    this.input?.addEventListener("focus", inputFocusHandler);

    const inputBlurHandler = () => {
      this.handleTypingStop();
    };
    this.input?.addEventListener("blur", inputBlurHandler);

    this.stopUnreadCountListener();
    this.markAllAsRead();

    if (this.teamTitle) {
      this.teamTitle.textContent = `Chat Squadra ${this.currentTeam}`;
    }

    this.overlay?.classList.remove("hidden");
    this.isVisible = true;
    this.input?.focus();
    this.listenToMessages();
    this.listenToTyping();

    // Setup typing reference
    const typingPath = `rooms/${gameManager.roomId}/teamTyping/${this.currentTeam}/${gameManager.playerId}`;
    this.typingRef = this.db.ref(typingPath);
  }

  cleanupListeners() {
    // Clean up Firebase listeners
    if (this.chatRef && this.chatListener) {
      this.chatRef.off("value", this.chatListener);
      this.chatRef = null;
      this.chatListener = null;
    }

    if (this.typingListener && this.typingDbRef) {
      this.typingDbRef.off("value", this.typingListener);
      this.typingListener = null;
      this.typingDbRef = null;
    }

    this.handleTypingStop();

    // Stop voice recognition if running
    if (this.isListening && this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {}
    }
  }

  setupVoiceButton() {
    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById("chat-voice-btn");

    this.voiceBtn = btn;

    if (!btn) return;

    if (!SpeechRec) {
      btn.disabled = true;
      btn.title = "Voice input not supported on this browser";
      return;
    }

    if (!this.recognition) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = "it-IT";
    }

    const stopListening = () => {
      this.isListening = false;
      btn.classList.remove("listening");
      btn.textContent = "Voice";
      try {
        this.recognition.stop();
      } catch (error) {}
    };

    const startListening = () => {
      if (!this.input) return;

      const hintKey = "voiceMicHintShown";
      const maybeStart = () => {
        this.isListening = true;
        btn.classList.add("listening");
        btn.textContent = "Stop";
        try {
          this.recognition.start();
        } catch (error) {
          stopListening();
        }
      };

      if (!localStorage.getItem(hintKey)) {
        this.showVoicePermissionModal(() => {
          localStorage.setItem(hintKey, "1");
          maybeStart();
        });
      } else {
        maybeStart();
      }
    };

    btn.onclick = () => {
      if (this.isListening) {
        stopListening();
      } else {
        startListening();
      }
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        this.input.value = transcript;
        this.input.focus();
      }
      stopListening();
    };

    this.recognition.onerror = () => {
      stopListening();
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        stopListening();
      }
    };
  }

  showVoicePermissionModal(onAccept) {
    const modal = document.getElementById("voice-permission-modal");
    const accept = document.getElementById("voice-modal-accept");
    const cancel = document.getElementById("voice-modal-cancel");

    if (!modal || !accept || !cancel) {
      // Fallback to immediate start if modal is missing
      onAccept?.();
      return;
    }

    const closeModal = () => {
      modal.classList.add("hidden");
      accept.onclick = null;
      cancel.onclick = null;
      modal.onclick = null;
    };

    accept.onclick = () => {
      closeModal();
      onAccept?.();
    };

    cancel.onclick = () => {
      closeModal();
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        closeModal();
      }
    };

    modal.classList.remove("hidden");
  }

  closeChat() {
    this.overlay?.classList.add("hidden");
    this.isVisible = false;

    // Clean up all listeners
    this.cleanupListeners();

    // Mark all messages as read before restarting background listener
    this.markAllAsRead();
    this.startUnreadCountListener();
  }

  handleTypingStart() {
    if (!this.currentTeam || !gameManager.roomId || !gameManager.playerId)
      return;

    const playerName = gameManager.playerName || "Someone";

    // Set typing status in Firebase
    if (this.typingRef) {
      this.typingRef.set({
        playerId: gameManager.playerId,
        playerName: playerName,
        timestamp: Date.now(),
      });
    }

    // Reset timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Auto-clear typing after 3 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.handleTypingStop();
    }, 3000);
  }

  handleTypingStop() {
    if (this.typingRef) {
      this.typingRef.remove();
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  listenToTyping() {
    if (!this.currentTeam || !gameManager.roomId) return;

    const typingPath = `rooms/${gameManager.roomId}/teamTyping/${this.currentTeam}`;
    const typingRef = this.db.ref(typingPath);

    this.typingListener = typingRef.on("value", (snapshot) => {
      const typingData = snapshot.val();
      this.updateTypingIndicator(typingData);
    });

    // Store ref for cleanup
    this.typingDbRef = typingRef;
  }

  updateTypingIndicator(typingData) {
    if (!this.typingIndicator) return;

    const typingUsers = [];

    if (typingData) {
      Object.values(typingData).forEach((typing) => {
        // Don't show our own typing
        if (
          typing &&
          typing.playerId &&
          typing.playerId !== gameManager.playerId
        ) {
          // Check if typing is recent (within 5 seconds)
          const isRecent = Date.now() - typing.timestamp < 5000;
          if (isRecent && typing.playerName) {
            typingUsers.push(typing.playerName);
          }
        }
      });
    }

    if (typingUsers.length > 0) {
      const typingText =
        typingUsers.length === 1
          ? `${typingUsers[0]} sta scrivendo...`
          : `${typingUsers.join(", ")} stanno scrivendo...`;

      this.typingIndicator.querySelector(".typing-text").textContent =
        typingText;
      this.typingIndicator.classList.remove("hidden");
    } else {
      this.typingIndicator.classList.add("hidden");
    }
  }

  updateUnreadCount(messages) {
    if (this.isVisible) return;

    const messageArray = Object.entries(messages)
      .map(([key, message]) => ({ id: key, ...message }))
      .filter(
        (message) =>
          message.playerId !== gameManager.playerId &&
          message.timestamp > this.lastReadTimestamp,
      );

    this.unreadCount = messageArray.length;
    this.updateUnreadBadge();
  }

  updateUnreadBadge() {
    const badge1 = document.getElementById("chat-unread-badge");
    const badge2 = document.getElementById("chat-unread-badge2");

    [badge1, badge2].forEach((badge) => {
      if (badge) {
        if (this.unreadCount > 0) {
          badge.textContent =
            this.unreadCount > 99 ? "99+" : this.unreadCount.toString();
          badge.classList.remove("hidden");
        } else {
          badge.classList.add("hidden");
        }
      }
    });
  }

  clearUnreadBadge() {
    this.unreadCount = 0;
    this.updateUnreadBadge();
  }

  markAllAsRead() {
    this.lastReadTimestamp = Date.now();
    this.clearUnreadBadge();
  }

  listenToMessages() {
    if (!this.currentRoomId || !this.currentTeam) return;

    if (this.chatRef) {
      this.chatRef.off("value", this.chatListener);
    }

    const chatPath = `rooms/${this.currentRoomId}/teamChats/${this.currentTeam}`;
    this.chatRef = this.db.ref(chatPath);
    this.chatListener = (snapshot) => {
      this.renderMessages(snapshot.val() || {});
    };
    this.chatRef.on("value", this.chatListener);
  }

  renderMessages(messages) {
    if (!this.messagesContainer) return;

    this.messagesContainer.innerHTML = "";
    const messageArray = Object.entries(messages)
      .map(([key, message]) => ({ id: key, ...message }))
      .sort((a, b) => a.timestamp - b.timestamp);

    messageArray.forEach((message) => {
      const messageElement = this.createMessageElement(message);
      this.messagesContainer.appendChild(messageElement);
    });

    this.scrollToBottom();
  }

  createMessageElement(message) {
    const messageDiv = document.createElement("div");
    const isOwnMessage = message.playerId === gameManager.playerId;

    messageDiv.className = `chat-message ${isOwnMessage ? "own" : "other"}`;

    const time = new Date(message.timestamp).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });

    messageDiv.innerHTML = `
      ${
        !isOwnMessage
          ? `<div class="message-author">${this.escapeHtml(
              message.playerName,
            )}</div>`
          : ""
      }
      <div class="message-text">${this.escapeHtml(message.text)}</div>
      <div class="message-time">${time}</div>
    `;

    return messageDiv;
  }

  async sendMessage() {
    const text = this.input?.value?.trim();
    if (!text || !this.currentRoomId || !this.currentTeam) return;

    if (this.input) this.input.value = "";

    const message = {
      text: text,
      playerId: gameManager.playerId,
      playerName: gameManager.playerName,
      team: this.currentTeam,
      timestamp: Date.now(),
    };

    const chatPath = `rooms/${this.currentRoomId}/teamChats/${this.currentTeam}`;
    try {
      const chatRef = this.db.ref(chatPath);
      await chatRef.push(message);
    } catch (error) {
      alert("Errore nell'invio del messaggio. Riprova.");
      if (this.input) this.input.value = text;
    }
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  cleanup() {
    this.closeChat();
    this.stopUnreadCountListener();
    this.currentRoomId = null;
    this.currentTeam = null;
    this.chatRef = null;
  }
}

export const teamChat = new TeamChat();

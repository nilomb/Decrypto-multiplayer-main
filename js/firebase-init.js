// Firebase configuration and initialization
// Requires Firebase scripts loaded via CDN before this module

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBT8YAZqJWWyw1h3wpH4k5o0ttfAsvLCt4",
  authDomain: "decrypto-italiano-multiplayer.firebaseapp.com",
  projectId: "decrypto-italiano-multiplayer",
  storageBucket: "decrypto-italiano-multiplayer.firebasestorage.app",
  messagingSenderId: "595214334413",
  appId: "1:595214334413:web:9444255dcf69a339516c84",
  // measurementId: "G-XXXXXXX" // optional
};

// Firebase initialization helper
let _app = null;
let _db = null;
let _auth = null;
let _authReady = false;

export function initFirebase(config = firebaseConfig) {
  if (_db) return _db;
  if (!window.firebase || !window.firebase.initializeApp) {
    console.warn(
      "[Firebase] SDK non presente. Aggiungi gli script CDN prima di inizializzare."
    );
    return null;
  }
  if (!config) {
    console.warn(
      "[Firebase] Config mancante. Passa il firebaseConfig a initFirebase()."
    );
    return null;
  }
  _app = window.firebase.initializeApp(config);
  _db = window.firebase.database();
  _auth = window.firebase.auth();

  // Sign in anonimo automatico
  _auth
    .signInAnonymously()
    .then(() => {
      _authReady = true;
      console.log("[Firebase Auth] Anonymous sign-in successful");
    })
    .catch((error) => {
      console.error("[Firebase Auth] Error:", error.code, error.message);
      _authReady = true; // Continue anyway for development
    });

  return _db;
}

export function getDb() {
  return _db;
}

export function getAuth() {
  return _auth;
}

export function isAuthReady() {
  return _authReady;
}

// Attende che Firebase sia pronto e inizializza automaticamente.
export function ensureFirebaseReady(maxWaitMs = 2000) {
  return new Promise((resolve) => {
    const start = performance.now();
    (function check() {
      if (window.firebase && window.firebase.initializeApp) {
        const db = initFirebase();

        // Wait for auth to be ready
        if (_authReady) {
          resolve(!!db);
        } else if (performance.now() - start < maxWaitMs) {
          setTimeout(check, 100);
        } else {
          console.warn("[Firebase] Auth timeout, proceeding anyway");
          resolve(!!db);
        }
      } else if (performance.now() - start < maxWaitMs) {
        setTimeout(check, 100);
      } else {
        console.warn("[Firebase] SDK non trovato entro timeout");
        resolve(false);
      }
    })();
  });
}

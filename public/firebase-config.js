// Centralized Firebase config for web (compat SDK)
(function () {
  const firebase = window.firebase;

  const firebaseConfig = {
    apiKey: "AIzaSyDGaAN-Fg1mK3KZANo88t__OEoJA8SJAD0",
    authDomain: "local-list-wski21.firebaseapp.com",
    projectId: "local-list-wski21",
    storageBucket: "local-list-wski21.firebasestorage.app",
    messagingSenderId: "280253430618",
    appId: "1:280253430618:web:f1110d0f205e619fea9163"
  };

// Stripe configuration
const stripeConfig = {
  // Replace with your Stripe publishable key (starts with pk_test_ or pk_live_)
  publishableKey: "pk_test_51SubwUIbyb3CuH51FdfXQ3V6I061Pbb7T3pX3UvBWg7Rl2fUTY0JpxcctK5EEJmTQw2p6YYmbu2zEYU3X2mHvupe00kEm8cnXw"
};

  window.stripeConfig = stripeConfig;

  if (!firebase) {
    console.error('Firebase SDK not loaded. Include firebase-app-compat and required compat SDK scripts before firebase-config.js.');
    window.firebaseApp = null;
    window.firebaseAuth = null;
    window.firebaseDb = null;
    window.firebaseStorage = null;
    return;
  }

  const app = firebase.apps && firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth ? firebase.auth() : null;
  const db = firebase.firestore ? firebase.firestore() : null;
  const storage = firebase.storage ? firebase.storage() : null;

  if (db) {
    try {
      // Force long polling for environments where WebChannel/QUIC is unstable.
      db.settings({
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: false,
        useFetchStreams: false,
        merge: true,
      });
      // Keep console cleaner in production by hiding verbose transport warnings.
      if (firebase.firestore.setLogLevel) {
        firebase.firestore.setLogLevel('error');
      }
    } catch (error) {
      // Ignore if settings were already locked by an earlier Firestore operation.
    }
  }

  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  window.firebaseStorage = storage;
})();

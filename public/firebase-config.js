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
    } catch {
      // Ignore if settings were already locked by an earlier Firestore operation.
    }
  }

  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  window.firebaseStorage = storage;

  const ACTIVE_PAID_PLAN_STATUSES = {
    active: true,
    trial: true,
  };

  function normalizeValue(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizePlanStatus(value) {
    const normalized = normalizeValue(value);

    switch (normalized) {
      case 'active':
      case 'pending':
      case 'trial':
      case 'past_due':
      case 'canceled':
      case 'cancelled':
      case 'expired':
        return normalized === 'cancelled' ? 'canceled' : normalized;
      default:
        return '';
    }
  }

  function resolveAccountType(profile) {
    const normalized = normalizeValue(profile && profile.accountType);
    if (normalized === 'business') return 'business';
    if (normalized === 'personal') return 'personal';
    return 'user';
  }

  function resolvePlanCode(profile) {
    const explicitCode = normalizeValue(profile && profile.planCode);
    if (explicitCode === 'free' || explicitCode === 'seller_pro' || explicitCode === 'business_premium') {
      return explicitCode;
    }

    const sellerTier = normalizeValue(profile && profile.sellerTier);
    if (sellerTier === 'pro') {
      return 'seller_pro';
    }

    const accountType = resolveAccountType(profile);
    const businessTier = normalizeValue(profile && profile.businessTier);
    const subscriptionPlan = normalizeValue(profile && profile.subscriptionPlan);
    const premiumStatus = normalizePlanStatus(profile && profile.premiumStatus);

    if (
      accountType === 'business' &&
      (
        businessTier === 'premium' ||
        subscriptionPlan === 'premium' ||
        subscriptionPlan === 'business_premium' ||
        (profile && profile.isPremium === true) ||
        premiumStatus === 'active' ||
        premiumStatus === 'trial' ||
        premiumStatus === 'past_due'
      )
    ) {
      return 'business_premium';
    }

    if (subscriptionPlan === 'seller_pro') {
      return 'seller_pro';
    }

    return 'free';
  }

  function resolvePlanStatus(profile) {
    return (
      normalizePlanStatus(profile && profile.planStatus) ||
      normalizePlanStatus(profile && profile.sellerStatus) ||
      normalizePlanStatus(profile && profile.premiumStatus) ||
      normalizePlanStatus(profile && profile.subscriptionStatus) ||
      'active'
    );
  }

  function resolvePlan(profile) {
    return {
      accountType: resolveAccountType(profile),
      planCode: resolvePlanCode(profile),
      planStatus: resolvePlanStatus(profile),
    };
  }

  function hasActivePaidPlan(profile) {
    const resolved = resolvePlan(profile);
    return resolved.planCode !== 'free' && ACTIVE_PAID_PLAN_STATUSES[resolved.planStatus] === true;
  }

  function hasBusinessPremiumAccess(profile) {
    const resolved = resolvePlan(profile);
    return resolved.planCode === 'business_premium' && ACTIVE_PAID_PLAN_STATUSES[resolved.planStatus] === true;
  }

  function hasSellerProAccess(profile) {
    const resolved = resolvePlan(profile);
    return resolved.planCode === 'seller_pro' && ACTIVE_PAID_PLAN_STATUSES[resolved.planStatus] === true;
  }

  function hasServiceProviderProfile(profile) {
    return Boolean(
      (profile && profile.hasServiceListing === true) ||
      (profile && profile.hasServices === true) ||
      normalizeValue(profile && profile.providerType) === 'service' ||
      normalizeValue(profile && profile.primaryProfileType) === 'service' ||
      normalizeValue(profile && profile.listingType) === 'services' ||
      normalizeValue(profile && profile.primaryServiceCategory)
    );
  }

  function hasPremiumServiceProviderAccess(profile) {
    return hasServiceProviderProfile(profile) && hasSellerProAccess(profile);
  }

  function hasProfileHubAccess(profile) {
    return resolveAccountType(profile) === 'business' || hasServiceProviderProfile(profile) || isAdminProfile(profile);
  }

  function hasPremiumProfileHubAccess(profile) {
    return hasBusinessPremiumAccess(profile) || hasPremiumServiceProviderAccess(profile) || isAdminProfile(profile);
  }

  function hasBusinessOnlyAccess(profile) {
    return resolveAccountType(profile) === 'business' || isAdminProfile(profile);
  }

  function isAdminProfile(profile) {
    return normalizeValue(profile && profile.role) === 'admin';
  }

  function hasSellerHubAccess(profile) {
    return hasActivePaidPlan(profile);
  }

  function getProfileNavTarget(profile) {
    const resolved = resolvePlan(profile);

    if (resolved.accountType === 'business' || hasServiceProviderProfile(profile)) {
      return { href: 'business-hub.html', label: 'Business Hub' };
    }

    if (hasSellerHubAccess(profile)) {
      return { href: 'seller-hub.html', label: "Seller's Hub" };
    }

    return { href: 'profile.html', label: 'Profile' };
  }

  window.LocalListPlanAccess = {
    normalizeValue,
    normalizePlanStatus,
    resolveAccountType,
    resolvePlanCode,
    resolvePlanStatus,
    resolvePlan,
    hasActivePaidPlan,
    hasServiceProviderProfile,
    hasPremiumServiceProviderAccess,
    hasProfileHubAccess,
    hasPremiumProfileHubAccess,
    hasBusinessOnlyAccess,
    hasBusinessPremiumAccess,
    hasSellerProAccess,
    hasSellerHubAccess,
    hasAiSellerToolsAccess: hasSellerHubAccess,
    getProfileNavTarget,
  };
})();

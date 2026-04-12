(function () {
  const db = window.firebaseDb;
  const auth = window.firebaseAuth;
  const storage = window.firebaseStorage;

  const adminStatus = document.getElementById('adminStatus');
  const adminContent = document.getElementById('adminContent');

  const tabs = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-section');

  const state = {
    activeTab: 'analytics',
    reports: {
      messages: [],
      listings: [],
    },
    reportFilters: {
      messages: 'pending',
      listings: 'pending',
    },
    selectedReport: null,
    selectedReportType: null,
  };

  const modalBackdrop = document.getElementById('reportModalBackdrop');
  const modalTitle = document.getElementById('reportModalTitle');
  const modalBody = document.getElementById('reportModalBody');
  const modalStatus = document.getElementById('reportStatus');
  const modalNotes = document.getElementById('reportNotes');
  const modalClose = document.getElementById('closeReportModal');
  const modalSave = document.getElementById('saveReportModal');

  function setStatus(type, message) {
    adminStatus.className = `status-banner status-${type}`;
    adminStatus.textContent = message;
  }

  function showContent(show) {
    adminContent.style.display = show ? 'block' : 'none';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return 'N/A';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString();
    } catch (error) {
      return 'N/A';
    }
  }

  async function loadTopPriorityCounts() {
    const pendingListingsEl = document.getElementById('priorityPendingListings');
    const serviceQueueEl = document.getElementById('priorityServiceApprovalQueue');
    const reportedListingsEl = document.getElementById('priorityReportedListings');
    const reportedMessagesEl = document.getElementById('priorityReportedMessages');
    const modPendingListingsEl = document.getElementById('modPendingListings');
    const modServiceQueueEl = document.getElementById('modServiceQueue');
    const modReportedListingsEl = document.getElementById('modReportedListings');
    const modReportedMessagesEl = document.getElementById('modReportedMessages');

    if (!pendingListingsEl || !serviceQueueEl || !reportedListingsEl || !reportedMessagesEl) return;

    try {
      const [pendingListingsSnap, pendingServicesSnap, pendingReportedListingsSnap, pendingReportedMessagesSnap, businessLocalSnap] = await Promise.all([
        db.collection('listings').where('status', '==', 'pending').get(),
        db.collection('services').where('approvalStatus', '==', 'pending').get(),
        db.collection('reportedListings').where('status', '==', 'pending').get(),
        db.collection('reportedMessages').where('status', '==', 'pending').get(),
        db.collection('businessLocal').get(),
      ]);

      const pendingBizProfilesCount = businessLocalSnap.docs.filter((d) => {
        const data = d.data() || {};
        if (data.isApproved === true) return false;
        const s = String(data.approvalStatus || '').toLowerCase();
        return s !== 'rejected' && s !== 'deleted';
      }).length;

      pendingListingsEl.textContent = String(pendingListingsSnap.size || 0);
      serviceQueueEl.textContent = String(pendingServicesSnap.size || 0);
      reportedListingsEl.textContent = String(pendingReportedListingsSnap.size || 0);
      reportedMessagesEl.textContent = String(pendingReportedMessagesSnap.size || 0);

      if (modPendingListingsEl) modPendingListingsEl.textContent = String(pendingListingsSnap.size || 0);
      if (modServiceQueueEl) modServiceQueueEl.textContent = String(pendingServicesSnap.size || 0);
      if (modReportedListingsEl) modReportedListingsEl.textContent = String(pendingReportedListingsSnap.size || 0);
      if (modReportedMessagesEl) modReportedMessagesEl.textContent = String(pendingReportedMessagesSnap.size || 0);
      setCountPill('modPendingBusinessProfiles', pendingBizProfilesCount);
    } catch (error) {
      console.error('Top priority counts load error:', error);
      pendingListingsEl.textContent = '-';
      serviceQueueEl.textContent = '-';
      reportedListingsEl.textContent = '-';
      reportedMessagesEl.textContent = '-';
      if (modPendingListingsEl) modPendingListingsEl.textContent = '-';
      if (modServiceQueueEl) modServiceQueueEl.textContent = '-';
      if (modReportedListingsEl) modReportedListingsEl.textContent = '-';
      if (modReportedMessagesEl) modReportedMessagesEl.textContent = '-';
    }
  }

  function getServiceOwnerId(serviceData) {
    return String(
      serviceData?.userId ||
      serviceData?.ownerUserId ||
      serviceData?.providerId ||
      serviceData?.createdBy ||
      ''
    ).trim();
  }

  function getVerificationDocs(data) {
    if (Array.isArray(data?.verificationDocumentUrls)) {
      return data.verificationDocumentUrls
        .filter((url) => typeof url === 'string')
        .map((url) => url.trim())
        .filter((url) => url !== '');
    }

    if (typeof data?.verificationDocumentUrls === 'string') {
      const one = data.verificationDocumentUrls.trim();
      return one ? [one] : [];
    }

    return [];
  }

  function isVerifiedBusinessRecord(data) {
    if (!data || data.isActive === false) return false;

    const status = String(data.approvalStatus || '').toLowerCase();
    const approved = data.isApproved === true || status === 'approved';
    const verified = data.isVerified === true;
    const docs = getVerificationDocs(data);

    return approved && verified && docs.length > 0;
  }

  async function loadServiceProvidersCount() {
    const countEl = document.getElementById('serviceProvidersCount');
    if (!countEl) return;

    try {
      const [servicesSnap, usersSnap] = await Promise.all([
        db.collection('services').get(),
        db.collection('users').get(),
      ]);

      const userMap = new Map(
        usersSnap.docs.map((docSnap) => [docSnap.id, docSnap.data() || {}])
      );
      const ownerIds = new Set();

      servicesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isActive === false) return;
        if (String(data.approvalStatus || '').toLowerCase() === 'deleted') return;

        const ownerId = getServiceOwnerId(data);
        if (ownerId) ownerIds.add(ownerId);
      });

      let serviceProviderCount = 0;
      ownerIds.forEach((ownerId) => {
        const userData = userMap.get(ownerId) || {};
        const accountType = String(userData.accountType || 'personal').toLowerCase();
        if (accountType !== 'business') serviceProviderCount += 1;
      });

      countEl.textContent = String(serviceProviderCount);
    } catch (error) {
      console.error('Service providers count load error:', error);
      countEl.textContent = '-';
    }
  }

  async function loadVerifiedBusinessesCount() {
    const countEl = document.getElementById('verifiedBusinessesCount');
    if (!countEl) return;

    try {
      const snap = await db.collection('businessLocal').get();
      const verifiedCount = snap.docs.reduce((total, docSnap) => {
        const data = docSnap.data() || {};
        return total + (isVerifiedBusinessRecord(data) ? 1 : 0);
      }, 0);

      countEl.textContent = String(verifiedCount);
    } catch (error) {
      console.error('Verified businesses count load error:', error);
      countEl.textContent = '-';
    }
  }

  function setCountPill(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  // Chart.js instances — kept so we can destroy before re-render
  let hubUsersChart = null;
  let hubListingsChart = null;

  async function loadHubAnalytics() {
    // Build last-7-days date labels and buckets
    const days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }));
    }
    const weekStart = days[0];

    try {
      // Fetch users, listings, businesses created in last 7 days, and all purchases in last 7 days
      const weekStartTs = firebase.firestore.Timestamp.fromDate(weekStart);
      const [usersSnap, listingsSnap, bizSnap, purchasesSnap] = await Promise.all([
        db.collection('users').where('createdAt', '>=', weekStartTs).get(),
        db.collection('listings').where('createdAt', '>=', weekStartTs).get(),
        db.collection('businessLocal').where('updatedAt', '>=', weekStartTs).get(),
        db.collection('featurePurchases').where('purchasedAt', '>=', weekStartTs).get(),
      ]);

      // Bucket by day
      const userCounts = new Array(7).fill(0);
      const listingCounts = new Array(7).fill(0);

      usersSnap.forEach(doc => {
        const ts = doc.data().createdAt;
        if (!ts) return;
        const d = ts.toDate();
        d.setHours(0, 0, 0, 0);
        const idx = days.findIndex(day => day.getTime() === d.getTime());
        if (idx >= 0) userCounts[idx]++;
      });

      listingsSnap.forEach(doc => {
        const ts = doc.data().createdAt;
        if (!ts) return;
        const d = ts.toDate();
        d.setHours(0, 0, 0, 0);
        const idx = days.findIndex(day => day.getTime() === d.getTime());
        if (idx >= 0) listingCounts[idx]++;
      });

      // Summary stat cards
      document.getElementById('weeklyNewUsers').textContent = usersSnap.size;
      document.getElementById('weeklyNewListings').textContent = listingsSnap.size;
      document.getElementById('weeklyNewBusinesses').textContent = bizSnap.size;
      document.getElementById('weeklyPurchases').textContent = purchasesSnap.size;

      // Chart defaults
      const chartDefaults = {
        type: 'bar',
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1, font: { size: 11 } },
              grid: { color: '#f1f5f9' },
            },
            x: { ticks: { font: { size: 10 } }, grid: { display: false } },
          },
        },
      };

      // Users chart
      const usersCtx = document.getElementById('chartNewUsers');
      if (usersCtx) {
        if (hubUsersChart) hubUsersChart.destroy();
        hubUsersChart = new Chart(usersCtx, {
          ...chartDefaults,
          data: {
            labels,
            datasets: [{
              data: userCounts,
              backgroundColor: '#3b82f6',
              borderRadius: 5,
              borderSkipped: false,
            }],
          },
        });
      }

      // Listings chart
      const listingsCtx = document.getElementById('chartNewListings');
      if (listingsCtx) {
        if (hubListingsChart) hubListingsChart.destroy();
        hubListingsChart = new Chart(listingsCtx, {
          ...chartDefaults,
          data: {
            labels,
            datasets: [{
              data: listingCounts,
              backgroundColor: '#10b981',
              borderRadius: 5,
              borderSkipped: false,
            }],
          },
        });
      }

    } catch (err) {
      console.error('Hub analytics load error:', err);
    }
  }

  async function loadDashboardCounts() {
    try {
      const [businessLocalSnap, allPurchasesSnap, businessUsersSnap, businessClaimsSnap,
        pendingApprovalsSnap, disabledUsersSnap, bannedUsersSnap, allUsersSnap] = await Promise.all([
        db.collection('businessLocal').get(),
        db.collection('featurePurchases').where('status', '==', 'pending').get(),
        db.collection('users').where('accountType', '==', 'business').get(),
        db.collection('businessClaims').get(),
        db.collection('pendingApprovals').get(),
        db.collection('users').where('isDisabled', '==', true).get(),
        db.collection('users').where('isBanned', '==', true).get(),
        db.collection('users').get(),
      ]);

      // Pending business profiles (not approved and not rejected/deleted)
      const pendingBizCount = businessLocalSnap.docs.filter((d) => {
        const data = d.data() || {};
        if (data.isApproved === true) return false;
        const s = String(data.approvalStatus || '').toLowerCase();
        return s !== 'rejected' && s !== 'deleted';
      }).length;
      setCountPill('modPendingBusinessProfiles', pendingBizCount);

      // Featured purchases split by type
      let featuredListingCount = 0;
      let featuredServiceCount = 0;
      allPurchasesSnap.forEach((d) => {
        const data = d.data() || {};
        const itemType = String(data.itemType || (data.serviceId ? 'service' : 'listing')).toLowerCase();
        if (itemType === 'service') featuredServiceCount += 1;
        else featuredListingCount += 1;
      });
      setCountPill('marketplaceFeaturedCount', featuredListingCount);
      setCountPill('featuredListingPurchasesCount', featuredListingCount);
      setCountPill('featuredServicePurchasesCount', featuredServiceCount);

      // Business users
      const bizCount = businessUsersSnap.size;
      setCountPill('businessUsersCount', bizCount);
      setCountPill('businessUserStatsCount', bizCount);

      // Pending business claims (default status = 'pending' when field absent)
      const pendingClaimsCount = businessClaimsSnap.docs.filter((d) => {
        const s = String(d.data().claimStatus || 'pending').toLowerCase();
        return s !== 'approved' && s !== 'rejected';
      }).length;
      setCountPill('businessClaimsCount', pendingClaimsCount);

      // Pending user approvals (default status = 'pending' when field absent)
      const pendingUsersCount = pendingApprovalsSnap.docs.filter((d) => {
        return String(d.data().status || 'pending').toLowerCase() === 'pending';
      }).length;
      setCountPill('pendingUsersCount', pendingUsersCount);

      // Blocked / flagged users (deduplicated)
      const blockedIds = new Set([
        ...disabledUsersSnap.docs.map((d) => d.id),
        ...bannedUsersSnap.docs.map((d) => d.id),
      ]);
      setCountPill('blockedUsersCount', blockedIds.size);

      // Total users
      setCountPill('totalUsersCount', allUsersSnap.size);

      // Reports section counts
      const digestCount = allUsersSnap.docs.filter(d => d.data().digestNotification === true).length;
      setCountPill('digestSubscribersCount', digestCount);

      const upgradeTargetCount = businessLocalSnap.docs.filter(d => {
        const data = d.data() || {};
        return String(data.businessTier || 'free') === 'free';
      }).length;
      setCountPill('upgradeTargetsCount', upgradeTargetCount);

      // Purchases report count (all time)
      const allPurchasesTotal = await db.collection('featurePurchases').get();
      setCountPill('purchasesReportCount', allPurchasesTotal.size);

    } catch (err) {
      console.error('Dashboard counts load error:', err);
    }
  }

  window.comingSoon = function (featureName) {
    alert(`${featureName} is coming soon.`);
  };

  function setActiveTab(tabId) {
    state.activeTab = tabId;
    tabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    sections.forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${tabId}`);
    });
  }

  function initTabs() {
    tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        if (!tabId) return;
        setActiveTab(tabId);
        loadTab(tabId);
      });
    });
  }

  function loadTab(tabId) {
    switch (tabId) {
      case 'analytics':
        loadAnalytics();
        break;
      case 'business-users':
        loadBusinessUsers();
        break;
      case 'service-providers':
        loadServiceProviders();
        break;
      case 'feature-purchases-listings':
        loadFeaturePurchasesListings();
        break;
      case 'feature-purchases-services':
        loadFeaturePurchasesServices();
        break;
      case 'business-claims':
        loadBusinessClaims();
        break;
      case 'verified-businesses':
        loadVerifiedBusinesses();
        break;
      case 'shop-local-section':
        loadShopLocalSectionSettings();
        break;
      case 'community-settings':
        loadCommunitySettings();
        break;
      case 'blocked':
        loadBlockedUsers();
        break;
      case 'pending-approvals':
        loadPendingApprovals();
        break;
      case 'reports':
        // No dynamic load needed — UI is static, exports are on-demand
        break;
      case 'pending-listings':
        loadPendingListings();
        break;
      case 'pending-services':
        loadPendingServices();
        break;
      case 'pending-business-profiles':
        loadPendingBusinessProfiles();
        break;
      case 'reported-messages':
        loadReportedMessages();
        break;
      case 'reported-listings':
        loadReportedListings();
        break;
      case 'auto-approvals':
        loadAutoApprovals();
        break;
      default:
        break;
    }
  }

  async function loadAnalytics() {
    const statTotalUsers = document.getElementById('statTotalUsers');
    const statPendingUsers = document.getElementById('statPendingUsers');
    const statTotalListings = document.getElementById('statTotalListings');
    const statTotalMessages = document.getElementById('statTotalMessages');
    const statReportedMessages = document.getElementById('statReportedMessages');
    const statPendingMessageReports = document.getElementById('statPendingMessageReports');
    const statReportedListings = document.getElementById('statReportedListings');
    const statPendingListingReports = document.getElementById('statPendingListingReports');
    const statPendingClaims = document.getElementById('statPendingClaims');
    const statApprovedClaims = document.getElementById('statApprovedClaims');
    const statRejectedClaims = document.getElementById('statRejectedClaims');
    const zipList = document.getElementById('zipList');

    zipList.innerHTML = '<div class="empty-state">Loading analytics...</div>';

    try {
      const [usersSnap, pendingSnap, listingsSnap, messagesSnap, reportedMessagesSnap, reportedListingsSnap, pendingMessageReportsSnap, pendingListingReportsSnap, businessClaimsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('pendingApprovals').get(),
        db.collection('listings').get(),
        db.collectionGroup('messages').get(),
        db.collection('reportedMessages').get(),
        db.collection('reportedListings').get(),
        db.collection('reportedMessages').where('status', '==', 'pending').get(),
        db.collection('reportedListings').where('status', '==', 'pending').get(),
        db.collection('businessClaims').get(),
      ]);

      statTotalUsers.textContent = usersSnap.size;
      statPendingUsers.textContent = pendingSnap.size;
      statTotalListings.textContent = listingsSnap.size;
      statTotalMessages.textContent = messagesSnap.size;
      statReportedMessages.textContent = reportedMessagesSnap.size;
      statPendingMessageReports.textContent = pendingMessageReportsSnap.size;
      statReportedListings.textContent = reportedListingsSnap.size;
      statPendingListingReports.textContent = pendingListingReportsSnap.size;

      let pendingClaimsCount = 0;
      let approvedClaimsCount = 0;
      let rejectedClaimsCount = 0;
      businessClaimsSnap.forEach((docSnap) => {
        const status = String(docSnap.data().claimStatus || 'pending').toLowerCase();
        if (status === 'approved') approvedClaimsCount += 1;
        else if (status === 'rejected') rejectedClaimsCount += 1;
        else pendingClaimsCount += 1;
      });

      if (statPendingClaims) statPendingClaims.textContent = pendingClaimsCount;
      if (statApprovedClaims) statApprovedClaims.textContent = approvedClaimsCount;
      if (statRejectedClaims) statRejectedClaims.textContent = rejectedClaimsCount;

      // Business account stats
      const businessAccountsSnap = await db.collection('users').where('accountType', '==', 'business').get();
      const paidBusinessAccounts = businessAccountsSnap.docs.filter(doc => {
        const plan = doc.data().subscriptionPlan;
        return plan && plan !== 'free';
      });
      document.getElementById('statBusinessAccounts').textContent = businessAccountsSnap.size;
      document.getElementById('statPaidPlans').textContent = paidBusinessAccounts.length;

      const approvedUsersSnap = await db.collection('users').where('status', '==', 'approved').get();
      const zipMap = {};
      approvedUsersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.zipCode) return;
        zipMap[data.zipCode] = (zipMap[data.zipCode] || 0) + 1;
      });

      const zipRows = Object.keys(zipMap)
        .map((zip) => ({ zip, count: zipMap[zip] }))
        .sort((a, b) => b.count - a.count);

      if (zipRows.length === 0) {
        zipList.innerHTML = '<div class="empty-state">No approved users yet.</div>';
        return;
      }

      zipList.innerHTML = zipRows.map((row) => `
        <div class="zip-row">
          <span>${escapeHtml(row.zip)}</span>
          <span>${row.count}</span>
        </div>
      `).join('');
    } catch (error) {
      console.error('Analytics load error:', error);
      zipList.innerHTML = '<div class="empty-state">Failed to load analytics.</div>';
    }
  }

  let allBusinessUsers = [];
  let allServiceProviders = [];
  let allVerifiedBusinesses = [];

  async function loadBusinessUsers() {
    const list = document.getElementById('businessUsersList');
    const searchInput = document.getElementById('businessSearchInput');
    list.innerHTML = '<div class="empty-state">Loading business users...</div>';

    try {
      const snap = await db.collection('users')
        .where('accountType', '==', 'business')
        .get();
      
      if (snap.empty) {
        list.innerHTML = '<div class="empty-state">No business users found.</div>';
        return;
      }

      allBusinessUsers = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      displayBusinessUsers(allBusinessUsers);

      // Setup search
      searchInput.removeEventListener('input', handleBusinessSearch);
      searchInput.addEventListener('input', handleBusinessSearch);
    } catch (error) {
      console.error('Business users load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load business users.</div>';
    }
  }

  function handleBusinessSearch(event) {
    const query = event.target.value.toLowerCase().trim();
    if (!query) {
      displayBusinessUsers(allBusinessUsers);
      return;
    }

    const filtered = allBusinessUsers.filter((user) => {
      return (
        (user.name && user.name.toLowerCase().includes(query)) ||
        (user.email && user.email.toLowerCase().includes(query)) ||
        (user.businessName && user.businessName.toLowerCase().includes(query))
      );
    });

    displayBusinessUsers(filtered);
  }

  function displayBusinessUsers(users) {
    const list = document.getElementById('businessUsersList');

    if (users.length === 0) {
      list.innerHTML = '<div class="empty-state">No business users match your search.</div>';
      return;
    }

    list.innerHTML = users.map((user) => {
      const plan = (user.subscriptionPlan || 'free').toUpperCase();
      const status = user.subscriptionStatus || 'active';
      const planColor = plan === 'FREE' ? '#666' : '#1565C0';
      
      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(user.name || 'Unknown')}</div>
              <div class="list-meta">${escapeHtml(user.email || 'No email')}</div>
              ${user.businessName ? `<div class="list-meta">Business: ${escapeHtml(user.businessName)}</div>` : ''}
              <div class="list-meta">Plan: <span style="color: ${planColor}; font-weight: 600;">${plan}</span> (${status})</div>
              <div class="list-meta">ZIP: ${escapeHtml(user.zipCode || 'N/A')} | Status: ${escapeHtml(user.status || 'unknown')}</div>
              ${user.businessPhone ? `<div class="list-meta">Phone: ${escapeHtml(user.businessPhone)}</div>` : ''}
              ${user.businessWebsite ? `<div class="list-meta">Website: ${escapeHtml(user.businessWebsite)}</div>` : ''}
            </div>
            <div class="list-actions">
              <button class="btn small" data-action="convert-to-user" data-user-id="${user.id}">Convert to User</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Setup convert buttons
    list.querySelectorAll('[data-action="convert-to-user"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-id');
        if (!userId) return;
        if (!confirm('Convert this business account to a regular user account? This will clear business information.')) return;
        try {
          await db.collection('users').doc(userId).update({
            accountType: 'user',
            businessName: null,
            businessDescription: null,
            businessPhone: null,
            businessWebsite: null,
            subscriptionPlan: 'free',
            subscriptionStatus: 'active'
          });
          loadBusinessUsers();
        } catch (error) {
          alert('Failed to convert user.');
          console.error(error);
        }
      });
    });
  }

  async function loadServiceProviders() {
    const list = document.getElementById('serviceProvidersList');
    const searchInput = document.getElementById('serviceProvidersSearchInput');
    if (!list || !searchInput) return;

    list.innerHTML = '<div class="empty-state">Loading service providers...</div>';

    try {
      const servicesSnap = await db.collection('services').get();
      const providerStatsByUserId = new Map();

      servicesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isActive === false) return;
        if (String(data.approvalStatus || '').toLowerCase() === 'deleted') return;

        const ownerId = getServiceOwnerId(data);
        if (!ownerId) return;

        const existing = providerStatsByUserId.get(ownerId) || {
          userId: ownerId,
          totalServices: 0,
          pendingServices: 0,
          approvedServices: 0,
          rejectedServices: 0,
          latestCreatedAtMs: 0,
          providerNames: new Set(),
          contactEmails: new Set(),
        };

        existing.totalServices += 1;

        const status = String(data.approvalStatus || '').toLowerCase();
        if (status === 'pending') existing.pendingServices += 1;
        else if (status === 'rejected') existing.rejectedServices += 1;
        else if (status === 'approved' || data.isApproved === true) existing.approvedServices += 1;

        const createdAtMs = data?.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
        if (createdAtMs > existing.latestCreatedAtMs) existing.latestCreatedAtMs = createdAtMs;

        const providerName = String(data.providerName || '').trim();
        if (providerName) existing.providerNames.add(providerName);
        const contactEmail = String(data.contactEmail || '').trim();
        if (contactEmail) existing.contactEmails.add(contactEmail);

        providerStatsByUserId.set(ownerId, existing);
      });

      if (providerStatsByUserId.size === 0) {
        allServiceProviders = [];
        list.innerHTML = '<div class="empty-state">No service providers found.</div>';
        const countEl = document.getElementById('serviceProvidersCount');
        if (countEl) countEl.textContent = '0';
        return;
      }

      const userIds = Array.from(providerStatsByUserId.keys());
      const userDocs = await Promise.all(
        userIds.map((userId) => db.collection('users').doc(userId).get())
      );

      const providers = [];

      userDocs.forEach((userDoc, index) => {
        const userId = userIds[index];
        const stats = providerStatsByUserId.get(userId);
        if (!stats) return;

        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        const accountType = String(userData.accountType || 'personal').toLowerCase();
        if (accountType === 'business') return;

        providers.push({
          userId,
          name: userData.name || userData.displayName || '',
          email: userData.email || '',
          accountType,
          status: userData.status || 'unknown',
          zipCode: userData.zipCode || '',
          isDisabled: userData.isDisabled === true,
          isBanned: userData.isBanned === true,
          providerNames: Array.from(stats.providerNames),
          contactEmails: Array.from(stats.contactEmails),
          totalServices: stats.totalServices,
          pendingServices: stats.pendingServices,
          approvedServices: stats.approvedServices,
          rejectedServices: stats.rejectedServices,
          latestCreatedAtMs: stats.latestCreatedAtMs,
        });
      });

      providers.sort((a, b) => {
        if (b.totalServices !== a.totalServices) return b.totalServices - a.totalServices;
        return b.latestCreatedAtMs - a.latestCreatedAtMs;
      });

      allServiceProviders = providers;
      displayServiceProviders(providers);

      const countEl = document.getElementById('serviceProvidersCount');
      if (countEl) countEl.textContent = String(providers.length);

      searchInput.removeEventListener('input', handleServiceProvidersSearch);
      searchInput.addEventListener('input', handleServiceProvidersSearch);
    } catch (error) {
      console.error('Service providers load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load service providers.</div>';
    }
  }

  function handleServiceProvidersSearch(event) {
    const query = String(event?.target?.value || '').toLowerCase().trim();
    if (!query) {
      displayServiceProviders(allServiceProviders);
      return;
    }

    const filtered = allServiceProviders.filter((provider) => {
      const name = String(provider.name || '').toLowerCase();
      const email = String(provider.email || '').toLowerCase();
      const userId = String(provider.userId || '').toLowerCase();
      const providerNames = provider.providerNames.map((item) => String(item || '').toLowerCase()).join(' ');
      const contactEmails = provider.contactEmails.map((item) => String(item || '').toLowerCase()).join(' ');

      return (
        name.includes(query) ||
        email.includes(query) ||
        userId.includes(query) ||
        providerNames.includes(query) ||
        contactEmails.includes(query)
      );
    });

    displayServiceProviders(filtered);
  }

  function displayServiceProviders(providers) {
    const list = document.getElementById('serviceProvidersList');
    if (!list) return;

    if (!providers || providers.length === 0) {
      list.innerHTML = '<div class="empty-state">No service providers match your search.</div>';
      return;
    }

    list.innerHTML = providers.map((provider) => {
      const providerNames = provider.providerNames.length > 0 ? provider.providerNames.join(', ') : 'N/A';
      const contactEmail = provider.contactEmails[0] || provider.email || 'N/A';
      const accountTypeLabel = provider.accountType || 'personal';
      const accessLabel = provider.isDisabled ? 'Disabled' : 'Active';
      const accessColor = provider.isDisabled ? '#b91c1c' : '#166534';

      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(provider.name || provider.providerNames[0] || 'Unknown Provider')}</div>
              <div class="list-meta">${escapeHtml(provider.email || 'No user email')} | User ID: ${escapeHtml(provider.userId)}</div>
              <div class="list-meta">Provider Names: ${escapeHtml(providerNames)}</div>
              <div class="list-meta">Contact: ${escapeHtml(contactEmail)} | Account Type: ${escapeHtml(accountTypeLabel)}</div>
              <div class="list-meta">Services: ${provider.totalServices} total • ${provider.approvedServices} approved • ${provider.pendingServices} pending • ${provider.rejectedServices} rejected</div>
              <div class="list-meta">ZIP: ${escapeHtml(provider.zipCode || 'N/A')} | Status: ${escapeHtml(provider.status || 'unknown')} | Access: <span style="color:${accessColor};font-weight:600;">${accessLabel}</span></div>
            </div>
            <div class="list-actions">
              <button class="btn secondary small" data-action="convert-provider-to-business" data-user-id="${provider.userId}" data-provider-name="${encodeURIComponent(provider.providerNames[0] || provider.name || '')}">Convert to Business</button>
              <button class="${provider.isDisabled ? 'btn small' : 'btn danger small'}" data-action="toggle-provider-access" data-user-id="${provider.userId}" data-disabled="${provider.isDisabled ? 'true' : 'false'}">${provider.isDisabled ? 'Enable Access' : 'Disable Access'}</button>
              <button class="btn small" onclick="window.navigateToTab('pending-services')">Open Service Queue</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="convert-provider-to-business"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-id');
        const providerName = decodeURIComponent((btn.getAttribute('data-provider-name') || '').trim());
        if (!userId) return;
        if (!confirm('Convert this service provider account to a business account?')) return;

        try {
          await db.collection('users').doc(userId).set({
            accountType: 'business',
            businessName: providerName || null,
            subscriptionPlan: 'free',
            subscriptionStatus: 'active',
            isDisabled: false,
            isBanned: false,
          }, { merge: true });

          await loadServiceProviders();
          await loadServiceProvidersCount();
        } catch (error) {
          console.error('Convert provider to business error:', error);
          alert('Failed to convert service provider to business.');
        }
      });
    });

    list.querySelectorAll('[data-action="toggle-provider-access"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-user-id');
        const disabledNow = btn.getAttribute('data-disabled') === 'true';
        if (!userId) return;

        const promptText = disabledNow
          ? 'Enable this service provider account?'
          : 'Disable this service provider account?';
        if (!confirm(promptText)) return;

        try {
          const payload = { isDisabled: !disabledNow };
          if (disabledNow) payload.isBanned = false;
          await db.collection('users').doc(userId).set(payload, { merge: true });

          await loadServiceProviders();
        } catch (error) {
          console.error('Toggle provider access error:', error);
          alert('Failed to update service provider access.');
        }
      });
    });
  }

  async function loadVerifiedBusinesses() {
    const list = document.getElementById('verifiedBusinessesList');
    const searchInput = document.getElementById('verifiedBusinessesSearchInput');
    if (!list || !searchInput) return;

    list.innerHTML = '<div class="empty-state">Loading verified businesses...</div>';

    try {
      const snap = await db.collection('businessLocal').get();
      const verifiedBusinesses = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((item) => isVerifiedBusinessRecord(item))
        .sort((a, b) => {
          const aT = a?.verifiedAt?.toDate ? a.verifiedAt.toDate().getTime() : 0;
          const bT = b?.verifiedAt?.toDate ? b.verifiedAt.toDate().getTime() : 0;
          return bT - aT;
        });

      allVerifiedBusinesses = verifiedBusinesses;
      displayVerifiedBusinesses(verifiedBusinesses);

      const countEl = document.getElementById('verifiedBusinessesCount');
      if (countEl) countEl.textContent = String(verifiedBusinesses.length);

      searchInput.removeEventListener('input', handleVerifiedBusinessesSearch);
      searchInput.addEventListener('input', handleVerifiedBusinessesSearch);
    } catch (error) {
      console.error('Verified businesses load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load verified businesses.</div>';
    }
  }

  function handleVerifiedBusinessesSearch(event) {
    const query = String(event?.target?.value || '').toLowerCase().trim();
    if (!query) {
      displayVerifiedBusinesses(allVerifiedBusinesses);
      return;
    }

    const filtered = allVerifiedBusinesses.filter((biz) => {
      const businessName = String(biz.businessName || '').toLowerCase();
      const userEmail = String(biz.userEmail || '').toLowerCase();
      const userId = String(biz.userId || '').toLowerCase();
      const city = String(biz.businessCity || '').toLowerCase();
      const zip = String(biz.zipCode || '').toLowerCase();

      return (
        businessName.includes(query) ||
        userEmail.includes(query) ||
        userId.includes(query) ||
        city.includes(query) ||
        zip.includes(query)
      );
    });

    displayVerifiedBusinesses(filtered);
  }

  function displayVerifiedBusinesses(items) {
    const list = document.getElementById('verifiedBusinessesList');
    if (!list) return;

    if (!items || items.length === 0) {
      list.innerHTML = '<div class="empty-state">No verified businesses match your search.</div>';
      return;
    }

    list.innerHTML = items.map((biz) => {
      const docs = getVerificationDocs(biz);
      const location = [biz.businessCity, biz.businessState].filter(Boolean).join(', ') || 'No location provided';
      const verifiedBy = biz.verifiedBy || 'N/A';

      return `
        <div class="list-item" style="border-left: 4px solid #10b981;">
          <div class="list-row">
            <div style="flex: 1;">
              <div class="list-title">${escapeHtml(biz.businessName || 'Unnamed Business')} <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#ecfdf3;color:#166534;border:1px solid #86efac;font-size:11px;font-weight:700;margin-left:8px;">VERIFIED</span></div>
              <div class="list-meta">Owner: ${escapeHtml(biz.userEmail || 'Unknown')} | User ID: ${escapeHtml(biz.userId || 'N/A')}</div>
              <div class="list-meta">Location: ${escapeHtml(location)} | ZIP: ${escapeHtml(biz.zipCode || 'N/A')}</div>
              <div class="list-meta">Category: ${escapeHtml(biz.businessCategory || 'N/A')} | Verified: ${formatDate(biz.verifiedAt)}</div>
              <div class="list-meta">Verified By: ${escapeHtml(verifiedBy)} | Verification Files: ${docs.length}</div>
            </div>
            <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn secondary small" data-action="view-verified-docs" data-file-urls="${docs.map((url) => encodeURIComponent(url)).join(',')}">View Files</button>
              <button class="btn small" data-action="reverify-business" data-id="${biz.id}">Re-verify</button>
              <button class="btn danger small" data-action="remove-verified-badge" data-id="${biz.id}">Remove Badge</button>
              <button class="btn small" onclick="window.navigateToTab('pending-business-profiles')">Review Pending Profiles</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="view-verified-docs"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const serializedUrls = btn.getAttribute('data-file-urls') || '';
        if (!serializedUrls) {
          alert('No verification files attached.');
          return;
        }
        openUploadedFiles(serializedUrls);
      });
    });

    list.querySelectorAll('[data-action="remove-verified-badge"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const profileId = btn.getAttribute('data-id');
        if (!profileId) return;
        if (!confirm('Remove the Local Business Verified badge from this business?')) return;

        try {
          await db.collection('businessLocal').doc(profileId).update({
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            verificationRemovedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verificationRemovedBy: auth.currentUser ? auth.currentUser.uid : null,
          });

          await loadVerifiedBusinesses();
          await loadVerifiedBusinessesCount();
        } catch (error) {
          console.error('Remove verified badge error:', error);
          alert('Failed to remove verified badge.');
        }
      });
    });

    list.querySelectorAll('[data-action="reverify-business"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const profileId = btn.getAttribute('data-id');
        if (!profileId) return;
        if (!confirm('Re-verify this business and refresh the verified timestamp?')) return;

        try {
          await db.collection('businessLocal').doc(profileId).update({
            isVerified: true,
            verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            verifiedBy: auth.currentUser ? auth.currentUser.uid : null,
            reverifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reverifiedBy: auth.currentUser ? auth.currentUser.uid : null,
          });

          await loadVerifiedBusinesses();
          await loadVerifiedBusinessesCount();
        } catch (error) {
          console.error('Re-verify business error:', error);
          alert('Failed to re-verify business.');
        }
      });
    });
  }

  async function loadBlockedUsers() {
    const list = document.getElementById('blockedList');
    list.innerHTML = '<div class="empty-state">Loading blocked users...</div>';

    try {
      const usersSnap = await db.collection('users').get();
      const blockedUsers = [];

      usersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const blocked = Array.isArray(data.blockedUsers) ? data.blockedUsers : [];
        if (blocked.length > 0) {
          blockedUsers.push({
            id: docSnap.id,
            name: data.name || 'Unknown',
            email: data.email || 'Unknown',
            blockedUsers: blocked,
          });
        }
      });

      if (blockedUsers.length === 0) {
        list.innerHTML = '<div class="empty-state">No blocked users found.</div>';
        return;
      }

      list.innerHTML = blockedUsers.map((user) => `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(user.name)}</div>
              <div class="list-meta">${escapeHtml(user.email)} | Blocked count: ${user.blockedUsers.length}</div>
              <div class="list-meta">Blocked IDs: ${escapeHtml(user.blockedUsers.join(', '))}</div>
            </div>
            <div class="list-actions">
              <button class="btn danger small" data-action="clear-blocks" data-user-id="${user.id}">Clear Blocks</button>
            </div>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('[data-action="clear-blocks"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-user-id');
          if (!userId) return;
          if (!confirm('Clear all blocked users for this account?')) return;
          try {
            await db.collection('users').doc(userId).update({ blockedUsers: [] });
            loadBlockedUsers();
          } catch (error) {
            alert('Failed to clear blocked users.');
          }
        });
      });
    } catch (error) {
      console.error('Blocked users load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load blocked users.</div>';
    }
  }

  let allFeaturePurchases = [];
  let currentListingPurchaseFilter = 'all';
  let currentServicePurchaseFilter = 'all';
  let allBusinessClaims = [];
  let currentBusinessClaimsFilter = 'pending';

  async function loadShopLocalSectionSettings() {
    const enabledEl = document.getElementById('shopLocalSectionEnabled');
    const titleEl = document.getElementById('shopLocalSectionTitle');
    const descriptionEl = document.getElementById('shopLocalSectionDescription');
    const buttonTextEl = document.getElementById('shopLocalSectionButtonText');
    const recentLimitEl = document.getElementById('shopLocalSectionRecentLimit');

    if (!enabledEl || !titleEl || !descriptionEl || !buttonTextEl || !recentLimitEl) return;

    enabledEl.value = 'true';
    titleEl.value = '🏪 Business Local';
    descriptionEl.value = 'Find trusted local businesses, discover what they offer, and explore the newest additions to our Business Local directory.';
    buttonTextEl.value = 'Explore Business Local';
    recentLimitEl.value = 3;

    try {
      const docSnap = await db.collection('settings').doc('shopLocalBrowseSection').get();
      if (!docSnap.exists) return;

      const data = docSnap.data() || {};
      if (typeof data.enabled === 'boolean') enabledEl.value = String(data.enabled);
      if (typeof data.title === 'string') titleEl.value = data.title;
      if (typeof data.description === 'string') descriptionEl.value = data.description;
      if (typeof data.buttonText === 'string') buttonTextEl.value = data.buttonText;
      if (typeof data.recentLimit === 'number') {
        const safeLimit = Math.min(6, Math.max(1, Math.floor(data.recentLimit)));
        recentLimitEl.value = safeLimit;
      }
    } catch (error) {
      console.error('Business Local section settings load error:', error);
      alert('Failed to load Business Local section settings.');
    }
  }

  async function saveShopLocalSectionSettings() {
    const enabledEl = document.getElementById('shopLocalSectionEnabled');
    const titleEl = document.getElementById('shopLocalSectionTitle');
    const descriptionEl = document.getElementById('shopLocalSectionDescription');
    const buttonTextEl = document.getElementById('shopLocalSectionButtonText');
    const recentLimitEl = document.getElementById('shopLocalSectionRecentLimit');

    if (!enabledEl || !titleEl || !descriptionEl || !buttonTextEl || !recentLimitEl) return;

    const title = (titleEl.value || '').trim();
    const description = (descriptionEl.value || '').trim();
    const buttonText = (buttonTextEl.value || '').trim();
    const recentLimitRaw = Number(recentLimitEl.value);
    const recentLimit = Math.min(6, Math.max(1, Number.isFinite(recentLimitRaw) ? Math.floor(recentLimitRaw) : 3));

    if (!title) {
      alert('Section title is required.');
      return;
    }

    if (!description) {
      alert('Section description is required.');
      return;
    }

    if (!buttonText) {
      alert('Button text is required.');
      return;
    }

    const payload = {
      enabled: enabledEl.value === 'true',
      title,
      description,
      buttonText,
      recentLimit,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser ? auth.currentUser.uid : null,
    };

    try {
      await db.collection('settings').doc('shopLocalBrowseSection').set(payload, { merge: true });
      alert('Business Local section settings saved.');
      loadShopLocalSectionSettings();
    } catch (error) {
      console.error('Business Local section settings save error:', error);
      alert('Failed to save Business Local section settings.');
    }
  }

  async function loadCommunitySettings() {
    const featuredCheckbox = document.getElementById('showFeaturedListings');
    const editorPicksCheckbox = document.getElementById('showEditorsPicks');
    const spotlightCheckbox = document.getElementById('showSpotlight');
    const newsCheckbox = document.getElementById('showNews');
    const quoteOfDayCheckbox = document.getElementById('showQuoteOfDay');
    const quoteOfDayTextInput = document.getElementById('quoteOfDayText');
    const quoteOfDayAttributionInput = document.getElementById('quoteOfDayAttribution');
    const spotlightHeadlineInput = document.getElementById('spotlightHeadline');
    const spotlightDescriptionInput = document.getElementById('spotlightDescription');
    const spotlightImageUrlInput = document.getElementById('spotlightImageUrl');
    const spotlightCtaTextInput = document.getElementById('spotlightCtaText');
    const spotlightCtaUrlInput = document.getElementById('spotlightCtaUrl');

    if (!featuredCheckbox || !editorPicksCheckbox || !spotlightCheckbox || !newsCheckbox) return;

    // Set defaults
    featuredCheckbox.checked = true;
    editorPicksCheckbox.checked = true;
    spotlightCheckbox.checked = true;
    newsCheckbox.checked = true;
    if (quoteOfDayCheckbox) quoteOfDayCheckbox.checked = true;
    if (quoteOfDayTextInput) quoteOfDayTextInput.value = '';
    if (quoteOfDayAttributionInput) quoteOfDayAttributionInput.value = '';
    if (spotlightHeadlineInput) spotlightHeadlineInput.value = '';
    if (spotlightDescriptionInput) spotlightDescriptionInput.value = '';
    if (spotlightImageUrlInput) spotlightImageUrlInput.value = '';
    if (spotlightCtaTextInput) spotlightCtaTextInput.value = '';
    if (spotlightCtaUrlInput) spotlightCtaUrlInput.value = '';

    try {
      const docSnap = await db.collection('community_settings').doc('display').get();
      if (!docSnap.exists) return;

      const data = docSnap.data() || {};
      if (typeof data.showFeaturedListings === 'boolean') featuredCheckbox.checked = data.showFeaturedListings;
      if (typeof data.showEditorsPicks === 'boolean') editorPicksCheckbox.checked = data.showEditorsPicks;
      if (typeof data.showSpotlight === 'boolean') spotlightCheckbox.checked = data.showSpotlight;
      if (typeof data.showNews === 'boolean') newsCheckbox.checked = data.showNews;
      if (quoteOfDayCheckbox && typeof data.showQuoteOfDay === 'boolean') quoteOfDayCheckbox.checked = data.showQuoteOfDay;
      if (quoteOfDayTextInput) quoteOfDayTextInput.value = data.quoteOfDayText || '';
      if (quoteOfDayAttributionInput) quoteOfDayAttributionInput.value = data.quoteOfDayAttribution || '';
      if (spotlightHeadlineInput) spotlightHeadlineInput.value = data.spotlightHeadline || '';
      if (spotlightDescriptionInput) spotlightDescriptionInput.value = data.spotlightDescription || '';
      if (spotlightImageUrlInput) spotlightImageUrlInput.value = data.spotlightImageUrl || '';
      if (spotlightCtaTextInput) spotlightCtaTextInput.value = data.spotlightCtaText || '';
      if (spotlightCtaUrlInput) spotlightCtaUrlInput.value = data.spotlightCtaUrl || '';
    } catch (error) {
      console.error('Community settings load error:', error);
    }
  }

  async function saveCommunitySettings() {
    const featuredCheckbox = document.getElementById('showFeaturedListings');
    const editorPicksCheckbox = document.getElementById('showEditorsPicks');
    const spotlightCheckbox = document.getElementById('showSpotlight');
    const newsCheckbox = document.getElementById('showNews');
    const quoteOfDayCheckbox = document.getElementById('showQuoteOfDay');
    const quoteOfDayTextInput = document.getElementById('quoteOfDayText');
    const quoteOfDayAttributionInput = document.getElementById('quoteOfDayAttribution');
    const spotlightHeadlineInput = document.getElementById('spotlightHeadline');
    const spotlightDescriptionInput = document.getElementById('spotlightDescription');
    const spotlightImageUrlInput = document.getElementById('spotlightImageUrl');
    const spotlightCtaTextInput = document.getElementById('spotlightCtaText');
    const spotlightCtaUrlInput = document.getElementById('spotlightCtaUrl');

    if (!featuredCheckbox || !editorPicksCheckbox || !spotlightCheckbox || !newsCheckbox) return;

    const spotlightCtaUrl = spotlightCtaUrlInput ? spotlightCtaUrlInput.value.trim() : '';
    if (spotlightCtaUrl && !/^https?:\/\//i.test(spotlightCtaUrl)) {
      const statusEl = document.getElementById('communitySettingsStatus');
      if (statusEl) {
        statusEl.textContent = 'CTA Link URL must start with http:// or https://';
        statusEl.className = 'status-banner status-error';
        statusEl.style.display = 'block';
      }
      return;
    }

    const payload = {
      showFeaturedListings: featuredCheckbox.checked,
      showEditorsPicks: editorPicksCheckbox.checked,
      showSpotlight: spotlightCheckbox.checked,
      showNews: newsCheckbox.checked,
      showQuoteOfDay: quoteOfDayCheckbox ? quoteOfDayCheckbox.checked : true,
      quoteOfDayText: quoteOfDayTextInput ? quoteOfDayTextInput.value.trim() : '',
      quoteOfDayAttribution: quoteOfDayAttributionInput ? quoteOfDayAttributionInput.value.trim() : '',
      spotlightHeadline: spotlightHeadlineInput ? spotlightHeadlineInput.value.trim() : '',
      spotlightDescription: spotlightDescriptionInput ? spotlightDescriptionInput.value.trim() : '',
      spotlightImageUrl: spotlightImageUrlInput ? spotlightImageUrlInput.value.trim() : '',
      spotlightCtaText: spotlightCtaTextInput ? spotlightCtaTextInput.value.trim() : '',
      spotlightCtaUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser ? auth.currentUser.uid : null,
    };

    try {
      await db.collection('community_settings').doc('display').set(payload, { merge: true });
      const statusEl = document.getElementById('communitySettingsStatus');
      if (statusEl) {
        statusEl.textContent = 'Settings saved successfully!';
        statusEl.className = 'status-banner status-success';
        statusEl.style.display = 'block';
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 3000);
      }
      loadCommunitySettings();
    } catch (error) {
      console.error('Community settings save error:', error);
      const statusEl = document.getElementById('communitySettingsStatus');
      if (statusEl) {
        statusEl.textContent = 'Failed to save settings. Please try again.';
        statusEl.className = 'status-banner status-error';
        statusEl.style.display = 'block';
      }
    }
  }

  async function uploadSpotlightImage() {
    const fileInput = document.getElementById('spotlightImageFile');
    const imageUrlInput = document.getElementById('spotlightImageUrl');
    const statusEl = document.getElementById('spotlightImageUploadStatus');
    const uploadBtn = document.getElementById('uploadSpotlightImageBtn');

    if (!fileInput || !imageUrlInput || !statusEl || !uploadBtn) return;

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      statusEl.textContent = 'Choose an image first.';
      statusEl.style.color = '#b45309';
      return;
    }

    if (!storage) {
      statusEl.textContent = 'Image upload is unavailable. Firebase Storage is not initialized.';
      statusEl.style.color = '#b91c1c';
      return;
    }

    if (!auth || !auth.currentUser) {
      statusEl.textContent = 'Sign in to upload an image.';
      statusEl.style.color = '#b91c1c';
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      statusEl.textContent = 'Please select a valid image file.';
      statusEl.style.color = '#b91c1c';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      statusEl.textContent = 'Image is too large. Use a file smaller than 8MB.';
      statusEl.style.color = '#b91c1c';
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `communitySpotlight/${auth.currentUser.uid}/${Date.now()}_${safeName}`;

    try {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Uploading...';
      statusEl.textContent = 'Uploading image...';
      statusEl.style.color = '#334155';

      const imageRef = storage.ref(storagePath);
      await imageRef.put(file, { contentType: file.type });
      const downloadUrl = await imageRef.getDownloadURL();

      imageUrlInput.value = downloadUrl;
      statusEl.textContent = 'Upload complete. Image URL has been filled in.';
      statusEl.style.color = '#166534';
    } catch (error) {
      console.error('Spotlight image upload error:', error);
      statusEl.textContent = 'Upload failed. Please try again.';
      statusEl.style.color = '#b91c1c';
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload Image';
    }
  }

  async function fetchFeaturePurchases() {
    const snap = await db.collection('featurePurchases')
      .orderBy('purchasedAt', 'desc')
      .get();

    allFeaturePurchases = await Promise.all(snap.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const itemType = String(data.itemType || (data.serviceId ? 'service' : 'listing')).toLowerCase();
      let itemTitle = 'Unknown';
      let userName = 'Unknown';

      try {
        if (itemType === 'service' && data.serviceId) {
          const serviceDoc = await db.collection('services').doc(data.serviceId).get();
          if (serviceDoc.exists) {
            const serviceData = serviceDoc.data() || {};
            itemTitle = serviceData.serviceName || serviceData.providerName || 'Untitled Service';
          }
        } else if (data.listingId) {
          const listingDoc = await db.collection('listings').doc(data.listingId).get();
          if (listingDoc.exists) {
            itemTitle = listingDoc.data().title || 'Untitled Listing';
          }
        }

        if (data.userId) {
          const userDoc = await db.collection('users').doc(data.userId).get();
          if (userDoc.exists) {
            userName = userDoc.data().displayName || userDoc.data().email || 'Unknown';
          }
        } else if (data.userEmail) {
          userName = data.userEmail;
        }
      } catch (err) {
        console.error('Error fetching related data:', err);
      }

      return {
        id: docSnap.id,
        ...data,
        itemType,
        itemTitle,
        userName,
      };
    }));
  }

  async function loadFeaturePurchasesByType(itemType, listElementId, filter) {
    const list = document.getElementById(listElementId);
    if (!list) return;
    list.innerHTML = '<div class="empty-state">Loading feature purchases...</div>';

    try {
      await fetchFeaturePurchases();

      const scopedPurchases = allFeaturePurchases.filter((purchase) => purchase.itemType === itemType);
      const reloadFn = itemType === 'service' ? loadFeaturePurchasesServices : loadFeaturePurchasesListings;
      displayFeaturePurchases(scopedPurchases, filter, listElementId, reloadFn);
    } catch (error) {
      console.error('Feature purchases load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load feature purchases.</div>';
    }
  }

  async function loadFeaturePurchasesListings() {
    await loadFeaturePurchasesByType('listing', 'featurePurchasesListingsList', currentListingPurchaseFilter);
  }

  async function loadFeaturePurchasesServices() {
    await loadFeaturePurchasesByType('service', 'featurePurchasesServicesList', currentServicePurchaseFilter);
  }

  function displayFeaturePurchases(purchases, filter, listElementId, reloadFn) {
    const list = document.getElementById(listElementId);
    if (!list) return;
    
    let filtered = purchases;
    if (filter === 'pending') {
      filtered = purchases.filter(p => p.status === 'pending');
    } else if (filter === 'completed') {
      filtered = purchases.filter(p => p.status === 'completed');
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">No ${filter !== 'all' ? filter : ''} feature purchases found.</div>`;
      return;
    }

    list.innerHTML = filtered.map((purchase) => {
      const purchaseStatus = String(purchase.status || 'pending').toLowerCase();
      const statusClass = purchaseStatus === 'completed' ? 'success' : 
                         purchaseStatus === 'pending' ? 'warning' : 'danger';
      const isPending = purchaseStatus === 'pending';
      const itemTypeLabel = purchase.itemType === 'service' ? 'Featured Service' : 'Featured Listing';
      const targetId = purchase.itemType === 'service' ? purchase.serviceId : purchase.listingId;
      const itemBg = isPending ? 'style="background: #fffbf0; border-left: 4px solid #ffc107;"' : '';
      
      return `
        <div class="list-item" ${itemBg}>
          <div class="list-row">
            <div style="flex: 1;">
              ${isPending ? '<div class="list-meta" style="color: #d97706; font-weight: 600; margin-bottom: 8px;">⚠️ PENDING APPROVAL</div>' : ''}
              <div class="list-title">${escapeHtml(purchase.itemTitle || 'Unknown')}</div>
              <div class="list-meta">For: ${escapeHtml(itemTypeLabel)}</div>
              <div class="list-meta">User: ${escapeHtml(purchase.userName)}</div>
              <div class="list-meta">Amount: $${purchase.amount || 0} ${purchase.currency || 'USD'}</div>
              <div class="list-meta">Purchased: ${formatDate(purchase.purchasedAt)}</div>
              <div class="list-meta">Expires: ${purchase.expiresAt ? new Date(purchase.expiresAt).toLocaleDateString() : 'N/A'}</div>
              <div class="list-meta">Payment Method: ${escapeHtml(purchase.paymentMethod || 'N/A')}</div>
              ${purchase.notes ? `<div class="list-meta">Notes: ${escapeHtml(purchase.notes)}</div>` : ''}
              <div class="list-meta">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: 600; 
                  background: ${statusClass === 'success' ? '#eef9f0' : statusClass === 'warning' ? '#fff3cd' : '#fdecec'};
                  color: ${statusClass === 'success' ? '#1f7a3d' : statusClass === 'warning' ? '#856404' : '#b3261e'};">
                  ${purchaseStatus.toUpperCase()}
                </span>
              </div>
            </div>
            ${isPending ? `
              <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn small" data-action="approve-purchase" data-purchase-id="${purchase.id}" data-item-type="${purchase.itemType || 'listing'}" data-target-id="${targetId || ''}" style="background: #10b981; color: white; border: none;">✓ Approve</button>
                <button class="btn danger small" data-action="reject-purchase" data-purchase-id="${purchase.id}">✗ Reject</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners for approve buttons
    list.querySelectorAll('[data-action="approve-purchase"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const purchaseId = btn.getAttribute('data-purchase-id');
        const itemType = String(btn.getAttribute('data-item-type') || 'listing').toLowerCase();
        const targetId = btn.getAttribute('data-target-id');
        if (!purchaseId || !targetId) return;
        
        if (!confirm('Approve this feature purchase and activate featured status?')) return;
        
        try {
          const isService = itemType === 'service';
          const collectionName = isService ? 'services' : 'listings';
          const targetDoc = await db.collection(collectionName).doc(targetId).get();
          const targetData = targetDoc.data();

          if (!targetData) {
            alert(isService ? 'Service not found.' : 'Listing not found.');
            return;
          }

          if (isService) {
            const serviceApproved = targetData.isApproved === true || targetData.approvalStatus === 'approved';
            if (!serviceApproved) {
              alert('This service must be approved first via the "Pending Services" tab before its featured status can be activated.');
              return;
            }
          } else if (targetData.status !== 'approved') {
            alert('This listing must be approved first via the "Pending Listings" tab before its featured status can be activated. Current status: ' + (targetData.status || 'unknown'));
            return;
          }
          
          // Update purchase status
          await db.collection('featurePurchases').doc(purchaseId).update({
            status: 'completed',
            verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          // Get the expiration date from the purchase
          const purchaseDoc = await db.collection('featurePurchases').doc(purchaseId).get();
          const purchaseData = purchaseDoc.data();
          
          // Activate featured status
          await db.collection(collectionName).doc(targetId).update({
            isFeatured: true,
            featureExpiresAt: purchaseData.expiresAt,
            featureActivatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          alert(`Feature purchase approved! ${isService ? 'Service' : 'Listing'} is now featured.`);
          if (typeof reloadFn === 'function') reloadFn();
        } catch (error) {
          console.error('Error approving purchase:', error);
          alert('Failed to approve purchase: ' + error.message);
        }
      });
    });

    // Add event listeners for reject buttons
    list.querySelectorAll('[data-action="reject-purchase"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const purchaseId = btn.getAttribute('data-purchase-id');
        if (!purchaseId) return;
        
        const reason = prompt('Enter rejection reason (optional):');
        if (reason === null) return; // User cancelled
        
        try {
          await db.collection('featurePurchases').doc(purchaseId).update({
            status: 'rejected',
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rejectionReason: reason || 'No reason provided'
          });
          
          alert('Feature purchase rejected.');
          if (typeof reloadFn === 'function') reloadFn();
        } catch (error) {
          console.error('Error rejecting purchase:', error);
          alert('Failed to reject purchase: ' + error.message);
        }
      });
    });
  }

  async function loadBusinessClaims() {
    const list = document.getElementById('businessClaimsList');
    if (!list) return;

    list.innerHTML = '<div class="empty-state">Loading claim requests...</div>';

    try {
      const snap = await db.collection('businessClaims').orderBy('createdAt', 'desc').get();
      allBusinessClaims = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      displayBusinessClaims(allBusinessClaims, currentBusinessClaimsFilter);
    } catch (error) {
      console.error('Business claims load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load claim requests.</div>';
    }
  }

  function normalizeClaimImages(value) {
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim() !== '');
    if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
    return [];
  }

  function openUploadedFiles(serializedUrls) {
    const urls = String(serializedUrls || '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch (error) {
          return '';
        }
      })
      .filter((url) => typeof url === 'string' && url.startsWith('http'));

    if (urls.length === 0) {
      alert('No uploaded files were found for this record.');
      return;
    }

    urls.forEach((url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  function getUploadedFileLabel(url, idx) {
    try {
      const parsedUrl = new URL(url);
      const rawPath = decodeURIComponent(parsedUrl.pathname || '');
      const pathSegments = rawPath.split('/').filter((segment) => segment.trim() !== '');
      const fileName = pathSegments[pathSegments.length - 1] || '';
      if (!fileName) return `Proof Image ${idx + 1}`;

      const cleaned = fileName
        .replace(/^o\//, '')
        .split('%2F')
        .pop()
        .replace(/^.*businessClaimProofs\//, '')
        .replace(/^[^/]+\//, '')
        .replace(/^\d+_/, '')
        .replace(/^([a-zA-Z0-9-]+_){2,}/, '');

      return cleaned || `Proof Image ${idx + 1}`;
    } catch (error) {
      return `Proof Image ${idx + 1}`;
    }
  }

  function renderClaimImageThumbs(proofImages) {
    if (!Array.isArray(proofImages) || proofImages.length === 0) return '';

    return `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
        ${proofImages.map((url, idx) => `
          <a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(getUploadedFileLabel(url, idx))}" style="display: inline-flex;">
            <img src="${encodeURI(url)}" alt="${escapeHtml(getUploadedFileLabel(url, idx))}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc;" />
          </a>
        `).join('')}
      </div>
    `;
  }

  async function updateClaimantUserStatus(claim, status, extra = {}) {
    const claimantUserId = String(claim?.userId || '').trim();
    if (!claimantUserId) return;

    await db.collection('users').doc(claimantUserId).set({
      claimOwnershipRequest: true,
      claimStatus: status,
      claimBusinessId: claim.businessId || null,
      claimBusinessName: claim.businessName || null,
      ...extra,
    }, { merge: true });
  }

  function displayBusinessClaims(claims, filter) {
    const list = document.getElementById('businessClaimsList');
    if (!list) return;

    const selectedFilter = (filter || 'all').toLowerCase();
    let rows = claims;
    if (selectedFilter !== 'all') {
      rows = claims.filter((claim) => {
        const status = (claim.claimStatus || 'pending').toLowerCase();
        if (selectedFilter === 'pending') {
          return status === 'pending' || status === 'under_review';
        }
        return status === selectedFilter;
      });
    }

    if (rows.length === 0) {
      list.innerHTML = '<div class="empty-state">No claim requests found.</div>';
      return;
    }

    list.innerHTML = rows.map((claim) => {
      const status = (claim.claimStatus || 'pending').toLowerCase();
      const statusClass = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';
      const isPending = status === 'pending';
      const isUnderReview = status === 'under_review';
      const highlightStyle = isPending
        ? 'style="background: #fffbf0; border-left: 4px solid #ffc107;"'
        : isUnderReview
        ? 'style="background: #eff6ff; border-left: 4px solid #3b82f6;"'
        : '';
      const proofImages = normalizeClaimImages(claim.claimImages);
      const proofImageSummary = proofImages.length > 0
        ? `<div class="list-meta" style="margin-top: 8px;">Proof Images: ${proofImages.length} file${proofImages.length === 1 ? '' : 's'} attached</div>`
        : '<div class="list-meta" style="margin-top: 8px;">Proof Images: None submitted</div>';
      const proofImageLinks = proofImages.length > 0
        ? `<div class="list-meta" style="margin-top: 4px; line-height: 1.7;">${proofImages.map((url, idx) => `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(getUploadedFileLabel(url, idx))}</a>`).join('<br>')}</div>`
        : '';

      return `
        <div class="list-item" ${highlightStyle}>
          <div class="list-row">
            <div style="flex: 1;">
              ${isPending ? '<div class="list-meta" style="color: #d97706; font-weight: 600; margin-bottom: 8px;">⚠️ PENDING REVIEW</div>' : ''}
              ${isUnderReview ? '<div class="list-meta" style="color: #2563eb; font-weight: 600; margin-bottom: 8px;">🔎 UNDER REVIEW</div>' : ''}
              <div class="list-title">${escapeHtml(claim.businessName || 'Unknown Business')}</div>
              <div class="list-meta">Business ID: ${escapeHtml(claim.businessId || 'N/A')}</div>
              <div class="list-meta">Requested By: ${escapeHtml(claim.userEmail || 'Unknown')} (${escapeHtml(claim.userId || 'N/A')})</div>
              <div class="list-meta">Requested: ${formatDate(claim.createdAt)}</div>
              <div class="list-meta">Status: <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: 600; background: ${statusClass === 'success' ? '#eef9f0' : statusClass === 'warning' ? '#fff3cd' : '#fdecec'}; color: ${statusClass === 'success' ? '#1f7a3d' : statusClass === 'warning' ? '#856404' : '#b3261e'};">${escapeHtml(status.toUpperCase())}</span></div>
              <div class="list-meta" style="margin-top: 8px; white-space: pre-wrap;">Claim Message: ${escapeHtml(claim.claimMessage || 'No message')}</div>
              ${claim.contactPhone ? `<div class="list-meta" style="margin-top: 4px;">📞 Phone: ${escapeHtml(claim.contactPhone)}</div>` : ''}
              ${claim.contactTime ? `<div class="list-meta">⏰ Best Time to Contact: ${escapeHtml(claim.contactTime)}</div>` : ''}
              ${claim.allowContact ? `<div class="list-meta" style="color: #059669; font-weight: 600;">✓ May contact to fast-track verification</div>` : ''}
              ${proofImageSummary}
              ${proofImageLinks}
              ${renderClaimImageThumbs(proofImages)}
              ${claim.adminNotes ? `<div class="list-meta" style="margin-top: 8px;">Admin Notes: ${escapeHtml(claim.adminNotes)}</div>` : ''}
            </div>
            ${(isPending || isUnderReview) ? `
              <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
                ${proofImages.length > 0 ? `<button class="btn secondary small" data-action="view-claim-files" data-file-urls="${proofImages.map((url) => encodeURIComponent(url)).join(',')}">View ${proofImages.length} File${proofImages.length === 1 ? '' : 's'}</button>` : ''}
                ${isPending ? `<button class="btn secondary small" data-action="mark-claim-review" data-claim-id="${claim.id}" style="border-color: #3b82f6; color: #1d4ed8;">Mark Under Review</button>` : ''}
                <button class="btn small" data-action="approve-claim" data-claim-id="${claim.id}" style="background: #10b981; color: white; border: none;">✓ Approve</button>
                <button class="btn danger small" data-action="reject-claim" data-claim-id="${claim.id}">✗ Reject</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="approve-claim"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const claimId = btn.getAttribute('data-claim-id');
        if (!claimId) return;
        await approveBusinessClaim(claimId);
      });
    });

    list.querySelectorAll('[data-action="mark-claim-review"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const claimId = btn.getAttribute('data-claim-id');
        if (!claimId) return;
        await markBusinessClaimUnderReview(claimId);
      });
    });

    list.querySelectorAll('[data-action="reject-claim"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const claimId = btn.getAttribute('data-claim-id');
        if (!claimId) return;
        await rejectBusinessClaim(claimId);
      });
    });

    list.querySelectorAll('[data-action="view-claim-files"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const serializedUrls = btn.getAttribute('data-file-urls') || '';
        openUploadedFiles(serializedUrls);
      });
    });
  }

  async function approveBusinessClaim(claimId) {
    if (!confirm('Approve this claim request and assign business ownership?')) return;

    try {
      const claimRef = db.collection('businessClaims').doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        alert('Claim request not found.');
        return;
      }

      const claim = claimSnap.data() || {};
      const businessId = claim.businessId;
      const claimantUserId = claim.userId;
      if (!businessId || !claimantUserId) {
        alert('Claim request is missing businessId or userId.');
        return;
      }

      const businessRef = db.collection('businessLocal').doc(businessId);
      const businessSnap = await businessRef.get();
      if (!businessSnap.exists) {
        alert('Business profile not found in businessLocal.');
        return;
      }

      const businessData = businessSnap.data() || {};
      const alreadyClaimed = businessData.isClaimed === true || (businessData.ownerUserId && String(businessData.ownerUserId).trim() !== '');
      if (alreadyClaimed) {
        alert('This business is already claimed.');
        return;
      }

      const notes = prompt('Optional approval notes:', '') || '';
      const batch = db.batch();
      const claimantUserRef = db.collection('users').doc(claimantUserId);

      batch.update(businessRef, {
        isClaimed: true,
        ownerUserId: claimantUserId,
        userId: claimantUserId,
        claimedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      batch.update(claimRef, {
        claimStatus: 'approved',
        adminNotes: notes,
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      batch.set(claimantUserRef, {
        claimOwnershipRequest: true,
        claimStatus: 'approved',
        claimBusinessId: businessId,
        claimBusinessName: claim.businessName || null,
      }, { merge: true });

      await batch.commit();
      alert('Claim approved and ownership assigned.');
      await loadBusinessClaims();
    } catch (error) {
      console.error('Error approving business claim:', error);
      alert('Failed to approve claim: ' + (error.message || 'Unknown error'));
    }
  }

  async function markBusinessClaimUnderReview(claimId) {
    try {
      const claimRef = db.collection('businessClaims').doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        alert('Claim request not found.');
        return;
      }

      const claim = claimSnap.data() || {};
      await claimRef.update({
        claimStatus: 'under_review',
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await updateClaimantUserStatus(claim, 'under_review');

      alert('Claim marked as under review.');
      await loadBusinessClaims();
    } catch (error) {
      console.error('Error marking claim under review:', error);
      alert('Failed to mark claim under review: ' + (error.message || 'Unknown error'));
    }
  }

  async function rejectBusinessClaim(claimId) {
    const reason = prompt('Enter rejection reason (optional):', '');
    if (reason === null) return;

    try {
      const claimRef = db.collection('businessClaims').doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        alert('Claim request not found.');
        return;
      }

      const claim = claimSnap.data() || {};

      await claimRef.update({
        claimStatus: 'rejected',
        adminNotes: reason || 'No reason provided',
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await updateClaimantUserStatus(claim, 'denied');

      alert('Claim request rejected.');
      await loadBusinessClaims();
    } catch (error) {
      console.error('Error rejecting business claim:', error);
      alert('Failed to reject claim: ' + (error.message || 'Unknown error'));
    }
  }

  async function loadPendingApprovals() {
    const list = document.getElementById('pendingApprovalsList');
    const rejectedList = document.getElementById('rejectedApprovalsList');
    list.innerHTML = '<div class="empty-state">Loading pending approvals...</div>';
    if (rejectedList) {
      rejectedList.innerHTML = '<div class="empty-state">Loading rejected requests...</div>';
    }

    try {
      const snap = await db.collection('pendingApprovals').orderBy('requestedAt', 'desc').get();
      const approvals = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        const resolvedUserId = data.userId || data.uid || data.userUid || data.accountId || '';
        return {
          id: docSnap.id,
          userId: resolvedUserId,
          name: data.name || 'Unknown',
          email: data.email || 'Unknown',
          zipCode: data.zipCode || 'Unknown',
          requestedAt: data.requestedAt,
          reviewedAt: data.reviewedAt,
          status: String(data.status || 'pending').toLowerCase(),
        };
      });

      const pendingRows = approvals
        .filter((item) => item.status === 'pending')
        .map((item) => `
          <div class="list-item">
            <div class="list-row">
              <div>
                <div class="list-title">${escapeHtml(item.name)}</div>
                <div class="list-meta">${escapeHtml(item.email)} | ${escapeHtml(item.zipCode)}</div>
                <div class="list-meta">Requested: ${formatDate(item.requestedAt)}</div>
              </div>
              <div class="list-actions">
                <button class="btn small" data-action="approve-user" data-user-id="${item.userId}" data-approval-id="${item.id}" data-email="${escapeHtml(item.email)}">Approve</button>
                <button class="btn secondary small" data-action="reject-user" data-user-id="${item.userId}" data-approval-id="${item.id}">Reject</button>
              </div>
            </div>
          </div>
        `);

      const rejectedRows = approvals
        .filter((item) => item.status === 'rejected')
        .map((item) => `
          <div class="list-item">
            <div class="list-row">
              <div>
                <div class="list-title">${escapeHtml(item.name)}</div>
                <div class="list-meta">${escapeHtml(item.email)} | ${escapeHtml(item.zipCode)}</div>
                <div class="list-meta">Requested: ${formatDate(item.requestedAt)}</div>
                <div class="list-meta" style="color:#b91c1c">Rejected: ${formatDate(item.reviewedAt)}</div>
              </div>
            </div>
          </div>
        `);

      list.innerHTML = pendingRows.length
        ? pendingRows.join('')
        : '<div class="empty-state">No pending approvals.</div>';

      if (rejectedList) {
        rejectedList.innerHTML = rejectedRows.length
          ? rejectedRows.join('')
          : '<div class="empty-state">No rejected requests.</div>';
      }

      list.querySelectorAll('[data-action="approve-user"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-user-id');
          const approvalId = btn.getAttribute('data-approval-id') || userId;
          if (!userId) return;
          try {
            await db.collection('users').doc(userId).update({
              status: 'approved',
              zipApproved: true,
              isDisabled: false,
              isBanned: false,
            });
            await db.collection('pendingApprovals').doc(approvalId).set({
              status: 'approved',
              reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
              reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
            }, { merge: true });
            await loadPendingApprovals();
          } catch (error) {
            alert('Failed to approve user.');
          }
        });
      });

      list.querySelectorAll('[data-action="reject-user"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = (btn.getAttribute('data-user-id') || '').trim();
          const approvalId = btn.getAttribute('data-approval-id') || userId;
          if (!approvalId) return;
          if (!confirm('Reject this approval request?')) return;

          try {
            // Always move request out of pending first.
            await db.collection('pendingApprovals').doc(approvalId).set({
              status: 'rejected',
              reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
              reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
            }, { merge: true });

            if (userId) {
              try {
                await db.collection('users').doc(userId).set({
                  status: 'rejected',
                  zipApproved: false,
                  isDisabled: true,
                }, { merge: true });
              } catch (userUpdateError) {
                console.warn('Approval rejected but user profile update failed:', userUpdateError);
              }
            }

            await loadPendingApprovals();
          } catch (error) {
            console.error('Reject approval error:', error);
            alert('Failed to reject user.');
          }
        });
      });
    } catch (error) {
      console.error('Pending approvals load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load pending approvals.</div>';
      if (rejectedList) {
        rejectedList.innerHTML = '<div class="empty-state">Failed to load rejected requests.</div>';
      }
    }
  }

  async function loadPendingListings() {
    const list = document.getElementById('pendingListingsList');
    list.innerHTML = '<div class="empty-state">Loading pending listings...</div>';

    try {
      const [pendingSnap, approvedSnap] = await Promise.all([
        db.collection('listings').where('status', '==', 'pending').get(),
        db.collection('listings').where('status', '==', 'approved').get(),
      ]);

      const pendingListings = pendingSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        type: 'listing',
        ...docSnap.data(),
      }));

      const approvedListings = approvedSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const sortByDate = (a, b) => {
        const aTime = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      };
      pendingListings.sort(sortByDate);
      approvedListings.sort(sortByDate);

      const pendingHtml = pendingListings.length === 0
        ? '<div class="empty-state">No pending listings.</div>'
        : pendingListings.map((data) => `
          <div class="list-item">
            <div class="list-row">
              <div>
                <div class="list-title">${escapeHtml(data.title || 'Untitled Listing')}</div>
                <div class="list-meta">Seller: ${escapeHtml(data.sellerName || 'Unknown')} | ${escapeHtml(data.sellerEmail || 'Unknown')}</div>
                <div class="list-meta">Created: ${formatDate(data.createdAt)}</div>
                ${data.featureRequested === true && String(data.featurePaymentStatus || '').toLowerCase() === 'paid'
                  ? '<div class="list-meta" style="color:#b45309;font-weight:600;">⭐ Featured payment received. Approving this listing will also approve its featured placement.</div>'
                  : ''}
              </div>
              <div class="list-actions">
                <button class="btn small" data-action="approve-item" data-type="listing" data-id="${data.id}">Approve</button>
                <button class="btn secondary small" data-action="reject-item" data-type="listing" data-id="${data.id}">Reject</button>
                <button class="btn danger small" data-action="delete-item" data-type="listing" data-id="${data.id}">Delete</button>
              </div>
            </div>
          </div>
        `).join('');

      const approvedHtml = approvedListings.length === 0
        ? '<div class="empty-state">No approved listings.</div>'
        : approvedListings.map((data) => {
          const featured = data.isFeatured === true || String(data.isFeatured || '').toLowerCase() === 'true';
          const featurePill = featured
            ? '<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:8px;background:#ecfeff;color:#155e75;border:1px solid #67e8f9;">FEATURED</span>'
            : '';
          return `
            <div class="list-item">
              <div class="list-row">
                <div>
                  <div class="list-title">${escapeHtml(data.title || 'Untitled Listing')} ${featurePill}</div>
                  <div class="list-meta">Seller: ${escapeHtml(data.sellerName || 'Unknown')} | ${escapeHtml(data.sellerEmail || 'Unknown')}</div>
                  <div class="list-meta">Approved: ${formatDate(data.approvedAt || data.createdAt)}</div>
                </div>
                <div class="list-actions">
                  <button class="btn secondary small" data-action="reject-approved-listing" data-id="${data.id}">Revoke Approval</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

      list.innerHTML = `
        <div style="font-weight:700;color:#334155;margin:2px 0 8px;">Pending Listings</div>
        ${pendingHtml}
        <div style="font-weight:700;color:#334155;margin:18px 0 8px;">Approved Listings</div>
        ${approvedHtml}
      `;

      list.querySelectorAll('[data-action="approve-item"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          try {
            const listingDoc = await db.collection('listings').doc(id).get();
            const listingData = listingDoc.exists ? (listingDoc.data() || {}) : {};
            const hasPaidFeatureRequest =
              listingData.featureRequested === true &&
              String(listingData.featurePaymentStatus || '').toLowerCase() === 'paid';

            await db.collection('listings').doc(id).update({ status: 'approved' });

            if (hasPaidFeatureRequest) {
              const purchasesSnap = await db.collection('featurePurchases')
                .where('listingId', '==', id)
                .get();

              const pendingPurchaseDocs = purchasesSnap.docs.filter((docSnap) => {
                const data = docSnap.data() || {};
                return String(data.status || 'pending').toLowerCase() === 'pending';
              });

              if (pendingPurchaseDocs.length > 0) {
                const batch = db.batch();
                pendingPurchaseDocs.forEach((docSnap) => {
                  batch.update(docSnap.ref, {
                    status: 'completed',
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    verificationSource: 'admin_listing_approval',
                  });
                });
                await batch.commit();
              }
            }

            loadPendingListings();
          } catch (error) { alert('Failed to approve listing.'); }
        });
      });

      list.querySelectorAll('[data-action="reject-item"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          try {
            await db.collection('listings').doc(id).update({ status: 'rejected' });
            loadPendingListings();
          } catch (error) { alert('Failed to reject listing.'); }
        });
      });

      list.querySelectorAll('[data-action="delete-item"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Delete this listing (cannot be undone)?')) return;
          try {
            await db.collection('listings').doc(id).update({ status: 'deleted' });
            loadPendingListings();
          } catch (error) { alert('Failed to delete listing.'); }
        });
      });

      list.querySelectorAll('[data-action="reject-approved-listing"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Revoke approval and move this listing back to pending?')) return;
          try {
            await db.collection('listings').doc(id).update({ status: 'pending' });
            loadPendingListings();
          } catch (error) { alert('Failed to revoke listing approval.'); }
        });
      });
    } catch (error) {
      console.error('Pending listings load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load pending listings.</div>';
    }
  }

  async function loadPendingServices() {
    const list = document.getElementById('pendingServicesList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state">Loading pending services...</div>';

    try {
      const [pendingSnap, approvedSnap] = await Promise.all([
        db.collection('services').where('approvalStatus', '==', 'pending').get(),
        db.collection('services').where('isApproved', '==', true).get(),
      ]);

      const pendingServices = pendingSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aT = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bT = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bT - aT;
        });

      const approvedServices = approvedSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.isActive !== false)
        .sort((a, b) => {
          const aT = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bT = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bT - aT;
        });

      const pendingHtml = pendingServices.length === 0
        ? '<div class="empty-state">No pending services.</div>'
        : pendingServices.map((data) => `
          <div class="list-item">
            <div class="list-row">
              <div>
                <div class="list-title">${escapeHtml(data.serviceName || 'Untitled Service')}</div>
                <div class="list-meta">Provider: ${escapeHtml(data.providerName || 'Unknown')} | ${escapeHtml(data.contactEmail || 'No email')}</div>
                <div class="list-meta">Created: ${formatDate(data.createdAt)}</div>
              </div>
              <div class="list-actions">
                <button class="btn small" data-action="approve-service" data-id="${data.id}">Approve</button>
                <button class="btn secondary small" data-action="reject-service" data-id="${data.id}">Reject</button>
                <button class="btn danger small" data-action="delete-service" data-id="${data.id}">Delete</button>
              </div>
            </div>
          </div>
        `).join('');

      const approvedHtml = approvedServices.length === 0
        ? '<div class="empty-state">No approved services.</div>'
        : approvedServices.map((service) => {
          const featured = service.isFeatured === true || service.isFeatured === 1 || String(service.isFeatured || '').toLowerCase() === 'true';
          const featurePill = featured
            ? '<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:8px;background:#ecfeff;color:#155e75;border:1px solid #67e8f9;">FEATURED</span>'
            : '';
          return `
            <div class="list-item">
              <div class="list-row">
                <div>
                  <div class="list-title">${escapeHtml(service.serviceName || 'Untitled Service')} ${featurePill}</div>
                  <div class="list-meta">Provider: ${escapeHtml(service.providerName || 'Unknown')} | ${escapeHtml(service.contactEmail || 'No email')}</div>
                  <div class="list-meta">Created: ${formatDate(service.createdAt)}</div>
                </div>
                <div class="list-actions">
                  <button class="${featured ? 'btn secondary small' : 'btn small'}" data-action="toggle-service-feature" data-id="${service.id}" data-featured="${featured ? 'true' : 'false'}">${featured ? 'Unfeature' : 'Feature'}</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

      list.innerHTML = `
        <div style="font-weight:700;color:#334155;margin:2px 0 8px;">Pending Services</div>
        ${pendingHtml}
        <div style="font-weight:700;color:#334155;margin:18px 0 8px;">Approved Services — Feature Controls</div>
        ${approvedHtml}
      `;

      list.querySelectorAll('[data-action="approve-service"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          try {
            await db.collection('services').doc(id).update({
              isApproved: true, approvalStatus: 'approved', isActive: true,
              approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            loadPendingServices();
          } catch (error) { alert('Failed to approve service.'); }
        });
      });

      list.querySelectorAll('[data-action="reject-service"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          try {
            await db.collection('services').doc(id).update({
              isApproved: false, approvalStatus: 'rejected', isActive: false,
              rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            loadPendingServices();
          } catch (error) { alert('Failed to reject service.'); }
        });
      });

      list.querySelectorAll('[data-action="delete-service"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Delete this service (cannot be undone)?')) return;
          try {
            await db.collection('services').doc(id).update({
              isActive: false, approvalStatus: 'deleted',
              deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            loadPendingServices();
          } catch (error) { alert('Failed to delete service.'); }
        });
      });

      list.querySelectorAll('[data-action="toggle-service-feature"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const featuredNow = btn.getAttribute('data-featured') === 'true';
          if (!id) return;
          try {
            await db.collection('services').doc(id).update({
              isFeatured: !featuredNow,
              featuredAt: !featuredNow ? firebase.firestore.FieldValue.serverTimestamp() : null,
            });
            loadPendingServices();
          } catch (error) { alert('Failed to update feature status.'); }
        });
      });
    } catch (error) {
      console.error('Pending services load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load pending services.</div>';
    }
  }

  async function loadPendingBusinessProfiles() {
    const list = document.getElementById('pendingBusinessProfilesList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state">Loading business profiles...</div>';

    try {
      const snap = await db.collection('businessLocal').get();

      const sortByDate = (a, b) => {
        const aData = a.data ? a.data() : a;
        const bData = b.data ? b.data() : b;
        const aTime = aData?.createdAt?.toDate ? aData.createdAt.toDate().getTime() : 0;
        const bTime = bData?.createdAt?.toDate ? bData.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      };

      const pendingDocs = snap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isApproved === true) return false;
        const status = String(data.approvalStatus || '').toLowerCase();
        return status !== 'rejected' && status !== 'deleted';
      }).sort(sortByDate);

      const approvedDocs = snap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        return data.isApproved === true;
      }).sort(sortByDate);

      const renderPendingCard = (docSnap) => {
        const data = docSnap.data();
        const location = [data.businessCity, data.businessState].filter(Boolean).join(', ') || 'No location provided';
        const debugApproval = Object.prototype.hasOwnProperty.call(data, 'isApproved') ? String(data.isApproved) : 'unset';
        const debugVerified = Object.prototype.hasOwnProperty.call(data, 'isVerified') ? String(data.isVerified) : 'unset';
        const debugStatus = data.approvalStatus ? String(data.approvalStatus) : 'unset';
        const debugOwner = data.userId || 'unset';
        const verificationDocs = Array.isArray(data.verificationDocumentUrls)
          ? data.verificationDocumentUrls.filter((url) => typeof url === 'string' && url.trim() !== '')
          : (typeof data.verificationDocumentUrls === 'string' && data.verificationDocumentUrls.trim() !== ''
            ? [data.verificationDocumentUrls.trim()]
            : []);
        return `
          <div class="list-item" style="background: #fffbf0; border-left: 4px solid #ffc107;">
            <div class="list-row">
              <div style="flex: 1;">
                <div class="list-meta" style="color: #d97706; font-weight: 600; margin-bottom: 8px;">⚠️ PENDING APPROVAL</div>
                <div class="list-title">${escapeHtml(data.businessName || 'Unnamed Business')}</div>
                <div class="list-meta">Submitted by: ${escapeHtml(data.userEmail || 'Unknown')}</div>
                <div class="list-meta">Location: ${escapeHtml(location)}</div>
                <div class="list-meta">Category: ${escapeHtml(data.businessCategory || 'N/A')}</div>
                <div class="list-meta">Submitted: ${formatDate(data.createdAt)}</div>
                <div class="list-meta" style="font-size: 16px; color: #64748b; margin-top: 4px;">Debug: docId=${escapeHtml(docSnap.id)} | userId=${escapeHtml(debugOwner)} | isApproved=${escapeHtml(debugApproval)} | approvalStatus=${escapeHtml(debugStatus)} | isVerified=${escapeHtml(debugVerified)}</div>
                ${data.businessDescription ? `<div class="list-meta" style="margin-top: 6px;">Description: ${escapeHtml(data.businessDescription.substring(0, 120))}${data.businessDescription.length > 120 ? '...' : ''}</div>` : ''}
                ${verificationDocs.length > 0
                  ? `<div class="list-meta" style="margin-top: 8px;">Verification Documents: ${verificationDocs.map((url, idx) => `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">Document ${idx + 1}</a>`).join(' | ')}</div>`
                  : '<div class="list-meta" style="margin-top: 8px;">Verification Documents: None submitted</div>'}
              </div>
              <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
                ${verificationDocs.length > 0 ? `<button class="btn secondary small" data-action="view-business-docs" data-file-urls="${verificationDocs.map((url) => encodeURIComponent(url)).join(',')}">View Files</button>` : ''}
                <button class="btn small" data-action="approve-business-profile" data-id="${docSnap.id}" style="background: #10b981; color: white; border: none;">✓ Approve</button>
                <button class="btn danger small" data-action="reject-business-profile" data-id="${docSnap.id}">✗ Reject</button>
              </div>
            </div>
          </div>
        `;
      };

      const renderApprovedCard = (docSnap) => {
        const data = docSnap.data();
        const location = [data.businessCity, data.businessState].filter(Boolean).join(', ') || 'No location';
        const verifiedPill = data.isVerified
          ? '<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:8px;background:#dcfce7;color:#15803d;border:1px solid #86efac;">VERIFIED</span>'
          : '';
        return `
          <div class="list-item" style="background: #f0fdf4; border-left: 4px solid #22c55e;">
            <div class="list-row">
              <div style="flex: 1;">
                <div class="list-meta" style="color: #15803d; font-weight: 600; margin-bottom: 8px;">✅ APPROVED</div>
                <div class="list-title">${escapeHtml(data.businessName || 'Unnamed Business')} ${verifiedPill}</div>
                <div class="list-meta">Owner: ${escapeHtml(data.userEmail || 'Unknown')}</div>
                <div class="list-meta">Location: ${escapeHtml(location)}</div>
                <div class="list-meta">Category: ${escapeHtml(data.businessCategory || 'N/A')}</div>
                <div class="list-meta">Approved: ${formatDate(data.approvedAt || data.createdAt)}</div>
              </div>
              <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn secondary small" data-action="revoke-business-approval" data-id="${docSnap.id}">Revoke Approval</button>
                ${!data.isVerified ? `<button class="btn small" data-action="verify-approved-business" data-id="${docSnap.id}" style="background:#3b82f6;color:white;border:none;">Mark Verified</button>` : ''}
              </div>
            </div>
          </div>
        `;
      };

      const pendingHtml = pendingDocs.length === 0
        ? '<div class="empty-state">No pending business profiles.</div>'
        : pendingDocs.map(renderPendingCard).join('');

      const approvedHtml = approvedDocs.length === 0
        ? '<div class="empty-state">No approved business profiles.</div>'
        : approvedDocs.map(renderApprovedCard).join('');

      list.innerHTML = `
        <div style="font-weight:700;color:#334155;margin:2px 0 8px;">Pending Business Profiles</div>
        ${pendingHtml}
        <div style="font-weight:700;color:#334155;margin:18px 0 8px;">Approved Business Profiles</div>
        ${approvedHtml}
      `;

      list.querySelectorAll('[data-action="approve-business-profile"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const profileId = btn.getAttribute('data-id');
          if (!profileId) return;
          if (!confirm('Approve this business profile and make it publicly visible?')) return;
          const shouldVerify = confirm('Mark this business as verified local and show the verified badge? Click Cancel to approve without badge.');
          try {
            await db.collection('businessLocal').doc(profileId).update({
              isApproved: true,
              approvalStatus: 'approved',
              isActive: true,
              isVerified: shouldVerify,
              approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
              approvedBy: auth.currentUser ? auth.currentUser.uid : null,
              verifiedAt: shouldVerify ? firebase.firestore.FieldValue.serverTimestamp() : null,
              verifiedBy: shouldVerify ? (auth.currentUser ? auth.currentUser.uid : null) : null,
            });
            loadPendingBusinessProfiles();
            loadDashboardCounts();
          } catch (error) {
            console.error('Error approving business profile:', error);
            alert('Failed to approve business profile: ' + (error.message || 'Unknown error'));
          }
        });
      });

      list.querySelectorAll('[data-action="reject-business-profile"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const profileId = btn.getAttribute('data-id');
          if (!profileId) return;
          const reason = prompt('Enter rejection reason (optional):');
          if (reason === null) return;
          if (!confirm('Reject and remove this business profile submission?')) return;
          try {
            await db.collection('businessLocal').doc(profileId).update({
              isApproved: false,
              approvalStatus: 'rejected',
              isActive: false,
              rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
              rejectedBy: auth.currentUser ? auth.currentUser.uid : null,
              rejectionReason: reason || 'No reason provided',
            });
            loadPendingBusinessProfiles();
            loadDashboardCounts();
          } catch (error) {
            console.error('Error rejecting business profile:', error);
            alert('Failed to reject business profile: ' + (error.message || 'Unknown error'));
          }
        });
      });

      list.querySelectorAll('[data-action="revoke-business-approval"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const profileId = btn.getAttribute('data-id');
          if (!profileId) return;
          if (!confirm('Revoke approval and move this business back to pending?')) return;
          try {
            await db.collection('businessLocal').doc(profileId).update({
              isApproved: false,
              approvalStatus: 'pending',
              isActive: false,
              isVerified: false,
            });
            loadPendingBusinessProfiles();
            loadDashboardCounts();
          } catch (error) { alert('Failed to revoke business approval.'); }
        });
      });

      list.querySelectorAll('[data-action="verify-approved-business"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const profileId = btn.getAttribute('data-id');
          if (!profileId) return;
          if (!confirm('Mark this business as verified and show the verified badge?')) return;
          try {
            await db.collection('businessLocal').doc(profileId).update({
              isVerified: true,
              verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
              verifiedBy: auth.currentUser ? auth.currentUser.uid : null,
            });
            loadPendingBusinessProfiles();
            loadVerifiedBusinessesCount();
          } catch (error) { alert('Failed to verify business.'); }
        });
      });

      list.querySelectorAll('[data-action="view-business-docs"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const serializedUrls = btn.getAttribute('data-file-urls') || '';
          openUploadedFiles(serializedUrls);
        });
      });
    } catch (error) {
      console.error('Pending business profiles load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load business profiles.</div>';
    }
  }

  async function loadReportedMessages() {
    const list = document.getElementById('reportedMessagesList');
    list.innerHTML = '<div class="empty-state">Loading reported messages...</div>';

    try {
      const snap = await db.collection('reportedMessages').get();
      state.reports.messages = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderReports('messages');
    } catch (error) {
      console.error('Reported messages load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load reported messages.</div>';
    }
  }

  async function loadReportedListings() {
    const list = document.getElementById('reportedListingsList');
    list.innerHTML = '<div class="empty-state">Loading reported listings...</div>';

    try {
      const snap = await db.collection('reportedListings').get();
      state.reports.listings = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderReports('listings');
    } catch (error) {
      console.error('Reported listings load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load reported listings.</div>';
    }
  }

  async function loadAutoApprovals() {
    const list = document.getElementById('autoApprovalsList');
    const filterSelect = document.getElementById('autoApprovalsFilter');
    const refreshBtn = document.getElementById('refreshAutoApprovals');
    
    list.innerHTML = '<div class="empty-state">Loading auto-approvals...</div>';

    try {
      const snap = await db.collection('adminNotifications')
        .where('type', 'in', ['auto_approved_service', 'auto_approved_job'])
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const notifications = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-state">No auto-approved items yet.</div>';
        return;
      }

      // Setup filter handler
      if (filterSelect && !filterSelect.hasListener) {
        filterSelect.hasListener = true;
        filterSelect.addEventListener('change', () => {
          renderAutoApprovals(notifications, list, filterSelect.value);
        });
      }

      // Setup refresh handler
      if (refreshBtn && !refreshBtn.hasListener) {
        refreshBtn.hasListener = true;
        refreshBtn.addEventListener('click', loadAutoApprovals);
      }

      renderAutoApprovals(notifications, list, filterSelect ? filterSelect.value : 'all');
    } catch (error) {
      console.error('Auto-approvals load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load auto-approvals.</div>';
    }
  }

  function renderAutoApprovals(notifications, list, filter) {
    let filtered = notifications;

    if (filter === 'service') {
      filtered = notifications.filter((n) => n.type === 'auto_approved_service');
    } else if (filter === 'job') {
      filtered = notifications.filter((n) => n.type === 'auto_approved_job');
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">No ${filter !== 'all' ? filter + 's' : 'auto-approved items'} found.</div>`;
      return;
    }

    list.innerHTML = filtered.map((notif) => {
      const isService = notif.type === 'auto_approved_service';
      const itemName = isService ? notif.serviceName : notif.jobTitle;
      const itemId = isService ? notif.serviceId : notif.jobId;
      const providerName = isService ? notif.providerName : notif.companyName;
      const createdDate = formatDate(notif.createdAt);
      const businessName = notif.businessName || 'Unknown Business';
      const typeLabel = isService ? '⚙️ Service' : '💼 Job';
      const typeColor = isService ? '#0ea5e9' : '#f59e0b';

      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(itemName || 'Untitled')}</div>
              <div class="list-meta">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; background: ${typeColor}20; color: ${typeColor}; font-size: 11px; font-weight: 700; margin-right: 8px;">${typeLabel}</span>
                ${isService ? `Provider: ${escapeHtml(providerName || 'N/A')}` : `Company: ${escapeHtml(providerName || 'N/A')}`}
              </div>
              <div class="list-meta">Business: ${escapeHtml(businessName)} | Auto-approved: ${createdDate}</div>
              ${itemId ? `<div class="list-meta">Item ID: ${escapeHtml(itemId)}</div>` : ''}
            </div>
            <div class="list-actions">
              <button class="btn small" data-item-id="${itemId}" data-item-type="${isService ? 'service' : 'job'}">View Item</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers for "View Item" buttons
    list.querySelectorAll('.btn.small[data-item-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item-id');
        const itemType = btn.getAttribute('data-item-type');
        if (!itemId) return;

        if (itemType === 'service') {
          // Open service in preview or admin panel
          window.open(`/public/admin.html?viewService=${itemId}`, '_blank');
        } else if (itemType === 'job') {
          // Open job in preview
          window.open(`/public/admin.html?viewJob=${itemId}`, '_blank');
        }
      });
    });
  }

  function renderReports(type) {
    const list = document.getElementById(type === 'messages' ? 'reportedMessagesList' : 'reportedListingsList');
    const filter = state.reportFilters[type];
    const rows = state.reports[type].filter((report) => {
      if (filter === 'pending') {
        return report.status === 'pending';
      }
      return report.status !== 'pending';
    });

    if (rows.length === 0) {
      list.innerHTML = '<div class="empty-state">No reports found.</div>';
      return;
    }

    list.innerHTML = rows.map((report) => {
      const title = type === 'messages' ? (report.messageText || 'Message report') : (report.listingTitle || 'Listing report');
      const detail = type === 'messages' ? `Thread: ${report.threadId || 'N/A'}` : `Listing ID: ${report.listingId || 'N/A'}`;
      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(title)}</div>
              <div class="list-meta">Reason: ${escapeHtml(report.reason || 'N/A')} | Status: ${escapeHtml(report.status || 'pending')}</div>
              <div class="list-meta">${escapeHtml(detail)} | Reported: ${formatDate(report.createdAt)}</div>
            </div>
            <div class="list-actions">
              <button class="btn small" data-action="open-report" data-type="${type}" data-id="${report.id}">Review</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="open-report"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reportId = btn.getAttribute('data-id');
        const reportType = btn.getAttribute('data-type');
        if (!reportId || !reportType) return;
        openReportModal(reportType, reportId);
      });
    });
  }

  function openReportModal(type, reportId) {
    const report = state.reports[type].find((item) => item.id === reportId);
    if (!report) return;

    state.selectedReport = report;
    state.selectedReportType = type;

    modalTitle.textContent = type === 'messages' ? 'Reported Message' : 'Reported Listing';

    const detailLines = [];
    if (type === 'messages') {
      detailLines.push(`<div class="list-meta">Message: ${escapeHtml(report.messageText || 'N/A')}</div>`);
      detailLines.push(`<div class="list-meta">Thread ID: ${escapeHtml(report.threadId || 'N/A')}</div>`);
      detailLines.push(`<div class="list-meta">Reported User: ${escapeHtml(report.reportedUser || 'N/A')}</div>`);
    } else {
      detailLines.push(`<div class="list-meta">Listing: ${escapeHtml(report.listingTitle || 'N/A')}</div>`);
      detailLines.push(`<div class="list-meta">Listing ID: ${escapeHtml(report.listingId || 'N/A')}</div>`);
      detailLines.push(`<div class="list-meta">Seller Email: ${escapeHtml(report.sellerEmail || 'N/A')}</div>`);
    }
    detailLines.push(`<div class="list-meta">Reason: ${escapeHtml(report.reason || 'N/A')}</div>`);
    detailLines.push(`<div class="list-meta">Details: ${escapeHtml(report.details || 'N/A')}</div>`);

    let link = '';
    if (type === 'messages' && report.threadId) {
      link = `<div class="list-meta"><a href="messages.html?threadId=${encodeURIComponent(report.threadId)}" target="_blank">Open Thread</a></div>`;
    }
    if (type === 'listings' && report.listingId) {
      link = `<div class="list-meta"><a href="single-listing.html?id=${encodeURIComponent(report.listingId)}" target="_blank">View Listing</a></div>`;
    }

    modalBody.innerHTML = `
      <div class="list-title">${escapeHtml(type === 'messages' ? 'Message Report' : 'Listing Report')}</div>
      ${detailLines.join('')}
      ${link}
    `;

    modalStatus.value = report.status && report.status !== 'pending' ? report.status : 'reviewed';
    modalNotes.value = report.adminNotes || '';

    modalBackdrop.classList.add('active');
  }

  async function saveReportUpdate() {
    if (!state.selectedReport || !state.selectedReportType) return;
    try {
      const collectionName = state.selectedReportType === 'messages' ? 'reportedMessages' : 'reportedListings';
      await db.collection(collectionName).doc(state.selectedReport.id).update({
        status: modalStatus.value,
        adminNotes: modalNotes.value || '',
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      modalBackdrop.classList.remove('active');
      if (state.selectedReportType === 'messages') {
        loadReportedMessages();
      } else {
        loadReportedListings();
      }
    } catch (error) {
      alert('Failed to update report.');
    }
  }

  function initReportFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-target');
        const filter = tab.getAttribute('data-filter');
        if (!target || !filter) return;

        document.querySelectorAll(`.filter-tab[data-target="${target}"]`).forEach((btn) => {
          btn.classList.toggle('active', btn === tab);
        });

        state.reportFilters[target] = filter;
        renderReports(target);
      });
    });
  }

  // ─── CSV EXPORT HELPERS ────────────────────────────────────────────────────

  function toTimestamp(dateStr) {
    // Returns a JS Date from a date-input string, or null
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function inDateRange(ts, fromDate, toDate) {
    if (!ts) return true;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (fromDate && d < fromDate) return false;
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (d > endOfDay) return false;
    }
    return true;
  }

  function downloadCSV(filename, rows) {
    if (!rows.length) { alert('No records found for the selected filters.'); return; }
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US');
  }

  window.exportDigestSubscribers = async function () {
    const from = toTimestamp(document.getElementById('digestFrom')?.value);
    const to = toTimestamp(document.getElementById('digestTo')?.value);
    try {
      const snap = await db.collection('users').where('digestNotification', '==', true).get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!inDateRange(d.createdAt, from, to)) return;
        rows.push({
          'User ID': doc.id,
          'Name': d.name || d.displayName || '',
          'Email': d.email || '',
          'Account Type': d.accountType || '',
          'Zip Code': d.zipCode || '',
          'Status': d.status || '',
          'Digest Opt-In': 'Yes',
          'Signed Up': formatDate(d.createdAt),
        });
      });
      downloadCSV(`digest-subscribers-${Date.now()}.csv`, rows);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  window.exportUpgradeTargets = async function () {
    const from = toTimestamp(document.getElementById('upgradeFrom')?.value);
    const to = toTimestamp(document.getElementById('upgradeTo')?.value);
    const statusFilter = document.getElementById('upgradeStatusFilter')?.value;
    try {
      let query = db.collection('businessLocal').where('businessTier', '==', 'free');
      if (statusFilter) query = query.where('approvalStatus', '==', statusFilter);
      const snap = await query.get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!inDateRange(d.updatedAt || d.createdAt, from, to)) return;
        rows.push({
          'User ID': d.userId || doc.id,
          'Email': d.userEmail || d.businessEmail || '',
          'Business Name': d.businessName || '',
          'Business Category': d.businessCategory || '',
          'Business Tier': d.businessTier || 'free',
          'Approval Status': d.approvalStatus || '',
          'City': d.businessCity || '',
          'State': d.businessState || '',
          'Zip': d.businessZipcode || '',
          'Profile Created': formatDate(d.updatedAt || d.createdAt),
        });
      });
      downloadCSV(`upgrade-targets-${Date.now()}.csv`, rows);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  window.exportAllUsers = async function () {
    const from = toTimestamp(document.getElementById('allUsersFrom')?.value);
    const to = toTimestamp(document.getElementById('allUsersTo')?.value);
    const statusFilter = document.getElementById('allUsersStatusFilter')?.value;
    try {
      let query = db.collection('users');
      if (statusFilter) query = query.where('status', '==', statusFilter);
      const snap = await query.get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!inDateRange(d.createdAt, from, to)) return;
        rows.push({
          'User ID': doc.id,
          'Name': d.name || d.displayName || '',
          'Email': d.email || '',
          'Account Type': d.accountType || '',
          'Subscription Plan': d.subscriptionPlan || '',
          'Status': d.status || '',
          'Zip Code': d.zipCode || '',
          'Digest Opt-In': d.digestNotification ? 'Yes' : 'No',
          'Signed Up': formatDate(d.createdAt),
          'Last Login': formatDate(d.lastLoginAt),
        });
      });
      downloadCSV(`all-users-${Date.now()}.csv`, rows);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  window.exportBusinessUsers = async function () {
    const from = toTimestamp(document.getElementById('bizUsersFrom')?.value);
    const to = toTimestamp(document.getElementById('bizUsersTo')?.value);
    try {
      const snap = await db.collection('users').where('accountType', '==', 'business').get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!inDateRange(d.createdAt, from, to)) return;
        rows.push({
          'User ID': doc.id,
          'Name': d.name || d.displayName || '',
          'Email': d.email || '',
          'Business Name': d.businessName || '',
          'Business Tier': d.businessTier || 'free',
          'Subscription Plan': d.subscriptionPlan || '',
          'Subscription Status': d.subscriptionStatus || '',
          'Status': d.status || '',
          'Zip Code': d.zipCode || '',
          'Signed Up': formatDate(d.createdAt),
          'Upgraded At': formatDate(d.upgradedAt),
        });
      });
      downloadCSV(`business-users-${Date.now()}.csv`, rows);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  window.exportPurchases = async function () {
    const from = toTimestamp(document.getElementById('purchasesFrom')?.value);
    const to = toTimestamp(document.getElementById('purchasesTo')?.value);
    const typeFilter = document.getElementById('purchasesTypeFilter')?.value;
    const statusFilter = document.getElementById('purchasesStatusFilter')?.value;
    try {
      let query = db.collection('featurePurchases').orderBy('purchasedAt', 'desc');
      const snap = await query.get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!inDateRange(d.purchasedAt, from, to)) return;
        const itemType = String(d.itemType || (d.serviceId ? 'service' : 'listing')).toLowerCase();
        if (typeFilter && itemType !== typeFilter) return;
        if (statusFilter && (d.status || '') !== statusFilter) return;
        rows.push({
          'Purchase ID': doc.id,
          'Purchase Date': formatDate(d.purchasedAt),
          'User ID': d.userId || '',
          'User Email': d.userEmail || '',
          'Item Type': itemType,
          'Listing/Service ID': d.listingId || d.serviceId || '',
          'Amount': d.amount || d.price || '',
          'Currency': d.currency || 'USD',
          'Status': d.status || '',
          'Payment Method': d.paymentMethod || '',
          'Stripe Payment ID': d.stripePaymentIntentId || d.paymentIntentId || '',
        });
      });
      downloadCSV(`purchases-${Date.now()}.csv`, rows);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  window.exportServiceListingPosters = async function () {
    const from = toTimestamp(document.getElementById('serviceListingsFrom')?.value);
    const to = toTimestamp(document.getElementById('serviceListingsTo')?.value);
    const purchaseFilter = document.getElementById('serviceListingsPurchaseFilter')?.value;

    try {
      const [servicesSnap, servicePurchasesSnap, usersSnap] = await Promise.all([
        db.collection('services').get(),
        db.collection('featurePurchases').where('itemType', '==', 'service').get(),
        db.collection('users').get(),
      ]);

      const userMap = new Map(usersSnap.docs.map((d) => [d.id, d.data() || {}]));

      const purchasedServiceIds = new Set();
      servicePurchasesSnap.forEach((doc) => {
        const d = doc.data() || {};
        const status = String(d.status || '').toLowerCase();
        const serviceId = String(d.serviceId || '').trim();
        if (!serviceId) return;
        if (status === 'completed' || status === 'paid' || status === 'success') {
          purchasedServiceIds.add(serviceId);
        }
      });

      const rows = [];
      servicesSnap.forEach((doc) => {
        const d = doc.data() || {};
        if (String(d.approvalStatus || '').toLowerCase() === 'deleted') return;
        if (!inDateRange(d.createdAt, from, to)) return;

        const serviceId = doc.id;
        const ownerId = getServiceOwnerId(d);
        const ownerData = userMap.get(ownerId) || {};

        const purchased =
          String(d.featurePaymentStatus || '').toLowerCase() === 'paid' ||
          d.isFeatured === true ||
          purchasedServiceIds.has(serviceId);

        if (purchaseFilter === 'purchased' && !purchased) return;
        if (purchaseFilter === 'free' && purchased) return;

        const address = [
          String(d.serviceArea || '').trim(),
          String(d.city || '').trim(),
          String(d.zipCode || '').trim(),
        ].filter(Boolean).join(', ');

        rows.push({
          'Service ID': serviceId,
          'Posted Date': formatDate(d.createdAt),
          'Poster User ID': ownerId || '',
          'Provider Name': d.providerName || ownerData.name || ownerData.displayName || '',
          'Service Name': d.serviceName || '',
          'Category': d.category || '',
          'Email': d.contactEmail || ownerData.email || '',
          'Address': address,
          'Purchased Feature': purchased ? 'Yes' : 'No',
          'Paid/Free': purchased ? 'Paid' : 'Free',
          'Approval Status': d.approvalStatus || '',
          'Preferred Contact Method': d.preferredContactMethod || '',
        });
      });

      downloadCSV(`service-listing-posters-${Date.now()}.csv`, rows);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  // ─── END CSV EXPORT HELPERS ──────────────────────────────────────────────────

  function initRefreshButtons() {
    document.getElementById('refreshAnalytics').addEventListener('click', loadAnalytics);
    document.getElementById('refreshHubAnalytics')?.addEventListener('click', loadHubAnalytics);
    document.getElementById('refreshBusinessUsers')?.addEventListener('click', loadBusinessUsers);
    document.getElementById('refreshServiceProviders')?.addEventListener('click', loadServiceProviders);
    document.getElementById('refreshBlocked').addEventListener('click', loadBlockedUsers);
    document.getElementById('refreshFeaturePurchasesListings')?.addEventListener('click', loadFeaturePurchasesListings);
    document.getElementById('refreshFeaturePurchasesServices')?.addEventListener('click', loadFeaturePurchasesServices);
    document.getElementById('refreshBusinessClaims')?.addEventListener('click', loadBusinessClaims);
    document.getElementById('refreshVerifiedBusinesses')?.addEventListener('click', loadVerifiedBusinesses);
    document.getElementById('refreshShopLocalSectionSettings')?.addEventListener('click', loadShopLocalSectionSettings);
    document.getElementById('refreshCommunitySettings')?.addEventListener('click', loadCommunitySettings);
    document.getElementById('refreshApprovals').addEventListener('click', loadPendingApprovals);
    document.getElementById('refreshListings').addEventListener('click', loadPendingListings);
    document.getElementById('refreshServices')?.addEventListener('click', loadPendingServices);
    document.getElementById('refreshPendingBusinessProfiles')?.addEventListener('click', loadPendingBusinessProfiles);
    document.getElementById('refreshAutoApprovals')?.addEventListener('click', loadAutoApprovals);
    
    // Featured listing purchase filter buttons
    document.getElementById('filterPendingListings')?.addEventListener('click', () => {
      currentListingPurchaseFilter = 'pending';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'listing'),
        'pending',
        'featurePurchasesListingsList',
        loadFeaturePurchasesListings
      );
    });
    
    document.getElementById('filterCompletedListings')?.addEventListener('click', () => {
      currentListingPurchaseFilter = 'completed';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'listing'),
        'completed',
        'featurePurchasesListingsList',
        loadFeaturePurchasesListings
      );
    });
    
    document.getElementById('filterAllListings')?.addEventListener('click', () => {
      currentListingPurchaseFilter = 'all';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'listing'),
        'all',
        'featurePurchasesListingsList',
        loadFeaturePurchasesListings
      );
    });

    // Featured service purchase filter buttons
    document.getElementById('filterPendingServices')?.addEventListener('click', () => {
      currentServicePurchaseFilter = 'pending';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'service'),
        'pending',
        'featurePurchasesServicesList',
        loadFeaturePurchasesServices
      );
    });

    document.getElementById('filterCompletedServices')?.addEventListener('click', () => {
      currentServicePurchaseFilter = 'completed';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'service'),
        'completed',
        'featurePurchasesServicesList',
        loadFeaturePurchasesServices
      );
    });

    document.getElementById('filterAllServices')?.addEventListener('click', () => {
      currentServicePurchaseFilter = 'all';
      displayFeaturePurchases(
        allFeaturePurchases.filter((p) => p.itemType === 'service'),
        'all',
        'featurePurchasesServicesList',
        loadFeaturePurchasesServices
      );
    });

    document.getElementById('filterClaimsPending')?.addEventListener('click', () => {
      currentBusinessClaimsFilter = 'pending';
      displayBusinessClaims(allBusinessClaims, currentBusinessClaimsFilter);
    });

    document.getElementById('filterClaimsApproved')?.addEventListener('click', () => {
      currentBusinessClaimsFilter = 'approved';
      displayBusinessClaims(allBusinessClaims, currentBusinessClaimsFilter);
    });

    document.getElementById('filterClaimsRejected')?.addEventListener('click', () => {
      currentBusinessClaimsFilter = 'rejected';
      displayBusinessClaims(allBusinessClaims, currentBusinessClaimsFilter);
    });

    document.getElementById('filterClaimsAll')?.addEventListener('click', () => {
      currentBusinessClaimsFilter = 'all';
      displayBusinessClaims(allBusinessClaims, currentBusinessClaimsFilter);
    });
  }

  function initModal() {
    modalClose.addEventListener('click', () => modalBackdrop.classList.remove('active'));
    modalBackdrop.addEventListener('click', (event) => {
      if (event.target === modalBackdrop) {
        modalBackdrop.classList.remove('active');
      }
    });
    modalSave.addEventListener('click', saveReportUpdate);
  }

  const SECTION_TITLES = {
    'analytics': 'Analytics',
    'pending-listings': 'Pending Listings',
    'pending-services': 'Pending Services',
    'reported-listings': 'Reported Listings',
    'reported-messages': 'Reported Messages',
    'business-users': 'Business Users',
    'service-providers': 'Service Providers',
    'feature-purchases-listings': 'Featured Listing Purchases',
    'feature-purchases-services': 'Featured Service Purchases',
    'business-claims': 'Business Claims',
    'verified-businesses': 'Verified Businesses',
    'pending-business-profiles': 'Pending Business Profiles',
    'shop-local-section': 'Local Section Settings',
    'community-settings': 'Community Settings',
    'pending-approvals': 'Pending Approvals',
    'blocked': 'Blocked Users',
    'reports': 'Reports & Exports',
  };

  window.navigateToTab = function (tabId) {
    const hubEl = document.getElementById('adminHub');
    const sectionsEl = document.getElementById('adminSections');
    const titleEl = document.getElementById('adminSectionTitle');
    if (hubEl) hubEl.style.display = 'none';
    if (sectionsEl) sectionsEl.style.display = 'block';
    if (titleEl) titleEl.textContent = SECTION_TITLES[tabId] || '';
    setActiveTab(tabId);
    loadTab(tabId);
  };

  window.showAdminHub = function () {
    const hubEl = document.getElementById('adminHub');
    const sectionsEl = document.getElementById('adminSections');
    if (hubEl) hubEl.style.display = 'block';
    if (sectionsEl) sectionsEl.style.display = 'none';
  };

  function initAdminPanel() {
    initTabs();
    initReportFilters();
    initRefreshButtons();
    initModal();
    loadTopPriorityCounts();
    loadServiceProvidersCount();
    loadVerifiedBusinessesCount();
    loadDashboardCounts();
    loadHubAnalytics();
    document.getElementById('saveShopLocalSectionSettings')?.addEventListener('click', saveShopLocalSectionSettings);
    document.getElementById('saveCommunitySettings')?.addEventListener('click', saveCommunitySettings);
    document.getElementById('uploadSpotlightImageBtn')?.addEventListener('click', uploadSpotlightImage);
    // Hub is shown by default; each section loads on demand when its card is clicked.
  }

  if (!db || !auth) {
    setStatus('error', 'Firebase is not initialized. Check firebase-config.js and SDK scripts.');
    showContent(false);
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus('error', 'Please sign in to access the admin panel.');
      showContent(false);
      return;
    }

    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      if (!userData || userData.role !== 'admin') {
        setStatus('error', 'Access denied. You are not an admin.');
        showContent(false);
        return;
      }

      setStatus('success', 'Admin access granted.');
      showContent(true);
      initAdminPanel();
    } catch (error) {
      console.error('Admin auth error:', error);
      setStatus('error', 'Unable to verify admin access.');
      showContent(false);
    }
  });
})();

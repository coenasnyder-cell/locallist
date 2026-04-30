(function () {
  const firebase = window.firebase || null;
  const Chart = window.Chart || null;
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
      pendingBusinessReviews: [],
      reviewRemovalRequests: [],
    },
    reportFilters: {
      messages: 'pending',
      listings: 'pending',
      pendingBusinessReviews: 'pending',
      reviewRemovalRequests: 'pending',
    },
    selectedReport: null,
    selectedReportType: null,
    selectedAiModerationListing: null,
  };

  const modalBackdrop = document.getElementById('reportModalBackdrop');
  const modalTitle = document.getElementById('reportModalTitle');
  const modalBody = document.getElementById('reportModalBody');
  const modalStatus = document.getElementById('reportStatus');
  const modalNotes = document.getElementById('reportNotes');
  const modalClose = document.getElementById('closeReportModal');
  const modalSave = document.getElementById('saveReportModal');
  const aiModerationModalBackdrop = document.getElementById('aiModerationModalBackdrop');
  const aiModerationModalTitle = document.getElementById('aiModerationModalTitle');
  const aiModerationModalBody = document.getElementById('aiModerationModalBody');
  const closeAiModerationModal = document.getElementById('closeAiModerationModal');
  const LISTINGS_ADMIN_API_BASE = `${window.location.origin}/api/admin`;
  const LISTING_REJECTION_REASONS = ['spam', 'prohibited', 'low_quality', 'duplicate', 'misleading'];

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

  function getListingRejectionReasonLabel(reason) {
    switch (String(reason || '').toLowerCase()) {
      case 'spam':
        return 'Spam';
      case 'prohibited':
        return 'Prohibited item or content';
      case 'low_quality':
        return 'Low quality listing';
      case 'duplicate':
        return 'Duplicate listing';
      case 'misleading':
        return 'Misleading information';
      default:
        return 'Marketplace guidelines issue';
    }
  }

  function formatListingRejectionReason(reason, notes) {
    const label = getListingRejectionReasonLabel(reason);
    const normalizedNotes = String(notes || '').trim();
    return normalizedNotes ? `${label}. ${normalizedNotes}` : label;
  }

  function promptForListingRejection() {
    const optionsText = LISTING_REJECTION_REASONS
      .map((reason) => `${reason} = ${getListingRejectionReasonLabel(reason)}`)
      .join('\n');
    const selected = window.prompt(
      `Enter a rejection reason code:\n\n${optionsText}`,
      'low_quality'
    );

    if (selected === null) {
      return null;
    }

    const rejectionReason = String(selected || '').trim().toLowerCase();
    if (!LISTING_REJECTION_REASONS.includes(rejectionReason)) {
      alert(`Please use one of these reason codes: ${LISTING_REJECTION_REASONS.join(', ')}`);
      return null;
    }

    const notesPrompt = window.prompt('Optional notes for the seller (optional):', '');
    if (notesPrompt === null) {
      return null;
    }

    return {
      rejectionReason,
      rejectionNotes: String(notesPrompt || '').trim(),
    };
  }

  function normalizeUserModerationStats(data) {
    const stats = data?.moderationStats || {};

    return {
      totalListings: Number.isFinite(Number(stats.totalListings)) ? Number(stats.totalListings) : 0,
      flaggedCount: Number.isFinite(Number(stats.flaggedCount)) ? Number(stats.flaggedCount) : 0,
      rejectedCount: Number.isFinite(Number(stats.rejectedCount)) ? Number(stats.rejectedCount) : 0,
      approvedCount: Number.isFinite(Number(stats.approvedCount)) ? Number(stats.approvedCount) : 0,
      lastFlaggedAt: stats.lastFlaggedAt || null,
      lastRejectedAt: stats.lastRejectedAt || null,
    };
  }

  function deriveUserModerationRisk(stats, storedRisk) {
    const trustScore = Math.max(
      0,
      Math.min(
        100,
        100 - (stats.flaggedCount * 5) - (stats.rejectedCount * 15) + Math.min(stats.approvedCount, 10),
      ),
    );
    const rejectionRate = stats.totalListings > 0 ? stats.rejectedCount / stats.totalListings : 0;
    const flaggedRate = stats.totalListings > 0 ? stats.flaggedCount / stats.totalListings : 0;

    let riskLevel = 'low';
    let reviewStatus = 'clear';

    if (trustScore <= 40 || stats.rejectedCount >= 5) {
      riskLevel = 'high';
      reviewStatus = 'disabled_candidate';
    } else if (trustScore <= 60 || stats.rejectedCount >= 3 || rejectionRate >= 0.4) {
      riskLevel = 'high';
      reviewStatus = 'at_risk';
    } else if (trustScore <= 80 || stats.flaggedCount >= 2 || flaggedRate >= 0.35) {
      riskLevel = 'medium';
      reviewStatus = 'watch';
    }

    return {
      trustScore,
      riskLevel,
      reviewStatus,
      updatedAt: storedRisk?.updatedAt || null,
    };
  }

  function isUserAtRisk(risk) {
    const reviewStatus = String(risk?.reviewStatus || '').toLowerCase();
    return reviewStatus === 'at_risk' || reviewStatus === 'disabled_candidate';
  }

  function getUserRiskMeta(risk) {
    const reviewStatus = String(risk?.reviewStatus || '').toLowerCase();

    if (reviewStatus === 'disabled_candidate') {
      return { label: 'Disable Candidate', className: 'high-risk' };
    }

    if (reviewStatus === 'at_risk') {
      return { label: 'At Risk', className: 'high-risk' };
    }

    if (String(risk?.riskLevel || '').toLowerCase() === 'medium') {
      return { label: 'Watch', className: 'medium-risk' };
    }

    return { label: 'Clear', className: 'low-risk' };
  }

  function formatModerationDate(value) {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  async function callListingsAdminApi(endpoint, payload) {
    if (!auth.currentUser) {
      throw new Error('You must be signed in as an admin to perform this action.');
    }

    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${LISTINGS_ADMIN_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch (error) {
      responseBody = null;
    }

    if (!response.ok) {
      throw new Error(responseBody?.error || `Request failed with status ${response.status}`);
    }

    return responseBody || {};
  }

  async function disableUserAccount(userId, reason) {
    if (!auth.currentUser) {
      throw new Error('You must be signed in as an admin to perform this action.');
    }

    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) {
      throw new Error('A disable reason is required.');
    }

    await db.collection('users').doc(userId).set({
      isDisabled: true,
      disabledReason: normalizedReason,
      disabledAt: firebase.firestore.FieldValue.serverTimestamp(),
      disabledBy: auth.currentUser.uid,
    }, { merge: true });
  }

  async function restoreUserAccountAccess(userId) {
    await db.collection('users').doc(userId).set({
      isDisabled: false,
      disabledReason: null,
      disabledAt: null,
      disabledBy: null,
    }, { merge: true });
  }

  function toggleRow(rowId, count) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.style.display = count > 0 ? '' : 'none';
  }

  function toggleNoPriorityTasksRow(counts) {
    const emptyRow = document.getElementById('rowNoPriorityTasks');
    if (!emptyRow) return;
    const hasVisibleTasks = counts.some((count) => count > 0);
    emptyRow.style.display = hasVisibleTasks ? 'none' : '';
  }

  async function loadTopPriorityCounts() {
    const aiFlaggedListingsEl = document.getElementById('priorityAiFlaggedListings');
    const serviceQueueEl = document.getElementById('priorityServiceApprovalQueue');
    const reportedListingsEl = document.getElementById('priorityReportedListings');
    const reportedMessagesEl = document.getElementById('priorityReportedMessages');
    const modAiFlaggedListingsEl = document.getElementById('modAiFlaggedListings');
    const modServiceQueueEl = document.getElementById('modServiceQueue');
    const modReportedListingsEl = document.getElementById('modReportedListings');
    const modReportedMessagesEl = document.getElementById('modReportedMessages');
    const modPendingReviewsManagementEl = document.getElementById('modPendingReviewsManagement');
    const modAtRiskUsersEl = document.getElementById('modAtRiskUsers');

    if (!aiFlaggedListingsEl || !serviceQueueEl || !reportedListingsEl || !reportedMessagesEl) return;

    try {
      const [aiFlaggedListingsSnap, pendingServicesSnap, pendingReportedListingsSnap, pendingReportedMessagesSnap, pendingBusinessReviewsSnap, pendingReviewRemovalSnap, businessLocalSnap, usersSnap] = await Promise.all([
        db.collection('listings').where('status', '==', 'pending_review').get(),
        db.collection('services').where('approvalStatus', '==', 'pending').get(),
        db.collection('reportedListings').where('status', '==', 'pending').get(),
        db.collection('reportedMessages').where('status', '==', 'pending').get(),
        db.collection('businessReviews').where('status', '==', 'pending').get(),
        db.collection('reviewRemovalRequests').where('status', '==', 'pending').get(),
        db.collection('businessLocal').get(),
        db.collection('users').get(),
      ]);

      const aiFlaggedListingsCount = aiFlaggedListingsSnap.size || 0;
      const serviceQueueCount = pendingServicesSnap.size || 0;
      const reportedListingsCount = pendingReportedListingsSnap.size || 0;
      const reportedMessagesCount = pendingReportedMessagesSnap.size || 0;
      const atRiskUsersCount = usersSnap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        const stats = normalizeUserModerationStats(data);
        const risk = deriveUserModerationRisk(stats, data.moderationRisk || {});
        return isUserAtRisk(risk);
      }).length;

      const pendingBizProfilesCount = businessLocalSnap.docs.filter((d) => {
        const data = d.data() || {};
        if (data.isApproved === true) return false;
        const s = String(data.approvalStatus || '').toLowerCase();
        return s !== 'rejected' && s !== 'deleted';
      }).length;

      aiFlaggedListingsEl.textContent = String(aiFlaggedListingsCount);
      serviceQueueEl.textContent = String(serviceQueueCount);
      reportedListingsEl.textContent = String(reportedListingsCount);
      reportedMessagesEl.textContent = String(reportedMessagesCount);

      if (modAiFlaggedListingsEl) modAiFlaggedListingsEl.textContent = String(aiFlaggedListingsCount);
      if (modServiceQueueEl) modServiceQueueEl.textContent = String(serviceQueueCount);
      if (modReportedListingsEl) modReportedListingsEl.textContent = String(reportedListingsCount);
      if (modReportedMessagesEl) modReportedMessagesEl.textContent = String(reportedMessagesCount);
      if (modPendingReviewsManagementEl) modPendingReviewsManagementEl.textContent = String((pendingBusinessReviewsSnap.size || 0) + (pendingReviewRemovalSnap.size || 0));
      if (modAtRiskUsersEl) modAtRiskUsersEl.textContent = String(atRiskUsersCount);
      setCountPill('modPendingBusinessProfiles', pendingBizProfilesCount);

      toggleRow('rowAiFlaggedListings', aiFlaggedListingsCount);
      toggleRow('rowServiceQueue', serviceQueueCount);
      toggleRow('rowReportedListings', reportedListingsCount);
      toggleRow('rowReportedMessages', reportedMessagesCount);
      toggleNoPriorityTasksRow([
        aiFlaggedListingsCount,
        serviceQueueCount,
        reportedListingsCount,
        reportedMessagesCount,
      ]);
    } catch (error) {
      console.error('Top priority counts load error:', error);
      aiFlaggedListingsEl.textContent = '-';
      serviceQueueEl.textContent = '-';
      reportedListingsEl.textContent = '-';
      reportedMessagesEl.textContent = '-';
      if (modAiFlaggedListingsEl) modAiFlaggedListingsEl.textContent = '-';
      if (modServiceQueueEl) modServiceQueueEl.textContent = '-';
      if (modReportedListingsEl) modReportedListingsEl.textContent = '-';
      if (modReportedMessagesEl) modReportedMessagesEl.textContent = '-';
      if (modPendingReviewsManagementEl) modPendingReviewsManagementEl.textContent = '-';
      if (modAtRiskUsersEl) modAtRiskUsersEl.textContent = '-';

      toggleRow('rowAiFlaggedListings', 1);
      toggleRow('rowServiceQueue', 1);
      toggleRow('rowReportedListings', 1);
      toggleRow('rowReportedMessages', 1);
      toggleNoPriorityTasksRow([1, 1, 1, 1]);
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
    const elements = document.querySelectorAll(`[id="${id}"], [data-count-key="${id}"]`);
    if (!elements.length) return;
    elements.forEach((el) => {
      el.textContent = String(value);
    });
  }

  // Chart.js instances — kept so we can destroy before re-render
  let hubUsersChart = null;
  let hubListingsChart = null;
  let businessGrowthChart = null;
  let userGrowthChart = null;

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
      if (usersCtx && Chart) {
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
      if (listingsCtx && Chart) {
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

  async function loadBusinessSnapshot() {
    try {
      const [businessProfilesSnap, businessUsersSnap] = await Promise.all([
        db.collection('businessLocal').get(),
        db.collection('users').where('accountType', '==', 'business').get(),
      ]);

      const usersById = new Map();
      const usersByEmail = new Map();
      businessUsersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        usersById.set(docSnap.id, data);
        const email = String(data.email || '').trim().toLowerCase();
        if (email) usersByEmail.set(email, data);
      });

      let activeCount = 0;
      let premiumCount = 0;
      let verifiedCount = 0;

      businessProfilesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (!isApprovedBusinessProfileRecord(data)) return;

        activeCount += 1;
        if (isVerifiedBusinessRecord(data)) verifiedCount += 1;

        const linkedUser = usersById.get(docSnap.id)
          || usersById.get(String(data.userId || '').trim())
          || usersByEmail.get(String(data.userEmail || '').trim().toLowerCase())
          || null;
        const subscriptionPlan = linkedUser?.subscriptionPlan || data.subscriptionPlan || data.businessTier || 'free';
        if (isPremiumBusinessProfileRecord({ subscriptionPlan, businessTier: data.businessTier })) {
          premiumCount += 1;
        }
      });

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartTs = firebase.firestore.Timestamp.fromDate(monthStart);
      const newThisMonthSnap = await db.collection('users')
        .where('accountType', '==', 'business')
        .where('createdAt', '>=', monthStartTs)
        .get();

      const monthLabels = [];
      const monthKeys = [];
      for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      }

      const monthlyCounts = new Array(monthKeys.length).fill(0);
      businessUsersSnap.forEach((docSnap) => {
        const createdAt = docSnap.data()?.createdAt;
        if (!createdAt?.toDate) return;
        const d = createdAt.toDate();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const idx = monthKeys.indexOf(key);
        if (idx >= 0) monthlyCounts[idx] += 1;
      });

      document.getElementById('businessNewThisMonth').textContent = String(newThisMonthSnap.size);
      document.getElementById('businessActiveTotal').textContent = String(activeCount);
      document.getElementById('businessPremiumTotal').textContent = String(premiumCount);
      document.getElementById('businessVerifiedTotal').textContent = String(verifiedCount);

      const chartEl = document.getElementById('chartBusinessGrowth');
      if (chartEl && Chart) {
        if (businessGrowthChart) businessGrowthChart.destroy();
        businessGrowthChart = new Chart(chartEl, {
          type: 'line',
          data: {
            labels: monthLabels,
            datasets: [{
              label: 'Business Signups',
              data: monthlyCounts,
              borderColor: '#0f766e',
              backgroundColor: 'rgba(15, 118, 110, 0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#0f766e',
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: '#f1f5f9' },
              },
              x: {
                ticks: { font: { size: 10 } },
                grid: { display: false },
              },
            },
          },
        });
      }
    } catch (error) {
      console.error('Business snapshot load error:', error);
    }
  }

  async function loadServiceSnapshot() {
    try {
      const servicesSnap = await db.collection('services').get();
      let totalServices = 0;
      let premiumServices = 0;

      servicesSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isActive === false) return;
        if (String(data.approvalStatus || '').toLowerCase() === 'deleted') return;

        totalServices += 1;

        const featured = (
          data.isFeatured === true ||
          data.isFeatured === 1 ||
          String(data.isFeatured || '').toLowerCase() === 'true'
        );

        if (featured) premiumServices += 1;
      });

      const totalEl = document.getElementById('serviceListingsTotal');
      const premiumEl = document.getElementById('servicePremiumTotal');
      if (totalEl) totalEl.textContent = String(totalServices);
      if (premiumEl) premiumEl.textContent = String(premiumServices);
    } catch (error) {
      console.error('Service snapshot load error:', error);
    }
  }

  async function loadUserSnapshot() {
    try {
      const [usersSnap, approvalsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('pendingApprovals').get(),
      ]);

      const totalUsers = usersSnap.size;
      const pendingUsers = approvalsSnap.docs.filter((docSnap) => String(docSnap.data()?.status || 'pending').toLowerCase() === 'pending').length;
      const businessUsers = usersSnap.docs.filter((docSnap) => normalizeUserAccountType(docSnap.data()) === 'business').length;
      const regularUsers = totalUsers - businessUsers;

      const totalEl = document.getElementById('userStatsTotal');
      const pendingEl = document.getElementById('userStatsPending');
      const businessEl = document.getElementById('userStatsBusiness');
      const regularEl = document.getElementById('userStatsRegular');
      if (totalEl) totalEl.textContent = String(totalUsers);
      if (pendingEl) pendingEl.textContent = String(pendingUsers);
      if (businessEl) businessEl.textContent = String(businessUsers);
      if (regularEl) regularEl.textContent = String(regularUsers);

      const now = new Date();
      const monthLabels = [];
      const monthKeys = [];
      for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        monthLabels.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      }

      const monthlyCounts = new Array(monthKeys.length).fill(0);
      usersSnap.forEach((docSnap) => {
        const createdAt = docSnap.data()?.createdAt;
        if (!createdAt?.toDate) return;
        const d = createdAt.toDate();
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const idx = monthKeys.indexOf(key);
        if (idx >= 0) monthlyCounts[idx] += 1;
      });

      const chartEl = document.getElementById('chartUserGrowth');
      if (chartEl && Chart) {
        if (userGrowthChart) userGrowthChart.destroy();
        userGrowthChart = new Chart(chartEl, {
          type: 'line',
          data: {
            labels: monthLabels,
            datasets: [{
              label: 'New Users',
              data: monthlyCounts,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#2563eb',
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1, font: { size: 11 } },
                grid: { color: '#f1f5f9' },
              },
              x: {
                ticks: { font: { size: 10 } },
                grid: { display: false },
              },
            },
          },
        });
      }
    } catch (error) {
      console.error('User snapshot load error:', error);
    }
  }

  async function loadDashboardCounts() {
    try {
      const [businessLocalSnap, pendingPurchasesSnap, businessUsersSnap, businessClaimsSnap,
        pendingApprovalsSnap, disabledUsersSnap, bannedUsersSnap, allUsersSnap, listingsSnap, allPurchasesTotalSnap, emailLogSnap] = await Promise.all([
        db.collection('businessLocal').get(),
        db.collection('featurePurchases').where('status', '==', 'pending').get(),
        db.collection('users').where('accountType', '==', 'business').get(),
        db.collection('businessClaims').get(),
        db.collection('pendingApprovals').get(),
        db.collection('users').where('isDisabled', '==', true).get(),
        db.collection('users').where('isBanned', '==', true).get(),
        db.collection('users').get(),
        db.collection('listings').get(),
        db.collection('featurePurchases').get(),
        db.collection('emailLog').get(),
      ]);

      // Pending business profiles (not approved and not rejected/deleted)
      const pendingBizCount = businessLocalSnap.docs.filter((d) => {
        const data = d.data() || {};
        if (data.isApproved === true) return false;
        const s = String(data.approvalStatus || '').toLowerCase();
        return s !== 'rejected' && s !== 'deleted';
      }).length;
      setCountPill('modPendingBusinessProfiles', pendingBizCount);

      const businessUsersById = new Map();
      const businessUsersByEmail = new Map();
      businessUsersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        businessUsersById.set(docSnap.id, data);
        const email = String(data.email || '').trim().toLowerCase();
        if (email) businessUsersByEmail.set(email, data);
      });

      const activeBusinessCount = businessLocalSnap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        return isApprovedBusinessProfileRecord(data);
      }).length;

      const premiumBusinessCount = businessLocalSnap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        if (!isApprovedBusinessProfileRecord(data)) return false;

        const linkedUser = businessUsersById.get(docSnap.id)
          || businessUsersById.get(String(data.userId || '').trim())
          || businessUsersByEmail.get(String(data.userEmail || '').trim().toLowerCase())
          || null;
        const subscriptionPlan = linkedUser?.subscriptionPlan || data.subscriptionPlan || data.businessTier || 'free';

        return isPremiumBusinessProfileRecord({ subscriptionPlan, businessTier: data.businessTier });
      }).length;

      // Featured purchases split by type
      let featuredListingCount = 0;
      let featuredServiceCount = 0;
      pendingPurchasesSnap.forEach((d) => {
        const data = d.data() || {};
        const itemType = String(data.itemType || (data.serviceId ? 'service' : 'listing')).toLowerCase();
        if (itemType === 'service') featuredServiceCount += 1;
        else featuredListingCount += 1;
      });
      setCountPill('marketplaceFeaturedCount', featuredListingCount);
      setCountPill('featuredListingPurchasesCount', featuredListingCount);
      setCountPill('featuredServicePurchasesCount', featuredServiceCount);

      // Business profile category counts
      setCountPill('businessUsersCount', activeBusinessCount);
      setCountPill('businessUserStatsCount', activeBusinessCount);
      setCountPill('premiumBusinessProfilesCount', premiumBusinessCount);
      setCountPill('userBusinessCount', businessUsersSnap.size);
      const regularUsersCount = allUsersSnap.docs.filter((d) => normalizeUserAccountType(d.data()) !== 'business').length;
      setCountPill('regularUsersCount', regularUsersCount);

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
      allUsersSnap.forEach((docSnap) => {
        const blockedUsers = Array.isArray(docSnap.data()?.blockedUsers) ? docSnap.data().blockedUsers : [];
        if (blockedUsers.length > 0) blockedIds.add(docSnap.id);
      });
      setCountPill('blockedUsersCount', blockedIds.size);

      // Total users
      setCountPill('totalUsersCount', allUsersSnap.size);

      // Reports section counts
      const digestCount = allUsersSnap.docs.filter(d => d.data().digestNotification === true).length;
      setCountPill('digestSubscribersCount', digestCount);
      setCountPill('emailDigestReportsCount', emailLogSnap.size);

      let totalPurchasesCount = 0;
      let pendingPurchaseCount = 0;
      let completedPurchaseCount = 0;
      let rejectedPurchaseCount = 0;
      let listingPurchaseCount = 0;
      let grossRevenue = 0;

      allPurchasesTotalSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const status = String(data.status || 'pending').toLowerCase();
        const itemType = String(data.itemType || (data.serviceId ? 'service' : 'listing')).toLowerCase();
        const amount = Number(data.amount || 0);

        totalPurchasesCount += 1;
        if (status === 'completed') completedPurchaseCount += 1;
        else if (status === 'rejected' || status === 'failed' || status === 'refunded') rejectedPurchaseCount += 1;
        else pendingPurchaseCount += 1;

        if (itemType === 'listing') listingPurchaseCount += 1;
        if (Number.isFinite(amount)) grossRevenue += amount;
      });

      setCountPill('paymentsStatTotalPurchases', totalPurchasesCount);
      setCountPill('paymentsStatPendingPurchases', pendingPurchaseCount);
      setCountPill('paymentsStatCompletedPurchases', completedPurchaseCount);
      setCountPill('paymentsStatRejectedPurchases', rejectedPurchaseCount);
      setCountPill('paymentsStatListingPurchases', listingPurchaseCount);

      const grossRevenueEl = document.getElementById('paymentsStatGrossRevenue');
      if (grossRevenueEl) {
        grossRevenueEl.textContent = `$${grossRevenue.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
      }

      const activeMarketplaceCount = listingsSnap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        const status = String(data.status || '').toLowerCase();
        if (status !== 'approved') return false;
        if (data.isActive === false || data.isDeleted === true || data.deleted === true) return false;
        const expiresAt = data.expiresAt;
        const expiresMs = typeof expiresAt?.toMillis === 'function'
          ? expiresAt.toMillis()
          : (typeof expiresAt === 'string' ? Date.parse(expiresAt) : null);
        return !Number.isFinite(expiresMs) || expiresMs > Date.now();
      }).length;
      setCountPill('marketplaceReportsCount', activeMarketplaceCount);

      const upgradeTargetCount = businessLocalSnap.docs.filter(d => {
        const data = d.data() || {};
        return String(data.businessTier || 'free') === 'free';
      }).length;
      setCountPill('upgradeTargetsCount', upgradeTargetCount);

      // Purchases report count (all time)
      setCountPill('purchasesReportCount', allPurchasesTotalSnap.size);

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
      case 'user-management':
        loadUserManagement();
        break;
      case 'feature-purchases-listings':
        loadPremiumPurchases();
        break;
      case 'feature-purchases-services':
        loadPremiumPurchases();
        break;
      case 'premium-purchases':
        loadPremiumPurchases();
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
        loadReviewRemovalRequests();
        break;
      case 'reviews-management':
        loadReviewsManagement();
        break;
      case 'ai-flagged-listings':
        loadAiFlaggedListings();
        break;
      case 'at-risk-users':
        loadAtRiskUsers();
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
  let allBusinessProfiles = [];
  const businessProfilesViewState = {
    filter: 'pending',
    search: '',
  };
  let allUsersForManagement = [];
  let pendingApprovalsForManagement = [];
  const userManagementState = {
    filter: 'all',
    search: '',
  };

  function normalizeUserAccountType(data) {
    return String(data?.accountType || 'user').toLowerCase();
  }

  function isBlockedOrFlaggedUser(data) {
    if (!data) return false;
    const blockedUsers = Array.isArray(data.blockedUsers) ? data.blockedUsers : [];
    return blockedUsers.length > 0 || data.isDisabled === true || data.isBanned === true;
  }

  function isPendingBusinessProfileRecord(data) {
    if (!data) return false;
    if (data.isApproved === true) return false;
    const status = String(data.approvalStatus || '').toLowerCase();
    return status !== 'rejected' && status !== 'deleted';
  }

  function isApprovedBusinessProfileRecord(data) {
    if (!data) return false;
    const status = String(data.approvalStatus || '').toLowerCase();
    return data.isApproved === true || status === 'approved';
  }

  function isPremiumBusinessProfileRecord(item) {
    if (window.LocalListPlanAccess && typeof window.LocalListPlanAccess.hasBusinessPremiumAccess === 'function') {
      return window.LocalListPlanAccess.hasBusinessPremiumAccess(item);
    }

    const plan = String(item?.subscriptionPlan || '').toLowerCase();
    const tier = String(item?.businessTier || '').toLowerCase();
    return (plan !== '' && plan !== 'free') || (tier !== '' && tier !== 'free');
  }

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
              <button class="btn small" onclick="window.openBusinessProfilesView('pending')">Review Pending Profiles</button>
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
            loadUserSnapshot();
          } catch {
            alert('Failed to clear blocked users.');
          }
        });
      });
    } catch (error) {
      console.error('Blocked users load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load blocked users.</div>';
    }
  }

  async function loadUserManagement() {
    const list = document.getElementById('userManagementList');
    const filterEl = document.getElementById('userManagementFilter');
    const searchInput = document.getElementById('userManagementSearchInput');
    const summaryEl = document.getElementById('userManagementSummary');
    if (!list || !filterEl || !searchInput || !summaryEl) return;

    list.innerHTML = '<div class="empty-state">Loading users...</div>';

    try {
      const [usersSnap, approvalsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('pendingApprovals').orderBy('requestedAt', 'desc').get(),
      ]);

      allUsersForManagement = usersSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      pendingApprovalsForManagement = approvalsSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          userId: data.userId || data.uid || data.userUid || data.accountId || '',
          name: data.name || 'Unknown',
          email: data.email || 'Unknown',
          zipCode: data.zipCode || 'Unknown',
          requestedAt: data.requestedAt,
          reviewedAt: data.reviewedAt,
          status: String(data.status || 'pending').toLowerCase(),
        };
      });

      filterEl.value = userManagementState.filter;
      searchInput.value = userManagementState.search;

      filterEl.onchange = (event) => {
        userManagementState.filter = String(event.target.value || 'all');
        renderUserManagement();
      };

      searchInput.oninput = (event) => {
        userManagementState.search = String(event.target.value || '');
        renderUserManagement();
      };

      renderUserManagement();
    } catch (error) {
      console.error('User management load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load users.</div>';
    }

    function renderUserManagement() {
      const filter = userManagementState.filter || 'all';
      const query = String(userManagementState.search || '').toLowerCase().trim();
      let items = [];

      if (filter === 'pending') {
        items = pendingApprovalsForManagement.filter((item) => item.status === 'pending');
        if (query) {
          items = items.filter((item) => {
            const fields = [item.name, item.email, item.zipCode].map((value) => String(value || '').toLowerCase());
            return fields.some((value) => value.includes(query));
          });
        }
        summaryEl.textContent = `Showing ${items.length} pending user approval${items.length === 1 ? '' : 's'}.`;
        list.innerHTML = items.length
          ? items.map(renderPendingApprovalCard).join('')
          : '<div class="empty-state">No pending users match your search.</div>';
      } else {
        items = allUsersForManagement.filter((user) => {
          const accountType = normalizeUserAccountType(user);
          if (filter === 'blocked') return isBlockedOrFlaggedUser(user);
          if (filter === 'business') return accountType === 'business';
          if (filter === 'regular') return accountType !== 'business';
          return true;
        });

        if (query) {
          items = items.filter((item) => {
            const fields = [
              item.name,
              item.displayName,
              item.email,
              item.zipCode,
              item.businessName,
              item.status,
              item.accountType,
            ].map((value) => String(value || '').toLowerCase());
            return fields.some((value) => value.includes(query));
          });
        }

        const labelMap = {
          all: 'all users',
          blocked: 'blocked or flagged users',
          business: 'business users',
          regular: 'regular users',
        };
        summaryEl.textContent = `Showing ${items.length} ${labelMap[filter] || 'users'}.`;
        list.innerHTML = items.length
          ? items.map((item) => renderUserManagementCard(item, filter)).join('')
          : `<div class="empty-state">No ${labelMap[filter] || 'users'} match your search.</div>`;
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
            await loadUserManagement();
            await loadDashboardCounts();
            await loadUserSnapshot();
          } catch (actionError) {
            console.error('Approve user error:', actionError);
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
            await db.collection('pendingApprovals').doc(approvalId).set({
              status: 'rejected',
              reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
              reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
            }, { merge: true });

            if (userId) {
              await db.collection('users').doc(userId).set({
                status: 'rejected',
                zipApproved: false,
                isDisabled: true,
              }, { merge: true });
            }

            await loadUserManagement();
            await loadDashboardCounts();
            await loadUserSnapshot();
          } catch (actionError) {
            console.error('Reject user error:', actionError);
            alert('Failed to reject user.');
          }
        });
      });

      list.querySelectorAll('[data-action="clear-user-blocks"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-user-id');
          if (!userId) return;
          if (!confirm('Clear all blocked users for this account?')) return;
          try {
            await db.collection('users').doc(userId).set({ blockedUsers: [] }, { merge: true });
            await loadUserManagement();
            await loadDashboardCounts();
            await loadUserSnapshot();
          } catch (actionError) {
            console.error('Clear user blocks error:', actionError);
            alert('Failed to clear blocked users.');
          }
        });
      });

      list.querySelectorAll('[data-action="restore-user-access"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-user-id');
          if (!userId) return;
          if (!confirm('Restore access for this user?')) return;
          try {
            await db.collection('users').doc(userId).set({
              isDisabled: false,
              isBanned: false,
            }, { merge: true });
            await loadUserManagement();
            await loadDashboardCounts();
            await loadUserSnapshot();
          } catch (actionError) {
            console.error('Restore user access error:', actionError);
            alert('Failed to restore user access.');
          }
        });
      });
    }

    function renderPendingApprovalCard(item) {
      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(item.name)}</div>
              <div class="list-meta">${escapeHtml(item.email)} | ${escapeHtml(item.zipCode)}</div>
              <div class="list-meta">Requested: ${formatDate(item.requestedAt)}</div>
            </div>
            <div class="list-actions">
              <button class="btn small" data-action="approve-user" data-user-id="${item.userId}" data-approval-id="${item.id}">Approve</button>
              <button class="btn secondary small" data-action="reject-user" data-user-id="${item.userId}" data-approval-id="${item.id}">Reject</button>
            </div>
          </div>
        </div>
      `;
    }

    function renderUserManagementCard(user, filter) {
      const accountType = normalizeUserAccountType(user);
      const blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
      const hasBlockedUsers = blockedUsers.length > 0;
      const disabled = user.isDisabled === true;
      const banned = user.isBanned === true;
      const badges = [
        accountType === 'business' ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;font-size:11px;font-weight:700;margin-left:8px;">BUSINESS</span>' : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;font-size:11px;font-weight:700;margin-left:8px;">REGULAR</span>',
        disabled ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-size:11px;font-weight:700;margin-left:8px;">DISABLED</span>' : '',
        banned ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fde68a;color:#92400e;border:1px solid #fbbf24;font-size:11px;font-weight:700;margin-left:8px;">BANNED</span>' : '',
        hasBlockedUsers ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;font-size:11px;font-weight:700;margin-left:8px;">BLOCKS</span>' : '',
      ].filter(Boolean).join('');

      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(user.name || user.displayName || 'Unknown User')}${badges}</div>
              <div class="list-meta">${escapeHtml(user.email || 'No email')} | ZIP: ${escapeHtml(user.zipCode || 'N/A')}</div>
              <div class="list-meta">Account Type: ${escapeHtml(accountType)} | Status: ${escapeHtml(user.status || 'unknown')}</div>
              ${user.businessName ? `<div class="list-meta">Business: ${escapeHtml(user.businessName)}</div>` : ''}
              ${hasBlockedUsers ? `<div class="list-meta">Blocked IDs: ${escapeHtml(blockedUsers.join(', '))}</div>` : ''}
            </div>
            <div class="list-actions">
              ${(disabled || banned) ? `<button class="btn small" data-action="restore-user-access" data-user-id="${user.id}">Restore Access</button>` : ''}
              ${hasBlockedUsers ? `<button class="btn danger small" data-action="clear-user-blocks" data-user-id="${user.id}">Clear Blocks</button>` : ''}
              ${(filter === 'business' || accountType === 'business') ? '<button class="btn secondary small" onclick="window.openBusinessProfilesView(\'active\')">Business Profiles</button>' : ''}
            </div>
          </div>
        </div>
      `;
    }
  }

  let allFeaturePurchases = [];
  let currentListingPurchaseFilter = 'all';
  let currentServicePurchaseFilter = 'all';
  const premiumPurchasesState = {
    scope: 'all',
    status: 'all',
  };
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
    premiumPurchasesState.scope = 'listing';
    await loadPremiumPurchases();
  }

  async function loadFeaturePurchasesServices() {
    premiumPurchasesState.scope = 'service';
    await loadPremiumPurchases();
  }

  async function loadPremiumPurchases() {
    const list = document.getElementById('premiumPurchasesList');
    const typeFilterEl = document.getElementById('premiumPurchasesTypeFilter');
    const statusFilterEl = document.getElementById('premiumPurchasesStatusFilter');
    const summaryEl = document.getElementById('premiumPurchasesSummary');
    if (!list || !typeFilterEl || !statusFilterEl || !summaryEl) return;

    list.innerHTML = '<div class="empty-state">Loading premium purchases...</div>';

    try {
      await fetchFeaturePurchases();

      typeFilterEl.value = premiumPurchasesState.scope;
      statusFilterEl.value = premiumPurchasesState.status;

      typeFilterEl.onchange = (event) => {
        premiumPurchasesState.scope = String(event.target.value || 'all');
        renderPremiumPurchases();
      };

      statusFilterEl.onchange = (event) => {
        premiumPurchasesState.status = String(event.target.value || 'all');
        renderPremiumPurchases();
      };

      renderPremiumPurchases();
    } catch (error) {
      console.error('Premium purchases load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load premium purchases.</div>';
    }

    function renderPremiumPurchases() {
      const scope = premiumPurchasesState.scope || 'all';
      const status = premiumPurchasesState.status || 'all';

      let purchases = allFeaturePurchases;
      if (scope !== 'all') {
        purchases = purchases.filter((purchase) => purchase.itemType === scope);
      }
      if (status !== 'all') {
        purchases = purchases.filter((purchase) => String(purchase.status || 'pending').toLowerCase() === status);
      }

      const scopeLabelMap = {
        all: 'all premium purchases',
        listing: 'featured listing purchases',
        service: 'featured service purchases',
      };
      const statusLabel = status === 'all' ? 'all statuses' : status;
      summaryEl.textContent = `Showing ${purchases.length} ${scopeLabelMap[scope] || 'premium purchases'} with ${statusLabel}.`;

      displayFeaturePurchases(purchases, 'all', 'premiumPurchasesList', loadPremiumPurchases);
    }
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
      const expiresAtLabel = purchase.expiresAt
        ? formatDate(purchase.expiresAt)
        : 'N/A';
      
      return `
        <div class="list-item" ${itemBg}>
          <div class="list-row">
            <div style="flex: 1;">
              ${isPending ? '<div class="list-meta" style="color: #d97706; font-weight: 600; margin-bottom: 8px;">⚠️ PENDING APPROVAL</div>' : ''}
              <div class="list-title">${escapeHtml(purchase.itemTitle || 'Unknown')}</div>
              <div class="list-meta">For: ${escapeHtml(itemTypeLabel)}</div>
              <div class="list-meta">User: ${escapeHtml(purchase.userName)}</div>
              <div class="list-meta">Amount: $${purchase.amount || 0} ${purchase.currency || 'USD'}</div>
              <div class="list-meta">Purchase Date: ${formatDate(purchase.purchasedAt)}</div>
              <div class="list-meta">Expires: ${expiresAtLabel}</div>
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
          if (isService) loadServiceSnapshot();
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
        } catch {
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
    } catch {
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
            await loadUserSnapshot();
          } catch {
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
            await loadUserSnapshot();
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
          } catch { alert('Failed to approve listing.'); }
        });
      });

      list.querySelectorAll('[data-action="reject-item"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          const rejection = promptForListingRejection();
          if (!rejection) return;
          try {
            await callListingsAdminApi('reject-listing', {
              listingId: id,
              rejectionReason: rejection.rejectionReason,
              rejectionNotes: rejection.rejectionNotes,
            });
            loadPendingListings();
          } catch { alert('Failed to reject listing.'); }
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
          } catch { alert('Failed to delete listing.'); }
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
          } catch { alert('Failed to revoke listing approval.'); }
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
            loadServiceSnapshot();
          } catch { alert('Failed to approve service.'); }
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
            loadServiceSnapshot();
          } catch { alert('Failed to reject service.'); }
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
            loadServiceSnapshot();
          } catch { alert('Failed to delete service.'); }
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
            loadServiceSnapshot();
          } catch { alert('Failed to update feature status.'); }
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
          } catch { alert('Failed to revoke business approval.'); }
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
          } catch { alert('Failed to verify business.'); }
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

  async function loadPendingBusinessProfiles() {
    const list = document.getElementById('pendingBusinessProfilesList');
    const searchInput = document.getElementById('businessProfilesSearchInput');
    const summaryEl = document.getElementById('businessProfilesSummary');
    if (!list || !searchInput || !summaryEl) return;
    list.innerHTML = '<div class="empty-state">Loading business profiles...</div>';

    try {
      const [businessSnap, businessUsersSnap] = await Promise.all([
        db.collection('businessLocal').get(),
        db.collection('users').where('accountType', '==', 'business').get(),
      ]);

      const usersById = new Map();
      const usersByEmail = new Map();

      businessUsersSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const record = { id: docSnap.id, ...data };
        usersById.set(docSnap.id, record);

        const email = String(data.email || '').trim().toLowerCase();
        if (email) usersByEmail.set(email, record);
      });

      allBusinessProfiles = businessSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const linkedUser = usersById.get(docSnap.id)
          || usersById.get(String(data.userId || '').trim())
          || usersByEmail.get(String(data.userEmail || '').trim().toLowerCase())
          || null;
        const verificationDocs = getVerificationDocs(data);
        const subscriptionPlan = linkedUser?.subscriptionPlan || data.subscriptionPlan || data.businessTier || 'free';
        const subscriptionStatus = linkedUser?.subscriptionStatus || data.subscriptionStatus || 'active';
        const isPending = isPendingBusinessProfileRecord(data);
        const isActive = isApprovedBusinessProfileRecord(data);
        const isVerified = isVerifiedBusinessRecord(data);
        const sortTime = (
          (isVerified && data?.verifiedAt?.toDate ? data.verifiedAt.toDate().getTime() : 0) ||
          (isActive && data?.approvedAt?.toDate ? data.approvedAt.toDate().getTime() : 0) ||
          (data?.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0)
        );

        return {
          id: docSnap.id,
          ...data,
          linkedUserId: linkedUser?.id || data.userId || '',
          linkedUserName: linkedUser?.name || linkedUser?.displayName || data.userName || '',
          linkedUserEmail: linkedUser?.email || data.userEmail || '',
          linkedUserZip: linkedUser?.zipCode || data.zipCode || '',
          subscriptionPlan,
          subscriptionStatus,
          verificationDocs,
          isPending,
          isActive,
          isVerified,
          isPremium: isPremiumBusinessProfileRecord({ subscriptionPlan, businessTier: data.businessTier }),
          sortTime,
        };
      }).filter((item) => {
        const status = String(item.approvalStatus || '').toLowerCase();
        return status !== 'rejected' && status !== 'deleted';
      }).sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));

      searchInput.value = businessProfilesViewState.search;
      searchInput.oninput = (event) => {
        businessProfilesViewState.search = String(event.target.value || '');
        renderBusinessProfilesView();
      };

      document.querySelectorAll('[data-business-profile-filter]').forEach((btn) => {
        btn.onclick = () => {
          businessProfilesViewState.filter = btn.getAttribute('data-business-profile-filter') || 'pending';
          renderBusinessProfilesView();
        };
      });

      renderBusinessProfilesView();
    } catch (error) {
      console.error('Pending business profiles load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load business profiles.</div>';
    }

    function renderBusinessProfilesView() {
      const filter = businessProfilesViewState.filter || 'pending';
      const query = String(businessProfilesViewState.search || '').toLowerCase().trim();
      const counts = {
        pending: allBusinessProfiles.filter((item) => item.isPending).length,
        active: allBusinessProfiles.filter((item) => item.isActive).length,
        premium: allBusinessProfiles.filter((item) => item.isActive && item.isPremium).length,
        verified: allBusinessProfiles.filter((item) => item.isVerified).length,
      };

      document.querySelectorAll('[data-business-profile-filter]').forEach((btn) => {
        const key = btn.getAttribute('data-business-profile-filter') || '';
        const label = btn.getAttribute('data-label') || btn.textContent || '';
        btn.classList.toggle('active', key === filter);
        btn.textContent = `${label} (${counts[key] || 0})`;
      });

      const filteredItems = allBusinessProfiles.filter((item) => {
        const passesFilter = (
          (filter === 'pending' && item.isPending) ||
          (filter === 'active' && item.isActive) ||
          (filter === 'premium' && item.isActive && item.isPremium) ||
          (filter === 'verified' && item.isVerified)
        );

        if (!passesFilter) return false;
        if (!query) return true;

        const searchParts = [
          item.businessName,
          item.linkedUserName,
          item.linkedUserEmail,
          item.userEmail,
          item.linkedUserId,
          item.userId,
          item.businessCity,
          item.businessState,
          item.zipCode,
          item.linkedUserZip,
          item.businessCategory,
        ].map((value) => String(value || '').toLowerCase());

        return searchParts.some((value) => value.includes(query));
      });

      const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1);
      summaryEl.textContent = `Showing ${filteredItems.length} ${filterLabel.toLowerCase()} business profile${filteredItems.length === 1 ? '' : 's'}.`;

      if (filteredItems.length === 0) {
        list.innerHTML = `<div class="empty-state">No ${filter.toLowerCase()} business profiles match your search.</div>`;
        return;
      }

      list.innerHTML = filteredItems.map((item) => renderBusinessProfileCard(item)).join('');

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
            await loadPendingBusinessProfiles();
            await loadDashboardCounts();
            await loadVerifiedBusinessesCount();
            await loadBusinessSnapshot();
          } catch (actionError) {
            console.error('Error approving business profile:', actionError);
            alert('Failed to approve business profile: ' + (actionError.message || 'Unknown error'));
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
            await loadPendingBusinessProfiles();
            await loadDashboardCounts();
            await loadVerifiedBusinessesCount();
            await loadBusinessSnapshot();
          } catch (actionError) {
            console.error('Error rejecting business profile:', actionError);
            alert('Failed to reject business profile: ' + (actionError.message || 'Unknown error'));
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
              verifiedAt: null,
              verifiedBy: null,
            });
            businessProfilesViewState.filter = 'pending';
            await loadPendingBusinessProfiles();
            await loadDashboardCounts();
            await loadVerifiedBusinessesCount();
            await loadBusinessSnapshot();
          } catch (actionError) {
            console.error('Revoke business approval error:', actionError);
            alert('Failed to revoke business approval.');
          }
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
            await loadPendingBusinessProfiles();
            await loadVerifiedBusinessesCount();
            await loadBusinessSnapshot();
          } catch (actionError) {
            console.error('Verify business error:', actionError);
            alert('Failed to verify business.');
          }
        });
      });

      list.querySelectorAll('[data-action="remove-verified-badge"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const profileId = btn.getAttribute('data-id');
          if (!profileId) return;
          if (!confirm('Remove the verified badge from this business?')) return;
          try {
            await db.collection('businessLocal').doc(profileId).update({
              isVerified: false,
              verifiedAt: null,
              verifiedBy: null,
              verificationRemovedAt: firebase.firestore.FieldValue.serverTimestamp(),
              verificationRemovedBy: auth.currentUser ? auth.currentUser.uid : null,
            });
            await loadPendingBusinessProfiles();
            await loadVerifiedBusinessesCount();
            await loadBusinessSnapshot();
          } catch (actionError) {
            console.error('Remove verified badge error:', actionError);
            alert('Failed to remove verified badge.');
          }
        });
      });

      list.querySelectorAll('[data-action="view-business-docs"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const serializedUrls = btn.getAttribute('data-file-urls') || '';
          openUploadedFiles(serializedUrls);
        });
      });
    }

    function renderBusinessProfileCard(item) {
      const location = [item.businessCity, item.businessState].filter(Boolean).join(', ') || 'No location provided';
      const ownerEmail = item.linkedUserEmail || item.userEmail || 'Unknown';
      const ownerName = item.linkedUserName || 'Unknown';
      const plan = String(item.subscriptionPlan || item.businessTier || 'free').toUpperCase();
      const status = String(item.subscriptionStatus || 'active');
      const verifiedBadge = item.isVerified
        ? '<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:8px;background:#dcfce7;color:#15803d;border:1px solid #86efac;">VERIFIED</span>'
        : '';
      const premiumBadge = item.isPremium
        ? '<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:8px;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd;">PREMIUM</span>'
        : '';
      const approvalLabel = item.isPending ? 'PENDING' : 'ACTIVE';
      const approvalColor = item.isPending ? '#d97706' : '#15803d';
      const cardBackground = item.isPending ? '#fffbf0' : '#f0fdf4';
      const borderColor = item.isPending ? '#ffc107' : '#22c55e';
      const debugApproval = Object.prototype.hasOwnProperty.call(item, 'isApproved') ? String(item.isApproved) : 'unset';
      const debugVerified = Object.prototype.hasOwnProperty.call(item, 'isVerified') ? String(item.isVerified) : 'unset';
      const debugStatus = item.approvalStatus ? String(item.approvalStatus) : 'unset';
      const debugOwner = item.userId || item.linkedUserId || 'unset';

      return `
        <div class="list-item" style="background: ${cardBackground}; border-left: 4px solid ${borderColor};">
          <div class="list-row">
            <div style="flex: 1;">
              <div class="list-meta" style="color: ${approvalColor}; font-weight: 600; margin-bottom: 8px;">${approvalLabel}${item.isPremium ? ' | PREMIUM' : ''}${item.isVerified ? ' | VERIFIED' : ''}</div>
              <div class="list-title">${escapeHtml(item.businessName || 'Unnamed Business')}${premiumBadge}${verifiedBadge}</div>
              <div class="list-meta">Owner: ${escapeHtml(ownerName)} | Email: ${escapeHtml(ownerEmail)}</div>
              <div class="list-meta">Location: ${escapeHtml(location)} | ZIP: ${escapeHtml(item.zipCode || item.linkedUserZip || 'N/A')}</div>
              <div class="list-meta">Category: ${escapeHtml(item.businessCategory || 'N/A')} | Plan: ${escapeHtml(plan)} (${escapeHtml(status)})</div>
              <div class="list-meta">${item.isPending ? 'Submitted' : 'Approved'}: ${escapeHtml(formatDate(item.isPending ? item.createdAt : (item.approvedAt || item.createdAt)))}</div>
              ${item.isVerified ? `<div class="list-meta">Verified: ${escapeHtml(formatDate(item.verifiedAt))}</div>` : ''}
              <div class="list-meta" style="font-size: 16px; color: #64748b; margin-top: 4px;">Debug: docId=${escapeHtml(item.id)} | userId=${escapeHtml(debugOwner)} | isApproved=${escapeHtml(debugApproval)} | approvalStatus=${escapeHtml(debugStatus)} | isVerified=${escapeHtml(debugVerified)}</div>
              ${item.businessDescription ? `<div class="list-meta" style="margin-top: 6px;">Description: ${escapeHtml(item.businessDescription.substring(0, 120))}${item.businessDescription.length > 120 ? '...' : ''}</div>` : ''}
              ${item.verificationDocs.length > 0
                ? `<div class="list-meta" style="margin-top: 8px;">Verification Documents: ${item.verificationDocs.map((url, idx) => `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">Document ${idx + 1}</a>`).join(' | ')}</div>`
                : '<div class="list-meta" style="margin-top: 8px;">Verification Documents: None submitted</div>'}
            </div>
            <div class="list-actions" style="display: flex; flex-direction: column; gap: 8px;">
              ${item.verificationDocs.length > 0 ? `<button class="btn secondary small" data-action="view-business-docs" data-file-urls="${item.verificationDocs.map((url) => encodeURIComponent(url)).join(',')}">View Files</button>` : ''}
              ${item.isPending ? `<button class="btn small" data-action="approve-business-profile" data-id="${escapeHtml(item.id)}" style="background: #10b981; color: white; border: none;">Approve</button>` : ''}
              ${item.isPending ? `<button class="btn danger small" data-action="reject-business-profile" data-id="${escapeHtml(item.id)}">Reject</button>` : ''}
              ${!item.isPending ? `<button class="btn secondary small" data-action="revoke-business-approval" data-id="${escapeHtml(item.id)}">Revoke Approval</button>` : ''}
              ${!item.isPending && !item.isVerified ? `<button class="btn small" data-action="verify-approved-business" data-id="${escapeHtml(item.id)}" style="background:#3b82f6;color:white;border:none;">Mark Verified</button>` : ''}
              ${!item.isPending && item.isVerified ? `<button class="btn danger small" data-action="remove-verified-badge" data-id="${escapeHtml(item.id)}">Remove Badge</button>` : ''}
            </div>
          </div>
        </div>
      `;
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

  async function loadReviewsManagement() {
    await Promise.all([
      loadPendingBusinessReviews(),
      loadReviewRemovalRequests(),
    ]);
  }

  async function loadPendingBusinessReviews() {
    const list = document.getElementById('pendingBusinessReviewsList');
    if (!list) return;

    list.innerHTML = '<div class="empty-state">Loading business reviews...</div>';

    try {
      const snap = await db.collection('businessReviews').get();
      state.reports.pendingBusinessReviews = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderPendingBusinessReviews();
    } catch (error) {
      console.error('Pending business reviews load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load business reviews.</div>';
    }
  }

  function renderPendingBusinessReviews() {
    const list = document.getElementById('pendingBusinessReviewsList');
    if (!list) return;

    const filter = state.reportFilters.pendingBusinessReviews || 'pending';
    const rows = state.reports.pendingBusinessReviews
      .filter((review) => {
        const status = String(review.status || 'pending').toLowerCase();
        if (filter === 'pending') {
          return status === 'pending';
        }
        return status !== 'pending';
      })
      .sort((left, right) => {
        const leftTime = left?.updatedAt?.toDate ? left.updatedAt.toDate().getTime() : 0;
        const rightTime = right?.updatedAt?.toDate ? right.updatedAt.toDate().getTime() : 0;
        return rightTime - leftTime;
      });

    if (!rows.length) {
      list.innerHTML = '<div class="empty-state">No business reviews found.</div>';
      return;
    }

    list.innerHTML = rows.map((review) => {
      const status = String(review.status || 'pending').toLowerCase();
      const notes = String(review.adminNotes || '').trim();
      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(review.userName || review.userEmail || 'Local User')}</div>
              <div class="list-meta">Business ID: ${escapeHtml(review.businessId || 'N/A')} | Rating: ${escapeHtml(String(review.rating || 'N/A'))}</div>
              <div class="list-meta">Status: ${escapeHtml(status)} | Submitted: ${formatDate(review.createdAt || review.updatedAt)}</div>
              <div class="list-meta">Review: ${escapeHtml(review.reviewText || 'No review text provided')}</div>
              ${notes ? `<div class="list-meta">Admin Notes: ${escapeHtml(notes)}</div>` : ''}
            </div>
            <div class="list-actions">
              ${status === 'pending' ? `
                <button class="btn small" data-action="approve-business-review" data-review-id="${review.id}">Approve</button>
                <button class="btn secondary small" data-action="reject-business-review" data-review-id="${review.id}">Reject</button>
              ` : `
                <div class="list-meta">Reviewed: ${formatDate(review.reviewedAt || review.updatedAt)}</div>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="approve-business-review"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reviewId = btn.getAttribute('data-review-id');
        if (!reviewId) return;
        const notes = window.prompt('Optional admin note for this approval:', '') || '';
        await updateBusinessReviewStatus(reviewId, 'approved', notes);
      });
    });

    list.querySelectorAll('[data-action="reject-business-review"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reviewId = btn.getAttribute('data-review-id');
        if (!reviewId) return;
        const notes = window.prompt('Why are you rejecting this review?', '') || '';
        await updateBusinessReviewStatus(reviewId, 'rejected', notes);
      });
    });
  }

  async function updateBusinessReviewStatus(reviewId, status, adminNotes) {
    const review = state.reports.pendingBusinessReviews.find((item) => item.id === reviewId);
    if (!review) return;

    try {
      await db.collection('businessReviews').doc(reviewId).set({
        status,
        adminNotes: adminNotes || '',
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (review.businessId) {
        await refreshBusinessReviewSummary(String(review.businessId));
      }

      await loadPendingBusinessReviews();
    } catch (error) {
      console.error('Failed to update business review:', error);
      alert('Failed to update business review.');
    }
  }

  async function refreshBusinessReviewSummary(businessId) {
    if (!businessId) return;

    const approvedSnap = await db.collection('businessReviews')
      .where('businessId', '==', businessId)
      .where('status', '==', 'approved')
      .get();

    let total = 0;
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    approvedSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const rating = Math.max(1, Math.min(5, Number(data.rating) || 0));
      if (!rating) return;
      total += rating;
      breakdown[rating] += 1;
    });

    const ratingCount = approvedSnap.size;
    const ratingAverage = ratingCount > 0 ? Number((total / ratingCount).toFixed(2)) : 0;

    const payload = {
      ratingAverage,
      ratingCount,
      ratingBreakdown: breakdown,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await Promise.allSettled([
      db.collection('businessLocal').doc(businessId).set(payload, { merge: true }),
      db.collection('users').doc(businessId).set(payload, { merge: true }),
    ]);
  }

  async function loadReviewRemovalRequests() {
    const list = document.getElementById('reviewRemovalRequestsList');
    if (!list) return;

    list.innerHTML = '<div class="empty-state">Loading review removal requests...</div>';

    try {
      const snap = await db.collection('reviewRemovalRequests').get();
      state.reports.reviewRemovalRequests = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderReviewRemovalRequests();
    } catch (error) {
      console.error('Review removal requests load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load review removal requests.</div>';
    }
  }

  function renderReviewRemovalRequests() {
    const list = document.getElementById('reviewRemovalRequestsList');
    if (!list) return;

    const filter = state.reportFilters.reviewRemovalRequests || 'pending';
    const rows = state.reports.reviewRemovalRequests
      .filter((request) => {
        const status = String(request.status || 'pending').toLowerCase();
        if (filter === 'pending') {
          return status === 'pending';
        }
        return status !== 'pending';
      })
      .sort((left, right) => {
        const leftTime = left?.updatedAt?.toDate ? left.updatedAt.toDate().getTime() : 0;
        const rightTime = right?.updatedAt?.toDate ? right.updatedAt.toDate().getTime() : 0;
        return rightTime - leftTime;
      });

    if (!rows.length) {
      list.innerHTML = '<div class="empty-state">No review removal requests found.</div>';
      return;
    }

    list.innerHTML = rows.map((request) => {
      const status = String(request.status || 'pending').toLowerCase();
      const reviewPreview = String(request.reviewText || '').trim();
      const notes = String(request.adminNotes || '').trim();

      return `
        <div class="list-item">
          <div class="list-row">
            <div>
              <div class="list-title">${escapeHtml(request.businessName || 'Business Account')}</div>
              <div class="list-meta">Status: ${escapeHtml(status)} | Requested: ${formatDate(request.createdAt || request.updatedAt)}</div>
              <div class="list-meta">Reviewer: ${escapeHtml(request.reviewAuthorName || 'Local User')} | Rating: ${escapeHtml(String(request.reviewRating || 'N/A'))}</div>
              <div class="list-meta">Reason: ${escapeHtml(request.reason || 'No reason provided')}</div>
              ${reviewPreview ? `<div class="list-meta">Review: ${escapeHtml(reviewPreview)}</div>` : ''}
              ${notes ? `<div class="list-meta">Admin Notes: ${escapeHtml(notes)}</div>` : ''}
            </div>
            <div class="list-actions">
              ${status === 'pending' ? `
                <button class="btn small" data-action="approve-review-removal" data-request-id="${request.id}">Approve</button>
                <button class="btn secondary small" data-action="reject-review-removal" data-request-id="${request.id}">Reject</button>
              ` : `
                <div class="list-meta">Reviewed: ${formatDate(request.reviewedAt || request.updatedAt)}</div>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="approve-review-removal"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const requestId = btn.getAttribute('data-request-id');
        if (!requestId) return;
        const notes = window.prompt('Optional admin note for this approval:', '') || '';
        await updateReviewRemovalRequestStatus(requestId, 'approved', notes);
      });
    });

    list.querySelectorAll('[data-action="reject-review-removal"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const requestId = btn.getAttribute('data-request-id');
        if (!requestId) return;
        const notes = window.prompt('Why are you rejecting this removal request?', '') || '';
        await updateReviewRemovalRequestStatus(requestId, 'rejected', notes);
      });
    });
  }

  async function updateReviewRemovalRequestStatus(requestId, status, adminNotes) {
    const request = state.reports.reviewRemovalRequests.find((item) => item.id === requestId);
    if (!request) return;

    try {
      await db.collection('reviewRemovalRequests').doc(requestId).set({
        status,
        adminNotes: adminNotes || '',
        reviewedBy: auth.currentUser ? auth.currentUser.uid : null,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (status === 'approved' && request.reviewId) {
        await db.collection('businessReviews').doc(String(request.reviewId)).set({
          status: 'removed',
          removalRequestId: requestId,
          removalApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
          removalApprovedBy: auth.currentUser ? auth.currentUser.uid : null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        if (request.businessId) {
          await refreshBusinessReviewSummary(String(request.businessId));
        }
      }

      await loadReviewRemovalRequests();
    } catch (error) {
      console.error('Failed to update review removal request:', error);
      alert('Failed to update review removal request.');
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
    } catch {
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

  function initReviewRemovalFilters() {
    const filterTabs = document.querySelectorAll('[data-review-removal-filter]');
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-review-removal-filter');
        if (!filter) return;

        document.querySelectorAll('[data-review-removal-filter]').forEach((btn) => {
          btn.classList.toggle('active', btn === tab);
        });

        state.reportFilters.reviewRemovalRequests = filter;
        renderReviewRemovalRequests();
      });
    });

    const refreshBtn = document.getElementById('refreshReviewRemovalRequests');
    if (refreshBtn && !refreshBtn.hasListener) {
      refreshBtn.hasListener = true;
      refreshBtn.addEventListener('click', loadReviewRemovalRequests);
    }
  }

  function initPendingReviewFilters() {
    const filterTabs = document.querySelectorAll('[data-pending-reviews-filter]');
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const filter = tab.getAttribute('data-pending-reviews-filter');
        if (!filter) return;

        document.querySelectorAll('[data-pending-reviews-filter]').forEach((btn) => {
          btn.classList.toggle('active', btn === tab);
        });

        state.reportFilters.pendingBusinessReviews = filter;
        renderPendingBusinessReviews();
      });
    });

    const refreshBtn = document.getElementById('refreshReviewsManagement');
    if (refreshBtn && !refreshBtn.hasListener) {
      refreshBtn.hasListener = true;
      refreshBtn.addEventListener('click', loadReviewsManagement);
    }
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

  function downloadJSON(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8;' });
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

  window.generateModerationReport = async function () {
    try {
      if (!auth.currentUser) {
        alert('You must be signed in as an admin to generate this report.');
        return;
      }

      const from = document.getElementById('moderationReportFrom')?.value || '';
      const to = document.getElementById('moderationReportTo')?.value || '';
      const recentLimit = document.getElementById('moderationReportRecentLimit')?.value || '20';
      const atRiskLimit = document.getElementById('moderationReportAtRiskLimit')?.value || '25';
      const preview = document.getElementById('moderationReportPreview');

      if (preview) {
        preview.textContent = 'Generating moderation report...';
      }

      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (recentLimit) params.set('recentLimit', recentLimit);
      if (atRiskLimit) params.set('atRiskLimit', atRiskLimit);

      const response = await fetch(`${LISTINGS_ADMIN_API_BASE}/moderation-report?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let report = null;
      try {
        report = await response.json();
      } catch (error) {
        report = null;
      }

      if (!response.ok || !report) {
        throw new Error(report?.error || `Moderation report failed with status ${response.status}`);
      }

      if (preview) {
        preview.textContent = JSON.stringify(report, null, 2);
      }

      downloadJSON(`moderation-report-${Date.now()}.json`, report);
    } catch (error) {
      console.error('Generate moderation report error:', error);
      const preview = document.getElementById('moderationReportPreview');
      if (preview) {
        preview.textContent = `Failed to generate moderation report.\n${error?.message || 'Unknown error'}`;
      }
      alert(error?.message || 'Failed to generate moderation report.');
    }
  };

  function normalizeModerationResult(data) {
    const confidence = String(data?.confidence || '').toLowerCase();

    return {
      flagged: data?.flagged === true,
      reason: typeof data?.reason === 'string' ? data.reason.trim() : '',
      confidence: confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'low',
      rawResponse: typeof data?.rawResponse === 'string' ? data.rawResponse : '',
    };
  }

  function getAiRiskMeta(confidence) {
    switch (String(confidence || '').toLowerCase()) {
      case 'high':
        return { label: 'High Risk', className: 'high-risk' };
      case 'medium':
        return { label: 'Medium Risk', className: 'medium-risk' };
      default:
        return { label: 'Low Risk', className: 'low-risk' };
    }
  }

  function formatPrice(value) {
    return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : '';
  }

  function formatAiModerationDate(value) {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function openAiModerationModal(listing) {
    if (!aiModerationModalBackdrop || !aiModerationModalBody || !aiModerationModalTitle) return;

    state.selectedAiModerationListing = listing;
    const risk = getAiRiskMeta(listing?.moderation?.confidence);
    const sellerName = listing?.sellerName || listing?.sellerEmail || listing?.userId || 'Unknown seller';

    aiModerationModalTitle.textContent = listing?.title || 'Listing Details';
    aiModerationModalBody.innerHTML = `
      <div class="ai-risk-row" style="margin-top: 6px;">
        <span class="ai-pill pending">Pending Review</span>
        <span class="ai-pill ${risk.className}">${escapeHtml(risk.label)}</span>
      </div>

      <div class="ai-flagged-box" style="margin-top: 14px;">
        <div class="ai-flagged-label">Why This Was Flagged</div>
        <div class="ai-flagged-reason">${escapeHtml(listing?.moderation?.reason || 'No detailed reason was returned by moderation.')}</div>
      </div>

      <div class="ai-modal-grid">
        <div class="ai-modal-card">
          <div class="ai-modal-label">Seller</div>
          <div class="ai-modal-value">${escapeHtml(sellerName)}</div>
        </div>
        <div class="ai-modal-card">
          <div class="ai-modal-label">Created</div>
          <div class="ai-modal-value">${escapeHtml(formatAiModerationDate(listing?.createdAt) || 'Unknown')}</div>
        </div>
        <div class="ai-modal-card">
          <div class="ai-modal-label">Status</div>
          <div class="ai-modal-value">${escapeHtml(listing?.status || 'pending_review')}</div>
        </div>
        <div class="ai-modal-card">
          <div class="ai-modal-label">Price</div>
          <div class="ai-modal-value">${escapeHtml(formatPrice(listing?.price) || 'Not provided')}</div>
        </div>
      </div>

      <div class="ai-modal-card" style="margin-top: 14px;">
        <div class="ai-modal-label">Description</div>
        <div class="ai-modal-value">${escapeHtml(listing?.description || 'No description provided.')}</div>
      </div>

      ${listing?.moderation?.rawResponse ? `
        <div class="ai-modal-card" style="margin-top: 14px;">
          <div class="ai-modal-label">Raw Moderation Response</div>
          <div class="ai-modal-value">${escapeHtml(listing.moderation.rawResponse)}</div>
        </div>
      ` : ''}
    `;

    aiModerationModalBackdrop.classList.add('active');
  }

  function initAiModerationModal() {
    if (!aiModerationModalBackdrop || !closeAiModerationModal) return;

    closeAiModerationModal.addEventListener('click', () => {
      aiModerationModalBackdrop.classList.remove('active');
    });

    aiModerationModalBackdrop.addEventListener('click', (event) => {
      if (event.target === aiModerationModalBackdrop) {
        aiModerationModalBackdrop.classList.remove('active');
      }
    });
  }

  async function loadAiFlaggedListings() {
    const list = document.getElementById('aiFlaggedListingsList');
    if (!list) return;

    list.innerHTML = '<div class="empty-state">Loading AI-flagged listings...</div>';

    try {
      const snapshot = await db.collection('listings').where('status', '==', 'pending_review').get();
      const rows = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data() || {};
          const moderationSnap = await docSnap.ref.collection('moderation').doc('result').get();
          const moderation = moderationSnap.exists ? normalizeModerationResult(moderationSnap.data() || {}) : normalizeModerationResult({});

          return {
            id: docSnap.id,
            ...data,
            moderation,
          };
        })
      );

      rows.sort((a, b) => {
        const aTime = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

      const listingMap = new Map(rows.map((item) => [item.id, item]));

      list.innerHTML = rows.length === 0
        ? '<div class="empty-state">No AI-flagged listings are waiting for review.</div>'
        : rows.map((item) => {
          const risk = getAiRiskMeta(item.moderation.confidence);
          const priceLabel = formatPrice(item.price);
          const reason = item.moderation.reason || 'No detailed reason was returned by moderation.';
          const sellerName = item.sellerName || item.sellerEmail || item.userId || 'Unknown seller';

          return `
            <div class="list-item ai-flagged-card ${risk.className}">
              <div class="ai-card-head">
                <div>
                  <div class="ai-card-title">${escapeHtml(item.title || 'Untitled Listing')}</div>
                  <div class="ai-card-meta">Seller: ${escapeHtml(sellerName)}</div>
                  <div class="ai-card-meta">Created: ${escapeHtml(formatAiModerationDate(item.createdAt) || 'Unknown')}</div>
                </div>
                ${priceLabel ? `<div class="ai-card-price">${escapeHtml(priceLabel)}</div>` : ''}
              </div>

              <div class="ai-risk-row">
                <span class="ai-pill pending">Pending Review</span>
                <span class="ai-pill ${risk.className}">${escapeHtml(risk.label)}</span>
              </div>

              <div class="ai-description">${escapeHtml(item.description || 'No description provided.')}</div>

              <div class="ai-flagged-box">
                <div class="ai-flagged-label">Why This Was Flagged</div>
                <div class="ai-flagged-reason">${escapeHtml(reason)}</div>
              </div>

              <div class="ai-card-actions">
                <button class="btn small" data-action="approve-ai-listing" data-id="${escapeHtml(item.id)}">Approve</button>
                <button class="btn danger small" data-action="reject-ai-listing" data-id="${escapeHtml(item.id)}">Reject</button>
                <button class="btn secondary small" data-action="view-ai-listing-details" data-id="${escapeHtml(item.id)}">View Details</button>
              </div>
            </div>
          `;
        }).join('');

      list.querySelectorAll('[data-action="approve-ai-listing"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Approve this listing and make it active?')) return;

          try {
            await callListingsAdminApi('approve-listing', { listingId: id });
            loadAiFlaggedListings();
            loadTopPriorityCounts();
          } catch (error) {
            console.error('Error approving AI-flagged listing:', error);
            alert('Failed to approve listing.');
          }
        });
      });

      list.querySelectorAll('[data-action="reject-ai-listing"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          const rejection = promptForListingRejection();
          if (!rejection) return;

          try {
            await callListingsAdminApi('reject-listing', {
              listingId: id,
              rejectionReason: rejection.rejectionReason,
              rejectionNotes: rejection.rejectionNotes,
            });
            loadAiFlaggedListings();
            loadTopPriorityCounts();
          } catch (error) {
            console.error('Error rejecting AI-flagged listing:', error);
            alert('Failed to reject listing.');
          }
        });
      });

      list.querySelectorAll('[data-action="view-ai-listing-details"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          const listing = listingMap.get(id);
          if (!listing) return;
          openAiModerationModal(listing);
        });
      });
    } catch (error) {
      console.error('AI-flagged listings load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load AI-flagged listings.</div>';
    }
  }

  async function loadAtRiskUsers() {
    const list = document.getElementById('atRiskUsersList');
    if (!list) return;

    list.innerHTML = '<div class="empty-state">Loading at-risk users...</div>';

    try {
      const usersSnap = await db.collection('users').get();
      const rows = usersSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const stats = normalizeUserModerationStats(data);
        const risk = deriveUserModerationRisk(stats, data.moderationRisk || {});

        return {
          id: docSnap.id,
          ...data,
          moderationStats: stats,
          moderationRisk: risk,
        };
      }).filter((user) => isUserAtRisk(user.moderationRisk));

      rows.sort((a, b) => {
        const aScore = Number(a?.moderationRisk?.trustScore || 0);
        const bScore = Number(b?.moderationRisk?.trustScore || 0);
        if (aScore !== bScore) return aScore - bScore;

        const aRejected = Number(a?.moderationStats?.rejectedCount || 0);
        const bRejected = Number(b?.moderationStats?.rejectedCount || 0);
        return bRejected - aRejected;
      });

      list.innerHTML = rows.length === 0
        ? '<div class="empty-state">No users are currently in the at-risk queue.</div>'
        : rows.map((user) => {
          const riskMeta = getUserRiskMeta(user.moderationRisk);
          const displayName = user.displayName || user.name || user.email || user.id;
          const flaggedCount = Number(user.moderationStats.flaggedCount || 0);
          const rejectedCount = Number(user.moderationStats.rejectedCount || 0);
          const approvedCount = Number(user.moderationStats.approvedCount || 0);
          const totalListings = Number(user.moderationStats.totalListings || 0);
          const lastRejectedAt = formatModerationDate(user.moderationStats.lastRejectedAt) || 'Never';
          const lastFlaggedAt = formatModerationDate(user.moderationStats.lastFlaggedAt) || 'Never';
          const disabled = user.isDisabled === true;
          const disabledReason = typeof user.disabledReason === 'string' && user.disabledReason.trim()
            ? user.disabledReason.trim()
            : '';
          const disabledAt = formatModerationDate(user.disabledAt) || '';

          return `
            <div class="list-item ai-flagged-card ${riskMeta.className}">
              <div class="ai-card-head">
                <div>
                  <div class="ai-card-title">${escapeHtml(displayName)}</div>
                  <div class="ai-card-meta">Email: ${escapeHtml(user.email || 'No email on file')}</div>
                  <div class="ai-card-meta">User ID: ${escapeHtml(user.id)}</div>
                  ${disabled ? `<div class="ai-card-meta" style="color:#991b1b;font-weight:700;">Account disabled${disabledAt ? ` on ${escapeHtml(disabledAt)}` : ''}</div>` : ''}
                </div>
                <div class="ai-card-price">Trust ${escapeHtml(String(user.moderationRisk.trustScore))}</div>
              </div>

              <div class="ai-risk-row">
                <span class="ai-pill ${riskMeta.className}">${escapeHtml(riskMeta.label)}</span>
                <span class="ai-pill pending">${escapeHtml(String(user.moderationRisk.reviewStatus || 'clear').replace('_', ' '))}</span>
              </div>

              <div class="ai-flagged-box">
                <div class="ai-flagged-label">Moderation Summary</div>
                <div class="ai-flagged-reason">
                  Total Listings: ${escapeHtml(String(totalListings))} | Approved: ${escapeHtml(String(approvedCount))} | Flagged: ${escapeHtml(String(flaggedCount))} | Rejected: ${escapeHtml(String(rejectedCount))}
                </div>
              </div>

              <div class="ai-description">
                Last flagged: ${escapeHtml(lastFlaggedAt)}<br>
                Last rejected: ${escapeHtml(lastRejectedAt)}
              </div>

              ${disabledReason ? `
                <div class="ai-flagged-box">
                  <div class="ai-flagged-label">Disable Reason</div>
                  <div class="ai-flagged-reason">${escapeHtml(disabledReason)}</div>
                </div>
              ` : ''}

              <div class="ai-card-actions">
                ${disabled
                  ? `<button class="btn small" data-action="restore-user-access" data-id="${escapeHtml(user.id)}">Restore Access</button>`
                  : `<button class="btn danger small" data-action="disable-user-account" data-id="${escapeHtml(user.id)}">Disable Account</button>`
                }
                <button class="btn secondary small" data-action="open-user-management" data-id="${escapeHtml(user.id)}">Manage User</button>
              </div>
            </div>
          `;
        }).join('');

      list.querySelectorAll('[data-action="disable-user-account"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          const promptResult = window.prompt('Enter a reason for disabling this account:', '');
          if (promptResult === null) return;

          const reason = promptResult.trim();
          if (!reason) {
            alert('A reason is required to disable this account.');
            return;
          }

          if (!confirm('Disable this account and notify the user by email?')) return;

          try {
            await disableUserAccount(id, reason);
            await loadAtRiskUsers();
          } catch (error) {
            console.error('Disable user account error:', error);
            alert(error?.message || 'Failed to disable user account.');
          }
        });
      });

      list.querySelectorAll('[data-action="restore-user-access"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (!confirm('Restore account access for this user?')) return;

          try {
            await restoreUserAccountAccess(id);
            await loadAtRiskUsers();
          } catch (error) {
            console.error('Restore user access error:', error);
            alert(error?.message || 'Failed to restore user access.');
          }
        });
      });

      list.querySelectorAll('[data-action="open-user-management"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.navigateToTab('user-management');
        });
      });
    } catch (error) {
      console.error('At-risk users load error:', error);
      list.innerHTML = '<div class="empty-state">Failed to load at-risk users.</div>';
    }
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
    document.getElementById('refreshBusinessSnapshot')?.addEventListener('click', loadBusinessSnapshot);
    document.getElementById('refreshServiceSnapshot')?.addEventListener('click', loadServiceSnapshot);
    document.getElementById('refreshUserSnapshot')?.addEventListener('click', loadUserSnapshot);
    document.getElementById('refreshUserManagement')?.addEventListener('click', loadUserManagement);
    document.getElementById('refreshBusinessUsers')?.addEventListener('click', loadBusinessUsers);
    document.getElementById('refreshServiceProviders')?.addEventListener('click', loadServiceProviders);
    document.getElementById('refreshBlocked').addEventListener('click', loadBlockedUsers);
    document.getElementById('refreshFeaturePurchasesListings')?.addEventListener('click', loadFeaturePurchasesListings);
    document.getElementById('refreshFeaturePurchasesServices')?.addEventListener('click', loadFeaturePurchasesServices);
    document.getElementById('refreshPremiumPurchases')?.addEventListener('click', loadPremiumPurchases);
    document.getElementById('refreshBusinessClaims')?.addEventListener('click', loadBusinessClaims);
    document.getElementById('refreshVerifiedBusinesses')?.addEventListener('click', loadVerifiedBusinesses);
    document.getElementById('refreshShopLocalSectionSettings')?.addEventListener('click', loadShopLocalSectionSettings);
    document.getElementById('refreshCommunitySettings')?.addEventListener('click', loadCommunitySettings);
    document.getElementById('refreshApprovals').addEventListener('click', loadPendingApprovals);
    document.getElementById('refreshAiFlaggedListings')?.addEventListener('click', loadAiFlaggedListings);
    document.getElementById('refreshAtRiskUsers')?.addEventListener('click', loadAtRiskUsers);
    document.getElementById('refreshListings').addEventListener('click', loadPendingListings);
    document.getElementById('refreshServices')?.addEventListener('click', loadPendingServices);
    document.getElementById('refreshPendingBusinessProfiles')?.addEventListener('click', loadPendingBusinessProfiles);
    document.getElementById('refreshAutoApprovals')?.addEventListener('click', loadAutoApprovals);
    
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
    initAiModerationModal();
  }

  const SECTION_TITLES = {
    'analytics': 'Analytics',
    'ai-flagged-listings': 'AI Flagged Listings',
    'at-risk-users': 'At-Risk Users',
    'pending-listings': 'Pending Listings',
    'pending-services': 'Pending Services',
    'reported-listings': 'Reported Listings',
    'reported-messages': 'Reported Messages',
    'reviews-management': 'Reviews Management',
    'business-users': 'Business Users',
    'service-providers': 'Service Providers',
    'feature-purchases-listings': 'Premium Purchases',
    'feature-purchases-services': 'Premium Purchases',
    'premium-purchases': 'Premium Purchases',
    'business-claims': 'Business Claim Requests',
    'verified-businesses': 'Verified Businesses',
    'user-management': 'User Management',
    'pending-business-profiles': 'Business Profiles',
    'shop-local-section': 'Browse: Business Local Section',
    'community-settings': 'Site Settings',
    'pending-approvals': 'Pending Approvals',
    'blocked': 'Blocked Users',
    'reports': 'Reports & Exports',
    'auto-approvals': 'Auto-Approvals',
  };

  function getSectionTitle(tabId) {
    const section = document.getElementById(`tab-${tabId}`);
    const sectionTitle = section?.querySelector('.section-title');
    const text = sectionTitle?.textContent?.trim();
    return text || SECTION_TITLES[tabId] || '';
  }

  window.navigateToTab = function (tabId) {
    const hubEl = document.getElementById('adminHub');
    const sectionsEl = document.getElementById('adminSections');
    const titleEl = document.getElementById('adminSectionTitle');
    if (hubEl) hubEl.style.display = 'none';
    if (sectionsEl) sectionsEl.style.display = 'block';
    if (titleEl) titleEl.textContent = getSectionTitle(tabId);
    setActiveTab(tabId);
    loadTab(tabId);
  };

  window.openBusinessProfilesView = function (filter = 'pending') {
    businessProfilesViewState.filter = filter;
    window.navigateToTab('pending-business-profiles');
  };

  window.openUserManagementView = function (filter = 'all') {
    userManagementState.filter = filter;
    window.navigateToTab('user-management');
  };

  window.openPremiumPurchasesView = function (scope = 'all') {
    premiumPurchasesState.scope = scope;
    premiumPurchasesState.status = 'all';
    window.navigateToTab('premium-purchases');
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
    initPendingReviewFilters();
    initReviewRemovalFilters();
    initRefreshButtons();
    initModal();
    loadTopPriorityCounts();
    loadBusinessSnapshot();
    loadServiceSnapshot();
    loadUserSnapshot();
    loadServiceProvidersCount();
    loadVerifiedBusinessesCount();
    loadDashboardCounts();
    loadHubAnalytics();
    document.getElementById('saveShopLocalSectionSettings')?.addEventListener('click', saveShopLocalSectionSettings);
    document.getElementById('saveCommunitySettings')?.addEventListener('click', saveCommunitySettings);
    document.getElementById('uploadSpotlightImageBtn')?.addEventListener('click', uploadSpotlightImage);
    // Hub is shown by default; each section loads on demand when its card is clicked.
  }

  if (!db || !auth || !firebase?.firestore) {
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

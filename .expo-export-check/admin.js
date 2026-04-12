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
      case 'feature-purchases-listings':
        loadFeaturePurchasesListings();
        break;
      case 'feature-purchases-services':
        loadFeaturePurchasesServices();
        break;
      case 'business-claims':
        loadBusinessClaims();
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
      const listingsSnap = await db.collection('listings').where('status', '==', 'pending').get();

      const pendingListings = listingsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        type: 'listing',
        ...docSnap.data(),
      }));

      pendingListings.sort((a, b) => {
        const aTime = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

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

      list.innerHTML = pendingHtml;

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
    list.innerHTML = '<div class="empty-state">Loading pending business profiles...</div>';

    try {
      const snap = await db.collection('businessLocal').get();
      const pendingDocs = snap.docs.filter((docSnap) => {
        const data = docSnap.data() || {};
        if (data.isApproved === true) return false;
        const status = String(data.approvalStatus || '').toLowerCase();
        if (status === 'rejected' || status === 'deleted') return false;
        return true;
      }).sort((a, b) => {
        const aData = a.data() || {};
        const bData = b.data() || {};
        const aTime = aData?.createdAt?.toDate ? aData.createdAt.toDate().getTime() : 0;
        const bTime = bData?.createdAt?.toDate ? bData.createdAt.toDate().getTime() : 0;
        return bTime - aTime;
      });

      if (pendingDocs.length === 0) {
        list.innerHTML = '<div class="empty-state">No pending business profiles.</div>';
        return;
      }

      list.innerHTML = pendingDocs.map((docSnap) => {
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
      }).join('');

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
          } catch (error) {
            console.error('Error rejecting business profile:', error);
            alert('Failed to reject business profile: ' + (error.message || 'Unknown error'));
          }
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
      list.innerHTML = '<div class="empty-state">Failed to load pending business profiles.</div>';
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

  function initRefreshButtons() {
    document.getElementById('refreshAnalytics').addEventListener('click', loadAnalytics);
    document.getElementById('refreshBusinessUsers')?.addEventListener('click', loadBusinessUsers);
    document.getElementById('refreshBlocked').addEventListener('click', loadBlockedUsers);
    document.getElementById('refreshFeaturePurchasesListings')?.addEventListener('click', loadFeaturePurchasesListings);
    document.getElementById('refreshFeaturePurchasesServices')?.addEventListener('click', loadFeaturePurchasesServices);
    document.getElementById('refreshBusinessClaims')?.addEventListener('click', loadBusinessClaims);
    document.getElementById('refreshShopLocalSectionSettings')?.addEventListener('click', loadShopLocalSectionSettings);
    document.getElementById('refreshCommunitySettings')?.addEventListener('click', loadCommunitySettings);
    document.getElementById('refreshApprovals').addEventListener('click', loadPendingApprovals);
    document.getElementById('refreshListings').addEventListener('click', loadPendingListings);
    document.getElementById('refreshServices')?.addEventListener('click', loadPendingServices);
    document.getElementById('refreshPendingBusinessProfiles')?.addEventListener('click', loadPendingBusinessProfiles);
    
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
    'feature-purchases-listings': 'Featured Listing Purchases',
    'feature-purchases-services': 'Featured Service Purchases',
    'business-claims': 'Business Claims',
    'pending-business-profiles': 'Pending Business Profiles',
    'shop-local-section': 'Local Section Settings',
    'community-settings': 'Community Settings',
    'pending-approvals': 'Pending Approvals',
    'blocked': 'Blocked Users',
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

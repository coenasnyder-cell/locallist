/* eslint-env browser */
/* global firebase */

// Shared Header Component for all pages
// Load this script in every HTML page to automatically inject the header

(function() {
  // Header HTML template
  const headerHTML = `
    <!-- Menu Overlay -->
    <div class="menu-overlay" id="menuOverlay" onclick="toggleMenu()"></div>
    
    <!-- Menu Sidebar -->
    <div class="menu-sidebar" id="menuSidebar">
      <h3>Menu</h3>
      <a href="index.html" onclick="toggleMenu(); return true;">Home</a>
      <a href="browse.html" onclick="toggleMenu(); return true;">Local List Marketplace</a>
      <a href="community-hub.html" onclick="toggleMenu(); return true;">Community Hub</a>
      <a href="support-legal-hub.html" onclick="toggleMenu(); return true;">Support Hub</a>
      <a href="messages.html" onclick="toggleMenu(); return true;">Messages</a>
      <a href="profile.html" id="menuProfileLink" onclick="toggleMenu(); return true;">Profile</a>
      <a href="contact.html" onclick="toggleMenu(); return true;">Contact Us</a>
    </div>
    
    <header>
      <button class="menu-btn" onclick="toggleMenu()" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div class="logo-container">
        <img src="logo.png" alt="Local List Logo" class="logo">
      </div>
      <div class="header-right" id="headerRight">
        <button class="header-btn admin-btn" id="adminBtn" onclick="window.location.href='admin.html'" title="Admin Dashboard" aria-label="Admin Dashboard" style="display: none;"><i class="fas fa-cog"></i></button>
        <div class="notification-container" style="position: relative;">
          <button class="header-btn" id="notificationsBtn" onclick="toggleNotifications()" title="Notifications" aria-label="Notifications" style="display: none;">
            <i class="fas fa-bell"></i>
            <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
          </button>
          <div class="notification-dropdown" id="notificationDropdown">
            <div class="notification-header">Messages</div>
            <div class="notification-list" id="notificationList">
              <div class="notification-loading">Loading...</div>
            </div>
          </div>
        </div>
        <button class="header-btn logout" onclick="handleLogout()" title="Logout" aria-label="Logout" style="display: none;" id="logoutBtn"><i class="fas fa-sign-out-alt"></i></button>
        <button class="header-btn-text" onclick="window.location.href='login.html'" id="signinBtn" title="Log In or Create an Account" aria-label="Log In or Create an Account">Join / Log In</button>
      </div>
    </header>

    <nav class="desktop-nav" aria-label="Primary navigation">
      <a href="index.html" class="desktop-nav-link">Home</a>
      <a href="browse.html" class="desktop-nav-link">Marketplace</a>
      <a href="community-hub.html" class="desktop-nav-link">Community Hub</a>
      <a href="support-legal-hub.html" class="desktop-nav-link">Support Hub</a>
      <a href="messages.html" class="desktop-nav-link">Messages</a>
      <a href="profile.html" class="desktop-nav-link" id="desktopProfileLink">Profile</a>
    </nav>
  `;

  // Header CSS styles
  const headerCSS = `
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      /* Header Styles */
      header {
        background: linear-gradient(135deg, #f0f8fc 0%, #f9f9f9 100%);
        color: #333;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        height: 120px;
        overflow: visible;
        position: relative;
      }
      
      .menu-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 10px;
        display: none;
        flex-direction: column;
        gap: 4px;
        z-index: 1000;
      }
      
      .menu-btn span {
        width: 25px;
        height: 3px;
        background: #333;
        border-radius: 2px;
        transition: all 0.3s;
      }
      
      .menu-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
      }
      
      .menu-overlay.active {
        display: block;
      }
      
      .menu-sidebar {
        position: fixed;
        top: 0;
        left: -300px;
        width: 280px;
        height: 100%;
        background: white;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
        transition: left 0.3s;
        z-index: 1000;
        padding: 20px;
      }
      
      .menu-sidebar.active {
        left: 0;
      }
      
      .menu-sidebar h3 {
        color: #475569;
        margin-bottom: 20px;
        padding-bottom: 10px;
      }
      
      .menu-sidebar a {
        display: block;
        padding: 12px;
        color: #333;
        text-decoration: none;
        border-radius: 6px;
        margin-bottom: 8px;
        transition: background 0.2s;
      }
      
      .menu-sidebar a:hover {
        background: #f0f8fc;
      }
      
      .logo-container {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      
      header img.logo {
        width: 200px;
        height: 200px;
        object-fit: contain;
        display: inline-block;
      }
      
      .header-right {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      
      .header-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        font-size: 18px;
        color: #333;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        transition: background 0.2s;
      }
      
      .header-btn i {
        font-size: 18px;
      }
      
      .header-btn:hover {
        background: rgba(0, 0, 0, 0.08);
      }
      
      .header-btn.logout {
        color: #333;
      }
      
      .header-btn.admin-btn {
        color: #FF6B6B;
        font-size: 20px;
      }
      
      .header-btn.admin-btn:hover {
        background: rgba(255, 107, 107, 0.1);
      }
      
      .header-btn-text {
        font-size: 14px;
        font-weight: 600;
        color: #475569;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #475569;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .header-btn-text:hover {
        background: #475569;
        color: white;
      }
      
      /* Notification Styles */
      .notification-container {
        position: relative;
      }
      
      .notification-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #ff4444;
        color: white;
        font-size: 10px;
        font-weight: bold;
        padding: 2px 5px;
        border-radius: 10px;
        min-width: 16px;
        text-align: center;
      }
      
      .notification-dropdown {
        display: none;
        position: absolute;
        top: 50px;
        right: 0;
        width: 350px;
        max-height: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        overflow: hidden;
      }
      
      .notification-dropdown.active {
        display: block;
      }
      
      .notification-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        font-weight: 600;
        font-size: 16px;
        color: #333;
        background: #f5f5f5;
      }
      
      .notification-list {
        max-height: 340px;
        overflow-y: auto;
      }
      
      .notification-item {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        gap: 12px;
      }
      
      .notification-item:hover {
        background: #f5f7f9;
      }
      
      .notification-item.unread {
        background: #f0f8fc;
      }
      
      .notification-image {
        width: 50px;
        height: 50px;
        border-radius: 8px;
        object-fit: cover;
        background: #e0e0e0;
        flex-shrink: 0;
      }
      
      .notification-content {
        flex: 1;
        min-width: 0;
      }
      
      .notification-title {
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .notification-message {
        font-size: 13px;
        color: #666;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .notification-time {
        font-size: 11px;
        color: #999;
        margin-top: 4px;
      }
      
      .notification-loading,
      .notification-empty {
        padding: 40px 20px;
        text-align: center;
        color: #999;
        font-size: 14px;
      }

      .desktop-nav {
        width: 100%;
        padding: 8px 24px;
        background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        position: relative;
        z-index: 10;
      }

      .desktop-nav-link {
        text-decoration: none;
        color: #334155;
        font-size: 13px;
        font-weight: 700;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid transparent;
        transition: all 0.2s ease;
      }

      .desktop-nav-link:hover {
        color: #1d4ed8;
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .desktop-nav-link.active {
        color: #fff;
        background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
        border-color: #1d4ed8;
        box-shadow: 0 4px 12px rgba(29, 78, 216, 0.28);
      }

      @media (max-width: 768px) {
        header {
          height: 86px;
          padding: 8px 10px;
        }

        .menu-overlay {
          top: 86px;
          height: calc(100% - 86px);
        }

        .menu-sidebar {
          top: 86px;
          left: -300px;
          height: calc(100% - 86px);
          padding: 24px 20px 20px;
          overflow-y: auto;
        }

        .menu-sidebar h3 {
          display: none !important;
          margin: 0;
          padding: 0;
          height: 0;
          overflow: hidden;
        }

        .logo-container {
          flex: 1;
          min-width: 0;
        }

        header img.logo {
          width: 120px;
          height: 120px;
        }

        .header-right {
          gap: 4px;
          flex-shrink: 0;
        }

        .header-btn {
          width: 34px;
          height: 34px;
          padding: 6px;
        }

        .header-btn i {
          font-size: 15px;
        }

        .header-btn-text {
          font-size: 16px;
          padding: 6px 8px;
        }

        .notification-dropdown {
          width: min(92vw, 350px);
          right: -8px;
        }

        .menu-btn {
          display: flex;
        }

        .desktop-nav {
          display: none;
        }
      }
    </style>
  `;

  // Wait for DOM to be ready
  function initHeader() {
    const container = document.getElementById('header-container');
    if (!container) {
      console.warn('header-container div not found in HTML');
      return;
    }

    // Inject CSS
    document.head.insertAdjacentHTML('beforeend', headerCSS);

    // Inject HTML
    container.innerHTML = headerHTML;

    // Setup event listeners and authentication
    setupHeaderFunctionality();
  }

  // Header functionality
  function setupHeaderFunctionality() {
    let notificationBadgeIntervalId = null;

    function getAuthInstance() {
      if (window.firebaseAuth) return window.firebaseAuth;
      if (window.firebase && typeof window.firebase.auth === 'function') return window.firebase.auth();
      return null;
    }

    function getDbInstance() {
      if (window.firebaseDb) return window.firebaseDb;
      if (window.firebase && typeof window.firebase.firestore === 'function') return window.firebase.firestore();
      return null;
    }

    function applyProfileNavTarget(isBusiness) {
      const targetHref = isBusiness ? 'business-hub.html' : 'profile.html';
      const targetLabel = isBusiness ? 'Business Hub' : 'Profile';

      const menuProfileLink = document.getElementById('menuProfileLink');
      const desktopProfileLink = document.getElementById('desktopProfileLink');

      if (menuProfileLink) {
        menuProfileLink.href = targetHref;
        menuProfileLink.textContent = targetLabel;
      }

      if (desktopProfileLink) {
        desktopProfileLink.href = targetHref;
        desktopProfileLink.textContent = targetLabel;
      }
    }

    async function updateProfileNavTargetForAccount() {
      try {
        const auth = getAuthInstance();
        const currentUser = auth && auth.currentUser ? auth.currentUser : null;

        if (!currentUser) {
          applyProfileNavTarget(false);
          return;
        }

        const db = getDbInstance();
        if (!db) {
          applyProfileNavTarget(false);
          return;
        }

        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        const isBusiness = String(userData.accountType || '').toLowerCase() === 'business';
        applyProfileNavTarget(isBusiness);
      } catch (error) {
        console.warn('Could not determine account type for header nav:', error);
        applyProfileNavTarget(false);
      } finally {
        updateDesktopNavActiveLink();
      }
    }

    function updateDesktopNavActiveLink() {
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const links = document.querySelectorAll('.desktop-nav-link');
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const isActive = href === currentPath || (currentPath === '' && href === 'index.html');
        link.classList.toggle('active', isActive);
      });
    }

    // Check if user is authenticated via localStorage
    function checkAuthStatus() {
      try {
        const userToken = localStorage.getItem('userToken');
        const userName = localStorage.getItem('userName');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        return {
          isLoggedIn: !!userToken,
          userName: userName || 'Profile',
          isAdmin: isAdmin
        };
      } catch (err) {
        return { isLoggedIn: false, userName: 'Profile', isAdmin: false };
      }
    }
    
    function updateHeaderButtons() {
      const { isLoggedIn, userName, isAdmin } = checkAuthStatus();
      
      const adminBtn = document.getElementById('adminBtn');
      const notificationsBtn = document.getElementById('notificationsBtn');
      const messagesBtn = document.getElementById('messagesBtn');
      const profileBtn = document.getElementById('profileBtn');
      const logoutBtn = document.getElementById('logoutBtn');
      const signinBtn = document.getElementById('signinBtn');
      
      // Check if we're on an auth page (login, signup, forgot-password)
      const currentPage = window.location.pathname;
      const isAuthPage = currentPage.includes('login.html') || 
                          currentPage.includes('signup.html') || 
                          currentPage.includes('forgot-password.html');
      
      // Hide all auth buttons on auth pages
      if (isAuthPage) {
        if (adminBtn) adminBtn.style.display = 'none';
        if (notificationsBtn) notificationsBtn.style.display = 'none';
        if (messagesBtn) messagesBtn.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        signinBtn.style.display = 'none';
        return;
      }
      
      if (isLoggedIn) {
        signinBtn.style.display = 'none';
        
        // Show profile and logout for all logged-in users
        if (notificationsBtn) notificationsBtn.style.display = 'flex';
        if (messagesBtn) messagesBtn.style.display = 'flex';
        if (profileBtn) profileBtn.style.display = 'flex';
        logoutBtn.style.display = 'flex';
        
        // Show admin button only for admins
        if (isAdmin && adminBtn) {
          adminBtn.style.display = 'flex';
        } else if (adminBtn) {
          adminBtn.style.display = 'none';
        }

        updateProfileNavTargetForAccount();
      } else {
        signinBtn.style.display = 'block';
        if (notificationsBtn) notificationsBtn.style.display = 'none';
        if (messagesBtn) messagesBtn.style.display = 'none';
        if (profileBtn) profileBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        if (adminBtn) {
          adminBtn.style.display = 'none';
        }

        applyProfileNavTarget(false);
      }
    }
    
    window.handleLogout = function() {
      try {
        const auth = getAuthInstance();
        if (auth) {
          auth.signOut().catch((error) => {
            console.error('Firebase sign out error:', error);
          });
        }
      } catch (error) {
        console.error('Logout error:', error);
      }

      localStorage.removeItem('userToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('isAdmin');
      updateHeaderButtons();
      alert('You have been signed out.');
    };
    
    window.toggleMenu = function() {
      const overlay = document.getElementById('menuOverlay');
      const sidebar = document.getElementById('menuSidebar');
      if (overlay && sidebar) {
        overlay.classList.toggle('active');
        sidebar.classList.toggle('active');
      }
    };

    // Notification dropdown functions
    window.toggleNotifications = function() {
      const dropdown = document.getElementById('notificationDropdown');
      if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        dropdown.classList.toggle('active');
        
        // Load notifications when opening
        if (!isActive) {
          loadNotifications();
        }
      }
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
      const dropdown = document.getElementById('notificationDropdown');
      const notifBtn = document.getElementById('notificationsBtn');
      if (dropdown && !dropdown.contains(event.target) && event.target !== notifBtn && !notifBtn?.contains(event.target)) {
        dropdown.classList.remove('active');
      }
    });

    // Load notifications from Firestore
    async function loadNotifications() {
      const notificationList = document.getElementById('notificationList');
      if (!notificationList) return;

      try {
        // Check if Firebase is available
        const db = getDbInstance();
        const auth = getAuthInstance();
        if (!db || !auth) {
          notificationList.innerHTML = '<div class="notification-empty">Unable to load notifications</div>';
          return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
          notificationList.innerHTML = '<div class="notification-empty">Please sign in to view notifications</div>';
          return;
        }

        notificationList.innerHTML = '<div class="notification-loading">Loading...</div>';

        // Fetch threads with unread messages
        const threadsSnapshot = await db.collection('threads')
          .where('participantIds', 'array-contains', currentUser.uid)
          .orderBy('lastTimestamp', 'desc')
          .limit(10)
          .get();

        const threads = [];
        threadsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.unreadBy && data.unreadBy.includes(currentUser.uid)) {
            threads.push({ id: doc.id, ...data });
          }
        });

        if (threads.length === 0) {
          notificationList.innerHTML = '<div class="notification-empty">No new messages</div>';
          return;
        }

        // Display notifications
        notificationList.innerHTML = threads.map(thread => {
          const timestamp = thread.lastTimestamp?.toDate();
          const timeAgo = timestamp ? formatTimeAgo(timestamp) : 'Recently';
          
          return `
            <div class="notification-item unread" onclick="window.location.href='messages.html?threadId=${thread.id}'">
              ${thread.listingImage ? 
                `<img src="${thread.listingImage}" class="notification-image" onerror="this.style.display='none'">` : 
                '<div class="notification-image"></div>'}
              <div class="notification-content">
                <div class="notification-title">${escapeNotificationHtml(thread.listingTitle || 'New Message')}</div>
                <div class="notification-message">${escapeNotificationHtml(thread.lastMessage || 'No message preview')}</div>
                <div class="notification-time">${timeAgo}</div>
              </div>
            </div>
          `;
        }).join('');

      } catch (error) {
        console.error('Error loading notifications:', error);
        notificationList.innerHTML = '<div class="notification-empty">Error loading notifications</div>';
      }
    }

    // Update notification badge count
    async function updateNotificationBadge() {
      const badge = document.getElementById('notificationBadge');
      if (!badge) return;

      try {
        // Check if Firebase is available
        const db = getDbInstance();
        const auth = getAuthInstance();
        if (!db || !auth) {
          badge.style.display = 'none';
          return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
          badge.style.display = 'none';
          return;
        }

        // Count threads with unread messages
        const threadsSnapshot = await db.collection('threads')
          .where('participantIds', 'array-contains', currentUser.uid)
          .get();

        let unreadCount = 0;
        threadsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.unreadBy && data.unreadBy.includes(currentUser.uid)) {
            unreadCount++;
          }
        });

        if (unreadCount > 0) {
          badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
          badge.style.display = 'block';
        } else {
          badge.style.display = 'none';
        }

      } catch (error) {
        console.error('Error updating notification badge:', error);
        badge.style.display = 'none';
      }
    }

    async function refreshNotificationsUI() {
      await updateNotificationBadge();
      const dropdown = document.getElementById('notificationDropdown');
      if (dropdown?.classList.contains('active')) {
        await loadNotifications();
      }
    }

    window.LocalListNotifications = {
      refresh: refreshNotificationsUI,
    };

    window.addEventListener('localList:notifications-updated', () => {
      refreshNotificationsUI();
    });

    // Helper function to format time ago
    function formatTimeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
      return date.toLocaleDateString();
    }

    // Helper function to escape HTML
    function escapeNotificationHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Set up periodic badge updates
    const auth = getAuthInstance();
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged((user) => {
        if (notificationBadgeIntervalId) {
          clearInterval(notificationBadgeIntervalId);
          notificationBadgeIntervalId = null;
        }

        if (user) {
          updateHeaderButtons();
          updateProfileNavTargetForAccount();
          refreshNotificationsUI();
          // Update badge every 30 seconds
          notificationBadgeIntervalId = setInterval(updateNotificationBadge, 30000);
        } else {
          applyProfileNavTarget(false);
          updateHeaderButtons();
        }
      });
    }

    // Initialize
    updateHeaderButtons();
    updateDesktopNavActiveLink();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }
})();

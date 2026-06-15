// ============================================================
// Gelo Growth OS — Core Application v2
// State management, rendering, filtering, scoring, CRUD
// + Settings Engine, new views, mobile-first navigation
// ============================================================

// Module ID → internal view type mapping (keeps all existing logic intact)
const MODULE_TO_VIEW = {
  today:             'command-center',
  myDay:             'my-day',
  inbox:             'inbox',
  tasks:             'tasks',
  calendar:          'calendar',
  projects:          'projects',
  leads:             'linkedin',
  messages:          'messages',
  salesPipeline:     'prime',
  clients:           'clients',
  brandCommunity:    'scc',
  productsOrders:    'calmera',
  content:           'repurposing',
  operations:        'operations',
  finance:           'finance',
  notes:             'notes',
  sops:              'sops',
  files:             'files',
  templates:         'templates',
  personalDashboard: 'personal-dashboard',
  goals:             'goals',
  habits:            'habits',
  learning:          'learning',
  reports:           'reports',
  automations:       'automations',
  settings:          'settings',
};
const VIEW_TO_MODULE = Object.fromEntries(Object.entries(MODULE_TO_VIEW).map(([k,v]) => [v,k]));

// Bottom-nav primary modules (always visible)
const BOTTOM_NAV_MODULES = ['today', 'calendar', 'leads', 'messages'];
// Modules that go in the "More" drawer
const DRAWER_MODULES = ['salesPipeline', 'brandCommunity', 'productsOrders', 'content', 'settings'];

class GeloGrowthOS {
  constructor() {
    // State
    this.currentView    = 'command-center';
    this.currentModule  = 'today';
    this.data           = null;
    this.filteredData   = null;
    this.filters        = { status: 'all', priority: 'all', search: '' };
    this.selectedRecord = null;
    this.sheetsConnected = false;
    this.syncStatus     = localStorage.getItem('gos_sheets_connected') === 'true' ? 'Synced' : 'Disconnected';
    this.syncError      = null;
    this.lastSynced     = localStorage.getItem('gos_last_synced') || 'Never';
    this.sortConfig     = { key: null, direction: 'asc' };
    this.confirmCallback = null;
    this._calViewMode = localStorage.getItem('gos_calendar_view_pref') || (window.innerWidth < 768 ? 'list' : 'calendar');
    this._calLayout = localStorage.getItem('gos_calendar_layout_pref') || 'month';
    this._calActiveDate = new Date();
    this._calSortKey = 'date';
    this._calSortDir = 'asc';
    this._calFilter = 'all';
    this._calCatFilter = 'all';
    this._calTypeFilter = 'all';
    this._calPriorityFilter = 'all';
    this._calStatusFilter = 'all';
    this._msgTone       = 'warm';
    this._currentMessage = null;
    this._sidebarCollapsed = localStorage.getItem('gos_sidebar_collapsed') === 'true';
    this.notifications = JSON.parse(localStorage.getItem('gos_notifications_log') || '[]');
    const storedCols = localStorage.getItem('gos_task_columns');
    this.taskColumns = storedCols ? JSON.parse(storedCols) : ['To Do', 'In Progress', 'Waiting', 'Review', 'Completed'];
    const hasSheets = typeof sheetsService !== 'undefined' && sheetsService.isConfigured();
    const isSheetsConnected = localStorage.getItem('gos_sheets_connected') === 'true';
    this.landingSyncState = (!hasSheets || isSheetsConnected) ? 'ready' : 'idle';
    this.landingSyncError = null;

    // Init
    try {
      this.loadData();
      this.bindEvents();
      this._initApp();
    } catch (e) {
      console.error('[GeloGrowthOS] Initialization failed:', e);
      const content = document.getElementById('main-content');
      if (content) {
        content.className = 'gos-content';
        content.innerHTML = `
          <div style="padding:40px; text-align:center; max-width:500px; margin: 40px auto; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow: var(--shadow-lg)">
            <h3 style="color:var(--red); margin-bottom:12px; font-weight:700">⚠️ Initialization Error</h3>
            <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:20px">
              Growth OS failed to start. This is usually caused by outdated or incompatible cached settings in your browser's local storage.
            </p>
            <div style="display:flex; gap:12px; justify-content:center; margin-bottom:20px">
              <button class="topbar-btn-primary" onclick="localStorage.clear(); location.reload();" style="background:var(--red); border-color:var(--red); cursor:pointer">
                Clear Cache & Reload
              </button>
              <button class="topbar-btn-primary" onclick="location.reload();" style="background:var(--surface-hover); border:1px solid var(--border); color:var(--text-primary); cursor:pointer">
                Retry Reload
              </button>
            </div>
            <pre style="margin-top:20px; text-align:left; background:var(--surface-hover); padding:12px; border-radius:var(--radius-sm); font-size:11px; overflow-x:auto; color:var(--text-muted); border:1px solid var(--border)">${e.stack || e.message}</pre>
          </div>
        `;
      }
    }
  }

  // ── App Initialization ───────────────────────────────────────
  _initApp() {
    // Apply saved theme immediately
    settingsEngine.applyTheme();

    // Build navigation from settings
    this.buildNavigation();

    // Update profile in sidebar
    this.updateSidebarProfile();

    // Update app name
    this.updateAppName();

    // Set initial page title
    document.getElementById('page-title').textContent = settingsEngine.getWorkspaceName();

    // Apply sidebar state
    this.applySidebarState();

    // Determine initial view and render it according to URL routing
    this.handleRouting();

    // Render notifications UI
    this.updateNotificationsUI();
  }

  // ── Sidebar Toggle Helpers ──────────────────────────────────
  applySidebarState() {
    const sidebar = document.getElementById('sidebar');
    const appEl = document.getElementById('app');
    const toggleBtn = document.getElementById('btn-sidebar-toggle');

    if (this._sidebarCollapsed) {
      if (sidebar) sidebar.classList.add('collapsed');
      if (appEl) appEl.classList.add('sidebar-collapsed');
      if (toggleBtn) {
        toggleBtn.innerHTML = '◨';
        toggleBtn.title = 'Expand sidebar';
        toggleBtn.setAttribute('aria-label', 'Expand sidebar');
      }
    } else {
      if (sidebar) sidebar.classList.remove('collapsed');
      if (appEl) appEl.classList.remove('sidebar-collapsed');
      if (toggleBtn) {
        toggleBtn.innerHTML = '◧';
        toggleBtn.title = 'Collapse sidebar';
        toggleBtn.setAttribute('aria-label', 'Collapse sidebar');
      }
    }
  }

  toggleSidebar() {
    this._sidebarCollapsed = !this._sidebarCollapsed;
    localStorage.setItem('gos_sidebar_collapsed', this._sidebarCollapsed);
    this.applySidebarState();
  }

  toggleNavGroup(catId) {
    const el = document.getElementById(`nav-group-${catId}`);
    if (el) {
      el.classList.toggle('collapsed');
      const isCollapsed = el.classList.contains('collapsed');
      localStorage.setItem(`gos_nav_group_${catId}_collapsed`, isCollapsed);
    }
  }

  // ── Build Navigation from Settings ──────────────────────────
  buildNavigation() {
    const settings = settingsEngine.get();
    const modules  = settingsEngine.getVisibleModules();

    // Group modules by category
    const categories = {
      core: { label: 'Core', items: [] },
      business: { label: 'Business', items: [] },
      knowledge: { label: 'Knowledge', items: [] },
      personal: { label: 'Personal', items: [] },
      system: { label: 'System', items: [] }
    };

    modules.forEach(mod => {
      const cat = mod.category || 'core';
      if (categories[cat]) {
        categories[cat].items.push(mod);
      } else {
        categories['core'].items.push(mod);
      }
    });

    // Build sidebar nav
    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      let navHtml = '';
      Object.entries(categories).forEach(([catId, catObj]) => {
        if (catObj.items.length === 0) return;
        
        const isCollapsed = localStorage.getItem(`gos_nav_group_${catId}_collapsed`) === 'true';
        navHtml += `
          <div class="nav-group ${isCollapsed ? 'collapsed' : ''}" id="nav-group-${catId}">
            <div class="nav-group-header" onclick="app.toggleNavGroup('${catId}')">
              <span>${catObj.label}</span>
              <span class="nav-group-chevron">▾</span>
            </div>
            <div class="nav-group-items">
        `;
        
        catObj.items.forEach(mod => {
          navHtml += `
            <button class="gos-nav-item ${this.currentModule === mod.id ? 'active' : ''}" 
                    data-module="${mod.id}"
                    onclick="app.navigateTo('${mod.id}')"
                    title="${mod.label}">
              <span class="nav-item-icon">${getIconSvg(MODULE_ICON_MAP[mod.id] || 'info', 18)}</span>
              <span class="nav-item-label">${mod.label}</span>
              ${mod.id === 'today' ? '<span class="nav-item-badge" id="nav-badge-overdue" style="display:none">0</span>' : ''}
              ${mod.id === 'tasks' ? '<span class="nav-item-badge" id="nav-badge-tasks-todo" style="display:none">0</span>' : ''}
            </button>
          `;
        });
        
        navHtml += `
            </div>
          </div>
        `;
      });
      nav.innerHTML = navHtml;
    }

    // Build mobile bottom-nav labels & icons dynamically
    BOTTOM_NAV_MODULES.forEach(moduleId => {
      const mod = settings.modules.find(m => m.id === moduleId);
      if (!mod) return;
      
      const btn = document.getElementById(`mob-nav-${moduleId}`);
      if (btn) {
        const iconSpan = btn.querySelector('.mob-nav-icon');
        if (iconSpan) {
          iconSpan.innerHTML = getIconSvg(MODULE_ICON_MAP[moduleId] || 'info', 20);
        }
      }
      
      const label = document.getElementById(`mob-label-${moduleId}`);
      if (label) label.textContent = mod.label;
    });

    // Build "More" drawer nav
    const drawer = document.getElementById('drawer-nav');
    if (drawer) {
      const drawerMods = modules.filter(m => !BOTTOM_NAV_MODULES.includes(m.id));
      drawer.innerHTML = drawerMods.map(mod => `
        <button class="drawer-nav-item ${this.currentModule === mod.id ? 'active' : ''}"
                data-module="${mod.id}"
                onclick="app.navigateTo('${mod.id}'); app.closeMoreDrawer();">
          <span class="drawer-nav-icon">${getIconSvg(MODULE_ICON_MAP[mod.id] || 'info', 18)}</span>
          <span>${mod.label}</span>
        </button>
      `).join('');
    }
  }

  // ── Update Sidebar Profile ───────────────────────────────────
  updateSidebarProfile() {
    const p = settingsEngine.getProfile();
    const el = (id) => document.getElementById(id);
    if (el('sidebar-avatar')) el('sidebar-avatar').textContent = p.avatarInitials || 'GV';
    if (el('sidebar-name'))   el('sidebar-name').textContent   = p.displayName   || 'Gelo';
    if (el('sidebar-company')) el('sidebar-company').textContent = `${p.company || ''} · ${p.role || ''}`;
  }

  // ── Update App Name ──────────────────────────────────────────
  updateAppName() {
    const name = settingsEngine.getWorkspaceName();
    const el = document.getElementById('sidebar-app-name');
    if (el) el.textContent = name;
    document.getElementById('page-title').textContent = name;
  }

  // ── Primary Navigation ───────────────────────────────────────
  navigateTo(moduleId) {
    // Determine internal view type
    const viewType = MODULE_TO_VIEW[moduleId] || moduleId;
    this.currentModule = moduleId;
    this.currentView   = viewType;
    this.filters = { status: 'all', priority: 'all', search: '' };
    this.sortConfig = { key: null, direction: 'asc' };

    // Update URL path mapping to match router paths
    const moduleToPath = {
      today: '/app',
      tasks: '/app/tasks',
      projects: '/app/projects',
      leads: '/app/crm',
      content: '/app/content',
      operations: '/app/operations',
      goals: '/app/goals',
    };
    const path = moduleToPath[moduleId];
    if (path && window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    } else if (!path && !window.location.pathname.startsWith('/app')) {
      window.history.pushState(null, '', '/app');
    }

    // Update nav active states
    this._updateActiveNav(moduleId);

    // Update topbar
    this.updateTopbar();

    // Update filter options
    this.updateFilterOptions();

    // Apply filters and render
    this.applyFilters();
    this.renderContent();

    // Reset search input
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';

    // Reset filter dropdown
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) statusFilter.value = 'all';

    // Close any open overlays
    this.closeMoreDrawer();
    this.closeMobileSidebar();
  }

  _updateActiveNav(moduleId) {
    // Sidebar nav items
    document.querySelectorAll('.gos-nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === moduleId);
    });
    // Bottom nav buttons
    document.querySelectorAll('.mobile-nav-btn[data-module]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.module === moduleId);
    });
    // Drawer nav items
    document.querySelectorAll('.drawer-nav-item[data-module]').forEach(item => {
      item.classList.toggle('active', item.dataset.module === moduleId);
    });
  }

  // ── Mobile Sidebar ───────────────────────────────────────────
  openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.add('active');
  }

  closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
  }

  // ── More Drawer ──────────────────────────────────────────────
  openMoreDrawer() {
    document.getElementById('mobile-drawer')?.classList.add('open');
    document.getElementById('drawer-backdrop').style.display = 'block';
  }

  closeMoreDrawer() {
    document.getElementById('mobile-drawer')?.classList.remove('open');
    const bd = document.getElementById('drawer-backdrop');
    if (bd) bd.style.display = 'none';
  }

  // ── Theme Toggle ────────────────────────────────────────────
  toggleTheme() {
    const newTheme = settingsEngine.toggleTheme();
    this.showToast(`Switched to ${newTheme} mode`, 'success');
  }

  // ── Handle search (replaces previous event listener approach) 
  handleSearch(value) {
    this.filters.search = value.toLowerCase();
    this.applyFilters();
    this.renderContent();
  }

  // ── Handle filter status dropdown
  handleFilterStatus(value) {
    this.filters.status = value;
    this.applyFilters();
    this.renderContent();
  }

  // ── Confirm Dialog ───────────────────────────────────────────
  showConfirm(title, message, btnLabel, callback) {
    this.confirmCallback = callback;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-action-btn').textContent = btnLabel || 'Confirm';
    document.getElementById('confirm-modal-overlay').style.display = 'flex';
  }
  executeConfirm() {
    document.getElementById('confirm-modal-overlay').style.display = 'none';
    if (this.confirmCallback) { this.confirmCallback(); this.confirmCallback = null; }
  }
  cancelConfirm() {
    document.getElementById('confirm-modal-overlay').style.display = 'none';
    this.confirmCallback = null;
  }

  // ── Data Loading ────────────────────────────────────────────
  saveLocalData() {
    try {
      localStorage.setItem('gos_local_database', JSON.stringify(this.data));
    } catch (e) {
      console.error('[GeloGrowthOS] saveLocalData failed:', e);
    }
  }

  getFriendlyErrorMessage(err) {
    const msg = err.message || String(err);
    if (msg.includes("Failed to fetch") || msg.includes("Network request failed")) {
      return "Network request failed. Check your internet connection or check if the Apps Script URL/CORS configuration is correct.";
    }
    if (msg.includes("HTTP 401") || msg.includes("401")) {
      return "Google Sheets access was denied (HTTP 401). Check permissions.";
    }
    if (msg.includes("HTTP 403") || msg.includes("403")) {
      return "Google Sheets access was denied (HTTP 403). Check Apps Script deployment settings.";
    }
    if (msg.includes("HTTP 404") || msg.includes("404")) {
      return "Apps Script URL not found (HTTP 404). Check deployment URL.";
    }
    if (msg.includes("HTTP 500") || msg.includes("500")) {
      return "The server returned HTTP 500. Apps Script execution failed — check Apps Script logs.";
    }
    // New descriptive "tab not found" error from updated sheet-api.gs
    if (msg.includes("was not found in your spreadsheet and has no default configuration")) {
      const match = msg.match(/Sheet tab "([^"]+)"/i);
      const tab = match ? match[1] : "unknown";
      return `Sheet tab "${tab}" was not found. Redeploy the latest sheet-api.gs as a Web App — it will auto-create all missing tabs.`;
    }
    if (msg.includes("has no default configuration")) {
      const match = msg.match(/Tab "([^"]+)"/);
      const tab = match ? match[1] : "unknown";
      return `Sheet tab "${tab}" was not found in sheets-config default mappings. Redeploy the latest sheet-api.gs.`;
    }
    if (msg.toLowerCase().includes("not found") && (msg.toLowerCase().includes("tab") || msg.toLowerCase().includes("sheet"))) {
      const match = msg.match(/Tab "([^"]+)"/i) || msg.match(/tab ([^\s]+)/i) || msg.match(/sheet "([^"]+)"/i) || msg.match(/sheet ([^\s]+)/i);
      const tab = match ? match[1].replace(/\\/g, '').replace(/"/g, '').trim() : "requested";
      return `Google Sheets tab "${tab}" was not found. Redeploy the latest sheet-api.gs as a Web App to enable auto-creation of missing tabs.`;
    }
    if (msg.includes("Column") && msg.includes("not found")) {
      return msg;
    }
    return msg;
  }

  renderSyncBadgeInline(viewType, id, record) {
    if (this.sheetsConnected && (record._syncStatus === 'Pending Sync' || record._syncStatus === 'Sync Failed')) {
      return `<span class="gos-badge badge-pending-sync clickable" style="cursor:pointer; margin-left:6px; user-select:none;" onclick="event.stopPropagation(); app.retryRecordSync('${viewType}', '${id}')" title="Sync Pending. Click to retry.">⏳ Sync Pending</span>`;
    }
    return '';
  }

  async retryRecordSync(viewType, id) {
    if (!this.sheetsConnected) {
      this.showToast('⚠️ Cannot retry sync: Google Sheets is disconnected.', 'warning');
      return;
    }

    const dataMap = {
      'linkedin':   { data: this.data.linkedinLeads,    idKey: 'leadId',       tabKey: 'linkedinLeads' },
      'prime':      { data: this.data.primePipeline,    idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':        { data: this.data.sccContent,       idKey: 'contentId',     tabKey: 'sccContent' },
      'calmera':    { data: this.data.calmeraOrders,    idKey: 'orderId',       tabKey: 'calmeraOrders' },
      'repurposing':{ data: this.data.repurposeOutputs, idKey: 'outputId',      tabKey: 'repurposeOutputs' },
      'tasks':      { data: this.data.tasks,            idKey: 'taskId',        tabKey: 'tasks' },
      'projects':   { data: this.data.projects,         idKey: 'projectId',     tabKey: 'projects' },
      'clients':    { data: this.data.clients,          idKey: 'clientId',      tabKey: 'clients' },
      'goals':      { data: this.data.goals,            idKey: 'goalId',        tabKey: 'goals' },
      'habits':     { data: this.data.habits,           idKey: 'habitId',       tabKey: 'habits' },
      'learning':   { data: this.data.learning,         idKey: 'learningId',    tabKey: 'learning' },
      'notes':      { data: this.data.notes,            idKey: 'noteId',        tabKey: 'notes' },
      'sops':       { data: this.data.sops,             idKey: 'sopId',         tabKey: 'sops' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => String(r[config.idKey]) === String(id));
    if (!record) return;

    this.showToast('🔄 Retrying sync...', 'info');
    this.updateTopbarSyncStatus('syncing');

    record._syncStatus = 'Syncing';
    this.render(); // update badges
    if (this.selectedRecord && this.selectedRecord.record[config.idKey] === id) {
      this.openRecordPanel(viewType, id);
    }

    try {
      // Relational self-repair/sync contacts and orgs first if applicable
      if (viewType === 'linkedin' || viewType === 'prime') {
        const contact = (this.data.contacts || []).find(c => c.fullName === record.contactName || c.contactId === record.contactId);
        if (contact) {
          if (contact._rowIndex === undefined) {
            const res = await sheetsService.appendRecord('contacts', contact);
            if (res && res.rowsAfter !== undefined) contact._rowIndex = res.rowsAfter - 1;
          } else {
            await sheetsService.updateRecord('contacts', contact._rowIndex, contact);
          }
        }
        const org = (this.data.organizations || []).find(o => o.organizationName === record.company || o.organizationId === record.organizationId);
        if (org) {
          if (org._rowIndex === undefined) {
            const res = await sheetsService.appendRecord('organizations', org);
            if (res && res.rowsAfter !== undefined) org._rowIndex = res.rowsAfter - 1;
          } else {
            await sheetsService.updateRecord('organizations', org._rowIndex, org);
          }
        }
      }

      // Send record
      if (record._rowIndex !== undefined) {
        await sheetsService.updateRecord(config.tabKey, record._rowIndex, record);
      } else {
        const res = await sheetsService.appendRecord(config.tabKey, record);
        if (res && res.rowsAfter !== undefined) {
          record._rowIndex = res.rowsAfter - 1;
        }
      }

      delete record._syncStatus;
      delete record._syncError;
      this.saveLocalData();
      this.updateTopbarSyncStatus('synced');
      this.showToast('✅ Sync successful!', 'success');
    } catch (err) {
      console.error('Retry sync failed:', err);
      const userError = this.getFriendlyErrorMessage(err);
      record._syncStatus = 'Sync Failed';
      record._syncError = userError;
      this.saveLocalData();
      this.updateTopbarSyncStatus('error');
      this.showToast(`⚠️ Sync failed: ${userError}`, 'error');
    }

    this.render();
    if (this.selectedRecord && this.selectedRecord.record[config.idKey] === id) {
      this.openRecordPanel(viewType, id);
    }
  }

  mergeLocalPendingRecords(key, loadedRows) {
    const localRows = this.data[key] || [];
    const idKeyMap = {
      contacts: 'contactId',
      organizations: 'organizationId',
      linkedinLeads: 'leadId',
      primePipeline: 'opportunityId',
      sccContent: 'contentId',
      calmeraOrders: 'orderId',
      repurposeOutputs: 'outputId',
      interactions: 'interactionId',
      tasks: 'taskId',
      projects: 'projectId',
      clients: 'clientId',
      goals: 'goalId',
      habits: 'habitId',
      learning: 'learningId',
      notes: 'noteId',
      sops: 'sopId',
    };
    const idKey = idKeyMap[key];
    if (!idKey) return loadedRows;

    const loadedByRowIndex = {};
    loadedRows.forEach(row => {
      if (row._rowIndex !== undefined) {
        loadedByRowIndex[row._rowIndex] = row;
      }
    });

    const merged = [];
    const processedRowIndices = new Set();
    const localPendingOrUnsynced = localRows.filter(r => r._syncStatus === 'Pending Sync' || r._syncStatus === 'Sync Failed' || r._rowIndex === undefined);

    const localPendingByRowIndex = {};
    const localPendingById = {};
    localPendingOrUnsynced.forEach(r => {
      if (r._rowIndex !== undefined) {
        localPendingByRowIndex[r._rowIndex] = r;
      }
      if (r[idKey]) {
        localPendingById[r[idKey]] = r;
      }
    });

    loadedRows.forEach(row => {
      const idx = row._rowIndex;
      const id = row[idKey];
      let rowToUse = row;

      if (idx !== undefined && localPendingByRowIndex[idx]) {
        rowToUse = localPendingByRowIndex[idx];
        processedRowIndices.add(idx);
      } else if (id && localPendingById[id]) {
        rowToUse = localPendingById[id];
        if (rowToUse._rowIndex !== undefined) {
          processedRowIndices.add(rowToUse._rowIndex);
        }
      }
      merged.push(rowToUse);
    });

    localPendingOrUnsynced.forEach(r => {
      const alreadyProcessed = (r._rowIndex !== undefined && processedRowIndices.has(r._rowIndex)) || 
                               (r[idKey] && merged.some(m => m[idKey] === r[idKey]));
      if (!alreadyProcessed) {
        merged.push(r);
      }
    });

    return merged;
  }

  loadLocalDataFallback() {
    const localRaw = localStorage.getItem('gos_local_database');
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        this.data = { ...DEMO_DATA, ...parsed };
        this.applyFilters();
        this.render();
      } catch (e) {
        console.warn('[GeloGrowthOS] loadLocalDataFallback failed:', e);
      }
    }
  }

  loadData() {
    const isSheets = localStorage.getItem('gos_sheets_connected') === 'true';
    if (!isSheets) {
      const localRaw = localStorage.getItem('gos_local_database');
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          this.data = { ...DEMO_DATA, ...parsed };
          this.applyFilters();
          return;
        } catch (e) {
          console.warn('[GeloGrowthOS] Load local database failed:', e);
        }
      }
    }
    this.data = { ...DEMO_DATA };
    this.applyFilters();
  }

  // ── Event Binding ───────────────────────────────────────────
  bindEvents() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
        this.closeModal('add-modal');
        this.closeModal('msg-modal');
        this.closeMobileSidebar();
        this.closeMoreDrawer();
      }
    });

    // History API popstate handler
    window.addEventListener('popstate', () => {
      this.handleRouting();
    });

    // Click outside handler for landing page profile dropdown
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('landing-account-dropdown');
      if (dropdown && dropdown.classList.contains('show')) {
        const area = document.getElementById('landing-account-area');
        if (area && !area.contains(e.target)) {
          dropdown.classList.remove('show');
        }
      }
    });
  }

  // ── View Switching (legacy support — use navigateTo() for new code) ─
  switchView(view) {
    // If given a module ID, delegate to navigateTo
    if (MODULE_TO_VIEW[view]) { this.navigateTo(view); return; }
    // If given an internal view type, find the module and navigate
    const moduleId = VIEW_TO_MODULE[view] || view;
    this.navigateTo(moduleId);
  }

  // ── Filter Options per View ─────────────────────────────────
  updateFilterOptions() {
    const statusFilter = document.getElementById('filter-status');
    if (!statusFilter) return;

    const options = { 'all': 'All Statuses' };

    switch (this.currentView) {
      case 'linkedin':
        Object.assign(options, { 'New': 'New', 'Qualified': 'Qualified', 'Contacted': 'Contacted', 'Nurturing': 'Nurturing', 'Closed': 'Closed', 'Recycle': 'Recycle' });
        break;
      case 'prime':
        Object.assign(options, { 'New Inquiry': 'New Inquiry', 'Qualified': 'Qualified', 'Discovery': 'Discovery', 'Proposal Sent': 'Proposal Sent', 'Negotiation': 'Negotiation', 'Won': 'Won', 'Lost': 'Lost', 'Handoff': 'Handoff', 'Closed': 'Closed' });
        break;
      case 'scc':
        Object.assign(options, { 'Idea': 'Idea', 'Planned': 'Planned', 'Draft': 'Draft', 'Review': 'Review', 'Scheduled': 'Scheduled', 'Published': 'Published', 'Archived': 'Archived' });
        break;
      case 'calmera':
        Object.assign(options, { 'Pending Contact': 'Pending Contact', 'Awaiting Response': 'Awaiting Response', 'Confirmed': 'Confirmed', 'Changed': 'Changed', 'Cancelled': 'Cancelled', 'Escalated': 'Escalated' });
        break;
      case 'repurposing':
        Object.assign(options, { 'Available': 'Available', 'Queued': 'Queued', 'Draft': 'Draft', 'Review': 'Review', 'Scheduled': 'Scheduled', 'Published': 'Published', 'Evaluated': 'Evaluated' });
        break;
      default:
        Object.assign(options, { 'Open': 'Open', 'In Progress': 'In Progress', 'Completed': 'Completed' });
    }

    statusFilter.innerHTML = Object.entries(options)
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('');
  }

  // ── Filtering ───────────────────────────────────────────────
  applyFilters() {
    const viewDataMap = {
      'command-center': 'tasks',
      'linkedin': 'linkedinLeads',
      'prime': 'primePipeline',
      'scc': 'sccContent',
      'calmera': 'calmeraOrders',
      'repurposing': 'repurposeOutputs',
    };

    const dataKey = viewDataMap[this.currentView] || 'tasks';
    let items = [...(this.data[dataKey] || [])];

    // Status filter
    if (this.filters.status !== 'all') {
      items = items.filter(item => {
        const status = item.stage || item.status || item.reconfirmationStatus || '';
        return status === this.filters.status;
      });
    }

    // Priority filter
    if (this.filters.priority !== 'all') {
      items = items.filter(item => (item.priority || '') === this.filters.priority);
    }

    // Search
    if (this.filters.search) {
      items = items.filter(item => {
        const searchable = Object.values(item).join(' ').toLowerCase();
        return searchable.includes(this.filters.search);
      });
    }

    // Sort
    if (this.sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[this.sortConfig.key] || '';
        let bVal = b[this.sortConfig.key] || '';
        if (typeof aVal === 'number') return this.sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        return this.sortConfig.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    this.filteredData = items;
  }

  // ── Sorting ─────────────────────────────────────────────────
  toggleSort(key) {
    if (this.sortConfig.key === key) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig = { key, direction: 'asc' };
    }
    this.applyFilters();
    this.renderContent();
  }

  // ── Main Render ─────────────────────────────────────────────
  render() {
    if (!this.sheetsConnected) {
      this.saveLocalData();
    }
    this.updateTopbar();
    this.renderContent();
  }

  updateTopbar() {
    const settings  = settingsEngine.get();
    const profile   = settings.profile;
    const modules   = settings.modules;

    // Build title from module label
    const mod = modules.find(m => m.id === this.currentModule) || {};
    const defaultSubtitles = {
      today:          'Your personal business command center',
      calendar:       'Your upcoming calls, follow-ups, and scheduled tasks',
      leads:          'Capture, qualify, nurture, and convert your leads',
      messages:       'Generate and copy messages for any lead or stage',
      salesPipeline:  'Track opportunities from inquiry to closed deal',
      brandCommunity: 'Plan, create, and publish community content',
      productsOrders: 'Manage product leads, orders, and customer reconfirmations',
      content:        'Turn source assets into multi-channel content',
      settings:       'Customize your Growth OS workspace',
    };

    const title    = mod.label || 'Dashboard';
    const subtitle = defaultSubtitles[this.currentModule] || mod.description || '';

    const titleEl    = document.getElementById('view-title');
    const subtitleEl = document.getElementById('view-subtitle');
    if (titleEl)    titleEl.textContent    = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }

  _getTimeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }

  renderContent() {
    if (this.currentView === 'landing') {
      const publicShell = document.getElementById('public-homepage-shell');
      if (publicShell) {
        this.renderLandingPage(publicShell);
      }
      return;
    }

    const content = document.getElementById('main-content');
    if (!content) return;

    content.className = 'gos-content animate-fade-in';

    switch (this.currentView) {
      case 'today':             // fall-through — sidebar uses 'today' module
      case 'command-center':    this.renderToday(content); break;
      case 'my-day':            this.renderMyDay(content); break;
      case 'inbox':             this.renderInbox(content); break;
      case 'tasks':             this.renderTasks(content); break;
      case 'calendar':          this.renderCalendar(content); break;
      case 'projects':          this.renderProjects(content); break;
      case 'linkedin':          this.renderLinkedIn(content); break;
      case 'messages':          this.renderMessagesPage(content); break;
      case 'prime':             this.renderPrime(content); break;
      case 'clients':           this.renderClients(content); break;
      case 'scc':               this.renderSCC(content); break;
      case 'calmera':           this.renderCalmera(content); break;
      case 'repurposing':       this.renderRepurposing(content); break;
      case 'operations':        this.renderOperations(content); break;
      case 'finance':           this.renderFinance(content); break;
      case 'notes':             this.renderNotes(content); break;
      case 'sops':              this.renderSops(content); break;
      case 'files':             this.renderFiles(content); break;
      case 'templates':         this.renderTemplates(content); break;
      case 'personal-dashboard': this.renderPersonalDashboard(content); break;
      case 'goals':             this.renderGoals(content); break;
      case 'habits':            this.renderHabits(content); break;
      case 'learning':          this.renderLearning(content); break;
      case 'reports':           this.renderReports(content); break;
      case 'automations':       this.renderAutomations(content); break;
      case 'settings':          this.renderSettings(content); break;
      default:                  this.renderToday(content);
    }
  }

  // ── Today / Command Center ──────────────────────────────────
  renderToday(container) { this.renderCommandCenter(container); }

  renderHeroHeader() {
    const settings = settingsEngine.get();
    const profile = settings.profile || {};
    const displayName = profile.displayName || 'Gelo';
    const timeOfDay = this._getTimeOfDay();
    
    const todayStr = getDemoToday();
    const events = this.gatherCalendarEvents();
    
    const todayEvents = events.filter(e => e.date === todayStr);
    const followUpsToday = todayEvents.filter(e => e.type === 'Follow-up').length;
    const callsToday = todayEvents.filter(e => e.type.toLowerCase().includes('call')).length;
    
    const overdueEvents = events.filter(e => {
      const isBefore = e.date < todayStr;
      const isPending = !['Done', 'Completed', 'Cancelled', 'Rescheduled', 'Confirmed', 'Closed', 'Won', 'Lost'].includes(e.status);
      return isBefore && isPending;
    }).length;

    const summaryText = `
      <div class="hero-summary">
        <span>${followUpsToday} follow-up${followUpsToday === 1 ? '' : 's'}</span>
        <span class="summary-dot">•</span>
        <span>${callsToday} call${callsToday === 1 ? '' : 's'}</span>
        <span class="summary-dot">•</span>
        <span class="${overdueEvents > 0 ? 'text-red font-bold animate-pulse' : ''}">${overdueEvents} overdue</span>
      </div>
    `;

    const today = new Date();
    const dateOpts = { weekday: 'long', month: 'short', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('en-US', dateOpts);

    return `
      <div class="gos-hero-section">
        <div class="hero-left">
          <h2 class="hero-greeting">Good ${timeOfDay}, ${displayName}</h2>
          <span class="hero-subtext">Here’s your focus for today.</span>
          ${summaryText}
        </div>
        <div class="gos-weather-widget">
          <div class="weather-icon-temp">
            <span class="weather-emoji">☀️</span>
            <span class="weather-temp">29°C</span>
          </div>
          <div class="weather-meta">
            <span class="weather-location">Dasmariñas</span>
            <span class="weather-date">${formattedDate}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Legacy Command Center (kept for compatibility) ───────────
  renderCommandCenter(container) {
    const todayStr = getDemoToday();
    const tasks    = this.data.tasks || [];
    const projects = this.data.projects || [];
    const leads    = this.data.linkedinLeads || [];
    const goals    = this.data.goals || [];

    // ── KPI Calculations ──────────────────────────────────────
    // Tasks Today: any task due today (regardless of source)
    const tasksToday = tasks.filter(t => t.dueAt === todayStr);
    const completedStatus = this.taskColumns[this.taskColumns.length - 1] || 'Completed';
    const completedTasksToday = tasksToday.filter(t => this.isTaskCompleted(t)).length;

    // Overdue Tasks: ALL tasks past due and not completed
    const overdueTasks = tasks.filter(t =>
      t.dueAt && t.dueAt < todayStr && !this.isTaskCompleted(t) && t.status !== 'Cancelled'
    );

    // Follow-ups Today: leads whose nextActionDate <= today (also include overdue follow-ups)
    const activeStages = ['Closed Won', 'Closed Lost', 'Not Fit', 'Closed', 'Recycle'];
    const followUpsToday = leads.filter(l =>
      l.nextActionDate && l.nextActionDate <= todayStr &&
      !activeStages.includes(l.stage)
    ).length;

    // Active Projects: not 100% complete
    const activeProjects = projects.filter(p => (p.progress || 0) < 100);

    // ── Load Saved Focus ─────────────────────────────────────
    let dailyFocus = ['', '', ''];
    try {
      const saved = localStorage.getItem('gos_daily_focus');
      if (saved) dailyFocus = JSON.parse(saved);
    } catch (e) {}

    // ── Upcoming Tasks (next 7 items not completed) ───────────
    const upcomingTasks = tasks
      .filter(t => !['Completed', 'Done', 'Cancelled'].includes(t.status) && t.dueAt)
      .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
      .slice(0, 7);

    // ── Today's Outreach list ─────────────────────────────────
    const todayActionsList = leads.filter(l =>
      l.nextActionDate && l.nextActionDate <= todayStr &&
      !activeStages.includes(l.stage)
    );

    // ── Goal Progress ─────────────────────────────────────────
    const activeGoals = goals.filter(g => g.goalName).slice(0, 4);

    container.innerHTML = `
      ${this.renderHeroHeader()}

      <!-- KPI Cards -->
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card" onclick="app.navigateTo('tasks')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Tasks Today</span>
            <span class="gos-kpi-icon">${getIconSvg('checkCircle', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${completedTasksToday}/${tasksToday.length}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Completed vs total due today</div>
        </div>

        <div class="gos-kpi-card${overdueTasks.length > 0 ? ' red' : ''}" onclick="app.navigateTo('tasks')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Overdue Tasks</span>
            <span class="gos-kpi-icon">${getIconSvg('alert', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${overdueTasks.length}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">${overdueTasks.length > 0 ? 'Needs immediate attention' : 'All tasks on track'}</div>
        </div>

        <div class="gos-kpi-card${followUpsToday > 0 ? ' amber' : ''}" onclick="app.navigateTo('leads')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Follow-ups Due</span>
            <span class="gos-kpi-icon">${getIconSvg('user', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${followUpsToday}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">${followUpsToday > 0 ? 'Outreach due today or overdue' : 'No follow-ups due'}</div>
        </div>

        <div class="gos-kpi-card" onclick="app.navigateTo('projects')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Active Projects</span>
            <span class="gos-kpi-icon">${getIconSvg('folder', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${activeProjects.length}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Active work milestones</div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="gos-section-grid">

        <!-- Left Column -->
        <div style="display:flex; flex-direction:column; gap:16px">

          <!-- Daily Focus -->
          <div class="gos-section-card">
            <div class="gos-section-card-header">
              <span class="gos-section-card-title">🎯 Daily Focus Priorities</span>
            </div>
            <div class="gos-section-card-body" style="padding:16px">
              <div class="daily-focus-row" style="margin-bottom:0">
                <input class="daily-focus-input" value="${this._esc(dailyFocus[0])}" placeholder="Priority 1..." onchange="app.saveDailyFocus(0, this.value)">
                <input class="daily-focus-input" value="${this._esc(dailyFocus[1])}" placeholder="Priority 2..." onchange="app.saveDailyFocus(1, this.value)">
                <input class="daily-focus-input" value="${this._esc(dailyFocus[2])}" placeholder="Priority 3..." onchange="app.saveDailyFocus(2, this.value)">
              </div>
            </div>
          </div>

          <!-- Active Projects -->
          <div class="gos-section-card">
            <div class="gos-section-card-header">
              <span class="gos-section-card-title">📁 Active Projects</span>
              <button class="btn-ghost btn-sm" onclick="app.navigateTo('projects')" style="font-size:11px">View all →</button>
            </div>
            <div class="gos-section-card-body" style="padding:16px">
              ${activeProjects.length === 0 ? `
                <div class="gos-empty" style="padding:20px 0">
                  <span class="gos-empty-desc">No active projects.</span>
                </div>
              ` : activeProjects.slice(0, 4).map(p => {
                const linkedTasks = tasks.filter(t => t.projectId === p.projectId);
                const completed = linkedTasks.filter(t => this.isTaskCompleted(t)).length;
                const progress = linkedTasks.length ? Math.round((completed / linkedTasks.length) * 100) : (p.progress || 0);
                return `
                  <div style="margin-bottom:14px; cursor:pointer" onclick="app.navigateTo('projects')">
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px">
                      <strong style="color:var(--text-primary)">${this._esc(p.projectName)}</strong>
                      <span style="color:var(--text-muted); font-weight:600">${progress}%</span>
                    </div>
                    <div class="progress-bar-container">
                      <div class="progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                    ${p.deadline ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px">Due ${this.formatDateTime(p.deadline, p.deadlineTime)}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>

        <!-- Right Column -->
        <div style="display:flex; flex-direction:column; gap:16px">

          <!-- Goal Progress -->
          <div class="gos-section-card">
            <div class="gos-section-card-header">
              <span class="gos-section-card-title">🏆 Goal Progress</span>
              <button class="btn-ghost btn-sm" onclick="app.navigateTo('goals')" style="font-size:11px">View all →</button>
            </div>
            <div class="gos-section-card-body" style="padding:16px">
              ${activeGoals.length === 0 ? `
                <div class="gos-empty" style="padding:16px 0">
                  <span class="gos-empty-desc">No goals set yet.</span>
                  <button class="btn-primary btn-sm" style="margin-top:8px" onclick="app.openQuickAdd('goals', event)">+ Add Goal</button>
                </div>
              ` : activeGoals.map(g => {
                const current = parseFloat(g.currentMetric) || 0;
                const target  = parseFloat(g.targetMetric)  || 1;
                const pct     = Math.min(Math.round((current / target) * 100), 100);
                const color   = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--accent)' : pct >= 30 ? 'var(--amber)' : 'var(--red)';
                return `
                  <div style="margin-bottom:14px; cursor:pointer" onclick="app.navigateTo('goals')">
                    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px">
                      <strong style="color:var(--text-primary)">${this._esc(g.goalName)}</strong>
                      <span style="font-weight:700; color:${color}">${pct}%</span>
                    </div>
                    <div class="progress-bar-container">
                      <div class="progress-bar-fill" style="width:${pct}%; background:${color}"></div>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px">
                      ${current.toLocaleString()} / ${target.toLocaleString()}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Upcoming Agenda -->
          <div class="gos-section-card">
            <div class="gos-section-card-header">
              <span class="gos-section-card-title">⏳ Upcoming Agenda</span>
              <button class="btn-ghost btn-sm" onclick="app.navigateTo('tasks')" style="font-size:11px">View all →</button>
            </div>
            <div class="gos-section-card-body" style="padding:8px 16px 16px">
              ${upcomingTasks.length === 0 ? `
                <div class="gos-empty" style="padding:20px 0">
                  <span class="gos-empty-desc">All caught up! No upcoming tasks.</span>
                </div>
              ` : `
                <ul class="gos-task-list" style="margin:0; padding:0; list-style:none">
                  ${upcomingTasks.map(t => {
                    const days = daysUntil(t.dueAt);
                    const isOvd = days < 0;
                    const isToday = days === 0;
                    const dueCls = isOvd ? 'overdue' : isToday ? 'due-today' : days <= 3 ? 'due-soon' : 'due-later';
                    const dueIcon = isOvd ? '🔴' : isToday ? '🔵' : '⏳';
                    const dueLabel = isOvd ? `${Math.abs(days)}d overdue` : isToday ? 'Today' : `${days}d`;
                    return `
                      <li style="display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer" onclick="app.openTaskPanel('${t.taskId}')">
                        <div class="gos-task-check ${this.isTaskCompleted(t) ? 'checked' : ''}" onclick="event.stopPropagation(); app.toggleTask('${t.taskId}')" style="flex-shrink:0; margin-top:2px"></div>
                        <div style="flex:1; min-width:0">
                          <div style="font-size:13px; font-weight:500; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${this._esc(t.title)}</div>
                          <div style="font-size:11px; color:var(--text-muted); margin-top:2px; display:flex; gap:6px; flex-wrap:wrap; align-items:center">
                            <span class="gos-due ${dueCls}">${dueIcon} ${dueLabel}${t.dueTime ? ' @ ' + this.formatTime(t.dueTime) : ''}</span>
                            ${t.priority ? this.renderBadge(t.priority) : ''}
                          </div>
                        </div>
                      </li>
                    `;
                  }).join('')}
                </ul>
              `}
            </div>
          </div>

        </div>
      </div>

      <!-- Outreach / Follow-ups Today -->
      <div class="gos-section-card" style="margin-top:20px">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">🤝 Outreach / Follow-ups Today</span>
          <button class="btn-ghost btn-sm" onclick="app.navigateTo('leads')" style="font-size:11px">View all →</button>
        </div>
        <div class="gos-section-card-body" style="padding:0">
          ${todayActionsList.length === 0 ? `
            <div class="gos-empty" style="padding:50px 20px">
              <span class="gos-empty-icon">🎉</span>
              <span class="gos-empty-title">All actions completed!</span>
              <span class="gos-empty-desc">No follow-ups due today. Keep up the amazing work!</span>
            </div>
          ` : `
            <!-- Desktop Table View -->
            <div class="gos-table-responsive hide-on-mobile">
              <table class="gos-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Source</th>
                    <th>Next Action</th>
                    <th>Follow-up Date</th>
                    <th class="cell-right">Amount</th>
                    <th class="cell-right" style="min-width: 160px">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${todayActionsList.map(l => {
                    const isOverdueVal = l.nextActionDate && l.nextActionDate < todayStr;
                    return `
                      <tr>
                        <td class="cell-name clickable" onclick="app.openRecordPanel('linkedin', '${l.leadId}')">
                          <div class="name-block">
                            <span class="name-text">${l.contactName || 'Unknown Contact'}</span>
                          </div>
                        </td>
                        <td>${l.company || '—'}</td>
                        <td>${this.renderBadge(l.stage)}</td>
                        <td>
                          <span class="gos-badge badge-purple" style="font-size:11px">${l.source || 'LinkedIn'}</span>
                        </td>
                        <td><span class="action-summary">${l.nextAction || 'Follow up'}</span></td>
                        <td>
                          ${l.nextActionDate ? `
                            <span class="date-badge ${isOverdueVal ? 'overdue animate-pulse' : 'today'}">
                              ${isOverdueVal ? '⚠️ ' : ''}${this.formatDateTime(l.nextActionDate, l.followUpTime)}
                            </span>
                          ` : '—'}
                        </td>
                        <td class="cell-right font-semibold">₱${(l.projectedCloseAmount || 0).toLocaleString()}</td>
                        <td class="cell-right">
                          <div class="gos-row-actions">
                            <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.openMessageForRecord('linkedin', '${l.leadId}')" title="Generate message">💬 Msg</button>
                            <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.copyMessageDirectly('linkedin', '${l.leadId}')" title="Copy follow-up">📋 Copy</button>
                            <button class="gos-btn btn-sm btn-primary" onclick="event.stopPropagation(); app.markEventCompleted('linkedin', '${l.leadId}')" title="Mark done">✓ Done</button>
                            <button class="gos-btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.openRecordPanel('linkedin', '${l.leadId}')" title="View more">⋯ More</button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Card View -->
            <div class="mobile-only-cards show-on-mobile" style="display:none">
              <div class="mobile-actions-grid" style="display:flex; flex-direction:column; gap:12px; padding:16px;">
                ${todayActionsList.map(l => {
                  const isOverdueVal = l.nextActionDate && l.nextActionDate < todayStr;
                  return `
                    <div class="action-card" onclick="app.openRecordPanel('linkedin', '${l.leadId}')">
                      <div class="action-card-top">
                        <div>
                          <div class="action-card-name">${l.contactName || 'Unknown Contact'}</div>
                          <div class="action-card-offer">${l.company || 'Brand: —'}</div>
                        </div>
                        <div class="action-card-score" style="font-weight:600; color:var(--text-primary)">
                          ₱${(l.projectedCloseAmount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div class="action-card-next">
                        <strong>Next:</strong> ${l.nextAction || 'Follow up with lead'}
                      </div>
                      <div style="margin-top:6px; font-size:11px; display:flex; gap:6px; align-items:center; flex-wrap:wrap">
                        ${l.nextActionDate ? `
                          <span class="date-badge ${isOverdueVal ? 'overdue animate-pulse' : 'today'}">
                            ${isOverdueVal ? '⚠️ OVERDUE: ' : 'DUE: '}${l.nextActionDate}
                          </span>
                        ` : ''}
                        <span>${this.renderBadge(l.stage)}</span>
                        <span class="gos-badge badge-purple" style="font-size:10px">${l.source || 'LinkedIn'}</span>
                      </div>
                      <div class="action-card-actions">
                        <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.openMessageForRecord('linkedin', '${l.leadId}')" style="flex:1; min-height:44px;">💬 Msg</button>
                        <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.copyMessageDirectly('linkedin', '${l.leadId}')" style="flex:1; min-height:44px;">📋 Copy</button>
                        <button class="gos-btn btn-sm btn-primary" onclick="event.stopPropagation(); app.markEventCompleted('linkedin', '${l.leadId}')" style="flex:1; min-height:44px;">✓ Done</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `}
        </div>
      </div>

    `;
  }

  isTaskCompleted(task) {
    const completedStatus = this.taskColumns[this.taskColumns.length - 1] || 'Completed';
    return task.status === completedStatus || task.status === 'Completed' || task.status === 'Done';
  }

  toggleTask(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (!task) return;
    const completedStatus = this.taskColumns[this.taskColumns.length - 1] || 'Completed';
    task.status = this.isTaskCompleted(task) ? 'To Do' : completedStatus;
    this.render();
    if (this.sheetsConnected) {
      if (task._rowIndex !== undefined) {
        sheetsService.updateRecord('tasks', task._rowIndex, task)
          .catch(err => {
            console.error('Toggle task sync failed:', err);
            task._syncStatus = 'Pending Sync';
            task._syncError = this.getFriendlyErrorMessage(err);
            this.saveLocalData();
            this.render();
          });
      } else {
        task._syncStatus = 'Pending Sync';
        task._syncError = 'Row index is undefined';
        this.saveLocalData();
        this.render();
      }
    }
  }

  renderTaskItem(task) {
    const due = daysUntil(task.dueAt);
    const overdueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : '';
    const dueLabel = due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d left`;
    const dueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : due <= 3 ? 'due-soon' : 'due-later';

    return `
      <li class="gos-task-item ${overdueClass}" onclick="app.openTaskPanel('${task.taskId}')">
        <div class="gos-task-check ${this.isTaskCompleted(task) ? 'checked' : ''}" onclick="event.stopPropagation(); app.toggleTask('${task.taskId}')"></div>
        <div class="gos-task-info">
          <div class="gos-task-title">${task.title}</div>
          <div class="gos-task-meta">
            ${this.renderBadge(task.priority)}
            <span class="gos-due ${dueClass}">
              <span class="due-icon">${due < 0 ? '🔴' : due === 0 ? '🔵' : '⏳'}</span>
              ${dueLabel}
            </span>
            <span>${task.recordType}</span>
          </div>
        </div>
      </li>
    `;
  }

  renderFunnel(data, stages, stageKey = 'stage') {
    const counts = stages.map(s => data.filter(d => d[stageKey] === s).length);
    const max = Math.max(...counts, 1);
    const colors = ['#3b82f6', '#22d3ee', '#6366f1', '#f59e0b', '#10b981'];

    return `
      <div class="gos-funnel">
        ${stages.map((stage, i) => `
          <div class="gos-funnel-stage">
            <span class="gos-funnel-count">${counts[i]}</span>
            <div class="gos-funnel-bar" style="height: ${Math.max((counts[i] / max) * 50, 8)}px; background: ${colors[i] || colors[0]};"></div>
            <span class="gos-funnel-label">${stage.length > 10 ? stage.substring(0, 8) + '…' : stage}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── LinkedIn Leads View ─────────────────────────────────────
  renderLinkedIn(container) {
    const leads = this.data.linkedinLeads;
    const activeLeads = leads.filter(l => !['Closed', 'Recycle'].includes(l.stage));
    const noAction = activeLeads.filter(l => isOverdue(l.nextActionDate));
    const totalProjected = activeLeads.reduce((s, l) => s + (l.projectedCloseAmount || 0), 0);
    const convertedCount = leads.filter(l => l.stage === 'Closed').length;

    const dataTableContent = this.renderDataTable(this.filteredData, [
      { key: 'contactName', label: 'Name', editable: true, editType: 'text', render: (v) => `<span class="cell-name clickable-edit-name">${v || '—'}</span>` },
      { key: 'company', label: 'Company / Brand', editable: true, editType: 'text' },
      { key: 'mobile', label: 'Phone Number', editable: true, editType: 'text' },
      { key: 'email', label: 'Email Address', editable: true, editType: 'text' },
      { key: 'source', label: 'Source', editable: true, editType: 'select', editOptions: ['LinkedIn', 'Facebook', 'Instagram', 'Network', 'Referral', 'Website', 'Other'] },
      { key: 'linkedinUrl', label: 'Profile / URL', editable: true, editType: 'text', render: (v) => v ? `<a href="${v.startsWith('http') ? v : 'https://' + v}" target="_blank" class="gos-link" onclick="event.stopPropagation()">${v.replace(/https?:\/\/(www\.)?/, '')}</a>` : '—' },
      { key: 'stage', label: 'Stage', editable: true, editType: 'select', editOptions: ['New', 'Qualified', 'Contacted', 'Nurturing', 'Closed', 'Recycle'] },
      { key: 'nextAction', label: 'Next Action', editable: true, editType: 'select', editOptions: ['Send first message', 'Follow up', 'Book discovery call', 'Send proposal', 'Prepare call notes', 'Check payment', 'Mark as not fit', 'Custom'], render: (v) => `<span class="truncate" style="max-width:150px;display:inline-block">${v || '—'}</span>` },
      { key: 'nextActionDate', label: 'Follow-up Date', editable: true, editType: 'date', render: (v, r) => this.renderDueDate(v, r.followUpTime) },
      { key: 'projectedCloseAmount', label: 'Projected Close Amount', editable: true, editType: 'number', render: (v) => v ? `₱${this.formatNumber(v)}` : '₱0' },
    ], 'linkedin', 'leadId', 'Leads');

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Leads</span><span class="gos-kpi-icon">${getIconSvg('users', 18)}</span></div>
          <div class="gos-kpi-value">${leads.length}</div>
          <div class="gos-kpi-detail">${activeLeads.length} active</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Closed Leads</span><span class="gos-kpi-icon">${getIconSvg('award', 18)}</span></div>
          <div class="gos-kpi-value">${convertedCount}</div>
          <div class="gos-kpi-detail">${convertedCount} closed leads</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Active Value</span><span class="gos-kpi-icon">${getIconSvg('dollarSign', 18)}</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalProjected)}</div>
          <div class="gos-kpi-detail">projected close amount of active leads</div>
        </div>
        <div class="gos-kpi-card ${noAction.length > 0 ? 'red' : 'green'}">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Overdue Follow-ups</span><span class="gos-kpi-icon">${noAction.length > 0 ? getIconSvg('alert', 18) : getIconSvg('checkCircle', 18)}</span></div>
          <div class="gos-kpi-value">${noAction.length}</div>
          <div class="gos-kpi-detail">${noAction.length > 0 ? 'Need immediate attention' : 'All follow-ups on track'}</div>
        </div>
      </div>

      ${dataTableContent}
    `;
  }

  // ── Prime Pipeline View ─────────────────────────────────────
  renderPrime(container) {
    const pipeline = this.data.primePipeline;
    const activeDeals = pipeline.filter(p => !['Closed Won', 'Closed Lost'].includes(p.stage));
    const totalPipeline = activeDeals.reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWeighted = activeDeals.reduce((s, p) => s + (p.weightedValue || 0), 0);
    const convertedCount = pipeline.filter(p => p.stage === 'Closed').length;

    const totalPaid = pipeline.filter(p => p.paymentStatus === 'Paid').reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWonPending = pipeline.filter(p => p.stage === 'Closed' && p.paymentStatus !== 'Paid').reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWon = totalPaid + totalWonPending;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Pipeline</span><span class="gos-kpi-icon">${getIconSvg('pipeline', 18)}</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalPipeline)}</div>
          <div class="gos-kpi-detail">${activeDeals.length} active opportunities</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Weighted Forecast</span><span class="gos-kpi-icon">${getIconSvg('chart', 18)}</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWeighted)}</div>
          <div class="gos-kpi-detail">probability-adjusted value</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Closed Deals</span><span class="gos-kpi-icon">${getIconSvg('award', 18)}</span></div>
          <div class="gos-kpi-value">${convertedCount}</div>
          <div class="gos-kpi-detail">${convertedCount} closed deals</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Won Revenue</span><span class="gos-kpi-icon">${getIconSvg('dollarSign', 18)}</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWon)}</div>
          <div class="gos-kpi-detail">₱${this.formatNumber(totalPaid)} paid · ₱${this.formatNumber(totalWonPending)} won pending</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'contactName', label: 'Contact', render: (v, r) => `<span class="cell-name clickable-edit-name" onclick="event.stopPropagation(); app.startInlineEdit(this, 'prime', '${r.opportunityId}', 'contactName', 'text')">${v || '—'}</span><br><span class="cell-company clickable-edit-company" onclick="event.stopPropagation(); app.startInlineEdit(this, 'prime', '${r.opportunityId}', 'orgName', 'text')">${r.orgName || 'Company'}</span>` },
        { key: 'serviceInterest', label: 'Service', editable: true, editType: 'text', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v}</span>` },
        { key: 'stage', label: 'Stage', editable: true, editType: 'select', editOptions: ['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff', 'Closed'] },
        { key: 'dealStatus', label: 'Deal Status', editable: true, editType: 'select', editOptions: ['Open', 'In Progress', 'Won', 'Lost', 'Paid', 'Closed'], render: (v) => this.renderBadge(v) },
        { key: 'paymentStatus', label: 'Payment', editable: true, editType: 'select', editOptions: ['Unpaid', 'Partial', 'Paid', 'Refunded', 'Cancelled'], render: (v) => this.renderBadge(v) },
        { key: 'estimatedValue', label: 'Value', editable: true, editType: 'number', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'probabilityPercent', label: 'Prob.', editable: true, editType: 'number', render: (v) => `${v || 0}%` },
        { key: 'nextAction', label: 'Next Action', editable: true, editType: 'text', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Due', editable: true, editType: 'date', render: (v, r) => this.renderDueDate(v, r.nextActionTime) },
      ], 'prime', 'opportunityId')}
    `;
  }

  // ── Self Care Club Content View ─────────────────────────────
  renderSCC(container) {
    const content = this.data.sccContent;
    const published = content.filter(c => c.status === 'Published');
    const upcoming = content.filter(c => ['Scheduled', 'Review', 'Draft', 'Planned'].includes(c.status));
    const totalViews = published.reduce((s, c) => s + (c.views || 0), 0);
    const totalEng = published.reduce((s, c) => s + (c.comments || 0) + (c.saves || 0) + (c.replies || 0), 0);

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Content</span><span class="gos-kpi-icon">📝</span></div>
          <div class="gos-kpi-value">${content.length}</div>
          <div class="gos-kpi-detail">${upcoming.length} in pipeline</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Published</span><span class="gos-kpi-icon">🚀</span></div>
          <div class="gos-kpi-value">${published.length}</div>
          <div class="gos-kpi-detail">${content.filter(c => c.repurposeFlag).length} flagged for repurpose</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Views</span><span class="gos-kpi-icon">👀</span></div>
          <div class="gos-kpi-value">${this.formatNumber(totalViews)}</div>
          <div class="gos-kpi-detail">across published content</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Engagements</span><span class="gos-kpi-icon">💬</span></div>
          <div class="gos-kpi-value">${totalEng}</div>
          <div class="gos-kpi-detail">comments + saves + replies</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'title', label: 'Title', render: (v) => `<span class="cell-name truncate" style="max-width:250px;display:inline-block">${v}</span>` },
        { key: 'contentPillar', label: 'Pillar' },
        { key: 'format', label: 'Format' },
        { key: 'channel', label: 'Channel' },
        { key: 'status', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'plannedPublishAt', label: 'Publish Date', render: (v, r) => this.renderDueDate(v, r.plannedPublishTime) },
        { key: 'views', label: 'Views', render: (v) => v > 0 ? this.formatNumber(v) : '—' },
      ], 'scc', 'contentId')}
    `;
  }

  // ── Calmera Orders View ─────────────────────────────────────
  renderCalmera(container) {
    const orders = this.data.calmeraOrders;
    const pending = orders.filter(o => ['Pending Contact', 'Awaiting Response'].includes(o.reconfirmationStatus));
    const confirmed = orders.filter(o => o.reconfirmationStatus === 'Confirmed');
    const atRisk = orders.filter(o => o.reconfirmationStatus === 'Escalated' || o.orderStatus === 'At Risk');
    const totalValue = orders.reduce((s, o) => s + (o.orderAmount || 0), 0);

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Orders</span><span class="gos-kpi-icon">📦</span></div>
          <div class="gos-kpi-value">${orders.length}</div>
          <div class="gos-kpi-detail">₱${this.formatNumber(totalValue)} total value</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Pending</span><span class="gos-kpi-icon">⏳</span></div>
          <div class="gos-kpi-value">${pending.length}</div>
          <div class="gos-kpi-detail">awaiting contact or response</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Confirmed</span><span class="gos-kpi-icon">✅</span></div>
          <div class="gos-kpi-value">${confirmed.length}</div>
          <div class="gos-kpi-detail">${Math.round((confirmed.length / Math.max(orders.length, 1)) * 100)}% confirmation rate</div>
        </div>
        <div class="gos-kpi-card ${atRisk.length > 0 ? 'red' : 'green'}">
          <div class="gos-kpi-header"><span class="gos-kpi-label">At Risk</span><span class="gos-kpi-icon">${atRisk.length > 0 ? '🚨' : '✅'}</span></div>
          <div class="gos-kpi-value">${atRisk.length}</div>
          <div class="gos-kpi-detail">${atRisk.length > 0 ? 'Escalated — act now!' : 'No escalations'}</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'customerName', label: 'Customer', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-mono">${r.externalOrderRef}</span>` },
        { key: 'itemsSummary', label: 'Items', render: (v) => `<span class="truncate" style="max-width:200px;display:inline-block">${v}</span>` },
        { key: 'orderAmount', label: 'Amount', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'reconfirmationStatus', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'fulfillmentCutoff', label: 'Cutoff', render: (v) => this.renderDueDate(v) },
        { key: 'orderStatus', label: 'Order Status', render: (v) => this.renderBadge(v) },
        { key: 'preferredChannel', label: 'Channel' },
      ], 'calmera', 'orderId')}
    `;
  }

  // ── Repurposing View ────────────────────────────────────────
  renderRepurposing(container) {
    const sources = this.data.sourceAssets;
    const outputs = this.data.repurposeOutputs;
    const published = outputs.filter(o => o.status === 'Published');
    const inProd = outputs.filter(o => ['Queued', 'Draft', 'Review', 'Scheduled'].includes(o.status));
    const totalViews = published.reduce((s, o) => s + (o.views || 0), 0);
    const avgPerSource = sources.length > 0 ? (outputs.length / sources.length).toFixed(1) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Source Assets</span><span class="gos-kpi-icon">📚</span></div>
          <div class="gos-kpi-value">${sources.length}</div>
          <div class="gos-kpi-detail">${sources.filter(s => s.reuseApproved).length} approved for reuse</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Outputs</span><span class="gos-kpi-icon">🔄</span></div>
          <div class="gos-kpi-value">${outputs.length}</div>
          <div class="gos-kpi-detail">${avgPerSource} avg per source</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Published</span><span class="gos-kpi-icon">🚀</span></div>
          <div class="gos-kpi-value">${published.length}</div>
          <div class="gos-kpi-detail">${this.formatNumber(totalViews)} total views</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">In Production</span><span class="gos-kpi-icon">⚙️</span></div>
          <div class="gos-kpi-value">${inProd.length}</div>
          <div class="gos-kpi-detail">queued, draft, review, scheduled</div>
        </div>
      </div>

      <div style="margin-bottom:24px">
        <div class="gos-table-container">
          <div class="gos-table-header">
            <span class="gos-table-title">📚 Source Assets</span>
            <span class="gos-table-count">${sources.length} sources</span>
          </div>
          <div class="gos-table-wrap">
            <table class="gos-table">
              <thead>
                <tr>
                  <th>Title</th><th>Type</th><th>Theme</th><th>Channel</th><th>Status</th><th>Outputs</th>
                </tr>
              </thead>
              <tbody>
                ${sources.map(s => {
                  const outputCount = outputs.filter(o => o.sourceId === s.sourceId).length;
                  return `
                    <tr class="clickable" onclick="app.openSourcePanel('${s.sourceId}')">
                      <td><span class="cell-name">${s.title}</span></td>
                      <td>${s.sourceType}</td>
                      <td><span class="truncate" style="max-width:160px;display:inline-block">${s.keyTheme}</span></td>
                      <td>${s.originChannel}</td>
                      <td>${this.renderBadge(s.status === 'Pending Approval' ? 'Pending Approval' : s.status)}</td>
                      <td><span class="cell-value">${outputCount}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'angleOrHook', label: 'Angle / Hook', render: (v) => `<span class="cell-name truncate" style="max-width:200px;display:inline-block">${v}</span>` },
        { key: 'targetChannel', label: 'Channel' },
        { key: 'format', label: 'Format' },
        { key: 'targetBrand', label: 'Brand' },
        { key: 'status', label: 'Status', render: (v) => this.renderBadge(v) },
        { key: 'scheduledAt', label: 'Scheduled', render: (v) => v || '—' },
        { key: 'views', label: 'Views', render: (v) => v > 0 ? this.formatNumber(v) : '—' },
        { key: 'engagements', label: 'Engagements', render: (v) => v > 0 ? v : '—' },
      ], 'repurposing', 'outputId')}
    `;
  }

  // ── Generic Data Table Renderer ─────────────────────────────
  renderDataTable(data, columns, viewType, idKey, title) {
    const tableTitle = title || {
      'linkedin': 'Leads',
      'prime': 'Pipeline Opportunities',
      'scc': 'Content Calendar',
      'calmera': 'Order Reconfirmations',
      'repurposing': 'Repurpose Outputs',
    }[viewType] || 'Records';

    if (!data || data.length === 0) {
      return `
        <div class="gos-table-container">
          <div class="gos-table-header">
            <span class="gos-table-title">${tableTitle}</span>
            <span class="gos-table-count">0 records</span>
          </div>
          <div class="gos-empty">
            <span class="gos-empty-icon">📭</span>
            <span class="gos-empty-title">No records found</span>
            <span class="gos-empty-text">Try adjusting your filters or add a new record.</span>
          </div>
        </div>
      `;
    }

    // Build desktop table HTML (hidden on mobile)
    const desktopTable = `
      <div class="gos-table-wrap hide-on-mobile">
        <table class="gos-table">
          <thead>
            <tr>
              ${columns.map(col => `
                <th onclick="app.toggleSort('${col.key}')" class="${this.sortConfig.key === col.key ? 'sorted' : ''}">
                  ${col.label}
                  <span class="sort-icon">${this.sortConfig.key === col.key ? (this.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
              `).join('')}
              <th style="width:100px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(record => {
              const rowCells = columns.map((col, idx) => {
                let content = col.render ? col.render(record[col.key], record) : (record[col.key] || '—');
                if (idx === 0) {
                  content = `${content} ${this.renderSyncBadgeInline(viewType, record[idKey], record)}`;
                }
                if (col.editable) {
                  const editOptions = col.editOptions ? JSON.stringify(col.editOptions) : 'null';
                  content = `
                    <div class="editable-cell" onclick="event.stopPropagation(); app.startInlineEdit(this, '${viewType}', '${record[idKey]}', '${col.key}', '${col.editType}', ${editOptions})">
                      <span class="cell-editable-content">${content}</span>
                    </div>
                  `;
                }
                return `<td>${content}</td>`;
              }).join('');

              let briefcaseBtn = '';
              if (viewType === 'linkedin') {
                const alreadyConverted = record.convertedToPipeline === 'Yes' || this.data.primePipeline.some(p => String(p.sourceLeadId) === String(record.leadId));
                briefcaseBtn = `
                  <button class="gos-btn gos-btn-ghost gos-btn-sm" 
                          onclick="event.stopPropagation(); app.convertLeadToPipeline('${record.leadId}')" 
                          title="Convert to Pipeline Opportunity" 
                          ${alreadyConverted ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                    ${getIconSvg('briefcase', 14)}
                  </button>
                `;
              }

              return `
                <tr class="clickable" onclick="app.openRecordPanel('${viewType}', '${record[idKey]}')">
                  ${rowCells}
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="event.stopPropagation(); app.openMessageForRecord('${viewType}', '${record[idKey]}')" title="Generate message">${getIconSvg('message-square', 14)}</button>
                      ${briefcaseBtn}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Build mobile cards HTML (visible on mobile)
    const mobileCards = `
      <div class="gos-card-list show-on-mobile mobile-only-cards" style="display:none">
        ${data.map(record => {
          if (viewType === 'linkedin') {
            const mainTitle = `${record.contactName || 'No Name'} ${this.renderSyncBadgeInline('linkedin', record.leadId, record)}`;
            const stageBadge = record.stage ? this.renderBadge(record.stage) : '';
            const priorityBadge = record.priority ? this.renderBadge(record.priority) : '';
            const amountText = record.projectedCloseAmount ? `₱${this.formatNumber(record.projectedCloseAmount)}` : '₱0';
            const phoneText = record.mobile || '—';
            const sourceBadge = record.source ? `<span class="gos-badge badge-purple" style="font-size:11px">${record.source}</span>` : '';
            
            const alreadyConverted = record.convertedToPipeline === 'Yes' || this.data.primePipeline.some(p => String(p.sourceLeadId) === String(record.leadId));
            const briefcaseBtn = `
              <button class="gos-btn gos-btn-secondary btn-sm" 
                      style="min-height:36px; padding:4px 10px;"
                      onclick="event.stopPropagation(); app.convertLeadToPipeline('${record.leadId}')" 
                      title="Convert to Pipeline" 
                      ${alreadyConverted ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                💼 Convert
              </button>
            `;

            return `
              <div class="gos-mobile-card" onclick="app.toggleMobileCardExpansion(this)">
                <div class="gos-mobile-card-header">
                  <div class="gos-mobile-card-title">${mainTitle}</div>
                  <div>${stageBadge}</div>
                </div>
                <div class="gos-mobile-card-summary" style="display:flex; flex-wrap:wrap; gap:6px; font-size:12px; color:var(--text-secondary); margin-top:4px;">
                  <div>📞 ${phoneText}</div>
                  <div>·</div>
                  <div>${sourceBadge}</div>
                  <div>·</div>
                  <div>💰 ${amountText}</div>
                  ${record.nextActionDate ? `<div>·</div><div>📅 ${record.nextActionDate}</div>` : ''}
                </div>
                
                <div class="gos-mobile-card-expandable" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px; display:none;">
                  <div style="font-size:12px; color:var(--text-secondary); line-height:1.6; margin-bottom:12px;">
                    ${record.email ? `<div><strong>Email:</strong> ${record.email}</div>` : ''}
                    ${record.company ? `<div><strong>Company / Brand:</strong> ${record.company}</div>` : ''}
                    ${record.role ? `<div><strong>Role:</strong> ${record.role}</div>` : ''}
                    ${record.linkedinUrl ? `<div><strong>Profile / URL:</strong> <a href="${record.linkedinUrl.startsWith('http') ? record.linkedinUrl : 'https://' + record.linkedinUrl}" target="_blank" onclick="event.stopPropagation()" style="color:var(--primary); text-decoration:underline;">${record.linkedinUrl}</a></div>` : ''}
                    ${record.nextAction ? `<div><strong>Next Action:</strong> ${record.nextAction}</div>` : ''}
                    ${record.priority ? `<div style="margin-top:4px;"><strong>Priority:</strong> ${priorityBadge}</div>` : ''}
                    ${record.notes ? `<div style="margin-top:4px;"><strong>Notes:</strong> ${record.notes}</div>` : ''}
                  </div>
                  
                  <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px; flex-wrap:wrap;">
                    <button class="gos-btn gos-btn-secondary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); app.openMessageForRecord('linkedin', '${record.leadId}')">✉️ Message</button>
                    <button class="gos-btn gos-btn-secondary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); navigator.clipboard.writeText('${record.email || ''}\\n${record.mobile || ''}').then(() => app.showToast('📋 Copied contact details', 'success'))">📋 Copy</button>
                    <button class="gos-btn gos-btn-secondary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); app.openRecordPanel('linkedin', '${record.leadId}'); setTimeout(() => app.editSelectedRecord(), 100)">✏️ Edit</button>
                    ${briefcaseBtn}
                    <button class="gos-btn gos-btn-primary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); app.openRecordPanel('linkedin', '${record.leadId}')">⋯ More</button>
                  </div>
                </div>
              </div>
            `;
          }

          const mainTitle = `${record.contactName || record.title || record.customerName || 'No Name'} ${this.renderSyncBadgeInline(viewType, record[idKey], record)}`;
          const secondary = record.company || record.orgName || record.contentPillar || record.itemsSummary || '';
          const stageBadge = record.stage ? this.renderBadge(record.stage) : (record.status ? this.renderBadge(record.status) : '');
          
          let quickEditFields = '';
          if (viewType === 'prime') {
            const stages = ['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff', 'Closed Won', 'Closed Lost'];
            quickEditFields = `
              <div class="gos-form-row" style="margin-top:12px; gap:8px;">
                <div class="gos-form-group" style="margin-bottom:0; flex:1;">
                  <label class="gos-form-label" style="font-size:10px;">Stage</label>
                  <select class="gos-form-select" style="padding:6px; font-size:12px;" onchange="app.saveInlineEdit('prime', '${record.opportunityId}', 'stage', this.value, this)">
                    ${stages.map(s => `<option value="${s}" ${record.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </div>
                <div class="gos-form-group" style="margin-bottom:0; flex:1;">
                  <label class="gos-form-label" style="font-size:10px;">Value (₱)</label>
                  <input class="gos-form-input" type="number" style="padding:6px; font-size:12px;" value="${record.estimatedValue || 0}" onblur="app.saveInlineEdit('prime', '${record.opportunityId}', 'estimatedValue', this.value, this)">
                </div>
              </div>
            `;
          }

          return `
            <div class="gos-mobile-card" onclick="app.toggleMobileCardExpansion(this)">
              <div class="gos-mobile-card-header">
                <div class="gos-mobile-card-title">${mainTitle}</div>
                <div>${stageBadge}</div>
              </div>
              <div class="gos-mobile-card-summary">
                ${secondary ? `<div class="gos-mobile-card-action-text">${secondary}</div>` : ''}
                ${record.priority ? `<div>·</div><div>${this.renderBadge(record.priority)}</div>` : ''}
                ${record.nextActionDate ? `<div>·</div><div>📅 ${record.nextActionDate}</div>` : ''}
              </div>
              
              <div class="gos-mobile-card-expandable" style="margin-top:12px; border-top:1px solid var(--border); padding-top:12px; display:none;">
                <div style="font-size:12px; color:var(--text-secondary); line-height:1.6;">
                  ${record.role ? `<div><strong>Role:</strong> ${record.role}</div>` : ''}
                  ${record.email ? `<div><strong>Email:</strong> ${record.email}</div>` : ''}
                  ${record.mobile ? `<div><strong>Phone:</strong> ${record.mobile}</div>` : ''}
                  ${record.status ? `<div><strong>Status:</strong> ${record.status}</div>` : ''}
                  ${record.interestSignal ? `<div style="margin-top:4px;"><strong>Interest:</strong> ${record.interestSignal}</div>` : ''}
                  ${record.notes ? `<div style="margin-top:4px;"><strong>Notes:</strong> ${record.notes}</div>` : ''}
                </div>
                
                ${quickEditFields}
                
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                  <button class="gos-btn gos-btn-secondary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); app.openMessageForRecord('${viewType}', '${record[idKey]}')">✉️ Message</button>
                  <button class="gos-btn gos-btn-primary btn-sm" style="min-height:36px; padding:4px 10px;" onclick="event.stopPropagation(); app.openRecordPanel('${viewType}', '${record[idKey]}')">⋯ Details</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    return `
      <div class="gos-table-container">
        <div class="gos-table-header">
          <span class="gos-table-title">${tableTitle}</span>
          <span class="gos-table-count">${data.length} records</span>
        </div>
        ${desktopTable}
        ${mobileCards}
      </div>
    `;
  }

  // ── Badge Renderer ──────────────────────────────────────────
  renderBadge(value) {
    if (!value) return '<span class="text-muted">—</span>';
    const cssClass = value.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return `<span class="gos-badge badge-${cssClass}">${value}</span>`;
  }

  // ── Score Renderer ──────────────────────────────────────────
  renderScore(score) {
    const s = score || 0;
    const level = s >= 75 ? 'high' : s >= 50 ? 'medium' : 'low';
    return `
      <div class="gos-score score-${level}">
        <span class="score-num">${s}</span>
        <div class="score-bar-bg">
          <div class="score-bar-fill" style="width:${s}%"></div>
        </div>
      </div>
    `;
  }

  // ── Due Date Renderer ───────────────────────────────────────
  renderDueDate(dateStr, timeStr) {
    if (!dateStr) return '<span class="text-muted">—</span>';
    const days = daysUntil(dateStr);
    let cls, label, icon;

    if (days < 0) {
      cls = 'overdue';
      label = `${Math.abs(days)}d overdue`;
      icon = '🔴';
    } else if (days === 0) {
      cls = 'due-today';
      label = 'Today';
      icon = '🔵';
    } else if (days <= 3) {
      cls = 'due-soon';
      label = `${days}d`;
      icon = '🟡';
    } else {
      cls = 'due-later';
      label = dateStr;
      icon = '';
    }

    if (timeStr) {
      const formattedTime = this.formatTime(timeStr);
      if (cls === 'due-later') {
        label = `${dateStr} @ ${formattedTime}`;
      } else {
        label = `${label} @ ${formattedTime}`;
      }
    }

    return `<span class="gos-due ${cls}">${icon} ${label}</span>`;
  }

  // ── Time / Date Helpers ─────────────────────────────────────
  formatTime(timeStr) {
    if (!timeStr) return '';
    // timeStr may be HH:MM (24h) from a time input
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
    } catch (e) {
      return timeStr;
    }
  }

  formatDateTime(dateStr, timeStr) {
    if (!dateStr && !timeStr) return '<span class="text-muted">—</span>';
    if (!dateStr) return this.formatTime(timeStr);
    if (!timeStr) return dateStr;
    return `${dateStr} @ ${this.formatTime(timeStr)}`;
  }

  updateTopbarSyncStatus(status) {
    const el = document.getElementById('topbar-sync-status');
    if (!el) return;
    clearTimeout(this._syncStatusTimer);
    if (status === 'syncing') {
      el.textContent = '⏳ Syncing';
      el.style.display = 'inline-block';
      el.style.background = 'rgba(139,92,246,0.15)';
      el.style.color = '#a78bfa';
      el.style.border = '1px solid rgba(139,92,246,0.3)';
    } else if (status === 'synced') {
      el.textContent = '✓ Synced';
      el.style.display = 'inline-block';
      el.style.background = 'rgba(16,185,129,0.15)';
      el.style.color = '#34d399';
      el.style.border = '1px solid rgba(16,185,129,0.3)';
      this._syncStatusTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
    } else if (status === 'error') {
      el.textContent = '⚠ Sync Error';
      el.style.display = 'inline-block';
      el.style.background = 'rgba(239,68,68,0.15)';
      el.style.color = '#f87171';
      el.style.border = '1px solid rgba(239,68,68,0.3)';
      this._syncStatusTimer = setTimeout(() => { el.style.display = 'none'; }, 6000);
    } else {
      el.style.display = 'none';
    }
  }

  // ── Detail Panel ────────────────────────────────────────────
  openRecordPanel(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId' },
      'tasks': { data: this.data.tasks, idKey: 'taskId' },
      'projects': { data: this.data.projects, idKey: 'projectId' },
      'clients': { data: this.data.clients, idKey: 'clientId' },
      'goals': { data: this.data.goals, idKey: 'goalId' },
      'notes': { data: this.data.notes, idKey: 'noteId' },
      'sops': { data: this.data.sops, idKey: 'sopId' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => r[config.idKey] === id);
    if (!record) return;

    this.selectedRecord = { viewType, record };

    const panel       = document.getElementById('detail-panel');
    const panelTitle  = document.getElementById('panel-title');
    const panelBody   = document.getElementById('panel-body');
    const panelFooter = document.getElementById('panel-footer');
    const backdrop    = document.getElementById('panel-backdrop');

    panelTitle.textContent   = this.getRecordTitle(viewType, record);
    panelBody.innerHTML      = this.renderRecordDetail(viewType, record);

    if (this.sheetsConnected) {
      const status = record._syncStatus || 'Synced';
      let syncInfoHtml = '';
      if (status === 'Pending Sync' || status === 'Sync Failed') {
        const errorMsg = record._syncError || 'Sync failed due to a network or script error.';
        syncInfoHtml = `
          <div class="gos-panel-section sync-status-section" style="border-top: 2px dashed var(--border); padding-top: 15px; margin-top: 15px;">
            <div class="gos-panel-section-title" style="display: flex; align-items: center; justify-content: space-between;">
              <span>🔄 Google Sheets Sync</span>
              <span class="gos-badge badge-pending-sync">Pending Sync</span>
            </div>
            <div style="font-size: 11px; color: var(--text-danger); background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px; border-radius: var(--radius-sm); margin-bottom: 8px; margin-top: 8px; font-family: monospace; word-break: break-all;">
              <strong>Error:</strong> ${errorMsg}
            </div>
            <button class="gos-btn gos-btn-primary btn-sm w-full" style="width: 100%; justify-content: center;" onclick="app.retryRecordSync('${viewType}', '${record[config.idKey]}')">
              🔄 Retry Sync Now
            </button>
          </div>
        `;
      } else if (status === 'Syncing') {
        syncInfoHtml = `
          <div class="gos-panel-section sync-status-section" style="border-top: 1px solid var(--border); padding-top: 10px; margin-top: 15px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span>🔄 Sheets Sync Status:</span>
            <span class="gos-badge badge-normal">Syncing...</span>
          </div>
        `;
      } else {
        syncInfoHtml = `
          <div class="gos-panel-section sync-status-section" style="border-top: 1px solid var(--border); padding-top: 10px; margin-top: 15px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span>🔄 Sheets Sync Status:</span>
            <span class="gos-badge badge-converted">Synced</span>
          </div>
        `;
      }
      panelBody.innerHTML += syncInfoHtml;
    }

    if (panelFooter) {
      const idFieldName = Object.keys(record).find(k => k.endsWith('Id') && k !== 'contactId' && k !== 'organizationId' && k !== 'sourceLeadId') || 'id';
      const idVal = record[idFieldName];
      panelFooter.innerHTML = `
        <button class="btn-secondary btn-sm" onclick="app.closePanel()">Close</button>
        <button class="btn-danger btn-sm" onclick="app.deleteSelectedRecord()" style="margin-right:auto">🗑️ Delete</button>
        <button class="btn-ghost btn-sm" onclick="app.editSelectedRecord()">✏️ Edit</button>
        <button class="btn-primary btn-sm" onclick="app.openMessageForRecord('${viewType}', '${idVal}')">✉️ Message</button>
      `;
    }

    panel.classList.add('open');
    if (backdrop) backdrop.style.display = 'block';
  }

  openTaskPanel(taskId) {
    // Delegate to the full panel system so Delete / Edit buttons work correctly
    this.openRecordPanel('tasks', taskId);
  }


  openSourcePanel(sourceId) {
    const source = this.data.sourceAssets.find(s => s.sourceId === sourceId);
    if (!source) return;

    const outputs = this.data.repurposeOutputs.filter(o => o.sourceId === sourceId);

    this.selectedRecord = { viewType: 'source', record: source };

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('panel-overlay');
    const panelFooter = document.getElementById('panel-footer');
    document.getElementById('panel-title').textContent = 'Source Asset';
    document.getElementById('panel-body').innerHTML = `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Source Details</div>
        ${this.renderField('Title', source.title)}
        ${this.renderField('Type', source.sourceType)}
        ${this.renderField('Theme', source.keyTheme)}
        ${this.renderField('Channel', source.originChannel)}
        ${this.renderField('Status', this.renderBadge(source.status))}
        ${this.renderField('Reuse Approved', source.reuseApproved ? '✅ Yes' : '❌ No')}
        ${this.renderField('Captured', source.capturedAt)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Derivative Outputs (${outputs.length})</div>
        ${outputs.map(o => `
          <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">${o.angleOrHook}</div>
            <div class="flex gap-8" style="font-size:12px;color:var(--text-muted)">
              ${this.renderBadge(o.status)}
              <span>${o.targetChannel}</span>
              <span>${o.format}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (panelFooter) {
      panelFooter.innerHTML = `
        <button class="gos-btn gos-btn-secondary" onclick="app.closePanel()">Close</button>
      `;
    }

    panel.classList.add('open');
    overlay.classList.add('open');
  }

  closePanel() {
    document.getElementById('detail-panel')?.classList.remove('open');
    const bd = document.getElementById('panel-backdrop');
    if (bd) bd.style.display = 'none';
    this.selectedRecord = null;
  }

  // ── Inline Edit Flow ─────────────────────────────────────────
  _setLeadsTab(tab) {
    this._leadsTab = tab;
    this.renderContent();
  }

  toggleMobileCardExpansion(cardElement) {
    cardElement.classList.toggle('expanded');
    const expandable = cardElement.querySelector('.gos-mobile-card-expandable');
    if (expandable) {
      expandable.style.display = cardElement.classList.contains('expanded') ? 'block' : 'none';
    }
  }

  startInlineEdit(element, viewType, recordId, fieldKey, fieldType, options = null) {
    if (element.querySelector('input') || element.querySelector('select')) return;

    const originalValue = element.textContent.trim();
    element.dataset.original = originalValue;
    element.innerHTML = '';

    let input;
    if (fieldType === 'select') {
      input = document.createElement('select');
      input.className = 'gos-form-select inline-select';
      input.style.padding = '4px 8px';
      input.style.fontSize = '12px';
      input.style.minHeight = '30px';
      const opts = options || [];
      
      // If nextAction custom value, prepend it
      if (fieldKey === 'nextAction' && !opts.includes(originalValue) && originalValue !== '—' && originalValue !== '') {
        const option = document.createElement('option');
        option.value = originalValue;
        option.textContent = originalValue;
        option.selected = true;
        input.appendChild(option);
      }
      
      opts.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === originalValue && !input.querySelector(`option[value="${CSS.escape(opt)}"]`)) option.selected = true;
        if (!input.querySelector(`option[value="${CSS.escape(opt)}"]`)) {
          input.appendChild(option);
        }
      });
      
      if (fieldKey === 'nextAction') {
        input.addEventListener('change', () => {
          if (input.value === 'Custom') {
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'gos-form-input inline-input';
            textInput.style.padding = '4px 8px';
            textInput.style.fontSize = '12px';
            textInput.style.minHeight = '30px';
            textInput.value = (originalValue === '—' || originalValue === 'Custom') ? '' : originalValue;

            element.innerHTML = '';
            element.appendChild(textInput);
            textInput.focus();

            const saveCustomValue = () => {
              const newValue = textInput.value.trim();
              this.saveInlineEdit(viewType, recordId, fieldKey, newValue, element);
            };
            const discardCustomChanges = () => {
              element.innerHTML = originalValue;
            };

            textInput.addEventListener('blur', saveCustomValue);
            textInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                textInput.removeEventListener('blur', saveCustomValue);
                saveCustomValue();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                textInput.removeEventListener('blur', saveCustomValue);
                discardCustomChanges();
              }
            });
          }
        });
      }
    } else {
      input = document.createElement('input');
      input.className = 'gos-form-input inline-input';
      input.style.padding = '4px 8px';
      input.style.fontSize = '12px';
      input.style.minHeight = '30px';
      if (fieldType === 'number') {
        input.type = 'number';
      } else if (fieldType === 'date') {
        input.type = 'date';
      } else if (fieldType === 'time') {
        input.type = 'time';
      } else {
        input.type = 'text';
      }
      input.value = originalValue === '—' ? '' : originalValue;
    }

    element.appendChild(input);
    input.focus();

    const saveValue = () => {
      const newValue = input.value.trim();
      this.saveInlineEdit(viewType, recordId, fieldKey, newValue, element);
    };

    const discardChanges = () => {
      element.innerHTML = originalValue;
    };

    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.removeEventListener('blur', saveValue);
        saveValue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.removeEventListener('blur', saveValue);
        discardChanges();
      }
    });
  }

  async saveInlineEdit(viewType, recordId, fieldKey, newValue, element) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => r[config.idKey] === recordId);
    if (!record) return;

    const originalValue = record[fieldKey];
    const numberFields = new Set([
      'qualificationScore', 'estimatedValue', 'probabilityPercent', 'weightedValue',
      'orderAmount', 'views', 'comments', 'saves', 'replies', 'engagements', 'leadsGenerated',
    ]);
    const parsedValue = numberFields.has(fieldKey) ? (parseFloat(newValue) || 0) : newValue;

    if (parsedValue === originalValue) {
      this.renderContent();
      return;
    }

    record[fieldKey] = parsedValue;

    if (viewType === 'linkedin') {
      const today = getDemoToday();
      if (fieldKey === 'contactName') {
        const oldContactId = record.contactId;
        const contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = parsedValue;
          contact.fullName = parsedValue;
          contact.updatedAt = today;
          try {
            await sheetsService.updateRecord('contacts', contact._rowIndex, contact);
          } catch(err) {
            console.error('Failed to sync contact name change', err);
          }
        }
        record.contactId = parsedValue;
      }
      
      if (fieldKey === 'company') {
        const contact = this.data.contacts.find(c => c.contactId === record.contactId);
        if (contact) {
          if (!contact.organizationId) {
            contact.organizationId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
          }
          let org = this.data.organizations.find(o => o.organizationId === contact.organizationId);
          if (!org) {
            org = {
              organizationId: contact.organizationId,
              organizationName: parsedValue,
              industry: '', website: '', source: 'LinkedIn', accountStatus: 'Active',
              ownerId: 'Gelo', createdAt: today, updatedAt: today, notes: ''
            };
            this.data.organizations.push(org);
            try {
              await sheetsService.appendRecord('organizations', org);
            } catch(err) {
              console.error('Failed to sync new org', err);
            }
          } else {
            org.organizationName = parsedValue;
            org.updatedAt = today;
            try {
              await sheetsService.updateRecord('organizations', org._rowIndex, org);
            } catch(err) {
              console.error('Failed to sync org name change', err);
            }
          }
        }
      }

      if (['mobile', 'email', 'status'].includes(fieldKey)) {
        const contact = this.data.contacts.find(c => c.contactId === record.contactId);
        if (contact) {
          contact[fieldKey] = parsedValue;
          contact.updatedAt = today;
          try {
            await sheetsService.updateRecord('contacts', contact._rowIndex, contact);
          } catch(err) {
            console.error(`Failed to sync contact ${fieldKey} change`, err);
          }
        }
      }
    }

    if (viewType === 'prime') {
      const today = getDemoToday();
      if (fieldKey === 'estimatedValue' || fieldKey === 'probabilityPercent') {
        const val = parseFloat(record.estimatedValue) || 0;
        const prob = parseFloat(record.probabilityPercent) || 0;
        record.weightedValue = Math.round(val * prob / 100);
      }

      if (fieldKey === 'contactName') {
        const contact = this.data.contacts.find(c => c.contactId === record.contactId);
        if (contact) {
          contact.fullName = parsedValue;
          contact.updatedAt = today;
          try {
            await sheetsService.updateRecord('contacts', contact._rowIndex, contact);
          } catch(err) {
            console.error('Failed to sync contact name change', err);
          }
        }
      }
    }

    if (viewType === 'linkedin' || viewType === 'prime') {
      this.updateTopbarSyncStatus('syncing');
      await this.syncLeadAndOpportunity(viewType, recordId);
    } else {
      this.updateTopbarSyncStatus('syncing');
      try {
        if (record._rowIndex !== undefined) {
          await sheetsService.updateRecord(config.tabKey, record._rowIndex, record);
        } else {
          const res = await sheetsService.appendRecord(config.tabKey, record);
          record._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
        }
        delete record._syncStatus;
        delete record._syncError;
        this.saveLocalData();
        this.updateTopbarSyncStatus('synced');
        this.syncStatus = 'Synced';
        this.syncError = null;
        this.render(); // update badges
      } catch (err) {
        console.error('Inline edit sync failed:', err);
        const userErr = this.getFriendlyErrorMessage(err);
        record._syncStatus = 'Sync Failed';
        record._syncError = userErr;
        this.saveLocalData();
        this.updateTopbarSyncStatus('error');
        this.syncStatus = 'Error';
        this.syncError = userErr;
        this.render(); // update badges
      }
    }
    this.renderContent();
  }

  async convertLeadToPipeline(leadId) {
    const lead = this.data.linkedinLeads.find(l => l.leadId === leadId);
    if (!lead) return;

    const alreadyConverted = lead.convertedToPipeline === 'Yes' || this.data.primePipeline.some(p => String(p.sourceLeadId) === String(leadId));
    if (alreadyConverted) {
      this.showToast('Lead already converted to opportunity', 'warning');
      return;
    }

    const today = getDemoToday();
    const opps = this.data.primePipeline || [];
    let maxNum = 0;
    opps.forEach(o => {
      const match = String(o.opportunityId).match(/^(OPP|PO)-(\d+)$/);
      if (match) {
        const num = parseInt(match[2]);
        if (num > maxNum) maxNum = num;
      }
    });
    const oppId = `OPP-${String(maxNum + 1).padStart(4, '0')}`;

    const newOpportunity = {
      opportunityId: oppId,
      sourceLeadId: leadId,
      contactName: lead.contactName || lead.contactId || '',
      contactId: lead.contactId || '',
      orgName: lead.company || '',
      organizationId: lead.organizationId || '',
      serviceInterest: lead.interestSignal || 'Services Inquiry',
      problemStatement: lead.notes || '',
      stage: 'Discovery',
      dealStatus: 'Open',
      paymentStatus: 'Unpaid',
      estimatedValue: lead.projectedCloseAmount || 0,
      probabilityPercent: 20,
      weightedValue: Math.round((lead.projectedCloseAmount || 0) * 0.2),
      budgetRange: '',
      decisionMaker: lead.contactName || lead.contactId || '',
      timeline: '',
      discoveryDate: today,
      proposalDate: '',
      nextAction: lead.nextAction || 'Schedule Discovery Call',
      nextActionDate: lead.nextActionDate || '',
      closeDate: '',
      outcomeReason: '',
      ownerId: 'Gelo',
      notes: lead.notes || '',
      mobile: lead.mobile || '',
      email: lead.email || '',
      source: lead.source || '',
      profileUrl: lead.linkedinUrl || '',
    };

    this.data.primePipeline.push(newOpportunity);

    lead.convertedToPipeline = 'Yes';
    lead.pipelineOpportunityId = oppId;
    lead.convertedOpportunityId = oppId;
    lead.pipelineStage = 'Discovery';
    lead.dealStatus = 'Open';
    lead.paymentStatus = 'Unpaid';

    this.showToast('🚀 Converting lead to pipeline opportunity...', 'info');
    this.renderContent();

    try {
      await sheetsService.appendRecord('primePipeline', newOpportunity);
      await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
      this.showToast('✅ Lead converted and synced successfully!', 'success');
    } catch(err) {
      console.error(err);
      this.showToast('⚠️ Conversion saved locally, but sheet sync failed.', 'warning');
    }
  }

  editSelectedRecord() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;

    const panelBody = document.getElementById('panel-body');
    const panelFooter = document.getElementById('panel-footer');

    // Swap body to edit form
    panelBody.innerHTML = this.renderEditForm(viewType, record);

    // Swap footer to Save/Cancel actions
    if (panelFooter) {
      panelFooter.innerHTML = `
        <button class="btn-secondary btn-sm" onclick="app.cancelRecordEdit()">Cancel</button>
        <button class="btn-primary btn-sm" onclick="app.saveRecordEdit()">💾 Save Changes</button>
      `;
    }
  }

  cancelRecordEdit() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;
    const idKeyMap = {
      'linkedin': 'leadId',
      'prime': 'opportunityId',
      'scc': 'contentId',
      'calmera': 'orderId',
      'repurposing': 'outputId',
    };
    const idKey = idKeyMap[viewType];
    this.openRecordPanel(viewType, record[idKey]);
  }

  async saveRecordEdit() {
    const form = document.getElementById('edit-record-form');
    if (!form || !this.selectedRecord) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const updatedFields = Object.fromEntries(formData);
    const { viewType, record } = this.selectedRecord;

    const dataMap = {
      'linkedin':   { data: this.data.linkedinLeads,    idKey: 'leadId',       tabKey: 'linkedinLeads' },
      'prime':      { data: this.data.primePipeline,    idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':        { data: this.data.sccContent,       idKey: 'contentId',     tabKey: 'sccContent' },
      'calmera':    { data: this.data.calmeraOrders,    idKey: 'orderId',       tabKey: 'calmeraOrders' },
      'repurposing':{ data: this.data.repurposeOutputs, idKey: 'outputId',      tabKey: 'repurposeOutputs' },
      'tasks':      { data: this.data.tasks,            idKey: 'taskId',        tabKey: 'tasks' },
      'projects':   { data: this.data.projects,         idKey: 'projectId',     tabKey: 'projects' },
      'clients':    { data: this.data.clients,          idKey: 'clientId',      tabKey: 'clients' },
      'goals':      { data: this.data.goals,            idKey: 'goalId',        tabKey: 'goals' },
      'habits':     { data: this.data.habits,           idKey: 'habitId',       tabKey: 'habits' },
      'learning':   { data: this.data.learning,         idKey: 'learningId',    tabKey: 'learning' },
      'notes':      { data: this.data.notes,            idKey: 'noteId',        tabKey: 'notes' },
      'sops':       { data: this.data.sops,             idKey: 'sopId',         tabKey: 'sops' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    // Keep an old copy to revert if needed
    const oldRecord = { ...record };

    // Update fields locally
    Object.entries(updatedFields).forEach(([key, val]) => {
      // Parse numbers
      const numberFields = new Set([
        'qualificationScore', 'estimatedValue', 'probabilityPercent', 'weightedValue',
        'orderAmount', 'views', 'comments', 'saves', 'replies', 'engagements', 'leadsGenerated',
        'budget', 'progress', 'accountValue', 'targetMetric', 'currentMetric', 'streak',
      ]);
      if (numberFields.has(key) && val !== '' && val !== null) {
        record[key] = parseFloat(val) || 0;
      } else {
        record[key] = val;
      }
    });

    // Side-effects / calculations
    if (viewType === 'prime') {
      const val = parseFloat(record.estimatedValue) || 0;
      const prob = parseFloat(record.probabilityPercent) || 0;
      record.weightedValue = Math.round(val * prob / 100);
    }

    // Relational self-repair/sync
    let contactToSave, orgToSave;
    let isNewContact = false, isNewOrg = false;
    const today = getDemoToday();

    if (viewType === 'linkedin') {
      let oldContactId = record.contactId;
      let contactName = updatedFields.contactName || record.contactName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && contactName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = contactName;
          contact.fullName = contactName;
          contact.linkedinUrl = record.linkedinUrl || '';
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = contactName;
        const localLead = this.data.linkedinLeads.find(l => l.leadId === record.leadId);
        if (localLead) localLead.contactId = contactName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.contactName,
          email: '',
          mobile: '',
          linkedinUrl: record.linkedinUrl || '',
          organizationId: record.organizationId || '',
          segments: ['LinkedIn Lead'],
          preferredChannel: 'LinkedIn',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.contactName;
        contact.linkedinUrl = record.linkedinUrl;
        contact.updatedAt = today;
        contactToSave = contact;
      }

      if (updatedFields.company) {
        if (!record.organizationId) {
          record.organizationId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
          if (contactToSave) contactToSave.organizationId = record.organizationId;
        }
        let org = this.data.organizations.find(o => o.organizationId === record.organizationId);
        if (!org) {
          org = {
            organizationId: record.organizationId,
            organizationName: updatedFields.company,
            industry: '',
            website: '',
            source: 'LinkedIn',
            accountStatus: 'Active',
            ownerId: 'Gelo',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.organizations.push(org);
          isNewOrg = true;
        } else {
          org.organizationName = updatedFields.company;
          org.updatedAt = today;
        }
        orgToSave = org;
      }
    } else if (viewType === 'prime') {
      let oldContactId = record.contactId;
      let contactName = updatedFields.contactName || record.contactName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && contactName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = contactName;
          contact.fullName = contactName;
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = contactName;
        const localOpp = this.data.primePipeline.find(o => o.opportunityId === record.opportunityId);
        if (localOpp) localOpp.contactId = contactName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.contactName,
          email: '',
          mobile: '',
          linkedinUrl: '',
          organizationId: record.organizationId || '',
          segments: ['Prime'],
          preferredChannel: 'Email',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.contactName;
        contact.updatedAt = today;
        contactToSave = contact;
      }

      let org = this.data.organizations.find(o => o.organizationId === record.organizationId);
      if (!org) {
        org = {
          organizationId: record.organizationId,
          organizationName: updatedFields.orgName,
          industry: '',
          website: '',
          source: 'Direct',
          accountStatus: 'Prospect',
          ownerId: 'Gelo',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.organizations.push(org);
        isNewOrg = true;
      } else {
        org.organizationName = updatedFields.orgName;
        org.updatedAt = today;
      }
      orgToSave = org;
    } else if (viewType === 'calmera') {
      let oldContactId = record.contactId;
      let customerName = updatedFields.customerName || record.customerName || '';
      let isMigrated = false;

      if (oldContactId && oldContactId.startsWith('CON-') && customerName) {
        let contact = this.data.contacts.find(c => c.contactId === oldContactId);
        if (contact) {
          contact.contactId = customerName;
          contact.fullName = customerName;
          contact.preferredChannel = updatedFields.preferredChannel || 'Email';
          contact.updatedAt = today;
          contactToSave = contact;
        }
        record.contactId = customerName;
        const localOrder = this.data.calmeraOrders.find(o => o.orderId === record.orderId);
        if (localOrder) localOrder.contactId = customerName;
        isMigrated = true;
      }

      let contact = this.data.contacts.find(c => c.contactId === record.contactId);
      if (!contact && !isMigrated) {
        contact = {
          contactId: record.contactId,
          fullName: updatedFields.customerName,
          email: '',
          mobile: '',
          linkedinUrl: '',
          organizationId: '',
          segments: ['Calmera'],
          preferredChannel: updatedFields.preferredChannel || 'Email',
          contactBasis: '',
          ownerId: 'Gelo',
          status: 'Active',
          createdAt: today,
          updatedAt: today,
          notes: '',
        };
        this.data.contacts.push(contact);
        isNewContact = true;
        contactToSave = contact;
      } else if (!isMigrated) {
        contact.fullName = updatedFields.customerName;
        contact.preferredChannel = updatedFields.preferredChannel || 'Email';
        contact.updatedAt = today;
        contactToSave = contact;
      }
    }

    if (viewType === 'linkedin' && (record.stage === 'Closed Won' || record.stage === 'Closed')) {
      const opp = (this.data.primePipeline || []).find(p => String(p.sourceLeadId) === String(record.leadId));
      if (opp) {
        opp.stage = 'Closed';
        opp.dealStatus = 'Won';
        opp.closeDate = today;
      }
      this.triggerLeadToClientConversion(record);
    }

    // Run denormalize locally to immediately update view properties (like contactName and company)
    sheetsService._denormalize(this.data);

    // ── Save locally IMMEDIATELY (before async Sheets write) ──
    this.saveLocalData();

    // Refresh CRM views and reopen panel in view mode
    this.applyFilters();
    this.render();
    this.openRecordPanel(viewType, record[config.idKey]);
    this.showToast('Changes saved locally!', 'success');

    // Sync in background to Sheets (if connected)
    if (this.sheetsConnected) {
      this.updateTopbarSyncStatus('syncing');
      (async () => {
        try {
          // Write/Update Contact
          if (contactToSave) {
            if (isNewContact || contactToSave._rowIndex === undefined) {
              const res = await sheetsService.appendRecord('contacts', contactToSave);
              if (res && res.rowsAfter !== undefined) contactToSave._rowIndex = res.rowsAfter - 1;
            } else {
              await sheetsService.updateRecord('contacts', contactToSave._rowIndex, contactToSave);
            }
          }
          
          // Write/Update Organization
          if (orgToSave) {
            if (isNewOrg || orgToSave._rowIndex === undefined) {
              const res = await sheetsService.appendRecord('organizations', orgToSave);
              if (res && res.rowsAfter !== undefined) orgToSave._rowIndex = res.rowsAfter - 1;
            } else {
              await sheetsService.updateRecord('organizations', orgToSave._rowIndex, orgToSave);
            }
          }

          // Write/Update the Main Record
          const rowIndex = record._rowIndex;
          if (rowIndex !== undefined) {
            await sheetsService.updateRecord(config.tabKey, rowIndex, record);
          } else {
            const res = await sheetsService.appendRecord(config.tabKey, record);
            if (res && res.rowsAfter !== undefined) {
              record._rowIndex = res.rowsAfter - 1;
            }
          }

          delete record._syncStatus;
          delete record._syncError;
          this.saveLocalData();
          this.updateTopbarSyncStatus('synced');
          this.showToast('📤 Changes synced to Google Sheets', 'success');
          this.render(); // update badges
        } catch (err) {
          console.error('Sheet update failed:', err);
          const userErr = this.getFriendlyErrorMessage(err);
          record._syncStatus = 'Sync Failed';
          record._syncError = userErr;
          this.saveLocalData();
          this.updateTopbarSyncStatus('error');
          this.showToast(`⚠️ Saved locally, but sheet sync failed: ${userErr}`, 'warning');
          this.render(); // update badges
        }
      })();
    } else if (sheetsService.isConfigured()) {
      record._syncStatus = 'Pending Sync';
      record._syncError = 'Not connected to Google Sheets. Click retry in the details panel or check settings.';
      if (contactToSave) {
        contactToSave._syncStatus = 'Pending Sync';
        contactToSave._syncError = 'Not connected to Google Sheets.';
      }
      if (orgToSave) {
        orgToSave._syncStatus = 'Pending Sync';
        orgToSave._syncError = 'Not connected to Google Sheets.';
      }
      this.saveLocalData();
      this.render();
    }
  }

  async deleteSelectedRecord() {
    if (!this.selectedRecord) return;
    const { viewType, record } = this.selectedRecord;
    const label = viewType === 'linkedin' ? 'lead' : viewType === 'prime' ? 'opportunity' : 'record';

    this.showConfirm(
      'Delete Record',
      `Are you sure you want to permanently delete this ${label}? This will also delete its row in Google Sheets.`,
      '🗑️ Delete',
      () => this._doDeleteRecord(viewType, record)
    );
  }

  async _doDeleteRecord(viewType, record) {

    const dataMap = {
      'linkedin':   { data: this.data.linkedinLeads,    idKey: 'leadId',       tabKey: 'linkedinLeads' },
      'prime':      { data: this.data.primePipeline,    idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':        { data: this.data.sccContent,       idKey: 'contentId',     tabKey: 'sccContent' },
      'calmera':    { data: this.data.calmeraOrders,    idKey: 'orderId',       tabKey: 'calmeraOrders' },
      'repurposing':{ data: this.data.repurposeOutputs, idKey: 'outputId',      tabKey: 'repurposeOutputs' },
      'tasks':      { data: this.data.tasks,            idKey: 'taskId',        tabKey: 'tasks' },
      'projects':   { data: this.data.projects,         idKey: 'projectId',     tabKey: 'projects' },
      'clients':    { data: this.data.clients,          idKey: 'clientId',      tabKey: 'clients' },
      'goals':      { data: this.data.goals,            idKey: 'goalId',        tabKey: 'goals' },
      'habits':     { data: this.data.habits,           idKey: 'habitId',       tabKey: 'habits' },
      'learning':   { data: this.data.learning,         idKey: 'learningId',    tabKey: 'learning' },
      'notes':      { data: this.data.notes,            idKey: 'noteId',        tabKey: 'notes' },
      'sops':       { data: this.data.sops,             idKey: 'sopId',         tabKey: 'sops' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const rowIndex = record._rowIndex;
    const recordId = record[config.idKey];

    const index = config.data.findIndex(r => r[config.idKey] === recordId);
    if (index !== -1) config.data.splice(index, 1);

    config.data.forEach(r => {
      if (r._rowIndex !== undefined && r._rowIndex > rowIndex) r._rowIndex--;
    });

    // Save locally immediately so deletion survives a page reload
    this.saveLocalData();

    this.closePanel();
    this.applyFilters();
    this.render();
    this.showToast('Record deleted!', 'success');

    if (this.sheetsConnected) {
      try {
        if (rowIndex !== undefined) {
          // Fast path: we know the exact row
          await sheetsService.deleteRecord(config.tabKey, rowIndex);
        } else {
          // Fallback: let Apps Script find and delete the row by unique ID
          const tabName = config.tabKey; // sheetsService resolves this internally
          await sheetsService.sendPostRequest({
            action: 'delete',
            module: tabName,
            tab: tabName,
            data: { [config.idKey]: recordId },
          });
        }
        this.showToast('🗑️ Deleted from Google Sheets', 'success');
      } catch (err) {
        console.error('Sheet delete failed:', err);
        this.showToast(`⚠️ Deleted locally. Sheet delete failed: ${this.getFriendlyErrorMessage(err)}`, 'warning');
      }
    }
  }

  renderEditForm(viewType, r) {
    switch (viewType) {
      case 'linkedin':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Lead Details</div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Full Name *</label>
                <input class="gos-form-input" name="contactName" value="${r.contactName || ''}" required>
              </div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Company / Brand</label>
                <input class="gos-form-input" name="company" value="${r.company || ''}">
              </div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Role</label>
                <input class="gos-form-input" name="role" value="${r.role || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Phone Number</label>
                  <input class="gos-form-input" name="mobile" value="${r.mobile || ''}" placeholder="e.g. +63 917 ...">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Email Address</label>
                  <input class="gos-form-input" type="email" name="email" value="${r.email || ''}" placeholder="e.g. client@example.com">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Source</label>
                  <select class="gos-form-select" name="source">
                    ${['LinkedIn', 'Facebook', 'Instagram', 'Network', 'Referral', 'Website', 'Other'].map(opt => `
                      <option value="${opt}" ${r.source === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Profile / URL</label>
                  <input class="gos-form-input" name="linkedinUrl" value="${r.linkedinUrl || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Stage</label>
                  <select class="gos-form-select" name="stage">
                    ${['New', 'Qualified', 'Contacted', 'Nurturing', 'Closed', 'Recycle'].map(opt => `
                      <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Priority</label>
                  <select class="gos-form-select" name="priority">
                    ${['Low', 'Normal', 'High', 'Urgent', 'Critical'].map(opt => `
                      <option value="${opt}" ${r.priority === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Score (1-100)</label>
                  <input class="gos-form-input" type="number" name="qualificationScore" min="1" max="100" value="${r.qualificationScore || 50}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Projected Close Amount (₱)</label>
                  <input class="gos-form-input" type="number" name="projectedCloseAmount" value="${r.projectedCloseAmount || 0}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Next Action</label>
                  <input class="gos-form-input" name="nextAction" value="${r.nextAction || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Follow-up Date</label>
                  <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Follow-up Time</label>
                  <input class="gos-form-input" type="time" name="followUpTime" value="${r.followUpTime || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Call Date</label>
                  <input class="gos-form-input" type="date" name="callDate" value="${r.callDate || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Call Time</label>
                  <input class="gos-form-input" type="time" name="callTime" value="${r.callTime || ''}">
                </div>
                <div class="gos-form-group">
                  <!-- empty spacer -->
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Notes</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'prime':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Opportunity Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Contact Name *</label>
                <input class="gos-form-input" name="contactName" value="${r.contactName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Organization *</label>
                <input class="gos-form-input" name="orgName" value="${r.orgName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Service Interest *</label>
                <input class="gos-form-input" name="serviceInterest" value="${r.serviceInterest || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Stage</label>
                  <select class="gos-form-select" name="stage">
                    ${['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Deal Status</label>
                  <select class="gos-form-select" name="dealStatus">
                    ${['Open', 'In Progress', 'Won', 'Lost', 'Paid', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.dealStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Payment Status</label>
                <select class="gos-form-select" name="paymentStatus">
                  ${['Unpaid', 'Partial', 'Paid', 'Refunded', 'Cancelled'].map(opt => `
                    <option value="${opt}" ${r.paymentStatus === opt ? 'selected' : ''}>${opt}</option>
                  `).join('')}
                </select>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Estimated Value (₱)</label>
                  <input class="gos-form-input" type="number" name="estimatedValue" value="${r.estimatedValue || 0}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Probability (%)</label>
                  <input class="gos-form-input" type="number" name="probabilityPercent" min="0" max="100" value="${r.probabilityPercent || 20}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Next Action</label>
                <input class="gos-form-input" name="nextAction" value="${r.nextAction || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Action Due Date</label>
                  <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Action Due Time</label>
                  <input class="gos-form-input" type="time" name="nextActionTime" value="${r.nextActionTime || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Call Date</label>
                  <input class="gos-form-input" type="date" name="callDate" value="${r.callDate || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Call Time</label>
                  <input class="gos-form-input" type="time" name="callTime" value="${r.callTime || ''}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Problem Statement</label>
                <textarea class="gos-form-textarea" name="problemStatement" rows="3">${r.problemStatement || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'scc':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Content Calendar Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Title *</label>
                <input class="gos-form-input" name="title" value="${r.title || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Pillar</label>
                  <select class="gos-form-select" name="contentPillar">
                    ${['Mindset & Habits', 'Mental Health', 'Physical Wellness', 'Productivity', 'Community'].map(opt => `
                      <option value="${opt}" ${r.contentPillar === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Format</label>
                  <select class="gos-form-select" name="format">
                    ${['Carousel Post', 'Short Video', 'Blog Article', 'Live Session', 'Story Series', 'Interview Post', 'Quote Graphic'].map(opt => `
                      <option value="${opt}" ${r.format === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Channel</label>
                  <select class="gos-form-select" name="channel">
                    ${['Instagram', 'TikTok / Reels', 'LinkedIn', 'Facebook Group', 'Website'].map(opt => `
                      <option value="${opt}" ${r.channel === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Status</label>
                  <select class="gos-form-select" name="status">
                    ${['Idea', 'Planned', 'Draft', 'Review', 'Scheduled', 'Published', 'Archived'].map(opt => `
                      <option value="${opt}" ${r.status === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">CTA</label>
                <input class="gos-form-input" name="cta" value="${r.cta || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Planned Publish Date</label>
                  <input class="gos-form-input" type="date" name="plannedPublishAt" value="${r.plannedPublishAt || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Planned Publish Time</label>
                  <input class="gos-form-input" type="time" name="plannedPublishTime" value="${r.plannedPublishTime || ''}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Draft URL</label>
                <input class="gos-form-input" name="draftUrl" value="${r.draftUrl || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Published URL</label>
                <input class="gos-form-input" name="publishedUrl" value="${r.publishedUrl || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Views</label>
                  <input class="gos-form-input" type="number" name="views" value="${r.views || 0}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Comments</label>
                  <input class="gos-form-input" type="number" name="comments" value="${r.comments || 0}">
                </div>
              </div>
            </div>
          </form>
        `;
      case 'calmera':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Order Information</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Customer Name *</label>
                <input class="gos-form-input" name="customerName" value="${r.customerName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Order Reference</label>
                <input class="gos-form-input" name="externalOrderRef" value="${r.externalOrderRef || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Items Summary *</label>
                <input class="gos-form-input" name="itemsSummary" value="${r.itemsSummary || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Amount (₱)</label>
                <input class="gos-form-input" type="number" name="orderAmount" value="${r.orderAmount || 0}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Fulfillment Cutoff *</label>
                <input class="gos-form-input" type="date" name="fulfillmentCutoff" value="${r.fulfillmentCutoff || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Reconfirmation Status</label>
                  <select class="gos-form-select" name="reconfirmationStatus">
                    ${['Pending Contact', 'Awaiting Response', 'Confirmed', 'Changed', 'Cancelled', 'Escalated', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.reconfirmationStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Order Status</label>
                  <select class="gos-form-select" name="orderStatus">
                    ${['New', 'Pending', 'Updated', 'Fulfillment Ready', 'At Risk', 'Closed', 'Cancelled'].map(opt => `
                      <option value="${opt}" ${r.orderStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Change Notes</label>
                <input class="gos-form-input" name="changeNotes" value="${r.changeNotes || ''}">
              </div>
            </div>
          </form>
        `;
      case 'tasks':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Task Details</div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Title *</label>
                <input class="gos-form-input" name="title" value="${r.title || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Status</label>
                  <select class="gos-form-select" name="status">
                    ${['To Do', 'In Progress', 'Waiting', 'Review', 'Completed'].map(opt => `
                      <option value="${opt}" ${r.status === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Priority</label>
                  <select class="gos-form-select" name="priority">
                    ${['Low', 'Medium', 'High', 'Urgent'].map(opt => `
                      <option value="${opt}" ${r.priority === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Start Date</label>
                  <input class="gos-form-input" type="date" name="startDate" value="${r.startDate || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Start Time</label>
                  <input class="gos-form-input" type="time" name="startTime" value="${r.startTime || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Due Date</label>
                  <input class="gos-form-input" type="date" name="dueAt" value="${r.dueAt || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Due Time</label>
                  <input class="gos-form-input" type="time" name="dueTime" value="${r.dueTime || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Project</label>
                  <select class="gos-form-select" name="projectId">
                    <option value="">None</option>
                    ${(this.data.projects || []).map(p => `
                      <option value="${p.projectId}" ${r.projectId === p.projectId ? 'selected' : ''}>${p.projectName}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Client</label>
                  <select class="gos-form-select" name="clientId">
                    <option value="">None</option>
                    ${(this.data.clients || []).map(c => `
                      <option value="${c.clientId}" ${r.clientId === c.clientId ? 'selected' : ''}>${c.clientName}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Notes</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'projects':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Project Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Project Name *</label>
                <input class="gos-form-input" name="projectName" value="${r.projectName || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Start Date</label>
                  <input class="gos-form-input" type="date" name="startDate" value="${r.startDate || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Start Time</label>
                  <input class="gos-form-input" type="time" name="startTime" value="${r.startTime || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Deadline Date</label>
                  <input class="gos-form-input" type="date" name="deadline" value="${r.deadline || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Deadline Time</label>
                  <input class="gos-form-input" type="time" name="deadlineTime" value="${r.deadlineTime || ''}">
                </div>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Client</label>
                  <select class="gos-form-select" name="clientId">
                    <option value="">None</option>
                    ${(this.data.clients || []).map(c => `
                      <option value="${c.clientId}" ${r.clientId === c.clientId ? 'selected' : ''}>${c.clientName}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Budget (₱)</label>
                  <input class="gos-form-input" type="number" name="budget" value="${r.budget || 0}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Progress (%)</label>
                <input class="gos-form-input" type="number" name="progress" min="0" max="100" value="${r.progress || 0}">
              </div>
            </div>
          </form>
        `;
      case 'clients':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Client Details</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Client Name *</label>
                <input class="gos-form-input" name="clientName" value="${r.clientName || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Services</label>
                <input class="gos-form-input" name="services" value="${r.services || ''}" placeholder="e.g. Consulting, Branding">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">End Date</label>
                  <input class="gos-form-input" type="date" name="endDate" value="${r.endDate || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Account Value (₱)</label>
                  <input class="gos-form-input" type="number" name="accountValue" value="${r.accountValue || 0}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Linked Lead ID</label>
                <input class="gos-form-input" name="leadId" value="${r.leadId || ''}" readonly style="background:var(--surface-hover); opacity:0.7">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Client Notes</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'goals':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Goal</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Goal Name *</label>
                <input class="gos-form-input" name="goalName" value="${r.goalName || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Current Value</label>
                  <input class="gos-form-input" type="number" name="currentMetric" value="${r.currentMetric || 0}" step="any">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Target Value</label>
                  <input class="gos-form-input" type="number" name="targetMetric" value="${r.targetMetric || 0}" step="any">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Notes</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'habits':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Habit</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Habit Name *</label>
                <input class="gos-form-input" name="habitName" value="${r.habitName || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Frequency</label>
                  <select class="gos-form-select" name="frequency">
                    ${['Daily', 'Weekly', 'Weekdays', 'Weekends', 'Monthly'].map(opt => `
                      <option value="${opt}" ${r.frequency === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Current Streak</label>
                  <input class="gos-form-input" type="number" name="streak" value="${r.streak || 0}" min="0">
                </div>
              </div>
            </div>
          </form>
        `;
      case 'notes':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Note</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Title *</label>
                <input class="gos-form-input" name="title" value="${r.title || ''}" required>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Content</label>
                <textarea class="gos-form-textarea" name="content" rows="10">${r.content || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'learning':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit Learning Item</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Title *</label>
                <input class="gos-form-input" name="title" value="${r.title || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Category</label>
                  <input class="gos-form-input" name="category" value="${r.category || ''}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Status</label>
                  <select class="gos-form-select" name="status">
                    ${['To Read', 'Reading', 'Completed', 'On Hold'].map(opt => `
                      <option value="${opt}" ${r.status === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">URL / Link</label>
                <input class="gos-form-input" name="url" value="${r.url || ''}" placeholder="https://...">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Notes / Key Takeaways</label>
                <textarea class="gos-form-textarea" name="notes" rows="4">${r.notes || ''}</textarea>
              </div>
            </div>
          </form>
        `;
      case 'sops':
        return `
          <form id="edit-record-form" onsubmit="event.preventDefault();">
            <div class="gos-panel-section">
              <div class="gos-panel-section-title">Edit SOP</div>

              <div class="gos-form-group">
                <label class="gos-form-label">Process Title *</label>
                <input class="gos-form-input" name="processTitle" value="${r.processTitle || ''}" required>
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Version</label>
                  <input class="gos-form-input" name="version" value="${r.version || '1.0'}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Last Updated</label>
                  <input class="gos-form-input" type="date" name="lastUpdated" value="${r.lastUpdated || ''}">
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Steps (one per line)</label>
                <textarea class="gos-form-textarea" name="steps" rows="8">${(() => {
                  try {
                    const parsed = JSON.parse(r.steps || '[]');
                    return Array.isArray(parsed) ? parsed.join('\n') : (r.steps || '');
                  } catch (e) { return r.steps || ''; }
                })()}</textarea>
              </div>
            </div>
          </form>
        `;
      default:
        return `<div class="gos-empty">Edit not supported for this view type.</div>`;
    }
  }

  getRecordTitle(viewType, record) {
    switch (viewType) {
      case 'linkedin': return `${record.contactName} — Lead`;
      case 'prime': return `${record.orgName} — ${record.serviceInterest}`;
      case 'scc': return record.title;
      case 'calmera': return `${record.customerName} — ${record.externalOrderRef}`;
      case 'repurposing': return record.angleOrHook;
      case 'tasks': return record.title || 'Task Details';
      case 'projects': return record.projectName || 'Project Details';
      case 'clients': return record.clientName || 'Client Details';
      case 'goals': return record.goalName || 'Goal Details';
      case 'notes': return record.title || 'Note Details';
      case 'sops': return record.processTitle || 'SOP Details';
      default: return 'Record Details';
    }
  }

  renderRecordDetail(viewType, record) {
    switch (viewType) {
      case 'linkedin': return this.renderLinkedInDetail(record);
      case 'prime': return this.renderPrimeDetail(record);
      case 'scc': return this.renderSCCDetail(record);
      case 'calmera': return this.renderCalmeraDetail(record);
      case 'repurposing': return this.renderRepurposeDetail(record);
      case 'tasks': return this.renderTaskDetail(record);
      case 'projects': return this.renderProjectDetail(record);
      case 'clients': return this.renderClientDetail(record);
      case 'goals': return this.renderGoalDetail(record);
      case 'notes': return this.renderNoteDetail(record);
      case 'sops': return this.renderSOPDetail(record);
      default: return '';
    }
  }

  renderLinkedInDetail(r) {
    const interactions = this.data.interactions.filter(i => i.recordId === r.leadId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Lead Information</div>
        ${this.renderField('Name', r.contactName)}
        ${this.renderField('Company / Brand', r.company)}
        ${this.renderField('Role', r.role)}
        ${this.renderField('Stage', this.renderBadge(r.stage))}
        ${this.renderField('Priority', this.renderBadge(r.priority))}
        ${this.renderField('Score', this.renderScore(r.qualificationScore))}
        ${this.renderField('Source', r.source)}
        ${this.renderField('Profile / URL', r.linkedinUrl ? `<a href="${r.linkedinUrl.startsWith('http') ? r.linkedinUrl : 'https://' + r.linkedinUrl}" target="_blank" class="gos-link" onclick="event.stopPropagation()">${r.linkedinUrl}</a>` : '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Contact Details</div>
        ${this.renderField('Phone Number', r.mobile || '—')}
        ${this.renderField('Email Address', r.email || '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Commercial</div>
        ${this.renderField('Projected Close Amount', `₱${(r.projectedCloseAmount || 0).toLocaleString()}`)}
        ${r.pipelineOpportunityId ? this.renderField('Pipeline Deal', `<a class="cell-link clickable" onclick="app.openRecordPanel('prime', '${r.pipelineOpportunityId}')">${r.pipelineOpportunityId}</a>`) : ''}
        ${this.renderField('Notes', r.notes)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Follow-Up</div>
        ${this.renderField('Next Action', r.nextAction)}
        ${this.renderField('Follow-up Date', this.renderDueDate(r.nextActionDate))}
        ${this.renderField('Last Interaction', r.lastInteractionAt || '—')}
      </div>
      ${interactions.length > 0 ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Interactions (${interactions.length})</div>
          ${interactions.map(i => `
            <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${i.interactionType} — ${i.channel}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${i.summary}</div>
              <div style="font-size:11px;color:var(--text-muted)">${i.occurredAt} · ${i.direction}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  renderPrimeDetail(r) {
    const interactions = this.data.interactions.filter(i => i.recordId === r.opportunityId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Opportunity Details</div>
        ${this.renderField('Contact', r.contactName)}
        ${this.renderField('Organization', r.orgName)}
        ${this.renderField('Service', r.serviceInterest)}
        ${this.renderField('Stage', this.renderBadge(r.stage))}
        ${this.renderField('Deal Status', this.renderBadge(r.dealStatus || 'Open'))}
        ${this.renderField('Payment Status', this.renderBadge(r.paymentStatus || 'Unpaid'))}
        ${this.renderField('Problem', r.problemStatement)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Commercial</div>
        ${this.renderField('Estimated Value', `₱${(r.estimatedValue || 0).toLocaleString()}`)}
        ${this.renderField('Probability', `${r.probabilityPercent}%`)}
        ${this.renderField('Weighted Value', `₱${(r.weightedValue || 0).toLocaleString()}`)}
        ${this.renderField('Budget Range', r.budgetRange)}
        ${this.renderField('Decision Maker', r.decisionMaker)}
        ${this.renderField('Timeline', r.timeline)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Dates & Actions</div>
        ${this.renderField('Discovery', r.discoveryDate || '—')}
        ${this.renderField('Proposal Sent', r.proposalDate || '—')}
        ${this.renderField('Next Action', r.nextAction)}
        ${this.renderField('Action Due', this.renderDueDate(r.nextActionDate))}
        ${r.closeDate ? this.renderField('Closed', r.closeDate) : ''}
        ${r.outcomeReason ? this.renderField('Outcome', r.outcomeReason) : ''}
      </div>
      ${interactions.length > 0 ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Interactions (${interactions.length})</div>
          ${interactions.map(i => `
            <div style="padding:10px;background:var(--bg-surface);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${i.interactionType} — ${i.channel}</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${i.summary}</div>
              <div style="font-size:11px;color:var(--text-muted)">${i.occurredAt}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  renderSCCDetail(r) {
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Content Details</div>
        ${this.renderField('Title', r.title)}
        ${this.renderField('Pillar', r.contentPillar)}
        ${this.renderField('Format', r.format)}
        ${this.renderField('Channel', r.channel)}
        ${this.renderField('Status', this.renderBadge(r.status))}
        ${this.renderField('CTA', r.cta)}
        ${this.renderField('Campaign', r.campaign || '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Schedule</div>
        ${this.renderField('Planned Publish', this.renderDueDate(r.plannedPublishAt))}
        ${r.publishedAt ? this.renderField('Published At', r.publishedAt) : ''}
        ${r.draftUrl ? this.renderField('Draft', `<a href="${r.draftUrl}" target="_blank" class="cell-link">Open Draft</a>`) : ''}
        ${r.publishedUrl ? this.renderField('Published URL', `<a href="${r.publishedUrl}" target="_blank" class="cell-link">View Post</a>`) : ''}
      </div>
      ${r.status === 'Published' ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Performance</div>
          <div class="gos-form-row" style="margin-bottom:0">
            <div>${this.renderField('Views', this.formatNumber(r.views))}</div>
            <div>${this.renderField('Comments', r.comments)}</div>
            <div>${this.renderField('Saves', r.saves)}</div>
            <div>${this.renderField('Replies', r.replies)}</div>
          </div>
        </div>
      ` : ''}
      ${this.renderField('Repurpose Flag', r.repurposeFlag ? '✅ Flagged for repurposing' : '—')}
    `;
  }

  renderCalmeraDetail(r) {
    const reconfirmations = this.data.interactions.filter(i => i.recordId === r.orderId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Order Information</div>
        ${this.renderField('Customer', r.customerName)}
        ${this.renderField('Order Ref', r.externalOrderRef)}
        ${this.renderField('Items', r.itemsSummary)}
        ${this.renderField('Amount', `₱${(r.orderAmount || 0).toLocaleString()}`)}
        ${this.renderField('Order Date', r.orderDate)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Reconfirmation</div>
        ${this.renderField('Status', this.renderBadge(r.reconfirmationStatus))}
        ${this.renderField('Order Status', this.renderBadge(r.orderStatus))}
        ${this.renderField('Fulfillment Cutoff', this.renderDueDate(r.fulfillmentCutoff))}
        ${this.renderField('Preferred Channel', r.preferredChannel)}
        ${this.renderField('Response Due', this.renderDueDate(r.responseDueAt))}
        ${r.latestAttemptAt ? this.renderField('Last Attempt', r.latestAttemptAt) : ''}
        ${r.resolvedAt ? this.renderField('Resolved', r.resolvedAt) : ''}
        ${r.changeNotes ? this.renderField('Change Notes', `<span class="text-amber">${r.changeNotes}</span>`) : ''}
      </div>
    `;
  }

  renderRepurposeDetail(r) {
    const source = this.data.sourceAssets.find(s => s.sourceId === r.sourceId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Output Details</div>
        ${this.renderField('Angle / Hook', r.angleOrHook)}
        ${this.renderField('Target Channel', r.targetChannel)}
        ${this.renderField('Format', r.format)}
        ${this.renderField('Brand', r.targetBrand)}
        ${this.renderField('CTA', r.cta)}
        ${this.renderField('Status', this.renderBadge(r.status))}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Source</div>
        ${source ? `
          ${this.renderField('Source Title', source.title)}
          ${this.renderField('Source Type', source.sourceType)}
          ${this.renderField('Theme', source.keyTheme)}
        ` : this.renderField('Source ID', r.sourceId)}
      </div>
      ${r.status === 'Published' ? `
        <div class="gos-panel-section">
          <div class="gos-panel-section-title">Performance</div>
          ${this.renderField('Views', this.formatNumber(r.views))}
          ${this.renderField('Engagements', r.engagements)}
          ${this.renderField('Leads Generated', r.leadsGenerated)}
        </div>
      ` : ''}
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Schedule</div>
        ${r.scheduledAt ? this.renderField('Scheduled', r.scheduledAt) : ''}
        ${r.publishedAt ? this.renderField('Published', r.publishedAt) : ''}
        ${r.draftUrl ? this.renderField('Draft', `<a href="${r.draftUrl}" target="_blank" class="cell-link">Open Draft</a>`) : ''}
        ${r.publishedUrl ? this.renderField('Published URL', `<a href="${r.publishedUrl}" target="_blank" class="cell-link">View Post</a>`) : ''}
      </div>
    `;
  }

  renderField(label, value) {
    return `
      <div class="gos-panel-field">
        <div class="gos-panel-field-label">${label}</div>
        <div class="gos-panel-field-value">${value || '—'}</div>
      </div>
    `;
  }

  // ── Add Record Modal ────────────────────────────────────────
  openAddModal() {
    const overlay    = document.getElementById('add-modal-overlay');
    const formFields = document.getElementById('add-form-fields');
    const titleEl    = document.getElementById('add-modal-title');

    const target = this._addRecordTarget || this.currentView;
    const viewTitles = {
      linkedin:   'Add New Lead',     prime:      'Add New Opportunity',
      scc:        'Add New Content',  calmera:    'Add New Order',
      repurposing:'Add New Output',   settings:   '',
      tasks:      'Add New Task',     projects:   'Add New Project',
      clients:    'Add New Client',   notes:      'Add New Note',
      'command-center': 'Add New Lead', calendar: 'Add New Lead',
      messages:   'Add New Lead',
    };
    if (titleEl) titleEl.textContent = viewTitles[target] || 'Add New Record';
    if (formFields) formFields.innerHTML = this.getAddFormFields();
    if (overlay) overlay.style.display = 'flex';
  }

  closeModal(modalId) {
    if (modalId === 'add-modal') {
      const el = document.getElementById('add-modal-overlay');
      if (el) el.style.display = 'none';
      this._addRecordTarget = null;
    } else {
      const el = document.getElementById('msg-modal-overlay');
      if (el) el.style.display = 'none';
    }
  }

  // ── Quick Add Dropdown ──────────────────────────────────────
  toggleQuickAddDropdown(event) {
    event.stopPropagation();
    const dd = document.getElementById('quick-add-dropdown');
    if (!dd) return;
    const isOpen = dd.style.display === 'block';
    dd.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      const close = (e) => {
        if (!dd.contains(e.target)) {
          dd.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  // ── Notifications Dropdown ──────────────────────────────────
  toggleNotifications(event) {
    if (event) event.stopPropagation();
    const dd = document.getElementById('notifications-dropdown');
    if (!dd) return;
    const isOpen = dd.classList.contains('active');
    
    if (isOpen) {
      dd.classList.remove('active');
    } else {
      dd.classList.add('active');
      // Mark all as read when opening dropdown
      if (this.notifications) {
        this.notifications.forEach(n => n.read = true);
        localStorage.setItem('gos_notifications_log', JSON.stringify(this.notifications));
        this.updateNotificationsUI();
      }
      
      const close = (e) => {
        if (!dd.contains(e.target)) {
          dd.classList.remove('active');
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  clearNotifications(event) {
    if (event) event.stopPropagation();
    this.notifications = [];
    localStorage.setItem('gos_notifications_log', JSON.stringify(this.notifications));
    this.updateNotificationsUI();
  }

  updateNotificationsUI() {
    const badge = document.getElementById('notifications-badge');
    const unreadCount = (this.notifications || []).filter(n => !n.read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    const list = document.getElementById('notifications-dropdown-list');
    if (list) {
      if (!this.notifications || this.notifications.length === 0) {
        list.innerHTML = '<div class="notification-empty">No recent activity</div>';
      } else {
        const typeIcons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        list.innerHTML = this.notifications.map(n => `
          <div class="notification-item ${n.read ? 'read' : 'unread'} ${n.type}">
            <span class="notification-item-icon">${typeIcons[n.type] || 'ℹ️'}</span>
            <div class="notification-item-content">
              <div class="notification-item-text">${n.message}</div>
              <div class="notification-item-time">${n.timestamp}</div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  openQuickAdd(type, event) {
    if (event) event.stopPropagation();
    const dd = document.getElementById('quick-add-dropdown');
    if (dd) dd.style.display = 'none';
    this._addRecordTarget = type;
    this.openAddModal();
  }

  getAddFormFields() {
    const target = this._addRecordTarget || this.currentView;
    switch (target) {
      case 'linkedin': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Full Name *</label><input class="gos-form-input" name="contactName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Company / Brand</label><input class="gos-form-input" name="company"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Phone Number</label><input class="gos-form-input" name="mobile" placeholder="e.g. +63 917 ..."></div>
          <div class="gos-form-group"><label class="gos-form-label">Email Address</label><input class="gos-form-input" type="email" name="email" placeholder="e.g. client@example.com"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Source</label>
            <select class="gos-form-select" name="source">
              <option>LinkedIn</option>
              <option>Facebook</option>
              <option>Instagram</option>
              <option>Network</option>
              <option>Referral</option>
              <option>Website</option>
              <option>Other</option>
            </select>
          </div>
          <div class="gos-form-group"><label class="gos-form-label">Profile / URL</label><input class="gos-form-input" name="linkedinUrl" placeholder="e.g. Profile or source link"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Stage</label>
            <select class="gos-form-select" name="stage">
              <option>New</option>
              <option>Qualified</option>
              <option>Contacted</option>
              <option>Nurturing</option>
              <option>Closed</option>
              <option>Recycle</option>
            </select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Priority</label>
            <select class="gos-form-select" name="priority">
              <option>Normal</option>
              <option>Low</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Score (1-100)</label><input class="gos-form-input" type="number" name="qualificationScore" min="1" max="100" value="50"></div>
          <div class="gos-form-group"><label class="gos-form-label">Projected Close Amount (₱)</label><input class="gos-form-input" type="number" name="projectedCloseAmount" placeholder="e.g. 30000"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction" placeholder="e.g. Send first message"></div>
          <div class="gos-form-group"><label class="gos-form-label">Follow-up Date</label><input class="gos-form-input" name="nextActionDate" type="date"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Follow-up Time</label><input class="gos-form-input" name="followUpTime" type="time"></div>
          <div class="gos-form-group"><label class="gos-form-label">Call Date</label><input class="gos-form-input" name="callDate" type="date"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Call Time</label><input class="gos-form-input" name="callTime" type="time"></div>
          <div class="gos-form-group"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
      case 'prime': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Contact Name *</label><input class="gos-form-input" name="contactName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Organization *</label><input class="gos-form-input" name="orgName" required></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Service Interest *</label><input class="gos-form-input" name="serviceInterest" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Problem Statement</label><textarea class="gos-form-textarea" name="problemStatement" rows="2"></textarea></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Estimated Value (₱)</label><input class="gos-form-input" name="estimatedValue" type="number"></div>
          <div class="gos-form-group"><label class="gos-form-label">Probability (%)</label><input class="gos-form-input" name="probabilityPercent" type="number" min="0" max="100"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Stage</label>
            <select class="gos-form-select" name="stage">
              <option>New Inquiry</option>
              <option>Qualified</option>
              <option>Discovery</option>
              <option>Proposal Sent</option>
              <option>Negotiation</option>
              <option>Won</option>
              <option>Lost</option>
              <option>Handoff</option>
              <option>Closed</option>
            </select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Deal Status</label>
            <select class="gos-form-select" name="dealStatus">
              <option>Open</option>
              <option>In Progress</option>
              <option>Won</option>
              <option>Lost</option>
              <option>Paid</option>
              <option>Closed</option>
            </select>
          </div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction"></div>
          <div class="gos-form-group"><label class="gos-form-label">Action Due Date</label><input class="gos-form-input" name="nextActionDate" type="date"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Action Due Time</label><input class="gos-form-input" name="nextActionTime" type="time"></div>
          <div class="gos-form-group"><label class="gos-form-label">Call Date</label><input class="gos-form-input" name="callDate" type="date"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Call Time</label><input class="gos-form-input" name="callTime" type="time"></div>
          <div class="gos-form-group"></div>
        </div>
      `;
      case 'scc': return `
        <div class="gos-form-group"><label class="gos-form-label">Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Pillar</label>
            <select class="gos-form-select" name="contentPillar"><option>Mindset & Habits</option><option>Mental Health</option><option>Physical Wellness</option><option>Productivity</option><option>Community</option></select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Format</label>
            <select class="gos-form-select" name="format"><option>Carousel Post</option><option>Short Video</option><option>Blog Article</option><option>Live Session</option><option>Story Series</option><option>Interview Post</option><option>Quote Graphic</option></select>
          </div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Channel</label>
            <select class="gos-form-select" name="channel"><option>Instagram</option><option>TikTok / Reels</option><option>LinkedIn</option><option>Facebook Group</option><option>Website</option></select>
          </div>
          <div class="gos-form-group"><label class="gos-form-label">Planned Publish Date</label><input class="gos-form-input" name="plannedPublishAt" type="date"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Planned Publish Time</label><input class="gos-form-input" name="plannedPublishTime" type="time"></div>
          <div class="gos-form-group"><label class="gos-form-label">CTA</label><input class="gos-form-input" name="cta" placeholder="Call to action"></div>
        </div>
      `;
      case 'calmera': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Customer Name *</label><input class="gos-form-input" name="customerName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Order Reference</label><input class="gos-form-input" name="externalOrderRef"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Items Summary *</label><input class="gos-form-input" name="itemsSummary" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Amount (₱)</label><input class="gos-form-input" name="orderAmount" type="number"></div>
          <div class="gos-form-group"><label class="gos-form-label">Fulfillment Cutoff *</label><input class="gos-form-input" name="fulfillmentCutoff" type="date" required></div>
        </div>
        <div class="gos-form-group">
          <label class="gos-form-label">Preferred Channel</label>
          <select class="gos-form-select" name="preferredChannel"><option>Email</option><option>SMS</option><option>Phone</option></select>
        </div>
      `;
      case 'tasks': return `
        <div class="gos-form-group"><label class="gos-form-label">Task Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Priority</label>
            <select class="gos-form-select" name="priority">
              <option>Normal</option>
              <option>Low</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Project</label>
            <select class="gos-form-select" name="projectId">
              <option value="">None</option>
              ${(this.data.projects || []).map(p => `<option value="${p.projectId}">${p.projectName}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Start Date</label><input class="gos-form-input" type="date" name="startDate"></div>
          <div class="gos-form-group"><label class="gos-form-label">Start Time</label><input class="gos-form-input" type="time" name="startTime"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Due Date</label><input class="gos-form-input" type="date" name="dueAt"></div>
          <div class="gos-form-group"><label class="gos-form-label">Due Time</label><input class="gos-form-input" type="time" name="dueTime"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Client</label>
            <select class="gos-form-select" name="clientId">
              <option value="">None</option>
              ${(this.data.clients || []).map(c => `<option value="${c.clientId}">${c.clientName}</option>`).join('')}
            </select>
          </div>
          <div class="gos-form-group"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
      case 'projects': return `
        <div class="gos-form-group"><label class="gos-form-label">Project Name *</label><input class="gos-form-input" name="projectName" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Start Date</label><input class="gos-form-input" type="date" name="startDate"></div>
          <div class="gos-form-group"><label class="gos-form-label">Start Time</label><input class="gos-form-input" type="time" name="startTime"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Deadline Date</label><input class="gos-form-input" type="date" name="deadline"></div>
          <div class="gos-form-group"><label class="gos-form-label">Deadline Time</label><input class="gos-form-input" type="time" name="deadlineTime"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Client</label>
            <select class="gos-form-select" name="clientId">
              <option value="">None</option>
              ${(this.data.clients || []).map(c => `<option value="${c.clientId}">${c.clientName}</option>`).join('')}
            </select>
          </div>
          <div class="gos-form-group"><label class="gos-form-label">Budget (₱)</label><input class="gos-form-input" type="number" name="budget"></div>
        </div>
      `;
      case 'clients': return `
        <div class="gos-form-group"><label class="gos-form-label">Client Name *</label><input class="gos-form-input" name="clientName" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Services / Contract</label><input class="gos-form-input" name="services"></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">End Date</label><input class="gos-form-input" type="date" name="endDate"></div>
          <div class="gos-form-group"><label class="gos-form-label">Account Value (₱)</label><input class="gos-form-input" type="number" name="accountValue"></div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Client Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
      case 'goals': return `
        <div class="gos-form-group"><label class="gos-form-label">Goal Name *</label><input class="gos-form-input" name="goalName" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Target Metric</label><input class="gos-form-input" name="targetMetric" placeholder="e.g. 100000"></div>
          <div class="gos-form-group"><label class="gos-form-label">Current Metric</label><input class="gos-form-input" name="currentMetric" value="0"></div>
        </div>
      `;
      case 'habits': return `
        <div class="gos-form-group"><label class="gos-form-label">Habit Name *</label><input class="gos-form-input" name="habitName" required></div>
        <div class="gos-form-group">
          <label class="gos-form-label">Frequency</label>
          <select class="gos-form-select" name="frequency">
            <option>Daily</option>
            <option>Weekly</option>
          </select>
        </div>
      `;
      case 'learning': return `
        <div class="gos-form-group"><label class="gos-form-label">Topic / Resource Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Category</label><input class="gos-form-input" name="category" placeholder="e.g. Book, Course"></div>
          <div class="gos-form-group">
            <label class="gos-form-label">Status</label>
            <select class="gos-form-select" name="status">
              <option>To Read</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
        </div>
      `;
      case 'notes': return `
        <div class="gos-form-group"><label class="gos-form-label">Note Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Content</label><textarea class="gos-form-textarea" name="content" rows="6" placeholder="Type notes here..."></textarea></div>
      `;
      case 'sops': return `
        <div class="gos-form-group"><label class="gos-form-label">Process Title *</label><input class="gos-form-input" name="processTitle" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Steps (One per line) *</label><textarea class="gos-form-textarea" name="steps" rows="6" placeholder="Step 1...\nStep 2..." required></textarea></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Version</label><input class="gos-form-input" name="version" value="1.0"></div>
        </div>
      `;
      default: return `
        <div class="gos-form-group"><label class="gos-form-label">Title *</label><input class="gos-form-input" name="title" required></div>
        <div class="gos-form-group"><label class="gos-form-label">Notes</label><textarea class="gos-form-textarea" name="notes" rows="3"></textarea></div>
      `;
    }
  }

  handleAddRecord() {
    const form = document.getElementById('add-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const today = getDemoToday();
    let newRecord;
    let newContact;
    let newOrg;

    const addTarget = this._addRecordTarget || this.currentView;
    this._addRecordTarget = null;
    switch (addTarget) {
      case 'linkedin': { // falls through from switch(addTarget)
        const contactId = data.contactName;
        let orgId = '';

        // Avoid duplicate contacts
        let contact = this.data.contacts.find(c => c.fullName === data.contactName || c.contactId === contactId);
        if (!contact) {
          newContact = {
            contactId,
            fullName: data.contactName,
            email: data.email || '',
            mobile: data.mobile || '',
            linkedinUrl: data.linkedinUrl || '',
            organizationId: '', // will be set below
            segments: ['LinkedIn Lead'],
            preferredChannel: 'LinkedIn',
            contactBasis: '',
            ownerId: 'Gelo',
            status: data.status || 'Lead',
            createdAt: today,
            updatedAt: today,
            notes: data.notes || '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        if (data.company) {
          let org = this.data.organizations.find(o => o.organizationName === data.company);
          if (!org) {
            orgId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
            newOrg = {
              organizationId: orgId,
              organizationName: data.company,
              industry: '',
              website: '',
              source: 'LinkedIn',
              accountStatus: 'Active',
              ownerId: 'Gelo',
              createdAt: today,
              updatedAt: today,
              notes: '',
            };
            this.data.organizations.push(newOrg);
          } else {
            orgId = org.organizationId;
            newOrg = null;
          }
          if (newContact) newContact.organizationId = orgId;
          else if (contact) contact.organizationId = orgId;
        }

        newRecord = {
          leadId: `LL-${String((this.data.linkedinLeads || []).length + 1).padStart(4, '0')}`,
          contactId: contactId,
          contactName: data.contactName,
          linkedinUrl: data.linkedinUrl || '',
          source: data.source || 'LinkedIn',
          dateCaptured: today,
          connectionStatus: 'Pending',
          role: data.role || '',
          organizationId: orgId,
          interestSignal: data.interestSignal || '',
          qualificationScore: parseFloat(data.qualificationScore) || 50,
          priority: data.priority || 'Normal',
          stage: data.stage || 'New',
          lastInteractionAt: '',
          nextAction: data.nextAction || '',
          nextActionDate: data.nextActionDate || '',
          followUpTime: data.followUpTime || '',
          callDate: data.callDate || '',
          callTime: data.callTime || '',
          convertedOpportunityId: '',
          ownerId: 'Gelo',
          notes: data.notes || '',
          email: data.email || '',
          mobile: data.mobile || '',
          company: data.company || '',
          projectedCloseAmount: parseFloat(data.projectedCloseAmount) || 0,
        };
        this.data.linkedinLeads.push(newRecord);
        break;
      }
      case 'prime': {
        const primeContactId = data.contactName;
        let primeOrgId = '';

        let contact = this.data.contacts.find(c => c.fullName === data.contactName || c.contactId === primeContactId);
        if (!contact) {
          newContact = {
            contactId: primeContactId,
            fullName: data.contactName,
            email: '',
            mobile: '',
            linkedinUrl: '',
            organizationId: '', // will be set below
            segments: ['Prime'],
            preferredChannel: 'Email',
            contactBasis: '',
            ownerId: 'Gelo',
            status: 'Active',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        let org = this.data.organizations.find(o => o.organizationName === data.orgName);
        if (!org) {
          primeOrgId = `ORG-${String((this.data.organizations || []).length + 1).padStart(4, '0')}`;
          newOrg = {
            organizationId: primeOrgId,
            organizationName: data.orgName,
            industry: '',
            website: '',
            source: 'Direct',
            accountStatus: 'Prospect',
            ownerId: 'Gelo',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.organizations.push(newOrg);
        } else {
          primeOrgId = org.organizationId;
          newOrg = null;
        }
        if (newContact) newContact.organizationId = primeOrgId;
        else if (contact) contact.organizationId = primeOrgId;

        const value = parseInt(data.estimatedValue) || 0;
        const prob = parseInt(data.probabilityPercent) || 20;
        newRecord = {
          opportunityId: `PO-${String((this.data.primePipeline || []).length + 1).padStart(4, '0')}`,
          contactId: primeContactId,
          organizationId: primeOrgId,
          sourceLeadId: '',
          serviceInterest: data.serviceInterest,
          problemStatement: data.problemStatement || '',
          stage: 'New Inquiry',
          estimatedValue: value,
          probabilityPercent: prob,
          weightedValue: Math.round(value * prob / 100),
          budgetRange: '',
          decisionMaker: data.contactName,
          timeline: '',
          discoveryDate: '',
          proposalDate: '',
          nextAction: data.nextAction || '',
          nextActionDate: data.nextActionDate || '',
          nextActionTime: data.nextActionTime || '',
          callDate: data.callDate || '',
          callTime: data.callTime || '',
          closeDate: '',
          outcomeReason: '',
          ownerId: 'Gelo',
        };
        this.data.primePipeline.push(newRecord);
        break;
      }
      case 'scc': {
        newRecord = {
          contentId: `SCC-${String((this.data.sccContent || []).length + 1).padStart(4, '0')}`,
          ...data,
          status: 'Idea',
          brand: data.brand || 'Self Care Club',
          platform: data.channel || data.platform || '',
          caption: data.caption || data.cta || '',
          views: 0, comments: 0, saves: 0, replies: 0,
          repurposeFlag: 'FALSE',
          sourceId: '',
          ownerId: 'Gelo',
          publishedAt: '', publishedUrl: '', draftUrl: '', assetUrl: '',
          createdAt: today,
          updatedAt: today,
        };
        this.data.sccContent.push(newRecord);
        break;
      }
      case 'calmera': {
        const calmeraContactId = data.customerName;

        let contact = this.data.contacts.find(c => c.fullName === data.customerName || c.contactId === calmeraContactId);
        if (!contact) {
          newContact = {
            contactId: calmeraContactId,
            fullName: data.customerName,
            email: '',
            mobile: '',
            linkedinUrl: '',
            organizationId: '',
            segments: ['Calmera'],
            preferredChannel: data.preferredChannel || 'Email',
            contactBasis: '',
            ownerId: 'Gelo',
            status: 'Active',
            createdAt: today,
            updatedAt: today,
            notes: '',
          };
          this.data.contacts.push(newContact);
        } else {
          newContact = null;
        }

        newRecord = {
          orderId: `CAL-${String((this.data.calmeraOrders || []).length + 1).padStart(4, '0')}`,
          externalOrderRef: data.externalOrderRef || '',
          contactId: calmeraContactId,
          customerName: data.customerName,
          orderDate: today,
          itemsSummary: data.itemsSummary,
          orderAmount: parseInt(data.orderAmount) || 0,
          fulfillmentCutoff: data.fulfillmentCutoff,
          preferredChannel: data.preferredChannel || 'Email',
          reconfirmationStatus: 'Pending Contact',
          latestAttemptAt: '',
          responseDueAt: '',
          orderStatus: 'New',
          changeNotes: '',
          resolvedAt: '',
          ownerId: 'Gelo',
        };
        this.data.calmeraOrders.push(newRecord);
        break;
      }
      case 'tasks': {
        newRecord = {
          taskId: `T-${String((this.data.tasks || []).length + 1).padStart(4, '0')}`,
          title: data.title,
          status: this.taskColumns[0] || 'To Do',
          priority: data.priority || 'Normal',
          dueAt: data.dueAt || '',
          dueTime: data.dueTime || '',
          startDate: data.startDate || '',
          startTime: data.startTime || '',
          areaId: data.areaId || '',
          projectId: data.projectId || '',
          clientId: data.clientId || '',
          notes: data.notes || '',
          createdAt: today,
          updatedAt: today,
        };
        if (!this.data.tasks) this.data.tasks = [];
        this.data.tasks.push(newRecord);
        break;
      }
      case 'projects': {
        newRecord = {
          projectId: `PRJ-${String((this.data.projects || []).length + 1).padStart(4, '0')}`,
          projectName: data.projectName,
          status: data.status || 'Planning',
          startDate: data.startDate || '',
          startTime: data.startTime || '',
          deadline: data.deadline || '',
          deadlineTime: data.deadlineTime || '',
          progress: 0,
          areaId: data.areaId || '',
          budget: parseFloat(data.budget) || 0,
          clientId: data.clientId || '',
          createdAt: today,
          updatedAt: today,
        };
        if (!this.data.projects) this.data.projects = [];
        this.data.projects.push(newRecord);
        break;
      }
      case 'clients': {
        newRecord = {
          clientId: `CL-${String((this.data.clients || []).length + 1).padStart(4, '0')}`,
          clientName: data.clientName,
          company: data.company || '',
          status: data.status || 'Active',
          sourceLeadId: data.sourceLeadId || data.leadId || '',
          leadId: data.leadId || data.sourceLeadId || '',
          services: data.services || '',
          startDate: data.startDate || today,
          endDate: data.endDate || '',
          accountValue: parseFloat(data.accountValue) || 0,
          createdAt: today,
          updatedAt: today,
        };
        if (!this.data.clients) this.data.clients = [];
        this.data.clients.push(newRecord);
        break;
      }
      case 'goals': {
        newRecord = {
          goalId: `G-${String((this.data.goals || []).length + 1).padStart(4, '0')}`,
          goalName: data.goalName,
          targetMetric: data.targetMetric || '',
          currentMetric: data.currentMetric || '0',
          createdAt: today,
        };
        if (!this.data.goals) this.data.goals = [];
        this.data.goals.push(newRecord);
        break;
      }
      case 'habits': {
        newRecord = {
          habitId: `H-${String((this.data.habits || []).length + 1).padStart(4, '0')}`,
          habitName: data.habitName,
          frequency: data.frequency || 'Daily',
          streak: 0,
          history: '{}',
          createdAt: today,
        };
        if (!this.data.habits) this.data.habits = [];
        this.data.habits.push(newRecord);
        break;
      }
      case 'learning': {
        newRecord = {
          learningId: `L-${String((this.data.learning || []).length + 1).padStart(4, '0')}`,
          title: data.title,
          category: data.category || '',
          status: data.status || 'To Read',
          createdAt: today,
        };
        if (!this.data.learning) this.data.learning = [];
        this.data.learning.push(newRecord);
        break;
      }
      case 'notes': {
        newRecord = {
          noteId: `N-${String((this.data.notes || []).length + 1).padStart(4, '0')}`,
          title: data.title,
          content: data.content || '',
          createdAt: today,
        };
        if (!this.data.notes) this.data.notes = [];
        this.data.notes.push(newRecord);
        break;
      }
      case 'sops': {
        const stepLines = (data.steps || '').split('\n').map(l => l.trim()).filter(Boolean);
        newRecord = {
          sopId: `SOP-${String((this.data.sops || []).length + 1).padStart(4, '0')}`,
          processTitle: data.processTitle,
          steps: JSON.stringify(stepLines),
          version: data.version || '1.0',
          lastUpdated: today,
        };
        if (!this.data.sops) this.data.sops = [];
        this.data.sops.push(newRecord);
        break;
      }
    }

    this.closeModal('add-modal');
    form.reset();
    this._addRecordTarget = null;

    // Map relational display names locally (so that names show in lists instantly!)
    sheetsService._denormalize(this.data);

    this.applyFilters();
    this.renderContent();
    this.showToast('Record added successfully!', 'success');

    // Write to Google Sheets in background (if connected)
    if (newRecord) {
      if (this.sheetsConnected) {
        const tabMap = {
          'linkedin': 'linkedinLeads',
          'prime': 'primePipeline',
          'scc': 'sccContent',
          'calmera': 'calmeraOrders',
          'tasks': 'tasks',
          'projects': 'projects',
          'clients': 'clients',
          'goals': 'goals',
          'habits': 'habits',
          'learning': 'learning',
          'notes': 'notes',
          'sops': 'sops',
        };
        const tabKey = tabMap[addTarget];
        if (tabKey) {
          this.updateTopbarSyncStatus('syncing');
          // Sequentially write Contact -> Organization -> Main Record to keep Sheets relational database clean
          const promises = [];
          if (newContact) promises.push(sheetsService.appendRecord('contacts', newContact));
          if (newOrg) promises.push(sheetsService.appendRecord('organizations', newOrg));

          Promise.all(promises)
            .then(() => {
              return sheetsService.appendRecord(tabKey, newRecord);
            })
            .then((res) => {
              if (res && res.rowsAfter !== undefined) {
                newRecord._rowIndex = res.rowsAfter - 1;
              }
              delete newRecord._syncStatus;
              delete newRecord._syncError;
              this.saveLocalData();
              this.updateTopbarSyncStatus('synced');
              this.showToast('📤 Saved to Google Sheets', 'success');
              this.render(); // update badges
            })
            .catch(err => {
              console.error('Sheet write failed:', err);
              const userErr = this.getFriendlyErrorMessage(err);
              newRecord._syncStatus = 'Pending Sync';
              newRecord._syncError = userErr;
              if (newContact) {
                newContact._syncStatus = 'Pending Sync';
                newContact._syncError = userErr;
              }
              if (newOrg) {
                newOrg._syncStatus = 'Pending Sync';
                newOrg._syncError = userErr;
              }
              this.saveLocalData();
              this.updateTopbarSyncStatus('error');
              this.showToast(`⚠️ Saved locally, but Sheet write failed: ${userErr}`, 'warning');
              this.render(); // update badges
            });
        }
      } else if (sheetsService.isConfigured()) {
        newRecord._syncStatus = 'Pending Sync';
        newRecord._syncError = 'Not connected to Google Sheets. Click retry in the details panel or check settings.';
        if (newContact) {
          newContact._syncStatus = 'Pending Sync';
          newContact._syncError = 'Not connected to Google Sheets.';
        }
        if (newOrg) {
          newOrg._syncStatus = 'Pending Sync';
          newOrg._syncError = 'Not connected to Google Sheets.';
        }
        this.saveLocalData();
        this.render();
      }
    }
  }

  // ── Lead Scoring ────────────────────────────────────────────
  calculateLeadScore(data) {
    let score = 30; // base

    // Interest signal
    if (data.interestSignal && data.interestSignal.length > 10) score += 20;

    // Priority
    if (data.priority === 'Critical') score += 25;
    else if (data.priority === 'High') score += 15;
    else if (data.priority === 'Normal') score += 5;

    // Company provided
    if (data.company) score += 10;

    // Role provided
    if (data.role) score += 10;

    // LinkedIn URL
    if (data.linkedinUrl) score += 5;

    return Math.min(score, 100);
  }

  // ── Task Toggle ─────────────────────────────────────────────
  toggleTask(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (task) {
      const firstStatus = this.taskColumns[0] || 'To Do';
      const lastStatus = this.taskColumns[this.taskColumns.length - 1] || 'Completed';
      const isCompleted = task.status === lastStatus;
      task.status = isCompleted ? firstStatus : lastStatus;
      task.completedAt = !isCompleted ? getDemoToday() : '';
      this.renderContent();
      this.showToast(
        !isCompleted ? 'Task completed! ✅' : 'Task reopened',
        !isCompleted ? 'success' : 'info'
      );
      if (this.sheetsConnected) {
        if (task._rowIndex !== undefined) {
          sheetsService.updateRecord('tasks', task._rowIndex, { status: task.status, completedAt: task.completedAt })
            .catch(err => {
              console.error('Failed to sync calendar task toggle:', err);
              task._syncStatus = 'Pending Sync';
              task._syncError = this.getFriendlyErrorMessage(err);
              this.saveLocalData();
              this.render();
            });
        } else {
          task._syncStatus = 'Pending Sync';
          task._syncError = 'Row index is undefined';
          this.saveLocalData();
          this.render();
        }
      }
    }
  }

  // ── Message Generator ───────────────────────────────────────
  openMessageGenerator() {
    const overlay = document.getElementById('msg-modal-overlay');
    const body    = document.getElementById('msg-modal-body');

    const streamMap = {
      linkedin: 'linkedin', prime: 'prime', scc: 'scc', calmera: 'calmera',
      'command-center': 'general', repurposing: 'general', messages: 'linkedin',
    };
    const stream    = streamMap[this.currentView] || 'general';
    const templates = MessageGenerator.getTemplates(stream);
    const categories = MessageGenerator.getCategories();

    body.innerHTML = `
      <div style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <span>Stream:</span>
          <select class="gos-form-select" style="width:auto" id="msg-category" onchange="app.switchMsgCategory(this.value)">
            ${categories.map(c => `<option value="${c}" ${c === stream ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:20px" id="msg-templates">
          ${templates.map(t => `
            <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius);padding:14px;cursor:pointer;transition:border-color 0.15s" 
                 onclick="app.selectTemplate('${t.id}')" data-template-id="${t.id}" 
                 onmouseover="this.style.borderColor='var(--accent)'" onmouseout="if(!this.classList.contains('selected'))this.style.borderColor='var(--border)'">
              <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:4px">${t.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${t.stage} · ${t.channel}</div>
            </div>
          `).join('')}
        </div>
        <div id="msg-preview" style="display:none">
          <div id="msg-preview-subject" style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px"></div>
          <div class="message-preview-text" id="msg-preview-body"></div>
        </div>
        <div id="msg-actions" style="display:none;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn-copy large" onclick="app.copyMessage()">📋 Copy to Clipboard</button>
          <button class="btn-secondary" onclick="app.closeModal('msg-modal')">Close</button>
        </div>
      </div>
    `;

    if (overlay) overlay.style.display = 'flex';
  }

  openMessageForRecord(viewType, id) {
    if (viewType === 'linkedin') {
      this._selectedMsgLeadId = id;
      this.navigateTo('messages');
      setTimeout(() => {
        this.handleMsgPageLeadChange(id);
        this._generateMessage();
      }, 100);
      return;
    }

    const dataMap = {
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
    };

    const config = dataMap[viewType];
    if (!config) { this.openMessageGenerator(); return; }

    const record = config.data.find(r => r[config.idKey] === id);
    this.selectedRecord = { viewType, record };
    this.openMessageGenerator();
  }

  switchMsgCategory(category) {
    const templates = MessageGenerator.getTemplates(category);
    const grid = document.getElementById('msg-templates');
    grid.innerHTML = templates.map(t => `
      <div class="gos-msg-template-card" onclick="app.selectTemplate('${t.id}')" data-template-id="${t.id}">
        <div class="gos-msg-template-name">${t.name}</div>
        <div class="gos-msg-template-stage">${t.stage} · ${t.channel}</div>
      </div>
    `).join('');

    document.getElementById('msg-preview').style.display = 'none';
    document.getElementById('msg-actions').style.display = 'none';
  }

  selectTemplate(templateId) {
    // Highlight selected
    document.querySelectorAll('.gos-msg-template-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.templateId === templateId);
    });

    const template = MessageGenerator.getTemplateById(templateId);
    if (!template) return;

    let result;
    if (this.selectedRecord?.record) {
      result = MessageGenerator.generatePreview(templateId, this.selectedRecord.record);
    } else {
      result = MessageGenerator.fillTemplate(template, {});
    }

    const preview = document.getElementById('msg-preview');
    const subject = document.getElementById('msg-preview-subject');
    const body = document.getElementById('msg-preview-body');
    const actions = document.getElementById('msg-actions');

    subject.textContent = result.subject || '(No subject — direct message)';
    // Highlight placeholders
    body.innerHTML = result.body.replace(/\[(\w+)\]/g, '<span class="placeholder">[$1]</span>');

    preview.style.display = 'block';
    actions.style.display = 'flex';

    this._currentMessage = result;
  }

  copyMessage() {
    if (!this._currentMessage) return;
    const text = (this._currentMessage.subject ? `Subject: ${this._currentMessage.subject}\n\n` : '') + this._currentMessage.body;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Message copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Failed to copy — check browser permissions', 'error');
    });
  }

  // ── Toast Notifications ─────────────────────────────────────
  showToast(message, type = 'info') {
    // 1. Log to notifications array
    const notif = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    if (!this.notifications) this.notifications = [];
    this.notifications.unshift(notif);
    if (this.notifications.length > 20) this.notifications.pop();
    localStorage.setItem('gos_notifications_log', JSON.stringify(this.notifications));
    this.updateNotificationsUI();

    // 2. Render small minimalist toast pill in top-right
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `gos-toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-text" title="${message}">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 150);
    }, 2800);
  }

  // ── Helpers ─────────────────────────────────────────────────
  isTaskCompleted(task) {
    if (!task) return false;
    const completedStatus = (this.taskColumns && this.taskColumns.length) ? this.taskColumns[this.taskColumns.length - 1] : 'Completed';
    return task.status === completedStatus;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    return num.toLocaleString();
  }

  // ── Google Sheets Connection ────────────────────────────────

  async connectSheets() {
    if (!sheetsService.isConfigured()) {
      this.showToast('⚠️ Add your Web App URL to sheets-config.js first. See the setup guide!', 'warning');
      return;
    }

    this.updateConnectionUI('loading');
    this.showToast('Connecting to Google Sheets...', 'info');

    try {
      // Test the connection
      const alive = await sheetsService.ping();
      if (!alive) {
        this.showToast('❌ Could not reach the Sheet API. Check your Web App URL.', 'error');
        this.updateConnectionUI('demo');
        this.loadLocalDataFallback();
        return;
      }

      sheetsService.signIn();

      // Load data from Sheets
      await this.refreshFromSheets();

    } catch (err) {
      console.error('Connection error:', err);
      this.showToast('Failed to connect: ' + (err.message || 'Unknown error'), 'error');
      this.updateConnectionUI('demo');
      this.loadLocalDataFallback();
    }
  }

  async refreshFromSheets() {
    if (!sheetsService.isSignedIn) {
      this.showToast('Not connected to Google Sheets.', 'warning');
      return;
    }

    this.updateConnectionUI('loading');

    try {
      const sheetsData = await sheetsService.readAllData();

      // Helper: only use Sheets data if it actually has rows.
      // If Sheets returns empty (tab missing or no rows), keep locally-saved data instead.
      const local = (() => {
        try {
          const raw = localStorage.getItem('gos_local_database');
          return raw ? JSON.parse(raw) : {};
        } catch(e) { return {}; }
      })();

      const mergeTab = (key, sheetsRows) => {
        if (sheetsRows && sheetsRows.length > 0) {
          return this.mergeLocalPendingRecords(key, sheetsRows);
        }
        // Sheets returned nothing — preserve locally-saved records to avoid data loss
        return local[key] || [];
      };

      this.data = {
        contacts:        mergeTab('contacts',        sheetsData.contacts || []),
        organizations:   mergeTab('organizations',   sheetsData.organizations || []),
        linkedinLeads:   mergeTab('linkedinLeads',   sheetsData.linkedinLeads || []),
        primePipeline:   mergeTab('primePipeline',   sheetsData.primePipeline || []),
        sccContent:      mergeTab('sccContent',      sheetsData.sccContent || []),
        calmeraOrders:   mergeTab('calmeraOrders',   sheetsData.calmeraOrders || []),
        sourceAssets:    mergeTab('sourceAssets',    sheetsData.sourceAssets || []),
        repurposeOutputs:mergeTab('repurposeOutputs',sheetsData.repurposeOutputs || []),
        interactions:    mergeTab('interactions',    sheetsData.interactions || []),
        tasks:           mergeTab('tasks',           sheetsData.tasks || []),
        projects:        mergeTab('projects',        sheetsData.projects || []),
        clients:         mergeTab('clients',         sheetsData.clients || []),
        areas:           mergeTab('areas',           sheetsData.areas || []),
        goals:           mergeTab('goals',           sheetsData.goals || []),
        habits:          mergeTab('habits',          sheetsData.habits || []),
        learning:        mergeTab('learning',        sheetsData.learning || []),
        notes:           mergeTab('notes',           sheetsData.notes || []),
        sops:            mergeTab('sops',            sheetsData.sops || []),
      };


      this.sheetsConnected = true;
      localStorage.setItem('gos_sheets_connected', 'true');
      this.applyFilters();
      this.render();
      this.updateConnectionUI('connected');
      this.updateNavBadge();
      this.showToast('✅ Data loaded from Google Sheets!', 'success');

    } catch (err) {
      console.error('Refresh error:', err);
      this.showToast('Failed to load data: ' + (err.message || 'Check sheet permissions'), 'error');
      this.updateConnectionUI('demo');
    }
  }

  disconnectSheets() {
    if (sheetsService.isSignedIn) {
      sheetsService.signOut();
    }
    this.sheetsConnected = false;
    localStorage.setItem('gos_sheets_connected', 'false');
    this.data = { ...DEMO_DATA };
    this.applyFilters();
    this.render();
    this.updateConnectionUI('demo');
    this.updateNavBadge();
    this.showToast('Disconnected — using demo data.', 'info');
  }

  updateConnectionUI(state) {
    const dot      = document.getElementById('conn-dot');
    const label    = document.getElementById('conn-label');
    const btnCon   = document.getElementById('btn-connect');
    const btnDis   = document.getElementById('btn-disconnect');
    const btnRef   = document.getElementById('btn-refresh');

    if (!dot) return;

    dot.className = `conn-dot ${state === 'connected' ? 'connected' : state === 'loading' ? 'loading' : ''}`;

    switch (state) {
      case 'connected':
        if (label)  label.textContent   = 'Google Sheets';
        if (btnCon) btnCon.style.display = 'none';
        if (btnDis) btnDis.style.display = 'block';
        if (btnRef) btnRef.style.display = 'block';
        break;
      case 'loading':
        if (label)  label.textContent   = 'Connecting…';
        if (btnCon) btnCon.style.display = 'none';
        if (btnDis) btnDis.style.display = 'none';
        if (btnRef) btnRef.style.display = 'none';
        break;
      default:
        if (label)  label.textContent   = 'Not Connected';
        if (btnCon) btnCon.style.display = 'block';
        if (btnDis) btnDis.style.display = 'none';
        if (btnRef) btnRef.style.display = 'none';
    }
  }

  updateNavBadge() {
    const tasks = this.data.tasks || [];
    const overdue = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled' && isOverdue(t.dueAt));
    const badge = document.getElementById('nav-badge-overdue');
    if (badge) {
      badge.textContent = overdue.length;
      badge.style.display = overdue.length === 0 ? 'none' : 'inline-flex';
    }
  }
  // ═══════════════════════════════════════════════════════════
  // ── NEW VIEWS ───────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  // ── Calendar View ───────────────────────────────────────────
  // ── Calendar View ───────────────────────────────────────────
  gatherCalendarEvents() {
    const leads = this.data.linkedinLeads || [];
    const pipe = this.data.primePipeline || [];
    const orders = this.data.calmeraOrders || [];
    const content = this.data.sccContent || [];
    const tasks = this.data.tasks || [];
    const today = getDemoToday();
    const events = [];

    // 1. Leads
    leads.forEach(l => {
      if (l.nextActionDate) {
        events.push({
          id: l.leadId,
          viewType: 'linkedin',
          date: l.nextActionDate,
          time: l.followUpTime || '10:00 AM', // dynamic lead time from master Leads registry
          name: l.contactName || l.fullName || 'Unknown Lead',
          type: l.stage === 'Call Booked' ? 'Call Booked' : 'Follow-up',
          category: 'consulting',
          priority: l.priority || 'Medium',
          status: l.stage || 'New',
          nextAction: l.nextAction || 'Follow up with lead',
          score: l.qualificationScore || 0,
          record: l
        });
      }
    });

    // 2. Pipeline (Opportunities)
    pipe.forEach(p => {
      if (p.nextActionDate) {
        let type = 'Sales Call';
        if (p.stage === 'Discovery') type = 'Discovery Call';
        else if (['Proposal Sent', 'Negotiation'].includes(p.stage)) type = 'Proposal Follow-up';
        
        events.push({
          id: p.opportunityId,
          viewType: 'prime',
          date: p.nextActionDate,
          time: '11:00 AM',
          name: p.contactName || p.opportunityId || 'Unknown Deal',
          type: type,
          category: 'consulting',
          priority: p.priority || 'Medium',
          status: p.stage || 'New Inquiry',
          nextAction: p.nextAction || 'Action item on deal',
          score: p.probabilityPercent || 0,
          record: p
        });
      }
    });

    // 3. Orders
    orders.forEach(o => {
      if (o.fulfillmentCutoff) {
        let type = 'Order Reconfirmation';
        if (['Escalated', 'Awaiting Response'].includes(o.reconfirmationStatus)) type = 'Customer Callback';

        events.push({
          id: o.orderId,
          viewType: 'calmera',
          date: o.fulfillmentCutoff,
          time: '04:00 PM',
          name: o.customerName || o.externalOrderRef || 'Unknown Order',
          type: type,
          category: 'productsOrders',
          priority: (o.orderStatus === 'At Risk' || o.reconfirmationStatus === 'Escalated') ? 'High' : 'Medium',
          status: o.reconfirmationStatus || 'Pending Contact',
          nextAction: o.itemsSummary || 'Confirm order items',
          score: 0,
          record: o
        });
      }
    });

    // 4. Content
    content.forEach(c => {
      if (c.plannedPublishAt) {
        events.push({
          id: c.contentId,
          viewType: 'scc',
          date: c.plannedPublishAt,
          time: '12:00 PM',
          name: c.title || 'Untitled Content',
          type: 'Content Task',
          category: 'brandCommunity',
          priority: c.priority || 'Medium',
          status: c.CTA || 'Idea',
          nextAction: c.contentPillar || 'Publish draft',
          score: 0,
          record: c
        });
      }
    });

    // 5. Tasks (Manual Events)
    tasks.forEach(t => {
      if (t.dueAt) {
        const parts = String(t.dueAt || '').split(/[ T]/);
        const date = parts[0] || '';
        let time = parts[1] || '09:00 AM';
        if (time && time.includes(':')) {
          time = time.slice(0, 5); // format as HH:MM
        }
        
        events.push({
          id: t.taskId,
          viewType: 'tasks',
          date: date,
          time: time,
          name: t.assignedTo || 'My Event',
          type: t.taskType || 'Manual Event',
          category: 'personalBrand',
          priority: t.priority || 'Medium',
          status: t.status || 'Open',
          nextAction: t.notes || 'Task to be completed',
          score: 0,
          record: t
        });
      }
    });

    return events;
  }

  isEventOverdue(ev) {
    const today = getDemoToday();
    const isBefore = ev.date < today;
    const completedStatus = this.taskColumns ? (this.taskColumns[this.taskColumns.length - 1] || 'Completed') : 'Completed';
    const isCompleted = ['Done', 'Completed', 'Confirmed', 'Closed', 'Won', completedStatus].includes(ev.status);
    return isBefore && !isCompleted;
  }

  filterAndSortEvents(events) {
    const today = getDemoToday();
    
    // Calculate date bounds
    const now = new Date();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(now.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    
    // Get start & end of week
    const currentDay = now.getDay(); // 0 is Sun, 6 is Sat
    const startOfWeekDate = new Date(now);
    startOfWeekDate.setDate(now.getDate() - currentDay);
    const endOfWeekDate = new Date(startOfWeekDate);
    endOfWeekDate.setDate(startOfWeekDate.getDate() + 6);
    
    const startOfWeek = startOfWeekDate.toISOString().slice(0, 10);
    const endOfWeek = endOfWeekDate.toISOString().slice(0, 10);
    
    let filtered = events.slice();

    // 1. Time-based filters (this._calFilter)
    if (this._calFilter === 'today') {
      filtered = filtered.filter(ev => ev.date === today);
    } else if (this._calFilter === 'tomorrow') {
      filtered = filtered.filter(ev => ev.date === tomorrow);
    } else if (this._calFilter === 'week') {
      filtered = filtered.filter(ev => ev.date >= startOfWeek && ev.date <= endOfWeek);
    } else if (this._calFilter === 'month') {
      filtered = filtered.filter(ev => ev.date.slice(0, 7) === today.slice(0, 7));
    } else if (this._calFilter === 'overdue') {
      filtered = filtered.filter(ev => this.isEventOverdue(ev));
    }

    // 2. Category filter — removed

    // 3. Event Type filter (this._calTypeFilter)
    if (this._calTypeFilter !== 'all') {
      if (this._calTypeFilter === 'followups') {
        filtered = filtered.filter(ev => ev.type === 'Follow-up');
      } else if (this._calTypeFilter === 'calls') {
        filtered = filtered.filter(ev => ev.type === 'Sales Call' || ev.type === 'Discovery Call');
      } else if (this._calTypeFilter === 'proposal') {
        filtered = filtered.filter(ev => ev.type === 'Proposal Follow-up');
      } else if (this._calTypeFilter === 'content') {
        filtered = filtered.filter(ev => ev.type === 'Content Task');
      } else if (this._calTypeFilter === 'orders') {
        filtered = filtered.filter(ev => ev.type === 'Order Reconfirmation' || ev.type === 'Customer Callback');
      }
    }

    // 4. Priority filter (this._calPriorityFilter)
    if (this._calPriorityFilter !== 'all') {
      filtered = filtered.filter(ev => (ev.priority || '').toLowerCase() === this._calPriorityFilter.toLowerCase());
    }

    // 5. Status filter (this._calStatusFilter)
    if (this._calStatusFilter !== 'all') {
      filtered = filtered.filter(ev => {
        const isDone = ['Done', 'Completed', 'Confirmed', 'Closed', 'Won'].includes(ev.status);
        if (this._calStatusFilter === 'completed') return isDone;
        if (this._calStatusFilter === 'open') return !isDone;
        return ev.status.toLowerCase() === this._calStatusFilter.toLowerCase();
      });
    }

    // Sort if in list mode
    if (this._calViewMode === 'list') {
      filtered.sort((a, b) => {
        let aVal = a[this._calSortKey] || '';
        let bVal = b[this._calSortKey] || '';
        
        if (this._calSortKey === 'priority') {
          const weights = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
          aVal = weights[a.priority] || 0;
          bVal = weights[b.priority] || 0;
        } else if (this._calSortKey === 'score') {
          aVal = a.score || 0;
          bVal = b.score || 0;
        }

        if (typeof aVal === 'number') {
          return this._calSortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return this._calSortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    } else {
      filtered.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    }

    return filtered;
  }

  renderCalendar(container) {
    const events = this.gatherCalendarEvents();
    const filtered = this.filterAndSortEvents(events);

    const viewSelector = `
      <div class="calendar-views-toolbar">
        <div class="view-preference-toggle">
          <button class="gos-btn ${this._calViewMode === 'calendar' ? 'active' : ''}" onclick="app._setCalViewMode('calendar')">📅 Calendar View</button>
          <button class="gos-btn ${this._calViewMode === 'list' ? 'active' : ''}" onclick="app._setCalViewMode('list')">📋 List View</button>
        </div>
      </div>
    `;

    const timeFilters = [
      { id: 'all', label: 'All Time' },
      { id: 'today', label: 'Today' },
      { id: 'tomorrow', label: 'Tomorrow' },
      { id: 'week', label: 'This Week' },
      { id: 'month', label: 'This Month' },
      { id: 'overdue', label: '⚠️ Overdue' }
    ];

    const typeFilters = [
      { id: 'all', label: 'All Event Types' },
      { id: 'followups', label: 'Follow-ups' },
      { id: 'calls', label: 'Calls' },
      { id: 'proposal', label: 'Proposal Follow-ups' },
      { id: 'content', label: 'Content Tasks' },
      { id: 'orders', label: 'Order Tasks' }
    ];

    const priFilters = [
      { id: 'all', label: 'All Priorities' },
      { id: 'High', label: 'High' },
      { id: 'Medium', label: 'Medium' },
      { id: 'Low', label: 'Low' }
    ];

    const statFilters = [
      { id: 'all', label: 'All Statuses' },
      { id: 'open', label: 'Open' },
      { id: 'completed', label: 'Completed' }
    ];

    const filtersHtml = `
      <div class="calendar-filters-row">
        <select class="topbar-filter" onchange="app._setCalFilter(this.value)">
          ${timeFilters.map(f => `<option value="${f.id}" ${this._calFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
        <select class="topbar-filter" onchange="app._setCalTypeFilter(this.value)">
          ${typeFilters.map(f => `<option value="${f.id}" ${this._calTypeFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
        <select class="topbar-filter" onchange="app._setCalPriorityFilter(this.value)">
          ${priFilters.map(f => `<option value="${f.id}" ${this._calPriorityFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
        <select class="topbar-filter" onchange="app._setCalStatusFilter(this.value)">
          ${statFilters.map(f => `<option value="${f.id}" ${this._calStatusFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
      </div>
    `;

    let contentHtml = '';
    if (this._calViewMode === 'calendar') {
      contentHtml = this.renderCalendarLayout(filtered);
    } else {
      contentHtml = this.renderListLayout(filtered);
    }

    container.innerHTML = `
      <div class="calendar-dashboard-wrap">
        ${viewSelector}
        ${filtersHtml}
        ${contentHtml}
      </div>
    `;
  }

  renderCalendarLayout(filtered) {
    const layout = this._calLayout || 'month';
    
    const layoutToggles = `
      <div class="calendar-layout-toolbar">
        <div class="layout-btn-group">
          <button class="gos-btn btn-sm ${layout === 'month' ? 'active' : ''}" onclick="app._setCalLayout('month')">Month</button>
          <button class="gos-btn btn-sm ${layout === 'week' ? 'active' : ''}" onclick="app._setCalLayout('week')">Week</button>
          <button class="gos-btn btn-sm ${layout === 'day' ? 'active' : ''}" onclick="app._setCalLayout('day')">Day</button>
        </div>
        <div class="calendar-nav-group">
          <button class="gos-btn btn-sm" onclick="app._navigateCalendar(-1)">◀ Prev</button>
          <button class="gos-btn btn-sm" onclick="app._navigateCalendar(0)">Today</button>
          <button class="gos-btn btn-sm" onclick="app._navigateCalendar(1)">Next ▶</button>
        </div>
        <div class="calendar-layout-title">${this.getCalendarLayoutTitle()}</div>
      </div>
    `;

    let gridHtml = '';
    if (layout === 'month') {
      gridHtml = this.renderMonthView(filtered);
    } else if (layout === 'week') {
      gridHtml = this.renderWeekView(filtered);
    } else {
      gridHtml = this.renderDayView(filtered);
    }

    return `
      <div class="calendar-view-container">
        ${layoutToggles}
        ${gridHtml}
      </div>
    `;
  }

  getCalendarLayoutTitle() {
    const layout = this._calLayout || 'month';
    const activeDate = this._calActiveDate;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    
    if (layout === 'month') {
      return `${months[activeDate.getMonth()]} ${activeDate.getFullYear()}`;
    } else if (layout === 'week') {
      const now = new Date(activeDate);
      const currentDay = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const sMonth = months[startOfWeek.getMonth()].slice(0,3);
      const eMonth = months[endOfWeek.getMonth()].slice(0,3);
      
      return `${sMonth} ${startOfWeek.getDate()} – ${eMonth} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    } else {
      return `${months[activeDate.getMonth()]} ${activeDate.getDate()}, ${activeDate.getFullYear()}`;
    }
  }

  renderMonthView(events) {
    const activeDate = this._calActiveDate;
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const todayStr = getDemoToday();
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headersHtml = headers.map(h => `<div class="cal-grid-header">${h}</div>`).join('');
    
    const cells = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push(`<div class="cal-grid-cell padding-cell">${prevMonthDays - i}</div>`);
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = dateStr === todayStr;
      
      const eventsListHtml = dayEvents.map(ev => {
        const isOverdue = this.isEventOverdue(ev);
        const catColor = settingsEngine.getCategory(ev.category)?.color || '#6366f1';
        return `
          <div class="cal-grid-event-pill ${isOverdue ? 'overdue' : ''}" 
               style="border-left: 3px solid ${catColor}"
               onclick="event.stopPropagation(); app.openRecordPanel('${ev.viewType}', '${ev.id}')"
               title="${ev.time} ${ev.name} (${ev.type})">
            <span class="event-pill-time">${ev.time.replace(':00','')}</span>
            <span class="event-pill-name">${ev.name}</span>
          </div>
        `;
      }).join('');
      
      cells.push(`
        <div class="cal-grid-cell ${isToday ? 'today' : ''}" onclick="app.showCellDetails('${dateStr}')">
          <span class="cell-day-num">${d}</span>
          <div class="cell-events-container">${eventsListHtml}</div>
        </div>
      `);
    }
    
    const totalCells = cells.length;
    const remaining = 42 - totalCells;
    for (let i = 1; i <= remaining; i++) {
      cells.push(`<div class="cal-grid-cell padding-cell">${i}</div>`);
    }
    
    return `
      <div class="calendar-month-grid">
        ${headersHtml}
        ${cells.join('')}
      </div>
    `;
  }

  showCellDetails(dateStr) {
    this._calActiveDate = new Date(dateStr);
    this._calLayout = 'day';
    localStorage.setItem('gos_calendar_layout_pref', 'day');
    this.renderContent();
  }

  renderWeekView(events) {
    const activeDate = this._calActiveDate;
    const currentDay = activeDate.getDay();
    const todayStr = getDemoToday();
    
    const startOfWeek = new Date(activeDate);
    startOfWeek.setDate(activeDate.getDate() - currentDay);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      weekDays.push(d);
    }
    
    const weekColumns = weekDays.map(date => {
      const dateStr = date.toISOString().slice(0, 10);
      const dayEvents = events.filter(e => e.date === dateStr);
      const isToday = dateStr === todayStr;
      
      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()];
      const formattedDate = `${dayName} ${date.getDate()}`;
      const eventsHtml = dayEvents.map(ev => this.renderEventMiniCard(ev)).join('');
      
      return `
        <div class="cal-week-column ${isToday ? 'today' : ''}" onclick="app.showCellDetails('${dateStr}')">
          <div class="cal-week-column-header">
            <span class="week-day-name">${formattedDate}</span>
            ${dayEvents.length > 0 ? `<span class="week-day-count">${dayEvents.length}</span>` : ''}
          </div>
          <div class="cal-week-events-list">
            ${eventsHtml || '<div class="cal-week-empty">No events</div>'}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="calendar-week-grid">
        ${weekColumns}
      </div>
    `;
  }

  renderDayView(events) {
    const activeDate = this._calActiveDate;
    const dateStr = activeDate.toISOString().slice(0, 10);
    const dayEvents = events.filter(e => e.date === dateStr);
    const eventsHtml = dayEvents.map(ev => this.renderEventBigCard(ev)).join('');
    
    return `
      <div class="calendar-day-view">
        <div class="day-view-header">Events for ${this.getCalendarLayoutTitle()}</div>
        <div class="day-events-list">
          ${eventsHtml || `
            <div class="gos-empty" style="padding: 40px;">
              <span class="gos-empty-icon">📅</span>
              <span class="gos-empty-title">No events scheduled for this day</span>
              <button class="btn-secondary btn-sm" style="margin-top:12px" onclick="app._navigateCalendar(0)">Back to Today</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  renderEventMiniCard(ev) {
    const isOverdue = this.isEventOverdue(ev);
    const catColor = settingsEngine.getCategory(ev.category)?.color || '#6366f1';
    return `
      <div class="cal-event-mini-card ${isOverdue ? 'overdue' : ''}" 
           style="border-left: 3px solid ${catColor}"
           onclick="event.stopPropagation(); app.openRecordPanel('${ev.viewType}', '${ev.id}')">
        <div class="mini-card-time">${isOverdue ? '⚠️ OVERDUE · ' : ''}${ev.time}</div>
        <div class="mini-card-name">${ev.name}</div>
        <div class="mini-card-type">${ev.type}</div>
      </div>
    `;
  }

  renderEventBigCard(ev) {
    const isOverdue = this.isEventOverdue(ev);
    const catColor = settingsEngine.getCategory(ev.category)?.color || '#6366f1';
    const catLabel = settingsEngine.getCategoryLabel(ev.category);
    const isDone = ['Done', 'Completed', 'Confirmed', 'Closed', 'Won'].includes(ev.status);
    
    const overdueLabel = isOverdue ? `<span class="overdue-tag">⚠️ OVERDUE</span>` : '';
    const priorityClass = ev.priority === 'Critical' ? 'critical' : ev.priority === 'High' ? 'high' : 'medium';
    
    return `
      <div class="cal-event-big-card ${isOverdue ? 'overdue' : ''}" style="border-left: 4px solid ${catColor}">
        <div class="big-card-header">
          <div class="big-card-time-type">
            <span class="big-card-time">⏰ ${ev.time}</span>
            <span class="big-card-type-tag" style="background:${catColor}33; color:${catColor}">${ev.type}</span>
            ${overdueLabel}
          </div>
          <span class="priority-badge ${priorityClass}">${ev.priority}</span>
        </div>
        <div class="big-card-body" onclick="app.openRecordPanel('${ev.viewType}', '${ev.id}')">
          <div class="big-card-lead-name">${ev.name}</div>
          <div class="big-card-meta-row">
            <span class="meta-label">Category:</span>
            <span class="meta-value">${catLabel}</span>
          </div>
          <div class="big-card-meta-row">
            <span class="meta-label">Status:</span>
            <span class="meta-value">${this.renderBadge(ev.status)}</span>
          </div>
          ${ev.nextAction ? `
            <div class="big-card-next-action">
              <strong>Next Action:</strong> ${ev.nextAction}
            </div>
          ` : ''}
        </div>
        <div class="big-card-actions">
          <button class="gos-btn btn-sm btn-ghost" onclick="app.openRecordPanel('${ev.viewType}', '${ev.id}')" style="min-height:44px;">👁️ View</button>
          <button class="gos-btn btn-sm btn-ghost" onclick="app.openMessageForRecord('${ev.viewType}', '${ev.id}')" style="min-height:44px;">💬 Msg</button>
          <button class="gos-btn btn-sm btn-ghost" onclick="app.copyMessageDirectly('${ev.viewType}', '${ev.id}')" style="min-height:44px;">📋 Copy</button>
          ${!isDone ? `
            <button class="gos-btn btn-sm btn-primary" onclick="app.markEventCompleted('${ev.viewType}', '${ev.id}')" style="min-height:44px;">✓ Done</button>
          ` : ''}
          <button class="gos-btn btn-sm btn-secondary" onclick="app.rescheduleEvent('${ev.viewType}', '${ev.id}')" style="min-height:44px;">📅 Reschedule</button>
        </div>
      </div>
    `;
  }

  renderListLayout(filtered) {
    if (filtered.length === 0) {
      return `
        <div class="gos-empty" style="padding: 40px;">
          <span class="gos-empty-icon">📋</span>
          <span class="gos-empty-title">No activities scheduled in List View</span>
          <span class="gos-empty-desc">Try resetting your filters or add activities.</span>
        </div>
      `;
    }

    const renderSortHeader = (key, label) => {
      const isSorted = this._calSortKey === key;
      const arrow = isSorted ? (this._calSortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th onclick="app._toggleCalSort('${key}')" class="sortable-header ${isSorted ? 'sorted' : ''}">${label}${arrow}</th>`;
    };

    const desktopTable = `
      <div class="list-view-desktop-table-container gos-table-wrap">
        <table class="gos-table">
          <thead>
            <tr>
              ${renderSortHeader('date', 'Date')}
              ${renderSortHeader('time', 'Time')}
              ${renderSortHeader('name', 'Lead / Contact')}
              ${renderSortHeader('category', 'Category')}
              ${renderSortHeader('type', 'Event Type')}
              ${renderSortHeader('priority', 'Priority')}
              ${renderSortHeader('status', 'Status')}
              ${renderSortHeader('nextAction', 'Next Action')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(ev => {
              const isOverdue = this.isEventOverdue(ev);
              const catColor = settingsEngine.getCategory(ev.category)?.color || '#6366f1';
              const catLabel = settingsEngine.getCategoryLabel(ev.category);
              const isDone = ['Done', 'Completed', 'Confirmed', 'Closed', 'Won'].includes(ev.status);
              
              return `
                <tr class="${isOverdue ? 'row-overdue' : ''}">
                  <td class="cell-date font-semibold">${isOverdue ? '⚠️ ' : ''}${ev.date}</td>
                  <td>${ev.time}</td>
                  <td class="cell-name clickable" onclick="app.openRecordPanel('${ev.viewType}', '${ev.id}')">${ev.name}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span class="category-color-dot" style="background:${catColor}; width:8px; height:8px;"></span>
                      <span>${catLabel}</span>
                    </div>
                  </td>
                  <td><span class="type-badge">${ev.type}</span></td>
                  <td><span class="priority-badge ${ev.priority.toLowerCase()}">${ev.priority}</span></td>
                  <td>${this.renderBadge(ev.status)}</td>
                  <td class="cell-next-action truncate" style="max-width: 180px;" title="${ev.nextAction}">${ev.nextAction}</td>
                  <td>
                    <div class="row-action-buttons" style="display:flex; gap:4px;">
                      <button class="gos-btn btn-sm btn-ghost" onclick="app.openRecordPanel('${ev.viewType}', '${ev.id}')" title="View Detail" style="min-height:36px; padding:4px 8px;">👁️</button>
                      <button class="gos-btn btn-sm btn-ghost" onclick="app.openMessageForRecord('${ev.viewType}', '${ev.id}')" title="Message" style="min-height:36px; padding:4px 8px;">💬</button>
                      <button class="gos-btn btn-sm btn-ghost" onclick="app.copyMessageDirectly('${ev.viewType}', '${ev.id}')" title="Copy Message" style="min-height:36px; padding:4px 8px;">📋</button>
                      ${!isDone ? `
                        <button class="gos-btn btn-sm btn-primary" onclick="app.markEventCompleted('${ev.viewType}', '${ev.id}')" title="Mark Done" style="min-height:36px; padding:4px 8px;">✓</button>
                      ` : ''}
                      <button class="gos-btn btn-sm btn-secondary" onclick="app.rescheduleEvent('${ev.viewType}', '${ev.id}')" title="Reschedule" style="min-height:36px; padding:4px 8px;">📅</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const mobileCards = `
      <div class="list-view-mobile-cards-container">
        ${filtered.map(ev => this.renderEventBigCard(ev)).join('')}
      </div>
    `;

    return `
      <div class="calendar-list-view-container">
        ${desktopTable}
        ${mobileCards}
      </div>
    `;
  }

  _setCalViewMode(mode) {
    this._calViewMode = mode;
    localStorage.setItem('gos_calendar_view_pref', mode);
    this.renderContent();
  }

  _setCalLayout(layout) {
    this._calLayout = layout;
    localStorage.setItem('gos_calendar_layout_pref', layout);
    this.renderContent();
  }

  _setCalFilter(f) {
    this._calFilter = f;
    this.renderContent();
  }

  _setCalTypeFilter(type) {
    this._calTypeFilter = type;
    this.renderContent();
  }



  _setCalPriorityFilter(pri) {
    this._calPriorityFilter = pri;
    this.renderContent();
  }

  _setCalStatusFilter(stat) {
    this._calStatusFilter = stat;
    this.renderContent();
  }

  _toggleCalSort(key) {
    if (this._calSortKey === key) {
      this._calSortDir = this._calSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._calSortKey = key;
      this._calSortDir = 'asc';
    }
    this.renderContent();
  }

  _navigateCalendar(dir) {
    const layout = this._calLayout || 'month';
    const activeDate = this._calActiveDate;
    
    if (dir === 0) {
      this._calActiveDate = new Date();
    } else if (layout === 'month') {
      this._calActiveDate.setMonth(activeDate.getMonth() + dir);
    } else if (layout === 'week') {
      this._calActiveDate.setDate(activeDate.getDate() + (dir * 7));
    } else if (layout === 'day') {
      this._calActiveDate.setDate(activeDate.getDate() + dir);
    }
    
    this.renderContent();
  }

  copyMessageDirectly(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
    };

    const config = dataMap[viewType];
    if (!config) {
      this.showToast('Templates not supported for manual tasks', 'warning');
      return;
    }

    const record = config.data.find(r => r[config.idKey] === id);
    if (!record) return;

    let stream = 'linkedin';
    if (viewType === 'prime') stream = 'prime';
    else if (viewType === 'calmera') stream = 'calmera';
    else if (viewType === 'scc') stream = 'scc';

    let msg = '';
    try {
      const templates = MessageGenerator.getTemplates(stream);
      const template = templates[0];
      if (template) {
        const name = record.contactName || record.fullName || record.customerName || '[Name]';
        const offer = record.serviceInterest || record.itemsSummary || '[Offer]';
        const result = MessageGenerator.fillTemplate(template, { name, company: offer, serviceInterest: offer });
        msg = result.body;
      }
    } catch (e) {
      console.warn(e);
    }

    if (!msg) {
      msg = `Hi ${record.contactName || 'there'}! Just checking in regarding ${record.nextAction || 'our next step'}. Let me know what you think!`;
    }

    navigator.clipboard.writeText(msg).then(() => {
      this.showToast('Message generated & copied directly! 📋', 'success');
    }).catch(() => {
      this.showToast('Copy failed — please copy manually', 'error');
    });
  }

  async syncLeadAndOpportunity(sourceType, sourceId) {
    const today = getDemoToday();
    if (sourceType === 'linkedin') {
      const lead = this.data.linkedinLeads.find(l => l.leadId === sourceId);
      if (!lead) return;
      
      const pipelineReadyStages = ['Qualified', 'Call Booked', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
      const isPipelineReady = pipelineReadyStages.includes(lead.stage);
      
      // Look for existing opportunity
      let opp = this.data.primePipeline.find(p => String(p.sourceLeadId) === String(lead.leadId) || String(p.leadId) === String(lead.leadId));
      
      if (isPipelineReady) {
        let isNew = false;
        if (!opp) {
          isNew = true;
          // Generate new opportunity ID
          const opps = this.data.primePipeline || [];
          let maxNum = 0;
          opps.forEach(o => {
            const match = String(o.opportunityId).match(/^(OPP|PO)-(\d+)$/);
            if (match) {
              const num = parseInt(match[2]);
              if (num > maxNum) maxNum = num;
            }
          });
          const oppId = `OPP-${String(maxNum + 1).padStart(4, '0')}`;
          
          opp = {
            opportunityId: oppId,
            sourceLeadId: lead.leadId,
            leadId: lead.leadId,
            ownerId: 'Gelo',
            budgetRange: '',
            timeline: '',
            discoveryDate: today,
            proposalDate: '',
            closeDate: '',
            outcomeReason: '',
            notes: lead.notes || ''
          };
          this.data.primePipeline.push(opp);
        }
        
        // Sync fields from lead to opp
        opp.contactName = lead.contactName || '';
        opp.contactId = lead.contactId || lead.contactName || '';
        opp.orgName = lead.company || '';
        opp.organizationId = lead.organizationId || '';
        opp.serviceInterest = lead.interestSignal || 'Services Inquiry';
        opp.mobile = lead.mobile || '';
        opp.email = lead.email || '';
        opp.source = lead.source || '';
        opp.profileUrl = lead.linkedinUrl || '';
        
        opp.stage = lead.stage;
        opp.estimatedValue = parseFloat(lead.projectedCloseAmount) || 0;
        opp.paymentStatus = lead.paymentStatus || 'Unpaid';
        
        // Map dealStatus
        if (lead.stage === 'Closed Won') {
          opp.dealStatus = 'Won';
          opp.closeDate = today;
          this.triggerLeadToClientConversion(lead);
        } else if (lead.stage === 'Closed Lost') {
          opp.dealStatus = 'Lost';
          opp.closeDate = today;
        } else {
          opp.dealStatus = 'Open';
        }
        
        // Map probability
        const probMap = {
          'Qualified': 20,
          'Call Booked': 40,
          'Proposal': 60,
          'Negotiation': 80,
          'Closed Won': 100,
          'Closed Lost': 0
        };
        opp.probabilityPercent = probMap[lead.stage] || 20;
        opp.weightedValue = Math.round(opp.estimatedValue * opp.probabilityPercent / 100);
        
        opp.nextAction = lead.nextAction || '';
        opp.nextActionDate = lead.nextActionDate || '';
        
        // Update lead converted fields
        lead.convertedToPipeline = 'Yes';
        lead.pipelineOpportunityId = opp.opportunityId;
        lead.convertedOpportunityId = opp.opportunityId;
        lead.pipelineStage = lead.stage;
        lead.dealStatus = opp.dealStatus;
        lead.paymentStatus = opp.paymentStatus;
        
        // Sync sheets
        if (this.sheetsConnected) {
          try {
            if (isNew) {
              await sheetsService.appendRecord('primePipeline', opp);
            } else {
              if (opp._rowIndex !== undefined) {
                await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
              } else {
                // If it was created locally but row index wasn't set, append it
                const res = await sheetsService.appendRecord('primePipeline', opp);
                opp._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
            }
            if (lead._rowIndex !== undefined) {
              await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
            } else {
              const res = await sheetsService.appendRecord('linkedinLeads', lead);
              lead._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
            }
            delete lead._syncStatus;
            delete lead._syncError;
            delete opp._syncStatus;
            delete opp._syncError;
            this.saveLocalData();
            this.showToast('📤 Lead & Pipeline Synced to Google Sheets!', 'success');
            this.syncStatus = 'Synced';
            this.syncError = null;
            this.lastSynced = new Date().toLocaleString();
            localStorage.setItem('gos_last_synced', this.lastSynced);
            this.updateTopbarSyncStatus('synced');
          } catch (err) {
            console.error('Failed to sync opportunity in syncLeadAndOpportunity:', err);
            const userErr = this.getFriendlyErrorMessage(err);
            lead._syncStatus = 'Pending Sync';
            lead._syncError = userErr;
            opp._syncStatus = 'Pending Sync';
            opp._syncError = userErr;
            this.saveLocalData();
            this.showToast(`⚠️ Sheet sync failed: ${userErr}`, 'warning');
            this.syncStatus = 'Error';
            this.syncError = userErr;
            this.updateTopbarSyncStatus('error');
          }
        }
      } else {
        // If lead stage is not pipeline ready, but opportunity exists, update opportunity status to Open/Lost
        if (opp) {
          opp.stage = lead.stage === 'Not Fit' ? 'Closed Lost' : lead.stage;
          opp.paymentStatus = lead.paymentStatus || 'Unpaid';
          if (lead.stage === 'Not Fit') {
            opp.dealStatus = 'Lost';
            opp.closeDate = today;
          }
          if (this.sheetsConnected) {
            try {
              if (opp._rowIndex !== undefined) {
                await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
              } else {
                const res = await sheetsService.appendRecord('primePipeline', opp);
                opp._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
              if (lead._rowIndex !== undefined) {
                await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              } else {
                const res = await sheetsService.appendRecord('linkedinLeads', lead);
                lead._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
              delete lead._syncStatus;
              delete lead._syncError;
              delete opp._syncStatus;
              delete opp._syncError;
              this.saveLocalData();
              this.showToast('📤 Lead & Pipeline Synced to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
              this.updateTopbarSyncStatus('synced');
            } catch(err) {
              console.error('Failed to sync opportunity in non-ready stage:', err);
              const userErr = this.getFriendlyErrorMessage(err);
              lead._syncStatus = 'Pending Sync';
              lead._syncError = userErr;
              opp._syncStatus = 'Pending Sync';
              opp._syncError = userErr;
              this.saveLocalData();
              this.showToast(`⚠️ Sheet sync failed: ${userErr}`, 'warning');
              this.syncStatus = 'Error';
              this.syncError = userErr;
              this.updateTopbarSyncStatus('error');
            }
          }
        } else {
          // If no opportunity exists, but sheets are connected, we must still update the lead record in Google Sheets!
          if (this.sheetsConnected) {
            try {
              if (lead._rowIndex !== undefined) {
                await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              } else {
                const res = await sheetsService.appendRecord('linkedinLeads', lead);
                lead._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
              delete lead._syncStatus;
              delete lead._syncError;
              this.saveLocalData();
              this.showToast('📤 Lead Saved to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
              this.updateTopbarSyncStatus('synced');
            } catch(err) {
              console.error('Failed to sync lead in basic stage:', err);
              const userErr = this.getFriendlyErrorMessage(err);
              lead._syncStatus = 'Pending Sync';
              lead._syncError = userErr;
              this.saveLocalData();
              this.showToast(`⚠️ Sheet sync failed: ${userErr}`, 'warning');
              this.syncStatus = 'Error';
              this.syncError = userErr;
              this.updateTopbarSyncStatus('error');
            }
          }
        }
      }
    } else if (sourceType === 'prime') {
      const opp = this.data.primePipeline.find(p => p.opportunityId === sourceId);
      if (!opp) return;
      
      const leadId = opp.sourceLeadId || opp.leadId;
      if (leadId) {
        const lead = this.data.linkedinLeads.find(l => l.leadId === leadId);
        if (lead) {
          // Sync fields from opp to lead
          lead.contactName = opp.contactName || '';
          lead.company = opp.orgName || '';
          lead.mobile = opp.mobile || '';
          lead.email = opp.email || '';
          lead.source = opp.source || '';
          lead.linkedinUrl = opp.profileUrl || '';
          
          lead.stage = opp.stage;
          lead.projectedCloseAmount = parseFloat(opp.estimatedValue) || 0;
          lead.paymentStatus = opp.paymentStatus || 'Unpaid';
          
          lead.nextAction = opp.nextAction || '';
          lead.nextActionDate = opp.nextActionDate || '';
          
          lead.convertedToPipeline = 'Yes';
          lead.pipelineOpportunityId = opp.opportunityId;
          lead.convertedOpportunityId = opp.opportunityId;
          lead.pipelineStage = opp.stage;
          lead.dealStatus = opp.dealStatus;
          
          if (this.sheetsConnected) {
            try {
              if (lead._rowIndex !== undefined) {
                await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              } else {
                const res = await sheetsService.appendRecord('linkedinLeads', lead);
                lead._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
              if (opp._rowIndex !== undefined) {
                await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
              } else {
                const res = await sheetsService.appendRecord('primePipeline', opp);
                opp._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
              }
              delete lead._syncStatus;
              delete lead._syncError;
              delete opp._syncStatus;
              delete opp._syncError;
              this.saveLocalData();
              this.showToast('📤 Lead & Pipeline Synced to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
              this.updateTopbarSyncStatus('synced');
            } catch (err) {
              console.error('Failed to sync lead in syncLeadAndOpportunity:', err);
              const userErr = this.getFriendlyErrorMessage(err);
              lead._syncStatus = 'Pending Sync';
              lead._syncError = userErr;
              opp._syncStatus = 'Pending Sync';
              opp._syncError = userErr;
              this.saveLocalData();
              this.showToast(`⚠️ Sheet sync failed: ${userErr}`, 'warning');
              this.syncStatus = 'Error';
              this.syncError = userErr;
              this.updateTopbarSyncStatus('error');
            }
          }
          return;
        }
      }

      // Fallback: If no connected lead (or lead not found), still save the opportunity itself to Google Sheets
      if (this.sheetsConnected) {
        try {
          if (opp._rowIndex !== undefined) {
            await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
          } else {
            const res = await sheetsService.appendRecord('primePipeline', opp);
            opp._rowIndex = res.rowIndex || (res.rowsAfter !== undefined ? res.rowsAfter - 1 : undefined);
          }
          delete opp._syncStatus;
          delete opp._syncError;
          this.saveLocalData();
          this.showToast('📤 Opportunity Saved to Google Sheets', 'success');
          this.syncStatus = 'Synced';
          this.syncError = null;
          this.lastSynced = new Date().toLocaleString();
          localStorage.setItem('gos_last_synced', this.lastSynced);
          this.updateTopbarSyncStatus('synced');
        } catch (err) {
          console.error('Failed to sync opportunity in syncLeadAndOpportunity:', err);
          const userErr = this.getFriendlyErrorMessage(err);
          opp._syncStatus = 'Pending Sync';
          opp._syncError = userErr;
          this.saveLocalData();
          this.showToast(`⚠️ Sheet sync failed: ${userErr}`, 'warning');
          this.syncStatus = 'Error';
          this.syncError = userErr;
          this.updateTopbarSyncStatus('error');
        }
      }
    }
  }

  async markEventCompleted(viewType, id) {
    let fields = {};
    if (viewType === 'linkedin') {
      fields = { nextAction: 'Completed', nextActionDate: '' };
    } else if (viewType === 'prime') {
      fields = { stage: 'Closed Won', nextAction: 'Completed', nextActionDate: '', dealStatus: 'Won' };
    } else if (viewType === 'calmera') {
      fields = { reconfirmationStatus: 'Confirmed' };
    } else if (viewType === 'tasks') {
      fields = { status: 'Completed', completedAt: getDemoToday() };
    } else if (viewType === 'scc') {
      fields = { CTA: 'Published' };
    }

    await this.updateRecordField(viewType, id, fields);
  }

  async rescheduleEvent(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId', dateKey: 'nextActionDate' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId', dateKey: 'nextActionDate' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId', dateKey: 'fulfillmentCutoff' },
      'scc': { data: this.data.sccContent, idKey: 'contentId', dateKey: 'plannedPublishAt' },
      'tasks': { data: this.data.tasks, idKey: 'taskId', dateKey: 'dueAt' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => r[config.idKey] === id);
    if (!record) return;

    const oldDate = record[config.dateKey] || '';
    const newDate = prompt(`Enter new date for this event (YYYY-MM-DD):`, oldDate);
    
    if (newDate === null) return;
    
    const dateTrim = newDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim.slice(0, 10))) {
      this.showToast('Invalid date format. Use YYYY-MM-DD.', 'warning');
      return;
    }

    const fields = {};
    fields[config.dateKey] = dateTrim;

    await this.updateRecordField(viewType, id, fields);
  }

  async updateRecordField(viewType, id, fields) {
    const dataMap = {
      'linkedin':    { data: this.data.linkedinLeads,    idKey: 'leadId',       tabKey: 'linkedinLeads' },
      'prime':       { data: this.data.primePipeline,    idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':         { data: this.data.sccContent,       idKey: 'contentId',     tabKey: 'sccContent' },
      'calmera':     { data: this.data.calmeraOrders,    idKey: 'orderId',       tabKey: 'calmeraOrders' },
      'tasks':       { data: this.data.tasks,            idKey: 'taskId',        tabKey: 'tasks' },
      'projects':    { data: this.data.projects,         idKey: 'projectId',     tabKey: 'projects' },
      'clients':     { data: this.data.clients,          idKey: 'clientId',      tabKey: 'clients' },
      'goals':       { data: this.data.goals,            idKey: 'goalId',        tabKey: 'goals' },
      'habits':      { data: this.data.habits,           idKey: 'habitId',       tabKey: 'habits' },
      'learning':    { data: this.data.learning,         idKey: 'learningId',    tabKey: 'learning' },
      'notes':       { data: this.data.notes,            idKey: 'noteId',        tabKey: 'notes' },
      'sops':        { data: this.data.sops,             idKey: 'sopId',         tabKey: 'sops' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId',      tabKey: 'repurposeOutputs' },
    };

    const config = dataMap[viewType];
    if (!config) return;

    const record = config.data.find(r => r[config.idKey] === id);
    if (!record) return;

    // Apply fields
    Object.assign(record, fields);

    // Bidirectional Sync for Leads and Pipeline
    if (viewType === 'linkedin' || viewType === 'prime') {
      await this.syncLeadAndOpportunity(viewType, id);
    } else {
      // Sync in background to Sheets if connected (standard)
      if (this.sheetsConnected) {
        const rowIndex = record._rowIndex;
        if (rowIndex !== undefined) {
          try {
            await sheetsService.updateRecord(config.tabKey, rowIndex, record);
            this.showToast('📤 Synced to Google Sheets', 'success');
            this.syncStatus = 'Synced';
            this.syncError = null;
          } catch (err) {
            console.error('Sheet update failed:', err);
            this.showToast('Saved locally, failed to sync to Sheets', 'warning');
            this.syncStatus = 'Error';
            this.syncError = err.message || err;
          }
        }
      }
    }

    // Refresh UI
    this.applyFilters();
    this.render();
    this.showToast('Updated successfully!', 'success');
  }

  // ── Messages Page ────────────────────────────────────────────
  renderMessagesPage(container) {
    const leads     = this.data.linkedinLeads || [];
    const toneOpts  = [
      { id:'warm',    label:'Warm Taglish',       desc:'Relatable, friendly, mix of Filipino warmth' },
      { id:'direct',  label:'Direct Professional', desc:'Straight to the point, executive style' },
      { id:'casual',  label:'Friendly Casual',     desc:'Conversational and light' },
      { id:'ceo',     label:'CEO / Founder Style', desc:'Confident, positioning-first' },
      { id:'comm',    label:'Community Style',     desc:'Inclusive, community-first language' },
    ];
    const typeOpts  = [
      { id:'connection',  label:'Connection Request'    },
      { id:'thank-you',   label:'Thank You Message'     },
      { id:'follow-up',   label:'Follow-up'             },
      { id:'call-invite', label:'Call Invite'           },
      { id:'no-reply',    label:'No-Reply Follow-up'    },
      { id:'proposal',    label:'Proposal Follow-up'    },
      { id:'referral',    label:'Referral Ask'          },
      { id:'reconfirm',   label:'Reconfirmation'        },
    ];

    const curTone = this._msgTone || 'warm';
    const curType = this._msgType || 'follow-up';
    const selectedLead = this._selectedMsgLeadId ? leads.find(l => l.leadId === this._selectedMsgLeadId) : null;

    container.innerHTML = `
      <div class="messages-layout">
        <div class="messages-form-panel">
          <div style="margin-bottom:16px">
            <label class="gos-form-label" style="margin-bottom:8px">Select Lead</label>
            <select class="gos-form-select" id="msg-page-lead-select" onchange="app.handleMsgPageLeadChange(this.value)">
              <option value="">-- Select a Lead --</option>
              ${leads.map(l => `<option value="${l.leadId}" ${this._selectedMsgLeadId === l.leadId ? 'selected' : ''}>${l.contactName || 'No Name'} (${l.leadId})</option>`).join('')}
            </select>
          </div>
          <div class="gos-form-group" style="display:none">
            <label class="gos-form-label">Lead Name</label>
            <input class="gos-form-input" id="msg-page-name" value="${selectedLead ? this._esc(selectedLead.contactName) : ''}">
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Company / Offer / Context</label>
            <input class="gos-form-input" id="msg-page-offer" value="${selectedLead ? this._esc(selectedLead.company || selectedLead.interestSignal || '') : ''}" placeholder="e.g. Consultation, Self Care Bundle">
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Stage</label>
            <select class="gos-form-select" id="msg-page-stage">
              <option ${selectedLead?.stage === 'New' ? 'selected' : ''}>New</option>
              <option ${selectedLead?.stage === 'Contacted' ? 'selected' : ''}>Contacted</option>
              <option ${selectedLead?.stage === 'Qualified' ? 'selected' : ''}>Qualified</option>
              <option ${selectedLead?.stage === 'Call Booked' ? 'selected' : ''}>Call Booked</option>
              <option ${selectedLead?.stage === 'Proposal' ? 'selected' : ''}>Proposal</option>
              <option ${selectedLead?.stage === 'Negotiation' ? 'selected' : ''}>Negotiation</option>
              <option ${selectedLead?.stage === 'Closed Won' ? 'selected' : ''}>Closed Won</option>
              <option ${selectedLead?.stage === 'Closed Lost' ? 'selected' : ''}>Closed Lost</option>
              <option ${selectedLead?.stage === 'Not Fit' ? 'selected' : ''}>Not Fit</option>
            </select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Platform</label>
            <select class="gos-form-select" id="msg-page-platform">
              <option ${selectedLead?.source === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
              <option ${selectedLead?.source === 'Instagram' ? 'selected' : ''}>Instagram</option>
              <option ${selectedLead?.source === 'Facebook' ? 'selected' : ''}>Facebook</option>
              <option ${['Messenger', 'WhatsApp', 'SMS', 'Email'].includes(selectedLead?.source) ? 'selected' : ''}>Messenger</option>
              <option>WhatsApp</option><option>SMS</option><option>Email</option>
            </select>
          </div>
          <div class="gos-form-label" style="margin-bottom:8px">Message Type</div>
          <div class="message-type-grid">
            ${typeOpts.map(t => `
              <button class="message-type-btn ${curType === t.id ? 'active' : ''}" 
                      onclick="app._setMsgType('${t.id}')">${t.label}</button>
            `).join('')}
          </div>
          <div class="gos-form-label" style="margin:8px 0">Tone</div>
          <div class="tone-selector">
            ${toneOpts.map(t => `
              <button class="tone-option ${curTone === t.id ? 'active' : ''}"
                      onclick="app._setMsgTone('${t.id}')">
                <strong>${t.label}</strong> — <span style="font-weight:400">${t.desc}</span>
              </button>
            `).join('')}
          </div>

          <!-- Next Follow-up Scheduler (Requirement 24) -->
          <div class="follow-up-scheduler" style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
            <div style="font-weight:600;font-size:13px;margin-bottom:12px;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
              <span>📅 Schedule Next Follow-up</span>
            </div>
            <div class="gos-form-group">
              <label class="gos-form-label">Next Action / Outreach Goal</label>
              <input class="gos-form-input" id="msg-next-action" value="${selectedLead ? this._esc(selectedLead.nextAction || '') : ''}" placeholder="e.g. Check reply, Share proposal, Book call">
            </div>
            <div class="gos-form-group">
              <label class="gos-form-label">Follow-up Date</label>
              <input class="gos-form-input" type="date" id="msg-followup-date" value="${selectedLead ? this._esc(selectedLead.nextActionDate || '') : ''}">
            </div>
          </div>

          <button class="btn-primary" style="width:100%;margin-top:16px" onclick="app._generateMessage()">✨ Generate Message</button>
        </div>
        <div class="messages-preview-panel">
          <div class="messages-panel-header">Message Preview</div>
          <div class="message-preview-body" id="msg-page-preview">
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">✉️</span>
              <span class="gos-empty-title">Fill in the form and generate a message</span>
              <span class="gos-empty-desc">Choose a type, tone, and click Generate.</span>
            </div>
          </div>
          <div class="message-actions" id="msg-page-actions" style="display:none">
            <button class="btn-copy large" onclick="app._copyPageMessage()">📋 Copy &amp; Schedule Follow-up</button>
            <button class="btn-secondary" onclick="app._generateMessage()">Regenerate</button>
          </div>
        </div>
      </div>
    `;
  }

  handleMsgPageLeadChange(leadId) {
    this._selectedMsgLeadId = leadId;
    const lead = this.data.linkedinLeads.find(l => l.leadId === leadId);
    if (lead) {
      const nameInput = document.getElementById('msg-page-name');
      if (nameInput) nameInput.value = lead.contactName || '';
      
      const offerInput = document.getElementById('msg-page-offer');
      if (offerInput) offerInput.value = lead.company || lead.interestSignal || '';
      
      const stageSelect = document.getElementById('msg-page-stage');
      if (stageSelect) stageSelect.value = lead.stage || 'New';
      
      const platformSelect = document.getElementById('msg-page-platform');
      if (platformSelect) {
        const platform = lead.source || 'LinkedIn';
        platformSelect.value = ['LinkedIn', 'Instagram', 'Facebook', 'Messenger', 'WhatsApp', 'SMS', 'Email'].includes(platform) ? platform : 'LinkedIn';
      }
      
      const nextActionInput = document.getElementById('msg-next-action');
      if (nextActionInput) nextActionInput.value = lead.nextAction || '';
      
      const nextActionDateInput = document.getElementById('msg-followup-date');
      if (nextActionDateInput) nextActionDateInput.value = lead.nextActionDate || '';
    }
  }

  _setMsgType(type) { this._msgType = type; this.renderContent(); }
  _setMsgTone(tone) { this._msgTone = tone; this.renderContent(); }

  _generateMessage() {
    const leadSelect = document.getElementById('msg-page-lead-select');
    const leadId = leadSelect?.value;
    const lead = leadId ? this.data.linkedinLeads.find(l => l.leadId === leadId) : null;

    const name     = document.getElementById('msg-page-name')?.value    || (lead ? lead.contactName : '') || '[Name]';
    const offer    = document.getElementById('msg-page-offer')?.value   || (lead ? lead.company : '') || '[Offer]';
    const stage    = document.getElementById('msg-page-stage')?.value   || 'New';
    const platform = document.getElementById('msg-page-platform')?.value|| 'LinkedIn';
    const type     = this._msgType || 'follow-up';
    const tone     = this._msgTone || 'warm';

    // Build a contextual message using MESSAGE_TEMPLATES if available
    let msg = '';
    try {
      const streamMap = { 'follow-up':'linkedin','call-invite':'linkedin','proposal':'prime','reconfirm':'calmera' };
      const stream    = streamMap[type] || 'linkedin';
      const templates = MessageGenerator.getTemplates(stream);
      const template  = templates[0];
      if (template) {
        const result = MessageGenerator.fillTemplate(template, { name, company: offer, serviceInterest: offer });
        msg = result.body;
      }
    } catch(e) {}

    if (!msg) {
      const toneMap = {
        warm:   `Hi ${name}! `,
        direct: `Hi ${name}, `,
        casual: `Hey ${name}! `,
        ceo:    `Hi ${name}, `,
        comm:   `Hi ${name}! `,
      };
      const typeMap = {
        'connection':  `I'd love to connect. I help people with ${offer}. Would love to have you in my network!`,
        'thank-you':   `Thank you so much for connecting! Excited to learn more about what you're working on.`,
        'follow-up':   `Just following up on our last conversation. I work with ${offer} and wanted to check if this could be a fit for you.`,
        'call-invite': `Would love to hop on a quick call to explore how ${offer} could help you. Are you free this week?`,
        'no-reply':    `Hi again! I know things get busy — just wanted to check if you had a chance to see my last message about ${offer}.`,
        'proposal':    `Following up on the proposal I sent. Happy to answer any questions or adjust based on your needs.`,
        'referral':    `Do you know anyone who might benefit from ${offer}? I'd appreciate any referrals!`,
        'reconfirm':   `Hi ${name}! Just confirming your order. Please let me know if anything has changed. Thank you!`,
      };
      msg = (toneMap[tone] || `Hi ${name}! `) + (typeMap[type] || 'How are you?');
    }

    this._pageMessage = msg;
    const prev = document.getElementById('msg-page-preview');
    const acts = document.getElementById('msg-page-actions');
    if (prev) prev.innerHTML = `<div class="message-preview-text" style="white-space:pre-wrap">${msg}</div>`;
    if (acts) acts.style.display = 'flex';
  }

  async _copyPageMessage() {
    if (!this._pageMessage) return;
    
    // Copy message to clipboard
    try {
      await navigator.clipboard.writeText(this._pageMessage);
      this.showToast('Message copied! 📋', 'success');
    } catch (err) {
      this.showToast('Copy failed — please copy manually', 'error');
    }

    // Schedule next follow-up and next action if configured
    const leadId = this._selectedMsgLeadId;
    const nextAction = document.getElementById('msg-next-action')?.value || '';
    const nextActionDate = document.getElementById('msg-followup-date')?.value || '';
    
    if (leadId && (nextAction || nextActionDate)) {
      const stage = document.getElementById('msg-page-stage')?.value;
      const fields = { nextAction, nextActionDate };
      if (stage) fields.stage = stage;
      
      await this.updateRecordField('linkedin', leadId, fields);
      this.showToast('📅 Next follow-up scheduled successfully!', 'success');
    }
  }

  // ── Settings Page ─────────────────────────────────────────────
  renderSettings(container) {
    const settings = settingsEngine.get();
    const tab      = this._settingsTab || 'workspace';

    const tabs = [
      { id:'workspace',  label:'Workspace' },
      { id:'profile',    label:'Profile'   },
      { id:'modules',    label:'Modules'   },
      { id:'sheets',     label:'Sheets'    },
      { id:'appearance', label:'Appearance'},
    ];

    container.innerHTML = `
      <div class="settings-layout">
        <div class="settings-tabs">
          ${tabs.map(t => `
            <button class="settings-tab ${tab === t.id ? 'active' : ''}" onclick="app._setSettingsTab('${t.id}')">
              ${t.label}
            </button>
          `).join('')}
        </div>

        <!-- Workspace -->
        <div class="settings-section ${tab === 'workspace' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Workspace Settings</div>
                <div class="settings-card-desc">Customize the name and subtitle of your Growth OS.</div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-group">
                <label class="gos-form-label">App Name</label>
                <input class="gos-form-input" id="set-appName" value="${this._esc(settings.appName)}" placeholder="e.g. Gelo Growth OS">
                <div class="gos-form-hint">Appears in the browser tab title.</div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Workspace Name</label>
                <input class="gos-form-input" id="set-workspaceName" value="${this._esc(settings.workspaceName)}" placeholder="e.g. Growth OS">
                <div class="gos-form-hint">Appears in the sidebar logo area.</div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Workspace Subtitle</label>
                <textarea class="gos-form-textarea" id="set-workspaceSubtitle" rows="2">${this._esc(settings.workspaceSubtitle)}</textarea>
                <div class="gos-form-hint">A short description of your workspace purpose.</div>
              </div>
              <button class="btn-primary" onclick="app._saveWorkspaceSettings()">Save Workspace</button>
            </div>
          </div>
        </div>

        <!-- Profile -->
        <div class="settings-section ${tab === 'profile' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Your Profile</div>
                <div class="settings-card-desc">How your name and role appear in the sidebar.</div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Display Name</label>
                  <input class="gos-form-input" id="set-displayName" value="${this._esc(settings.profile.displayName)}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Avatar Initials</label>
                  <input class="gos-form-input" id="set-avatarInitials" value="${this._esc(settings.profile.avatarInitials)}" maxlength="2" style="text-transform:uppercase">
                </div>
              </div>
              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Role / Title</label>
                  <input class="gos-form-input" id="set-role" value="${this._esc(settings.profile.role)}">
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Company</label>
                  <input class="gos-form-input" id="set-company" value="${this._esc(settings.profile.company)}">
                </div>
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Email</label>
                <input class="gos-form-input" type="email" id="set-email" value="${this._esc(settings.profile.email)}">
              </div>
              <div class="gos-form-group">
                <label class="gos-form-label">Main Focus</label>
                <input class="gos-form-input" id="set-mainFocus" value="${this._esc(settings.profile.mainFocus)}" placeholder="e.g. Sales, Content, and Growth">
              </div>
              <button class="btn-primary" onclick="app._saveProfileSettings()">Save Profile</button>
            </div>
          </div>
        </div>

        <!-- Modules -->
        <div class="settings-section ${tab === 'modules' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Modules</div>
                <div class="settings-card-desc">Rename modules. Changes update the sidebar and navigation instantly.</div>
              </div>
            </div>
            <div class="settings-card-body">
              ${settings.modules.map((mod, idx) => {
                const isCustom = ['leads', 'brandCommunity', 'productsOrders'].includes(mod.id);
                return `
                  <div class="module-item" style="${isCustom ? '' : 'opacity:0.85;'}">
                    <div class="module-item-icon" style="color:var(--primary);">${getIconSvg(MODULE_ICON_MAP[mod.id] || 'info', 20)}</div>
                    <div class="module-item-info">
                      <div class="module-item-name" style="display:flex;align-items:center;gap:8px;">
                        ${this._esc(mod.label)}
                        ${isCustom ? '' : '<span class="fixed-badge">Fixed</span>'}
                      </div>
                      ${mod.sheetTab ? `<div class="module-item-sheet">📊 ${mod.sheetTab}</div>` : '<div class="module-item-sheet text-muted">No sheet tab</div>'}
                    </div>
                    <div class="module-item-actions">
                      <input class="module-rename-input" id="mod-label-${idx}" value="${this._esc(mod.label)}" placeholder="Module name" ${isCustom ? '' : 'disabled'}>
                      ${mod.sheetTab ? `<input class="module-rename-input" id="mod-tab-${idx}" value="${this._esc(mod.sheetTab)}" placeholder="Sheet tab name" style="width:120px" ${isCustom ? '' : 'disabled'}>` : ''}
                      <label class="toggle-switch" title="Show/hide this module">
                        <input type="checkbox" ${mod.visible ? 'checked' : ''} onchange="app._toggleModuleVisible(${idx}, this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                `;
              }).join('')}
              <div style="margin-top:16px">
                <button class="btn-primary" onclick="app._saveModuleSettings()">Save Module Names</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sheets -->
        <div class="settings-section ${tab === 'sheets' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Google Sheets Connection</div>
                <div class="settings-card-desc">Status: <span class="conn-status-pill ${this.sheetsConnected ? 'connected' : 'disconnected'}">${this.sheetsConnected ? '✅ Connected' : '❌ Not Connected'}</span></div>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-group">
                <label class="gos-form-label">Apps Script Web App URL</label>
                <input class="gos-form-input" id="set-webAppUrl" value="${this._esc(settings.sheets.webAppUrl || SHEETS_CONFIG.WEBAPP_URL || '')}" placeholder="https://script.google.com/macros/s/...">
                <div class="gos-form-hint">Deploy your sheet-api.gs as a Web App and paste the URL here.</div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
                <button class="btn-primary" onclick="app._saveAndTestSheets()">Save &amp; Test Connection</button>
                ${this.sheetsConnected ? '<button class="btn-secondary" onclick="app.refreshFromSheets()">↻ Sync Now</button>' : ''}
                ${this.sheetsConnected ? '<button class="btn-danger btn-sm" onclick="app.disconnectSheets()">Disconnect</button>' : ''}
              </div>

              <!-- Premium Sync Diagnostic Panel -->
              <div class="sync-diagnostic-panel" style="margin-top:20px;margin-bottom:24px;background:var(--surface-alt);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                  <span>📡 Sync Diagnostics &amp; Connection Health</span>
                </div>
                
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
                  <div style="background:var(--bg-surface);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border)">
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Sync Status</div>
                    <div style="font-weight:600;font-size:13px;margin-top:4px;color:${this.syncStatus === 'Synced' ? 'var(--green)' : this.syncStatus === 'Connecting' ? 'var(--blue)' : 'var(--red)'}">
                      ${this.syncStatus === 'Synced' ? '🟢 Synced' : this.syncStatus === 'Connecting' ? '🔵 Syncing…' : '🔴 Connection Error'}
                    </div>
                  </div>
                  <div style="background:var(--bg-surface);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border)">
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Last Synced</div>
                    <div style="font-weight:600;font-size:13px;margin-top:4px;color:var(--text-primary)">
                      ${this.lastSynced}
                    </div>
                  </div>
                  <div style="background:var(--bg-surface);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--border)">
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">API Endpoint</div>
                    <div style="font-weight:600;font-size:11px;margin-top:4px;color:var(--text-secondary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap" title="${settings.sheets.webAppUrl || SHEETS_CONFIG.WEBAPP_URL || 'None'}">
                      ${(settings.sheets.webAppUrl || SHEETS_CONFIG.WEBAPP_URL || 'None').slice(0, 18)}…
                    </div>
                  </div>
                </div>

                ${this.syncError ? `
                  <div style="background:rgba(239,68,68,0.1);border:1px solid var(--red);color:var(--red);border-radius:var(--radius-sm);padding:12px;font-size:12px;line-height:1.6;margin-bottom:16px;">
                    <strong style="display:block;margin-bottom:4px">⚠️ Sync Error Logged:</strong>
                    ${this.syncError}
                  </div>
                ` : ''}

                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button class="gos-btn btn-sm btn-ghost" onclick="app.refreshFromSheets()" ${this.syncStatus === 'Connecting' ? 'disabled' : ''}>
                    🔄 Retry Sync
                  </button>
                  <button class="gos-btn btn-sm btn-ghost" onclick="app.validateSheetStructure()">
                    🔍 Validate Sheet Structure
                  </button>
                  <button class="gos-btn btn-sm btn-ghost" onclick="app.toggleDiagnosticDetails()">
                    👁️ View Details
                  </button>
                </div>

                <div id="diagnostic-details-panel" style="display:none;margin-top:16px;padding-top:16px;border-top:1px dashed var(--border);font-size:12px;color:var(--text-secondary);line-height:1.6;">
                  <div style="font-weight:600;margin-bottom:6px;color:var(--text-primary)">Active Schema Column Configurations:</div>
                  <ul style="padding-left:16px;margin:0 0 12px 0;">
                    <li><strong>Leads master:</strong> Table maps 10 columns (Name, Company, Mobile, Email, Source, URL, Stage, Next Action, Date, Amount)</li>
                    <li><strong>Bidirectional progression:</strong> Set stage to Qualified, Call Booked, Proposal, Negotiation, Closed Won, Closed Lost to sync instantly.</li>
                    <li><strong>Unique Lead ID validation:</strong> Safeguards database rows by auto-generating LL-XXXX identifiers.</li>
                  </ul>
                  <div style="color:var(--text-muted)">CRM Sync Version: v2.7 (Bidirectional Production Grade)</div>
                </div>
              </div>

              <div class="gos-form-label" style="margin-bottom:12px">Sheet Tab Mappings</div>
              ${Object.entries(settings.sheets.tabMappings).map(([modId, tabName]) => {
                const isCustom = ['leads', 'brandCommunity', 'productsOrders'].includes(modId);
                return `
                  <div class="sheet-mapping-row" style="margin-bottom:12px;${isCustom ? '' : 'opacity:0.85;'}">
                    <div class="sheet-mapping-label" style="display:flex;align-items:center;gap:8px;font-weight:600;min-width:180px;">
                      ${settingsEngine.getModuleLabel(modId) || modId}
                      ${isCustom ? '' : '<span class="fixed-badge">Fixed</span>'}
                    </div>
                    <input class="gos-form-input" id="tab-${modId}" value="${this._esc(tabName)}" placeholder="Tab name in Google Sheets" ${isCustom ? '' : 'disabled'}>
                  </div>
                `;
              }).join('')}
              <button class="btn-secondary" style="margin-top:12px" onclick="app._saveTabMappings()">Save Tab Names</button>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div class="settings-section ${tab === 'appearance' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-title">Appearance</div>
            </div>
            <div class="settings-card-body">
              <div class="gos-form-label" style="margin-bottom:12px">Theme</div>
              <div class="theme-options">
                <div class="theme-option ${settings.appearance.theme === 'dark' ? 'active' : ''}" onclick="app._setTheme('dark')">
                  <div class="theme-option-preview dark-preview"></div>
                  <div class="theme-option-label">Dark Mode</div>
                  <div class="theme-option-desc">Premium dark navy — easy on the eyes</div>
                </div>
                <div class="theme-option ${settings.appearance.theme === 'light' ? 'active' : ''}" onclick="app._setTheme('light')">
                  <div class="theme-option-preview light-preview"></div>
                  <div class="theme-option-label">Light Mode</div>
                  <div class="theme-option-desc">Clean white — great for daytime use</div>
                </div>
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-header">
              <div class="settings-card-title">⚠️ Reset Settings</div>
            </div>
            <div class="settings-card-body">
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Reset all workspace settings back to defaults. Your Google Sheets data will NOT be affected.</p>
              <button class="btn-danger" onclick="app._resetSettings()">Reset All Settings</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _setSettingsTab(tab) { this._settingsTab = tab; this.renderContent(); }
  _setTheme(t) { settingsEngine.applyTheme(t); this.showToast(`Switched to ${t} mode`, 'success'); this.renderContent(); }

  _esc(str) { return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  _saveWorkspaceSettings() {
    const settings = settingsEngine.get();
    settings.appName           = document.getElementById('set-appName')?.value           || settings.appName;
    settings.workspaceName     = document.getElementById('set-workspaceName')?.value     || settings.workspaceName;
    settings.workspaceSubtitle = document.getElementById('set-workspaceSubtitle')?.value || settings.workspaceSubtitle;
    settingsEngine.save(settings);
    this.updateAppName();
    document.getElementById('page-title').textContent = settings.appName;
    this.showToast('Workspace settings saved!', 'success');
  }

  _saveProfileSettings() {
    const settings = settingsEngine.get();
    settings.profile.displayName    = document.getElementById('set-displayName')?.value    || settings.profile.displayName;
    settings.profile.avatarInitials = document.getElementById('set-avatarInitials')?.value || settings.profile.avatarInitials;
    settings.profile.role           = document.getElementById('set-role')?.value           || settings.profile.role;
    settings.profile.company        = document.getElementById('set-company')?.value        || settings.profile.company;
    settings.profile.email          = document.getElementById('set-email')?.value          || '';
    settings.profile.mainFocus      = document.getElementById('set-mainFocus')?.value      || settings.profile.mainFocus;
    settingsEngine.save(settings);
    this.updateSidebarProfile();
    this.showToast('Profile saved!', 'success');
  }

  async _saveModuleSettings() {
    const settings = settingsEngine.get();
    const customizableIds = ['leads', 'brandCommunity', 'productsOrders'];
    const promises = [];
    
    for (let idx = 0; idx < settings.modules.length; idx++) {
      const mod = settings.modules[idx];
      if (!customizableIds.includes(mod.id)) continue;
      
      const labelEl = document.getElementById(`mod-label-${idx}`);
      const tabEl   = document.getElementById(`mod-tab-${idx}`);
      
      if (labelEl && labelEl.value.trim()) {
        mod.label = labelEl.value.trim();
      }
      
      if (tabEl && tabEl.value.trim()) {
        const newTab = tabEl.value.trim();
        const oldTab = settings.sheets.tabMappings[mod.id] || mod.sheetTab;
        
        if (newTab !== oldTab) {
          if (this.sheetsConnected && oldTab) {
            promises.push(
              sheetsService.renameTab(oldTab, newTab)
                .then(() => {
                  this.showToast(`🏷️ Renamed Google Sheets tab "${oldTab}" to "${newTab}"`, 'success');
                })
                .catch(err => {
                  console.error('Failed to rename Google Sheets tab:', err);
                  this.showToast(`⚠️ Could not rename Google Sheet tab "${oldTab}". Please rename it manually!`, 'warning');
                })
            );
          }
          mod.sheetTab = newTab;
          if (settings.sheets.tabMappings[mod.id] !== undefined) {
            settings.sheets.tabMappings[mod.id] = newTab;
          }
        }
      }
    }
    
    settingsEngine.save(settings);
    this.buildNavigation();
    this.updateTopbar();
    this.showToast('Module settings saved locally!', 'success');
    
    if (promises.length > 0) {
      this.showToast('🔄 Renaming Google Sheet tabs in background...', 'info');
      await Promise.all(promises);
    }
    
    this.renderContent();
  }


  _toggleModuleVisible(idx, visible) {
    const settings = settingsEngine.get();
    if (settings.modules[idx]) settings.modules[idx].visible = visible;
    settingsEngine.save(settings);
    this.buildNavigation();
  }

  async _saveAndTestSheets() {
    const settings   = settingsEngine.get();
    const url        = document.getElementById('set-webAppUrl')?.value.trim();
    if (!url) { this.showToast('Please enter a Web App URL', 'warning'); return; }
    settings.sheets.webAppUrl = url;
    settingsEngine.save(settings);
    // Update SHEETS_CONFIG too
    if (typeof SHEETS_CONFIG !== 'undefined') SHEETS_CONFIG.WEBAPP_URL = url;
    this.showToast('URL saved. Testing connection…', 'info');
    await this.connectSheets();
    this.renderContent();
  }

  async _saveTabMappings() {
    const settings = settingsEngine.get();
    const customizableIds = ['leads', 'brandCommunity', 'productsOrders'];
    const promises = [];
    
    Object.keys(settings.sheets.tabMappings).forEach(modId => {
      if (!customizableIds.includes(modId)) return;
      const el = document.getElementById(`tab-${modId}`);
      if (el && el.value.trim()) {
        const newTab = el.value.trim();
        const oldTab = settings.sheets.tabMappings[modId];
        
        if (newTab !== oldTab) {
          if (this.sheetsConnected && oldTab) {
            promises.push(
              sheetsService.renameTab(oldTab, newTab)
                .then(() => {
                  this.showToast(`🏷️ Renamed Google Sheets tab "${oldTab}" to "${newTab}"`, 'success');
                })
                .catch(err => {
                  console.error('Failed to rename Google Sheets tab:', err);
                  this.showToast(`⚠️ Could not rename Google Sheet tab "${oldTab}". Please rename it manually!`, 'warning');
                })
            );
          }
          settings.sheets.tabMappings[modId] = newTab;
          const mod = settings.modules.find(m => m.id === modId);
          if (mod) {
            mod.sheetTab = newTab;
          }
        }
      }
    });
    
    settingsEngine.save(settings);
    this.showToast('Tab mappings saved locally!', 'success');
    
    if (promises.length > 0) {
      this.showToast('🔄 Renaming Google Sheet tabs in background...', 'info');
      await Promise.all(promises);
    }
    
    this.renderContent();
  }


  _resetSettings() {
    this.showConfirm(
      'Reset All Settings',
      'This will reset all workspace settings (names, modules, categories, theme) to defaults. Your Google Sheets data will NOT be affected.',
      '🔄 Reset',
      () => {
        settingsEngine.reset();
        settingsEngine.applyTheme();
        this.buildNavigation();
        this.updateSidebarProfile();
        this.updateAppName();
        this.renderContent();
        this.showToast('Settings reset to defaults.', 'info');
      }
    );
  }

  toggleDiagnosticDetails() {
    const el = document.getElementById('diagnostic-details-panel');
    if (el) {
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
  }

  async validateSheetStructure() {
    this.showToast('🔍 Validating spreadsheet structure...', 'info');
    if (!sheetsService.isConfigured()) {
      this.showToast('❌ Sheet API is not configured. Add Web App URL.', 'error');
      return;
    }
    
    try {
      const active = await sheetsService.ping();
      if (!active) {
        this.showToast('❌ Could not reach sheet server. Ping failed.', 'error');
        return;
      }
      
      const sheetsData = await sheetsService.readAllData();
      const tabMappings = settingsEngine.get().sheets.tabMappings;
      const verified = [];
      const missing = [];
      
      for (const [modId, tabName] of Object.entries(tabMappings)) {
        const jsKey = resolveTabToJsKey(tabName);
        if (sheetsData[jsKey]) {
          verified.push(tabName);
        } else {
          missing.push(tabName);
        }
      }
      
      if (missing.length === 0) {
        this.showToast('✅ Structure validated successfully! All mapped tabs verified.', 'success');
        this.syncStatus = 'Synced';
        this.syncError = null;
        this.renderContent();
      } else {
        const err = `Missing sheet tabs: ${missing.join(', ')}`;
        this.showToast(`⚠️ Structure validation error: ${err}`, 'warning');
        this.syncStatus = 'Error';
        this.syncError = err;
        this.renderContent();
      }
    } catch(err) {
      this.showToast(`❌ Structure validation failed: ${err.message || err}`, 'error');
      this.syncStatus = 'Error';
      this.syncError = err.message || err;
      this.renderContent();
    }
  }

  // ── My Day View & Priorities ───────────────────────────────
  renderMyDay(container) {
    const todayStr = getDemoToday();
    const tasks = (this.data.tasks || []).filter(t => t.dueAt === todayStr || (t.dueAt < todayStr && t.status !== 'Completed'));
    const leads = (this.data.linkedinLeads || []).filter(l => l.nextActionDate === todayStr && !['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage));

    let dailyFocus = ['','',''];
    try {
      const saved = localStorage.getItem('gos_daily_focus');
      if (saved) dailyFocus = JSON.parse(saved);
    } catch(e){}

    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">🎯 Daily Focus Priorities (Top 3)</span>
        </div>
        <div class="gos-section-card-body">
          <div class="daily-focus-row">
            <input class="daily-focus-input" id="focus-0" value="${this._esc(dailyFocus[0])}" placeholder="Priority 1..." onchange="app.saveDailyFocus(0, this.value)">
            <input class="daily-focus-input" id="focus-1" value="${this._esc(dailyFocus[1])}" placeholder="Priority 2..." onchange="app.saveDailyFocus(1, this.value)">
            <input class="daily-focus-input" id="focus-2" value="${this._esc(dailyFocus[2])}" placeholder="Priority 3..." onchange="app.saveDailyFocus(2, this.value)">
          </div>
        </div>
      </div>

      <div class="gos-section-card" style="margin-top:20px">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">📝 Today's Agenda & Checklist</span>
          <button class="btn-primary btn-sm" onclick="app.openAddTaskModal('my-day')">+ Add Task</button>
        </div>
        <div class="gos-section-card-body" style="padding:0">
          ${tasks.length === 0 && leads.length === 0 ? `
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">☕</span>
              <span class="gos-empty-title">All tasks completed for today!</span>
              <span class="gos-empty-desc">Enjoy your day or capture ideas in the Inbox.</span>
            </div>
          ` : `
            <ul class="gos-task-list">
              ${tasks.map(t => `
                <li class="gos-task-item ${this.isTaskCompleted(t) ? 'completed' : ''}">
                  <input type="checkbox" class="gos-task-checkbox" ${this.isTaskCompleted(t) ? 'checked' : ''} onchange="app.toggleTaskStatus('${t.taskId}')">
                  <div class="gos-task-info" onclick="app.openTaskPanel('${t.taskId}')" style="flex:1">
                    <span class="gos-task-title">${this._esc(t.title)}</span>
                    <div class="gos-task-meta">
                      <span class="${t.dueAt < todayStr ? 'text-red font-bold' : ''}">Due ${t.dueAt}</span>
                      ${this.renderBadge(t.priority)}
                    </div>
                  </div>
                </li>
              `).join('')}
              ${leads.map(l => `
                <li class="gos-task-item outreach-due">
                  <span class="task-badge-icon">📞</span>
                  <div class="gos-task-info" onclick="app.openRecordPanel('linkedin', '${l.leadId}')" style="flex:1">
                    <span class="gos-task-title">Follow-up: ${this._esc(l.contactName)}</span>
                    <div class="gos-task-meta">
                      <span>Outreach Scheduled Today</span>
                      ${this.renderBadge(l.priority)}
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>
    `;
  }

  saveDailyFocus(idx, val) {
    let dailyFocus = ['','',''];
    try {
      const saved = localStorage.getItem('gos_daily_focus');
      if (saved) dailyFocus = JSON.parse(saved);
    } catch(e){}
    dailyFocus[idx] = val;
    localStorage.setItem('gos_daily_focus', JSON.stringify(dailyFocus));
    this.showToast('Daily priorities updated!', 'success');
  }

  // ── Inbox (Quick Capture) View ──────────────────────────────
  renderInbox(container) {
    const inboxItems = (this.data.tasks || []).filter(t => t.status === 'Inbox');
    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">📥 Quick Capture</span>
        </div>
        <div class="gos-section-card-body">
          <div class="quick-capture-container">
            <input class="quick-capture-input" id="inbox-quick-capture-input" placeholder="Type a task, project idea, or note to capture instantly..." onkeydown="if(event.key==='Enter') app.quickCaptureInbox()">
            <button class="quick-capture-btn" onclick="app.quickCaptureInbox()">Capture</button>
          </div>
        </div>
      </div>

      <div class="gos-section-card" style="margin-top:20px">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">Items in Inbox</span>
          <span class="gos-table-count">${inboxItems.length} items</span>
        </div>
        <div class="gos-section-card-body" style="padding:0">
          ${inboxItems.length === 0 ? `
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">🍃</span>
              <span class="gos-empty-title">Inbox is clear!</span>
              <span class="gos-empty-desc">Your capture queue is clean.</span>
            </div>
          ` : `
            <ul class="gos-task-list">
              ${inboxItems.map(t => `
                <li class="gos-task-item">
                  <div class="gos-task-info" style="flex:1">
                    <span class="gos-task-title" style="font-weight:600">${this._esc(t.title)}</span>
                    <div class="gos-task-meta">Captured ${t.createdAt || getDemoToday()}</div>
                  </div>
                  <div style="display:flex; gap:8px">
                    <button class="btn-secondary btn-sm" onclick="app.convertInboxItem('${t.taskId}', 'task')">Task</button>
                    <button class="btn-secondary btn-sm" onclick="app.convertInboxItem('${t.taskId}', 'project')">Project</button>
                    <button class="btn-secondary btn-sm" onclick="app.convertInboxItem('${t.taskId}', 'note')">Note</button>
                    <button class="btn-danger btn-sm" onclick="app.deleteTask('${t.taskId}')">✕</button>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>
    `;
  }

  quickCaptureInbox() {
    const input = document.getElementById('inbox-quick-capture-input');
    if (!input || !input.value.trim()) return;
    const title = input.value.trim();
    const today = getDemoToday();
    const newTask = {
      taskId: `T-${String((this.data.tasks || []).length + 1).padStart(4, '0')}`,
      title,
      status: 'Inbox',
      priority: 'Normal',
      dueAt: today,
      createdAt: today,
      areaId: '',
      projectId: '',
      clientId: '',
      notes: ''
    };
    if (!this.data.tasks) this.data.tasks = [];
    this.data.tasks.push(newTask);
    input.value = '';
    this.showToast('Captured in Inbox!', 'success');
    this.render();
  }

  convertInboxItem(taskId, type) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (!task) return;
    if (type === 'task') {
      task.status = this.taskColumns[0] || 'To Do';
      this.showToast(`Converted inbox item to ${task.status} Task!`, 'success');
      this.render();
      if (this.sheetsConnected) {
        if (task._rowIndex !== undefined) {
          sheetsService.updateRecord('tasks', task._rowIndex, task)
            .catch(err => {
              console.error('Failed to sync inbox task conversion:', err);
              task._syncStatus = 'Pending Sync';
              task._syncError = this.getFriendlyErrorMessage(err);
              this.saveLocalData();
              this.render();
            });
        } else {
          task._syncStatus = 'Pending Sync';
          task._syncError = 'Row index is undefined';
          this.saveLocalData();
          this.render();
        }
      }
    } else if (type === 'project') {
      this.data.tasks = this.data.tasks.filter(t => t.taskId !== taskId);
      const projectId = `PRJ-${String((this.data.projects || []).length + 1).padStart(4, '0')}`;
      const newProj = {
        projectId,
        projectName: task.title,
        deadline: getDemoToday(),
        progress: 0,
        budget: 0,
      };
      if (!this.data.projects) this.data.projects = [];
      this.data.projects.push(newProj);
      this.showToast('Converted inbox item to Project!', 'success');
      this.render();
      if (this.sheetsConnected) {
        sheetsService.appendRecord('projects', newProj)
          .then(res => {
            if (res && res.rowsAfter !== undefined) newProj._rowIndex = res.rowsAfter - 1;
            if (task._rowIndex !== undefined) return sheetsService.deleteRecord('tasks', task._rowIndex);
          })
          .catch(err => {
            console.error('Failed to sync inbox project conversion:', err);
            const userErr = this.getFriendlyErrorMessage(err);
            newProj._syncStatus = 'Pending Sync';
            newProj._syncError = userErr;
            this.saveLocalData();
            this.render();
          });
      }
    } else if (type === 'note') {
      this.data.tasks = this.data.tasks.filter(t => t.taskId !== taskId);
      const noteId = `N-${String((this.data.notes || []).length + 1).padStart(4, '0')}`;
      const newNote = {
        noteId,
        title: task.title,
        content: '',
        createdAt: getDemoToday(),
      };
      if (!this.data.notes) this.data.notes = [];
      this.data.notes.push(newNote);
      this.showToast('Converted inbox item to Note!', 'success');
      this.render();
      if (this.sheetsConnected) {
        sheetsService.appendRecord('notes', newNote)
          .then(res => {
            if (res && res.rowsAfter !== undefined) newNote._rowIndex = res.rowsAfter - 1;
            if (task._rowIndex !== undefined) return sheetsService.deleteRecord('tasks', task._rowIndex);
          })
          .catch(err => {
            console.error('Failed to sync inbox note conversion:', err);
            const userErr = this.getFriendlyErrorMessage(err);
            newNote._syncStatus = 'Pending Sync';
            newNote._syncError = userErr;
            this.saveLocalData();
            this.render();
          });
      }
    }
  }

  // ── Universal Task Management ───────────────────────────────
  renderTasks(container) {
    const tasks = this.data.tasks || [];
    const projects = this.data.projects || [];

    if (!this.taskFilters) {
      this.taskFilters = {
        area: 'all',
        project: 'all',
        priority: 'all',
        status: 'all',
        viewMode: 'list'
      };
    }

    let filtered = [...tasks].filter(t => t.status !== 'Inbox');
    if (this.taskFilters.priority !== 'all') {
      filtered = filtered.filter(t => t.priority === this.taskFilters.priority);
    }
    if (this.taskFilters.status !== 'all') {
      filtered = filtered.filter(t => t.status === this.taskFilters.status);
    }
    if (this.taskFilters.project !== 'all') {
      filtered = filtered.filter(t => t.projectId === this.taskFilters.project);
    }

    const todayStr = getDemoToday();

    container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-group">
          <label class="filter-label">Status</label>
          <select class="filter-select" onchange="app.setTaskFilter('status', this.value)">
            <option value="all" ${this.taskFilters.status === 'all' ? 'selected' : ''}>All Statuses</option>
            ${(this.taskColumns || ['To Do', 'In Progress', 'Waiting', 'Review', 'Completed']).map(opt => `
              <option value="${opt}" ${this.taskFilters.status === opt ? 'selected' : ''}>${opt}</option>
            `).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Priority</label>
          <select class="filter-select" onchange="app.setTaskFilter('priority', this.value)">
            <option value="all" ${this.taskFilters.priority === 'all' ? 'selected' : ''}>All Priorities</option>
            <option value="Low" ${this.taskFilters.priority === 'Low' ? 'selected' : ''}>Low</option>
            <option value="Medium" ${this.taskFilters.priority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="High" ${this.taskFilters.priority === 'High' ? 'selected' : ''}>High</option>
            <option value="Urgent" ${this.taskFilters.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Project</label>
          <select class="filter-select" onchange="app.setTaskFilter('project', this.value)">
            <option value="all" ${this.taskFilters.project === 'all' ? 'selected' : ''}>All Projects</option>
            ${projects.map(p => `<option value="${p.projectId}" ${this.taskFilters.project === p.projectId ? 'selected' : ''}>${this._esc(p.projectName)}</option>`).join('')}
          </select>
        </div>
        <div style="flex-grow:1"></div>
        <div class="filter-group" style="flex-direction:row; gap:8px; align-items:center">
          <button class="btn-secondary btn-sm" onclick="app.setTaskViewMode('list')">List</button>
          <button class="btn-secondary btn-sm" onclick="app.setTaskViewMode('kanban')">Kanban</button>
          <button class="btn-primary btn-sm" onclick="app.openAddTaskModal('tasks')">+ Add Task</button>
        </div>
      </div>

      ${this.taskFilters.viewMode === 'list' ? `
        <div class="gos-section-card" style="margin-top:16px">
          <div class="gos-section-card-body" style="padding:0">
            ${filtered.length === 0 ? `
              <div class="gos-empty" style="padding:40px 20px">
                <span class="gos-empty-icon">📝</span>
                <span class="gos-empty-title">No tasks found</span>
                <span class="gos-empty-desc">Create a new task to get started.</span>
              </div>
            ` : `
              <ul class="gos-task-list">
                ${filtered.map(t => {
                  const proj = projects.find(p => p.projectId === t.projectId);
                  return `
                    <li class="gos-task-item ${this.isTaskCompleted(t) ? 'completed' : ''}">
                      <input type="checkbox" class="gos-task-checkbox" ${this.isTaskCompleted(t) ? 'checked' : ''} onchange="app.toggleTaskStatus('${t.taskId}')">
                      <div class="gos-task-info" onclick="app.openTaskPanel('${t.taskId}')" style="flex:1">
                        <span class="gos-task-title">${this._esc(t.title)} ${this.renderSyncBadgeInline('tasks', t.taskId, t)}</span>
                        <div class="gos-task-meta">
                          <span class="${t.dueAt < todayStr && t.status !== 'Completed' ? 'text-red font-bold' : ''}">Due ${t.dueAt || 'No Date'}</span>
                          ${this.renderBadge(t.priority)}
                          ${proj ? `<span class="kanban-card-project">${this._esc(proj.projectName)}</span>` : ''}
                        </div>
                      </div>
                      <button class="btn-danger btn-sm" onclick="app.deleteTask('${t.taskId}')">✕</button>
                    </li>
                  `;
                }).join('')}
              </ul>
            `}
          </div>
        </div>
      ` : `
        <div class="kanban-board">
          ${(this.taskColumns || ['To Do', 'In Progress', 'Waiting', 'Review', 'Completed']).map(colStatus => {
            const colTasks = filtered.filter(t => t.status === colStatus);
            return `
              <div class="kanban-column" id="kanban-col-${colStatus.replace(' ', '-')}" ondragover="event.preventDefault()" ondrop="app.handleTaskDrop(event, '${colStatus}')">
                <div class="kanban-column-header">
                  <span class="kanban-column-title" contenteditable="true" onblur="app.renameKanbanColumn('${colStatus}', this.textContent)" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">${colStatus}</span>
                  <div class="kanban-column-header-right" style="display:flex; align-items:center; gap:8px;">
                    <span class="kanban-column-count">${colTasks.length}</span>
                    <button class="btn-delete-kanban-col" onclick="app.deleteKanbanColumn('${colStatus}', event)" title="Delete section">✕</button>
                  </div>
                </div>
                <div class="kanban-cards-container">
                  ${colTasks.map(t => {
                    const proj = projects.find(p => p.projectId === t.projectId);
                    return `
                      <div class="kanban-card" draggable="true" ondragstart="app.handleTaskDragStart(event, '${t.taskId}')" onclick="app.openTaskPanel('${t.taskId}')">
                        <div class="kanban-card-title">${this._esc(t.title)} ${this.renderSyncBadgeInline('tasks', t.taskId, t)}</div>
                        <div class="kanban-card-meta">
                          <span>${t.dueAt || 'No Date'}</span>
                          ${this.renderBadge(t.priority)}
                        </div>
                        ${proj ? `<div style="margin-top:6px"><span class="kanban-card-project">${this._esc(proj.projectName)}</span></div>` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
          <div class="kanban-column add-column-placeholder" id="kanban-add-col-placeholder">
            <button class="kanban-add-col-btn" onclick="app.promptAddKanbanColumn()" title="Add a new section">
              <span class="plus-icon">+</span>
              <span>Add Section</span>
            </button>
          </div>

        </div>
      `}
    `;
  }

  handleTaskDragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
  }

  handleTaskDrop(e, status) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (task && task.status !== status) {
      task.status = status;
      this.showToast(`Updated task status to ${status}`, 'success');
      this.render();
      if (this.sheetsConnected) {
        if (task._rowIndex !== undefined) {
          sheetsService.updateRecord('tasks', task._rowIndex, { status })
            .catch(err => {
              console.error('Task status drag-drop sync failed:', err);
              task._syncStatus = 'Pending Sync';
              task._syncError = this.getFriendlyErrorMessage(err);
              this.saveLocalData();
              this.render();
            });
        } else {
          task._syncStatus = 'Pending Sync';
          task._syncError = 'Row index is undefined';
          this.saveLocalData();
          this.render();
        }
      }
    }
  }

  setTaskFilter(key, val) {
    this.taskFilters[key] = val;
    this.renderContent();
  }

  setTaskViewMode(mode) {
    this.taskFilters.viewMode = mode;
    this.renderContent();
  }

  toggleTaskStatus(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (task) {
      const firstStatus = this.taskColumns[0] || 'To Do';
      const lastStatus = this.taskColumns[this.taskColumns.length - 1] || 'Completed';
      task.status = task.status === lastStatus ? firstStatus : lastStatus;
      this.showToast(`Task status updated!`, 'success');
      this.render();
      if (this.sheetsConnected && task._rowIndex !== undefined) {
        sheetsService.updateRecord('tasks', task._rowIndex, { status: task.status });
      }
    }
  }

  renameKanbanColumn(oldName, newName) {
    if (!newName) {
      this.render();
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      this.render();
      return;
    }
    if (this.taskColumns.includes(trimmed)) {
      this.showToast('Section name already exists!', 'warning');
      this.render();
      return;
    }
    
    // Update columns list
    const index = this.taskColumns.indexOf(oldName);
    if (index !== -1) {
      this.taskColumns[index] = trimmed;
      localStorage.setItem('gos_task_columns', JSON.stringify(this.taskColumns));
    }
    
    // Update all tasks that had the old status to the new status
    let updatedCount = 0;
    if (this.data && this.data.tasks) {
      this.data.tasks.forEach(task => {
        if (task.status === oldName) {
          task.status = trimmed;
          updatedCount++;
          if (this.sheetsConnected && task._rowIndex !== undefined) {
            sheetsService.updateRecord('tasks', task._rowIndex, { status: task.status });
          }
        }
      });
      if (updatedCount > 0) {
        this.saveLocalData();
      }
    }
    
    this.showToast(`Renamed section to "${trimmed}"`, 'success');
    this.render();
  }

  addKanbanColumn(name) {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (this.taskColumns.includes(trimmed)) {
      this.showToast('Section already exists!', 'warning');
      return;
    }
    this.taskColumns.push(trimmed);
    localStorage.setItem('gos_task_columns', JSON.stringify(this.taskColumns));
    this.showToast(`Added section "${trimmed}"`, 'success');
    this.render();
  }

  promptAddKanbanColumn() {
    const placeholder = document.getElementById('kanban-add-col-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;padding:12px;width:100%;">
        <input
          id="kanban-new-col-input"
          class="gos-form-input"
          placeholder="Section name..."
          maxlength="40"
          autofocus
          style="width:100%;font-size:13px;"
          onkeydown="if(event.key==='Enter'){app.confirmAddKanbanColumn();}else if(event.key==='Escape'){app.render();}"
        >
        <div style="display:flex;gap:6px;">
          <button class="btn-primary btn-sm" style="flex:1" onclick="app.confirmAddKanbanColumn()">Add</button>
          <button class="btn-ghost btn-sm" style="flex:1" onclick="app.render()">Cancel</button>
        </div>
      </div>
    `;
    const input = document.getElementById('kanban-new-col-input');
    if (input) { input.focus(); }
  }

  confirmAddKanbanColumn() {
    const input = document.getElementById('kanban-new-col-input');
    if (!input) return;
    this.addKanbanColumn(input.value);
  }


  deleteKanbanColumn(name, event) {
    if (event) event.stopPropagation();
    if (this.taskColumns.length <= 1) {
      this.showToast('You must have at least one Kanban section!', 'warning');
      return;
    }
    const fallback = this.taskColumns[0] === name ? this.taskColumns[1] : this.taskColumns[0];
    this.showConfirm(
      'Delete Section',
      `Are you sure you want to delete the section "${name}"? Tasks in this section will be moved to "${fallback}".`,
      'Delete',
      () => {
        // Remove column
        this.taskColumns = this.taskColumns.filter(c => c !== name);
        localStorage.setItem('gos_task_columns', JSON.stringify(this.taskColumns));
        
        // Move tasks
        let movedCount = 0;
        if (this.data && this.data.tasks) {
          this.data.tasks.forEach(task => {
            if (task.status === name) {
              task.status = fallback;
              movedCount++;
              if (this.sheetsConnected && task._rowIndex !== undefined) {
                sheetsService.updateRecord('tasks', task._rowIndex, { status: task.status });
              }
            }
          });
          if (movedCount > 0) {
            this.saveLocalData();
          }
        }
        
        this.showToast(`Deleted section "${name}"`, 'success');
        this.render();
      }
    );
  }

  deleteTask(taskId) {
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (task) {
      this.showConfirm(
        'Delete Task',
        `Are you sure you want to permanently delete task "${task.title || ''}"? This will also delete its row in Google Sheets.`,
        '🗑️ Delete',
        () => this._doDeleteRecord('tasks', task)
      );
    }
  }

  openAddTaskModal(source) {
    this.currentView = 'tasks';
    this.openAddModal();
  }

  // ── Project Management ──────────────────────────────────────
  renderProjects(container) {
    const projects = this.data.projects || [];
    const tasks = this.data.tasks || [];
    const clients = this.data.clients || [];

    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${projects.length} projects</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddProjectModal()">+ Add Project</button>
      </div>

      <div class="sop-grid" style="margin-top:16px">
        ${projects.length === 0 ? `
          <div class="gos-empty" style="padding:40px 20px; grid-column: 1 / -1">
            <span class="gos-empty-icon">📁</span>
            <span class="gos-empty-title">No projects active</span>
            <span class="gos-empty-desc">Create your first project to organize your workflows.</span>
          </div>
        ` : projects.map(p => {
          const linkedTasks = tasks.filter(t => t.projectId === p.projectId);
          const completedTasks = linkedTasks.filter(t => this.isTaskCompleted(t));
          const calculatedProgress = linkedTasks.length ? Math.round((completedTasks.length / linkedTasks.length) * 100) : 0;
          const displayProgress = p.progress !== undefined ? p.progress : calculatedProgress;
          const client = clients.find(c => c.clientId === p.clientId);

          return `
            <div class="sop-card" onclick="app.openProjectPanel('${p.projectId}')">
              <div>
                <div class="sop-title">${this._esc(p.projectName)}</div>
                ${client ? `<div class="note-meta" style="margin-bottom:8px">Client: ${this._esc(client.clientName)}</div>` : ''}
                <div class="note-meta" style="display:flex; justify-content:space-between; align-items:center;">
                  <span>Deadline: ${p.deadline || 'No Deadline'}</span>
                  ${this.renderSyncBadgeInline('projects', p.projectId, p)}
                </div>
              </div>
              <div>
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:12px; color:var(--text-muted)">
                  <span>Progress</span>
                  <span>${displayProgress}%</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: ${displayProgress}%"></div>
                </div>
                <div style="margin-top:12px; display:flex; justify-content:flex-end">
                  <button class="btn-danger btn-sm" onclick="event.stopPropagation(); app.deleteProject('${p.projectId}')">Delete</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  openAddProjectModal() {
    this.currentView = 'projects';
    this.openAddModal();
  }

  deleteProject(projectId) {
    const proj = this.data.projects.find(p => p.projectId === projectId);
    if (proj) {
      this.showConfirm(
        'Delete Project',
        `Are you sure you want to permanently delete project "${proj.projectName || ''}"? This will also delete its row in Google Sheets.`,
        '🗑️ Delete',
        () => this._doDeleteRecord('projects', proj)
      );
    }
  }

  // ── Client Management ───────────────────────────────────────
  renderClients(container) {
    const clients = this.data.clients || [];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${clients.length} clients</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddClientModal()">+ Add Client</button>
      </div>

      <div class="gos-section-card" style="margin-top:16px">
        <div class="gos-section-card-body" style="padding:0">
          ${clients.length === 0 ? `
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">🤝</span>
              <span class="gos-empty-title">No clients onboarded</span>
              <span class="gos-empty-desc">When a CRM lead is closed won, you can convert them to a client.</span>
            </div>
          ` : `
            <table class="gos-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Services</th>
                  <th>End Date</th>
                  <th>Value (₱)</th>
                  <th style="width:80px">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${clients.map(c => `
                  <tr class="clickable" onclick="app.openClientPanel('${c.clientId}')">
                    <td><strong>${this._esc(c.clientName)}</strong></td>
                    <td>${this._esc(c.services || '—')}</td>
                    <td>${c.endDate || '—'}</td>
                    <td>₱${Number(c.accountValue || 0).toLocaleString()}</td>
                    <td>
                      <button class="btn-danger btn-sm" onclick="event.stopPropagation(); app.deleteClient('${c.clientId}')">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  openAddClientModal() {
    this.currentView = 'clients';
    this.openAddModal();
  }

  deleteClient(clientId) {
    const client = this.data.clients.find(c => c.clientId === clientId);
    if (client) {
      this.data.clients = this.data.clients.filter(c => c.clientId !== clientId);
      this.showToast('Client record deleted.', 'info');
      this.render();
      if (this.sheetsConnected && client._rowIndex !== undefined) {
        sheetsService.deleteRecord('clients', client._rowIndex).catch(err => console.error('Delete client failed:', err));
      }
    }
  }

  // ── Operations & Recurring Checklists ──────────────────────
  renderOperations(container) {
    const tasks = this.data.tasks || [];
    const projects = this.data.projects || [];
    const weeklySync = tasks.filter(t => t.title.toLowerCase().includes('sync') || t.title.toLowerCase().includes('weekly') || t.title.toLowerCase().includes('recurring'));

    container.innerHTML = `
      <div class="gos-section-grid">
        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">🔁 Recurring Operations Checklist</span>
            <button class="btn-primary btn-sm" onclick="app.addOperationsChecklist()">+ Add Check</button>
          </div>
          <div class="gos-section-card-body" style="padding:0">
            ${weeklySync.length === 0 ? `
              <div class="gos-empty" style="padding:30px 10px">
                <span class="gos-empty-desc">No recurring operational tasks mapped.</span>
              </div>
            ` : `
              <ul class="gos-task-list">
                ${weeklySync.map(t => `
                  <li class="gos-task-item ${this.isTaskCompleted(t) ? 'completed' : ''}">
                    <input type="checkbox" class="gos-task-checkbox" ${this.isTaskCompleted(t) ? 'checked' : ''} onchange="app.toggleTaskStatus('${t.taskId}')">
                    <div class="gos-task-info">
                      <span class="gos-task-title">${this._esc(t.title)}</span>
                    </div>
                  </li>
                `).join('')}
              </ul>
            `}
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">👥 Workload Analysis</span>
          </div>
          <div class="gos-section-card-body">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px">
              <span>Gelo (Founder / Operator)</span>
              <strong>${tasks.filter(t => t.status !== 'Completed').length} open tasks</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px">
              <span>Active Projects</span>
              <strong>${projects.length} active</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  addOperationsChecklist() {
    const val = prompt('Enter recurring checklist task title (e.g. Weekly Team Sync):');
    if (!val || !val.trim()) return;
    const newTask = {
      taskId: `T-${String((this.data.tasks || []).length + 1).padStart(4, '0')}`,
      title: `${val.trim()} (Recurring)`,
      status: 'To Do',
      priority: 'Normal',
      dueAt: getDemoToday(),
      createdAt: getDemoToday(),
      notes: 'Operational recurring task'
    };
    if (!this.data.tasks) this.data.tasks = [];
    this.data.tasks.push(newTask);
    this.showToast('Recurring checklist item added!', 'success');
    this.render();
    if (this.sheetsConnected) {
      sheetsService.appendRecord('tasks', newTask);
    }
  }

  // ── Finance View ───────────────────────────────────────────
  renderFinance(container) {
    const pipeline = this.data.primePipeline || [];
    const wonPending = pipeline.filter(p => p.stage === 'Closed Won' || p.stage === 'Won');
    const totalWon = wonPending.reduce((s, p) => s + (p.estimatedValue || 0), 0);

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Total Revenue</span>
            <span class="gos-kpi-icon">₱</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">₱${totalWon.toLocaleString()}</div>
          </div>
          <div class="gos-kpi-detail">Revenue generated from Won pipeline deals</div>
        </div>
      </div>

      <div class="gos-section-card" style="margin-top:20px">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">Pending Payments & Deliverables</span>
        </div>
        <div class="gos-section-card-body" style="padding:0">
          ${wonPending.length === 0 ? `
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">☕</span>
              <span class="gos-empty-title">No pending won deals</span>
              <span class="gos-empty-desc">Close leads as Closed Won to track financials here.</span>
            </div>
          ` : `
            <table class="gos-table">
              <thead>
                <tr>
                  <th>Deal ID</th>
                  <th>Client / Org</th>
                  <th>Service</th>
                  <th>Value</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                ${wonPending.map(p => `
                  <tr>
                    <td>${p.opportunityId}</td>
                    <td><strong>${this._esc(p.orgName || p.contactName || '')}</strong></td>
                    <td>${this._esc(p.serviceInterest)}</td>
                    <td>₱${(p.estimatedValue || 0).toLocaleString()}</td>
                    <td>${this.renderBadge(p.paymentStatus || 'Unpaid')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  // ── Notes & SOPs (Knowledge Hub) ───────────────────────────
  renderNotes(container) {
    const notes = this.data.notes || [];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${notes.length} notes</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddNoteModal()">+ Add Note</button>
      </div>

      <div class="notes-grid" style="margin-top:16px">
        ${notes.length === 0 ? `
          <div class="gos-empty" style="padding:40px 20px; grid-column:1/-1">
            <span class="gos-empty-icon">📝</span>
            <span class="gos-empty-title">Notes library is empty</span>
            <span class="gos-empty-desc">Capture meeting minutes and quick ideas here.</span>
          </div>
        ` : notes.map(n => `
          <div class="note-card" onclick="app.openNotePanel('${n.noteId}')">
            <div>
              <div class="note-title">${this._esc(n.title)}</div>
              <div style="font-size:12px; color:var(--text-secondary); max-height:80px; overflow:hidden; text-overflow:ellipsis">${this._esc(n.content || 'No content')}</div>
            </div>
            <div class="note-meta" style="margin-top:12px">Created ${n.createdAt}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  openAddNoteModal() {
    this.currentView = 'notes';
    this.openAddModal();
  }

  renderSops(container) {
    const sops = this.data.sops || [];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${sops.length} SOPs</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddSopModal()">+ Add SOP</button>
      </div>

      <div class="sop-grid" style="margin-top:16px">
        ${sops.length === 0 ? `
          <div class="gos-empty" style="padding:40px 20px; grid-column:1/-1">
            <span class="gos-empty-icon">📖</span>
            <span class="gos-empty-title">No SOPs found</span>
            <span class="gos-empty-desc">Create standard operating procedures to organize your business processes.</span>
          </div>
        ` : sops.map(s => {
          let steps = [];
          try {
            if (s.steps) {
              steps = typeof s.steps === 'string' ? JSON.parse(s.steps) : s.steps;
            }
          } catch(e){
            steps = (s.steps || '').split('\n').filter(Boolean);
          }
          return `
            <div class="sop-card" onclick="app.openSopPanel('${s.sopId}')">
              <div>
                <div class="sop-title">${this._esc(s.processTitle)}</div>
                <div class="sop-steps-count">${steps.length} steps · v${s.version || '1.0'}</div>
                <div style="margin-top:8px">
                  ${steps.slice(0, 2).map((step, idx) => `
                    <div class="sop-step-item">
                      <span class="sop-step-number">${idx + 1}</span>
                      <span>${this._esc(step)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              <div class="note-meta" style="margin-top:12px">Updated ${s.lastUpdated || '—'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  openAddSopModal() {
    this.currentView = 'sops';
    this.openAddModal();
  }

  renderFiles(container) {
    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header"><span class="gos-section-card-title">Drive Files & Documents</span></div>
        <div class="gos-section-card-body">
          <p style="font-size:13px; color:var(--text-muted)">Connect and store drives links, spreadsheet models, and resource indexes here.</p>
        </div>
      </div>
    `;
  }

  renderTemplates(container) {
    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header"><span class="gos-section-card-title">Message Templates</span></div>
        <div class="gos-section-card-body">
          <p style="font-size:13px; color:var(--text-muted)">Manage outreach copywriting templates to copy-paste during outreach directly.</p>
        </div>
      </div>
    `;
  }

  // ── Personal Hub ────────────────────────────────────────────
  renderPersonalDashboard(container) {
    const tasks = (this.data.tasks || []).filter(t => t.title.toLowerCase().includes('personal') || t.notes?.toLowerCase().includes('personal'));
    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">🧘 Personal Dashboard</span>
        </div>
        <div class="gos-section-card-body">
          <p style="font-size:13px; color:var(--text-muted)">Your personal growth center. Tag tasks with "personal" to keep them organized here.</p>
        </div>
      </div>

      <div class="gos-section-card" style="margin-top:20px">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">Personal Checklist</span>
          <button class="btn-primary btn-sm" onclick="app.openAddTaskModal('personal')">+ Add Task</button>
        </div>
        <div class="gos-section-card-body" style="padding:0">
          ${tasks.length === 0 ? `
            <div class="gos-empty" style="padding:30px 10px">
              <span class="gos-empty-desc">No personal tasks.</span>
            </div>
          ` : `
            <ul class="gos-task-list">
              ${tasks.map(t => `
                <li class="gos-task-item ${this.isTaskCompleted(t) ? 'completed' : ''}">
                  <input type="checkbox" class="gos-task-checkbox" ${this.isTaskCompleted(t) ? 'checked' : ''} onchange="app.toggleTaskStatus('${t.taskId}')">
                  <div class="gos-task-info">
                    <span class="gos-task-title">${this._esc(t.title)}</span>
                  </div>
                </li>
              `).join('')}
            </ul>
          `}
        </div>
      </div>
    `;
  }

  renderGoals(container) {
    const goals = this.data.goals || [];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${goals.length} goals</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddGoalModal()">+ Add Goal</button>
      </div>

      <div class="sop-grid" style="margin-top:16px">
        ${goals.length === 0 ? `
          <div class="gos-empty" style="padding:40px 20px; grid-column:1/-1">
            <span class="gos-empty-icon">🏆</span>
            <span class="gos-empty-title">No goals set</span>
            <span class="gos-empty-desc">Define key milestones for this quarter.</span>
          </div>
        ` : goals.map(g => {
          const target = parseFloat(g.targetMetric) || 100;
          const current = parseFloat(g.currentMetric) || 0;
          const progress = Math.min(Math.round((current / target) * 100), 100);
          return `
            <div class="sop-card" onclick="app.openGoalPanel('${g.goalId}')">
              <div>
                <div class="sop-title">${this._esc(g.goalName)}</div>
                <div class="note-meta">Target: ${g.currentMetric || 0} / ${g.targetMetric || 100}</div>
              </div>
              <div>
                <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:12px; color:var(--text-muted)">
                  <span>Progress</span>
                  <span>${progress}%</span>
                </div>
                <div class="progress-bar-container">
                  <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  openAddGoalModal() {
    this.currentView = 'goals';
    this.openAddModal();
  }

  renderHabits(container) {
    const habits = this.data.habits || [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${habits.length} habits</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddHabitModal()">+ Add Habit</button>
      </div>

      <div class="habits-list" style="margin-top:16px">
        ${habits.length === 0 ? `
          <div class="gos-empty" style="padding:40px 20px">
            <span class="gos-empty-icon">⭐️</span>
            <span class="gos-empty-title">No habits tracked</span>
            <span class="gos-empty-desc">Track weekly routines to stay aligned.</span>
          </div>
        ` : habits.map(h => {
          let history = {};
          try {
            if (h.history) {
              history = typeof h.history === 'string' ? JSON.parse(h.history) : h.history;
            }
          } catch(e){}
          
          return `
            <div class="habit-row">
              <div class="habit-info-col">
                <div class="habit-name">${this._esc(h.habitName)}</div>
                <div class="habit-streak">Streak: ${h.streak || 0} days · Frequency: ${h.frequency || 'Daily'}</div>
              </div>
              <div class="habit-days-grid">
                ${days.map((day, idx) => {
                  const completed = history[day] === true;
                  return `
                    <button class="habit-day-btn ${completed ? 'completed' : ''}" onclick="app.toggleHabitDay('${h.habitId}', '${day}')" title="${day}">
                      ${day[0]}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  openAddHabitModal() {
    this.currentView = 'habits';
    this.openAddModal();
  }

  toggleHabitDay(habitId, day) {
    const habit = this.data.habits.find(h => h.habitId === habitId);
    if (habit) {
      let history = {};
      try {
        if (habit.history) {
          history = typeof habit.history === 'string' ? JSON.parse(habit.history) : habit.history;
        }
      } catch(e){}
      
      history[day] = !history[day];
      habit.history = JSON.stringify(history);
      
      // Calculate streak
      let streak = 0;
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let d of days) {
        if (history[d]) streak++;
      }
      habit.streak = streak;

      this.showToast('Habit progress updated!', 'success');
      this.render();

      if (this.sheetsConnected && habit._rowIndex !== undefined) {
        sheetsService.updateRecord('habits', habit._rowIndex, { history: habit.history, streak: habit.streak });
      }
    }
  }

  renderLearning(container) {
    const items = this.data.learning || [];
    container.innerHTML = `
      <div class="filter-bar">
        <span class="gos-table-count">${items.length} materials</span>
        <div style="flex-grow:1"></div>
        <button class="btn-primary btn-sm" onclick="app.openAddLearningModal()">+ Add Resource</button>
      </div>

      <div class="gos-section-card" style="margin-top:16px">
        <div class="gos-section-card-body" style="padding:0">
          ${items.length === 0 ? `
            <div class="gos-empty" style="padding:40px 20px">
              <span class="gos-empty-icon">📚</span>
              <span class="gos-empty-title">Reading list is empty</span>
              <span class="gos-empty-desc">Store courses, books, and resources here.</span>
            </div>
          ` : `
            <table class="gos-table">
              <thead>
                <tr>
                  <th>Topic / Resource</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(l => `
                  <tr>
                    <td><strong>${this._esc(l.title || l.learningId)}</strong></td>
                    <td>${this._esc(l.category || '—')}</td>
                    <td>${this.renderBadge(l.status || 'To Read')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  openAddLearningModal() {
    this.currentView = 'learning';
    this.openAddModal();
  }

  // ── Reports & Automations ──────────────────────────────────
  renderReports(container) {
    const tasks = this.data.tasks || [];
    const completedTasks = tasks.filter(t => this.isTaskCompleted(t)).length;
    const leads = this.data.linkedinLeads || [];
    const clients = this.data.clients || [];

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Tasks Completed</span></div>
          <div class="gos-kpi-value">${completedTasks}</div>
        </div>
        <div class="gos-kpi-card">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Active Clients</span></div>
          <div class="gos-kpi-value">${clients.length}</div>
        </div>
        <div class="gos-kpi-card">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Leads Captured</span></div>
          <div class="gos-kpi-value">${leads.length}</div>
        </div>
      </div>
    `;
  }

  renderAutomations(container) {
    container.innerHTML = `
      <div class="gos-section-card">
        <div class="gos-section-card-header">
          <span class="gos-section-card-title">🤖 Active System Automations</span>
        </div>
        <div class="gos-section-card-body">
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px">
            • <strong>CRM Client Onboarding:</strong> Moving leads to "Closed Won" automatically converts them to active clients and generates standard onboarding projects/checklists. (Active)
          </div>
        </div>
      </div>
    `;
  }

  // ── Details Render Helpers ─────────────────────────────────
  renderTaskDetail(r) {
    const proj = (this.data.projects || []).find(p => p.projectId === r.projectId);
    const client = (this.data.clients || []).find(c => c.clientId === r.clientId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Task Details</div>
        ${this.renderField('Title', r.title)}
        ${this.renderField('Status', this.renderBadge(r.status))}
        ${this.renderField('Priority', this.renderBadge(r.priority))}
        ${this.renderField('Due Date', this.renderDueDate(r.dueAt))}
        ${this.renderField('Project', proj ? this._esc(proj.projectName) : '—')}
        ${this.renderField('Client', client ? this._esc(client.clientName) : '—')}
        ${this.renderField('Notes', r.notes || '—')}
      </div>
    `;
  }

  renderProjectDetail(r) {
    const projectTasks = (this.data.tasks || []).filter(t => t.projectId === r.projectId);
    const client = (this.data.clients || []).find(c => c.clientId === r.clientId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Project Details</div>
        ${this.renderField('Project Name', r.projectName)}
        ${this.renderField('Deadline', r.deadline || '—')}
        ${this.renderField('Client', client ? this._esc(client.clientName) : '—')}
        ${this.renderField('Budget', r.budget ? `₱${Number(r.budget).toLocaleString()}` : '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Project Tasks (${projectTasks.length})</div>
        <ul class="gos-task-list">
          ${projectTasks.map(t => `
            <li class="gos-task-item ${this.isTaskCompleted(t) ? 'completed' : ''}" style="padding: 6px 0">
              <span style="font-size:12px; font-weight:600">${this._esc(t.title)}</span>
              ${this.renderBadge(t.status)}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderClientDetail(r) {
    const clientProjects = (this.data.projects || []).filter(p => p.clientId === r.clientId);
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Client Details</div>
        ${this.renderField('Client Name', r.clientName)}
        ${this.renderField('Services', r.services || '—')}
        ${this.renderField('End Date', r.endDate || '—')}
        ${this.renderField('Account Value', r.accountValue ? `₱${Number(r.accountValue).toLocaleString()}` : '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Active Projects (${clientProjects.length})</div>
        <ul>
          ${clientProjects.map(p => `
            <li style="margin-bottom:6px; font-size:12px">
              <strong>${this._esc(p.projectName)}</strong> — Due ${p.deadline || '—'}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderGoalDetail(r) {
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Goal Details</div>
        ${this.renderField('Goal Name', r.goalName)}
        ${this.renderField('Target Metric', r.targetMetric || '—')}
        ${this.renderField('Current Metric', r.currentMetric || '—')}
        ${this.renderField('Due Date', r.dueDate || '—')}
      </div>
    `;
  }

  renderNoteDetail(r) {
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Edit Note</div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px">Created: ${r.createdAt || '—'}</div>
        <div class="gos-form-group">
          <label class="gos-form-label">Note Title</label>
          <input class="gos-form-input" id="note-edit-title" value="${this._esc(r.title || '')}" oninput="app.updateNoteRecord('${r.noteId}', 'title', this.value)" style="margin-bottom:12px">
        </div>
        <div class="gos-form-group">
          <label class="gos-form-label">Note Content</label>
          <textarea class="gos-form-textarea" id="note-edit-content" rows="18" placeholder="Start typing notes..." oninput="app.updateNoteRecord('${r.noteId}', 'content', this.value)" style="font-size:13px; line-height:1.6; padding:12px">${this._esc(r.content || '')}</textarea>
        </div>
      </div>
    `;
  }

  updateNoteRecord(noteId, field, value) {
    const note = (this.data.notes || []).find(n => n.noteId === noteId);
    if (note) {
      note[field] = value;
      this.saveLocalData();
      
      // Update background list UI if viewing notes
      if (this.currentView === 'notes') {
        const content = document.getElementById('main-content');
        if (content) this.renderNotes(content);
      }

      // Sync to Google Sheets if connected
      if (this.sheetsConnected && note._rowIndex !== undefined) {
        sheetsService.updateRecord('notes', note._rowIndex, note)
          .catch(err => console.error('Failed to sync note update to Sheets:', err));
      }
    }
  }

  renderSOPDetail(r) {
    let steps = [];
    try {
      if (r.steps) {
        steps = typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps;
      }
    } catch(e){
      steps = (r.steps || '').split('\n').filter(Boolean);
    }
    return `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">SOP Information</div>
        ${this.renderField('Process Title', r.processTitle)}
        ${this.renderField('Version', r.version || '1.0')}
        ${this.renderField('Last Updated', r.lastUpdated || '—')}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Procedure Steps</div>
        <ol style="padding-left:16px; font-size:13px">
          ${steps.map((s, i) => `<li style="margin-bottom:8px">${this._esc(s)}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  openTaskPanel(taskId) { this.openRecordPanel('tasks', taskId); }
  openProjectPanel(projectId) { this.openRecordPanel('projects', projectId); }
  openClientPanel(clientId) { this.openRecordPanel('clients', clientId); }
  openNotePanel(noteId) { this.openRecordPanel('notes', noteId); }
  openSopPanel(sopId) { this.openRecordPanel('sops', sopId); }
  openGoalPanel(goalId) { this.openRecordPanel('goals', goalId); }

  triggerLeadToClientConversion(lead) {
    const exists = (this.data.clients || []).some(c => c.clientName === lead.contactName);
    if (exists) return;

    this.showConfirm(
      '🎉 Closed Won: Onboard Client?',
      `Convert lead "${lead.contactName}" into an active client? This will create a Client record, onboarding project, and standard onboarding checklist tasks.`,
      '🤝 Convert & Onboard',
      () => {
        this.convertLeadToClient(lead);
      }
    );
  }

  convertLeadToClient(lead) {
    const today = getDemoToday();
    const clientId = `CL-${String((this.data.clients || []).length + 1).padStart(4, '0')}`;
    const newClient = {
      clientId,
      clientName: lead.contactName,
      services: lead.interestSignal || 'Services Onboarding',
      endDate: '',
      accountValue: parseFloat(lead.projectedCloseAmount) || 0,
      createdAt: today,
      updatedAt: today,
    };
    if (!this.data.clients) this.data.clients = [];
    this.data.clients.push(newClient);

    const projectId = `PRJ-${String((this.data.projects || []).length + 1).padStart(4, '0')}`;
    const newProject = {
      projectId,
      projectName: `${lead.contactName} — Onboarding & Launch`,
      deadline: '',
      progress: 0,
      budget: parseFloat(lead.projectedCloseAmount) || 0,
      clientId: clientId,
      createdAt: today,
      updatedAt: today,
    };
    if (!this.data.projects) this.data.projects = [];
    this.data.projects.push(newProject);

    const onboardingTasks = [
      'Conduct Kickoff Call',
      'Receive & Verify Contract Signoff',
      'Set Up Shared Folder & Workspace Assets',
      'Initialize Lead Tracker Integration Mapping'
    ];
    if (!this.data.tasks) this.data.tasks = [];
    onboardingTasks.forEach((taskTitle, idx) => {
      const taskId = `T-${String((this.data.tasks || []).length + 1).padStart(4, '0')}`;
      const newTask = {
        taskId,
        title: taskTitle,
        status: 'To Do',
        priority: idx === 0 ? 'High' : 'Normal',
        dueAt: today,
        createdAt: today,
        projectId: projectId,
        clientId: clientId,
        notes: `Standard onboarding check item for ${lead.contactName}`
      };
      this.data.tasks.push(newTask);
    });

    this.showToast(`✅ Client "${lead.contactName}" onboarded! Project and tasks created.`, 'success');
    this.render();

    if (this.sheetsConnected) {
      sheetsService.appendRecord('clients', newClient)
        .then(() => sheetsService.appendRecord('projects', newProject))
        .catch(err => console.error('Failed to write client/project to sheets:', err));
    }
  }

  // ── Router and Landing Page ──────────────────────────────────
  handleRouting() {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const redirectParam = searchParams.get('redirect');
    
    if (redirectParam) {
      window.history.replaceState(null, '', redirectParam);
      this.handleRouting();
      return;
    }

    const isLoggedIn = !!localStorage.getItem('gos_google_user');
    const publicShell = document.getElementById('public-homepage-shell');
    const internalShell = document.getElementById('internal-dashboard-shell');

    if (path === '/' || path === '/index.html' || path === '') {
      this.currentView = 'landing';
      this.currentModule = 'landing';
      
      if (publicShell) publicShell.style.display = 'block';
      if (internalShell) internalShell.style.display = 'none';

      document.body.classList.add('landing-mode');
      const appEl = document.getElementById('app');
      if (appEl) appEl.classList.add('landing-mode');
    } else if (path.startsWith('/app')) {
      if (!isLoggedIn) {
        sessionStorage.setItem('gos_auth_redirect', path);
        window.history.replaceState(null, '', '/');
        this.currentView = 'landing';
        this.currentModule = 'landing';
        
        if (publicShell) publicShell.style.display = 'block';
        if (internalShell) internalShell.style.display = 'none';

        document.body.classList.add('landing-mode');
        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.add('landing-mode');
      } else {
        if (publicShell) publicShell.style.display = 'none';
        if (internalShell) internalShell.style.display = 'flex';

        document.body.classList.remove('landing-mode');
        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.remove('landing-mode');
        
        if (path === '/app' || path === '/app/') {
          this.navigateTo('today');
        } else if (path.startsWith('/app/tasks')) {
          this.navigateTo('tasks');
        } else if (path.startsWith('/app/projects')) {
          this.navigateTo('projects');
        } else if (path.startsWith('/app/crm')) {
          this.navigateTo('leads');
        } else if (path.startsWith('/app/content')) {
          this.navigateTo('content');
        } else if (path.startsWith('/app/operations')) {
          this.navigateTo('operations');
        } else if (path.startsWith('/app/goals')) {
          this.navigateTo('goals');
        } else {
          this.navigateTo('today');
        }
      }
    } else {
      this.currentView = 'landing';
      this.currentModule = 'landing';
      
      if (publicShell) publicShell.style.display = 'block';
      if (internalShell) internalShell.style.display = 'none';

      document.body.classList.add('landing-mode');
      const appEl = document.getElementById('app');
      if (appEl) appEl.classList.add('landing-mode');
    }
    
    this.render();
  }

  landingSignIn() {
    const mockUser = { displayName: 'Gelo Vencio', email: 'gelo@prime.co', avatarInitials: 'GV' };
    localStorage.setItem('gos_google_user', JSON.stringify(mockUser));
    this.showToast('✅ Signed in with Google', 'success');
    
    // Auto-advance connection flow steps on sign-in
    localStorage.setItem('gos_workspace_connected', 'true');
    this.landingSyncData();
  }

  landingSignOut() {
    localStorage.removeItem('gos_google_user');
    localStorage.removeItem('gos_workspace_connected');
    localStorage.removeItem('gos_sheets_connected');
    this.sheetsConnected = false;
    this.landingSyncState = 'idle';
    this.landingSyncError = null;
    this.showToast('ℹ️ Signed out', 'info');
    window.history.pushState(null, '', '/');
    this.handleRouting();
  }

  toggleLandingDropdown() {
    const dropdown = document.getElementById('landing-account-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('show');
    }
  }

  landingConnectWorkspace() {
    localStorage.setItem('gos_workspace_connected', 'true');
    this.showToast('📁 Workspace Connected', 'success');
    this.render();
  }

  async landingSyncData() {
    this.landingSyncState = 'syncing';
    this.landingSyncError = null;
    this.render();
    
    if (!sheetsService.isConfigured()) {
      this.landingSyncState = 'ready';
      this.render();
      return;
    }
    
    try {
      const alive = await sheetsService.ping();
      if (!alive) {
        throw new Error('Could not reach Google Sheets API. Please check if your Google Sheets Web App URL is correct and active.');
      }
      
      sheetsService.signIn();
      const sheetsData = await sheetsService.readAllData();
      
      const local = (() => {
        try {
          const raw = localStorage.getItem('gos_local_database');
          return raw ? JSON.parse(raw) : {};
        } catch(e) { return {}; }
      })();

      const mergeTab = (key, sheetsRows) => {
        if (sheetsRows && sheetsRows.length > 0) {
          return this.mergeLocalPendingRecords(key, sheetsRows);
        }
        return local[key] || [];
      };

      this.data = {
        contacts:        mergeTab('contacts',        sheetsData.contacts || []),
        organizations:   mergeTab('organizations',   sheetsData.organizations || []),
        linkedinLeads:   mergeTab('linkedinLeads',   sheetsData.linkedinLeads || []),
        primePipeline:   mergeTab('primePipeline',   sheetsData.primePipeline || []),
        sccContent:      mergeTab('sccContent',      sheetsData.sccContent || []),
        calmeraOrders:   mergeTab('calmeraOrders',   sheetsData.calmeraOrders || []),
        sourceAssets:    mergeTab('sourceAssets',    sheetsData.sourceAssets || []),
        repurposeOutputs:mergeTab('repurposeOutputs',sheetsData.repurposeOutputs || []),
        interactions:    mergeTab('interactions',    sheetsData.interactions || []),
        tasks:           mergeTab('tasks',           sheetsData.tasks || []),
        projects:        mergeTab('projects',        sheetsData.projects || []),
        clients:         mergeTab('clients',         sheetsData.clients || []),
        areas:           mergeTab('areas',           sheetsData.areas || []),
        goals:           mergeTab('goals',           sheetsData.goals || []),
        habits:          mergeTab('habits',          sheetsData.habits || []),
        learning:        mergeTab('learning',        sheetsData.learning || []),
        notes:           mergeTab('notes',           sheetsData.notes || []),
        sops:            mergeTab('sops',            sheetsData.sops || []),
      };

      this.sheetsConnected = true;
      localStorage.setItem('gos_sheets_connected', 'true');
      this.applyFilters();
      this.updateConnectionUI('connected');
      this.updateNavBadge();
      
      this.landingSyncState = 'ready';
      this.render();
      this.showToast('✅ Sync Completed!', 'success');
    } catch (err) {
      console.error('Landing page sync error:', err);
      this.landingSyncState = 'failed';
      this.landingSyncError = err.message || 'Unknown error during Google Sheets sync.';
      
      this.loadLocalDataFallback();
      this.render();
      this.showToast('⚠️ Sync failed, but you can still enter in local mode.', 'warning');
    }
  }

  handlePrimaryLandingAction() {
    const isLoggedIn = !!localStorage.getItem('gos_google_user');
    const workspaceConnected = localStorage.getItem('gos_workspace_connected') === 'true';
    
    if (!isLoggedIn) {
      this.landingSignIn();
    } else if (!workspaceConnected) {
      this.landingConnectWorkspace();
    } else if (this.landingSyncState === 'ready' || this.landingSyncState === 'failed') {
      const redirect = sessionStorage.getItem('gos_auth_redirect') || '/app';
      sessionStorage.removeItem('gos_auth_redirect');
      window.history.pushState(null, '', redirect);
      this.handleRouting();
    }
  }

  renderLandingPage(container) {
    const googleUser = (() => {
      try {
        const raw = localStorage.getItem('gos_google_user');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    })();
    const workspaceConnected = localStorage.getItem('gos_workspace_connected') === 'true';
    
    const step1Completed = !!googleUser;
    const step2Completed = step1Completed && workspaceConnected;
    const step3Completed = step2Completed && this.landingSyncState === 'ready';
    const step3Failed = step2Completed && this.landingSyncState === 'failed';
    const step3Syncing = step2Completed && this.landingSyncState === 'syncing';

    const googleIcon = `<svg viewBox="0 0 24 24" width="16" height="16" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.218 2.709 1.255 6.645l4.01 3.12z"/><path fill="#4285F4" d="M23.71 12.273c0-.818-.073-1.609-.209-2.373H12v4.5h6.582A5.63 5.63 0 0 1 16.15 18.12l3.873 3c2.264-2.09 3.682-5.173 3.682-8.847z"/><path fill="#FBBC05" d="M5.266 14.235A7.09 7.09 0 0 1 4.909 12c0-.79.136-1.545.357-2.235L1.255 6.645A11.905 11.905 0 0 0 0 12c0 1.92.455 3.736 1.255 5.355l4.01-3.12z"/><path fill="#34A853" d="M12 24c3.245 0 5.973-1.073 7.964-2.927l-3.873-3c-1.073.718-2.445 1.145-4.09 1.145-3.155 0-5.827-2.136-6.782-5.018L1.209 17.3A11.936 11.936 0 0 0 12 24z"/></svg>`;

    const step1Icon = step1Completed 
      ? getIconSvg('checkCircle', 18, 'var(--green)') 
      : googleIcon;
    const step2Icon = step2Completed 
      ? getIconSvg('checkCircle', 18, 'var(--green)') 
      : getIconSvg('briefcase', 16, step1Completed ? 'var(--accent)' : 'var(--text-muted)');
    const step3Icon = step3Completed 
      ? getIconSvg('checkCircle', 18, 'var(--green)') 
      : (step3Failed ? getIconSvg('alert', 16, 'var(--red)') : getIconSvg('zap', 16, step2Completed ? 'var(--accent)' : 'var(--text-muted)'));

    const step1Class = step1Completed ? 'stepper-step completed' : 'stepper-step active';
    const step2Class = step2Completed ? 'stepper-step completed' : (step1Completed ? 'stepper-step active' : 'stepper-step');
    const step3Class = step3Completed ? 'stepper-step completed' : (step3Failed ? 'stepper-step failed' : (step2Completed ? 'stepper-step active' : 'stepper-step'));

    const line1Class = step2Completed ? 'stepper-line completed' : (step1Completed ? 'stepper-line active' : 'stepper-line');
    const line2Class = step3Completed ? 'stepper-line completed' : (step2Completed ? 'stepper-line active' : 'stepper-line');
    
    let compactStatusClass = 'connection-status-compact';
    let compactStatusText = 'Disconnected';
    if (googleUser) {
      compactStatusClass += ' google-connected';
      compactStatusText = 'Google Connected';
      if (workspaceConnected) {
        compactStatusClass = 'connection-status-compact workspace-connected';
        compactStatusText = 'Workspace Connected';
        if (this.landingSyncState === 'syncing') {
          compactStatusClass = 'connection-status-compact syncing';
          compactStatusText = 'Syncing Data...';
        } else if (this.landingSyncState === 'ready') {
          compactStatusClass = 'connection-status-compact ready';
          compactStatusText = 'Sync Ready';
        } else if (this.landingSyncState === 'failed') {
          compactStatusClass = 'connection-status-compact failed';
          compactStatusText = 'Sync Failed';
        }
      }
    }

    let primaryBtnText = 'Continue with Google';
    let primaryBtnAction = 'app.handlePrimaryLandingAction()';
    if (googleUser) {
      if (!workspaceConnected) {
        primaryBtnText = 'Connect Workspace';
        primaryBtnAction = 'app.landingConnectWorkspace()';
      } else if (this.landingSyncState === 'idle' || this.landingSyncState === 'failed') {
        primaryBtnText = this.landingSyncState === 'failed' ? 'Retry Sync' : 'Sync Data';
        primaryBtnAction = 'app.landingSyncData()';
      } else if (this.landingSyncState === 'syncing') {
        primaryBtnText = 'Syncing Data...';
        primaryBtnAction = '';
      } else if (this.landingSyncState === 'ready') {
        primaryBtnText = 'Enter Growth OS';
        primaryBtnAction = 'app.handlePrimaryLandingAction()';
      }
    }
    
    let accountHtml = `
      <button class="topbar-btn-primary" onclick="app.landingSignIn()" style="font-size: 12px; padding: 8px 16px; cursor: pointer; border-radius: var(--radius);">Continue with Google</button>
    `;
    if (googleUser) {
      accountHtml = `
        <div class="landing-profile-wrapper" onclick="event.stopPropagation(); app.toggleLandingDropdown()">
          <div class="landing-avatar">${googleUser.avatarInitials}</div>
          <div class="landing-profile-info">
            <div class="landing-profile-name">${googleUser.displayName}</div>
            <div class="landing-profile-email">${googleUser.email}</div>
          </div>
          <span class="landing-profile-chevron">▼</span>
          <div class="landing-account-dropdown" id="landing-account-dropdown">
            <div class="dropdown-header">
              <div class="dropdown-user-name">${googleUser.displayName}</div>
              <div class="dropdown-user-email">${googleUser.email}</div>
            </div>
            <div class="dropdown-divider"></div>
            <button class="landing-dropdown-item" onclick="app.showToast('Account Settings clicked', 'info')">Account Settings</button>
            <button class="landing-dropdown-item" onclick="app.showToast('Workspace Settings clicked', 'info')">Workspace Settings</button>
            <button class="landing-dropdown-item" onclick="app.showToast('Sync Status clicked', 'info')">Sync Status</button>
            <div class="dropdown-divider"></div>
            <button class="landing-dropdown-item signout-btn" onclick="app.landingSignOut()">Sign Out</button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="landing-container">
        <header class="landing-header">
          <div class="landing-logo-block">
            <div class="logo-icon">G</div>
            <span class="logo-name">Growth OS</span>
          </div>
          <div class="landing-nav" style="display: flex; align-items: center; gap: var(--space-5);">
            <a href="#" class="landing-nav-link" onclick="event.preventDefault(); document.getElementById('features-section').scrollIntoView({behavior: 'smooth'})">Features</a>
            <a href="#" class="landing-nav-link" onclick="event.preventDefault(); document.getElementById('connection-card').scrollIntoView({behavior: 'smooth'})">How It Works</a>
            <div id="landing-account-area" class="landing-account-area">
              ${accountHtml}
            </div>
          </div>
        </header>

        <section class="landing-hero-section">
          <div class="landing-grid">
            <div class="landing-left-col">
              <h2 class="landing-headline">Run everything from one operating system.</h2>
              <p class="landing-supporting-text">Manage tasks, projects, leads, content, operations, and goals—all in one connected workspace.</p>
              
              <div class="gos-section-card" id="connection-card" style="margin-top: 12px; width: 100%;">
                <div class="gos-section-card-header">
                  <span class="gos-section-card-title">🔑 Start where you left off</span>
                </div>
                <div class="gos-section-card-body" style="padding: 20px;">
                  <div class="stepper-container">
                    <div class="${step1Class}">
                      <div class="step-circle">${step1Icon}</div>
                      <div class="step-label">Google Account</div>
                      <div class="step-status">${step1Completed ? 'Connected' : 'Disconnected'}</div>
                    </div>
                    <div class="${line1Class}"></div>
                    <div class="${step2Class}">
                      <div class="step-circle">${step2Icon}</div>
                      <div class="step-label">Connect Workspace</div>
                      <div class="step-status">${step2Completed ? 'Connected' : (step1Completed ? 'Pending' : 'Locked')}</div>
                    </div>
                    <div class="${line2Class}"></div>
                    <div class="${step3Class}">
                      <div class="step-circle">${step3Icon}</div>
                      <div class="step-label">Sync and Enter</div>
                      <div class="step-status">${step3Completed ? 'Sync Ready' : (step3Failed ? 'Sync Failed' : (step2Completed ? (step3Syncing ? 'Syncing...' : 'Pending') : 'Locked'))}</div>
                    </div>
                  </div>
                  
                  ${this.landingSyncError ? `
                    <div class="connection-error-box" style="margin-bottom: 16px;">
                      <strong>Sync Error:</strong> ${this.landingSyncError}
                    </div>
                  ` : ''}
                  
                  <div class="${compactStatusClass}" id="connection-status-compact" style="margin-bottom: 20px;">
                    <span class="status-dot"></span>
                    <span class="status-text">${compactStatusText}</span>
                  </div>

                  <div class="connection-actions-area" style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="topbar-btn-primary" id="btn-primary-action" onclick="${primaryBtnAction}" style="width:100%; justify-content:center; padding:12px; font-weight:600; cursor:pointer;" ${this.landingSyncState === 'syncing' ? 'disabled' : ''}>
                      ${primaryBtnText}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Dashboard Preview -->
            <div class="landing-right-col">
              <div class="preview-browser-frame">
                <div class="browser-header">
                  <span class="browser-dot red"></span>
                  <span class="browser-dot yellow"></span>
                  <span class="browser-dot green"></span>
                  <span class="browser-url">growth-os.prime/app</span>
                </div>
                <div class="browser-content-mock">
                  <!-- Simulated dashboard rendering -->
                  <div class="mock-sidebar">
                    <div class="mock-logo">G</div>
                    <div class="mock-nav-item active"></div>
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                  </div>
                  <div class="mock-main">
                    <div class="mock-topbar">
                      <div class="mock-title-block">
                        <div class="mock-title">Growth OS Dashboard</div>
                        <div class="mock-subtitle">Your unified business workspace</div>
                      </div>
                      <div class="mock-avatar">GV</div>
                    </div>
                    <div class="mock-content">
                      <!-- Top Row Widgets -->
                      <div class="mock-grid-3">
                        <!-- 1. Tasks Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">📝 Tasks</div>
                          <div class="mock-task-item"><span class="mock-dot-bullet green"></span><span>Design Homepage UI</span></div>
                          <div class="mock-task-item"><span class="mock-dot-bullet yellow"></span><span>Sheets sync test</span></div>
                          <div class="mock-task-item completed"><span class="mock-dot-bullet grey"></span><span>Onboard Gelo</span></div>
                        </div>
                        <!-- 2. Projects Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">📁 Projects</div>
                          <div class="mock-project-item">
                            <div class="mock-project-info"><span>Codex CRM</span><span class="mock-percent">35%</span></div>
                            <div class="mock-project-bar"><div class="mock-project-fill" style="width: 35%;"></div></div>
                          </div>
                          <div class="mock-project-item">
                            <div class="mock-project-info"><span>Plus Size Campaign</span><span class="mock-percent">70%</span></div>
                            <div class="mock-project-bar"><div class="mock-project-fill" style="width: 70%;"></div></div>
                          </div>
                        </div>
                        <!-- 3. CRM Pipeline Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">👤 CRM Pipeline</div>
                          <div class="mock-crm-item"><span>Leads Active:</span> <strong>12</strong></div>
                          <div class="mock-crm-item"><span>Proposal:</span> <strong>₱120k</strong></div>
                          <div class="mock-crm-item"><span>Won:</span> <strong>₱350k</strong></div>
                        </div>
                      </div>
                      <!-- Bottom Row Widgets -->
                      <div class="mock-grid-3">
                        <!-- 4. Content Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">🚀 Content</div>
                          <div class="mock-content-item"><span>Mon: Growth OS</span> <span class="mock-badge green">Active</span></div>
                          <div class="mock-content-item"><span>Wed: Workflows</span> <span class="mock-badge yellow">Draft</span></div>
                        </div>
                        <!-- 5. Operations Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">⚙️ Operations</div>
                          <div class="mock-ops-item"><span>Backup Check</span> <span class="mock-check">✔</span></div>
                          <div class="mock-ops-item"><span>Client Reports</span> <span class="mock-check">✔</span></div>
                        </div>
                        <!-- 6. Goals Widget -->
                        <div class="mock-widget">
                          <div class="mock-widget-header">🎯 Goals</div>
                          <div class="mock-goal-item">
                            <div class="mock-goal-info"><span>Reach $10k MRR</span><span>80%</span></div>
                            <div class="mock-goal-bar"><div class="mock-goal-fill" style="width: 80%;"></div></div>
                          </div>
                          <div class="mock-goal-item">
                            <div class="mock-goal-info"><span>Publish 12 posts</span><span>50%</span></div>
                            <div class="mock-goal-bar"><div class="mock-goal-fill" style="width: 50%;"></div></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Feature Cards Summary -->
        <section class="landing-features-section" id="features-section">
          <div class="features-grid">
            <!-- Feature 1 -->
            <div class="gos-section-card">
              <div class="gos-section-card-header">
                <span class="gos-section-card-title">📝 Project Management</span>
              </div>
              <div class="gos-section-card-body" style="padding: 16px;">
                <p class="feature-card-desc">Plan, track, and manage projects, tasks, timelines, and progress.</p>
              </div>
            </div>
            <!-- Feature 2 -->
            <div class="gos-section-card">
              <div class="gos-section-card-header">
                <span class="gos-section-card-title">👤 CRM and Sales</span>
              </div>
              <div class="gos-section-card-body" style="padding: 16px;">
                <p class="feature-card-desc">Manage leads, pipeline stages, calls, follow-ups, and clients.</p>
              </div>
            </div>
            <!-- Feature 3 -->
            <div class="gos-section-card">
              <div class="gos-section-card-header">
                <span class="gos-section-card-title">🚀 Content and Operations</span>
              </div>
              <div class="gos-section-card-body" style="padding: 16px;">
                <p class="feature-card-desc">Manage content schedules, recurring tasks, workflows, and deliverables.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }
}

// ── Initialize ────────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new GeloGrowthOS();
  app.updateNavBadge();

  // Auto-connect to Google Sheets on startup if configured and not explicitly disconnected
  const savedUrl = settingsEngine.get().sheets.webAppUrl;
  if (savedUrl && typeof SHEETS_CONFIG !== 'undefined') SHEETS_CONFIG.WEBAPP_URL = savedUrl;

  if (sheetsService.isConfigured() && localStorage.getItem('gos_sheets_connected') !== 'false') {
    app.connectSheets();
  }
});

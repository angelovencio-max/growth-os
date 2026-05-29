// ============================================================
// Gelo Growth OS — Core Application v2
// State management, rendering, filtering, scoring, CRUD
// + Settings Engine, new views, mobile-first navigation
// ============================================================

// Module ID → internal view type mapping (keeps all existing logic intact)
const MODULE_TO_VIEW = {
  today:          'command-center',
  calendar:       'calendar',
  leads:          'linkedin',
  messages:       'messages',
  salesPipeline:  'prime',
  brandCommunity: 'scc',
  productsOrders: 'calmera',
  content:        'repurposing',
  settings:       'settings',
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

    // Init
    this.loadData();
    this.bindEvents();
    this._initApp();
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

    // Render the first view
    this.render();
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

  // ── Build Navigation from Settings ──────────────────────────
  buildNavigation() {
    const settings = settingsEngine.get();
    const modules  = settingsEngine.getVisibleModules();

    // Build sidebar nav
    const nav = document.getElementById('sidebar-nav');
    if (nav) {
      nav.innerHTML = modules.map(mod => `
        <button class="gos-nav-item ${this.currentModule === mod.id ? 'active' : ''}" 
                data-module="${mod.id}"
                onclick="app.navigateTo('${mod.id}')"
                title="${mod.label}">
          <span class="nav-item-icon">${getIconSvg(MODULE_ICON_MAP[mod.id] || 'info', 18)}</span>
          <span class="nav-item-label">${mod.label}</span>
          ${mod.id === 'today' ? '<span class="nav-item-badge" id="nav-badge-overdue" style="display:none">0</span>' : ''}
        </button>
      `).join('');
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
      const drawerMods = modules.filter(m => DRAWER_MODULES.includes(m.id));
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
  loadData() {
    // Use demo data (or Sheets data when connected)
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
        Object.assign(options, { 'New': 'New', 'Qualified': 'Qualified', 'Contacted': 'Contacted', 'Nurturing': 'Nurturing', 'Converted': 'Converted', 'Recycle': 'Recycle', 'Closed': 'Closed' });
        break;
      case 'prime':
        Object.assign(options, { 'New Inquiry': 'New Inquiry', 'Qualified': 'Qualified', 'Discovery': 'Discovery', 'Proposal Sent': 'Proposal Sent', 'Negotiation': 'Negotiation', 'Won': 'Won', 'Lost': 'Lost', 'Handoff': 'Handoff' });
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
    const content = document.getElementById('main-content');
    if (!content) return;

    content.className = 'gos-content animate-fade-in';

    switch (this.currentView) {
      case 'command-center': this.renderToday(content); break;
      case 'calendar':       this.renderCalendar(content); break;
      case 'linkedin':       this.renderLinkedIn(content); break;
      case 'messages':       this.renderMessagesPage(content); break;
      case 'prime':          this.renderPrime(content); break;
      case 'scc':            this.renderSCC(content); break;
      case 'calmera':        this.renderCalmera(content); break;
      case 'repurposing':    this.renderRepurposing(content); break;
      case 'settings':       this.renderSettings(content); break;
      default:               this.renderToday(content);
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
    const leads = this.data.linkedinLeads || [];
    const pipeline = this.data.primePipeline || [];
    const tasks = this.data.tasks || [];
    const events = this.gatherCalendarEvents();

    // 1. Calculations
    const followUpsToday = leads.filter(l => l.nextActionDate === todayStr && !['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage)).length;
    
    // Converted leads are those with stage Qualified, Call Booked, Proposal, Negotiation, Closed Won, Closed Lost or pipeline opportunity
    const convertedCount = leads.filter(l => ['Qualified', 'Call Booked', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].includes(l.stage) || l.convertedToPipeline === 'Yes' || pipeline.some(p => String(p.sourceLeadId) === String(l.leadId))).length;
    
    const overdueFollowUps = leads.filter(l => l.nextActionDate && l.nextActionDate < todayStr && !['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage)).length;
    
    const activeLeads = leads.filter(l => !['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage));
    const projectedValue = activeLeads.reduce((s, l) => s + (l.projectedCloseAmount || 0), 0);

    // 2. Today's Actions List (Based on Requirement 6)
    const todayActionsList = leads.filter(l => {
      // Unpaid or Partial payment leads need daily operational focus
      if (['Unpaid', 'Partial'].includes(l.paymentStatus)) {
        return true;
      }
      
      // If it is closed, don't show it in outreach
      if (['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage)) {
        return false;
      }
      
      const isPipelineReady = ['Qualified', 'Call Booked', 'Proposal', 'Negotiation'].includes(l.stage);
      const isFollowUpDue = l.nextActionDate && l.nextActionDate <= todayStr;
      
      return isFollowUpDue || isPipelineReady;
    }).sort((a, b) => {
      if (a.nextActionDate !== b.nextActionDate) {
        if (!a.nextActionDate) return 1;
        if (!b.nextActionDate) return -1;
        return a.nextActionDate < b.nextActionDate ? -1 : 1;
      }
      return (b.projectedCloseAmount || 0) - (a.projectedCloseAmount || 0);
    });

    // 3. Today's Calendar events
    const todayEvents = events.filter(e => e.date === todayStr);
    const overdueEvents = events.filter(e => {
      const isBefore = e.date < todayStr;
      const isPending = !['Done', 'Completed', 'Cancelled', 'Rescheduled', 'Confirmed', 'Closed', 'Won', 'Lost', 'Closed Won', 'Closed Lost'].includes(e.status);
      return isBefore && isPending;
    });
    
    const nextTask = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled' && t.dueAt >= todayStr)
      .sort((a, b) => a.dueAt < b.dueAt ? -1 : 1)[0];

    // 4. Render Layout
    container.innerHTML = `
      <!-- Part 4 & 5: Hero Header + Weather Widget -->
      ${this.renderHeroHeader()}

      <!-- Part 6: Priority Cards Grid -->
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card" onclick="app.navigateTo('leads')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Follow-ups Today</span>
            <span class="gos-kpi-icon">${getIconSvg('calendar', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${followUpsToday}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Outreach actions scheduled today</div>
        </div>

        <div class="gos-kpi-card" onclick="app.navigateTo('leads')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Converted Leads</span>
            <span class="gos-kpi-icon">${getIconSvg('award', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${convertedCount}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Leads progressed to pipeline or won</div>
        </div>

        <div class="gos-kpi-card" onclick="app.navigateTo('leads')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Overdue Follow-ups</span>
            <span class="gos-kpi-icon">${getIconSvg('alert', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">${overdueFollowUps}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Leads with due dates in the past</div>
        </div>

        <div class="gos-kpi-card" onclick="app.navigateTo('salesPipeline')">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Active Value</span>
            <span class="gos-kpi-icon">${getIconSvg('dollarSign', 18)}</span>
          </div>
          <div class="gos-kpi-value-wrapper">
            <div class="gos-kpi-value">₱${this.formatNumber(projectedValue)}</div>
            <div class="gos-kpi-arrow">→</div>
          </div>
          <div class="gos-kpi-detail">Total close value of active leads</div>
        </div>
      </div>

      <!-- Today's Schedule and Command Grid -->
      <div class="gos-section-grid">
        
        <!-- Part 7: Today's Calendar aggregates -->
        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📅 Today's Calendar & Aggregates</span>
          </div>
          <div class="gos-section-card-body">
            <div class="schedule-summary-box">
              ${todayEvents.length === 0 && overdueEvents.length === 0 && !nextTask ? `
                <div class="gos-empty" style="padding:40px 20px">
                  <span class="gos-empty-icon">☕</span>
                  <span class="gos-empty-title">Your schedule is clear today</span>
                  <span class="gos-empty-desc">Take some time to network or plan content.</span>
                </div>
              ` : `
                <ul class="gos-task-list">
                  <!-- Scheduled Calls Today -->
                  ${todayEvents.filter(e => e.type.toLowerCase().includes('call') || e.status === 'Call Booked').map(e => `
                    <li class="gos-task-item event-call" onclick="app.openRecordPanel('${e.viewType}', '${e.id}')">
                      <span class="task-badge-icon">📞</span>
                      <div class="gos-task-info">
                        <div class="gos-task-title">Call: ${e.name}</div>
                        <div class="gos-task-meta">
                          <span>${e.time}</span>
                          ${this.renderBadge(e.priority)}
                          <span>${settingsEngine.getModuleLabel(VIEW_TO_MODULE[e.viewType])}</span>
                        </div>
                      </div>
                    </li>
                  `).join('')}

                  <!-- Scheduled Follow-ups Today -->
                  ${todayEvents.filter(e => e.type === 'Follow-up').map(e => `
                    <li class="gos-task-item event-followup" onclick="app.openRecordPanel('${e.viewType}', '${e.id}')">
                      <span class="task-badge-icon">✉️</span>
                      <div class="gos-task-info">
                        <div class="gos-task-title">Follow-up: ${e.name}</div>
                        <div class="gos-task-meta">
                          <span>${e.time}</span>
                          ${this.renderBadge(e.priority)}
                          <span>${e.nextAction}</span>
                        </div>
                      </div>
                    </li>
                  `).join('')}

                  <!-- Overdue Actions -->
                  ${overdueEvents.slice(0, 3).map(e => `
                    <li class="gos-task-item overdue" onclick="app.openRecordPanel('${e.viewType}', '${e.id}')">
                      <span class="task-badge-icon text-red">⚠️</span>
                      <div class="gos-task-info">
                        <div class="gos-task-title">Overdue: ${e.name}</div>
                        <div class="gos-task-meta">
                          <span class="text-red font-bold">Due ${e.date}</span>
                          <span>${e.type}</span>
                          ${this.renderBadge(e.priority)}
                        </div>
                      </div>
                    </li>
                  `).join('')}

                  <!-- Next Upcoming Manual Task -->
                  ${nextTask ? `
                    <li class="gos-task-item next-task" onclick="app.openTaskPanel('${nextTask.taskId}')">
                      <span class="task-badge-icon">📝</span>
                      <div class="gos-task-info">
                        <div class="gos-task-title">Next Task: ${nextTask.title}</div>
                        <div class="gos-task-meta">
                          <span class="${isOverdue(nextTask.dueAt) ? 'text-red font-bold' : ''}">Due ${nextTask.dueAt}</span>
                          ${this.renderBadge(nextTask.priority)}
                        </div>
                      </div>
                    </li>
                  ` : ''}
                </ul>
              `}
            </div>
          </div>
        </div>

        <!-- Today's Action Center & Table / Mobile Cards -->
        <div class="gos-section-card" style="grid-column: span 2">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">🔥 Today's Action Center</span>
            <span class="gos-table-count">${todayActionsList.length} leads</span>
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
                                ${isOverdueVal ? '⚠️ ' : ''}${l.nextActionDate}
                              </span>
                            ` : '—'}
                          </td>
                          <td class="cell-right font-semibold">₱${(l.projectedCloseAmount || 0).toLocaleString()}</td>
                          <td class="cell-right">
                            <div class="gos-row-actions">
                              <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.openMessageForRecord('linkedin', '${l.leadId}')" title="Generate customized message">💬 Msg</button>
                              <button class="gos-btn btn-sm btn-ghost" onclick="event.stopPropagation(); app.copyMessageDirectly('linkedin', '${l.leadId}')" title="Copy default follow-up directly">📋 Copy</button>
                              <button class="gos-btn btn-sm btn-primary" onclick="event.stopPropagation(); app.markEventCompleted('linkedin', '${l.leadId}')" title="Mark action completed">✓ Done</button>
                              <button class="gos-btn btn-sm btn-secondary" onclick="event.stopPropagation(); app.openRecordPanel('linkedin', '${l.leadId}')" title="View details panel">⋯ More</button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Mobile Stacked Card View (viewport < 768px) -->
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
                        <div style="margin-top:6px; font-size:11px; display:flex; gap:6px; align-items:center;">
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

      </div>
    `;
  }

  renderTaskItem(task) {
    const due = daysUntil(task.dueAt);
    const overdueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : '';
    const dueLabel = due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d left`;
    const dueClass = due < 0 ? 'overdue' : due === 0 ? 'due-today' : due <= 3 ? 'due-soon' : 'due-later';

    return `
      <li class="gos-task-item ${overdueClass}" onclick="app.openTaskPanel('${task.taskId}')">
        <div class="gos-task-check ${task.status === 'Completed' ? 'checked' : ''}" onclick="event.stopPropagation(); app.toggleTask('${task.taskId}')"></div>
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
    const activeLeads = leads.filter(l => !['Closed Won', 'Closed Lost', 'Not Fit'].includes(l.stage));
    const noAction = activeLeads.filter(l => isOverdue(l.nextActionDate));
    const totalProjected = activeLeads.reduce((s, l) => s + (l.projectedCloseAmount || 0), 0);
    const convertedCount = leads.filter(l => ['Qualified', 'Call Booked', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].includes(l.stage) || l.convertedToPipeline === 'Yes' || this.data.primePipeline.some(p => String(p.sourceLeadId) === String(l.leadId))).length;

    const dataTableContent = this.renderDataTable(this.filteredData, [
      { key: 'contactName', label: 'Name', editable: true, editType: 'text', render: (v) => `<span class="cell-name clickable-edit-name">${v || '—'}</span>` },
      { key: 'company', label: 'Company / Brand', editable: true, editType: 'text' },
      { key: 'mobile', label: 'Phone Number', editable: true, editType: 'text' },
      { key: 'email', label: 'Email Address', editable: true, editType: 'text' },
      { key: 'source', label: 'Source', editable: true, editType: 'select', editOptions: ['LinkedIn', 'Facebook', 'Instagram', 'Network', 'Referral', 'Website', 'Other'] },
      { key: 'linkedinUrl', label: 'Profile / URL', editable: true, editType: 'text', render: (v) => v ? `<a href="${v.startsWith('http') ? v : 'https://' + v}" target="_blank" class="gos-link" onclick="event.stopPropagation()">${v.replace(/https?:\/\/(www\.)?/, '')}</a>` : '—' },
      { key: 'stage', label: 'Stage', editable: true, editType: 'select', editOptions: ['New', 'Contacted', 'Qualified', 'Call Booked', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost', 'Not Fit'] },
      { key: 'nextAction', label: 'Next Action', editable: true, editType: 'select', editOptions: ['Send first message', 'Follow up', 'Book discovery call', 'Send proposal', 'Prepare call notes', 'Check payment', 'Mark as not fit', 'Custom'], render: (v) => `<span class="truncate" style="max-width:150px;display:inline-block">${v || '—'}</span>` },
      { key: 'nextActionDate', label: 'Follow-up Date', editable: true, editType: 'date', render: (v) => this.renderDueDate(v) },
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
          <div class="gos-kpi-header"><span class="gos-kpi-label">Converted</span><span class="gos-kpi-icon">${getIconSvg('award', 18)}</span></div>
          <div class="gos-kpi-value">${convertedCount}</div>
          <div class="gos-kpi-detail">${convertedCount} converted opportunities</div>
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
    const convertedCount = pipeline.filter(p => p.sourceLeadId).length;

    const totalPaid = pipeline.filter(p => p.paymentStatus === 'Paid').reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWonPending = pipeline.filter(p => p.stage === 'Closed Won' && p.paymentStatus !== 'Paid').reduce((s, p) => s + (p.estimatedValue || 0), 0);
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
          <div class="gos-kpi-header"><span class="gos-kpi-label">Converted</span><span class="gos-kpi-icon">${getIconSvg('award', 18)}</span></div>
          <div class="gos-kpi-value">${convertedCount}</div>
          <div class="gos-kpi-detail">${convertedCount} converted opportunities</div>
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
        { key: 'stage', label: 'Stage', editable: true, editType: 'select', editOptions: ['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff', 'Closed Won', 'Closed Lost'] },
        { key: 'dealStatus', label: 'Deal Status', editable: true, editType: 'select', editOptions: ['Open', 'In Progress', 'Won', 'Lost', 'Paid', 'Closed'], render: (v) => this.renderBadge(v) },
        { key: 'paymentStatus', label: 'Payment', editable: true, editType: 'select', editOptions: ['Unpaid', 'Partial', 'Paid', 'Refunded', 'Cancelled'], render: (v) => this.renderBadge(v) },
        { key: 'estimatedValue', label: 'Value', editable: true, editType: 'number', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'probabilityPercent', label: 'Prob.', editable: true, editType: 'number', render: (v) => `${v || 0}%` },
        { key: 'nextAction', label: 'Next Action', editable: true, editType: 'text', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Due', editable: true, editType: 'date', render: (v) => this.renderDueDate(v) },
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
        { key: 'plannedPublishAt', label: 'Publish Date', render: (v) => this.renderDueDate(v) },
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
              const rowCells = columns.map(col => {
                let content = col.render ? col.render(record[col.key], record) : (record[col.key] || '—');
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
            const mainTitle = record.contactName || 'No Name';
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

          const mainTitle = record.contactName || record.title || record.customerName || 'No Name';
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
  renderDueDate(dateStr) {
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

    return `<span class="gos-due ${cls}">${icon} ${label}</span>`;
  }

  // ── Detail Panel ────────────────────────────────────────────
  openRecordPanel(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId' },
      'scc': { data: this.data.sccContent, idKey: 'contentId' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId' },
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
    const task = this.data.tasks.find(t => t.taskId === taskId);
    if (!task) return;

    this.selectedRecord = { viewType: 'task', record: task };

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('panel-overlay');
    const panelFooter = document.getElementById('panel-footer');
    document.getElementById('panel-title').textContent = 'Task Details';
    document.getElementById('panel-body').innerHTML = `
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Task Information</div>
        ${this.renderField('Title', task.title)}
        ${this.renderField('Priority', this.renderBadge(task.priority))}
        ${this.renderField('Status', this.renderBadge(task.status))}
        ${this.renderField('Due Date', this.renderDueDate(task.dueAt))}
        ${this.renderField('Type', task.taskType)}
        ${this.renderField('Related To', `${task.recordType} — ${task.recordId}`)}
        ${this.renderField('Assigned To', task.assignedTo)}
        ${this.renderField('Notes', task.notes)}
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
      await this.syncLeadAndOpportunity(viewType, recordId);
    } else {
      this.showToast('⚡ Saving changes...', 'info');
      try {
        await sheetsService.updateRecord(config.tabKey, record._rowIndex, record);
        this.showToast('✅ Saved to Google Sheets', 'success');
        this.syncStatus = 'Synced';
        this.syncError = null;
      } catch (err) {
        this.showToast('⚠️ Sync failed. Saved locally only.', 'warning');
        console.error(err);
        this.syncStatus = 'Error';
        this.syncError = err.message || err;
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
    lead.stage = 'Converted';

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
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc': { data: this.data.sccContent, idKey: 'contentId', tabKey: 'sccContent' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId', tabKey: 'calmeraOrders' },
      'repurposing': { data: this.data.repurposeOutputs, idKey: 'outputId', tabKey: 'repurposeOutputs' },
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

    // Run denormalize locally to immediately update view properties (like contactName and company)
    sheetsService._denormalize(this.data);

    // Refresh CRM views and reopen panel in view mode
    this.applyFilters();
    this.render();
    this.openRecordPanel(viewType, record[config.idKey]);
    this.showToast('Changes saved locally!', 'success');

    // Sync in background to Sheets (if connected)
    if (this.sheetsConnected) {
      const rowIndex = record._rowIndex;
      if (rowIndex !== undefined) {
        try {
          // Write/Update the Main Record
          await sheetsService.updateRecord(config.tabKey, rowIndex, record);
          
          // Write/Update Contact
          if (contactToSave) {
            if (isNewContact) {
              await sheetsService.appendRecord('contacts', contactToSave)
                .then(res => { if (res && res.rowsAfter !== undefined) contactToSave._rowIndex = res.rowsAfter - 1; });
            } else if (contactToSave._rowIndex !== undefined) {
              await sheetsService.updateRecord('contacts', contactToSave._rowIndex, contactToSave);
            }
          }
          
          // Write/Update Organization
          if (orgToSave) {
            if (isNewOrg) {
              await sheetsService.appendRecord('organizations', orgToSave)
                .then(res => { if (res && res.rowsAfter !== undefined) orgToSave._rowIndex = res.rowsAfter - 1; });
            } else if (orgToSave._rowIndex !== undefined) {
              await sheetsService.updateRecord('organizations', orgToSave._rowIndex, orgToSave);
            }
          }

          this.showToast('📤 Saved to Google Sheets', 'success');
        } catch (err) {
          console.error('Sheet update failed:', err);
          this.showToast('⚠️ Saved locally, but failed to sync to Google Sheets. Check your Apps Script deployment!', 'warning');
        }
      } else {
        this.showToast('⚠️ Sheet row index not found. Saved only locally.', 'warning');
      }
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
      'linkedin':   { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime':      { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc':        { data: this.data.sccContent, idKey: 'contentId', tabKey: 'sccContent' },
      'calmera':    { data: this.data.calmeraOrders, idKey: 'orderId', tabKey: 'calmeraOrders' },
      'repurposing':{ data: this.data.repurposeOutputs, idKey: 'outputId', tabKey: 'repurposeOutputs' },
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

    this.closePanel();
    this.applyFilters();
    this.render();
    this.showToast('Record deleted locally!', 'success');

    if (this.sheetsConnected && rowIndex !== undefined) {
      try {
        await sheetsService.deleteRecord(config.tabKey, rowIndex);
        this.showToast('🗑️ Deleted from Google Sheets', 'success');
      } catch (err) {
        this.showToast('⚠️ Deleted locally, but Google Sheets delete failed.', 'warning');
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
                    ${['New', 'Contacted', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost', 'Not Fit', 'Connection Sent', 'Connected', 'Thank You Sent', 'Follow-up Due', 'Replied', 'Call Booked', 'Call Done'].map(opt => `
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
                    ${['Inquiry', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].map(opt => `
                      <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Deal Status</label>
                  <select class="gos-form-select" name="dealStatus">
                    ${['Open', 'In Progress', 'Won', 'Lost', 'Paid'].map(opt => `
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

              <div class="gos-form-group">
                <label class="gos-form-label">Action Due Date</label>
                <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
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

              <div class="gos-form-group">
                <label class="gos-form-label">Planned Publish Date</label>
                <input class="gos-form-input" type="date" name="plannedPublishAt" value="${r.plannedPublishAt || ''}">
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
    const overlay   = document.getElementById('add-modal-overlay');
    const formFields = document.getElementById('add-form-fields');
    const titleEl   = document.getElementById('add-modal-title');

    const viewTitles = {
      linkedin:   'Add New Lead', prime:      'Add New Opportunity',
      scc:        'Add New Content', calmera:  'Add New Order',
      repurposing:'Add New Output',  settings: '',
      'command-center': 'Add New Lead', calendar: 'Add New Lead',
      messages:   'Add New Lead',
    };
    if (titleEl) titleEl.textContent = viewTitles[this.currentView] || 'Add New Record';
    if (formFields) formFields.innerHTML = this.getAddFormFields();
    if (overlay) overlay.style.display = 'flex';
  }

  closeModal(modalId) {
    if (modalId === 'add-modal') {
      const el = document.getElementById('add-modal-overlay');
      if (el) el.style.display = 'none';
    } else {
      const el = document.getElementById('msg-modal-overlay');
      if (el) el.style.display = 'none';
    }
  }

  getAddFormFields() {
    switch (this.currentView) {
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
              <option>Contacted</option>
              <option>Qualified</option>
              <option>Proposal</option>
              <option>Closed Won</option>
              <option>Closed Lost</option>
              <option>Not Fit</option>
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
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction"></div>
          <div class="gos-form-group"><label class="gos-form-label">Action Due Date</label><input class="gos-form-input" name="nextActionDate" type="date"></div>
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
        <div class="gos-form-group"><label class="gos-form-label">CTA</label><input class="gos-form-input" name="cta" placeholder="Call to action"></div>
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

    switch (this.currentView) {
      case 'linkedin': {
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
          views: 0, comments: 0, saves: 0, replies: 0,
          repurposeFlag: 'FALSE',
          sourceId: '',
          ownerId: 'Gelo',
          publishedAt: '', publishedUrl: '', draftUrl: '', assetUrl: '',
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
    }

    this.closeModal('add-modal');
    form.reset();

    // Map relational display names locally (so that names show in lists instantly!)
    sheetsService._denormalize(this.data);

    this.applyFilters();
    this.renderContent();
    this.showToast('Record added successfully!', 'success');

    // Write to Google Sheets in background (if connected)
    if (this.sheetsConnected && newRecord) {
      const tabMap = {
        'linkedin': 'linkedinLeads',
        'prime': 'primePipeline',
        'scc': 'sccContent',
        'calmera': 'calmeraOrders',
      };
      const tabKey = tabMap[this.currentView];
      if (tabKey) {
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
            this.showToast('📤 Saved to Google Sheets', 'success');
          })
          .catch(err => {
            console.error('Sheet write failed:', err);
            this.showToast('⚠️ Saved locally, but Sheet write failed.', 'warning');
          });
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
      task.status = task.status === 'Completed' ? 'Open' : 'Completed';
      task.completedAt = task.status === 'Completed' ? getDemoToday() : '';
      this.renderContent();
      this.showToast(
        task.status === 'Completed' ? 'Task completed! ✅' : 'Task reopened',
        task.status === 'Completed' ? 'success' : 'info'
      );
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
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `gos-toast ${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-text">${message}</span>
      <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:0 0 0 8px;font-size:16px;line-height:1" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  // ── Helpers ─────────────────────────────────────────────────
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
        return;
      }

      sheetsService.signIn();

      // Load data from Sheets
      await this.refreshFromSheets();

    } catch (err) {
      console.error('Connection error:', err);
      this.showToast('Failed to connect: ' + (err.message || 'Unknown error'), 'error');
      this.updateConnectionUI('demo');
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

      // Use Sheets data directly (empty arrays if a sheet tab is empty)
      this.data = {
        contacts: sheetsData.contacts || [],
        organizations: sheetsData.organizations || [],
        linkedinLeads: sheetsData.linkedinLeads || [],
        primePipeline: sheetsData.primePipeline || [],
        sccContent: sheetsData.sccContent || [],
        calmeraOrders: sheetsData.calmeraOrders || [],
        sourceAssets: sheetsData.sourceAssets || [],
        repurposeOutputs: sheetsData.repurposeOutputs || [],
        interactions: sheetsData.interactions || [],
        tasks: sheetsData.tasks || [],
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
        const parts = t.dueAt.split(/[ T]/);
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
    const isCompleted = ['Done', 'Completed', 'Confirmed', 'Closed', 'Won'].includes(ev.status);
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

    // 2. Category filter (this._calCatFilter)
    if (this._calCatFilter !== 'all') {
      filtered = filtered.filter(ev => ev.category === this._calCatFilter);
    }

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

    const catFilters = [
      { id: 'all', label: 'All Categories' },
      ...settingsEngine.getAllCategories().map(c => ({ id: c.id, label: c.label }))
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
        <select class="topbar-filter" onchange="app._setCalCatFilter(this.value)">
          ${catFilters.map(f => `<option value="${f.id}" ${this._calCatFilter === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}
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

  _setCalCatFilter(cat) {
    this._calCatFilter = cat;
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
                opp._rowIndex = res.rowIndex;
              }
            }
            await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
            this.showToast('📤 Lead & Pipeline Synced to Google Sheets!', 'success');
            this.syncStatus = 'Synced';
            this.syncError = null;
            this.lastSynced = new Date().toLocaleString();
            localStorage.setItem('gos_last_synced', this.lastSynced);
          } catch (err) {
            console.error('Failed to sync opportunity in syncLeadAndOpportunity:', err);
            this.showToast('⚠️ Sheet sync failed. Saved locally.', 'warning');
            this.syncStatus = 'Error';
            this.syncError = err.message || err;
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
          if (this.sheetsConnected && opp._rowIndex !== undefined) {
            try {
              await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
              await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              this.showToast('📤 Lead & Pipeline Synced to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
            } catch(err) {
              console.error('Failed to sync opportunity in non-ready stage:', err);
              this.showToast('⚠️ Sheet sync failed. Saved locally.', 'warning');
              this.syncStatus = 'Error';
              this.syncError = err.message || err;
            }
          }
        } else {
          // If no opportunity exists, but sheets are connected, we must still update the lead record in Google Sheets!
          if (this.sheetsConnected && lead._rowIndex !== undefined) {
            try {
              await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              this.showToast('📤 Lead Saved to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
            } catch(err) {
              console.error('Failed to sync lead in basic stage:', err);
              this.showToast('⚠️ Sheet sync failed. Saved locally.', 'warning');
              this.syncStatus = 'Error';
              this.syncError = err.message || err;
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
              await sheetsService.updateRecord('linkedinLeads', lead._rowIndex, lead);
              await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
              this.showToast('📤 Lead & Pipeline Synced to Google Sheets', 'success');
              this.syncStatus = 'Synced';
              this.syncError = null;
              this.lastSynced = new Date().toLocaleString();
              localStorage.setItem('gos_last_synced', this.lastSynced);
            } catch (err) {
              console.error('Failed to sync lead in syncLeadAndOpportunity:', err);
              this.showToast('⚠️ Sheet sync failed. Saved locally.', 'warning');
              this.syncStatus = 'Error';
              this.syncError = err.message || err;
            }
          }
          return;
        }
      }

      // Fallback: If no connected lead (or lead not found), still save the opportunity itself to Google Sheets
      if (this.sheetsConnected && opp._rowIndex !== undefined) {
        try {
          await sheetsService.updateRecord('primePipeline', opp._rowIndex, opp);
          this.showToast('📤 Opportunity Saved to Google Sheets', 'success');
          this.syncStatus = 'Synced';
          this.syncError = null;
          this.lastSynced = new Date().toLocaleString();
          localStorage.setItem('gos_last_synced', this.lastSynced);
        } catch (err) {
          console.error('Failed to sync opportunity in syncLeadAndOpportunity:', err);
          this.showToast('⚠️ Sheet sync failed. Saved locally.', 'warning');
          this.syncStatus = 'Error';
          this.syncError = err.message || err;
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
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId', tabKey: 'linkedinLeads' },
      'prime': { data: this.data.primePipeline, idKey: 'opportunityId', tabKey: 'primePipeline' },
      'scc': { data: this.data.sccContent, idKey: 'contentId', tabKey: 'sccContent' },
      'calmera': { data: this.data.calmeraOrders, idKey: 'orderId', tabKey: 'calmeraOrders' },
      'tasks': { data: this.data.tasks, idKey: 'taskId', tabKey: 'tasks' },
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
      { id:'categories', label:'Categories'},
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

        <!-- Categories -->
        <div class="settings-section ${tab === 'categories' ? 'active' : ''}">
          <div class="settings-card">
            <div class="settings-card-header">
              <div>
                <div class="settings-card-title">Categories</div>
                <div class="settings-card-desc">Categories help you organize leads, content, and orders by business area.</div>
              </div>
              <button class="btn-secondary btn-sm" onclick="app._addCategory()">+ Add Category</button>
            </div>
            <div class="settings-card-body">
              <div id="category-list">
                ${settings.categories.map((cat, idx) => `
                  <div class="category-item" id="cat-item-${idx}">
                    <div class="category-color-dot" style="background:${cat.color}"></div>
                    <input class="category-label-input" id="cat-label-${idx}" value="${this._esc(cat.label)}">
                    <input type="color" value="${cat.color}" style="width:32px;height:32px;border:none;background:none;cursor:pointer;border-radius:var(--radius-sm)" onchange="app._setCategoryColor(${idx}, this.value)">
                    <button class="btn-ghost btn-sm btn-icon" onclick="app._deleteCategory(${idx})" title="Delete">🗑️</button>
                  </div>
                `).join('')}
              </div>
              <div style="margin-top:16px">
                <button class="btn-primary" onclick="app._saveCategorySettings()">Save Categories</button>
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

  _saveModuleSettings() {
    const settings = settingsEngine.get();
    const customizableIds = ['leads', 'brandCommunity', 'productsOrders'];
    settings.modules.forEach((mod, idx) => {
      if (!customizableIds.includes(mod.id)) return;
      const labelEl = document.getElementById(`mod-label-${idx}`);
      const tabEl   = document.getElementById(`mod-tab-${idx}`);
      if (labelEl && labelEl.value.trim()) mod.label = labelEl.value.trim();
      if (tabEl   && tabEl.value.trim()) {
        const newTab = tabEl.value.trim();
        mod.sheetTab = newTab;
        if (settings.sheets.tabMappings[mod.id] !== undefined) {
          settings.sheets.tabMappings[mod.id] = newTab;
        }
      }
    });
    settingsEngine.save(settings);
    this.buildNavigation();
    this.updateTopbar();
    this.showToast('Module names saved!', 'success');
    this.renderContent();
  }

  _toggleModuleVisible(idx, visible) {
    const settings = settingsEngine.get();
    if (settings.modules[idx]) settings.modules[idx].visible = visible;
    settingsEngine.save(settings);
    this.buildNavigation();
  }

  _addCategory() {
    const settings = settingsEngine.get();
    const colors   = ['#6366f1','#10b981','#3b82f6','#f59e0b','#ec4899','#eab308','#22d3ee','#a855f7'];
    settings.categories.push({
      id:    `cat-${Date.now()}`,
      label: 'New Category',
      color: colors[settings.categories.length % colors.length],
    });
    settingsEngine.save(settings);
    this.renderContent();
  }

  _setCategoryColor(idx, color) {
    const settings = settingsEngine.get();
    if (settings.categories[idx]) settings.categories[idx].color = color;
    settingsEngine.save(settings);
  }

  _deleteCategory(idx) {
    const settings = settingsEngine.get();
    settings.categories.splice(idx, 1);
    settingsEngine.save(settings);
    this.renderContent();
  }

  _saveCategorySettings() {
    const settings = settingsEngine.get();
    settings.categories.forEach((cat, idx) => {
      const el = document.getElementById(`cat-label-${idx}`);
      if (el && el.value.trim()) cat.label = el.value.trim();
    });
    settingsEngine.save(settings);
    this.showToast('Categories saved!', 'success');
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

  _saveTabMappings() {
    const settings = settingsEngine.get();
    const customizableIds = ['leads', 'brandCommunity', 'productsOrders'];
    Object.keys(settings.sheets.tabMappings).forEach(modId => {
      if (!customizableIds.includes(modId)) return;
      const el = document.getElementById(`tab-${modId}`);
      if (el && el.value.trim()) {
        const newTab = el.value.trim();
        settings.sheets.tabMappings[modId] = newTab;
        const mod = settings.modules.find(m => m.id === modId);
        if (mod) {
          mod.sheetTab = newTab;
        }
      }
    });
    settingsEngine.save(settings);
    this.showToast('Tab mappings saved!', 'success');
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

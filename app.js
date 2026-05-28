// ============================================================
// Gelo Growth OS — Core Application
// State management, rendering, filtering, scoring, CRUD
// ============================================================

class GeloGrowthOS {
  constructor() {
    // State
    this.currentView = 'command-center';
    this.data = null;
    this.filteredData = null;
    this.filters = { status: 'all', priority: 'all', search: '' };
    this.selectedRecord = null;
    this.sheetsConnected = false;
    this.sortConfig = { key: null, direction: 'asc' };

    // Init
    this.loadData();
    this.bindEvents();
    this.render();
  }

  // ── Data Loading ────────────────────────────────────────────
  loadData() {
    // Use demo data (or Sheets data when connected)
    this.data = { ...DEMO_DATA };
    this.applyFilters();
  }

  // ── Event Binding ───────────────────────────────────────────
  bindEvents() {
    // Navigation
    document.querySelectorAll('.gos-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView(item.dataset.view);
      });
    });

    // Filters
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.applyFilters();
      this.renderContent();
    });

    document.getElementById('filter-priority')?.addEventListener('change', (e) => {
      this.filters.priority = e.target.value;
      this.applyFilters();
      this.renderContent();
    });

    document.getElementById('global-search')?.addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.applyFilters();
      this.renderContent();
    });

    // Add record button
    document.getElementById('btn-add-record')?.addEventListener('click', () => {
      this.openAddModal();
    });

    // Message generator button
    document.getElementById('btn-message-gen')?.addEventListener('click', () => {
      this.openMessageGenerator();
    });

    // Panel close
    document.getElementById('panel-close')?.addEventListener('click', () => this.closePanel());
    document.getElementById('panel-overlay')?.addEventListener('click', () => this.closePanel());

    // Modal close
    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal('add-modal'));
    document.getElementById('add-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'add-modal-overlay') this.closeModal('add-modal');
    });
    document.getElementById('msg-modal-close')?.addEventListener('click', () => this.closeModal('msg-modal'));
    document.getElementById('msg-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'msg-modal-overlay') this.closeModal('msg-modal');
    });

    // Add form submit
    document.getElementById('add-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddRecord();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
        this.closeModal('add-modal');
        this.closeModal('msg-modal');
      }
    });
  }

  // ── View Switching ──────────────────────────────────────────
  switchView(view) {
    this.currentView = view;
    this.filters = { status: 'all', priority: 'all', search: '' };

    // Update nav
    document.querySelectorAll('.gos-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    // Reset filters UI
    const statusFilter = document.getElementById('filter-status');
    const priorityFilter = document.getElementById('filter-priority');
    const searchInput = document.getElementById('global-search');
    if (statusFilter) statusFilter.value = 'all';
    if (priorityFilter) priorityFilter.value = 'all';
    if (searchInput) searchInput.value = '';

    this.updateFilterOptions();
    this.applyFilters();
    this.render();
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
    const titles = {
      'command-center': ['Daily Command Center', 'Your daily action hub — overdue, due today, and upcoming tasks'],
      'linkedin': ['LinkedIn Lead Funnel', 'Capture, qualify, nurture, and convert LinkedIn connections'],
      'prime': ['Prime Consultancy Pipeline', 'Track opportunities from inquiry to won/lost'],
      'scc': ['Self Care Club Content', 'Plan, create, and publish community content'],
      'calmera': ['Calmera Reconfirmation Desk', 'Confirm orders before fulfillment cutoff'],
      'repurposing': ['Content Repurposing Engine', 'Turn source assets into multi-channel derivatives'],
    };

    const [title, subtitle] = titles[this.currentView] || ['Dashboard', ''];
    document.getElementById('view-title').textContent = title;
    document.getElementById('view-subtitle').textContent = subtitle;
  }

  renderContent() {
    const content = document.getElementById('main-content');
    if (!content) return;

    switch (this.currentView) {
      case 'command-center': this.renderCommandCenter(content); break;
      case 'linkedin': this.renderLinkedIn(content); break;
      case 'prime': this.renderPrime(content); break;
      case 'scc': this.renderSCC(content); break;
      case 'calmera': this.renderCalmera(content); break;
      case 'repurposing': this.renderRepurposing(content); break;
    }
  }

  // ── Command Center ──────────────────────────────────────────
  renderCommandCenter(container) {
    const tasks = this.data.tasks;
    const openTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled');
    const overdue = openTasks.filter(t => isOverdue(t.dueAt));
    const dueToday = openTasks.filter(t => isDueToday(t.dueAt));
    const dueWeek = openTasks.filter(t => { const d = daysUntil(t.dueAt); return d > 0 && d <= 7; });
    const critical = openTasks.filter(t => t.priority === 'Critical');

    const pipeline = this.data.primePipeline;
    const activeDeals = pipeline.filter(p => !['Won', 'Lost'].includes(p.stage));
    const totalWeighted = pipeline.reduce((s, p) => s + (p.weightedValue || 0), 0);
    const wonDeals = pipeline.filter(p => p.stage === 'Won');

    const leads = this.data.linkedinLeads;
    const activeLeads = leads.filter(l => !['Closed', 'Converted'].includes(l.stage));

    const orders = this.data.calmeraOrders;
    const pendingOrders = orders.filter(o => !['Confirmed', 'Closed'].includes(o.reconfirmationStatus) && o.reconfirmationStatus !== 'Changed');
    const atRiskOrders = orders.filter(o => o.orderStatus === 'At Risk' || o.reconfirmationStatus === 'Escalated');

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card red">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Overdue</span>
            <span class="gos-kpi-icon">⚠️</span>
          </div>
          <div class="gos-kpi-value">${overdue.length}</div>
          <div class="gos-kpi-detail">${critical.length} critical actions</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Due Today</span>
            <span class="gos-kpi-icon">📋</span>
          </div>
          <div class="gos-kpi-value">${dueToday.length}</div>
          <div class="gos-kpi-detail">${dueWeek.length} due this week</div>
        </div>
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Pipeline Value</span>
            <span class="gos-kpi-icon">💰</span>
          </div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWeighted)}</div>
          <div class="gos-kpi-detail">${activeDeals.length} active deals</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Active Leads</span>
            <span class="gos-kpi-icon">🔗</span>
          </div>
          <div class="gos-kpi-value">${activeLeads.length}</div>
          <div class="gos-kpi-detail">${leads.filter(l => l.stage === 'Converted').length} converted</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Pending Orders</span>
            <span class="gos-kpi-icon">📦</span>
          </div>
          <div class="gos-kpi-value">${pendingOrders.length}</div>
          <div class="gos-kpi-detail">${atRiskOrders.length > 0 ? `<span class="text-red">${atRiskOrders.length} at risk!</span>` : 'No escalations'}</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header">
            <span class="gos-kpi-label">Won Revenue</span>
            <span class="gos-kpi-icon">🏆</span>
          </div>
          <div class="gos-kpi-value">₱${this.formatNumber(wonDeals.reduce((s, d) => s + d.estimatedValue, 0))}</div>
          <div class="gos-kpi-detail">${wonDeals.length} closed won</div>
        </div>
      </div>

      <div class="gos-section-grid">
        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">🔴 Critical & Overdue Tasks</span>
            <span class="gos-table-count">${overdue.length + critical.filter(t => !isOverdue(t.dueAt)).length}</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${[...overdue, ...critical.filter(t => !isOverdue(t.dueAt))].slice(0, 6).map(t => this.renderTaskItem(t)).join('')}
              ${overdue.length === 0 && critical.filter(t => !isOverdue(t.dueAt)).length === 0 ? '<div class="gos-empty" style="padding:30px"><span class="gos-empty-icon">✅</span><span class="gos-empty-title">All clear!</span></div>' : ''}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📋 Due Today</span>
            <span class="gos-table-count">${dueToday.length}</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${dueToday.slice(0, 6).map(t => this.renderTaskItem(t)).join('')}
              ${dueToday.length === 0 ? '<div class="gos-empty" style="padding:30px"><span class="gos-empty-icon">📭</span><span class="gos-empty-title">Nothing due today</span></div>' : ''}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">🔗 LinkedIn Lead Funnel</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.switchView('linkedin')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            ${this.renderFunnel(leads, ['New', 'Qualified', 'Contacted', 'Nurturing', 'Converted'])}
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">💼 Prime Pipeline</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.switchView('prime')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            ${this.renderFunnel(pipeline, ['New Inquiry', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won'], 'stage')}
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📦 Calmera Order Alerts</span>
            <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="app.switchView('calmera')">View All →</button>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${orders.filter(o => o.reconfirmationStatus === 'Escalated' || o.reconfirmationStatus === 'Pending Contact' || o.reconfirmationStatus === 'Awaiting Response').slice(0, 4).map(o => `
                <li class="gos-task-item ${o.reconfirmationStatus === 'Escalated' ? 'overdue' : ''}" onclick="app.openRecordPanel('calmera', '${o.orderId}')">
                  <div class="gos-task-info">
                    <div class="gos-task-title">${o.customerName} — ${o.externalOrderRef}</div>
                    <div class="gos-task-meta">
                      ${this.renderBadge(o.reconfirmationStatus)}
                      <span>₱${o.orderAmount.toLocaleString()}</span>
                      <span>Cutoff: ${o.fulfillmentCutoff}</span>
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <div class="gos-section-card">
          <div class="gos-section-card-header">
            <span class="gos-section-card-title">📢 Recent Activity</span>
          </div>
          <div class="gos-section-card-body">
            <ul class="gos-task-list">
              ${this.data.interactions.slice(0, 5).map(i => `
                <li class="gos-task-item">
                  <div class="gos-task-info">
                    <div class="gos-task-title">${i.contactName} — ${i.interactionType}</div>
                    <div class="gos-task-meta">
                      <span>${i.channel}</span>
                      <span>${i.direction}</span>
                      <span>${i.occurredAt}</span>
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
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
    const activeLeads = leads.filter(l => !['Closed', 'Converted'].includes(l.stage));
    const noAction = activeLeads.filter(l => isOverdue(l.nextActionDate));
    const avgScore = leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.qualificationScore, 0) / leads.length) : 0;
    const converted = leads.filter(l => l.stage === 'Converted').length;
    const convRate = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Leads</span><span class="gos-kpi-icon">👥</span></div>
          <div class="gos-kpi-value">${leads.length}</div>
          <div class="gos-kpi-detail">${activeLeads.length} active</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Conversion Rate</span><span class="gos-kpi-icon">📈</span></div>
          <div class="gos-kpi-value">${convRate}%</div>
          <div class="gos-kpi-detail">${converted} converted</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Avg Score</span><span class="gos-kpi-icon">⭐</span></div>
          <div class="gos-kpi-value">${avgScore}</div>
          <div class="gos-kpi-detail">of 100 qualification points</div>
        </div>
        <div class="gos-kpi-card ${noAction.length > 0 ? 'red' : 'green'}">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Overdue Follow-ups</span><span class="gos-kpi-icon">${noAction.length > 0 ? '⚠️' : '✅'}</span></div>
          <div class="gos-kpi-value">${noAction.length}</div>
          <div class="gos-kpi-detail">${noAction.length > 0 ? 'Need immediate attention' : 'All follow-ups on track'}</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'contactName', label: 'Name', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-company">${r.company}</span>` },
        { key: 'stage', label: 'Stage', render: (v) => this.renderBadge(v) },
        { key: 'qualificationScore', label: 'Score', render: (v) => this.renderScore(v) },
        { key: 'priority', label: 'Priority', render: (v) => this.renderBadge(v) },
        { key: 'nextAction', label: 'Next Action', render: (v) => `<span class="truncate" style="max-width:200px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Follow-up', render: (v) => this.renderDueDate(v) },
        { key: 'source', label: 'Source' },
      ], 'linkedin', 'leadId')}
    `;
  }

  // ── Prime Pipeline View ─────────────────────────────────────
  renderPrime(container) {
    const pipeline = this.data.primePipeline;
    const activeDeals = pipeline.filter(p => !['Won', 'Lost'].includes(p.stage));
    const totalPipeline = activeDeals.reduce((s, p) => s + (p.estimatedValue || 0), 0);
    const totalWeighted = activeDeals.reduce((s, p) => s + (p.weightedValue || 0), 0);
    const won = pipeline.filter(p => p.stage === 'Won');
    const lost = pipeline.filter(p => p.stage === 'Lost');
    const winRate = (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    container.innerHTML = `
      <div class="gos-kpi-grid">
        <div class="gos-kpi-card purple">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Total Pipeline</span><span class="gos-kpi-icon">💼</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalPipeline)}</div>
          <div class="gos-kpi-detail">${activeDeals.length} active opportunities</div>
        </div>
        <div class="gos-kpi-card blue">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Weighted Forecast</span><span class="gos-kpi-icon">📊</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(totalWeighted)}</div>
          <div class="gos-kpi-detail">probability-adjusted value</div>
        </div>
        <div class="gos-kpi-card green">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Win Rate</span><span class="gos-kpi-icon">🏆</span></div>
          <div class="gos-kpi-value">${winRate}%</div>
          <div class="gos-kpi-detail">${won.length} won / ${lost.length} lost</div>
        </div>
        <div class="gos-kpi-card amber">
          <div class="gos-kpi-header"><span class="gos-kpi-label">Won Revenue</span><span class="gos-kpi-icon">💰</span></div>
          <div class="gos-kpi-value">₱${this.formatNumber(won.reduce((s, d) => s + d.estimatedValue, 0))}</div>
          <div class="gos-kpi-detail">${won.length} closed deals</div>
        </div>
      </div>

      ${this.renderDataTable(this.filteredData, [
        { key: 'contactName', label: 'Contact', render: (v, r) => `<span class="cell-name">${v}</span><br><span class="cell-company">${r.orgName}</span>` },
        { key: 'serviceInterest', label: 'Service', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v}</span>` },
        { key: 'stage', label: 'Stage', render: (v) => this.renderBadge(v) },
        { key: 'estimatedValue', label: 'Value', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'probabilityPercent', label: 'Prob.', render: (v) => `${v || 0}%` },
        { key: 'weightedValue', label: 'Weighted', render: (v) => `<span class="cell-value">₱${(v || 0).toLocaleString()}</span>` },
        { key: 'nextAction', label: 'Next Action', render: (v) => `<span class="truncate" style="max-width:180px;display:inline-block">${v || '—'}</span>` },
        { key: 'nextActionDate', label: 'Due', render: (v) => this.renderDueDate(v) },
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
      ], 'repurposing', 'outputId', 'Repurpose Outputs')}
    `;
  }

  // ── Generic Data Table Renderer ─────────────────────────────
  renderDataTable(data, columns, viewType, idKey, title) {
    const tableTitle = title || {
      'linkedin': 'LinkedIn Leads',
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

    return `
      <div class="gos-table-container">
        <div class="gos-table-header">
          <span class="gos-table-title">${tableTitle}</span>
          <span class="gos-table-count">${data.length} records</span>
        </div>
        <div class="gos-table-wrap">
          <table class="gos-table">
            <thead>
              <tr>
                ${columns.map(col => `
                  <th onclick="app.toggleSort('${col.key}')" class="${this.sortConfig.key === col.key ? 'sorted' : ''}">
                    ${col.label}
                    <span class="sort-icon">${this.sortConfig.key === col.key ? (this.sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                `).join('')}
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody>
              ${data.map(record => `
                <tr class="clickable" onclick="app.openRecordPanel('${viewType}', '${record[idKey]}')">
                  ${columns.map(col => `
                    <td>${col.render ? col.render(record[col.key], record) : (record[col.key] || '—')}</td>
                  `).join('')}
                  <td>
                    <button class="gos-btn gos-btn-ghost gos-btn-sm" onclick="event.stopPropagation(); app.openMessageForRecord('${viewType}', '${record[idKey]}')" title="Generate message">✉️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
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
    const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    return `
      <div class="gos-score score-${level}">
        <span>${score}</span>
        <div class="gos-score-bar">
          <div class="gos-score-fill" style="width: ${score}%"></div>
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

    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('panel-overlay');
    const panelTitle = document.getElementById('panel-title');
    const panelBody = document.getElementById('panel-body');
    const panelFooter = document.getElementById('panel-footer');

    panelTitle.textContent = this.getRecordTitle(viewType, record);
    panelBody.innerHTML = this.renderRecordDetail(viewType, record);

    if (panelFooter) {
      const idFieldName = Object.keys(record).find(k => k.endsWith('Id') && k !== 'contactId' && k !== 'organizationId' && k !== 'sourceLeadId') || 'id';
      const idVal = record[idFieldName];
      panelFooter.innerHTML = `
        <button class="gos-btn gos-btn-secondary" onclick="app.closePanel()">Close</button>
        <button class="gos-btn gos-btn-ghost" onclick="app.editSelectedRecord()">✏️ Edit Details</button>
        <button class="gos-btn gos-btn-primary" onclick="app.openMessageForRecord('${viewType}', '${idVal}')">✉️ Generate Message</button>
      `;
    }

    panel.classList.add('open');
    overlay.classList.add('open');
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
    document.getElementById('panel-overlay')?.classList.remove('open');
    this.selectedRecord = null;
  }

  // ── Inline Edit Flow ─────────────────────────────────────────
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
        <button class="gos-btn gos-btn-secondary" onclick="app.cancelRecordEdit()">Cancel</button>
        <button class="gos-btn gos-btn-primary" onclick="app.saveRecordEdit()">💾 Save Changes</button>
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
          await sheetsService.updateRecord(config.tabKey, rowIndex, record);
          this.showToast('📤 Saved to Google Sheets', 'success');
        } catch (err) {
          console.error('Sheet update failed:', err);
          this.showToast('⚠️ Sheet write failed. Reverting changes...', 'danger');
          // Revert local data
          Object.assign(record, oldRecord);
          this.applyFilters();
          this.render();
          this.openRecordPanel(viewType, record[config.idKey]);
        }
      } else {
        this.showToast('⚠️ Sheet row index not found. Saved only locally.', 'warning');
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
                <label class="gos-form-label">Company</label>
                <input class="gos-form-input" name="company" value="${r.company || ''}">
              </div>
              
              <div class="gos-form-group">
                <label class="gos-form-label">Role</label>
                <input class="gos-form-input" name="role" value="${r.role || ''}">
              </div>

              <div class="gos-form-row">
                <div class="gos-form-group">
                  <label class="gos-form-label">Stage</label>
                  <select class="gos-form-select" name="stage">
                    ${['New', 'Qualified', 'Contacted', 'Nurturing', 'Converted', 'Recycle', 'Closed'].map(opt => `
                      <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
                <div class="gos-form-group">
                  <label class="gos-form-label">Priority</label>
                  <select class="gos-form-select" name="priority">
                    ${['Normal', 'High', 'Critical', 'Low'].map(opt => `
                      <option value="${opt}" ${r.priority === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Score (0-100)</label>
                <input class="gos-form-input" type="number" name="qualificationScore" min="0" max="100" value="${r.qualificationScore || 0}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Next Action</label>
                <input class="gos-form-input" name="nextAction" value="${r.nextAction || ''}">
              </div>

              <div class="gos-form-group">
                <label class="gos-form-label">Follow-up Date</label>
                <input class="gos-form-input" type="date" name="nextActionDate" value="${r.nextActionDate || ''}">
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

              <div class="gos-form-group">
                <label class="gos-form-label">Stage</label>
                <select class="gos-form-select" name="stage">
                  ${['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff'].map(opt => `
                    <option value="${opt}" ${r.stage === opt ? 'selected' : ''}>${opt}</option>
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
      case 'linkedin': return `${record.contactName} — LinkedIn Lead`;
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
        ${this.renderField('Company', r.company)}
        ${this.renderField('Role', r.role)}
        ${this.renderField('Stage', this.renderBadge(r.stage))}
        ${this.renderField('Priority', this.renderBadge(r.priority))}
        ${this.renderField('Score', this.renderScore(r.qualificationScore))}
        ${this.renderField('Source', r.source)}
        ${this.renderField('Connection', r.connectionStatus)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Interest & Qualification</div>
        ${this.renderField('Interest Signal', r.interestSignal)}
        ${this.renderField('Notes', r.notes)}
      </div>
      <div class="gos-panel-section">
        <div class="gos-panel-section-title">Follow-Up</div>
        ${this.renderField('Next Action', r.nextAction)}
        ${this.renderField('Follow-up Date', this.renderDueDate(r.nextActionDate))}
        ${this.renderField('Last Interaction', r.lastInteractionAt || '—')}
        ${r.convertedOpportunityId ? this.renderField('Converted To', `<a class="cell-link" onclick="app.openRecordPanel('prime', '${r.convertedOpportunityId}')">${r.convertedOpportunityId}</a>`) : ''}
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
    const overlay = document.getElementById('add-modal-overlay');
    const formBody = document.getElementById('add-form-body');

    formBody.innerHTML = this.getAddFormFields();
    overlay.classList.add('open');
  }

  closeModal(modalId) {
    const id = modalId === 'add-modal' ? 'add-modal-overlay' : 'msg-modal-overlay';
    document.getElementById(id)?.classList.remove('open');
  }

  getAddFormFields() {
    switch (this.currentView) {
      case 'linkedin': return `
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Full Name *</label><input class="gos-form-input" name="contactName" required></div>
          <div class="gos-form-group"><label class="gos-form-label">Company</label><input class="gos-form-input" name="company"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Role</label><input class="gos-form-input" name="role"></div>
          <div class="gos-form-group"><label class="gos-form-label">LinkedIn URL</label><input class="gos-form-input" name="linkedinUrl"></div>
        </div>
        <div class="gos-form-row">
          <div class="gos-form-group">
            <label class="gos-form-label">Source</label>
            <select class="gos-form-select" name="source"><option>LinkedIn Search</option><option>LinkedIn Content</option><option>LinkedIn Event</option><option>Referral</option><option>Network</option><option>Other</option></select>
          </div>
          <div class="gos-form-group">
            <label class="gos-form-label">Priority</label>
            <select class="gos-form-select" name="priority"><option>Normal</option><option>High</option><option>Critical</option><option>Low</option></select>
          </div>
        </div>
        <div class="gos-form-group"><label class="gos-form-label">Interest Signal</label><input class="gos-form-input" name="interestSignal" placeholder="What caught your attention about this lead?"></div>
        <div class="gos-form-row">
          <div class="gos-form-group"><label class="gos-form-label">Next Action</label><input class="gos-form-input" name="nextAction" placeholder="e.g., Send connection request"></div>
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

    switch (this.currentView) {
      case 'linkedin':
        newRecord = {
          leadId: `LL-${String(this.data.linkedinLeads.length + 1).padStart(4, '0')}`,
          contactId: `CON-${String(this.data.contacts.length + 1).padStart(4, '0')}`,
          ...data,
          dateCaptured: today,
          connectionStatus: 'Pending',
          qualificationScore: this.calculateLeadScore(data),
          stage: 'New',
          lastInteractionAt: '',
          convertedOpportunityId: '',
        };
        this.data.linkedinLeads.push(newRecord);
        break;
      case 'prime':
        const value = parseInt(data.estimatedValue) || 0;
        const prob = parseInt(data.probabilityPercent) || 20;
        newRecord = {
          opportunityId: `PO-${String(this.data.primePipeline.length + 1).padStart(4, '0')}`,
          ...data,
          stage: 'New Inquiry',
          estimatedValue: value,
          probabilityPercent: prob,
          weightedValue: Math.round(value * prob / 100),
          discoveryDate: '',
          proposalDate: '',
          closeDate: '',
          outcomeReason: '',
        };
        this.data.primePipeline.push(newRecord);
        break;
      case 'scc':
        newRecord = {
          contentId: `SCC-${String(this.data.sccContent.length + 1).padStart(4, '0')}`,
          ...data,
          status: 'Idea',
          views: 0, comments: 0, saves: 0, replies: 0,
          repurposeFlag: false,
          publishedAt: '', publishedUrl: '', draftUrl: '', assetUrl: '',
        };
        this.data.sccContent.push(newRecord);
        break;
      case 'calmera':
        newRecord = {
          orderId: `CAL-${String(this.data.calmeraOrders.length + 1).padStart(4, '0')}`,
          ...data,
          orderAmount: parseInt(data.orderAmount) || 0,
          orderDate: today,
          reconfirmationStatus: 'Pending Contact',
          latestAttemptAt: '',
          responseDueAt: '',
          orderStatus: 'New',
          changeNotes: '',
          resolvedAt: '',
        };
        this.data.calmeraOrders.push(newRecord);
        break;
    }

    this.closeModal('add-modal');
    form.reset();
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
        sheetsService.appendRecord(tabKey, newRecord)
          .then((res) => {
            if (res && res.rowsAfter !== undefined) {
              newRecord._rowIndex = res.rowsAfter - 1;
            }
            this.showToast('📤 Saved to Google Sheets', 'success');
          })
          .catch(err => {
            console.error('Sheet write failed:', err);
            this.showToast('⚠️ Saved locally, but Sheet write failed. Try refreshing.', 'warning');
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
    const body = document.getElementById('msg-body');

    const streamMap = {
      'linkedin': 'linkedin',
      'prime': 'prime',
      'scc': 'scc',
      'calmera': 'calmera',
      'command-center': 'general',
      'repurposing': 'general',
    };

    const stream = streamMap[this.currentView] || 'general';
    const templates = MessageGenerator.getTemplates(stream);
    const categories = MessageGenerator.getCategories();

    body.innerHTML = `
      <div class="gos-msg-gen">
        <div class="gos-msg-gen-header">
          <span>✉️</span>
          <h3>Select Template</h3>
          <select class="gos-filter" id="msg-category" style="margin-left:auto" onchange="app.switchMsgCategory(this.value)">
            ${categories.map(c => `<option value="${c}" ${c === stream ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="gos-msg-template-grid" id="msg-templates">
          ${templates.map(t => `
            <div class="gos-msg-template-card" onclick="app.selectTemplate('${t.id}')" data-template-id="${t.id}">
              <div class="gos-msg-template-name">${t.name}</div>
              <div class="gos-msg-template-stage">${t.stage} · ${t.channel}</div>
            </div>
          `).join('')}
        </div>
        <div class="gos-msg-preview" id="msg-preview" style="display:none">
          <div class="gos-msg-preview-subject" id="msg-preview-subject"></div>
          <div class="gos-msg-preview-body" id="msg-preview-body"></div>
        </div>
        <div class="gos-msg-actions" id="msg-actions" style="display:none">
          <button class="gos-btn gos-btn-secondary" onclick="app.copyMessage()">📋 Copy to Clipboard</button>
        </div>
      </div>
    `;

    overlay.classList.add('open');
  }

  openMessageForRecord(viewType, id) {
    const dataMap = {
      'linkedin': { data: this.data.linkedinLeads, idKey: 'leadId' },
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
    const toast = document.createElement('div');
    toast.className = `gos-toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="gos-toast-icon">${icons[type]}</span>
      <span class="gos-toast-msg">${message}</span>
      <button class="gos-toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    const demo = document.getElementById('status-demo');
    const connected = document.getElementById('status-connected');
    const loading = document.getElementById('status-loading');
    const btnConnect = document.getElementById('btn-connect');
    const btnDisconnect = document.getElementById('btn-disconnect');
    const btnRefresh = document.getElementById('btn-refresh');

    if (!demo) return; // elements not ready yet

    // Hide all status badges
    demo.style.display = 'none';
    connected.style.display = 'none';
    loading.style.display = 'none';

    switch (state) {
      case 'connected':
        connected.style.display = 'flex';
        btnConnect.style.display = 'none';
        btnDisconnect.style.display = 'inline-flex';
        btnRefresh.style.display = 'inline-flex';
        break;
      case 'loading':
        loading.style.display = 'flex';
        btnConnect.style.display = 'none';
        btnDisconnect.style.display = 'none';
        btnRefresh.style.display = 'none';
        break;
      case 'demo':
      default:
        demo.style.display = 'flex';
        btnConnect.style.display = 'inline-flex';
        btnDisconnect.style.display = 'none';
        btnRefresh.style.display = 'none';
        break;
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
}

// ── Initialize ────────────────────────────────────────────────
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new GeloGrowthOS();
  app.updateNavBadge();

  // Auto-connect to Google Sheets on startup if configured and not explicitly disconnected
  if (sheetsService.isConfigured() && localStorage.getItem('gos_sheets_connected') !== 'false') {
    app.connectSheets();
  }
});

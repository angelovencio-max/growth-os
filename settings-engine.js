// ============================================================
// Gelo Growth OS — Settings Engine v2
// Manages all customization: modules, categories, profile,
// appearance, and Sheets mappings via localStorage.
// ============================================================

/// Global helper to generate premium vector outline SVG icons
function getIconSvg(name, size = 18, color = 'currentColor') {
  const icons = {
    home: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    calendar: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    user: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    users: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    'message-square': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    sprout: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M12 2a15 15 0 0 0-15 15a15 15 0 0 0 15-15z"></path><path d="M12 2a15 15 0 0 1 15 15a15 15 0 0 1-15-15z"></path><path d="M12 2v20"></path></svg>`,
    package: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon><polygon points="12 12 21 6.92 21 17.08 12 22.08"></polygon><polygon points="12 2 3 6.92 12 12 21 6.92 12 2"></polygon><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    'file-text': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    'settings-icon': `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    award: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`,
    star: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    pipeline: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,
    chart: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
    dollarSign: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    sun: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></svg>`,
    moon: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    info: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    inbox: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
    folder: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    operations: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
    book: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    zap: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gos-icon"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
  };
  return icons[name] || icons.info;
}

// Module ID -> Vector icon name map
const MODULE_ICON_MAP = {
  today: 'home',
  myDay: 'sun',
  inbox: 'inbox',
  tasks: 'checkCircle',
  calendar: 'calendar',
  projects: 'folder',
  leads: 'user',
  salesPipeline: 'briefcase',
  clients: 'users',
  content: 'file-text',
  operations: 'operations',
  finance: 'dollarSign',
  notes: 'file-text',
  sops: 'book',
  files: 'folder',
  templates: 'file-text',
  personalDashboard: 'home',
  goals: 'award',
  habits: 'star',
  learning: 'book',
  reports: 'chart',
  automations: 'zap',
  settings: 'settings-icon'
};
const SETTINGS_VERSION = 'gos_settings_v3';

const DEFAULT_SETTINGS = {
  appName: 'Gelo Growth OS',
  workspaceName: 'Growth OS',
  workspaceSubtitle: 'Your personal operating system for sales, content, and growth.',
  profile: {
    displayName: 'Gelo',
    role: 'Founder / Operator',
    company: 'Prime',
    avatarInitials: 'GV',
    email: '',
    mainFocus: 'Sales, Content, and Growth',
  },
  modules: [
    // Core Group
    { id: 'today',             label: 'Home',                icon: 'home',           visible: true,  order: 1,  category: 'core',      description: 'Centralized Command Center',        sheetTab: '' },
    { id: 'myDay',             label: 'My Day',              icon: 'sun',            visible: true,  order: 2,  category: 'core',      description: 'Your daily focus and checklist',    sheetTab: '' },
    { id: 'inbox',             label: 'Inbox',               icon: 'inbox',          visible: true,  order: 3,  category: 'core',      description: 'Quick-capture inbox',               sheetTab: '' },
    { id: 'tasks',             label: 'Tasks',               icon: 'checkCircle',    visible: true,  order: 4,  category: 'core',      description: 'Universal task manager',            sheetTab: 'Tasks' },
    { id: 'calendar',          label: 'Calendar',            icon: 'calendar',       visible: true,  order: 5,  category: 'core',      description: 'Deadlines, calls, and events',      sheetTab: 'Calendar' },
    { id: 'projects',          label: 'Projects',            icon: 'folder',         visible: true,  order: 6,  category: 'core',      description: 'Project tracking & progress',       sheetTab: 'Projects' },

    // Business Group
    { id: 'leads',             label: 'CRM',                 icon: 'user',           visible: true,  order: 7,  category: 'business',  description: 'Leads and contacts database',        sheetTab: 'LinkedIn_Leads' },
    { id: 'salesPipeline',     label: 'Sales Pipeline',      icon: 'briefcase',      visible: true,  order: 8,  category: 'business',  description: 'Deals and sales stages',            sheetTab: 'Prime_Pipeline' },
    { id: 'clients',           label: 'Clients',             icon: 'users',          visible: true,  order: 9,  category: 'business',  description: 'Active client accounts',            sheetTab: 'Clients' },
    { id: 'content',           label: 'Content OS',          icon: 'file-text',      visible: true,  order: 10, category: 'business',  description: 'Content calendar and workflow',     sheetTab: 'SCC_Content' },
    { id: 'operations',        label: 'Operations',          icon: 'operations',     visible: true,  order: 11, category: 'business',  description: 'Recurring tasks and checklists',    sheetTab: '' },
    { id: 'finance',           label: 'Finance',             icon: 'dollarSign',     visible: true,  order: 12, category: 'business',  description: 'Deliverables & payments pending',   sheetTab: '' },

    // Knowledge Group
    { id: 'notes',             label: 'Notes',               icon: 'file-text',      visible: true,  order: 13, category: 'knowledge', description: 'Meeting & quick notes library',       sheetTab: 'Notes' },
    { id: 'sops',              label: 'SOPs',                icon: 'book',           visible: true,  order: 14, category: 'knowledge', description: 'Standard operating procedures',       sheetTab: 'SOPs' },
    { id: 'files',             label: 'Files',               icon: 'folder',         visible: true,  order: 15, category: 'knowledge', description: 'Drive links and documents',          sheetTab: '' },
    { id: 'templates',         label: 'Templates',           icon: 'file-text',      visible: true,  order: 16, category: 'knowledge', description: 'Reusable templates library',         sheetTab: '' },

    // Personal Group
    { id: 'personalDashboard', label: 'Personal Dashboard',  icon: 'home',           visible: true,  order: 17, category: 'personal',  description: 'Personal dashboard & tasks',        sheetTab: '' },
    { id: 'goals',             label: 'Goals',               icon: 'award',          visible: true,  order: 18, category: 'personal',  description: 'Goal setting and progress metrics', sheetTab: 'Goals' },
    { id: 'habits',            label: 'Habits',              icon: 'star',           visible: true,  order: 19, category: 'personal',  description: 'Daily habits and consistency',      sheetTab: 'Habits' },
    { id: 'learning',          label: 'Learning',            icon: 'book',           visible: true,  order: 20, category: 'personal',  description: 'Courses, books, and articles',       sheetTab: 'Learning' },

    // System Group
    { id: 'reports',           label: 'Reports',             icon: 'chart',          visible: true,  order: 21, category: 'system',    description: 'Dynamic reports & KPI metrics',     sheetTab: '' },
    { id: 'automations',       label: 'Automations',         icon: 'zap',            visible: true,  order: 22, category: 'system',    description: 'Recurring automations settings',     sheetTab: '' },
    { id: 'settings',          label: 'Settings',            icon: 'settings-icon',  visible: true,  order: 23, category: 'system',    description: 'Customize your workspace settings', sheetTab: '' },
  ],
  categories: [
    { id: 'consulting',     label: 'Consulting',         color: '#6366f1', description: 'Consulting and sales prospects' },
    { id: 'brandCommunity', label: 'Brand / Community',  color: '#10b981', description: 'Community, apparel, or brand-related work' },
    { id: 'productsOrders', label: 'Products / Orders',  color: '#3b82f6', description: 'Product leads, orders, and customer follow-ups' },
    { id: 'content',        label: 'Content',            color: '#f59e0b', description: 'Content and video services' },
    { id: 'personalBrand',  label: 'Personal Brand',     color: '#ec4899', description: 'Personal brand content and opportunities' },
    { id: 'referral',       label: 'Referral',           color: '#eab308', description: 'Referral partners and introductions' },
  ],
  sheets: {
    spreadsheetUrl: '',
    webAppUrl: '',
    tabMappings: {
      leads:             'LinkedIn_Leads',
      salesPipeline:     'Prime_Pipeline',
      brandCommunity:    'SCC_Content',
      productsOrders:    'Calmera_Orders',
      content:           'Repurpose_Outputs',
      calendar:          'Calendar',
      contacts:          'Contacts',
      organizations:     'Organizations',
      tasks:             'Tasks',
      projects:          'Projects',
      clients:           'Clients',
      goals:             'Goals',
      habits:            'Habits',
      learning:          'Learning',
      notes:             'Notes',
      sops:              'SOPs',
    },
  },
  appearance: {
    theme: 'dark',
  },
};

// ── Settings Engine Class ────────────────────────────────────
class SettingsEngine {
  constructor() {
    this._cache = null;
  }

  // Load from localStorage (with deep merge against defaults for new keys)
  get() {
    if (this._cache) return this._cache;
    try {
      let raw = localStorage.getItem(SETTINGS_VERSION);
      if (!raw) {
        // Migrate from v2 settings to preserve personalized names, custom labels, and workspace name
        const rawV2 = localStorage.getItem('gos_settings_v2');
        if (rawV2) {
          raw = rawV2;
          localStorage.setItem(SETTINGS_VERSION, rawV2);
        }
      }
      
      if (raw) {
        const parsed = JSON.parse(raw);
        this._cache = this._deepMerge(DEFAULT_SETTINGS, parsed);
        
        // Migrate emoji icons in localStorage to vector icons
        const emojiMap = {
          '🏠': 'home',
          '📅': 'calendar',
          '👤': 'user',
          '💬': 'message-square',
          '💼': 'briefcase',
          '🌿': 'sprout',
          '📦': 'package',
          '📝': 'file-text',
          '⚙️': 'settings-icon'
        };
        let modified = false;
        this._cache.modules.forEach(m => {
          if (emojiMap[m.icon]) {
            m.icon = emojiMap[m.icon];
            modified = true;
          }
        });
        if (modified) {
          this.save(this._cache);
        }

        // Ensure all default modules exist (handles upgrades)
        DEFAULT_SETTINGS.modules.forEach(defMod => {
          const existing = this._cache.modules.find(m => m.id === defMod.id);
          if (!existing) {
            this._cache.modules.push({ ...defMod });
          } else {
            existing.category = defMod.category;
            existing.icon = defMod.icon;
            existing.order = defMod.order;
            if (existing.description === undefined) {
              existing.description = defMod.description;
            }
          }
        });
        DEFAULT_SETTINGS.categories.forEach(defCat => {
          if (!this._cache.categories.find(c => c.id === defCat.id)) {
            this._cache.categories.push({ ...defCat });
          }
        });
      } else {
        this._cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      console.warn('[SettingsEngine] Load failed, using defaults:', e);
      this._cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    if (this._cache && this._cache.modules) {
      this._cache.modules.sort((a, b) => a.order - b.order);
    }
    return this._cache;
  }

  // Persist to localStorage
  save(data) {
    this._cache = data;
    try {
      localStorage.setItem(SETTINGS_VERSION, JSON.stringify(data));
    } catch (e) {
      console.error('[SettingsEngine] Save failed:', e);
    }
  }

  // Partial update helper
  update(partialUpdate) {
    const current = this.get();
    const updated = this._deepMerge(current, partialUpdate);
    this.save(updated);
    return updated;
  }

  // ── Module Helpers ─────────────────────────────────────────
  getVisibleModules() {
    return this.get().modules
      .filter(m => m.visible)
      .sort((a, b) => a.order - b.order);
  }

  getModule(id) {
    return this.get().modules.find(m => m.id === id) || null;
  }

  getModuleLabel(id) {
    const mod = this.getModule(id);
    return mod ? mod.label : id;
  }

  getModuleIcon(id) {
    return getIconSvg(MODULE_ICON_MAP[id] || 'info', 18);
  }

  // ── Category Helpers ───────────────────────────────────────
  getAllCategories() {
    return this.get().categories;
  }

  getCategory(id) {
    return this.get().categories.find(c => c.id === id) || null;
  }

  getCategoryLabel(id) {
    const cat = this.getCategory(id);
    return cat ? cat.label : id;
  }

  getCategoryOptions() {
    return this.get().categories.map(c =>
      `<option value="${c.id}">${c.label}</option>`
    ).join('');
  }

  getCategoryLabelsArray() {
    return this.get().categories.map(c => c.label);
  }

  // ── Sheets Helpers ─────────────────────────────────────────
  getTabName(moduleId) {
    const settings = this.get();
    return (settings.sheets.tabMappings && settings.sheets.tabMappings[moduleId]) || '';
  }

  getWebAppUrl() {
    // Prefer settings-stored URL, fall back to SHEETS_CONFIG
    const settings = this.get();
    if (settings.sheets.webAppUrl) return settings.sheets.webAppUrl;
    if (typeof SHEETS_CONFIG !== 'undefined') return SHEETS_CONFIG.WEBAPP_URL;
    return '';
  }

  // ── Profile Helpers ────────────────────────────────────────
  getProfile() {
    return this.get().profile;
  }

  getDisplayName() {
    return this.get().profile.displayName || 'Gelo';
  }

  getAvatarInitials() {
    return this.get().profile.avatarInitials || 'GV';
  }

  // ── Appearance ─────────────────────────────────────────────
  getTheme() {
    return this.get().appearance?.theme || 'dark';
  }

  applyTheme(theme) {
    const t = theme || this.getTheme();
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
      document.documentElement.classList.add('theme-light');
    }
    // Update theme toggle button icon if available in DOM
    const btn = document.getElementById('btn-theme-toggle');
    if (btn && typeof getIconSvg !== 'undefined') {
      btn.innerHTML = getIconSvg(t === 'dark' ? 'sun' : 'moon', 18);
    }
    // Update stored theme
    if (theme) {
      const settings = this.get();
      settings.appearance.theme = theme;
      this.save(settings);
    }
  }

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    return next;
  }

  // ── App Name ───────────────────────────────────────────────
  getAppName() {
    return this.get().appName || 'Gelo Growth OS';
  }

  getWorkspaceName() {
    return this.get().workspaceName || 'Growth OS';
  }

  // ── Deep Merge Utility ─────────────────────────────────────
  _deepMerge(target, source) {
    const result = Object.assign({}, target);
    for (const key in source) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // ── Reset ──────────────────────────────────────────────────
  reset() {
    this._cache = null;
    localStorage.removeItem(SETTINGS_VERSION);
  }
}

// Singleton instance
const settingsEngine = new SettingsEngine();

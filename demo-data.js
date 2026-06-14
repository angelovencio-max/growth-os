// ============================================================
// Gelo Growth OS — Demo Data (Cleared)
// Clean slate with no sample data, ready for your own leads.
// ============================================================

const DEMO_CONTACTS = [];
const DEMO_ORGANIZATIONS = [];
const DEMO_LINKEDIN_LEADS = [];
const DEMO_PRIME_PIPELINE = [];
const DEMO_SCC_CONTENT = [];
const DEMO_CALMERA_ORDERS = [];
const DEMO_SOURCE_ASSETS = [];
const DEMO_REPURPOSE_OUTPUTS = [];
const DEMO_TASKS = [];
const DEMO_INTERACTIONS = [];

// New collections for All-in-One OS
const DEMO_PROJECTS = [];
const DEMO_CLIENTS = [];
const DEMO_AREAS = [
  { areaId: 'area-1', areaName: 'Prime Consulting', type: 'Business' },
  { areaId: 'area-2', areaName: 'Self Care Club', type: 'Personal' },
  { areaId: 'area-3', areaName: 'Personal Brand', type: 'Business' },
  { areaId: 'area-4', areaName: 'Health & Fitness', type: 'Personal' },
  { areaId: 'area-5', areaName: 'Personal Finance', type: 'Personal' }
];
const DEMO_GOALS = [];
const DEMO_HABITS = [];
const DEMO_LEARNING = [];
const DEMO_NOTES = [];
const DEMO_SOPS = [];

// Helper: get today's date string
function getDemoToday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper: calculate days until date
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date(getDemoToday());
  const target = new Date(dateStr);
  const diff = Math.floor((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

// Helper: check if a date is overdue
function isOverdue(dateStr) {
  return daysUntil(dateStr) < 0;
}

// Helper: check if a date is today
function isDueToday(dateStr) {
  return daysUntil(dateStr) === 0;
}

// All demo data bundled
const DEMO_DATA = {
  contacts: DEMO_CONTACTS,
  organizations: DEMO_ORGANIZATIONS,
  linkedinLeads: DEMO_LINKEDIN_LEADS,
  primePipeline: DEMO_PRIME_PIPELINE,
  sccContent: DEMO_SCC_CONTENT,
  calmeraOrders: DEMO_CALMERA_ORDERS,
  sourceAssets: DEMO_SOURCE_ASSETS,
  repurposeOutputs: DEMO_REPURPOSE_OUTPUTS,
  tasks: DEMO_TASKS,
  interactions: DEMO_INTERACTIONS,
  projects: DEMO_PROJECTS,
  clients: DEMO_CLIENTS,
  areas: DEMO_AREAS,
  goals: DEMO_GOALS,
  habits: DEMO_HABITS,
  learning: DEMO_LEARNING,
  notes: DEMO_NOTES,
  sops: DEMO_SOPS,
};

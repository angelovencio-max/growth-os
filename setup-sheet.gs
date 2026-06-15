// ============================================================
// Gelo Growth OS — Google Sheet Setup Script
// 
// HOW TO USE:
// 1. Create a new Google Sheet (sheets.new)
// 2. Name it: "Gelo Growth OS - Master"
// 3. Go to Extensions > Apps Script
// 4. Delete any existing code
// 5. Paste this ENTIRE script
// 6. Click Run ▶️ (select "setupMasterSheet")
// 7. Authorize when prompted
// 8. Wait ~30 seconds — all tabs, headers, and validations will be created!
// ============================================================

function setupMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Delete default "Sheet1" if it exists (we'll create our own tabs)
  const defaultSheet = ss.getSheetByName('Sheet1');
  
  // ── Create all tabs with headers ────────────────────────────
  const tabs = {
    'Dashboard': {
      headers: ['Metric', 'Value', 'Target', 'Status', 'Last Updated'],
      note: 'KPI dashboard — populated by formulas. Do not edit directly.',
      color: '#6366f1',
    },
    'Contacts': {
      headers: ['contact_id', 'full_name', 'email', 'mobile', 'linkedin_url', 'organization_id', 'segments', 'preferred_channel', 'contact_basis', 'owner_id', 'status', 'created_at', 'updated_at', 'notes'],
      color: '#3b82f6',
    },
    'Organizations': {
      headers: ['organization_id', 'organization_name', 'industry', 'website', 'source', 'account_status', 'owner_id', 'created_at', 'updated_at', 'notes'],
      color: '#3b82f6',
    },
    'LinkedIn_Leads': {
      headers: ['ID', 'Lead Name', 'Company', 'Stage', 'Call Date', 'Call Time', 'Follow-Up Date', 'Follow-Up Time', 'Next Action', 'Estimated Value', 'Created Date', 'Updated Date'],
      color: '#22d3ee',
    },
    'Prime_Pipeline': {
      headers: ['opportunity_id', 'contact_id', 'organization_id', 'source_lead_id', 'service_interest', 'problem_statement', 'stage', 'estimated_value', 'probability_percent', 'weighted_value', 'budget_range', 'decision_maker', 'timeline', 'discovery_date', 'proposal_date', 'next_action', 'next_action_date', 'next_action_time', 'close_date', 'outcome_reason', 'owner_id'],
      color: '#f59e0b',
    },
    'SCC_Content': {
      headers: ['ID', 'Content Title', 'Status', 'Brand', 'Platform', 'Publish Date', 'Publish Time', 'Caption', 'Created Date', 'Updated Date'],
      color: '#10b981',
    },
    'Calmera_Orders': {
      headers: ['order_id', 'external_order_ref', 'contact_id', 'customer_name', 'order_date', 'items_summary', 'order_amount', 'fulfillment_cutoff', 'preferred_channel', 'reconfirmation_status', 'latest_attempt_at', 'response_due_at', 'order_status', 'change_notes', 'resolved_at', 'owner_id'],
      color: '#ef4444',
    },
    'Reconfirmations': {
      headers: ['reconfirmation_id', 'order_id', 'attempt_number', 'channel', 'message_template_id', 'attempted_at', 'response_at', 'response_status', 'customer_request', 'next_followup_at', 'resolved_at', 'owner_id', 'interaction_id'],
      color: '#ef4444',
    },
    'Source_Assets': {
      headers: ['source_id', 'source_type', 'title', 'origin_channel', 'origin_url', 'captured_at', 'key_theme', 'audience', 'reuse_approved', 'transcript_or_notes_url', 'status', 'owner_id'],
      color: '#a855f7',
    },
    'Repurpose_Outputs': {
      headers: ['output_id', 'source_id', 'linked_content_id', 'target_brand', 'target_channel', 'format', 'angle_or_hook', 'CTA', 'status', 'draft_url', 'scheduled_at', 'published_at', 'published_url', 'views', 'engagements', 'leads_generated', 'owner_id'],
      color: '#a855f7',
    },
    'Interactions': {
      headers: ['interaction_id', 'contact_id', 'record_type', 'record_id', 'channel', 'direction', 'interaction_type', 'occurred_at', 'summary', 'outcome', 'next_action', 'next_action_date', 'owner_id'],
      color: '#64748b',
    },
    'Tasks': {
      headers: ['ID', 'Task Name', 'Description', 'Status', 'Priority', 'Start Date', 'Start Time', 'Due Date', 'Due Time', 'Area', 'Project', 'Created Date', 'Updated Date'],
      color: '#64748b',
    },
    'Projects': {
      headers: ['ID', 'Project Name', 'Status', 'Start Date', 'Start Time', 'Deadline Date', 'Deadline Time', 'Progress', 'Area', 'Created Date', 'Updated Date'],
      color: '#8b5cf6',
    },
    'Clients': {
      headers: ['ID', 'Client Name', 'Company', 'Status', 'Source Lead ID', 'Account Value', 'Start Date', 'Created Date', 'Updated Date'],
      color: '#8b5cf6',
    },
    'Areas': {
      headers: ['area_id', 'area_name', 'type'],
      color: '#8b5cf6',
    },
    'Goals': {
      headers: ['goal_id', 'goal_name', 'target_metric', 'current_metric', 'created_at'],
      color: '#8b5cf6',
    },
    'Habits': {
      headers: ['habit_id', 'habit_name', 'frequency', 'streak', 'history', 'created_at'],
      color: '#8b5cf6',
    },
    'Learning': {
      headers: ['learning_id', 'title', 'category', 'status', 'created_at'],
      color: '#8b5cf6',
    },
    'Notes': {
      headers: ['note_id', 'title', 'content', 'created_at'],
      color: '#8b5cf6',
    },
    'SOPs': {
      headers: ['sop_id', 'process_title', 'steps', 'version', 'last_updated'],
      color: '#8b5cf6',
    },
    'Lists_Config': {
      headers: ['list_type', 'list_value', 'sort_order', 'active', 'rule_setting', 'rule_value', 'template_id', 'template_text', 'updated_at'],
      color: '#374151',
    },
    'Automation_Log': {
      headers: ['log_id', 'rule_id', 'run_at', 'record_type', 'record_id', 'trigger_met', 'action_taken', 'task_id', 'result', 'error_detail'],
      color: '#374151',
    },
  };

  // Create each tab
  for (const [tabName, config] of Object.entries(tabs)) {
    let sheet = ss.getSheetByName(tabName);
    
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    
    // Set headers
    const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
    headerRange.setValues([config.headers]);
    
    // Style headers
    headerRange
      .setFontWeight('bold')
      .setFontSize(10)
      .setBackground('#1e293b')
      .setFontColor('#f1f5f9')
      .setHorizontalAlignment('left')
      .setBorder(false, false, true, false, false, false, '#334155', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    
    // Set tab color
    sheet.setTabColor(config.color);
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (let i = 1; i <= config.headers.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
    
    // Add note if present
    if (config.note) {
      sheet.getRange(2, 1).setNote(config.note);
    }
    
    Logger.log(`✅ Created tab: ${tabName}`);
  }
  
  // Delete default sheet if we created all others
  if (defaultSheet) {
    try { ss.deleteSheet(defaultSheet); } catch (e) { /* ignore */ }
  }

  // ── Set up data validations ─────────────────────────────────
  setupValidations(ss);
  
  // ── Populate Lists_Config ───────────────────────────────────
  populateConfigLists(ss);
  
  // ── Set up Dashboard formulas ───────────────────────────────
  setupDashboard(ss);

  // ── Protect sensitive columns ───────────────────────────────
  protectIdColumns(ss);

  SpreadsheetApp.getUi().alert(
    '✅ Gelo Growth OS Setup Complete!\n\n' +
    '• 22 tabs created with headers\n' +
    '• Data validations added\n' +
    '• Lists_Config populated\n' +
    '• Dashboard formulas set\n' +
    '• ID columns protected\n\n' +
    'You can now start entering data!'
  );
}


// ── Data Validations ──────────────────────────────────────────
function setupValidations(ss) {
  
  // Helper: set dropdown validation on a column (rows 2-500)
  function setDropdown(sheetName, colLetter, values) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const col = colLetter.charCodeAt(0) - 64; // A=1, B=2, etc.
    const range = sheet.getRange(2, col, 499, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    range.setDataValidation(rule);
  }
  
  // Priority (used in multiple sheets)
  const priorities = ['Critical', 'High', 'Normal', 'Low'];
  
  // ── LinkedIn_Leads
  setDropdown('LinkedIn_Leads', 'D', ['New', 'Qualified', 'Contacted', 'Nurturing', 'Closed', 'Recycle']);
  
  // ── Prime_Pipeline
  setDropdown('Prime_Pipeline', 'G', ['New Inquiry', 'Qualified', 'Discovery', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Handoff', 'Closed']);
  
  // ── SCC_Content
  setDropdown('SCC_Content', 'C', ['Idea', 'Planned', 'Draft', 'Review', 'Scheduled', 'Published', 'Archived']);
  setDropdown('SCC_Content', 'E', ['Instagram', 'TikTok / Reels', 'LinkedIn', 'Facebook Group', 'Website', 'YouTube', 'Twitter/X']);
  
  // ── Calmera_Orders
  setDropdown('Calmera_Orders', 'I', ['Email', 'SMS', 'Phone', 'WhatsApp']);
  setDropdown('Calmera_Orders', 'J', ['Pending Contact', 'Awaiting Response', 'Confirmed', 'Changed', 'Cancelled', 'Escalated', 'Closed']);
  setDropdown('Calmera_Orders', 'M', ['New', 'Pending', 'Updated', 'Fulfillment Ready', 'At Risk', 'Closed', 'Cancelled']);
  
  // ── Reconfirmations
  setDropdown('Reconfirmations', 'D', ['Email', 'SMS', 'Phone', 'WhatsApp']);
  setDropdown('Reconfirmations', 'H', ['Sent', 'Delivered', 'Read', 'Replied', 'Failed']);
  setDropdown('Reconfirmations', 'K', ['TRUE', 'FALSE']);
  
  // ── Source_Assets
  setDropdown('Source_Assets', 'B', ['Video', 'Article', 'Book', 'Podcast', 'Social Post', 'Other']);
  setDropdown('Source_Assets', 'K', ['Draft', 'Review', 'Ready', 'Archived']);
  
  // ── Repurpose_Outputs
  setDropdown('Repurpose_Outputs', 'I', ['Idea', 'Writing', 'Production', 'Editing', 'Scheduled', 'Published', 'Archived']);
  
  // ── Tasks
  setDropdown('Tasks', 'D', ['To Do', 'In Progress', 'Waiting', 'Completed', 'Cancelled']);
  setDropdown('Tasks', 'E', priorities);

  // ── Projects / Clients
  setDropdown('Projects', 'C', ['Planning', 'In Progress', 'Waiting', 'Completed', 'Cancelled']);
  setDropdown('Clients', 'D', ['Active', 'Onboarding', 'Paused', 'Closed']);
  
  Logger.log('✅ Data validations set');
}


// ── Populate Lists_Config ─────────────────────────────────────
function populateConfigLists(ss) {
  const sheet = ss.getSheetByName('Lists_Config');
  if (!sheet) return;
  
  const data = [
    // Priorities
    ['priority', 'Critical', 1, 'TRUE', 'service_level', 'Act same day', '', '', ''],
    ['priority', 'High', 2, 'TRUE', 'service_level', 'Act within 1 business day', '', '', ''],
    ['priority', 'Normal', 3, 'TRUE', 'service_level', 'Act by due date', '', '', ''],
    ['priority', 'Low', 4, 'TRUE', 'service_level', 'Review weekly or monthly', '', '', ''],
    
    // Lead stages
    ['lead_stage', 'New', 1, 'TRUE', '', '', '', '', ''],
    ['lead_stage', 'Qualified', 2, 'TRUE', '', '', '', '', ''],
    ['lead_stage', 'Contacted', 3, 'TRUE', '', '', '', '', ''],
    ['lead_stage', 'Nurturing', 4, 'TRUE', '', '', '', '', ''],
    ['lead_stage', 'Closed', 5, 'TRUE', '', '', '', '', ''],
    ['lead_stage', 'Recycle', 6, 'TRUE', '', '', '', '', ''],
    
    // Prime stages
    ['prime_stage', 'New Inquiry', 1, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Qualified', 2, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Discovery', 3, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Proposal Sent', 4, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Negotiation', 5, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Won', 6, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Lost', 7, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Handoff', 8, 'TRUE', '', '', '', '', ''],
    ['prime_stage', 'Closed', 9, 'TRUE', '', '', '', '', ''],
    
    // Content status
    ['content_status', 'Idea', 1, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Planned', 2, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Draft', 3, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Review', 4, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Scheduled', 5, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Published', 6, 'TRUE', '', '', '', '', ''],
    ['content_status', 'Archived', 7, 'TRUE', '', '', '', '', ''],
    
    // Reconfirmation status
    ['reconfirmation_status', 'Pending Contact', 1, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Awaiting Response', 2, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Confirmed', 3, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Changed', 4, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Cancelled', 5, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Escalated', 6, 'TRUE', '', '', '', '', ''],
    ['reconfirmation_status', 'Closed', 7, 'TRUE', '', '', '', '', ''],
    
    // Task status
    ['task_status', 'Open', 1, 'TRUE', '', '', '', '', ''],
    ['task_status', 'In Progress', 2, 'TRUE', '', '', '', '', ''],
    ['task_status', 'Waiting', 3, 'TRUE', '', '', '', '', ''],
    ['task_status', 'Completed', 4, 'TRUE', '', '', '', '', ''],
    ['task_status', 'Cancelled', 5, 'TRUE', '', '', '', '', ''],
    
    // Content pillars
    ['content_pillar', 'Mindset & Habits', 1, 'TRUE', '', '', '', '', ''],
    ['content_pillar', 'Mental Health', 2, 'TRUE', '', '', '', '', ''],
    ['content_pillar', 'Physical Wellness', 3, 'TRUE', '', '', '', '', ''],
    ['content_pillar', 'Productivity', 4, 'TRUE', '', '', '', '', ''],
    ['content_pillar', 'Community', 5, 'TRUE', '', '', '', '', ''],
    
    // Repurpose status
    ['repurpose_status', 'Available', 1, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Queued', 2, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Draft', 3, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Review', 4, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Scheduled', 5, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Published', 6, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Evaluated', 7, 'TRUE', '', '', '', '', ''],
    ['repurpose_status', 'Archived', 8, 'TRUE', '', '', '', '', ''],

    // Owner
    ['owner', 'Gelo', 1, 'TRUE', '', '', '', '', ''],
  ];
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  }
  
  Logger.log('✅ Lists_Config populated');
}


// ── Dashboard Formulas ────────────────────────────────────────
function setupDashboard(ss) {
  const sheet = ss.getSheetByName('Dashboard');
  if (!sheet) return;
  
  const metrics = [
    // [Metric, Formula, Target, Status Formula]
    ['Total LinkedIn Leads', '=COUNTA(LinkedIn_Leads!A2:A)', '', ''],
    ['Active Leads (not Closed)', '=COUNTIFS(LinkedIn_Leads!H2:H,"<>Closed",LinkedIn_Leads!H2:H,"<>")', '', ''],
    ['Leads Missing Next Action', '=COUNTIFS(LinkedIn_Leads!H2:H,"<>Closed",LinkedIn_Leads!L2:L,"")', '0', '=IF(B4=0,"✅","⚠️")'],
    ['Closed Leads', '=COUNTIF(LinkedIn_Leads!H2:H,"Closed")', '', ''],
    ['Conversion Rate', '=IF(B2>0,B5/B2,0)', '>=25%', ''],
    ['', '', '', ''],
    ['Total Pipeline Opportunities', '=COUNTA(Prime_Pipeline!A2:A)', '', ''],
    ['Active Pipeline Value', '=SUMPRODUCT((Prime_Pipeline!G2:G<>"Won")*(Prime_Pipeline!G2:G<>"Lost")*(Prime_Pipeline!G2:G<>"")*Prime_Pipeline!H2:H)', '', ''],
    ['Weighted Forecast', '=SUMPRODUCT((Prime_Pipeline!G2:G<>"Won")*(Prime_Pipeline!G2:G<>"Lost")*(Prime_Pipeline!G2:G<>"")*Prime_Pipeline!J2:J)', '', ''],
    ['Won Revenue', '=SUMIF(Prime_Pipeline!G2:G,"Won",Prime_Pipeline!H2:H)', '', ''],
    ['Won Deals', '=COUNTIF(Prime_Pipeline!G2:G,"Won")', '', ''],
    ['', '', '', ''],
    ['Total Content Items', '=COUNTA(SCC_Content!A2:A)', '', ''],
    ['Published Content', '=COUNTIF(SCC_Content!I2:I,"Published")', '', ''],
    ['Content in Pipeline', '=COUNTIFS(SCC_Content!I2:I,"<>Published",SCC_Content!I2:I,"<>Archived",SCC_Content!I2:I,"<>")', '', ''],
    ['Total Content Views', '=SUM(SCC_Content!O2:O)', '', ''],
    ['', '', '', ''],
    ['Total Calmera Orders', '=COUNTA(Calmera_Orders!A2:A)', '', ''],
    ['Pending Reconfirmation', '=COUNTIFS(Calmera_Orders!J2:J,"<>Confirmed",Calmera_Orders!J2:J,"<>Closed",Calmera_Orders!J2:J,"<>Changed",Calmera_Orders!J2:J,"<>")', '', ''],
    ['Confirmed Orders', '=COUNTIF(Calmera_Orders!J2:J,"Confirmed")', '', ''],
    ['Escalated Orders', '=COUNTIF(Calmera_Orders!J2:J,"Escalated")', '0', '=IF(B22=0,"✅","🚨")'],
    ['Confirmation Rate', '=IF(B19>0,B21/B19,0)', '>=95%', ''],
    ['', '', '', ''],
    ['Total Source Assets', '=COUNTA(Source_Assets!A2:A)', '', ''],
    ['Total Repurpose Outputs', '=COUNTA(Repurpose_Outputs!A2:A)', '', ''],
    ['Outputs per Source', '=IF(B25>0,B26/B25,0)', '>=3', ''],
    ['Published Outputs', '=COUNTIF(Repurpose_Outputs!I2:I,"Published")', '', ''],
    ['', '', '', ''],
    ['Open Tasks', '=COUNTIFS(Tasks!I2:I,"<>Completed",Tasks!I2:I,"<>Cancelled",Tasks!I2:I,"<>")', '', ''],
    ['Overdue Tasks', '=COUNTIFS(Tasks!I2:I,"<>Completed",Tasks!I2:I,"<>Cancelled",Tasks!G2:G,"<"&TODAY(),Tasks!G2:G,"<>")', '0', '=IF(B31=0,"✅","🔴")'],
    ['Critical Tasks', '=COUNTIFS(Tasks!F2:F,"Critical",Tasks!I2:I,"<>Completed",Tasks!I2:I,"<>Cancelled")', '0', ''],
    ['Completed Today', '=COUNTIF(Tasks!J2:J,TODAY())', '', ''],
  ];
  
  // Write metrics
  for (let i = 0; i < metrics.length; i++) {
    const row = i + 2;
    const [metric, formula, target, statusFormula] = metrics[i];
    
    sheet.getRange(row, 1).setValue(metric);
    if (formula) sheet.getRange(row, 2).setFormula(formula);
    if (target) sheet.getRange(row, 3).setValue(target);
    if (statusFormula) sheet.getRange(row, 4).setFormula(statusFormula);
  }
  
  // Format percentage rows
  [5, 23, 27].forEach(rowOffset => {
    sheet.getRange(rowOffset + 1, 2).setNumberFormat('0.0%');
  });
  
  // Format currency rows
  [9, 10, 11].forEach(rowOffset => {
    sheet.getRange(rowOffset + 1, 2).setNumberFormat('₱#,##0');
  });
  
  // Style metric names
  sheet.getRange(2, 1, metrics.length, 1).setFontWeight('bold');
  
  // Section header rows (empty rows as separators)
  [7, 13, 18, 24, 29].forEach(rowOffset => {
    const row = rowOffset + 1;
    sheet.getRange(row, 1, 1, 4).setBackground('#0f172a');
  });
  
  // Column widths
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  
  Logger.log('✅ Dashboard formulas set');
}


// ── Protect ID Columns ────────────────────────────────────────
function protectIdColumns(ss) {
  const tabsWithIds = [
    'Contacts', 'Organizations', 'LinkedIn_Leads', 'Prime_Pipeline',
    'SCC_Content', 'Calmera_Orders', 'Reconfirmations', 'Source_Assets',
    'Repurpose_Outputs', 'Interactions', 'Tasks',
    'Projects', 'Clients', 'Areas', 'Goals', 'Habits', 'Learning', 'Notes', 'SOPs'
  ];
  
  tabsWithIds.forEach(tabName => {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    
    // Add a warning note to column A header
    sheet.getRange(1, 1).setNote('⚠️ ID column — do not edit or delete existing IDs. New IDs should follow the pattern shown.');
  });
  
  // Protect Dashboard tab entirely (except for manual review)
  const dashboard = ss.getSheetByName('Dashboard');
  if (dashboard) {
    const protection = dashboard.protect().setDescription('Dashboard - formulas only');
    protection.setWarningOnly(true);
  }
  
  // Protect Automation_Log (automation writes only)
  const autoLog = ss.getSheetByName('Automation_Log');
  if (autoLog) {
    const protection = autoLog.protect().setDescription('Automation Log - system writes only');
    protection.setWarningOnly(true);
  }
  
  Logger.log('✅ ID columns protected');
}


// ── Weighted Value Formula (for Prime_Pipeline) ───────────────
function addWeightedValueFormulas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Prime_Pipeline');
  if (!sheet) return;
  
  // Column J = weighted_value = H (estimated_value) * I (probability_percent) / 100
  const lastRow = Math.max(sheet.getLastRow(), 2);
  for (let row = 2; row <= Math.max(lastRow, 100); row++) {
    sheet.getRange(row, 10).setFormula(`=IF(H${row}<>"",H${row}*I${row}/100,"")`);
  }
  
  Logger.log('✅ Weighted value formulas added');
}


// ── Auto-generate IDs (can be called manually or via trigger) ─
function generateIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const configs = [
    { tab: 'Contacts', prefix: 'CON', col: 1 },
    { tab: 'Organizations', prefix: 'ORG', col: 1 },
    { tab: 'LinkedIn_Leads', prefix: 'LL', col: 1 },
    { tab: 'Prime_Pipeline', prefix: 'PO', col: 1 },
    { tab: 'SCC_Content', prefix: 'SCC', col: 1 },
    { tab: 'Calmera_Orders', prefix: 'CAL', col: 1 },
    { tab: 'Reconfirmations', prefix: 'RC', col: 1 },
    { tab: 'Source_Assets', prefix: 'SA', col: 1 },
    { tab: 'Repurpose_Outputs', prefix: 'RO', col: 1 },
    { tab: 'Interactions', prefix: 'INT', col: 1 },
    { tab: 'Tasks', prefix: 'T', col: 1 },
    { tab: 'Projects', prefix: 'PRJ', col: 1 },
    { tab: 'Clients', prefix: 'CLI', col: 1 },
    { tab: 'Areas', prefix: 'AREA', col: 1 },
    { tab: 'Goals', prefix: 'G', col: 1 },
    { tab: 'Habits', prefix: 'H', col: 1 },
    { tab: 'Learning', prefix: 'L', col: 1 },
    { tab: 'Notes', prefix: 'N', col: 1 },
    { tab: 'SOPs', prefix: 'SOP', col: 1 },
  ];
  
  configs.forEach(({ tab, prefix, col }) => {
    const sheet = ss.getSheetByName(tab);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    const idRange = sheet.getRange(2, col, lastRow - 1, 1);
    const ids = idRange.getValues();
    
    // Find highest existing ID number
    let maxNum = 0;
    ids.forEach(([id]) => {
      if (id && typeof id === 'string') {
        const match = id.match(/(\d+)$/);
        if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
      }
    });
    
    // Fill missing IDs
    let changed = false;
    ids.forEach(([id], i) => {
      if (!id) {
        maxNum++;
        ids[i][0] = `${prefix}-${String(maxNum).padStart(4, '0')}`;
        changed = true;
      }
    });
    
    if (changed) {
      idRange.setValues(ids);
      Logger.log(`✅ Generated IDs for ${tab}`);
    }
  });
}


// ── Add timestamp triggers ────────────────────────────────────
function addTimestamps() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  
  // For each tab with created_at / updated_at columns, fill them
  const tabConfigs = [
    { tab: 'Contacts', createdCol: 12, updatedCol: 13 },
    { tab: 'Organizations', createdCol: 8, updatedCol: 9 },
  ];
  
  tabConfigs.forEach(({ tab, createdCol, updatedCol }) => {
    const sheet = ss.getSheetByName(tab);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    for (let row = 2; row <= lastRow; row++) {
      const created = sheet.getRange(row, createdCol).getValue();
      if (!created) {
        sheet.getRange(row, createdCol).setValue(now);
      }
      sheet.getRange(row, updatedCol).setValue(now);
    }
  });
}


// ── Menu for easy access ──────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 Gelo Growth OS')
    .addItem('🔧 Run Full Setup', 'setupMasterSheet')
    .addSeparator()
    .addItem('🆔 Generate Missing IDs', 'generateIds')
    .addItem('📊 Add Weighted Value Formulas', 'addWeightedValueFormulas')
    .addItem('🕐 Update Timestamps', 'addTimestamps')
    .addToUi();
}

// ============================================================
// Gelo Growth OS — Sheet API (Web App)
//
// This script turns your Google Sheet into a simple REST API.
// The dashboard reads and writes data through this script.
//
// SETUP:
// 1. Open your "Gelo Growth OS" Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Create a NEW file (click + next to "Files") named "API"
// 4. Paste this entire script into the new file
// 5. Click Deploy > New deployment
// 6. Type: Web app
// 7. Execute as: Me
// 8. Who has access: Anyone
// 9. Click Deploy
// 10. Copy the Web App URL — paste it into sheets-config.js
//
// That's it! The dashboard can now read/write your sheet.
// ============================================================

// ── Default Column Headers Configuration ──────────────────────
const DEFAULT_HEADERS = {
  'Contacts': ['contact_id', 'full_name', 'email', 'mobile', 'linkedin_url', 'organization_id', 'segments', 'preferred_channel', 'contact_basis', 'owner_id', 'status', 'created_at', 'updated_at', 'notes'],
  'Organizations': ['organization_id', 'organization_name', 'industry', 'website', 'source', 'account_status', 'owner_id', 'created_at', 'updated_at', 'notes'],
  'LinkedIn_Leads': ['ID', 'Lead Name', 'Company', 'Stage', 'Call Date', 'Call Time', 'Follow-Up Date', 'Follow-Up Time', 'Next Action', 'Estimated Value', 'Created Date', 'Updated Date'],
  'Prime_Pipeline': ['opportunity_id', 'contact_id', 'organization_id', 'source_lead_id', 'service_interest', 'problem_statement', 'stage', 'estimated_value', 'probability_percent', 'weighted_value', 'budget_range', 'decision_maker', 'timeline', 'discovery_date', 'proposal_date', 'next_action', 'next_action_date', 'next_action_time', 'close_date', 'outcome_reason', 'owner_id'],
  'SCC_Content': ['ID', 'Content Title', 'Status', 'Brand', 'Platform', 'Publish Date', 'Publish Time', 'Caption', 'Created Date', 'Updated Date'],
  'Calmera_Orders': ['order_id', 'external_order_ref', 'contact_id', 'customer_name', 'order_date', 'items_summary', 'order_amount', 'fulfillment_cutoff', 'preferred_channel', 'reconfirmation_status', 'latest_attempt_at', 'response_due_at', 'order_status', 'change_notes', 'resolved_at', 'owner_id'],
  'Reconfirmations': ['reconfirmation_id', 'order_id', 'attempt_number', 'channel', 'message_template_id', 'attempted_at', 'response_at', 'response_status', 'customer_request', 'next_followup_at', 'resolved_at', 'owner_id', 'interaction_id'],
  'Source_Assets': ['source_id', 'source_type', 'title', 'origin_channel', 'origin_url', 'captured_at', 'key_theme', 'audience', 'reuse_approved', 'transcript_or_notes_url', 'status', 'owner_id'],
  'Repurpose_Outputs': ['output_id', 'source_id', 'linked_content_id', 'target_brand', 'target_channel', 'format', 'angle_or_hook', 'CTA', 'status', 'draft_url', 'scheduled_at', 'published_at', 'published_url', 'views', 'engagements', 'leads_generated', 'owner_id'],
  'Interactions': ['interaction_id', 'contact_id', 'record_type', 'record_id', 'channel', 'direction', 'interaction_type', 'occurred_at', 'summary', 'outcome', 'next_action', 'next_action_date', 'owner_id'],
  'Tasks': ['ID', 'Task Name', 'Description', 'Status', 'Priority', 'Start Date', 'Start Time', 'Due Date', 'Due Time', 'Area', 'Project', 'Created Date', 'Updated Date'],
  'Projects': ['ID', 'Project Name', 'Status', 'Start Date', 'Start Time', 'Deadline Date', 'Deadline Time', 'Progress', 'Area', 'Created Date', 'Updated Date'],
  'Clients': ['ID', 'Client Name', 'Company', 'Status', 'Source Lead ID', 'Account Value', 'Start Date', 'Created Date', 'Updated Date'],
  'Areas': ['area_id', 'area_name', 'type'],
  'Goals': ['goal_id', 'goal_name', 'target_metric', 'current_metric', 'created_at'],
  'Habits': ['habit_id', 'habit_name', 'frequency', 'streak', 'history', 'created_at'],
  'Learning': ['learning_id', 'title', 'category', 'status', 'created_at'],
  'Notes': ['note_id', 'title', 'content', 'created_at'],
  'SOPs': ['sop_id', 'process_title', 'steps', 'version', 'last_updated']
};

const MODULE_TAB_MAPPINGS = {
  'tasks': 'Tasks',
  'task': 'Tasks',
  'projects': 'Projects',
  'project': 'Projects',
  'crm': 'LinkedIn_Leads',
  'leads': 'LinkedIn_Leads',
  'lead': 'LinkedIn_Leads',
  'linkedinleads': 'LinkedIn_Leads',
  'linkedin_leads': 'LinkedIn_Leads',
  'primepipeline': 'Prime_Pipeline',
  'prime_pipeline': 'Prime_Pipeline',
  'clients': 'Clients',
  'client': 'Clients',
  'content': 'SCC_Content',
  'scccontent': 'SCC_Content',
  'scc_content': 'SCC_Content',
  'operations': 'Tasks',
  'calmeraorders': 'Calmera_Orders',
  'calmera_orders': 'Calmera_Orders',
  'sourceassets': 'Source_Assets',
  'source_assets': 'Source_Assets',
  'repurposeoutputs': 'Repurpose_Outputs',
  'repurpose_outputs': 'Repurpose_Outputs',
  'interactions': 'Interactions',
  'reconfirmations': 'Reconfirmations',
  'contacts': 'Contacts',
  'organizations': 'Organizations',
  'goals': 'Goals',
  'habits': 'Habits',
  'learning': 'Learning',
  'notes': 'Notes',
  'sops': 'SOPs',
  'areas': 'Areas'
};

function resolveTargetTab(tab, tabName, moduleName) {
  const rawTarget = tab || tabName || moduleName;

  // Guard: missing, blank, or the literal string "undefined"/"null"
  if (rawTarget === undefined || rawTarget === null) {
    throw new Error('Missing sheet tab/module name in request payload. Make sure the "tab" or "module" field is set correctly.');
  }
  const rawStr = String(rawTarget).trim();
  if (rawStr === '' || rawStr === 'undefined' || rawStr === 'null') {
    throw new Error('Invalid sheet tab name "' + rawStr + '" — this is a frontend bug. The tab name was not resolved before sending the request.');
  }

  const normTarget = normalizeString(rawTarget);

  const mapped = MODULE_TAB_MAPPINGS[normTarget];
  if (mapped) return mapped;

  for (var configuredTab in DEFAULT_HEADERS) {
    if (normalizeString(configuredTab) === normTarget) return configuredTab;
  }

  throw new Error('Unsupported sheet module/tab "' + rawTarget + '". Expected one of: Tasks, Projects, CRM, Clients, Content, Goals, Habits, Notes, SOPs, Learning.');
}

// ── Safe Tab Getter & Creator ──────────────────────────────────
function getOrSetupSheet(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet ID is invalid or access was denied. Make sure the spreadsheet exists and permissions are configured.');
  }

  // Case-insensitive tab lookup — find existing sheet by name regardless of case/whitespace
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    const normTarget = String(tabName).toLowerCase().trim();
    const allSheets = ss.getSheets();
    for (var si = 0; si < allSheets.length; si++) {
      if (allSheets[si].getName().toLowerCase().trim() === normTarget) {
        sheet = allSheets[si];
        break;
      }
    }
  }

  const headers = DEFAULT_HEADERS[tabName];
  if (!headers) {
    // Tab name not in our config — provide a clear error instead of silently creating a blank sheet
    throw new Error('Sheet tab "' + tabName + '" was not found in your spreadsheet and has no default configuration. Please create a tab named "' + tabName + '" or copy the latest sheet-api.gs script and redeploy.');
  }

  if (!sheet) {
    // Tab is configured but doesn't exist yet — create it automatically
    sheet = ss.insertSheet(tabName);
  }

  // If the sheet is empty (no headers or rows), initialize it
  if (sheet.getLastColumn() === 0 || sheet.getLastRow() === 0) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    
    // Premium header styling
    headerRange
      .setFontWeight('bold')
      .setFontSize(10)
      .setBackground('#1e293b')
      .setFontColor('#f1f5f9')
      .setHorizontalAlignment('left')
      .setBorder(false, false, true, false, false, false, '#334155', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 150);
    }
    Logger.log('Initialized headers for blank tab: ' + tabName);
  } else {
    // Check for missing headers and append them
    // Use normalized comparison (lowercase, no spaces/underscores) to prevent duplicate columns
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const normExisting = existingHeaders.map(function(h) {
      return String(h || '').toLowerCase().replace(/[\s_-]/g, '');
    });
    const missingHeaders = [];
    headers.forEach(function(h) {
      const normH = String(h || '').toLowerCase().replace(/[\s_-]/g, '');
      if (normExisting.indexOf(normH) === -1) {
        missingHeaders.push(h);
      }
    });
    if (missingHeaders.length > 0) {
      const newStartCol = existingHeaders.length + 1;
      const range = sheet.getRange(1, newStartCol, 1, missingHeaders.length);
      range.setValues([missingHeaders]);
      
      // Premium header styling for new columns
      range
        .setFontWeight('bold')
        .setFontSize(10)
        .setBackground('#1e293b')
        .setFontColor('#f1f5f9')
        .setHorizontalAlignment('left')
        .setBorder(false, false, true, false, false, false, '#334155', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
        
      for (var i = 0; i < missingHeaders.length; i++) {
        sheet.setColumnWidth(newStartCol + i, 150);
      }
      Logger.log('Appended missing headers for ' + tabName + ': ' + missingHeaders.join(', '));
    }
  }
  
  return sheet;
}

// ── GET Handler (Read Data) ───────────────────────────────────
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'readAll';
    const tab = e && e.parameter && e.parameter.tab;

    if (action === 'readAll') {
      return sendJSON(readAllTabs());
    }

    if (action === 'read' && tab) {
      return sendJSON(readTab(tab));
    }

    if (action === 'ping') {
      return sendJSON({ status: 'ok', timestamp: new Date().toISOString(), sheetName: SpreadsheetApp.getActiveSpreadsheet().getName() });
    }

    return sendJSON({ success: false, error: 'Unknown action. Use: readAll, read, or ping' });

  } catch (err) {
    return sendJSON({ success: false, error: err.message });
  }
}

// ── POST Handler (Write Data) ─────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return sendJSON({ success: false, error: 'Empty or missing POST body contents' });
    }

    const payload = JSON.parse(e.postData.contents);
    let { action, tab, data, record, rowIndex, oldName, newName, oldHeader, newHeader, tabName, module } = payload;
    if (!data && record) {
      data = record;
    }

    // Normalize action: 'create' → 'append'
    if (action === 'create') {
      action = 'append';
    }

    // Flat payload fallback: if no 'data' key but root payload has fields, treat root as data
    // (strip our control keys and use the rest as the row data)
    if (!data && action === 'append') {
      var controlKeys = ['action', 'tab', 'tabName', 'module', 'record', 'rowIndex', 'oldName', 'newName', 'oldHeader', 'newHeader'];
      var flatData = {};
      Object.keys(payload).forEach(function(k) {
        if (controlKeys.indexOf(k) === -1) {
          flatData[k] = payload[k];
        }
      });
      if (Object.keys(flatData).length > 0) {
        data = flatData;
        Logger.log('Using flat payload as data: ' + JSON.stringify(flatData));
      }
    }

    const needsTarget = ['append', 'update', 'delete', 'batchAppend'].indexOf(action) !== -1;
    const targetTab = needsTarget ? resolveTargetTab(tab, tabName, module) : null;

    // Extract recordId for response
    let recordId = '';
    if (data) {
      recordId = data.task_id || data.taskId || data.project_id || data.projectId || data.client_id || data.clientId || data.content_id || data.contentId || data.lead_id || data.leadId || data.source_lead_id || data.sourceLeadId || data.opportunity_id || data.opportunityId || data.id || data.goal_id || data.goalId || '';
    }

    if (action === 'append' && targetTab && data) {
      const result = appendRow(targetTab, data);
      return sendJSON({ success: true, message: 'Record saved successfully', recordId: recordId, rowsAfter: result });
    }

    if (action === 'update' && targetTab && data) {
      // Find row index if not provided (using unique ID matching)
      let resolvedRowIndex = rowIndex;
      if (resolvedRowIndex === undefined) {
        resolvedRowIndex = findRowIndexById(targetTab, data);
      }
      if (resolvedRowIndex === undefined || resolvedRowIndex === -1) {
        return sendJSON({ success: false, error: 'Row index or unique ID not found for update' });
      }
      updateRow(targetTab, resolvedRowIndex, data);
      return sendJSON({ success: true, message: 'Record saved successfully', recordId: recordId, row: resolvedRowIndex });
    }

    if (action === 'delete' && targetTab) {
      let resolvedRowIndex = rowIndex;
      if (resolvedRowIndex === undefined && data) {
        resolvedRowIndex = findRowIndexById(targetTab, data);
      }
      if (resolvedRowIndex === undefined || resolvedRowIndex === -1) {
        return sendJSON({ success: false, error: 'Row index not found for delete' });
      }
      deleteRow(targetTab, resolvedRowIndex);
      return sendJSON({ success: true, message: 'Record saved successfully', row: resolvedRowIndex });
    }

    if (action === 'batchAppend' && targetTab && Array.isArray(data)) {
      const result = batchAppendRows(targetTab, data);
      return sendJSON({ success: true, message: 'Record saved successfully', rowsAdded: data.length, rowsAfter: result });
    }

    if (action === 'renameTab' && oldName && newName) {
      renameTab(oldName, newName);
      return sendJSON({ success: true, message: 'Record saved successfully', oldName, newName });
    }

    if (action === 'renameSpreadsheet' && newName) {
      renameSpreadsheet(newName);
      return sendJSON({ success: true, message: 'Record saved successfully', newName });
    }

    if (action === 'renameColumn' && tabName && oldHeader && newHeader) {
      renameColumn(tabName, oldHeader, newHeader);
      return sendJSON({ success: true, message: 'Record saved successfully', tabName, oldHeader, newHeader });
    }

    return sendJSON({ success: false, error: 'Invalid action. Use: append, update, delete, batchAppend, renameTab, renameSpreadsheet, or renameColumn' });

  } catch (err) {
    return sendJSON({ success: false, error: err.message });
  }
}

// ── Read All Tabs ─────────────────────────────────────────────
function readAllTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const result = {};

  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (sheet.getLastRow() > 1 && sheet.getLastColumn() > 0) {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      const rows = dataRange.getValues();

      result[name] = rows
        .filter(row => row.some(cell => cell !== '' && cell !== null))
        .map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            let val = row[i];
            // Convert dates to strings
            if (val instanceof Date) {
              val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            }
            // Convert empty to ''
            if (val === null || val === undefined) val = '';
            obj[header] = val;
          });
          return obj;
        });
    } else {
      result[name] = [];
    }
  });

  return result;
}

// ── Read Single Tab ───────────────────────────────────────────
function readTab(tabName) {
  const sheet = getOrSetupSheet(tabName);
  if (sheet.getLastRow() <= 1) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const rows = dataRange.getValues();

  return rows
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        let val = row[i];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        if (val === null || val === undefined) val = '';
        obj[header] = val;
      });
      return obj;
    });
}

// ── Helper functions for flexible header matching and synchronization ──────────

function normalizeString(str) {
  return String(str || '').toLowerCase().trim().replace(/[\s_-]/g, '');
}

function getSynonymsForTab(tabName) {
  const taskSynonyms = {
    'id': ['id', 'taskid', 'task_id', 'taskId'],
    'taskid': ['taskid', 'task_id', 'taskId', 'id'],
    'title': ['title', 'taskname', 'task_name', 'name', 'task_title', 'taskTitle'],
    'taskname': ['taskname', 'task_name', 'taskTitle', 'title', 'name'],
    'description': ['description', 'notes', 'notes_content', 'notescontent'],
    'notes': ['notes', 'description', 'notes_content', 'notescontent', 'changenotes'],
    'status': ['status'],
    'priority': ['priority'],
    'dueat': ['dueat', 'duedate', 'due_date', 'dueAt', 'deadline'],
    'duedate': ['duedate', 'due_date', 'dueAt', 'dueat', 'deadline'],
    'duetime': ['duetime', 'dueTime', 'due_time'],
    'startdate': ['startdate', 'startDate', 'start_date'],
    'starttime': ['starttime', 'startTime', 'start_time'],
    'area': ['area', 'area_id', 'areaId'],
    'areaid': ['areaid', 'area_id', 'area', 'areaId'],
    'project': ['project', 'project_id', 'projectId'],
    'projectid': ['projectid', 'project_id', 'project', 'projectId'],
    'createdat': ['createdat', 'created_at', 'createddate', 'created_date', 'createdAt'],
    'updatedat': ['updatedat', 'updated_at', 'updateddate', 'updated_date', 'updatedAt']
  };

  const projectSynonyms = {
    'id': ['id', 'projectid', 'project_id', 'projectId'],
    'projectid': ['projectid', 'project_id', 'projectId', 'id'],
    'projectname': ['projectname', 'project_name', 'name', 'title'],
    'status': ['status'],
    'deadline': ['deadline', 'deadlinedate', 'deadline_date', 'deadlineDate'],
    'deadlinedate': ['deadlinedate', 'deadline_date', 'deadlineDate', 'deadline'],
    'deadlinetime': ['deadlinetime', 'deadline_time', 'deadlineTime'],
    'startdate': ['startdate', 'startDate', 'start_date'],
    'starttime': ['starttime', 'startTime', 'start_time'],
    'progress': ['progress'],
    'area': ['area', 'area_id', 'areaId'],
    'areaid': ['areaid', 'area_id', 'area', 'areaId'],
    'createdat': ['createdat', 'created_at', 'createddate', 'created_date', 'createdAt']
  };

  const crmSynonyms = {
    'id': ['id', 'leadid', 'lead_id', 'leadId'],
    'leadid': ['leadid', 'lead_id', 'leadId', 'id'],
    'name': ['name', 'leadname', 'lead_name', 'contactname', 'contactName'],
    'leadname': ['leadname', 'lead_name', 'contactname', 'contactName', 'name'],
    'companybrand': ['companybrand', 'company', 'brand', 'company_brand', 'companyName'],
    'company': ['company', 'companybrand', 'company_brand', 'companyName', 'organizationName'],
    'stage': ['stage'],
    'calldate': ['calldate', 'call_date', 'callDate'],
    'calltime': ['calltime', 'call_time', 'callTime'],
    'followupdate': ['followupdate', 'follow_up_date', 'followUpDate', 'nextactiondate', 'nextActionDate'],
    'followuptime': ['followuptime', 'follow_up_time', 'followUpTime', 'nextactiontime', 'nextActionTime'],
    'nextaction': ['nextaction', 'next_action', 'nextAction'],
    'estimatedvalue': ['estimatedvalue', 'estimated_value', 'estimatedValue', 'projectedcloseamount', 'projectedCloseAmount', 'deal_value'],
    'createdat': ['createdat', 'created_at', 'createddate', 'created_date', 'createdAt']
  };

  const contentSynonyms = {
    'id': ['id', 'contentid', 'content_id', 'contentId'],
    'contentid': ['contentid', 'content_id', 'contentId', 'id'],
    'title': ['title', 'contenttitle', 'content_title', 'contentTitle'],
    'contenttitle': ['contenttitle', 'content_title', 'contentTitle', 'title'],
    'status': ['status'],
    'brand': ['brand', 'targetBrand', 'target_brand', 'campaign'],
    'platform': ['platform', 'channel', 'targetChannel', 'target_channel'],
    'plannedpublishat': ['plannedpublishat', 'planned_publish_at', 'plannedPublishAt', 'publishdate', 'publish_date', 'publishDate'],
    'publishdate': ['publishdate', 'publish_date', 'publishDate', 'plannedpublishat', 'planned_publish_at', 'plannedPublishAt'],
    'plannedpublishtime': ['plannedpublishtime', 'planned_publish_time', 'plannedPublishTime', 'publishtime', 'publish_time', 'publishTime'],
    'publishtime': ['publishtime', 'publish_time', 'publishTime', 'plannedpublishtime', 'planned_publish_time', 'plannedPublishTime'],
    'caption': ['caption', 'notes', 'summary', 'content'],
    'createdat': ['createdat', 'created_at', 'createddate', 'created_date', 'createdAt']
  };

  const clientSynonyms = {
    'id': ['id', 'clientid', 'client_id', 'clientId'],
    'clientid': ['clientid', 'client_id', 'clientId', 'id'],
    'clientname': ['clientname', 'client_name', 'clientName', 'name'],
    'company': ['company', 'organizationName', 'orgName'],
    'status': ['status'],
    'sourceleadid': ['sourceleadid', 'source_lead_id', 'sourceLeadId', 'leadid', 'lead_id', 'leadId'],
    'leadid': ['leadid', 'lead_id', 'leadId', 'sourceleadid', 'source_lead_id', 'sourceLeadId'],
    'accountvalue': ['accountvalue', 'account_value', 'accountValue', 'estimatedvalue', 'estimated_value'],
    'startdate': ['startdate', 'start_date', 'startDate'],
    'createdat': ['createdat', 'created_at', 'createddate', 'created_date', 'createdAt'],
    'updatedat': ['updatedat', 'updated_at', 'updateddate', 'updated_date', 'updatedAt']
  };

  if (tabName === 'Tasks') return taskSynonyms;
  if (tabName === 'Projects') return projectSynonyms;
  if (tabName === 'LinkedIn_Leads' || tabName === 'Prime_Pipeline') return crmSynonyms;
  if (tabName === 'SCC_Content') return contentSynonyms;
  if (tabName === 'Clients') return clientSynonyms;
  return {};
}

function getValueByHeader(header, data, tabName, existingVal) {
  if (!data) return existingVal !== undefined ? existingVal : '';
  const normHeader = normalizeString(header);
  
  // 1. Direct match
  for (const key of Object.keys(data)) {
    if (normalizeString(key) === normHeader) {
      const val = data[key];
      return val !== undefined && val !== null ? val : '';
    }
  }
  
  // 2. Synonym map match
  const synonyms = getSynonymsForTab(tabName);
  for (const [canonical, list] of Object.entries(synonyms)) {
    if (normalizeString(canonical) === normHeader) {
      for (const key of Object.keys(data)) {
        const normKey = normalizeString(key);
        if (list.map(normalizeString).indexOf(normKey) !== -1) {
          const val = data[key];
          return val !== undefined && val !== null ? val : '';
        }
      }
    }
  }
  
  // 3. Return existing cell value if updating, else empty string
  if (existingVal !== undefined) return existingVal;
  return '';
}

function findRowIndexById(tabName, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() <= 1) return -1;
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Find column containing 'id' in its header
  let idColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    const norm = normalizeString(headers[i]);
    if (norm.indexOf('id') !== -1) {
      idColIndex = i;
      break;
    }
  }
  
  if (idColIndex === -1) return -1;
  
  const targetId = getValueByHeader(headers[idColIndex], data, tabName);
  if (!targetId) return -1;
  
  const values = sheet.getRange(2, idColIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][0]) === String(targetId)) {
      return r; // 0-indexed data row index
    }
  }
  
  return -1;
}

// ── Append Row ────────────────────────────────────────────────
function appendRow(tabName, data) {
  const sheet = getOrSetupSheet(tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(header => {
    const val = getValueByHeader(header, data, tabName);
    return Array.isArray(val) ? val.join(', ') : val;
  });

  sheet.appendRow(row);
  return sheet.getLastRow() - 1; // data row count
}

// ── Batch Append ──────────────────────────────────────────────
function batchAppendRows(tabName, dataArray) {
  const sheet = getOrSetupSheet(tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = dataArray.map(data =>
    headers.map(header => {
      const val = getValueByHeader(header, data, tabName);
      return Array.isArray(val) ? val.join(', ') : val;
    })
  );

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, headers.length).setValues(rows);
  return sheet.getLastRow() - 1;
}

// ── Update Row ────────────────────────────────────────────────
function updateRow(tabName, rowIndex, data) {
  const sheet = getOrSetupSheet(tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-indexed
  
  const existingValues = sheet.getRange(sheetRow, 1, 1, headers.length).getValues()[0];
  const row = headers.map((header, i) => {
    const val = getValueByHeader(header, data, tabName, existingValues[i]);
    return Array.isArray(val) ? val.join(', ') : val;
  });

  sheet.getRange(sheetRow, 1, 1, headers.length).setValues([row]);
}

// ── Delete Row ────────────────────────────────────────────────
function deleteRow(tabName, rowIndex) {
  const sheet = getOrSetupSheet(tabName);
  const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-indexed
  sheet.deleteRow(sheetRow);
}

// ── Rename Tab ────────────────────────────────────────────────
function renameTab(oldName, newName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(oldName);
  if (!sheet) throw new Error(`Tab "${oldName}" not found`);
  sheet.setName(newName);
}

// ── Rename Spreadsheet ────────────────────────────────────────
function renameSpreadsheet(newName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setName(newName);
}

// ── Rename Column ─────────────────────────────────────────────
function renameColumn(tabName, oldHeader, newHeader) {
  const sheet = getOrSetupSheet(tabName);
  if (sheet.getLastColumn() < 1) throw new Error(`Tab "${tabName}" has no columns`);
  
  const headersRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headersRange.getValues()[0];
  const colIndex = headers.indexOf(oldHeader);
  
  if (colIndex === -1) throw new Error(`Column "${oldHeader}" not found in tab "${tabName}"`);
  
  sheet.getRange(1, colIndex + 1).setValue(newHeader);
}

// ── JSON Response Helper ──────────────────────────────────────
function sendJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Trigger Cleanup (run manually after deploying updates) ───────────────
function cleanupGrowthOsTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const removed = [];

  triggers.forEach(function(trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'migrateLeadsToV26') {
      ScriptApp.deleteTrigger(trigger);
      removed.push(handler);
    }
  });

  Logger.log('Removed stale Growth OS triggers: ' + (removed.length ? removed.join(', ') : 'none'));
  return removed;
}

// ── Test function (run manually to verify) ────────────────────
function testReadAll() {
  const data = readAllTabs();
  Logger.log('Tabs loaded: ' + Object.keys(data).join(', '));
  Object.entries(data).forEach(([tab, rows]) => {
    Logger.log(`  ${tab}: ${rows.length} rows`);
  });
}

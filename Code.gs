/**
 * 🎬 MOVIE SCHEDULE CRM  →  GOOGLE CALENDAR SYNC + REMINDERS
 * ---------------------------------------------------------------------------
 * Lives INSIDE your "Work flow" Google Sheet (Extensions ▸ Apps Script).
 * Each sheet tab (KS 10, Sardar 2, Hello Kadhal, Toxic, ...) is one project.
 *
 * What it does:
 *   1. You type an event's real date in the "Event Date" column.
 *   2. It creates / updates a Google Calendar event automatically (with the
 *      boss added as a guest, so it lands on the boss's calendar too).
 *   3. Every morning it emails the boss a digest:
 *        • events happening TOMORROW  (the "before" reminder)
 *        • events that happened YESTERDAY (the "after" follow-up)
 *
 * You never need the boss's password. You only need their email address.
 * ---------------------------------------------------------------------------
 */

// ═══════════════════════════════════════════════════════════════════════════
//  ⚙️  CONFIG  — edit these 3 lines, save, done.
// ═══════════════════════════════════════════════════════════════════════════
var CONFIG = {

  // Where reminders + calendar invites go. Comma-separate for more than one.
  ADMIN_EMAIL: 'REPLACE_WITH_BOSS_EMAIL@gmail.com',

  // A dedicated calendar is created under YOUR account with this name.
  CALENDAR_NAME: 'Movie Schedule',

  // Your timezone (India = Asia/Kolkata).
  TIMEZONE: 'Asia/Kolkata',

  // If you type "Aug 4" instead of a full date, which year to assume.
  DEFAULT_YEAR: new Date().getFullYear(),

  // Hour of day (0–23) to send the daily reminder email.
  REMINDER_HOUR: 8,

  // Tabs to ignore (settings/notes tabs that aren't projects).
  SKIP_TABS: ['Config', 'Instructions', 'Template', 'README'],

  // ── Column layout (don't change unless your sheet differs) ──
  FREEFORM_COL: 1,   // A = your human "Date" text (July 20/21, TBD, ...)
  ASSET_COL:    2,   // B = Asset  (becomes the event title)
  DATE_COL:     3,   // C = Event Date  (REAL date the calendar uses)
  STATUS_COL:   4,   // D = Calendar Sync  (script-managed; holds a hidden id)
  HEADER_ROW:   1,
  FIRST_DATA_ROW: 3  // your data starts on row 3
};


// ═══════════════════════════════════════════════════════════════════════════
//  MENU  (appears as "🎬 Schedule Sync" in the sheet toolbar)
// ═══════════════════════════════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎬 Schedule Sync')
    .addItem('⚙️  First-time setup', 'firstTimeSetup')
    .addSeparator()
    .addItem('🔄  Sync all tabs now', 'syncAll')
    .addItem('✉️  Send reminder email now (test)', 'sendDailyReminders')
    .addItem('🔔  Reinstall automatic triggers', 'setupTriggers')
    .addToUi();
}

/** Run once from the menu after pasting the code. */
function firstTimeSetup() {
  prepareColumns_();
  setupTriggers();
  syncAll();
  SpreadsheetApp.getUi().alert(
    '✅ Setup complete!\n\n' +
    '• "Event Date" + "Calendar Sync" columns added to every project tab\n' +
    '• Automatic triggers installed (live sync + daily 8am reminder)\n' +
    '• Existing rows with a date have been synced to your "' +
    CONFIG.CALENDAR_NAME + '" calendar\n\n' +
    'From now on: just type a real date in the "Event Date" column and it ' +
    'syncs automatically.');
}


// ═══════════════════════════════════════════════════════════════════════════
//  TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════
function setupTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Clear any triggers we previously made (avoid duplicates).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onSheetEdit' || fn === 'sendDailyReminders') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Live sync whenever someone edits a cell.
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();

  // Daily reminder digest.
  ScriptApp.newTrigger('sendDailyReminders')
    .timeBased().everyDays(1).atHour(CONFIG.REMINDER_HOUR).create();
}

/** Installable edit trigger — syncs only the tab that was edited. */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  var col = e.range.getColumn();
  // Only react to edits in the columns that matter; ignore our own status writes.
  if (col !== CONFIG.FREEFORM_COL && col !== CONFIG.ASSET_COL && col !== CONFIG.DATE_COL) {
    return;
  }
  syncSheet_(e.range.getSheet());
}


// ═══════════════════════════════════════════════════════════════════════════
//  SYNC  (sheet → calendar)
// ═══════════════════════════════════════════════════════════════════════════
function syncAll() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (isProjectTab_(sheets[i])) syncSheet_(sheets[i]);
  }
}

function syncSheet_(sheet) {
  if (!isProjectTab_(sheet)) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.FIRST_DATA_ROW) return;

  ensureHeaders_(sheet);

  var project = sheet.getName();
  var cal = getCalendar_();
  var n = lastRow - CONFIG.FIRST_DATA_ROW + 1;
  var start = CONFIG.FIRST_DATA_ROW;

  var assets = sheet.getRange(start, CONFIG.ASSET_COL, n, 1).getValues();
  var dates  = sheet.getRange(start, CONFIG.DATE_COL,  n, 1).getValues();
  var frees  = sheet.getRange(start, CONFIG.FREEFORM_COL, n, 1).getValues();

  var statusRange = sheet.getRange(start, CONFIG.STATUS_COL, n, 1);
  var statusVals  = statusRange.getValues();
  var statusNotes = statusRange.getNotes();   // hidden calendar event id lives here

  for (var i = 0; i < n; i++) {
    var asset = String(assets[i][0]).trim();
    var when  = parseDate_(dates[i][0]);
    var eventId = statusNotes[i][0];

    // No usable date or no asset → remove any event we made, leave a note.
    if (!asset || !when) {
      if (eventId) { deleteEvent_(cal, eventId); }
      statusNotes[i][0] = '';
      statusVals[i][0]  = asset && !when ? '⏳ needs a date' : '';
      continue;
    }

    var title = '[' + project + '] ' + asset;
    var desc  = buildDescription_(project, frees[i][0]);
    var ev = eventId ? getEventById_(cal, eventId) : null;

    if (ev) {
      updateEvent_(ev, title, when, desc);
    } else {
      ev = createEvent_(cal, title, when, desc);
      statusNotes[i][0] = ev.getId();
    }
    statusVals[i][0] = '✅ ' + fmtDate_(when);
  }

  statusRange.setValues(statusVals);
  statusRange.setNotes(statusNotes);
}


// ═══════════════════════════════════════════════════════════════════════════
//  REMINDERS  (calendar/sheet → email digest to boss)
// ═══════════════════════════════════════════════════════════════════════════
function sendDailyReminders() {
  var today     = new Date();
  var tomorrow  = addDays_(today, 1);
  var yesterday = addDays_(today, -1);

  var before = collectEventsOn_(tomorrow);   // "before the day" reminder
  var after  = collectEventsOn_(yesterday);  // "after" follow-up

  if (!before.length && !after.length) return;   // nothing to say today

  var html = buildDigestHtml_(before, after, tomorrow, yesterday);

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: '🎬 Schedule reminders — ' + fmtDate_(today),
    htmlBody: html
  });
}

/** Scan every project tab for rows whose Event Date == the given day. */
function collectEventsOn_(day) {
  var out = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (!isProjectTab_(sheet)) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.FIRST_DATA_ROW) continue;

    var n = lastRow - CONFIG.FIRST_DATA_ROW + 1, start = CONFIG.FIRST_DATA_ROW;
    var assets = sheet.getRange(start, CONFIG.ASSET_COL, n, 1).getValues();
    var dates  = sheet.getRange(start, CONFIG.DATE_COL,  n, 1).getValues();

    for (var i = 0; i < n; i++) {
      var asset = String(assets[i][0]).trim();
      var when  = parseDate_(dates[i][0]);
      if (asset && when && sameDay_(when, day)) {
        out.push({ project: sheet.getName(), asset: asset });
      }
    }
  }
  return out;
}

function buildDigestHtml_(before, after, tomorrow, yesterday) {
  function section(title, subtitle, items, empty) {
    var rows = items.length
      ? items.map(function (e) {
          return '<tr>' +
            '<td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;color:#1a73e8;">' +
              e.project + '</td>' +
            '<td style="padding:6px 12px;border-bottom:1px solid #eee;">' + e.asset + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="2" style="padding:6px 12px;color:#888;">' + empty + '</td></tr>';
    return '<h3 style="margin:20px 0 4px;">' + title + '</h3>' +
           '<div style="color:#666;font-size:13px;margin-bottom:6px;">' + subtitle + '</div>' +
           '<table style="border-collapse:collapse;width:100%;font-size:14px;">' + rows + '</table>';
  }

  return '' +
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">' +
      '<h2 style="color:#111;">🎬 Schedule Reminders</h2>' +
      section('🔔 Happening tomorrow', fmtLong_(tomorrow), before, 'Nothing scheduled for tomorrow.') +
      section('✅ Follow-up (yesterday)', fmtLong_(yesterday), after, 'Nothing to follow up on.') +
      '<p style="color:#999;font-size:12px;margin-top:24px;">' +
        'Automated by your Movie Schedule CRM. Reply-to edits go in the Work flow sheet.</p>' +
    '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════
//  CALENDAR HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function getCalendar_() {
  var cals = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (cals.length) return cals[0];
  return CalendarApp.createCalendar(CONFIG.CALENDAR_NAME, {
    summary: 'Movie release & event schedule (auto-synced from Work flow sheet)',
    color: CalendarApp.Color.RED
  });
}

function createEvent_(cal, title, day, desc) {
  return cal.createAllDayEvent(title, day, {
    description: desc,
    guests: CONFIG.ADMIN_EMAIL,
    sendInvites: true
  });
}

function updateEvent_(ev, title, day, desc) {
  if (ev.getTitle() !== title) ev.setTitle(title);
  if (ev.getDescription() !== desc) ev.setDescription(desc);
  var cur = ev.getAllDayStartDate();
  if (!cur || !sameDay_(cur, day)) ev.setAllDayDate(day);

  // Make sure the boss is still a guest.
  var admins = CONFIG.ADMIN_EMAIL.split(',').map(function (x) { return x.trim().toLowerCase(); });
  var have = ev.getGuestList().map(function (g) { return g.getEmail().toLowerCase(); });
  admins.forEach(function (a) { if (a && have.indexOf(a) === -1) ev.addGuest(a); });
}

function getEventById_(cal, id) {
  try { return cal.getEventById(id); } catch (err) { return null; }
}

function deleteEvent_(cal, id) {
  var ev = getEventById_(cal, id);
  if (ev) { try { ev.deleteEvent(); } catch (err) {} }
}


// ═══════════════════════════════════════════════════════════════════════════
//  SETUP / COLUMN HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function prepareColumns_() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (isProjectTab_(sheets[i])) ensureHeaders_(sheets[i]);
  }
}

function ensureHeaders_(sheet) {
  var dateCell = sheet.getRange(CONFIG.HEADER_ROW, CONFIG.DATE_COL);
  var statCell = sheet.getRange(CONFIG.HEADER_ROW, CONFIG.STATUS_COL);
  if (dateCell.getValue() !== 'Event Date') {
    dateCell.setValue('Event Date').setFontWeight('bold');
    sheet.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.DATE_COL,
      Math.max(1, sheet.getMaxRows() - CONFIG.FIRST_DATA_ROW + 1), 1)
      .setNumberFormat('ddd, mmm d yyyy');
  }
  if (statCell.getValue() !== 'Calendar Sync') {
    statCell.setValue('Calendar Sync').setFontWeight('bold');
  }
}

function isProjectTab_(sheet) {
  return CONFIG.SKIP_TABS.indexOf(sheet.getName()) === -1;
}

function buildDescription_(project, freeform) {
  var lines = ['Project: ' + project];
  var f = String(freeform || '').trim();
  if (f) lines.push('Planned: ' + f);
  lines.push('', '↳ Synced from the Work flow sheet.');
  return lines.join('\n');
}


// ═══════════════════════════════════════════════════════════════════════════
//  DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Turn a cell value into a real Date, or null if unusable.
 * Accepts real date cells AND typed text like "Aug 4", "Sep 4 or 5",
 * "From Sep 29 to Oct 3" (takes the first date). Returns null for "TBD"/blank.
 */
function parseDate_(val) {
  if (val instanceof Date && !isNaN(val.getTime())) return stripTime_(val);

  var s = String(val || '').trim();
  if (!s || /tbd/i.test(s)) return null;

  // Grab the first "<Month> <day>" found (handles ranges / "or").
  var m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (m) {
    var d = new Date(m[1] + ' ' + m[2] + ' ' + CONFIG.DEFAULT_YEAR);
    if (!isNaN(d.getTime())) return stripTime_(d);
  }

  // Fallback: let JS try (e.g. "2026-08-04", "8/4/2026").
  var d2 = new Date(s);
  if (!isNaN(d2.getTime())) return stripTime_(d2);

  return null;
}

function stripTime_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function sameDay_(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
function fmtDate_(d) { return Utilities.formatDate(d, CONFIG.TIMEZONE, 'MMM d, yyyy'); }
function fmtLong_(d) { return Utilities.formatDate(d, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy'); }

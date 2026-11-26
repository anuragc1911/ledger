/**
 * Ledger — a personal finance tracker that keeps all of its data in this Google Sheet.
 *
 *   Transactions  every income / expense (add rows by hand here too: Date, Type, Category, Amount)
 *   Budgets       monthly budget per category
 *   Rules         "if the email text contains X, use category Y" for imported transactions
 *   Settings      currency, email import on/off, the Gmail search used to find bank alerts
 *
 * Setup is in README.md: paste this file and Index.html into Extensions > Apps Script,
 * run setup() once, then Deploy > New deployment > Web app.
 */

const SHEETS = {
  tx:       { name: 'Transactions', headers: ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Source', 'Ref', 'Created'] },
  budgets:  { name: 'Budgets',      headers: ['Category', 'Monthly budget'] },
  rules:    { name: 'Rules',        headers: ['If text contains', 'Category'] },
  settings: { name: 'Settings',     headers: ['Setting', 'Value'] },
};
const C = { id: 0, date: 1, type: 2, category: 3, description: 4, amount: 5, source: 6, ref: 7, created: 8 };

const EXPENSE_CATS = [['Housing', '🏠'], ['Groceries', '🛒'], ['Food & dining', '🍽️'], ['Transport', '🚌'], ['Utilities', '💡'], ['Shopping', '🛍️'], ['Health', '💊'], ['Entertainment', '🎬'], ['Travel', '✈️'], ['Education', '📚'], ['Subscriptions', '🔁'], ['Transfers', '🔀'], ['Other', '📦']];
const INCOME_CATS = [['Salary', '💼'], ['Freelance', '💻'], ['Investments', '📈'], ['Gifts', '🎁'], ['Refunds', '↩️'], ['Other income', '💰']];
const INCOME_NAMES = INCOME_CATS.map(c => c[0]);

const DEFAULT_QUERY = 'newer_than:7d -in:chats -category:promotions (debited OR credited OR spent OR "transaction alert" OR "you paid" OR "payment of" OR withdrawn OR "txn")';

const DEFAULT_RULES = [
  ['salary', 'Salary'], ['refund', 'Refunds'], ['reversal', 'Refunds'], ['interest', 'Investments'], ['dividend', 'Investments'],
  ['swiggy', 'Food & dining'], ['zomato', 'Food & dining'], ['restaurant', 'Food & dining'], ['cafe', 'Food & dining'], ['starbucks', 'Food & dining'], ['dominos', 'Food & dining'], ['mcdonald', 'Food & dining'],
  ['bigbasket', 'Groceries'], ['blinkit', 'Groceries'], ['zepto', 'Groceries'], ['dmart', 'Groceries'], ['instamart', 'Groceries'], ['grocery', 'Groceries'], ['supermarket', 'Groceries'], ['walmart', 'Groceries'], ['whole foods', 'Groceries'],
  ['uber', 'Transport'], ['ola', 'Transport'], ['rapido', 'Transport'], ['metro', 'Transport'], ['fuel', 'Transport'], ['petrol', 'Transport'], ['fastag', 'Transport'], ['irctc', 'Travel'],
  ['makemytrip', 'Travel'], ['goibibo', 'Travel'], ['indigo', 'Travel'], ['airbnb', 'Travel'], ['booking.com', 'Travel'], ['hotel', 'Travel'],
  ['amazon', 'Shopping'], ['flipkart', 'Shopping'], ['myntra', 'Shopping'], ['ajio', 'Shopping'], ['nykaa', 'Shopping'],
  ['netflix', 'Subscriptions'], ['spotify', 'Subscriptions'], ['prime', 'Subscriptions'], ['hotstar', 'Subscriptions'], ['youtube', 'Subscriptions'], ['apple.com', 'Subscriptions'], ['google play', 'Subscriptions'],
  ['electricity', 'Utilities'], ['airtel', 'Utilities'], ['jio', 'Utilities'], ['vodafone', 'Utilities'], ['broadband', 'Utilities'], ['gas', 'Utilities'], ['water', 'Utilities'],
  ['pharmacy', 'Health'], ['apollo', 'Health'], ['hospital', 'Health'], ['clinic', 'Health'], ['1mg', 'Health'], ['pharmeasy', 'Health'],
  ['bookmyshow', 'Entertainment'], ['pvr', 'Entertainment'], ['steam', 'Entertainment'],
  ['rent', 'Housing'], ['maintenance', 'Housing'],
  ['school', 'Education'], ['udemy', 'Education'], ['coursera', 'Education'],
  ['self transfer', 'Transfers'], ['own account', 'Transfers'], ['credit card payment', 'Transfers'],
];

/* ------------------------------------------------------------------ web app */

function doGet() {
  ensureSheets_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Ledger')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

/** Run once from the editor: creates the tabs and turns on email import. */
function setup() {
  ensureSheets_();
  setEmailImport(true);
  Logger.log('Ledger is set up. Now Deploy > New deployment > Web app.');
}

/* ------------------------------------------------------------------ reads */

function getData() {
  ensureSheets_();
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const sh = sheet_('tx');
  const txns = [];
  const last = sh.getLastRow();
  if (last > 1) {
    const rows = sh.getRange(2, 1, last - 1, SHEETS.tx.headers.length).getValues();
    let missingIds = false;
    rows.forEach(r => {
      const date = toISO_(r[C.date], tz);
      const amount = Math.abs(Number(String(r[C.amount]).replace(/[^\d.-]/g, '')));
      if (!date || !amount) return;
      if (!r[C.id]) { r[C.id] = Utilities.getUuid(); missingIds = true; } // rows typed straight into the sheet
      const type = String(r[C.type]).trim().toLowerCase() === 'income' ? 'income' : 'expense';
      txns.push({
        id: String(r[C.id]), date, type, amount: Math.round(amount * 100) / 100,
        category: String(r[C.category]).trim() || (type === 'income' ? 'Other income' : 'Other'),
        description: String(r[C.description]).trim(),
        source: String(r[C.source]).trim().toLowerCase() === 'email' ? 'email' : 'manual',
      });
    });
    if (missingIds) withLock_(() => sh.getRange(2, 1, rows.length, 1).setValues(rows.map(r => [r[C.id]])));
  }
  const s = readSettings_();
  return {
    txns,
    budgets: readBudgets_(),
    currency: s['Currency'] || guessCurrency_(),
    categories: { expense: EXPENSE_CATS, income: INCOME_CATS },
    email: {
      on: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'importEmails'),
      query: s['Email search'] || DEFAULT_QUERY,
      lastCheck: s['Last email check'] ? String(s['Last email check']) : '',
      lastResult: s['Last email result'] ? String(s['Last email result']) : '',
    },
    sheetUrl: ss.getUrl(),
  };
}

/* ------------------------------------------------------------------ writes */

function addTxn(t) {
  const tx = clean_(t);
  return withLock_(() => {
    sheet_('tx').appendRow([tx.id, tx.date, cap_(tx.type), safe_(tx.category), safe_(tx.description), tx.amount, 'Manual', '', new Date()]);
    return tx;
  });
}

function updateTxn(t) {
  const tx = clean_(t);
  return withLock_(() => {
    const sh = sheet_('tx');
    const row = findRow_(sh, tx.id);
    if (!row) throw new Error('That transaction is no longer in the sheet. Refresh and try again.');
    sh.getRange(row, C.date + 1, 1, 5).setValues([[tx.date, cap_(tx.type), safe_(tx.category), safe_(tx.description), tx.amount]]);
    return tx;
  });
}

function deleteTxn(id) {
  return withLock_(() => {
    const sh = sheet_('tx');
    const row = findRow_(sh, String(id));
    if (row) sh.deleteRow(row);
    return true;
  });
}

function restoreTxn(t) {
  // Undo of a delete: put it back with its original source.
  const tx = clean_(t);
  return withLock_(() => {
    sheet_('tx').appendRow([tx.id, tx.date, cap_(tx.type), safe_(tx.category), safe_(tx.description), tx.amount, t.source === 'email' ? 'Email' : 'Manual', '', new Date()]);
    return tx;
  });
}

function saveBudgets(map) {
  return withLock_(() => {
    const sh = sheet_('budgets');
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
    const rows = Object.keys(map || {})
      .map(k => [safe_(String(k).slice(0, 40)), Math.round(Number(map[k]) * 100) / 100])
      .filter(r => r[0] && r[1] > 0);
    if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
    return readBudgets_();
  });
}

function saveSettings(s) {
  return withLock_(() => {
    if (s.currency !== undefined) {
      if (!/^[A-Z]{3}$/.test(s.currency)) throw new Error('Unknown currency');
      writeSetting_('Currency', s.currency);
    }
    if (s.emailQuery !== undefined) writeSetting_('Email search', String(s.emailQuery).slice(0, 500) || DEFAULT_QUERY);
    return true;
  });
}

/* ------------------------------------------------------------------ email import */

/** Turns the 15-minute Gmail check on or off. */
function setEmailImport(on) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'importEmails').forEach(t => ScriptApp.deleteTrigger(t));
  if (on) ScriptApp.newTrigger('importEmails').timeBased().everyMinutes(15).create();
  return !!on;
}

/** Called by the app's "Check now" button. */
function checkEmailNow() {
  const added = importEmails();
  return { added, data: getData() };
}

/** Looks for bank / card / UPI alert emails and adds new ones to Transactions. Returns how many were added. */
function importEmails() {
  ensureSheets_();
  const s = readSettings_();
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const query = String(s['Email search'] || DEFAULT_QUERY);
  const rules = readRules_();
  const sh = sheet_('tx');
  const seen = new Set();
  if (sh.getLastRow() > 1) sh.getRange(2, C.ref + 1, sh.getLastRow() - 1, 1).getValues().forEach(r => r[0] && seen.add(String(r[0])));

  const rows = [];
  let looked = 0;
  GmailApp.search(query, 0, 60).forEach(thread => thread.getMessages().forEach(m => {
    const ref = 'gmail:' + m.getId();
    if (seen.has(ref)) return;
    seen.add(ref);
    looked++;
    const tx = parseAlert(m.getSubject(), messageText_(m), rules);
    if (!tx) return;
    rows.push([Utilities.getUuid(), Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd'), cap_(tx.type), tx.category,
      safe_(tx.description), tx.amount, 'Email', ref, new Date()]);
  }));

  withLock_(() => {
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    writeSetting_('Last email check', Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
    writeSetting_('Last email result', rows.length + ' added from ' + looked + ' new emails');
  });
  return rows.length;
}

/**
 * Reads one alert email. Returns {type, amount, description, category} or null when it is not a
 * completed transaction (OTPs, statements, reminders, promos, no amount).
 * Kept free of Apps Script services so it can be tested anywhere.
 */
function parseAlert(subject, body, rules) {
  const text = (String(subject || '') + '\n' + String(body || '')).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').slice(0, 4000);
  // Only the top of the email: bank alerts often carry promo footers.
  if (/\b(otp|one[- ]time password|verification code|statement (is|for)|amount due|minimum (amount )?due|due date|will be (debited|charged)|is due|mandate|e-?nach registration|request(ed)? money|collect request)\b/i.test(text.slice(0, 700))) return null;

  const debitRe = /\b(debited|spent|paid|withdrawn|purchase[d]?|charged|used for|sent|deducted|txn of|transaction of|payment of|you made a|made a purchase)\b/i;
  const creditRe = /\b(credited|deposited|refunded|received)\b/i;
  const d = text.search(debitRe), c = text.search(creditRe);
  if (d < 0 && c < 0) return null;
  const type = c >= 0 && (d < 0 || c < d) ? 'income' : 'expense';

  // First money amount that isn't a balance / limit.
  const amtRe = /(?:rs\.?|inr|₹|usd|us\$|\$|eur|€|gbp|£|aed|sgd)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  let amount = 0, at = -1, m;
  while ((m = amtRe.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (/(bal(ance)?|limit|available|avl|outstanding|due)[^0-9]*$/i.test(before)) continue;
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (v > 0) { amount = Math.round(v * 100) / 100; at = m.index; break; }
  }
  if (!amount) return null;

  const tail = text.slice(at);
  let who = '';
  const pats = [
    /\b(?:vpa|upi id)\s+([\w.\-]+@[\w.\-]+)/i,
    /\binfo[:\s-]+([^\n.]{2,40})/i,
    /\b(?:at|to|towards|from|by|with)\s+(?!(?:your|you|a\/c|ac|account|card|the|rs|inr|\d{1,2}:\d{2})\b)([A-Za-z][A-Za-z0-9&@.\-*'_/ ]{1,40}?)(?=\s+(?:on|via|using|from|for|ref|upi|avl|thru|through|with|is|has|dated)\b|\s*[.,;:()\n]|\s*$)/i,
  ];
  for (const p of pats) { const r = tail.match(p) || text.match(p); if (r) { who = r[1]; break; } }
  who = who.replace(/\s+/g, ' ').replace(/[*_]+/g, ' ').trim();
  const description = (who || String(subject || '').trim() || 'Bank alert').slice(0, 60);

  const hay = (who + ' ' + text).toLowerCase();
  let category = type === 'income' ? 'Other income' : 'Other';
  for (const [kw, cat] of rules || []) {
    if (!kw || !cat) continue;
    const isIncomeCat = INCOME_NAMES.indexOf(cat) >= 0;
    if (isIncomeCat !== (type === 'income')) continue;
    const k = String(kw).toLowerCase().trim();
    const re = new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
    if (re.test(hay)) { category = cat; break; }
  }
  return { type, amount, description, category };
}

function messageText_(m) {
  let t = m.getPlainBody();
  if (!t || t.trim().length < 20) t = String(m.getBody()).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8377;/g, '₹');
  return t;
}

/* ------------------------------------------------------------------ helpers */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(key => {
    const def = SHEETS[key];
    if (ss.getSheetByName(def.name)) return;
    let sh;
    const first = ss.getSheets()[0];
    if (key === 'tx' && ss.getSheets().length === 1 && first.getLastRow() === 0) { sh = first.setName(def.name); }
    else sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#f1f0ec');
    sh.setFrozenRows(1);
    if (key === 'tx') {
      sh.getRange('B2:B').setNumberFormat('yyyy-mm-dd');
      sh.getRange('F2:F').setNumberFormat('#,##0.00');
      sh.getRange('I2:I').setNumberFormat('yyyy-mm-dd hh:mm');
      sh.setColumnWidth(1, 90); sh.setColumnWidth(5, 260); sh.setColumnWidth(8, 160);
      sh.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Expense', 'Income'], true).setAllowInvalid(false).build());
    }
    if (key === 'rules') sh.getRange(2, 1, DEFAULT_RULES.length, 2).setValues(DEFAULT_RULES);
    if (key === 'settings') sh.getRange(2, 1, 2, 2).setValues([['Currency', guessCurrency_()], ['Email search', DEFAULT_QUERY]]);
    if (key === 'budgets') sh.getRange('B2:B').setNumberFormat('#,##0.00');
  });
}

function sheet_(key) { return SpreadsheetApp.getActive().getSheetByName(SHEETS[key].name); }

function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function readSettings_() {
  const sh = sheet_('settings');
  const out = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}

function writeSetting_(key, value) {
  const sh = sheet_('settings');
  const n = sh.getLastRow() - 1;
  const keys = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0]).trim()) : [];
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(value);
  else sh.appendRow([key, value]);
}

function readBudgets_() {
  const sh = sheet_('budgets');
  const out = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { const v = Number(r[1]); if (r[0] && v > 0) out[String(r[0]).trim()] = v; });
  return out;
}

function readRules_() {
  const sh = sheet_('rules');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().filter(r => r[0] && r[1]).map(r => [String(r[0]), String(r[1]).trim()]);
}

function clean_(t) {
  if (!t || typeof t !== 'object') throw new Error('Missing transaction');
  const date = String(t.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date');
  const amount = Math.round(Number(t.amount) * 100) / 100;
  if (!(amount > 0) || !isFinite(amount)) throw new Error('Invalid amount');
  const type = t.type === 'income' ? 'income' : 'expense';
  return {
    id: /^[\w-]{6,64}$/.test(String(t.id || '')) ? String(t.id) : Utilities.getUuid(),
    date, type, amount,
    category: String(t.category || (type === 'income' ? 'Other income' : 'Other')).slice(0, 40),
    description: String(t.description || '').slice(0, 200),
  };
}

function toISO_(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = s ? new Date(s) : null;
  return d && !isNaN(d) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
}

/** Stops text that starts with = + - @ from being read as a formula. */
function safe_(s) { s = String(s || ''); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function cap_(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function guessCurrency_() {
  const region = (SpreadsheetApp.getActive().getSpreadsheetLocale() || '').split('_')[1] || '';
  const map = { IN: 'INR', US: 'USD', GB: 'GBP', JP: 'JPY', AU: 'AUD', CA: 'CAD', SG: 'SGD', AE: 'AED', CH: 'CHF', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR' };
  return map[region] || 'USD';
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

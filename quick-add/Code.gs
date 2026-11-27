/**
 * Ledger Quick Add: an add-only endpoint for the iPhone shortcut (Back Tap).
 * It can only append one transaction to the Ledger Sheet, and only with the secret key in Secret.gs.
 * It cannot read your data except the list of category names.
 *
 *   GET  ?key=K&list=expense        -> category names, one per line (for the shortcut's menu)
 *   POST {key, amount, category, note?, type?: "expense"|"income", account?}  -> "Added ₹450 · Food & dining"
 *
 * Deploy as a web app: Execute as Me, Who has access: Anyone. Open its URL once in a browser to authorise.
 */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.key) return text_('Ledger quick add is ready. It is used by the iPhone shortcut.');
  if (p.key !== QUICK_ADD.key) return text_('Wrong key');
  if (p.list) return text_(categories_(p.list === 'income' ? 'Income' : 'Expense').join('\n'));
  return add_(p);
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { p = (e && e.parameter) || {}; }
  if (p.key !== QUICK_ADD.key) return text_('Wrong key');
  return add_(p);
}

function add_(p) {
  const amount = Math.round(Number(String(p.amount || '').replace(/[^\d.]/g, '')) * 100) / 100;
  if (!(amount > 0)) return text_('Enter an amount');
  const type = /^inc/i.test(String(p.type || '')) ? 'Income' : 'Expense';
  const category = String(p.category || (type === 'Income' ? 'Other income' : 'Other')).trim().slice(0, 40);
  const note = String(p.note || '').trim().slice(0, 200);
  const ss = SpreadsheetApp.openById(QUICK_ADD.sheetId);
  const tz = ss.getSpreadsheetTimeZone();
  // the Sheet's own day number for today (a JavaScript Date would be shifted by time-zone conversion)
  const [y, m, d] = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  const today = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ss.getSheetByName('Transactions').appendRow([Utilities.getUuid(), today, type, safe_(category), safe_(note), amount, 'Manual', 'shortcut', new Date(), safe_(String(p.account || ''))]);
  } finally { lock.releaseLock(); }
  return text_('Added ₹' + amount.toLocaleString('en-IN') + ' · ' + category);
}

function categories_(type) {
  const sh = SpreadsheetApp.openById(QUICK_ADD.sheetId).getSheetByName('Categories');
  const rows = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 4).getValues();
  return rows.filter(r => String(r[0]).trim() && String(r[1]).trim() === type && String(r[3]).trim() !== 'Transfer').map(r => String(r[0]).trim());
}

function safe_(s) { s = String(s || ''); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function text_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }

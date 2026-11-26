/**
 * Ledger: a personal finance dashboard that keeps all of its data in this Google Sheet.
 * The web app only displays it and adds to it; every number can be read or edited here.
 *
 *   Transactions   every income / expense (Source: Manual, Email or Statement)
 *   Accounts       bank accounts and cards: balance, credit limit, purpose (e.g. Emergency fund)
 *   Investments    holdings: invested amount, current value, purpose
 *   Goals          savings goals with a target amount and date
 *   Debts          money you owe / are owed, with deadlines; Debt payments holds part-payments
 *   History        net worth at the end of each month (filled in automatically)
 *   Categories     every category with its Group (Need, Want, Savings, Debt, Transfer, Income)
 *   Budgets        monthly budget per category
 *   Rules          "if the text contains X, use category Y" for imported transactions
 *   Settings       your profile and targets, currency, email import
 *
 * Setup is in README.md.
 */

const SHEETS = {
  tx:       { name: 'Transactions',  headers: ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Source', 'Ref', 'Created', 'Account'] },
  accounts: { name: 'Accounts',      headers: ['Name', 'Type', 'Last 4 digits', 'Balance', 'Credit limit', 'Purpose', 'Updated'] },
  holdings: { name: 'Investments',   headers: ['ID', 'Name', 'Type', 'Invested', 'Current value', 'Purpose', 'Updated', 'Note'] },
  goals:    { name: 'Goals',         headers: ['ID', 'Name', 'Target amount', 'Target date', 'Saved so far', 'Note'] },
  debts:    { name: 'Debts',         headers: ['ID', 'Source', 'Direction', 'Amount', 'Due date', 'Note', 'Created'] },
  payments: { name: 'Debt payments', headers: ['ID', 'Debt ID', 'Date', 'Amount', 'Note'] },
  history:  { name: 'History',       headers: ['Month', 'Cash', 'Investments', 'Card dues', 'Debts I owe', 'Owed to me', 'Net worth'] },
  cats:     { name: 'Categories',    headers: ['Name', 'Type', 'Emoji', 'Group'] },
  budgets:  { name: 'Budgets',       headers: ['Category', 'Monthly budget'] },
  rules:    { name: 'Rules',         headers: ['If text contains', 'Category'] },
  settings: { name: 'Settings',      headers: ['Setting', 'Value'] },
};
const C = { id: 0, date: 1, type: 2, category: 3, description: 4, amount: 5, source: 6, ref: 7, created: 8, account: 9 };

// [name, emoji, group]. Groups: Need, Want, Savings, Debt, Transfer (expense); Income, Transfer (income).
const EXPENSE_CATS = [['Housing', '🏠', 'Need'], ['Groceries', '🛒', 'Need'], ['Food & dining', '🍽️', 'Want'], ['Transport', '🚌', 'Need'],
  ['Utilities', '💡', 'Need'], ['Health', '💊', 'Need'], ['Insurance', '🛡️', 'Need'], ['Education', '📚', 'Need'], ['Loan EMI', '🏦', 'Debt'],
  ['Shopping', '🛍️', 'Want'], ['Entertainment', '🎬', 'Want'], ['Travel', '✈️', 'Want'], ['Subscriptions', '🔁', 'Want'],
  ['Investing', '📈', 'Savings'], ['Transfers', '🔀', 'Transfer'], ['Other', '📦', 'Want']];
const INCOME_CATS = [['Salary', '💼', 'Income'], ['Freelance', '💻', 'Income'], ['Investments', '📈', 'Income'], ['Gifts', '🎁', 'Income'],
  ['Refunds', '↩️', 'Income'], ['Transfer in', '🔀', 'Transfer'], ['Other income', '💰', 'Income']];
const INCOME_NAMES = INCOME_CATS.map(c => c[0]);
const GROUPS = { expense: ['Need', 'Want', 'Savings', 'Debt', 'Transfer'], income: ['Income', 'Transfer'] };

const ACCOUNT_TYPES = ['Bank account', 'Debit card', 'Credit card', 'UPI / wallet', 'Cash'];
const HOLDING_TYPES = ['Equity mutual fund', 'Debt mutual fund', 'Stocks', 'EPF', 'PPF', 'NPS', 'FD / RD', 'Bonds', 'Gold', 'Crypto', 'Real estate', 'Other'];

// Profile and targets: rows in the Settings tab. Benchmarks come from Indian bank / fintech guidance (see README).
const PROFILE = [
  ['Age', '', 'age'],
  ['Monthly take-home (leave empty to use your Salary average)', '', 'income'],
  ['Dependents (Yes/No)', 'No', 'dependents'],
  ['Savings rate target %', 20, 'savingsTarget'],
  ['Emergency fund target (months of spending)', 6, 'efMonths'],
  ['FI multiple (x annual spending)', 33, 'fiMultiple'],
  ['Expected return % a year', 10, 'returnPct'],
  ['Inflation % a year', 6, 'inflationPct'],
  ['Term life cover', '', 'termCover'],
  ['Health cover', '', 'healthCover'],
];

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
  ['emi', 'Loan EMI'], ['loan', 'Loan EMI'], ['insurance', 'Insurance'], ['premium', 'Insurance'],
  ['sip', 'Investing'], ['mutual fund', 'Investing'], ['zerodha', 'Investing'], ['groww', 'Investing'], ['nps', 'Investing'], ['ppf', 'Investing'],
  ['self transfer', 'Transfers'], ['own account', 'Transfers'], ['credit card payment', 'Transfers'], ['cc billpay', 'Transfers'],
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
      const amount = num_(r[C.amount]);
      if (!date || !amount) return;
      if (!r[C.id]) { r[C.id] = Utilities.getUuid(); missingIds = true; } // rows typed straight into the sheet
      const type = String(r[C.type]).trim().toLowerCase() === 'income' ? 'income' : 'expense';
      const src = String(r[C.source]).trim().toLowerCase();
      txns.push({
        id: String(r[C.id]), date, type, amount: Math.round(amount * 100) / 100,
        category: String(r[C.category]).trim() || (type === 'income' ? 'Other income' : 'Other'),
        description: String(r[C.description]).trim(),
        source: src === 'email' || src === 'statement' ? src : 'manual',
        linked: src !== 'email' && /^gmail:/.test(String(r[C.ref])),
        account: String(r[C.account] || '').trim(),
      });
    });
    if (missingIds) withLock_(() => sh.getRange(2, 1, rows.length, 1).setValues(rows.map(r => [r[C.id]])));
  }
  const s = readSettings_();
  const cats = categories_();
  const accounts = readAccounts_(tz);
  const holdings = readHoldings_(tz);
  const debts = readDebts_(tz);
  return {
    txns, debts, accounts, holdings,
    goals: readGoals_(tz),
    history: snapshot_(accounts, holdings, debts, tz),
    profile: readProfile_(s),
    budgets: readBudgets_(),
    currency: s['Currency'] || guessCurrency_(),
    categories: { expense: cats.expense, income: cats.income },
    email: {
      on: ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'importEmails'),
      query: s['Email search'] || DEFAULT_QUERY,
      lastCheck: s['Last email check'] ? String(s['Last email check']) : '',
      lastResult: s['Last email result'] ? String(s['Last email result']) : '',
    },
    sheetUrl: ss.getUrl(),
  };
}

/* ------------------------------------------------------------------ transactions */

function addTxn(t) {
  const tx = clean_(t);
  return withLock_(() => {
    sheet_('tx').appendRow([tx.id, tx.date, cap_(tx.type), safe_(tx.category), safe_(tx.description), tx.amount, 'Manual', '', new Date(), safe_(tx.account)]);
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
    sh.getRange(row, C.account + 1).setValue(safe_(tx.account));
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
  const src = t.source === 'email' ? 'Email' : t.source === 'statement' ? 'Statement' : 'Manual';
  return withLock_(() => {
    sheet_('tx').appendRow([tx.id, tx.date, cap_(tx.type), safe_(tx.category), safe_(tx.description), tx.amount, src, String(t.ref || ''), new Date(), safe_(tx.account)]);
    return tx;
  });
}

/**
 * Two rows that are the same payment (e.g. typed in by hand and also imported from email).
 * Keeps `keep` (normally the imported one), copies over the category / note / account you chose,
 * and deletes `drop`.
 */
function mergeTxns(m) {
  if (!m || !m.keep || !m.drop || m.keep === m.drop) throw new Error('Pick two different transactions');
  return withLock_(() => {
    const sh = sheet_('tx');
    const keepRow = findRow_(sh, String(m.keep)), dropRow = findRow_(sh, String(m.drop));
    if (!keepRow || !dropRow) throw new Error('One of those transactions is no longer in the sheet. Refresh and try again.');
    if (m.category) sh.getRange(keepRow, C.category + 1).setValue(safe_(String(m.category).slice(0, 40)));
    if (m.description) sh.getRange(keepRow, C.description + 1).setValue(safe_(String(m.description).slice(0, 200)));
    if (m.account) sh.getRange(keepRow, C.account + 1).setValue(safe_(String(m.account).slice(0, 40)));
    sh.deleteRow(dropRow);
    return true;
  });
}

/**
 * Files every transaction with this exact description under `category`, and (rule: true) adds a Rule
 * so future imports with that text get the same category. Returns how many rows changed.
 */
function recategorize(r) {
  const desc = String((r && r.description) || '').trim().toLowerCase();
  const category = String((r && r.category) || '').trim().slice(0, 40);
  if (!desc || !category) throw new Error('Missing description or category');
  const type = r.type === 'income' ? 'Income' : 'Expense';
  return withLock_(() => {
    const sh = sheet_('tx');
    let changed = 0;
    if (sh.getLastRow() > 1) {
      const range = sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS.tx.headers.length);
      const rows = range.getValues();
      const cats = rows.map(row => {
        if (String(row[C.type]).trim() === type && String(row[C.description]).trim().toLowerCase() === desc && String(row[C.category]).trim() !== category) {
          changed++;
          return [safe_(category)];
        }
        return [row[C.category]];
      });
      if (changed) sh.getRange(2, C.category + 1, rows.length, 1).setValues(cats);
    }
    if (r.rule && desc.length >= 3) {
      const rs = sheet_('rules');
      const have = readRules_().some(x => x[0].toLowerCase().trim() === desc);
      if (!have) { rs.insertRowBefore(2); rs.getRange(2, 1, 1, 2).setValues([[safe_(desc), safe_(category)]]); }
    }
    return changed;
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

/** Saves the profile / targets block (keys as in PROFILE[i][2]). Empty clears a value. */
function saveProfile(p) {
  p = p || {};
  return withLock_(() => {
    PROFILE.forEach(([label, , key]) => {
      if (p[key] === undefined) return;
      let v = p[key];
      if (key === 'dependents') v = /^y/i.test(String(v)) ? 'Yes' : 'No';
      else if (v === '' || v === null) v = '';
      else { v = Number(v); if (!isFinite(v) || v < 0) throw new Error('Invalid number for ' + label); }
      writeSetting_(label, v);
    });
    return readProfile_(readSettings_());
  });
}

function readProfile_(s) {
  const out = {};
  PROFILE.forEach(([label, def, key]) => {
    const raw = s[label] === undefined ? def : s[label];
    if (key === 'dependents') out[key] = /^y/i.test(String(raw)) ? 'Yes' : 'No';
    else out[key] = raw === '' || raw === null ? null : (isFinite(Number(raw)) ? Number(raw) : null);
  });
  return out;
}

/* ------------------------------------------------------------------ email import */

/** Turns the 15-minute Gmail check on or off. */
function setEmailImport(on) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'importEmails').forEach(t => ScriptApp.deleteTrigger(t));
  if (on) ScriptApp.newTrigger('importEmails').timeBased().everyMinutes(15).create();
  return !!on;
}

/** Called by the app's "Check now" / "Import older emails" buttons. days = how far back (optional). */
function checkEmailNow(days) {
  const added = importEmails(Number(days) || 0);
  return { added, data: getData() };
}

/**
 * Looks for bank / card / UPI alert emails and adds new ones to Transactions. Returns how many were added.
 * days: look back this many days instead of the saved search's own window (used for importing history).
 *
 * No double counting: if a row you typed in by hand, or a bank-statement row, has the same type and
 * amount within 2 days, the email is treated as that same payment. A hand-typed row gets the email
 * linked to it (its Ref), keeps your category, and gets the card filled in if it was empty.
 */
function importEmails(days) {
  days = typeof days === 'number' && days > 0 ? Math.min(days, 730) : 0; // the 15-min trigger passes an event object
  ensureSheets_();
  const s = readSettings_();
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  let query = String(s['Email search'] || DEFAULT_QUERY);
  if (days) query = query.replace(/\bnewer_than:\S+/gi, '').trim() + ' newer_than:' + days + 'd';
  const accounts = readAccounts_(tz);
  const rules = readRules_();
  const incomeNames = categories_().income.map(c => c[0]);
  const sh = sheet_('tx');
  const seen = new Set();
  const open = {}; // type|amount -> [{t, row, manual, hasAccount}] rows an email may belong to
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS.tx.headers.length).getValues().forEach((r, i) => {
    const ref = String(r[C.ref] || '');
    if (ref) seen.add(ref);
    const src = String(r[C.source]).trim().toLowerCase();
    if (src === 'email' || /^gmail:/.test(ref)) return; // already an email, or already linked to one
    const date = toISO_(r[C.date], tz), amount = num_(r[C.amount]);
    if (!date || !amount) return;
    const key = (String(r[C.type]).trim().toLowerCase() === 'income' ? 'income' : 'expense') + '|' + amount.toFixed(2);
    (open[key] = open[key] || []).push({ t: Date.parse(date), row: i + 2, manual: src !== 'statement', hasAccount: !!String(r[C.account] || '').trim() });
  });
  const matchExisting = (type, amount, day) => {
    const list = open[type + '|' + amount.toFixed(2)];
    if (!list) return null;
    const t = Date.parse(day);
    let best = -1;
    list.forEach((c, i) => { const d = Math.abs(c.t - t); if (d <= 2 * 86400000 && (best < 0 || d < Math.abs(list[best].t - t))) best = i; });
    return best < 0 ? null : list.splice(best, 1)[0];
  };

  const rows = [], links = [];
  let looked = 0;
  const started = Date.now(), max = days ? 600 : 60, page = days ? 100 : 60;
  outer:
  for (let start = 0; start < max; start += page) {
    const threads = GmailApp.search(query, start, page);
    for (const thread of threads) {
      if (Date.now() - started > 270000) break outer; // stay well inside Apps Script's 6-minute limit
      for (const m of thread.getMessages()) {
        const ref = 'gmail:' + m.getId();
        if (seen.has(ref)) continue;
        seen.add(ref);
        looked++;
        const tx = parseAlert(m.getSubject(), messageText_(m), rules, incomeNames);
        if (!tx) continue;
        const day = Utilities.formatDate(m.getDate(), tz, 'yyyy-MM-dd');
        const acct = tx.last4 ? accounts.find(a => a.last4 === tx.last4) : null;
        const hit = matchExisting(tx.type, tx.amount, day);
        if (hit) { if (hit.manual) links.push({ row: hit.row, ref, account: !hit.hasAccount && acct ? acct.name : '' }); continue; }
        rows.push([Utilities.getUuid(), day, cap_(tx.type), tx.category,
          safe_(tx.description), tx.amount, 'Email', ref, new Date(), acct ? safe_(acct.name) : '']);
      }
    }
    if (threads.length < page) break;
  }

  withLock_(() => {
    links.forEach(l => {
      sh.getRange(l.row, C.ref + 1).setValue(l.ref);
      if (l.account) sh.getRange(l.row, C.account + 1).setValue(safe_(l.account));
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    writeSetting_('Last email check', Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'));
    writeSetting_('Last email result', rows.length + ' added, ' + links.length + ' matched to entries you made, from ' + looked + ' new emails');
  });
  return rows.length;
}

/**
 * Reads one alert email. Returns {type, amount, description, category} or null when it is not a
 * completed transaction (OTPs, statements, reminders, promos, no amount).
 * Kept free of Apps Script services so it can be tested anywhere.
 */
function parseAlert(subject, body, rules, incomeNames) {
  incomeNames = incomeNames || INCOME_NAMES;
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
    const isIncomeCat = incomeNames.indexOf(cat) >= 0;
    if (isIncomeCat !== (type === 'income')) continue;
    const k = String(kw).toLowerCase().trim();
    const re = new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
    if (re.test(hay)) { category = cat; break; }
  }
  const card = text.match(/(?:x{2,}|\*{2,}|ending(?:\s+(?:in|with))?|a\/c(?:\s*no\.?)?|account(?:\s*no\.?)?|card(?:\s*no\.?)?)\s*[x*]*\s*(\d{4})\b/i);
  return { type, amount, description, category, last4: card ? card[1] : '' };
}

function messageText_(m) {
  let t = m.getPlainBody();
  if (!t || t.trim().length < 20) t = String(m.getBody()).replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8377;/g, '₹');
  return t;
}

/* ------------------------------------------------------------------ debts */

function saveDebt(d) {
  if (!d || typeof d !== 'object') throw new Error('Missing debt');
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!(amount > 0) || !isFinite(amount)) throw new Error('Invalid amount');
  const source = String(d.source || '').trim().slice(0, 60);
  if (!source) throw new Error('Missing name');
  const due = String(d.due || '');
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Invalid deadline');
  const id = /^[\w-]{6,64}$/.test(String(d.id || '')) ? String(d.id) : Utilities.getUuid();
  const dir = d.direction === 'owed' ? 'Owed to me' : 'I owe';
  const note = String(d.note || '').slice(0, 200);
  return withLock_(() => {
    const sh = sheet_('debts');
    const row = findRow_(sh, id);
    const vals = [safe_(source), dir, amount, due, safe_(note)];
    if (row) sh.getRange(row, 2, 1, 5).setValues([vals]);
    else sh.appendRow([id].concat(vals, [new Date()]));
    return { id, source, direction: d.direction === 'owed' ? 'owed' : 'owe', amount, due, note };
  });
}

function deleteDebt(id) {
  id = String(id);
  return withLock_(() => {
    const sh = sheet_('debts');
    const row = findRow_(sh, id);
    if (row) sh.deleteRow(row);
    const ps = sheet_('payments');
    const n = ps.getLastRow() - 1;
    if (n > 0) {
      const ids = ps.getRange(2, 2, n, 1).getValues();
      for (let i = n - 1; i >= 0; i--) if (String(ids[i][0]) === id) ps.deleteRow(i + 2);
    }
    return true;
  });
}

function addPayment(p) {
  if (!p || typeof p !== 'object') throw new Error('Missing payment');
  const amount = Math.round(Number(p.amount) * 100) / 100;
  if (!(amount > 0) || !isFinite(amount)) throw new Error('Invalid amount');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) throw new Error('Invalid date');
  const id = /^[\w-]{6,64}$/.test(String(p.id || '')) ? String(p.id) : Utilities.getUuid();
  return withLock_(() => {
    if (!findRow_(sheet_('debts'), String(p.debtId))) throw new Error('That debt is no longer in the sheet. Refresh and try again.');
    sheet_('payments').appendRow([id, String(p.debtId), p.date, amount, safe_(String(p.note || '').slice(0, 200))]);
    return { id, debtId: String(p.debtId), date: p.date, amount };
  });
}

function deletePayment(id) {
  return withLock_(() => {
    const sh = sheet_('payments');
    const row = findRow_(sh, String(id));
    if (row) sh.deleteRow(row);
    return true;
  });
}

function readDebts_(tz) {
  const pays = {};
  const ps = sheet_('payments');
  if (ps.getLastRow() > 1) ps.getRange(2, 1, ps.getLastRow() - 1, 5).getValues().forEach(r => {
    const amount = Math.abs(Number(r[3]));
    if (!r[1] || !amount) return;
    const k = String(r[1]);
    (pays[k] = pays[k] || []).push({ id: String(r[0] || Utilities.getUuid()), date: toISO_(r[2], tz), amount, note: String(r[4] || '') });
  });
  const sh = sheet_('debts');
  const out = [];
  if (sh.getLastRow() < 2) return out;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  let missingIds = false;
  rows.forEach(r => {
    const amount = Math.abs(Number(String(r[3]).replace(/[^\d.-]/g, '')));
    if (!String(r[1]).trim() || !amount) return;
    if (!r[0]) { r[0] = Utilities.getUuid(); missingIds = true; } // rows typed straight into the sheet
    const id = String(r[0]);
    out.push({
      id, source: String(r[1]).trim(), amount,
      direction: /owed to me/i.test(String(r[2])) ? 'owed' : 'owe',
      due: toISO_(r[4], tz), note: String(r[5] || '').trim(),
      payments: pays[id] || [],
    });
  });
  if (missingIds) withLock_(() => sh.getRange(2, 1, rows.length, 1).setValues(rows.map(r => [r[0]])));
  return out;
}

/* ------------------------------------------------------------------ accounts & cards */

/** Rewrites the Accounts tab. Balance = money in it (for a credit card: what you currently owe on it). */
function saveAccounts(list) {
  return withLock_(() => {
    const sh = sheet_('accounts');
    const width = SHEETS.accounts.headers.length;
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
    const rows = (list || []).map(a => [
      safe_(String(a.name || '').trim().slice(0, 40)),
      ACCOUNT_TYPES.indexOf(a.type) >= 0 ? a.type : 'Bank account',
      String(a.last4 || '').replace(/\D/g, '').slice(-4),
      optNum_(a.balance), optNum_(a.limit),
      safe_(String(a.purpose || '').slice(0, 40)),
      a.updated && /^\d{4}-\d{2}-\d{2}$/.test(a.updated) ? a.updated : '',
    ]).filter(r => r[0]);
    if (rows.length) {
      sh.getRange(2, 3, rows.length, 1).setNumberFormat('@'); // keep leading zeros
      sh.getRange(2, 1, rows.length, width).setValues(rows);
    }
    return readAccounts_(SpreadsheetApp.getActive().getSpreadsheetTimeZone());
  });
}

function readAccounts_(tz) {
  const sh = sheet_('accounts');
  if (!sh || sh.getLastRow() < 2) return [];
  const n = sh.getLastRow() - 1, w = SHEETS.accounts.headers.length;
  const shown = sh.getRange(2, 1, n, w).getDisplayValues(), raw = sh.getRange(2, 1, n, w).getValues();
  return shown.map((r, i) => ({ r, v: raw[i] })).filter(x => String(x.r[0]).trim()).map(({ r, v }) => ({
    name: String(r[0]).trim(),
    type: ACCOUNT_TYPES.indexOf(String(r[1]).trim()) >= 0 ? String(r[1]).trim() : 'Bank account',
    last4: String(r[2]).replace(/\D/g, '').slice(-4),
    balance: v[3] === '' ? null : num_(v[3], true),
    limit: v[4] === '' ? null : num_(v[4]),
    purpose: String(r[5] || '').trim(),
    updated: toISO_(v[6], tz),
  }));
}

/* ------------------------------------------------------------------ investments */

function saveHolding(h) {
  if (!h || typeof h !== 'object') throw new Error('Missing investment');
  const name = String(h.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Give it a name');
  const value = optNum_(h.value);
  if (value === '') throw new Error('Enter its current value');
  const vals = [safe_(name), HOLDING_TYPES.indexOf(h.type) >= 0 ? h.type : 'Other', optNum_(h.invested), value,
    safe_(String(h.purpose || '').slice(0, 40)), /^\d{4}-\d{2}-\d{2}$/.test(String(h.updated)) ? h.updated : todayISO_(), safe_(String(h.note || '').slice(0, 200))];
  return upsert_('holdings', h.id, vals);
}
function deleteHolding(id) { return deleteById_('holdings', id); }

function readHoldings_(tz) {
  return readRows_('holdings', r => String(r[1]).trim() && r[4] !== '', r => ({
    id: String(r[0]), name: String(r[1]).trim(), type: HOLDING_TYPES.indexOf(String(r[2]).trim()) >= 0 ? String(r[2]).trim() : 'Other',
    invested: r[3] === '' ? null : num_(r[3]), value: num_(r[4]), purpose: String(r[5] || '').trim(), updated: toISO_(r[6], tz), note: String(r[7] || '').trim(),
  }));
}

/* ------------------------------------------------------------------ goals */

function saveGoal(g) {
  if (!g || typeof g !== 'object') throw new Error('Missing goal');
  const name = String(g.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Give the goal a name');
  const target = optNum_(g.target);
  if (!(target > 0)) throw new Error('Enter a target amount');
  const date = String(g.date || '');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid target date');
  return upsert_('goals', g.id, [safe_(name), target, date, optNum_(g.saved) || 0, safe_(String(g.note || '').slice(0, 200))]);
}
function deleteGoal(id) { return deleteById_('goals', id); }

function readGoals_(tz) {
  return readRows_('goals', r => String(r[1]).trim() && num_(r[2]) > 0, r => ({
    id: String(r[0]), name: String(r[1]).trim(), target: num_(r[2]), date: toISO_(r[3], tz), saved: num_(r[4]), note: String(r[5] || '').trim(),
  }));
}

/* ------------------------------------------------------------------ net worth history */

/** Writes this month's net worth row in History (only when it changed) and returns all rows, oldest first. */
function snapshot_(accounts, holdings, debts, tz) {
  const sh = sheet_('history');
  const month = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  let cash = 0, cards = 0;
  accounts.forEach(a => { if (a.balance === null) return; if (a.type === 'Credit card') cards += Math.max(0, a.balance); else cash += a.balance; });
  const inv = holdings.reduce((s, h) => s + h.value, 0);
  const left = d => Math.max(0, d.amount - d.payments.reduce((s, p) => s + p.amount, 0));
  const owe = debts.filter(d => d.direction === 'owe').reduce((s, d) => s + left(d), 0);
  const owed = debts.filter(d => d.direction === 'owed').reduce((s, d) => s + left(d), 0);
  const r2 = v => Math.round(v * 100) / 100;
  const row = [month, r2(cash), r2(inv), r2(cards), r2(owe), r2(owed), r2(cash + inv + owed - cards - owe)];
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 7).getValues() : [];
  const monthOf = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM') : String(v).trim().slice(0, 7);
  const i = rows.findIndex(r => monthOf(r[0]) === month);
  const hasData = accounts.length || holdings.length || debts.length;
  if (hasData && (i < 0 || rows[i].slice(1).some((v, k) => Math.abs(Number(v) - row[k + 1]) > 0.005))) {
    withLock_(() => {
      if (i >= 0) sh.getRange(i + 2, 1, 1, 7).setValues([row]);
      else { sh.getRange(sh.getLastRow() + 1, 1, 1, 1).setNumberFormat('@'); sh.getRange(sh.getLastRow() + 1, 1, 1, 7).setValues([row]); }
    });
    if (i >= 0) rows[i] = row; else rows.push(row);
  }
  return rows.filter(r => /^\d{4}-\d{2}$/.test(monthOf(r[0]))).map(r => ({
    month: monthOf(r[0]), cash: Number(r[1]) || 0, investments: Number(r[2]) || 0, cards: Number(r[3]) || 0,
    owe: Number(r[4]) || 0, owed: Number(r[5]) || 0, net: Number(r[6]) || 0,
  })).sort((a, b) => a.month.localeCompare(b.month));
}

/* ------------------------------------------------------------------ categories */

function addCategory(c) {
  const name = String((c && c.name) || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  if (!name) throw new Error('Give the category a name');
  const type = c.type === 'income' ? 'income' : 'expense';
  const emoji = String(c.emoji || '').trim().slice(0, 8) || '🏷️';
  const group = GROUPS[type].indexOf(c.group) >= 0 ? c.group : (type === 'income' ? 'Income' : 'Want');
  return withLock_(() => {
    if (categories_()[type].some(x => x[0].toLowerCase() === name.toLowerCase())) throw new Error('That category already exists');
    const sh = sheet_('cats');
    // keep "Other" / "Other income" last: insert before it when present
    const n = sh.getLastRow() - 1;
    const names = n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
    const other = names.findIndex(r => String(r[0]).trim() === (type === 'income' ? 'Other income' : 'Other') && String(r[1]).trim().toLowerCase() === type);
    if (other >= 0) { sh.insertRowBefore(other + 2); sh.getRange(other + 2, 1, 1, 4).setValues([[safe_(name), cap_(type), emoji, group]]); }
    else sh.appendRow([safe_(name), cap_(type), emoji, group]);
    return categories_();
  });
}

/** Changes a category's icon and / or group. */
function updateCategory(c) {
  const name = String((c && c.name) || '').trim().toLowerCase();
  const type = c && c.type === 'income' ? 'income' : 'expense';
  return withLock_(() => {
    const sh = sheet_('cats');
    const n = sh.getLastRow() - 1;
    const rows = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
    const i = rows.findIndex(r => String(r[0]).trim().toLowerCase() === name && String(r[1]).trim().toLowerCase() === type);
    if (i < 0) throw new Error('That category is no longer in the sheet');
    if (c.emoji) sh.getRange(i + 2, 3).setValue(String(c.emoji).slice(0, 8));
    if (GROUPS[type].indexOf(c.group) >= 0) sh.getRange(i + 2, 4).setValue(c.group);
    return categories_();
  });
}

function deleteCategory(c) {
  const name = String((c && c.name) || '').trim().toLowerCase();
  const type = c && c.type === 'income' ? 'income' : 'expense';
  if (name === 'other' || name === 'other income') throw new Error('"Other" is needed for anything without a category');
  return withLock_(() => {
    const sh = sheet_('cats');
    const n = sh.getLastRow() - 1;
    if (n > 0) {
      const rows = sh.getRange(2, 1, n, 2).getValues();
      for (let i = n - 1; i >= 0; i--) {
        const t = String(rows[i][1]).trim().toLowerCase() === 'income' ? 'income' : 'expense';
        if (String(rows[i][0]).trim().toLowerCase() === name && t === type) sh.deleteRow(i + 2);
      }
    }
    return categories_();
  });
}

/** Categories as listed in the Categories tab: { expense: [[name, emoji, group]], income: [...] }. */
function categories_() {
  const sh = sheet_('cats');
  const rows = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : [];
  const out = { expense: [], income: [] };
  rows.forEach(r => {
    const name = String(r[0]).trim(); if (!name) return;
    const type = String(r[1]).trim().toLowerCase() === 'income' ? 'income' : 'expense';
    if (out[type].some(x => x[0].toLowerCase() === name.toLowerCase())) return;
    const g = String(r[3]).trim();
    out[type].push([name, String(r[2]).trim() || '🏷️', GROUPS[type].indexOf(g) >= 0 ? g : (type === 'income' ? 'Income' : 'Want')]);
  });
  if (!out.expense.length) out.expense = EXPENSE_CATS.map(c => c.slice());
  if (!out.income.length) out.income = INCOME_CATS.map(c => c.slice());
  [['expense', 'Other', '📦', 'Want'], ['income', 'Other income', '💰', 'Income']].forEach(([t, n, e, g]) => {
    const i = out[t].findIndex(x => x[0] === n);
    const item = i >= 0 ? out[t].splice(i, 1)[0] : [n, e, g];
    out[t].push(item);
  });
  return out;
}

/* ------------------------------------------------------------------ helpers */

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(key => {
    const def = SHEETS[key];
    let sh = ss.getSheetByName(def.name);
    if (sh) {
      // older versions had fewer columns: add any missing headers
      const head = sh.getRange(1, 1, 1, def.headers.length).getValues()[0];
      def.headers.forEach((h, i) => { if (String(head[i]).trim() === '') sh.getRange(1, i + 1).setValue(h).setFontWeight('bold').setBackground('#f1f0ec'); });
      return;
    }
    const first = ss.getSheets()[0];
    if (key === 'tx' && ss.getSheets().length === 1 && first.getLastRow() === 0) sh = first.setName(def.name);
    else sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#f1f0ec');
    sh.setFrozenRows(1);
    const list = (range, values) => sh.getRange(range).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
    const money = cols => cols.forEach(c => sh.getRange(c + '2:' + c).setNumberFormat('#,##0.00'));
    if (key === 'tx') {
      sh.getRange('B2:B').setNumberFormat('yyyy-mm-dd'); money(['F']); sh.getRange('I2:I').setNumberFormat('yyyy-mm-dd hh:mm');
      sh.setColumnWidth(1, 90); sh.setColumnWidth(5, 260); sh.setColumnWidth(8, 160);
      list('C2:C', ['Expense', 'Income']);
    }
    if (key === 'rules') sh.getRange(2, 1, DEFAULT_RULES.length, 2).setValues(DEFAULT_RULES);
    if (key === 'settings') sh.getRange(2, 1, 2, 2).setValues([['Currency', guessCurrency_()], ['Email search', DEFAULT_QUERY]]);
    if (key === 'budgets') money(['B']);
    if (key === 'debts') { money(['D']); sh.getRange('E2:E').setNumberFormat('yyyy-mm-dd'); sh.getRange('G2:G').setNumberFormat('yyyy-mm-dd hh:mm'); sh.setColumnWidth(2, 200); sh.setColumnWidth(6, 240); list('C2:C', ['I owe', 'Owed to me']); }
    if (key === 'payments') { sh.getRange('C2:C').setNumberFormat('yyyy-mm-dd'); money(['D']); }
    if (key === 'holdings') { money(['D', 'E']); sh.getRange('G2:G').setNumberFormat('yyyy-mm-dd'); sh.setColumnWidth(2, 200); list('C2:C', HOLDING_TYPES); }
    if (key === 'goals') { money(['C', 'E']); sh.getRange('D2:D').setNumberFormat('yyyy-mm-dd'); sh.setColumnWidth(2, 200); }
    if (key === 'history') { sh.getRange('A2:A').setNumberFormat('@'); money(['B', 'C', 'D', 'E', 'F', 'G']); }
    if (key === 'cats') list('B2:B', ['Expense', 'Income']);
  });
  migrate_();
}

/** One-time upgrades of an existing sheet, remembered in Settings. */
function migrate_() {
  const s = readSettings_();
  if (s['Version'] && Number(s['Version']) >= 3) return;
  withLock_(() => {
    // Categories: list every category in the tab, each with a Group.
    const cs = sheet_('cats');
    const n = cs.getLastRow() - 1;
    const have = n > 0 ? cs.getRange(2, 1, n, 4).getValues() : [];
    have.forEach((r, i) => { if (!String(r[3]).trim() && String(r[0]).trim()) cs.getRange(i + 2, 4).setValue(String(r[1]).trim().toLowerCase() === 'income' ? 'Income' : 'Want'); });
    const key = (name, type) => name.toLowerCase() + '|' + type;
    const present = new Set(have.map(r => key(String(r[0]).trim(), String(r[1]).trim().toLowerCase() === 'income' ? 'income' : 'expense')));
    const add = [];
    const push = (list, type) => list.forEach(([nm, e, g]) => { if (!present.has(key(nm, type))) add.push([nm, cap_(type), e, g]); });
    push(EXPENSE_CATS.slice(0, -1), 'expense'); push(INCOME_CATS.slice(0, -1), 'income');
    if (add.length) { cs.insertRowsBefore(2, add.length); cs.getRange(2, 1, add.length, 4).setValues(add); }
    const tail = [];
    if (!present.has(key('Other', 'expense'))) tail.push(['Other', 'Expense', '📦', 'Want']);
    if (!present.has(key('Other income', 'income'))) tail.push(['Other income', 'Income', '💰', 'Income']);
    if (tail.length) cs.getRange(cs.getLastRow() + 1, 1, tail.length, 4).setValues(tail);
    cs.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Need', 'Want', 'Savings', 'Debt', 'Transfer', 'Income'], true).setAllowInvalid(false).build());
    // Accounts: number formats and pick-lists for the new columns.
    const as = sheet_('accounts');
    as.getRange('D2:E').setNumberFormat('#,##0.00'); as.getRange('G2:G').setNumberFormat('yyyy-mm-dd'); as.getRange('C2:C').setNumberFormat('@');
    as.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ACCOUNT_TYPES, true).setAllowInvalid(false).build());
    // New rules (EMI, insurance, investing) go after the existing ones.
    const rs = sheet_('rules'); const known = new Set(readRules_().map(r => r[0].toLowerCase().trim()));
    const newRules = DEFAULT_RULES.filter(r => !known.has(r[0]));
    if (newRules.length) rs.getRange(rs.getLastRow() + 1, 1, newRules.length, 2).setValues(newRules);
    // Profile & targets.
    const cur = readSettings_();
    PROFILE.forEach(([label, def]) => { if (cur[label] === undefined) writeSetting_(label, def); });
    writeSetting_('Version', 3);
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

/** Inserts or updates a row (by ID in column A) of a tab whose first column is ID. Returns the saved id. */
function upsert_(key, id, values) {
  id = /^[\w-]{6,64}$/.test(String(id || '')) ? String(id) : Utilities.getUuid();
  return withLock_(() => {
    const sh = sheet_(key);
    const row = findRow_(sh, id);
    if (row) sh.getRange(row, 2, 1, values.length).setValues([values]);
    else sh.appendRow([id].concat(values));
    return id;
  });
}

function deleteById_(key, id) {
  return withLock_(() => {
    const sh = sheet_(key);
    const row = findRow_(sh, String(id));
    if (row) sh.deleteRow(row);
    return true;
  });
}

/** Reads a tab whose first column is ID, assigning IDs to rows typed straight into the sheet. */
function readRows_(key, keep, map) {
  const sh = sheet_(key);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, SHEETS[key].headers.length).getValues();
  let missing = false;
  const out = [];
  rows.forEach(r => { if (!keep(r)) return; if (!r[0]) { r[0] = Utilities.getUuid(); missing = true; } out.push(map(r)); });
  if (missing) withLock_(() => sh.getRange(2, 1, rows.length, 1).setValues(rows.map(r => [r[0]])));
  return out;
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
    account: String(t.account || '').slice(0, 40),
  };
}

/** A sheet cell as a number: absolute value unless signed is true. */
function num_(v, signed) {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  if (!isFinite(n)) return 0;
  return signed ? n : Math.abs(n);
}
/** '' for empty, otherwise a rounded number. */
function optNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!isFinite(n)) throw new Error('Invalid number');
  return Math.round(n * 100) / 100;
}

function toISO_(v, tz) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = s ? new Date(s) : null;
  return d && !isNaN(d) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
}
function todayISO_() { return Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd'); }

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

# Ledger: a personal finance dashboard, saved in a Google Sheet

Ledger shows where you stand financially: net worth, cash flow, spending, investments, debts, goals, and a set of financial-health indicators measured against standard benchmarks.
It reads your bank's alert emails in Gmail and adds those transactions for you. You can also enter payments by hand.
Everything is stored in a Google Sheet that you own. The app only displays the Sheet and adds to it. Only your Google account can open the app.
It works on a phone (bottom tabs) and on a laptop (wider layout).

Setup takes about 5 minutes.

## 1. Make the sheet and paste the code

1. Open **https://sheets.new** and name the sheet, for example "Ledger".
2. In the sheet, go to **Extensions → Apps Script**.
3. In the editor, `Code.gs` is already open. Delete what's there and paste in all of **Code.gs** from this folder.
4. Click the **+** next to "Files", choose **HTML**, and name it `Index` (it becomes `Index.html`). Paste in all of **Index.html**.
5. Click **Save** (💾).

## 2. Run setup once

1. In the function dropdown at the top of the editor, pick **setup**, then click **Run**.
2. Google asks for permission. Choose your account. If you see "Google hasn't verified this app", click **Advanced → Go to Ledger (unsafe)**. This is normal for a script you wrote yourself, and it only runs as you.
3. It asks for access to:
   - **Sheets**, to store your data
   - **Gmail**, to read bank alerts. It only reads; it never sends or deletes.
   - **Triggers**, for the 15-minute email check

Go back to the sheet. It now has all its tabs (Transactions, Accounts, Investments, Goals, Debts, History, Categories, Budgets, Rules and Settings).

## 3. Publish it as your app

1. In Apps Script, go to **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" and choose **Web app**.
3. Fill it in:
   - **Execute as:** Me
   - **Who has access:** **Only myself**
4. Click **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

## 4. Put it on your phone

Open the URL on your phone while signed in to the same Google account:

- **iPhone (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** ⋮ menu → **Add to Home screen**

It now opens from your home screen like an app.

---

## Using it

A period picker at the top (This month, Last 3 months, This year, custom dates…) controls Overview, Spending and Activity.

- **Overview:** net worth with its monthly history, then income, spending, investing and saved for the period. Below that:
  - **Financial health:** each indicator shows its value, the benchmark and a status (Healthy / Borderline / Off target). Tap one to see how it's worked out and where the benchmark comes from.
  - A 12-month cash-flow chart, and what's coming up.
- **Spending:** needs / wants / savings as a share of income against 50/30/20, spending by category against your budget, spending by month, and top payees.
- **Wealth:**
  - Net worth broken into assets and liabilities.
  - Emergency fund in months of essential spending.
  - Progress to financial independence (FI number = annual spending × 33 by default) and the time to reach it at your current pace.
  - Investments with allocation and gain, goals, accounts and credit cards with utilization, and debts.
- **Activity:** every transaction. Filter by type, category, account and source (entered by you / email / statement), search, and sort. **Possible duplicates** lists pairs to merge.
- **Settings:** your profile and targets, category groups, email import, currency.

### Quick add from your phone (iPhone Back Tap)

Add `?add=expense` or `?add=income` to the end of your web app URL, and the app opens straight into a new transaction. On a phone it shows a number pad and your most-used categories first. You can also prefill it, e.g. `…/exec?add=expense&amount=450&note=Lunch`.

To open it by double-tapping the back of an iPhone:

1. In the **Shortcuts** app, tap **+**, add the action **Open URLs**, and paste `https://script.google.com/macros/s/<your deployment id>/exec?add=expense`. Name the shortcut "Add expense".
2. Go to **Settings → Accessibility → Touch → Back Tap → Double Tap** and choose **Add expense**.
3. Optionally, make a second shortcut with `?add=income` and set it as **Triple Tap**.

### How things are counted

Every category has a **Group** (Settings, or the Categories tab):

| Group | Counted as |
|---|---|
| Need | spending (essential) |
| Want | spending (discretionary) |
| Debt | spending, and in EMIs-to-income (e.g. Loan EMI) |
| Savings | saved, not spent (e.g. Investing for SIPs) |
| Transfer | ignored (credit card bill payments, moving money between your own accounts) |
| Income | income |

### No double counting

- If an email alert matches a payment you already entered by hand (same type and amount, within 2 days), it's **linked** to your entry instead of being added. Your category stays, and the card gets filled in.
- If you add a payment by hand that was already imported, Ledger asks **Already recorded?** and updates the imported one instead.
- Rows imported from a bank statement (Source = `Statement`) also stop the same email alerts from being added.
- Anything that slips through shows up under **Activity → Possible duplicates**, with a Merge button.
- When you re-file an imported payment, Ledger offers to re-file every other payment with the same payee and to add a **Rule**, so future imports get it right.

### Getting all your transactions in (several cards)

1. **Turn on email alerts for every card** in each bank's app or net banking. Choose "all transactions", not just large ones.
2. **Add each account and card** under Wealth → Accounts & cards: the last 4 digits, the balance, and for credit cards the limit and the amount owed.
3. **Import your history:** go to Settings → Import older emails, pick 90 days or 1 year, and tap **Import**. One run reads up to about 600 email threads. Run it again to pick up more.
4. **Or import a bank statement:** convert it to a CSV with the Transactions columns in order (ID left blank, Source `Statement`). Open the **Transactions** tab, go to File → Import → Upload, and choose **Append to current sheet**.
5. From then on, new alerts arrive automatically every 15 minutes.

### Email import

Every 15 minutes, the script searches Gmail for bank alert emails. It reads the amount, whether money went out or came in, and the merchant. It skips OTPs, statements and payment reminders, and imports each email only once.

- **To make the search stricter:** go to Settings → "Which emails it reads" and add your bank's sender address, e.g. `from:(alerts@hdfcbank.net OR credit_cards@icicibank.com) newer_than:7d`.
- **Categories:** these come from the **Rules** tab. If the email contains `swiggy`, the transaction goes in `Food & dining`. The first matching rule wins.

### SMS alerts

Google can't read text messages on your phone. Most banks send the same alert by email too. If yours only sends SMS:

- **Android:** use an "SMS to Gmail" forwarding app.
- **iPhone:** create a Shortcuts automation: *Message received from [bank] → Send Email to yourself*.

### Sheet tabs

| Tab | What's in it |
|---|---|
| Transactions | every income / expense, with Source (Manual, Email, Statement) and Account |
| Accounts | bank accounts and cards: `Balance` (for a credit card, the amount owed), `Credit limit`, `Purpose` (e.g. Emergency fund) |
| Investments | holdings: `Type`, `Invested`, `Current value`, `Purpose` |
| Goals | `Target amount`, `Target date`, `Saved so far` |
| Debts / Debt payments | money you owe or are owed, with deadlines and part-payments |
| History | net worth at each month end. It fills itself in whenever you open the app, so don't edit it. |
| Categories | every category with its Group (the app draws its own icons; your own categories show their first letter) |
| Budgets | monthly limit per category |
| Rules | keyword → category for imported emails |
| Settings | your profile and targets (age, take-home, FI multiple, return, inflation, insurance covers), currency, Gmail search |

### Where the benchmarks come from

Indian bank and fintech guidance: Kotak, Bank of Baroda, Axis Bank, Bajaj Finserv, Policybazaar, Acko, Finnovate and freefincal. Global references: Fidelity (savings by age), SoFi and DBS (personal financial ratios). The defaults are:

- **Savings rate:** at least 20%, and 30%+ counts as strong.
- **Emergency fund:** 6 months of essentials, with 3 as the minimum.
- **FI multiple:** 33× annual spending (Indian planners use 28–33×, the US 4% rule gives 25×).
- **EMIs to income:** 30% or less (lenders cap at 40–50%).
- **Card utilization:** under 30%.
- **Term life cover:** 10–15× income.
- **Health cover:** ₹10–15L.
- **Equity share:** between 100 − age and 120 − age.
- **Net worth for your age:** Fidelity's 1× income by 30, 3× by 40.

No standard exists for how many credit cards to hold, so the count shows without a status. All targets are editable in Settings.

### Editing the sheet directly

You can type rows into **Transactions** yourself. You only need **Date**, **Type** (Expense/Income), **Category** and **Amount**, and the app fills in the ID. Pull new data into the app with **Settings → Refresh**, or just reopen the app.

### Updating the code later

- **With [clasp](https://github.com/google/clasp)** (the Google tool used to upload the code): run `clasp push`, then `clasp update-deployment <deployment id>`.
- **By hand:** paste the new code, then go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

Either way, the URL stays the same.

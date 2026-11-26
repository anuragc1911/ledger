# Ledger: a finance tracker on your phone, saved in a Google Sheet

You get a phone app with a dashboard, a transaction list, budgets and manual entry.
It also reads your bank's alert emails in Gmail and adds those transactions for you.
Everything is stored in a Google Sheet that you own. Only your Google account can open the app.

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

Go back to the sheet. It now has four tabs: **Transactions**, **Budgets**, **Rules** and **Settings**.

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

- **+ button:** add an expense or income. Enter the amount, tap a category, and save. The app remembers the last category you used.
- **Tap any transaction** to edit or delete it. Delete has an Undo.
- **Dashboard:** this month's spending against your budget, income, net saved, a 6-month chart, spending by category and recent transactions. Use ‹ › to change month.
- **Activity:** search and filter by spending, income or **From email**. Tap a category on the dashboard to see only its transactions.
- **Budgets:** set a monthly limit per category.
- **Settings:** email import on/off, **Check now**, currency, and a link to the sheet.

### Email import

Every 15 minutes, the script searches Gmail for bank alert emails. It reads the amount, whether money went out or came in, and the merchant (for example "Rs 450 debited… to VPA swiggy@icici" or "INR 2,349 at AMAZON"). It skips OTPs, statements and payment reminders. Each email is imported only once. Imported transactions show an **EMAIL** tag. Tap one to change its category.

- **To make the search stricter:** go to Settings → "Which emails it reads" and add your bank's sender address, e.g. `from:(alerts@hdfcbank.net OR credit_cards@icicibank.com) newer_than:7d`.
- **To fix categories:** add rows to the **Rules** tab in the sheet. If the email contains `swiggy`, the transaction goes in `Food & dining`. The first matching rule wins.
- **Duplicates:** paying a credit card bill from your bank shows up twice (once from the bank, once from the card). Delete one of them or give it the **Transfers** category.

### SMS alerts

Google can't read text messages on your phone. Most banks send the same alert by email too, so turn on email alerts in your bank's app. If your bank only sends SMS:

- **Android:** use an "SMS to Gmail" forwarding app, filtered to your bank's sender.
- **iPhone:** in the Shortcuts app, create a Personal Automation: *Message received from [bank] → Send Email to yourself*.

The forwarded messages land in Gmail and get picked up automatically. You may need to add the forwarder's sender address to the search.

### Editing the sheet directly

You can type rows into **Transactions** yourself. You only need **Date**, **Type** (Expense/Income), **Category** and **Amount**, and the app fills in the ID. Pull new data into the app with **Settings → Refresh**, or just reopen the app.

### Updating the code later

After pasting new code, go to **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

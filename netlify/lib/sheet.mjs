// Sends one row to the leads spreadsheet, if LEADS_WEBHOOK is set.
//
// LEADS_WEBHOOK is the web-app URL of the small Apps Script attached to the
// Google Sheet (see DEPLOY.md). The script adds a row for a new lead, and fills
// in the grade on that row once the report has been emailed.

export async function logToSheet(row) {
  const url = process.env.LEADS_WEBHOOK;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false; // the sheet being down never blocks a visitor
  }
}

// Apps Script for the "hotelgrader leads" Google Sheet.
// Extensions > Apps Script, paste this, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). The web-app URL goes into Netlify
// as LEADS_WEBHOOK.
//
// Columns: Timestamp (HST) | Name | Email | Hotel | City | State | Grade | Score | Report link | Source

function doPost(e) {
  var d = JSON.parse(e.postData.contents || '{}');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var email = String(d.email || '').toLowerCase();
    var hotel = String(d.hotel || '');
    if (!email) return out({ ok: false });

    // Same person, same hotel: update that row instead of adding another.
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][2]).toLowerCase() === email && String(rows[i][3]).toLowerCase() === hotel.toLowerCase()) {
        if (d.grade) sheet.getRange(i + 1, 7, 1, 2).setValues([[d.grade, d.score]]);
        if (d.link) sheet.getRange(i + 1, 9).setValue(d.link);
        return out({ ok: true, row: i + 1 });
      }
    }
    var when = Utilities.formatDate(new Date(), 'Pacific/Honolulu', 'yyyy-MM-dd HH:mm');
    sheet.appendRow([when, d.name || '', email, hotel, d.city || '', d.state || '', d.grade || '', d.score || '', d.link || '', 'site']);
    return out({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

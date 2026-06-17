// OBHS Advisor Catalog — Google Apps Script
// Paste this entire file into your Google Sheet's Apps Script editor.
// Extensions → Apps Script → paste → Save → Deploy → New deployment → Web App

const SHEET_NAMES = ["Freshmen", "Sophomores", "Juniors", "Seniors"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, sheet: sheetName, id, month, title, description, notes } = payload;

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return respond({ status: "error", message: "Sheet not found: " + sheetName });
    }

    if (action === "add") {
      // Find the next available ID
      const lastRow = sheet.getLastRow();
      const newId   = lastRow < 2 ? 1 : Number(sheet.getRange(lastRow, 1).getValue()) + 1;
      sheet.appendRow([newId, month || "", title || "", description || "", notes || ""]);
      return respond({ status: "ok", message: "Added" });
    }

    if (action === "update") {
      const rowIndex = findRowById(sheet, id);
      if (!rowIndex) return respond({ status: "error", message: "Row not found" });
      sheet.getRange(rowIndex, 2, 1, 4).setValues([[month || "", title || "", description || "", notes || ""]]);
      return respond({ status: "ok", message: "Updated" });
    }

    if (action === "delete") {
      const rowIndex = findRowById(sheet, id);
      if (!rowIndex) return respond({ status: "error", message: "Row not found" });
      sheet.deleteRow(rowIndex);
      return respond({ status: "ok", message: "Deleted" });
    }

    return respond({ status: "error", message: "Unknown action: " + action });

  } catch (err) {
    return respond({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return respond({ status: "ok", message: "OBHS Advisor Catalog script is running." });
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return null;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

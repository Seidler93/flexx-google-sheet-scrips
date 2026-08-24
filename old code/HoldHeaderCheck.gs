function ensureExtendedHoldRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("HOLDS"); // change to your sheet name
  
  const colA = sheet.getRange("A:A").getValues().flat();
  const colB = sheet.getRange("B:B").getValues().flat();
  
  const targetA = "Yellow Hold";
  const greenHoldB = "Green Hold";
  
  // 1️⃣ Already in Column A?
  const foundInA = colA.findIndex(v => v && v.toString().trim().toLowerCase() === targetA.toLowerCase());
  if (foundInA !== -1) return;
  
  // 2️⃣ Check for "Extended Hold" in Column B
  const foundInB = colB.findIndex(v => v && v.toString().trim().toLowerCase() === targetA.toLowerCase());
  if (foundInB !== -1) {
    let insertRowIndex = (foundInB + 1) - 1; // two rows above
    if (insertRowIndex < 1) insertRowIndex = 1;
    addYellowHoldRow(sheet, insertRowIndex);
    return;
  }
  
  // 3️⃣ Find last "Green Hold" in Column B
  let lastGreenHoldRow = -1;
  colB.forEach((v, i) => {
    if (v && v.toString().trim().toLowerCase() === greenHoldB.toLowerCase()) {
      lastGreenHoldRow = i + 1;
    }
  });
  
  if (lastGreenHoldRow !== -1) {
    addYellowHoldRow(sheet, lastGreenHoldRow + 1);
  } else {
    addYellowHoldRow(sheet, 3);
  }
}

function addYellowHoldRow(sheet, insertRowIndex) {
  Logger.log(`Inserting Yellow Hold row at position ${insertRowIndex}`);
  
  // Insert row
  sheet.insertRowBefore(insertRowIndex);

  // Set header text
  const headerTextCol1 = "Yellow Hold";
  const headerTextCol2 = "EXTENDED HOLDS 29>  Days OR Open-Ended Holds (bi-weekly texts)";

  sheet.getRange(insertRowIndex, 1).setValue(headerTextCol1);
  sheet.getRange(insertRowIndex, 2).setValue(headerTextCol2);

  // Merge columns 2 through 5 on the new row
  sheet.getRange(insertRowIndex, 2, 1, 4).merge(); // B → E

  // Center-align the merged cell text
  sheet.getRange(insertRowIndex, 2).setHorizontalAlignment("center");

  // Format only from col A to col M
  sheet.getRange(insertRowIndex, 1, 1, 13) // A → M
    .setBackground("yellow")
    .setFontWeight("bold");

  // Make col 1 text invisible (same yellow as background)
  sheet.getRange(insertRowIndex, 1).setFontColor("yellow");
}



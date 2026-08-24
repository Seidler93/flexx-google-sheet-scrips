/**
 * STEP 1: Load members and attendance, add any new names
 */
function processStep1(data, startDateStr, endDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const memberSheet = ss.getSheetByName('Members');
  const attendanceSheet = ss.getSheetByName('Attendance');

  // Get existing attendance names
  const attendanceRowCount = attendanceSheet.getLastRow();
  let existingDisplayNames = [];
  if (attendanceRowCount > 1 && !attendanceSheet.getRange(2, 1).isBlank()) {
    existingDisplayNames = attendanceSheet.getRange(2, 1, attendanceRowCount - 1).getValues().flat();
  }

  // Get member list
  const memberLastRow = memberSheet.getLastRow();
  const memberData = memberSheet.getRange(2, 1, Math.max(memberLastRow - 1, 0), 8).getValues();

  // Add new members to attendance sheet
  const memberNamesFromMembers = memberData.map(([name]) => name);
  const newNames = memberNamesFromMembers.filter(name =>
    name && !existingDisplayNames.includes(name)
  );

  if (newNames.length > 0) {
    attendanceSheet
      .getRange(attendanceSheet.getLastRow() + 1, 1, newNames.length, 1)
      .setValues(newNames.map(n => [n]));
  }

  // Store member data in cache for next steps
  CacheService.getScriptCache().put("memberData", JSON.stringify(memberData), 600);
  return true;
}

/**
 * STEP 2: Parse the raw session data, count sessions attended
 */
function processStep2(data, startDateStr, endDateStr) {
  const sessionLines = data.trim().split('\n');
  const attendees = sessionLines.map(line => line.split('\t')[0]);

  // Load member data from cache
  const memberData = JSON.parse(CacheService.getScriptCache().get("memberData")) || [];

  // Build map and count attendance
  const members = memberData.map(row => ({
    name: row[0],
    membershipStats: row[1],
    temp: row[2],
    reason: row[3],
    daysPerWeek: row[4],
    payment: row[5],
    pricePoint: row[6],
    startDate: row[7],
    sessionCount: 0
  }));

  const memberMap = new Map(members.map(m => [m.name, m]));

  attendees.forEach(attendee => {
    const m = memberMap.get(attendee);
    if (m) m.sessionCount++;
  });

  // Store in cache for next steps
  CacheService.getScriptCache().put("memberMap", JSON.stringify([...memberMap]), 600);
  return true;
}

/**
 * STEP 3: Create new columns, calculate attendance, write results and coloring
 */
function processStep3(data, startDateStr, endDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attendanceSheet = ss.getSheetByName('Attendance');
  const holdsSheet = ss.getSheetByName('HOLDS');

  const formattedMin = Utilities.formatDate(new Date(startDateStr), "UTC", "MM/dd");
  const formattedMax = Utilities.formatDate(new Date(endDateStr), "UTC", "MM/dd");
  const dateLabel = `${formattedMin}–${formattedMax}`;

  // Load memberMap
  const memberMap = new Map(JSON.parse(CacheService.getScriptCache().get("memberMap") || "[]"));

  // Insert columns and headers
  attendanceSheet.insertColumns(3, 3);
  attendanceSheet.getRange(1, 3, 1, 3).setValues([
    [`${dateLabel} Attended`, `${dateLabel} Expected`, `${dateLabel} Net`]
  ]);

  // Get holds data
  const holdsLastRow = holdsSheet.getLastRow();
  const holdsData = holdsSheet.getRange(2, 1, Math.max(holdsLastRow - 1, 0), 5).getValues();
  const findHold = (name) => holdsData.find(r => r[0] === name);

  // Get all names from Attendance
  const names = attendanceSheet
    .getRange(2, 1, Math.max(attendanceSheet.getLastRow() - 1, 0), 1)
    .getValues()
    .flat()
    .map(n => (n || '').toString().trim());

  // Build data for columns C:E
  const rowsCE = names.map(name => {
    const m = memberMap.get(name);
    const attended = m ? m.sessionCount : 0;
    let expected = m && m.daysPerWeek ? parseInt(m.daysPerWeek.toString().charAt(0), 10) : 0;

    if (findHold(name) || m?.payment === "Punchcard" || new Date(m?.startDate) > new Date(startDateStr)) {
      expected = 0;
    }

    const net = attended - expected;
    return [attended, expected, net];
  });

  // Write data
  if (rowsCE.length) {
    attendanceSheet.getRange(2, 3, rowsCE.length, 3).setValues(rowsCE);

    // Apply colors
    rowsCE.forEach((row, i) => {
      const [attended, expected, net] = row;
      const name = names[i];
      const range = attendanceSheet.getRange(i + 2, 3, 1, 3);
      const nameCol = attendanceSheet.getRange(i + 2, 1, 1, 1);

      const isHold = findHold(name);
      const isPunchcard = memberMap.get(name)?.payment === "Punchcard";

      if (isHold) {
        range.setBackground("#e0e0e0");
        nameCol.setBackground("#e0e0e0");
      } else if (isPunchcard) {
        range.setBackground("white");
        nameCol.setBackground("white");
      } else if (attended === 0 && expected > 0) {
        range.setBackground("#ffcccc");
        nameCol.setBackground("#ffcccc");
      } else if (net < 0) {
        range.setBackground("#fff4b3");
        nameCol.setBackground("#fff4b3");
      } else {
        range.setBackground("white");
        nameCol.setBackground("white");
      }
    });
  }

  return true;
}

/**
 * STEP 4: Write formulas to calculate total missed sessions
 */
function processStep4(data, startDateStr, endDateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attendanceSheet = ss.getSheetByName('Attendance');

  const formulaStartRow = 2;
  const formulaEndRow = attendanceSheet.getLastRow();

  for (let i = formulaStartRow; i <= formulaEndRow; i++) {
    const formula = `=IFERROR(SUM(FILTER(C${i}:AL${i}, MOD(COLUMN(C${i}:AL${i})-COLUMN(C${i}), 3)=2)), 0)`;
    attendanceSheet.getRange(i, 2).setFormula(formula);
  }

  return true;
}

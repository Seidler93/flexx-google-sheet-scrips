function processStep1(data, startDateStr, endDateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var memberSheet = getAttendanceRequiredSheet_(ss, 'Members');
  var attendanceSheet = getAttendanceRequiredSheet_(ss, 'Attendance');

  var attendanceRowCount = attendanceSheet.getLastRow();
  var existingDisplayNames = [];
  if (attendanceRowCount > 1 && !attendanceSheet.getRange(2, 1).isBlank()) {
    existingDisplayNames = attendanceSheet.getRange(2, 1, attendanceRowCount - 1, 1).getValues().map(function (row) {
      return String(row[0] || '').trim();
    });
  }

  var memberLastRow = memberSheet.getLastRow();
  var memberData = memberLastRow > 1
    ? memberSheet.getRange(2, 1, memberLastRow - 1, 8).getValues()
    : [];

  var memberNamesFromMembers = memberData.map(function (row) {
    return String(row[0] || '').trim();
  });
  var newNames = memberNamesFromMembers.filter(function (name) {
    return name && existingDisplayNames.indexOf(name) === -1;
  });

  if (newNames.length > 0) {
    attendanceSheet
      .getRange(attendanceSheet.getLastRow() + 1, 1, newNames.length, 1)
      .setValues(newNames.map(function (name) { return [name]; }));
  }

  CacheService.getScriptCache().put('attendanceMemberData', JSON.stringify(memberData), 600);
  return true;
}

function processStep2(data, startDateStr, endDateStr) {
  var sessionLines = String(data || '').trim().split('\n');
  var attendees = sessionLines.map(function (line) {
    return String(line.split('\t')[0] || '').trim();
  }).filter(function (name) {
    return name;
  });

  var memberData = JSON.parse(CacheService.getScriptCache().get('attendanceMemberData') || '[]');
  var members = memberData.map(function (row) {
    return {
      name: String(row[0] || '').trim(),
      membershipStatus: row[1],
      temperature: row[2],
      reason: row[3],
      daysPerWeek: row[4],
      payment: row[5],
      pricePoint: row[6],
      startDate: row[7],
      sessionCount: 0
    };
  });

  var memberMap = {};
  members.forEach(function (member) {
    if (member.name) {
      memberMap[member.name] = member;
    }
  });

  attendees.forEach(function (attendee) {
    if (memberMap[attendee]) {
      memberMap[attendee].sessionCount += 1;
    }
  });

  CacheService.getScriptCache().put('attendanceMemberMap', JSON.stringify(memberMap), 600);
  return true;
}

function processStep3(data, startDateStr, endDateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attendanceSheet = getAttendanceRequiredSheet_(ss, 'Attendance');
  var holdsSheet = getAttendanceRequiredSheet_(ss, 'HOLDS');

  var formattedMin = Utilities.formatDate(new Date(startDateStr), 'UTC', 'MM/dd');
  var formattedMax = Utilities.formatDate(new Date(endDateStr), 'UTC', 'MM/dd');
  var dateLabel = formattedMin + '-' + formattedMax;
  var memberMap = JSON.parse(CacheService.getScriptCache().get('attendanceMemberMap') || '{}');

  attendanceSheet.insertColumns(3, 3);
  attendanceSheet.getRange(1, 3, 1, 3).setValues([[
    dateLabel + ' Attended',
    dateLabel + ' Expected',
    dateLabel + ' Net'
  ]]);

  var holdsLastRow = holdsSheet.getLastRow();
  var holdsData = holdsLastRow > 1
    ? holdsSheet.getRange(2, 1, holdsLastRow - 1, 5).getValues()
    : [];
  var holdNames = {};
  holdsData.forEach(function (row) {
    var name = String(row[0] || '').trim();
    if (name) {
      holdNames[name] = true;
    }
  });

  var lastAttendanceRow = attendanceSheet.getLastRow();
  var names = lastAttendanceRow > 1
    ? attendanceSheet.getRange(2, 1, lastAttendanceRow - 1, 1).getValues().map(function (row) {
      return String(row[0] || '').trim();
    })
    : [];

  var periodStart = new Date(startDateStr);
  var rowsCE = names.map(function (name) {
    var member = memberMap[name];
    var attended = member ? Number(member.sessionCount || 0) : 0;
    var expected = member && member.daysPerWeek
      ? parseInt(String(member.daysPerWeek).charAt(0), 10) || 0
      : 0;
    var startDate = member && member.startDate ? new Date(member.startDate) : null;

    if (
      holdNames[name] ||
      (member && member.payment === 'Punchcard') ||
      (startDate && !isNaN(startDate.getTime()) && startDate > periodStart)
    ) {
      expected = 0;
    }

    return [attended, expected, attended - expected];
  });

  if (!rowsCE.length) {
    return true;
  }

  attendanceSheet.getRange(2, 3, rowsCE.length, 3).setValues(rowsCE);
  rowsCE.forEach(function (row, index) {
    var attended = row[0];
    var expected = row[1];
    var net = row[2];
    var name = names[index];
    var member = memberMap[name];
    var range = attendanceSheet.getRange(index + 2, 3, 1, 3);
    var nameCol = attendanceSheet.getRange(index + 2, 1, 1, 1);
    var isPunchcard = member && member.payment === 'Punchcard';
    var color = 'white';

    if (holdNames[name]) {
      color = '#e0e0e0';
    } else if (isPunchcard) {
      color = 'white';
    } else if (attended === 0 && expected > 0) {
      color = '#ffcccc';
    } else if (net < 0) {
      color = '#fff4b3';
    }

    range.setBackground(color);
    nameCol.setBackground(color);
  });

  return true;
}

function processStep4(data, startDateStr, endDateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attendanceSheet = getAttendanceRequiredSheet_(ss, 'Attendance');
  var formulaEndRow = attendanceSheet.getLastRow();

  for (var row = 2; row <= formulaEndRow; row += 1) {
    var formula = '=IFERROR(SUM(FILTER(C' + row + ':AL' + row + ', MOD(COLUMN(C' + row + ':AL' + row + ')-COLUMN(C' + row + '), 3)=2)), 0)';
    attendanceSheet.getRange(row, 2).setFormula(formula);
  }

  return true;
}

function getAttendanceRequiredSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Missing required sheet: ' + sheetName);
  }
  return sheet;
}

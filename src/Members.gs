var MEMBER_ID_HEADER = 'Member ID';

var MEMBER_HEADERS = [
  'Name',
  'Membership Status',
  'Membership Age',
  'Reason/Solution',
  'Days Per Week',
  'Payment Option',
  'Price Point',
  'Start Date',
  '90-Day Date',
  'Referral',
  'Referral 2nd Month',
  'Referral Member',
  'Referral Coach',
  'Recurring',
  'Reactivation',
  'Notes',
  'Created Date'
];

var MEMBER_EDITABLE_FIELDS = [
  'Name',
  'Reason/Solution',
  'Days Per Week',
  'Payment Option',
  'Price Point',
  'Start Date',
  'Referral',
  'Referral 2nd Month',
  'Referral Member',
  'Referral Coach',
  'Recurring',
  'Reactivation',
  'Notes'
];

var MEMBER_LOCKED_FIELDS = [
  'Membership Status',
  'Membership Age',
  '90-Day Date',
  'Created Date'
];

var MEMBER_DASHBOARD_TABLE_FIELDS = [
  'Name',
  'Membership Status',
  'Membership Age',
  'Reason/Solution',
  'Days Per Week',
  'Payment Option',
  'Price Point',
  'Start Date',
  '90-Day Date',
  'Recurring',
  'Notes',
  'Created Date'
];

var MEMBER_DASHBOARD_DEFAULT_FIELDS = [
  'Name',
  'Membership Status',
  'Membership Age',
  'Days Per Week',
  'Payment Option',
  'Price Point',
  'Start Date',
  '90-Day Date'
];

var CANCELLATIONS_DEFAULT_FIELDS = [
  'Name',
  'Membership Status',
  'Membership Age at Cancel',
  'Reason',
  'Cancel Date',
  'Solution',
  'Last Contact',
  'Stay in contact'
];

var HOLD_STATUSES = {
  green: 'Green Hold',
  yellow: 'Yellow Hold'
};

var UPCOMING_HOLD_HEADERS = [
  'Name',
  'Membership Status',
  'Membership Age',
  'Reason',
  'Start Date',
  'Next Contact',
  'Return Date?',
  'End of 6-week Nurture'
];

function getDashboardData(locationKey) {
  var location = getLocationConfig_(locationKey);
  var sheet = getMembersSheet_(location.key);
  var data = readMembersTable_(sheet);
  var headers = data.headers;
  var rows = data.rows;
  var statusIndex = headers.indexOf('Membership Status');

  var summary = {
    active: 0,
    greenHolds: 0,
    yellowHolds: 0,
    cancelsThisWeek: 0
  };
  var currentWeek = getCurrentWeekBounds_();

  rows.forEach(function (row) {
    incrementStatusSummary_(summary, getCellDisplay_(row[statusIndex]));
  });

  summary.cancelsThisWeek = getCancellationsThisWeek_(location.key, currentWeek);

  return {
    location: {
      key: location.key,
      name: location.name
    },
    summary: summary,
    memberTable: buildDashboardMemberTable_(headers, rows, data.firstDataRow)
  };
}

function searchMembers(locationKey, query) {
  var searchTerm = String(query || '').trim().toLowerCase();
  if (!searchTerm) {
    return [];
  }

  var sheet = getMembersSheet_(resolveLocationKey_(locationKey));
  var data = readMembersTable_(sheet);
  var nameIndex = data.headers.indexOf('Name');
  var statusIndex = data.headers.indexOf('Membership Status');
  var results = [];

  for (var i = 0; i < data.rows.length && results.length < 20; i += 1) {
    var row = data.rows[i];
    var name = getCellDisplay_(row[nameIndex]);
    if (name.toLowerCase().indexOf(searchTerm) > -1) {
      results.push({
        memberId: data.firstDataRow + i,
        name: name,
        membershipStatus: getCellDisplay_(row[statusIndex])
      });
    }
  }

  return results;
}

function searchAllMembersAndCancels(locationKey, query) {
  var searchTerm = String(query || '').trim().toLowerCase();
  if (!searchTerm) {
    return [];
  }

  var location = getLocationConfig_(resolveLocationKey_(locationKey));
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var membersData = readMembersTable_(membersSheet);
  var memberNameIndex = membersData.headers.indexOf('Name');
  var memberStatusIndex = membersData.headers.indexOf('Membership Status');
  var results = {};

  membersData.rows.forEach(function (row, index) {
    var name = getCellDisplay_(row[memberNameIndex]);
    var score = getNameSearchScore_(name, searchTerm);
    if (score === null) {
      return;
    }

    var memberId = membersData.firstDataRow + index;
    results['member:' + memberId] = {
      memberId: memberId,
      name: name,
      membershipStatus: getCellDisplay_(row[memberStatusIndex]),
      source: 'Members',
      meta: getCellDisplay_(row[memberStatusIndex]),
      score: score
    };
  });

  var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
  var cancellationHeaders = getSheetHeaderRow_(cancellationsSheet, 1).filter(function (header) {
    return header;
  });
  var cancellationNameIndex = cancellationHeaders.indexOf('Name');
  var cancellationStatusIndex = cancellationHeaders.indexOf('Membership Status');
  var cancellationDateIndex = cancellationHeaders.indexOf('Cancel Date');
  var memberRowMap = getMemberRowMapByName_(membersSheet);
  var lastCancellationRow = cancellationsSheet.getLastRow();

  if (cancellationNameIndex > -1 && lastCancellationRow >= 2 && cancellationHeaders.length) {
    var cancellationValues = cancellationsSheet.getRange(2, 1, lastCancellationRow - 1, cancellationHeaders.length).getValues();
    cancellationValues.forEach(function (row) {
      var name = getCellDisplay_(row[cancellationNameIndex]);
      var score = getNameSearchScore_(name, searchTerm);
      if (score === null) {
        return;
      }

      var memberId = memberRowMap[String(name || '').trim().toLowerCase()] || null;
      var key = memberId ? 'member:' + memberId : 'cancel:' + String(name || '').trim().toLowerCase();
      var status = getCellDisplay_(row[cancellationStatusIndex]) || 'Cancel';
      var cancelDate = cancellationDateIndex > -1 ? getCellDisplay_(row[cancellationDateIndex]) : '';
      var meta = cancelDate ? 'Canceled ' + cancelDate : status;

      if (results[key]) {
        results[key].source = results[key].source === 'Members' ? 'Members + Cancels' : results[key].source;
        results[key].meta = results[key].meta ? results[key].meta + ' | ' + meta : meta;
        results[key].score = Math.min(results[key].score, score + 0.2);
        return;
      }

      results[key] = {
        memberId: memberId,
        name: name,
        membershipStatus: status,
        source: 'Cancels',
        meta: meta,
        score: score + 0.2
      };
    });
  }

  return Object.keys(results).map(function (key) {
    return results[key];
  }).sort(function (left, right) {
    if (left.score !== right.score) {
      return left.score - right.score;
    }
    return String(left.name || '').localeCompare(String(right.name || ''));
  }).slice(0, 10).map(function (result) {
    delete result.score;
    return result;
  });
}

function addMemberFromWebApp(locationKey, form) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var firstName = String(form && form.firstName || '').trim();
  var lastName = String(form && form.lastName || '').trim();
  var startDate = parseIsoDate_(form && form.startDate);
  if (!firstName) {
    throw new Error('First name is required.');
  }
  if (!lastName) {
    throw new Error('Last name is required.');
  }
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Start date is required.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getMembersSheet_(resolvedLocationKey);
    var headers = getHeaderRow_(sheet);
    var rowNumber = 2;
    var row = headers.map(function () {
      return '';
    });
    var startDateColumn = columnIndexToLetter_(headers.indexOf('Start Date') + 1);
    var formattedName = lastName + ', ' + firstName;
    var trialDate = parseIsoDate_(form && form.trialDate);
    var notes = buildNewMemberNotes_(Boolean(form && form.trial), trialDate, form && form.notes);
    var referral = Boolean(form && form.referral);
    var pricePoint = String(form && form.pricePoint || '').trim();

    setValueForHeader_(headers, row, MEMBER_ID_HEADER, createMemberId_(resolvedLocationKey));
    setValueForHeader_(headers, row, 'Name', formattedName);
    setValueForHeader_(headers, row, 'Membership Status', 'Active');
    setValueForHeader_(headers, row, 'Membership Age', 'New member under 90 days');
    setValueForHeader_(headers, row, 'Reason/Solution', 'New member under 90 days');
    setValueForHeader_(headers, row, 'Days Per Week', String(form && form.daysPerWeek || '').trim());
    setValueForHeader_(headers, row, 'Payment Option', String(form && form.paymentOption || '').trim());
    setValueForHeader_(headers, row, 'Price Point', pricePoint === '' ? '' : Number(pricePoint));
    setValueForHeader_(headers, row, 'Start Date', startDate);
    setValueForHeader_(headers, row, '90-Day Date', '=EDATE(' + startDateColumn + rowNumber + ', 3)');
    setValueForHeader_(headers, row, 'Referral', referral);
    setValueForHeader_(headers, row, 'Referral 2nd Month', referral ? '=EDATE(' + startDateColumn + rowNumber + ', 1)' : '');
    setValueForHeader_(headers, row, 'Referral Member', String(form && form.referralMember || '').trim());
    setValueForHeader_(headers, row, 'Referral Coach', '');
    setValueForHeader_(headers, row, 'Recurring', Boolean(form && form.recurring));
    setValueForHeader_(headers, row, 'Reactivation', false);
    setValueForHeader_(headers, row, 'Notes', notes);
    setValueForHeader_(headers, row, 'Created Date', new Date());

    sheet.insertRowBefore(rowNumber);
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: sheet.getName(),
      rowNumber: rowNumber,
      oldStatus: '',
      newStatus: 'Active',
      newDaysPerWeek: valueForHeader_(headers, row, 'Days Per Week'),
      newNotes: notes
    });

    return getMember(resolvedLocationKey, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function backfillMemberIdsForAllLocations() {
  var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
    return backfillMemberIdsForLocation_(locationKey);
  });
  return results;
}

function backfillMemberIdsForDefaultLocation() {
  return backfillMemberIdsForLocation_(FLEXX_CONFIG.defaultLocationKey);
}

function validateAllLocationSheets() {
  var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
    return validateLocationSheets_(locationKey);
  });
  var issues = [];
  results.forEach(function (result) {
    issues = issues.concat(result.issues);
  });
  if (issues.length) {
    notifyAppIssue_(
      'Flexx Staff validation found sheet issues',
      issues.join('\n')
    );
  }
  return results;
}

function getMember(locationKey, memberId) {
  var rowNumber = parseMemberRowNumber_(memberId);
  var sheet = getMembersSheet_(resolveLocationKey_(locationKey));
  validateMemberRow_(sheet, rowNumber);

  var headers = getHeaderRow_(sheet);
  var row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  var fields = {};

  MEMBER_HEADERS.forEach(function (fieldName) {
    var index = headers.indexOf(fieldName);
    fields[fieldName] = index > -1 ? formatClientValue_(row[index]) : '';
  });

  return {
    memberId: rowNumber,
    fields: fields,
    editableFields: MEMBER_EDITABLE_FIELDS,
    lockedFields: MEMBER_LOCKED_FIELDS
  };
}

function saveMemberChanges(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var rowNumber = parseMemberRowNumber_(payload && payload.memberId);
  var updates = payload && payload.fields ? payload.fields : {};
  var lock = LockService.getScriptLock();

  lock.waitLock(30000);
  try {
    var sheet = getMembersSheet_(resolvedLocationKey);
    validateMemberRow_(sheet, rowNumber);

    var headers = getHeaderRow_(sheet);
    var rowRange = sheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();

    MEMBER_EDITABLE_FIELDS.forEach(function (fieldName) {
      if (Object.prototype.hasOwnProperty.call(updates, fieldName)) {
        var index = headers.indexOf(fieldName);
        if (index > -1) {
          row[index] = formatMemberUpdateValue_(fieldName, updates[fieldName]);
        }
      }
    });

    rowRange.setValues([row]);
    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: sheet.getName(),
      rowNumber: rowNumber,
      oldStatus: valueForHeader_(headers, before, 'Membership Status'),
      newStatus: valueForHeader_(headers, row, 'Membership Status'),
      oldDaysPerWeek: valueForHeader_(headers, before, 'Days Per Week'),
      newDaysPerWeek: valueForHeader_(headers, row, 'Days Per Week'),
      oldNotes: valueForHeader_(headers, before, 'Notes'),
      newNotes: valueForHeader_(headers, row, 'Notes')
    });

    return getMember(resolvedLocationKey, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function setMemberStatus(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var rowNumber = parseMemberRowNumber_(payload && payload.memberId);
  var status = String(payload && payload.status || '').trim();
  if (status !== 'Active') {
    throw new Error('This status change needs the hold or cancel form.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var sheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
    var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    validateMemberRow_(sheet, rowNumber);

    var headers = getHeaderRow_(sheet);
    var rowRange = sheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();
    var name = getCellDisplay_(valueForHeader_(headers, row, 'Name'));

    var oldStatus = String(valueForHeader_(headers, before, 'Membership Status') || '').trim();
    setValueForHeader_(headers, row, 'Membership Status', status);
    if (status === 'Active' && (oldStatus === 'Cancel' || (payload && payload.reactivate === true))) {
      setValueForHeader_(headers, row, 'Reactivation', true);
    }
    rowRange.setValues([row]);
    clearHoldRowsForMember_(holdsSheet, name);
    clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
    if (payload && payload.cancellationRowNumber) {
      setCancellationRowStatus_(cancellationsSheet, Number(payload.cancellationRowNumber), status);
    }
    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: sheet.getName(),
      rowNumber: rowNumber,
      oldStatus: oldStatus,
      newStatus: valueForHeader_(headers, row, 'Membership Status'),
      oldDaysPerWeek: valueForHeader_(headers, before, 'Days Per Week'),
      newDaysPerWeek: valueForHeader_(headers, row, 'Days Per Week'),
      oldNotes: valueForHeader_(headers, before, 'Notes'),
      newNotes: valueForHeader_(headers, row, 'Notes')
    });

    return getMember(resolvedLocationKey, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function cancelMember(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var rowNumber = parseMemberRowNumber_(payload && payload.memberId);
  var reason = String(payload && payload.reason || '').trim();
  var solution = String(payload && payload.solution || '').trim();
  var cancelDate = parseIsoDate_(payload && payload.cancelDate) || new Date();
  var lock = LockService.getScriptLock();

  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    validateMemberRow_(membersSheet, rowNumber);

    var headers = getHeaderRow_(membersSheet);
    var rowRange = membersSheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();

    setValueForHeader_(headers, row, 'Membership Status', 'Cancel');
    if (reason) {
      setValueForHeader_(headers, row, 'Reason/Solution', reason);
    }
    rowRange.setValues([row]);

    appendCancellationRow_(cancellationsSheet, headers, row, reason, solution, cancelDate);
    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: membersSheet.getName(),
      rowNumber: rowNumber,
      oldStatus: valueForHeader_(headers, before, 'Membership Status'),
      newStatus: 'Cancel',
      cancelReason: reason,
      cancelDate: cancelDate
    });

    return getMember(resolvedLocationKey, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function putMemberOnHold(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var rowNumber = parseMemberRowNumber_(payload && payload.memberId);
  var startDate = parseIsoDate_(payload && payload.startDate);
  var returnDate = parseIsoDate_(payload && payload.returnDate);
  var holdType = calculateHoldType_(startDate, returnDate);
  var holdStatus = HOLD_STATUSES[holdType];
  if (!holdStatus) {
    throw new Error('Could not calculate a valid hold type.');
  }

  var reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new Error('Hold reason is required.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
    var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');

    validateMemberRow_(membersSheet, rowNumber);

    var headers = getHeaderRow_(membersSheet);
    var rowRange = membersSheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();
    var name = getCellDisplay_(valueForHeader_(headers, row, 'Name'));
    var membershipAge = getCellDisplay_(valueForHeader_(headers, row, 'Membership Age'));

    setValueForHeader_(headers, row, 'Reason/Solution', reason);

    var holdRow = [
      name,
      holdStatus,
      membershipAge,
      reason,
      startDate,
      parseIsoDate_(payload.nextContact),
      returnDate,
      holdType === 'yellow' ? parseIsoDate_(payload.endOfNurture) || addDays_(startDate, 42) : ''
    ];
    clearHoldRowsForMember_(holdsSheet, name);
    clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);

    var isUpcomingHold = isFutureDate_(startDate);
    var holdRowNumber;
    var holdSheetName;
    if (isUpcomingHold) {
      holdRowNumber = appendUpcomingHoldRow_(upcomingHoldsSheet, holdRow);
      holdSheetName = upcomingHoldsSheet.getName();
    } else {
      setValueForHeader_(headers, row, 'Membership Status', holdStatus);
      holdRowNumber = appendHoldRow_(holdsSheet, holdType, holdRow);
      holdSheetName = holdsSheet.getName();
    }

    rowRange.setValues([row]);

    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: membersSheet.getName(),
      rowNumber: rowNumber,
      oldStatus: valueForHeader_(headers, before, 'Membership Status'),
      newStatus: valueForHeader_(headers, row, 'Membership Status'),
      oldDaysPerWeek: valueForHeader_(headers, before, 'Days Per Week'),
      newDaysPerWeek: valueForHeader_(headers, row, 'Days Per Week'),
      oldNotes: valueForHeader_(headers, before, 'Notes'),
      newNotes: valueForHeader_(headers, row, 'Notes'),
      holdType: holdType,
      holdSheet: holdSheetName,
      holdRowNumber: holdRowNumber,
      holdReason: reason,
      upcoming: isUpcomingHold
    });

    return {
      member: getMember(resolvedLocationKey, rowNumber),
      holdRowNumber: holdRowNumber,
      upcoming: isUpcomingHold
    };
  } finally {
    lock.releaseLock();
  }
}

function getHoldsData(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
  var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var memberRowMap = getMemberRowMapByName_(membersSheet);

  return {
    green: readHoldSection_(holdsSheet, 'green', memberRowMap),
    yellow: readHoldSection_(holdsSheet, 'yellow', memberRowMap),
    upcoming: readUpcomingHoldSection_(upcomingHoldsSheet, memberRowMap)
  };
}

function getCancellationsData(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var memberRowMap = getMemberRowMapByName_(membersSheet);
  var headers = getSheetHeaderRow_(cancellationsSheet, 1).filter(function (header) {
    return header;
  });
  var lastRow = cancellationsSheet.getLastRow();
  var rows = [];

  if (lastRow >= 2 && headers.length) {
    var values = cancellationsSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    values.forEach(function (row, index) {
      if (row.every(function (value) { return String(value || '').trim() === ''; })) {
        return;
      }

      var fields = {};
      headers.forEach(function (header, columnIndex) {
        fields[header] = formatClientValue_(row[columnIndex]);
      });

      var name = String(fields.Name || '').trim().toLowerCase();
      rows.push({
        rowNumber: index + 2,
        memberId: memberRowMap[name] || null,
        fields: fields
      });
    });
  }

  return {
    columns: headers,
    defaultVisibleColumns: CANCELLATIONS_DEFAULT_FIELDS.filter(function (fieldName) {
      return headers.indexOf(fieldName) > -1;
    }),
    rows: rows
  };
}

function getDataTimeline(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var sheet = getRequiredSheet_(spreadsheet, location.sheets.data || 'Dashboard', 'Data');
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 4) {
    return {
      title: location.name,
      periods: [],
      rows: []
    };
  }

  var displayValues = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  var title = String(displayValues[1] && displayValues[1][0] || location.name).trim() || location.name;
  var periods = [];
  for (var column = 4; column <= lastColumn; column += 1) {
    var topLabel = String(displayValues[0][column - 1] || '').trim();
    var bottomLabel = String(displayValues[1][column - 1] || '').trim();
    if (!topLabel && !bottomLabel && isTimelineColumnEmpty_(displayValues, column - 1)) {
      continue;
    }
    periods.push({
      columnIndex: column,
      startLabel: topLabel,
      endLabel: bottomLabel
    });
  }

  var rows = [];
  for (var rowIndex = 2; rowIndex < displayValues.length; rowIndex += 1) {
    var row = displayValues[rowIndex];
    var label = String(row[0] || '').trim();
    var goal = String(row[1] || '').trim();
    var average = String(row[2] || '').trim();
    var values = periods.map(function (period) {
      return String(row[period.columnIndex - 1] || '').trim();
    });
    if (!label && !goal && !average && values.every(function (value) { return !value; })) {
      continue;
    }
    rows.push({
      metric: label,
      goal: goal,
      average: average,
      values: values
    });
  }

  return {
    title: title,
    periods: periods,
    rows: rows
  };
}

function updateHoldEntry(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var holdType = String(payload && payload.holdType || '').trim().toLowerCase();
  var rowNumber = Number(payload && payload.rowNumber);
  var fields = payload && payload.fields ? payload.fields : {};
  if (!HOLD_STATUSES[holdType] || !rowNumber) {
    throw new Error('Invalid hold row.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
    var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    var section = findHoldSection_(holdsSheet, holdType);
    var headers = getHoldSectionHeaders_(holdsSheet, section.headerRow, holdType);
    var width = holdType === 'yellow' ? 8 : 7;
    var rowRange = holdsSheet.getRange(rowNumber, 1, 1, width);
    var row = rowRange.getValues()[0];
    var name = String(valueForHeader_(headers, row, 'Name') || '').trim();
    var memberInfo = findMemberByName_(membersSheet, name);
    if (!memberInfo) {
      throw new Error('Could not find member from hold row: ' + name);
    }

    var statusWasChanged = Object.prototype.hasOwnProperty.call(fields, 'Membership Status');
    var requestedStatus = String(fields['Membership Status'] || valueForHeader_(headers, row, 'Membership Status') || '').trim();
    var reason = Object.prototype.hasOwnProperty.call(fields, 'Reason') ? fields['Reason'] : valueForHeader_(headers, row, 'Reason');
    var startDate = Object.prototype.hasOwnProperty.call(fields, 'Start Date') ? parseIsoDate_(fields['Start Date']) : valueForHeader_(headers, row, 'Start Date');
    var nextContact = Object.prototype.hasOwnProperty.call(fields, 'Next Contact') ? parseHoldOptionalDate_(fields['Next Contact']) : valueForHeader_(headers, row, 'Next Contact');
    var returnDate = Object.prototype.hasOwnProperty.call(fields, 'Return Date?') ? parseHoldReturnDate_(fields['Return Date?']) : valueForHeader_(headers, row, 'Return Date?');
    var endNurture = Object.prototype.hasOwnProperty.call(fields, 'End of 6-week Nurture') ? parseHoldOptionalDate_(fields['End of 6-week Nurture']) : valueForHeader_(headers, row, 'End of 6-week Nurture');

    if (requestedStatus === 'Active') {
      updateMemberFromHold_(memberInfo, 'Active', reason);
      clearHoldRow_(holdsSheet, rowNumber);
      SpreadsheetApp.flush();
      return getHoldsData(resolvedLocationKey);
    }

    if (requestedStatus === 'Cancel') {
      updateMemberFromHold_(memberInfo, 'Cancel', reason);
      appendCancellationRow_(cancellationsSheet, memberInfo.headers, memberInfo.row, reason, '', new Date());
      clearHoldRow_(holdsSheet, rowNumber);
      SpreadsheetApp.flush();
      return getHoldsData(resolvedLocationKey);
    }

    if (statusWasChanged && requestedStatus === 'Yellow Hold') {
      returnDate = '-';
    }

    var targetHoldType = statusWasChanged && requestedStatus === 'Yellow Hold' ? 'yellow' : calculateHoldType_(startDate, returnDate);
    var targetStatus = HOLD_STATUSES[targetHoldType];
    if (targetHoldType === 'yellow' && !Object.prototype.hasOwnProperty.call(fields, 'End of 6-week Nurture')) {
      endNurture = addDays_(startDate, 42);
    } else if (targetHoldType !== 'yellow') {
      endNurture = '';
    }
    var nextRow = [
      name,
      targetStatus,
      valueForHeader_(headers, row, 'Membership Age'),
      reason,
      startDate,
      nextContact,
      returnDate,
      endNurture
    ];

    updateMemberFromHold_(memberInfo, targetStatus, reason);
    if (targetHoldType === holdType) {
      rowRange.setValues([nextRow.slice(0, width)]);
    } else {
      clearHoldRow_(holdsSheet, rowNumber);
      appendHoldRow_(holdsSheet, targetHoldType, nextRow);
    }
    SpreadsheetApp.flush();
    return getHoldsData(resolvedLocationKey);
  } finally {
    lock.releaseLock();
  }
}

function getMembersSheet_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  return getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
}

function backfillMemberIdsForLocation_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var sheet = getMembersSheet_(location.key);
  var idColumn = ensureMemberIdColumn_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      location: location.name,
      addedColumn: idColumn.addedColumn,
      updatedRows: 0
    };
  }

  var values = sheet.getRange(2, idColumn.index + 1, lastRow - 1, 1).getValues();
  var updatedRows = 0;
  values.forEach(function (row) {
    if (!String(row[0] || '').trim()) {
      row[0] = createMemberId_(location.key);
      updatedRows += 1;
    }
  });

  if (updatedRows) {
    sheet.getRange(2, idColumn.index + 1, values.length, 1).setValues(values);
  }

  return {
    location: location.name,
    addedColumn: idColumn.addedColumn,
    updatedRows: updatedRows
  };
}

function validateLocationSheets_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var issues = [];

  validateSheetExists_(spreadsheet, location.sheets.members, location.name, 'Members', issues);
  validateSheetExists_(spreadsheet, location.sheets.holds, location.name, 'HOLDS', issues);
  validateSheetExists_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', location.name, 'Upcoming Holds', issues);
  validateSheetExists_(spreadsheet, location.sheets.cancellations, location.name, 'Cancellations/Ex-Members', issues);
  validateSheetExists_(spreadsheet, location.sheets.data || 'Dashboard', location.name, 'Dashboard', issues);

  var membersSheet = spreadsheet.getSheetByName(location.sheets.members);
  if (membersSheet) {
    var memberHeaders = getSheetHeaderRow_(membersSheet, MEMBER_HEADERS.length);
    MEMBER_HEADERS.forEach(function (header) {
      if (memberHeaders.indexOf(header) === -1) {
        issues.push(location.name + ': Members is missing header "' + header + '".');
      }
    });
  }

  var holdsSheet = spreadsheet.getSheetByName(location.sheets.holds);
  if (holdsSheet) {
    try {
      findHoldSection_(holdsSheet, 'green');
      findHoldSection_(holdsSheet, 'yellow');
    } catch (error) {
      issues.push(location.name + ': HOLDS layout issue - ' + error.message);
    }
  }

  var cancellationsSheet = spreadsheet.getSheetByName(location.sheets.cancellations);
  if (cancellationsSheet) {
    var cancellationHeaders = getSheetHeaderRow_(cancellationsSheet, 1);
    ['Name', 'Membership Status', 'Cancel Date'].forEach(function (header) {
      if (cancellationHeaders.indexOf(header) === -1) {
        issues.push(location.name + ': Cancellations/Ex-Members is missing header "' + header + '".');
      }
    });
  }

  return {
    location: location.name,
    ok: issues.length === 0,
    issues: issues
  };
}

function validateSheetExists_(spreadsheet, sheetName, locationName, label, issues) {
  if (!spreadsheet.getSheetByName(sheetName)) {
    issues.push(locationName + ': missing "' + sheetName + '" tab for ' + label + '.');
  }
}

function ensureMemberIdColumn_(sheet) {
  var headers = getSheetHeaderRow_(sheet, MEMBER_HEADERS.length + 1);
  var existingIndex = headers.indexOf(MEMBER_ID_HEADER);
  if (existingIndex > -1) {
    return {
      index: existingIndex,
      addedColumn: false
    };
  }

  sheet.insertColumnBefore(1);
  sheet.getRange(1, 1).setValue(MEMBER_ID_HEADER);
  return {
    index: 0,
    addedColumn: true
  };
}

function createMemberId_(locationKey) {
  return String(locationKey || 'member') + '-' + Utilities.getUuid();
}

function getRequiredSheet_(spreadsheet, sheetName, label) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    notifyAppIssue_(
      'Flexx Staff sheet setup issue',
      'Could not find the "' + sheetName + '" tab for ' + label + ' in spreadsheet ' + spreadsheet.getId() + '.'
    );
    throw new Error('Sheet setup issue: missing "' + sheetName + '" tab for ' + label + '. This has been logged for repair.');
  }
  return sheet;
}

function getCancellationsThisWeek_(locationKey, currentWeek) {
  var location = getLocationConfig_(locationKey);
  var sheetName = location.sheets.cancellations;
  if (!sheetName) {
    return 0;
  }

  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Cancellations sheet not found for ' + location.name + '.');
  }

  var headers = getSheetHeaderRow_(sheet, 1);
  var cancelDateIndex = headers.indexOf('Cancel Date');
  if (cancelDateIndex === -1) {
    throw new Error('Missing required cancellations header: Cancel Date');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var values = sheet.getRange(2, cancelDateIndex + 1, lastRow - 1, 1).getValues();
  var count = 0;
  values.forEach(function (row) {
    if (isDateInBounds_(row[0], currentWeek)) {
      count += 1;
    }
  });

  return count;
}

function buildDashboardMemberTable_(headers, rows, firstDataRow) {
  var availableFields = MEMBER_DASHBOARD_TABLE_FIELDS.filter(function (fieldName) {
    return headers.indexOf(fieldName) > -1;
  });

  return {
    columns: availableFields,
    defaultVisibleColumns: MEMBER_DASHBOARD_DEFAULT_FIELDS.filter(function (fieldName) {
      return availableFields.indexOf(fieldName) > -1;
    }),
    rows: rows.map(function (row, index) {
      var fields = {};
      availableFields.forEach(function (fieldName) {
        fields[fieldName] = formatClientValue_(valueForHeader_(headers, row, fieldName));
      });

      return {
        memberId: firstDataRow + index,
        fields: fields
      };
    })
  };
}

function appendHoldRow_(sheet, holdType, rowValues) {
  var section = findHoldSection_(sheet, holdType);
  var appendRow = section.headerRow + 1;

  sheet.insertRowsBefore(appendRow, 1);

  sheet.getRange(appendRow, 1, 1, rowValues.length).setValues([rowValues]);
  return appendRow;
}

function appendUpcomingHoldRow_(sheet, rowValues) {
  var headers = ensureUpcomingHoldHeaders_(sheet);
  var appendRow = 2;
  var row = headers.map(function (header, index) {
    return index < rowValues.length ? rowValues[index] : '';
  });
  sheet.insertRowBefore(appendRow);
  sheet.getRange(appendRow, 1, 1, headers.length).setValues([row]);
  return appendRow;
}

function ensureUpcomingHoldHeaders_(sheet) {
  var headers = getSheetHeaderRow_(sheet, UPCOMING_HOLD_HEADERS.length).filter(function (header) {
    return header;
  });
  if (!headers.length) {
    sheet.getRange(1, 1, 1, UPCOMING_HOLD_HEADERS.length).setValues([UPCOMING_HOLD_HEADERS]);
    return UPCOMING_HOLD_HEADERS.slice();
  }
  return headers;
}

function appendCancellationRow_(sheet, memberHeaders, memberRow, reason, solution, cancelDate) {
  var cancelHeaders = getSheetHeaderRow_(sheet, 1);
  var row = cancelHeaders.map(function (header) {
    if (header === 'Membership Age at Cancel') {
      return valueForHeader_(memberHeaders, memberRow, 'Membership Age');
    }
    if (header === 'Reason') {
      return reason || valueForHeader_(memberHeaders, memberRow, 'Reason/Solution');
    }
    if (header === 'Cancel Date') {
      return cancelDate;
    }
    if (header === 'Solution') {
      return solution;
    }
    return valueForHeader_(memberHeaders, memberRow, header);
  });

  sheet.appendRow(row);
}

function readHoldSection_(sheet, holdType, memberRowMap) {
  var section = findHoldSection_(sheet, holdType);
  var headers = getHoldSectionHeaders_(sheet, section.headerRow, holdType);
  var statusIndex = headers.indexOf('Membership Status');
  var expectedStatus = HOLD_STATUSES[holdType];
  var startRow = section.headerRow + 1;
  var endRow = section.nextHeaderRow ? section.nextHeaderRow - 1 : sheet.getLastRow();

  if (endRow < startRow) {
    return {
      columns: headers,
      rows: []
    };
  }

  var values = sheet.getRange(startRow, 1, endRow - startRow + 1, headers.length).getValues();
  var rows = [];
  values.forEach(function (row, index) {
    if (isBlankHoldRow_(row) || String(row[0] || '').trim() === '') {
      return;
    }
    if (statusIndex > -1 && String(row[statusIndex] || '').trim() !== expectedStatus) {
      return;
    }

    var fields = {};
    headers.forEach(function (header, columnIndex) {
      fields[header] = formatClientValue_(row[columnIndex]);
    });

    var name = String(fields.Name || '').trim().toLowerCase();
    rows.push({
      rowNumber: startRow + index,
      holdType: holdType,
      memberId: memberRowMap && memberRowMap[name] ? memberRowMap[name] : null,
      fields: fields
    });
  });

  return {
    columns: headers,
    rows: rows
  };
}

function readUpcomingHoldSection_(sheet, memberRowMap) {
  var headers = ensureUpcomingHoldHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var rows = [];
  if (lastRow >= 2 && headers.length) {
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    values.forEach(function (row, index) {
      if (row.every(function (value) { return String(value || '').trim() === ''; })) {
        return;
      }

      var fields = {};
      headers.forEach(function (header, columnIndex) {
        fields[header] = formatClientValue_(row[columnIndex]);
      });

      var name = String(fields.Name || '').trim().toLowerCase();
      rows.push({
        rowNumber: index + 2,
        holdType: 'upcoming',
        memberId: memberRowMap && memberRowMap[name] ? memberRowMap[name] : null,
        fields: fields
      });
    });
  }

  return {
    columns: headers,
    rows: rows
  };
}

function getHoldSectionHeaders_(sheet, headerRow, holdType) {
  var columnCount = holdType === 'yellow' ? 8 : 7;
  return sheet.getRange(headerRow, 1, 1, columnCount).getValues()[0].map(function (header) {
    return String(header || '').trim();
  }).filter(function (header) {
    return header;
  });
}

function findHoldSection_(sheet, holdType) {
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var values = sheet.getRange(1, 1, lastRow, Math.max(sheet.getLastColumn(), 2)).getValues();
  var headerRows = [];

  values.forEach(function (row, index) {
    var first = String(row[0] || '').trim().toLowerCase();
    var second = String(row[1] || '').trim().toLowerCase();
    if (first === 'name' && second === 'membership status') {
      headerRows.push(index + 1);
    }
  });

  var sectionIndex = holdType === 'green' ? 0 : 1;
  if (!headerRows[sectionIndex]) {
    throw new Error('Could not find the ' + holdType + ' hold section in HOLDS.');
  }

  return {
    headerRow: headerRows[sectionIndex],
    nextHeaderRow: headerRows[sectionIndex + 1] || null
  };
}

function findHoldAppendRow_(sheet, section) {
  var startRow = section.headerRow + 1;
  var endRow = section.nextHeaderRow ? section.nextHeaderRow - 1 : Math.max(sheet.getLastRow(), startRow);
  var rowCount = Math.max(endRow - startRow + 1, 1);
  var values = sheet.getRange(startRow, 1, rowCount, Math.max(sheet.getLastColumn(), 8)).getValues();

  for (var i = 0; i < values.length; i += 1) {
    if (isBlankHoldRow_(values[i])) {
      return startRow + i;
    }
  }

  return endRow + 1;
}

function isBlankHoldRow_(row) {
  var firstEightValues = row.slice(0, 8);
  return firstEightValues.every(function (value) {
    return String(value || '').trim() === '';
  });
}

function isTimelineColumnEmpty_(displayValues, columnIndex) {
  for (var rowIndex = 2; rowIndex < displayValues.length; rowIndex += 1) {
    if (String(displayValues[rowIndex][columnIndex] || '').trim()) {
      return false;
    }
  }
  return true;
}

function getMemberRowMapByName_(sheet) {
  var data = readMembersTable_(sheet);
  var nameIndex = data.headers.indexOf('Name');
  var map = {};
  data.rows.forEach(function (row, index) {
    var name = String(row[nameIndex] || '').trim().toLowerCase();
    if (name && !map[name]) {
      map[name] = data.firstDataRow + index;
    }
  });
  return map;
}

function findMemberByName_(sheet, name) {
  var data = readMembersTable_(sheet);
  var nameIndex = data.headers.indexOf('Name');
  var normalizedName = String(name || '').trim().toLowerCase();
  for (var i = 0; i < data.rows.length; i += 1) {
    if (String(data.rows[i][nameIndex] || '').trim().toLowerCase() === normalizedName) {
      return {
        sheet: sheet,
        rowNumber: data.firstDataRow + i,
        headers: data.headers,
        row: data.rows[i]
      };
    }
  }
  return null;
}

function updateMemberFromHold_(memberInfo, status, reason) {
  var row = memberInfo.row.slice();
  setValueForHeader_(memberInfo.headers, row, 'Membership Status', status);
  setValueForHeader_(memberInfo.headers, row, 'Reason/Solution', reason);
  memberInfo.sheet.getRange(memberInfo.rowNumber, 1, 1, memberInfo.headers.length).setValues([row]);
  memberInfo.row = row;
}

function clearHoldRowsForMember_(sheet, name) {
  var normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    return;
  }

  ['green', 'yellow'].forEach(function (holdType) {
    var section = findHoldSection_(sheet, holdType);
    var startRow = section.headerRow + 1;
    var endRow = section.nextHeaderRow ? section.nextHeaderRow - 1 : sheet.getLastRow();
    if (endRow < startRow) {
      return;
    }

    var rowCount = endRow - startRow + 1;
    var values = sheet.getRange(startRow, 1, rowCount, 1).getValues();
    values.forEach(function (row, index) {
      if (String(row[0] || '').trim().toLowerCase() === normalizedName) {
        clearHoldRow_(sheet, startRow + index);
      }
    });
  });
}

function clearUpcomingHoldRowsForMember_(sheet, name) {
  var normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    return;
  }

  var headers = ensureUpcomingHoldHeaders_(sheet);
  var nameIndex = headers.indexOf('Name');
  if (nameIndex === -1 || sheet.getLastRow() < 2) {
    return;
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][nameIndex] || '').trim().toLowerCase() === normalizedName) {
      sheet.deleteRow(index + 2);
    }
  }
}

function setCancellationRowStatus_(sheet, rowNumber, status) {
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    return;
  }

  var headers = getSheetHeaderRow_(sheet, 1);
  var statusIndex = headers.indexOf('Membership Status');
  if (statusIndex === -1) {
    return;
  }

  sheet.getRange(rowNumber, statusIndex + 1).setValue(status);
}

function clearHoldRow_(sheet, rowNumber) {
  sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), 8)).clearContent();
}

function readMembersTable_(sheet) {
  var headers = getHeaderRow_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return {
      headers: headers,
      rows: [],
      firstDataRow: 2
    };
  }

  return {
    headers: headers,
    rows: sheet.getRange(2, 1, lastRow - 1, headers.length).getValues(),
    firstDataRow: 2
  };
}

function getHeaderRow_(sheet) {
  var headers = getSheetHeaderRow_(sheet, MEMBER_HEADERS.length);
  assertRequiredHeaders_(headers);
  return headers;
}

function getSheetHeaderRow_(sheet, minimumColumnCount) {
  var lastColumn = Math.max(sheet.getLastColumn(), minimumColumnCount || 1);
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (header) {
    return String(header || '').trim();
  });
}

function assertRequiredHeaders_(headers) {
  var missingHeaders = [];
  MEMBER_HEADERS.forEach(function (headerName) {
    if (headers.indexOf(headerName) === -1) {
      missingHeaders.push(headerName);
    }
  });
  if (missingHeaders.length) {
    notifyAppIssue_(
      'Flexx Staff Members header issue',
      'The Members sheet is missing required header(s): ' + missingHeaders.join(', ') + '. Found headers: ' + headers.join(', ')
    );
    throw new Error('Sheet setup issue: Members is missing required header(s): ' + missingHeaders.join(', ') + '. This has been logged for repair.');
  }
}

function validateMemberRow_(sheet, rowNumber) {
  if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('Member row not found.');
  }
}

function parseMemberRowNumber_(memberId) {
  var rowNumber = Number(memberId);
  if (!rowNumber || Math.floor(rowNumber) !== rowNumber || rowNumber < 2) {
    throw new Error('Invalid member identifier.');
  }
  return rowNumber;
}

function incrementStatusSummary_(summary, status) {
  var normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'active') {
    summary.active += 1;
  } else if (normalizedStatus === 'green hold') {
    summary.greenHolds += 1;
  } else if (normalizedStatus === 'yellow hold') {
    summary.yellowHolds += 1;
  }
}

function getCurrentWeekBounds_() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var day = start.getDay();
  var daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);

  var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return {
    start: start,
    end: end
  };
}

function isDateInBounds_(value, bounds) {
  var date = normalizeDateValue_(value);
  if (!date) {
    return false;
  }
  return date >= bounds.start && date < bounds.end;
}

function isFutureDate_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target > today;
}

function normalizeDateValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function valueForHeader_(headers, row, headerName) {
  var index = headers.indexOf(headerName);
  return index > -1 ? row[index] : '';
}

function setValueForHeader_(headers, row, headerName, value) {
  var index = headers.indexOf(headerName);
  if (index > -1) {
    row[index] = value;
  }
}

function formatMemberUpdateValue_(fieldName, value) {
  if (fieldName === 'Start Date') {
    return parseIsoDate_(value) || value;
  }
  if (fieldName === 'Recurring') {
    return value === true || String(value).toLowerCase() === 'true';
  }
  return value;
}

function parseIsoDate_(value) {
  var raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return raw;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

function parseHoldReturnDate_(value) {
  var raw = String(value || '').trim();
  if (!raw || raw === '-') {
    return raw || '';
  }
  return parseIsoDate_(raw);
}

function parseHoldOptionalDate_(value) {
  var raw = String(value || '').trim();
  if (!raw || raw === '-') {
    return raw || '';
  }
  return parseIsoDate_(raw);
}

function calculateHoldType_(startDate, returnDate) {
  if (!(returnDate instanceof Date) || isNaN(returnDate.getTime())) {
    return 'yellow';
  }
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    return 'yellow';
  }

  var days = Math.round((returnDate.getTime() - startDate.getTime()) / 86400000);
  return days >= 28 ? 'yellow' : 'green';
}

function addDays_(date, days) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  var result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

function getCellDisplay_(value) {
  return value === null || typeof value === 'undefined' ? '' : String(formatClientValue_(value));
}

function getNameSearchScore_(name, searchTerm) {
  var normalizedSearch = String(searchTerm || '').trim().toLowerCase();
  if (!normalizedSearch) {
    return null;
  }

  var haystacks = getNameSearchHaystacks_(name);
  var bestScore = null;
  haystacks.forEach(function (haystack) {
    var score = null;
    var index = haystack.indexOf(normalizedSearch);
    if (haystack === normalizedSearch) {
      score = 0;
    } else if (index === 0) {
      score = 1;
    } else if (index > -1) {
      score = 2 + (index / 100);
    } else {
      var parts = haystack.split(/\s+/);
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i].indexOf(normalizedSearch) === 0) {
          score = 3 + (i / 100);
          break;
        }
      }
    }

    if (score !== null && (bestScore === null || score < bestScore)) {
      bestScore = score;
    }
  });

  return bestScore;
}

function getNameSearchHaystacks_(name) {
  var raw = String(name || '').trim().toLowerCase();
  if (!raw) {
    return [];
  }

  var haystacks = [
    raw.replace(/\s+/g, ' '),
    raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
  ];
  var commaParts = raw.split(',').map(function (part) {
    return part.trim();
  }).filter(function (part) {
    return part;
  });
  if (commaParts.length > 1) {
    haystacks.push((commaParts.slice(1).join(' ') + ' ' + commaParts[0]).replace(/\s+/g, ' ').trim());
  }

  return haystacks.filter(function (haystack, index) {
    return haystack && haystacks.indexOf(haystack) === index;
  });
}

function buildNewMemberNotes_(isTrial, trialDate, notes) {
  var noteText = String(notes || '').trim();
  if (!isTrial) {
    return noteText;
  }

  var trialText = trialDate instanceof Date && !isNaN(trialDate.getTime())
    ? 'End of trial, ' + Utilities.formatDate(trialDate, Session.getScriptTimeZone(), 'MM/dd/yyyy') + '.'
    : 'Trial period.';
  return noteText ? trialText + ' ' + noteText : trialText;
}

function columnIndexToLetter_(columnIndex) {
  var letter = '';
  var index = Number(columnIndex);
  while (index > 0) {
    var remainder = (index - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    index = Math.floor((index - remainder) / 26);
  }
  return letter;
}

function formatClientValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }
  return value === null || typeof value === 'undefined' ? '' : value;
}

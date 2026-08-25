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

var MEMBER_OPTIONAL_HEADERS = [
  MEMBER_ID_HEADER
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

var MEMBER_WATCHLIST_HEADERS = [
  'Name',
  'Monday Text',
  'Wednesday Text',
  'Additional Information',
  'On schedule?'
];

var DATA_METRIC_ROWS = [
  'Total Members',
  'Weekly Net',
  'Net Active Members',
  'Total Yellow Holds',
  'Total Green Holds',
  'Total Sign-ups',
  'VIP Sign-ups',
  'Referral Sign-ups',
  'Reactivation Sign-ups',
  'New Cancellations',
  'Total Referrals (this quarter)',
  'Instagram Posts',
  'Estimated Monthly Revenue (not considering Holds)',
  '4 Week Rolling Attrition',
  'Monthly Attrition'
];

function getDashboardData(locationKey) {
  if (resolveLocationKey_(locationKey) === 'master') {
    return getMasterDashboardData_();
  }

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
    cancelsThisWeek: 0,
    weeklyNet: 0
  };
  var currentWeek = getCurrentWeekBounds_();

  rows.forEach(function (row) {
    incrementStatusSummary_(summary, getCellDisplay_(row[statusIndex]));
  });

  summary.cancelsThisWeek = getCancellationsThisWeek_(location.key, currentWeek);
  summary.weeklyNet = getSignupsThisWeek_(headers, rows, currentWeek) - summary.cancelsThisWeek;

  return {
    location: {
      key: location.key,
      name: location.name
    },
    summary: summary,
    memberTable: buildDashboardMemberTable_(headers, rows, data.firstDataRow)
  };
}

function getMasterDashboardData_() {
  var currentWeek = getCurrentWeekBounds_();
  var totals = {
    active: 0,
    greenHolds: 0,
    yellowHolds: 0,
    cancelsThisWeek: 0,
    weeklyNet: 0
  };

  var rows = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
    var location = getLocationConfig_(locationKey);
    var sheet = getMembersSheet_(location.key);
    var data = readMembersTable_(sheet);
    var statusIndex = data.headers.indexOf('Membership Status');
    var summary = {
      active: 0,
      greenHolds: 0,
      yellowHolds: 0,
      cancelsThisWeek: getCancellationsThisWeek_(location.key, currentWeek),
      weeklyNet: 0
    };

    data.rows.forEach(function (row) {
      incrementStatusSummary_(summary, getCellDisplay_(row[statusIndex]));
    });
    summary.weeklyNet = getSignupsThisWeek_(data.headers, data.rows, currentWeek) - summary.cancelsThisWeek;

    totals.active += summary.active;
    totals.greenHolds += summary.greenHolds;
    totals.yellowHolds += summary.yellowHolds;
    totals.cancelsThisWeek += summary.cancelsThisWeek;
    totals.weeklyNet += summary.weeklyNet;

    return {
      locationKey: location.key,
      locationName: location.name,
      activeMembers: summary.active + summary.greenHolds,
      greenHolds: summary.greenHolds,
      yellowHolds: summary.yellowHolds,
      cancelsThisWeek: summary.cancelsThisWeek,
      weeklyNet: summary.weeklyNet
    };
  });

  return {
    master: true,
    location: {
      key: 'master',
      name: 'Master'
    },
    summary: totals,
    snapshotRows: rows,
    memberTable: {
      columns: [],
      defaultVisibleColumns: [],
      rows: []
    }
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

  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    var name = getCellDisplay_(row[nameIndex]);
    var score = getNameSearchScore_(name, searchTerm);
    if (score === null) {
      continue;
    }
    results.push({
      memberId: data.firstDataRow + i,
      name: name,
      membershipStatus: getCellDisplay_(row[statusIndex]),
      score: score
    });
  }

  return results.sort(function (left, right) {
    if (left.score !== right.score) {
      return left.score - right.score;
    }
    return String(left.name || '').localeCompare(String(right.name || ''));
  }).slice(0, 10).map(function (result) {
    delete result.score;
    return result;
  });
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
    var isTrial = Boolean(form && form.trial);
    var notes = buildNewMemberNotes_(isTrial, trialDate, form && form.notes);
    var referral = Boolean(form && form.referral);
    var pricePoint = String(form && form.pricePoint || '').trim();

    setValueForHeader_(headers, row, MEMBER_ID_HEADER, createMemberId_(resolvedLocationKey));
    setValueForHeader_(headers, row, 'Name', formattedName);
    setValueForHeader_(headers, row, 'Membership Status', isTrial ? 'Trial' : 'Active');
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
      newStatus: valueForHeader_(headers, row, 'Membership Status'),
      newDaysPerWeek: valueForHeader_(headers, row, 'Days Per Week'),
      newNotes: notes
    });

    return getMember(resolvedLocationKey, rowNumber);
  } finally {
    lock.releaseLock();
  }
}

function backfillMemberIdsForAllLocations() {
  try {
    var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
      return {
        members: backfillMemberIdsForLocation_(locationKey),
        cancellations: backfillCancellationMemberIdsForLocation_(locationKey)
      };
    });
    console.log('backfillMemberIdsForAllLocations results: ' + JSON.stringify(results));
    return results;
  } catch (error) {
    notifyAppIssue_('Flexx Staff Member ID backfill failed', error.stack || error.message || String(error));
    throw error;
  }
}

function backfillMemberIdsForDefaultLocation() {
  try {
    var result = {
      members: backfillMemberIdsForLocation_(FLEXX_CONFIG.defaultLocationKey),
      cancellations: backfillCancellationMemberIdsForLocation_(FLEXX_CONFIG.defaultLocationKey)
    };
    console.log('backfillMemberIdsForDefaultLocation result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    notifyAppIssue_('Flexx Staff Member ID backfill failed', error.stack || error.message || String(error));
    throw error;
  }
}

function validateAllLocationSheets() {
  try {
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
    console.log('validateAllLocationSheets results: ' + JSON.stringify(results));
    return results;
  } catch (error) {
    notifyAppIssue_('Flexx Staff validation failed', error.stack || error.message || String(error));
    throw error;
  }
}

function promoteUpcomingHoldsForAllLocations() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
      return promoteUpcomingHoldsForLocation_(locationKey);
    });
    console.log('promoteUpcomingHoldsForAllLocations results: ' + JSON.stringify(results));
    return results;
  } catch (error) {
    notifyAppIssue_('Flexx Staff upcoming hold promotion failed', error.stack || error.message || String(error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function getMemberWatchlistData(locationKey) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  if (resolvedLocationKey === 'master') {
    throw new Error('Select a location to view the member watchlist.');
  }

  var location = getLocationConfig_(resolvedLocationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var sheet = getRequiredSheet_(spreadsheet, location.sheets.memberWatchlist || 'Member Watchlist', 'Member Watchlist');
  var headers = ensureMemberWatchlistHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  var rows = [];

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    values.forEach(function (row, index) {
      var isEmpty = row.every(function (value) {
        return String(value === null || typeof value === 'undefined' ? '' : value).trim() === '';
      });
      if (isEmpty) {
        return;
      }

      var fields = {};
      headers.forEach(function (header, headerIndex) {
        fields[header] = formatClientValue_(row[headerIndex]);
      });
      rows.push({
        rowNumber: index + 2,
        fields: fields
      });
    });
  }

  return {
    locationName: location.name,
    columns: headers,
    rows: rows
  };
}

function updateMemberWatchlistEntry(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  if (resolvedLocationKey === 'master') {
    throw new Error('Select a location before editing the watchlist.');
  }

  var rowNumber = Number(payload && payload.rowNumber);
  if (!rowNumber || Math.floor(rowNumber) !== rowNumber || rowNumber < 2) {
    throw new Error('Watchlist row not found.');
  }

  var fields = payload && payload.fields ? payload.fields : {};
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var sheet = getRequiredSheet_(spreadsheet, location.sheets.memberWatchlist || 'Member Watchlist', 'Member Watchlist');
    var headers = ensureMemberWatchlistHeaders_(sheet);
    if (rowNumber > Math.max(sheet.getLastRow(), 1)) {
      throw new Error('Watchlist row not found.');
    }

    Object.keys(fields).forEach(function (fieldName) {
      var index = headers.indexOf(fieldName);
      if (index === -1) {
        return;
      }
      sheet.getRange(rowNumber, index + 1).setValue(formatMemberWatchlistValue_(fieldName, fields[fieldName]));
    });
    SpreadsheetApp.flush();

    return getMemberWatchlistData(resolvedLocationKey);
  } finally {
    lock.releaseLock();
  }
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
  if (payload && payload.cancellationRowNumber && !(payload && payload.memberId)) {
    return reactivateCancellationMember(locationKey, payload);
  }
  var rowNumber = parseMemberRowNumber_(payload && payload.memberId);
  var status = String(payload && payload.status || '').trim();
  if (status !== 'Active' && status !== 'Trial') {
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
    if ((status === 'Active' || status === 'Trial') && (oldStatus === 'Cancel' || (payload && payload.reactivate === true))) {
      setValueForHeader_(headers, row, 'Reactivation', true);
      setValueForHeader_(headers, row, 'Created Date', new Date());
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

    ensureMemberIdColumn_(membersSheet);
    var headers = getHeaderRow_(membersSheet);
    var rowRange = membersSheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();

    setValueForHeader_(headers, row, 'Membership Status', 'Cancel');
    if (reason) {
      setValueForHeader_(headers, row, 'Reason/Solution', reason);
    }
    rowRange.setValues([row]);

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: membersSheet.getName(),
      rowNumber: rowNumber,
      oldStatus: valueForHeader_(headers, before, 'Membership Status'),
      newStatus: 'Cancel',
      cancelReason: reason,
      cancelDate: cancelDate
    });

    appendCancellationRow_(cancellationsSheet, headers, row, reason, solution, cancelDate);
    membersSheet.deleteRow(rowNumber);
    SpreadsheetApp.flush();

    return {
      memberId: null,
      fields: buildMemberFieldsFromRow_(headers, row),
      editableFields: [],
      lockedFields: MEMBER_HEADERS.slice()
    };
  } finally {
    lock.releaseLock();
  }
}

function reactivateCancellationMember(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var cancellationRowNumber = Number(payload && payload.cancellationRowNumber);
  var status = String(payload && payload.status || '').trim();
  if (status !== 'Active' && status !== 'Trial') {
    throw new Error('Cancelled members can only be reactivated as Active or Trial.');
  }
  if (!cancellationRowNumber || Math.floor(cancellationRowNumber) !== cancellationRowNumber || cancellationRowNumber < 2) {
    throw new Error('Cancellation row not found.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    if (cancellationRowNumber > cancellationsSheet.getLastRow()) {
      throw new Error('Cancellation row not found.');
    }

    ensureMemberIdColumn_(membersSheet);
    var memberHeaders = getHeaderRow_(membersSheet);
    var cancellationHeaders = getSheetHeaderRow_(cancellationsSheet, 1);
    var cancellationRow = cancellationsSheet.getRange(cancellationRowNumber, 1, 1, cancellationHeaders.length).getValues()[0];
    var existingMember = findMemberFromCancellationRow_(membersSheet, cancellationHeaders, cancellationRow);
    var rowNumber = existingMember ? existingMember.rowNumber : 2;
    var before = existingMember ? existingMember.row.slice() : null;
    var row = existingMember ? existingMember.row.slice() : buildMemberRowFromCancellation_(memberHeaders, cancellationHeaders, cancellationRow, resolvedLocationKey);

    setValueForHeader_(memberHeaders, row, 'Membership Status', status);
    setValueForHeader_(memberHeaders, row, 'Reactivation', true);
    setValueForHeader_(memberHeaders, row, 'Created Date', new Date());
    if (!String(valueForHeader_(memberHeaders, row, MEMBER_ID_HEADER) || '').trim()) {
      setValueForHeader_(memberHeaders, row, MEMBER_ID_HEADER, createMemberId_(resolvedLocationKey));
    }

    if (existingMember) {
      membersSheet.getRange(rowNumber, 1, 1, memberHeaders.length).setValues([row]);
    } else {
      membersSheet.insertRowBefore(rowNumber);
      membersSheet.getRange(rowNumber, 1, 1, memberHeaders.length).setValues([row]);
    }

    setCancellationRowStatus_(cancellationsSheet, cancellationRowNumber, status);
    SpreadsheetApp.flush();

    runMemberUpdateHooks_({
      locationKey: resolvedLocationKey,
      sheet: membersSheet.getName(),
      rowNumber: rowNumber,
      oldStatus: before ? valueForHeader_(memberHeaders, before, 'Membership Status') : 'Cancel',
      newStatus: status,
      oldDaysPerWeek: before ? valueForHeader_(memberHeaders, before, 'Days Per Week') : '',
      newDaysPerWeek: valueForHeader_(memberHeaders, row, 'Days Per Week'),
      oldNotes: before ? valueForHeader_(memberHeaders, before, 'Notes') : '',
      newNotes: valueForHeader_(memberHeaders, row, 'Notes')
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

function updateCancellationEntry(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var rowNumber = Number(payload && payload.rowNumber);
  var updatedFields = payload && payload.fields ? payload.fields : {};
  var allowedFields = ['Reason', 'Solution', 'Last Contact', 'Stay in contact'];
  if (!rowNumber || rowNumber < 2) {
    throw new Error('Invalid cancellation row.');
  }
  if (!Object.keys(updatedFields).length) {
    throw new Error('No cancellation fields to update.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(resolvedLocationKey);
    var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    var headers = getSheetHeaderRow_(cancellationsSheet, 1).filter(function (header) {
      return header;
    });
    if (rowNumber > cancellationsSheet.getLastRow()) {
      throw new Error('Cancellation row not found.');
    }

    Object.keys(updatedFields).forEach(function (fieldName) {
      if (allowedFields.indexOf(fieldName) === -1) {
        throw new Error('Cancellation field cannot be edited here: ' + fieldName);
      }
      var fieldIndex = headers.indexOf(fieldName);
      if (fieldIndex === -1) {
        throw new Error('Cancellations sheet is missing the ' + fieldName + ' header.');
      }
      cancellationsSheet.getRange(rowNumber, fieldIndex + 1).setValue(formatCancellationUpdateValue_(fieldName, updatedFields[fieldName]));
    });
    SpreadsheetApp.flush();

    var values = cancellationsSheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    var resultFields = {};
    headers.forEach(function (header, columnIndex) {
      resultFields[header] = formatClientValue_(values[columnIndex]);
    });

    return {
      rowNumber: rowNumber,
      fields: resultFields
    };
  } finally {
    lock.releaseLock();
  }
}

function backfillCancellationMemberIdsForAllLocations() {
  try {
    var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
      return backfillCancellationMemberIdsForLocation_(locationKey);
    });
    console.log('backfillCancellationMemberIdsForAllLocations results: ' + JSON.stringify(results));
    return results;
  } catch (error) {
    notifyAppIssue_('Flexx Staff cancellation Member ID backfill failed', error.stack || error.message || String(error));
    throw error;
  }
}

function backfillCancellationMemberIdsForDefaultLocation() {
  try {
    var result = backfillCancellationMemberIdsForLocation_(FLEXX_CONFIG.defaultLocationKey);
    console.log('backfillCancellationMemberIdsForDefaultLocation result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    notifyAppIssue_('Flexx Staff cancellation Member ID backfill failed', error.stack || error.message || String(error));
    throw error;
  }
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

function updateWeeklyDataSnapshotsForAllLocations() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var results = FLEXX_CONFIG.getLocationKeys().map(function (locationKey) {
      return updateWeeklyDataSnapshotForLocation_(locationKey, getCurrentWeekBounds_());
    });
    console.log('updateWeeklyDataSnapshotsForAllLocations results: ' + JSON.stringify(results));
    return results;
  } catch (error) {
    notifyAppIssue_('Flexx Staff weekly data snapshot failed', error.stack || error.message || String(error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function updateWeeklyDataSnapshotForDefaultLocation() {
  var result = updateWeeklyDataSnapshotForLocation_(FLEXX_CONFIG.defaultLocationKey, getCurrentWeekBounds_());
  console.log('updateWeeklyDataSnapshotForDefaultLocation result: ' + JSON.stringify(result));
  return result;
}

function updateWeeklyDataSnapshotForLocation_(locationKey, weekBounds) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var dataSheet = getRequiredSheet_(spreadsheet, location.sheets.data || 'Dashboard', 'Data');
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
  var membersData = readMembersTable_(membersSheet);
  var previousTotalMembers = getPreviousSnapshotNumber_(dataSheet, 'Total Members', weekBounds.start);
  var metrics = calculateWeeklyDataMetrics_(membersData.headers, membersData.rows, cancellationsSheet, weekBounds, previousTotalMembers, dataSheet);
  writeWeeklyDataSnapshot_(dataSheet, location.name, weekBounds, metrics);

  return {
    location: location.name,
    week: formatDataDateLabel_(weekBounds.start) + '-' + formatDataDateLabel_(addDays_(weekBounds.end, -1)),
    totalMembers: metrics['Total Members'],
    weeklyNet: metrics['Weekly Net']
  };
}

function calculateWeeklyDataMetrics_(memberHeaders, memberRows, cancellationsSheet, weekBounds, previousTotalMembers, dataSheet) {
  var statusIndex = memberHeaders.indexOf('Membership Status');
  var createdIndex = memberHeaders.indexOf('Created Date');
  var referralIndex = memberHeaders.indexOf('Referral');
  var reactivationIndex = memberHeaders.indexOf('Reactivation');
  var priceIndex = memberHeaders.indexOf('Price Point');
  var paymentIndex = memberHeaders.indexOf('Payment Option');
  var totals = {
    active: 0,
    greenHolds: 0,
    yellowHolds: 0,
    vipSignups: 0,
    referralSignups: 0,
    reactivationSignups: 0,
    revenue: 0
  };

  memberRows.forEach(function (row) {
    var status = String(getCellDisplay_(row[statusIndex]) || '').trim().toLowerCase();
    var createdDate = createdIndex > -1 ? row[createdIndex] : '';
    var isCreatedThisWeek = isDateInBounds_(createdDate, weekBounds);
    var isReferral = referralIndex > -1 && isTruthyCell_(row[referralIndex]);
    var isReactivation = reactivationIndex > -1 && isTruthyCell_(row[reactivationIndex]);

    if (status === 'active') {
      totals.active += 1;
      totals.revenue += getMonthlyRevenueValue_(row[priceIndex], row[paymentIndex]);
    } else if (status === 'green hold') {
      totals.greenHolds += 1;
    } else if (status === 'yellow hold') {
      totals.yellowHolds += 1;
    }

    if (isCreatedThisWeek) {
      if (isReactivation) {
        totals.reactivationSignups += 1;
      } else if (isReferral) {
        totals.referralSignups += 1;
      } else {
        totals.vipSignups += 1;
      }
    }
  });

  var totalMembers = totals.active + totals.greenHolds + totals.yellowHolds;
  var newCancellations = countCancellationsInBounds_(cancellationsSheet, weekBounds);
  var fourWeekStart = new Date(weekBounds.start.getFullYear(), weekBounds.start.getMonth(), weekBounds.start.getDate() - 21);
  var fourWeekBounds = { start: fourWeekStart, end: weekBounds.end };
  var fourWeekCancels = countCancellationsInBounds_(cancellationsSheet, fourWeekBounds);
  var fourWeekBase = getSnapshotNumberAtOrBefore_(dataSheet, 'Total Members', fourWeekStart) || previousTotalMembers || totalMembers;
  var monthBounds = getMonthBounds_(weekBounds.start);
  var monthCancels = countCancellationsInBounds_(cancellationsSheet, monthBounds);
  var monthBase = getSnapshotNumberAtOrBefore_(dataSheet, 'Total Members', monthBounds.start) || totalMembers;
  var quarterReferrals = countMemberRowsInBounds_(memberHeaders, memberRows, 'Created Date', getQuarterBounds_(weekBounds.start), function (row) {
    return referralIndex > -1 && isTruthyCell_(row[referralIndex]);
  });
  var instagramPosts = getCurrentSnapshotValue_(dataSheet, 'Instagram Posts', weekBounds.start);

  return {
    'Total Members': totalMembers,
    'Weekly Net': typeof previousTotalMembers === 'number' ? totalMembers - previousTotalMembers : 0,
    'Net Active Members': totals.active,
    'Total Yellow Holds': totals.yellowHolds,
    'Total Green Holds': totals.greenHolds,
    'Total Sign-ups': totals.vipSignups + totals.referralSignups + totals.reactivationSignups,
    'VIP Sign-ups': totals.vipSignups,
    'Referral Sign-ups': totals.referralSignups,
    'Reactivation Sign-ups': totals.reactivationSignups,
    'New Cancellations': newCancellations,
    'Total Referrals (this quarter)': quarterReferrals,
    'Instagram Posts': instagramPosts || 0,
    'Estimated Monthly Revenue (not considering Holds)': Math.round(totals.revenue),
    '4 Week Rolling Attrition': fourWeekBase ? fourWeekCancels / fourWeekBase : 0,
    'Monthly Attrition': monthBase ? monthCancels / monthBase : 0
  };
}

function writeWeeklyDataSnapshot_(sheet, locationName, weekBounds, metrics) {
  ensureDataTimelineLayout_(sheet, locationName);
  var targetColumn = ensureDataWeekColumn_(sheet, weekBounds);
  DATA_METRIC_ROWS.forEach(function (metricName, index) {
    var rowNumber = index + 3;
    sheet.getRange(rowNumber, targetColumn).setValue(metrics[metricName]);
  });
  formatDataTimelineSheet_(sheet, targetColumn);
}

function ensureDataTimelineLayout_(sheet, locationName) {
  var requiredRows = DATA_METRIC_ROWS.length + 2;
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < 4) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 4 - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, 3).setValues([['', '', '']]);
  sheet.getRange(2, 1, 1, 3).setValues([[locationName, 'Goal', 'Average']]);
  DATA_METRIC_ROWS.forEach(function (metricName, index) {
    sheet.getRange(index + 3, 1).setValue(metricName);
  });
}

function ensureDataWeekColumn_(sheet, weekBounds) {
  var startLabel = formatDataDateLabel_(weekBounds.start);
  var endLabel = formatDataDateLabel_(addDays_(weekBounds.end, -1));
  var lastColumn = Math.max(sheet.getLastColumn(), 4);
  var headers = sheet.getRange(1, 1, 2, lastColumn).getDisplayValues();

  for (var column = 4; column <= lastColumn; column += 1) {
    if (String(headers[0][column - 1] || '').trim() === startLabel) {
      sheet.getRange(2, column).setValue(endLabel);
      return column;
    }
  }

  sheet.insertColumnBefore(4);
  sheet.getRange(1, 4).setValue(startLabel);
  sheet.getRange(2, 4).setValue(endLabel);
  return 4;
}

function formatDataTimelineSheet_(sheet, currentColumn) {
  var rows = DATA_METRIC_ROWS.length + 2;
  var columns = Math.max(sheet.getLastColumn(), currentColumn);
  sheet.getRange(1, 1, 2, columns).setFontWeight('bold').setBackground('#c9ced6');
  sheet.getRange(2, 1).setFontSize(18).setBackground('#5a83e6');
  sheet.getRange(1, 1, rows, columns).setBorder(true, true, true, true, true, true);
  sheet.getRange(3, 1, DATA_METRIC_ROWS.length, 1).setFontWeight('bold');
  sheet.getRange(3, currentColumn, DATA_METRIC_ROWS.length, 1).setNumberFormat('0.##');
  setMetricNumberFormat_(sheet, 'Estimated Monthly Revenue (not considering Holds)', currentColumn, '$#,##0');
  setMetricNumberFormat_(sheet, '4 Week Rolling Attrition', currentColumn, '0.00%');
  setMetricNumberFormat_(sheet, 'Monthly Attrition', currentColumn, '0.00%');
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(1);
}

function setMetricNumberFormat_(sheet, metricName, column, format) {
  var row = DATA_METRIC_ROWS.indexOf(metricName) + 3;
  if (row >= 3) {
    sheet.getRange(row, column).setNumberFormat(format);
  }
}

function getPreviousSnapshotNumber_(sheet, metricName, currentWeekStart) {
  var currentLabel = formatDataDateLabel_(currentWeekStart);
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 4) {
    return null;
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var metricRow = findDataMetricRow_(sheet, metricName);
  if (!metricRow) {
    return null;
  }
  for (var column = 4; column <= lastColumn; column += 1) {
    var label = String(headers[column - 1] || '').trim();
    if (label && label !== currentLabel) {
      var value = Number(sheet.getRange(metricRow, column).getValue());
      return isNaN(value) ? null : value;
    }
  }
  return null;
}

function getSnapshotNumberAtOrBefore_(sheet, metricName, targetDate) {
  var lastColumn = sheet.getLastColumn();
  var metricRow = findDataMetricRow_(sheet, metricName);
  if (!metricRow || lastColumn < 4) {
    return null;
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var best = null;
  for (var column = 4; column <= lastColumn; column += 1) {
    var date = parseDataDateLabel_(headers[column - 1], targetDate.getFullYear());
    if (!date || date > targetDate) {
      continue;
    }
    var value = Number(sheet.getRange(metricRow, column).getValue());
    if (!isNaN(value) && (!best || date > best.date)) {
      best = { date: date, value: value };
    }
  }
  return best ? best.value : null;
}

function getCurrentSnapshotValue_(sheet, metricName, currentWeekStart) {
  var currentLabel = formatDataDateLabel_(currentWeekStart);
  var metricRow = findDataMetricRow_(sheet, metricName);
  var lastColumn = sheet.getLastColumn();
  if (!metricRow || lastColumn < 4) {
    return '';
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  for (var column = 4; column <= lastColumn; column += 1) {
    if (String(headers[column - 1] || '').trim() === currentLabel) {
      return sheet.getRange(metricRow, column).getValue();
    }
  }
  return '';
}

function findDataMetricRow_(sheet, metricName) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    return null;
  }
  var values = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || '').trim() === metricName) {
      return index + 3;
    }
  }
  return null;
}

function updateDataTimelineMetric(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var metric = String(payload && payload.metric || '').trim();
  var periodLabel = String(payload && payload.periodLabel || '').trim();
  var value = payload && Object.prototype.hasOwnProperty.call(payload, 'value') ? payload.value : '';
  if (metric !== 'Instagram Posts') {
    throw new Error('Only Instagram Posts can be edited here.');
  }
  if (!periodLabel) {
    throw new Error('Missing week column.');
  }

  var location = getLocationConfig_(resolvedLocationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var sheet = getRequiredSheet_(spreadsheet, location.sheets.data || 'Dashboard', 'Data');
  var rowNumber = findDataMetricRow_(sheet, metric);
  var column = findDataPeriodColumn_(sheet, periodLabel);
  if (!rowNumber || !column) {
    throw new Error('Could not find the Instagram Posts cell.');
  }
  var normalizedValue = String(value || '').trim() === '' ? '' : Number(value);
  if (normalizedValue !== '' && isNaN(normalizedValue)) {
    throw new Error('Instagram Posts must be a number.');
  }
  sheet.getRange(rowNumber, column).setValue(normalizedValue);
  SpreadsheetApp.flush();
  return getDataTimeline(resolvedLocationKey);
}

function findDataPeriodColumn_(sheet, periodLabel) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 4) {
    return null;
  }
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  for (var column = 4; column <= lastColumn; column += 1) {
    if (String(headers[column - 1] || '').trim() === periodLabel) {
      return column;
    }
  }
  return null;
}

function countMemberRowsInBounds_(headers, rows, dateHeader, bounds, predicate) {
  var dateIndex = headers.indexOf(dateHeader);
  if (dateIndex === -1) {
    return 0;
  }
  var count = 0;
  rows.forEach(function (row) {
    if (isDateInBounds_(row[dateIndex], bounds) && (!predicate || predicate(row))) {
      count += 1;
    }
  });
  return count;
}

function countCancellationsInBounds_(sheet, bounds) {
  var headers = getSheetHeaderRow_(sheet, 1);
  var cancelDateIndex = headers.indexOf('Cancel Date');
  var lastRow = sheet.getLastRow();
  if (cancelDateIndex === -1 || lastRow < 2) {
    return 0;
  }

  var values = sheet.getRange(2, cancelDateIndex + 1, lastRow - 1, 1).getValues();
  var count = 0;
  values.forEach(function (row) {
    if (isDateInBounds_(row[0], bounds)) {
      count += 1;
    }
  });
  return count;
}

function getMonthlyRevenueValue_(priceValue, paymentOption) {
  var price = Number(String(priceValue || '').replace(/[$,]/g, '').trim());
  if (isNaN(price) || price <= 0) {
    return 0;
  }
  var option = String(paymentOption || '').trim().toLowerCase();
  if (option === 'weekly') {
    return price * 52 / 12;
  }
  if (option === 'bi-weekly' || option === 'biweekly') {
    return price * 26 / 12;
  }
  return price;
}

function getQuarterBounds_(date) {
  var quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  var start = new Date(date.getFullYear(), quarterStartMonth, 1);
  var end = new Date(date.getFullYear(), quarterStartMonth + 3, 1);
  return { start: start, end: end };
}

function getMonthBounds_(date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
  };
}

function formatDataDateLabel_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d');
}

function parseDataDateLabel_(label, fallbackYear) {
  var raw = String(label || '').trim();
  if (!raw) {
    return null;
  }
  var parsed = new Date(raw + ' ' + fallbackYear);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isTruthyCell_(value) {
  if (value === true) {
    return true;
  }
  var normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === 'y';
}

function getAttendanceMemberMap_(memberRows) {
  var nameIndex = memberRows.headers.indexOf('Name');
  var statusIndex = memberRows.headers.indexOf('Membership Status');
  var daysIndex = memberRows.headers.indexOf('Days Per Week');
  var map = {};

  memberRows.rows.forEach(function (row, index) {
    var name = getCellDisplay_(row[nameIndex]).trim();
    if (!name) {
      return;
    }
    map[name.toLowerCase()] = {
      memberId: memberRows.firstDataRow + index,
      status: getCellDisplay_(row[statusIndex]),
      daysPerWeek: getCellDisplay_(row[daysIndex])
    };
  });

  return map;
}

function getAttendancePeriods_(rawHeaders, displayHeaders) {
  var periods = [];
  for (var columnIndex = 2; columnIndex < rawHeaders.length; columnIndex += 1) {
    var header = String(displayHeaders[columnIndex] || rawHeaders[columnIndex] || '').trim();
    var match = header.match(/^(.+)\s+Attended$/i);
    if (!match) {
      continue;
    }

    var label = match[1].trim();
    var expectedHeader = String(displayHeaders[columnIndex + 1] || rawHeaders[columnIndex + 1] || '').trim();
    var netHeader = String(displayHeaders[columnIndex + 2] || rawHeaders[columnIndex + 2] || '').trim();
    if (
      expectedHeader.toLowerCase() !== (label + ' Expected').toLowerCase() ||
      netHeader.toLowerCase() !== (label + ' Net').toLowerCase()
    ) {
      continue;
    }

    periods.push({
      label: label,
      attendedIndex: columnIndex,
      expectedIndex: columnIndex + 1,
      netIndex: columnIndex + 2
    });
    columnIndex += 2;
  }
  return periods;
}

function normalizeAttendanceNumber_(value) {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  var raw = String(value || '').trim();
  if (!raw) {
    return 0;
  }
  var parsed = Number(raw);
  return isNaN(parsed) ? 0 : parsed;
}

function getAttendanceWeekState_(attended, expected, net, status) {
  if (isHoldStatus_(status)) {
    return 'hold';
  }
  if (expected > 0 && attended === 0) {
    return 'no-show';
  }
  if (expected > 0 && attended < expected) {
    return 'missed';
  }
  return 'met';
}

function getAttendanceCategory_(status, weeks) {
  var current = weeks[0] || { attended: 0, expected: 0, net: 0 };
  var previous = weeks[1] || { net: 0 };
  if (current.expected > 0 && current.attended === 0) {
    return { key: 'no-show', label: 'No Show', order: 1 };
  }
  if (current.net < 0 && previous.net < 0) {
    return { key: 'two-week-miss', label: '2 Week Miss', order: 2 };
  }
  if (current.net < 0) {
    return { key: 'missed-this-week', label: 'Missed This Week', order: 3 };
  }
  if (isHoldStatus_(status) || current.state === 'hold') {
    return { key: 'on-hold', label: 'On Hold', order: 4 };
  }
  if (current.net > 0) {
    return { key: 'over-expected', label: 'Over Expected', order: 5 };
  }
  return { key: 'remaining', label: 'On Track', order: 6 };
}

function isHoldStatus_(status) {
  var normalized = String(status || '').trim().toLowerCase();
  return normalized === 'green hold' || normalized === 'yellow hold';
}

function getAttendanceData(locationKey) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  if (resolvedLocationKey === 'master') {
    throw new Error('Select a location to view attendance.');
  }

  var location = getLocationConfig_(resolvedLocationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var attendanceSheet = getRequiredSheet_(spreadsheet, location.sheets.attendance || 'Attendance', 'Attendance');
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var memberRows = readMembersTable_(membersSheet);
  var memberMap = getAttendanceMemberMap_(memberRows);
  var lastRow = attendanceSheet.getLastRow();
  var lastColumn = attendanceSheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 5) {
    return {
      locationName: location.name,
      periods: [],
      rows: []
    };
  }

  var rawHeaders = attendanceSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var displayHeaders = attendanceSheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var periods = getAttendancePeriods_(rawHeaders, displayHeaders).slice(0, 8);
  if (!periods.length) {
    return {
      locationName: location.name,
      periods: [],
      rows: []
    };
  }

  var values = attendanceSheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var displayValues = attendanceSheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  var rows = [];

  values.forEach(function (row, rowIndex) {
    var name = String(displayValues[rowIndex][0] || '').trim();
    if (!name) {
      return;
    }

    var memberInfo = memberMap[String(name).toLowerCase()] || {};
    var weeks = periods.map(function (period) {
      var attended = normalizeAttendanceNumber_(row[period.attendedIndex]);
      var expected = normalizeAttendanceNumber_(row[period.expectedIndex]);
      var net = normalizeAttendanceNumber_(row[period.netIndex]);
      if (row[period.netIndex] === '' || row[period.netIndex] === null || typeof row[period.netIndex] === 'undefined') {
        net = attended - expected;
      }
      return {
        label: period.label,
        attended: attended,
        expected: expected,
        net: net,
        state: getAttendanceWeekState_(attended, expected, net, memberInfo.status)
      };
    });
    var category = getAttendanceCategory_(memberInfo.status, weeks);

    rows.push({
      memberId: memberInfo.memberId || null,
      name: name,
      status: memberInfo.status || '',
      daysPerWeek: memberInfo.daysPerWeek || '',
      category: category.key,
      categoryLabel: category.label,
      sortOrder: category.order,
      weeks: weeks
    });
  });

  rows.sort(function (left, right) {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    var leftNet = left.weeks.length ? left.weeks[0].net : 0;
    var rightNet = right.weeks.length ? right.weeks[0].net : 0;
    if (leftNet !== rightNet) {
      return leftNet - rightNet;
    }
    return String(left.name || '').localeCompare(String(right.name || ''));
  });

  return {
    locationName: location.name,
    periods: periods.map(function (period) {
      return {
        label: period.label
      };
    }),
    rows: rows
  };
}

function updateHoldEntry(locationKey, payload) {
  var resolvedLocationKey = resolveLocationKey_(locationKey);
  var holdType = String(payload && payload.holdType || '').trim().toLowerCase();
  var rowNumber = Number(payload && payload.rowNumber);
  var fields = payload && payload.fields ? payload.fields : {};
  if ((!HOLD_STATUSES[holdType] && holdType !== 'upcoming') || !rowNumber) {
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
    var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
    if (holdType === 'upcoming') {
      return updateUpcomingHoldEntry_(upcomingHoldsSheet, rowNumber, fields, resolvedLocationKey);
    }
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

    if (requestedStatus === 'Active' || requestedStatus === 'Trial') {
      updateMemberFromHold_(memberInfo, requestedStatus, reason);
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
    movedColumn: idColumn.movedColumn,
    updatedRows: updatedRows
  };
}

function backfillCancellationMemberIdsForLocation_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');

  backfillMemberIdsForLocation_(location.key);
  var idColumn = ensureCancellationMemberIdColumn_(cancellationsSheet);
  var headers = getSheetHeaderRow_(cancellationsSheet, 1);
  var nameIndex = headers.indexOf('Name');
  var memberIdIndex = headers.indexOf(MEMBER_ID_HEADER);
  var lastRow = cancellationsSheet.getLastRow();
  if (lastRow < 2 || nameIndex === -1 || memberIdIndex === -1) {
    return {
      location: location.name,
      addedColumn: idColumn.addedColumn,
      movedColumn: idColumn.movedColumn,
      updatedRows: 0,
      unmatchedRows: 0
    };
  }

  var memberIdByName = getStableMemberIdMapByName_(membersSheet);
  var values = cancellationsSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var updatedRows = 0;
  var unmatchedRows = 0;
  values.forEach(function (row) {
    if (String(row[memberIdIndex] || '').trim()) {
      return;
    }

    var name = String(row[nameIndex] || '').trim().toLowerCase();
    if (name && memberIdByName[name]) {
      row[memberIdIndex] = memberIdByName[name];
    } else {
      row[memberIdIndex] = createCancellationMemberId_(location.key);
      unmatchedRows += 1;
    }
    updatedRows += 1;
  });

  if (updatedRows) {
    cancellationsSheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  return {
    location: location.name,
    addedColumn: idColumn.addedColumn,
    movedColumn: idColumn.movedColumn,
    updatedRows: updatedRows,
    unmatchedRows: unmatchedRows
  };
}

function validateLocationSheets_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var issues = [];

  validateSheetExists_(spreadsheet, location.sheets.members, location.name, 'Members', issues);
  validateSheetExists_(spreadsheet, location.sheets.attendance || 'Attendance', location.name, 'Attendance', issues);
  validateSheetExists_(spreadsheet, location.sheets.memberWatchlist || 'Member Watchlist', location.name, 'Member Watchlist', issues);
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

  var memberWatchlistSheet = spreadsheet.getSheetByName(location.sheets.memberWatchlist || 'Member Watchlist');
  if (memberWatchlistSheet) {
    var memberWatchlistHeaders = getSheetHeaderRow_(memberWatchlistSheet, MEMBER_WATCHLIST_HEADERS.length);
    MEMBER_WATCHLIST_HEADERS.forEach(function (header) {
      if (memberWatchlistHeaders.indexOf(header) === -1) {
        issues.push(location.name + ': Member Watchlist is missing header "' + header + '".');
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

function ensureMemberWatchlistHeaders_(sheet) {
  var headers = getSheetHeaderRow_(sheet, MEMBER_WATCHLIST_HEADERS.length).slice(0, MEMBER_WATCHLIST_HEADERS.length);
  var hasAnyHeader = headers.some(function (header) {
    return Boolean(header);
  });
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, MEMBER_WATCHLIST_HEADERS.length).setValues([MEMBER_WATCHLIST_HEADERS]);
    return MEMBER_WATCHLIST_HEADERS.slice();
  }

  var missingHeaders = MEMBER_WATCHLIST_HEADERS.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  if (missingHeaders.length) {
    notifyAppIssue_(
      'Flexx Staff Member Watchlist header issue',
      'The Member Watchlist sheet is missing required header(s): ' + missingHeaders.join(', ') + '. Found headers: ' + headers.join(', ')
    );
    throw new Error('Sheet setup issue: Member Watchlist is missing required header(s): ' + missingHeaders.join(', ') + '. This has been logged for repair.');
  }

  return headers;
}

function formatMemberWatchlistValue_(fieldName, value) {
  if (fieldName === 'Monday Text' || fieldName === 'Wednesday Text') {
    var textNormalized = String(value || '').trim().toLowerCase();
    if (textNormalized === 'yes' || textNormalized === 'y' || textNormalized === 'x' || textNormalized === 'true') {
      return 'Yes';
    }
    return 'No';
  }
  if (fieldName === 'On schedule?') {
    var normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'on') {
      return 'On';
    }
    if (normalized === 'off') {
      return 'Off';
    }
    return String(value || '').trim();
  }
  return String(value === null || typeof value === 'undefined' ? '' : value).trim();
}

function promoteUpcomingHoldsForLocation_(locationKey) {
  var location = getLocationConfig_(locationKey);
  var spreadsheet = SpreadsheetApp.openById(location.spreadsheetId);
  var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
  var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
  var upcomingSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
  var headers = ensureUpcomingHoldHeaders_(upcomingSheet);
  var lastRow = upcomingSheet.getLastRow();
  var promoted = 0;
  var skipped = 0;
  var issues = [];

  if (lastRow < 2) {
    return {
      location: location.name,
      promoted: 0,
      skipped: 0,
      issues: []
    };
  }

  var values = upcomingSheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var index = values.length - 1; index >= 0; index -= 1) {
    var sheetRow = index + 2;
    var row = values[index];
    if (row.every(function (value) { return String(value || '').trim() === ''; })) {
      skipped += 1;
      continue;
    }

    var name = String(valueForHeader_(headers, row, 'Name') || '').trim();
    var startDate = valueForHeader_(headers, row, 'Start Date');
    if (!isDateTodayOrPast_(startDate)) {
      skipped += 1;
      continue;
    }

    var memberInfo = findMemberByName_(membersSheet, name);
    if (!memberInfo) {
      issues.push(location.name + ': could not find member for upcoming hold "' + name + '".');
      continue;
    }

    var reason = valueForHeader_(headers, row, 'Reason');
    var returnDate = valueForHeader_(headers, row, 'Return Date?');
    var targetHoldType = calculateHoldType_(startDate, returnDate);
    var targetStatus = HOLD_STATUSES[targetHoldType];
    var endNurture = targetHoldType === 'yellow'
      ? valueForHeader_(headers, row, 'End of 6-week Nurture') || addDays_(startDate, 42)
      : '';
    var holdRow = [
      name,
      targetStatus,
      valueForHeader_(headers, row, 'Membership Age'),
      reason,
      startDate,
      valueForHeader_(headers, row, 'Next Contact'),
      returnDate,
      endNurture
    ];

    clearHoldRowsForMember_(holdsSheet, name);
    appendHoldRow_(holdsSheet, targetHoldType, holdRow);
    updateMemberFromHold_(memberInfo, targetStatus, reason);
    upcomingSheet.deleteRow(sheetRow);
    promoted += 1;
  }

  if (issues.length) {
    notifyAppIssue_('Flexx Staff upcoming hold promotion issue', issues.join('\n'));
  }
  SpreadsheetApp.flush();
  return {
    location: location.name,
    promoted: promoted,
    skipped: skipped,
    issues: issues
  };
}

function ensureMemberIdColumn_(sheet) {
  return ensureColumnAfterHeader_(sheet, MEMBER_ID_HEADER, 'Created Date');
}

function ensureCancellationMemberIdColumn_(sheet) {
  return ensureColumnAfterHeader_(sheet, MEMBER_ID_HEADER, 'Created Date');
}

function ensureColumnAfterHeader_(sheet, headerName, afterHeaderName) {
  var headers = getSheetHeaderRow_(sheet, MEMBER_HEADERS.length + MEMBER_OPTIONAL_HEADERS.length);
  var existingIndex = headers.indexOf(headerName);
  var createdDateIndex = headers.indexOf(afterHeaderName);
  var insertAfterColumn = createdDateIndex > -1 ? createdDateIndex + 1 : sheet.getLastColumn();
  if (existingIndex > -1) {
    if (existingIndex === createdDateIndex + 1) {
      return {
        index: existingIndex,
        addedColumn: false,
        movedColumn: false
      };
    }

    var lastRow = Math.max(sheet.getLastRow(), 1);
    var values = sheet.getRange(1, existingIndex + 1, lastRow, 1).getValues();
    sheet.insertColumnAfter(insertAfterColumn);
    sheet.getRange(1, insertAfterColumn + 1, lastRow, 1).setValues(values);
    sheet.deleteColumn(existingIndex > insertAfterColumn ? existingIndex + 2 : existingIndex + 1);
    return {
      index: existingIndex < insertAfterColumn ? insertAfterColumn - 1 : insertAfterColumn,
      addedColumn: false,
      movedColumn: true
    };
  }

  sheet.insertColumnAfter(insertAfterColumn);
  sheet.getRange(1, insertAfterColumn + 1).setValue(headerName);
  return {
    index: insertAfterColumn,
    addedColumn: true,
    movedColumn: false
  };
}

function createMemberId_(locationKey) {
  return String(locationKey || 'member') + '-' + Utilities.getUuid();
}

function createCancellationMemberId_(locationKey) {
  return String(locationKey || 'member') + '-cancel-' + Utilities.getUuid();
}

function getStableMemberIdMapByName_(sheet) {
  var idColumn = ensureMemberIdColumn_(sheet);
  var data = readMembersTable_(sheet);
  var nameIndex = data.headers.indexOf('Name');
  var memberIdIndex = data.headers.indexOf(MEMBER_ID_HEADER);
  var missingIds = 0;
  var idValues = [];
  var map = {};

  data.rows.forEach(function (row) {
    var memberId = String(row[memberIdIndex] || '').trim();
    if (!memberId) {
      memberId = createMemberId_(FLEXX_CONFIG.findLocationKeyBySpreadsheetId(sheet.getParent().getId()));
      missingIds += 1;
    }
    idValues.push([memberId]);
    var name = String(row[nameIndex] || '').trim().toLowerCase();
    if (name && !map[name]) {
      map[name] = memberId;
    }
  });

  if (missingIds && idValues.length) {
    sheet.getRange(data.firstDataRow, idColumn.index + 1, idValues.length, 1).setValues(idValues);
  }

  return map;
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
    }).filter(function (entry) {
      return isDashboardMemberStatus_(entry.fields['Membership Status']);
    })
  };
}

function isDashboardMemberStatus_(status) {
  return String(status || '').trim().toLowerCase() !== 'cancel';
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
  ensureCancellationMemberIdColumn_(sheet);
  var cancelHeaders = getSheetHeaderRow_(sheet, 1);
  var row = cancelHeaders.map(function (header) {
    if (header === MEMBER_ID_HEADER) {
      return valueForHeader_(memberHeaders, memberRow, MEMBER_ID_HEADER) || createCancellationMemberId_(FLEXX_CONFIG.findLocationKeyBySpreadsheetId(sheet.getParent().getId()));
    }
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

  sheet.insertRowBefore(2);
  sheet.getRange(2, 1, 1, row.length).setValues([row]);
  return 2;
}

function buildMemberFieldsFromRow_(headers, row) {
  var fields = {};
  MEMBER_HEADERS.forEach(function (fieldName) {
    fields[fieldName] = formatClientValue_(valueForHeader_(headers, row, fieldName));
  });
  return fields;
}

function buildMemberRowFromCancellation_(memberHeaders, cancellationHeaders, cancellationRow, locationKey) {
  var row = memberHeaders.map(function (header) {
    if (header === 'Membership Status') {
      return 'Active';
    }
    if (header === 'Membership Age') {
      return valueForHeader_(cancellationHeaders, cancellationRow, 'Membership Age at Cancel');
    }
    if (header === 'Reason/Solution') {
      return valueForHeader_(cancellationHeaders, cancellationRow, 'Reason');
    }
    if (header === 'Reactivation') {
      return true;
    }
    if (header === 'Created Date') {
      return new Date();
    }
    if (header === MEMBER_ID_HEADER) {
      return valueForHeader_(cancellationHeaders, cancellationRow, MEMBER_ID_HEADER) || createMemberId_(locationKey);
    }
    return valueForHeader_(cancellationHeaders, cancellationRow, header);
  });
  return row;
}

function findMemberFromCancellationRow_(membersSheet, cancellationHeaders, cancellationRow) {
  var data = readMembersTable_(membersSheet);
  var memberId = String(valueForHeader_(cancellationHeaders, cancellationRow, MEMBER_ID_HEADER) || '').trim();
  var name = String(valueForHeader_(cancellationHeaders, cancellationRow, 'Name') || '').trim().toLowerCase();
  var memberIdIndex = data.headers.indexOf(MEMBER_ID_HEADER);
  var nameIndex = data.headers.indexOf('Name');

  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    var idMatches = memberId && memberIdIndex > -1 && String(row[memberIdIndex] || '').trim() === memberId;
    var nameMatches = name && nameIndex > -1 && String(row[nameIndex] || '').trim().toLowerCase() === name;
    if (idMatches || nameMatches) {
      return {
        rowNumber: data.firstDataRow + i,
        row: row
      };
    }
  }
  return null;
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

function updateUpcomingHoldEntry_(sheet, rowNumber, fields, locationKey) {
  var headers = ensureUpcomingHoldHeaders_(sheet);
  if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    throw new Error('Upcoming hold row not found.');
  }

  var rowRange = sheet.getRange(rowNumber, 1, 1, headers.length);
  var row = rowRange.getValues()[0];
  Object.keys(fields).forEach(function (fieldName) {
    var index = headers.indexOf(fieldName);
    if (index === -1) {
      return;
    }
    if (fieldName === 'Start Date') {
      row[index] = parseIsoDate_(fields[fieldName]);
    } else if (fieldName === 'Next Contact' || fieldName === 'End of 6-week Nurture') {
      row[index] = parseHoldOptionalDate_(fields[fieldName]);
    } else if (fieldName === 'Return Date?') {
      row[index] = parseHoldReturnDate_(fields[fieldName]);
    } else {
      row[index] = fields[fieldName];
    }
  });

  var startDate = valueForHeader_(headers, row, 'Start Date');
  var returnDate = valueForHeader_(headers, row, 'Return Date?');
  var calculatedHoldType = calculateHoldType_(startDate, returnDate);
  setValueForHeader_(headers, row, 'Membership Status', HOLD_STATUSES[calculatedHoldType]);
  setValueForHeader_(headers, row, 'End of 6-week Nurture', calculatedHoldType === 'yellow' ? addDays_(startDate, 42) : '');

  rowRange.setValues([row]);
  SpreadsheetApp.flush();
  return getHoldsData(locationKey);
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
  var headers = getSheetHeaderRow_(sheet, MEMBER_HEADERS.length + MEMBER_OPTIONAL_HEADERS.length);
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

function getSignupsThisWeek_(headers, rows, bounds) {
  var createdDateIndex = headers.indexOf('Created Date');
  if (createdDateIndex === -1) {
    return 0;
  }

  var count = 0;
  rows.forEach(function (row) {
    if (isDateInBounds_(row[createdDateIndex], bounds)) {
      count += 1;
    }
  });
  return count;
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

function isDateTodayOrPast_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target <= today;
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
  if (fieldName === 'Price Point') {
    var rawPrice = String(value || '').replace(/[$,]/g, '').trim();
    return rawPrice === '' ? '' : Number(rawPrice);
  }
  if (fieldName === 'Recurring' || fieldName === 'Referral') {
    return value === true || String(value).toLowerCase() === 'true';
  }
  return value;
}

function formatCancellationUpdateValue_(fieldName, value) {
  if (fieldName === 'Last Contact') {
    return parseHoldOptionalDate_(value);
  }
  if (fieldName === 'Stay in contact') {
    return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes';
  }
  return String(value || '').trim();
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

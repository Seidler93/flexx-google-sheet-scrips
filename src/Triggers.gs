function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Flexx')
    .addItem('Open Staff Dashboard', 'openStaffDashboard')
    .addItem('Add Member', 'showAddMemberForm')
    .addItem('Import Attendance', 'showSessionModal')
    .addItem('Update Weekly Data', 'updateWeeklyDataFromMenu')
    .addItem('Install Weekly Data Trigger', 'setupWeeklyDataSnapshotTriggerFromMenu')
    .addItem('Install Upcoming Hold Trigger', 'setupUpcomingHoldCheckTriggerFromMenu')
    .addItem('Backfill Member IDs', 'backfillMemberIdsFromMenu')
    .addItem('Install Status Edit Triggers', 'setupMembershipStatusEditTriggersFromMenu')
    .addItem('Install All Triggers', 'setupAllTriggersFromMenu')
    .addItem('Check Installed Triggers', 'showInstalledTriggersFromMenu')
    .addToUi();
}

function openStaffDashboard() {
  var spreadsheetId = SpreadsheetApp.getActive().getId();
  var locationKey = FLEXX_CONFIG.findLocationKeyBySpreadsheetId(spreadsheetId);
  var url = FLEXX_CONFIG.getWebAppUrl(locationKey);

  var html = HtmlService
    .createHtmlOutput(
      '<script>window.open(' + JSON.stringify(url) + ', "_blank");google.script.host.close();</script>' +
      '<p><a href="' + url + '" target="_blank">Open Flexx Staff Dashboard</a></p>'
    )
    .setWidth(320)
    .setHeight(120);

  SpreadsheetApp.getUi().showModalDialog(html, 'Flexx Staff');
}

function showAddMemberForm() {
  var html = HtmlService.createHtmlOutputFromFile('AddMemberForm')
    .setWidth(500)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add New Member');
}

function addMember(form) {
  var spreadsheetId = SpreadsheetApp.getActive().getId();
  var locationKey = FLEXX_CONFIG.findLocationKeyBySpreadsheetId(spreadsheetId) || FLEXX_CONFIG.defaultLocationKey;
  var result = addMemberFromWebApp(locationKey, {
    firstName: form && form.firstName,
    lastName: form && form.lastName,
    trial: String(form && form.status || '').trim() === 'Trial',
    trialDate: form && form.trialDate,
    daysPerWeek: form && form.daysPerWeek,
    paymentOption: form && form.paymentOption,
    pricePoint: form && form.pricePoint,
    startDate: form && form.startDate,
    referral: form && form.referral,
    referralMember: form && form.referralMember,
    recurring: form && form.recurring,
    notes: form && form.notes
  });
  return 'Member added successfully: ' + (result.fields && result.fields.Name ? result.fields.Name : '');
}

function showSessionModal() {
  var html = HtmlService.createHtmlOutputFromFile('AttendanceModal')
    .setWidth(500)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Session Data');
}

function backfillMemberIdsFromMenu() {
  var spreadsheetId = SpreadsheetApp.getActive().getId();
  var locationKey = FLEXX_CONFIG.findLocationKeyBySpreadsheetId(spreadsheetId);
  var result = locationKey
    ? {
      members: backfillMemberIdsForLocation_(locationKey),
      cancellations: backfillCancellationMemberIdsForLocation_(locationKey)
    }
    : backfillMemberIdsForAllLocations();

  SpreadsheetApp.getUi().alert('Member ID backfill complete:\n\n' + JSON.stringify(result, null, 2));
  return result;
}

function updateWeeklyDataFromMenu() {
  var result = updateWeeklyDataSnapshotsForAllLocations();
  SpreadsheetApp.getUi().alert('Weekly data updated:\n\n' + JSON.stringify(result, null, 2));
  return result;
}

function onEdit(e) {
  handleMembershipStatusEdit(e);
}

function handleMembershipStatusEdit(e) {
  try {
    if (!e || !e.range || !e.source) {
      return;
    }
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) {
      return;
    }

    var locationKey = FLEXX_CONFIG.findLocationKeyBySpreadsheetId(e.source.getId());
    if (!locationKey) {
      return;
    }

    var location = getLocationConfig_(locationKey);
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();
    var newStatus = canonicalMembershipStatus_(e.value || e.range.getValue());
    var oldStatus = canonicalMembershipStatus_(e.oldValue);
    if (!newStatus) {
      return;
    }

    if (sheetName === location.sheets.members) {
      handleMembersStatusEdit_(locationKey, e.source, sheet, e.range.getRow(), e.range.getColumn(), oldStatus, newStatus);
    } else if (sheetName === location.sheets.holds) {
      handleHoldsStatusEdit_(locationKey, sheet, e.range.getRow(), e.range.getColumn(), newStatus);
    } else if (sheetName === location.sheets.cancellations) {
      handleCancellationsStatusEdit_(locationKey, e.source, sheet, e.range.getRow(), e.range.getColumn(), newStatus);
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    notifyAppIssue_('Flexx Staff status edit failed', error && error.stack ? error.stack : String(error));
  }
}

function runMemberUpdateHooks_(context) {
  if (!context || context.oldStatus === context.newStatus) {
    return;
  }
  console.log('Member status changed for ' + context.locationKey + ' row ' + context.rowNumber + ': ' + context.oldStatus + ' -> ' + context.newStatus);
}

function setupMembershipStatusEditTriggers() {
  deleteMembershipStatusEditTriggers_();
  FLEXX_CONFIG.getLocationKeys().forEach(function (locationKey) {
    var location = getLocationConfig_(locationKey);
    ScriptApp.newTrigger('handleMembershipStatusEdit')
      .forSpreadsheet(location.spreadsheetId)
      .onEdit()
      .create();
  });
  console.log('Membership status edit triggers installed for all locations.');
  return 'Membership status edit triggers installed for all locations.';
}

function setupMembershipStatusEditTriggersFromMenu() {
  var message = setupMembershipStatusEditTriggers();
  SpreadsheetApp.getUi().alert(message);
  return message;
}

function deleteMembershipStatusEditTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'handleMembershipStatusEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function handleMembersStatusEdit_(locationKey, spreadsheet, membersSheet, rowNumber, columnNumber, oldStatus, newStatus) {
  if (rowNumber < 2) {
    return;
  }
  var headers = getHeaderRow_(membersSheet);
  if (columnNumber !== headers.indexOf('Membership Status') + 1) {
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(locationKey);
    var rowRange = membersSheet.getRange(rowNumber, 1, 1, headers.length);
    var row = rowRange.getValues()[0];
    var before = row.slice();
    var name = getCellDisplay_(valueForHeader_(headers, row, 'Name'));
    if (!name) {
      return;
    }

    var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
    var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
    var cancellationsSheet = getRequiredSheet_(spreadsheet, location.sheets.cancellations, 'Cancellations/Ex-Members');
    var existingHold = getExistingHoldInfoForMember_(holdsSheet, upcomingHoldsSheet, name);

    setValueForHeader_(headers, row, 'Membership Status', newStatus);
    if (newStatus === 'Active' || newStatus === 'Trial') {
      clearHoldRowsForMember_(holdsSheet, name);
      clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
      if (oldStatus === 'Cancel' || hasCancellationRowForMember_(cancellationsSheet, name)) {
        setValueForHeader_(headers, row, 'Reactivation', true);
        setValueForHeader_(headers, row, 'Created Date', new Date());
        setCancellationRowsStatusForMember_(cancellationsSheet, name, newStatus);
      }
    } else if (newStatus === 'Cancel') {
      clearHoldRowsForMember_(holdsSheet, name);
      clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
      upsertCancellationForMember_(cancellationsSheet, headers, row, name, new Date());
    } else if (newStatus === 'Green Hold' || newStatus === 'Yellow Hold') {
      clearHoldRowsForMember_(holdsSheet, name);
      clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
      appendDefaultHoldForMemberStatus_(holdsSheet, headers, row, name, newStatus, existingHold);
    }

    rowRange.setValues([row]);
    SpreadsheetApp.flush();
    runMemberUpdateHooks_({
      locationKey: locationKey,
      sheet: membersSheet.getName(),
      rowNumber: rowNumber,
      oldStatus: valueForHeader_(headers, before, 'Membership Status') || oldStatus,
      newStatus: newStatus
    });
  } finally {
    lock.releaseLock();
  }
}

function handleHoldsStatusEdit_(locationKey, holdsSheet, rowNumber, columnNumber, newStatus) {
  var holdType = getHoldTypeForEditedRow_(holdsSheet, rowNumber, columnNumber);
  if (!holdType) {
    return;
  }
  updateHoldEntry(locationKey, {
    holdType: holdType,
    rowNumber: rowNumber,
    fields: {
      'Membership Status': newStatus
    }
  });
}

function handleCancellationsStatusEdit_(locationKey, spreadsheet, cancellationsSheet, rowNumber, columnNumber, newStatus) {
  if (rowNumber < 2) {
    return;
  }
  var headers = getSheetHeaderRow_(cancellationsSheet, 1);
  if (columnNumber !== headers.indexOf('Membership Status') + 1) {
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var location = getLocationConfig_(locationKey);
    var membersSheet = getRequiredSheet_(spreadsheet, location.sheets.members, 'Members');
    var holdsSheet = getRequiredSheet_(spreadsheet, location.sheets.holds, 'HOLDS');
    var upcomingHoldsSheet = getRequiredSheet_(spreadsheet, location.sheets.upcomingHolds || 'Upcoming Holds', 'Upcoming Holds');
    var row = cancellationsSheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    var name = getCellDisplay_(valueForHeader_(headers, row, 'Name'));
    var memberInfo = findMemberByName_(membersSheet, name);
    if (!memberInfo) {
      return;
    }

    setCancellationRowStatus_(cancellationsSheet, rowNumber, newStatus);
    setValueForHeader_(memberInfo.headers, memberInfo.row, 'Membership Status', newStatus);
    if (newStatus === 'Active' || newStatus === 'Trial') {
      setValueForHeader_(memberInfo.headers, memberInfo.row, 'Reactivation', true);
      setValueForHeader_(memberInfo.headers, memberInfo.row, 'Created Date', new Date());
      clearHoldRowsForMember_(holdsSheet, name);
      clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
    } else if (newStatus === 'Cancel') {
      clearHoldRowsForMember_(holdsSheet, name);
      clearUpcomingHoldRowsForMember_(upcomingHoldsSheet, name);
    }
    memberInfo.sheet.getRange(memberInfo.rowNumber, 1, 1, memberInfo.headers.length).setValues([memberInfo.row]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function canonicalMembershipStatus_(status) {
  var normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'active') {
    return 'Active';
  }
  if (normalized === 'trial') {
    return 'Trial';
  }
  if (normalized === 'green hold' || normalized === 'green') {
    return 'Green Hold';
  }
  if (normalized === 'yellow hold' || normalized === 'yellow') {
    return 'Yellow Hold';
  }
  if (normalized === 'cancel' || normalized === 'cancelled' || normalized === 'canceled') {
    return 'Cancel';
  }
  return '';
}

function getHoldTypeForEditedRow_(holdsSheet, rowNumber, columnNumber) {
  var holdTypes = ['green', 'yellow'];
  for (var i = 0; i < holdTypes.length; i += 1) {
    var holdType = holdTypes[i];
    var section = findHoldSection_(holdsSheet, holdType);
    var headers = getHoldSectionHeaders_(holdsSheet, section.headerRow, holdType);
    var statusColumn = headers.indexOf('Membership Status') + 1;
    var startRow = section.headerRow + 1;
    var endRow = section.nextHeaderRow ? section.nextHeaderRow - 1 : holdsSheet.getLastRow();
    if (columnNumber === statusColumn && rowNumber >= startRow && rowNumber <= endRow) {
      return holdType;
    }
  }
  return '';
}

function appendDefaultHoldForMemberStatus_(holdsSheet, memberHeaders, memberRow, name, status, existingHold) {
  var holdType = status === 'Yellow Hold' ? 'yellow' : 'green';
  var today = getTodayAtNoon_();
  var startDate = existingHold && existingHold.startDate ? existingHold.startDate : today;
  var returnDate = holdType === 'yellow'
    ? '-'
    : (existingHold && existingHold.returnDate instanceof Date ? existingHold.returnDate : addDays_(startDate, 14));
  var reason = getCellDisplay_(valueForHeader_(memberHeaders, memberRow, 'Reason/Solution'));
  var holdRow = [
    name,
    status,
    valueForHeader_(memberHeaders, memberRow, 'Membership Age'),
    reason,
    startDate,
    getDefaultHoldNextContactDate_(startDate, holdType),
    returnDate,
    holdType === 'yellow' ? addDays_(startDate, 42) : ''
  ];
  appendHoldRow_(holdsSheet, holdType, holdRow);
}

function getExistingHoldInfoForMember_(holdsSheet, upcomingHoldsSheet, name) {
  var normalizedName = String(name || '').trim().toLowerCase();
  var found = null;
  ['green', 'yellow'].some(function (holdType) {
    var section = findHoldSection_(holdsSheet, holdType);
    var headers = getHoldSectionHeaders_(holdsSheet, section.headerRow, holdType);
    var startRow = section.headerRow + 1;
    var endRow = section.nextHeaderRow ? section.nextHeaderRow - 1 : holdsSheet.getLastRow();
    if (endRow < startRow) {
      return false;
    }
    var values = holdsSheet.getRange(startRow, 1, endRow - startRow + 1, headers.length).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(valueForHeader_(headers, values[i], 'Name') || '').trim().toLowerCase() === normalizedName) {
        found = {
          startDate: normalizeDateValue_(valueForHeader_(headers, values[i], 'Start Date')),
          returnDate: valueForHeader_(headers, values[i], 'Return Date?')
        };
        return true;
      }
    }
    return false;
  });
  if (found || !upcomingHoldsSheet) {
    return found;
  }
  var upcomingHeaders = ensureUpcomingHoldHeaders_(upcomingHoldsSheet);
  if (upcomingHoldsSheet.getLastRow() < 2) {
    return null;
  }
  var upcomingValues = upcomingHoldsSheet.getRange(2, 1, upcomingHoldsSheet.getLastRow() - 1, upcomingHeaders.length).getValues();
  for (var rowIndex = 0; rowIndex < upcomingValues.length; rowIndex += 1) {
    if (String(valueForHeader_(upcomingHeaders, upcomingValues[rowIndex], 'Name') || '').trim().toLowerCase() === normalizedName) {
      return {
        startDate: normalizeDateValue_(valueForHeader_(upcomingHeaders, upcomingValues[rowIndex], 'Start Date')),
        returnDate: valueForHeader_(upcomingHeaders, upcomingValues[rowIndex], 'Return Date?')
      };
    }
  }
  return null;
}

function upsertCancellationForMember_(cancellationsSheet, memberHeaders, memberRow, name, cancelDate) {
  var rowNumber = findCancellationRowByName_(cancellationsSheet, name);
  if (!rowNumber) {
    appendCancellationRow_(cancellationsSheet, memberHeaders, memberRow, getCellDisplay_(valueForHeader_(memberHeaders, memberRow, 'Reason/Solution')), '', cancelDate);
    return;
  }
  var headers = getSheetHeaderRow_(cancellationsSheet, 1);
  setCancellationRowStatus_(cancellationsSheet, rowNumber, 'Cancel');
  var cancelDateIndex = headers.indexOf('Cancel Date');
  if (cancelDateIndex > -1 && !cancellationsSheet.getRange(rowNumber, cancelDateIndex + 1).getValue()) {
    cancellationsSheet.getRange(rowNumber, cancelDateIndex + 1).setValue(cancelDate);
  }
}

function hasCancellationRowForMember_(cancellationsSheet, name) {
  return Boolean(findCancellationRowByName_(cancellationsSheet, name));
}

function setCancellationRowsStatusForMember_(cancellationsSheet, name, status) {
  var normalizedName = String(name || '').trim().toLowerCase();
  var headers = getSheetHeaderRow_(cancellationsSheet, 1);
  var nameIndex = headers.indexOf('Name');
  var statusIndex = headers.indexOf('Membership Status');
  if (nameIndex === -1 || statusIndex === -1 || cancellationsSheet.getLastRow() < 2) {
    return;
  }
  var values = cancellationsSheet.getRange(2, 1, cancellationsSheet.getLastRow() - 1, headers.length).getValues();
  values.forEach(function (row, index) {
    if (String(row[nameIndex] || '').trim().toLowerCase() === normalizedName) {
      cancellationsSheet.getRange(index + 2, statusIndex + 1).setValue(status);
    }
  });
}

function findCancellationRowByName_(cancellationsSheet, name) {
  var normalizedName = String(name || '').trim().toLowerCase();
  var headers = getSheetHeaderRow_(cancellationsSheet, 1);
  var nameIndex = headers.indexOf('Name');
  if (nameIndex === -1 || cancellationsSheet.getLastRow() < 2) {
    return 0;
  }
  var values = cancellationsSheet.getRange(2, nameIndex + 1, cancellationsSheet.getLastRow() - 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i -= 1) {
    if (String(values[i][0] || '').trim().toLowerCase() === normalizedName) {
      return i + 2;
    }
  }
  return 0;
}

function getDefaultHoldNextContactDate_(startDate, holdType) {
  var nextFriday = getNextFridayOnOrAfter_(startDate || getTodayAtNoon_());
  if (holdType === 'yellow') {
    nextFriday.setDate(nextFriday.getDate() + 7);
  }
  return nextFriday;
}

function getNextFridayOnOrAfter_(date) {
  var base = normalizeDateValue_(date) || getTodayAtNoon_();
  var nextFriday = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  var daysUntilFriday = (5 - nextFriday.getDay() + 7) % 7;
  nextFriday.setDate(nextFriday.getDate() + daysUntilFriday);
  return nextFriday;
}

function getTodayAtNoon_() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function setupUpcomingHoldCheckTrigger() {
  deleteUpcomingHoldCheckTriggers_();
  ScriptApp.newTrigger('promoteUpcomingHoldsForAllLocations')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .nearMinute(15)
    .create();
  console.log('Upcoming hold check trigger installed for about 5:15 AM daily.');
  return 'Upcoming hold check trigger installed for about 5:15 AM daily.';
}

function setupUpcomingHoldCheckTriggerFromMenu() {
  var message = setupUpcomingHoldCheckTrigger();
  SpreadsheetApp.getUi().alert(message);
  return message;
}

function setupWeeklyDataSnapshotTrigger() {
  deleteWeeklyDataSnapshotTriggers_();
  ScriptApp.newTrigger('updateWeeklyDataSnapshotsForAllLocations')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(5)
    .nearMinute(45)
    .create();
  console.log('Weekly data snapshot trigger installed for Monday around 5:45 AM.');
  return 'Weekly data snapshot trigger installed for Monday around 5:45 AM.';
}

function setupWeeklyDataSnapshotTriggerFromMenu() {
  var message = setupWeeklyDataSnapshotTrigger();
  SpreadsheetApp.getUi().alert(message);
  return message;
}

function setupAllTriggersFromMenu() {
  var messages = [
    setupMembershipStatusEditTriggers(),
    setupUpcomingHoldCheckTrigger(),
    setupWeeklyDataSnapshotTrigger()
  ];
  SpreadsheetApp.getUi().alert('Trigger setup complete:\n\n' + messages.join('\n'));
  return messages;
}

function showInstalledTriggersFromMenu() {
  var triggers = listInstalledTriggers();
  var message = triggers.length
    ? triggers.map(function (trigger, index) {
      return [
        String(index + 1) + '. ' + trigger.handlerFunction,
        'Event: ' + trigger.eventType,
        'Source: ' + trigger.triggerSource,
        trigger.triggerSourceId ? 'Source ID: ' + trigger.triggerSourceId : ''
      ].filter(function (line) { return line; }).join('\n');
    }).join('\n\n')
    : 'No installable triggers found.';

  SpreadsheetApp.getUi().alert('Installed Triggers:\n\n' + message);
  return triggers;
}

function listInstalledTriggers() {
  return ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      triggerSource: String(trigger.getTriggerSource()),
      triggerSourceId: typeof trigger.getTriggerSourceId === 'function' ? trigger.getTriggerSourceId() : '',
      uniqueId: trigger.getUniqueId()
    };
  });
}

function deleteWeeklyDataSnapshotTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'updateWeeklyDataSnapshotsForAllLocations') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function deleteUpcomingHoldCheckTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'promoteUpcomingHoldsForAllLocations') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

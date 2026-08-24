function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Flexx')
    .addItem('Open Staff Dashboard', 'openStaffDashboard')
    .addItem('Import Attendance', 'showSessionModal')
    .addItem('Update Weekly Data', 'updateWeeklyDataSnapshotsForAllLocations')
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

function showSessionModal() {
  var html = HtmlService.createHtmlOutputFromFile('AttendanceModal')
    .setWidth(500)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Session Data');
}

function runMemberUpdateHooks_(context) {
  // Existing onEdit business logic will be refactored here later.
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

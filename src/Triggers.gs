function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Flexx')
    .addItem('Open Staff Dashboard', 'openStaffDashboard')
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

function runMemberUpdateHooks_(context) {
  // Existing onEdit business logic will be refactored here later.
}

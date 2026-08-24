function doGet(e) {
  var requestedLocation = e && e.parameter ? e.parameter.location : null;
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialLocationKey = resolveLocationKey_(requestedLocation);
  return template
    .evaluate()
    .setTitle('Flexx Staff')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

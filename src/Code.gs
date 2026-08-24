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

function getAlertConfig_() {
  var alerts = FLEXX_CONFIG.alerts || {};
  var propertyName = String(alerts.slackWebhookPropertyName || '').trim();
  var slackWebhookUrl = String(alerts.slackWebhookUrl || '').trim();
  if (!slackWebhookUrl && propertyName) {
    slackWebhookUrl = String(PropertiesService.getScriptProperties().getProperty(propertyName) || '').trim();
  }
  return {
    email: alerts.email || '',
    slackWebhookUrl: slackWebhookUrl
  };
}

function notifyAppIssue_(subject, details) {
  var alerts = getAlertConfig_();
  var email = String(alerts.email || '').trim();
  var slackWebhookUrl = String(alerts.slackWebhookUrl || '').trim();
  if (!email && !slackWebhookUrl) {
    return;
  }

  var cacheKey = Utilities.base64EncodeWebSafe(subject + '\n' + details).slice(0, 180);
  var cache = CacheService.getScriptCache();
  if (cache.get(cacheKey)) {
    return;
  }
  cache.put(cacheKey, '1', 1800);

  var message = subject + '\n\n' + details;
  if (email) {
    MailApp.sendEmail(email, subject, message);
  }
  if (slackWebhookUrl) {
    UrlFetchApp.fetch(slackWebhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        text: '*Flexx Staff issue*\n' + message
      }),
      muteHttpExceptions: true
    });
  }
}

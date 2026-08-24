var FLEXX_CONFIG = (function () {
  var DEFAULT_LOCATION_KEY = 'highlandPark';
  var PRODUCTION_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzbd5Oo9SGcYsb7phOGouruJY1XzB_Ru6JPlfxo8JMU_C5qdcVgvmWmlWVRZ7BKBOdU/exec';

  var LOCATIONS = {
    highlandPark: {
      name: 'Highland Park',
      spreadsheetId: '1kzejYtuoGm8FSHGeWsL-k3dj5R-hcPikhZFN6o9-jtg',
      sheets: {
        members: 'Members',
        holds: 'HOLDS',
        cancellations: 'Cancellations/Ex-Members'
      }
    }
  };

  function getLocation(locationKey) {
    var resolvedKey = resolveLocationKey(locationKey);
    var location = LOCATIONS[resolvedKey];
    return {
      key: resolvedKey,
      name: location.name,
      spreadsheetId: location.spreadsheetId,
      sheets: location.sheets
    };
  }

  function getPublicLocations() {
    return Object.keys(LOCATIONS).map(function (key) {
      return {
        key: key,
        name: LOCATIONS[key].name
      };
    });
  }

  function resolveLocationKey(locationKey) {
    if (locationKey && LOCATIONS[locationKey]) {
      return locationKey;
    }
    return DEFAULT_LOCATION_KEY;
  }

  function findLocationKeyBySpreadsheetId(spreadsheetId) {
    var keys = Object.keys(LOCATIONS);
    for (var i = 0; i < keys.length; i += 1) {
      if (LOCATIONS[keys[i]].spreadsheetId === spreadsheetId) {
        return keys[i];
      }
    }
    return null;
  }

  function getWebAppUrl(locationKey) {
    var resolvedKey = resolveLocationKey(locationKey);
    return PRODUCTION_WEB_APP_URL + '?location=' + encodeURIComponent(resolvedKey);
  }

  return {
    defaultLocationKey: DEFAULT_LOCATION_KEY,
    productionWebAppUrl: PRODUCTION_WEB_APP_URL,
    getLocation: getLocation,
    getPublicLocations: getPublicLocations,
    resolveLocationKey: resolveLocationKey,
    findLocationKeyBySpreadsheetId: findLocationKeyBySpreadsheetId,
    getWebAppUrl: getWebAppUrl
  };
}());

function getAppConfig(locationKey) {
  return {
    defaultLocationKey: FLEXX_CONFIG.defaultLocationKey,
    selectedLocationKey: FLEXX_CONFIG.resolveLocationKey(locationKey),
    productionWebAppUrl: FLEXX_CONFIG.productionWebAppUrl,
    locations: FLEXX_CONFIG.getPublicLocations()
  };
}

function resolveLocationKey_(locationKey) {
  return FLEXX_CONFIG.resolveLocationKey(locationKey);
}

function getLocationConfig_(locationKey) {
  return FLEXX_CONFIG.getLocation(locationKey);
}

function openLocationSpreadsheet_(locationKey) {
  var location = getLocationConfig_(locationKey);
  return SpreadsheetApp.openById(location.spreadsheetId);
}

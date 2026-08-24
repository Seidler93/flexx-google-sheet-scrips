# Flexx Staff

Internal multi-location Flexx staff app built as a standalone Google Apps Script web app.

The app uses one Apps Script project and one deployed web app. Each Flexx location is configured with its own Google Sheets spreadsheet ID.

Current production web app:

https://script.google.com/macros/s/AKfycbzbd5Oo9SGcYsb7phOGouruJY1XzB_Ru6JPlfxo8JMU_C5qdcVgvmWmlWVRZ7BKBOdU/exec

## Setup

1. Install Node.js and npm.
2. Run `npm install`.
3. Run `npm run login`.
4. Find the existing Apps Script Script ID in Apps Script project settings.
5. Copy `.clasp.json.example` to `.clasp.json`.
6. Paste the existing Script ID into `.clasp.json`:

   ```json
   {
     "scriptId": "PASTE_EXISTING_APPS_SCRIPT_ID_HERE",
     "rootDir": "src"
   }
   ```

7. Run `npm run pull` only if you intentionally want to inspect or reconcile remote Apps Script files. Review local changes first so newer local work is not overwritten.
8. Run `npm run status`.
9. Run `npm run push` to sync source files to the existing Apps Script project.
10. Redeploy a new Apps Script web-app version manually from the Apps Script editor when you are ready.

`npm run push` only syncs source. It does not update the production `/exec` deployment by itself.

## Useful Commands

```bash
npm run login
npm run status
npm run push
npm run open
npm run logs
```

## Adding a Location

Edit `src/Config.gs` and add another entry to `LOCATIONS`:

```js
arlingtonHeights: {
  name: 'Arlington Heights',
  spreadsheetId: 'PASTE_ID_HERE',
  sheets: {
    members: 'Members'
  }
}
```

Direct web-app URLs can use the location key:

```text
/exec?location=highlandPark
/exec?location=arlingtonHeights
```

If the requested location is missing or invalid, the app falls back to the configured default location.

## Deployment Safety

Do not use `npm run pull` or `npm run push` casually against production. Pulling can overwrite local files if remote files have the same names, and pushing updates the source attached to the existing Apps Script project.

For safe testing:

1. Push source with `npm run push`.
2. Open the Apps Script editor with `npm run open`.
3. Use Apps Script test deployments or a new versioned deployment.
4. Verify behavior with a location-specific URL such as `?location=highlandPark`.
5. Update the production deployment manually only after testing.

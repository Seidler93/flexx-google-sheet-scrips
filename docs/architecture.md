# Flexx Staff Architecture

## Goals

- One local Git repository.
- One Apps Script project.
- One deployed web app.
- Multiple Flexx locations selected by location key.
- Existing Google Sheets remain the source of truth.
- Local sync through `clasp`.

## Apps Script Layout

`src/` is the clasp root directory. `src/appsscript.json` lives there because clasp expects the Apps Script manifest inside the configured `rootDir`.

- `Code.gs`: web app entry point and HTML include helper.
- `Config.gs`: location configuration and lookup helpers.
- `Members.gs`: dashboard, search, profile, and member save operations.
- `Triggers.gs`: lightweight spreadsheet menu and future member update hooks.
- `Index.html`: Apps Script HTML shell.
- `Styles.html`: app styling.
- `Scripts.html`: vanilla browser JavaScript using `google.script.run`.

## Locations

Locations are currently stored in `Config.gs`:

```js
highlandPark: {
  name: 'Highland Park',
  spreadsheetId: '1kzejYtuoGm8FSHGeWsL-k3dj5R-hcPikhZFN6o9-jtg',
  sheets: {
    members: 'Members',
    holds: 'HOLDS',
    cancellations: 'Cancellations/Ex-Members'
  }
}
```

All backend methods accept or resolve a `locationKey`. The app does not hardcode Highland Park outside the initial configuration.

This shape can later move to `PropertiesService` without rewriting callers because the rest of the app goes through `getLocationConfig_()` and `resolveLocationKey_()`.

## Members

The `Members` sheet uses the existing row number as the member identifier. The code does not assume a separate member ID, first name, or last name column.

Editable profile fields include most member fields, with typed controls in the web app for:

- `Days Per Week`
- `Payment Option`
- `Recurring`
- `Start Date`

The profile keeps these fields locked:

- `Membership Status`
- `Membership Age`
- `90-Day Date`
- `Created Date`

Cancellation from the profile sets `Membership Status` to `Cancel` and appends a row to `Cancellations/Ex-Members` with the cancellation reason, solution, and cancel date.
- `Notes`

Other profile fields are read-only until formula-driven columns are identified.

## Dashboard Counts

The member status cards count `Membership Status` values from `Members`:

- `Active Members`: `Active` plus `Green Hold`
- `Holds`: `Green Hold`
- `Extended Holds`: `Yellow Hold`

`Cancels This Week` reads the `Cancel Date` column from `Cancellations/Ex-Members` and counts dates in the current Monday-Sunday week.

The dashboard member table reads configured columns from `Members`. The browser stores each location's visible column choices in local storage, so staff can hide lower-use columns without changing the Sheet.

## Holds

`putMemberOnHold(locationKey, payload)` updates the member row in `Members` and writes one row to the configured `HOLDS` tab. Holds under 28 days are classified as `Green Hold`; holds 28 days or longer, or holds with no return date, are classified as `Yellow Hold`. Green holds default to the next Friday contact date. Yellow holds default to every-other-Friday contact and set the 6-week nurture date 42 days after the hold start date. Existing sheet `onEdit(e)` logic is still not duplicated; the hold action passes context to `runMemberUpdateHooks_()` for later shared business logic extraction.

The Holds page reads the same `HOLDS` tab and renders the first hold section as Green Holds and the second hold section as Extended Holds. Divider rows and blank rows are ignored.

Inline Holds edits call `updateHoldEntry(locationKey, payload)`. Setting a hold to `Active` or `Cancel` clears the hold row and updates the matching member status. Choosing `Yellow Hold` moves the row to the extended section with an open-ended return date. Date edits recalculate green/yellow status using the 28-day rule and update the 6-week nurture date for extended holds.

## Writes and Hooks

`saveMemberChanges(locationKey, payload)` uses `LockService.getScriptLock()`, reads the target row once, updates editable values in memory, and writes the row with one `setValues()` call.

After saving, it passes before/after context into:

```js
function runMemberUpdateHooks_(context) {
  // Existing onEdit business logic will be refactored here later.
}
```

Programmatic writes do not run existing simple `onEdit(e)` logic automatically. That logic should be refactored into shared handlers later so manual sheet edits and web-app edits can call the same code.

## Web App URLs

The web app supports direct location URLs:

```text
/exec?location=highlandPark
```

Invalid or absent location keys fall back to the default location.

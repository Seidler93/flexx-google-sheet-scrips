function addColumnToDashboard() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("dashboard");

  // Check if the sheet was found
  if (!sheet) {
    Logger.log("Error: Sheet 'dashboard' not found.");
    return; // Exit the function if sheet is not found
  }

  var today = new Date();

  // Check if today is Monday
  var isMonday = today.getDay() == 1; // getDay() returns 1 for Monday

  // Check conditions and trigger actions
  if (isMonday) {
    addNewWeek(sheet); // Call function to add a new week if it's Monday
  }
}

// Function to add a new week (shift data and copy values)
function addNewWeek(sheet) {
  // Check if the sheet is properly passed
  if (!sheet) {
    Logger.log("Error: Sheet is undefined in addNewWeek function.");
    return; // Exit the function if sheet is undefined
  }

  // Get the range E1:E14
  var range = sheet.getRange('E1:E13');
  
  // Insert new cells to the right of this range (shifting data from E to D)
  range.insertCells(SpreadsheetApp.Dimension.COLUMNS); // Insert cells to the left
  
  // Now copy the values from D1:D14 to the newly inserted cells (E1:E14)
  var sourceRange = sheet.getRange('D1:D13');
  var values = sourceRange.getValues(); // Get values from D1:D14
  
  var targetRange = sheet.getRange('E1:E13'); // Get the target range for E1:E14
  targetRange.setValues(values); // Set the values into E1:E14

  var styleEColumn = sheet.getRange('E3:E13'); 
  var styleDColumn = sheet.getRange('D3:D13'); 
  var styleDBottomColumn = sheet.getRange('E14:E14'); 

  styleEColumn.setBorder(
    null, // top border
    null,  // left border
    true,  // bottom border
    true,  // right border
    true,  // vertical
    true, // horizontal
    null, // color
    SpreadsheetApp.BorderStyle.SOLID  // solid border style
  );

  // Bottom and inner borders: Thin solid
  styleDColumn.setBorder(
    true, // top border
    true,  // left border
    true,  // bottom border
    true,  // right border
    true,  // vertical
    true, // horizontal
    null, // color
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM  // solid border style
  );

  // Bottom and inner borders: Thin solid
  styleDBottomColumn.setBorder(
    true, // top border
    null,  // left border
    null,  // bottom border
    null,  // right border
    null,  // vertical
    null, // horizontal
    null, // color
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM  // solid border style
  );

  // Get the current values of E1 and E2
  var e1 = sheet.getRange('E1').getValue();
  var e2 = sheet.getRange('E2').getValue();
  
  // Add 7 days to E1 and E2
  var newD1 = new Date(e1);
  newD1.setDate(newD1.getDate() + 7); // Add 7 days to E1
  
  var newD2 = new Date(e2);
  newD2.setDate(newD2.getDate() + 7); // Add 7 days to E2
  
  // Set the new values into D1 and D2
  sheet.getRange('D1').setValue(newD1);
  sheet.getRange('D2').setValue(newD2);
  sheet.getRange('B21').setValue('=SUM(D12:G12)/G5');
  sheet.getRange('D4').setValue('=SUM(D5-E5)');

}



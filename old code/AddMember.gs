function showAddMemberForm() {
  var html = HtmlService.createHtmlOutputFromFile('AddMemberForm')
      .setWidth(500)
      .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add New Member');
}

function showSessionModal() {
  const html = HtmlService.createHtmlOutputFromFile('AttendanceModal')
    .setWidth(500)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Session Data');
}

function addMember(form) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Members");  // Update with your sheet name
  // Add a new row in the members sheet
  sheet.insertRowBefore(2);  // Insert a new row below title row

  // Get the current date
  var currentDate = new Date();
  var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM/dd/yyyy");

  function formatName(first, last) {
    if (!first || !last) {
      return "Invalid input"; // Handle cases where input is missing
    }
  
    // Trim spaces from the beginning and end of the first and last names
    first = first.trim();
    last = last.trim();
  
    return `${last}, ${first}`;
  }
  

  var formattedName = formatName(form.firstName, form.lastName);

  var referralSecondMonth = form.referral ? '=EDATE(H2, 1)' : '';

  var memberData = [
    formattedName,         // Member Name
    form.status,           // Status
    "Yellow",              // Default status color
    "New member under 90 days",  // Status description
    form.daysPerWeek,      // Number of days per week
    form.paymentOption,    // Payment option
    form.pricePoint,       // Price point
    form.startDate,        // Start date
    '=EDATE(H2, 3)',       // 90 days after start
    form.referral,         // Referral
    referralSecondMonth,   // Referral follow-up date
    form.referralMember,   // Referral member
    "",                    // Empty column for future use
    form.recurring,        // Recurring flag
    false,                 // Another flag (assumed to be a default value)
    form.notes,            // Notes
    formattedDate          // Current date in MM/dd/yyyy format
  ];

  // Write the data to the sheet
  sheet.getRange(2, 1, 1, memberData.length).setValues([memberData]);

  return "Member added successfully!";
}

// Function to add a custom menu when the spreadsheet opens
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Flexx')
    .addItem('Add Member', 'showAddMemberForm')
    .addItem('Import Attendance', 'showSessionModal')
    .addToUi();
}

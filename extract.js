require('dotenv').config();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const jsforce = require('jsforce');
const ProgressBar = require('progress');

// Define your Salesforce credentials
const username = process.env.SFDC_USERNAME;
const password = process.env.SFDC_PASSWORD;
const loginUrl = process.env.SFDC_LOGINURL;

// Create a connection to Salesforce
const conn = new jsforce.Connection({
    loginUrl : loginUrl,
    version : '57.0'  // Set your desired API version here
});

let records = [];
let totalCount = 0;
let totalSize = 0;
let bar = null;

// Function to create a CSV writer with a new file path
function createWriter(totalCount) {
  return createCsvWriter({
    path: `out-${totalCount-records.length+1}-${totalCount}.csv`,
    header: [
        {id: 'RefMetadataComponentId', title: 'RefMetadataComponentId'},
        {id: 'RefMetadataComponentName', title: 'RefMetadataComponentName'},
        {id: 'RefMetadataComponentType', title: 'RefMetadataComponentType'},
        {id: 'MetadataComponentId', title: 'MetadataComponentId'},
        {id: 'MetadataComponentName', title: 'MetadataComponentName'},
        {id: 'MetadataComponentType', title: 'MetadataComponentType'},
    ]
  });
}

// Define a function to fetch the records
const fetchRecords = (queryUrl, isMore) => {
  const fetchFunc = isMore ? 'queryMore' : 'query';

  conn.tooling[fetchFunc](queryUrl, function(err, result) {
    if (err) { return console.error(err); }

    if (!totalSize) {
      totalSize = result.totalSize;
      bar = new ProgressBar('[:bar] :percent :etas', { total: totalSize, width: 40 });
    }

    records.push(...result.records);
    totalCount += result.records.length;

    // Update the progress bar
    bar.tick(result.records.length);

    if (records.length >= 50000 || result.done) {
      const csvWriter = createWriter(totalCount);
      csvWriter
        .writeRecords(records)
        .then(() => console.log('The CSV file was written successfully'))
        .catch(console.error);

      // Reset the records array
      records = [];
    }

    if (!result.done) {
      console.log("Fetching next records from URL : " + result.nextRecordsUrl);
      fetchRecords(result.nextRecordsUrl, true);
    } else {
      console.log("Fetching done");
    }
  });
};

// Login to Salesforce
conn.login(username, password, function(err, userInfo) {
    if (err) { return console.error(err); }

    // Define the SOQL query
    const query = "SELECT Id, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType, MetadataComponentId, MetadataComponentName, MetadataComponentType FROM MetadataComponentDependency";

    fetchRecords(query, false);
});


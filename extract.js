require('dotenv').config();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const jsforce = require('jsforce');

// Define your Salesforce credentials
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const loginUrl = process.env.LOGINURL;

console.log(loginUrl);

// Define the CSV writer
const csvWriter = createCsvWriter({
    path: 'out.csv',
    header: [
        {id: 'RefMetadataComponentId', title: 'RefMetadataComponentId'},
        {id: 'RefMetadataComponentName', title: 'RefMetadataComponentName'},
        {id: 'RefMetadataComponentType', title: 'RefMetadataComponentType'},
        {id: 'MetadataComponentId', title: 'MetadataComponentId'},
        {id: 'MetadataComponentName', title: 'MetadataComponentName'},
        {id: 'MetadataComponentType', title: 'MetadataComponentType'},
    ]
});

// Create a connection to Salesforce
const conn = new jsforce.Connection({
    loginUrl : loginUrl,
    version : '57.0'  // Set your desired API version here
});

// Login to Salesforce
conn.login(username, password, function(err, userInfo) {
    if (err) { return console.error(err); }

    // Define the SOQL query
    const query = "SELECT Id, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType, MetadataComponentId, MetadataComponentName, MetadataComponentType FROM MetadataComponentDependency";

    // Execute the query and handle pagination
    const records = [];
    const queryResult = conn.tooling.query(query);
    queryResult.on("record", function(record) {
        records.push(record);
        console.log(record);
    });
    queryResult.on("end", function() {
        console.log("Total records fetched : " + queryResult.totalFetched);

        // Write the records to the CSV file
        csvWriter.writeRecords(records)
            .then(() => {
                console.log('...Done');
            });
    });
    queryResult.on("error", function(err) {
        console.error(err);
    });
    queryResult.run({ autoFetch : true, maxFetch : 500000 }); // Adjust maxFetch as needed
});

require('dotenv').config();
const jsforce = require('jsforce');
const fs = require('fs');
const csv = require('fast-csv');
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

const csvStream = csv.format({ headers: true });
const writableStream = fs.createWriteStream('sobjects.csv');

writableStream.on('finish', () => console.log('CSV file successfully created.'));

csvStream.pipe(writableStream);

async function main() {
  try {
    await conn.login(username, password);

    // Query all tooling sobjects
    const res = await conn.tooling.describeGlobal();

    const bar = new ProgressBar(':bar :current/:total SObjects processed', { total: res.sobjects.length });

    for (let sobject of res.sobjects) {
      try {
        // Use a SOQL query to count records
        const result = await conn.tooling.query(`SELECT COUNT() FROM ${sobject.name}`);
        csvStream.write({
          'SObjectName': sobject.name,
          'Record Count': result.totalSize
        });
      } catch (e) {
        // Handle error, possibly due to unqueryable SObject
        console.error(`Error querying ${sobject.name}:`, e.message);
      }

      bar.tick();
    }

    csvStream.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();

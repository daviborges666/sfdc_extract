require('dotenv').config();
const jsforce = require('jsforce');
const fs = require('fs');
const csv = require('fast-csv');
const ProgressBar = require('progress');
const path = require('path');

// Define your Salesforce credentials
const username = process.env.SFDC_USERNAME;
const password = process.env.SFDC_PASSWORD;
const loginUrl = process.env.SFDC_LOGINURL;

// Create a connection to Salesforce
const conn = new jsforce.Connection({
  loginUrl : loginUrl,
  version : '57.0'  // Set your desired API version here
});

async function main() {
  try {
    await conn.login(username, password);

    // Create 'sobjects' subfolder if it does not exist
    if (!fs.existsSync('sobjects')) {
      fs.mkdirSync('sobjects');
    }

    const sobjects = [];
    fs.createReadStream('sobjects.csv')
      .pipe(csv.parse({ headers: true }))
      .on('error', error => console.error(error))
      .on('data', row => sobjects.push(row))
      .on('end', async (rowCount) => {
        console.log(`Read ${rowCount} rows from sobjects.csv`);

        const bar = new ProgressBar(':bar :current/:total SObjects processed', { total: sobjects.length });

        for (let sobject of sobjects) {
          // Check if the SObject has count > 0
          if (Number(sobject['Record Count']) > 0) {
            try {
              // Query only the Ids of the SObject records
              const records = await conn.tooling.sobject(sobject.SObjectName).find({}, 'Id');

              // Create a new CSV for this SObject in the 'sobjects' subfolder
              const csvStream = csv.format({ headers: true });
              const writableStream = fs.createWriteStream(path.join('sobjects', `${sobject.SObjectName}.csv`));
              csvStream.pipe(writableStream);

              records.forEach(record => {
                csvStream.write(record);
              });

              csvStream.end();
            } catch (e) {
              // Handle error, possibly due to unqueryable SObject
              console.error(`Error querying ${sobject.SObjectName}:`, e.message);
            }
          }

          bar.tick();
        }
      });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
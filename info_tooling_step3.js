require('dotenv').config();
const jsforce = require('jsforce');
const fs = require('fs');
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

function appendCSVLine(file, data) {
  file.write(Object.values(data).map(value => `"${value}"`).join(',') + '\n');
}

async function main() {
  try {
    await conn.login(username, password);

    // Get a list of CSV files in 'sobjects' subfolder
    const files = fs.readdirSync('sobjects').filter(file => file.endsWith('.csv'));

    const bar = new ProgressBar(':bar :current/:total SObjects processed', { total: files.length });

    // Create dependencies CSV and error log CSV
    const dependenciesFile = fs.createWriteStream('dependencies.csv');
    const errorsFile = fs.createWriteStream('dependencies_error.csv');

    // Write headers
    appendCSVLine(dependenciesFile, {
      MetadataComponentId: 'MetadataComponentId',
      MetadataComponentName: 'MetadataComponentName',
      MetadataComponentType: 'MetadataComponentType',
      RefMetadataComponentId: 'RefMetadataComponentId',
      RefMetadataComponentName: 'RefMetadataComponentName',
      RefMetadataComponentType: 'RefMetadataComponentType'
    });
    appendCSVLine(errorsFile, {
      SObjectName: 'SObjectName',
      Id: 'Id',
      Error: 'Error'
    });

    for (let file of files) {
      const sobjectName = path.basename(file, '.csv');

      const records = [];
      fs.createReadStream(path.join('sobjects', file))
        .on('data', row => records.push(row))
        .on('end', async (rowCount) => {
          console.log(`Read ${rowCount} rows from ${file}`);

          for (let record of records) {
            // Ignore Id "000000000000000AAA"
            if (record.Id !== '000000000000000AAA') {
              let retried = false;

              const getDependencies = async () => {
                try {
                  // Query the metadata component dependencies for this Id
                  const dependencies = await conn.tooling.query(`SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId = '${record.Id}'`);

                  dependencies.records.forEach(dependency => {
                    appendCSVLine(dependenciesFile, dependency);
                  });
                } catch (e) {
                  // If it was a timeout error and we haven't retried yet
                  if (e.message.includes('timeout') && !retried) {
                    retried = true;

                    // Wait 10 seconds and retry
                    setTimeout(getDependencies, 10000);
                  } else {
                    // Log error
                    appendCSVLine(errorsFile, {
                      'SObjectName': sobjectName,
                      'Id': record.Id,
                      'Error': e.message
                    });
                  }
                }
              };

              await getDependencies();
            }
          }

          bar.tick();
        });
    }

    dependenciesFile.end();
    errorsFile.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();

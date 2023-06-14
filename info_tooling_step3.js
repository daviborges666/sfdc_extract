require("dotenv").config();
const jsforce = require("jsforce");
const fs = require("fs/promises");
const ProgressBar = require("progress");
const path = require("path");
const csv = require("csv-parser"); // csv-parser library

// Define your Salesforce credentials
const username = process.env.SFDC_USERNAME;
const password = process.env.SFDC_PASSWORD;
const loginUrl = process.env.SFDC_LOGINURL;

// Create a connection to Salesforce
const conn = new jsforce.Connection({
  loginUrl: loginUrl,
  version: "57.0", // Set your desired API version here
});

async function appendCSVLine(file, data) {
  await fs.appendFile(
    file,
    Object.values(data)
      .map((value) => `"${value}"`)
      .join(",") + "\n"
  );
}

async function main() {
  try {
    try {
      await conn.login(username, password);
    } catch (e) {
      await fs.appendFile(
        "dependencies_error.csv",
        `Error logging in: ${e.message}\n`
      );
      throw e; // rethrow the error after logging
    }

    // Get a list of CSV files in 'sobjects' subfolder
    const files = await fs
      .readdir("sobjects")
      .filter((file) => file.endsWith(".csv"));

    const bar = new ProgressBar(":bar :current/:total SObjects processed", {
      total: files.length,
    });

    // Write headers
    await appendCSVLine("dependencies.csv", {
      MetadataComponentId: "MetadataComponentId",
      MetadataComponentName: "MetadataComponentName",
      MetadataComponentType: "MetadataComponentType",
      RefMetadataComponentId: "RefMetadataComponentId",
      RefMetadataComponentName: "RefMetadataComponentName",
      RefMetadataComponentType: "RefMetadataComponentType",
    });
   
    for (let file of files) {
      const sobjectName = path.basename(file, ".csv");

      const records = [];
      fs.createReadStream(path.join("sobjects", file))
        .pipe(csv())
        .on("data", (row) => records.push(row))
        .on("end", async () => {
          console.log(`Read ${records.length} rows from ${file}`);

          for (let record of records) {
            // Ignore Id "000000000000000AAA"
            if (record.Id !== "000000000000000AAA") {
              let retried = false;

              const getDependencies = async () => {
                try {
                  // Query the metadata component dependencies for this Id
                  const dependencies = await conn.tooling.query(
                    `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId = '${record.Id}'`
                  );

                  for (let dependency of dependencies.records) {
                    delete dependency.attributes; // Remove the attributes element
                    await appendCSVLine("dependencies.csv", dependency);
                  }
                } catch (e) {
                  // If it was a timeout error and we haven't retried yet
                  if (e.message.includes("timeout") && !retried) {
                    retried = true;

                    // Wait 10 seconds and retry
                    setTimeout(getDependencies, 10000);
                  } else {
                    // Log error
                    await appendCSVLine("dependencies_error.csv", {
                      SObjectName: sobjectName,
                      Id: record.Id,
                      Error: e.message,
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
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main();

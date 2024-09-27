const mongoose = require('mongoose');

const chalk = require('chalk');
//const clipboardy = require('clipboardy');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'duonat'
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Could not connect to MongoDB:', err);
    process.exit(1);
  });

// Define schemas
const taxonInfoSchema = new mongoose.Schema({
    taxonId: { type: String, index: true },
    taxonName: { type: String, index: true },
    vernacularName: String,
    ancestryIds: [Number],
    rank: String,
    taxonFacts: [String],
    range: [String],
    hints: [String],
    enabled: { type: Boolean, default: false }
}, { strict: false });

const taxonPairSchema = new mongoose.Schema({
    pairID: String,
    pairName: String,
    level: String,
    tags: [String],
    taxa: [Number],
    taxonNames: [String],
    range: [String],
    enabled: { type: Boolean, default: false }
}, { strict: false });

const taxonHierarchySchema = new mongoose.Schema({
    taxonId: String,
    taxonName: String,
    vernacularName: String,
    rank: String,
    parentId: String
}, { strict: false });

const TaxonInfo = mongoose.model('TaxonInfo', taxonInfoSchema, 'taxonInfo');
const TaxonPair = mongoose.model('TaxonPair', taxonPairSchema, 'taxonPairs');
const TaxonHierarchy = mongoose.model('TaxonHierarchy', taxonHierarchySchema, 'taxonHierarchy');

// File paths
const INPUT_FILE = '../data/processing/data_entry_workflow/1newTaxonInputPairs.txt';
const PERPLEXITY_FILE = '../data/processing/data_entry_workflow/3perplexityData.json';

// Helper functions
async function fetchTaxonDetails(taxonName) {
    if (!taxonName || typeof taxonName !== 'string') {
        throw new Error('Invalid taxon name provided');
    }
    try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
        const data = await response.json();
        if (data.results.length > 0) {
            const result = data.results[0];
            return {
                id: result.id,
                taxonName: result.name,
                vernacularName: result.preferred_common_name ? capitalizeFirstLetter(result.preferred_common_name) : '-',
                rank: capitalizeFirstLetter(result.rank)
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching taxon details for ${taxonName}:`, error);
        return null;
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

async function promptForCorrection(taxonName) {
    console.log(`Taxon '${taxonName}' not found. Please choose an option:`);
    console.log("1. Enter a correction");
    console.log("2. Skip this taxon");
    
    const choice = await promptUser("Enter your choice (1 or 2): ", val => ['1', '2'].includes(val));
    
    if (choice === '1') {
        return await promptUser(`Enter the correct name for '${taxonName}': `);
    } else {
        return null;
    }
}

// Helper functions for colored console output
const logSuccess = (message) => console.log(chalk.green(message));
const logError = (message) => console.error(chalk.red(message));
const logNeutral = (message) => console.log(chalk.blue(message));
const logWarning = (message) => console.log(chalk.yellow(message));

// backup and restore db collections
const BACKUP_DIR = path.join(__dirname, 'backups');

async function backupCollections() {
    console.log("Backing up MongoDB collections...");
    try {
        // Ensure backup directory exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Rename old backups
        const files = await fs.readdir(BACKUP_DIR);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(BACKUP_DIR, file);
                const newFilePath = path.join(BACKUP_DIR, `${file}.old`);
                await fs.rename(filePath, newFilePath);
                console.log(`Renamed ${file} to ${file}.old`);
            }
        }

        // Get all collection names
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`Backing up collection: ${collectionName}`);
            
            // Fetch all documents from the collection
            const documents = await mongoose.connection.db.collection(collectionName).find({}).toArray();
            
            // Write to JSON file
            const backupPath = path.join(BACKUP_DIR, `${collectionName}.json`);
            await fs.writeFile(backupPath, JSON.stringify(documents, null, 2));
            
            console.log(`Backup completed for ${collectionName}`);
        }
        
        console.log('All collections backed up successfully');
    } catch (error) {
        console.error('Error during backup:', error);
    }
}

async function restoreCollections() {
    console.log("Restoring MongoDB collections...");
    try {
        const confirmed = await promptUser('WARNING: This will overwrite all data in MongoDB. Are you sure you want to proceed? (yes/no): ', 
            val => ['yes', 'no'].includes(val.toLowerCase()));
        
        if (confirmed.toLowerCase() !== 'yes') {
            console.log('Restore operation cancelled.');
            return;
        }

        // Get all JSON files in the backup directory
        const backupFiles = await fs.readdir(BACKUP_DIR);
        const jsonFiles = backupFiles.filter(file => file.endsWith('.json'));
        
        for (const file of jsonFiles) {
            const collectionName = path.parse(file).name;
            console.log(`Restoring collection: ${collectionName}`);
            
            // Read the JSON file
            const backupPath = path.join(BACKUP_DIR, file);
            const fileContent = await fs.readFile(backupPath, 'utf8');
            const documents = JSON.parse(fileContent);
            
            // Clear existing data in the collection
            await mongoose.connection.db.collection(collectionName).deleteMany({});
            
            // Insert the backup data
            if (documents.length > 0) {
                await mongoose.connection.db.collection(collectionName).insertMany(documents);
            }
            
            console.log(`Restore completed for ${collectionName}`);
        }
        
        console.log('All collections restored successfully');
    } catch (error) {
        console.error('Error during restore:', error);
    }
}

// main code
async function fetchTaxonById(taxonId) {
    if (!taxonId || isNaN(taxonId)) {
        throw new Error('Invalid taxon ID provided');
    }
    try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.results.length > 0) {
            const result = data.results[0];
            return {
                taxonName: result.name,
                vernacularName: result.preferred_common_name ? capitalizeFirstLetter(result.preferred_common_name) : '-',
                rank: capitalizeFirstLetter(result.rank)
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching taxon details by ID ${taxonId}:`, error);
        return null;
    }
}

async function fetchAncestry(taxonId) {
    if (!taxonId || isNaN(taxonId)) {
        throw new Error('Invalid taxon ID provided for ancestry fetch');
    }
    try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results[0].ancestors.map(ancestor => ancestor.id);
        }
        return [];
    } catch (error) {
        console.error(`Error fetching ancestry for taxon ID ${taxonId}:`, error);
        return [];
    }
}

async function processTaxa() {
    let taxaAdded = 0;
    let taxaSkipped = 0;
    try {
        const fileContent = await fs.readFile(INPUT_FILE, 'utf8');
        const taxonPairs = fileContent.split('\n').filter(line => line.trim() !== '');
        const corrections = {};

        for (const pair of taxonPairs) {
            const [taxon1, taxon2] = pair.split(',').map(t => t.trim());
            if (!taxon1 || !taxon2) {
                console.error(`Invalid pair in input file: ${pair}`);
                continue;
            }
            for (const taxonName of [taxon1, taxon2]) {
                let taxonToUse = taxonName;
                let existingTaxon = await TaxonInfo.findOne({ taxonName: taxonToUse });
                if (!existingTaxon) {
                    let taxonDetails = await fetchTaxonDetails(taxonToUse);
                    if (!taxonDetails) {
                        const correction = await promptForCorrection(taxonToUse);
                        if (correction) {
                            corrections[taxonToUse] = correction;
                            taxonToUse = correction;
                            taxonDetails = await fetchTaxonDetails(taxonToUse);
                        } else {
                            console.log(`Skipping taxon: ${taxonToUse}`);
                            continue;
                        }
                    }
                    if (taxonDetails) {
                        const ancestry = await fetchAncestry(taxonDetails.id);
                        const newTaxon = new TaxonInfo({
                            taxonId: taxonDetails.id.toString(),
                            taxonName: taxonDetails.taxonName,
                            vernacularName: capitalizeFirstLetter(taxonDetails.vernacularName),
                            ancestryIds: ancestry,
                            rank: capitalizeFirstLetter(taxonDetails.rank),
                            taxonFacts: [],
                            range: [],
                            enabled: false
                        });
                        await newTaxon.save();
                        logSuccess(`Added new taxon: ${taxonToUse}`);
                    } else {
                        logWarning(`Could not fetch details for: ${taxonToUse}`);
                    }
                } else {
                    logNeutral(`Taxon already exists: ${taxonToUse}`);
                }
            }
        }

        if (Object.keys(corrections).length > 0) {
            console.log("\nCorrections made during processing:");
            for (const [original, corrected] of Object.entries(corrections)) {
                console.log(`  ${original} -> ${corrected}`);
            }
            const updateInput = await promptUser("Do you want to update the input file with these corrections? (y/n): ", val => ['y', 'n'].includes(val.toLowerCase()));
            if (updateInput.toLowerCase() === 'y') {
                await updateInputFile(corrections);
            }
        }
    } catch (error) {
        console.error('Error processing taxa:', error);
    }
    console.log(`\nSummary:`);
    console.log(`Taxa added: ${taxaAdded}`);
    console.log(`Taxa skipped: ${taxaSkipped}`);
    await generatePerplexityPrompt();
}

async function updateInputFile(corrections) {
    try {
        const fileContent = await fs.readFile(INPUT_FILE, 'utf8');
        const updatedLines = fileContent.split('\n').map(line => {
            const taxa = line.split(',');
            const updatedTaxa = taxa.map(taxon => corrections[taxon.trim()] || taxon);
            return updatedTaxa.join(',');
        });
        await fs.writeFile(INPUT_FILE, updatedLines.join('\n'));
        console.log(`Input file ${INPUT_FILE} has been updated with corrections.`);
    } catch (error) {
        console.error('Error updating input file:', error);
    }
}

async function generatePerplexityPrompt() {
    try {
        const newTaxa = await TaxonInfo.find({ enabled: false });
        const taxonNames = newTaxa.map(taxon => taxon.taxonName);

        let prompt = "Use this prompt in Perplexity, then save its output in '3perplexityData.json':\n\n";
        prompt += await fs.readFile('../data/processing/data_entry_workflow/perplexityPrompt.txt', 'utf8');
        prompt += "\n\n";
        prompt += taxonNames.join('\n');

        console.log(prompt);

        // Optionally, write to a file
        //await fs.writeFile('perplexityPrompt.txt', prompt);
        //console.log("Perplexity prompt has been saved to 'perplexityPrompt.txt'");

        // If you want to copy to clipboard (Note: This won't work in all environments)
         //await clipboardy.write(prompt);
         //console.log("Perplexity prompt has been copied to the clipboard.");
    } catch (error) {
        console.error('Error generating Perplexity prompt:', error);
    }
}

async function mergePerplexityData() {
    let taxaUpdated = 0;
    let taxaNotFound = 0;
    try {
        const perplexityData = JSON.parse(await fs.readFile(PERPLEXITY_FILE, 'utf8'));
        for (const [taxonName, data] of Object.entries(perplexityData)) {
            const taxon = await TaxonInfo.findOne({ taxonName });
            if (taxon) {
                let updated = false;
                if (data.taxonFacts && data.taxonFacts.length > 0) {
                    taxon.taxonFacts = data.taxonFacts;
                    updated = true;
                }
                if (data.range && data.range.length > 0) {
                    taxon.range = data.range;
                    updated = true;
                }
                if (updated) {
                    await taxon.save();
                    taxaUpdated++;
                    logSuccess(`Updated ${taxonName} with Perplexity data`);
                    console.log(`Updated ${taxonName} with Perplexity data`);
                } else {
                    logNeutral(`No new data to update for ${taxonName}`);
                }
            } else {
                logWarning(`Taxon not found: ${taxonName}`);
                taxaNotFound++;
            }
        }
    } catch (error) {
        console.error('Error merging Perplexity data:', error);
    }
    console.log(`\nSummary:`);
    console.log(`Taxa updated with Perplexity data: ${taxaUpdated}`);
    console.log(`Taxa not found: ${taxaNotFound}`);
}

async function createTaxonPairs() {
    let pairsCreated = 0;
    let pairsSkipped = 0;
    try {
        const fileContent = await fs.readFile(INPUT_FILE, 'utf8');
        const taxonPairs = fileContent.split('\n').filter(line => line.trim() !== '');

        for (const pair of taxonPairs) {
            const [taxon1, taxon2] = pair.split(',').map(t => t.trim());
            if (!taxon1 || !taxon2) {
                console.error(`Invalid pair in input file: ${pair}`);
                continue;
            }
            const taxonInfo1 = await TaxonInfo.findOne({ taxonName: taxon1 });
            const taxonInfo2 = await TaxonInfo.findOne({ taxonName: taxon2 });

            if (taxonInfo1 && taxonInfo2) {
                const existingPair = await TaxonPair.findOne({
                    taxa: { $all: [taxonInfo1.taxonId, taxonInfo2.taxonId] }
                });

                if (!existingPair) {
                    const newPairID = await getNextPairID();
                    const pairRange = taxonInfo1.range.filter(r => taxonInfo2.range.includes(r));
                    const newPair = new TaxonPair({
                        pairID: newPairID,
                        pairName: `${taxon1} vs ${taxon2}`,
                        level: "0",
                        tags: [],
                        taxa: [parseInt(taxonInfo1.taxonId), parseInt(taxonInfo2.taxonId)],
                        taxonNames: [taxon1, taxon2],
                        range: pairRange,
                        enabled: false
                    });
                    await newPair.save();
                    logSuccess(`Created new pair: ${taxon1} vs ${taxon2} with ID ${newPairID}`);
                    pairsCreated++;
                } else {
                    logNeutral(`Pair already exists: ${taxon1} vs ${taxon2}`);
                    pairsSkipped++;
                }
            } else {
                logWarning(`Could not create pair: ${taxon1} vs ${taxon2} - missing taxon info`);
                pairsSkipped++;
            }
        }
    } catch (error) {
        console.error('Error creating taxon pairs:', error);
    }
    console.log(`\nSummary:`);
    console.log(`Pairs created: ${pairsCreated}`);
    console.log(`Pairs skipped: ${pairsSkipped}`);
}

async function getNextPairID() {
    try {
        const allPairs = await TaxonPair.find({}, { pairID: 1 }).lean();
        console.log(`Total pairs found: ${allPairs.length}`);
        if (allPairs.length > 0) {
            const highestID = Math.max(...allPairs.map(pair => parseInt(pair.pairID, 10)));
            console.log(`Highest existing pairID: ${highestID}`);
            const nextID = (highestID + 1).toString();
            console.log(`Next pairID to be used: ${nextID}`);
            return nextID;
        }
        console.log('No existing pairs found. Starting with pairID: 1');
        return "1";
    } catch (error) {
        console.error('Error getting next pair ID:', error);
        throw error;
    }
}

async function updatePairMetadata() {
    try {
        const pairs = await TaxonPair.find({ level: "0" });
        if (pairs.length === 0) {
            console.log("No pairs found with level 0.");
            return;
        }

        console.log(`Found ${pairs.length} pairs with level 0.`);

        for (const pair of pairs) {
            console.log(`\nPair ${pair.pairID}: ${pair.taxonNames.join(', ')}`);
            
            pair.level = await promptUser("Enter level (1-3): ", val => ['1','2','3'].includes(val));
            
            pair.pairName = await promptUser("Enter a name for this pair: ");
            
            const tagsInput = await promptUser("Enter tags (comma-separated): ");
            pair.tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
            
            await pair.save();
        }
        console.log("Pair metadata updated successfully.");
    } catch (error) {
        console.error('Error updating pair metadata:', error);
    }
}

async function updateHierarchy() {
    console.log("Updating taxon hierarchy...");
    try {
        const newTaxa = await TaxonInfo.find({ enabled: false });
        console.log(`Processing ${newTaxa.length} new taxa...`);

        for (const taxon of newTaxa) {
            console.log(`Processing ${taxon.taxonName}...`);
            const ancestryIds = [...taxon.ancestryIds].reverse(); // Reverse the order
            
            let shouldContinue = true;
            for (let i = 0; i < ancestryIds.length && shouldContinue; i++) {
                const currentId = ancestryIds[i].toString();
                const parentId = i === ancestryIds.length - 1 ? "48460" : ancestryIds[i+1].toString();

                const existingHierarchyEntry = await TaxonHierarchy.findOne({ taxonId: currentId });
                
                if (!existingHierarchyEntry) {
                    const taxonDetails = await fetchTaxonById(currentId);
                    if (taxonDetails) {
                        await TaxonHierarchy.create({
                            taxonId: currentId,
                            taxonName: taxonDetails.taxonName,
                            vernacularName: capitalizeFirstLetter(taxonDetails.vernacularName),
                            rank: capitalizeFirstLetter(taxonDetails.rank),
                            parentId: parentId
                        });
                        logSuccess(`Added new hierarchy entry for ${taxonDetails.taxonName}`);
                    } else {
                        logWarning(`Could not fetch details for taxon ID: ${currentId}`);
                    }
                } else {
                    console.log(`Hierarchy entry already exists for ${existingHierarchyEntry.taxonName}`);
                    shouldContinue = false; // Stop processing ancestors if one is found
                }
            }

            // Always add the current taxon to the hierarchy
            const taxonHierarchyEntry = await TaxonHierarchy.findOne({ taxonId: taxon.taxonId });
            if (!taxonHierarchyEntry) {
                await TaxonHierarchy.create({
                    taxonId: taxon.taxonId,
                    taxonName: taxon.taxonName,
                    vernacularName: capitalizeFirstLetter(taxon.vernacularName),
                    rank: capitalizeFirstLetter(taxon.rank),
                    parentId: taxon.ancestryIds.length > 0 ? taxon.ancestryIds[taxon.ancestryIds.length - 1].toString() : "48460"
                });
                console.log(`Added new hierarchy entry for ${taxon.taxonName}`);
            }

            // Mark the taxon as enabled after processing
            taxon.enabled = true;
            await taxon.save();
        }
        console.log("Taxon hierarchy update completed.");
    } catch (error) {
        console.error('Error updating hierarchy:', error);
    }
}

async function enableAllNewEntries() {
    try {
        const taxaResult = await TaxonInfo.updateMany({ enabled: false }, { enabled: true });
        const pairsResult = await TaxonPair.updateMany({ enabled: false }, { enabled: true });
        
        console.log(`Updated ${taxaResult.modifiedCount} taxa to enabled=true`);
        console.log(`Updated ${pairsResult.modifiedCount} taxon pairs to enabled=true`);
    } catch (error) {
        console.error('Error enabling new taxa and pairs:', error);
    }
}

async function promptUser(question, validator = () => true) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        const ask = () => {
            rl.question(question, answer => {
                if (validator(answer)) {
                    rl.close();
                    resolve(answer);
                } else {
                    console.log("Invalid input. Please try again.");
                    ask();
                }
            });
        };
        ask();
    });
}

async function displayMenu(lastAction) {
    console.log("\nChoose an action:");
    const options = [
        "Process taxa from input file",
        "Merge Perplexity data",
        "Create taxon pairs",
        "Update pair metadata",
        "Update taxon hierarchy",
        "Enable all new taxa and pairs",
        "Backup MongoDB collections",
        "Restore MongoDB collections"
    ];
    
    options.forEach((option, index) => {
        if (index + 1 === lastAction + 1) {
            console.log(chalk.green(`${index + 1}. ${option} <- Recommended next step`));
        } else {
            console.log(`${index + 1}. ${option}`);
        }
    });
    console.log(chalk.yellow("0. Exit"));

    const choice = await promptUser("Enter your choice (0-8): ", val => ['0','1','2','3','4','5','6','7','8'].includes(val));
    return parseInt(choice);
}

// Main function
async function main() {
    let lastAction = 0;
    while (true) {
        const choice = await displayMenu(lastAction);
        
        switch (choice) {
            case 1:
                await processTaxa();
                lastAction = 1;
                break;
            case 2:
                await mergePerplexityData();
                lastAction = 2;
                break;
            case 3:
                await createTaxonPairs();
                lastAction = 3;
                break;
            case 4:
                await updatePairMetadata();
                lastAction = 4;
                break;
            case 5:
                await updateHierarchy();
                lastAction = 5;
                break;
            case 6:
                await enableAllNewEntries();
                lastAction = 6;
                break;
            case 7:
                await backupCollections();
                lastAction = 0; // Reset to beginning after completing all steps
                break;
            case 8:
                await restoreCollections();
                lastAction = 8;
                break;
            case 0:
                console.log("Exiting...");
                await mongoose.connection.close();
                return;
            default:
                console.log("Invalid choice. Please try again.");
        }
    }
}

main().catch(console.error);

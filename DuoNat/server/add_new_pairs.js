const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs').promises;
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
                vernacularName: result.preferred_common_name || '-',
                rank: result.rank
            };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching taxon details for ${taxonName}:`, error);
        return null;
    }
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
                vernacularName: result.preferred_common_name || '-',
                rank: result.rank
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
                            vernacularName: taxonDetails.vernacularName,
                            ancestryIds: ancestry,
                            rank: taxonDetails.rank,
                            taxonFacts: [],
                            range: [],
                            enabled: false
                        });
                        await newTaxon.save();
                        console.log(`Added new taxon: ${taxonToUse}`);
                    } else {
                        console.log(`Could not fetch details for: ${taxonToUse}`);
                    }
                } else {
                    console.log(`Taxon already exists: ${taxonToUse}`);
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

async function mergePerplexityData() {
    let taxaUpdated = 0;
    let taxaNotFound = 0;
    try {
        const perplexityData = JSON.parse(await fs.readFile(PERPLEXITY_FILE, 'utf8'));
        for (const [taxonName, data] of Object.entries(perplexityData)) {
            const taxon = await TaxonInfo.findOne({ taxonName });
            if (taxon) {
                taxon.taxonFacts = data.taxonFacts || [];
                taxon.range = data.range || [];
                await taxon.save();
                console.log(`Updated ${taxonName} with Perplexity data`);
            } else {
                console.log(`Taxon not found: ${taxonName}`);
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
                    console.log(`Created new pair: ${taxon1} vs ${taxon2}`);
                } else {
                    console.log(`Pair already exists: ${taxon1} vs ${taxon2}`);
                }
            } else {
                console.log(`Could not create pair: ${taxon1} vs ${taxon2} - missing taxon info`);
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
        const lastPair = await TaxonPair.findOne().sort('-pairID');
        return lastPair ? (parseInt(lastPair.pairID) + 1).toString() : "1";
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
        const confirm = await promptUser("Do you want to update these pairs? (y/n): ", val => ['y', 'n'].includes(val.toLowerCase()));
        
        if (confirm.toLowerCase() !== 'y') {
            console.log("Update cancelled.");
            return;
        }

        for (const pair of pairs) {
            console.log(`\nPair ${pair.pairID}: ${pair.taxonNames.join(', ')}`);
            
            pair.level = await promptUser("Enter level (1-3): ", val => ['1','2','3'].includes(val));
            
            const tagsInput = await promptUser("Enter tags (comma-separated): ");
            pair.tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
            
            pair.pairName = await promptUser("Enter a name for this pair: ");
            
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
        // Ensure the root "Life" taxon exists
        await TaxonHierarchy.findOneAndUpdate(
            { taxonId: "48460" },
            {
                taxonName: "Life",
                vernacularName: "-",
                rank: "Stateofmatter",
                parentId: null
            },
            { upsert: true }
        );

        const newTaxa = await TaxonInfo.find({ enabled: false });
        console.log(`Processing ${newTaxa.length} new taxa...`);

        for (const taxon of newTaxa) {
            console.log(`Processing ${taxon.taxonName}...`);
            const ancestryIds = taxon.ancestryIds || [];
            
            for (let i = 0; i < ancestryIds.length; i++) {
                const currentId = ancestryIds[i].toString();
                const parentId = i === 0 ? "48460" : ancestryIds[i-1].toString();

                const existingHierarchyEntry = await TaxonHierarchy.findOne({ taxonId: currentId });
                
                if (!existingHierarchyEntry) {
                    const taxonDetails = await fetchTaxonById(currentId);
                    if (taxonDetails) {
                        await TaxonHierarchy.create({
                            taxonId: currentId,
                            taxonName: taxonDetails.taxonName,
                            vernacularName: taxonDetails.vernacularName,
                            rank: taxonDetails.rank,
                            parentId: parentId
                        });
                        console.log(`Added new hierarchy entry for ${taxonDetails.taxonName}`);
                    } else {
                        console.log(`Could not fetch details for taxon ID: ${currentId}`);
                    }
                } else {
                    console.log(`Hierarchy entry already exists for ${existingHierarchyEntry.taxonName}`);
                }
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

async function enableAllNewTaxa() {
    try {
        const result = await TaxonInfo.updateMany({ enabled: false }, { enabled: true });
        console.log(`Updated ${result.modifiedCount} taxa to enabled=true`);
    } catch (error) {
        console.error('Error enabling new taxa:', error);
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
        "Enable all new taxa"
    ];
    
    options.forEach((option, index) => {
        if (index + 1 === lastAction + 1) {
            console.log(`${index + 1}. ${option} <- Recommended next step`);
        } else {
            console.log(`${index + 1}. ${option}`);
        }
    });
    console.log("0. Exit");

    const choice = await promptUser("Enter your choice (0-6): ", val => ['0','1','2','3','4','5','6'].includes(val));
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
                await enableAllNewTaxa();
                lastAction = 0;  // Reset to beginning after completing all steps
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

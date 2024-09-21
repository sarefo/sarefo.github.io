const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const BACKUP_DIR = path.join(__dirname, 'backups');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askForConfirmation() {
    return new Promise((resolve) => {
        rl.question('WARNING: This will overwrite all data in MongoDB. Are you sure you want to proceed? (yes/no): ', (answer) => {
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

async function restoreCollections() {
    try {
        console.log('Connected to MongoDB');
        
        const confirmed = await askForConfirmation();
        if (!confirmed) {
            console.log('Restore operation cancelled.');
            return;
        }

        // Get all JSON files in the backup directory
        const backupFiles = fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith('.json'));
        
        for (const file of backupFiles) {
            const collectionName = path.parse(file).name;
            console.log(`Restoring collection: ${collectionName}`);
            
            // Read the JSON file
            const backupPath = path.join(BACKUP_DIR, file);
            const documents = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
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
    } finally {
        rl.close();
        mongoose.connection.close();
    }
}

// Connect to MongoDB and start the restore process
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'duonat'
}).then(restoreCollections)
  .catch(err => console.error('Could not connect to MongoDB:', err));

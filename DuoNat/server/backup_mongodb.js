const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BACKUP_DIR = path.join(__dirname, 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

// Function to rename existing backup files
function renameOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR);
    files.forEach(file => {
        if (file.endsWith('.json')) {
            const filePath = path.join(BACKUP_DIR, file);
            const newFilePath = path.join(BACKUP_DIR, `${file}.old`);
            fs.renameSync(filePath, newFilePath);
            console.log(`Renamed ${file} to ${file}.old`);
        }
    });
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'duonat'
}).then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Rename old backups
        renameOldBackups();

        // Get all collection names
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`Backing up collection: ${collectionName}`);
            
            // Fetch all documents from the collection
            const documents = await mongoose.connection.db.collection(collectionName).find({}).toArray();
            
            // Write to JSON file
            const backupPath = path.join(BACKUP_DIR, `${collectionName}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(documents, null, 2));
            
            console.log(`Backup completed for ${collectionName}`);
        }
        
        console.log('All collections backed up successfully');
    } catch (error) {
        console.error('Error during backup:', error);
    } finally {
        mongoose.connection.close();
    }
}).catch(err => console.error('Could not connect to MongoDB:', err));

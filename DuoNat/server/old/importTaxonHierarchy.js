const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const dbName = 'duonat'; // Make sure this matches your actual database name
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName
});

const taxonHierarchySchema = new mongoose.Schema({
  taxonId: String,
  taxonName: String,
  vernacularName: String,
  rank: String,
  parentId: String
}, { strict: false });

const TaxonHierarchy = mongoose.model('TaxonHierarchy', taxonHierarchySchema, 'taxonHierarchy');

async function importData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const data = JSON.parse(fs.readFileSync('../data/taxonHierarchy.json', 'utf8'));

    const transformedData = Object.entries(data).map(([key, value]) => ({
      taxonId: key,
      ...value
    }));

    await TaxonHierarchy.deleteMany({}); // Clear existing data
    const result = await TaxonHierarchy.insertMany(transformedData);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in the database:', collections.map(c => c.name));

    const count = await TaxonHierarchy.countDocuments();
    console.log(`Number of documents in taxonHierarchy collection: ${count}`);

    console.log(`${result.length} documents inserted`);
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

importData();

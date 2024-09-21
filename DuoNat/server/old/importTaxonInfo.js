const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const dbName = 'duonat'; // Make sure this matches your actual database name
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName
});

const taxonInfoSchema = new mongoose.Schema({
  taxonId: String,
  taxonName: String,
  vernacularName: String,
  ancestryIds: [Number],
  rank: String,
  taxonFacts: [String],
  range: [String],
  hints: [String]
}, { strict: false });

const TaxonInfo = mongoose.model('TaxonInfo', taxonInfoSchema, 'taxonInfo');

async function importData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const data = JSON.parse(fs.readFileSync('../data/taxonInfo.json', 'utf8'));

    const transformedData = Object.entries(data).map(([key, value]) => ({
      taxonId: key,
      ...value
    }));

    await TaxonInfo.deleteMany({}); // Clear existing data
    const result = await TaxonInfo.insertMany(transformedData);

// Add this after the insertMany operation in importTaxonInfo.js
const collections = await mongoose.connection.db.listCollections().toArray();
console.log('Collections in the database:', collections.map(c => c.name));

const count = await TaxonInfo.countDocuments();
console.log(`Number of documents in taxonInfo collection: ${count}`);


    console.log(`${result.length} documents inserted`);
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

importData();

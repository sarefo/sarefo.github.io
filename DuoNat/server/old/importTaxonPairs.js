const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const dbName = 'duonat';
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName
});

const taxonPairSchema = new mongoose.Schema({
  pairID: String,
  pairName: String,
  level: String,
  tags: [String],
  taxa: [Number],
  taxonNames: [String],
  range: [String]
}, { strict: false });

const TaxonPair = mongoose.model('TaxonPair', taxonPairSchema, 'taxonPairs');

async function importData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const data = JSON.parse(fs.readFileSync('../data/taxonPairs.json', 'utf8'));

    const transformedData = Object.entries(data).map(([key, value]) => ({
      pairID: key,
      ...value
    }));

    await TaxonPair.deleteMany({}); // Clear existing data
    const result = await TaxonPair.insertMany(transformedData);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in the database:', collections.map(c => c.name));

    const count = await TaxonPair.countDocuments();
    console.log(`Number of documents in taxonPairs collection: ${count}`);

    console.log(`${result.length} documents inserted`);
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

importData();

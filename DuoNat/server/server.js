console.log("first line");
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'duonat' // Make sure this matches your database name
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', // Be more specific in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    
    // Test query
    const testDoc = await mongoose.connection.db.collection('taxonInfo').findOne({});
    console.log('Test document from taxonInfo collection:', testDoc);
  })
  .catch(err => console.error('Could not connect to MongoDB:', err));

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Define Taxon Schema
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


const taxonPairSchema = new mongoose.Schema({
  pairID: String,
  pairName: String,
  level: String,
  tags: [String],
  taxa: [Number],
  taxonNames: [String],
  range: [String]
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

// Add routes to fetch data
app.get('/api/taxonInfo', async (req, res) => {
  try {
    const taxonInfo = await TaxonInfo.find({}).lean();
    console.log('Fetched taxon info:', taxonInfo.length, 'documents');
    if (taxonInfo.length > 0) {
      console.log('Sample document:', JSON.stringify(taxonInfo[0], null, 2));
    }
    res.json(taxonInfo);
  } catch (error) {
    console.error('Error fetching taxon info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/taxonPairs', async (req, res) => {
  try {
    console.log('Fetching taxon pairs...');
    const taxonPairs = await TaxonPair.find({}).lean();
    console.log('Fetched taxon pairs:', taxonPairs.length, 'documents');
    
    if (taxonPairs.length === 0) {
      console.log('No documents found in taxonPairs collection');
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections in the database:', collections.map(c => c.name));
      const count = await TaxonPair.countDocuments();
      console.log(`Number of documents in taxonPairs collection: ${count}`);
      
      // Try to fetch a single document directly from MongoDB
      const db = mongoose.connection.db;
      const collection = db.collection('taxonPairs');
      const sampleDocument = await collection.findOne({});
      console.log('Sample document from direct MongoDB query:', sampleDocument);
    } else if (taxonPairs.length > 0) {
      console.log('Sample document:', JSON.stringify(taxonPairs[0], null, 2));
    }
    
    res.json(taxonPairs);
  } catch (error) {
    console.error('Error fetching taxon pairs:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

app.get('/api/taxonHierarchy', async (req, res) => {
  try {
    console.log('Fetching taxon hierarchy...');
    console.log('TaxonHierarchy model:', TaxonHierarchy);
    console.log('Collection name:', TaxonHierarchy.collection.name);
    
    const taxonHierarchy = await TaxonHierarchy.find({}).lean();
    console.log('Fetched taxon hierarchy:', taxonHierarchy.length, 'documents');
    
    if (taxonHierarchy.length === 0) {
      console.log('No documents found in taxonHierarchy collection');
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections in the database:', collections.map(c => c.name));
      const count = await TaxonHierarchy.countDocuments();
      console.log(`Number of documents in taxonHierarchy collection: ${count}`);
      
      // Try to fetch a single document directly from MongoDB
      const db = mongoose.connection.db;
      const collection = db.collection('taxonHierarchy');
      const sampleDocument = await collection.findOne({});
      console.log('Sample document from direct MongoDB query:', sampleDocument);
    } else if (taxonHierarchy.length > 0) {
      console.log('Sample document:', JSON.stringify(taxonHierarchy[0], null, 2));
    }
    
    const hierarchyObject = taxonHierarchy.reduce((acc, item) => {
      acc[item.taxonId] = item;
      return acc;
    }, {});
    console.log('Sending response with', Object.keys(hierarchyObject).length, 'items');
    res.json(hierarchyObject);
  } catch (error) {
    console.error('Error fetching taxon hierarchy:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

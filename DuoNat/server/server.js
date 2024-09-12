console.log("first line");
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*', // Be more specific in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    console.log('MongoDB URI:', process.env.MONGODB_URI);
  })
  .catch(err => console.error('Could not connect to MongoDB:', err));

app.get('/api/taxonInfo', async (req, res) => {
  try {
    const taxonInfo = await TaxonInfo.find({});
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

const TaxonInfo = mongoose.model('TaxonInfo', taxonInfoSchema, 'taxonInfo');

// Add routes to fetch data
app.get('/api/taxonInfo', async (req, res) => {
  try {
    const taxonInfo = await TaxonInfo.find({});
    res.json(taxonInfo);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.send('Welcome to DuoNat server!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


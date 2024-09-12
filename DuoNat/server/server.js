const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Define Taxon Schema
const taxonSchema = new mongoose.Schema({
  taxonId: String,
  taxonName: String,
  vernacularName: String,
  ancestryIds: [Number],
  rank: String,
  taxonFacts: [String],
  range: [String],
  hints: [String]
});

const Taxon = mongoose.model('Taxon', taxonSchema);

// New route to fetch taxon info
app.get('/api/taxonInfo/:id', async (req, res) => {
  try {
    const taxon = await Taxon.findOne({ taxonId: req.params.id });
    if (taxon) {
      res.json(taxon);
    } else {
      res.status(404).json({ message: 'Taxon not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Define Schemata

const taxonInfoSchema = new mongoose.Schema({
  taxonId: { type: String, index: true },
  taxonName: { type: String, index: true },
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

// Connecting to DB

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'duonat'
}).then(async () => {
  console.log('Connected to MongoDB');
  
  // Create index if it doesn't exist
  try {
    await TaxonInfo.createIndexes();
    console.log('Indexes for TaxonInfo created successfully');
    
    // Test query
    const testDoc = await TaxonInfo.findOne({}).lean();
  } catch (error) {
    console.error('Error creating indexes or querying:', error);
  }
}).catch(err => console.error('Could not connect to MongoDB:', err));

const TaxonInfo = mongoose.model('TaxonInfo', taxonInfoSchema, 'taxonInfo');
const TaxonPair = mongoose.model('TaxonPair', taxonPairSchema, 'taxonPairs');
const TaxonHierarchy = mongoose.model('TaxonHierarchy', taxonHierarchySchema, 'taxonHierarchy');

app.use(cors({
  origin: '*', // Be more specific in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working' });
});


// Add routes to fetch data

app.get('/api/taxonInfo', async (req, res) => {
    try {
        const taxonName = req.query.taxonName;
        const fields = req.query.fields ? req.query.fields.split(',') : null;

        let query = TaxonInfo.findOne({ taxonName: { $regex: new RegExp(`^${taxonName}$`, 'i') } });
        if (fields) {
            query = query.select(fields.join(' '));
        }
        const taxon = await query.lean();

        if (!taxon) {
            return res.status(404).json({ message: 'Taxon not found' });
        }
        res.json(taxon);
    } catch (error) {
        console.error('Error fetching taxon info:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/bulkTaxonInfo', async (req, res) => {
    try {
        const { taxonNames } = req.body;
        if (!Array.isArray(taxonNames)) {
            return res.status(400).json({ message: 'Invalid input: taxonNames should be an array' });
        }

        const taxonInfo = await TaxonInfo.find({ 
            taxonName: { $in: taxonNames } 
        }).select('taxonName vernacularName').lean();

        const taxonMap = taxonInfo.reduce((acc, taxon) => {
            acc[taxon.taxonName] = taxon.vernacularName;
            return acc;
        }, {});

        res.json(taxonMap);
    } catch (error) {
        console.error('Error fetching bulk taxon info:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/taxonInfo/:taxonId', async (req, res) => {
    try {
        const taxonId = req.params.taxonId;
        const fields = req.query.fields ? req.query.fields.split(',') : null;

        let query = TaxonInfo.findOne({ taxonId: taxonId });
        if (fields) {
            query = query.select(fields.join(' '));
        }
        const taxon = await query.lean();

        if (!taxon) {
            return res.status(404).json({ message: 'Taxon not found' });
        }
        res.json(taxon);
    } catch (error) {
        console.error('Error fetching taxon info:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/taxonHints/:taxonId', async (req, res) => {
    try {
        const taxonId = req.params.taxonId;
        const taxon = await TaxonInfo.findOne({ taxonId: taxonId }).select('hints').lean();
        if (!taxon) {
            return res.status(404).json({ message: 'Taxon hints not found' });
        }
        res.json({ hints: taxon.hints || [] });
    } catch (error) {
        console.error('Error fetching taxon hints:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



// TaxonPairs:
app.post('/api/taxonPairs', async (req, res) => {
    try {
        const { filters, searchTerm, page, pageSize } = req.body;
        const query = buildMongoQuery(filters, searchTerm);
        const options = {
            skip: (page - 1) * pageSize,
            limit: pageSize,
            sort: { pairID: 1 }
        };

        const [results, totalCount] = await Promise.all([
            TaxonPair.find(query, null, options).lean(),
            TaxonPair.countDocuments(query)
        ]);

        res.json({
            results,
            totalCount,
            hasMore: totalCount > page * pageSize
        });
    } catch (error) {
        console.error('Error fetching paginated taxon pairs:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/taxonPairs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const filters = JSON.parse(req.query.filters || '{}');
    const searchTerm = req.query.search || '';

    const query = buildMongoQuery(filters, searchTerm);
    const totalCount = await TaxonPair.countDocuments(query);
    const pairs = await TaxonPair.find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({
      results: pairs,
      totalCount,
      hasMore: totalCount > page * pageSize
    });
  } catch (error) {
    console.error('Error fetching taxon pairs:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
});

app.get('/api/taxonPairs/levelCounts', async (req, res) => {
    try {
        const filters = JSON.parse(req.query.filters || '{}');
        const query = buildMongoQuery(filters);
        
        // Remove the level filter for this count
        delete query.level;

        const counts = await TaxonPair.aggregate([
            { $match: query },
            { 
                $group: { 
                    _id: null,
                    total: { $sum: 1 },
                    levels: { 
                        $push: { 
                            level: "$level", 
                            count: 1 
                        } 
                    }
                } 
            },
            { 
                $project: { 
                    _id: 0,
                    total: 1,
                    levels: {
                        $arrayToObject: {
                            $map: {
                                input: ["1", "2", "3"],
                                as: "level",
                                in: {
                                    k: "$$level",
                                    v: {
                                        $size: {
                                            $filter: { input: "$levels", cond: { $eq: ["$$this.level", "$$level"] } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } 
            }
        ]);

        const result = counts.length > 0 ? counts[0] : { total: 0, levels: { '1': 0, '2': 0, '3': 0 } };
        res.json(result);
    } catch (error) {
        console.error('Error fetching level counts:', error);
        res.status(500).json({ message: 'Server error', error: error.toString() });
    }
});

app.get('/api/taxonPairs/:pairID', async (req, res) => {
    try {
        const pairID = req.params.pairID;
        const pair = await TaxonPair.findOne({ pairID: pairID }).lean();
        if (!pair) {
            return res.status(404).json({ message: 'Pair not found' });
        }
        res.json(pair);
    } catch (error) {
        console.error('Error fetching pair by ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// TaxonHierarchy:
app.get('/api/taxonHierarchy', async (req, res) => {
  try {
    console.log('Fetching taxon hierarchy...');
    //console.log('TaxonHierarchy model:', TaxonHierarchy);
    //console.log('Collection name:', TaxonHierarchy.collection.name);
    
    const taxonHierarchy = await TaxonHierarchy.find({}).lean();
    //console.log('Fetched taxon hierarchy:', taxonHierarchy.length, 'documents');
    
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
      //console.log('Sample document from direct MongoDB query:', sampleDocument);
    } else if (taxonHierarchy.length > 0) {
      //console.log('Sample document:', JSON.stringify(taxonHierarchy[0], null, 2));
    }
    
    const hierarchyObject = taxonHierarchy.reduce((acc, item) => {
      acc[item.taxonId] = item;
      return acc;
    }, {});
    //console.log('Sending response with', Object.keys(hierarchyObject).length, 'items');
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


function buildMongoQuery(filters, searchTerm) {
  const query = {};

  // Handle levels filter
  if (filters.levels && filters.levels.length > 0) {
    query.level = { $in: filters.levels };
  }

  // Handle ranges filter
  if (filters.ranges && filters.ranges.length > 0) {
    query.range = { $in: filters.ranges };
  }

  // Handle tags filter
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $all: filters.tags };
  }

  // Handle phylogeny filter
  if (filters.phylogenyId) {
    // This requires a more complex query, possibly using aggregation
    // For now, we'll use a simplified version
    query['taxa'] = { $elemMatch: { $eq: filters.phylogenyId } };
  }

  // Handle search term
  if (searchTerm) {
    query.$or = [
      { taxonNames: { $regex: searchTerm, $options: 'i' } },
      { pairName: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } },
      { pairID: searchTerm } // Exact match for pairID
    ];
  }

  return query;
}

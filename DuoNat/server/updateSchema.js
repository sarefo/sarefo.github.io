const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'duonat'
}).then(async () => {
  console.log('Connected to MongoDB');
  
  const TaxonInfo = mongoose.model('TaxonInfo', new mongoose.Schema({}, { strict: false }), 'taxonInfo');
  const TaxonPair = mongoose.model('TaxonPair', new mongoose.Schema({}, { strict: false }), 'taxonPairs');

  try {
    await TaxonInfo.updateMany({}, { $set: { enabled: true } });
    console.log('Updated TaxonInfo documents');

    await TaxonPair.updateMany({}, { $set: { enabled: true } });
    console.log('Updated TaxonPair documents');

  } catch (error) {
    console.error('Error updating documents:', error);
  } finally {
    mongoose.disconnect();
  }
}).catch(err => console.error('Could not connect to MongoDB:', err));

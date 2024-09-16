const mongoose = require('mongoose');

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

module.exports = TaxonPair;

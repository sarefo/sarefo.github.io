const mongoose = require('mongoose');

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

const TaxonInfo = mongoose.model('TaxonInfo', taxonInfoSchema, 'taxonInfo');

module.exports = TaxonInfo;

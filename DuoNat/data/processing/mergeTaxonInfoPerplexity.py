import json

# Load newTaxonInfo.json
with open('2newTaxonInfo.json', 'r') as file:
    new_taxon_info = json.load(file)

# Load perplexity_data.json
with open('5perplexityData.json', 'r') as file:
    perplexity_data = json.load(file)

# Merge the data
for taxon_id, taxon_data in new_taxon_info.items():
    taxon_name = taxon_data['taxonName']
    if taxon_name in perplexity_data:
        perplexity_info = perplexity_data[taxon_name]
        
        # Add taxonFacts from perplexity_data
        taxon_data['taxonFacts'] = perplexity_info.get('taxon_info', [])
        
        # Add distribution from perplexity_data
        taxon_data['distribution'] = perplexity_info.get('distribution', [])

# Save the merged data to a new file
with open('6newTaxonInfoWithPerplexity.json', 'w') as file:
    json.dump(new_taxon_info, file, indent=2)

print("Merged data saved to newTaxonInfoWithPerplexity.json")

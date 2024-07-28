import json

# Read taxonInfo.json
with open('../../data/taxonInfo.json', 'r') as f:
    taxon_info = json.load(f)

# Read taxaDistributions.json
with open('../../data/taxaDistributions.json', 'r') as f:
    taxa_distributions = json.load(f)

# Create a dictionary for quick lookup of distributions
distribution_dict = {item['taxonName']: item['distribution'] for item in taxa_distributions}

# Merge distribution data into taxon_info
for taxon_id, taxon_data in taxon_info.items():
    taxon_name = taxon_data['taxonName']
    if taxon_name in distribution_dict:
        taxon_data['distribution'] = distribution_dict[taxon_name]

# Write the merged data to taxonInfo2.json
with open('taxonInfo2.json', 'w') as f:
    json.dump(taxon_info, f, indent=2)

print("Merged data has been written to taxonInfo2.json")

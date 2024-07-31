import json
import os

# Define file paths
current_dir = os.path.dirname(os.path.realpath(__file__))
input_file = os.path.join(current_dir, '..', '..', 'data', 'setsInput.json')
taxon_info_file = os.path.join(current_dir, '..', '..', 'data', 'taxonInfo.json')
output_file = os.path.join(current_dir, '..', '..', 'data', 'taxonSets.json.new2')

# Load input data
with open(input_file, 'r') as f:
    input_data = json.load(f)

# Load taxon info data
with open(taxon_info_file, 'r') as f:
    taxon_info = json.load(f)

# Create a mapping of taxon names to IDs
taxon_name_to_id = {info['taxonName']: id for id, info in taxon_info.items()}

# Convert data
output_data = []
for index, item in enumerate(input_data, start=1):
    taxa_ids = []
    taxa_names = []
    for taxon_name in item['taxaNames']:
        if taxon_name in taxon_name_to_id:
            taxa_ids.append(int(taxon_name_to_id[taxon_name]))
            taxa_names.append(taxon_name)
        else:
            print(f"Warning: Taxon '{taxon_name}' not found in taxon info.")

    output_item = {
        "setID": str(index),
        "setName": item['setName'],
        "skillLevel": "",
        "tags": item['tags'],
        "taxa": taxa_ids,
        "taxaNames": taxa_names
    }
    output_data.append(output_item)

# Write output data
with open(output_file, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"Conversion complete. Output written to {output_file}")

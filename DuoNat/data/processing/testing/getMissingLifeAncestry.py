import json

def process_taxon_info(file_path):
    # Read the JSON file
    with open(file_path, 'r') as file:
        taxon_info = json.load(file)
    
    # Process each taxon
    for taxon_id, taxon_data in taxon_info.items():
        # Check if 48460 is not in the ancestryIds
        if 48460 not in taxon_data['ancestryIds']:
            print(taxon_data['taxonName'])

# Usage
file_path = 'taxonInfo.json'
process_taxon_info(file_path)

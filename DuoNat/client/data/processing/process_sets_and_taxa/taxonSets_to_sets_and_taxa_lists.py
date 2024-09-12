import json

def process_json_file(input_file, output_file1, output_file2):
    # Read the JSON file
    with open(input_file, 'r') as f:
        data = json.load(f)
    
    # Process and write to taxonSets.txt
    with open(output_file1, 'w') as f:
        for entry in data.values():
            f.write(','.join(entry['taxonNames']) + '\n')
    
    # Collect all unique taxonNames
    all_taxon_names = set()
    for entry in data.values():
        all_taxon_names.update(entry['taxonNames'])
    
    # Write unique taxonNames to taxonNames.txt
    with open(output_file2, 'w') as f:
        for name in sorted(all_taxon_names):
            f.write(name + '\n')

# File paths
input_file = '../../taxonSets.json'
output_file1 = 'taxonSets.txt'
output_file2 = 'taxonNames.txt'

# Process the files
process_json_file(input_file, output_file1, output_file2)

print(f"Processing complete. Output files created: {output_file1} and {output_file2}")

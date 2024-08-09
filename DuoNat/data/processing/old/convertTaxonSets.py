import json

def convert_taxon_sets(input_file, output_file):
    # Read the current taxonSets.json file
    with open(input_file, 'r') as f:
        taxon_sets = json.load(f)

    # Convert the array to an object with setID as keys
    converted_sets = {}
    for taxon_set in taxon_sets:
        set_id = taxon_set['setID']
        # Remove the setID from the set data since it's now the key
        del taxon_set['setID']
        converted_sets[set_id] = taxon_set

    # Write the converted data to the output file
    with open(output_file, 'w') as f:
        json.dump(converted_sets, f, indent=2)

    print(f"Conversion complete. Output written to {output_file}")

# Usage
input_file = '../taxonSets.json'
output_file = '../taxonSets_converted.json'
convert_taxon_sets(input_file, output_file)

import json
import os

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def save_json(data, file_path):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=2)

def get_taxon_id(taxon_name, taxon_info):
    for id, info in taxon_info.items():
        if info['taxonName'] == taxon_name:
            return int(id)
    return None

def main():
    # Define file paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    taxon_pairs_path = os.path.join(current_dir, '..', '..', 'data', 'taxonPairs.json')
    taxon_info_path = os.path.join(current_dir, '..', '..', 'data', 'taxonInfo.json')
    output_path = os.path.join(current_dir, '..', '..', 'data', 'taxonSets.json.new')

    # Load data
    taxon_pairs = load_json(taxon_pairs_path)
    taxon_info = load_json(taxon_info_path)

    # Convert data
    taxon_sets = []
    for i, pair in enumerate(taxon_pairs, start=1):
        taxon1_id = get_taxon_id(pair['taxon1'], taxon_info)
        taxon2_id = get_taxon_id(pair['taxon2'], taxon_info)
        
        if taxon1_id is None or taxon2_id is None:
            print(f"Warning: Could not find ID for one or both taxa in pair {pair}")
            continue

        taxon_set = {
            "setID": str(i),
            "setName": "",
            "skillLevel": "",
            "tags": [],
            "taxa": [taxon1_id, taxon2_id],
            "taxaNames": [pair['taxon1'], pair['taxon2']]
        }
        taxon_sets.append(taxon_set)

    # Save the new data
    save_json(taxon_sets, output_path)
    print(f"Conversion complete. New data saved to {output_path}")

if __name__ == "__main__":
    main()

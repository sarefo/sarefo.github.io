import json

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def get_taxa_from_a(data):
    return set(entry['taxonName'] for entry in data.values())

def get_taxa_from_b(data):
    taxa = set()
    for taxon_set in data.values():
        taxa.update(taxon_set['taxonNames'])
    return taxa

def main():
    # Load JSON files
    taxon_info = load_json('taxonInfo.json')
    taxon_sets = load_json('taxonSets.json')

    # Get taxa from both files
    taxa_a = get_taxa_from_a(taxon_info)
    taxa_b = get_taxa_from_b(taxon_sets)

    # Find taxa in B that are not in A
    missing_taxa = taxa_b - taxa_a

    # Print results
    if missing_taxa:
        print("Taxa in taxonSets.json that are not in taxonInfo.json:")
        for taxon in missing_taxa:
            print(f"- {taxon}")
    else:
        print("All taxa in taxonSets.json are present in taxonInfo.json.")

if __name__ == "__main__":
    main()

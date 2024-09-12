import json
from collections import Counter

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def save_json(data, file_path):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=2)

def get_common_range(taxon_info, taxa_ids):
    ranges = [set(taxon_info[str(taxon_id)]['range']) for taxon_id in taxa_ids]
    return list(set.intersection(*ranges))

def main():
    taxon_info = load_json('../../taxonInfo.json')
    taxon_sets = load_json('../../taxonSets.json')

    for taxon_set in taxon_sets:
        common_range = get_common_range(taxon_info, taxon_set['taxa'])
        taxon_set['range'] = common_range

    save_json(taxon_sets, './taxonSetsWithRange.json')

if __name__ == "__main__":
    main()

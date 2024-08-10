# input: 'newTaxonSetData.txt' > comma-separated taxa, one set per line
# output: newTaxonInfo.json for new taxa • newTaxonSets.json for new sets
# reads taxonInfo.json and taxonSets.json for context
# afterwards, get range + facts from perplexity: https://www.perplexity.ai/search/please-give-me-a-list-of-at-mo-gmq_93EyRqaxmtTbAgI9SQ

# sample entry for taxonInfo.json:
'''
  "62483": {
    "taxonName": "Tricholoma magnivelare",
    "vernacularName": "American matsutake",
    "ancestryIds": [
      48460,
      47170,
      47169,
      492000,
      50814,
      1094814,
      47167,
      787526,
      47498,
      62484,
      1444961,
      1377700,
      62483
    ],
    "rank": "Species",
    "taxonFacts": [
      "Highly prized edible mushroom in North America and Japan",
      "Forms mycorrhizal associations with conifer trees",
      "Has a distinctive cinnamon-like aroma"
    ],
    "range": [
      "NA"
    ]
  },
'''

# sample entry for taxonSets.json:
'''
  {
    "setID": "603",
    "setName": "Beetles and Thrips",
    "level": "2",
    "tags": [
      "beetles",
      "thrips"
    ],
    "taxa": [
      "83201",
      "47951"
    ],
    "taxonNames": [
      "Thysanoptera",
      "Staphylinidae"
    ]
  },
'''

import requests
import json
from time import sleep

def fetch_taxon_details(taxon_name):
    base_url = "https://api.inaturalist.org/v1/taxa/autocomplete"
    response = requests.get(f"{base_url}?q={taxon_name}")
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            return data['results'][0]
    return None

def fetch_ancestry(taxon_id):
    base_url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(base_url)
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            return data['results'][0]['ancestors']
    return []

def get_last_set_id(file_path):
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            return max(int(set_id) for set_id in data.keys())
    except FileNotFoundError:
        return 0

def load_existing_sets(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def is_duplicate_set(new_set, existing_sets):
    new_set_taxa = set(new_set)
    for existing_set in existing_sets.values():
        if set(existing_set['taxa']) == new_set_taxa:
            return True
    return False

def process_taxa(input_file, existing_taxon_file, new_taxon_file, existing_sets_file, new_sets_file, new_taxa_list_file):
    existing_taxa = {}
    new_taxa = {}
    new_sets = {}

    # Load existing taxa
    try:
        with open(existing_taxon_file, 'r') as f:
            existing_taxa = json.load(f)
    except FileNotFoundError:
        pass

    # Load existing sets
    existing_sets = load_existing_sets(existing_sets_file)

    # Get the last setID
    last_set_id = get_last_set_id(existing_sets_file)

    with open(input_file, 'r') as f:
        taxon_sets = f.read().splitlines()

    for set_index, taxon_set in enumerate(taxon_sets, 1):
        taxa_in_set = [taxon.strip() for taxon in taxon_set.split(',')]
        taxon_ids = []
        taxon_names = []

        for taxon in taxa_in_set:
            print(f"Processing: {taxon}")
            taxon_details = fetch_taxon_details(taxon)
            if taxon_details:
                taxon_id = taxon_details['id']
                taxon_ids.append(taxon_id)
                taxon_names.append(taxon_details['name'])

                if str(taxon_id) not in existing_taxa and str(taxon_id) not in new_taxa:
                    ancestry = fetch_ancestry(taxon_id)
                    
                    new_taxa[str(taxon_id)] = {
                        "taxonName": taxon_details['name'],
                        "vernacularName": taxon_details.get('preferred_common_name', '').capitalize(),
                        "ancestryIds": [ancestor['id'] for ancestor in ancestry] + [taxon_id],
                        "rank": taxon_details['rank'].capitalize(),
                        "taxonFacts": [],
                        "range": []
                    }
                else:
                    print(f"Taxon {taxon} (ID: {taxon_id}) already exists in the database.")
            
            sleep(1)  # To avoid hitting API rate limits

        # Check if the set is a duplicate
        if is_duplicate_set(taxon_ids, existing_sets):
            print(f"Duplicate set found: {', '.join(taxon_names)}. Skipping.")
            continue

        # Create new set entry
        new_set_id = str(last_set_id + len(new_sets) + 1)
        new_sets[new_set_id] = {
            "setName": "",
            "level": "0",
            "tags": [],
            "taxa": taxon_ids,
            "taxonNames": taxon_names,
            "range": []
        }

    # Write new taxa to file
    with open(new_taxon_file, 'w') as f:
        json.dump(new_taxa, f, indent=2)

    # Write new sets to file
    with open(new_sets_file, 'w') as f:
        json.dump(new_sets, f, indent=2)

    # Write new taxa names to text file
    with open(new_taxa_list_file, 'w') as f:
        for taxon_info in new_taxa.values():
            f.write(f"{taxon_info['taxonName']}\n")

    print(f"New taxa data written to {new_taxon_file}")
    print(f"New sets data written to {new_sets_file}")
    print(f"List of new taxa written to {new_taxa_list_file}")

if __name__ == "__main__":
    input_file = "1newTaxonInputSets.txt"
    existing_taxon_file = "../../taxonInfo.json"
    new_taxon_file = "2newTaxonInfoForPerplexity.json"
    existing_sets_file = "../../taxonSets.json"
    new_sets_file = "3newTaxonSets.json"
    new_taxa_list_file = "4newTaxonListForPerplexity.txt"
    process_taxa(input_file, existing_taxon_file, new_taxon_file, existing_sets_file, new_sets_file, new_taxa_list_file)

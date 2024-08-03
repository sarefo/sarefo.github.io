# input: 'newTaxonSetData.txt' > comma-separated taxa, one set per line
# output: newTaxonInfo.json for new taxa • newTaxonSets.json for new sets
# reads taxonInfo.json and taxonSets.json for context
# afterwards, get distribution + facts from perplexity: https://www.perplexity.ai/search/please-give-me-a-list-of-at-mo-gmq_93EyRqaxmtTbAgI9SQ

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
            return max(int(set_data['setID']) for set_data in data)
    except FileNotFoundError:
        return 0

def process_taxa(input_file, existing_taxon_file, new_taxon_file, existing_sets_file, new_sets_file):
    existing_taxa = {}
    new_taxa = {}
    new_sets = []

    # Load existing taxa
    try:
        with open(existing_taxon_file, 'r') as f:
            existing_taxa = json.load(f)
    except FileNotFoundError:
        pass

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
                taxon_id = str(taxon_details['id'])
                taxon_ids.append(taxon_id)
                taxon_names.append(taxon_details['name'])

                if taxon_id not in existing_taxa and taxon_id not in new_taxa:
                    ancestry = fetch_ancestry(taxon_id)
                    
                    new_taxa[taxon_id] = {
                        "taxonName": taxon_details['name'],
                        "vernacularName": taxon_details.get('preferred_common_name', '').capitalize(),
                        "ancestryIds": [ancestor['id'] for ancestor in ancestry] + [int(taxon_id)],
                        "rank": taxon_details['rank'].capitalize(),
                        "taxonFacts": [],
                        "distribution": []
                    }
                else:
                    print(f"Taxon {taxon} (ID: {taxon_id}) already exists in the database.")
            
            sleep(1)  # To avoid hitting API rate limits

        # Create new set entry
        new_set = {
            "setID": str(last_set_id + set_index),
            "setName": "",
            "skillLevel": "",
            "tags": [""],
            "taxa": taxon_ids,
            "taxonNames": taxon_names
        }
        new_sets.append(new_set)

    # Write new taxa to file
    with open(new_taxon_file, 'w') as f:
        json.dump(new_taxa, f, indent=2)

    # Write new sets to file
    with open(new_sets_file, 'w') as f:
        json.dump(new_sets, f, indent=2)

    print(f"New taxa data written to {new_taxon_file}")
    print(f"New sets data written to {new_sets_file}")

if __name__ == "__main__":
    input_file = "newTaxonSetData.txt"
    existing_taxon_file = "taxonInfo.json"
    new_taxon_file = "newTaxonInfo.json"
    existing_sets_file = "taxonSets.json"
    new_sets_file = "newTaxonSets.json"
    process_taxa(input_file, existing_taxon_file, new_taxon_file, existing_sets_file, new_sets_file)

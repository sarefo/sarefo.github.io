import requests
import json
from time import sleep
import os

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

def load_existing_data(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_data(data, file_path):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

def process_taxa(input_file, new_taxon_file):
    new_taxa = load_existing_data(new_taxon_file)

    with open(input_file, 'r') as f:
        taxon_sets = f.read().splitlines()

    for taxon_set in taxon_sets:
        taxa_in_set = [taxon.strip() for taxon in taxon_set.split(',')]
        for taxon in taxa_in_set:
            print(f"Processing: {taxon}")
            taxon_details = fetch_taxon_details(taxon)
            if taxon_details:
                taxon_id = str(taxon_details['id'])
                if taxon_id not in new_taxa:
                    ancestry = fetch_ancestry(taxon_id)
                    
                    new_taxa[taxon_id] = {
                        "taxonName": taxon_details['name'],
                        "vernacularName": taxon_details.get('preferred_common_name', '').capitalize(),
                        "ancestryIds": [ancestor['id'] for ancestor in ancestry] + [int(taxon_id)],
                        "rank": taxon_details['rank'].capitalize(),
                        "taxonFacts": [],
                        "range": []
                    }
                else:
                    print(f"Taxon {taxon} (ID: {taxon_id}) already exists in the database.")
            
            sleep(1)  # To avoid hitting API rate limits

    save_data(new_taxa, new_taxon_file)
    print(f"New taxa data written to {new_taxon_file}")
    
    # Output taxa names to console
    print("\nNew taxa names for Perplexity:")
    for taxon_info in new_taxa.values():
        print(taxon_info['taxonName'])

def merge_perplexity_data(new_taxon_file, perplexity_file, output_file):
    new_taxon_info = load_existing_data(new_taxon_file)
    perplexity_data = load_existing_data(perplexity_file)

    for taxon_id, taxon_data in new_taxon_info.items():
        taxon_name = taxon_data['taxonName']
        if taxon_name in perplexity_data:
            perplexity_info = perplexity_data[taxon_name]
            taxon_data['taxonFacts'] = perplexity_info.get('taxonFacts', [])
            taxon_data['range'] = perplexity_info.get('range', [])

    save_data(new_taxon_info, output_file)
    print(f"Merged data saved to {output_file}")

def create_taxon_sets(new_taxon_file, existing_sets_file, new_sets_file, input_file):
    new_taxa = load_existing_data(new_taxon_file)
    existing_sets = load_existing_data(existing_sets_file)
    
    # Initialize new_sets as an empty dict if the file doesn't exist or is empty
    try:
        with open(new_sets_file, 'r') as f:
            content = f.read().strip()
            new_sets = json.loads(content) if content else {}
    except (FileNotFoundError, json.JSONDecodeError):
        new_sets = {}

    # Find the last set ID
    all_set_ids = list(existing_sets.keys()) + list(new_sets.keys())
    last_set_id = max([int(set_id) for set_id in all_set_ids] + [0])

    with open(input_file, 'r') as f:
        taxon_sets = f.read().splitlines()

    for taxon_set in taxon_sets:
        taxa_in_set = [taxon.strip() for taxon in taxon_set.split(',')]
        taxon_ids = []
        taxon_names = []

        for taxon in taxa_in_set:
            taxon_id = next((id for id, info in new_taxa.items() if info['taxonName'] == taxon), None)
            if taxon_id:
                taxon_ids.append(int(taxon_id))
                taxon_names.append(taxon)

        if not is_duplicate_set(taxon_ids, existing_sets) and not is_duplicate_set(taxon_ids, new_sets):
            new_set_id = str(last_set_id + 1)
            last_set_id += 1
            new_sets[new_set_id] = {
                "setName": "",
                "level": "0",
                "tags": [],
                "taxa": taxon_ids,
                "taxonNames": taxon_names,
                "range": []
            }

    save_data(new_sets, new_sets_file)
    print(f"New sets data written to {new_sets_file}")

def is_duplicate_set(new_set, sets):
    new_set = set(new_set)
    for existing_set in sets.values():
        if set(existing_set['taxa']) == new_set:
            return True
    return False

def main():
    input_file = "1newTaxonInputSets.txt"
    new_taxon_file = "2newTaxonSetsForPerplexity.json"
    perplexity_file = "3perplexityData.json"
    merged_taxon_file = "4newTaxonInfoWithPerplexity.json"
    existing_sets_file = "../../taxonSets.json"
    new_sets_file = "5newTaxonSets.json"

    while True:
        print("\nChoose an action:")
        print("1. Process taxa from input file")
        print("2. Merge Perplexity data")
        print("3. Create taxon sets")
        print("4. Exit")

        choice = input("Enter your choice (1-4): ")

        if choice == '1':
            process_taxa(input_file, new_taxon_file)
        elif choice == '2':
            if os.path.exists(perplexity_file):
                merge_perplexity_data(new_taxon_file, perplexity_file, merged_taxon_file)
            else:
                print(f"Error: {perplexity_file} not found. Please create it first.")
        elif choice == '3':
            create_taxon_sets(merged_taxon_file, existing_sets_file, new_sets_file, input_file)
        elif choice == '4':
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()

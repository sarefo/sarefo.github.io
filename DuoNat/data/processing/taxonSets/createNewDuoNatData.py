import requests
import json
from time import sleep
import os
import shutil

def fetch_taxon_details(taxon_name):
    """Fetch taxon details from iNat API using taxon name"""
    url = f"https://api.inaturalist.org/v1/taxa/autocomplete?q={taxon_name}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            result = data['results'][0]
            taxon_id = result['id']
            taxon_name = result['name']
            vernacular_name = result.get('preferred_common_name', 'n/a').capitalize()
            rank = result['rank'].capitalize()
            print(f"  Found: {taxon_name} (ID: {taxon_id}, Vernacular: {vernacular_name}, Rank: {rank})")
            return {
                "id": taxon_id,
                "taxonName": taxon_name,
                "vernacularName": vernacular_name,
                "rank": rank
            }
        else:
            print(f"  No results found for taxon: {taxon_name}")
    else:
        print(f"  Error fetching details for taxon: {taxon_name}. Status code: {response.status_code}")
    return None

def fetch_taxon_by_id(taxon_id):
    """Fetch taxon details from iNat API using taxon ID"""
    url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            result = data['results'][0]
            taxon_name = result['name']
            vernacular_name = result.get('preferred_common_name', 'n/a').capitalize()
            rank = result['rank'].capitalize()
            print(f"  Found: {taxon_name} (ID: {taxon_id}, Vernacular: {vernacular_name}, Rank: {rank})")
            return {
                "taxonName": taxon_name,
                "vernacularName": vernacular_name,
                "rank": rank
            }
        else:
            print(f"  No results found for taxon ID: {taxon_id}")
    else:
        print(f"  Error fetching details for taxon ID: {taxon_id}. Status code: {response.status_code}")
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

def clear_file(file_path):
    open(file_path, 'w').close()

def process_taxa(input_file, new_taxon_file, perplexity_file):
    clear_file(new_taxon_file)
    new_taxa = {}
    taxon_names_list = []
    processed_taxa = set()  # New set to keep track of processed taxa

    with open(input_file, 'r') as f:
        taxon_sets = f.read().splitlines()

    print("Processing taxa...")
    for taxon_set in taxon_sets:
        taxa_in_set = [taxon.strip() for taxon in taxon_set.split(',')]
        for taxon in taxa_in_set:
            if taxon not in processed_taxa:  # Check if taxon has already been processed
#                print(f"Processing: {taxon}")
                taxon_details = fetch_taxon_details(taxon)
                if taxon_details:
                    taxon_id = str(taxon_details['id'])
                    if taxon_id not in new_taxa:
                        ancestry = fetch_ancestry(taxon_id)
                        
                        new_taxa[taxon_id] = {
                            "taxonName": taxon_details['taxonName'],
                            "vernacularName": taxon_details['vernacularName'],
                            "ancestryIds": [ancestor['id'] for ancestor in ancestry] + [int(taxon_id)],
                            "rank": taxon_details['rank'],
                            "taxonFacts": [],
                            "range": []
                        }
                        taxon_names_list.append(taxon_details['taxonName'])
                    else:
                        print(f"Taxon {taxon} (ID: {taxon_id}) already exists in the database.")
                processed_taxa.add(taxon)  # Add taxon to processed set
                sleep(1)  # To avoid hitting API rate limits
            else:
                print(f"Taxon {taxon} has already been processed. Skipping.")

    save_data(new_taxa, new_taxon_file)
    print(f"\nNew taxa data written to {new_taxon_file}")

    # Output perplexityPrompt.txt content
    print("\nUse this prompt in Perplexity, then save its output in '3perplexityData.json':")
    try:
        with open('perplexityPrompt.txt', 'r') as f:
            print(f.read())
    except FileNotFoundError:
        print("perplexityPrompt.txt not found. Skipping prompt output.")

    # Output list of taxon names
    for name in taxon_names_list:
        print(name)
    clear_file(perplexity_file)

def merge_perplexity_data(new_taxon_file, perplexity_file, output_file):
    clear_file(output_file)
    new_taxon_info = load_existing_data(new_taxon_file)
    perplexity_data = load_existing_data(perplexity_file)

    valid_continents = {"NA", "SA", "EU", "AF", "AS", "OC"}

    for taxon_id, taxon_data in new_taxon_info.items():
        taxon_name = taxon_data['taxonName']
        if taxon_name in perplexity_data:
            perplexity_info = perplexity_data[taxon_name]
            taxon_data['taxonFacts'] = perplexity_info.get('taxonFacts', [])
            
            # Sanity check for continent abbreviations
            range_data = perplexity_info.get('range', [])
            taxon_data['range'] = [continent for continent in range_data if continent in valid_continents]
            
            if len(taxon_data['range']) != len(range_data):
                print(f"Warning: Invalid continent abbreviation found for {taxon_name}. Filtered out invalid entries.")

    save_data(new_taxon_info, output_file)
    print(f"Merged data saved to {output_file}")

def create_taxon_sets(new_taxon_file, taxon_sets_file, new_sets_file, input_file):
    clear_file(new_sets_file)
    new_taxa = load_existing_data(new_taxon_file)
    existing_sets = load_existing_data(taxon_sets_file)
    new_sets = {}

    # Find the last set ID
    last_set_id = max([int(set_id) for set_id in existing_sets.keys()] + [0])

    with open(input_file, 'r') as f:
        taxon_sets = f.read().splitlines()

    for taxon_set in taxon_sets:
        taxa_in_set = [taxon.strip() for taxon in taxon_set.split(',')]
        
        # Check if the set contains exactly two taxa
        if len(taxa_in_set) != 2:
            print(f"WARNING: Skipping set with incorrect number of taxa: {taxon_set}")
            continue

        taxon_ids = []
        taxon_names = []
        set_range = set()

        for taxon in taxa_in_set:
            taxon_id = next((id for id, info in new_taxa.items() if info['taxonName'] == taxon), None)
            if taxon_id:
                taxon_ids.append(int(taxon_id))
                taxon_names.append(taxon)
                
                # Initialize set_range with the first taxon's range
                if not set_range:
                    set_range = set(new_taxa[taxon_id]['range'])
                else:
                    # Intersect the current set_range with the new taxon's range
                    set_range = set_range.intersection(set(new_taxa[taxon_id]['range']))
            else:
                print(f"WARNING: Taxon '{taxon}' not found in new_taxa. Skipping this set.")
                break

        if len(taxon_ids) == 2 and not is_duplicate_set(taxon_ids, existing_sets) and not is_duplicate_set(taxon_ids, new_sets):
            new_set_id = str(last_set_id + 1)
            last_set_id += 1
            new_sets[new_set_id] = {
                "setName": "",
                "level": "0",
                "tags": [],
                "taxa": taxon_ids,
                "taxonNames": taxon_names,
                "range": list(set_range)  # Convert set back to list
            }
        elif len(taxon_ids) != 2:
            print(f"WARNING: Set {taxon_set} does not have exactly two valid taxa. Skipping.")

    save_data(new_sets, new_sets_file)
    print(f"New sets data written to {new_sets_file}")
    print(f"Total new sets created: {len(new_sets)}")

def is_duplicate_set(new_set, sets):
    new_set = set(new_set)
    for existing_set in sets.values():
        if set(existing_set['taxa']) == new_set:
            return True
    return False

def update_set_metadata(new_sets_file):
    new_sets = load_existing_data(new_sets_file)
    
    print("Updating metadata for new taxon sets...")
    for set_id, set_data in new_sets.items():
        print(f"\nSet {set_id}: {', '.join(set_data['taxonNames'])}")
        
        # Update level
        while True:
            level = input("Enter level (1-3): ")
            if level.isdigit() and 1 <= int(level) <= 3:
                set_data['level'] = level
                break
            else:
                print("Invalid input. Please enter a number between 1 and 3.")
        
        # Update tags
        tags = input("Enter tags (comma-separated, or press Enter for no tags): ").strip()
        set_data['tags'] = [tag.strip() for tag in tags.split(',')] if tags else []
        
        # Update set name
        set_name = input("Enter a name for this set (or press Enter to skip): ").strip()
        if set_name:
            set_data['setName'] = set_name
    
    save_data(new_sets, new_sets_file)
    print(f"Updated metadata saved to {new_sets_file}")

def update_main_files_without_metadata(taxon_info_file, taxon_sets_file, new_taxon_file, new_sets_file):
    # Backup old files
    shutil.copy(taxon_info_file, f"{taxon_info_file}.bak")
    shutil.copy(taxon_sets_file, f"{taxon_sets_file}.bak")
    print("Old files backed up with .bak extension.")

    # Load existing data
    taxon_info = load_existing_data(taxon_info_file)
    taxon_sets = load_existing_data(taxon_sets_file)

    # Load new data
    new_taxon_info = load_existing_data(new_taxon_file)
    new_taxon_sets = load_existing_data(new_sets_file)

    # Check and log new taxon info
    for taxon_id, taxon_data in new_taxon_info.items():
        if 'taxonName' not in taxon_data or not taxon_data['taxonName']:
            print(f"Warning: Missing or empty taxonName for taxon ID {taxon_id}")
        else:
            print(f"Adding/Updating taxon: {taxon_data['taxonName']} (ID: {taxon_id})")

    # Update taxon_info
    taxon_info.update(new_taxon_info)
    
    # Check and log new taxon sets
    for set_id, set_data in new_taxon_sets.items():
        if 'taxonNames' not in set_data or not set_data['taxonNames']:
            print(f"Warning: Missing or empty taxonNames for set ID {set_id}")
        else:
            print(f"Adding new set: {set_data['taxonNames']} (ID: {set_id})")
        set_data['level'] = "0"  # Ensure level is set as a string

    # Update taxon_sets
    taxon_sets.update(new_taxon_sets)

    # Save updated data
    save_data(taxon_info, taxon_info_file)
    save_data(taxon_sets, taxon_sets_file)
    print(f"Files {taxon_info_file} and {taxon_sets_file} updated with new data (level=0 for new sets).")

    # Print summary
    print(f"Total taxa in updated file: {len(taxon_info)}")
    print(f"Total sets in updated file: {len(taxon_sets)}")

def update_set_metadata_in_main_file(taxon_sets_file):
    taxon_sets = load_existing_data(taxon_sets_file)
    
    print("Updating metadata for new taxon sets (level=0)...")
    for set_id, set_data in taxon_sets.items():
        if set_data.get('level') == "0":
            print(f"\nSet {set_id}: {', '.join(set_data['taxonNames'])}")
            
            # Update level
            while True:
                level = input("Enter level (1-3): ")
                if level.isdigit() and 1 <= int(level) <= 3:
                    set_data['level'] = level
                    break
                else:
                    print("Invalid input. Please enter a number between 1 and 3.")
            
            # Update tags
            tags = input("Enter tags (comma-separated, or press Enter for no tags): ").strip()
            set_data['tags'] = [tag.strip() for tag in tags.split(',')] if tags else []
            
            # Update set name
            set_name = input("Enter a name for this set (or press Enter to skip): ").strip()
            if set_name:
                set_data['setName'] = set_name
    
    save_data(taxon_sets, taxon_sets_file)
    print(f"Updated metadata saved to {taxon_sets_file}")

def main():
    input_file = "1newTaxonInputSets.txt"
    new_taxon_file = "2newTaxonSetsForPerplexity.json"
    perplexity_file = "3perplexityData.json"
    merged_taxon_file = "4newTaxonInfoWithPerplexity.json"
    new_sets_file = "5newTaxonSets.json"

    taxon_info_file = "../../taxonInfo.json"
    taxon_sets_file = "../../taxonSets.json"
    taxon_hierarchy_file = "../../taxonHierarchy.json"

    while True:
        print("\nChoose an action:")
        print("0. Exit")
        print("1. Process taxa from input file")
        print("2. Merge Perplexity data")
        print("3. Create taxon sets")
        print("4. Update main files without metadata")
        print("5. Update set metadata in main file")
        print("6. Update taxon hierarchy")

        choice = input("Enter your choice (0-6): ")

        if choice == '1':
            process_taxa(input_file, new_taxon_file, perplexity_file)
        elif choice == '2':
            if os.path.exists(perplexity_file):
                merge_perplexity_data(new_taxon_file, perplexity_file, merged_taxon_file)
            else:
                print(f"Error: {perplexity_file} not found. Please create it first.")
        elif choice == '3':
            create_taxon_sets(merged_taxon_file, taxon_sets_file, new_sets_file, input_file)
        elif choice == '4':
            update_main_files_without_metadata(taxon_info_file, taxon_sets_file, merged_taxon_file, new_sets_file)
        elif choice == '5':
            update_set_metadata_in_main_file(taxon_sets_file)
        elif choice == '6':
            update_hierarchy(taxon_info_file, taxon_hierarchy_file)
        elif choice == '0':
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()

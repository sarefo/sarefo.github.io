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
            vernacular_name = result.get('preferred_common_name', '-').capitalize()
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
            vernacular_name = result.get('preferred_common_name', '-').capitalize()
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

def prompt_for_correction(taxon_name):
    while True:
        print(f"Taxon '{taxon_name}' not found. Please choose an option:")
        print("1. Enter a correction")
        print("2. Skip this taxon")
        choice = input("Enter your choice (1 or 2): ")
        
        if choice == '1':
            correction = input(f"Enter the correct name for '{taxon_name}': ").strip()
            return correction
        elif choice == '2':
            return None
        else:
            print("Invalid choice. Please try again.")

def update_input_file(input_file, corrections):
    with open(input_file, 'r') as f:
        lines = f.readlines()
    
    updated_lines = []
    for line in lines:
        taxa = line.strip().split(',')
        updated_taxa = [corrections.get(taxon.strip(), taxon) for taxon in taxa]
        updated_lines.append(','.join(updated_taxa) + '\n')
    
    with open(input_file, 'w') as f:
        f.writelines(updated_lines)

def process_taxa(input_file, new_taxon_file, perplexity_file, taxon_info_file):
    clear_file(new_taxon_file)
    new_taxa = {}
    taxon_names_list = []
    unique_taxa = set()
    existing_taxa = load_existing_data(taxon_info_file)
    corrections = {}

    with open(input_file, 'r') as f:
        taxon_pairs = f.read().splitlines()

    # Create a unique list of taxa
    for taxon_pair in taxon_pairs:
        taxa_in_pair = [taxon.strip() for taxon in taxon_pair.split(',')]
        unique_taxa.update(taxa_in_pair)

    print(f"Processing {len(unique_taxa)} unique taxa...")
    for taxon in unique_taxa:
        taxon_details = fetch_taxon_details(taxon)

        if not taxon_details:
            correction = prompt_for_correction(taxon)
            if correction:
                corrections[taxon] = correction
                taxon_details = fetch_taxon_details(correction)
            else:
                print(f"Skipping taxon: {taxon}")
                continue

        if taxon_details:
            taxon_id = str(taxon_details['id'])
            if taxon_id not in existing_taxa:
                if taxon_id not in new_taxa:
                    ancestry = fetch_ancestry(taxon_id)

                    # Filter out ancestryId 48460
                    filtered_ancestry_ids = [ancestor['id'] for ancestor in ancestry if ancestor['id'] != 48460]
                    filtered_ancestry_ids.append(int(taxon_id))

                    new_taxa[taxon_id] = {
                        "taxonName": taxon_details['taxonName'],
                        "vernacularName": taxon_details['vernacularName'],
                        "ancestryIds": filtered_ancestry_ids,
                        "rank": taxon_details['rank'],
                        "taxonFacts": [],
                        "range": []
                    }
                    taxon_names_list.append(taxon_details['taxonName'])
                else:
                    print(f"Taxon {taxon} (ID: {taxon_id}) already exists in new taxa.")
            else:
                print(f"Taxon {taxon} (ID: {taxon_id}) already exists in taxonInfo.json.")
        sleep(1)  # To avoid hitting API rate limits

    save_data(new_taxa, new_taxon_file)
    print(f"\nNew taxa data written to {new_taxon_file}")

    if corrections:
        print("\nCorrections made during processing:")
        for original, corrected in corrections.items():
            print(f"  {original} -> {corrected}")

        update_input = input("Do you want to update the input file with these corrections? (y/n): ").lower()
        if update_input == 'y':
            update_input_file(input_file, corrections)
            print(f"Input file {input_file} has been updated with corrections.")

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

def create_taxon_pairs(new_taxon_file, taxon_pairs_file, new_pairs_file, input_file, taxon_info_file):
    clear_file(new_pairs_file)
    new_taxa = load_existing_data(new_taxon_file)
    existing_taxa = load_existing_data(taxon_info_file)
    existing_pairs = load_existing_data(taxon_pairs_file)
    new_pairs = {}

    # Find the last pair ID
    last_pair_id = max([int(pair_id) for pair_id in existing_pairs.keys()] + [0])

    with open(input_file, 'r') as f:
        taxon_pairs = f.read().splitlines()

    for taxon_pair in taxon_pairs:
        taxa_in_pair = [taxon.strip() for taxon in taxon_pair.split(',')]
        
        # Check if the pair contains exactly two taxa
        if len(taxa_in_pair) != 2:
            print(f"WARNING: Skipping pair with incorrect number of taxa: {taxon_pair}")
            continue

        taxon_ids = []
        taxon_names = []
        pair_range = set()

        for taxon in taxa_in_pair:
            taxon_id = next((id for id, info in new_taxa.items() if info['taxonName'] == taxon), None)
            if taxon_id is None:
                taxon_id = next((id for id, info in existing_taxa.items() if info['taxonName'] == taxon), None)
            
            if taxon_id:
                taxon_ids.append(int(taxon_id))
                taxon_names.append(taxon)
                
                # Get the taxon info from either new_taxa or existing_taxa
                taxon_info = new_taxa.get(str(taxon_id)) or existing_taxa.get(str(taxon_id))
                
                # Initialize pair_range with the first taxon's range
                if not pair_range:
                    pair_range = set(taxon_info['range'])
                else:
                    # Intersect the current pair_range with the new taxon's range
                    pair_range = pair_range.intersection(set(taxon_info['range']))
            else:
                print(f"WARNING: Taxon '{taxon}' not found in new_taxa or existing_taxa. Skipping this pair.")
                break

        if len(taxon_ids) == 2 and not is_duplicate_pair(taxon_ids, existing_pairs) and not is_duplicate_pair(taxon_ids, new_pairs):
            new_pair_id = str(last_pair_id + 1)
            last_pair_id += 1
            new_pairs[new_pair_id] = {
                "pairName": "",
                "level": "0",
                "tags": [],
                "taxa": taxon_ids,
                "taxonNames": taxon_names,
                "range": list(pair_range)  # Convert pair back to list
            }
        elif len(taxon_ids) != 2:
            print(f"WARNING: Pair {taxon_pair} does not have exactly two valid taxa. Skipping.")

    save_data(new_pairs, new_pairs_file)
    print(f"New pair data written to {new_pairs_file}")
    print(f"Total new pairs created: {len(new_pairs)}")

def is_duplicate_pair(new_pair, pairs):
    new_pair = set(new_pair)
    for existing_pair in pairs.values():
        if set(existing_pair['taxa']) == new_pair:
            return True
    return False

def update_pair_metadata(new_pairs_file):
    new_pairs = load_existing_data(new_pairs_file)
    
    print("Updating metadata for new taxon pairs...")
    for pair_id, pair_data in new_pairs.items():
        print(f"\nPair {pair_id}: {', '.join(pair_data['taxonNames'])}")
        
        # Update level
        while True:
            level = input("Enter level (1-3): ")
            if level.isdigit() and 1 <= int(level) <= 3:
                pair_data['level'] = level
                break
            else:
                print("Invalid input. Please enter a number between 1 and 3.")
        
        # Update tags
        tags = input("Enter tags (comma-separated, or press Enter for no tags): ").strip()
        pair_data['tags'] = [tag.strip() for tag in tags.split(',')] if tags else []
        
        # Update pair name
        pair_name = input("Enter a name for this pair (or press Enter to skip): ").strip()
        if pair_name:
            pair_data['pairName'] = pair_name
    
    save_data(new_pairs, new_pairs_file)
    print(f"Updated metadata saved to {new_pairs_file}")

def update_main_files_without_metadata(taxon_info_file, taxon_pairs_file, new_taxon_file, new_pairs_file):
    # Backup old files
    shutil.copy(taxon_info_file, f"{taxon_info_file}.old")
    shutil.copy(taxon_pairs_file, f"{taxon_pairs_file}.old")
    print("Old files backed up with .old extension.")

    # Load existing data
    taxon_info = load_existing_data(taxon_info_file)
    taxon_pairs = load_existing_data(taxon_pairs_file)

    # Load new data
    new_taxon_info = load_existing_data(new_taxon_file)
    new_taxon_pairs = load_existing_data(new_pairs_file)

    # Check and log new taxon info
    for taxon_id, taxon_data in new_taxon_info.items():
        if 'taxonName' not in taxon_data or not taxon_data['taxonName']:
            print(f"Warning: Missing or empty taxonName for taxon ID {taxon_id}")
        else:
            print(f"Adding/Updating taxon: {taxon_data['taxonName']} (ID: {taxon_id})")

    # Update taxon_info
    taxon_info.update(new_taxon_info)
    
    # Check and log new taxon pairs
    for pair_id, pair_data in new_taxon_pairs.items():
        if 'taxonNames' not in pair_data or not pair_data['taxonNames']:
            print(f"Warning: Missing or empty taxonNames for pair ID {pair_id}")
        else:
            print(f"Adding new pair: {pair_data['taxonNames']} (ID: {pair_id})")
        pair_data['level'] = "0"  # Ensure level is set as a string

    # Update taxon_pairs
    taxon_pairs.update(new_taxon_pairs)

    # Save updated data
    save_data(taxon_info, taxon_info_file)
    save_data(taxon_pairs, taxon_pairs_file)
    print(f"Files {taxon_info_file} and {taxon_pairs_file} updated with new data (level=0 for new pairs).")

    # Print summary
    print(f"Total taxa in updated file: {len(taxon_info)}")
    print(f"Total pairs in updated file: {len(taxon_pairs)}")

def update_pair_metadata_in_main_file(taxon_pairs_file, taxon_info_file):
    taxon_pairs = load_existing_data(taxon_pairs_file)
    taxon_info = load_existing_data(taxon_info_file)
    
    print("Updating metadata for new taxon pairs (level=0)...")
    last_tags = []  # Initialize last_tags as an empty list
    
    for pair_id, pair_data in taxon_pairs.items():
        if pair_data.get('level') == "0":
            print(f"\nPair {pair_id}: {', '.join(pair_data['taxonNames'])}")
            
            # Generate default name
            taxon_a = taxon_info.get(str(pair_data['taxa'][0]), {})
            taxon_b = taxon_info.get(str(pair_data['taxa'][1]), {})
            name_a = taxon_a.get('vernacularName', taxon_a.get('taxonName', 'Unknown'))
            name_b = taxon_b.get('vernacularName', taxon_b.get('taxonName', 'Unknown'))
            default_name = f"{name_a} vs {name_b}"
            
            # Update pair name
            pair_name = input(f"Enter a name for this pair (press Enter to use '{default_name}'): ").strip()
            pair_data['pairName'] = pair_name if pair_name else default_name
            
            # Update level
            while True:
                level = input("Enter level (1-3): ")
                if level.isdigit() and 1 <= int(level) <= 3:
                    pair_data['level'] = level
                    break
                else:
                    print("Invalid input. Please enter a number between 1 and 3.")
            
            # Update tags
            default_tags = ", ".join(last_tags) if last_tags else "no tags"
            tags_input = input(f"Enter tags (comma-separated, '-' for no tags, or press Enter to use '{default_tags}'): ").strip()
            
            if tags_input == '-':
                new_tags = []
            elif tags_input:
                new_tags = [tag.strip() for tag in tags_input.split(',') if tag.strip()]
            else:
                new_tags = last_tags.copy()  # Use the default tags
            
            pair_data['tags'] = new_tags
            last_tags = new_tags  # Update last_tags for the next iteration
    
    save_data(taxon_pairs, taxon_pairs_file)
    print(f"Updated metadata saved to {taxon_pairs_file}")

def update_hierarchy(taxon_info_file, taxon_hierarchy_file):
    # Backup old file
    shutil.move(taxon_hierarchy_file, f"{taxon_hierarchy_file}.old")
    print(f"Old {taxon_hierarchy_file} backed up with .old extension.")

    # Load existing data
    current_hierarchy = load_existing_data(f"{taxon_hierarchy_file}.old")
    taxon_info = load_existing_data(taxon_info_file)

    # Create a new hierarchy dictionary
    updated_hierarchy = {}

    # First, copy all existing taxa from current_hierarchy
    for id, info in current_hierarchy.items():
        updated_hierarchy[id] = {
            "taxonName": info["taxonName"],
            "vernacularName": info["vernacularName"],
            "rank": info["rank"],
            "parentId": info["parentId"]
        }

    # Ensure the root "Life" taxon exists
    updated_hierarchy["48460"] = {
        "taxonName": "Life",
        "vernacularName": "-",
        "rank": "Stateofmatter",
        "parentId": None
    }

    # Now, process taxon_info to add new taxa and update existing ones
    for taxon_id, taxon_data in taxon_info.items():
        ancestry_ids = taxon_data["ancestryIds"]

        for i, current_id in enumerate(ancestry_ids):
            current_id = str(current_id)

            # If this taxon isn't in our hierarchy yet, add it
            if current_id not in updated_hierarchy:
                # Fetch details from iNat API
                taxon_details = fetch_taxon_by_id(current_id)
                if taxon_details:
                    updated_hierarchy[current_id] = taxon_details
                else:
                    print(f"  Unable to fetch details for taxon ID: {current_id}. Using placeholder data.")
                    updated_hierarchy[current_id] = {
                        "taxonName": "Unknown",
                        "vernacularName": "-",
                        "rank": "Unknown",
                        "parentId": None
                    }
                sleep(1)  # To avoid hitting API rate limits

            # Set the parentId
            if i == 0:
                parent_id = "48460"  # Set the root node to "Life" for all taxa
            else:
                parent_id = str(ancestry_ids[i-1])

            updated_hierarchy[current_id]["parentId"] = parent_id

            # If this is the last ID in the ancestry, it's the taxon itself
            if i == len(ancestry_ids) - 1:
                updated_hierarchy[current_id]["taxonName"] = taxon_data["taxonName"]
                updated_hierarchy[current_id]["vernacularName"] = taxon_data.get("vernacularName", "-")
                updated_hierarchy[current_id]["rank"] = taxon_data["rank"]

    # Save the updated hierarchy
    save_data(updated_hierarchy, taxon_hierarchy_file)
    print(f"Updated hierarchy saved to {taxon_hierarchy_file}")

def main():
    input_file = "1newTaxonInputPairs.txt"
    new_taxon_file = "2newTaxonPairsForPerplexity.json"
    perplexity_file = "3perplexityData.json"
    merged_taxon_file = "4newTaxonInfoWithPerplexity.json"
    new_pairs_file = "5newTaxonPairs.json"

    taxon_info_file = "../../taxonInfo.json"
    taxon_pairs_file = "../../taxonPairs.json"
    taxon_hierarchy_file = "../../taxonHierarchy.json"

    last_action = 0
    while True:
        print("\nChoose an action:")
        print("0. Exit")
        options = [
            "Process taxa from input file",
            "Merge Perplexity data",
            "Create taxon pairs",
            "Update main files without metadata",
            "Update pair metadata in main file",
            "Update taxon hierarchy"
        ]
        
        for i, option in enumerate(options, 1):
            if i == last_action + 1:
                print(f"{i}. {option} <- Recommended next step")
            else:
                print(f"{i}. {option}")

        choice = input("Enter your choice (0-6): ")

        if choice == '1':
            process_taxa(input_file, new_taxon_file, perplexity_file, taxon_info_file)
            last_action = 1
        elif choice == '2':
            if os.path.exists(perplexity_file):
                merge_perplexity_data(new_taxon_file, perplexity_file, merged_taxon_file)
                last_action = 2
            else:
                print(f"Error: {perplexity_file} not found. Please create it first.")
                last_action = 1  # Recommend creating the Perplexity file
        elif choice == '3':
            create_taxon_pairs(merged_taxon_file, taxon_pairs_file, new_pairs_file, input_file, taxon_info_file)
            last_action = 3
        elif choice == '4':
            update_main_files_without_metadata(taxon_info_file, taxon_pairs_file, merged_taxon_file, new_pairs_file)
            last_action = 4
        elif choice == '5':
            update_pair_metadata_in_main_file(taxon_pairs_file, taxon_info_file)
            last_action = 5
        elif choice == '6':
            update_hierarchy(taxon_info_file, taxon_hierarchy_file)
            last_action = 0  # Reset to beginning after completing all steps
        elif choice == '0':
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()

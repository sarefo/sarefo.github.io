import json

def merge_taxon_data(taxon_info_file, taxon_facts_file, output_file):
    # Read taxonInfo.json
    with open(taxon_info_file, 'r') as f:
        taxon_info = json.load(f)
    
    # Read taxonFacts.json
    with open(taxon_facts_file, 'r') as f:
        taxon_facts = json.load(f)
    
    # Keep track of unmatched taxa
    unmatched_taxa = []
    
    # Merge data
    for taxon_name, facts in taxon_facts.items():
        matched = False
        for taxon_id, info in taxon_info.items():
            if info['taxonName'] == taxon_name:
                info['taxon_info'] = facts['taxon_info']
                matched = True
                break
        if not matched:
            unmatched_taxa.append(taxon_name)
    
    # Write merged data to output file
    with open(output_file, 'w') as f:
        json.dump(taxon_info, f, indent=2)
    
    # Print unmatched taxa
    if unmatched_taxa:
        print("The following taxa from taxonFacts could not be matched in taxonInfo:")
        for taxon in unmatched_taxa:
            print(f"- {taxon}")
    else:
        print("All taxa from taxonFacts were successfully merged into taxonInfo.")

# Usage
merge_taxon_data('../../../data/taxaInfo.json', '../../../data/taxonFacts.json', 'final_merged.json')

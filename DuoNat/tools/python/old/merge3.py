import json

def merge_taxon_data(taxon_info_file, taxon_facts_file, output_file):
    # Read taxonInfo.json
    try:
        with open(taxon_info_file, 'r') as f:
            taxon_info = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error reading {taxon_info_file}:")
        print(f"JSONDecodeError: {str(e)}")
        print_problematic_lines(taxon_info_file, e.lineno, 5)
        return

    # Read taxonFacts.json
    try:
        with open(taxon_facts_file, 'r') as f:
            taxon_facts = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error reading {taxon_facts_file}:")
        print(f"JSONDecodeError: {str(e)}")
        print_problematic_lines(taxon_facts_file, e.lineno, 5)
        return

    # Keep track of unmatched taxa
    unmatched_taxa = []
    
    # Merge data
    for taxon_name, facts in taxon_facts.items():
        matched = False
        for taxon_id, info in taxon_info.items():
            if info['taxonName'] == taxon_name:
                info['taxon_info'] = facts.get('taxon_info', [])
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

def print_problematic_lines(file_path, error_line, context=5):
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    start = max(0, error_line - context - 1)
    end = min(len(lines), error_line + context)
    
    print(f"Problematic lines (with {context} lines of context):")
    for i, line in enumerate(lines[start:end], start=start+1):
        prefix = ">> " if i == error_line else "   "
        print(f"{prefix}{i}: {line.rstrip()}")

# Usage
merge_taxon_data('../../data/taxaInfo.json', '../../data/taxonFacts.json', 'merged_taxon_data2.json')

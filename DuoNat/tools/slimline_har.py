import json

def parse_har(har_file_path):
    with open(har_file_path, 'r', encoding='utf-8') as file:
        har_data = json.load(file)

    result = []
    for entry in har_data['log']['entries']:
        # Extract required fields: name, initiator, size, time
        name = entry['request']['url']
        initiator = entry['initiator']['type'] if 'initiator' in entry else 'unknown'
        size = entry['response']['bodySize'] if 'bodySize' in entry['response'] else 0
        time = entry['time']  # Total time taken for the request
        
        result.append({
            'name': name,
            'initiator': initiator,
            'size': size,
            'time': time
        })

    return result

# Example usage (replace 'example.har' with your actual .har file path)
print(parse_har('127.0.0.1.har'))

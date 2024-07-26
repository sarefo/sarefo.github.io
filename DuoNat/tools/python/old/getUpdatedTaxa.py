import requests
import json

# Define your list of taxa
taxa_list = [
    "Agelena gracilens",
    "Carduelis spinus",
    "Carollia brevicauda",
    "Cosmophasis umbratica",
    "Delphinus capensis",
    "Dendrocopos medius",
    "Diaemus youngi",
    "Flabellina bertschi",
    "Flabellina exoptata",
    "Flabellina iodinea",
    "Flabellina rubrolineata",
    "Gongylophis conicus",
    "Heniochus macrolepidotus",
    "Heteractis magnifica",
    "Hipposideros pratti",
    "Hypselodoris bullocki",
    "Janolus cristatus",
    "Lagenorhynchus acutus",
    "Lagenorhynchus obliquidens",
    "Lagenorhynchus obscurus",
    "Lentinus edodes",
    "Lenzites betulina",
    "Leptynia hispanica",
    "Machimus atricapillus",
    "Machimus cingulatus",
    "Macropus rufus",
    "Manduca quinquemaculata",
    "Megaderma lyra",
    "Mormopterus norfolkensis",
    "Mormopterus planiceps",
    "Morpho peleides",
    "Neoromicia capensis",
    "Neoromicia nanus",
    "Neovison vison",
    "Nephila clavipes",
    "Parapercis hexophthalma",
    "Phalacrocorax aristotelis",
    "Phintella versicolor",
    "Polyporus squamosus",
    "Python reticulatus",
    "Sepia latimanus",
    "Sitticus fasciger",
    "Sitticus pubescens",
    "Synaema globosum",
    "Tamias sibiricus",
    "Thamnophis sauritus",
    "Trapania hispalensis",
    "Tremella aurantia",
    "Tritonia nilsodhneri",
    "Tritonia plebeia",
    "Xenochrophis flavipunctatus",
    "Xenochrophis piscator"
]

# Function to fetch the taxon name from iNaturalist
def get_inat_taxon_name(taxon):
    url = "https://api.inaturalist.org/v1/taxa"
    params = {
        "q": taxon,
        "rank": "species",
        "per_page": 1
    }
    response = requests.get(url, params=params)
    if response.status_code == 200:
        data = response.json()
        if data['total_results'] > 0:
            return data['results'][0]['name']
    return None

# Fetch the iNaturalist taxon names
taxon_mappings = []
for taxon in taxa_list:
    inat_taxon = get_inat_taxon_name(taxon)
    taxon_mappings.append(f"{taxon}: {inat_taxon if inat_taxon else 'Not found'}")

# Output the taxon mappings
for mapping in taxon_mappings:
    print(mapping)

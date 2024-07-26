# Define the mapping
taxon_mapping = {
    "Agelena gracilens": "Allagelena gracilens",
    "Carduelis spinus": "Spinus spinus",
    "Carollia brevicauda": "Carollia brevicaudum",
    "Cosmophasis umbratica": "Cosmophasis thalassina",
    "Delphinus capensis": "Delphinus delphis",
    "Dendrocopos medius": "Dendrocoptes medius",
    "Diaemus youngi": "Diaemus youngii",
    "Flabellina bertschi": "Edmundsella bertschi",
    "Flabellina exoptata": "Coryphellina exoptata",
    "Flabellina iodinea": "Flabellinopsis iodinea",
    "Flabellina rubrolineata": "Coryphellina rubrolineata",
    "Gongylophis conicus": "Eryx conicus",
    "Heniochus macrolepidotus": "Heniochus acuminatus",
    "Heteractis magnifica": "Radianthus magnifica",
    "Hipposideros pratti": "Hipposideros swinhoei",
    "Hypselodoris bullocki": "Hypselodoris bullockii",
    "Janolus cristatus": "Antiopella cristata",
    "Lagenorhynchus acutus": "Leucopleurus acutus",
    "Lagenorhynchus obliquidens": "Sagmatias obliquidens",
    "Lagenorhynchus obscurus": "Sagmatias obscurus",
    "Lentinus edodes": "Lentinula edodes",
    "Lenzites betulina": "Trametes betulina",
    "Leptynia hispanica": "Pijnackeria hispanica",
    "Machimus atricapillus": "Tolmerus atricapillus",
    "Machimus cingulatus": "Tolmerus cingulatus",
    "Macropus rufus": "Osphranter rufus",
    "Manduca quinquemaculata": "Manduca quinquemaculatus",
    "Megaderma lyra": "Lyroderma lyra",
    "Mormopterus norfolkensis": "Micronomus norfolkensis",
    "Mormopterus planiceps": "Ozimops planiceps",
    "Morpho peleides": "Not found",
    "Neoromicia capensis": "Laephotis capensis",
    "Neoromicia nanus": "Afronycteris nanus",
    "Neovison vison": "Neogale vison",
    "Nephila clavipes": "Trichonephila clavipes",
    "Parapercis hexophthalma": "Parapercis hexophtalma",
    "Phalacrocorax aristotelis": "Gulosus aristotelis",
    "Phintella versicolor": "Phintelloides versicolor",
    "Polyporus squamosus": "Cerioporus squamosus",
    "Python reticulatus": "Malayopython reticulatus",
    "Sepia latimanus": "Ascarosepion latimanus",
    "Sitticus fasciger": "Attulus fasciger",
    "Sitticus pubescens": "Attulus pubescens",
    "Synaema globosum": "Synema globosum",
    "Tamias sibiricus": "Eutamias sibiricus",
    "Thamnophis sauritus": "Thamnophis proximus",
    "Trapania hispalensis": "Trapania lineata",
    "Tremella aurantia": "Naematelia aurantia",
    "Tritonia nilsodhneri": "Candiella odhneri",
    "Tritonia plebeia": "Candiella plebeia",
    "Xenochrophis flavipunctatus": "Fowlea flavipunctata",
    "Xenochrophis piscator": "Fowlea piscator"
}

# Read taxa from input file
with open('../../data/taxa.txt', 'r') as file:
    taxa_list = file.readlines()

# Replace taxa according to the mapping
updated_taxa_list = [taxon_mapping.get(taxon.strip(), taxon.strip()) for taxon in taxa_list]

# Write the updated taxa to an output file
with open('taxa_output.txt', 'w') as file:
    for taxon in updated_taxa_list:
        file.write(taxon + '\n')

print("Taxa have been updated and written to taxa_output.txt")

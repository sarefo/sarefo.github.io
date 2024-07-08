// global handles for image and name html elements
const leftImage = document.getElementById('left-image');
const rightImage = document.getElementById('right-image');
const leftName = document.getElementById('left-name');
const rightName = document.getElementById('right-name');

// global variables for image and name data
let leftImageTaxon, rightImageTaxon;
let leftNameTaxon, rightNameTaxon;
let currentPair;

// debugging section
const debug = false;
let displayName = "both"; // taxon, vernacular, both
const iNatUser = null // change to user name to include only images by that user

// fetch from JSON file
async function fetchTaxonPairs() {
    try {
        const response = await fetch('./data/taxonPairs.json');
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        return await response.json();
    } catch (error) { console.error("Could not fetch taxon pairs:", error); return []; }
}

// display pair list for selection
async function showTaxonPairList() {
    const taxonPairs = await fetchTaxonPairs();
    if (taxonPairs.length === 0) { console.error("No taxon pairs available"); return; }
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;`;

    const list = document.createElement('div');
    list.style.cssText = `
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;`;

    // list pairs
    taxonPairs.forEach((pair, index) => {
        const button = document.createElement('button');
        button.innerHTML = `<i>${pair.taxon1}</i> <span style="color: gray;">vs</span> <i>${pair.taxon2}</i>`;
        button.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px;
            margin: 5px 0;
            background-color: #f0f0f0;
            border: none;
            border-radius: 5px;
            cursor: pointer;`;
        button.onclick = () => {
            currentPair = pair;
            setupGame(false);
            document.body.removeChild(modal);
        };
        list.appendChild(button);
    });

    modal.appendChild(list);
    document.body.appendChild(modal);

    modal.onclick = (e) => { if (e.target === modal) { document.body.removeChild(modal); } };
}

// optionally get pair of taxa from URL
function getURLParameters() {
    const params = new URLSearchParams(window.location.search);
    const [taxon1, taxon2] = [params.get('taxon1'), params.get('taxon2')];
    return (taxon1 !== null && taxon2 !== null) ? { taxon1, taxon2 } : null;
}

// implement sharing current pair URL
document.getElementById('share-button').addEventListener('click', shareCurrentPair);
function shareCurrentPair() {
    // Get the current URL
    let currentUrl = new URL(window.location.href);

    // Remove existing taxon1 and taxon2 parameters
    currentUrl.searchParams.delete('taxon1');
    currentUrl.searchParams.delete('taxon2');

    // Add new taxon1 and taxon2 parameters
    currentUrl.searchParams.set('taxon1', leftImageTaxon);
    currentUrl.searchParams.set('taxon2', rightImageTaxon);

    // Create the new URL string
    let shareUrl = currentUrl.toString();

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => { }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy link. Please try again.');
    });
}

//return random taxon pair by default, or one with given index
async function selectTaxonPair(index = null) {
    const taxonPairs = await fetchTaxonPairs();
    if (taxonPairs.length === 0) {
        console.error("No taxon pairs available");
        return null;
    }
    return !index ? taxonPairs[Math.floor(Math.random() * taxonPairs.length)] : taxonPairs[index];
}

// fetch random image of taxon from iNat
async function fetchRandomImage(taxonName, username = null) {
    try {
        // Search for the taxon
        const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa?q=${taxonName}`);
        const searchData = await searchResponse.json();
        if (searchData.results.length === 0) { throw new Error('Taxon not found'); }
        const taxonId = searchData.results[0].id;

        let images = [];
        // Get the taxon details
        const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
        const taxonData = await taxonResponse.json();
        if (taxonData.results.length === 0) { throw new Error('No details found for the taxon'); }
        const taxon = taxonData.results[0];
        
        // Extract images from taxon photos
        // square 75px • small 240px • medium 500px • large 1024px
        images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));
        if (images.length === 0) { throw new Error('No images found'); }

        // Select a random image
        const randomImage = images[Math.floor(Math.random() * images.length)];
        return randomImage;
    } catch (error) { console.error(error); return null; }
}

// fetch vernacular name of taxon from iNat
async function fetchVernacular(taxonName) {
    const baseUrl = 'https://api.inaturalist.org/v1/taxa';
    try {
        const response = await fetch(`${baseUrl}?q=${encodeURIComponent(taxonName)}`);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const taxon = data.results[0];
            if (taxon && taxon.preferred_common_name) {
                return taxon.preferred_common_name;
            } else { return 'No vernacular name'; }
        } else { return 'Taxon not found.'; }
    } catch (error) { console.error('Error fetching vernacular name:', error); return ""; }
}

async function setupGame(newPair = false)  {
    resetDraggables();

    if (newPair) { // select new taxon pair
        if (!currentPair) { // first round, no pair previously selected
            // try to fetch taxon pair from URL, use random from local array otherwise
            if (!(currentPair = getURLParameters())) { currentPair = await selectTaxonPair(); }
        // not the first round: get random from local array
        } else if (newPair === true) { currentPair = await selectTaxonPair(); }
    }

    // Randomly decide which taxon goes left and right (images)
    [leftImageTaxon, rightImageTaxon] = Math.random() < 0.5
        ? [currentPair.taxon1, currentPair.taxon2]
            : [currentPair.taxon2, currentPair.taxon1];

    showOverlay("Loading…", color="rgba(100, 100, 100, 0.8"); // TODO flaky hack to notify pictures still loading

    // fetch images and vernacular names
    const [leftImageURL, rightImageURL, leftImageVernacular, rightImageVernacular] = await Promise.all([
        fetchRandomImage(leftImageTaxon, iNatUser),
        fetchRandomImage(rightImageTaxon, iNatUser),
        fetchVernacular(leftImageTaxon),
        fetchVernacular(rightImageTaxon)
    ]);

    // place images
    [leftImage.src, rightImage.src] = [leftImageURL, rightImageURL];

    // Randomly decide placement of taxon names (name tiles)
    [leftNameTaxon, leftNameVernacular, rightNameTaxon, rightNameVernacular] = Math.random() < 0.5
        ? [rightImageTaxon, rightImageVernacular, leftImageTaxon, leftImageVernacular]
            : [leftImageTaxon, leftImageVernacular, rightImageTaxon, rightImageVernacular];

    // use extra attributes to track taxon ID on name tiles
    leftName.setAttribute('data-taxon', leftNameTaxon);
    rightName.setAttribute('data-taxon', rightNameTaxon);

    // display names on tiles
    leftName.innerHTML = `<i>${leftNameTaxon}</i><br>(${leftNameVernacular})`;
    rightName.innerHTML = `<i>${rightNameTaxon}</i><br>(${rightNameVernacular})`;

    hideOverlay(); // TODO remove later, see above
    // Call rearrangeElements after setting up the game
//    setTimeout(rearrangeElements, 100); // Use setTimeout to ensure images have loaded
}

// drag and drop name tile onto image
function dragStart(e) { e.dataTransfer.setData('text/plain', e.target.id); }
function dragOver(e) { e.preventDefault(); }
function drop(e) {
    e.preventDefault();
    const data = e.dataTransfer.getData('text');
    const draggedElement = document.getElementById(data);
    
    let dropZone;
    if (e.target.classList.contains('image-container')) {
        dropZone = e.target.querySelector('div[id$="-drop"]');
    } else if (e.target.tagName === 'IMG') {
        dropZone = e.target.nextElementSibling;
    } else { return; } // Drop on an invalid target

    dropZone.innerHTML = ''; // Clear any existing content
    dropZone.appendChild(draggedElement);

    // Automatically move the other name
    const otherNameId = data === 'left-name' ? 'right-name' : 'left-name';
    const otherName = document.getElementById(otherNameId);
    const otherDropZone = document.getElementById(dropZone.id === 'left-drop' ? 'right-drop' : 'left-drop');
    otherDropZone.innerHTML = '';
    otherDropZone.appendChild(otherName);

    checkAnswer(dropZone.id);
}
function resetDraggables() {
    const leftNameContainer = document.getElementById('left-name-container');
    const rightNameContainer = document.getElementById('right-name-container');
    const leftDrop = document.getElementById('left-drop');
    const rightDrop = document.getElementById('right-drop');
    
    // Move draggables back to the names container
    leftNameContainer.appendChild(document.getElementById('left-name'));
    rightNameContainer.appendChild(document.getElementById('right-name'));
    
    // Clear drop zones
    leftDrop.innerHTML = ''; rightDrop.innerHTML = '';
}

function checkAnswer(droppedZoneId) {
    // Get references to the left and right drop zones
    const leftDrop = document.getElementById('left-drop');
    const rightDrop = document.getElementById('right-drop');
    const colorCorrect = "rgba(0, 200, 0, 0.5)", colorWrong = "rgba(200, 0, 0, 0.5)";

    const leftAnswer = leftDrop.children[0]?.getAttribute('data-taxon');
    const rightAnswer = rightDrop.children[0]?.getAttribute('data-taxon');

    // Check if there are any answers in the drop zones
    if (leftAnswer || rightAnswer) {
        let isCorrect = false;
        // Check if the answer dropped in the left drop zone is correct
        if (droppedZoneId === 'left-drop') {
            isCorrect = leftAnswer === leftImageTaxon;
        // Check if the answer dropped in the right drop zone is correct
        } else { isCorrect = rightAnswer === rightImageTaxon; }

        if (isCorrect) {
            showOverlay('Correct!', colorCorrect);
            // Start a new game after 2 seconds
            setTimeout(() => {hideOverlay(); setupGame(false); }, 2400);
        } else {
            resetDraggables(); // remove tiles immediately
            showOverlay('Wrong!<br>Try again.', colorWrong);
            setTimeout(() => { hideOverlay(); }, 800); // Reset if wrong
        }
    }
}

// overlay for result and loading
function showOverlay(message="", color) {
    const overlay = document.getElementById('overlay');
    const messageElement = document.getElementById('overlay-message');
    const overlayBackground = document.getElementById('overlay');
    messageElement.innerHTML = message;
    overlayBackground.style.backgroundColor = color;
    overlay.classList.add('show');
}
function hideOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.classList.remove('show');
}

document.getElementById('version-id').textContent = 'Last modified: ' + document.lastModified;

// Event listeners
document.querySelectorAll('.draggable').forEach(element => {
    element.addEventListener('dragstart', dragStart);
});
document.querySelectorAll('.image-container').forEach(element => {
    element.addEventListener('dragover', dragOver);
    element.addEventListener('drop', drop);
});

document.getElementById('random-pair-button').addEventListener('click', async () => { await setupGame(true); });
document.getElementById('select-pair-button').addEventListener('click', showTaxonPairList);

(async function() {
    await setupGame(newPair = true);
})();

// global handles for image and name html elements
const elements = {
    imageOne: document.getElementById('image-1'),
    imageTwo: document.getElementById('image-2'),
    leftName: document.getElementById('left-name'),
    rightName: document.getElementById('right-name'),
    overlay: document.getElementById('overlay'),
    overlayMessage: document.getElementById('overlay-message')
};

// overlay colors
const overlayColors = {
    green: "rgba(76, 175, 80, 1.0)",
    red: "rgba(200, 0, 0, 1.0)",
    gray: "rgba(100, 100, 100, 0.8"
};

let isFirstLoad = true;
let currentPair;

// global variables for image and name data
let taxonImageOne, taxonImageTwo;
let taxonLeftName, taxonRightName;

// debugging section
const debug = false;

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
function shareCurrentPair() {
    // Get the current URL
    let currentUrl = new URL(window.location.href);

    // Remove existing taxon1 and taxon2 parameters
    currentUrl.searchParams.delete('taxon1');
    currentUrl.searchParams.delete('taxon2');

    // Add new taxon1 and taxon2 parameters
    currentUrl.searchParams.set('taxon1', taxonImageOne);
    currentUrl.searchParams.set('taxon2', taxonImageTwo);

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
async function fetchRandomImage(taxonName) {
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
            // try to fetch taxon pair from URL, use random from local array otherwise
            // not the first round: get random from local array
        currentPair = !currentPair ? (getURLParameters() || await selectTaxonPair()) : await selectTaxonPair();
    }

    // Randomly decide which taxon goes left and right (images)
    [taxonImageOne, taxonImageTwo] = Math.random() < 0.5
        ? [currentPair.taxon1, currentPair.taxon2]
            : [currentPair.taxon2, currentPair.taxon1];

    var startMessage = isFirstLoad ? "Drag the names!" : startMessage = "Loading…";
        showOverlay(startMessage, overlayColors.green);
        setTimeout(() => {
            hideOverlay();
            isFirstLoad = false;
        }, 1200);

    // fetch images and vernacular names
    const [imageOneURL, imageTwoURL, imageOneVernacular, imageTwoVernacular] = await Promise.all([
        fetchRandomImage(taxonImageOne),
        fetchRandomImage(taxonImageTwo),
        fetchVernacular(taxonImageOne),
        fetchVernacular(taxonImageTwo)
    ]);

    // place images
    [elements.imageOne.src, elements.imageTwo.src] = [imageOneURL, imageTwoURL];

    // Randomly decide placement of taxon names (name tiles)
    [taxonLeftName, leftNameVernacular, taxonRightName, rightNameVernacular] = Math.random() < 0.5
        ? [taxonImageTwo, imageTwoVernacular, taxonImageOne, imageOneVernacular]
            : [taxonImageOne, imageOneVernacular, taxonImageTwo, imageTwoVernacular];

    // use extra attributes to track taxon ID on name tiles
    elements.leftName.setAttribute('data-taxon', taxonLeftName);
    elements.rightName.setAttribute('data-taxon', taxonRightName);

    // display names on tiles
    elements.leftName.innerHTML = `<i>${taxonLeftName}</i><br>(${leftNameVernacular})`;
    elements.rightName.innerHTML = `<i>${taxonRightName}</i><br>(${rightNameVernacular})`;

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
        dropZone = e.target.querySelector('div[id^="drop-"]');
    } else if (e.target.tagName === 'IMG') {
        dropZone = e.target.nextElementSibling;
    } else { return; } // Drop on an invalid target

    dropZone.innerHTML = ''; // Clear any existing content
    dropZone.appendChild(draggedElement);

    // Automatically move the other name
    const otherNameId = data === 'left-name' ? 'right-name' : 'left-name';
    const otherName = document.getElementById(otherNameId);
    const otherDropZone = document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
    otherDropZone.innerHTML = '';
    otherDropZone.appendChild(otherName);

    checkAnswer(dropZone.id);
}
function resetDraggables() {
    const leftNameContainer = document.getElementById('left-name-container');
    const rightNameContainer = document.getElementById('right-name-container');
    const dropOne = document.getElementById('drop-1');
    const dropTwo = document.getElementById('drop-2');
    
    // Move draggables back to the names container
    leftNameContainer.appendChild(document.getElementById('left-name'));
    rightNameContainer.appendChild(document.getElementById('right-name'));
    
    // Clear drop zones
    dropOne.innerHTML = ''; dropTwo.innerHTML = '';
}

function checkAnswer(droppedZoneId) {
    // Get references to the left and right drop zones
    const dropOne = document.getElementById('drop-1');
    const dropTwo = document.getElementById('drop-2');
    const colorCorrect = overlayColors.green, colorWrong = overlayColors.red;

    const leftAnswer = dropOne.children[0]?.getAttribute('data-taxon');
    const rightAnswer = dropTwo.children[0]?.getAttribute('data-taxon');

    // Check if there are any answers in the drop zones
    if (leftAnswer || rightAnswer) {
        let isCorrect = false;
        // Check if the answer dropped in the first drop zone is correct
        if (droppedZoneId === 'drop-1') {
            isCorrect = leftAnswer === taxonImageOne;
        // Check if the answer dropped in the other drop zone is correct
        } else { isCorrect = rightAnswer === taxonImageTwo; }

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
    elements.overlayMessage.innerHTML = message;
    elements.overlay.style.backgroundColor = color;
    elements.overlay.classList.add('show');
}
function hideOverlay() {
    elements.overlay.classList.remove('show');
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

document.getElementById('share-button').addEventListener('click', shareCurrentPair);
document.getElementById('random-pair-button').addEventListener('click', async () => { await setupGame(true); });
document.getElementById('select-pair-button').addEventListener('click', showTaxonPairList);

// start
(async function() {
    await setupGame(newPair = true);
})();

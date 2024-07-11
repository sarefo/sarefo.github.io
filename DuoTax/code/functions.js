// global handles for image and name html elements
const elements = {
    imageOne: document.getElementById('image-1'),
    imageTwo: document.getElementById('image-2'),
    imageOneContainer: document.getElementById('image-container-1'),
    imageTwoContainer: document.getElementById('image-container-2'),
    namePair: document.querySelector('.name-pair'),
    leftName: document.getElementById('left-name'),
    rightName: document.getElementById('right-name'),
    overlay: document.getElementById('overlay'),
    overlayMessage: document.getElementById('overlay-message'),
    buttons: document.querySelectorAll('.bottom-button')
};

// overlay colors
const overlayColors = {
    green: "rgba(116,172,0,1.0)", /* iNat green; before rgba(76, 175, 80, 1.0)"*/
    red: "rgba(172, 0, 40, 1.0)",
    gray: "rgba(100, 100, 100, 0.8"
};

// global variables for swiping left
let startX = 0;
let endX = 0;
let isDragging = false;
let gameContainer;

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
//let isFullscreen = false;

let isFirstLoad = true;
let currentPair, preloadedPair;
// global variables for image and name data
let taxonImageOne, taxonImageTwo, taxonLeftName, taxonRightName;

// debugging section
const debug = false;

// functions

// Debounce function to prevent rapid toggling
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
/*
// Function to toggle fullscreen
function toggleFullscreen() {
    if (!isFullscreen) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { 
            document.documentElement.webkitRequestFullscreen();
        }
        isFullscreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { 
            document.webkitExitFullscreen();
        }
        isFullscreen = false;
    }
    scrollToTop();
}
// Debounced version of toggleFullscreen
const debouncedToggleFullscreen = debounce(toggleFullscreen, 300);
*/

// preload images for one taxon pair
async function preloadPair() {
    const pair = await selectTaxonPair();
    const [imageOneURL, imageTwoURL] = await Promise.all([
        fetchRandomImage(pair.taxon1),
        fetchRandomImage(pair.taxon2)
    ]);
    return { pair, imageOneURL, imageTwoURL };
}

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
    if (taxonPairs.length === 0) {
        console.error("No taxon pairs available");
        return;
    }
    const modal = document.createElement('div');
    modal.className = 'taxon-pair-modal';

    const list = document.createElement('div');
    list.className = 'taxon-pair-list';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'taxon-pair-cancel-button';
    cancelButton.onclick = () => {
        document.body.removeChild(modal);
    };

    taxonPairs.forEach((pair, index) => {
        const button = document.createElement('button');
        button.innerHTML = `<i>${pair.taxon1}</i> <span class="taxon-pair-versus">vs</span> <i>${pair.taxon2}</i>`;
        button.className = 'taxon-pair-button';
        button.onclick = () => {
            currentPair = pair;
            setupGame(false);
            document.body.removeChild(modal);
        };
        list.appendChild(button);
    });

    list.insertBefore(cancelButton, list.firstChild);

    modal.appendChild(list);
    document.body.appendChild(modal);

    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

// for user input of new taxon pairs
async function validateTaxon(taxonName) {
    try {
        const response = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(taxonName)}`);
        const data = await response.json();
        return data.results.length > 0 ? data.results[0] : null;
    } catch (error) {
        console.error('Error validating taxon:', error);
        return null;
    }
}
async function handleNewPairSubmit(event) {
    event.preventDefault();
    const taxon1 = document.getElementById('taxon1').value;
    const taxon2 = document.getElementById('taxon2').value;
    const dialogMessage = document.getElementById('dialog-message');

    dialogMessage.textContent = 'Validating taxa...';

    const [validatedTaxon1, validatedTaxon2] = await Promise.all([
        validateTaxon(taxon1),
        validateTaxon(taxon2)
    ]);

    if (validatedTaxon1 && validatedTaxon2) {
        const newPair = {
            taxon1: validatedTaxon1.name,
            taxon2: validatedTaxon2.name
        };

        try {
            const response = await fetch('./data/taxonPairs.json');
            const taxonPairs = await response.json();
            taxonPairs.push(newPair);

            await fetch('./data/taxonPairs.json', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taxonPairs),
            });

            currentPair = newPair;
            setupGame(false);
            document.getElementById('enter-pair-dialog').close();
        } catch (error) {
            console.error('Error updating taxonPairs.json:', error);
            dialogMessage.textContent = 'Error saving new pair. Please try again.';
        }
    } else {
        dialogMessage.textContent = 'One or both taxa are invalid. Please check and try again.';
    }
}
function clearDialogInputs() {
    document.getElementById('taxon1').value = '';
    document.getElementById('taxon2').value = '';
    document.getElementById('dialog-message').textContent = '';
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
        } else { return 'Taxon not found'; }
    } catch (error) { console.error('Error fetching vernacular name:', error); return ""; }
}

async function setupGame(newPair = false)  {
    resetDraggables();
    scrollToTop();

    // Fade out current images and show loading overlay
    elements.imageOne.classList.add('loading');
    elements.imageTwo.classList.add('loading');
    var startMessage = isFirstLoad ? "Drag the names!" : startMessage = "Loading…";
    showOverlay(startMessage, overlayColors.green);

    if (newPair) {
        if (isFirstLoad) {
            const urlParams = getURLParameters();
            if (urlParams) { currentPair = urlParams; }// else { urlParams = false; }
        } else if (preloadedPair) {
            currentPair = preloadedPair.pair;
            elements.imageOne.src = preloadedPair.imageOneURL;
            elements.imageTwo.src = preloadedPair.imageTwoURL;
        } else {
            // Fallback to current behavior if no preloaded pair
            currentPair = await selectTaxonPair();
        }
    }
    isFirstLoad = false;

/*    if (newPair) {
        if (preloadedPair) {
            currentPair = preloadedPair.pair;
            elements.imageOne.src = preloadedPair.imageOneURL;
            elements.imageTwo.src = preloadedPair.imageTwoURL;
        } else {
            // Fallback to current behavior if no preloaded pair
            currentPair = await selectTaxonPair();
            const [imageOneURL, imageTwoURL] = await Promise.all([
                fetchRandomImage(currentPair.taxon1),
                fetchRandomImage(currentPair.taxon2)
            ]);
            elements.imageOne.src = imageOneURL;
            elements.imageTwo.src = imageTwoURL;
        }
    }
*/
    // Randomly decide which taxon goes left and right (images)
    [taxonImageOne, taxonImageTwo] = Math.random() < 0.5
        ? [currentPair.taxon1, currentPair.taxon2]
            : [currentPair.taxon2, currentPair.taxon1];

    // fetch images and vernacular names
    const [imageOneURL, imageTwoURL, imageOneVernacular, imageTwoVernacular] = await Promise.all([
        fetchRandomImage(taxonImageOne),
        fetchRandomImage(taxonImageTwo),
        fetchVernacular(taxonImageOne),
        fetchVernacular(taxonImageTwo)
    ]);

    // Function to load image and remove 'loading' class
    const loadImage = (imgElement, src) => {
        return new Promise((resolve) => {
            imgElement.onload = () => {
                imgElement.classList.remove('loading');
                resolve();
            };
            imgElement.src = src;
            // Remove 'loading' class immediately if the image is cached
            if (imgElement.complete) {
                imgElement.classList.remove('loading');
                resolve();
            }
        });
    };

    // Load new images
    await Promise.all([
        loadImage(elements.imageOne, imageOneURL),
        loadImage(elements.imageTwo, imageTwoURL)
    ]);

    // Hide loading overlay
    hideOverlay();

    // Randomly decide placement of taxon names (name tiles)
    [taxonLeftName, leftNameVernacular, taxonRightName, rightNameVernacular] = Math.random() < 0.5
        ? [taxonImageTwo, imageTwoVernacular, taxonImageOne, imageOneVernacular]
            : [taxonImageOne, imageOneVernacular, taxonImageTwo, imageTwoVernacular];

    // use extra attributes to track taxon ID on name tiles
    elements.leftName.setAttribute('data-taxon', taxonLeftName);
    elements.rightName.setAttribute('data-taxon', taxonRightName);
    elements.leftName.style.zIndex = '10'; // weird Claude suggestion
    elements.rightName.style.zIndex = '10';

    // display names on tiles
    elements.leftName.innerHTML = `<i>${taxonLeftName}</i><br>(${leftNameVernacular})`;
    elements.rightName.innerHTML = `<i>${taxonRightName}</i><br>(${rightNameVernacular})`;

    // Preload next pair for future use
    preloadedPair = await preloadPair();
}
function loadImage(imgElement, src) {
    return new Promise((resolve, reject) => {
        imgElement.onload = resolve;
        imgElement.onerror = reject;
        imgElement.src = src;
    });
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
    const dropOne = document.getElementById('drop-1');
    const dropTwo = document.getElementById('drop-2');
    const colorCorrect = overlayColors.green;
    const colorWrong = overlayColors.red;

    const leftAnswer = dropOne.children[0]?.getAttribute('data-taxon');
    const rightAnswer = dropTwo.children[0]?.getAttribute('data-taxon');

    scrollToTop();

    if (leftAnswer && rightAnswer) {
        let isCorrect = false;
        if (droppedZoneId === 'drop-1') {
            isCorrect = leftAnswer === taxonImageOne;
        } else {
            isCorrect = rightAnswer === taxonImageTwo;
        }

        if (isCorrect) {

    elements.imageOne.classList.add('loading');
    elements.imageTwo.classList.add('loading');
            showOverlay('Correct!', colorCorrect);
            setTimeout(() => {
                hideOverlay();
                setupGame(false);
            }, 2400);
        } else {
            resetDraggables();
            showOverlay('Try again!', colorWrong);
            setTimeout(() => {
                hideOverlay();
            }, 800);
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

// swipe left on top image for new random pair
function handleSwipeOrDrag(e) {
    if (!isDragging) return;
    
    endX = e.type.includes('touch') ? e.changedTouches[0].screenX : e.screenX;
    const dragDistance = startX - endX;
    
    if (dragDistance > 50) {  // Swipe/drag left threshold
        gameContainer.classList.add('swipe-out-left');
        
        setTimeout(() => {
            gameContainer.classList.remove('swiping-left', 'swipe-out-left');
            resetGameContainerStyle();
            setupGame(true);
        }, 500); // Match this with the animation duration
    } else {
        // Reset if not swiped far enough
        resetGameContainerStyle();
    }
    
    isDragging = false;
}

function resetGameContainerStyle() {
    gameContainer.style.transform = '';
    gameContainer.style.opacity = '';
    document.querySelectorAll('.image-container').forEach(container => {
        container.style.transform = '';
        container.style.opacity = '';
    });
}

function handleDragMove(e) {
    if (!isDragging) return;
    
    const currentX = e.type.includes('touch') ? e.touches[0].screenX : e.screenX;
    const dragDistance = startX - currentX;
    
    if (dragDistance > 0) {
        const progress = Math.min(dragDistance / 100, 1);
        const rotation = progress * -5;
        const opacity = 1 - progress * 0.5;
        
        gameContainer.style.transform = `rotate(${rotation}deg) translateX(${-dragDistance}px)`;
        gameContainer.style.opacity = opacity;
    }
}

// touch events
[elements.imageOneContainer, elements.imageTwoContainer].forEach(container => {
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchend', handleImageInteraction);

    container.addEventListener('mousedown', (e) => {
        touchStartX = e.clientX;
        touchStartY = e.clientY;
    });

    container.addEventListener('mouseup', handleImageInteraction);
});

// tile dragging listeners
document.querySelectorAll('.draggable').forEach(element => {
    element.addEventListener('dragstart', dragStart);
    element.addEventListener('touchstart', touchStart, { passive: false });
    element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('touchend', touchEnd, { passive: false });
});
document.querySelectorAll('.image-container').forEach(element => {
    element.addEventListener('dragover', dragOver);
    element.addEventListener('drop', drop);
});

// button listeners
document.getElementById('share-button').addEventListener('click', shareCurrentPair);
document.getElementById('random-pair-button').addEventListener('click', async () => { await setupGame(true); });
document.getElementById('select-pair-button').addEventListener('click', showTaxonPairList);

document.getElementById('enter-pair-button').addEventListener('click', () => {
    clearDialogInputs();
    document.getElementById('enter-pair-dialog').showModal();
});
document.getElementById('close-dialog').addEventListener('click', () => {
    document.getElementById('enter-pair-dialog').close();
});
document.querySelector('#enter-pair-dialog form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleNewPairSubmit(event);
});
document.getElementById('surprise-button').addEventListener('click', () => {
    clearDialogInputs();
    surprise();
});

// Keyboard shortcuts
document.addEventListener('DOMContentLoaded', (event) => {
    document.addEventListener('keydown', function(event) {
        // Check if the enter pair dialog is open
        const isDialogOpen = document.getElementById('enter-pair-dialog').open;
        
        // Only process shortcuts if the dialog is not open
        if (!isDialogOpen) {
            if (event.key === 'r' || event.key === 'R') {
                document.getElementById('random-pair-button').click();
            }
            if (event.key === 's' || event.key === 'S') {
                document.getElementById('select-pair-button').click();
            }
            if (event.key === 'e' || event.key === 'E') {
                document.getElementById('enter-pair-button').click();
                // Clear the input field
                setTimeout(() => {
                    document.getElementById('taxon1').value = '';
                    document.getElementById('taxon1').focus();
                }, 0);
            }
            if (event.key === 'p' || event.key === 'P' || event.key === 'f' || event.key === 'F') {
                document.getElementById('surprise-button').click();
            }
        }
    });
});

function handleTouchStart(event) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].clientX;
    touchEndY = event.changedTouches[0].clientY;
    handleImageInteraction();
}

function handleMouseDown(event) {
    touchStartX = event.clientX;
    touchStartY = event.clientY;
}

function handleMouseUp(event) {
    touchEndX = event.clientX;
    touchEndY = event.clientY;
    handleImageInteraction();
}

function handleImageInteraction(event) {
    const diffX = Math.abs(touchStartX - (event.clientX || event.changedTouches[0].clientX));
    const diffY = Math.abs(touchStartY - (event.clientY || event.changedTouches[0].clientY));

    // If the touch/click moved less than 10 pixels, consider it a tap/click
//    if (diffX < 10 && diffY < 10) { debouncedToggleFullscreen(); }
}

//const elements = ['image-container-1', 'image-container-2'];
const events = ['touchstart', 'touchend', 'mousedown', 'mouseup'];
const handlers = [handleTouchStart, handleTouchEnd, handleMouseDown, handleMouseUp];

// touch + mouse event handlers for image containers
[elements.imageOneContainer, elements.imageTwoContainer].forEach(id => { const element = id;
  events.forEach((event, index) => { element.addEventListener(event, handlers[index]); }); });

/*
// part of fullscreen mode
function hideAddressBar() {
    if (document.documentElement.scrollHeight < window.outerHeight / window.devicePixelRatio) {
        document.documentElement.style.height = (window.outerHeight / window.devicePixelRatio) + 'px';
    }
    setTimeout(window.scrollTo(1, 1), 0);
}
// Call this function when the page loads and on orientation change
window.addEventListener("load", hideAddressBar);
window.addEventListener("orientationchange", hideAddressBar);
// Listen for fullscreen change events
document.addEventListener('fullscreenchange', () => { isFullscreen = !!document.fullscreenElement; });
document.addEventListener('webkitfullscreenchange', () => { isFullscreen = !!document.webkitFullscreenElement; });
*/

// Prevent scrolling in the name-pair area
elements.namePair.addEventListener('touchmove', function(event) { event.preventDefault(); }, { passive: false });
elements.namePair.addEventListener('wheel', function(event) { event.preventDefault(); }, { passive: false });

// Scroll to top when a button is clicked
elements.buttons.forEach(button => { button.addEventListener('click', () => { scrollToTop() }); });

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// tile dragging stuff
let draggedElement = null;
let touchOffset = { x: 0, y: 0 };
function touchStart(e) {
    e.preventDefault();
    draggedElement = e.target.closest('.draggable');
    if (!draggedElement) return;
    
    const touch = e.touches[0];
    const rect = draggedElement.getBoundingClientRect();
    touchOffset.x = touch.clientX - rect.left;
    touchOffset.y = touch.clientY - rect.top;
    
    draggedElement.style.zIndex = '1000';
    draggedElement.style.position = 'fixed';
    updateElementPosition(touch);
}
function touchMove(e) {
    e.preventDefault();
    if (draggedElement) {
        const touch = e.touches[0];
        updateElementPosition(touch);
    }
}
function touchEnd(e) {
    e.preventDefault();
    if (draggedElement) {
        const dropZone = getDropZone(e);
        if (dropZone) {
            handleDrop(dropZone);
        } else {
            resetDraggedElement();
        }
        draggedElement.style.zIndex = '';
        draggedElement.style.position = '';
        draggedElement = null;
    }
}
function updateElementPosition(touch) {
    draggedElement.style.left = `${touch.clientX - touchOffset.x}px`;
    draggedElement.style.top = `${touch.clientY - touchOffset.y}px`;
}
function getDropZone(e) {
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const imageContainers = document.querySelectorAll('.image-container');
    for (let container of imageContainers) {
        const rect = container.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
            return container.querySelector('.droppable');
        }
    }
    return null;
}
function handleDrop(dropZone) {
    if (!draggedElement) return;

    dropZone.innerHTML = '';
    dropZone.appendChild(draggedElement);
    draggedElement.style.position = 'static'; // Reset position to static
    draggedElement.style.left = '';
    draggedElement.style.top = '';
    draggedElement.style.width = '100%'; // Ensure the dragged element fills the drop zone width

    const otherNameId = draggedElement.id === 'left-name' ? 'right-name' : 'left-name';
    const otherName = document.getElementById(otherNameId);
    const otherDropZone = document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
    otherDropZone.innerHTML = '';
    otherDropZone.appendChild(otherName);

    checkAnswer(dropZone.id);
}

function resetDraggedElement() {
    const originalContainer = draggedElement.id === 'left-name' ? 'left-name-container' : 'right-name-container';
    document.getElementById(originalContainer).appendChild(draggedElement);
    draggedElement.style.position = '';
    draggedElement.style.left = '';
    draggedElement.style.top = '';
}

function surprise() {
    // placeholder
    const soundUrl = './sound/fart.mp3';
    // Create a new Audio object

const audio = new Audio(soundUrl);
    audio.play({ playbackMode: 'background' })
      .then(() => { /* Audio started playing successfully*/ }).catch(error => { console.error('Error playing the fart:', error); });
}

// start
(async function() {
    await setupGame(newPair = true);
    preloadedPair = await preloadPair();
    
})();

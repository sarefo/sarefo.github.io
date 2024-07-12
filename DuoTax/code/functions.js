// snapshot 20240712 2247 > stable, but tooo many preload requests
import api from './api.js';
import config from './config.js';
import dragAndDrop from './dragAndDrop.js';
import {elements, gameState} from './state.js';
import eventHandlers from './eventHandlers.js';
import game from './game.js';
import ui from './ui.js';
import utils from './utils.js';

(function() {

    document.getElementById('version-id').textContent = `Modified: ${document.lastModified}`;

    function initializeApp() {
        console.log("Initializing app");
        
        // Check for URL parameters
        const urlParams = utils.getURLParameters();
        if (urlParams) {
            console.log("URL parameters found:", urlParams);
            game.nextSelectedPair = urlParams;
        }
        
        game.setupGame(true);
        eventHandlers.initialize();
        console.log("App initialization complete");
    }
/*
    function loadImage(imgElement, src) {
        return new Promise((resolve, reject) => {
            imgElement.onload = resolve;
            imgElement.onerror = reject;
            imgElement.src = src;
        });
    }


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
        if (!event) return;  // handle cases where event is undefined
        const diffX = Math.abs(touchStartX - (event.clientX || event.changedTouches[0].clientX));
        const diffY = Math.abs(touchStartY - (event.clientY || event.changedTouches[0].clientY));
    }

    //const elements = ['image-container-1', 'image-container-2'];
    const events = ['touchstart', 'touchend', 'mousedown', 'mouseup'];
    const handlers = [handleTouchStart, handleTouchEnd, handleMouseDown, handleMouseUp];

    // touch + mouse event handlers for image containers
    [elements.imageOneContainer, elements.imageTwoContainer].forEach(id => { const element = id;
      events.forEach((event, index) => { element.addEventListener(event, handlers[index]); }); });

    // Prevent scrolling in the name-pair area
    elements.namePair.addEventListener('touchmove', function(event) { event.preventDefault(); }, { passive: false });
    elements.namePair.addEventListener('wheel', function(event) { event.preventDefault(); }, { passive: false });

    // Scroll to top when a button is clicked
    elements.buttons.forEach(button => { button.addEventListener('click', () => { ui.scrollToTop() }); });
*/
    // Expose initializeApp to the global scope
    window.initializeApp = initializeApp;

    // Call initialization function
    window.addEventListener('DOMContentLoaded', (event) => {
        window.initializeApp();
    });
})();

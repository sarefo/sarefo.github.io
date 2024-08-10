import { elements, gameState } from './state.js';
import logger from './logger.js';
import ui from './ui.js';
import utils from './utils.js';

const gameUI = {
    prepareImagesForLoading() {
        elements.imageOne.classList.add('image-container__image--loading');
        elements.imageTwo.classList.add('image-container__image--loading');
    },

    // determine height of tallest name tile, to keep layout stable over multiple rounds
    setNamePairHeight() {
        const leftName = document.getElementById('left-name');
        const rightName = document.getElementById('right-name');
        const namePair = document.querySelector('.name-pair');

        // Reset the height to auto to get the natural height
        leftName.style.height = 'auto';
        rightName.style.height = 'auto';
        namePair.style.height = 'auto';

        // Use requestAnimationFrame to ensure the browser has rendered the auto heights
        requestAnimationFrame(() => {
            const maxHeight = Math.max(leftName.offsetHeight, rightName.offsetHeight);

            // Set the height of the name-pair container
            namePair.style.height = `${maxHeight}px`;

            // Set both name tiles to this height
            leftName.style.height = `${maxHeight}px`;
            rightName.style.height = `${maxHeight}px`;
        });
    },

    setupNameTilesUI(leftName, rightName, leftNameVernacular, rightNameVernacular) {
        // Randomize the position of the name tiles
        const shouldSwap = Math.random() < 0.5;

        const nameOne = shouldSwap ? rightName : leftName;
        const nameTwo = shouldSwap ? leftName : rightName;
        const vernacularOne = shouldSwap ? rightNameVernacular : leftNameVernacular;
        const vernacularTwo = shouldSwap ? leftNameVernacular : rightNameVernacular;

        elements.leftName.setAttribute('data-taxon', nameOne);
        elements.rightName.setAttribute('data-taxon', nameTwo);
        elements.leftName.style.zIndex = '10';
        elements.rightName.style.zIndex = '10';

        // Create a span for the taxon name and a span for the vernacular name (if it exists and is not "n/a")
        elements.leftName.innerHTML = `
            <span class="name-pair__taxon-name">${nameOne}</span>
            ${vernacularOne && vernacularOne !== "N/a" ? `<span class="name-pair__vernacular-name">${vernacularOne}</span>` : ''}
        `;
        logger.debug(`vernacular one is ${vernacularOne}`);
        elements.rightName.innerHTML = `
            <span class="name-pair__taxon-name">${nameTwo}</span>
            ${vernacularTwo && vernacularTwo !== "N/a" ? `<span class="name-pair__vernacular-name">${vernacularTwo}</span>` : ''}
        `;
        logger.debug(`vernacular two is ${vernacularTwo}`);

        gameState.taxonLeftName = nameOne;
        gameState.taxonRightName = nameTwo;

        // Call setNamePairHeight after setting the content
        this.setNamePairHeight();
    },

    updateLevelIndicator(level) {
        const indicator = document.getElementById('level-indicator');
        if (!indicator) return;

        const chiliCount = parseInt(level) || 0;
        indicator.innerHTML = ''; // Clear existing content

        for (let i = 0; i < chiliCount; i++) {
            const chiliSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            chiliSvg.classList.add('icon', 'icon-chili');
            chiliSvg.setAttribute('viewBox', '0 0 24 24');
            //         chiliSvg.style.display = 'inline-block'; // Ensure the SVG is visible

            const useElement = document.createElementNS("http://www.w3.org/2000/svg", "use");
            useElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-spicy');

            useElement.setAttribute('transform', 'scale(1.2) translate(-2, -2)'); // enlarge a bit

            chiliSvg.appendChild(useElement);
            indicator.appendChild(chiliSvg);
        }

        // Adjust container width based on number of chilis
        indicator.style.width = `${chiliCount * 26 + 16}px`; // Adjusted width calculation
    },

};

Object.keys(gameUI).forEach(key => {
    if (typeof gameUI[key] === 'function') {
        gameUI[key] = gameUI[key].bind(gameUI);
    }
});

export default gameUI;

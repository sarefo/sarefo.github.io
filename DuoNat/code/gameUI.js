import { elements, gameState } from './state.js';
import logger from './logger.js';
import utils from './utils.js';

const gameUI = {
    imageHandling: {
        prepareImagesForLoading() {
            elements.imageOne.classList.add('image-container__image--loading');
            elements.imageTwo.classList.add('image-container__image--loading');
        }
    },

    layoutManagement: {
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
        }
    },

    nameTiles: {
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
            this.layoutManagement.setNamePairHeight();
        }
    },

};

// Bind all methods to ensure correct 'this' context
Object.keys(gameUI).forEach(key => {
    if (typeof gameUI[key] === 'object') {
        Object.keys(gameUI[key]).forEach(subKey => {
            if (typeof gameUI[key][subKey] === 'function') {
                gameUI[key][subKey] = gameUI[key][subKey].bind(gameUI);
            }
        });
    }
});

export default gameUI;

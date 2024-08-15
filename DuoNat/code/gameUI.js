import logger from './logger.js';
import state from './state.js';

const gameUI = {
    imageHandling: {
        prepareImagesForLoading() {
            state.getElement('imageOne').classList.add('image-container__image--loading');
            state.getElement('imageTwo').classList.add('image-container__image--loading');
        }
    },

    layoutManagement: {
        // determine height of tallest name tile, to keep layout stable over multiple rounds
        setNamePairHeight() {
            const leftName = document.getElementById('left-name');
            const rightName = document.getElementById('right-name');
            const namePair = document.querySelector('.name-pair');

            this.layoutManagement._resetHeights(leftName, rightName, namePair);
            this.layoutManagement._setMaxHeight(leftName, rightName, namePair);
        },

        _resetHeights(leftName, rightName, namePair) {
            leftName.style.height = 'auto';
            rightName.style.height = 'auto';
            namePair.style.height = 'auto';
        },

        _setMaxHeight(leftName, rightName, namePair) {
            requestAnimationFrame(() => {
                const maxHeight = Math.max(leftName.offsetHeight, rightName.offsetHeight);
                this.layoutManagement._applyHeights(leftName, rightName, namePair, maxHeight);
            });
        },

        _applyHeights(leftName, rightName, namePair, maxHeight) {
            namePair.style.height = `${maxHeight}px`;
            leftName.style.height = `${maxHeight}px`;
            rightName.style.height = `${maxHeight}px`;
        }
    },

    nameTiles: {
        setupNameTilesUI(leftName, rightName, leftNameVernacular, rightNameVernacular) {
            const { nameOne, nameTwo, vernacularOne, vernacularTwo } = gameUI.nameTiles._randomizeNames(leftName, rightName, leftNameVernacular, rightNameVernacular);
            
            gameUI.nameTiles._setNameAttributes(nameOne, nameTwo);
            gameUI.nameTiles._setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo);
            gameUI.nameTiles._updateGameState(nameOne, nameTwo);
            
            this.layoutManagement.setNamePairHeight();
        },

        _randomizeNames(leftName, rightName, leftNameVernacular, rightNameVernacular) {
            const shouldSwap = Math.random() < 0.5;
            return {
                nameOne: shouldSwap ? rightName : leftName,
                nameTwo: shouldSwap ? leftName : rightName,
                vernacularOne: shouldSwap ? rightNameVernacular : leftNameVernacular,
                vernacularTwo: shouldSwap ? leftNameVernacular : rightNameVernacular
            };
        },

        _setNameAttributes(nameOne, nameTwo) {
            state.getElement('leftName').setAttribute('data-taxon', nameOne);
            state.getElement('rightName').setAttribute('data-taxon', nameTwo);
            state.getElement('leftName').style.zIndex = '10';
            state.getElement('rightName').style.zIndex = '10';
        },

        _setNameContent(nameOne, nameTwo, vernacularOne, vernacularTwo) {
            state.getElement('leftName').innerHTML = gameUI.nameTiles._createNameHTML(nameOne, vernacularOne);
            state.getElement('rightName').innerHTML = gameUI.nameTiles._createNameHTML(nameTwo, vernacularTwo);
        },

        _createNameHTML(name, vernacular) {
            return `
                <span class="name-pair__taxon-name">${name}</span>
                ${vernacular && vernacular !== "N/a" ? `<span class="name-pair__vernacular-name">${vernacular}</span>` : ''}
            `;
        },

        _updateGameState(nameOne, nameTwo) {
            state.setTaxonLeftName = nameOne;
            state.setTaxonRightName = nameTwo;
        }
    },
};

// Create the public API
const publicAPI = {
    setNamePairHeight: gameUI.layoutManagement.setNamePairHeight,
    setupNameTilesUI: gameUI.nameTiles.setupNameTilesUI,
    prepareImagesForLoading: gameUI.imageHandling.prepareImagesForLoading
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

// Bind the public API methods to the gameUI object
Object.keys(publicAPI).forEach(key => {
    publicAPI[key] = publicAPI[key].bind(gameUI);
});

export default publicAPI;

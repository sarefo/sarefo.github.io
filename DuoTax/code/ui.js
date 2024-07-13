// UI functions

import api from './api.js';
import {elements, gameState} from './state.js';
import game from './game.js';

const ui = {

    // Enter pair dialog 
    clearDialogInputs: function () {
            document.getElementById('taxon1').value = '';
            document.getElementById('taxon2').value = '';
            document.getElementById('dialog-message').textContent = '';
        },

    resetGameContainerStyle: function () {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.style.transform = '';
            gameContainer.style.opacity = '';
        }
        elements.imageOneContainer.style.transform = '';
        elements.imageOneContainer.style.opacity = '';
        elements.imageTwoContainer.style.transform = '';
        elements.imageTwoContainer.style.opacity = '';
    },

    // TODO move to "const ui" > eventhandler trouble?
    // display pair list for selection
    showTaxonPairList: function () {
        api.fetchTaxonPairs().then(taxonPairs => {
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
                    // Set the selected pair as the next pair to be used
                    game.nextSelectedPair = pair;
                    
                    // Close the modal
                    document.body.removeChild(modal);
                    
                    // Set up the game with the new pair
                    game.setupGame(true);
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
        });
    },

    showOverlay: function (message="", color) {
        elements.overlayMessage.innerHTML = message;
        elements.overlay.style.backgroundColor = color;
        elements.overlay.classList.add('show');
    },

    updateOverlayMessage: function (message) {
        elements.overlayMessage.innerHTML = message;
    },

    hideOverlay: function () {
        elements.overlay.classList.remove('show');
    },

    scrollToTop: function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showINatDownDialog: function () {
        const dialog = document.getElementById('inat-down-dialog');
        dialog.showModal();
        
        document.getElementById('check-inat-status').addEventListener('click', () => {
            window.open('https://inaturalist.org', '_blank');
        });
        
        document.getElementById('retry-connection').addEventListener('click', async () => {
            dialog.close();
            if (await api.isINaturalistReachable()) {
                game.setupGame(true);
            } else {
                showINatDownDialog();
            }
        });
    }

}; // const ui

export default ui;

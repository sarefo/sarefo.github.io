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
            cancelButton.onclick = closeModal;
            
            taxonPairs.forEach((pair, index) => {
                const button = document.createElement('button');
                button.innerHTML = `<i>${pair.taxon1}</i> <span class="taxon-pair-versus">vs</span> <i>${pair.taxon2}</i>`;
                button.className = 'taxon-pair-button';
                button.onclick = () => {
                    // Set the selected pair as the next pair to be used
                    game.nextSelectedPair = pair;
                    
                    // Close the modal
                    closeModal();
                    
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
                    closeModal();
                }
            };

            // Add event listener for the Escape key
            const handleEscapeKey = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                }
            };

            document.addEventListener('keydown', handleEscapeKey);

            // Function to close the modal
            function closeModal() {
                document.body.removeChild(modal);
                document.removeEventListener('keydown', handleEscapeKey);
            }
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
    },

initializeDraggables: function() {
    const draggables = document.querySelectorAll('.draggable');
    let draggedElement = null;
    let originalRect = null;

    draggables.forEach(draggable => {
        draggable.addEventListener('mousedown', startDragging);
        draggable.addEventListener('touchstart', startDragging, { passive: false });
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);

    function startDragging(e) {
        e.preventDefault(); // Prevent default to disable text selection
        draggedElement = this;
        draggedElement.classList.add('dragging');
        
        // Store the original position and size
        originalRect = draggedElement.getBoundingClientRect();
        
        // Set initial position
        const event = e.type.startsWith('touch') ? e.touches[0] : e;
        const offsetX = event.clientX - originalRect.left;
        const offsetY = event.clientY - originalRect.top;
        
        draggedElement.style.position = 'fixed';
        draggedElement.style.zIndex = '1000';
        draggedElement.style.width = `${originalRect.width}px`;
        draggedElement.style.height = `${originalRect.height}px`;
        draggedElement.style.left = `${originalRect.left}px`;
        draggedElement.style.top = `${originalRect.top}px`;

        // Store offset for drag calculations
        draggedElement.dataset.offsetX = offsetX;
        draggedElement.dataset.offsetY = offsetY;
    }

    function drag(e) {
        if (!draggedElement) return;
        e.preventDefault();

        const event = e.type.startsWith('touch') ? e.touches[0] : e;
        const x = event.clientX - draggedElement.dataset.offsetX;
        const y = event.clientY - draggedElement.dataset.offsetY;

        draggedElement.style.left = `${x}px`;
        draggedElement.style.top = `${y}px`;
    }

    function stopDragging() {
        if (!draggedElement) return;

        draggedElement.classList.remove('dragging');
        draggedElement.style.position = '';
        draggedElement.style.zIndex = '';
        draggedElement.style.width = '';
        draggedElement.style.height = '';
        draggedElement.style.left = '';
        draggedElement.style.top = '';
        
        draggedElement = null;
        originalRect = null;
    }
},

}; // const ui

export default ui;

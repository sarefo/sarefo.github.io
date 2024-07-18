// UI functions

import api from './api.js';
import config from './config.js';
import {elements, gameState} from './state.js';
import game from './game.js';
import logger from './logger.js';

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
                logger.error("No taxon pairs available");
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

    scrollToTop: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

showINatDownDialog: function () {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    const dialog = document.getElementById('inat-down-dialog');
    dialog.showModal();
    
    const checkStatusBtn = document.getElementById('check-inat-status');
    const retryConnectionBtn = document.getElementById('retry-connection');
    
    const checkStatusHandler = () => {
        window.open('https://inaturalist.org', '_blank');
    };
    
    const retryConnectionHandler = async () => {
        dialog.close();
        if (await api.isINaturalistReachable()) {
            game.setupGame(true);
        } else {
            this.showINatDownDialog();
        }
    };
    
    checkStatusBtn.addEventListener('click', checkStatusHandler);
    retryConnectionBtn.addEventListener('click', retryConnectionHandler);
    
    dialog.addEventListener('close', () => {
        checkStatusBtn.removeEventListener('click', checkStatusHandler);
        retryConnectionBtn.removeEventListener('click', retryConnectionHandler);
    });
},
    hideINatDownDialog: function () {
        const dialog = document.getElementById('inat-down-dialog');
        dialog.close();
    },

    initializeDraggables: function () {
            const draggables = document.querySelectorAll('.draggable');
            const dropzones = document.querySelectorAll('.dropzone');

            draggables.forEach(draggable => {
                draggable.addEventListener('mousedown', dragStart);
                draggable.addEventListener('touchstart', dragStart, { passive: false });
            });

            function dragStart(e) {
                e.preventDefault();
                if (e.type === 'touchstart') {
                    initialX = e.touches[0].clientX - this.getBoundingClientRect().left;
                    initialY = e.touches[0].clientY - this.getBoundingClientRect().top;
                } else {
                    initialX = e.clientX - this.getBoundingClientRect().left;
                    initialY = e.clientY - this.getBoundingClientRect().top;
                }

                this.classList.add('dragging');
                document.addEventListener('mousemove', drag);
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('mouseup', dragEnd);
                document.addEventListener('touchend', dragEnd);
            }

            function drag(e) {
                e.preventDefault();
                const currentDraggable = document.querySelector('.dragging');
                if (!currentDraggable) return;

                let currentX, currentY;
                if (e.type === 'touchmove') {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                currentDraggable.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }

            function dragEnd(e) {
                const currentDraggable = document.querySelector('.dragging');
                if (!currentDraggable) return;

                document.removeEventListener('mousemove', drag);
                document.removeEventListener('touchmove', drag);
                document.removeEventListener('mouseup', dragEnd);
                document.removeEventListener('touchend', dragEnd);

                currentDraggable.classList.remove('dragging');

                let dropzone = null;
                dropzones.forEach(zone => {
                    const rect = zone.getBoundingClientRect();
                    const draggableRect = currentDraggable.getBoundingClientRect();
                    if (
                        draggableRect.left + draggableRect.width / 2 > rect.left &&
                        draggableRect.left + draggableRect.width / 2 < rect.right &&
                        draggableRect.top + draggableRect.height / 2 > rect.top &&
                        draggableRect.top + draggableRect.height / 2 < rect.bottom
                    ) {
                        dropzone = zone;
                    }
                });

                if (dropzone) {
                    dropzone.appendChild(currentDraggable);
                    currentDraggable.style.transform = 'none';
                    checkAnswer();
                } else {
                    // If not dropped in a valid dropzone, revert to original position
                    currentDraggable.style.transition = 'transform 0.3s ease-out';
                    currentDraggable.style.transform = 'translate(0, 0)';
                    setTimeout(() => {
                        currentDraggable.style.transition = '';
                    }, 300);
                }
            }
        },

    showTutorial: function() {
        const steps = [
            "Welcome to DuoNat!<br>Let's learn how to play.",
            "You'll see two images of different taxa.",
            "Drag the name tags in the center<br>to match them with the correct images.",
            "If you're correct,<br>you'll move to the next round.",
            "Swipe left for a new set of species.",
            "Share your favorite pairs<br>with the share buttom on top.",
            "Scroll down for more functions.",
            "Ready to start? Let's go!"
        ];

        let currentStep = 0;

        const showStep = () => {
            if (currentStep < steps.length) {
                this.showOverlay(steps[currentStep], config.overlayColors.green);
                currentStep++;
                setTimeout(() => {
                    this.hideOverlay();
                    setTimeout(showStep, 800); // Short pause between steps
                }, 4000); // Show each step for 3 seconds
            } else {
                this.hideOverlay();
                //game.setupGame(true); // Start a new game after the tutorial
            }
        };

        // Close the help dialog before starting the tutorial
        document.getElementById('help-dialog').close();
        showStep();
    },

}; // const ui

export default ui;

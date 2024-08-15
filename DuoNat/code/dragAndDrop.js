import gameLogic from './gameLogic.js';
import logger from './logger.js';
import state from './state.js';

const dragAndDrop = {
    state: {
        draggedElement: null,
        touchOffset: { x: 0, y: 0 },
        gameContainer: null,
        initialY: 0,
        otherElementInitialY: 0,
    },

    init: {
        initialize() {
            this.state.gameContainer = document.querySelector('.game-container');
            this.eventListeners.addEventListeners();
        },
    },

    eventListeners: {
        addEventListeners() {
            document.querySelectorAll('.name-pair__item--draggable').forEach(element => {
                element.addEventListener('dragstart', this.dragHandlers.dragStart.bind(this));
                element.addEventListener('mousedown', this.dragHandlers.mouseStart.bind(this));
                element.addEventListener('touchstart', this.dragHandlers.touchStart.bind(this), { passive: false });
                element.addEventListener('touchmove', this.dragHandlers.touchMove.bind(this), { passive: false });
                element.addEventListener('touchend', this.dragHandlers.touchEnd.bind(this), { passive: false });
            });

            document.addEventListener('mousemove', this.dragHandlers.mouseMove.bind(this));
            document.addEventListener('mouseup', this.dragHandlers.mouseEnd.bind(this));

            document.querySelectorAll('.image-container').forEach(element => {
                element.addEventListener('dragover', this.dropHandlers.dragOver.bind(this));
                element.addEventListener('dragleave', this.dropHandlers.dragLeave.bind(this));
                element.addEventListener('drop', this.dropHandlers.drop.bind(this));
            });
        },
    },

    dragHandlers: {
        mouseStart(e) {
            e.preventDefault();
            this.state.draggedElement = e.target.closest('.name-pair__item--draggable');
            if (!this.state.draggedElement) return;

            const rect = this.state.draggedElement.getBoundingClientRect();
            this.state.touchOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            this.state.initialY = e.clientY;
            this.utils.captureOtherElementPosition();

            this.state.draggedElement.classList.add('name-pair__item--dragging');
            this.state.draggedElement.style.zIndex = '1000';
            
            this.utils.updateElementPosition(e);
        },

        touchStart(e) {
            e.preventDefault();
            this.state.draggedElement = e.target.closest('.name-pair__item--draggable');
            if (!this.state.draggedElement) return;

            const touch = e.touches[0];
            const rect = this.state.draggedElement.getBoundingClientRect();
            this.state.touchOffset = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            this.state.initialY = touch.clientY;
            this.utils.captureOtherElementPosition();

            this.state.draggedElement.classList.add('name-pair__item--dragging');
            this.state.draggedElement.style.zIndex = '1000';
            
            this.utils.updateElementPosition(touch);
        },

        mouseMove(e) {
            if (this.state.draggedElement) {
                e.preventDefault();
                this.utils.updateElementPosition(e);
            }
        },

        dragStart(e) {
            e.dataTransfer.setData('text/plain', e.target.id);
        },

        touchMove(e) {
            e.preventDefault();
            if (this.state.draggedElement) {
                const touch = e.touches[0];
                this.utils.updateElementPosition(touch);
            }
        },

        mouseEnd(e) {
            if (this.state.draggedElement) {
                const dropZone = this.utils.getDropZone(e);
                if (dropZone) {
                    this.dropHandlers.handleDrop(dropZone);
                } else {
                    this.utils.resetDraggedElement();
                }
                this.state.draggedElement = null;
            }
        },

        touchEnd(e) {
            e.preventDefault();
            if (this.state.draggedElement) {
                const dropZone = this.utils.getDropZone(e);
                if (dropZone) {
                    this.dropHandlers.handleDrop(dropZone);
                } else {
                    this.utils.resetDraggedElement();
                }
                this.state.draggedElement = null;
            }
        },
    },

    dropHandlers: {
        dragOver(e) {
            e.preventDefault();
            if (e.target.classList.contains('image-container')) {
                e.target.classList.add('image-container--drag-over');
            }
        },

        dragLeave(e) {
            if (e.target.classList.contains('image-container')) {
                e.target.classList.remove('image-container--drag-over');
            }
        },

        drop(e) {
            e.preventDefault();
            const data = e.dataTransfer.getData('text');
            const draggedElement = document.getElementById(data);

            let dropZone;
            if (e.target.classList.contains('image-container')) {
                e.target.classList.remove('image-container--drag-over');
                dropZone = e.target.querySelector('div[id^="drop-"]');
            } else if (e.target.tagName === 'IMG') {
                e.target.parentElement.classList.remove('image-container--drag-over');
                dropZone = e.target.nextElementSibling;
            } else {
                return; // Drop on an invalid target
            }

            this.handleDrop(dropZone, draggedElement);
        },

        handleDrop(dropZone, draggedElement = this.state.draggedElement) {
            if (!draggedElement) return;

            const isCorrect = this.utils.isAnswerCorrect(dropZone.id, draggedElement.id);
            const otherElement = draggedElement.id === 'left-name' ?
                document.getElementById('right-name') :
                document.getElementById('left-name');

            this.utils.animateElement(draggedElement, dropZone, isCorrect);
            this.utils.animateElement(otherElement, this.utils.getOtherDropZone(dropZone), isCorrect);

            setTimeout(() => {
                this.utils.finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect);
                // Ensure the game is in PLAYING state before checking the answer
                state.setState(state.GameState.PLAYING);
                gameLogic.checkAnswer(dropZone.id);
            }, 300);
        },
    },

    utils: {
        captureOtherElementPosition() {
            const otherElement = this.state.draggedElement.id === 'left-name' ?
                document.getElementById('right-name') :
                document.getElementById('left-name');
            if (otherElement) {
                const rect = otherElement.getBoundingClientRect();
                this.state.otherElementInitialY = rect.top;
            }
        },

        isAnswerCorrect(dropZoneId, draggedElementId) {
            try {
                const isLeftDrop = dropZoneId === 'drop-1';
                const draggedElement = document.getElementById(draggedElementId);

                if (!draggedElement) {
                    logger.error('Dragged element not found');
                    return false;
                }

                const draggedTaxon = draggedElement.getAttribute('data-taxon');

                let gameState = state.getGameState();
                if (!gameState) {
                    logger.error('gameState is undefined');
                    return false;
                }

                const correctTaxon = isLeftDrop ? gameState.taxonImageOne : gameState.taxonImageTwo;

                if (!correctTaxon) {
                    logger.error('Correct taxon is undefined in gameState');
                    return false;
                }

                return draggedTaxon === correctTaxon;
            } catch (error) {
                logger.error('Error in isAnswerCorrect:', error);
                return false;
            }
        },

        getDropZone(e) {
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const imageContainers = document.querySelectorAll('.image-container');
            for (let container of imageContainers) {
                const rect = container.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    return container.querySelector('div[id^="drop-"]');
                }
            }
            return null;
        },

        getOtherDropZone(dropZone) {
            return document.getElementById(dropZone.id === 'drop-1' ? 'drop-2' : 'drop-1');
        },

        resetDraggedElement() {
            if (!this.state.draggedElement) return;

            const elements = [
                this.state.draggedElement,
                this.state.draggedElement.id === 'left-name' ? document.getElementById('right-name') : document.getElementById('left-name')
            ];

            elements.forEach(element => {
                const originalContainer = element.id === 'left-name' ? 'name-pair__container--left' : 'name-pair__container--right';
                const container = document.getElementsByClassName(originalContainer)[0];

                element.classList.remove('name-pair__item--dragging', 'name-pair__item--landing');
                element.style = '';
                container.appendChild(element);
            });

            this.state.draggedElement = null;
        },

        updateElementPosition(event) {
            if (!this.state.draggedElement || !this.state.gameContainer) return;

            const gameContainerRect = this.state.gameContainer.getBoundingClientRect();
            const elementWidth = this.state.draggedElement.offsetWidth;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;
            const deltaY = clientY - this.state.initialY;

            const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);
            const topPosition = clientY - this.state.touchOffset.y;

            requestAnimationFrame(() => {
                this.state.draggedElement.style.position = 'fixed';
                this.state.draggedElement.style.left = `${leftPosition}px`;
                this.state.draggedElement.style.top = `${topPosition}px`;

                this.utils.mirrorOtherElement(deltaY, gameContainerRect, elementWidth);
            });
        },

        mirrorOtherElement(deltaY, gameContainerRect, elementWidth) {
            const otherElement = this.state.draggedElement.id === 'left-name' ?
                document.getElementById('right-name') :
                document.getElementById('left-name');

            if (otherElement) {
                const leftPosition = gameContainerRect.left + (gameContainerRect.width / 2) - (elementWidth / 2);
                const topPosition = this.state.otherElementInitialY - deltaY;

                otherElement.style.position = 'fixed';
                otherElement.style.left = `${leftPosition}px`;
                otherElement.style.top = `${topPosition}px`;
            }
        },

        animateElement(element, targetZone, isCorrect) {
            const currentRect = element.getBoundingClientRect();
            let targetRect;

            if (isCorrect) {
                targetRect = targetZone.getBoundingClientRect();
            } else {
                const originalContainer = element.id === 'left-name' ?
                    document.querySelector('.name-pair__container--left') :
                    document.querySelector('.name-pair__container--right');
                targetRect = originalContainer.getBoundingClientRect();
            }

            element.style.position = 'fixed';
            element.style.left = `${currentRect.left}px`;
            element.style.top = `${currentRect.top}px`;
            element.style.width = `${currentRect.width}px`;
            element.style.height = `${currentRect.height}px`;
            element.style.zIndex = '1000';

            document.body.appendChild(element);
            element.offsetHeight; // Force reflow
            element.classList.add('name-pair__item--landing');

            element.style.left = `${targetRect.left}px`;
            element.style.top = `${targetRect.top}px`;
            element.style.width = `${targetRect.width}px`;
            element.style.height = `${targetRect.height}px`;
        },

        finalizeDropAnimation(draggedElement, otherElement, dropZone, isCorrect) {
            [draggedElement, otherElement].forEach(element => {
                element.classList.remove('name-pair__item--landing', 'name-pair__item--dragging');
                element.style.position = '';
                element.style.left = '';
                element.style.top = '';
                element.style.width = '';
                element.style.height = '';
                element.style.zIndex = '';
            });

            if (isCorrect) {
                dropZone.innerHTML = '';
                dropZone.appendChild(draggedElement);

                const otherDropZone = this.utils.getOtherDropZone(dropZone);
                otherDropZone.innerHTML = '';
                otherDropZone.appendChild(otherElement);

                gameLogic.checkAnswer(dropZone.id);
            } else {
                const leftContainer = document.querySelector('.name-pair__container--left');
                const rightContainer = document.querySelector('.name-pair__container--right');

                leftContainer.appendChild(document.getElementById('left-name'));
                rightContainer.appendChild(document.getElementById('right-name'));
            }

            draggedElement.classList.add(isCorrect ? 'name-pair__item--correct' : 'name-pair__item--incorrect');
            setTimeout(() => {
                draggedElement.classList.remove('name-pair__item--correct', 'name-pair__item--incorrect');
            }, 600);
        },
    },
};

// Bind all methods to ensure correct 'this' context
Object.keys(dragAndDrop).forEach(key => {
    if (typeof dragAndDrop[key] === 'object') {
        Object.keys(dragAndDrop[key]).forEach(methodKey => {
            if (typeof dragAndDrop[key][methodKey] === 'function') {
                dragAndDrop[key][methodKey] = dragAndDrop[key][methodKey].bind(dragAndDrop);
            }
        });
    }
});

const publicAPI = {
    initialize: dragAndDrop.init.initialize
};

export default publicAPI;

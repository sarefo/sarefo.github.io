import config from './config.js';
import gameSetup from './gameSetup.js';
import logger from './logger.js';
import roundManager from './roundManager.js';
import state from './state.js';
import ui from './ui.js';
import utils from './utils.js';

const gameLogic = {
    answerHandling: {
        checkAnswer(droppedZoneId) {
            if (!this.isGameStateValid()) return;

            state.setState(state.GameState.CHECKING);
            const answers = this.getAnswersFromDropZones();

            if (this.areAnswersComplete(answers)) {
                this.evaluateAnswer(answers);
            } else {
                this.handleIncompleteAnswer();
            }
        },

        isGameStateValid() {
            const currentState = state.getState();
            if (currentState !== state.GameState.PLAYING) {
                logger.debug(`Cannot check answer when not in PLAYING state. Current state: ${currentState}`);
                return false;
            }
            return true;
        },

        getAnswersFromDropZones() {
            const dropOne = document.getElementById('drop-1');
            const dropTwo = document.getElementById('drop-2');
            return {
                leftAnswer: dropOne.children[0]?.getAttribute('data-taxon'),
                rightAnswer: dropTwo.children[0]?.getAttribute('data-taxon')
            };
        },

        areAnswersComplete(answers) {
            return answers.leftAnswer && answers.rightAnswer;
        },

        evaluateAnswer(answers) {
            const taxonImageOne = state.getTaxonImageOne();
            const taxonImageTwo = state.getTaxonImageTwo();
            
            const isCorrect =
                answers.leftAnswer === taxonImageOne &&
                answers.rightAnswer === taxonImageTwo;

            if (isCorrect) {
                this.handleCorrectAnswer();
            } else {
                this.handleIncorrectAnswer();
            }
        },

        handleIncompleteAnswer() {
            logger.debug("Incomplete answer. Returning to PLAYING state.");
            state.setState(state.GameState.PLAYING);
        },

        async handleCorrectAnswer() {
            logger.debug('Handling correct answer');
            await ui.showOverlay('Correct!', config.overlayColors.green);
            ui.prepareImagesForLoading();
            await utils.ui.sleep(1700);
            await gameSetup.setupGame(false);
            await utils.ui.sleep(400); // wait for setupNameTiles()
            ui.hideOverlay();
        },

        async handleIncorrectAnswer() {
            roundManager.resetDraggables();
            await ui.showOverlay('Try again!', config.overlayColors.red);
            await utils.ui.sleep(1200);
            ui.hideOverlay();
            state.setState(state.GameState.PLAYING);
        },
    },
};

// Bind all methods in gameLogic and its nested objects
Object.keys(gameLogic).forEach(key => {
    if (typeof gameLogic[key] === 'object') {
        Object.keys(gameLogic[key]).forEach(nestedKey => {
            if (typeof gameLogic[key][nestedKey] === 'function') {
                gameLogic[key][nestedKey] = gameLogic[key][nestedKey].bind(gameLogic[key]);
            }
        });
    }
});

const publicAPI = {
    checkAnswer: gameLogic.answerHandling.checkAnswer,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(gameLogic);
    }
});

export default publicAPI;

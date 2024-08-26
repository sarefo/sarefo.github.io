import eventInitializer from './eventInitializer.js';
import keyboardShortcuts from './keyboardShortcuts.js';
import eventUIButtons from './eventUIButtons.js';
import searchHandler from './searchHandler.js';
import swipeHandler from './swipeHandler.js';
import imagePanner from './imagePanner.js';

const eventMain = {
    initialize() {
        eventInitializer.initialize();
        keyboardShortcuts.initialize();
        eventUIButtons.initialize();
        searchHandler.initialize();
        swipeHandler.initialize();
        imagePanner.initialize();

    },

    enableKeyboardShortcuts: keyboardShortcuts.enable,
    disableKeyboardShortcuts: keyboardShortcuts.disable,

    enableSwipe: swipeHandler.enable,
    disableSwipe: swipeHandler.disable,

    setFocusLost: searchHandler.setFocusLost,
    resetScrollPosition: searchHandler.resetScrollPosition,
    resetSearch: searchHandler.resetSearch,
};

// Bind all methods in eventMain
/*Object.keys(eventMain).forEach(key => {
    if (typeof eventMain[key] === 'function') {
        eventMain[key] = eventMain[key].bind(eventMain);
    }
});*/

export default eventMain;

// Configuration

const config = {

    useMongoDB: true,
    serverUrl: (() => {
        // Check if we're running in a production environment
        if (window.location.hostname === 'duonat-210dcde9c851.herokuapp.com') {
            return 'https://duonat-210dcde9c851.herokuapp.com';
        }
        // For local development
        //return 'http://localhost:3000'; // Adjust this port if your local server uses a different one
            return 'https://duonat-210dcde9c851.herokuapp.com';
    })(),
    //serverUrl: 'https://duonat-210dcde9c851.herokuapp.com/',
    //serverUrl: 'http://localhost:3000'  // Update this with your Heroku URL when deployed

    debug: true, // set to false for less console output

    // overlay colors
    overlayColors: {
        green: "rgba(116, 172, 0, 1.0)", /* iNat green */
        red: "rgba(172, 0, 40, 1.0)",
        gray: "rgba(100, 100, 100, 0.8)"
    },
    loadingMessage: "", // used to be "Loading..."

    useObservationImages: false, // switch between gallery and observation images
};

// no publicAPI needed here, only retrieve values
export default config;

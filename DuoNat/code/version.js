const version = '1.4.33'; // Increment the version number

function updateVersion() {
    // Update CSS, JS, and manifest files
    const noCacheFiles = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"], script[src], link[rel="manifest"]');
    noCacheFiles.forEach(element => {
        const url = new URL(element.href || element.src, window.location.href);
        url.searchParams.set('v', version);
        if (element.href) {
            element.href = url.toString();
        } else {
            element.src = url.toString();
        }
    });

    // Update SVG icons
    const svgIcons = document.querySelectorAll('use[href^="./images/icons.svg"]');
    svgIcons.forEach(icon => {
        const iconHref = icon.getAttribute('href');
        const url = new URL(iconHref, window.location.href);
        url.searchParams.set('v', version);
        icon.setAttribute('href', url.toString());
    });
}

// Run updateVersion on DOMContentLoaded and after a short delay
document.addEventListener('DOMContentLoaded', () => {
    updateVersion();
    // Run again after a short delay to catch any dynamically added elements
    setTimeout(updateVersion, 100);
});

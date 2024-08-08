let isGlobeView = false; // Session-wide setting
let worldMaps = []; // Array to store all world map instances

export const continentMap = {
    'North America': 'NA',
    'South America': 'SA',
    'Europe': 'EU',
    'Africa': 'AF',
    'Asia': 'AS',
    'Oceania': 'OC'
};

export function getFullContinentName(abbreviation) {
    return Object.keys(continentMap).find(key => continentMap[key] === abbreviation);
}

export function getContinentAbbreviation(fullName) {
    return continentMap[fullName];
}

// Core function to draw the world map
function drawWorldMap(container, highlightedContinents, isClickable = false, onContinentClick = null) {
    const mapContainer = container.querySelector('.image-container__world-map') || container;
    if (!mapContainer) {
        console.error('World map container not found');
        return null;
    }

    const width = 100;
    const height = 60;

    return fetch('./images/world.svg')
        .then(response => response.text())
        .then(svgData => {
            const parser = new DOMParser();
            const svgDOM = parser.parseFromString(svgData, "image/svg+xml");

            const svg = svgDOM.documentElement;
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 1775.8327 853.5303');
            svg.style.maxWidth = '100%';
            svg.style.height = 'auto';

            // Color the continents
            const paths = svg.querySelectorAll('path');
            paths.forEach(path => {
                const continentName = path.getAttribute('inkscape:label');
                if (highlightedContinents.includes(continentName)) {
                    path.setAttribute('fill', '#ac0028');
                } else {
                    path.setAttribute('fill', '#888');
                }
                path.setAttribute('stroke', '#33a02c');
                path.setAttribute('stroke-width', '0.5');

                if (isClickable && onContinentClick) {
                    path.style.cursor = 'pointer';
                    path.addEventListener('click', () => onContinentClick(continentName));
                }
            });

            mapContainer.innerHTML = '';
            mapContainer.appendChild(svg);

            return svg;
        })
        .catch(error => {
            console.error('Error loading SVG:', error);
            return null;
        });
}

// Function to create a globe icon
function createGlobeIcon() {
    const button = document.createElement('button');
    button.className = 'icon-button image-container__button image-container__button--globe';
    //    button.style.position = 'absolute';
    //    button.style.bottom = '10px';
    //    button.style.left = '60px';

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-globe');
    svg.appendChild(use);
    button.appendChild(svg);

    return button;
}

// Function to toggle between map and globe view
function toggleAllWorldMaps() {
    isGlobeView = !isGlobeView;
    worldMaps.forEach(map => map.toggle());
}

// Function to create a world map with toggle functionality
export function createWorldMap(container, highlightedContinents) {
    const mapContainer = container.querySelector('.image-container__world-map');
    if (!mapContainer) {
        console.error('World map container not found');
        return;
    }

    let svg = null;
    let globeIcon = null;

    function toggle() {
        if (isGlobeView) {
            if (!globeIcon) {
                globeIcon = createGlobeIcon();
                container.appendChild(globeIcon);
                globeIcon.addEventListener('click', toggleAllWorldMaps);
            }
            mapContainer.style.display = 'none';
            globeIcon.style.display = 'flex';
        } else {
            if (globeIcon) {
                globeIcon.style.display = 'none';
            }
            mapContainer.style.display = 'block';
        }
    }

    drawWorldMap(container, highlightedContinents).then(createdSvg => {
        svg = createdSvg;
        if (svg) {
            svg.addEventListener('click', toggleAllWorldMaps);
        }
        toggle(); // Set initial state
    });

    // Add this world map instance to the array
    worldMaps.push({ toggle });
}

// Function to create a clickable world map (for range selection)
export function createClickableWorldMap(container, selectedContinents, onContinentClick) {
    drawWorldMap(container, Array.from(selectedContinents), true, onContinentClick);
}

// Function to create a non-clickable world map (for filter summary)
export function createNonClickableWorldMap(container, selectedContinents) {
    drawWorldMap(container, Array.from(selectedContinents), false);
}

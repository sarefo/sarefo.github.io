let isGlobeView = false; // Session-wide setting
let worldMaps = []; // Array to store all world map instances

export function createWorldMap(container, highlightedContinents) {
    const mapContainer = container.querySelector('.image-container__world-map');
    if (!mapContainer) {
        console.error('World map container not found');
        return;
    }

    const width = 100;
    const height = 60;

    function createGlobeIcon() {
        const button = document.createElement('button');
        button.className = 'icon-button image-container__button image-container__button--globe';
        button.style.position = 'absolute';
        button.style.bottom = '10px';
        button.style.left = '60px';
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('class', 'icon');
        svg.setAttribute('viewBox', '0 0 24 24');

        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', './images/icons.svg#icon-globe');
        svg.appendChild(use);
        button.appendChild(svg);

        return button;
    }

    fetch('./images/world.svg')
        .then(response => response.text())
        .then(svgData => {
            const parser = new DOMParser();
            const svgDOM = parser.parseFromString(svgData, "image/svg+xml");

            const svg = svgDOM.documentElement;
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.setAttribute('viewBox', '0 0 1775.8327 853.5303');
            svg.style.position = 'absolute';
            svg.style.bottom = '5px';
            svg.style.left = '5px';
            svg.style.background = '#fff';
            svg.style.transition = 'all 0.3s ease-in-out';
            svg.style.cursor = 'pointer';

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
            });

            function toggleAllWorldMaps() {
                isGlobeView = !isGlobeView;
                worldMaps.forEach(map => map.toggle());
            }

            function toggle() {
                if (isGlobeView) {
                    let globeIcon = container.querySelector('.image-container__button--globe');
                    if (!globeIcon) {
                        globeIcon = createGlobeIcon();
                        container.appendChild(globeIcon);
                        globeIcon.addEventListener('click', toggleAllWorldMaps);
                    }
                    mapContainer.style.display = 'none';
                    globeIcon.style.display = 'flex';
                } else {
                    const globeIcon = container.querySelector('.image-container__button--globe');
                    if (globeIcon) {
                        globeIcon.style.display = 'none';
                    }
                    mapContainer.style.display = 'block';
                }
            }

            // Add this world map instance to the array
            worldMaps.push({ toggle });

            // Initial state
            mapContainer.appendChild(svg);
            svg.addEventListener('click', toggleAllWorldMaps);

            // Create the globe icon once and hide it initially
            const globeIcon = createGlobeIcon();
            container.appendChild(globeIcon);
            globeIcon.style.display = 'none';
            globeIcon.addEventListener('click', toggleAllWorldMaps);

            toggle();
        })
        .catch(error => console.error('Error loading SVG:', error));
}

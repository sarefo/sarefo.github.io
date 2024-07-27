export function createWorldMap(container, highlightedContinent) {
    const mapContainer = container.querySelector('.world-map-container');
    if (!mapContainer) {
        console.error('World map container not found');
        return;
    }

    const width = 100;
    const height = 60;

    fetch('./images/world.svg')
        .then(response => response.text())
        .then(svgData => {
            const parser = new DOMParser();
            const svgDOM = parser.parseFromString(svgData, "image/svg+xml");

            // Set SVG attributes
            const svg = svgDOM.documentElement;
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            svg.setAttribute('viewBox', '0 0 1775.8327 853.5303');
            svg.style.position = 'absolute';
            svg.style.bottom = '5px';
            svg.style.right = '5px';
            svg.style.background = '#fff';

            // Color the continents
            const paths = svg.querySelectorAll('path');
            paths.forEach(path => {
                const continentName = path.getAttribute('inkscape:label');
                if (continentName === highlightedContinent) {
                    path.setAttribute('fill', '#ac0028');
                } else {
                    path.setAttribute('fill', '#888');
                }
                path.setAttribute('stroke', '#33a02c');
                path.setAttribute('stroke-width', '0.5');
            });

            // Clear the container and append the SVG
            mapContainer.innerHTML = '';
            mapContainer.appendChild(svg);
        })
        .catch(error => console.error('Error loading SVG:', error));
}

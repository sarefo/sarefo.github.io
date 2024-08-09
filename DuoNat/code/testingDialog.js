import api from './api.js';
import dialogManager from './dialogManager.js';
import { gameState } from './state.js';
import logger from './logger.js';

const testingDialog = {
    initialize() {
        this.createDialog();
        this.setupEventListeners();
    },

    createDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'testing-dialog';
        dialog.className = 'standard-dialog testing-dialog';

        dialog.innerHTML = `
            <button class="dialog-close-button icon" aria-label="Close">×</button>
            <h3 class="dialog-title">Graph Testing</h3>
            <select id="graph-type-select">
                <option value="radial">Interactive Radial Tree</option>
                <option value="hierarchical">Hierarchical Tree View</option>
            </select>
            <div id="graph-container" class="testing-dialog__graph-container"></div>
        `;

        document.body.appendChild(dialog);
    },

    setupEventListeners() {
        const closeButton = document.querySelector('#testing-dialog .dialog-close-button');
        closeButton.addEventListener('click', () => dialogManager.closeDialog('testing-dialog'));

        const graphTypeSelect = document.getElementById('graph-type-select');
        graphTypeSelect.addEventListener('change', () => this.updateGraph());
    },

    openDialog() {
        dialogManager.openDialog('testing-dialog');
        this.updateGraph();
    },

    async updateGraph() {
        const graphType = document.getElementById('graph-type-select').value;
        const graphContainer = document.getElementById('graph-container');
        graphContainer.innerHTML = ''; // Clear previous graph

        const hierarchyObj = api.getTaxonomyHierarchy();
//        console.log('Raw hierarchy data:', hierarchyObj);

        if (!hierarchyObj || !hierarchyObj.nodes) {
            graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
            return;
        }

        const rootNode = this.convertHierarchyToNestedObject(hierarchyObj);
//        console.log('Converted hierarchy:', JSON.stringify(rootNode, null, 2));

        switch (graphType) {
            case 'radial':
                this.createRadialTree(graphContainer, rootNode);
                break;
            case 'hierarchical':
                this.createHierarchicalTree(graphContainer, rootNode);
                break;
        }
    },

    convertHierarchyToNestedObject(hierarchyObj) {
        const nodes = hierarchyObj.nodes;
        const nodeMap = new Map();
        let root = null;

//        console.log('Total nodes:', nodes.size);

        // First pass: create all nodes
        for (const [id, node] of nodes) {
            const newNode = {
                id: id,
                taxonName: node.taxonName,
                vernacularName: node.vernacularName,
                rank: node.rank,
                children: []
            };
            nodeMap.set(id, newNode);
            if (node.parentId === null) {
                root = newNode;
//                console.log('Root node found:', newNode);
            }
        }

//        console.log('Nodes created:', nodeMap.size);

        // Second pass: build the tree structure
        for (const [id, node] of nodes) {
            if (node.parentId !== null) {
                const parent = nodeMap.get(node.parentId);
                if (parent) {
                    parent.children.push(nodeMap.get(id));
//                    console.log(`Added ${node.taxonName} to ${parent.taxonName}`);
                } else {
//                    console.warn(`Parent node not found for ${node.taxonName} (ID: ${id})`);
                }
            }
        }

        if (!root) {
//            console.warn('No root node found, using first node as root');
            root = nodeMap.values().next().value;
        }

//        console.log('Root node children:', root.children.length);
//        console.log('First level children:', root.children.map(child => child.taxonName));

        return root;
    },

    createHierarchicalTree(container, rootNode) {
        const width = 800;
        const height = 600;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(40,0)');

        const root = d3.hierarchy(rootNode);
        logger.debug('D3 hierarchy data:', root);
        logger.debug('Root node children:', root.children ? root.children.length : 0);
        logger.debug('First level children:', root.children ? root.children.map(child => child.data.taxonName) : 'None');

        if (!root) {
            logger.error('Failed to create hierarchy from root node');
            return;
        }

        // Initialize the tree layout
        const treeLayout = d3.tree().size([height, width - 200]);

        // Collapse all nodes initially except for the first two levels
        root.descendants().forEach(d => {
            if (d.depth > 1) {
                d._children = d.children;
                d.children = null;
            }
        });

        // Expand the root node and its immediate children
        expand(root);
        root.children.forEach(expand);

        // Initial update
        update(root);

        function update(source) {
            const duration = 750;

            const tree = treeLayout(root);
            const nodes = tree.descendants();
            const links = tree.links();

            nodes.forEach(d => d.y = d.depth * 180);

            const node = svg.selectAll('.testing-dialog__node')
                .data(nodes, d => d.data.id);

            const nodeEnter = node.enter().append('g')
                .attr('class', 'testing-dialog__node')
                .attr('transform', d => {
                    const x = isNaN(source.x0) ? 0 : source.x0;
                    const y = isNaN(source.y0) ? 0 : source.y0;
                    return `translate(${y},${x})`;
                })
                .on('click', (event, d) => {
                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else {
                        d.children = d._children;
                        d._children = null;
                    }
                    update(d);
                });

            nodeEnter.append('circle')
                .attr('r', 5)
                .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

            nodeEnter.append('text')
                .attr('dy', '.35em')
                .attr('x', d => d.children || d._children ? -13 : 13)
                .attr('text-anchor', d => d.children || d._children ? 'end' : 'start')
                .text(d => d.data.taxonName);

            const nodeUpdate = nodeEnter.merge(node);

            nodeUpdate.transition()
                .duration(duration)
                .attr('transform', d => {
                    if (isNaN(d.x) || isNaN(d.y)) {
                        logger.error('Invalid node position:', d);
                        return 'translate(0,0)';
                    }
                    return `translate(${d.y},${d.x})`;
                });

            nodeUpdate.select('circle')
                .attr('r', 5)
                .attr('fill', d => d._children ? "lightsteelblue" : "#fff");

            const nodeExit = node.exit().transition()
                .duration(duration)
                .attr('transform', d => {
                    const x = isNaN(source.x) ? 0 : source.x;
                    const y = isNaN(source.y) ? 0 : source.y;
                    return `translate(${y},${x})`;
                })
                .remove();

            nodeExit.select('circle')
                .attr('r', 1e-6);

            nodeExit.select('text')
                .style('fill-opacity', 1e-6);

            const link = svg.selectAll('.testing-dialog__link')
                .data(links, d => d.target.data.id);

            const linkEnter = link.enter().insert('path', 'g')
                .attr('class', 'testing-dialog__link')
                .attr('d', d => {
                    const o = {x: source.x0, y: source.y0};
                    return diagonal(o, o);
                });

            const linkUpdate = linkEnter.merge(link);

            linkUpdate.transition()
                .duration(duration)
                .attr('d', d => diagonal(d.source, d.target));

            link.exit().transition()
                .duration(duration)
                .attr('d', d => {
                    const o = {x: source.x, y: source.y};
                    return diagonal(o, o);
                })
                .remove();

            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        function diagonal(s, d) {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        }

        function expand(d) {
            if (d._children) {
                d.children = d._children;
                d.children.forEach(expand);
            }
        }
        // Initial update
        update(root);
    },

    createRadialTree(container, rootNode) {
        const width = 800;
        const height = 600;
        const radius = Math.min(width, height) / 2 - 120;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        svg.append('style').text(`
            .link {
                fill: none;
                stroke: #ccc;
                stroke-width: 1.5px;
            }
            .node text {
                font: 16px sans-serif;
            }
        `);

        const root = d3.hierarchy(rootNode);
        
        if (!root) {
            logger.error('Failed to create radial hierarchy from root node');
            return;
        }

        let centerNode = root;

        const treeLayout = d3.tree()
            .size([2 * Math.PI, radius])
            .separation((a, b) => {
                return (a.parent == b.parent ? 1 : 2) / a.depth;
            });

        function update(source) {
            const duration = 750;

            const treeData = treeLayout(centerNode);
            const nodes = treeData.descendants();
            const links = treeData.links();

            nodes.forEach(d => {
                d.y = (d.depth - centerNode.depth) * 100;
            });

            const node = svg.selectAll('g.node')
                .data(nodes, d => d.data.id);

            const nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${radialPoint(source.x0 || 0, source.y0 || 0)})`)
                .on('click', click);

            nodeEnter.append('circle')
                .attr('r', 1e-6)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff')
                .style('stroke', '#74ac00')
                .style('stroke-width', '1.5px');

            nodeEnter.append('text')
                .attr('dy', '.31em')
                .attr('x', d => d.x < Math.PI === !d.children ? 6 : -6)
                .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
                .attr('transform', d => `rotate(${(d.x < Math.PI ? d.x - Math.PI / 2 : d.x + Math.PI / 2) * 180 / Math.PI})`)
                .text(d => d.data.taxonName)
                .style('fill-opacity', 1e-6);

            const nodeUpdate = nodeEnter.merge(node);

            nodeUpdate.transition()
                .duration(duration)
                .attr('transform', d => `translate(${radialPoint(d.x, d.y)})`);

            nodeUpdate.select('circle')
                .attr('r', 5)
                .style('fill', d => d._children ? 'lightsteelblue' : '#fff');

            nodeUpdate.select('text')
                .style('fill-opacity', 1)
                .attr('transform', function(d) {
                    const angle = (d.x < Math.PI ? d.x - Math.PI / 2 : d.x + Math.PI / 2) * 180 / Math.PI;
                    const rotation = angle > 90 && angle < 270 ? 180 : 0;
                    const x = 15;  // Increased distance from node
                    return `rotate(${angle}) translate(${x},0) rotate(${rotation})`;
                })
                .attr('text-anchor', d => {
                    const angle = d.x * 180 / Math.PI;
                    return (angle < 180) ? 'start' : 'end';
                })
                .attr('dx', d => {
                    const angle = d.x * 180 / Math.PI;
                    return (angle < 180) ? '5' : '-5';
                });

            const nodeExit = node.exit().transition()
                .duration(duration)
                .attr('transform', d => `translate(${radialPoint(source.x, source.y)})`)
                .remove();

            nodeExit.select('circle')
                .attr('r', 1e-6);

            nodeExit.select('text')
                .style('fill-opacity', 1e-6);

            const link = svg.selectAll('path.link')
                .data(links, d => d.target.data.id);

            const linkEnter = link.enter().insert('path', 'g')
                .attr('class', 'link')
                .attr('d', d => {
                    const o = {x: source.x0 || 0, y: source.y0 || 0};
                    return diagonal({source: o, target: o});
                });

            link.merge(linkEnter).transition()
                .duration(duration)
                .attr('d', diagonal);

            link.exit().transition()
                .duration(duration)
                .attr('d', d => {
                    const o = {x: source.x, y: source.y};
                    return diagonal({source: o, target: o});
                })
                .remove();

            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        function click(event, d) {
            if (d.parent) {
                centerNode = d.parent;
            }

            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }

            root.descendants().forEach(node => {
                if (node !== centerNode && !isDescendantOf(node, centerNode) && !isAncestorOf(node, d)) {
                    node._children = node.children || node._children;
                    node.children = null;
                }
            });

            update(d);
        }

        function diagonal(d) {
            return d3.linkRadial()
                .angle(d => d.x)
                .radius(d => d.y)
                (d);
        }

        function radialPoint(x, y) {
            return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
        }

        function isDescendantOf(node, target) {
            while (node.parent) {
                if (node.parent === target) return true;
                node = node.parent;
            }
            return false;
        }

        function isAncestorOf(node, target) {
            while (target.parent) {
                if (target.parent === node) return true;
                target = target.parent;
            }
            return false;
        }

        root.descendants().forEach(d => {
            if (d.depth > 0) {
                d._children = d.children;
                d.children = null;
            }
        });

        update(root);
    },

};

export default testingDialog;

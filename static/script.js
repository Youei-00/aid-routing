let map = L.map('map').setView([37, -95], 4);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

// ------------------
// ICONS
// ------------------
const warehouseIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995470.png",
    iconSize: [35, 35]
});

const hubIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
    iconSize: [30, 30]
});

const campIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
    iconSize: [28, 28]
});

let nodes = {};
let selected = [];
let routeLine;
let decorator;
let riskZones = [];

// ------------------
// USA BOUNDS (same as backend)
// ------------------
const MIN_LAT = 26, MAX_LAT = 48;
const MIN_LNG = -124, MAX_LNG = -67;

// ------------------
// RISK ZONES (X)
// ------------------
function generateRiskZones(n=10) {
    let nodeList = Object.values(nodes);

    for (let i = 0; i < n; i++) {
        let randomNode = nodeList[Math.floor(Math.random() * nodeList.length)];

        let lat = randomNode[0] + (Math.random() - 0.5) * 2;
        let lng = randomNode[1] + (Math.random() - 0.5) * 2;

        let marker = L.marker([lat, lng], {
            icon: L.divIcon({
                html:`<div style="color:red;font-size:28px;font-weight:bold;">✖</div>`
            }),
            zIndexOffset: 2000
        }).addTo(map);

        riskZones.push({
            center:[lat,lng],
            radius:800000
        });
    }
}

// ------------------
// LOAD GRAPH
// ------------------
async function loadGraph() {
    const res = await fetch("/data");
    const data = await res.json();

    let bounds = [];

    for (let node in data.coords) {
        let icon = node.includes("Warehouse") ? warehouseIcon : campIcon;

        let latlng = data.coords[node];
        bounds.push(latlng);

        L.marker(latlng, { icon })
            .addTo(map)
            .on("click", () => selectNode(node));

        nodes[node] = latlng;
    }

    // ✅ THIS FIXES EVERYTHING GOING OUT OF MAP
    map.fitBounds(bounds, { padding: [50, 50] });

    drawEdges(data.graph, data.coords);
}
// ------------------
// DRAW EDGES
// ------------------
function drawEdges(graph, coords) {
    let drawn = new Set();

    for (let n in graph) {
        for (let [neighbor] of graph[n]) {

            let key = [n, neighbor].sort().join("-");
            if (drawn.has(key)) continue;

            drawn.add(key);

            L.polyline(
                [coords[n], coords[neighbor]],
                { color: "gray", weight: 1, opacity: 0.3 }
            ).addTo(map);
        }
    }
}

// ------------------
// SELECT + ROUTE
// ------------------
function selectNode(node) {
    selected.push(node);

    if (selected.length === 2) {
        findRoute(selected[0], selected[1]);
        selected = [];
    }
}

// ------------------
// FIND ROUTE
// ------------------
async function findRoute(start, end) {

    const res = await fetch("/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            start: start,
            end: end,
            riskZones: riskZones
        })
    });

    const data = await res.json();

    if (routeLine) map.removeLayer(routeLine);
    if (decorator) map.removeLayer(decorator);

    let latlngs = data.path.map(n => nodes[n]);

    routeLine = L.polyline(latlngs, {
        color: "#0A3D62",
        weight: 6
    }).addTo(map);

    decorator = L.polylineDecorator(routeLine, {
        patterns: [{
            offset: '10%',
            repeat: '20%',
            symbol: L.Symbol.arrowHead({ pixelSize: 10 })
        }]
    }).addTo(map);
}

// ------------------
loadGraph().then(() => {
    generateRiskZones();
});
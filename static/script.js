let map = L.map('map').setView([20, 0], 2);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
).addTo(map);

// ICONS
const warehouseIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/128/1350/1350237.png",
    iconSize: [35, 35]
});

const campIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/128/1054/1054092.png",
    iconSize: [28, 28]
});

const storeIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/128/7845/7845682.png",
    iconSize: [28, 28]
});

const hospitalIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/128/4320/4320350.png",
    iconSize: [30, 30]
});

// TRUCK ICON
const truckImg = "https://cdn-icons-png.flaticon.com/128/2107/2107330.png";

let heatLayer = null;
let nodes = {};
let selected = [];
let routeLine;
let decorator;
let riskZones = [];
let truckMarker = null;
let riskMarkers = [];
let chart = null;

// ------------------
// TAB SWITCHING
// ------------------
function showTab(tab) {
    document.getElementById("mapTab").style.display = "none";
    document.getElementById("statsTab").style.display = "none";

    if (tab === "statsTab") {
        document.getElementById("statsTab").style.display = "flex"; // 🔥 keep flex
    } else {
        document.getElementById("mapTab").style.display = "block";
        setTimeout(() => map.invalidateSize(), 200);
    }
}

// ------------------
// DISTANCE
// ------------------
function getDistance(a, b) {
    let R = 6371;
    let dLat = (b[0] - a[0]) * Math.PI/180;
    let dLon = (b[1] - a[1]) * Math.PI/180;

    let lat1 = a[0] * Math.PI/180;
    let lat2 = b[0] * Math.PI/180;

    let x = Math.sin(dLat/2)**2 +
            Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;

    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// ------------------
// STATS + CHART
// ------------------
function updateStats(path) {

    let hospitalCount = 0;
let storeCount = 0;

for (let node of path) {
    if (node.includes("Hospital")) hospitalCount++;
    if (node.includes("Store")) storeCount++;
}

let coverage = 0;

if (path.length > 0) {
    let criticalStops = hospitalCount + storeCount;
    coverage = Math.min(100, (criticalStops / path.length) * 100);
}
    if (!path || path.length === 0) return;

    let totalDistance = 0;
    let riskHits = 0;

    for (let i = 0; i < path.length - 1; i++) {

        let a = nodes[path[i]];
        let b = nodes[path[i+1]];

        let dist = getDistance(a, b);
        totalDistance += dist;

        let mid = [(a[0]+b[0])/2, (a[1]+b[1])/2];

        for (let zone of riskZones) {
            let d = getDistance(mid, zone.center);
            if (d < zone.radius / 1000) {
                riskHits++;
            }
        }
    }

    let avgSpeed = 60;
    let travelTime = totalDistance / avgSpeed;
    let stops = path.length;
    let efficiency = totalDistance / stops;
    let riskPercent = Math.min(100,
    (riskHits / (path.length - 1)) * 100

);
    // SAFE UI UPDATES
    setText("statDistance", totalDistance.toFixed(0));
    setText("statStops", stops);
    setText("statRisk", riskHits);
    setText("statTime", travelTime.toFixed(1));
    setText("statEfficiency", efficiency.toFixed(1));
    setText("statRiskPercent", riskPercent.toFixed(0) + "%");
    setText("statHospitals", hospitalCount);
    setText("statStores", storeCount);
    setText("statCoverage", coverage.toFixed(0) + "%");

    createChart(path, totalDistance);
}

// helper (prevents crashes if element missing)
function setText(id, value) {
    let el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ------------------
// CHART
// ------------------
function createChart(path) {

    let labels = [];
    let data = [];

    let total = 0;

    for (let i = 0; i < path.length; i++) {
        labels.push("Stop " + (i+1));

        if (i > 0) {
            total += getDistance(nodes[path[i-1]], nodes[path[i]]);
        }

        data.push(total);
    }

    if (chart) chart.destroy();

    chart = new Chart(document.getElementById("routeChart"), {
        type: path.length <= 2 ? "bar" : "line",  // 🔥 KEY FIX

        data: {
            labels: labels,
            datasets: [{
                label: "Distance Traveled (km)",
                data: data,
                borderColor: "#4FC3F7",
                backgroundColor: "rgba(79,195,247,0.3)",
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4
            }]
        },

      options: {
    responsive: true,
    maintainAspectRatio: false, // ✅ THIS FIXES THE WEIRD SCALING

    scales: {
        y: {
            beginAtZero: true,
            grace: '15%',
            ticks: {
                color: "#aaa",
                callback: v => v + " km"
            },
            grid: {
                color: "rgba(255,255,255,0.1)"
            }
        },
        x: {
            ticks: {
                color: "#aaa"
            },
            grid: {
                color: "rgba(255,255,255,0.05)"
            }
        }
    },

    plugins: {
        legend: {
            labels: {
                color: "white"
            }
        }
    }
}
    });
}
// ------------------
// RISK ZONES
// ------------------
function generateRiskZonesFromGraph(graph, coords, count = 50) {

    // 🔥 REMOVE old markers if any
    riskMarkers.forEach(m => map.removeLayer(m));
    riskMarkers = [];

    // 🔥 REMOVE old heatmap
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    riskZones = [];
    let heatPoints = [];

    for (let i = 0; i < count; i++) {

        let nodesList = Object.keys(graph);
        let node = nodesList[Math.floor(Math.random() * nodesList.length)];

        if (!graph[node] || graph[node].length === 0) continue;

        let [neighbor] = graph[node][Math.floor(Math.random() * graph[node].length)];

        let a = coords[node];
        let b = coords[neighbor];

        // random point along edge
        let t = Math.random();
        let lat = a[0] + t * (b[0] - a[0]);
        let lng = a[1] + t * (b[1] - a[1]);

        // add to heatmap (3rd value = intensity)
        heatPoints.push([lat, lng, Math.random() * 0.8 + 0.2]);

        // keep for backend risk calculations
        riskZones.push({
            center: [lat, lng],
            radius: 800000
        });
    }

    // CREATE HEATMAP
    heatLayer = L.heatLayer(heatPoints, {
        radius: 25,      // size of heat blobs
        blur: 20,        // smoothness
        maxZoom: 5,
        gradient: {
            0.2: 'blue',
            0.4: 'lime',
            0.6: 'yellow',
            0.8: 'orange',
            1.0: 'red'
        }
    }).addTo(map);
}
// ------------------
// LOAD GRAPH
// ------------------
async function loadGraph() {
    const res = await fetch("/data");
    const data = await res.json();

    window.graphData = data.graph;

    let bounds = [];

    for (let node in data.coords) {
        let coord = data.coords[node];
        bounds.push(coord);

        let icon;

if (node.includes("Warehouse")) {
    icon = warehouseIcon;
}
else if (node.includes("Hospital")) {
    icon = hospitalIcon;
}
else if (node.includes("Store")) {
    icon = storeIcon;
}
else {
    icon = campIcon;
}

        L.marker(coord, {icon})
        .addTo(map)
        .on("click", ()=>selectNode(node));

        nodes[node] = coord;
    }

    map.fitBounds(bounds, {padding:[50,50]});

    drawEdges(data.graph, data.coords);
    generateRiskZonesFromGraph(data.graph, data.coords);

    setText("nodeCount", Object.keys(data.coords).length);
}

// ------------------
// DRAW EDGES
// ------------------
function drawEdges(graph, coords) {
    let drawn = new Set();

    for (let n in graph) {
        for (let [neighbor] of graph[n]) {

            let key = [n,neighbor].sort().join("-");
            if (drawn.has(key)) continue;

            drawn.add(key);

            L.polyline(
                [coords[n], coords[neighbor]],
                {color:"gray",weight:1,opacity:0.3}
            ).addTo(map);
        }
    }
}

// ------------------
// SELECT ROUTE
// ------------------
function selectNode(node) {
    selected.push(node);

    if (selected.length === 2) {
        findRoute(selected[0], selected[1]);
        selected = [];
    }
}

// ------------------
// TRUCK ANIMATION
// ------------------
function animateTruck(pathCoords) {

    if (truckMarker) map.removeLayer(truckMarker);
    if (!pathCoords || pathCoords.length < 2) return;

    let i = 0;

  truckMarker = L.marker(pathCoords[0], {
    icon: L.divIcon({
        html: `<img src="${truckImg}" style="width:30px;">`,
        className: "truck-icon" // 👈 use custom class
    }),
    zIndexOffset: 3000
}).addTo(map);

    function moveSegment() {
        if (i >= pathCoords.length - 1) return;

        let start = pathCoords[i];
        let end = pathCoords[i + 1];

        let step = 0;
        let steps = 60;

        let interval = setInterval(() => {

            let lat = start[0] + (end[0] - start[0]) * (step / steps);
            let lng = start[1] + (end[1] - start[1]) * (step / steps);

           let dx = end[1] - start[1]; // longitude (east-west)
let dy = end[0] - start[0]; // latitude (north-south)

// geographic angle
let angle = Math.atan2(dx, dy) * (180 / Math.PI);

// adjust for icon orientation
angle = angle - 90;

            truckMarker.setIcon(L.divIcon({
    html: `<img src="${truckImg}" 
           style="
             width:30px;
             transform: rotate(${angle}deg);
             transform-origin: center;
           ">`,
    className: "truck-icon"
}));

            truckMarker.setLatLng([lat,lng]);

            step++;

            if(step>steps){
                clearInterval(interval);
                i++;
                moveSegment();
            }

        },30);
    }

    moveSegment();
}

// ------------------
// ROUTE
// ------------------
async function findRoute(start,end) {
    const res = await fetch("/route", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            start:start,
            end:end,
            riskZones:riskZones
        })
    });

    const data = await res.json();

    if (routeLine) map.removeLayer(routeLine);
    if (decorator) map.removeLayer(decorator);

    //supports both backend formats
    let path = data.safe_path || data.path;

    let latlngs = path.map(n => nodes[n]);

    routeLine = L.polyline(latlngs, {
        color:"#0A3D62",
        weight:5
    }).addTo(map);

    decorator = L.polylineDecorator(routeLine, {
        patterns:[{
            offset:'10%',
            repeat:'20%',
            symbol:L.Symbol.arrowHead({pixelSize:10})
        }]
    }).addTo(map);

    animateTruck(latlngs);

    updateStats(path);
}

// ------------------
function clearRoute() {
    if (routeLine) map.removeLayer(routeLine);
    if (decorator) map.removeLayer(decorator);
    if (truckMarker) map.removeLayer(truckMarker);
}

function regenerateRisk() {
    generateRiskZonesFromGraph(window.graphData, nodes);
}

// ------------------
loadGraph();
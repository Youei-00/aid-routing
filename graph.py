import heapq
import math
import random

def generate_coordinates():
    coords = {}

    regions = [
        (37, -95),    # USA
        (50, 10),     # Europe
        (20, 78),     # India
        (35, 105),    # China
        (-23, -58),   # South America
        (-25, 135),   # Australia
        (0, 20)       # Africa
    ]

    def jitter(lat, lng, spread):
        return (
            lat + random.uniform(-spread, spread),
            lng + random.uniform(-spread, spread)
        )

    # Warehouses
    for i, r in enumerate(regions):
        coords[f"Warehouse{i}"] = jitter(*r, 8)

    # Hubs
    for i in range(25):
        r = random.choice(regions)
        coords[f"Hub{i}"] = jitter(*r, 12)

    # Camps
    for i in range(40):
        r = random.choice(regions)
        coords[f"Camp{i}"] = jitter(*r, 15)

    # 🏪 Stores
    for i in range(30):
        r = random.choice(regions)
        coords[f"Store{i}"] = jitter(*r, 10)

    # 🏥 Hospitals
    for i in range(20):
        r = random.choice(regions)
        coords[f"Hospital{i}"] = jitter(*r, 6)

    return coords


# ------------------------
# DISTANCE
# ------------------------
def haversine(a, b):
    R = 6371

    lat1, lon1 = a
    lat2, lon2 = b

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    x = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.atan2(math.sqrt(x), math.sqrt(1-x))

# ------------------------
# BUILD GRAPH (CONNECTED + GLOBAL)
# ------------------------
def build_graph(coords, k=6):
    graph = {node: [] for node in coords}

    # 🔒 prevent duplicate edges
    added_edges = set()

    # ------------------------
    # LOCAL CONNECTIONS (nearest neighbors)
    # ------------------------
    for node1 in coords:
        distances = []

        for node2 in coords:
            if node1 == node2:
                continue

            dist = haversine(coords[node1], coords[node2])
            distances.append((dist, node2))

        distances.sort()

        for dist, neighbor in distances[:k]:

            # avoid duplicate edges
            edge_key = tuple(sorted([node1, neighbor]))
            if edge_key in added_edges:
                continue
            added_edges.add(edge_key)

            # small randomness for realism
            dist *= random.uniform(0.8, 1.3)

            graph[node1].append((neighbor, dist))
            graph[neighbor].append((node1, dist))

    # ------------------------
    # GLOBAL CONNECTIONS (long distance)
    # ------------------------
    nodes = list(coords.keys())

    for _ in range(len(nodes) // 3):
        a = random.choice(nodes)
        b = random.choice(nodes)

        if a == b:
            continue

        edge_key = tuple(sorted([a, b]))
        if edge_key in added_edges:
            continue
        added_edges.add(edge_key)

        dist = haversine(coords[a], coords[b])

        graph[a].append((b, dist))
        graph[b].append((a, dist))

    return graph

# ------------------------
# 🔥 IMPROVED RISK CHECK (MULTI-POINT)
# ------------------------
def is_blocked(coord1, coord2, zones):
    for zone in zones:
        zx, zy = zone["center"]
        radius = zone["radius"] / 1000  # meters → km

        # Check multiple points along the edge
        for t in [0.2, 0.4, 0.6, 0.8]:
            lat = coord1[0] + t * (coord2[0] - coord1[0])
            lng = coord1[1] + t * (coord2[1] - coord1[1])

            if haversine((lat, lng), (zx, zy)) < radius:
                return True

    return False


# ------------------------
# 🔥 DIJKSTRA (STRONG AVOIDANCE)
# ------------------------
def dijkstra(start, end, coords, zones, graph):
    pq = [(0, start, [])]
    visited = set()

    while pq:
        cost, node, path = heapq.heappop(pq)

        if node in visited:
            continue

        path = path + [node]
        visited.add(node)

        if node == end:
            return cost, path

        for neighbor, dist in graph[node]:

            if neighbor in visited:
                continue

            # 🔥 VERY strong penalty (forces rerouting)
            if is_blocked(coords[node], coords[neighbor], zones):
                penalty = dist * 2 + 500  # base + scaled penalty
            else:
                penalty = 0

            total = cost + dist + penalty

            heapq.heappush(pq, (total, neighbor, path))

    return float("inf"), []
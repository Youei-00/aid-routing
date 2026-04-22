import heapq
import math
import random

# ------------------------
# RANDOM COORDINATES (USA)
# ------------------------
def generate_coordinates():
    coords = {}

    # USA bounding box (safe margins so nothing goes off screen)
    MIN_LAT, MAX_LAT = 26, 48
    MIN_LNG, MAX_LNG = -124, -67

    # Warehouses (few, spread out)
    for i in range(5):
        coords[f"Warehouse{i}"] = (
            random.uniform(MIN_LAT, MAX_LAT),
            random.uniform(MIN_LNG, MAX_LNG)
        )

    # Hubs (medium amount)
    for i in range(15):
        coords[f"Hub{i}"] = (
            random.uniform(MIN_LAT, MAX_LAT),
            random.uniform(MIN_LNG, MAX_LNG)
        )

    # Camps / Stores (many)
    for i in range(25):
        coords[f"Camp{i}"] = (
            random.uniform(MIN_LAT, MAX_LAT),
            random.uniform(MIN_LNG, MAX_LNG)
        )

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

    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))


# ------------------------
# BUILD GRAPH
# ------------------------
def build_graph(coords, k=5):
    graph = {node: [] for node in coords}

    # Step 1: K-nearest neighbors (bidirectional)
    for node1 in coords:
        distances = []

        for node2 in coords:
            if node1 == node2:
                continue

            dist = haversine(coords[node1], coords[node2])
            distances.append((dist, node2))

        distances.sort()

        for dist, neighbor in distances[:k]:
            graph[node1].append((neighbor, dist))
            graph[neighbor].append((node1, dist))  # ✅ FIX

    # Step 2: Ensure full connectivity
    visited = set()

    def dfs(start):
        stack = [start]
        comp = set()
        while stack:
            n = stack.pop()
            if n in comp:
                continue
            comp.add(n)
            for neigh, _ in graph[n]:
                stack.append(neigh)
        return comp

    components = []
    for node in coords:
        if node not in visited:
            comp = dfs(node)
            visited |= comp
            components.append(comp)

    # Connect components
    for i in range(len(components) - 1):
        a = list(components[i])[0]
        b = list(components[i + 1])[0]

        dist = haversine(coords[a], coords[b])
        graph[a].append((b, dist))
        graph[b].append((a, dist))

    return graph
# ------------------------
# RISK CHECK
# ------------------------
def is_blocked(coord1, coord2, zones):
    for zone in zones:
        zx, zy = zone["center"]
        radius = zone["radius"] / 1000

        # check midpoint
        mx = (coord1[0] + coord2[0]) / 2
        my = (coord1[1] + coord2[1]) / 2

        if haversine((mx, my), (zx, zy)) < radius:
            return True

    return False


# ------------------------
# DIJKSTRA
# ------------------------
def dijkstra(start, end, coords, zones):
    pq = [(0, start, [])]
    visited = set()

    dynamic_graph = build_graph(coords)

    while pq:
        cost, node, path = heapq.heappop(pq)

        if node in visited:
            continue

        path = path + [node]
        visited.add(node)

        if node == end:
            return cost, path

        for neighbor, dist in dynamic_graph[node]:

            if neighbor in visited:
                continue

            base_cost = dist  # ✅ use existing distance

            # safer penalty (still avoids risk)
            if is_blocked(coords[node], coords[neighbor], zones):
                penalty = base_cost * 10
            else:
                penalty = 0

            total = cost + base_cost + penalty

            heapq.heappush(pq, (total, neighbor, path))

    return float("inf"), []
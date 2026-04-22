from flask import Flask, render_template, jsonify, request
from graph import generate_coordinates, build_graph, dijkstra

app = Flask(__name__)

# store one graph session
coords = generate_coordinates()
graph = build_graph(coords)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/data")
def data():
    return jsonify({
        "coords": coords,
        "graph": graph
    })

@app.route("/route", methods=["POST"])
def route():
    data = request.json

    if not data:
        return jsonify({"error": "No data"}), 400

    start = data.get("start")
    end = data.get("end")
    zones = data.get("riskZones", [])

    if not start or not end:
        return jsonify({"error": "Missing start/end"}), 400

    cost, path = dijkstra(start, end, coords, zones)

    return jsonify({
        "path": path,
        "cost": cost
    })

if __name__ == "__main__":
    app.run(debug=True)
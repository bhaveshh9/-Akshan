"""
MARINE SENTINEL
AI-Powered Oil Spill Detection & Vessel Attribution System

Hackathon prototype backend. Serves realistic dummy data from
data/cases.json through a small set of REST endpoints. No real
satellite feed, AIS feed, or ML model is connected -- this is a
functional prototype intended to demonstrate the product concept.
"""

import json
import os
from flask import Flask, jsonify, render_template, abort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "cases.json")

app = Flask(__name__)


def load_data():
    """Load the dummy case dataset from disk."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def find_case(case_id):
    data = load_data()
    for case in data["cases"]:
        if case["case_id"].lower() == case_id.lower():
            return case
    return None


def case_summary(case):
    """Small payload used for the case switcher / case list."""
    return {
        "case_id": case["case_id"],
        "region": case["region"],
        "priority": case["priority"],
        "status": case["status"],
        "detection_time": case["detection_time"],
        "last_analysis": case["last_analysis"],
        "coordinates": case["coordinates"],
    }


def ranked_suspects(case):
    """Build the suspect ranking from the vessel list."""
    vessels = sorted(case["vessels"], key=lambda v: v["suspicion_score"], reverse=True)
    suspects = []
    for i, v in enumerate(vessels, start=1):
        score = v["suspicion_score"]
        if score >= 70:
            level = "HIGH SUSPICION"
        elif score >= 40:
            level = "MEDIUM SUSPICION"
        else:
            level = "LOW SUSPICION"
        suspects.append({
            "rank": i,
            "vessel_id": v["id"],
            "name": v["name"],
            "mmsi": v["mmsi"],
            "type": v["type"],
            "distance_from_origin_km": v["distance_from_origin_km"],
            "time_correlation": v["time_correlation"],
            "trajectory_match": v["trajectory_match"],
            "ais_anomaly": v["ais_anomaly"],
            "suspicion_score": score,
            "suspicion_level": level,
        })
    return suspects


# ---------------------------------------------------------------------------
# PAGE ROUTE
# ---------------------------------------------------------------------------

@app.route("/")
def dashboard():
    data = load_data()
    cases = [case_summary(c) for c in data["cases"]]
    return render_template("index.html", cases=cases, default_case=cases[0]["case_id"])


# ---------------------------------------------------------------------------
# API ROUTES
# ---------------------------------------------------------------------------

@app.route("/api/cases")
def api_cases():
    data = load_data()
    return jsonify({"cases": [case_summary(c) for c in data["cases"]]})


@app.route("/api/case/<case_id>")
def api_case(case_id):
    case = find_case(case_id)
    if case is None:
        abort(404, description=f"Case {case_id} not found")
    payload = {
        "case_id": case["case_id"],
        "region": case["region"],
        "priority": case["priority"],
        "status": case["status"],
        "detection_time": case["detection_time"],
        "last_analysis": case["last_analysis"],
        "coordinates": case["coordinates"],
        "satellite": case["satellite"],
        "case_details": case["case_details"],
        "spill_geometry": case["spill_geometry"],
        "drift": case["drift"],
        "charts": case["charts"],
        "statistics": case["statistics"],
    }
    return jsonify(payload)


@app.route("/api/case/<case_id>/vessels")
def api_case_vessels(case_id):
    case = find_case(case_id)
    if case is None:
        abort(404, description=f"Case {case_id} not found")
    return jsonify({"case_id": case["case_id"], "vessels": case["vessels"]})


@app.route("/api/case/<case_id>/suspects")
def api_case_suspects(case_id):
    case = find_case(case_id)
    if case is None:
        abort(404, description=f"Case {case_id} not found")
    suspects = ranked_suspects(case)
    top = suspects[0] if suspects else None
    factors = None
    if top:
        factors = [
            {"label": "SPATIAL PROXIMITY", "met": top["distance_from_origin_km"] <= 3},
            {"label": "TEMPORAL CORRELATION", "met": top["time_correlation"] >= 70},
            {"label": "TRAJECTORY MATCH", "met": top["trajectory_match"] >= 70},
            {"label": "AIS BEHAVIOURAL ANOMALY", "met": top["ais_anomaly"] != "NONE DETECTED"},
            {"label": "VESSEL TYPE RELEVANCE", "met": "TANKER" in top["type"]},
        ]
    return jsonify({
        "case_id": case["case_id"],
        "suspects": suspects,
        "top_suspect": top,
        "attribution_factors": factors,
        "disclaimer": (
            "THIS SCORE REPRESENTS AN AI-ASSISTED INVESTIGATIVE RISK "
            "ASSESSMENT AND DOES NOT CONSTITUTE FINAL LEGAL ATTRIBUTION."
        ),
    })


@app.route("/api/case/<case_id>/statistics")
def api_case_statistics(case_id):
    case = find_case(case_id)
    if case is None:
        abort(404, description=f"Case {case_id} not found")
    return jsonify({"case_id": case["case_id"], "statistics": case["statistics"]})


@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": str(e)}), 404


if __name__ == "__main__":
    app.run(debug=True, port=5000)

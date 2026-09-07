/* =========================================================
   MARINE SENTINEL — FRONTEND APPLICATION LOGIC
   Vanilla JS. Talks to the Flask API via fetch().
   ========================================================= */

const state = {
  cases: [],
  activeIndex: 0,
  activeCase: null,   // full /api/case/<id> payload
  vessels: [],
  suspects: null,
  map: null,
  layers: {
    spillPolygon: null,
    originZone: null,
    backwardPath: null,
    forwardPath: null,
    vesselMarkers: [],
    vesselLines: [],
    centroidMarker: null,
    originMarker: null,
  },
  charts: {},
};

const STAT_ICONS = {
  area: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-6 9 6-9 6-9-6z"/><path d="M3 9v6l9 6 9-6V9"/></svg>',
  confidence: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3 7h7l-5.5 4.3L18.5 21 12 16.5 5.5 21l2-7.7L2 9h7z"/></svg>',
  age: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  risk: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 21h20L12 2z"/><path d="M12 9v5M12 17h.01"/></svg>',
  vessels: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l2-8h14l2 8"/><path d="M5 17v3h14v-3"/><path d="M12 2v7"/></svg>',
  suspect: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
};

/* ---------------------------------------------------------
   INITIALISATION
   --------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('case-prev').addEventListener('click', () => shiftCase(-1));
  document.getElementById('case-next').addEventListener('click', () => shiftCase(1));

  await loadCases();

  if (state.cases.length > 0) {
    await loadCase(state.cases[0].case_id);
  }
}

/* ---------------------------------------------------------
   DATA LOADING FUNCTIONS
   --------------------------------------------------------- */

async function loadCases() {
  try {
    const res = await fetch('/api/cases');
    if (!res.ok) throw new Error('Failed to load case list');
    const data = await res.json();
    state.cases = data.cases;
    renderCaseSwitcher();
  } catch (err) {
    console.error(err);
    const el = document.getElementById('case-cards');
    el.innerHTML = '<div class="case-card">UNABLE TO LOAD CASES</div>';
  }
}

async function loadCase(caseId) {
  setLoadingState(true);
  try {
    const [caseRes, vesselRes, suspectRes] = await Promise.all([
      fetch(`/api/case/${caseId}`),
      fetch(`/api/case/${caseId}/vessels`),
      fetch(`/api/case/${caseId}/suspects`),
    ]);

    if (!caseRes.ok || !vesselRes.ok || !suspectRes.ok) {
      throw new Error(`Failed to load case ${caseId}`);
    }

    state.activeCase = await caseRes.json();
    state.vessels = (await vesselRes.json()).vessels;
    state.suspects = await suspectRes.json();

    state.activeIndex = state.cases.findIndex(c => c.case_id === caseId);

    updateDashboard();
  } catch (err) {
    console.error(err);
  } finally {
    setLoadingState(false);
  }
}

async function loadStatistics(caseId) {
  const res = await fetch(`/api/case/${caseId}/statistics`);
  if (!res.ok) throw new Error('Failed to load statistics');
  return (await res.json()).statistics;
}

async function loadVessels(caseId) {
  const res = await fetch(`/api/case/${caseId}/vessels`);
  if (!res.ok) throw new Error('Failed to load vessels');
  return (await res.json()).vessels;
}

async function loadSuspects(caseId) {
  const res = await fetch(`/api/case/${caseId}/suspects`);
  if (!res.ok) throw new Error('Failed to load suspects');
  return await res.json();
}

/* ---------------------------------------------------------
   LOADING STATE
   --------------------------------------------------------- */

function setLoadingState(isLoading) {
  document.body.style.cursor = isLoading ? 'progress' : 'default';
}

/* ---------------------------------------------------------
   CASE SWITCHER
   --------------------------------------------------------- */

function renderCaseSwitcher() {
  const wrap = document.getElementById('case-cards');
  wrap.innerHTML = state.cases.map((c, i) => `
    <div class="case-card ${i === state.activeIndex ? 'active' : ''}" data-case-id="${c.case_id}">
      <div class="case-card-id">${c.case_id}</div>
      <div class="case-card-region">${c.region}</div>
      <span class="case-card-priority ${c.priority === 'HIGH' ? 'priority-high' : 'priority-medium'}">${c.priority} PRIORITY</span>
    </div>
  `).join('');

  wrap.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('click', () => loadCase(card.dataset.caseId));
  });
}

function shiftCase(direction) {
  if (state.cases.length === 0) return;
  let next = state.activeIndex + direction;
  if (next < 0) next = state.cases.length - 1;
  if (next >= state.cases.length) next = 0;
  loadCase(state.cases[next].case_id);
}

/* ---------------------------------------------------------
   MASTER DASHBOARD UPDATE
   --------------------------------------------------------- */

function updateDashboard() {
  renderCaseSwitcher();
  updateHeader();
  updateStatistics();
  updateSatelliteImages();
  updateCaseDetails();
  updateGeometry();
  updateVesselTable();
  updateSuspectProbability();
  updateDriftTimeline();
  updateMap();
  updateCharts();
}

function updateHeader() {
  document.getElementById('last-analysis-value').textContent = state.activeCase.last_analysis;
}

/* ---------------------------------------------------------
   STATISTICS CARDS
   --------------------------------------------------------- */

function updateStatistics() {
  const s = state.activeCase.statistics;
  const grid = document.getElementById('stats-grid');
  const riskClass = s.risk_level === 'HIGH' ? 'risk-high' : (s.risk_level === 'MEDIUM' ? 'risk-medium' : 'risk-low');
  const riskIconClass = s.risk_level === 'HIGH' ? 'risk' : (s.risk_level === 'MEDIUM' ? 'warn' : '');

  grid.innerHTML = `
    ${statCard('area', 'Spill Area', `${s.spill_area_km2.toFixed(2)} KM²`)}
    ${statCard('confidence', 'Detection Confidence', `${s.detection_confidence.toFixed(1)}%`)}
    ${statCard('age', 'Estimated Spill Age', `${s.spill_age_hours} HOURS`)}
    ${statCard('risk', 'Risk Level', s.risk_level, riskClass, riskIconClass)}
    ${statCard('vessels', 'Nearby Vessels', String(s.nearby_vessels).padStart(2, '0'))}
    ${statCard('suspect', 'Top Suspect Score', `${s.top_suspect_score}%`)}
  `;
  grid.classList.remove('count-up');
  void grid.offsetWidth;
  grid.classList.add('count-up');
}

function statCard(iconKey, label, value, valueClass = '', iconClass = '') {
  return `
    <div class="stat-card">
      <div class="stat-icon ${iconClass}">${STAT_ICONS[iconKey]}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value ${valueClass}">${value}</div>
    </div>
  `;
}

/* ---------------------------------------------------------
   SATELLITE / SEGMENTATION IMAGERY
   --------------------------------------------------------- */

function updateSatelliteImages() {
  const sat = state.activeCase.satellite;
  const sarImg = document.getElementById('sar-image');
  const segImg = document.getElementById('seg-image');
  sarImg.src = sat.image;
  segImg.src = sat.segmentation_image;

  document.getElementById('meta-platform').textContent = sat.platform;
  document.getElementById('meta-sensor').textContent = sat.sensor;
  document.getElementById('meta-acquisition').textContent = sat.acquisition_time;
  document.getElementById('meta-resolution').textContent = sat.resolution;
  document.getElementById('confidence-pill').textContent = `${state.activeCase.statistics.detection_confidence.toFixed(1)}%`;
}

/* ---------------------------------------------------------
   CASE DETAILS
   --------------------------------------------------------- */

function updateCaseDetails() {
  const d = state.activeCase.case_details;
  const grid = document.getElementById('case-details-grid');
  const rows = [
    ['Case ID', state.activeCase.case_id],
    ['Location', d.location],
    ['Coordinates', d.coordinates],
    ['Detection Time', d.detection_time],
    ['Estimated Spill Age', d.spill_age],
    ['Spill Area', d.spill_area],
    ['Wind Speed', d.wind_speed],
    ['Ocean Current', d.ocean_current],
    ['Drift Speed', d.drift_speed],
    ['Analysis Status', d.analysis_status],
  ];
  grid.innerHTML = rows.map(([label, value]) => `
    <div class="detail-card">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    </div>
  `).join('');
  grid.classList.remove('fade-swap');
  void grid.offsetWidth;
  grid.classList.add('fade-swap');
}

/* ---------------------------------------------------------
   SPILL GEOMETRY
   --------------------------------------------------------- */

function updateGeometry() {
  const g = state.activeCase.spill_geometry;
  const grid = document.getElementById('geometry-grid');
  const rows = [
    ['Total Area', `${g.total_area_km2.toFixed(2)} KM²`],
    ['Perimeter', `${g.perimeter_km.toFixed(1)} KM`],
    ['Maximum Length', `${g.max_length_km.toFixed(1)} KM`],
    ['Maximum Width', `${g.max_width_km.toFixed(1)} KM`],
    ['Centroid Latitude', `${g.centroid.lat.toFixed(3)}° N`],
    ['Centroid Longitude', `${g.centroid.lon.toFixed(3)}° E`],
  ];
  grid.innerHTML = rows.map(([label, value]) => `
    <div class="detail-card">
      <div class="detail-label">${label}</div>
      <div class="detail-value">${value}</div>
    </div>
  `).join('');

  drawGeometrySvg(g.polygon);
}

function drawGeometrySvg(polygonLonLat) {
  const svg = document.getElementById('geometry-svg');
  const lons = polygonLonLat.map(p => p[0]);
  const lats = polygonLonLat.map(p => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const pad = 24, w = 260, h = 200;

  const points = polygonLonLat.map(([lon, lat]) => {
    const x = pad + ((lon - minLon) / (maxLon - minLon || 1)) * (w - pad * 2);
    const y = h - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const cx = w / 2, cy = h / 2;

  svg.innerHTML = `<polygon points="${points}"></polygon><circle cx="${cx}" cy="${cy}" r="4"></circle>`;
}

/* ---------------------------------------------------------
   VESSEL / SUSPECT TABLE
   --------------------------------------------------------- */

function updateVesselTable() {
  const tbody = document.getElementById('suspect-table-body');
  const suspects = state.suspects.suspects;

  tbody.innerHTML = suspects.map(s => {
    const scoreClass = s.suspicion_score >= 70 ? 'score-high' : (s.suspicion_score >= 40 ? 'score-medium' : 'score-low');
    return `
      <tr>
        <td class="suspect-rank">${s.rank}</td>
        <td class="suspect-name">${s.name}</td>
        <td>${s.mmsi}</td>
        <td>${s.type}</td>
        <td>${s.distance_from_origin_km.toFixed(1)} KM</td>
        <td>${s.time_correlation}%</td>
        <td>${s.trajectory_match}%</td>
        <td>${s.ais_anomaly}</td>
        <td><span class="score-badge ${scoreClass}">${s.suspicion_score}%</span></td>
      </tr>
    `;
  }).join('');
}

/* ---------------------------------------------------------
   SUSPECT PROBABILITY GAUGE
   --------------------------------------------------------- */

function updateSuspectProbability() {
  const top = state.suspects.top_suspect;
  if (!top) return;

  const circumference = 2 * Math.PI * 60; // r=60
  const fillEl = document.getElementById('gauge-fill');
  const pct = top.suspicion_score / 100;
  const offset = circumference * (1 - pct);

  fillEl.style.strokeDasharray = `${circumference}`;
  fillEl.style.strokeDashoffset = `${circumference}`;
  fillEl.style.stroke = top.suspicion_score >= 70 ? 'var(--c-red)' : (top.suspicion_score >= 40 ? 'var(--c-amber)' : 'var(--c-green)');

  requestAnimationFrame(() => {
    fillEl.style.strokeDashoffset = `${offset}`;
  });

  animateCountUp(document.getElementById('gauge-value'), top.suspicion_score, '%');
  document.getElementById('probability-vessel-name').textContent = top.name;

  const factors = state.suspects.attribution_factors || [];
  const list = document.getElementById('factor-list');
  list.innerHTML = factors.map(f => `
    <li><span class="${f.met ? 'check' : 'cross'}">${f.met ? '✓' : '–'}</span> ${f.label}</li>
  `).join('');
}

function animateCountUp(el, target, suffix = '') {
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(progress * target);
    el.textContent = `${value}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------
   DRIFT & HINDCASTING TIMELINE
   --------------------------------------------------------- */

function updateDriftTimeline() {
  const d = state.activeCase.drift;
  document.getElementById('drift-origin-time').textContent = d.estimated_origin.time;
  document.getElementById('drift-current-time').textContent = d.current_location.time;
  document.getElementById('drift-forecast-time').textContent = d.forecast_24h.time;
}

/* ---------------------------------------------------------
   MAP (LEAFLET)
   --------------------------------------------------------- */

function updateMap() {
  const c = state.activeCase;

  if (!state.map) {
    state.map = L.map('main-map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);

    document.getElementById('map-zoom-in').addEventListener('click', () => state.map.zoomIn());
    document.getElementById('map-zoom-out').addEventListener('click', () => state.map.zoomOut());
    document.getElementById('map-reset').addEventListener('click', () => fitInvestigationBounds());
    document.getElementById('map-fullscreen').addEventListener('click', toggleMapFullscreen);
  }

  clearMapLayers();

  // --- Oil spill polygon ---
  const polygonLatLng = c.spill_geometry.polygon.map(([lon, lat]) => [lat, lon]);
  state.layers.spillPolygon = L.polygon(polygonLatLng, {
    color: '#d1372f',
    weight: 3,
    dashArray: '7 5',
    fillColor: '#d1372f',
    fillOpacity: 0.38,
    className: 'spill-polygon',
  }).addTo(state.map);

  const spillLabel = L.divIcon({
    className: '',
    html: `<div class="spill-label">⚠ DETECTED OIL SPILL<span class="sub">AREA: ${c.spill_geometry.total_area_km2.toFixed(2)} KM² · CONF: ${c.statistics.detection_confidence.toFixed(1)}%</span></div>`,
    iconSize: null,
  });
  L.marker([c.spill_geometry.centroid.lat, c.spill_geometry.centroid.lon], { icon: spillLabel, interactive: false })
    .addTo(state.map);

  // --- Centroid marker ---
  const centroidIcon = L.divIcon({
    className: 'centroid-icon',
    html: crosshairSvg('#d1372f'),
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  state.layers.centroidMarker = L.marker([c.spill_geometry.centroid.lat, c.spill_geometry.centroid.lon], { icon: centroidIcon })
    .addTo(state.map)
    .bindPopup(`<div class="vessel-popup"><div class="vessel-popup-name">Spill Centroid</div>
      <div class="vessel-popup-row"><span>Latitude</span><span>${c.spill_geometry.centroid.lat.toFixed(3)}°</span></div>
      <div class="vessel-popup-row"><span>Longitude</span><span>${c.spill_geometry.centroid.lon.toFixed(3)}°</span></div>
      <div class="vessel-popup-row"><span>Estimated Area</span><span>${c.spill_geometry.total_area_km2.toFixed(2)} KM²</span></div>
      <div class="vessel-popup-row"><span>Detection Time</span><span>${c.case_details.detection_time}</span></div></div>`);

  // --- Estimated origin zone ---
  const origin = c.drift.estimated_origin;
  state.layers.originZone = L.circle([origin.lat, origin.lon], {
    radius: 1800,
    color: '#d98c1f',
    weight: 2,
    fillColor: '#d98c1f',
    fillOpacity: 0.22,
  }).addTo(state.map)
    .bindTooltip('ESTIMATED USING BACKWARD DRIFT / HINDCASTING ANALYSIS', { direction: 'top' });

  const originLabel = L.divIcon({
    className: '',
    html: `<div class="spill-label origin-label">ESTIMATED ORIGIN ZONE<span class="sub">${origin.time}</span></div>`,
    iconSize: null,
  });
  L.marker([origin.lat, origin.lon], { icon: originLabel, interactive: false }).addTo(state.map);

  // --- Backward drift path (hindcasting) ---
  const backwardLatLng = c.drift.backward_path.map(([lon, lat]) => [lat, lon]);
  state.layers.backwardPath = L.polyline(backwardLatLng, {
    color: '#0d6a79', weight: 3, dashArray: '9 6',
  }).addTo(state.map).bindTooltip('BACKWARD DRIFT PATH', { sticky: true });

  // --- Forward forecast path ---
  const forwardLatLng = c.drift.forward_path.map(([lon, lat]) => [lat, lon]);
  state.layers.forwardPath = L.polyline(forwardLatLng, {
    color: '#22b8cf', weight: 3,
  }).addTo(state.map).bindTooltip('24-HOUR DRIFT FORECAST', { sticky: true });

  // --- Vessels ---
  const topSuspectId = state.suspects.top_suspect ? state.suspects.top_suspect.vessel_id : null;

  state.vessels.forEach(v => {
    const color = v.risk_level === 'HIGH' ? '#d1372f' : (v.risk_level === 'MEDIUM' ? '#d98c1f' : '#1d6fa5');
    const weight = v.risk_level === 'HIGH' ? 4 : (v.risk_level === 'MEDIUM' ? 2.5 : 1.5);

    const line = L.polyline(v.trajectory.map(([lon, lat]) => [lat, lon]), {
      color, weight, opacity: 0.85,
    }).addTo(state.map);
    state.layers.vesselLines.push(line);

    // The bow must point the way the vessel is actually travelling, which is
    // the direction from the second-to-last trajectory point to the vessel's
    // current position -- NOT simply the raw AIS course field, which can be
    // stale or noisy and would otherwise make the ship look like it is
    // pointing straight at (rather than moving past/away from) the spill.
    const heading = vesselHeading(v);

    const icon = L.divIcon({
      className: 'ship-icon',
      html: shipSvg(color, heading),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker([v.lat, v.lon], { icon }).addTo(state.map);
    marker.bindPopup(buildVesselPopup(v));
    state.layers.vesselMarkers.push(marker);

    if (v.id === topSuspectId) {
      const topLabel = L.divIcon({
        className: '',
        html: `<div class="top-suspect-label">TOP SUSPECT</div>`,
        iconSize: null,
        iconAnchor: [-14, 10],
      });
      L.marker([v.lat, v.lon], { icon: topLabel, interactive: false }).addTo(state.map);
      marker.getElement() && marker.getElement().classList.add('pulse-marker');
    }
  });

  fitInvestigationBounds();
}

function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function vesselHeading(v) {
  const traj = v.trajectory;
  if (!traj || traj.length < 2) return v.course_deg;
  // trajectory points are [lon, lat]; use the final leg (second-to-last -> current position)
  const [lonA, latA] = traj[traj.length - 2];
  return bearingBetween(latA, lonA, v.lat, v.lon);
}

function crosshairSvg(color) {
  return `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6" stroke="${color}" stroke-width="2"/></svg>`;
}

function shipSvg(color, courseDeg) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" style="transform:rotate(${courseDeg}deg)">
    <path d="M12 2 L18 16 L12 13 L6 16 Z" fill="${color}" stroke="#ffffff" stroke-width="1"/>
  </svg>`;
}

function buildVesselPopup(v) {
  return `<div class="vessel-popup">
    <div class="vessel-popup-name">${v.name}</div>
    <div class="vessel-popup-row"><span>MMSI</span><span>${v.mmsi}</span></div>
    <div class="vessel-popup-row"><span>Type</span><span>${v.type}</span></div>
    <div class="vessel-popup-row"><span>Speed</span><span>${v.speed_knots} KT</span></div>
    <div class="vessel-popup-row"><span>Course</span><span>${v.course_deg}°</span></div>
    <div class="vessel-popup-row"><span>Dist. From Origin</span><span>${v.distance_from_origin_km.toFixed(1)} KM</span></div>
    <div class="vessel-popup-row"><span>Dist. From Spill</span><span>${v.distance_from_spill_km.toFixed(1)} KM</span></div>
    <div class="vessel-popup-row"><span>Time Correlation</span><span>${v.time_correlation}%</span></div>
    <div class="vessel-popup-row"><span>Suspicion Score</span><span>${v.suspicion_score}%</span></div>
  </div>`;
}

function clearMapLayers() {
  const l = state.layers;
  [l.spillPolygon, l.originZone, l.backwardPath, l.forwardPath, l.centroidMarker]
    .forEach(layer => layer && state.map.removeLayer(layer));
  l.vesselMarkers.forEach(m => state.map.removeLayer(m));
  l.vesselLines.forEach(m => state.map.removeLayer(m));
  state.map.eachLayer(layer => {
    if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === '') {
      state.map.removeLayer(layer);
    }
  });
  l.vesselMarkers = [];
  l.vesselLines = [];
}

function fitInvestigationBounds() {
  const c = state.activeCase;
  const pts = [
    [c.spill_geometry.centroid.lat, c.spill_geometry.centroid.lon],
    [c.drift.estimated_origin.lat, c.drift.estimated_origin.lon],
    [c.drift.forecast_24h.lat, c.drift.forecast_24h.lon],
    ...state.vessels.map(v => [v.lat, v.lon]),
    ...c.spill_geometry.polygon.map(([lon, lat]) => [lat, lon]),
  ];
  const bounds = L.latLngBounds(pts);
  state.map.fitBounds(bounds, { padding: [40, 40] });
}

function toggleMapFullscreen() {
  const wrapper = document.querySelector('.map-wrapper');
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
  setTimeout(() => state.map && state.map.invalidateSize(), 250);
}

/* ---------------------------------------------------------
   CHARTS (Chart.js)
   --------------------------------------------------------- */

function updateCharts() {
  const c = state.activeCase;

  destroyChart('areaTrend');
  destroyChart('suspectScores');
  destroyChart('vesselDistance');
  destroyChart('driftSpeed');

  const navy = '#0a2540', ocean = '#1d6fa5', teal = '#12879a', red = '#d1372f', amber = '#d98c1f';

  state.charts.areaTrend = new Chart(document.getElementById('chart-area-trend'), {
    type: 'line',
    data: {
      labels: c.charts.spill_area_trend.labels,
      datasets: [{
        label: 'Spill Area (KM²)',
        data: c.charts.spill_area_trend.values,
        borderColor: ocean,
        backgroundColor: 'rgba(29,111,165,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: baseChartOptions(),
  });

  const suspectSorted = [...state.suspects.suspects].sort((a, b) => b.suspicion_score - a.suspicion_score);
  state.charts.suspectScores = new Chart(document.getElementById('chart-suspect-scores'), {
    type: 'bar',
    data: {
      labels: suspectSorted.map(s => s.name),
      datasets: [{
        label: 'Suspicion Score',
        data: suspectSorted.map(s => s.suspicion_score),
        backgroundColor: suspectSorted.map(s => s.suspicion_score >= 70 ? red : (s.suspicion_score >= 40 ? amber : teal)),
        borderRadius: 4,
      }],
    },
    options: { ...baseChartOptions(), indexAxis: 'y' },
  });

  state.charts.vesselDistance = new Chart(document.getElementById('chart-vessel-distance'), {
    type: 'bar',
    data: {
      labels: state.vessels.map(v => v.name),
      datasets: [{
        label: 'Distance From Origin (KM)',
        data: state.vessels.map(v => v.distance_from_origin_km),
        backgroundColor: navy,
        borderRadius: 4,
      }],
    },
    options: baseChartOptions(),
  });

  state.charts.driftSpeed = new Chart(document.getElementById('chart-drift-speed'), {
    type: 'line',
    data: {
      labels: c.charts.drift_speed_trend.labels,
      datasets: [{
        label: 'Drift Speed (KM/H)',
        data: c.charts.drift_speed_trend.values,
        borderColor: teal,
        backgroundColor: 'rgba(18,135,154,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      }],
    },
    options: baseChartOptions(),
  });
}

function baseChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0a2540',
        titleFont: { family: 'Inter' },
        bodyFont: { family: 'Inter' },
        padding: 8,
      },
    },
    scales: {
      x: { ticks: { font: { size: 10, family: 'Inter' }, color: '#5b7185' }, grid: { display: false } },
      y: { ticks: { font: { size: 10, family: 'Inter' }, color: '#5b7185' }, grid: { color: '#eef3f7' } },
    },
  };
}

function destroyChart(key) {
  if (state.charts[key]) {
    state.charts[key].destroy();
    state.charts[key] = null;
  }
}

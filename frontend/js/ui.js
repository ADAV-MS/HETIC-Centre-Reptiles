let chart = null;
let selectedNode = null;
const alerts = {};
const nodesData = {};

export function initUI(mqttClient) {
    // Initialisation Chart.js
    const ctx = document.getElementById('chart-node').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Point Chaud (°C)', data: [], borderColor: '#ef4444', borderWidth: 2, tension: 0.1, fill: false, spanGaps: true },
                { label: 'Point Froid (°C)', data: [], borderColor: '#0284c7', borderWidth: 2, tension: 0.1, fill: false, spanGaps: true }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Envoi de commandes
    document.getElementById('cmd-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const target = document.getElementById('cmd-target').value;
        const action = document.getElementById('cmd-action').value;
        const valueInput = document.getElementById('cmd-value');
        let rawVal = valueInput ? valueInput.value : '';

        if (!target) {
            alert('Veuillez sélectionner un node dans la grille.');
            return;
        }

        let value = rawVal;
        if (rawVal === 'true') value = true;
        else if (rawVal === 'false') value = false;
        else if (!isNaN(rawVal) && rawVal.trim() !== '') value = Number(rawVal);

        const cmdId = 'cmd-' + Math.random().toString(36).substring(2, 7);
        const payload = JSON.stringify({ id: cmdId, action, value });

        mqttClient.publish(`rc/v1/cmd/${target}`, payload, { qos: 1 }, (err) => {
            if (!err) {
                logAck({ cmdId, action, ok: 'en_cours', detail: `Envoyé vers ${target}` });
            }
        });
    });
}

function initDynamicValueField() {
    const actionSelect = document.getElementById('cmd-action');
    const valueContainer = document.getElementById('value-container');

    if (!actionSelect || !valueContainer) return;

    const updateField = () => {
        const action = actionSelect.value;
        
        if (action === 'lamp' || action === 'light') {
            valueContainer.innerHTML = `
                <select id="cmd-value">
                    <option value="on">on</option>
                    <option value="off">off</option>
                </select>
            `;
        } else if (action === 'safety_cut') {
            valueContainer.innerHTML = `
                <select id="cmd-value">
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            `;
        } else if (action === 'setpoint') {
            valueContainer.innerHTML = `
                <input type="number" id="cmd-value" value="32" placeholder="ex: 32">
            `;
        } else if (action === 'interval') {
            valueContainer.innerHTML = `
                <input type="number" id="cmd-value" value="60" placeholder="ex: 60">
            `;
        } else {
            valueContainer.innerHTML = `
                <input type="text" id="cmd-value" placeholder="Valeur...">
            `;
        }
    };

    actionSelect.addEventListener('change', updateField);
    updateField();
}

export function handleIncomingData(node, payload) {
    let isNewNode = false;

    if (!nodesData[node]) {
        nodesData[node] = {
            id: node,
            tempHot: null,
            tempCold: null,
            door: 'fermée',
            battery: null,
            lastSeen: Date.now(),
            history: []
        };
        isNewNode = true;
    }

    const d = nodesData[node];
    d.lastSeen = Date.now();

    if (payload.type === 'reading') {
        if (payload.sensor === 'temp_hot' || payload.sensor === 'temp_ambient') d.tempHot = Number(payload.value);
        if (payload.sensor === 'temp_cold') d.tempCold = Number(payload.value);

        const currentTs = payload.ts || Date.now();
        const lastPoint = d.history.length > 0 ? d.history[d.history.length - 1] : null;

        if (lastPoint && lastPoint.ts === currentTs) {
            lastPoint.tempHot = d.tempHot;
            lastPoint.tempCold = d.tempCold;
        } else {
            d.history.push({ ts: currentTs, tempHot: d.tempHot, tempCold: d.tempCold });
        }

        if (d.history.length > 60) {
            d.history.shift();
        }

    } else if (payload.type === 'door') {
        d.door = payload.state;
        if (d.door === 'open') triggerAlert(node, 'door', `Porte ouverte sur ${node}`);
        else resolveAlert(node, 'door');
    } else if (payload.type === 'heartbeat' || payload.type === 'boot') {
        if (payload.battery !== undefined) {
            d.battery = Number(payload.battery);
            if (d.battery < 20) triggerAlert(node, 'battery', `Batterie faible (${d.battery}%) sur ${node}`);
            else resolveAlert(node, 'battery');
        }
    } else if (payload.type === 'ack') {
        logAck(payload);
    }

    // Détection valeurs aberrantes
    if (d.tempHot === -127 || d.tempHot === 85 || d.tempCold === -127) {
        triggerAlert(node, 'sensor', `Valeur aberrante sur ${node}`);
    } else {
        resolveAlert(node, 'sensor');
    }

    if (isNewNode) updateCommandSelect();
    renderGrid();
    if (selectedNode === node) updateChart(node);
}

function updateCommandSelect() {
    const select = document.getElementById('cmd-target');
    if (!select) return;
    
    const currentVal = select.value; 
    let html = '<option value="">-- Choisir un capteur --</option>';
    for (const id of Object.keys(nodesData).sort()) {
        html += `<option value="${id}">${id}</option>`;
    }
    
    select.innerHTML = html;
    if (currentVal) select.value = currentVal;
}

export function checkSilentNodes() {
    const now = Date.now();
    for (const [node, d] of Object.entries(nodesData)) {
        if (now - d.lastSeen > 5 * 60 * 1000) {
            triggerAlert(node, 'silent', `Node muet : ${node}`);
        }
    }
    renderAlerts();
}

function triggerAlert(node, type, message) {
    const key = `${node}_${type}`;
    if (!alerts[key]) {
        alerts[key] = { message, time: new Date().toLocaleTimeString() };
        renderAlerts();
    }
}

function resolveAlert(node, type) {
    const key = `${node}_${type}`;
    if (alerts[key]) {
        delete alerts[key];
        renderAlerts();
    }
}

function renderAlerts() {
    const container = document.getElementById('alerts-container');
    const keys = Object.keys(alerts);
    if (keys.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Aucune alerte active</p>';
        return;
    }
    let html = '';
    for (const key of keys) {
        const a = alerts[key];
        html += `
        <div class="alert-item">
            <span class="alert-content">[${a.time}] ${a.message}</span>
            <button class="btn-danger" onclick="window.ackAlert('${key}')">Acquitter</button>
        </div>`;
    }
    container.innerHTML = html;
}

window.ackAlert = function(key) {
    delete alerts[key];
    renderAlerts();
};

function renderGrid() {
    const grid = document.getElementById('nodes-grid');
    let html = '';
    for (const [id, d] of Object.entries(nodesData).sort()) {
        const isSelected = selectedNode === id ? 'selected' : '';
        const doorClass = d.door === 'open' ? 'status-open' : 'status-closed';
        html += `
        <div class="node-card ${isSelected}" onclick="window.selectNode('${id}')">
            <div class="node-title">${id}</div>
            <div class="node-detail-row"><span>Pt. Chaud:</span> <span>${d.tempHot !== null ? d.tempHot + ' °C' : '--'}</span></div>
            <div class="node-detail-row"><span>Pt. Froid:</span> <span>${d.tempCold !== null ? d.tempCold + ' °C' : '--'}</span></div>
            <div class="node-detail-row"><span>Porte:</span> <span class="${doorClass}">${d.door}</span></div>
            <div class="node-detail-row"><span>Batterie:</span> <span>${d.battery !== null ? d.battery + '%' : 'Secteur'}</span></div>
        </div>`;
    }
    grid.innerHTML = html;
}

window.selectNode = function(id) {
    selectedNode = id;
    document.getElementById('detail-title').textContent = `Historique : ${id}`;
    document.getElementById('cmd-target').value = id;
    renderGrid();
    updateChart(id);
};

function updateChart(id) {
    const d = nodesData[id];
    if (!d || !chart) return;
    chart.data.labels = d.history.map(h => new Date(h.ts).toLocaleTimeString());
    chart.data.datasets[0].data = d.history.map(h => h.tempHot);
    chart.data.datasets[1].data = d.history.map(h => h.tempCold);
    chart.update();
}

function logAck(payload) {
    const logBox = document.getElementById('ack-log');
    const time = new Date().toLocaleTimeString();
    const statusText = payload.ok === true || payload.ok === 'ok' ? 'SUCCÈS' : (payload.ok === false ? 'ÉCHEC' : 'ENVOYÉ');
    logBox.innerHTML += `[${time}] ID: ${payload.cmdId || 'N/A'} | Action: ${payload.action} | Statut: ${statusText} | Détail: ${payload.detail || 'ok'}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}
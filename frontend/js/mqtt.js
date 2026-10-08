export function initMqtt(onMessageCallback) {
    const client = mqtt.connect('ws://localhost:9001', {
        username: 'front_user',
        password: 'front_user',
        clean: true,
        reconnectPeriod: 1000
    });

    client.on('connect', () => {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Connecté';
            statusEl.className = 'badge badge-online';
        }
        client.subscribe('rc/v1/#', (err) => {
            if (err) console.error("Erreur d'abonnement MQTT", err);
        });
    });

    client.on('offline', () => {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Hors ligne';
            statusEl.className = 'badge badge-warning';
        }
    });

    client.on('error', (err) => {
        console.error("Erreur MQTT :", err);
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Erreur';
            statusEl.className = 'badge badge-offline';
        }
    });

    client.on('message', (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            const topicParts = topic.split('/');
            const node = payload.node || topicParts[topicParts.length - 1];
            if (node) {
                onMessageCallback(node, payload, topic);
            }
        } catch (e) {
            console.error("Erreur parsing message MQTT :", e);
        }
    });

    return client;
}
'use strict';

const mqtt = require('mqtt');

function createMqttOutput() {
  let client = null;
  const buffer = []; // Stocke les messages si le réseau coupe

  return {
    start(sim) {
      // 1. Connexion au serveur MQTT local
      client = mqtt.connect('mqtt://localhost:1883');

      client.on('connect', () => {
        // Écoute des commandes pour tous les boîtiers
        client.subscribe('rc/v1/cmd/+');

        // Envoi des messages en attente dès que le réseau revient
        while (buffer.length > 0 && client.connected) {
          const msg = buffer.shift();
          client.publish(msg.topic, msg.payload);
        }
      });

      // 2. Quand le simulateur génère un message, on l'envoie en MQTT et sur la console
      sim.on('message', (m) => {
        let sub = 'reading';
        if (m.type === 'door') sub = 'door';
        else if (m.type === 'heartbeat' || m.type === 'boot') sub = 'heartbeat';
        else if (m.type === 'ack') sub = 'ack';

        const topic = `rc/v1/${sub}/${m.node}`;
        const payload = JSON.stringify(m);

        // Si connecté on publie, sinon on met de côté dans le buffer
        if (client && client.connected) {
          client.publish(topic, payload, { qos: 1 });
        } else {
          buffer.push({ topic, payload });
        }

        // Garde la sortie console d'origine active
        process.stdout.write(payload + '\n');
      });

      // 3. Quand une commande arrive du site web via MQTT
      client.on('message', (topic, message) => {
        const targetNode = topic.split('/')[3]; // Extrait l'ID du boîtier
        const data = JSON.parse(message.toString());
        
        sim.handleCommand({
          id: data.id || 'cmd-1',
          target: targetNode,
          action: data.action,
          value: data.value
        });
      });
    },

    stop() {
      if (client) client.end(true);
    }
  };
}

module.exports = { createMqttOutput };
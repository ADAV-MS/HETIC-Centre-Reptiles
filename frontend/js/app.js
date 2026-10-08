import { initMqtt } from './mqtt.js';
import { initUI, handleIncomingData, checkSilentNodes } from './ui.js';

// Initialise la connexion MQTT en lui passant la fonction de traitement des messages
const client = initMqtt((node, payload) => {
    handleIncomingData(node, payload);
});

// Initialise l'interface graphique (graphiques, formulaires) avec le client MQTT pour pouvoir publier
initUI(client);

// Vérifie les capteurs muets toutes les 30 secondes
setInterval(checkSilentNodes, 30000);
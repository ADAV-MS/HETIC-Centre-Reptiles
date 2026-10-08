import { initMqtt } from './mqtt.js';
import { initUI, handleIncomingData, checkSilentNodes } from './ui.js';

// 1. Connexion MQTT et écoute des messages entrants
const client = initMqtt(handleIncomingData);

// 2. Initialisation des composants graphiques et de l'interface
initUI(client);

// 3. Vérification périodique des nodes muets (toutes les 10 secondes)
setInterval(checkSilentNodes, 10000);
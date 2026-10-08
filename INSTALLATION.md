# Supervision - Centre pour Reptiles

Interface de supervision web temps réel pour le suivi des enclos et la gestion des alertes MQTT.

## Prérequis

* Docker et Docker Compose installés sur votre machine.

## Lancement rapide

1. Clonez le projet et entrez dans le dossier :
```bash
git clone <URL_DE_VOTRE_DEPOT_GITHUB>
cd HETIC-Centre-Reptiles
```

2. Démarrez l'infrastructure (Broker MQTT, Simulateur, Frontend Nginx) :
```bash
docker compose up --build -d
```

3. Accédez à l'interface de supervision depuis votre navigateur :
http://localhost:8080

## Changer de scénario

Le simulateur joue le scénario `incidents` par défaut. 

Pour tester un autre comportement (`normal` ou `chaos`), ouvrez votre fichier `docker-compose.yml`. Dans la section du service `simulator`, modifiez le dernier mot de la ligne `command`.

Exemple pour lancer la simulation sans aucun incident :
```yaml
command: ["node", "src/index.js", "--output", "mqtt", "--scenario", "normal"]
```

Une fois le fichier sauvegardé, appliquez le changement en relançant l'infrastructure :
```bash
docker compose up -d
```

## Arrêt du système

Pour tout éteindre proprement :
```bash
docker compose down
```
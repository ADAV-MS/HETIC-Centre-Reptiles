FROM node:20-alpine
WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm install

# Copie du code source
COPY . .

# Lancement du simulateur avec l'adaptateur MQTT
CMD ["node", "src/index.js", "--output", "mqtt"]
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY proto ./proto
COPY schema ./schema
COPY src ./src
COPY scripts ./scripts
COPY docs ./docs
COPY postman ./postman
COPY README.md ./

ENV NODE_ENV=production

CMD ["node", "src/services/rest/index.js"]

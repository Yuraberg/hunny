# products.generated.json обновляется командой `npm run generate:products`
# из корня репозитория (та же, что обновляет worker/products.generated.json)
# — запускать перед сборкой образа, если менялись товары.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./
COPY lib ./lib
COPY products.generated.json ./
EXPOSE 3000
CMD ["node", "server.js"]

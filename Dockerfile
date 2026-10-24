FROM node:22-alpine
WORKDIR /app
COPY . .
RUN cd server && npm ci --omit=dev && cd ../client && npm ci && npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]

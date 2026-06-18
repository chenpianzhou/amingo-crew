FROM node:24-slim
RUN apt-get update && apt-get install -y ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p uploads thumbs
EXPOSE 3456
ENV PORT=3456
CMD ["node", "server.js"]

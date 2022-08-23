FROM node:16

# https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

# Create app directory
WORKDIR /app

# Bundle app source
COPY . .

# Install app dependencies
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

#EXPOSE 8080

#CMD [ "tail", "-F", "anything" ]
CMD [ "node", "server.js" ]
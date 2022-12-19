
FROM node:lts

WORKDIR /ansible-language-server

COPY . .

RUN npm ci
RUN npm run compile

ENTRYPOINT [ "node", "./out/server/src/server.js" ]
CMD [ "--stdio" ]

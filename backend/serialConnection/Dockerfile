FROM balenalib/%%RESIN_MACHINE_NAME%%-debian-node:15.10-buster

RUN install_packages wget git
ENV UDEV=1

COPY package.json /package.json
RUN npm install

COPY src/ /usr/src/app
CMD ["node", "/usr/src/app/main.js"]
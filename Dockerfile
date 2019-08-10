# docker run -d -p 8000:8000 alseambusher/crontab-ui
FROM alpine

ENV   CRON_PATH /etc/crontabs

RUN   mkdir /crontab-ui; touch $CRON_PATH/root; chmod +x $CRON_PATH/root

WORKDIR /crontab-ui

LABEL maintainer "@alseambusher"
LABEL description "Crontab-UI docker"

RUN   apk --no-cache add \
      wget \
      curl \
      nodejs \
      npm \
      docker \
      supervisor

COPY ./package.json ./package-lock.json /crontab-ui/

RUN   npm install

COPY supervisord.conf /etc/supervisord.conf

COPY . /crontab-ui

ENV   HOST 0.0.0.0

ENV   PORT 8000

ENV   CRON_IN_DOCKER true

EXPOSE $PORT

CMD ["supervisord", "-c", "/etc/supervisord.conf"]

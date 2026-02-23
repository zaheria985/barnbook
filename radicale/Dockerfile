FROM tomsquest/docker-radicale:latest

COPY config /etc/radicale/config
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

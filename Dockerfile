FROM oven/bun:1 AS base

WORKDIR /app
COPY . .

RUN bun install
RUN mkdir -p /app/data

# faq.json을 볼륨 마운트와 무관한 위치에 백업
# (fly.io 볼륨이 /app/data를 덮어쓰므로)
RUN cp /app/data/faq.json /app/faq-seed.json 2>/dev/null || true

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080
CMD ["/app/entrypoint.sh"]

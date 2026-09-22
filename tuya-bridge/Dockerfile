FROM python:3.11-slim

WORKDIR /app

# pulsar-client may need build tools on some platforms; try prebuilt wheels first.
RUN apt-get update && apt-get install -y --no-install-recommends gcc libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY mq_authentication.py .
COPY message_util.py .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]

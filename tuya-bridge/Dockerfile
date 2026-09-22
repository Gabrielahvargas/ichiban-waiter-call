FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends gcc libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all bridge files
COPY main.py .
COPY bridge_core.py .
COPY mq_authentication.py .
COPY message_util.py .

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]

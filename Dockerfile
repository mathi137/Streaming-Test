# Gets a lightweight version for Python
FROM python:3.12-slim

# Creates a directory and moves to it
WORKDIR /app

# Copy the source code from your current working directory to the newly created directory inside the container
ADD . /app

# Install all the dependencies
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000

# Runs Flask application for production
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "app:app"]
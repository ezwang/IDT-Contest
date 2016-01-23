#!/bin/sh -e

venv/bin/gunicorn -w 5 -b 0.0.0.0:8080 --worker-class eventlet server:app

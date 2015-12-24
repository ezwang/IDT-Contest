#!/usr/bin/env python

import psycopg2
import json
import sys

from werkzeug.security import generate_password_hash, check_password_hash

with open('config.json') as data:
    config = json.load(data)

print "[*] Connecting to database..."
conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")
cur = conn.cursor()

print('[*] Deleting previous tables...')
cur.execute('DROP TABLE IF EXISTS users, packages, steps')
conn.commit()

print "[*] Creating user table..."
cur.execute('CREATE TABLE IF NOT EXISTS users (id SERIAL, username TEXT UNIQUE, password TEXT, email TEXT, type INTEGER)')
conn.commit()
print "[*] Adding 'admin' user with password 'admin'..."
cur.execute('INSERT INTO users (username, password, type) VALUES (%s, %s, 1)', ('admin', generate_password_hash('admin')))
conn.commit()
print "[*] Adding 'user' user with password 'user'..."
cur.execute('INSERT INTO users (username, password, type) VALUES (%s, %s, 0)', ('user', generate_password_hash('user')))
conn.commit()
print "[*] Creating package table..."
cur.execute('CREATE TABLE IF NOT EXISTS packages (id UUID, name TEXT, destination POINT, delivered BOOLEAN, PRIMARY KEY (id))')
conn.commit()
print '[*] Creating package steps table...'
cur.execute('CREATE TABLE IF NOT EXISTS steps (id UUID, pos POINT, ele DOUBLE PRECISION, time TIMESTAMP)')
conn.commit()
print '[*] Tasks completed successfully!'
conn.close()

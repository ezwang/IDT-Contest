#!/usr/bin/env python

import psycopg2
import json
import sys

with open('config.json') as data:
    config = json.load(data)

print "[*] Connecting to database..."
conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")
cur = conn.cursor()

if len(sys.argv) > 1:
    if sys.argv[1].lower() == "clear":
        print('[*] Deleting all tables...')
        cur.execute('DROP TABLE IF EXISTS users, packages, steps')
        conn.commit()

print "[*] Creating user table..."
cur.execute('CREATE TABLE IF NOT EXISTS users (id SERIAL, username TEXT, password TEXT, email TEXT, type INTEGER)')
conn.commit()
print "[*] Creating package table..."
cur.execute('CREATE TABLE IF NOT EXISTS packages (id UUID, name TEXT, destination POINT, delivered BOOLEAN, PRIMARY KEY (id))')
conn.commit()
print '[*] Creating package steps table...'
cur.execute('CREATE TABLE IF NOT EXISTS steps (id UUID, pos POINT, ele DOUBLE PRECISION, time TIMESTAMP)')
conn.commit()
print '[*] Tasks completed successfully!'
conn.close()

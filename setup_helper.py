#!/usr/bin/env python

import psycopg2
import json
import sys

import random
import string
import json

import getpass

from werkzeug.security import generate_password_hash, check_password_hash

def load_config():
    with open('config.json') as data:
        config = json.load(data)
    return config

def save_config(config):
    with open('config.json', 'w') as data:
        data.write(json.dumps(config, indent=4, sort_keys=True))

def generate_flask_secret(config):
    print "[*] Generating random flask secret..."
    r = random.SystemRandom()
    config["flasksecret"] = ''.join(r.choice(string.printable) for _ in range(50))

def prompt_database_credentials(config):
    print("[*] You will now be prompted for your database credentials.")
    print("[*] Press enter to select the default.")
    for x in ["dbname", "host", "pass", "user"]:
        val = raw_input("What is your " + x + "? [Default: " + config["database"][x] + "] ")
        if len(val) > 0:
            config["database"][x] = val

def setup_database(config):
    print "[*] Connecting to database..."
    conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")
    cur = conn.cursor()

    print('[*] Deleting previous tables...')
    cur.execute('DROP TABLE IF EXISTS users, packages, steps, access')
    conn.commit()

    print "[*] Creating user table..."
    cur.execute('CREATE TABLE IF NOT EXISTS users (id SERIAL, username TEXT UNIQUE, password TEXT, email TEXT, type INTEGER)')
    conn.commit()
    print "[*] Creating access table..."
    cur.execute('CREATE TABLE IF NOT EXISTS access (id SERIAL, userid INTEGER, package UUID, CONSTRAINT u_constraint UNIQUE (userid, package))')
    conn.commit()
    print "[*] Adding 'admin' user..."
    while True:
        resp = getpass.getpass('Enter a password for the new user: ')
        conf = getpass.getpass('Confirm password: ')
        if resp == conf:
            break
        else:
            print("Password doesn't match confirm!")
    cur.execute('INSERT INTO users (username, password, type) VALUES (%s, %s, 1)', ('admin', generate_password_hash(resp)))
    conn.commit()
    print "[*] User created!"
    print "[*] Use the username 'admin' and the password you created to login to the website."
    print "[*] Creating package table..."
    cur.execute('CREATE TABLE IF NOT EXISTS packages (id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, delivered BOOLEAN, PRIMARY KEY (id))')
    conn.commit()
    print '[*] Creating package steps table...'
    cur.execute('CREATE TABLE IF NOT EXISTS steps (id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION, ele DOUBLE PRECISION, time TIMESTAMP)')
    conn.commit()
    conn.close()

if __name__ == '__main__':
    config = load_config()
    generate_flask_secret(config)
    if len(sys.argv) > 1 and sys.argv[1] == "prompt":
        prompt_database_credentials(config)
    save_config(config)
    setup_database(config)

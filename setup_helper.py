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
    print "[*] You will now be prompted for your database credentials."
    print "[*] Press enter to select the default shown."
    for x in [("dbname", "database name"), ("host", "host"), ("user", "username")]:
        val = raw_input("[*] What is your " + x[1] + "? [Default: " + config["database"][x[0]] + "] ")
        if len(val) > 0:
            config["database"][x[0]] = val
    while True:
        val = getpass.getpass('[*] What is your password? [Default: Previous Value] ')
        if len(val) > 0:
            config["database"]["pass"] = val
            break
        if len(config["database"]["pass"]) > 0:
            break
        else:
            print '[*] No previous value!'

def setup_database(config):
    print "[*] Connecting to database..."
    conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")
    cur = conn.cursor()

    print "[*] Deleting previous tables..."
    cur.execute('DROP TABLE IF EXISTS users, packages, steps, access')
    conn.commit()

    print "[*] Creating user table..."
    cur.execute('CREATE TABLE IF NOT EXISTS users (id SERIAL, username TEXT UNIQUE, password TEXT, email TEXT, type INTEGER)')
    conn.commit()
    print "[*] Creating access table..."
    cur.execute('CREATE TABLE IF NOT EXISTS access (id SERIAL, userid INTEGER, package UUID, CONSTRAINT u_constraint UNIQUE (userid, package))')
    conn.commit()
    print "[*] Creating package table..."
    cur.execute('CREATE TABLE IF NOT EXISTS packages (id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, delivered BOOLEAN, PRIMARY KEY (id))')
    conn.commit()
    print "[*] Creating package steps table..."
    cur.execute('CREATE TABLE IF NOT EXISTS steps (id UUID, lat DOUBLE PRECISION, lng DOUBLE PRECISION, ele DOUBLE PRECISION, time TIMESTAMP)')
    conn.commit()
    print "[*] Adding 'admin' user..."
    print "[*] The password you enter below will be used for logging in to the website."
    while True:
        resp = getpass.getpass('[*] Password: ')
        conf = getpass.getpass('[*] Confirm password: ')
        if len(resp) == 0:
            print "[!] Please enter a password!"
            continue
        if resp == conf:
            break
        else:
            print "[!] Password doesn't match confirm!"
    cur.execute('INSERT INTO users (username, password, type) VALUES (%s, %s, 1)', ('admin', generate_password_hash(resp)))
    conn.commit()
    print "[*] User created!"
    print "[*] Use the username 'admin' and the password you created to login to the website."
    conn.close()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        config = load_config()
        generate_flask_secret(config)
        if sys.argv[1] == "prompt":
            prompt_database_credentials(config)
        elif sys.argv[1] == "created":
            config["database"]["host"] = "localhost"
            config["database"]["dbname"] = "pmdb"
            config["database"]["user"] = "pmuser"
            if len(sys.argv) > 2:
                config["database"]["pass"] = sys.argv[2]
            else:
                print('[*] Enter the password you entered earlier for the database user.')
                config["database"]["pass"] = getpass.getpass("[*] Password: ")
    else:
        print 'This script should not be run directly!'
        print 'Run the setup script to install the application.'
        exit()
    setup_database(config)
    save_config(config)

#!/usr/bin/env python

import json
from flask import Flask, request, render_template, jsonify

import psycopg2

app = Flask(__name__, static_url_path='')

with open('config.json') as data:
    config = json.load(data)

conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")

@app.route('/')
def root():
    return render_template('index.html')

@app.route('/tracknewpackage')
def tracknewpackage():
    name = request.args.get('name')
    uuid = request.args.get('uuid')
    dLat = float(request.args.get('destinationLat'))
    dLon = float(request.args.get('destinationLon'))
    cur = conn.cursor()
    cur.execute('INSERT INTO packages (id, name, destination, delivered) VALUES (%s, %s, \'(%s, %s)\', false)', (uuid, name, dLat, dLon))
    conn.commit()
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    if "delivered" in request.args:
        cur = conn.cursor()
        cur.execute('UPDATE packages SET delivered = true WHERE uuid = ?', (uuid,))
        conn.commit()
    else:
        content = request.get_json()
        lat = float(content['lat'])
        lon = float(content['lon'])
        ele = float(content['ele'])
        time = content['time']
        cur = conn.cursor()
        cur.execute('INSERT INTO steps (id, pos, ele, time) VALUES (%s, \'(%s, %s)\', %s, %s)', (uuid, lat, lon, ele, time))
        conn.commit()
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

if __name__ == '__main__':
    app.run(threaded=True, port=8080, debug=True)

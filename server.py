#!/usr/bin/env python

import json
from flask import Flask, request, render_template, jsonify
from flask_socketio import SocketIO

import psycopg2

app = Flask(__name__, static_url_path='')
socketio = SocketIO(app)

with open('config.json') as data:
    config = json.load(data)

conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")

@app.route('/')
def root():
    return render_template('index.html')

@app.route('/map')
def map():
    return render_template('map.html', mapskey = config["api"]["googlemaps"] if config["api"]["googlemaps"] else "")

@app.route('/tracknewpackage')
def tracknewpackage():
    name = request.args.get('name')
    uuid = request.args.get('uuid')
    dLat = float(request.args.get('destinationLat'))
    dLon = float(request.args.get('destinationLon'))
    cur = conn.cursor()
    cur.execute('INSERT INTO packages (id, name, destination, delivered) VALUES (%s, %s, \'(%s, %s)\', false)', (uuid, name, dLat, dLon))
    conn.commit()
    socketio.emit('newpackage', {'name':name,'uuid':uuid})
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    content = request.get_json()
    if "delivered" in content:
        cur = conn.cursor()
        cur.execute('UPDATE packages SET delivered = true WHERE uuid = %s', (uuid,))
        conn.commit()
        socketio.emit('packagedelivered', {'uuid':uuid})
    else:
        lat = float(content['lat'])
        lon = float(content['lon'])
        ele = float(content['ele'])
        time = content['time']
        cur = conn.cursor()
        cur.execute('INSERT INTO steps (id, pos, ele, time) VALUES (%s, \'(%s, %s)\', %s, %s)', (uuid, lat, lon, ele, time))
        conn.commit()
        socketio.emit('plot', {'uuid':uuid,'lat':lat,'lon':lon})
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

if __name__ == '__main__':
    socketio.run(app, port=8080, debug=True)

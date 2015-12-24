#!/usr/bin/env python

import json
from flask import Flask, request, render_template, jsonify, session
from flask_socketio import SocketIO

from werkzeug.security import generate_password_hash, check_password_hash

import psycopg2

app = Flask(__name__, static_url_path='')
socketio = SocketIO(app)

with open('config.json') as data:
    config = json.load(data)

app.secret_key = config['flasksecret']
conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")

@app.route('/')
def root():
    return render_template('index.html')

@app.route('/map')
def map():
    return render_template('map.html', mapskey = config["api"]["googlemaps"] if config["api"]["googlemaps"] else "", id = session.id if 'id' in session else '')

@app.route('/login', methods=["POST"])
def login():
    if not 'username' in request.form or not 'password' in request.form:
        return jsonify(**{'error':'No data sent to server!'})
    username = request.form['username']
    password = request.form['password']
    cur = conn.cursor()
    cur.execute('SELECT id, password, username FROM users WHERE username = %s OR email = %s LIMIT 1', (username,username))
    if cur.rowcount == 0:
        return jsonify(**{'error':'No account exists with that username or email!'})
    row = cur.fetchone()
    if not check_password_hash(row[1], password):
        return jsonify(**{'error':'Wrong password!'})
    session['id'] = row[0]
    session['username'] = row[2]
    return jsonify(**{'redirect':'/map'})

@app.route('/getpackage/<uuid>')
def getexistingpackage(uuid):
    cur = conn.cursor()
    cur.execute('SELECT pos FROM steps WHERE id = %s', (uuid,))
    return jsonify(**{'data':[[d for d in x[0][1:-1].split(",")] for x in cur]})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/getpackages')
def getexistingdata():
    cur = conn.cursor()
    cur.execute('SELECT id,name,delivered,destination FROM packages')
    return jsonify(**{'data':[x for x in cur]})

@app.route('/tracknewpackage')
def tracknewpackage():
    name = request.args.get('name')
    if not name:
        name = 'Unnamed Package'
    uuid = request.args.get('uuid')
    if not uuid:
        return jsonify(**{"error":"No UUID parameter passed to server!"})
    dLat = float(request.args.get('destinationLat'))
    dLon = float(request.args.get('destinationLon'))
    cur = conn.cursor()
    cur.execute('INSERT INTO packages (id, name, destination, delivered) VALUES (%s, %s, \'(%s, %s)\', false)', (uuid, name, dLat, dLon))
    conn.commit()
    socketio.emit('newpackage', {'name':name,'uuid':uuid})
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    if not uuid:
        return jsonify(**{"error":"No UUID parameter passed to server!"})
    content = request.get_json()
    if "delivered" in content:
        cur = conn.cursor()
        cur.execute('UPDATE packages SET delivered = true WHERE id = %s', (uuid,))
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

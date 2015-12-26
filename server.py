#!/usr/bin/env python

import json
from flask import Flask, request, render_template, jsonify, session, redirect, abort, Response
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
    if 'id' in session:
        return redirect('/map')
    return render_template('index.html')

def getemail(usrid):
    cur = conn.cursor()
    cur.execute('SELECT email FROM users WHERE id = %s', (usrid,))
    if cur.rowcount == 0:
        return ""
    row = cur.fetchone()
    return row[0] if not row[0] == None else ""

@app.route('/settings')
def settings():
    if not 'id' in session:
        return redirect('/')
    return render_template('settings.html', email = getemail(session['id']).replace('"', '\\"'), username = session['username'], type = 'Administrator' if session['type'] > 0 else 'Normal User')

@app.route('/accounts')
def accounts():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(401)
    return render_template('accounts.html')

@app.route('/settings/change_password', methods=['POST'])
def changepassword():
    if not 'id' in session:
        return redirect('/')
    old = request.form['password']
    new = request.form['newpassword']
    confirm = request.form['confirmpassword']
    if len(new) == 0:
        return jsonify(**{'error':'Please enter a new password!'})
    if new != confirm:
        return jsonify(**{'error':'Your confirm does not match your password!'})
    cur = conn.cursor()
    cur.execute('SELECT password FROM users WHERE id = %s', (session['id'],))
    if cur.rowcount == 0:
        return jsonify(**{'error':'Your account does not exist anymore!'})
    row = cur.fetchone()
    if not check_password_hash(row[0], old):
        return jsonify(**{'error':'Wrong password!'})
    cur.execute('UPDATE users SET password = %s WHERE id = %s', (generate_password_hash(new), session['id']))
    conn.commit()
    return jsonify(**{'success':'Your password has been changed!'})

@app.route('/settings/delete_account', methods=['POST'])
def deleteaccount():
    if not 'id' in session:
        return redirect('/')
    password = request.form['password']
    cur = conn.cursor()
    cur.execute('SELECT password FROM users WHERE id = %s', (session['id'],))
    if cur.rowcount == 0:
        return jsonify(**{'error':'Your account does not exist anymore!'})
    row = cur.fetchone()
    if not check_password_hash(row[0], password):
        return jsonify(**{'error':'Wrong password!'})
    cur.execute('DELETE FROM users WHERE id = %s', (session['id'],))
    conn.commit()
    session.clear()
    return jsonify(**{'success':'Your account has been deleted!','redirect':'/'})

@app.route('/settings/change_email', methods=["POST"])
def changeemail():
    if not 'id' in session:
        return redirect('/')
    email = request.form['email']
    cur = conn.cursor()
    cur.execute('UPDATE users SET email = %s WHERE id = %s', (email, session['id']))
    conn.commit()
    return jsonify(**{'success':'Your email address has been updated!'})

@app.route('/map')
def map():
    return render_template('map.html', mapskey = config["api"]["googlemaps"] if config["api"]["googlemaps"] else "", id = session['id'] if 'id' in session else '', username = session['username'] if 'username' in session else '')

@app.route('/map/delete_package/<uuid>')
def deletepackage(uuid):
    # TODO: auth check here
    cur = conn.cursor()
    cur.execute('DELETE FROM packages WHERE id = %s', (uuid,))
    cur.execute('DELETE FROM steps WHERE id = %s', (uuid,))
    cur.execute('DELETE FROM access WHERE package = %s', (uuid,))
    conn.commit()
    return jsonify(**{'ackUUID':'[' + uuid + ']'})

@app.route('/map/rename_package/<uuid>/<name>')
def renamepackage(uuid, name):
    # TODO: auth check here
    cur = conn.cursor()
    cur.execute('UPDATE packages SET name = %s WHERE id = %s', (name, uuid))
    conn.commit()
    return jsonify(**{'ackUUID':'[' + uuid + ']'})

@app.route('/login', methods=["POST"])
def login():
    if not 'username' in request.form or not 'password' in request.form:
        return jsonify(**{'error':'No data sent to server!'})
    username = request.form['username']
    password = request.form['password']
    cur = conn.cursor()
    cur.execute('SELECT id, password, username, type FROM users WHERE username = %s OR email = %s LIMIT 1', (username,username))
    if cur.rowcount == 0:
        return jsonify(**{'error':'No account exists with that username or email!'})
    row = cur.fetchone()
    if not check_password_hash(row[1], password):
        return jsonify(**{'error':'Wrong password!'})
    session['id'] = row[0]
    session['username'] = row[2]
    session['type'] = row[3]
    return jsonify(**{'redirect':'/map'})

@app.route('/getpackage/<uuid>')
def getexistingpackage(uuid):
    # TODO: auth check here
    cur = conn.cursor()
    cur.execute('SELECT pos,ele FROM steps WHERE id = %s ORDER BY time DESC', (uuid,))
    return jsonify(**{'data':[[d for d in x[0][1:-1].split(",")] + [x[1]] for x in cur]})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/getpackages')
def getexistingdata():
    cur = conn.cursor()
    if 'id' in session:
        if session['type'] > 0:
            cur.execute('SELECT id,name,delivered,destination FROM packages')
        else:
            cur.execute('SELECT id,name.delivered,destination FROM packages WHERE EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND (access.userid = %s or access.userid < 0))', (session['id'],))
    else:
        cur.execute('SELECT id,name,delivered,destination FROM packages WHERE EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND access.userid < 0)')
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
    cur.execute('INSERT INTO access (userid, package) VALUES (-1, %s)',(uuid,))
    conn.commit()
    # TODO: auth check here
    socketio.emit('newpackage', {'name':name,'uuid':uuid,'dest':[dLat,dLon]})
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

import re

uuidpattern = re.compile("^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$")

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    if not uuid:
        return jsonify(**{"error":"No UUID parameter passed to server!"})
    if not uuidpattern.match(uuid):
        print 'Warning: Received invalid UUID ' + uuid
        return jsonify(**{"error":"Invalid UUID!"})
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
        # TODO: auth check here
        socketio.emit('plot', {'uuid':uuid,'lat':lat,'lon':lon,'ele':ele})
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

if __name__ == '__main__':
    socketio.run(app, port=8080, debug=True)

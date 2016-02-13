#!/usr/bin/env python

import json
from flask import Flask, request, render_template, jsonify, session, redirect, abort, Response
from flask_socketio import SocketIO, join_room, leave_room

from werkzeug.security import generate_password_hash, check_password_hash

from time import time

import psycopg2

app = Flask(__name__, static_url_path='')
socketio = SocketIO(app)

with open('config.json') as data:
    config = json.load(data)

def save_config(config):
    with open('config.json', 'w') as data:
        data.write(json.dumps(config, indent=4, sort_keys=True))

app.secret_key = config['flasksecret']
conn = psycopg2.connect("dbname='" + config["database"]["dbname"] + "' user='" + config["database"]["user"] + "' host='" + config["database"]["host"] + "' password='" + config["database"]["pass"] + "'")

@app.context_processor
def inject_user_data():
    return dict(logged_in='id' in session, is_admin=session['type'] > 0 if 'type' in session else False, allow_register=config["allow_registration"])

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(403)
def forbidden(e):
    return render_template('403.html'), 403

@app.route('/')
def root():
    if 'id' in session:
        return redirect('/map')
    return render_template('index.html')

@app.route('/about')
def about():
    with open('credits.json') as data:
        return render_template('about.html', credits=json.load(data))

import urllib2

failed_requests = 0
failed_time = -1

def geocode(latlng):
    """ Return a tuple with a boolean indicating success as the first value and an address or error message as the second value. """
    if failed_time > 0:
        if time() - failed_time < 86400:
            return (False, 'OVER_QUERY_LIMIT')
        else:
            failed_requests = 0
            failed_time = -1
    url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng={0}&key={1}'
    request = url.format(latlng, config["api"]["googlemaps_server"])
    data = json.loads(urllib2.urlopen(request).read())
    if data['status'] == 'REQUEST_DENIED':
        print '--- Google Maps Geocoding API'
        print data['error_message']
        print '--- End Google Maps Geocoding API'
        return (False, 'REQUEST_DENIED')
    if data['status'] == 'OVER_QUERY_LIMIT':
        failed_requests += 1
        if failed_requests > 10:
            failed_time = time()
        print 'Warning: Google Maps Geocoding API query limit exceeded!'
        return (False, 'OVER_QUERY_LIMIT')
    failed_requests = 0
    if data['status'] == 'ZERO_RESULTS':
        return (False, 'ZERO_RESULTS')
    if len(data['results']) > 0:
        return (True, data['results'][0]['formatted_address'])
    return (False, 'ZERO_RESULTS')

@app.route('/packageaddress/<uuid>')
def package_address(uuid):
    if not config["api"]["googlemaps_server"]:
        return jsonify(**{'status':'disabled'})
    cur = conn.cursor()
    cur.execute('SELECT lat, lng, address FROM packages WHERE id = %s', (uuid,))
    conn.commit()
    if cur.rowcount == 0:
        return jsonify(**{'status':'empty'})
    row = cur.fetchone()
    if row[2]:
        if row[2] == 'ZERO_RESULTS':
            return jsonify(**{'status':'empty'})
        return jsonify(**{'location':row[2]})
    worked, loc = geocode(str(row[0]) + "," + str(row[1]))
    if not worked:
        if loc == 'ZERO_RESULTS':
            cur.execute('UPDATE PACKAGES SET address = %s WHERE id = %s', ('ZERO_RESULTS', uuid))
            conn.commit()
            return jsonify(**{'status':'empty'})
        return jsonify(**{'status':'pending'})
    cur.execute('UPDATE packages SET address = %s WHERE id = %s', (loc, uuid))
    conn.commit()
    return jsonify(**{'location':loc})

def getemail(usrid):
    """ Return the email of an user given a user id, or a blank string on error. """
    cur = conn.cursor()
    cur.execute('SELECT email FROM users WHERE id = %s', (usrid,))
    if cur.rowcount == 0:
        return ""
    row = cur.fetchone()
    conn.commit()
    return row[0] if not row[0] == None else ""

@app.route('/register')
def register():
    if not config["allow_registration"]:
        return abort(403)
    if 'id' in session:
        return redirect('/')
    return render_template('register.html')

@app.route('/register', methods=['POST'])
def register_submit():
    if not config["allow_registration"]:
        return abort(403)
    username = request.form['username']
    email = request.form['email']
    password = request.form['password']
    confirm = request.form['confirmpassword']
    if len(username) == 0 or len(email) == 0 or len(password) == 0:
        return jsonify(**{'error':'Please fill out all of the fields!'})
    if len(password) < 4:
        return jsonify(**{'error':'Please pick a longer password!'})
    if confirm != password:
        return jsonify(**{'error':'Password does not match confirm!'})
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO users (username, email, password, type) VALUES (%s, %s, %s, 0)',(username,email,generate_password_hash(password)))
    except psycopg2.IntegrityError, e:
        conn.rollback()
        return jsonify(**{'error':'Username is already taken!'})
    conn.commit()
    return jsonify(**{'success':'Account created! Redirecting to login page...', 'delayed_redirect':'/'})

@app.route('/settings')
def settings():
    if not 'id' in session:
        return render_template('settings.html')
    return render_template('settings.html', email = getemail(session['id']).replace('"', '\\"'), username = session['username'], type = 'Administrator' if session['type'] > 0 else 'Normal User', allow_deletion = config['allow_deletion'])

@app.route('/global_settings')
def global_settings():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    return render_template('global_settings.html', config = config)

@app.route('/global_settings/reset', methods=['POST'])
def global_settings_reset():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    password = request.form['password']
    cur = conn.cursor()
    cur.execute('SELECT password FROM users WHERE id = %s', (session['id'],))
    if cur.rowcount == 0:
        return jsonify(**{'error':'Your account does not exist anymore!'})
    row = cur.fetchone()
    if not check_password_hash(row[0], password):
        return jsonify(**{'error':'Wrong password!'})
    cur.execute('TRUNCATE TABLE packages, access, steps')
    conn.commit()
    socketio.emit('refresh')
    return jsonify(**{'success':'All package records deleted!'})

@app.route('/accounts')
def accounts():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    return render_template('accounts.html')

@app.route('/accounts/userdata')
def user_data():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    cur = conn.cursor()
    cur.execute('SELECT id, username, email, type FROM users')
    conn.commit()
    return jsonify(**{"data":[{'id':x[0],'username':x[1],'email':x[2],'type':x[3]} for x in cur]})

@app.route('/accounts/permissions/<ids>')
def admin_permissions_load(ids):
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    userid = [int(x.strip()) for x in ids.split(',')]
    cur = conn.cursor()
    cur.execute('SELECT package,(userid < 0),id FROM access WHERE userid IN %s OR userid < 0 ORDER BY userid DESC', (tuple(userid),))
    conn.commit()
    return jsonify(**{"packages":[x for x in cur]})

@app.route('/accounts/permissions/add', methods=['POST'])
def admin_permissions_add():
    userids = [int(x.strip()) for x in request.form['id'].split(',')]
    uuid = request.form['uuid']
    if not uuidpattern.match(uuid):
        return jsonify(**{'error':'The UUID you entered is not in the correct format!'})
    is_global = request.form['type'] == 'global'
    if is_global:
        userids = [-1]
    cur = conn.cursor()
    row = []
    fails = 0
    for userid in userids:
        try:
            cur.execute('INSERT INTO access (package, userid) VALUES (%s, %s) RETURNING id', (uuid, userid))
            row.append(cur.fetchone())
            conn.commit()
        except psycopg2.IntegrityError:
            conn.rollback()
            if len(userids) == 1:
                return jsonify(**{'error':'A permission pair already exists with that user and package combination!'})
            fails += 1
    return jsonify(**{'success':'Package permission(s) added!' if fails == 0 else str(len(userids)) + '/' + str(len(userids)-fails) + ' package permissions added!','id':row[0][0] if len(row) == 1 else [x[0] for x in row]})

@app.route('/accounts/permissions/remove/<ids>')
def admin_permissions_remove(ids):
    ids = [int(x.strip()) for x in ids.split(',')]
    cur = conn.cursor()
    cur.execute('DELETE FROM access WHERE id IN %s', (tuple(ids),))
    conn.commit()
    return jsonify(**{'success':'Package permission deleted!'})

@app.route('/accounts/delete', methods=['POST'])
def admin_delete_account():
    ids = [int(x) for x in request.form['id'].split(',')]
    cur = conn.cursor()
    for x in ids:
        cur.execute('DELETE FROM users WHERE id = %s', (x,))
        cur.execute('DELETE FROM access WHERE userid = %s', (x,))
    conn.commit()
    return jsonify(**{'success':str(len(ids)) + ' account(s) deleted!'})

@app.route('/accounts/modify', methods=['POST'])
def admin_modify_account():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    userid = request.form['id']
    username = request.form['username']
    if len(username) == 0:
        return jsonify(**{'error':'You must enter a username!'})
    email = request.form['email']
    acc_type = int(request.form['type'])
    cur = conn.cursor()
    cur.execute('UPDATE users SET username = %s, email = %s, type = %s WHERE id = %s', (username, email, acc_type, userid))
    if 'password' in request.form and len(request.form['password']) > 0:
        cur.execute('UPDATE users SET password = %s WHERE id = %s', (generate_password_hash(request.form['password']), userid))
    conn.commit()
    return jsonify(**{'success':'Account modified!'})

@app.route('/accounts/add', methods=['POST'])
def admin_add_account():
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0:
        return abort(403)
    username = request.form['username']
    if len(username) == 0:
        return jsonify(**{'error':'Please enter a username for the new account!'})
    email = request.form['email'] if 'email' in request.form else ''
    password = request.form['password'] if 'password' in request.form else ''
    acc_type = int(request.form['type'])
    cur = conn.cursor()
    try:
        cur.execute('INSERT INTO users (username, email, password, type) VALUES (%s, %s, %s, %s)',(username,email,generate_password_hash(password),acc_type))
    except psycopg2.IntegrityError, e:
        conn.rollback()
        return jsonify(**{'error':'Account exists with that username!'})
    conn.commit()
    if len(password) > 0:
        return jsonify(**{'success':'New account created!'})
    return jsonify(**{'warning':'New account created! You will need to set a password for this account before logging in.'})

@app.route('/settings/change_password', methods=['POST'])
def changepassword():
    if not 'id' in session:
        return redirect('/')
    old = request.form['password']
    new = request.form['newpassword']
    confirm = request.form['confirmpassword']
    if len(new) == 0:
        return jsonify(**{'error':'Please enter a new password!'})
    if len(new) < 4:
        return jsonify(**{'error':'Please pick a longer password!'})
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
def delete_account():
    if not 'id' in session:
        return redirect('/')
    if not config['allow_deletion']:
        return abort(403)
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
    return jsonify(**{'success':'Your account has been deleted!','delayed_redirect':'/'})

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
    if 'id' in session:
        type = session['type']
    else:
        type = -1
    return render_template('map.html', mapskey = config["api"]["googlemaps_client"] if config["api"]["googlemaps_client"] else "", id = session['id'] if 'id' in session else '', username = session['username'] if 'username' in session else '', can_edit = config["allow_user_edit"])

@app.route('/map/delete_package/<uuid>')
def deletepackage(uuid):
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0 and not config["allow_user_edit"]:
        return jsonify(**{'error':'Access denied!'})
    cur = conn.cursor()
    if session['type'] == 0:
        cur.execute('SELECT COUNT(*) FROM access WHERE package = %s AND userid = %s', (uuid,session['id']))
        result = cur.fetchone()
        if result[0] == 0:
            return jsonify(**{'error':'Access denied!'})
    cur.execute('DELETE FROM packages WHERE id = %s', (uuid,))
    cur.execute('DELETE FROM steps WHERE id = %s', (uuid,))
    cur.execute('DELETE FROM access WHERE package = %s', (uuid,))
    conn.commit()
    socketio.emit('deletepackage', {'uuid':uuid}, room='admin')
    socketio.emit('deletepackage', {'uuid':uuid}, room=uuid)
    return jsonify(**{'ackUUID':'[' + uuid + ']'})

@app.route('/map/rename_package/<uuid>', methods=["POST"])
def renamepackage(uuid):
    if not 'id' in session:
        return redirect('/')
    if session['type'] == 0 and not config["allow_user_edit"]:
        return jsonify(**{'error':'Access denied!'})
    name = request.form["name"]
    if len(name) == 0:
        return jsonify(**{'error':'You must enter a name for this package!'})
    cur = conn.cursor()
    if session['type'] == 0:
        cur.execute('SELECT COUNT(*) FROM access WHERE package = %s AND userid = %s', (uuid,session['id']))
        result = cur.fetchone()
        if result[0] == 0:
            return jsonify(**{'error':'Access denied!'})
    cur.execute('UPDATE packages SET name = %s WHERE id = %s', (name, uuid))
    conn.commit()
    socketio.emit('renamepackage', {'uuid':uuid,'name':name}, room='admin')
    socketio.emit('renamepackage', {'uuid':uuid,'name':name}, room=uuid)
    return jsonify(**{'ackUUID':'[' + uuid + ']'})

@app.route('/login', methods=["POST"])
def login():
    if not 'username' in request.form or not 'password' in request.form:
        return jsonify(**{'error':'No data sent to server!'})
    username = request.form['username']
    password = request.form['password']
    cur = conn.cursor()
    cur.execute('SELECT id, password, username, type FROM users WHERE username = %s OR email = %s LIMIT 1', (username,username))
    conn.commit()
    if cur.rowcount == 0:
        return jsonify(**{'error':'No account exists with that username or email!'})
    row = cur.fetchone()
    if not check_password_hash(row[1], password):
        return jsonify(**{'error':'Wrong password!'})
    session['id'] = row[0]
    session['username'] = row[2]
    session['type'] = row[3]
    session['access'] = []
    return jsonify(**{'redirect':'/map'})

@app.route('/getpackage/<uuid>')
def getexistingpackage(uuid):
    if not uuidpattern.match(uuid):
        return jsonify(**{'error':'Invalid UUID format!'})
    if not checkaccess(uuid):
        return abort(403)
    cur = conn.cursor()
    cur.execute('SELECT lat, lng, ele, time FROM steps WHERE id = %s ORDER BY time', (uuid,))
    return jsonify(**{'data':[x for x in cur]})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

globalaccess = []

def checkaccess(uuid):
    """ Returns true or false depending on if the user can access the package. refreshaccess MUST be called before using this method. """
    if 'id' in session:
        if session['type'] > 0:
            return True
        if uuid in session['access']:
            return True
    if uuid in globalaccess:
        return True
    return False

def refreshaccess():
    """ Caches the UUID of all public packages to minimize database lookup. """
    global globalaccess
    cur = conn.cursor()
    if 'id' in session:
        cur.execute('SELECT package FROM access WHERE userid = %s', (session['id'],))
        session['access'] = [x[0] for x in cur]
    cur.execute('SELECT package FROM access WHERE userid < 0')
    globalaccess = [x[0] for x in cur]

@app.route('/getpackages')
def getexistingdata():
    refreshaccess()
    cur = conn.cursor()
    if 'id' in session:
        if session['type'] > 0:
            cur.execute('SELECT id,name,delivered,lat,lng,1 FROM packages ORDER BY name')
        else:
            cur.execute('(SELECT id,name,delivered,lat,lng,1 FROM packages WHERE EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND access.userid = %s)) UNION (SELECT id,name,delivered,lat,lng,0 FROM packages WHERE EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND access.userid < 0) AND NOT EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND access.userid = %s)) ORDER BY name', (session['id'],session['id']))
            conn.commit()
            return jsonify(**{'data':[x for x in cur]})
    else:
        cur.execute('SELECT id,name,delivered,lat,lng,0 FROM packages WHERE EXISTS (SELECT 1 FROM access WHERE packages.id = access.package AND access.userid < 0) ORDER BY name')
    conn.commit()
    return jsonify(**{'data':[x for x in cur]})

@app.route('/tracknewpackage')
def tracknewpackage():
    name = request.args.get('name')
    if not name:
        name = 'Unnamed Package'
    uuid = request.args.get('uuid')
    if not uuid:
        return jsonify(**{"error":"NO_UUID"})
    if not uuidpattern.match(uuid):
        return jsonify(**{"error":"INVALID_UUID"})
    dLat = request.args.get('destinationLat')
    if not dLat:
        return jsonify(**{"error":"NO_LATITUDE"})
    dLat = float(dLat)
    dLon = request.args.get('destinationLon')
    if not dLon:
        return jsonify(**{"error":"NO_LONGITUDE"})
    dLon = float(dLon)
    cur = conn.cursor()
    cur.execute('INSERT INTO packages (id, name, lat, lng, delivered) VALUES (%s, %s, %s, %s, false)', (uuid, name, dLat, dLon))
    if config["new_package_public"]:
        cur.execute('INSERT INTO access (userid, package) VALUES (-1, %s)',(uuid,))
        for client in clients:
            socketio.server.enter_room(client, uuid, namespace='/')
    conn.commit()
    socketio.emit('newpackage', {'name':name,'uuid':uuid,'dest':[dLat,dLon],'global':config['new_package_public']}, room='admin')
    socketio.emit('newpackage', {'name':name,'uuid':uuid,'dest':[dLat,dLon],'global':config['new_package_public']}, room=uuid)
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

import re

uuidpattern = re.compile("^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$")

import datetime

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    if not uuid:
        return jsonify(**{"error":"NO_UUID"})
    if not uuidpattern.match(uuid):
        return jsonify(**{"error":"INVALID_UUID"})
    content = request.get_json()
    if "delivered" in content:
        cur = conn.cursor()
        cur.execute('UPDATE packages SET delivered = true WHERE id = %s', (uuid,))
        conn.commit()
        socketio.emit('packagedelivered', {'uuid':uuid}, room='admin')
        socketio.emit('packagedelivered', {'uuid':uuid}, room=uuid)
    else:
        if not 'lat' in content:
            return jsonify(**{"error":"NO_LATITUDE"})
        lat = float(content['lat'])
        if not 'lon' in content:
            return jsonify(**{"error":"NO_LONGITUDE"})
        lon = float(content['lon'])
        ele = float(content['ele'] if 'ele' in content else '0')
        if not 'time' in content:
            time = datetime.datetime.now().isoformat()
        else:
            time = content['time']
        cur = conn.cursor()
        cur.execute('INSERT INTO steps (id, lat, lng, ele, time) VALUES (%s, %s, %s, %s, %s)', (uuid, lat, lon, ele, time))
        conn.commit()
        socketio.emit('plot', {'uuid':uuid,'lat':lat,'lon':lon,'ele':ele,'time':time}, room='admin')
        socketio.emit('plot', {'uuid':uuid,'lat':lat,'lon':lon,'ele':ele,'time':time}, room=uuid)
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

clients = []

@socketio.on('connect')
def client_connect():
    cur = conn.cursor()
    flag = True
    if 'id' in session:
        if session['type'] > 0:
            join_room('admin')
            flag = False
        else:
            cur.execute('SELECT package FROM access WHERE userid = %s OR userid < 0', (session['id'],))
    else:
        cur.execute('SELECT package FROM access WHERE userid < 0')
    if flag:
        clients.append(request.sid)
        for x in cur:
            join_room(x[0])

@socketio.on('disconnect')
def client_disconnect():
    try:
        clients.remove(request.sid)
    except ValueError:
        pass

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)

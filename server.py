#!/usr/bin/env python

from flask import Flask, request, render_template, jsonify

app = Flask(__name__, static_url_path='')

@app.route('/')
def root():
    return render_template('index.html')

@app.route('/tracknewpackage')
def tracknewpackage():
    name = request.args.get('name')
    uuid = request.args.get('uuid')
    destinationLat = request.args.get('destinationLat')
    destinationLon = request.args.get('destinationLon')
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

@app.route('/packagetrackupdate/<uuid>', methods=['POST'])
def packagetrackupdate(uuid):
    if "delivered" in request.args:
        pass
    else:
        pass
    return jsonify(**{"ackUUID":"[" + uuid + "]"})

if __name__ == '__main__':
    app.run(threaded=True, port=8080, debug=True)

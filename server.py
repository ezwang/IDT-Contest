#!/usr/bin/env python

from flask import Flask, request

app = Flask(__name__, static_url_path='')

@app.route('/')
def root():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(threaded=True, port=8080, debug=True)

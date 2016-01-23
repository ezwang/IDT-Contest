#!/bin/bash

echo '''Package Manager
TJHSST Team 1
Install Script

This script has been tested on Ubuntu 14.04 LTS and should work for Debian based systems.
You may be prompted for root access during the installation process.
'''

pip -h > /dev/null 2>&1 || sudo apt-get install python-pip
if ! dpkg --get-selections | grep -q "^libpq-dev[[:space:]]*install$" >/dev/null; then
    sudo apt-get install libpq-dev python-dev
fi
pip install virtualenv
virtualenv venv
source venv/bin/activate
pip install -r requirements.txt
# TODO: install postgresql server
# TODO: edit config.json
# TODO: setup database
# TODO: add handler for server to start on boot

#!/bin/bash

echo '''Package Manager
TJHSST Team 1
Install Script

This script has been tested on Ubuntu 14.04 LTS.
This script should work for Debian based systems.
You may be prompted for root access during the installation process.
'''

if ! type "apt-get" > /dev/null; then
    echo 'WARNING: You are not using the apt-get package manager!'
    echo 'Some parts of this script require the package manager.'
    echo 'You may have to use the manual install process.'
    echo
fi

echo 'Checking for pip...'
pip -h > /dev/null 2>&1 || sudo apt-get install python-pip || { echo 'Could not install pip!'; exit 1; }
if ! type "dpkg" > /dev/null; then
    echo 'WARNING: You may need to manually install the database drivers for your operating system.'
    echo 'In Debian based systems, the package is called libpq-dev.'
    echo 'Press the [ENTER] key after you have installed the necessary postgresql drivers.'
    read -p "$*"
else
    if ! dpkg --get-selections | grep -q "^libpq-dev[[:space:]]*install$" >/dev/null; then
        echo 'Installing database drivers...'
        sudo apt-get install libpq-dev python-dev || { echo 'Unable to install postgresql drivers!'; exit 1; }
    fi
fi
pip -q install virtualenv
if [ ! -d "venv" ]; then
    echo 'Creating virtual environment...'
    virtualenv venv || { echo 'Failed to create virtual environment!'; exit 1; }
fi
echo 'Entering virtual environment..'
source venv/bin/activate || { echo 'Failed to enter virtual environment!'; exit 1; }
pip -q install -r requirements.txt
read -p "Do you already have a postgresql database? [y/N] " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo 'Installing postgresql database...'
    sudo apt-get install postgresql postgresql-contrib || { echo 'Failed to install the postgresql database!'; exit 1; }
    # TODO: configure postgresql server
    python setup_helper.py || exit 1
else
    python setup_helper.py prompt || exit 1
fi
echo 'Installing server handler...'
# TODO: add handler for server to start on boot
echo 'Installation completed!'
echo 'Opening user manual page...'
xdg-open http://localhost:8080/about &>/dev/null

#!/bin/bash

echo '''
+============================+
| Package Manager            |
| TJHSST Team 1              |
| Install Script             |
+============================+

[*] This script has been tested on Ubuntu 14.04 LTS.
[*] This script should work for Debian based systems.
[*] You may be prompted for root access during the installation process.
'''

if ! type "apt-get" > /dev/null; then
    echo '[!] WARNING: You are not using the apt-get package manager!'
    echo '[!] Some parts of this script require the package manager.'
    echo '[!] You may have to use the manual install process.'
    echo
fi

echo '[*] Checking for pip...'
pip -h > /dev/null 2>&1 || sudo apt-get install python-pip || { echo '[!] Could not install pip!'; exit 1; }
if ! type "dpkg" > /dev/null; then
    echo '[!] WARNING: You may need to manually install the database drivers for your operating system.'
    echo '[!] In Debian based systems, the package is called libpq-dev.'
    echo '[!] Press the [ENTER] key after you have installed the necessary postgresql drivers.'
    read -p "$*"
else
    if ! dpkg --get-selections | grep -q "^libpq-dev[[:space:]]*install$" >/dev/null; then
        echo '[*] Installing database drivers...'
        sudo apt-get install -y libpq-dev python-dev || { echo '[!] Unable to install postgresql drivers!'; exit 1; }
    fi
fi
pip -q install virtualenv
if [ ! -d "venv" ]; then
    echo '[*] Creating virtual environment...'
    virtualenv venv || { echo '[!] Failed to create virtual environment!'; exit 1; }
fi
echo '[*] Entering virtual environment..'
source venv/bin/activate || { echo '[!] Failed to enter virtual environment!'; exit 1; }
pip -q install -r requirements.txt || { echo '[!] Failed to install pip packages!'; exit 1; }
echo '[*] If you do not already have a database set up, this script can install one for you.'
read -p "[*] Do you want this script to install a postgresql database for you? [Y/n] " -r
if [[ ! $REPLY =~ ^[Nn]$ ]]
then
    echo '[*] Installing postgresql database...'
    sudo apt-get install -y postgresql postgresql-contrib || { echo 'Failed to install the postgresql database!'; exit 1; }
    echo '[*] Creating user account and database...'
    echo '[*] You will be prompted to enter a new password for the postgresql user account.'
    echo '[*] Remember the password you enter; you will be prompted for it again later.'
    PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    while true; do
        sudo -u postgres createuser -D -A "pmuser" && break
        echo '[!] Error while creating new user!'
        echo '[*] This issue may be caused by another user with the same name in the database.'
        echo '[*] Attempting to delete old user...'
        sudo -u postgres dropdb "pmdb" && echo '[*] Old database deleted...'
        sudo -u postgres dropuser "pmuser" || { echo '[!] Failed to delete user!'; exit 1; }
        echo '[*] User deleted, attempting to create account again...'
    done
    echo '[*] Attempting to set password for new user...'
    sudo -u postgres psql -c "ALTER USER pmuser WITH PASSWORD '$PASS';"
    sudo -u postgres createdb -O "pmuser" "pmdb" || { echo '[!] Failed to create database!'; exit 1; }
    echo '[*] You must update the postgresql configuration to allow for password based authentication.'
    echo '[*] Add the following line in your pg_hba.conf or postgresql.conf (depends on version of postgresql installed).'
    echo '[*] If both files exist, edit the pg_hba.conf file.'
    echo '[*] This file is usually located in /etc/postgresql/<version>/main folder.'
    echo
    echo 'host all all 127.0.0.1/32 password'
    echo
    echo '[*] After you have added this line, press the [Enter] key.'
    read -p "$*"
    echo '[*] Restarting postgres server...'
    sudo /etc/init.d/postgresql restart || { echo '[!] Failed to restart server. You may have to do this manually. Press [Enter] when you are finished.'; read -p "$*"; }
    python setup_helper.py created $PASS || exit 1
else
    python setup_helper.py prompt || exit 1
fi
echo '[*] Installing server handler...'
# TODO: add handler for server to start on boot
./server.py & # temporary
echo '[*] Installation completed!'
echo '[*] Opening user manual page...'
xdg-open http://localhost:8080/about &>/dev/null

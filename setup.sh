#!/bin/bash

echo '''
+============================+
| Package Manager            |
| TJHSST Team 1              |
| Install Script             |
+============================+

[*] This script has been tested on Ubuntu 14.04 LTS and Debian 8.3.
[*] This script should work for most Debian based systems.
'''

if [[ $EUID -ne 0 ]]; then
    echo '[*] You may be prompted for root access during the installation process.'
    echo
fi

if ! type "apt-get" > /dev/null; then
    echo '[!] WARNING: You are not using the apt-get package manager!'
    echo '[!] Some parts of this script require the package manager.'
    echo '[!] You may have to use the manual install process.'
    echo
fi

echo '[*] Checking for pip...'
pip -h > /dev/null 2>&1 || sudo apt-get install -y python-pip || { echo '[!] Could not install pip!'; exit 1; }
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
    PASS=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    # TODO: check if user exists before attempting to create user
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
    sudo -u postgres psql -c "ALTER USER pmuser WITH PASSWORD '$PASS';" || { echo '[!] Failed to set password for new user!'; exit 1; }
    sudo -u postgres createdb -O "pmuser" "pmdb" || { echo '[!] Failed to create database!'; exit 1; }
    PG_HBA_PATH=$(sudo -u postgres psql -t -P format=unaligned -c 'show hba_file')
    if [ -n "$PG_HBA_PATH" ] && sudo grep -q -P '^host[ \t]+all[ \t]+all[ \t]+127\.0\.0\.1\/32[ \t]+(md5|password)[ \t]?$' "$PG_HBA_PATH"; then
        echo '[*] pg_hba.conf already configured, skipping...'
    else
        echo '[*] This script will attempt to update the postgresql configuration to allow for password based authentication.'
        echo '[*] It will add the following line in your pg_hba.conf.'
        echo "[*] The file is located at $PG_HBA_PATH."
        echo
        echo 'host all all 127.0.0.1/32 md5'
        echo
        echo "host\tall\tall\t127.0.0.1/32\tmd5" | sudo tee -a $PG_HBA_PATH
        echo '[*] Line added!'
        echo '[*] Restarting postgres server...'
        sudo /etc/init.d/postgresql restart || { echo '[!] Failed to restart server. You may have to do this manually. Press [Enter] when you are finished.'; read -p "$*"; }
    fi
    python setup_helper.py created $PASS || exit 1
else
    python setup_helper.py prompt || exit 1
fi

echo '[*] Copying files to /opt...'
if [ -d "/opt/packagemanager" ]; then
    echo '[*] Old installation exists, deleting...'
    sudo rm -rf /opt/packagemanager || echo '[!] Warning: Failed to delete old installation.'
fi
sudo mkdir /opt/packagemanager || { echo '[!] Failed to create directory in opt!'; exit 1; }
sudo cp -R . /opt/packagemanager || { echo '[!] Failed to copy files into new directory!'; exit 1; }

echo '[*] Application has been installed to /opt/packagemanager!'

echo '[*] Installing server handler...'
echo '[*] This process will start Package Manager when the server boots.'

if sudo bash -c 'type "initctl" > /dev/null 2>&1'; then
    echo '[*] Upstart detected, registering service...'
    sudo cp packagemanager.conf /etc/init/packagemanager.conf
    sudo start packagemanager
elif sudo bash -c 'type "update-rc.d" > /dev/null 2>&1'; then
    echo '[*] Adding script to init.d and creating startup links...'
    sudo cp packagemanager /etc/init.d/packagemanager
    sudo chmod +x /etc/init.d/packagemanager
    sudo update-rc.d packagemanager defaults
    sudo /etc/init.d/packagemanager start
else
    echo '[*] No service manager detected, running server...'
    echo '[!] You will need to manually register run.sh to execute on boot.'
    /opt/packagemanager/run.sh &
fi

echo '[*] Installation completed!'
echo '[*] Opening user manual page...'
xdg-open http://localhost:8080/about &>/dev/null

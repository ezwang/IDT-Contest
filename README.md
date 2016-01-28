# IDT Contest Submission
Contest submission for TJHSST Team 1

## Installation
You will need a Linux based operating system to install and run the server.
We recommend [Ubuntu 14.04 LTS](http://www.ubuntu.com/download/desktop).
If you do not want to replace your operating system or dual boot, you can use [VirtualBox](https://www.virtualbox.org/wiki/Downloads) to create a virtual machine.

You need to have git installed in order to use git clone.
Make sure you have the sudo command and Python 2 installed before following the steps below.
### Automatic Install
To install our solution, simply run the commands:
```bash
git clone https://github.com/ezwang/IDT-Contest
cd IDT-Contest
./setup.sh
```
The setup script has been tested on Ubuntu 14.04 LTS and Debian 8.3.
You will need root privileges for some parts of the script.
If the script does not work for you, use the manual installation process.
### Manual Install
The `apt-get` command only exists on Debian based distributions.
The command will be different for other Linux distributions.

Clone this repository and change directory to the IDT-Contest folder.
```sh
git clone https://github.com/ezwang/IDT-Contest
cd IDT-Contest
```

You will need pip to install python libraries. To install pip, run the following command:
```sh
sudo apt-get install python-pip
```

You will need to install database drivers to communicate with the postgresql database.
```sh
sudo apt-get install libpq-dev python-dev
```

We will install virtualenv so we can create virtual environments.
```sh
pip install virtualenv
```

We will create a virtual environment to avoid tampering with your existing configuration.
```sh
virtualenv venv
source venv/bin/activate
```

Install all of the requirements in `requirements.txt`:
```sh
pip install -r requirements.txt
```
#### Installing a PostgreSQL server
If you do not have a PostgreSQL server already configured, follow the steps below to install one. Otherwise, skip past this section.

To install PostgreSQL, run the following commands:
```sh
sudo apt-get install postgresql postgresql-contrib
```

You will need to create a new user and database using the following commands:
```sh
sudo -u postgres createuser -D -A -P "pmuser"
sudo -u postgres createdb -O "pmuser" "pmdb"
```
You will be prompted for a password for the new user. Make sure you remember this password, you will need to use it later.

By default, you will not be able to login using password authentication. Add the following line to your `pg\_hba.conf` file.
```
host all all 127.0.0.1/32 md5
```

If you do not know where your `pg\_hba.conf` file is located, run the following command:
```sh
sudo -u postgres psql -t -P format=unaligned -c 'show hba_file'
```

After you have enabled password authentication, restart the database server.
```sh
sudo /etc/init.d/postgresql restart
```
#### Configuring the application
At this point, you can run the following command to configure the application:
```sh
python setup_helper.py prompt
```
If you followed the steps to setup a database above, the the database name is `pmdb`, the username is `pmuser`, the host is `localhost`.

Use the command below to run the server:
```sh
./run.sh
```
**Thats it!** Go to [http://localhost:8080/about](http://localhost:8080/about) and you should see the user guide!
#### Additional Steps
- Enable or disable features in `config.json`
- Make the server start up on boot

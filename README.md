# IDT Contest Submission
Contest submission for TJHSST Team 1

## Installation
We recommend a Linux based operating system to install and run the server.
We recommend [Ubuntu 14.04 LTS](http://www.ubuntu.com/download/desktop).
If you do not want to replace your operating system or dual boot, you can use [VirtualBox](https://www.virtualbox.org/wiki/Downloads) to create a virtual machine.
You can also install the server on Windows and a guide is included below.

You need to have git installed in order to use git clone. Alternatively, you can download and unzip the project from the GitHub website.
Make sure you have the sudo command and Python 2 installed before following the steps for automatic installation.
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
### Manual Install (Linux)
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

Run the following command to install virtualenv so that you can create virtual environments.
```sh
pip install virtualenv
```

Run the following commands to create a virtual environment and install all required dependencies to avoid tampering with your existing configuration.
```sh
virtualenv venv
source venv/bin/activate
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
You will be prompted for a password for the new user. Make sure you remember this password; you will need to use it later.

By default, you will not be able to login using password authentication. Add the following line to the end of your `pg_hba.conf` file.
```
host all all 127.0.0.1/32 md5
```

If you do not know where your `pg_hba.conf` file is located, run the following command:
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
**Thats it!** Go to [http://localhost:8080/about](http://localhost:8080/about) from the server machine and you should see the user guide!

### Manual Install (Windows)

You can get the Python 2 installer [here](https://www.python.org/downloads/).
The installer will prompt you to add Python to the path environment variable. This guide will assume you have checked this box.
If you have multiple versions of Python installed, you will need to make sure the path to the Python executable points towards Python 2.
You will need [Microsoft Visual C++ 9.0](http://aka.ms/vcpython27) in order to build some of the dependencies.

If you have git installed, you can use the git clone command to download the software solution. You can also download the solution from the GitHub website.
```
git clone https://github.com/ezwang/IDT-Contest
cd IDT-Contest
```

Run the following commands to install virtualenv, setup a virtual environment, and install necessary dependencies:
```
pip install virtualenv
virtualenv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

You can install a PostgreSQL server using the graphical installer located [here](http://www.postgresql.org/download/windows/). You will need to edit `config.json` to enter your server location and credentials.

To run the server, execute the following command:
```
python server.py
```

**Thats it!** Go to [http://localhost:8080/about](http://localhost:8080/about) from the server machine and you should see the user guide!

#### Accessing from other machines
You can run the following command to get your IP address:
```sh
ifconfig
```
On a Windows operating system, open a command prompt window and run `ipconfig`.

Other machines on the same network can access the application by navigating to `http://(your ip address):8080/`.

If you have set up the server inside of a virtual machine, you will have to configure port forwarding.

#### Optional Steps
- Enable or disable features in `config.json`
- Move server files to a more permanant location
- Make the server start up on boot

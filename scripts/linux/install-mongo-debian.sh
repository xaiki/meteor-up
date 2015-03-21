#!/bin/bash

sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://repo.mongodb.org/apt/debian wheezy/mongodb-org/3.0 main' > mongodb.list
sudo mv mongodb.list /etc/apt/sources.list.d
sudo apt-get update -y
sudo apt-get install mongodb-org mongodb-org-server mongodb-org-shell mongodb-org-tools -y

# Restart mongodb
sudo stop mongod || :
sudo start mongod

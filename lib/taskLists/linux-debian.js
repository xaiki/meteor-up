var nodemiral = require('nodemiral');
var fs = require('fs');
var path = require('path');
var util = require('util');
var linux = require('./linux-common');

var system = {
  start: 'systemctl start',
  stop : 'systemctl stop'
}

var SCRIPT_DIR = path.resolve(__dirname, '../../scripts/linux');
var TEMPLATES_DIR = path.resolve(__dirname, '../../templates/linux');

exports.setup = function(config) {
  var taskList = nodemiral.taskList('Setup (linux-debian)');

  // Installation
  if(config.setupNode) {
    taskList.executeScript('Installing Node.js', {
      script: path.resolve(SCRIPT_DIR, 'install-node-debian.sh'),
      vars: {
        nodeVersion: config.nodeVersion
      }
    });
  }

  if(config.setupPhantom) {
    taskList.executeScript('Installing PhantomJS', {
      script: path.resolve(SCRIPT_DIR, 'install-phantomjs.sh')
    });
  }

  if(config.setupMongo) {
    taskList.copy('Copying MongoDB configuration', {
      src: path.resolve(TEMPLATES_DIR, 'mongodb.conf'),
      dest: '/etc/mongodb.conf'
    });

    taskList.executeScript('Installing MongoDB', {
      script: path.resolve(SCRIPT_DIR, 'install-mongodb-debian.sh')
    });
  }

  if(config.ssl) {
    linux.installStud(taskList);
    linux.configureStud(taskList, config.ssl.pem, config.ssl.backendPort);
  }

  configureSystemd(taskList, config);

  return taskList;
};

exports.deploy = function(bundlePath, env, deployCheckWaitTime, appName) {
  var taskList = nodemiral.taskList("Deploy app '" + appName + "' (linux-debian)");

  taskList.copy('Uploading bundle', {
    src: bundlePath,
    dest: '/opt/' + appName + '/tmp/bundle.tar.gz'
  });

  configureSystemd(taskList, {appName: appName, env: env});

  // deploying
  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'env.sh'),
    dest: '/opt/' + appName + '/config/env.sh',
    vars: {
      env: linux.patchEnv(env),
      appName: appName,
      system: system
    }
  });

  taskList.executeScript('Invoking deployment process', {
    script: path.resolve(TEMPLATES_DIR, 'deploy.sh'),
    vars: {
      deployCheckWaitTime: deployCheckWaitTime || 10,
      appName: appName
    }
  });

  return taskList;
};

exports.reconfig = function(env, appName) {
  var taskList = nodemiral.taskList("Updating configurations (linux-debian)");

  configureSystemd(taskList, {appName: appName, env: env});
  restartSystemd(taskList, appName);

  return taskList;
};

exports.restart = function(appName) {
  var taskList = nodemiral.taskList("Restarting Application (linux-debian)");

  restartSystemd (taskList, appName)

  return taskList;
};

exports.stop = function(appName) {
  var taskList = nodemiral.taskList("Stopping Application (linux-debian)");

  //stopping
  taskList.execute('Stopping app', {
    command: '(sudo systemctl stop ' + appName + ')'
  });

  return taskList;
};

exports.start = function(appName) {
  var taskList = nodemiral.taskList("Starting Application (linux-debian)");

  //starting
  taskList.execute('Starting app', {
    command: '(sudo systemctl start ' + appName + ')'
  });

  return taskList;
};

function restartSystemd (taskList, appName) {
//restarting
  taskList.execute('Restarting app', {
    command: '(sudo systemctl stop ' + appName + ' || :) && (sudo systemctl start ' + appName + ')'
  });
}

function configureSystemd(taskList, config) {
  var tmpService = '/opt/' + config.appName + '/tmp/' + config.appName + '.service';
  //Configurations
  taskList.copy('Configuring systemd', {
    src: path.resolve(TEMPLATES_DIR, 'systemd.conf'),
    dest: tmpService,
    vars: {
      appName: config.appName,
      env: linux.patchEnv (config.env, config.appName)
    }
  });

  //restarting
  taskList.execute('Enable Service', {
    command: 'sudo cp ' + tmpService + ' /etc/systemd/system/ && sudo systemctl enable ' + config.appName + '.service'
  });
}

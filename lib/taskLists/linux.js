var nodemiral = require('nodemiral');
var fs = require('fs');
var path = require('path');
var util = require('util');
var linux = require('./linux-common');

var system = {
  start: 'start',
  stop : 'stop'
}

var SCRIPT_DIR = path.resolve(__dirname, '../../scripts/linux');
var TEMPLATES_DIR = path.resolve(__dirname, '../../templates/linux');


exports.setup = function(config) {
  var taskList = nodemiral.taskList('Setup (linux)');

  // Installation
  if(config.setupNode) {
    taskList.executeScript('Installing Node.js', {
      script: path.resolve(SCRIPT_DIR, 'install-node.sh'),
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

  taskList.executeScript('Setting up Environment', {
    script: path.resolve(SCRIPT_DIR, 'setup-env.sh'),
    vars: {
      env: config.env,
      appName: config.appName,
      system: system
    }
  });

  if(config.setupMongo) {
    taskList.copy('Copying MongoDB configuration', {
      src: path.resolve(TEMPLATES_DIR, 'mongodb.conf'),
      dest: '/etc/mongodb.conf'
    });

    taskList.executeScript('Installing MongoDB', {
      script: path.resolve(SCRIPT_DIR, 'install-mongodb.sh')
    });
  }

  if(config.ssl) {
    linux.installStud(taskList);
    linux.configureStud(taskList, config.ssl.pem, config.ssl.backendPort);
  }

  //Configurations
  taskList.copy('Configuring upstart', {
    src: path.resolve(TEMPLATES_DIR, 'meteor.conf'),
    dest: '/etc/init/' + config.appName + '.conf',
    vars: {
      appName: config.appName
    }
  });

  return taskList;
};

exports.deploy = function(bundlePath, env, deployCheckWaitTime, appName) {
  var taskList = nodemiral.taskList("Deploy app '" + appName + "' (linux)");

  taskList.copy('Uploading bundle', {
    src: bundlePath,
    dest: '/opt/' + appName + '/tmp/bundle.tar.gz'
  });

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'env.sh'),
    dest: '/opt/' + appName + '/config/env.sh',
    vars: {
      env: env,
      appName: appName,
      system: system
    }
  });

  // deploying
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
  var taskList = nodemiral.taskList("Updating configurations (linux)");

  taskList.copy('Setting up Environment Variables', {
    src: path.resolve(TEMPLATES_DIR, 'env.sh'),
    dest: '/opt/' + appName + '/config/env.sh',
    vars: {
      env: env,
      appName: appName,
      system: system
    }
  });

  //restarting
  taskList.execute('Restarting app', {
    command: '(sudo stop ' + appName + ' || :) && (sudo start ' + appName + ')'
  });

  return taskList;
};

exports.restart = function(appName) {
  var taskList = nodemiral.taskList("Restarting Application (linux)");

  //restarting
  taskList.execute('Restarting app', {
    command: '(sudo stop ' + appName + ' || :) && (sudo start ' + appName + ')'
  });

  return taskList;
};

exports.stop = function(appName) {
  var taskList = nodemiral.taskList("Stopping Application (linux)");

  //stopping
  taskList.execute('Stopping app', {
    command: '(sudo stop ' + appName + ')'
  });

  return taskList;
};

exports.start = function(appName) {
  var taskList = nodemiral.taskList("Starting Application (linux)");

  //starting
  taskList.execute('Starting app', {
    command: '(sudo start ' + appName + ')'
  });

  return taskList;
};


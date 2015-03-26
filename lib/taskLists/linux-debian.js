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

  taskList.executeScript('Setting up Environment', {
    script: path.resolve(SCRIPT_DIR, 'setup-env.sh'),
    vars: {
      appName: config.appName
    }
  });

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
  var env = _.extend ({
    PORT:80,
    MONGO_URL: 'mongodb://127.0.0.1/' + config.appName,
    ROOT_URL: 'http://localhost'
  }, config.env);

  var tmpService = '/opt/' + config.appName + '/tmp/' + config.appName + '.service';
  //Configurations
  taskList.copy('Configuring systemd', {
    src: path.resolve(TEMPLATES_DIR, 'systemd.conf'),
    dest: tmpService,
    vars: {
      appName: config.appName,
      env: env
    }
  });

  //restarting
  taskList.execute('Enable Service', {
    command: 'sudo cp ' + tmpService + ' /etc/systemd/system/ && sudo systemctl enable ' + config.appName + '.service'
  });
}

function configureStud(taskList, pemFilePath, port) {
  var backend = {host: '127.0.0.1', port: port};

  taskList.copy('Configuring Stud for Upstart', {
    src: path.resolve(TEMPLATES_DIR, 'stud.init.conf'),
    dest: '/etc/init/stud.conf'
  });

  taskList.copy('Configuring SSL', {
    src: pemFilePath,
    dest: '/opt/stud/ssl.pem'
  });


  taskList.copy('Configuring Stud', {
    src: path.resolve(TEMPLATES_DIR, 'stud.conf'),
    dest: '/opt/stud/stud.conf',
    vars: {
      backend: util.format('[%s]:%d', backend.host, backend.port)
    }
  });

  taskList.execute('Verifying SSL Configurations (ssl.pem)', {
    command: 'stud --test --config=/opt/stud/stud.conf'
  });

  //restart stud
  taskList.execute('Strating Stud', {
    command: '(sudo systemctl stop stud || :) && (sudo systemctl start stud || :)'
  });
}



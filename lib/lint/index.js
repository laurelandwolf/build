var path = require('path');

var fs = require('fs-extra');
var _ = require('lodash');
var recursiveReadDir = require('recursive-readdir')
var format = require('chalk');
var timem = require('timem');
var async = require('async');
var CLIEngine = require("eslint").CLIEngine;
var chokidar = require('chokidar');
var notify = require('osx-notifier');

var ESLINT_CONFIG = require('./eslintrc');

module.exports = function startLint (options) {

  options = options || {};

  var eslintCli = new CLIEngine({
    configFile: __dirname + '/eslintrc.json'
  });

  var LINT_FILE_PATH = options.cache || process.cwd() + '/.cache/lint.json';
  var DIR = options.source || process.cwd();
  var IGNORE_FILES = ['*.json', '*.html', '*.css', '.*'];

  lintFiles();

  if (options.watcher) {
    listenForFileChanges();
  }

  function listenForFileChanges () {

    var watcher = chokidar.watch(DIR, {
      ignore: IGNORE_FILES
    });

    // Listen for file changes
    watcher.on('change', function (filePath) {

      console.log('\n');
      console.log('========================================================\n');
      console.log(format.blue.bold('File change. Linting files ...'));

      lintFiles();
    });

    watcher.on('add', function (filePath) {

      watcher.add(filePath);
    });

    watcher.on('unlink', function (filePath) {

      watcher.unwatch(filePath);
    });
  }

  function lintFiles () {

    // Lint files
    getFilesToLint(function (err, fileObject) {

      var hasErrors = false;
      var filesToLint = _.reject(fileObject.files, function (file, filepath) {

        return file.linted;
      });

      _.each(filesToLint, function (file) {

        var content = fs.readFileSync(file.path).toString();
        var report = eslintCli.executeOnText(content);

        // TODO: how to handle files with warnings?????
        if (report.errorCount < 1) {
          file.linted = true;
        }

        hasErrors = report.errorCount > 0;

        // Print out results
        _.each(report.results, function (result) {

          if (report.errorCount > 0) {
            console.log('');
            printPath(file.path);
          }

          _.each(result.messages, function (message) {

            if (message.severity === 2) {
              var severity = message.severity < 2 ? format.yellow('Warning: ') : format.red('Error:   ');
              var output = severity + ' [line: ' + message.line + ', column: ' + message.column + '] ' + message.message;

              log(output);
            }
          });
        });

        fileObject[file.path] = file;
      });

      writeCacheFile(fileObject);

      console.log('');

      if (!hasErrors) {
        console.log(format.green('No Linting Errors'));
        console.log('');
        console.log(format.bold('(っ◕‿◕)っ'));
        console.log('');
      }
      else {
        console.log('');
        console.log(format.red.bold('¯_(ツ)_/¯ '));
        sendNotification('fail', 'Linting Failed');
      }
    });
  }

  function getFilesToLint (done) {

    var cache = getCacheFile();

    recursiveReadDir(DIR, IGNORE_FILES, function (err, files) {

      async.each(files, function (filepath, done) {

        timem(filepath, function (err, t) {

          if (err) {
            return done(err);
          }

          if (!cache.files) {
            cache.files = {};
          }

          if (!cache.files[filepath]) {
            cache.files[filepath] = {
              path: filepath,
              updatedAt: t,
              linted: false
            };
          }

          var liveDate = new Date(t);
          var cachedDate = new Date(cache.files[filepath].updatedAt);

          // Check for updated files
          if (+liveDate > +cachedDate) {
            cache.files[filepath].linted = false;
          }

          cache.files[filepath] = {
            path: filepath,
            updatedAt: t,
            linted: !!cache.files[filepath].linted
          };

          done();
        });
      }, function (err) {

        done(err, cache);
      });
    });
  }

  function writeCacheFile (cache) {

    fs.outputFileSync(LINT_FILE_PATH, JSON.stringify(cache, null, 2));
    return cache;
  }

  function getCacheFile () {

    var cacheFile = {
      files: {}
    };

    try {
      cacheFile = require(LINT_FILE_PATH);
    }
    catch (e) {
      // Probably doesn't exist
    }

    return cacheFile;
  }

  function printPath (p) {

    log(format.bold.underline('file://' + p));
  }

  function log (str) {

    console.log(str);
  }

  function pad(str) {

    return '  ' + str;
  }

  function sendNotification (type, message) {

    notify({
      type: type,
      title: 'L&W Lint',
      message: message,
      group: 'lw-build',
    });
  }

};
var path = require('path')
var http = require('http')

var fs = require('fs-extra')
var _ = require('lodash')
var recursiveReadDir = require('recursive-readdir')
var format = require('chalk')
var timem = require('timem')
var async = require('async')
var CLIEngine = require("eslint").CLIEngine
var notify = require('osx-notifier')
var figures = require('figures')
var chokidar = require('chokidar')
var hasFlag = require('has-flag')

var ESLINT_CONFIG_FILEPATH = path.join(__dirname, '.eslintrc')

module.exports = function startLint (options) {

  options = options || {}

  var eslintCli = new CLIEngine({
    configFile: ESLINT_CONFIG_FILEPATH,
    cache: true
  })

  var LINT_FILE_PATH = options.cache || process.cwd() + '/.cache/lint.json'
  var DIR = options.source || process.cwd()
  var IGNORE_FILES = [
    '*.json',
    '*.html',
    '*.css',
    '.DS_Store'
  ]

  lintFiles()

  if (options.watcher) {
    listenForFileChanges()
  }

  function listenForFileChanges () {

    var watcher = chokidar.watch(DIR)

    // Listen for file changes
    watcher.on('change', function (filePath) {

      log('\n')
      log('========================================================\n')
      log(format.blue.bold('File change. Linting files ...'))

      sendToTaskBar('building')

      lintFiles()
    })
  }

  function lintFiles () {

    // Lint files
    getFilesToLint(function (err, fileObject) {

      var hasErrors = false
      var filesToLint = _.reject(fileObject.files, function (file, filepath) {

        return file.linted
      })

      _.each(filesToLint, function (file) {

        // Skip file that doesn't exist
        // TODO: delete this from the cache
        if (!fs.existsSync(file.path)) {
          return
        }

        var content = fs.readFileSync(file.path).toString()
        var report = eslintCli.executeOnText(content)

        if (report.errorCount < 1) {
          file.linted = true
        }

        // hasErrors = report.errorCount > 0
        if (report.errorCount > 0 && hasErrors === false) {
          hasErrors = true
        }

        // Print out results
        _.each(report.results, function (result) {

          if (report.errorCount > 0) {
            log('')
            printPath(file.path)
          }

          _.each(result.messages, function (message) {

            if (message.severity > 1) {
              var severity = message.severity < 2 ? format.yellow(figures.warning + ' : ') : format.red(figures.cross + ' : ')
              var output = severity + ' [line: ' + message.line + ', column: ' + message.column + '] ' + message.message

              log(output)
            }
          })
        })

        fileObject[file.path] = file
      })

      // writeCacheFile(fileObject)

      log('')

      if (!hasErrors) {
        log(format.green(figures.tick + ' No Linting Errors'))
        log('')
        log(format.bold('(っ◕‿◕)っ'))
        log('')
        sendToTaskBar('success')
      }
      else {
        log('')
        log(format.red('¯_(ツ)_/¯ '))
        log('')
        sendNotification('fail', 'Linting Failed')
        sendToTaskBar('error-lint')
      }
    })
  }

  function getFilesToLint (done) {

    var cache = getCacheFile()

    recursiveReadDir(DIR, IGNORE_FILES, function (err, files) {

      async.each(files, function (filepath, done) {

        timem(filepath, function (err, t) {

          if (err) {
            return done(err)
          }

          if (!cache.files) {
            cache.files = {}
          }

          if (!cache.files[filepath]) {
            cache.files[filepath] = {
              path: filepath,
              updatedAt: t,
              linted: false
            }
          }

          var liveDate = new Date(t)
          var cachedDate = new Date(cache.files[filepath].updatedAt)

          // Check for updated files
          if (+liveDate > +cachedDate) {
            cache.files[filepath].linted = false
          }

          cache.files[filepath] = {
            path: filepath,
            updatedAt: t,
            linted: !!cache.files[filepath].linted
          }

          done()
        })
      }, function (err) {

        done(err, cache)
      })
    })
  }

  function writeCacheFile (cache) {

    fs.outputFileSync(LINT_FILE_PATH, JSON.stringify(cache, null, 2))
    return cache
  }

  function getCacheFile () {

    var cacheFile = {
      files: {}
    }

    try {
      var file = fs.readFileSync(LINT_FILE_PATH)
      cacheFile = JSON.parse(file.toString())
    }
    catch (e) {
      // Probably doesn't exist
    }

    return cacheFile
  }

  function printPath (p) {

    log(format.bold.underline(p))
  }

  function log (str) {

    console.log(str)
  }

  function pad(str) {

    return '  ' + str
  }

  function sendToTaskBar (type) {

    // http.get('http://localhost:1337/' + type)
    //   .on('error', function () {})
  }

  function sendNotification (type, message) {

    // if (hasFlag('notifications')) {
      notify({
        type: type,
        title: 'L&W Lint',
        message: message,
        group: 'lw-build',
      })
    // }
  }
}

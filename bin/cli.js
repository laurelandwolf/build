#!/usr/bin/env node

var fs = require('fs-extra');
var cli = require('nash')();

var build = require('../lib');

cli.get('watch', false);
cli.set('cacheFilePath', process.cwd() + '/.tmp/lint.json');

cli.flag('-w', '--watch')
  .handler(function (value, done) {

    cli.set('watch', value);
    done();
  });

var lintCommand = cli.command('lint')
  .handler(function (data, flags, done) {

    build.lint({
      watcher: cli.get('watch'),
      source: data[0] || process.cwd(),
      cache: cli.get('cacheFilePath')
    });

    done();
  });

lintCommand.flag('--cache')
  .handler(function (value, done) {

    cli.set('cacheFilePath', value);
    done();
  });

lintCommand.task('clearCache')
  .handler(function (data, flags, done) {

    fs.removeSync(cli.get('cacheFilePath'));
    done();
  });

cli.run(process.argv);

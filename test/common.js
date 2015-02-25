// jshint ignore: start

'use strict';
var expect = require('chai').expect;
var common = require('../common');
var fs = require('fs');

describe('common:', function() {

    var testFilePath = __dirname + '/test.json';
    before(function (done) {
        fs.writeFile(testFilePath, JSON.stringify({ external: 'external' }), done);
    });

    it('.serviceConfig', function () {
        var cfg = common.serviceConfig(
            testFilePath,
            { homepage: 'homepage', internal: 'internal'},
            { test: 'test', version: 'version', homepage: 'homepage2'}
        );
        // console.log(cfg);
        expect(cfg.external).to.equal('external');
        expect(cfg.homepage).to.equal('homepage');
        expect(cfg.internal).to.equal('internal');
        expect(cfg.version).to.equal('version');
        expect(cfg.test).to.not.exists;
    });

    after(function (done) {
        fs.unlink(testFilePath, done)
    });

});

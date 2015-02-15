#!/usr/bin/env node
'use strict';

/**
 * Sample test service which launch and load test device
 */
var Service = require('../../service');
var device = require('./device.js');

var pkg = require('../../package.json');
var service = new Service({
    id: 'test',             // required field
    version: pkg.version,       // required field
    description: 'service for testing and example purposes',
    homepage: pkg.homepage,
    author: pkg.author
}, function(err) {
    if(err) { throw err; }
    console.log('Created service with id "%s"', service.id);

    // load device into service
    service.loadDevice(device, function (err) {
        if(err) { throw err; }
        console.log('Device "%s" loaded, available states:', device.id, device.states);
    });
});

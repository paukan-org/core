// jshint ignore: start

'use strict';
var expect = require('chai').expect;
var Service = require('../service');
var fs = require('fs');
var emitter = require('websocket-eventemitter2');
var device = require('../examples/test-service/device');
var ld = require('lodash-node');

describe('service:', function() {

    var service, server, wsPort = 45545, config = {
        id: 'mocha',
        version: '0.0.1',
        logger: (function () { // create empty logger
            var obj = {};
            obj.info = obj.error = obj.warn = ld.noop;
            return obj;
        })()
    };

    before(function (done) {
        service = new Service(config);
        server = new emitter.Server({ listen: wsPort });
        server.local.on('ready', done);
    });

    it('.getFirstReadyConnection - connect to redis', function (done) {
        service.cfg.connections = ['direct'];
        service.getFirstReadyConnection(service.network.local, function (err, network) {
            if(err) { return done(err); }
            expect(network.type).to.equal('direct');
            return done();
        });
    });

    it('.getFirstReadyConnection - create websocket server', function (done) {
        service.cfg.connections = ['server'];
        service.getFirstReadyConnection(service.network.local, function (err, network) {
            if(err) { return done(err); }
            expect(network.type).to.equal('server');
            return done();
        });
    });

    it('.getFirstReadyConnection - connect to remote websocket', function (done) {
        service.cfg.connections = ['remote'];
        service.cfg.port = wsPort;
        service.cfg.host = 'localhost';
        service.getFirstReadyConnection(service.network.local, function (err, network) {
            if(err) { return done(err); }
            expect(network.type).to.equal('remote');
            return done();
        });
    });

    it('.isDeviceValid - invalid', function (done) {
        service.isDeviceValid(device, function (err) {
            expect(err).to.be.an.instanceof(Error);
            return done();
        });
    });

    it('.isDeviceValid - valid', function (done) {
        var d = ld.clone(device);
        d.beforeLoad({}, service, ld.noop);
        service.isDeviceValid(d, done);
    });

    it('.init - run service in remote mode', function (done) {
        service.init(done);
    });

    it('.loadDevice', function (done) {
        service.loadDevice(device, {}, done);
    });

    it('.response', function (done) {
        var replyID = 'reply', action = 'action', payload = 'payload';
        server.on('reply.'+service.id+'.'+replyID+'.'+action, function (err, msg) {
            expect(msg).to.equal(payload);
            return done(err);
        });
        service.response(null, payload, replyID, action);
    });
    it('.state', function (done) {
        var deviceID = device.id, state = 'state', arg1 = 'arg1', arg2 = 'arg2';
        server.on('state.'+service.id+'.'+deviceID+'.'+state, function (_arg1, _arg2) {
            expect(_arg1).to.equal(arg1);
            expect(_arg2).to.equal(arg2);
            return done();
        });
        service.state(deviceID, state, arg1, arg2);
    });

    it('.handleRequest - error on get', function (done) {
        var replyID = 'reply', action = 'action2';
        server.on('reply.'+service.id+'.'+replyID+'.'+action, function (err) {
            expect(err).to.contain('not declared');
            return done();
        });
        service.handleRequest('request.'+service.id+'.'+device.id+'.'+action, replyID);
    });

    it('.handleRequest - valid set', function (done) {
        var replyID = 'reply', action = 'delay', payload = 100;
        server.on('reply.'+service.id+'.'+replyID+'.'+action, function (err, delay) {
            expect(delay).to.equal(delay);
            return done(err);
        });
        service.handleRequest('request.'+service.id+'.'+device.id+'.'+action, replyID, payload);
    });

    it('.handleGlobalRequest - send ping', function (done) {
        server.on('reply.'+service.id+'.'+service.id+'.pong', done);
        service.handleGlobalRequest('request.global.anystring.ping');
    });
    
    it('.discover', function (done) {
        service.discover(function (err, info) {
            expect(info.id).to.equal(service.id);
            expect(info.devices[0].id).to.equal(device.id);
            return done(err);
        });
    });

});

describe('service work:', function() {
});

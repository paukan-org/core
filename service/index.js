'use strict';

var ld = require('lodash-node');
var async = require('async');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

var requiredFields = ['id', 'version']; // required fields for device

/**
 * Service - interaction interface between automated network and end devices.
 * Provice necessary functional and act as router.
 *
 * @param {object}      config      configuration parameters for service initialisation
 * @param {function}    callback    if not set - only class will be instances
 */
function Service(config, callback) {

    var eventEmitter = new EventEmitter2({ wildcard: true, delimiter: '.'});
    this.cfg = {};
    this.network = { local: eventEmitter };

    ld.defaults(this.cfg, config, {
        // id                       // required, unique service id [^a-zA-Z0-9_]
        // version                  // required
        requestTimeout: 3000,       // timeout in ms before device answer
        port: 6379,                 // network or proxy port
        host: 'paukan',             // network or proxy host
        throttling: 200,            // do not emit same event fired durning this period (on multiple psubscribe)
        connections: ['direct', 'remote', 'server'] // try next connection type if previous failed
        // - direct: connect to redis queue on specified host and port
        // - remote: connect to remote websocket proxy service on specified host and port
        // - server: create websocket server and wait incoming connection on specified port
    });

    this.id = this.cfg.id;
    this.hostname = require('os').hostname();
    this.version = this.cfg.version;
    this.description = this.cfg.description;
    this.homepage = this.cfg.homepage;
    this.author = this.cfg.author;

    this.devices = {}; // list of devices in this service

    if(callback) { this.init(callback); }
}

/**
 * Connect to automated network and handle common events
 *
 * @param {function} callback       <err>
 */
Service.prototype.init = function(callback) {

    var self = this,
        network = this.network;

    var cb = function(err) {
        callback = callback || function(err) {
            if(err) { throw err; }
            network.local.emit('online');
        };
        if(err) { return callback(err); }
        network.local.on('error', console.error);

        async.series([
            function (next) { // listen and handle global network events
                network.on('request.global.*.*', function () {
                    var argv = ld.values(arguments);
                    argv.unshift(this.event);
                    self.handleGlobalRequest.apply(self, argv);
                }, next);
            },
            function (next) { // listen and handle service-specific network events
                if(self.cfg.type === 'proxy') { // service act as proxy - dont handle request events
                    return next();
                }
                network.on('request.'+self.id+'.*.*', function () {
                    var argv = ld.values(arguments);
                    argv.unshift(this.event);
                    self.handleRequest.apply(self, argv);
                }, next);
            },
            function (next) { // emit event 'im online'
                network.emit('state.'+self.id+'.service.online', next);
            },
            function (next) { // handle exit and emit 'im offline' on exit
                self.handleGoodbyeOnExit();
                return next();
            },
        ], callback);
    };

    if(!this.isDeviceValid(this)) {
        return cb(new Error('.id and .version should be provided for service'));
    }

    // network: global evenemitter object, events will be transmitted into whole automated network
    // network.local: events will be transmitted only into current application
    this.getFirstReadyConnection(this.network.local, function (err, _network) {
        network = self.network = _network;
        setImmediate(cb, err);
    });
};

/**
 * Iterate over {cfg.connections} array and try to create connecton of this type.
 * Return first one on success or error on fail
 *
 * @param {object}   eventEmitter   eventemitter instance (injected into network wrapped)
 * @param {function} callback       <err, network>
 */
Service.prototype.getFirstReadyConnection = function(eventEmitter, callback) {

    var network, cfg = this.cfg;
    async.eachSeries(cfg.connections, function (connectionType, next) {
        var Emitter, config = ld.clone(cfg);
        switch(connectionType) {
            case 'direct':
                Emitter = require('redis-eventemitter2');
            break;
            case 'remote':
                Emitter = require('websocket-eventemitter2').Client;
                config.url = 'ws://'+cfg.host+':'+cfg.port;
            break;
            case 'server':
                Emitter = require('websocket-eventemitter2').Server;
                config.listen = cfg.port;
            break;
            default:
                return next(new Error(connectionType +': this connection type not supported'));
        }
        var cb = function (err) {
            network.local.off('error', cb);
            network.local.off('ready', cb);
            if(err) {
                return next(null);
            }
            console.log('Network connection type:', connectionType);
            return next(connectionType);
        };
        network = new Emitter(config, eventEmitter);
        network.local.on('ready', cb);
        network.local.on('error', cb);
    }, function (err) {
        if(err instanceof Error || !err) {
            return callback(err || new Error('unable to find suitable connection to network'));
        }
        network.type = err;
        return callback(null, network);
    });
};

/**
 * Validate and load specified device, emit device online event
 *
 * @param {object}      device      current device
 * @param {object|null} config      parameters passed to device
 * @param {function}    callback    <err>
 * @return {object}                 device object
 */
Service.prototype.loadDevice = function(device, config, callback) {

    var self = this;

    if (typeof config === 'function') {
        callback = config;
        config = undefined;
    }
    async.series([
        function hookBefore(next) { // call hook before load
            if (!ld.isFunction(device.beforeLoad)) {
                return next();
            }
            device.beforeLoad(config, self, next);
        },
        function validate(next) { // check if device valid
            self.isDeviceValid(device, next);
        },
        function load(next) { // load device into service
            var devices = self.devices,
                id = device.id;
            if (devices[id]) {
                return next(new Error('device with same id already loaded'));
            }
            devices[id] = device;
            return next();
        },
        function hookAfter(next) { // call hook after load
            if (!ld.isFunction(device.afterLoad)) {
                return next();
            }
            device.afterLoad(next);
        },
        function emitOnline(next) { // send 'device is online' into network
            self.network.emit('state.'+self.id+'.'+device.id+'.online', next);
        },
    ], function(err) {
        setImmediate(callback || ld.noop, err);
        return device;
    });
};

/**
 * Test if object is valid device
 *
 * @param {object}      device      specified device
 * @param {function}    callback    error if device is invalid
 * @return {boolean}                is device valid
 */
Service.prototype.isDeviceValid = function(device, callback) {

    var cb = function(err) {
        setImmediate(callback || ld.noop, err);
        return !err;
    };
    if (/[^a-zA-Z0-9_]/.test(device.id)) {
        return cb(new Error('id not found or invalid (only digits and letters allowed)'));
    }
    var isValid = ld.every(requiredFields, function(v) {
        return device[v] && ld.isString(device[v]);
    });
    if(!isValid) {
        return cb(new Error('one of required fields not found: '+ requiredFields.join(', ')));
    }
    return cb();
};

/**
 * Emit 'response' event into network in form "reply.service.replyid.action"
 * Event payload always consists of an array [err] or [null, res]
 *
 * @param  {error} err      object with error or null
 * @param  {any} res        response
 * @param  {string} replyId part of event
 * @param  {string} action  part of event
 */
Service.prototype.response = function(err, res, replyId, action) {

    var response = ['reply.'+this.id+'.'+replyId+'.'+action];
    if(err) {
        response.push(err.message);
    } else if(res) {
        response.push(null, res);
    }
    this.network.emit.apply(this.network, response);
};

/**
 * Emit 'state' event into network in form 'state.service.device.name
 *
 * @param {object|string}   device id or device object, if falsy value passed - event will be emitted from service
 * @param {string}          state name
 * @params {any}            arguments to event payload
 */
Service.prototype.state = function() {

    var arg = ld.values(arguments),
        deviceID = arg.shift(),
        stateName = arg.shift(),
        eventName = [
            'state',
            this.id,
            deviceID ? (deviceID.id || deviceID) : 'service',
            stateName
        ].join('.');

    arg.unshift(eventName);

    this.network.emit.apply(this.network, arg);
};

/**
 * Handle incoming request from network
 *
 * @param {string} event    event from network in form "request.serviceid.deviceid.statename"
 * @param {string} replyId  information about place to reply
 * @param {any} value       event payload (if exists)
 */
Service.prototype.handleRequest = function(event, replyId, value) {

    var arr = event.split('.');
    if(arr[0] !== 'request' || arr[1] !== this.id) {
        throw new Error('wrong request event:' + event);
    }
    var self = this,
        action = arr[3],
        device = this.devices[arr[2]];

    function callback(err, res) {
        if(err) {
            console.error(err.message);
        }
        if(replyId) { // no need to genereate 'reply.*' event if reply id is not provided
            self.response(err, res, replyId, action);
        }
    }

    if (!device) {
        return callback(new Error('device with id ' + arr[3] + ' not found'));
    }
    // ask requested device about response
    return this.handleRequestedAction(device, action, value, callback);
};

/**
 * Handle global requests from network
 * @param {string} event   event from network in form "request.global.anystring.action"
 * @param {string} replyId information about place to reply
 */
Service.prototype.handleGlobalRequest = function(event, replyId) {

    if(!replyId) { // if information not provided - reply with service id
        replyId = this.id;
    }

    var self = this,
        arr = event.split('.'),
        action = arr[3];

    switch(action) {
        case 'ping': // tell 'im alive'
            return this.response(null, null, replyId, 'pong');
        case 'discover': // provide information about service and devices
            return this.discover(function (err, info) {
                self.response(err, info, replyId, action);
            });
    }
};

/**
 * Return full info about current service, including all states/actions and available devices
 *
 * @param {function} callback       <err, info>
 */
Service.prototype.discover = function(callback) {

    var self = this, info = {
        id: this.id,
        version: this.version,
        description: this.description,
        hostname: this.hostname,
        homepage: this.homepage,
        author: this.author,
        states: {},     // available states for current service
        devices : []    // currently active devices
    };

    // iterate over devices and collect info
    async.each(ld.keys(this.devices), function(deviceName, next) {
        var device = self.devices[deviceName];
        var _info = {
            id: device.id,
            version: device.version,
            states: {}
        };

        // append not required fields
        ld.each(['description', 'homepage', 'author'], function(v) {
            if(device[v]) {
                _info[v] = device[v];
            }
        });

        // get current states
        async.each(device.states, function(state, _next) {
            self.handleRequestedAction(device, state, null, function(err, result) {
                _info.states[state] = err ? undefined : result;
                return _next();
            });
        }, function(err) {
            if(!err) {
                info.devices.push(_info);
            }
            return next(err);
        });

    }, function(err) {
        return callback(err, info);
    });
};

/**
 * Translate string 'somEsTRing' to 'Somestring'
 *
 * @param {string}    string    source
 * @return {string}             result
 */
Service.prototype.capitalize = function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

/**
 * Try to guess requested action type (get/set) for device and execute it
 * @param {object}   device   target device
 * @param {string}   action   action to execute
 * @param {any}   value       payload to pass into device on execution
 * @param {function} callback <err, result>
 */
Service.prototype.handleRequestedAction = function(device, action, value, callback) {

    var states = device.states,
        isSetter = !!value,
        capName = this.capitalize(action),
        func, cb, timer;

    // set execution timeout (in case of bad device)
    timer = setTimeout(
        cb,
        this.cfg.requestTimeout,
        new Error(device.id + '.' + action + ' do not responding, please report it to developer')
    );
    cb = ld.once(function (err, res) {
        clearTimeout(timer);
        return callback(err, res);
    });

    // requested action should be declared in [device.states] array
    if (states && states.indexOf(action) === -1) {
        return cb(new Error('action or state ' + action + ' not declared in ' + device.id));
    }

    if(isSetter) { // payload passed - whis is 'set' request
        func = device['set'+capName];
        if (ld.isFunction(func)) { // try to call 'set{Action}' with passed arguments
            return func.bind(device)(value, cb);
        }
    } else { // no payload - this is 'get request'
        func = device['get'+capName];
        if (ld.isFunction(func)) { // try to call 'get{Action}'
            return func.bind(device)(cb);
        }
        if (ld.has(device, action)) { // search property device.{state}
            return cb(null, device[action]);
        }
    }

    // try call default handler if none found (both for get and set requests)
    if (ld.isFunction(device.action)) {
        return device.action.bind(device)(action, value, cb);
    }

    return cb(new Error('action or state "' + action + '" declared but not handled in ' + device.id));

};


/**
 * Send 'service is offline' event on app exit or termination
 */
Service.prototype.handleGoodbyeOnExit = function() {

    var network = this.network, id = this.id;
    process.stdin.resume(); //so the program will not close instantly

    function exitHandler(options, err) {
        if (err) {
            console.log(err.stack);
        }
        if (options.exit) {
            process.exit();
        }

        if(network) {
            network.emit('state.'+id+'.service.offline');
        }
    }

    //do something when app is closing
    process.on('exit', exitHandler.bind(null, {
        cleanup: true
    }));

    //catches ctrl+c event
    process.on('SIGINT', exitHandler.bind(null, {
        exit: true
    }));

    //catches uncaught exceptions
    process.on('uncaughtException', exitHandler.bind(null, {
        exit: true
    }));
};

module.exports = Service;

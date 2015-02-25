'use strict';

var ld = require('lodash-node');
var moment = require('moment');
var clc = require('cli-color');

/**
 * Take configuration files and service specific info from package.json
 *
 * @params {string|object}
 *  - if first parameter is string - will be added config from /etc/paukan/<name>.json
 *  - second parameter is confguration object with default settings
 *  - last (third, or second if name is not specified - object from package.json where service-specific info will be taken)
 */
function serviceConfig() {

    var arg = ld.values(arguments), cfg = {};

    // try to load file from global directory
    if(typeof arg[0] === 'string') {
        var path = arg.shift();
        try {
            cfg = require('/etc/paukan/'+path+'.json');
        } catch (err) { // try to load file directly if global fails
            try {
                cfg = require(path);
            } catch (err) {}
        }
    }

    // append default settings
    var localCfg = arg.shift();
    if(!ld.isPlainObject(localCfg)) {
        throw new Error('at least local config should be specified');
    }
    ld.defaults(cfg, localCfg);

    // load specific field from package.json
    var packageCfg = arg.shift();
    if(ld.isPlainObject(packageCfg)) {
        ld.defaults(cfg, ld.pick(packageCfg, ['version', 'description', 'homepage', 'author']));
    }

    return cfg;
}

/**
 * Stream to console for bunyan logger
 */
function StreamConsole(cfg) {
    cfg = cfg || {};
    this.color = cfg.color || true;
    this.timestamp = (typeof cfg.timestamp === 'undefined') ? 'HH:mm:ss ' : cfg.timestamp;
}

StreamConsole.prototype.colorify = function(msg, level) {
    if (!this.color) {
        return msg;
    }
    switch (level) {
        case 50: // error
            return clc.red.bold(msg);
        case 40: // warn
            return clc.yellow(msg);
        case 30: // info
            return clc.blue(msg);
        default:
            return msg;
    }
};

StreamConsole.prototype.timestampify = function(time) {
    if (!this.timestamp) {
        return time;
    }
    return moment(time).format(this.timestamp);
};

StreamConsole.prototype.write = function(item) {
    console.log(this.timestampify(item.time) + this.colorify(item.name, item.level) + ':', item.msg);
};

module.exports.serviceConfig = serviceConfig;
module.exports.StreamConsole = StreamConsole;

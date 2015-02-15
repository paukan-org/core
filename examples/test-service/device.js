'use strict';

/**
 *	Working device example.
 *
 * Purposes:
 * - device template
 * - test device
 */
function Device() {}


/**
 * This function will be run before device load. Can be used to init properties.
 * For example - set availabe states, actions etc.
 *
 * @param {object}      config      device specific configuration passed by service
 * @param {object}      service     service instance
 * @param {function}    callback    <err>
 */
Device.beforeLoad = function(config, service, callback) {

    var pkg = require('../../package.json');
    this.id = 'test1';          // required field
    this.version = pkg.version; // required field
    this.description = 'test device for tests and examples';
    this.homepage = pkg.homepage;
    this.author = pkg.author;

    this.service = service;
    this.states = ['counter', 'delay']; // available states (can be quieried over network)
    callback();
};

/**
 * This function will be run on device succesful load. Can be used to run main device code.
 *
 * @param {object}  callback    should return error on fail
 */
Device.afterLoad = function(callback) {

    this.counter = 0;
    this.delay = 60000;

    this.restartTimer();
    callback();
};

/**
 * Restart counter with specified delay
 */
Device.restartTimer = function() {

    clearInterval(this.timer);
    this.timer = setInterval(function() {
        this.counter++;
        this.emit('counter', this.counter, this.counter - 1);
    }.bind(this), this.delay);
};

/**
 * Set delay for counter. 'delay' specified in 'states' array, so function 'setDelay' available
 * for external requests, example: 'request.test.test1.delay' with payload [null, 1000]
 *
 * @param {integer}   value     amount of ms for timer
 * @param {function} callback   <err, new value, previous value>
 */
Device.setDelay = function(value, callback) {

    var prevValue = this.switch;
    var newValue = parseInt(value, 10);
    if(!newValue) {
        return callback(new Error('wrong value passed'));
    }
    this.delay = value;
    this.emit('delay', value, prevValue);
    this.restartTimer();
    return callback(null, value, prevValue);
};

/**
 * Emit state change for device
 * @param  {string} name     state name
 * @param  {any} value       param1 in event payload
 * @param  {any} oldValue    param2 in event payload
 */
Device.emit = function(name, value, oldValue) {

    this.service.network.emit(
        'state.'+this.service.id+'.'+this.id+'.'+name,
        value,
        oldValue
    );
};

/**
 * Default action request handler for items .{state} or function .get{state} not found.
 *
 * @param {string}      name           requested state name
 * @param {array}       arg            array of parameters passed with action request
 * @param {function}    callback       <err, value>
 */
Device.action = function(name, arg, callback) {

    return callback(new Error('action not supported'));
};


module.exports = Device;

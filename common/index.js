'use strict';

var ld = require('lodash-node');

module.exports.serviceConfig = function(cfg, pkg) {
    ld.defaults(cfg, ld.pick(pkg, ['version', 'description', 'homepage', 'author']));
    return cfg;
};

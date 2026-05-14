var exec = require('cordova/exec');

var AdMob = {
    createBanner: function(options, success, error) {
        exec(success, error, 'AdMob', 'createBanner', [options]);
    }
};

module.exports = AdMob;
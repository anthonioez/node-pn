var npn = require('node-pn')();
var bunyan = require('bunyan');

var pushlog = bunyan.createLogger({
    name  : "node-pn",
    level : "info",
    src   : true
});

var fcmConfig = {
    apiKey  : 'fcm key here',
    ttl     : 6*3600,
    notify  : false,    //send as notification or data
    log     : pushlog, 
};

var apnConfig = {
    cert        : "./certs/dist_cert.pem",
    key         : "./certs/dist_key.pem",
    ttl         : 6*3600,                        // Time to live, (optional, default = 3600 = 1h)
    production  : true,                   // If your application is on the production APNS
    topic       : "app bundle here",
    log         : pushlog, 
    priority    : 10,
    badge       : 1,
    sound       : 'default',                                 
};

pushtest = {
    apnToken: "iOS token here",
    fcmToken: 'Android token here',

    start: function(app)
    {        
        pushtest.testFCM();
        pushtest.testAPN();
    },

    testFCM: function()
    {        
        var tokens  = [pushtest.fcmToken];

        var data    = {
            title       : "message title",
            body        : 'message body',
            //any_other_Key : "that you want to send"     
        }

        var sender = npn.send(npn.constants.TYPE_ANDROID, fmcConfig, tokens, data);
        sender.on("successful", (token) => 
        {
            // Each successful push triggers this event with the token and message_id.
            console.log('succes', token)
        });
        
        sender.on("failed", (err) => 
        {
            // Each failed push triggers this event with the token and the statusCode or error.
            console.log('failed', err)
        });
        
        sender.on("unregistered", (token) => 
        {
            // Each push where the device is not registered (uninstalled app).
            console.log('unreg', token)
        });
        
        sender.on("end", (results) => 
        {
            // Contains success, failed and unregistered notifications responses data (if there are some).
            console.log('done', JSON.stringify(results))
        })                
    },

    testAPN: function()
    {
        var tokens  = [pushtest.apnToken];

        var data    = {
            title       : "message title",
            body        : 'message body',
            badge       : 1,
            sound     : 'default',

            //any_other_Key : "that you want to send"     
        };
        
        var sender = npn.send(npn.constants.TYPE_IOS, apnConfig, tokens, data);
        sender.on("successful", (token) => 
        {
            // Each successful push triggers this event with the token and message_id.
            console.log('succes', token)
        });
        sender.on("failed", (err) => 
        {
            // Each failed push triggers this event with the token and the statusCode or error.
            console.log('failed', err)
        });
        sender.on("unregistered", (token) => 
        {
            // Each push where the device is not registered (uninstalled app).
            console.log('unreg', token)
        });
        sender.on("end", (results) => 
        {
            // Contains success, failed and unregistered notifications responses data (if there are some).
            console.log('done', JSON.stringify(results))
        })        
    }
}
module.exports = pushtest

'use strict';

const constants = require('./lib/const.js'),
    _ = require('underscore'),
    Gcm = require('./lib/fcm/fcm'),
    Wns = require("./lib/wns/wns"),
    Apn = require("./lib/apn/apn"),
    bunyan = require('bunyan'),
    util = require("util"),
    Serializer = require("./lib/util/serializer"),
    EventEmitter = require("events");

module.exports = function () 
{
    function Sender(options) 
    {
        EventEmitter.call(this);
        if (false === (this instanceof Sender)) {
            return new Sender(options);
        }
    }

    util.inherits(Sender, EventEmitter);

    Sender.constants = constants;

    /**
     * Function called to send a notification on Android device(s)
     *
     * @param {object}      config      Sender Config
     * @param {string[]}    tokens      Devices tokens
     * @param {object}      data        Sender Data
     * @private
     */
    Sender.prototype.sendAndroid = function (config, tokens, data) 
    {
        var gcm = new Gcm(config);
        
        if (!config.hasOwnProperty("apiKey")) 
        {
            throw "Error, no apiKey";
        }

        gcm.send(tokens, data);
        return gcm;
    };


    /**
     * Function called to send a notification on iOS device
     *
     * @param {object}      config      Sender Config
     * @param {string[]}    tokens      Devices tokens
     * @param {object}      data        Sender Data
     * @private
     */
    Sender.prototype.sendIOS = function (config, tokens, data) 
    {        
        if(config.sound != undefined && data.sound == undefined) data.sound = config.sound        
        if(config.badge != undefined && data.badge == undefined) data.badge = config.badge
        if(config.icon != undefined && data.icon == undefined) data.icon = config.icon

        var apn = new Apn.Connection(config);
        
        apn.send(tokens, data);
        
        return apn;
    };

    /**
     * Function called to send a notification on WindowsPhone device
     *
     * @param {object}      params                  Sender params
     * @param {object}      params.log              Sender log
     * @param {object}      params.message          Sender Message
     * @param {string[]}    params.tokens           Devices tokens
     * @param {object}      params.config           Sender Config
     * @param {string}      params.config.sid       Package Security Identifier (SID)
     * @param {string}      params.config.secret    Secret password
     * @private
     */
    Sender.prototype._sendWP = function (params) {
        var wns = new Wns({ log : params.log });
        if (!params.config.sid) {
            throw "Error, no SID";
        }
        if (!params.config.secret) {
            throw "Error, no secret";
        }
        var context = {
            ttl               : params.config.ttl,
            tokenUrl          : params.tokens,
            client_id         : params.config.sid,
            client_secret     : params.config.secret,
            notificationClass : "immediate",
            type              : Wns.types.TOAST,
            template          : "ToastText01",
            payload           : {
                text : [
                    params.message[constants.PARAMS_MESSAGE]
                ]
            }
        };
        wns.send(context);
        return wns;
    };

    /**
     * Function called to send a notification on device(s).
     *
     * @param {string}              type        Sender type
     * @param {object}              config      Sender Config
     * @param {string[]}            tokens      Devices tokens
     * @param {object}              data        Sender Data
     * @param {function}            [callback]  Callback function
     */
    Sender.send = function send(type, config, tokens, data, callback) 
    {
        var sender = new Sender();
        var handled = false;

        if (!config) {
            throw "Error, no config found";
        }

        if (!tokens || tokens.length == 0) 
        {
            throw "Error, no tokens";
        }

        if (!data) 
        {
            throw "Error, no data";
        }

        if (Object.keys(data).length == 0) 
        {
            throw "Error, empty data";
        }
        
        if (isNaN(config.ttl) || config.ttl < 0 || config.ttl > 2419200) 
        {
            config.ttl = 3600;
        }

        let senderLib;
        switch (type) 
        {
            case constants.TYPE_ANDROID :
                senderLib = sender.sendAndroid(config, tokens, data);
                break;
            case constants.TYPE_IOS :
                senderLib = sender.sendIOS(config, tokens, data);
                break;
            case constants.TYPE_WP :
                senderLib = sender._sendWP(params);
                break;
            default :
                throw "Unknow sender type";
        }

        if (_.isFunction(callback)) 
        {
            senderLib.once("error", (err)=> {
                if (!handled) 
                {
                    callback(err);
                    handled = true;
                }
            });
            senderLib.on("end", (result)=> {
                if (!handled) 
                {
                    callback(null, result);
                    handled = true;
                }
            });
        } 
        else 
        {
            senderLib.on("error", sender.emit.bind(sender, "error"));
            senderLib.on("end", sender.emit.bind(sender, "end"));
            senderLib.on("successful", sender.emit.bind(sender, "successful"));
            senderLib.on("failed", sender.emit.bind(sender, "failed"));
            senderLib.on("unregistered", sender.emit.bind(sender, "unregistered"));
        }
        return sender;
    };

    return Sender;
};

module.exports.constants = constants;

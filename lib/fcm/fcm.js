"use strict";

const request = require('request'),
    util = require("util"),
    chunk = require("./../util/array").chunk,
    EventEmitter = require("events"),
    async = require("async"),
    _ = require("underscore"),
    bunyan = require('bunyan');

/**
 * GCM lib to send notification to WindowsPhone devices.
 * 
 * @param {object} options.log Bunyan logger
 * @constructor
 */
var Gcm = function (config) 
{
    EventEmitter.call(this);
    this._apiKey = config.apiKey
    this._notify = config.notify
    this._ttl = config.ttl;
    this._log = config.log.child({ component : 'gcm-sender' });
};
util.inherits(Gcm, EventEmitter);


/**
 * Android unregistered error code.
 *
 * @type {string}
 * @const
 */
Gcm.UNREGISTERED_ERROR = "NotRegistered";

/**
 * Android GCM Server URI
 * @type {string}
 * @const
 */
Gcm.SERVER_URI = 'https://android.googleapis.com/gcm/send';


/**
 * Send Message
 *
 * @param {string[]}        tokens          Tokens.
 * @param {object}          message         Push message.
 * @param {object}          data            push data.
 */
Gcm.prototype.send = function (tokens, data) 
{
    this._log.trace({ tokens: tokens, data: data }, "Send()'s params");

    var registration_ids = chunk(tokens, 1000); // Cut the token array in chunk.
    var results = [];

    var pushBody = {};
    
    if(this._notify)
    {
        var notification = {};
        if(data.hasOwnProperty('title'))
        {
            notification.title = data.title;
            delete data.title
        }

        if(data.hasOwnProperty('body'))
        {
            notification.body = data.body;
            delete data.body;
        }

        if(data.hasOwnProperty('icon'))
        {
            notification.icon = data.icon;
            delete data.icon
        }

        if(data.hasOwnProperty('sound'))
        {
            notification.sound = data.sound;
            delete data.sound
        }

        if(data.hasOwnProperty('tag'))
        {
            notification.tag = data.tag;
            delete data.tag
        }

        if(data.hasOwnProperty('color'))
        {
            notification.color = data.color;
            delete data.color
        }
        
        if(Object.keys(notification).length > 0)
        {
            pushBody.notification = notification;        
        }
    }

    if(Object.keys(data).length > 0)
    {
        pushBody.data = data;
    }
        
    //pushBody.delay_while_idle = false;
    //pushBody.collapse_key = '';
    pushBody.time_to_live = this._ttl;

    //console.log('pushBody: ', pushBody);

    var req = {
        uri       : Gcm.SERVER_URI,
        json      : true,
        method    : "POST",
        headers   : {
            'Authorization' : 'key=' + this._apiKey,
            'Content-Type'  : 'application/json'
        },
        encoding  : 'UTF-8',
        strictSSL : false,
        body      : pushBody,
    };
    async.each(registration_ids, (tokens, callback) => {
        req.body.registration_ids = tokens;
        this._log.debug({ req : req }, "Send()'s request");
        request.post(req, (err, res)=> {
            this._log.trace({ res : res });
            if (err) {
                this._log.error({ err : err }, "Error while sending the notification request");
                _.each(tokens, (token)=> {
                    let error = {
                        error      : true,
                        token      : token,
                        statusCode : jsonResponse.statusCode,
                        body       : jsonResponse.body
                    };
                    this._log.debug({ error : error }, "Notification fail");
                    this.emit("failed", error);
                    results.push(error);
                });
            } else {
                var jsonResponse = res.toJSON();
                this._log.debug({ res : jsonResponse }, "Notification GCM response");
                if (jsonResponse.statusCode === 200) {
                    _.each(jsonResponse.body.results, (result, index)=> {
                        if (result.error) {
                            let info = {
                                error      : result.error,
                                token      : tokens[index],
                                message_id : result.message_id
                            };
                            if (result.error === Gcm.UNREGISTERED_ERROR) {
                                info.unregistered = true;
                                this.emit("unregistered", info);
                            } else {
                                this.emit("failed", info);
                            }
                            this._log.debug({ error : info }, "Notification fail");
                            results.push(info);
                        } else {
                            let info = {
                                token      : tokens[index],
                                message_id : result.message_id
                            };
                            this._log.debug(info, "Notification sent");
                            this.emit("successful", info);
                            results.push(info);
                        }
                    })
                } else {
                    _.each(tokens, (token) => {
                        let error = {
                            error      : true,
                            token      : token,
                            statusCode : jsonResponse.statusCode,
                            body       : jsonResponse.body
                        };
                        this._log.debug(error, "Notification fail");
                        this.emit("failed", error);
                        results.push(error);
                    });
                }
            }
            callback();
        })
    }, (err) => {
        if (err) 
        {
            this.emit("error", err);
        }
        
        let data = 
        {
            success      : [],
            failure      : [],
            unregistered : []
        };
        results.forEach(response => 
        {
            if (response.unregistered) 
            {
                data.unregistered.push(response);
            } 
            else if (response.error) 
            {
                data.failure.push(response);
            } 
            else 
            {
                data.success.push(response);
            }
        });
        this.emit("end", data);
    });
};

module.exports = Gcm;
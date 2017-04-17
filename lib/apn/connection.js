"use strict";

const EventEmitter = require("events");
const Promise = require("bluebird");
const extend = require("util")._extend;
const Device = require("./device");
const Notification = require("./notification");

module.exports = function(dependencies) 
{
    const config = dependencies.config;
    const EndpointManager = dependencies.EndpointManager;


    function Connection (options) 
    {
        if(false === (this instanceof Connection)) 
        {
            return new Connection(options);
        }

        this._priority = options.priority;
        this._topic = options.topic;
        this._ttl = options.ttl;
        this._log = options.log.child({ component : 'apn-sender' });

        this.config = config(options);
        this.endpointManager = new EndpointManager(this.config);
        this.endpointManager.on("wakeup", () => 
        {
            while (this.queue.length > 0) 
            {
                const stream = this.endpointManager.getStream();
                if (!stream) 
                {
                    return;
                }
                const resolve = this.queue.shift();
                resolve(stream);
            }
        });

        this.endpointManager.on("error", this.emit.bind(this, "error"));

        this.queue = [];

        EventEmitter.call(this);
    }

    Connection.prototype = Object.create(EventEmitter.prototype);

    Connection.prototype.getHeaders = function getHeaders()
    {
        var expiry = Math.floor(Date.now() / 1000) + this._ttl;

        var headers = {};
        if (expiry > 0) 
        {
            headers["apns-expiration"] = expiry;
        }

        if (this._priority && this._priority  > 0 && this._priority <= 10) 
        {
            headers["apns-priority"] = this._priority;
        }

        if (this._topic) 
        {
            headers["apns-topic"] = this._topic;
        }
        return headers;
    }

    Connection.prototype.getBody = function getBody(data)
    {
        var aps = {};  //new Notification();
        
        if(data.hasOwnProperty('body'))
        {
            if(data.hasOwnProperty('title'))
            {
                var alert = {}

                alert.title = data.title;
                delete data.title                

                alert.body = data.body;
                delete data.body

                aps.alert = alert;
            }
            else
            {
                aps.alert = data.body;
                delete data.body
            }            
        }
        
        if(data.hasOwnProperty('badge'))
        {
            aps.badge = data.badge;
            delete data.badge                            
        }
        
        if(data.hasOwnProperty('sound'))
        {
            aps.sound = data.sound;
            delete data.sound                            
        }

        if(data.hasOwnProperty('category'))
        {
            aps.category = data.category;
            delete data.category                            
        }

        if(data.hasOwnProperty('tag'))
        {
            aps['thread-id'] = data.tag;
            delete data.tag
        }

        if(data.hasOwnProperty('mutable'))
        {
            aps['mutable-content'] = data.mutable;
            delete data.mutable                            
        }
        
        var body = {aps: aps}

        //body.aps = aps;

        //body.aps["content-available"] = 1;

        Object.keys(data).forEach(function(key) 
        {
            if(key != 'aps')
            {
                body[key] = data[key];
            }
        });

        return JSON.stringify(body);
    }

    Connection.prototype.send = function send(tokens, data) 
    {
        var recipients = [];

        tokens.forEach(token => 
        {
            try
            {
                recipients.push(new Device(token))
            }
            catch(error)
            {

            }
        });
        
        var notificationHeaders = this.getHeaders();

        var notificationBody = this.getBody(data);

        //console.log('notificationHeaders:', notificationHeaders);
        //console.log('notificationBody:', notificationBody);

        const send = device => 
        {
            return new Promise( resolve => 
            {
                const stream = this.endpointManager.getStream();
                if (!stream) 
                {
                    this.queue.push(resolve);
                } 
                else 
                {
                    resolve(stream);
                }
            }).then( stream => 
            {
                return new Promise ( resolve => 
                {
                    stream.setEncoding("utf8");

                    stream.headers(extend({
                        ":scheme": "https",
                        ":method": "POST",
                        ":authority": this.config.address,
                        ":path": "/3/device/" + device
                    }, notificationHeaders));

                    var status, id, responseData = "";
                    stream.on("headers", headers => {
                        status = headers[":status"];
                        id = headers["apns-id"];
                    });

                    stream.on("data", data => {
                        responseData = responseData + data;
                    });
                    stream.on("end", () => {
                        if (status === "200") {
                            let info = {
                                token     : device.toString(),
                                message_id : id
                            };
                            this._log.debug(info, "Notification sent");
                            this.emit("successful", info);
                            resolve(info);
                        } else {
                            const response = JSON.parse(responseData);
                            let info = {
                                token : device.toString(),
                                status,
                                error  : response
                            };
                            if (status === "410") {
                                info.unregistered = true;
                                this.emit("unregistered", info);
                            } else {
                                this.emit("failed", info);
                            }
                            this._log.debug(info, "Notification fail to be send");
                            resolve(info);
                        }
                    });
                    stream.on("error", this.emit.bind(this, "error"));
                    stream.write(notificationBody);
                    stream.end();
                });
            });
        };
        
        if (!Array.isArray(recipients)) 
        {
            recipients = [recipients];
        }
        
        return Promise.all(recipients.map(send)).then(results => {
            let data = {
                success      : [],
                failure      : [],
                unregistered : []
            };
            results.forEach(response => 
            {
                if (response.unregistered) {
                    data.unregistered.push(response);
                } else if (response.error) {
                    data.failure.push(response);
                } else {
                    data.success.push(response);
                }
            });
            this.emit("end", data);
            return data;
        });
    };





    return Connection;
};


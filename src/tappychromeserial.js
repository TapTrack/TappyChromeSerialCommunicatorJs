(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.TappyChromeSerialCommunicator = factory();
    }
}(this, function () {
    ChromeSerialCommunicator = function(path, params) {
        var self = this;

        if(typeof params !== "undefined" && 
                params !== null && 
                typeof params.serial === "object") {
            this.serial = params.serial;
        }
        else {
            this.serial = chrome.serial;
        }

        this.connectionId = null;
        this.path = path;
        this.isConnecting = false;
        this.hasAttached = false;
        this.disconnectImmediately = false;

        this.dataReceivedCallback = function(bytes) {

        };
        this.setErrorCallback = function(data) {

        };
        this.readCallback = function(info) {
            var recConnectionId = info.connectionId;
            var newDataBuf = info.data;
            if(self.isConnected() && recConnectionId === self.connectionId) {
                var newData = new Uint8Array(newDataBuf);
                self.dataReceivedCallback(newData);
            }
        };
    };

    ChromeSerialCommunicator.prototype = {
        attachReadWrite: function() {
            if(!this.hasAttached) {
                this.hasAttached = true;
                this.serial.onReceive.addListener(this.readCallback);
            }
        },

        connect: function(cb) {
            var self = this;
            if(!self.isConnecting && !self.isConnected()) {
                self.isConnecting = true;
                // this should probably have a failure state
                // but the chrome docs dont describe what happens
                self.serial.connect(
                    this.path,
                    {bitrate: 115200},
                    function(connectionInfo) {
                        self.isConnecting = false;
                        self.connectionId = connectionInfo.connectionId;
                        self.attachReadWrite();

                        if(typeof cb === "function") {
                            cb();
                        }

                        if(self.disconnectImmediately) {
                            self.disconnectUnsafe();
                        }

                    }
                );
            }
        },

        flush: function(cb) {
            var self = this;
            if(this.isConnected()) {
                self.serial.flush(self.connectionId, function(result) {
                    cb(result);
                });
            } else {
                throw new Error("Can't flush when not connected");
            }
        }, 

        isConnected: function() {
            return this.connectionId !== null;
        },
 
        disconnectUnsafe: function(cb) {
            var self = this;
            if(self.isConnecting) {
                throw "Connection still in the process of being established";
            }
            if(self.isConnected()) {
                // TODO: Make safer
                // In particular, find out what a failed connect means
                // and determine if the connectionId should be set to null
                // before like it is currently or if guards around it should be setup
                // so it can stay set during the duration of the disconnect process
                // but avoid trying to disconnect it while a disconnect is pending
                var cnxn = self.connectionId;
                self.connectionId = null;
                self.serial.disconnect(cnxn, function(result) {
                    if(typeof cb === "function") {
                        cb(result);
                    }
                });
            }
        },

        disconnect: function(cb) {
            this.disconnectImmediately = true;
            if(!this.isConnecting && this.isConnected()) {
                this.disconnectUnsafe(cb);
            }
        },

        send: function(buffer) {
            var self = this;
            self.serial.send(this.connectionId,buffer,function(sendInfo) {
                if(sendInfo.hasOwnProperty("error") && sendInfo.error !== null) {
                    if(typeof self.callbacks.serialPortErrorCb === 'function') {
                        var data = {buffer: buffer};
                        self.callbacks.serialPortErrorCb(sendInfo,data);
                    }
                }
            });
        },

        setDataCallback: function(cb) {
            this.dataReceivedCallback = cb;
        }
    };
    return ChromeSerialCommunicator;
}));

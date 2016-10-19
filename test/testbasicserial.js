GLOBAL.chrome = {
    runtime: {
        lastError: false // a check should be added for this later
    }
};
var ChromeSerial = require('../src/tappychromeserial.js');

var MockDevice = function(mockSerial, connectionId) {
    this.disconnected = true;

    this.rx = function(data) {
        if(this.disconnected) {
            throw new Error("Trying to send data to a disconnected connection");
        }
    };

    this.sendData = function(buffer) {
        mockSerial.rx(connectionId,buffer);
    };

    this.connect = function() {
        this.disconnected = false;
    };

    this.disconnect = function() {
        this.disconnected = true;
    };
};

var MockSerial = function(devices) {
    var self = this;
    this.devices = devices || [];
    this.lastGetDeviceCb = function() {};

    this.connections = [];
    this.receiveListeners = [];
    this.onReceive = {};
    this.onReceive.addListener = function(cb) {
        self.receiveListeners.push(cb);
    };
};

MockSerial.prototype = {
    getDevices: function(cb) {
        this.lastGetDeviceCb = cb;

        for(var device in this.devices) {
            cb({path: this.devices[device]});
        }
    },

    resendDevices: function() {
        this.getDevices(this.lastGetDeviceCb);
    },

    connect: function(path, options, cb) {
        var self = this;
        var device = null;
        var length = self.connections.length;
        if (self.devices.indexOf(path) >= 0) {
            device = new MockDevice(self,length);
        } else {
            throw new Error("Cannot connect to a device that doesn't exist");
        }
        if(device !== null) {
            self.connections.push(device);
            device.connect();
            cb({connectionId: length});
        }
    },

    disconnect: function(connectionId, cb) {
        var self = this;
        if(self.connections.length <= connectionId) {
            throw new Error("Connection doesn't exist");
        }
        else {
            var cnxn = self.connections[connectionId];
            cnxn.disconnect();
            cb({});
        }
    },
    
    rx: function(connectionId, data) {
        var self = this;
        for(var i in self.receiveListeners) {
            var listener = self.receiveListeners[i];
            listener({connectionId: connectionId, data: data});
        }
    },

    send: function(connectionId, data, cb) {
        var self = this;
        if(self.connections.length <= connectionId) {
            throw new Error("Connection doesn't exist");
        }
        else {
            var cnxn = self.connections[connectionId];
            cnxn.rx(data);
            cb({});
        }
    },
    
    getDevice: function(connectionId) {
        var self = this;
        if(self.connections.length <= connectionId) {
            throw new Error("Connection doesn't exist");
        }
        else {
            var device = self.connections[connectionId];
            return device;
        }

    },

    flush: function(connectionId, cb) {
        // this mock does no buffering so unnecessary
        cb(true);
    }
};

var arrayEquals = function(a1,a2) {
    return a1.length == a2.length && a1.every(function(e,i){return e == a2[i];});
};

describe("Test connection status", function() {
    var posixPath = "/dev/ttyUSB1";
    var winPath = "COM1";
    var testPaths = [posixPath,winPath];

    it("should report not connected while not connected",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        expect(chromeSerialPosix.isConnected()).toBe(false);
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        expect(chromeSerialWin.isConnected()).toBe(false);
    });
    
    it("should report connected after connecting",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        chromeSerialPosix.connect();
        expect(chromeSerialPosix.isConnected()).toBe(true);
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        chromeSerialWin.connect();
        expect(chromeSerialWin.isConnected()).toBe(true);
    });
    
    it("should report disconnected after disconnecting",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        chromeSerialPosix.connect();
        chromeSerialPosix.disconnect();
        expect(chromeSerialPosix.isConnected()).toBe(false);
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        chromeSerialWin.connect();
        chromeSerialWin.disconnect();
        expect(chromeSerialWin.isConnected()).toBe(false);
    });
    
    it("disconnect should not throw when called regardless of connection status multiple times",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        expect(function(){
            chromeSerialPosix.disconnect();}).not.toThrow();
        chromeSerialPosix.connect();
        chromeSerialPosix.disconnect();
        expect(function(){
            chromeSerialPosix.disconnect();}).not.toThrow();
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        expect(function(){
            chromeSerialWin.disconnect();}).not.toThrow();
        chromeSerialWin.connect();
        chromeSerialWin.disconnect();
        expect(function(){
            chromeSerialWin.disconnect();}).not.toThrow();
    });
    
    it("connect should not throw when called regardless of connection status multiple times",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        expect(function(){
            chromeSerialPosix.connect();}).not.toThrow();
        chromeSerialPosix.disconnect();
        chromeSerialPosix.connect();
        expect(function(){
            chromeSerialPosix.connect();}).not.toThrow();
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        expect(function(){
            chromeSerialWin.connect();}).not.toThrow();
        chromeSerialWin.connect();
        chromeSerialWin.disconnect();
        expect(function(){
            chromeSerialWin.connect();}).not.toThrow();
    });
});

describe("Test flushing", function() {
    var posixPath = "/dev/ttyUSB1";
    var winPath = "COM1";
    var testPaths = [posixPath,winPath];

    it("should throw when flush is called while not connected",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        var callPosix = function() { 
            chromeSerialPosix.flush(function() {});
        };
        expect(callPosix).toThrow();

        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        var callWin = function() {
            chromeSerialWin.flush(function() {});
        };
        expect(callWin).toThrow();
    });

    it("should not throw when not connected",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        chromeSerialPosix.connect();
        var callPosix = function() { 
            chromeSerialPosix.flush(function() {});
        };
        expect(callPosix).not.toThrow();

        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        chromeSerialWin.connect();
        var callWin = function() {
            chromeSerialWin.flush(function() {});
        };
        expect(callWin).not.toThrow();
    });

    it("should call flush callback after flushing",function() {
        var mockSerial = new MockSerial(testPaths);
        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        chromeSerialPosix.connect();
        var calledFlushPosix = false;
        chromeSerialPosix.flush(function() {
            calledFlushPosix = true;
        });
        expect(calledFlushPosix).toEqual(true);
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        chromeSerialWin.connect();
        var calledFlushWin = false;
        chromeSerialWin.flush(function() {
            calledFlushWin = true;
        });
        expect(calledFlushWin).toEqual(true);
    });
});

describe("Test rx/tx operations",function() {
    var posixPath = "/dev/ttyUSB1";
    var posixPath2 = "/dev/ttyUSB2";
    var winPath = "COM1";
    var winPath2 = "COM2";
    var testPaths = [posixPath,posixPath2,winPath,winPath2];
    it("should forward information received from the device",function() {
        var testData = [0x44,0x55,0x66,0x77,0x88];
        var mockSerial = new MockSerial(testPaths);

        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        var gotPosixData = false;
        chromeSerialPosix.setDataCallback(function(data) {
            expect(arrayEquals(data,testData)).toEqual(true);
            gotPosixData = true;
        });
        chromeSerialPosix.connect();
        var posixDevice = mockSerial.getDevice(chromeSerialPosix.connectionId);
        posixDevice.sendData((new Uint8Array(testData)).buffer);
        expect(gotPosixData).toEqual(true);

        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        var gotWinData = false;
        chromeSerialWin.setDataCallback(function(data) {
            expect(arrayEquals(data,testData)).toEqual(true);
            gotWinData = true;
        });
        chromeSerialWin.connect();
        var winDevice = mockSerial.getDevice(chromeSerialWin.connectionId);
        winDevice.sendData((new Uint8Array(testData)).buffer);
        expect(gotWinData).toEqual(true);
    });

    it("should not forward information received from wrong device",function() {
        var testData = [0x44,0x55,0x66,0x77,0x88];
        var mockSerial = new MockSerial(testPaths);

        var chromeSerialPosix = new ChromeSerial(posixPath,{serial: mockSerial});
        var chromeSerialPosix2 = new ChromeSerial(posixPath,{serial: mockSerial});
        chromeSerialPosix.setDataCallback(function(data) {
            fail("should not forward information rec'd from other device when disconnected");
        });
        chromeSerialPosix2.connect();
        var posixDevice2 = mockSerial.getDevice(chromeSerialPosix2.connectionId);
        posixDevice2.sendData((new Uint8Array(testData)).buffer);

        chromeSerialPosix.connect();
        chromeSerialPosix.setDataCallback(function(data) {
            fail("should not forward information rec'd from other device when connected");
        });
        posixDevice2.sendData((new Uint8Array(testData)).buffer);
        
        var chromeSerialWin = new ChromeSerial(winPath,{serial: mockSerial});
        var chromeSerialWin2 = new ChromeSerial(winPath,{serial: mockSerial});
        chromeSerialWin.setDataCallback(function(data) {
            fail("should not forward information rec'd from other device when disconnected");
        });
        chromeSerialWin2.connect();
        var winDevice2 = mockSerial.getDevice(chromeSerialWin2.connectionId);
        winDevice2.sendData((new Uint8Array(testData)).buffer);

        chromeSerialWin.connect();
        chromeSerialWin.setDataCallback(function(data) {
            fail("should not forward information rec'd from other device when connected");
        });
        winDevice2.sendData((new Uint8Array(testData)).buffer);
    });
    
});

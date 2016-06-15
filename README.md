Wrapper for using a Chrome packaged app serial port as a communicator
for Tappy devices.

## Installation
NPM
```
npm install @taptrack/tappy-chromeserialcommunicator
```

Bower
```
bower install tappy-chromeserialcommunciator
```

## Usage
Note that this wrapper is not intended to be used directly, rather
it is to be used to back a Tappy object in order to provide an 
abstraction from the underlying communication method.

```javascript
var path = "/dev/ttyUSB1";
var comm = new TappyChromeSerialCommunicator(path);
```

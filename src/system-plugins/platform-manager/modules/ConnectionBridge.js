var crc = require('crc');
var EventEmitter = require('events').EventEmitter;
var logger = require('AppFramework.js').logger;
var net = require('net');

function Bridge(socket_id) {
  var self = this;
  var bridge = new EventEmitter();
  var reader = new StatusReader();
  var emitRawSerial = false;
  var serialConnected = false;
  var serialPort = {};
  var lastWriteTime = new Date();

  bridge.isConnected = function(){
     return serialConnected;
  };

  bridge.connect = function () {
    serialPort = new net.Socket();
    //Work around for influx serialport changes while we have the dependencies moving around a bit.
    //Remove once the shrinkwrapped version matches the dev version api
    // if (SerialPort.parsers.Readline){
    //   Readline= SerialPort.parsers.Readline;
    //   parser=serialPort.pipe(Readline({delimiter: '\r\n'}));
    // }
    // if (SerialPort.parsers.ReadLine){
    //   Readline= SerialPort.parsers.ReadLine;
    //   parser=serialPort.pipe(Readline({delimiter: '\r\n'}));
    // }
    // if (SerialPort.parsers.readline){
    //   Readline= SerialPort.parsers.readline;
    //   parser=serialPort.pipe(Readline({delimiter: '\r\n'}));
    // }

    serialPort.connect(5432,'127.0.0.1', function() {
        serialConnected = true;
        console.log('port opened!');
    });

    serialPort.on('error',function(err){
          console.log('error ',err)
    });

    serialPort.on('close', function (data) {
        console.log('port closed!');
        serialConnected = false;
    });

    serialPort.on('data', function (data) {
    //     console.log("data: " + data); 
           var status = reader.parseStatus(data);
           if (status == null) return;
           bridge.emit('status', status);
    //     if (emitRawSerial) {
    //        bridge.emit('serial-recieved', data + '\n');
    //     }
    });

  };


  // This code intentionally spaces out the serial commands so that the buffer does not overflow
  bridge.write = function (command) {
    var crc8 = crc.crc81wire(command);
    var commandBuffer = new Buffer(command, 'utf8');
    var crcBuffer = new Buffer(1);
    crcBuffer[0] = crc8;
    var messagebuffer = Buffer.concat([
        crcBuffer,
        commandBuffer
      ]);
    if (serialConnected) {
      // console.log("Bridge Write: " + messagebuffer);
      var now = new Date();
      var delay = 3 - (now.getTime() - lastWriteTime.getTime());
      if (delay < 0) {
        delay = 0;
      }
      lastWriteTime = now;
      lastWriteTime.setMilliseconds(lastWriteTime.getMilliseconds + delay);
      setTimeout(function () {
        serialPort.write(messagebuffer);
        // if (emitRawSerial) {
        //   bridge.emit('serial-sent', command);
        // }
      }, delay);
    } else {
      logger.debug('DID NOT SEND');
    }
  };

  bridge.close = function () {
    if (!serialConnected){
      return;
    }
    serialConnected = false;
  };

  return bridge;
}

// Helper class for parsing status messages
var StatusReader = function () {
  var reader = new EventEmitter();
  var currTemp = 20;
  var currDepth = 0;
  var collectedString = "";
  var processSettings = function processSettings(parts) {
    var setparts = parts.split(',');
    var settingsCollection = {};
    for (var s = 0; s < setparts.length; s++) {
      var lastParts = setparts[s].split('|');
      settingsCollection[lastParts[0]] = lastParts[1];
    }
    reader.emit('firmwareSettingsReported', settingsCollection);
    return settingsCollection;
  };
  var processItemsInStatus = function processItemsInStatus(status) {
    if ('iout' in status) {
      status.iout = parseFloat(status.iout);
    }
    if ('btti' in status) {
      status.btti = parseFloat(status.btti);
    }
    if ('vout' in status) {
      status.vout = parseFloat(status.vout);
    }
  };
  reader.parseStatus = function parseStatus(rawStatus) {
    var position = 0;
    var status = {};
    // console.log("rawStatus: " + rawStatus);
    var rawStatusString = rawStatus.toString();
    // check if we have a complete "ENDUPDATE:1;" in this string yet
    // otherwise, wait for it
    collectedString = collectedString.concat(rawStatusString);
    // console.log("collectedString: " + collectedString);
    if ((position = collectedString.search("ENDUPDATE:1;")) == -1) return status;
    // now we have ENDUPDATE:1;
    // let's take any characters after ENDUPDATE:1; and save them for next time
    var processString = collectedString.substring(0,position+"ENDUPDATE:1;".length);
    collectedString = collectedString.substring(position+"ENDUPDATE:1;".length+1);
    // console.log("collectedString: " + collectedString);
    var parts = processString.split(';');
    for (var i = 0; i < parts.length; i++) {
      var subParts = parts[i].split(':');
      // console.log("subParts[0]: " + subParts[0] + " subParts[1]: " + subParts[1]);
      switch (subParts[0]) {
      case '*settings':
        status.settings = processSettings(subParts[1]);
        break;
      default:
        status[subParts[0]] = subParts[1];
      }
    }
    processItemsInStatus(status);
    return status;
  };
  return reader;
};
module.exports = Bridge;

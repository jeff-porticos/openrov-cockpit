(function () {
  function Laser(name, deps) {
    deps.logger.debug('Laser plugin loaded');
    this.globalBus  = deps.globalEventLoop;
    this.cockpitBus = deps.cockpit;
    var self = this;
    var claserstate = 0;
    // Cockpit
    deps.cockpit.on('plugin.laser.highLow', function (value) {
      sendHighLow(value);
    });
    deps.cockpit.on('plugin.laser.pids', function (value) {
      sendPIDs(value);
    });
    deps.cockpit.on('plugin.laser.thrusters', function (value) {
      sendThrusters(value);
    });
    deps.cockpit.on('plugin.laser.init', function (value) {
      sendInit(value);
    });
    var sendHighLow = function (state) {
      console.log(state);
      if (state == '0') {
        var settings = { mjpegVideo: { framerate:  " -framerate 10 ", resolution:  " -x 1280 -y 720 "  }};
        var value = { enabled: false };
      } else {
        var settings = { mjpegVideo: { framerate:  " -framerate 5 ", resolution:  " -x 1920 -y 1080 " } };
        var value = { enabled: true };
      }
      console.log(settings);
      self.cockpitBus.emit('plugin.laser.state', value);
      self.globalBus.emit('settings-change.mjpegVideo', settings);
    };
    var sendPIDs = function (state) {
    };
    var sendThrusters = function (state) {
      deps.globalEventLoop.emit('mcu.SendCommand', 'enable_thrusters(' + state + ')');
    };
    var sendInit = function (state) {
    };
  }

  module.exports = function (name, deps) {
    return new Laser(name, deps);
  };
}());

(function () {
  function Laser(name, deps) {
    deps.logger.debug('Laser plugin loaded');
    var claserstate = 0;
    // Cockpit
    deps.cockpit.on('plugin.laser.balance', function (value) {
      sendBalance(value);
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
    // Arduino
    deps.globalEventLoop.on('mcu.status', function (data) {
      if ('cbalance' in data) {
        var enabled = (data.cbalance != 0);
        deps.cockpit.emit('plugin.laser.state', { enabled: enabled ? true : false });
      }
    });
    var sendBalance = function (state) {
      deps.globalEventLoop.emit('mcu.SendCommand', 'start_balance(' + state + ')');
    };
    var sendPIDs = function (state) {
      deps.globalEventLoop.emit('mcu.SendCommand', 'enable_pids(' + state + ')');
    };
    var sendThrusters = function (state) {
      deps.globalEventLoop.emit('mcu.SendCommand', 'enable_thrusters(' + state + ')');
    };
    var sendInit = function (state) {
      deps.globalEventLoop.emit('mcu.SendCommand', 'init_balance(' + state + ')');
    };
  }
  module.exports = function (name, deps) {
    return new Laser(name, deps);
  };
}());

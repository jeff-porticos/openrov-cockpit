(function (window) {
  'use strict';
  var plugins = namespace('plugins');

  var Laser = function Laser(cockpit) {
    console.log("Loading laser plugin.");
    var self = this;
    self.cockpit = cockpit;
    
    self.highLow = {
      enabled: false
    };
    
    self.pidState = {
      enabled: false
    };
    
    self.thrusterState = {
      enabled: false
    };
    
    self.initState = {
      enabled: false
    };
    

    this.actions = 
    {
      "plugin.laser.highLow":
      {
        description: 'Toggle camera resolution between HIGH and LOW',
        controls:
        {
          button:
          {
            down: function() {
              cockpit.rov.emit('plugin.laser.highLow', self.highLow.enabled == true ? 0 : 1);
              self.highLow.enabled = !self.highLow.enabled;
            }            
          }
        }
      },
      "plugin.laser.thrusters":
      {
        description: 'Toggle thruster control',
        controls:
        {
          button:
          {
            down: function() {
              cockpit.rov.emit('plugin.laser.thrusters', self.thrusterState.enabled == true ? 0 : 1);
              self.thrusterState.enabled = !self.thrusterState.enabled;
            }            
          }
        }
      },
      "plugin.laser.pids":
      {
        description: 'Toggle depth/balance control PIDs',
        controls:
        {
          button:
          {
            down: function() {
              cockpit.rov.emit('plugin.laser.pids', self.pidState.enabled == true ? 0 : 1);
              self.pidState.enabled = !self.pidState.enabled;
            }            
          }
        }
      },
      "plugin.laser.init":
      {
        description: 'Toggle initialization state of depth/balance control',
        controls:
        {
          button:
          {
            down: function() {
              cockpit.rov.emit('plugin.laser.init', self.initState.enabled == true ? 0 : 1);
              self.initState.enabled = !self.initState.enabled;
            }            
          }
        }
      }
    };

    this.inputDefaults = 
    {
      keyboard:
      {
        "t": { type: "button",
               action: "plugin.laser.highLow" }
      },
      gamepad:
      {
        "START": { type: "button",
               action: "plugin.laser.highLow" }
      }
    };
    
  };
  
  plugins.Laser = Laser;

  plugins.Laser.prototype.getTelemetryDefinitions = function getTelemetryDefinitions() {
    return [{
        name: 'highLow',
        description: 'Current camera resolution (HIGH or LOW)'
      }];
  };
  //This pattern will hook events in the cockpit and pull them all back
  //so that the reference to this instance is available for further processing
  plugins.Laser.prototype.listen = function listen() {
    var self = this;
    /* Forward calls on the COCKPIT emitter to the ROV  */
    self.cockpit.on('plugin.laser.highLow', function (value) {
      cockpit.rov.emit('plugin.laser.highLow', value);
    });
    self.cockpit.on('plugin.laser.set', function (value) {
      cockpit.rov.emit('plugin.laser.set', value);
    });
    self.cockpit.rov.withHistory.on('plugin.laser.state', function (state) {
      self.highLow.enabled = state.enabled;
      cockpit.emit('plugin.laser.state', state);
    });
  };
  window.Cockpit.plugins.push(plugins.Laser);
}(window));

(function (window) {
  'use strict';
  var plugins = namespace('plugins');

  var Laser = function Laser(cockpit) {
    console.log("Loading laser plugin.");
    var self = this;
    self.cockpit = cockpit;
    
    self.balanceState = {
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
      "plugin.laser.balance":
      {
        description: 'Toggle automatic depth/balance control',
        controls:
        {
          button:
          {
            down: function() {
              cockpit.rov.emit('plugin.laser.balance', self.balanceState.enabled == true ? 0 : 1);
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
               action: "plugin.laser.balance" }
      },
      gamepad:
      {
        "START": { type: "button",
               action: "plugin.laser.balance" }
      }
    };
    
  };
  
  plugins.Laser = Laser;

  plugins.Laser.prototype.getTelemetryDefinitions = function getTelemetryDefinitions() {
    return [{
        name: 'cbalance',
        description: 'Auto depth/balance algorithm state'
      }];
  };
  //This pattern will hook events in the cockpit and pull them all back
  //so that the reference to this instance is available for further processing
  plugins.Laser.prototype.listen = function listen() {
    var self = this;
    /* Forward calls on the COCKPIT emitter to the ROV  */
    self.cockpit.on('plugin.laser.set', function (value) {
      cockpit.rov.emit('plugin.laser.set', value);
    });
    self.cockpit.rov.withHistory.on('plugin.laser.state', function (data) {
      self.laserState = data;
      cockpit.emit('plugin.laser.state', data);
    });
  };
  window.Cockpit.plugins.push(plugins.Laser);
}(window));

(function() 
{
    const Periodic = require( 'Periodic' );
    const Listener = require( 'Listener' );
    const Notifier = require( 'node-notifier' );

    // Encoding helper functions
    function encode( floatIn )
    {
        return parseInt( floatIn * 1000 );
    }

    function decode( intIn )
    {
        return ( intIn * 0.001 );
    }

    class ExternalLights
    {
        constructor(name, deps)
        {
            deps.logger.debug( 'ExternalLights plugin loaded' );

            this.globalBus  = deps.globalEventLoop;
            this.cockpitBus = deps.cockpit;

            this.targetPower          = 0;
            this.targetPower_enc      = 0;
            this.mcuTargetPower_enc   = 0;
            this.selectedPhoto        = 0;
            this.selectedLight        = 0;
            this.mcuSelectedLight     = 0;
            this.mcuSelectedPhoto     = 0;

            var self = this;

            this.SyncTargetPower = new Periodic( 500, "timeout", function()
            {
                var synced = true;

                // update selected Camera to snap
                if( self.selectedPhoto !== 0)
                {
                    synced = false;

                    // Encode floating point to integer representation
                    var command = 'ephoto_select(' + self.selectedPhoto + ')';

                    // Emit command to mcu
                    self.globalBus.emit( 'mcu.SendCommand', command );
                    self.selectedPhoto = 0;
                    Notifier.notify('Still image snapped from camera');
                }

                // update selected active LED
                if( self.mcuSelectedLight !== self.selectedLight )
                {
                    // Encode floating point to integer representation
                    var command = 'elights_select(' + self.selectedLight + ')';

                    // Emit command to mcu
                    self.globalBus.emit( 'mcu.SendCommand', command );
                    // force immediate synchronization
                    self.mcuSelectedLight = self.selectedLight;
                }


                // Send target power to MCU until it responds with affirmation
                if( self.mcuTargetPower_enc !== self.targetPower_enc )
                {
                    synced = false;

                    // Encode floating point to integer representation
                    var command = 'elights_tpow(' + self.targetPower_enc + ')';

                    // Emit command to mcu
                    self.globalBus.emit( 'mcu.SendCommand', command );
                }

                if( synced )
                {
                    // No need to continue
                    self.SyncTargetPower.stop();
                }
            });

            this.listeners = 
            {
                settings: new Listener( this.globalBus, 'settings-change.external-lights', true, function( settings )
                {
                    // Apply settings
                    self.settings = settings.lights;
                    
                    // Emit settings update to cockpit
                    self.cockpitBus.emit( 'plugin.externalLights.settingsChange', self.settings );

                    // Enable MCU Status listener
                    self.listeners.mcuStatus.enable();

                    // Enable API
                    self.listeners.setTargetPower.enable();
                    self.listeners.setSelectedLight.enable();
                    self.listeners.setSelectedPhoto.enable();
                }),

                mcuStatus: new Listener( this.globalBus, 'mcu.status', false, function( data )
                {
                    // Current light power
                    if( 'elights_pow' in data ) 
                    {
                        // Convert from integer to float
                        var power = decode( parseInt( data.elights_pow ) );

                        // Emit on cockpit bus for UI purposes
                        self.cockpitBus.emit( 'plugin.externalLights.currentPower', power );
                    }

                    if( 'elights_select' in data ) 
                    {
                        // Save for sync validation purposes
                        self.mcuSelectedLight = parseInt( data.elights_select );
                    }

                    if( 'ephoto_select' in data ) 
                    {
                        // Save for sync validation purposes
                        self.mcuSelectedPhoto = parseInt( data.ephoto_select );
                    }

                    // Target light power
                    if( 'elights_tpow' in data ) 
                    {
                        // Save encoded version for sync validation purposes
                        self.mcuTargetPower_enc = parseInt( data.elights_tpow );

                        // Convert from integer to float
                        var power = decode( self.mcuTargetPower_enc );

                        // Emit the real target power on the cockpit bus for UI purposes
                        self.cockpitBus.emit( 'plugin.externalLights.targetPower', power );
                    }
                }),

                setTargetPower: new Listener( this.cockpitBus, 'plugin.externalLights.setTargetPower', false, function( powerIn )
                {
                    // Set new target Power
                    self.setTargetPower( powerIn );
                }),

                setSelectedLight: new Listener( this.cockpitBus, 'plugin.externalLights.setSelectedLight', false, function( selectedLight )
                {
                    // the original string is now a number
                    // Set new active LED
                    self.setSelectedLight( selectedLight );
                }),

                setSelectedPhoto: new Listener( this.cockpitBus, 'plugin.externalLights.setSelectedPhoto', false, function( selectedPhoto )
                {
                    // the original string is now a number
                    // Set new active LED
                    self.setSelectedPhoto( selectedPhoto );
                })
            
            }
        }

        setSelectedPhoto( selectedPhoto )
        {
            var self = this;

            // Validate input
            if( isNaN( selectedPhoto ) )
            {
              // Ignore
              return;
            }

            self.selectedPhoto = selectedPhoto;

            self.SyncTargetPower.start();
        }
        
        setSelectedLight( selectedLight )
        {
            var self = this;

            // Validate input
            if( isNaN( selectedLight ) )
            {
              // Ignore
              return;
            }

            self.selectedLight = selectedLight;

            self.SyncTargetPower.start();
        }
        
        setTargetPower( powerIn )
        {
            var self = this;

            // Validate input
            if( isNaN( powerIn ) )
            {
              // Ignore
              return;
            }

            // Apply limits
            if( powerIn > 1.0 )
            {
                self.targetPower = 1.0;
            }
            else if( powerIn < 0 )
            {
                self.targetPower = 0;
            }
            else
            {
                self.targetPower = powerIn;
            }

            self.targetPower_enc = encode( self.targetPower );

            // Start targetPower sync, if not already running
            self.SyncTargetPower.start();
        }
        
        start()
        {
          this.listeners.settings.enable();
        }

        stop()
        {
          this.listeners.settings.disable();
          this.listeners.mcuStatus.disable();
          this.listeners.setTargetPower.disable();
          this.listeners.setSelectedLight.disable();
          this.listeners.setSelectedPhoto.disable();
        }

        getSettingSchema()
        {
            //from http://json-schema.org/examples.html
            return [{
                'title': 'External Lights',
                'type': 'object',
                'id': 'external-lights',
                'managedBy': '_hidden',
                'properties': {},
                'required': []
            }];
        }
    }

    module.exports = function(name, deps) 
    {
        if( process.env.PRODUCTID == "trident" )
        {
            deps.logger.debug( "External Lights Not supported on trident" );
            return {};
        }

        return new ExternalLights(name, deps);
    };
}());

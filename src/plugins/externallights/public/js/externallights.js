(function(window) 
{
    'use strict';
    class ExternalLights 
    {
        constructor( cockpit )
        {
            console.log('ExternalLights Plugin running');

            var self = this;
            self.cockpit = cockpit;

            self.settings = null;     // These get sent by the local model

            self.currentPower = 0.0;  // As reported by the local model
            self.targetPower = 0.0;   // As requested by this plugin
            self.selectedLight = 0;   
            self.lastSelectedLight = 0;   

            // Alternate representations of targetPower
            self.currentStep = 0;     
            self.isOn        = false;
            self.areAllOn    = false;

            self.stepMap =
            {
                "0": 0.0,
                "1": 0.1,
                "2": 0.2,
                "3": 0.3,
                "4": 0.4,
                "5": 0.5,
                "6": 0.6,
                "7": 0.7,
                "8": 0.8,
                "9": 0.9,
                "10": 1.0,
                "min": 0,
                "max": 10
            }

            self.actions = 
            {
                "plugin.externalLights.stepPositive":
                {
                    description: 'Increase External Light Brightness',
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.stepPositive' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.stepNegative":
                {
                    description: "Decrease External Light Brightness",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.stepNegative' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.toggle":
                {
                    description: "Toggle External Light",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.toggle' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.toggleAll":
                {
                    description: "Toggle All External Lights",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.toggleAll' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.topCamera":
                {
                    description: "Select Top Camera",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.topCamera' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.bottomCamera":
                {
                    description: "Select Bottom Camera",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.bottomCamera' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.sideCamera":
                {
                    description: "Select Side Camera",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.sideCamera' );
                            }                            
                        }
                    }
                },
                "plugin.externalLights.frontCamera":
                {
                    description: "Select Front Camera",
                    controls:
                    {
                        button:
                        {
                            down: function() {
                                cockpit.emit( 'plugin.externalLights.frontCamera' );
                            }                            
                        }
                    }
                }
            };

            // Setup input handlers
            self.inputDefaults = 
            {
                keyboard:
                {
                    "+": { type: "button",
                           action: "plugin.externalLights.stepPositive" },
                    "_": { type: "button",
                           action: "plugin.externalLights.stepNegative" },
                    "shift+o": { type: "button",
                           action: "plugin.externalLights.toggle" },
                    "shift+a": { type: "button",
                           action: "plugin.externalLights.toggleAll" }
                },
                gamepad:
                {
                    "DPAD_UP": { type: "button",
                           action: 'plugin.externalLights.stepPositive' },
                    "DPAD_DOWN": { type: "button",
                           action: 'plugin.externalLights.stepNegative' },
                    "DPAD_LEFT": { type: "button",
                           action: 'plugin.externalLights.toggle' },
                    "DPAD_RIGHT": { type: "button",
                           action: 'plugin.externalLights.toggleAll' },
                    "Y": { type: "button",
                           action: 'plugin.externalLights.topCamera' },
                    "A": { type: "button",
                           action: 'plugin.externalLights.bottomCamera' },
                    "X": { type: "button",
                           action: 'plugin.externalLights.sideCamera' },
                    "B": { type: "button",
                           action: 'plugin.externalLights.frontCamera' }
                }

            };
        };

        updateFromStep()
        {
            // Update state
            if( this.currentStep != 0 )
            {
                this.isOn = true;
            }
            else
            {
                this.isOn = false;
            }

            // Update current power
            this.targetPower = this.stepMap[ this.currentStep ];

            // Send request to local model
            this.cockpit.rov.emit( 'plugin.externalLights.setTargetPower', this.targetPower );
        }

        updateFromState()
        {
            // Update step and power
            if( this.isOn )
            {
                this.currentStep = this.stepMap.max;
            }
            else
            {
                this.currentStep = this.stepMap.min;
            }

            this.targetPower = this.stepMap[ this.currentStep ];

            // Send request to local model
            this.cockpit.rov.emit( 'plugin.externalLights.setTargetPower', this.targetPower );
        }

        updateFromSelectedLight()
        {
            // Send request to local model
            this.cockpit.rov.emit( 'plugin.externalLights.setSelectedLight', this.selectedLight );
        }

        updateFromPower()
        {
            // Update step and state
            if( this.targetPower > 0.0 )
            {
                this.isOn = true;
            }
            else
            {
                this.isOn = false;
            }

            // Calculate closest step
            if( this.targetPower < 1.0 )
            {
                this.currentStep = Math.floor( this.targetPower / 0.1 )
            }
            else
            {
                this.currentStep = this.stepMap.max;
            }

            // Send request to local model
            this.cockpit.rov.emit( 'plugin.externalLights.setTargetPower', this.targetPower );
        }

        stepPositive()
        {
            this.currentStep++;

            // Bound
            if( this.currentStep > this.stepMap.max )
            {
                this.currentStep = this.stepMap.max;
            }

            this.updateFromStep();
        }

        stepNegative()
        {
            this.currentStep--;

            // Bound
            if( this.currentStep < this.stepMap.min )
            {
                this.currentStep = this.stepMap.min;
            }

            this.updateFromStep();
        }

        allOff()
        {
            // Only Update the "all" state
            this.areAllOn = false;
            // revert to last active tab
            this.selectedLight = this.lastSelectedLight;
            this.updateFromSelectedLight();
        }

        allOn()
        {    
            // indicate LED state is on as well as the allOn state
            this.on();
            // Update boolean rep
            this.areAllOn = true;
            // selected light 0 is all lights
            this.selectedLight = 0;
            this.updateFromSelectedLight();
        }

        off()
        {
            // Update boolean rep
            this.isOn = false;

            this.updateFromState();
        }

        on()
        {    
            // Update boolean rep
            this.isOn = true;

            this.updateFromState();
        }

        toggleAll()
        {
            if( this.isAllOn === false )
            {
                this.allOn();
            }
            else
            {
                this.allOff();
            }
        }

        toggle()
        {
            if( this.isOn === false )
            {
                this.on();
            }
            else
            {
                this.off();
            }
        }

        getTelemetryDefinitions()
        {
            return [
            {
                name: 'externalLights.currentPower',
                description: 'Light power as a percent'
            },
            {
                name: 'externalLights.targetPower',
                description: 'Requested light power as a percent'
            }]
        };

        // This pattern will hook events in the cockpit and pull them all back
        // so that the reference to this instance is available for further processing
        listen() 
        {
            var self = this;

            // Listen for settings from the local model
            this.cockpit.rov.withHistory.on('plugin.externalLights.settingsChange', function(settings)
            {
                // Copy settings
                self.settings = settings;
            });

            // Local Model currentPower
            this.cockpit.rov.withHistory.on('plugin.externalLights.currentPower', function( power )
            {
                // Update 
                self.currentPower = power;
                
                self.cockpit.emit( 'plugin.externalLights.currentPower', power );
            });

            // Local Model targetPower
            this.cockpit.rov.withHistory.on('plugin.externalLights.targetPower', function( power )
            {
                self.cockpit.emit( 'plugin.externalLights.targetPower', power );
            });

            // API functions

            // stepPositive
            this.cockpit.on('plugin.externalLights.stepPositive', function()
            {
                self.stepPositive();
            });

            // stepNegative
            this.cockpit.on('plugin.externalLights.stepNegative', function()
            {
                self.stepNegative();
            });

            // Off
            this.cockpit.on('plugin.externalLights.off', function()
            {
                self.off();
            });

            // On
            this.cockpit.on('plugin.externalLights.on', function()
            {
                self.on();
            });

            // Toggle
            this.cockpit.on('plugin.externalLights.toggle', function()
            {
                self.toggle();
            });

            // Toggle all lights
            this.cockpit.on('plugin.externalLights.toggleAll', function()
            {
                self.toggleAll();
            });

            // setTargetPower
            this.cockpit.on('plugin.externalLights.setTargetPower', function( power )
            {
                self.targetPower = power;
                self.updateFromPower();
            });

            this.cockpit.on('plugin.externalLights.setSelectedLight', function( selectedLight )
            {
                // a string "Camera N" will be delivered
                console.log("selectedLight: " + selectedLight);
                var numberStr = selectedLight.substr(selectedLight.length -1)
                // Set new active LED
                self.selectedLight =  Number(numberStr);
                this.lastSelectedLight = this.selectedLight;
                self.updateFromSelectedLight();
            });

        };
    };

    // Add plugin to the window object and add it to the plugins list
    var plugins = namespace('plugins');
    plugins.ExternalLights = ExternalLights;
    window.Cockpit.plugins.push( plugins.ExternalLights );

}(window));

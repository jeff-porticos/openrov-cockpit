(function() 
{
    const os        = require( "os" );
    const net       = require( "net" );
    const fs        = require('fs');
    const respawn   = require('respawn');
    const util      = require('util');
    const io        = require('socket.io-client');
    const assert    = require('assert');
    const Listener  = require( 'Listener' );

    var logger;
    var defaults = 
    {
        port: 8090,
        wspath: '/mjpeg'
    };

    class MjpgStreamer
    {
        constructor( name, deps )
        {
            logger = deps.logger;
            
            logger.info( "Loaded Cockpit Plugin: MjpgStreamer", name, "deps: ", deps );

            this.globalBus  = deps.globalEventLoop;
            this.cockpitBus = deps.cockpit;

            this.runVideo0   = false;
            this.runVideo1   = false;
            this.runVideo2   = false;
            this.runVideo3   = false;
            this.settings    = {};
            this.camera      = null;
            this.disabled    = false;
            this.supervisor  = undefined;
            this.supervisorB = undefined;

            this.supervisorLaunchOptions = 
            [
                "nice",
                "-1",
                "node",
                require.resolve( 'mjpeg-video-server' ),
                "-p",
                defaults.port
            ];
//                "-c",
//                "/etc/openrov/STAR_openrov_net.chained.crt",
//                "-k",
//                "/etc/openrov/star_openrov_net.key"

            // Handle mock options
            if( process.env.USE_MOCK === 'true' ) 
            {
                if( process.env.MOCK_VIDEO_TYPE === "MJPEG" )
                {
                    logger.info( "Using MJPEG video format in Mock Mode.");

                    this.supervisorLaunchOptions.push( '-m' );
                    this.supervisorLaunchOptions.push( 'true' );

                    if( process.env.MOCK_VIDEO_HARDWARE === 'false' )
                    {
                        logger.info( "Using actual MJPEG video source.");

                        this.supervisorLaunchOptions.push( '-h' );
                        this.supervisorLaunchOptions.push( 'true' );
                    }
                    else
                    {
                        logger.info( "Using mocked MJPEG video source.");
                    }
                }
                else
                {
                    this.disabled = true;
                    return;
                }
            }

            var hostIP = this.getExternalIp();
            var connectIP = "http://" + hostIP + ':' + defaults.port;
            logger.info("this.supervisor: ", connectIP);
            this.supervisor = io.connect( connectIP,
            {
                path: defaults.wspath,
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000
            });


            logger.info("this.supervisor: ", this.supervisor.id);
            // connect to 'B' supervisor if this is the 'A' PI
            // so that we can enable and disable the B side cameras
            var hostname = os.hostname();
            logger.info( "HOSTNAME: " + hostname);
            if (hostname.indexOf("B") === -1) {

                var thisIP = this.getExternalIp();
                // get the last number group
                var index = this.getPosition(thisIP,".",3);
                // get the value of that last number group
                var id = thisIP.substring(index+1);
                var baseIP = thisIP.substring(0,index+1);
                // change a string to an integer
                var value = parseInt(id);
                // add one
                value = value+1;
                // now build a new IP address
                var newIP = baseIP + value.toString();
                // now build a new IP address
                logger.info( "HTTP B Camera IP: " + newIP);
                var newConnectIP = "http://" + newIP + ':' + defaults.port;
                logger.info( "HTTP B Camera IP: " + newConnectIP);
                this.supervisorB = io.connect( newConnectIP,
                {
                    path: defaults.wspath,
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 1000
                });
                logger.info("this.supervisorB: ", this.supervisorB.id);

            }


            this.svMonitor = respawn( this.supervisorLaunchOptions, 
            {
                name: 'mjpeg-video-server',
                env: 
                {
                    'COCKPIT_PATH': process.env[ "COCKPIT_PATH" ],
                    'DEBUG': 'app*'
                },
                maxRestarts: -1,
                sleep: 1000
            });
            logger.info("this.svMonitor: ", this.svMonitor);
            logger.info("this.cockpitBus: ", this.cockpitBus);
            logger.info("this.globalBus: ", this.globalBus );

            this.svMonitor.on( "stdout", (data) =>
            {
                logger.debug( data.toString() );
            });

            this.svMonitor.on( "stderr", (data) =>
            {
                logger.debug( data.toString() );
            });      

            if (this.supervisorB !== undefined) {
                this.listenersB = 
                {
                    svBConnect: new Listener( this.supervisorB, 'connect', false, () =>
                    {
                        logger.info( 'Successfully connected to mjpg-streamer supervisor B', this.supervisorB );

                    }),

                    svBDisconnect: new Listener( this.supervisorB, 'disconnect', false, function()
                    {
                        logger.info( 'Disconnected from mjpg-streamer supervisor B: ' + this.supervisorB );
                    }),

                    svBConnectError: new Listener( this.supervisorB, 'connect_error', false, function(err)
                    {
                        logger.error(err, 'Mjpg-streamer supervisor B connection error' );
                    }),

                    svBError: new Listener( this.supervisorB, 'error', false, function(err)
                    {
                        logger.error(err, 'Mjpg-streamer supervisor B error' );
                    }),

                    svBReconnect: new Listener( this.supervisorB, 'reconnect', false, function()
                    {
                        logger.info('Reconnecting to mjpg-streamer supervisor B... ', this.supervisorB);
                    })
                }
            }

            // Set up listeners
            this.listeners = 
            {
                settings: new Listener( this.globalBus, 'settings-change.mjpegVideo', true, (settings) =>
                {
                    try
                    {
                        // Check for settings changes
                        assert.notDeepEqual( settings.mjpegVideo, this.settings );

                        // Update settings
                        this.settings = settings.mjpegVideo;

                        logger.info( `Updating MJPEG streamer settings to: \n${this.settings}` );

                        // Send update to supervisor so it restarts the stream
                        this.supervisor.emit( "updateSettings", this.settings );
                        if (this.supervisorB !== undefined) {
                            this.supervisorB.emit( "updateSettings", this.settings );
                        }
                    }
                    catch( err )
                    {
                        logger.info("mjpeg-streamer settings-change error: " + err);
                    }
                }),

                scanForCameras: new Listener( this.cockpitBus, "plugin.mjpegVideo.scanForCameras", false, function(runVideo0, runVideo1, runVideo2, runVideo3)
                {
                    try
                    {
                        logger.info( "mjpeg-streamer Scanning: ", this.supervisor );
                        this.runVideo0 = runVideo0;
                        this.runVideo1 = runVideo1;
                        this.runVideo2 = runVideo2;
                        this.runVideo3 = runVideo3;
                        this.supervisor.emit( "scan", this.runVideo0, this.runVideo1 );
                        logger.info( "mjpeg-streamer Scanning B: ", this.supervisorB );
                        if (this.supervisorB !== undefined) {
                            this.supervisorB.emit( "scan", this.runVideo2, this.runVideo3 );
                        }
                    }
                    catch( err )
                    {
                        logger.info("mjpeg-streamer scanForCameras error: " + err);
                    }
                }.bind(this)),

                svConnect: new Listener( this.supervisor, 'connect', false, () =>
                {
                    logger.info( 'Successfully connected to mjpg-streamer supervisor ', this.supervisor );

                    // Start listening for settings changes (gets the latest settings)
                    this.listeners.settings.enable();
                }),

                svDisconnect: new Listener( this.supervisor, 'disconnect', false, function()
                {
                    logger.info( 'Disconnected from mjpg-streamer supervisor: ' + this.supervisor );
                }),

                svConnectError: new Listener( this.supervisor, 'connect_error', false, function(err)
                {
                    logger.error(err, 'Mjpg-streamer supervisor connection error' );
                }),

                svError: new Listener( this.supervisor, 'error', false, function(err)
                {
                    logger.error(err, 'Mjpg-streamer supervisor error' );
                }),

                svReconnect: new Listener( this.supervisor, 'reconnect', false, function()
                {
                    logger.info('Reconnecting to mjpg-streamer supervisor... ', this.supervisor);
                }),


                svStreamRegistration: new Listener( this.supervisor, 'stream.registration', false, ( serial, info ) =>
                {
                    logger.info('mjpeg-streamer stream registration: ' + JSON.stringify(info) );
                    logger.info('mjpg-streamer stream registration... ' + this.supervisor);
                    var relativeServiceUrl = null;
                    if (info.relativeServiceUrl !== null) {
                       relativeServiceUrl = info.relativeServiceUrl;
                    } else {
                       relativeServiceUrl = `:${info.port}`;
                    }

                    this.globalBus.emit( 'CameraRegistration', 
                    {
                        location:           "forward",               // TODO: Lookup location based on serial ID
                        videoMimeType: 	    "video/x-motion-jpeg",
                        resolution:         info.resolution,
                        framerate:          info.framerate, 
                        wspath:             "",
                        relativeServiceUrl: relativeServiceUrl,
                        sourcePort:         info.port,
                        sourceAddress:      "",
                        connectionType:     info.connectionType,
                        cameraName:         info.cameraName,
                        cameraID:           info.cameraID
                    });
                })
            }
        }

        start()
        {
            logger.info("start mjpg-streamer supervisor: ", this.disabled);
            logger.info('mjpg-streamer stream start... ', this.supervisor);
            if( this.disabled )
            {
                return;
            }

            // Enable listeners
            this.listeners.svConnect.enable();
            this.listeners.svDisconnect.enable();
            this.listeners.svError.enable();
            this.listeners.svReconnect.enable();
            this.listeners.svStreamRegistration.enable();

            if (this.supervisorB !== undefined) {
                this.listenersB.svBConnect.enable();
                this.listenersB.svBDisconnect.enable();
                this.listenersB.svBError.enable();
                this.listenersB.svBReconnect.enable();
            }

            this.listeners.scanForCameras.enable();

            // Start the supervisor process
            this.svMonitor.start();
        }

        stop()
        {
            logger.info("stop mjpg-streamer supervisor: ", this.disabled);
            if( this.disabled )
            {
                return;
            }
            
            // Stop the supervisor process
            this.svMonitor.stop();

            // Disable all listeners
            for( var listener in this.listeners ) 
            {
                if( this.listeners.hasOwnProperty( listener ) ) 
                {
                    listener.disable();
                }
            }

            if (this.supervisorB !== undefined) {
                for( var listener in this.listenersB ) 
                {
                    if( this.listeners.hasOwnProperty( listener ) ) 
                    {
                        listener.disable();
                    }
                }
            }
        }

        getSettingSchema()
        {
            return [
            {
                'title':    'MJPEG Video',
                'type':     'object',
                'id':       'mjpegVideo',
                'category' : 'video',
                'managedBy': 'nobody',
                'properties': {
                    'framerate': 
                    {
                        'type': 'string',
                        'enum': 
                        [
                            ' -framerate 30 ',
                            ' -framerate 15 ',
                            ' -framerate 10 ',
                            ' -framerate 5 '
                        ],
                        'title': 'Framerate (FPS)',
                        'default': ' -framerate 10 '
                    },
                    'resolution': 
                    {
                        'type': 'string',
                        'enum': 
                        [
                            ' -x 1920 -y 1080 ',
                            ' -x 1280 -y 720 ',
                            ' -x 800 -y 600 ',
                            ' -x 640 -y 480 ',
                            ' -x 352 -y 288 ',
                            ' -x 320 -y 240 ',
                            ' -x 176 -y 144 ',
                            ' -x 160 -y 120 '
                        ],
                        'title': 'Resolution',
                        'default': ' -x 1280 -y 720 '
                    }                    
                },

                'required': 
                [
                    'framerate',    // Framerate setting for camera
                    'resolution'    // Resolution setting for camera
                ]
            }];
        }

        getExternalIp()
        {
            var ifconfig = os.networkInterfaces();
            var device, i, I, protocol;

            for (device in ifconfig) {
                // ignore loopback interface
                if (device.indexOf('lo') !== -1 || !ifconfig.hasOwnProperty(device)) {
                    continue;
                }

                for (i = 0, I=ifconfig[device].length; i < I; i++) {
                    protocol = ifconfig[device][i];
                    // filter for external IPv4 addresses
                    if (protocol.family === 'IPv4' && protocol.internal === false) {
                       return protocol.address;
                    }
                }
            }
        }

        getPosition(string, subString, index)
        {
            return string.split(subString, index).join(subString).length;
        }

    }

    module.exports = function( name, deps ) 
    {
        if( process.env.PRODUCTID == "trident" )
        {
            deps.logger.info( "MjpgStreamer Not supported on trident" );
            return {};
        }
        deps.logger.info("new mjpg-streamer supervisor");

        return new MjpgStreamer( name, deps );
    };
}());

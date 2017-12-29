/*
  Running this within a function prevents leaking variables
  in to the global namespace.
*/
(function (window) {
  'use strict';
  var widgets = namespace('widgets');
  widgets['orov-video1'] = {
    name: 'orov-video1',
    defaultUISymantic: 'data-control-unit',
    url: 'video/video1.html'
  };
  widgets['orov-video2'] = {
    name: 'orov-video2',
    defaultUISymantic: 'data-control-unit',
    url: 'video/video2.html'
  };
  widgets['orov-video3'] = {
    name: 'orov-video3',
    defaultUISymantic: 'data-control-unit',
    url: 'video/video3.html'
  };
  widgets['orov-video4'] = {
    name: 'orov-video4',
    defaultUISymantic: 'data-control-unit',
    url: 'video/video4.html'
  };
}  // The line below both ends the anonymous function and then calls
   // it passing in the required depenencies.
(window));

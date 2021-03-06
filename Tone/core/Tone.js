/**
 *  Tone.js
 *  @author Yotam Mann
 *  @license http://opensource.org/licenses/MIT MIT License
 *  @copyright 2014-2015 Yotam Mann
 */
define(function(){

	"use strict";

	//////////////////////////////////////////////////////////////////////////
	//	WEB AUDIO CONTEXT
	///////////////////////////////////////////////////////////////////////////

	//borrowed from underscore.js
	function isUndef(val){
		return val === void 0;
	}

	//borrowed from underscore.js
	function isFunction(val){
		return typeof val === "function";
	}

	var audioContext;

	//polyfill for AudioContext and OfflineAudioContext
	if (isUndef(window.AudioContext)){
		window.AudioContext = window.webkitAudioContext;
	} 
	if (isUndef(window.OfflineAudioContext)){
		window.OfflineAudioContext = window.webkitOfflineAudioContext;
	} 

	if (!isUndef(AudioContext)){
		audioContext = new AudioContext();
	} else {
		throw new Error("Web Audio is not supported in this browser");
	}

	//SHIMS////////////////////////////////////////////////////////////////////

	if (!isFunction(AudioContext.prototype.createGain)){
		AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
	}
	if (!isFunction(AudioContext.prototype.createDelay)){
		AudioContext.prototype.createDelay = AudioContext.prototype.createDelayNode;
	}
	if (!isFunction(AudioContext.prototype.createPeriodicWave)){
		AudioContext.prototype.createPeriodicWave = AudioContext.prototype.createWaveTable;
	}
	if (!isFunction(AudioBufferSourceNode.prototype.start)){
		AudioBufferSourceNode.prototype.start = AudioBufferSourceNode.prototype.noteGrainOn;
	}
	if (!isFunction(AudioBufferSourceNode.prototype.stop)){
		AudioBufferSourceNode.prototype.stop = AudioBufferSourceNode.prototype.noteOff;
	}
	if (!isFunction(OscillatorNode.prototype.start)){
		OscillatorNode.prototype.start = OscillatorNode.prototype.noteOn;
	}
	if (!isFunction(OscillatorNode.prototype.stop)){
		OscillatorNode.prototype.stop = OscillatorNode.prototype.noteOff;	
	}
	if (!isFunction(OscillatorNode.prototype.setPeriodicWave)){
		OscillatorNode.prototype.setPeriodicWave = OscillatorNode.prototype.setWaveTable;	
	}
	//extend the connect function to include Tones
	AudioNode.prototype._nativeConnect = AudioNode.prototype.connect;
	AudioNode.prototype.connect = function(B, outNum, inNum){
		if (B.input){
			if (Array.isArray(B.input)){
				if (isUndef(inNum)){
					inNum = 0;
				}
				this.connect(B.input[inNum]);
			} else {
				this.connect(B.input, outNum, inNum);
			}
		} else {
			try {
				if (B instanceof AudioNode){
					this._nativeConnect(B, outNum, inNum);
				} else {
					this._nativeConnect(B, outNum);
				}
			} catch (e) {
				throw new Error("error connecting to node: "+B);
			}
		}
	};

	///////////////////////////////////////////////////////////////////////////
	//	TONE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  @class  Tone is the base class of all other classes.  
	 *  
	 *  @constructor
	 *  @alias Tone
	 *  @param {number} [inputs=1] the number of input nodes
	 *  @param {number} [outputs=1] the number of output nodes
	 */
	var Tone = function(inputs, outputs){

		/**
		 *  the input node(s)
		 *  @type {GainNode|Array}
		 */
		if (isUndef(inputs) || inputs === 1){
			this.input = this.context.createGain();
		} else if (inputs > 1){
			this.input = new Array(inputs);
		}

		/**
		 *  the output node(s)
		 *  @type {GainNode|Array}
		 */
		if (isUndef(outputs) || outputs === 1){
			this.output = this.context.createGain();
		} else if (outputs > 1){
			this.output = new Array(inputs);
		}
	};

	/**
	 *  Set the parameters at once. Either pass in an
	 *  object mapping parameters to values, or to set a
	 *  single parameter, by passing in a string and value.
	 *  @param {Object|string} params
	 *  @param {number=} value
	 *  @param {Tone.Time=} rampTime
	 *  @returns {Tone} `this`
	 *  @example
	 *  //set values using an object
	 *  filter.set({
	 *  	"frequency" : 300,
	 *  	"type" : highpass
	 *  });
	 *  //or
	 *  filter.set("type", "highpass");
	 *  //ramp to the value 220 over 3 seconds. 
	 *  oscillator.set({
	 *  	"frequency" : 220
	 *  }, 3);
	 */
	Tone.prototype.set = function(params, value, rampTime){
		if (typeof params === "object"){
			rampTime = value;
		} else if (typeof params === "string"){
			var tmpObj = {};
			tmpObj[params] = value;
			params = tmpObj;
		}
		for (var attr in params){
			var param = this[attr];
			if (isUndef(param)){
				continue;
			}
			value = params[attr];
			if (param instanceof Tone.Signal){
				if (param.value !== value){
					if (isUndef(rampTime)){
						param.value = value;
					} else {
						param.rampTo(value, rampTime);
					}
				}
			} else if (param instanceof AudioParam){
				if (param.value !== value){
					param.value = value;
				}				
			} else if (param instanceof Tone){
				param.set(value);
			} else if (param !== value){
				this[attr] = value;
			}
		}
		return this;
	};

	/**
	 *  Get the object's attributes. 
	 *  @example
	 *  osc.get();
	 *  //returns {"type" : "sine", "frequency" : 440, ...etc}
	 *  osc.get("type"); //returns { "type" : "sine"}
	 *  @param {Array=|string|Object} params the parameters to get, otherwise will return 
	 *  					                  all available.
	 */
	Tone.prototype.get = function(params){
		if (isUndef(params)){
			params = this._collectDefaults(this.constructor);
		} else if (typeof params === "string"){
			var obj = {};
			obj[params] = 0;
			params = obj;
		} else if (Array.isArray(params)){
			//use the objects as keys
			var keyObj = {};
			for (var i = 0; i < params.length; i++){
				keyObj[params[i]] = 0;
			}
			params = keyObj;
		}
		var ret = {};
		for (var attr in params){
			var param = this[attr];
			if (typeof params[attr] === "object"){
				ret[attr] = param.get(params[attr]);
			} else if (param instanceof Tone.Signal){
				ret[attr] = param.value;
			} else if (param instanceof AudioParam){
				ret[attr] = param.value;
			} else if (param instanceof Tone){
				ret[attr] = param.get();
			} else if (!isFunction(param) && !isUndef(param)){
				ret[attr] = param;
			} 
		}
		return ret;
	};

	/**
	 *  collect all of the default attributes in one
	 *  @private
	 *  @param {function} constr the constructor to find the defaults from
	 *  @return {Object} all of the attributes which belong to the class
	 */
	Tone.prototype._collectDefaults = function(constr){
		var ret = {};
		if (!isUndef(constr.defaults)){
			ret = constr.defaults;
		}
		if (!isUndef(constr._super)){
			var superDefs = this._collectDefaults(constr._super);
			for (var attr in superDefs){
				ret[attr] = superDefs[attr];
			}
		}
		return ret;
	};

	/**
	 *  Set the preset if it exists. 
	 *  @param {string} presetName the name of the preset
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.setPreset = function(presetName){
		if (!this.isUndef(this.preset) && this.preset.hasOwnProperty(presetName)){
			this.set(this.preset[presetName]);
		}
		return this;
	};

	/**
	 *  @returns {string} returns the name of the class as a string
	 */
	Tone.prototype.toString = function(){
		for (var className in Tone){
			var isLetter = className[0].match(/^[A-Z]$/);
			var sameConstructor =  Tone[className] === this.constructor;
			if (isFunction(Tone[className]) && isLetter && sameConstructor){
				return className;
			}
		}
		return "Tone";
	};

	///////////////////////////////////////////////////////////////////////////
	//	CLASS VARS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  A static pointer to the audio context accessible as `Tone.context`. 
	 *  @type {AudioContext}
	 */
	Tone.context = audioContext;

	/**
	 *  The audio context.
	 *  @type {AudioContext}
	 */
	Tone.prototype.context = Tone.context;

	/**
	 *  the default buffer size
	 *  @type {number}
	 *  @static
	 *  @const
	 */
	Tone.prototype.bufferSize = 2048;

	/**
	 *  the delay time of a single buffer frame
	 *  @type {number}
	 *  @static
	 *  @const
	 */
	Tone.prototype.bufferTime = Tone.prototype.bufferSize / Tone.context.sampleRate;
	
	///////////////////////////////////////////////////////////////////////////
	//	CONNECTIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  disconnect and dispose
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.dispose = function(){
		if (!this.isUndef(this.input)){
			if (this.input instanceof AudioNode){
				this.input.disconnect();
			} 
			this.input = null;
		}
		if (!this.isUndef(this.output)){
			if (this.output instanceof AudioNode){
				this.output.disconnect();
			} 
			this.output = null;
		}
		return this;
	};

	/**
	 *  a silent connection to the DesinationNode
	 *  which will ensure that anything connected to it
	 *  will not be garbage collected
	 *  
	 *  @private
	 */
	var _silentNode = null;

	/**
	 *  makes a connection to ensure that the node will not be garbage collected
	 *  until 'dispose' is explicitly called
	 *
	 *  use carefully. circumvents JS and WebAudio's normal Garbage Collection behavior
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.noGC = function(){
		this.output.connect(_silentNode);
		return this;
	};

	AudioNode.prototype.noGC = function(){
		this.connect(_silentNode);
		return this;
	};

	/**
	 *  connect the output of a ToneNode to an AudioParam, AudioNode, or ToneNode
	 *  @param  {Tone | AudioParam | AudioNode} unit 
	 *  @param {number} [outputNum=0] optionally which output to connect from
	 *  @param {number} [inputNum=0] optionally which input to connect to
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.connect = function(unit, outputNum, inputNum){
		if (Array.isArray(this.output)){
			outputNum = this.defaultArg(outputNum, 0);
			this.output[outputNum].connect(unit, 0, inputNum);
		} else {
			this.output.connect(unit, outputNum, inputNum);
		}
		return this;
	};

	/**
	 *  disconnect the output
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.disconnect = function(outputNum){
		if (Array.isArray(this.output)){
			outputNum = this.defaultArg(outputNum, 0);
			this.output[outputNum].disconnect();
		} else {
			this.output.disconnect();
		}
		return this;
	};

	/**
	 *  connect together all of the arguments in series
	 *  @param {...AudioParam|Tone|AudioNode}
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.connectSeries = function(){
		if (arguments.length > 1){
			var currentUnit = arguments[0];
			for (var i = 1; i < arguments.length; i++){
				var toUnit = arguments[i];
				currentUnit.connect(toUnit);
				currentUnit = toUnit;
			}
		}
		return this;
	};

	/**
	 *  fan out the connection from the first argument to the rest of the arguments
	 *  @param {...AudioParam|Tone|AudioNode}
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.connectParallel = function(){
		var connectFrom = arguments[0];
		if (arguments.length > 1){
			for (var i = 1; i < arguments.length; i++){
				var connectTo = arguments[i];
				connectFrom.connect(connectTo);
			}
		}
		return this;
	};

	/**
	 *  Connect the output of this node to the rest of the nodes in series.
	 *  @example
	 *  //connect a node to an effect, panVol and then to the master output
	 *  node.chain(effect, panVol, Tone.Master);
	 *  @param {...AudioParam|Tone|AudioNode} nodes
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.chain = function(){
		if (arguments.length > 0){
			var currentUnit = this;
			for (var i = 0; i < arguments.length; i++){
				var toUnit = arguments[i];
				currentUnit.connect(toUnit);
				currentUnit = toUnit;
			}
		}
		return this;
	};

	/**
	 *  connect the output of this node to the rest of the nodes in parallel.
	 *  @param {...AudioParam|Tone|AudioNode}
	 *  @returns {Tone} `this`
	 */
	Tone.prototype.fan = function(){
		if (arguments.length > 0){
			for (var i = 0; i < arguments.length; i++){
				this.connect(arguments[i]);
			}
		}
		return this;
	};

	//give native nodes chain and fan methods
	AudioNode.prototype.chain = Tone.prototype.chain;
	AudioNode.prototype.fan = Tone.prototype.fan;

	///////////////////////////////////////////////////////////////////////////
	//	UTILITIES / HELPERS / MATHS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  if a the given is undefined, use the fallback. 
	 *  if both given and fallback are objects, given
	 *  will be augmented with whatever properties it's
	 *  missing which are in fallback
	 *
	 *  warning: if object is self referential, it will go into an an 
	 *  infinite recursive loop. 
	 *  
	 *  @param  {*} given    
	 *  @param  {*} fallback 
	 *  @return {*}          
	 */
	Tone.prototype.defaultArg = function(given, fallback){
		if (typeof given === "object" && typeof fallback === "object"){
			var ret = {};
			//make a deep copy of the given object
			for (var givenProp in given) {
				ret[givenProp] = this.defaultArg(given[givenProp], given[givenProp]);
			}
			for (var prop in fallback) {
				ret[prop] = this.defaultArg(given[prop], fallback[prop]);
			}
			return ret;
		} else {
			return isUndef(given) ? fallback : given;
		}
	};

	/**
	 *  returns the args as an options object with given arguments
	 *  mapped to the names provided. 
	 *
	 *  if the args given is an array containing an object, it is assumed
	 *  that that's already the options object and will just return it. 
	 *  
	 *  @param  {Array} values  the 'arguments' object of the function
	 *  @param  {Array.<string>} keys the names of the arguments as they
	 *                                 should appear in the options object
	 *  @param {Object=} defaults optional defaults to mixin to the returned 
	 *                            options object                              
	 *  @return {Object}       the options object with the names mapped to the arguments
	 */
	Tone.prototype.optionsObject = function(values, keys, defaults){
		var options = {};
		if (values.length === 1 && typeof values[0] === "object"){
			options = values[0];
		} else {
			for (var i = 0; i < keys.length; i++){
				options[keys[i]] = values[i];
			}
		}
		if (!this.isUndef(defaults)){
			return this.defaultArg(options, defaults);
		} else {
			return options;
		}
	};

	/**
	 *  test if the arg is undefined
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is undefined
	 *  @function
	 */
	Tone.prototype.isUndef = isUndef;

	/**
	 *  test if the arg is a function
	 *  @param {*} arg the argument to test
	 *  @returns {boolean} true if the arg is a function
	 *  @function
	 */
	Tone.prototype.isFunction = isFunction;

	/**
	 *  Make the property not writable. Internal use only. 
	 *  @private
	 *  @param  {string}  property  the property to make not writable
	 */
	Tone.prototype._readOnly = function(property){
		if (Array.isArray(property)){
			for (var i = 0; i < property.length; i++){
				this._readOnly(property[i]);
			}
		} else {
			Object.defineProperty(this, property, { 
				writable: false,
				enumerable : true,
			});
		}
	};

	/**
	 *  Make an attribute writeable. Interal use only. 
	 *  @private
	 *  @param  {string}  property  the property to make writable
	 */
	Tone.prototype._writable = function(property){
		if (Array.isArray(property)){
			for (var i = 0; i < property.length; i++){
				this._writable(property[i]);
			}
		} else {
			Object.defineProperty(this, property, { 
				writable: true,
			});
		}
	};

	///////////////////////////////////////////////////////////////////////////
	// GAIN CONVERSIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  equal power gain scale
	 *  good for cross-fading
	 *  @param  {number} percent (0-1)
	 *  @return {number}         output gain (0-1)
	 */
	Tone.prototype.equalPowerScale = function(percent){
		var piFactor = 0.5 * Math.PI;
		return Math.sin(percent * piFactor);
	};

	/**
	 *  convert db scale to gain scale (0-1)
	 *  @param  {number} db
	 *  @return {number}   
	 */
	Tone.prototype.dbToGain = function(db) {
		return Math.pow(2, db / 6);
	};

	/**
	 *  convert gain scale to decibels
	 *  @param  {number} gain (0-1)
	 *  @return {number}   
	 */
	Tone.prototype.gainToDb = function(gain) {
		return  20 * (Math.log(gain) / Math.LN10);
	};

	///////////////////////////////////////////////////////////////////////////
	//	TIMING
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  @return {number} the currentTime from the AudioContext
	 */
	Tone.prototype.now = function(){
		return this.context.currentTime;
	};

	/**
	 *  convert a sample count to seconds
	 *  @param  {number} samples 
	 *  @return {number}         
	 */
	Tone.prototype.samplesToSeconds = function(samples){
		return samples / this.context.sampleRate;
	};

	/**
	 *  convert a time into samples
	 *  
	 *  @param  {Tone.time} time
	 *  @return {number}         
	 */
	Tone.prototype.toSamples = function(time){
		var seconds = this.toSeconds(time);
		return Math.round(seconds * this.context.sampleRate);
	};

	/**
	 *  convert time to seconds
	 *
	 *  this is a simplified version which only handles numbers and 
	 *  'now' relative numbers. If the Transport is included this 
	 *  method is overridden to include many other features including 
	 *  notationTime, Frequency, and transportTime
	 *  
	 *  @param  {number=} time 
	 *  @param {number=} now if passed in, this number will be 
	 *                       used for all 'now' relative timings
	 *  @return {number}   	seconds in the same timescale as the AudioContext
	 */
	Tone.prototype.toSeconds = function(time, now){
		now = this.defaultArg(now, this.now());
		if (typeof time === "number"){
			return time; //assuming that it's seconds
		} else if (typeof time === "string"){
			var plusTime = 0;
			if(time.charAt(0) === "+") {
				time = time.slice(1);	
				plusTime = now;			
			} 
			return parseFloat(time) + plusTime;
		} else {
			return now;
		}
	};

	///////////////////////////////////////////////////////////////////////////
	// FREQUENCY CONVERSION
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  true if the input is in the format number+hz
	 *  i.e.: 10hz
	 *
	 *  @param {number} freq 
	 *  @return {boolean} 
	 *  @function
	 */
	Tone.prototype.isFrequency = (function(){
		var freqFormat = new RegExp(/\d*\.?\d+hz$/i);
		return function(freq){
			return freqFormat.test(freq);
		};
	})();

	/**
	 *  Convert a frequency into seconds.
	 *  Accepts numbers and strings: i.e. `"10hz"` or 
	 *  `10` both return `0.1`. 
	 *  
	 *  @param  {number|string} freq 
	 *  @return {number}      
	 */
	Tone.prototype.frequencyToSeconds = function(freq){
		return 1 / parseFloat(freq);
	};

	/**
	 *  Convert a number in seconds to a frequency.
	 *  @param  {number} seconds 
	 *  @return {number}         
	 */
	Tone.prototype.secondsToFrequency = function(seconds){
		return 1/seconds;
	};

	///////////////////////////////////////////////////////////////////////////
	//	INHERITANCE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  have a child inherit all of Tone's (or a parent's) prototype
	 *  to inherit the parent's properties, make sure to call 
	 *  Parent.call(this) in the child's constructor
	 *
	 *  based on closure library's inherit function
	 *
	 *  @static
	 *  @param  {function} 	child  
	 *  @param  {function=} parent (optional) parent to inherit from
	 *                             if no parent is supplied, the child
	 *                             will inherit from Tone
	 */
	Tone.extend = function(child, parent){
		if (isUndef(parent)){
			parent = Tone;
		}
		function TempConstructor(){}
		TempConstructor.prototype = parent.prototype;
		child.prototype = new TempConstructor();
		/** @override */
		child.prototype.constructor = child;
		child._super = parent;
	};

	///////////////////////////////////////////////////////////////////////////
	//	CONTEXT
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  array of callbacks to be invoked when a new context is added
	 *  @private 
	 *  @private
	 */
	var newContextCallbacks = [];

	/**
	 *  invoke this callback when a new context is added
	 *  will be invoked initially with the first context
	 *  @private 
	 *  @static
	 *  @param {function(AudioContext)} callback the callback to be invoked
	 *                                           with the audio context
	 */
	Tone._initAudioContext = function(callback){
		//invoke the callback with the existing AudioContext
		callback(Tone.context);
		//add it to the array
		newContextCallbacks.push(callback);
	};

	/**
	 *  Tone.js automatically creates a context on init, but if you are working
	 *  with other libraries which also create an AudioContext, it can be
	 *  useful to set your own. If you are going to set your own context, 
	 *  be sure to do it at the start of your code, before creating any objects.
	 *  @static
	 *  @param {AudioContext} ctx The new audio context to set
	 */
	Tone.setContext = function(ctx){
		//set the prototypes
		Tone.prototype.context = ctx;
		Tone.context = ctx;
		//invoke all the callbacks
		for (var i = 0; i < newContextCallbacks.length; i++){
			newContextCallbacks[i](ctx);
		}
	};

	/**
	 *  Bind this to a touchstart event to start the audio on mobile devices. 
	 *  <br>
	 *  http://stackoverflow.com/questions/12517000/no-sound-on-ios-6-web-audio-api/12569290#12569290
	 *  @static
	 */
	Tone.startMobile = function(){
		var osc = Tone.context.createOscillator();
		var silent = Tone.context.createGain();
		silent.gain.value = 0;
		osc.connect(silent);
		silent.connect(Tone.context.destination);
		var now = Tone.context.currentTime;
		osc.start(now);
		osc.stop(now+1);
	};

	//setup the context
	Tone._initAudioContext(function(audioContext){
		//set the bufferTime
		Tone.prototype.bufferTime = Tone.prototype.bufferSize / audioContext.sampleRate;
		_silentNode = audioContext.createGain();
		_silentNode.gain.value = 0;
		_silentNode.connect(audioContext.destination);
	});

	console.log("%c * Tone.js r5-dev * ", "background: #000; color: #fff");

	return Tone;
});

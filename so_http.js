/**
 * @package so
 * @object  so.http
 * @depends so, so.list, so.class
 * @author  Kerem Güneş <k-gun@mail.com>
 * @license The MIT License <https://opensource.org/licenses/MIT>
 */
;(function(window, $) { 'use strict';

    var re_query = /\?&+(.*)/;
    var re_space = /%20/g;
    var re_http = /^https?/;
    var re_post = /PUT|POST/i;
    var re_json = /^(\{.*\}|\[.*\]|".*"|-?\d+(\.\d+)?|true|false|null)$/;
    var re_request = /^([A-Z]+)?\s*(.*?)\s*(?:@(json|xml|html|text))?$/;
    var re_dataType = /\/(json|xml|html|plain)(?:[; ])?/i;
    var optionsDefault = {
        method: 'GET', uri: '', uriParams: null, data: null, dataType: null,
        async: true, noCache: true, autoSend: true, headers: {'X-Requested-With': 'XMLHttpRequest'},
        // onStart: null, onStop: null, /* @todo: queue */
        // onHeaders: null, onProgress: null,
        // onDone: null, onSuccess: null, onFailure: null,
        // onAbort: null, onTimeout: null, onBeforeSend: null, onAfterSend: null,
        ons: {} // all other on.. stuff
    };
    var STATE_OPENED = 1, STATE_HEADERS_RECEIVED = 2, STATE_LOADING = 3, STATE_DONE = 4;

    // export base methods
    $.http = {
        /**
         * Parse XML.
         * @param  {Any}    input
         * @param  {String} inputType?
         * @return {Document}
         */
        parseXml: function(input, inputType) {
            if ($.isDocument(input)) {
                return input;
            }

            if (!$.isString(input)) {
                return null;
            }

            return new DOMParser.parseFromString(input, inputType || 'text/xml');
        },

        /**
         * Parse JSON.
         * @param  {String} input
         * @return {Any}
         */
        parseJson: function(input) {
            input = $.trim(input);

            if (!re_json.test(input)) {
                return input;
            }

            return $.json(input);
        },

        /**
         * Parse headers.
         * @param  {String} headers
         * @return {Object}
         */
        parseHeaders: function(headers) {
            var ret = {};

            if ($.isString(headers)) {
                headers.trim().split('\r\n').forEach(function(header) {
                    header = header.split(':', 2),
                        ret[$.trim(header[0]).toLowerCase()] = $.trim(header[1]);
                });
            }

            return ret;
        },

        /**
         * Serialize.
         * @param  {Any} data
         * @return {String}
         */
        serialize: function(data) {
            if ($.isString(data) || !$.isIterable(data)) {
                return data;
            }

            if ($.isList(data)) {
                data = data.data;
            }

            var ret = [], encode = encodeURIComponent;;

            $.forEach(data, function(key, value) { // only two-dimensionals
                key = encode(key);
                if ($.isArray(value)) {
                    if (value.length) {
                        while (value.length) {
                            ret.push('%s[]=%s'.format(key, encode(value.shift())));
                        }
                    } else ret.push('%s[]='.format(key));
                } else if ($.isObject(value)) {
                    $.forEach(value, function(_key, _value) {
                        ret.push('%s[%s]=%s'.format(key, _key, encode(_value)));
                    });
                } else {
                    ret.push('%s=%s'.format(key, encode(value)));
                }
            });

            return ret.join('&').replace(re_space, '+');
        }
    };

    /**
     * Stream.
     * @param {Client} client
     */
    function Stream(client) {
        this.client = client;
        this.headers = {};
        this.data = null;
        this.dataType = null;
    }

    /**
     * Request.
     * @param {Client} client
     */
    function Request(client) {
        this.super(client);
        this.method = client.options.method;
        this.uri = client.options.uri;
        this.uriParams = client.options.uriParams;
    }

    /**
     * Response.
     * @param {Client} client
     */
    function Response(client) {
        this.super(client);
        this.status = null;
        this.statusCode = null;
        this.statusText = null;
    }

    // extend request & response
    $.class(Request).extends(Stream);
    $.class(Response).extends(Stream);

    // shortcut helpers
    function addUriParams(uri, uriParams) {
        return (uri += (!uri.has('?') ? '?' : '&') + $.http.serialize(uriParams));
    }

    function onReadyStateChange(client) {
        if (client.aborted) {
            return offReadyStateChange(client);
        }

        // hold trigger button
        if (client.options.trigger) {
            client.options.trigger.disabled = true;
        }

        // handle states
        client.state = client.api.readyState;
        switch (client.state) {
            case STATE_OPENED:           client.fire('start');    break;
            case STATE_HEADERS_RECEIVED: client.fire('headers');  break;
            case STATE_LOADING:          client.fire('progress'); break;
            case STATE_DONE:
                client.done = true;

                var status = 'HTTP/1.1 %s %s'.format(client.api.status, client.api.statusText),
                    headers = $.http.parseHeaders(client.api.getAllResponseHeaders()),
                    data = client.api.responseText,
                    dataType = client.options.dataType || (re_dataType.exec(headers['content-type']) || [,])[1];

                client.response.status = headers[0] = status;
                client.response.statusCode = client.api.status;
                client.response.statusText = client.api.statusText;
                client.response.headers = headers;

                // parse wars..
                if (dataType == 'json') {
                    client.response.data = $.http.parseJson(data);
                } else if (dataType == 'xml') {
                    client.response.data = $.http.parseXml(data);
                } else {
                    client.response.data = data;
                }
                client.response.dataType = dataType;

                // specials, eg: 200: function(){...}
                client.fire(client.response.statusCode);

                // success or failure?
                client.fire((client.response.statusCode > 99 && client.response.statusCode < 400)
                    ? 'success' : 'failure', client.response.data);

                // end!
                client.fire('done', client.response.data);

                // release trigger button
                if (client.options.trigger) {
                    client.options.trigger.disabled = false;
                }

                offReadyStateChange(client);
                break;
            default:
                throw ('Unknown HTTP error!');
        }
    }

    function offReadyStateChange(client) {
        client.api.onreadystatechange = null;
    }

    /**
     * Client.
     * @param {String} uri
     * @param {Object} options
     */
    function Client(uri, options) {
        if (!uri) {
            throw ('URI required!');
        }

        options = $.extend({}, optionsDefault, options);
        options.method = (options.method || optionsDefault.method).toUpperCase();
        options.uri = uri;
        options.headers = $.extend({}, optionsDefault.headers, options.headers);

        // check cross domain
        if (re_http.test(uri)) {
            delete options.headers['X-Requested-With'];
        }

        // handle post streams
        if (re_post.test(options.method)) {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }

        if (options.uriParams) {
            options.uri = addUriParams(options.uri, options.uriParams);
        } else if (options.data && options.method == 'GET') {
            options.uri = addUriParams(options.uri, options.data);
        }

        if (options.noCache) {
            options.uri = addUriParams(options.uri, {'_': $.now()});
        }
        options.uri = options.uri.replace(re_query, '?$1');

        var _this = this;
        this.options = options;
        this.request = new Request(this);
        this.response = new Response(this);

        this.api = new XMLHttpRequest(); // what an ugly name..
        this.api.open(this.request.method, this.request.uri, !!options.async);
        this.api.onerror = function(e) {
            _this.fire('error');
        };

        this.request.data = options.data;
        this.request.dataType = options.dataType;
        this.request.headers = options.headers;

        if (options.async) {
            this.api.onreadystatechange = function() {
                onReadyStateChange(_this);
            };
        }

        this.state = 0;
        this.sent = false;
        this.done = false;
        this.aborted = false;

        this.api.client = this;

        // sen if auto-send
        if (options.autoSend) {
            this.send();
        }
    }

    $.extendPrototype(Client, {
        /**
         * Send.
         * @return {this}
         */
        send: function() {
            if (!this.sent && !this.aborted) {
                var _this = this, data;

                this.fire('beforeSend');

                $.forEach(this.request.headers, function(name, value) {
                    _this.api.setRequestHeader(name, value);
                });

                // check data
                if (re_post.test(this.request.method)) {
                    data = $.http.serialize(this.request.data);
                }

                this.api.send(data);

                this.fire('afterSend');

                if (this.options.timeout) {
                    $.fire(this.options.timeout, function(){
                        _this.cancel();
                        _this.fire('timeout');
                    });
                }

                this.sent = true;
            }

            return this;
        },

        /**
         * Fire.
         * @param  {String|Function} fn
         * @param  {Array}           fnArgs
         * @return {void}
         */
        fire: function(fn, fnArgs) {
            // check 'ons'
            if (this.options.ons[fn]) {
                fn = this.options.ons[fn];
            } else if (!$.isFunction(fn)) {
                fn = $.isNumeric(fn) // status code functions
                    ? fn : fn.toCapitalCase().prepend('on');
                if (this.options[fn]) {
                    fn = this.options[fn];
                }
            }

            if ($.isFunction(fn)) {
                var args = [this.request, this.response, this];
                // prepend
                if (!$.isUndefined(fnArgs)) {
                    args = [fnArgs].concat(args);
                }
                fn.apply(this, args);
            }
        },

        /**
         * Cancel
         * @return {void}
         */
        cancel: function() {
            this.api.abort();
            this.fire('abort');
            this.aborted = true;
        },

        /**
         * End.
         * @param  {Function} fn
         * @return {this}
         */
        end: function(fn) {
            var _this = this, i;

            // actually just calls onDone
            i = setInterval(function() {
                if (_this.done) {
                    _this.fire(fn);
                    clearInterval(i);
                }
            }, 1);

            return this;
        },

        /**
         * On.
         * @param  {String}   name
         * @param  {Function} callback
         * @return {this}
         */
        on: function(name, callback) {
            return this.options.ons[name] = callback, this;
        }
    });

    // shortcut helpers
    function initClient(uri, options) {
        return new Client(uri, options);
    }
    function initRequest(client) {
        return new Request(client);
    }
    function initResponse(client) {
        return new Response(client);
    }

    /**
     * Init.
     * @param  {String}          uri
     * @param  {Object|Function} options?
     * @param  {Function}        onDone?
     * @param  {Function}        onSuccess?
     * @param  {Function}        onFailure?
     * @param  {String}          method?
     * @return {Client}
     */
    function init(uri, options, onDone, onSuccess, onFailure, method) {
        if (!$.isString(uri)) {
            throw ('URI must be string!');
        }

        var args, re, _options;

        // swap arguments
        if ($.isFunction(options)) {
            args = arguments;
            onDone = onSuccess = onFailure = options = null;
            onDone = args[1], onSuccess = args[2], onFailure = args[3];
        }
        _options = options = options || {};

        uri = uri.trimSpace();
        if (uri.has(' ')) {
            // <method> <uri> @<data type>, eg: '/foo', '/foo @json', 'GET /foo', 'GET /foo @json'
            re = re_request.exec(uri);
            if (re) {
                options.method = re[1];
                options.uri = uri = re[2];
                options.dataType = re[3];
            }
        } else {
            options.method = method;
            options.uri = uri;
        }

        if ($.isFunction(_options)) {
            // eg: '/foo', function() {...}
            options = $.extend(options, {onDone: _options, onSuccess: onDone, onFailure: onSuccess});
        } else if ($.isObject(_options)) {
            // eg: '/foo', {...}
            options = $.extend(options, $.extend({onDone: onDone, onSuccess: onSuccess, onFailure: onFailure}, _options));
        }

        return initClient(uri, options);
    }

    // export more methods
    $.extend($.http, {
        Client: initClient,
        Request: initRequest,
        Response: initResponse,
        get: function(uri, options, onDone, onSuccess, onFailure) {
            return init(uri, options, onDone, onSuccess, onFailure, 'get');
        },
        post: function(uri, options, onDone, onSuccess, onFailure) {
            return init(uri, options, onDone, onSuccess, onFailure, 'post');
        },
        request: function(uri, options, onDone, onSuccess, onFailure) {
            return init(uri, options, onDone, onSuccess, onFailure);
        }
    });

})(window, so);

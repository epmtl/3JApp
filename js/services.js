angular.module('app.services', ['ionic','cb.x2js','ngCordova'])

.factory('mTools', function(x2js){
        var _toBase64 = function(input){
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;

            do {
                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                keyStr.charAt(enc3) + keyStr.charAt(enc4);
            } while (i < input.length);
            return output;
        }
        var _XMLtoJSON = function(input){
            var jsonObj = x2js.xml_str2json(input);
            return jsonObj;
        }

        return {
            _toBase64: _toBase64,
            _XMLtoJSON: _XMLtoJSON
        };
})

.factory('mSettings', function($q,$http,$log,$cordovaDevice){
    var shared = {};
    shared.settings = {};
    if (ionic.Platform.isAndroid() == true) {
        shared.settings.uuid = $cordovaDevice.getUUID();
    } else {
        shared.settings.uuid = "0000";
    }

    var getDefaultSettings = function() {
        var deferred = $q.defer();
        $http.get('js/data/settings.json').success(
            function(response){
                // Load default settings
                shared.settings = response.default;
                deferred.resolve(shared.settings);
            }
        );
        return deferred.promise;
    }

    var getUUID = function(){
        return shared.settings.uuid;
    }

    var getSettings = function(){
        return shared.settings;
    }

    var setSettings = function(value){
        shared.settings = value;
    }

    var setSettingsURL = function(value){
        shared.settings.url = value;
    }

    var setSettingsUsername = function(value){
        shared.settings.username = value;
    }

    var setSettingsPassword = function(value){
        shared.settings.password = value;
    }

    var setSettingsJobname = function(value){
        shared.settings.jobname = value;
    }

    var setSettingsToken = function(value){
        shared.settings.token = value;
    }

    var setSettingsTestresultfile = function(value){
        shared.settings.testresultfile = value;
    }

    var setSettingsProxy = function(value){
        shared.settings.proxy = value;
    }

    return {
        getUUID :getUUID,
        getDefaultSettings : getDefaultSettings,       
        getSettings : getSettings,
        setSettings : setSettings,
        setSettingsURL : setSettingsURL,
        setSettingsUsername : setSettingsUsername,
        setSettingsPassword : setSettingsPassword,
        setSettingsJobname : setSettingsJobname,
        setSettingsToken : setSettingsToken,
        setSettingsTestresultfile : setSettingsTestresultfile,
        setSettingsProxy : setSettingsProxy
    };

})


.factory('mJenkinsClient', function($q,$http,$log,mTools){
        var _username = "";
        var _password = "";
        var _serviceurl = "";
        var _body = "";
        var _jobname = "";

        var _setBodyAndServiceURL = function(method){
                if (method.includes("queue")){
                    _body = "";
                    _serviceurl = _serviceurl + method;
                }
                else {
                    _body = "";
                    _serviceurl = _serviceurl + _jobname + method;
                }
        }

        var setParameters = function(username,password,serviceurl,jobname){
            _username = username;
            _password = password;
            _jobname = "job/"+jobname;
        }

        var postCommand = function(serviceurl,method){
            var deferred = $q.defer();
            var credentials = 'Basic '+mTools._toBase64(_username+":"+_password);
            _serviceurl = serviceurl;
            _setBodyAndServiceURL(method);
            var httpConfig = {
                method: 'POST',
                url: _serviceurl,
                headers: {
                    'Content-Type': 'text/xml',
                    'Authorization': credentials
                }
            };
            $http.post(_serviceurl, _body, httpConfig).
                then(function(response) {
                    deferred.resolve(response);
                }, function(response) {
                    deferred.resolve(response);
            });
            
            return deferred.promise;
        }

        return {
            postJenkinsCommand: postCommand,
            setParameters: setParameters
        };
});
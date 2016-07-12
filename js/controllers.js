angular.module('app.controllers', ['ionic','app.services','ngCordova','ngSanitize'])
  
.controller('homeCtrl', function($scope,$log,mSettings) {
    if (ionic.Platform.isAndroid() == true) {
        $scope.info = "Your device UUID is:"+mSettings.getUUID();
    } else {
        $log.log("Platform="+ionic.Platform.platform());
        if(ionic.Platform.isAndroid() != true && ionic.Platform.isIOS() != true){
           $scope.info = "You are running the web version.";
        }
    }
    $scope.welcome = "<b>";
    $scope.welcome = $scope.welcome + "This is a Javascript Jenkins JUNIT Application.<br>";
    $scope.welcome = $scope.welcome + $scope.info;
    $scope.welcome = $scope.welcome + "</b>";
})

.controller('settingsCtrl', function($scope,$log,mSettings) {
    var init = false;
    $scope.settings = {};

    // Retrieve the default profile when the controller loads
    mSettings.getDefaultSettings().then(
        function(defaultprofile) {
            $scope.settings = defaultprofile;
            init = true;
        }, 
        function(reason) {alert('Failed: '+reason);}
    );

    $scope.$on("$ionicView.leave", function(event, data){
        /*
        Secure the changes of each element when we leave the page
        If a user doesn't push enter in an input field, the ng-change may
        not be triggered.
        */
        $scope.settings = mSettings.getSettings();
        mSettings.setSettingsURL($scope.settings.url);
        mSettings.setSettingsUsername($scope.settings.username);
        mSettings.setSettingsPassword($scope.settings.password);
        mSettings.setSettingsJobname($scope.settings.jobname);
        mSettings.setSettingsToken($scope.settings.token);
        mSettings.setSettingsTestresultfile($scope.settings.testresultfile);
        mSettings.setSettingsProxy($scope.settings.proxy);
        $log.log("Leaving settings page with:"+JSON.stringify($scope.settings));
    });

    $scope.resetSettings = function() 
    {
        mSettings.getDefaultSettings().then(
            function(defaultprofile) {$scope.settings = defaultprofile;}, 
            function(reason) {alert('Failed: ' + reason);}
        );
    };
    $scope.updateURL = function () 
    {mSettings.setSettingsURL($scope.settings.url);};
    $scope.updateUsername = function () 
    {mSettings.setSettingsUsername($scope.settings.username);};
    $scope.updatePassword = function () 
    {mSettings.setSettingsPassword($scope.settings.password);};
    $scope.updateJobname = function () 
    {mSettings.setSettingsJobname($scope.settings.jobname);};
    $scope.updateToken = function () 
    {mSettings.setSettingsToken($scope.settings.token);};
    $scope.updateTestresultfile = function () 
    {mSettings.setSettingsTestresultfile($scope.settings.testresultfile);};
    $scope.updateProxy = function () 
    {mSettings.setSettingsProxy($scope.settings.proxy);};

})
   

.controller('jenkinsCtrl', function(
    $scope,
    $http,
    $log,
    $timeout,
    $interval,
    mJenkinsClient,
    mTools,
    mSettings) {
    var init = false;
    var queue_uri = "";
    var lastJenkinsJobId = 0;
    var intervalId = 0;
    var step = 0;
    var interval = 4;
    var attempt = 10;
    $scope.data = "";
    $scope.status = 0;
    $scope.testsuite = null;
    $scope.total = 0;
    $scope.failures = 0;
    $scope.passed = 0;
    $scope.errors = 0;
    $scope.jobId = "";
    $scope.buttondisabled = false;
    $scope.version = "0.1";
    $scope.settings = {};
    

    // Retrieve the default profile when the controller loads
    mSettings.getDefaultSettings().then(
        function(defaultprofile) {
            $scope.settings = defaultprofile;
            init = true;
        }, 
        function(reason) {alert('Failed: '+reason);}
    );

    $scope.$on("$ionicView.enter", function(event, data){
        if (init == true) {
            $scope.settings = mSettings.getSettings();
            $log.log("Entering Jenkins page with:"+JSON.stringify($scope.settings));
        }
    });

    var _stopPolling = function(){
          if (angular.isDefined(intervalId)) {
              $interval.cancel(intervalId);
              intervalId = undefined;
          }
    }

    var _startPolling = function(){
        var i = attempt;
        intervalId = $interval(function() {
            if (i>0 && step == 2 ) {
                $scope.launchJenkinsCommand();
                i--;
            } else {
                _stopPolling();
            }
        }, (4*1000));
    }

    var _analyzeResults = function(results) {
            if (results.status <= 202 && results.status >= 200) {
                if (step == 0) {
                    $scope.data = $scope.data + "NextJobId #" + results.data.nextBuildNumber + "<br/>";
                    $log.log(JSON.stringify(results.data.nextBuildNumber));
                    $scope.jobId = results.data.nextBuildNumber;
                    if ($scope.jobId > 0) {
                        // wait 1s
                        $scope.data = $scope.data + "Launching the job...";
                        step = 1;
                        // wait 1s and start polling
                        $timeout(function(){$scope.launchJenkinsCommand();},1000);
                        return;
                    }
                }

                if (step == 1) {
                    $scope.data = $scope.data + "done." + "<br/>";
                    // Getting the queue location
                    queue_uri = results.headers('Location');
                    var queueLocationSplit = queue_uri.split("/");
                    queue_uri = "";
                    for(i = 3; i < queueLocationSplit.length; i++){
                        queue_uri += "/"+queueLocationSplit[i];
                    }
                    queue_uri += "api/xml"
                    $scope.data = $scope.data + "Building on-going...";
                    step = 2;
                    // wait 500ms and start polling for file
                    $timeout(function(){_startPolling();},500);
                    return;
                }

                if (step == 2) {
                    $scope.data = $scope.data + "...";
                    $scope.queuedata = mTools._XMLtoJSON(results.data);
                    //$log.log("PARSED DATA = "+angular.toJson($scope.queuedata,true));
                    if ($scope.queuedata.leftItem != null) {
                        // Not in the queue anymore
                        if (($scope.queuedata.leftItem.cancelled).includes("true")) {
                            stopPolling();
                            $scope.data = $scope.data + "done." + "<br/>";
                            $scope.data = $scope.data + "JOB CANCELLED!" + "<br/>";
                            $scope.buttondisabled = false;
                            step = 0;
                        }
                        if ($scope.queuedata.leftItem.executable != null) {
                            // Building on going
                            JobId = $scope.queuedata.leftItem.executable.number;
                            $log.log("JOB ID..."+JobId);
                            if (($scope.queuedata.leftItem.task.color).includes("_anime") == false) {
                                // DONE
                                $scope.data = $scope.data + "done." + "<br/>";
                                $scope.data = $scope.data + "Retrieving the test results...";
                                step = 3;
                                $timeout(function(){$scope.launchJenkinsCommand();},1000);
                            }
                        }
                    }
                    return;
                }
                if (step == 3) {
                    $scope.data = $scope.data + "done." + "<br/>";
                    $scope.buttondisabled = false;
                    $scope.testsuite = mTools._XMLtoJSON(results.data);
                    //$log.log("PARSED DATA = "+angular.toJson($scope.testsuite,true));
                    $scope.total = parseInt($scope.testsuite.testsuite._tests);
                    $scope.failures = parseInt($scope.testsuite.testsuite._failures);
                    $scope.errors = parseInt($scope.testsuite.testsuite._errors);
                    $scope.passed = $scope.total - ($scope.failures - $scope.errors);
                    for(var key in $scope.testsuite.testsuite.properties.property) {
                        var p = $scope.testsuite.testsuite.properties.property[key];
                        if (angular.equals(p._name,"JenkinsBuildNumber")){
                            $scope.data = $scope.data + "Found Results for Build #" + p._value + "<br/>";
                        }
                    }
                    step = 0;
                    return;
                }
            }
            else if (results.status == 404) {
                if (step == 2) {
                    $scope.data = $scope.data + "Getting 404..." + "<br/>";
                    return;

                } else {
                    alert('Error:' + results.status);
                    steop = 0;
                    $scope.buttondisabled = false;
                    return;
                }
            }
            else {
                alert('Error:' + results.status);
                steop = 0;
                $scope.buttondisabled = false;
                return;
            }
    }

    $scope.launchJenkinsCommand = function() {
        var jfunction = "";
        //$log.log("Entering jenkinscommands...");
        if (step == 0) {
            $scope.settings = mSettings.getSettings();
            mJenkinsClient.setParameters(
                $scope.settings.username,
                $scope.settings.password,
                $scope.settings.url,
                $scope.settings.jobname);
            $scope.buttondisabled = true;       
            //$log.log("Getting Build Number...");
            $scope.data = "Actvity started using the parameters:<br/>";
            $scope.data = $scope.data + JSON.stringify($scope.settings) + "<br/>";
            jfunction = "/api/json";
        } else if (step == 1) {
            //$log.log("Launching Build...");
            jfunction = "/build?token="+$scope.settings.token;
        } else if (step == 2) {
            //$log.log("Getting Queue Data..."+queue_uri);
            jfunction = queue_uri;
        } else if (step == 3) {
            //$log.log("Getting File...");
            jfunction = "/ws/"+$scope.settings.testresultfile;
        }
        mJenkinsClient.postJenkinsCommand($scope.settings.url,jfunction)
            .then(function(results) {
                $scope.status = results.status;
                _analyzeResults(results);
            }, function(reason) {
                alert('Failed: ' + reason);
            });
    };

    /* For Test cases toggling */
    $scope.toggleItem= function(item) {
        if ($scope.isItemShown(item)) {
            $scope.shownItem = null;
        } else {
            $scope.shownItem = item;
        }
    };

    $scope.isItemShown = function(item) {
        return $scope.shownItem === item;
    };

})

/* jslint node: true, esnext: true */

"use strict";

var parentStep = require('kronos-adapter-inbound-http').AdapterInboundHttp;
var route = require('koa-route');

var httpRoutingStep = Object.assign({}, parentStep, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	"endpoints": {
		"out": {
			"out": true,
			"active": true
		}
	},
	initialize: function (manager, scopeReporter, name, stepConfiguration, endpoints, props) {
		parentStep.initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props);

		console.log('routes: ' + JSON.stringify(stepConfiguration.routes));

		var routes = [];

		for (var path in stepConfiguration.routes) {
			//const rp = stepConfiguration.routes[path];
			var r = route.get(path, function (ctx) {
				//const data = ctx.request;
				ctx.body = "unknown TODO";
			});
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

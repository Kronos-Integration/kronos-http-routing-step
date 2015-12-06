/* jslint node: true, esnext: true */

"use strict";

const httpRoutingStep = Object.assign({}, require('kronos-adapter-inbound-http').AdapterInboundHttp, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	"endpoints": {
		"out": {
			"out": true,
			"active": true
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

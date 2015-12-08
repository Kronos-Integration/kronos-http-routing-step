/* jslint node: true, esnext: true */

"use strict";

const parentStep = require('kronos-adapter-inbound-http').AdapterInboundHttp;
const route = require('koa-route');

const httpRoutingStep = Object.assign({}, parentStep, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props) {
		parentStep.initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props);

		console.log(`routes: ${JSON.stringify(stepConfiguration.routes)}`);

		const routes = [];

		for (let path in stepConfiguration.routes) {
			const rp = stepConfiguration.routes[path];
			const method = rp.method || 'get';

			const r = route.get(path, (ctx) => {
				//const data = ctx.request;
				ctx.body = "unknown TODO";
			});
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

/* jslint node: true, esnext: true */

"use strict";

const parentStep = require('kronos-adapter-inbound-http').AdapterInboundHttp;
const route = require('koa-route');

const httpRoutingStep = Object.assign({}, parentStep, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props) {
		parentStep.initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props);

		props.routes = {
			value: stepConfiguration.routes
		};
	},

	_doRegisterUrls() {
		const routes = [];

		for (let path in this.routes) {
			const rp = this.routes[path];
			let method;

			if (rp.method) {
				method = route[rp.method.toLowerCase()];
			} else {
				method = route.get;
			}

			//			console.log(`routes: ${path} ${JSON.stringify(rp)}`);

			const r = method(path, (ctx) => {
				//const data = ctx.request;
				console.log(`in method`);
				ctx.body = "unknown TODO";
			});

			this.registerRoute(r);
		}
	}

});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

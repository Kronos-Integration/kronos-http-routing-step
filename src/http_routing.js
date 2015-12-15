/* jslint node: true, esnext: true */

"use strict";

const parentStep = require('kronos-adapter-inbound-http').AdapterInboundHttp,
	route = require('koa-route'),
	Step = require('kronos-step');

const httpRoutingStep = Object.assign({}, parentStep, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props) {
		parentStep.initialize(manager, scopeReporter, name, stepConfiguration, endpoints, props);

		for (let path in stepConfiguration.routes) {
			const r = stepConfiguration.routes[path];

			if (r.target) {
				r.endpoint = endpoints[r.target] = Step.createEndpoint(r.target, {
					out: true,
					active: true
				});

				console.log(`endpoint: ${r.target}`);
			}
		}

		props.routes = {
			value: stepConfiguration.routes
		};
	},

	_doRegisterUrls() {
		for (let path in this.routes) {
			const r = this.routes[path];
			let method;

			if (r.method) {
				method = route[r.method.toLowerCase()];
			} else {
				method = route.get;
			}

			this.registerRoute(method(path, (ctx) => {
				const request = ctx.request;
				//console.log(`in method: ${request}`);

				if (r.content) {
					r.endpoint.send({
						info: path,
						content: r.content
					});
				} else {
					r.endpoint.send({
						info: path
					});
				}
				ctx.body = "OK";
			}));
		}
	}

});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

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

			const eName = r.name || path;
			const endpointOptions = {
				out: true,
				active: true,
				target: r.target
			};
			r.endpoint = endpoints[eName] = Step.createEndpoint(eName, endpointOptions);
		}

		props.routes = {
			value: stepConfiguration.routes
		};
	},

	_doRegisterUrls() {
		for (let path in this.routes) {
			const r = this.routes[path];
			let method, methodName;

			if (r.method) {
				methodName = r.method.toLowerCase();
				method = route[methodName];
			} else {
				methodName = 'get';
				method = route.get;
			}

			this.info(`add route: ${methodName} ${path}`);

			this.registerRoute(method(path, ctx => {
				this.info(`${methodName} ${path}`);

				const request = ctx.request;
				const rout = {
					info: {
						request: request
					}
				};

				if (r.content) {
					rout.content = r.content;
				} else {
					rout.stream = ctx.req;
				}

				const promise = r.endpoint.send(rout).value;

				if (promise) {
					return promise.then(f => {
						this.info(`${methodName} ${path}: ${f}`);
						ctx.body = f;
					});
				}

				this.warn(`${methodName} ${path}: unknown result ${promise}`);
			}));
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

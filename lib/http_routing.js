/* jslint node: true, esnext: true */

"use strict";

const route = require('koa-route'),
	step = require('kronos-step');

class RouteSendEndpoint extends step.endpoint.SendEndpoint {
	constructor(name, owner, path, method, content) {
		super(name, owner);

		// The path in the URL
		Object.defineProperty(this, 'path', {
			value: path
		});

		// The HTTP method to use (GET, POST, ...)
		Object.defineProperty(this, 'method', {
			value: method.toLowerCase()
		});

		// TODO @Markus 
		Object.defineProperty(this, 'content', {
			value: content
		});
	}

	get route() {
		return route[this.method](this.path, ctx => {
			this.owner.info(`${this.method} ${this.path}`);

			const request = ctx.request;
			const rout = {
				info: {
					request: request
				}
			};

			if (this.content) {
				rout.content = this.content;
			} else {
				rout.stream = ctx.req;
			}

			return this.send(rout).then(response => {
				this.owner.info(`${this.method} ${this.path}: ${JSON.stringify(response)}`);
				ctx.body = response;
			});
		});
	}
}

const httpRoutingStep = Object.assign({}, step.Step, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	initialize(manager, scopeReporter, name, conf, props) {
		props.listener = {
			value: manager.serviceDeclare('koa', conf.listener || 'default-listener')
		};

		props._start = {
			value: function () {
				return this.listener.start().then(
					r => {
						for (let en in this.endpoints) {
							const route = this.endpoints[en].route;
							if (route)
								this.listener.koa.use(route);
						}
						Promise.resolve(this);
					}
				);
			}
		};
	},

	createEndpoints(scopeReporter, conf) {
		for (let path in conf.endpoints) {
			const r = conf.endpoints[path];
			this.addEndpoint(new RouteSendEndpoint(r.name || path, this, path, r.method || 'get'));
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

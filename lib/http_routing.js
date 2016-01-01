/* jslint node: true, esnext: true */

"use strict";

const route = require('koa-route'),
	step = require('kronos-step');

class RouteSendEndpoint extends step.endpoint.SendEndpoint {
	constructor(name, owner, path, method, content) {
		super(name, owner);

		Object.defineProperty(this, 'path', {
			value: path
		});
		Object.defineProperty(this, 'method', {
			value: method.toLowerCase()
		});
		Object.defineProperty(this, 'content', {
			value: content
		});
	}

	get route() {
		console.log(`route: ${this.path} ${this.method}`);

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
				this.owner.info(`${this.method} ${this.path}: ${response}`);
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
							this.listener.koa.use(this.endpoints[en].route);
						}
						Promise.resolve(this);
					}
				);
			}
		}
	},

	createEndpoints(scopeReporter, conf) {
		for (let path in conf.routes) {
			const r = conf.routes[path];
			this.addEndpoint(new RouteSendEndpoint(r.name || path, this, path, r.method || 'get'));
		}
	}
});

exports.registerWithManager = function (manager) {
	manager.registerStep(httpRoutingStep);
};

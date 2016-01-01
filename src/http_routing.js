/* jslint node: true, esnext: true */

"use strict";

const route = require('koa-route'),
	step = require('kronos-step');

class RouteSendEndpoint extends step.endpoint.SendEndpoint {
	constructor(name, owner, path, method, content) {
		super(name, owner);

		Object.defineProperty(this, 'path', path);
		Object.defineProperty(this, 'method', method.toLowerCase());
		Object.defineProperty(this, 'content', content);
	}

	get route() {
		const method = route[this.method];

		return method(this.path, ctx => {
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
						this.listener.koa.use(route);
					}
				);
				this.listener.koa.use(route);
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

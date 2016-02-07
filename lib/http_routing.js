/* jslint node: true, esnext: true */

"use strict";

const route = require('koa-route'),
	step = require('kronos-step'),
	endpoint = require('kronos-endpoint');

/**
 * Endpoint to link against a koa route
 */
class RouteSendEndpoint extends endpoint.SendEndpoint {

	/**
	 * @param name {String} endpoint name
	 * @param owner {Step} the owner of the endpoint
	 * @param method {String} http method defaults to get
	 * @param content
	 */
	constructor(name, owner, path, method, content) {
		super(name, owner);

		// The path in the URL
		Object.defineProperty(this, 'path', {
			value: path
		});

		method = method ? method.toLowerCase() : "get";

		// The HTTP method to use (GET, POST, ...)
		Object.defineProperty(this, 'method', {
			value: method
		});

		// TODO planned for dynamic construction of a request
		Object.defineProperty(this, 'content', {
			value: content
		});
	}

	/**
	 *
	 */
	get route() {
		if (!this._route) {
			this._route = route[this.method](this.path, ctx => {
				this.owner.info(`${this.method} ${this.path}`);

				const request = ctx.request;
				const rout = {
					info: {
						request: request
					}
				};

				if (this.content) {
					// TODO
					rout.content = this.content;
				} else {
					rout.stream = ctx.req;
				}

				return this.receive(rout).then(response => {
					this.owner.info(`${this.method} ${this.path}: ${JSON.stringify(response)}`);
					ctx.body = response;
				});
			});
		}
		return this._route;
	}

	toString() {
		return `${this.method} ${this.name}`;
	}
}

const httpRoutingStep = Object.assign({}, step.Step, {
	"name": "kronos-http-routing",
	"description": "routes http requests to endpoints",
	initialize(manager, name, conf, props) {
		props._listener = {
			value: conf.listener || 'default-listener'
		};
	},

	_start() {
		// wait until names service is present
		return this.manager.declareService({
			'type': 'koa',
			'name': this._listener
		}, true).then(service => {
			this.listener = service;
			for (let en in this.endpoints) {
				const route = this.endpoints[en].route;
				if (route) {
					service.koa.use(route);
				}
			}

			return service.start();
		});
	},

	_stop() {
		for (let en in this.endpoints) {
			const route = this.endpoints[en].route;
			if (route) {
				this.trace(level => `removing route ${this.endpoints[en]}`);
				this.listener.koa.delete(route);
			}
		}
		return Promise.resolve();
	},

	createEndpoints(def) {
		for (let name in def.endpoints) {
			const r = def.endpoints[name];

			const ep = new RouteSendEndpoint(name, this, r.path || name, r.method);

			if (def.interceptors) {
				ep.interceptors = def.interceptors.map(icDef => this.manager.createInterceptorInstanceFromConfig(icDef, ep));
			}

			this.addEndpoint(ep);
		}
	}
});

exports.registerWithManager = manager => manager.registerStep(httpRoutingStep);

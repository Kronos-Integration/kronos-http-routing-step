/* jslint node: true, esnext: true */

"use strict";

const pathToRegexp = require('path-to-regexp'),
	step = require('kronos-step'),
	endpoint = require('kronos-endpoint');


function decode(val) {
	if (val) return decodeURIComponent(val);
}

/**
 * Endpoint to link against a koa route
 */
class RouteSendEndpoint extends endpoint.SendEndpoint {

	/**
	 * @param name {String} endpoint name
	 * @param owner {Step} the owner of the endpoint
	 * @param method {String} http method defaults to get
	 * @param serviceName
	 */
	constructor(name, owner, path, method, serviceName) {
		super(name, owner);

		// The path in the URL
		Object.defineProperty(this, 'path', {
			value: path
		});

		const keys = [];
		const re = pathToRegexp(path, keys, {});

		Object.defineProperty(this, 'regex', {
			value: re
		});

		Object.defineProperty(this, 'keys', {
			value: keys
		});

		method = method ? method.toUpperCase() : 'GET';

		// The HTTP method to use (GET, POST, ...)
		Object.defineProperty(this, 'method', {
			value: method
		});

		Object.defineProperty(this, 'serviceName', {
			value: serviceName
		});
	}

	get route() {
		return (ctx, next) => {
			if (!this.matches(ctx, this.method)) return next();

			// path
			const m = this.regex.exec(ctx.path);
			if (m) {
				const args = m.slice(1).map(decode);
				const values = {};
				for (const i in args) {
					values[this.keys[i].name] = args[i];
				}

				return this.receive(ctx, values).catch(e => {
					this.owner.error(`${this.method} ${this.path}: ${e}`);
					ctx.body = e;
				});
			}

			// miss
			return next();
		};
	}

	matches(ctx) {
		if (ctx.method === this.method) return true;
		if (this.method === 'GET' && ctx.method === 'HEAD') return true;
		return false;
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

			const registry = this.manager.services.registry;

			for (let en in this.endpoints) {
				const ep = this.endpoints[en];
				const route = ep.route;

				if (route) {
					service.koa.use(route);

					if (registry && ep.serviceName) {
						registry.registerService(ep.serviceName, {
							url: this.listener.url + ep.path
						});
					}
				}
			}

			return service.start();
		});
	},

	_stop() {
		const registry = this.manager.services.registry;

		for (let en in this.endpoints) {
			const ep = this.endpoints[en];
			const route = ep.route;
			if (route) {
				if (registry && ep.serviceName) {
					registry.unregisterService(ep.serviceName, {
						url: this.listener.url + ep.path
					});
				}

				this.listener.koa.delete(route);
			}
		}
		return Promise.resolve();
	},

	createEndpoint(name, def) {
		const ep = new RouteSendEndpoint(name, this, def.path || name, def.method, def.serviceName);

		this.addEndpoint(ep);

		if (def.interceptors) {
			ep.interceptors = def.interceptors.map(icDef => this.manager.createInterceptorInstanceFromConfig(icDef, ep));
		}
	}
});

exports.registerWithManager = manager => manager.registerStep(httpRoutingStep);

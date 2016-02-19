/* jslint node: true, esnext: true */

"use strict";

const pathToRegexp = require('path-to-regexp'),
	step = require('kronos-step'),
	endpoint = require('kronos-endpoint'),
	service = require('kronos-service');


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

	wantsServiceRegistration() {
		for (const en in this.endpoints) {
			const e = this.endpoints[en];
			if (e.serviceName !== undefined) {
				return true;
			}
		}
		return false;
	},

	_start() {
		const serviceDefs = {
			'listener': {
				type: 'koa',
				name: this._listener
			}
		};

		if (this.wantsServiceRegistration()) {
			serviceDefs.registry = 'registry';
		}

		// wait until services are present
		return service.ServiceConsumerMixin.defineServiceConsumerProperties(this, serviceDefs, this.manager, true)
			.then(() => {
				for (let en in this.endpoints) {
					const ep = this.endpoints[en];
					const route = ep.route;

					if (route) {
						this.listener.koa.use(route);

						if (ep.serviceName) {
							this.registry.registerService(ep.serviceName, {
								url: this.listener.url + ep.path
							});
						}
					}
				}

				return Promise.resolve();
			}).catch(console.log);
	},

	_stop() {
		for (let en in this.endpoints) {
			const ep = this.endpoints[en];
			const route = ep.route;
			if (route) {
				if (ep.serviceName) {
					this.registry.unregisterService(ep.serviceName, {
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

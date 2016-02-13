/* jslint node: true, esnext: true */

"use strict";

const path = require('path'),
	route = require('koa-route'),
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
	constructor(name, owner, path, method, content, serviceName) {
		super(name, owner);

		// The path in the URL
		Object.defineProperty(this, 'path', {
			value: path
		});

		method = method ? method.toLowerCase() : 'get';

		// The HTTP method to use (GET, POST, ...)
		Object.defineProperty(this, 'method', {
			value: method
		});

		Object.defineProperty(this, 'serviceName', {
			value: serviceName
		});
	}

	get route() {
		// TODO: call this.receive directly
		return route[this.method](this.path, (ctx, a, b, c) => {
			return this.receive(ctx, a, b, c).catch(e => {
				this.owner.error(`${this.method} ${this.path}: ${e}`);
				ctx.body = e;
			});
		});

		//return route[this.method](this.path, this.receive);
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
							url: path.join(this.listener.url, route.path)
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
						url: path.join(this.listener.url, route.path)
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

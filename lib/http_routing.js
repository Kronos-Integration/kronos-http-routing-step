/* jslint node: true, esnext: true */

"use strict";

const path = require('path'),
	route = require('koa-route'),
	step = require('kronos-step'),
	ReadableStream = require('stream').Readable,
	FormData = require('form-data'),
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

		method = method ? method.toLowerCase() : "get";

		// The HTTP method to use (GET, POST, ...)
		Object.defineProperty(this, 'method', {
			value: method
		});

		// The path in the URL
		Object.defineProperty(this, 'serviceName', {
			value: serviceName
		});
	}


	/**
	 *
	 */
	get route() {
		if (!this._route) {
			this._route = route[this.method](this.path, ctx => {

				this.owner.info(`${this.method} ${this.path}`);

				const message = {
					"info": {
						"request": ctx.request,
					},
					"payload": ctx.req
				};

				return this.receive(message).then(response => {
					//this.owner.info(`${this.method} ${this.path}: ${JSON.stringify(response)}`);
					this.owner.info(`${this.method} ${this.path}`);

					if (response && (response.payload.readable)) {
						ctx.set('content-type', response.payload.getHeaders()["content-type"]);
						ctx.body = response.payload;
					} else {
						ctx.body = response;
					}

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

				this.trace(level => `removing route ${this.endpoints[en]}`);
				this.listener.koa.delete(route);
			}
		}
		return Promise.resolve();
	},

	createEndpoints(def) {
		for (let name in def.endpoints) {
			const r = def.endpoints[name];

			const ep = new RouteSendEndpoint(name, this, r.path || name, r.method, r.serviceName);

			if (r.interceptors) {
				ep.interceptors = r.interceptors.map(icDef => this.manager.createInterceptorInstanceFromConfig(icDef, ep));
			}

			this.addEndpoint(ep);
		}
	}
});

exports.registerWithManager = manager => manager.registerStep(httpRoutingStep);

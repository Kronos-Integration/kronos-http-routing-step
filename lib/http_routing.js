/* jslint node: true, esnext: true */

'use strict';

const step = require('kronos-step'),
	endpoint = require('kronos-endpoint'),
	service = require('kronos-service'),
	ks = require('kronos-service-koa');

const httpRoutingStep = Object.assign({}, step.Step, {
	'name': 'kronos-http-routing',
	'description': 'routes http requests to endpoints',
	initialize(manager, name, conf, props) {
		props._listener = {
			value: conf.listener || 'default-listener'
		};

		if (conf.mount !== undefined) {
			props.mount = {
				value: conf.mount
			};
		}
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
					} else if (ep.socket) {
						this.listener.addSocketEndpoint(ep);
					}
				}

				return Promise.resolve();
			});
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
			} else if (ep.socket) {
				this.listener.removeSocketEndpoint(ep);
			}
		}
		return Promise.resolve();
	},

	createEndpoint(name, def) {
		let path = def.path || name;
		let ep;

		if (def.socket) {
			ep = new ks.SocketEndpoint(name, this, path);
		} else {
			if (this.mount !== undefined) {
				path = this.mount + path;
			}
			ep = new ks.RouteSendEndpoint(name, this, path, def.method, def.serviceName);
		}

		this.addEndpoint(ep);

		if (def.interceptors) {
			ep.interceptors = def.interceptors.map(icDef => this.manager.createInterceptorInstanceFromConfig(icDef, ep));
		}
	}
});

exports.registerWithManager = manager => manager.registerStep(httpRoutingStep);

/* global describe, before, it, xit */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise),
  ksm = require('kronos-service-manager'),
  testStep = require('kronos-test-step'),
  endpoint = require('kronos-endpoint');


let manager;

before(done => {
  ksm.manager([{}, {
    name: "my-listener",
    hostname: "localhost"
  }], [require('kronos-service-registry'), require('kronos-service-koa'), require('../lib/http_routing')]).then(m => {
    manager = m;
    done();
  });
});

it('http-routing', () => {
  const hr = manager.steps['kronos-http-routing'].createInstance({
    name: "myStep",
    type: "kronos-http-routing",
    listener: "my-listener",
    mount: "/mnt",
    endpoints: {
      "ep1": {
        "serviceName": "service1",
        "path": "/r1",
        "target": "out1"
      },
      "ep2": {
        "method": "post",
        "path": "/r2",
        "target": "out1"
      },
      "/r3/:id/:all": {
        "method": "delete"
      },
      "sp1": {
        "path": "/socket",
        "socket": true
      }
    }
  }, manager);

  const epTestEndpoint = new endpoint.ReceiveEndpoint('ep1test');

  let epData;

  epTestEndpoint.receive = (ctx, args) => {
    ctx.req.on('data', chunk => {
      epData = chunk;
    });

    ctx.body = {
      args: args,
      path: ctx.request.path,
      method: ctx.method
    };
    return Promise.resolve();
  };

  hr.endpoints.ep1.connected = epTestEndpoint;
  hr.endpoints.ep2.connected = epTestEndpoint;
  hr.endpoints['/r3/:id/:all'].connected = epTestEndpoint;

  describe('static', () => {
    testStep.checkStepStatic(manager, hr);
    it('has endpoints', () => {
      assert.equal(hr.endpoints.ep1.name, "ep1");
      assert.equal(hr.endpoints.ep1.serviceName, "service1");
      assert.deepEqual(hr.endpoints.ep1.toJSON(), {
        method: "GET",
        out: true,
        path: "/mnt/r1",
        serviceName: "service1"
      });
      assert.equal(hr.endpoints.ep2.name, "ep2");
      assert.deepEqual(hr.endpoints.ep2.toJSON(), {
        method: "POST",
        out: true,
        path: "/mnt/r2"
      });
      assert.equal(hr.endpoints['/r3/:id/:all'].name, "/r3/:id/:all");
      assert.equal(hr.endpoints['/r3/:id/:all'].method, "DELETE");
      assert.deepEqual(hr.endpoints['/r3/:id/:all'].toJSON(), {
        method: "DELETE",
        out: true,
        path: "/mnt/r3/:id/:all"
      });
    });
  });

  describe('live-cycle', () => {
    let wasRunning = false;
    testStep.checkStepLivecycle(manager, hr, (step, state, livecycle, done) => {
      if (state === 'running' && !wasRunning) {
        wasRunning = true;

        const app = step.listener.server.listen();

        request(app)
          .get('/mnt/r1')
          .expect(200)
          .then(res => {
            try {
              const r = JSON.parse(res.text);
              assert.equal(r.path, '/mnt/r1');
              assert.equal(r.method, 'GET');

              request(app)
                .post('/mnt/r2')
                .send({
                  name: 'Manny',
                  species: 'cat'
                })
                .expect(200)
                .then(res => {
                  try {
                    const r = JSON.parse(res.text);

                    assert.equal(r.path, '/mnt/r2');
                    assert.equal(JSON.parse(epData).name, 'Manny');

                    request(app)
                      .delete('/mnt/r3/4711/all')
                      .expect(200)
                      .then(res => {
                        const r = JSON.parse(res.text);
                        assert.equal(r.path, '/mnt/r3/4711/all');
                        assert.equal(r.args.all, 'all');
                        assert.equal(r.args.id, '4711');
                        assert.equal(r.method, 'DELETE');
                        done();
                      }).catch(done);
                  } catch (e) {
                    console.log(`Error: ${e}`);
                    done(e);
                  }
                });
            } catch (e) {
              console.log(`Error: ${e}`);
              done(e);
            }
          }).catch(done);
      } else {
        if (state === 'stopped' && wasRunning) {
          //assert.equal(manager.flows['sample'].name, 'sample');
        }

        done();
      }
    });
  });
});

/* global describe, it, xit */
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
  ksm.manager({}, [require('kronos-service-koa'), require('../lib/http_routing')]).then(m => {
    manager = m;
    done();
  });
});

it('http-routing', () => {
  const hr = manager.steps['kronos-http-routing'].createInstance({
    name: "myStep",
    type: "kronos-http-routing",
    listener: "my-listener",

    endpoints: {
      "ep1": {
        "path": "/r1",
        "target": "out1",
        "content": {
          "key1": "value1"
        }
      },
      "ep2": {
        "method": "post",
        "path": "/r2",
        "target": "out1"
      },
      "/r3/:id": {
        "method": "delete"
      }
    }
  }, manager);

  const ep1TestEndpoint = new endpoint.ReceiveEndpoint('ep1test');

  let ep1Request;
  ep1TestEndpoint.receive = request => {
    ep1Request = request;
    return Promise.resolve({
      message: "returned from ep1test"
    });
  };

  hr.endpoints.ep1.connected = ep1TestEndpoint;

  const ep2TestEndpoint = new endpoint.ReceiveEndpoint('ep2test');

  let ep2Request;
  let ep2Data;

  ep2TestEndpoint.receive = request => {
    ep2Request = request;
    ep2Request.stream.on('data', chunk => {
      ep2Data = chunk;
    });
    return Promise.resolve("ok");
  };

  hr.endpoints.ep2.connected = ep2TestEndpoint;

  const ep3TestEndpoint = new endpoint.ReceiveEndpoint('ep3test');

  let ep3Request;
  ep3TestEndpoint.receive = request => {
    ep3Request = request;
    return Promise.resolve("delete ok");
  };

  hr.endpoints['/r3/:id'].connected = ep3TestEndpoint;

  describe('static', () => {
    testStep.checkStepStatic(manager, hr);
    it('has endpoints', () => {
      assert.equal(hr.endpoints.ep1.name, "ep1");
      assert.equal(hr.endpoints.ep2.name, "ep2");
      assert.equal(hr.endpoints['/r3/:id'].name, "/r3/:id");
    });
  });

  describe('live-cycle', () => {
    let wasRunning = false;
    testStep.checkStepLivecycle(manager, hr, (step, state, livecycle, done) => {
      if (state === 'running' && !wasRunning) {
        wasRunning = true;

        const app = step.listener.server.listen();

        request(app)
          .get('/r1')
          .expect(200)
          .then(res => {
            try {
              assert.equal(ep1Request.info.request.path, '/r1');
              const r = JSON.parse(res.text);
              if (r.message !== 'returned from ep1test') throw Error("not OK");

              request(app)
                .post('/r2')
                .send({
                  name: 'Manny',
                  species: 'cat'
                })
                .expect(200)
                .then(res => {
                  try {
                    assert.equal(ep2Request.info.request.path, '/r2');
                    assert.equal(JSON.parse(ep2Data).name, 'Manny');

                    request(app)
                      .delete('/r3/4711')
                      .expect(200)
                      .then(res => {
                        done();
                      });
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

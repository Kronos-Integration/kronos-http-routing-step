/* global describe, it, xit */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise),
  path = require('path'),
  fs = require('fs'),
  testStep = require('kronos-test-step'),
  BaseStep = require('kronos-step');

chai.use(require("chai-as-promised"));

const manager = testStep.managerMock;

require('../lib/http_routing').registerWithManager(manager);
require('kronos-koa-service').registerWithManager(manager);

describe('http-routing', function () {
  const hr = manager.steps['kronos-http-routing'].createInstance(manager, undefined, {
    name: "myStep",
    type: "kronos-http-routing",

    listener: {
      name: "my-listener",
      port: 1234,
      logLevel: "error"
    },

    routes: {
      "/r1": {
        "name": "ep1",
        "target": "out1",
        "content": {
          "key1": "value1"
        }
      },
      "/r2": {
        "method": "post",
        "name": "ep2",
        "target": "out1"
      },
      "/r3/:id": {
        "method": "delete"
      }
    }
  });

  const ep1TestEndpoint = BaseStep.createEndpoint('ep1test', {
    "in": true,
    "passive": true
  });
  let ep1Request;
  ep1TestEndpoint.receive(function* () {
    do {
      ep1Request = yield Promise.resolve("OK");
    }
    while (true);
  });
  ep1TestEndpoint.connect(hr.endpoints.ep1);

  const ep2TestEndpoint = BaseStep.createEndpoint('ep2test', {
    "in": true,
    "passive": true
  });

  let ep2Request;
  let ep2Data;
  ep2TestEndpoint.receive(function* () {
    do {
      ep2Request = yield Promise.resolve("OK");
      //ep2Request.stream.pipe(process.stdout);
      ep2Request.stream.on('data', function (chunk) {
        ep2Data = chunk;
        //console.log('got %d bytes of data', chunk.length);
      });
    } while (true);
  });
  ep2TestEndpoint.connect(hr.endpoints.ep2);

  describe('static', function () {
    testStep.checkStepStatic(manager, hr);
    it('has endpoints', function () {
      assert.equal(hr.endpoints.ep1.name, "ep1");
      assert.equal(hr.endpoints.ep2.name, "ep2");
      assert.equal(hr.endpoints['/r3/:id'].name, "/r3/:id");
    });

    it('has logLevel', function () {
      assert.equal(hr.listener.logLevel, "error");
    });
  });

  describe('live-cycle', function () {
    let wasRunning = false;
    testStep.checkStepLivecycle(manager, hr, function (step, state, livecycle, done) {
      if (state === 'running' && !wasRunning) {
        wasRunning = true;

        const app = step.listener.server.listen();

        request(app)
          .get('/r1')
          .expect(200)
          .then(function (res) {
            try {
              assert.equal(ep1Request.info.request.path, '/r1');
              if (res.text !== 'OK') throw Error("not OK");

              request(app)
                .post('/r2')
                .send({
                  name: 'Manny',
                  species: 'cat'
                })
                .expect(200)
                .then(function (res) {
                  try {
                    assert.equal(ep2Request.info.request.path, '/r2');
                    assert.equal(JSON.parse(ep2Data).name, 'Manny');
                    done();
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

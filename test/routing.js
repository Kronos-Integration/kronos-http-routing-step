/* global describe, it, xit */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  request = require("supertest-as-promised")(Promise);

chai.use(require("chai-as-promised"));


const path = require('path'),
  fs = require('fs');

const testStep = require('kronos-test-step'),
  BaseStep = require('kronos-step');

const manager = testStep.managerMock;

require('../lib/http_routing').registerWithManager(manager);

describe('http-routing', function () {
  const hr = manager.steps['kronos-http-routing'].createInstance(manager, undefined, {
    name: "myStep",
    type: "kronos-http-routing",

    listener: {
      port: 1234
    },

    routes: {
      "r1/:id": {},
      "r2": {
        "method": "DELETE"
      }
    }
  });

  const testEndpoint = BaseStep.createEndpoint('test', {
    "in": true,
    "passive": true
  });

  testEndpoint.receive(function* () {
    let request = yield;
    console.log(`got request: ${request}`);
  });

  //testEndpoint.connect(hr.endpoints.out);

  describe('static', function () {
    testStep.checkStepStatic(manager, hr);
  });

  describe('live-cycle', function () {
    let wasRunning = false;
    testStep.checkStepLivecycle(manager, hr, function (step, state, livecycle) {
      if (state === 'running' && !wasRunning) {
        wasRunning = true;

        request(step.listener.server.listen())
          .get('/r1x')
          .expect(200)
          .expect(function (res) {
            console.log('GET 200');
            if (res.text !== 'OK') throw Error("not OK");
          });
      }

      if (state === 'stopped' && wasRunning) {
        //assert.equal(manager.flows['sample'].name, 'sample');
      }
    });
  });
});

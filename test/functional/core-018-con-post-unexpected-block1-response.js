/*
 Handle an unexpected Block1 response to a confirmable POST request:

 1. Client sends a request:
 ==============================================================================
 Version | Type | Token Length | Code            | Message ID
 0 1     | 0 0  | 0 0 0 0      | 0 0 0 0 0 0 1 0 | 0x0001
 1       | CON  | 0 bytes      | POST            | 1
 ------------------------------------------------------------------------------
 Remote Endpoint: 127.0.0.1
 ------------------------------------------------------------------------------
 Uri-Path      : unexpected-block1
 Content-Format: text/plain;charset=utf-8
 ------------------------------------------------------------------------------
 Payload (14 bytes)
 Lorem ipsum...
 ==============================================================================

 2. Server sends an invalid ACK response with a Block1 option:
 ==============================================================================
 Version | Type | Token Length | Code            | Message ID
 0 1     | 1 0  | 0 0 0 0      | 0 1 0 0 0 0 0 1 | 0x0001
 1       | ACK  | 0 bytes      | 2.01 Created    | 1
 ------------------------------------------------------------------------------
 Remote Endpoint: 127.0.0.1
 ------------------------------------------------------------------------------
 Block1: NUM: 0, M: false, SZX: 5 (512 bytes)
 ==============================================================================

 3. Client receives the #2 response. Request emits the `acknowledged` event.

 4. Client sees that the #2 response includes a Block1 option, but because
 the #1 request is not blockwise, the response is ignored.

 5. After `exchangeTimeout` ms have passed, the client emits
 the `exchange timeout` event and the request emits the `timeout` event.
*/

'use strict';

require('should');

var sinon = require('sinon');
var helpers = require('../helpers');
var Message = require(helpers.LIB_DIR).Message;

helpers.test(__filename, function(ctx)
{
  var expectedRequest = {
    type: Message.Type.CON,
    code: Message.Code.POST,
    id: 0x0001,
    token: new Buffer([]),
    uri: '/unexpected-block1',
    contentFormat: 'text/plain;charset=utf-8',
    payload: new Buffer('Lorem ipsum...')
  };
  var expectedResponse = {
    type: Message.Type.ACK,
    code: Message.Code.CREATED,
    id: expectedRequest.id,
    token: expectedRequest.token,
    block1: {num: 0, m: false, size: 512}
  };

  ctx.socket.expectRequest(expectedRequest);
  ctx.socket.scheduleResponse(1000, expectedResponse);

  var req = ctx.client.request(Message.fromObject(expectedRequest));

  var eventSpy = sinon.spy(req, 'emit');

  ctx.clock.tick(3600000);

  return function assert()
  {
    ctx.socket.assert();

    sinon.assert.callCount(eventSpy, 2);

    sinon.assert.calledWith(
      eventSpy, 'acknowledged', sinon.match.instanceOf(Message)
    );
    sinon.assert.calledWith(eventSpy, 'timeout');

    eventSpy.args[0][0].should.be.equal('acknowledged');
    sinon.assert.coapMessage(
      eventSpy.args[0][1], expectedResponse, "Invalid ACK."
    );

    eventSpy.args[1][0].should.be.equal('timeout');
  };
});

#!/usr/bin/env node

var wx = require("./lib/wx.js");
var getUuid = wx.getUuid;
var checkState = wx.checkState;
var login = wx.login;
var init = wx.init;
var getContact = wx.getContact;
var receiveAndSend =wx.receiveAndSend;

getUuid.then(checkState).then(login).then(init).then(getContact).then(receiveAndSend);
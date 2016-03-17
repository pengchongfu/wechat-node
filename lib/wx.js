var request = require("request");
var qrcode = require("qrcode-terminal");
var readline = require("readline");

var getUuid = new Promise(function(resolve,reject){
  var wxSession={};//记录本次登录的各种数据
  console.log("程序开始启动");
  
  var options={
    baseUrl:"https://login.weixin.qq.com",
    uri:"/jslogin",
    method:"GET",
    qs:{
      appid:"wx782c26e4c19acffb",
      redirect_uri:"https://wx.qq.com/cgi-bin/mmwebwx-bin/webwxloginpage",
      fun:"new",
      lang:"en_US",
      _:Date.now()
    }
  };
  
  request(options,function(err,res,body){
    if(err)return reject(err);
    wxSession.uuid=body.substring(50,62);
    wxSession.tip=1;
    console.log("uuid:"+wxSession.uuid);
    qrcode.generate("https://login.weixin.qq.com/l/"+wxSession.uuid);
    resolve(wxSession);
  });
  
});


function checkState(wxSession){
  var url='https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?loginicon=true&uuid='+wxSession.uuid+"&tip="+wxSession.tip+"&r="+~Date.now();
  return new Promise(function(resolve,reject){
    request(url,function(err,res,body){
      if(err)return reject(err);
      if(/window\.code=201/.test(body)){
        wxSession.tip=0;
        console.log("请确认");
        resolve(checkState(wxSession));
      }
      else if(/window\.code=200/.test(body)){
        wxSession.redirect=/window\.redirect_uri="([^"]+)";/.exec(body)[1];
        console.log("重定向"+wxSession.redirect);
        resolve(wxSession);
      }
      else{
        console.log("超时，重启程序");
      }
    })
  });
}

function login(wxSession){
  return new Promise(function(resolve,reject){
    request({
      uri:wxSession.redirect,
      jar:true,
      followRedirect:false
    },
    function(err,res,body){
      if(err)reject(err);
      wxSession.BaseRequest={
        skey:(new RegExp('<skey>([^<]+)</skey>')).exec(body)[1],
        sid:(new RegExp('<wxsid>([^<]+)</wxsid>')).exec(body)[1],
        uin:(new RegExp('<wxuin>([^<]+)</wxuin>')).exec(body)[1],
        deviceId:'e' + ('' + Math.random().toFixed(15)).substring(2, 17)
      };
      wxSession.pass_ticket=(new RegExp('<pass_ticket>([^<]+)</pass_ticket>')).exec(body)[1];
      console.log("登录成功");
      resolve(wxSession);
    });
  });
}

function init(wxSession){
  return new Promise(function(resolve,reject){
    var options={
      baseUrl:'https://wx.qq.com',
      uri:'cgi-bin/mmwebwx-bin/webwxinit?pass_ticket='+wxSession.pass_ticket,
      method:'POST',
      json:true,
      jar:true,
      headers:{
        'Content-Type': 'application/json;charset=utf-8'
      },
      body:{
        BaseRequest:wxSession.BaseRequest
      }
    }
    request(options,function(err,res,body){
      if(err)return reject(err);
      console.log("初始化成功");
      wxSession.username = body['User']['UserName'];
      wxSession.nickname = body['User']['NickName'];
      wxSession.syncKey = body['SyncKey'];
      resolve(wxSession);
    })
    
  });
}

function getContact(wxSession){
  return new Promise(function(resolve,reject){
    var options={
      baseUrl:"https://wx.qq.com",
      uri:'/cgi-bin/mmwebwx-bin/webwxgetcontact?lang=en_US&pass_ticket='+wxSession.BaseRequest.pass_ticket+'&skey='+wxSession.BaseRequest.skey+'&seq=0&r='+Date.now(),
      method:'GET',
      json:true,
      jar:true
    }
    request(options,function(err,res,body){
      if(err)return reject(err);
      wxSession.MemberList=body.MemberList;
      resolve(wxSession);
    });
  });
}

function sendMessage(wxSession){
  const rl=readline.createInterface({
    input:process.stdin,
    output:process.stdout
  });
  return new Promise(function(resolve,reject){
    rl.question("",function(input){
      rl.close();
      
      if(input[0]==="!"){
        wxSession.userTalkking=input.substr(1);
        console.log("当前聊天用户更换为 "+wxSession.userTalkking);
      }
      else {
        sendToServer(wxSession.userTalkking,input,wxSession);
      }
     
      resolve(sendMessage(wxSession));
      
      
      
    });
  });
}

function sendToServer(user,msg,wxSession){
  var touser;
  for(var i=0,l=wxSession.MemberList.length;i<l;i++){
    if(wxSession.MemberList[i].RemarkName===user){
      touser=wxSession.MemberList[i].UserName;
    }
  }
  
  
  var msgId=(Date.now()+Math.random().toFixed(3)).replace('.','');
  var data={
    BaseRequest:wxSession.BaseRequest,
    Msg:{
      Type:1,
      Content:msg,
      FromUserName:wxSession.username,
      ToUserName:touser,
      LocalId:msgId,
      ClientMsgId:msgId
    }
  }
  var options={
    baseUrl:"https://wx.qq.com",
    uri:"/cgi-bin/mmwebwx-bin/webwxsendmsg?lang=en_US&pass_ticket="+wxSession.pass_ticket,
    method:"POST",
    jar:true,
    json:true,
    body:data
  }
  request(options,function(err,res,body){
    if(!err)console.log("发送 "+msg+">"+user+" 成功");
  });
}

exports.getUuid=getUuid;
exports.checkState=checkState;
exports.login=login;
exports.init=init;
exports.getContact=getContact;
exports.sendMessage=sendMessage;
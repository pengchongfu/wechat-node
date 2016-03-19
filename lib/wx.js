var request = require("request");//处理http请求的模块
var qrcode = require("qrcode-terminal");//生成二维码的模块
var readline = require("readline");//构建cli的模块
var chalk = require("chalk");//修改命令颜色的模块

/*获取uuid参数并根据该参数生成二维码*/
var getUuid = new Promise(function(resolve,reject){
  console.log("程序开始启动");
  var wxSession={};//记录本次登录的各种数据，参数的意义见http://reverland.org/javascript/2016/01/15/webchat-user-bot/
  
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
  }
  
  request(options,function(err,res,body){
    if(err)return reject(err);
    wxSession.uuid=body.substring(50,62);
    wxSession.tip=1;
    qrcode.generate("https://login.weixin.qq.com/l/"+wxSession.uuid);
    console.log('请扫描二维码');
    resolve(wxSession);
  });
});

/*确定二维码的状态，并且获取重定向链接*/
function checkState(wxSession){
  var url='https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?loginicon=true&uuid='+wxSession.uuid+"&tip="+wxSession.tip+"&r="+~Date.now();
  return new Promise(function(resolve,reject){
    request(url,function(err,res,body){
      if(err)return reject(err);
      if(/window\.code=201/.test(body)){
        wxSession.tip=0;
        console.log("请确认登录");
        resolve(checkState(wxSession));
      }
      else if(/window\.code=200/.test(body)){
        wxSession.redirect=/window\.redirect_uri="([^"]+)";/.exec(body)[1];
        console.log("重定向成功");
        resolve(wxSession);
      }
      else{
        resolve(checkState(wxSession));
      }
    });
  });
}

/*获取登录信息*/
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

/*初始化，获取用户信息*/
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
      wxSession.synckey = body['SyncKey'];
      resolve(wxSession);
    });    
  });
}

/*获取联系人列表*/
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
      console.log("获取联系人列表成功");
      resolve(wxSession);
    });
  });
}

/*进入cli模式*/
function cli(wxSession){
  const rl=readline.createInterface({
    input:process.stdin,
    output:process.stdout,
    terminal:true,
  });
  rl.setPrompt(wxSession.userTalkking+" << ");
  rl.on('line',function(input){
    if(input===""){
      rl.prompt();
      return;
    }
    if(input==="!!!"){
      console.log(chalk.blue("当前用户为 "+wxSession.userTalkking));
      rl.prompt();
      return;
    }
    if(input[0]==="!"){
      wxSession.userTalkking=input.substr(1);
      console.log(chalk.blue("当前用户更换为 "+wxSession.userTalkking));
      rl.setPrompt(wxSession.userTalkking+" << ");
      rl.prompt();
    }
    else {
      sendMsg(wxSession.userTalkking,input,wxSession);
      rl.prompt();
    }
  });
  rl.prompt();
  return rl;
}

/*发送消息到服务器*/
function sendMsg(user,msg,wxSession){
  var username='';
  if(wxSession.nickname===user){
    username=wxSession.username;
  }
  for(var i=0,l=wxSession.MemberList.length;i<l;i++){
    if(wxSession.MemberList[i].RemarkName===user){
      username=wxSession.MemberList[i].UserName;
      break;
    }
  }
  if(username===''){
    console.log(chalk.red("用户不存在，请通过`!username`设置，`!!!`查看"));
    return;
  }
  
  var msgId=(Date.now()+Math.random().toFixed(3)).replace('.','');
  var body={
    BaseRequest:wxSession.BaseRequest,
    Msg:{
      Type:1,
      Content:msg,
      FromUserName:wxSession.username,
      ToUserName:username,
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
    body:body
  }
  request(options,function(err,res,body){
    if(err){
      readline.clearLine(process.stdout,0);
      readline.cursorTo(process.stdout,0);
      console.log(chalk.red(user+" << "+msg));
      wxSession.rl.prompt(true);
    }
  });
}

/*长连接，检查是否需要同步消息*/
function syncCheck(wxSession){
  return new Promise(function(resolve,reject){
    var synckey=wxSession.synckey.List.map(o=>o.Key + '_' + o.Val).join('|');
    var options={
      baseUrl:"https://webpush.weixin.qq.com",
      uri:'/cgi-bin/mmwebwx-bin/synccheck',
      method:'GET',
      qs:{
        r:Date.now(),
        skey:wxSession.BaseRequest.skey,
        sid:wxSession.BaseRequest.sid,
        uin:wxSession.BaseRequest.uin,
        deviceid:wxSession.BaseRequest.deviceId,
        synckey:synckey
      },
      jar:true,
      timeout:35000,
    }
    request(options,function(err,res,body){
      if(err)reject(err);
      if(body!=='window.synccheck={retcode:"0",selector:"0"}'){
        resolve(webwxsync(wxSession));
      }
      else{
        resolve(syncCheck(wxSession));
      }
    });
  });
}

/*接收新消息，更新synckey*/
function webwxsync(wxSession){
  return new Promise(function(resolve,reject){
    var options={
      baseUrl:'https://wx.qq.com',
      uri:'/cgi-bin/mmwebwx-bin/webwxsync?sid='+wxSession.BaseRequest.sid+'&skey='+wxSession.BaseRequest.skey+'&lang=en_US&pass_ticket=$'+wxSession.pass_ticket+'&rr='+~Date.now(),
      method:"POST",
      body:{
        BaseRequest:wxSession.BaseRequest,
        SyncKey:wxSession.synckey,
      },
      json:true,
      jar:true,
      timeout:15000,
    }
    request(options,function(err,res,body){
      if(err){
        resolve(webwxsync(wxSession));
        return;
      }
      if(!body||body.BaseResponse.Ret!==0){
        resolve(webwxsync(wxSession));
        return;
      }
      wxSession.synckey=body.SyncKey;
      if(body.AddMsgList.length>0){
        for(var i=0,l=body.AddMsgList.length;i<l;i++){
          if(body.AddMsgList[i].MsgType===1){
            receiveMsg(body.AddMsgList[i].FromUserName,body.AddMsgList[i].Content,wxSession);
          }
        }
      }
      resolve(syncCheck(wxSession));
    });
  });
}

/*处理接收到的消息*/
function receiveMsg(username,content,wxSession){
  var nickname='';
  for(var i in wxSession.MemberList){
    if(wxSession.MemberList[i].UserName===username){
      nickname=wxSession.MemberList[i].RemarkName;
      break;
    }
  }
  if(nickname===''){
    if(wxSession.username===username){
      nickname=wxSession.nickname;
    }
    else{
      nickname="微信群";
    }
  }
  
  readline.clearLine(process.stdout,0);
  readline.cursorTo(process.stdout,0);
  console.log(chalk.green(nickname+" >> "+content));
  wxSession.rl.prompt(true);
}

/*开启cli和长连接的入口*/
function receiveAndSend(wxSession){
  var rl=cli(wxSession);
  wxSession.rl=rl;
  syncCheck(wxSession);
}

exports.getUuid=getUuid;
exports.checkState=checkState;
exports.login=login;
exports.init=init;
exports.getContact=getContact;
exports.receiveAndSend=receiveAndSend;
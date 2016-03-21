var request = require("request");//处理http请求的模块
var qrcode = require("qrcode-terminal");//生成二维码的模块
var readline = require("readline");//构建cli的模块
var chalk = require("chalk");//修改命令颜色的模块
var url = require("url");

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
  var uri='https://login.weixin.qq.com/cgi-bin/mmwebwx-bin/login?loginicon=true&uuid='+wxSession.uuid+"&tip="+wxSession.tip+"&r="+~Date.now();
  return new Promise(function(resolve,reject){
    request(uri,function(err,res,body){
      if(err)return reject(err);
      if(/window\.code=201/.test(body)){
        wxSession.tip=0;
        console.log("请确认登录");
        resolve(checkState(wxSession));
      }
      else if(/window\.code=200/.test(body)){
        wxSession.redirect=/window\.redirect_uri="([^"]+)";/.exec(body)[1];
        console.log("重定向成功");
        var e=url.parse(wxSession.redirect).host,
            t="weixin.qq.com",
            o="file.wx.qq.com",
            n="webpush.weixin.qq.com";
        e.indexOf("wx2.qq.com")>-1?(t="weixin.qq.com",o="file2.wx.qq.com",n="webpush2.weixin.qq.com"):e.indexOf("qq.com")>-1?(t="weixin.qq.com",o="file.wx.qq.com",n="webpush.weixin.qq.com"):e.indexOf("web1.wechat.com")>-1?(t="wechat.com",o="file1.wechat.com",n="webpush1.wechat.com"):e.indexOf("web2.wechat.com")>-1?(t="wechat.com",o="file2.wechat.com",n="webpush2.wechat.com"):e.indexOf("wechat.com")>-1?(t="wechat.com",o="file.wechat.com",n="webpush.wechat.com"):e.indexOf("web1.wechatapp.com")>-1?(t="wechatapp.com",o="file1.wechatapp.com",n="webpush1.wechatapp.com"):(t="wechatapp.com",o="file.wechatapp.com",n="webpush.wechatapp.com");
        //以上为web微信源代码内的代码，只使用了e和t，e代表获取消息的服务器，n代表保持轮询的服务器
        wxSession.e="https://"+e;
        wxSession.t="https://"+t;
        wxSession.o="https://"+o;
        wxSession.n="https://"+n;
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
      baseUrl:wxSession.e,
      uri:'/cgi-bin/mmwebwx-bin/webwxinit?pass_ticket='+wxSession.pass_ticket,
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
      baseUrl:wxSession.e,
      uri:'/cgi-bin/mmwebwx-bin/webwxgetcontact?lang=en_US&pass_ticket='+wxSession.BaseRequest.pass_ticket+'&skey='+wxSession.BaseRequest.skey+'&seq=0&r='+Date.now(),
      method:'GET',
      json:true,
      jar:true
    }
    request(options,function(err,res,body){
      if(err)return reject(err);
      wxSession.MemberList=body.MemberList.map(function(object){
        var member={};
        member.UserName=object.UserName;
        member.RemarkName=object.RemarkName;
        member.NickName=object.NickName;
        return member;
      });
      console.log("获取联系人列表成功");
      resolve(wxSession);
    });
  });
}

/*进入cli模式*/
function cli(wxSession){
  wxSession.userTalkking={
    user:'',
    username:''
  };
  console.log(chalk.red("用户不存在，请通过`!username`设置"));
  const rl=readline.createInterface({
    input:process.stdin,
    output:process.stdout,
    terminal:true,
  });
  rl.setPrompt(wxSession.userTalkking.user+" << ");
  rl.on('line',function(input){
    if(input==="!clear"){
      process.stdout.write('\u001B[2J\u001B[0;0f'),
      rl.prompt();
      return;
    }
    if(input==="!exit"){
      process.exit(0);
    }
    if(input===""){
      rl.prompt();
      return;
    }
    if(input==="!user"){
      if(!wxSession.userTalkking.user||!wxSession.userTalkking.username){
        console.log(chalk.red("用户不存在，请通过`!username`设置"));
      }
      else{
        console.log(chalk.blue("当前用户为 "+wxSession.userTalkking.user));
      }
      rl.prompt();
      return;
    }
    if(input[0]==="!"){
      var user=input.substr(1);
      var username='';
      for(var i=0,l=wxSession.MemberList.length;i<l;i++){
        if(wxSession.MemberList[i].RemarkName===user){
          username=wxSession.MemberList[i].UserName;
          break;
        }
      }
      if(!username){
        for(var i=0,l=wxSession.MemberList.length;i<l;i++){
          if(wxSession.MemberList[i].NickName===user){
            username=wxSession.MemberList[i].UserName;
            break;
          }
        }
      }
      
      if(user===''||username===''){
        console.log(chalk.red("用户不存在，请通过`!username`设置"));
        rl.prompt();
        return;
      }
      wxSession.userTalkking.user=user;
      wxSession.userTalkking.username=username;
      console.log(chalk.blue("当前用户更换为 "+wxSession.userTalkking.user));
      rl.setPrompt(wxSession.userTalkking.user+" << ");
      rl.prompt();
    }
    else {
      if(wxSession.userTalkking.user||wxSession.userTalkking.username){
        sendMsg(input,wxSession);
      }
      else{
        console.log(chalk.red("用户不存在，请通过`!username`设置"));
      }
      rl.prompt();
    }
  });
  rl.prompt();
  wxSession.rl=rl;
}

/*发送消息到服务器*/
function sendMsg(msg,wxSession){
  var user=wxSession.userTalkking.user;
  var username=wxSession.userTalkking.username; 
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
    baseUrl:wxSession.e,
    uri:"/cgi-bin/mmwebwx-bin/webwxsendmsg?lang=en_US&pass_ticket="+wxSession.pass_ticket,
    method:"POST",
    jar:true,
    json:true,
    body:body
  }
  request(options,function(err,res,body){
    if(err||body.BaseResponse.Ret!==0){
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
      baseUrl:wxSession.n,
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
      else if(body!=='window.synccheck={retcode:"0",selector:"0"}'){
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
      baseUrl:wxSession.e,
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
      if(body.BaseResponse.Ret===1101){
        readline.clearLine(process.stdout,0);
        readline.cursorTo(process.stdout,0);
        console.log("微信已退出");
        process.exit(0);
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
  var user='';
  for(var i in wxSession.MemberList){
    if(wxSession.MemberList[i].UserName===username){
      user=wxSession.MemberList[i].RemarkName?wxSession.MemberList[i].RemarkName:wxSession.MemberList[i].NickName;
      break;
    }
  }
  if(user===''){
    user="微信群";
    return;//屏蔽微信群消息，其实是因为不想再做微信群的消息收发了。。。
  }
  
  readline.clearLine(process.stdout,0);
  readline.cursorTo(process.stdout,0);
  console.log(chalk.green(user+" >> "+content));
  wxSession.rl.prompt(true);
}

/*开启cli和轮询的入口*/
function receiveAndSend(wxSession){
  cli(wxSession);
  syncCheck(wxSession);
}

exports.getUuid=getUuid;
exports.checkState=checkState;
exports.login=login;
exports.init=init;
exports.getContact=getContact;
exports.receiveAndSend=receiveAndSend;
# wechat-node

仿照reverland的[教程](http://reverland.org/javascript/2016/01/15/webchat-user-bot/)做一个node版的命令行微信，加深对http的理解

注意：现在只支持普通的文字消息，以及不能接收群消息

使用说明：

1. `git clone https://github.com/steinsphang/wechat-node.git`
2. `cd wechat-node`
3. `npm install`
4. `node index.js`
5. 在cli中输入`!clear`清除屏幕，`!exit`退出程序，`!user`查看当前聊天用户，`!用户名`切换当前聊天用户
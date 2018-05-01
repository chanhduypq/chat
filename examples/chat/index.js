// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;
var ent = require('ent'); // Blocks HTML characters (security equivalent to htmlentities in PHP)
var mysql = require('mysql'); // include thêm module mysql
var pool = mysql.createPool({
host: 'localhost',
user: 'root',
password: '',
database: 'test'
});

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

app.get('/error', function(req, res){
  res.sendFile(__dirname + '/public/error.html');
});

app.get('/checkuser/:username', function(req, res){
  var username = req.params.username;
    pool.query("SELECT * FROM `member` WHERE account = ? AND password = ?",[username,'123456'], function(error, result){
        if(result.length === 0 || error) {
            return res.send("error");
        } else {
            return res.send("OK");
        }  
    });
  
});

// Chatroom

var numUsers = 0;

io.on('connection', (socket) => {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;
        
    if (username === '' ){
        var destination = '/';
        socket.emit('redirect', destination);
    } else{
        pool.query("SELECT * FROM `member` WHERE account = ? AND password = ?",[username,'123456'], function(error, result){
            if(result.length === 0 || error) {
                var destination = '/error';
                socket.emit('redirect', destination);
            } else {
                console.log('– MEMBER — ' , result[0]);
                // we store the username in the socket session for this client
                socket.username = username;
//                socket.broadcast.emit('new_client', username); 
                ++numUsers;
                addedUser = true;
                socket.emit('login', {
                  numUsers: numUsers
                });
                // echo globally (all clients) that a person has connected
                socket.broadcast.emit('user joined', {
                  username: socket.username,
                  numUsers: numUsers
                });
            }  
        });
    }

    
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

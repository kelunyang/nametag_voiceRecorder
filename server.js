//變數區，執行前必須指向node真正的安裝目錄
var globaldir = "C:\\Users\\Kelunyang\\AppData\\Roaming\\npm\\node_modules\\";
var https = require("https");
var url = require('url');
var fs = require('fs');
var mime = require('mime-types');
var { StringDecoder } = require('string_decoder');
//外掛模組區，請確認執行前都已經用NPM安裝完成
var axios = require(globaldir+'axios');
var express = require(globaldir+"express");
var session = require(globaldir+"express-session");
var mysql = require(globaldir+"promise-mysql");
var moment = require(globaldir+"moment");
var io = require(globaldir+'socket.io');
var ios = require(globaldir+'express-socket.io-session');
var ss = require(globaldir+'socket.io-stream');
var MemoryStore = require(globaldir+'sessionstore');
var hbs = require(globaldir+'hbs');
var ical = require(globaldir+'ical.js');
var Promise = require(globaldir+'bluebird');	//原生不錯，但bluebird有序列執行的功能
var telegraf = require(globaldir+'telegraf');
//var Promise = require(globaldir+'promise');

//HTTPS
var SERVER_CONFIG = {
    key:  fs.readFileSync(__dirname+'/ssl/voiceRecorder.key'),
    cert: fs.readFileSync(__dirname+'/ssl/voiceRecorder.crt')
};

hbs.registerPartials(__dirname + '/views/partials');
var app = express();
app.set('view engine', 'hbs');
app.set('trust proxy', 1) // trust first proxy
var session_store = MemoryStore.createSessionStore();
var sessioninstance = session({
	secret: 'THNIO&TG%^)',
	resave: true,
	saveUninitialized: true,
	store: session_store,
	cookie: {maxAge: 1800000}
})
var pool = mysql.createPool({
	host: 'localhost',
	user: 'webapp',
	password: '75*0F*d4b6',
	database: 'voiceRecorder',
	connectionLimit: 10
});
/*var server = http.Server(app);
server.listen(82, function() {
    console.log("voiceRecorder started!");
});*/
var server = https.createServer(SERVER_CONFIG, app).listen(82,function() { 
	console.log("voiceRecorder starts in HTTPS mode!");
});
var serv_io = io(server);
serv_io.use(ios(sessioninstance, {
	autoSave: true
}));
serv_io.of("/fileUpload").use(ios(sessioninstance, {
	autoSave: true
}));
app.use(sessioninstance);
var chatbot = new telegraf("469575579:AAGHx6ju3EF3GFPg04tI9olCu7CJdPJx7Ys");
chatbot.command("start", (ctx) => {
	console.log("start", ctx.from);
	ctx.reply("Welcome!");
});
chatbot.hears("hi", (ctx) => {
	console.log("hi", ctx.from);
	ctx.reply("Hey there!")}
);
chatbot.startPolling();


app.get("/", (req,res) => {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	console.log("Client Connected:"+ip+"("+moment().format("YYYY/MM/DD HH:mm:ss")+")");
	if(!req.session.hasOwnProperty("initalSession")) {
		req.session.userID = req.query.hasOwnProperty("userID") ? req.query.userID : "A126408543";
		req.session.save();
	}
	pool.getConnection().then(function(connection) {
		connection.query("SELECT `title`,`name` FROM userList WHERE `id` = ?",req.session.userID)
		.then(function(rows) {
			res.render("nametag", {
				title: "啟動頁面",
				jobtitle: rows[0].title,
				name: rows[0].name
			})
		});
		pool.releaseConnection(connection);
	}).catch(function(err) {
		console.log(err);
	});
});
app.get("/desktop", function(req,res) {
	if(!req.session.hasOwnProperty("initalSession")) {
		req.session.userID = req.query.hasOwnProperty("userID") ? req.query.userID : "A126408543";
		req.session.save();
	}
	res.render("desktop", {
		title: "行程頁面"
	});
});
app.get("/recordings", function(req, res) {
	var file = __dirname + '/recordings/' + req.query.name;
	res.download(file); // Set disposition and send it.
});
app.get("/socket.io-stream.js", function(req, res) {
	var file = __dirname + '/javascript/socket.io-stream.js';
	res.download(file); // Set disposition and send it.
});

serv_io.of("/fileUpload").on("connection", (socket) => {
	var sessioni = socket.handshake.session;
	var ipaddress = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
	var timestamp;
	var recordingid;
	var msg;
	ss(socket).on("recordingUpload", (stream, data) => {
		timestamp = moment().unix();
		pool.getConnection().then(async (connection) => {
				await connection.query("INSERT INTO gadgetMessages (`message`, `user`, `timestamp`,`questionID`) VALUES ( ? , ? , ?, ? )", [
				"Recording",
				sessioni.userID,
				timestamp,
				null
			]);
			return connection;
		}).then(async (connection) => {
				await connection.query("SELECT `id` FROM gadgetMessages WHERE `user` = ? AND `timestamp` = ?", [
				sessioni.userID,
				timestamp
			]).then(function(rows) {
				recordingid = rows[0].id;
				stream.pipe(fs.createWriteStream(__dirname+"/recordings/"+recordingid+"."+data.filetype));	//fs.createWriteStream opintion default set to override
				msg = "Recording, URL: https://kelunyang.ddns.net:82/recordings?name="+recordingid+"."+data.filetype;
			});
			return connection;
		}).then(async (connection) => {
			await connection.query("UPDATE gadgetMessages SET message = ? WHERE id = ?", [
				msg,
				recordingid
			])
			return connection;
		}).then(async (connection) => {
			await connection.query("SELECT `telegramid` FROM userList WHERE `id` = ?",sessioni.userID)
			.then(function(rows) {
				chatbot.telegram.sendMessage(rows[0].telegramid, msg);
				ss(socket).emit("recordingUploaded", {
					timestamp: timestamp
				});
			})
			pool.releaseConnection(connection);	
		})
		.catch(function(err) {
			console.log(err);
			socket.emit("errorMsg", function() {
				msg: e
			});
		});
	});
});
serv_io.sockets.on('connection', async (socket) => {
	var sessioni = socket.handshake.session;
	socket.on("getCal", (data) => {
		var errorlist = new Array();
		var ics = "";
		var calpri = 0;
		var calsec = 0;
		var decoder = new StringDecoder('utf8');
		pool.getConnection().then(function(connection) {
			connection.query("SELECT `ics` FROM userList WHERE `id` = ?",sessioni.userID)
			.then((rows) => {
				ics = JSON.parse(rows[0].ics);
				pool.releaseConnection(connection);
				var promiseArray = new Array();	//Promise Array 不能直接放動作，要放參數，動作等到delay再做
				ics.secondary.forEach(function(item) {
					promiseArray.push({
						url: item,
						type: 1
					});
				});
				promiseArray.push({
					url: ics.primary,
					type: 0
				});
				Promise.mapSeries(promiseArray, async item => {
					return await Promise.delay(5000).then(async url => {
						return await axios(item.url).then(response => {
							return calGetter(response, item.type);
						});
					});
				})
				.then(data => {
					var output = {
						allDay: new Array(),
						primary: undefined,
						upcomming: undefined,
						secondary: new Array()
					}
					var calname = {
						primary: undefined,
						secondary: new Array()
					}
					data.forEach(function(item) {
						if(item != undefined) {
							if(item.type == 0) {
								output.primary = item.selectedEvent;
								output.upcomming = item.upcommingEvent;
								calname.primary = item.calName;
							} else {
								if(item.selectedEvent != undefined) {
									output.secondary.push(item.selectedEvent);
									calname.secondary.push(item.calName);
								}
							}
							if(item.allDay != undefined) {
								output.allDay =	output.allDay.concat(item.allDay);
							}
						}
					});
					output.secondary.sort(function(a,b) {
						return b.dist - a.dist;
					});
					if(output.primary == undefined) {
						if(output.secondary.length > 0) {
							output.primary = output.secondary.splice(0,1);
						} else {
							output.primary = {
								location: "休息中",
								summary: "休息中",
								calname: calname.primary,
								endtime: 0,
								starttime: 0,
								dist: 60 * 60 * 24
							};
						}
					}
					socket.emit("sendCal", output);	
				})
				.catch(error => {
					console.log(error);
					if(error.hasOwnProperty("response")) {
						if(error.response.status == 503) {
							socket.emit("errorMsg", {
								msg: "re-Download"
							});
						}
					} else {
						socket.emit("errorMsg", {
							msg: error
						});
					}
				});	
			}).catch(error => {
				console.log(error);
			});
		}).catch(function(err) {
			console.log(err);
		});
	});
	socket.on("getmessageService", (data) => {
		try {
			var output = new Array();
			pool.getConnection().then(function(connection) {
				connection.query("SELECT `message`, `timestamp` FROM gadgetMessages WHERE `user` = ? AND `questionID` != 0 ORDER BY `timestamp` DESC LIMIT 2",sessioni.userID)
				.then(function(rows) {
					rows.forEach(function(row) {
						output.push({
							message: row.message,
							timestamp: row.timestamp
						});
					});
					pool.releaseConnection(connection);
					socket.emit("messageList", output);
				})
			}).catch(function(err) {
				console.log(err);
			});
		} catch(e) {
			socket.emit("errorMsg", {
				msg: e
			});
		}
	});
	socket.on("getquestionService", (data) => {
		try {
			var output = new Array();
			pool.getConnection().then(function(connection) {
				connection.query("SELECT `id`,`question`,`answers` FROM questionList WHERE `user` = ?",sessioni.userID)
				.then(function(rows) {
					rows.forEach(function(row) {
						output.push({
							question: row.question,
							answers: JSON.parse(row.answers),
							id: row.id
						});
					});
					pool.releaseConnection(connection);
					socket.emit("questionList", output);
				})
			}).catch(function(err) {
				console.log(err);
			});
		} catch(e) {
			socket.emit("errorMsg", {
				msg: e
			});
		}
	});
	socket.on("sendmsgService", (data) => {
		try {
			var timestamp = moment().unix();
			pool.getConnection().then(async (connection) => {
				await connection.query("INSERT INTO gadgetMessages (`message`, `user`, `timestamp`,`questionID`) VALUES ( ? , ? , ?, ? )", [
					data.message,
					sessioni.userID,
					timestamp,
					data.qid
				])
				return connection;
			}).then(function(connection) {
				connection.query("SELECT `telegramid` FROM userList WHERE `id` = ?",sessioni.userID)
				.then(function(rows) {
					socket.emit("messageSent", {
						msg: data.message,
						time: timestamp
					});
					chatbot.telegram.sendMessage(rows[0].telegramid, data.message);
					pool.releaseConnection(connection);
				})
			}).catch(function(err) {
				console.log(err);
			});
		} catch(e) {
			socket.emit("errorMsg", {
				msg: e
			});
		}
	});
});

function calGetter(response, type) {
	var events = new Array();
	var filteredEvent = new Array();
	var filteredUpcommings = new Array();
	var str = response.data;
	var data = ical.parse(str);
	var comp = new ical.Component(data);
	var vevents = comp.getAllSubcomponents('vevent');
	var name = comp.getFirstPropertyValue("x-wr-calname");
	var allday = new Array();
	vevents.forEach(function(item) {
		events.push(new ical.Event(item)); 
	});
	events.forEach(function(item) {
		item.dist = moment().unix() - moment(item.startDate.toJSDate()).unix();
		if(moment(item.startDate.toJSDate()).unix() <= moment().unix()) {
			if(moment(item.endDate.toJSDate()).unix() >= moment().unix()) {
				if(item.duration.toSeconds() >= 60 * 60 * 24) {
					allday.push({
						location: item.location,
						summary: item.summary,
						calname: name,
						endtime: 0,
						starttime: 0,
						dist: item.dist
					});
				} else {
					filteredEvent.push(item);
				}
			}
		}
		if(moment(item.startDate.toJSDate()).unix() > moment().unix()) {
			if(moment(item.endDate.toJSDate()).unix() > moment().unix()) {
				if(item.duration.toSeconds() < 60 * 60 * 24) {
					filteredUpcommings.push(item);
				}
			}
		}
	});
	var sortedEvent = filteredEvent.sort(function(a,b) {
		return b.dist - a.dist;
	});
	var selectedEvent = sortedEvent.length > 0 ? 
	{
		location: sortedEvent[0].location,
		summary: sortedEvent[0].summary,
		calname: name,
		endtime: moment(sortedEvent[0].endDate.toJSDate()).unix(),
		starttime: moment(sortedEvent[0].startDate.toJSDate()).unix(),
		dist: sortedEvent[0].item
	} : undefined;
	var upcommingEvent = undefined;
	if(type == 0) {
		filteredUpcommings.sort(function(a,b) {
			return b.dist - a.dist;
		});
		upcommingEvent = filteredUpcommings.length > 0 ? {
			location: filteredUpcommings[0].location,
			summary: filteredUpcommings[0].summary,
			calname: name,
			endtime: moment(filteredUpcommings[0].endDate.toJSDate()).unix(),
			starttime: moment(filteredUpcommings[0].startDate.toJSDate()).unix(),
		} : undefined;
	}
	/*var secondarycal = new icalexpander({ str, maxIterations: 100 });
	var events = icalexpander.between(moment().startOf("day").toDate(), moment().endOf("day").toDate());*/
	return {
		calName: name,
		type: type,
		selectedEvent: selectedEvent,
		allDay: allday,
		upcommingEvent: upcommingEvent
	}
}
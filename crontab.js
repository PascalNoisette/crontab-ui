/*jshint esversion: 6*/
//load database
var Datastore = require('nedb');
var path = require("path");
var temp = require('temp');
var db = new Datastore({ filename: __dirname + '/crontabs/crontab.db' });
var cronPath = "/tmp";

if(process.env.CRON_PATH !== undefined) {
	console.log(`Path to crond files set using env variables ${process.env.CRON_PATH}`);
	cronPath = process.env.CRON_PATH;
}

db.loadDatabase(function (err) {
	if (err) throw err; // no hope, just terminate
});
var childProcess = require('child_process');
var exec = childProcess.exec;
var fs = require('fs');
var cron_parser = require("cron-parser");

exports.log_folder = __dirname + '/crontabs/logs';
exports.env_file = __dirname + '/crontabs/env.db';

crontab = function(name, command, schedule, stopped, logging, mailing, remote, trigger){
	var data = {};
	data.name = name;
	data.command = command;
	data.schedule = schedule;
	if(stopped !== null) {
		data.stopped = JSON.parse(stopped);
	}
	data.timestamp = (new Date()).toString();
	data.logging = logging;
	if (!mailing)
		mailing = {};
	data.mailing = mailing;
    if (!remote)
        remote = {};
    data.remote = remote;
    data.trigger = trigger;
	return data;
};

exports.create_new = function(name, command, schedule, logging, mailing, stopped, remote, trigger){
	var tab = crontab(name, command, schedule, stopped, logging, mailing, remote, trigger);
	tab.created = new Date().valueOf();
	db.insert(tab);
};

exports.update = function(data){
	db.update({_id: data._id}, crontab(data.name, data.command, data.schedule, JSON.parse(data.stopped), data.logging, data.mailing, data.remote, data.trigger));
};

exports.update_unsecure = function(data){
	if ("stopped" in data) {
        data.stopped = JSON.parse(data.stopped)
	}
    db.update({_id: data._id}, {$set: data});
};

exports.remove = function(_id){
	db.remove({_id: _id}, {});
};

// Iterates through all the crontab entries in the db and calls the callback with the entries
exports.crontabs = function(callback){
	db.find({}).sort({ created: -1 }).exec(function(err, docs){
		for(var i=0; i<docs.length; i++){
			if(docs[i].schedule == "@reboot")
				docs[i].next = "Next Reboot";
			else
				docs[i].next = cron_parser.parseExpression(docs[i].schedule).next().toString();
		}
		callback(docs);
	});
};
exports.kill = function(_id) {
    exports.get_crontab(_id, function (job) {
    	if (job.pid) {
    		try {
				process.kill(job.pid);
            } catch (e) {
				exports.update_unsecure({_id:_id, pid:null});
            }
        }
	});
};
exports.get_crontab = function(_id, callback) {
	db.find({_id: _id}).exec(function(err, docs){
		callback(docs[0]);
	});
};
function getFullCommand(res)
{

    return command
}
exports.runjob = function(_id, callback) {
	exports.runhook(_id, process.env);
};
exports.runhook = function(_id, env) {
    db.find({_id: _id}).exec(function(err, docs){
        var res = docs[0];

        if (typeof(res) != "undefined" && !res.pid) {
            var output = fs.openSync(path.join(exports.log_folder, _id + ".log"), 'w');
            var output2 = fs.openSync(path.join(exports.log_folder, _id + ".log"), 'a');
            var tempName = temp.path();
            var command = "sh -s < " + tempName + ".sh";
            fs.writeFileSync(
                tempName+ ".sh",
                "cat << EOF > " + tempName + "\n" +
                res.command                + "\n" +
                "EOF"                      + "\n" +
                "chmod +x " + tempName     + "\n" +
                tempName                   + "\n" +
                "RES=$? "                  + "\n" +
                "rm -f " + tempName        + "\n" +
                "exit $RES"
            );

            if ("remote" in res) {
                if ("ssh" in res.remote && res.remote.ssh.enabled == "on") {
                    command = "ssh -o \"StrictHostKeyChecking=no\" " + res.remote.ssh.server + " -p " +  res.remote.ssh.port + " " + command;
                } else if ("docker" in res.remote && res.remote.docker.enabled == "on") {
                    command = "/usr/bin/docker run -i --rm " + res.remote.docker.image + " " + command;
                }
            }

            process.stdin.pause();
            const execution = childProcess.spawn('sh', ['-c', command], {stdio: ['ignore', output, output2], env: env});

            exports.update_unsecure({_id: _id, pid: execution.pid});
            execution.on('close', (code, signal) => {
                fs.unlink(tempName + ".sh" , function(err){});
                if (!code && code !==0) {
                	code = signal
				}
                exports.update_unsecure({_id: _id, executed: new Date().valueOf(), code:code, pid:null});
                if ("trigger" in res && typeof(res.trigger.forEach) != "undefined") {
                    res.trigger.forEach(function(jobId) {
                    	env["TRIGGER_RETURN_CODE"] = code;
                        exports.runhook(jobId, env);
                    });
                }
            });
        }
    });
};

// Set actual crontab file from the db
exports.set_crontab = function(env_vars, callback){
	exports.crontabs( function(tabs){
		var crontab_string = "";
		if (env_vars) {
			crontab_string = env_vars + "\n";
		}
		tabs.forEach(function(tab){
			if(!tab.stopped) {
				let stderr = path.join(cronPath, tab._id + ".stderr");
				let stdout = path.join(cronPath, tab._id + ".stdout");
				let command  = "/usr/bin/curl 127.0.0.1:8000/hook/?id=" + tab._id;
				if(command[command.length-1] != ";") // add semicolon
                    command +=";";

				crontab_string += tab.schedule + " " + command;

				if (tab.mailing && JSON.stringify(tab.mailing) != "{}"){
					crontab_string += "; /usr/local/bin/node " + __dirname + "/bin/crontab-ui-mailer.js " + tab._id + " " + stdout + " " + stderr;
				}

				crontab_string += "\n";

			} else {
				console.log(tab._id +  " is stopped");
			}
		});
        console.log("Backed up as " + crontab_string);
		fs.writeFile(exports.env_file, env_vars, function(err) {
			if (err) callback(err);
			// In docker we're running as the root user, so we need to write the file as root and not crontab
			var fileName = "crontab"
			if(process.env.CRON_IN_DOCKER !== undefined) {
				fileName = "root"
			}
			fs.writeFile(path.join(cronPath, fileName), crontab_string, function(err) {
				if (err) return callback(err);
				/// In docker we're running crond using busybox implementation of crond
				/// It is launched as part of the container startup process, so no need to run it again
				if(process.env.CRON_IN_DOCKER === undefined) {
					exec("crontab " + path.join(cronPath, "crontab"), function(err) {
						if (err) return callback(err);
						else callback();
					});
				} else {
					callback();
				}
			});
		});
	});
};

exports.get_backup_names = function(){
	var backups = [];
	fs.readdirSync(__dirname + '/crontabs').forEach(function(file){
		// file name begins with backup
		if(file.indexOf("backup") === 0){
			backups.push(file);
		}
	});

	// Sort by date. Newest on top
	for(var i=0; i<backups.length; i++){
		var Ti = backups[i].split("backup")[1];
		Ti = new Date(Ti.substring(0, Ti.length-3)).valueOf();
		for(var j=0; j<i; j++){
			var Tj = backups[j].split("backup")[1];
			Tj = new Date(Tj.substring(0, Tj.length-3)).valueOf();
			if(Ti > Tj){
				var temp = backups[i];
				backups[i] = backups[j];
				backups[j] = temp;
			}
		}
	}

	return backups;
};

exports.backup = function(){
	//TODO check if it failed
	fs.createReadStream( __dirname + '/crontabs/crontab.db').pipe(fs.createWriteStream( __dirname + '/crontabs/backup ' + (new Date()).toString().replace("+", " ") + '.db'));
};

exports.restore = function(db_name){
	fs.createReadStream( __dirname + '/crontabs/' + db_name).pipe(fs.createWriteStream( __dirname + '/crontabs/crontab.db'));
	db.loadDatabase(); // reload the database
};

exports.reload_db = function(){
	db.loadDatabase();
};

exports.get_env = function(){
	if (fs.existsSync(exports.env_file)) {
		return fs.readFileSync(exports.env_file , 'utf8').replace("\n", "\n");
	}
	return "";
};

exports.import_crontab = function(){
	exec("crontab -l", function(error, stdout, stderr){
		var lines = stdout.split("\n");
		var namePrefix = new Date().getTime();

		lines.forEach(function(line, index){
			line = line.replace(/\t+/g, ' ');
			var regex = /^((\@[a-zA-Z]+\s+)|(([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+))/;
			var command = line.replace(regex, '').trim();
			var schedule = line.replace(command, '').trim();

			var is_valid = false;
			try { is_valid = cron_parser.parseString(line).expressions.length > 0; } catch (e){}

			if(command && schedule && is_valid){
				var name = namePrefix + '_' + index;

				db.findOne({ command: command, schedule: schedule }, function(err, doc) {
					if(err) {
						throw err;
					}
					if(!doc){
						exports.create_new(name, command, schedule, false, {}, false, {});
					} else if(command.match("/usr/bin/curl 127.0.0.1:8000/hook")){
                        doc.schedule = schedule;
                        exports.update(doc);
                    }
                    else{
						doc.command = command;
						doc.schedule = schedule;
						exports.update(doc);
					}
				});
			}
		});
	});
};

exports.autosave_crontab = function(callback) {
	let env_vars = exports.get_env();
	exports.set_crontab(env_vars, callback);
};

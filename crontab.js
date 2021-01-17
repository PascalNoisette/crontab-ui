/*jshint esversion: 6*/
//load database
var Datastore = require('nedb');
var temp = require('temp');
var path = require("path");

exports.db_folder = process.env.CRON_DB_PATH === undefined ? path.join(__dirname,  "crontabs") : process.env.CRON_DB_PATH;
console.log("Cron db path: " + exports.db_folder);
exports.log_folder = path.join(exports.db_folder, 'logs');
exports.env_file =  path.join(exports.db_folder, 'env.db');
exports.crontab_db_file = path.join(exports.db_folder, 'crontab.db');

var db = new Datastore({ filename: exports.crontab_db_file});
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



exports.create_new = function(tab){
	delete tab._id;
	tab.created = new Date().valueOf();
	tab.saved = false;
	db.insert(tab);
};


exports.update = function(data){
	var tab = crontab(data.name, data.command, data.schedule, JSON.parse(data.stopped), data.logging, data.mailing, data.remote, data.trigger);
	tab.saved = false;
	db.update({_id: data._id}, tab);
};

exports.status = function(_id, stopped){
	db.update({_id: _id},{$set: {stopped: stopped, saved: false}});
};

exports.update_unsecure = function(data){
	if ("stopped" in data) {
        data.stopped = JSON.parse(data.stopped)
	}

    db.update({_id: data._id}, {$set: data});
};

exports.update = function(data) {
    let unset = {};
    if (data['$unset']) {
        unset = data['$unset'];
        delete data['$unset'];
    }

	db.update({_id: data._id}, {$set: data, $unset: unset});
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
				try {
					docs[i].next = cron_parser.parseExpression(docs[i].schedule).next().toString();
				} catch(err) {
					console.error(err);
					docs[i].next = "invalid";
				}
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
				exports.update({_id:_id, pid:null});
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
                if (res.remote_ssh_enabled == "on") {
                    command = "ssh -o \"BatchMode=yes\" -o \"StrictHostKeyChecking=no\" " + res.remote.ssh.server + " -p " +  res.remote.ssh.port + " " + command;
                } else if ("docker" in res.remote && res.remote_docker_enabled == "on") {
                    command = "/usr/bin/docker run -i --rm " + res.remote.docker.image + " " + command;
                }
            }

            const execution = childProcess.spawn('sh', ['-c', command], {stdio: ['ignore', output, output2], env: env});

            exports.update({_id: _id, pid: execution.pid});
            execution.on('close', (code, signal) => {
                fs.unlink(tempName + ".sh" , function(err){});
                if (!code && code !==0) {
                	code = signal
				}
                exports.update({_id: _id, executed: new Date().valueOf(), code:code, pid:null});
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

make_command = function(tab) {
	var crontab_job_string = "";

	let stderr = path.join(cronPath, tab._id + ".stderr");
	let stdout = path.join(cronPath, tab._id + ".stdout");
	let log_file = path.join(exports.log_folder, tab._id + ".log");
	let log_file_stdout = path.join(exports.log_folder, tab._id + ".stdout.log");

	var crontab_job_string_command = tab.command

	if(crontab_job_string_command[crontab_job_string_command.length-1] != ";") { // add semicolon
		crontab_job_string_command +=";";
	}

	crontab_job_string = crontab_job_string_command
	crontab_job_string =  "{ " + crontab_job_string + " }" 
	// write stdout to file
	crontab_job_string =  "(" + crontab_job_string + " | tee " + stdout + ")"
	// write stderr to file
	crontab_job_string = "(" + crontab_job_string + " 3>&1 1>&2 2>&3 | tee " + stderr + ") 3>&1 1>&2 2>&3"
	crontab_job_string =  "(" + crontab_job_string + ")"

	if (tab.logging && tab.logging == "true") {
		crontab_job_string += "; if test -f " + stderr +
		"; then date >> \"" + log_file + "\"" +
		"; cat " + stderr + " >> \"" + log_file + "\"" +
		"; fi";

		crontab_job_string += "; if test -f " + stdout +
		"; then date >> \"" + log_file_stdout + "\"" +
		"; cat " + stdout + " >> \"" + log_file_stdout + "\"" +
		"; fi";
	}

	if (tab.hook) {
		crontab_job_string += "; if test -f " + stdout +
		"; then " + tab.hook + " < " + stdout +
		"; fi";
	}

	if (tab.mailing && JSON.stringify(tab.mailing) != "{}"){
		crontab_job_string += "; /usr/local/bin/node " + __dirname + "/bin/crontab-ui-mailer.js " + tab._id + " " + stdout + " " + stderr;
	}

	return crontab_job_string;
}

add_env_vars = function(env_vars, command) {
	console.log("env vars");
	console.log(env_vars)
	if (env_vars)
		return "(" + env_vars.replace(/\s*\n\s*/g,' ').trim() + "; (" + command + "))";
	
	return command;
}

// Set actual crontab file from the db
exports.set_crontab = function(env_vars, callback) {
	exports.crontabs( function(tabs){
		var crontab_string = "";
		if (env_vars) {
			crontab_string += env_vars;
			crontab_string += "\n";
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
			if (err) {
				console.error(err);
				callback(err);
			}
			// In docker we're running as the root user, so we need to write the file as root and not crontab
			var fileName = process.env.CRON_IN_DOCKER !== undefined  ? "root" : "crontab";
			fs.writeFile(path.join(cronPath, fileName), crontab_string, function(err) {
				if (err) {
					console.error(err);
					return callback(err);
				}

				exec("crontab " + path.join(cronPath, fileName), function(err) {
					if (err) {
						console.error(err);
						return callback(err);
					}
					else {
						db.update({},{$set: {saved: true}}, {multi: true});
						callback();
					}
				});
			});
		});
	});
};

exports.get_backup_names = function(){
	var backups = [];
	fs.readdirSync(exports.db_folder).forEach(function(file){
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
	fs.createReadStream(exports.crontab_db_file).pipe(fs.createWriteStream( path.join(exports.db_folder, 'backup ' + (new Date()).toString().replace("+", " ") + '.db')));
};

exports.restore = function(db_name){
	fs.createReadStream(path.join(exports.db_folder, db_name)).pipe(fs.createWriteStream(exports.crontab_db_file));
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

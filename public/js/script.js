/*jshint esversion: 6 */
/*********** MessageBox ****************/
// simply show info.  Only close button
function infoMessageBox(message, title){
	$("#info-body").html(message);
	$("#info-title").html(title);
	$("#info-popup").modal('show');
}
// like info, but for errors.
function errorMessageBox(message) {
	var msg =
		"Operation failed: " + message + ". " +
		"Please see error log for details.";
	infoMessageBox(msg, "Error");
}
// modal with full control
function messageBox(body, title, ok_text, close_text, callback){
	$("#modal-body").html(body);
	$("#modal-title").html(title);
	if (ok_text) $("#modal-button").html(ok_text);
	if(close_text) $("#modal-close-button").html(close_text);
	$("#modal-button").unbind("click"); // remove existing events attached to this
	$("#modal-button").click(callback);
	$("#popup").modal("show");
}


/*********** crontab actions ****************/
// TODO get rid of global variables
var schedule = "";
var job_command = "";

function deleteJob(_id){
	// TODO fix this. pass callback properly
	messageBox("<p> Do you want to delete this Job? </p>", "Confirm delete", null, null, function(){
		$.post(routes.remove, {_id: _id}, function(){
			location.reload();
		});
	});
}

function hookJob(_id){
    var newClip = window.location + "hook/?id=" + _id;
	messageBox('<p> Hook url : <a href="' + newClip + '">'+newClip+'</a></p>');
}

function stopJob(_id){
	messageBox("<p> Do you want to stop this Job? </p>", "Confirm stop job", null, null, function(){
		$.post(routes.stop, {_id: _id}, function(){
			location.reload();
		});
	});
}

function startJob(_id){
	messageBox("<p> Do you want to start this Job? </p>", "Confirm start job", null, null, function(){
		$.post(routes.start, {_id: _id}, function(){
			location.reload();
		});
	});
}

function runJob(_id){
	messageBox("<p> Do you want to run this Job? </p>", "Confirm run job", null, null, function(){
		$.post(routes.run, {_id: _id}, function(){
			location.reload();
		});
		
	});
}

function setCrontab(){
	messageBox("<p> Do you want to set the crontab file? </p>", "Confirm crontab setup", null, null, function(){
		$.get(routes.crontab, { "env_vars": $("#env_vars").val() }, function(){
			// TODO show only if success
			infoMessageBox("Successfuly set crontab file!","Information");
		}).fail(function(response) {
			errorMessageBox(response.statusText,"Error");
		});
	});
}

function getCrontab(){
	messageBox("<p> Do you want to get the crontab file? <br /> <b style='color:red'>NOTE: It is recommended to take a backup before this.</b> And refresh the page after this.</p>", "Confirm crontab retrieval", null, null, function(){
		$.get(routes.import_crontab, { "env_vars": $("#env_vars").val() }, function(){
			// TODO show only if success
			infoMessageBox("Successfuly got the crontab file!","Information");
			location.reload();
		});
	});
}

function editJob(_id){
	var job = null;
	crontabs.forEach(function(crontab){
		if(crontab._id == _id)
			job = crontab;
	});
	if(job){
		$("#job").modal("show");
		$("#job-name").val(job.name);
		$("#job-command").val(job.command);
		// if macro not used
		if(job.schedule.indexOf("@") !== 0){
			var components = job.schedule.split(" ");
			$("#job-minute").val(components[0]);
			$("#job-hour").val(components[1]);
			$("#job-day").val(components[2]);
			$("#job-month").val(components[3]);
			$("#job-week").val(components[4]);
		}
		if (job.mailing) {
			$("#job-mailing").attr("data-json", JSON.stringify(job.mailing));
		}
		var trigger = [];
        if (job.trigger) {
        	trigger = job.trigger;
        }
        $("#job-trigger").val(trigger);

        if (job.remote) {
            $("#job-remote").values({"job-remote":job.remote});
            $("#job-remote").find("input[type=checkbox]").each(function(f, e){if (e.checked) toggleRemote(e.id)});
        }
		schedule = job.schedule;
		job_command = job.command;
		if (job.logging && job.logging != "false")
			$("#job-logging").prop("checked", true);
		if (job.stopped && JSON.parse(job.stopped)) {
            $("#job-stopped").prop("checked", true);
        } else {
            $("#job-stopped").prop("checked", false);
		}
		job_string();
	}

	$("#job-save").unbind("click"); // remove existing events attached to this
	$("#job-save").click(function(){
		// TODO good old boring validations
		if (!schedule) {
			schedule = "* * * * *";
		}
		let name = $("#job-name").val();
		let mailing = JSON.parse($("#job-mailing").attr("data-json"));
		let remote = $("#job-remote").values()["job-remote"];
		let logging = $("#job-logging").prop("checked");
		let stopped = $("#job-stopped").prop("checked");
		let trigger = $('#job-trigger').val();
		$.post(routes.save, {name: name, command: job_command , schedule: schedule, _id: _id, logging: logging, mailing: mailing, stopped : stopped, remote: remote, trigger: trigger}, function(){
			location.reload();
		});
	});
}

function newJob(){
	schedule = "";
	job_command = "";
	$("#job-minute").val("*");
	$("#job-hour").val("*");
	$("#job-day").val("*");
	$("#job-month").val("*");
	$("#job-week").val("*");

	$("#job").modal("show");
	$("#job-name").val("");
	$("#job-command").val("");
	$("#job-mailing").attr("data-json", "{}");
    $("#job-trigger").val([]);
	job_string();
	$("#job-save").unbind("click"); // remove existing events attached to this
	$("#job-save").click(function(){
		// TODO good old boring validations
		if (!schedule) {
			schedule = "* * * * *";
		}
		let name = $("#job-name").val();
		let mailing = JSON.parse($("#job-mailing").attr("data-json"));
		let remote = $("#job-remote").values()["job-remote"];
		let logging = $("#job-logging").prop("checked");
		let stopped = $("#job-stopped").prop("checked");
        let trigger = $('#job-trigger').val();
		$.post(routes.save, {name: name, command: job_command , schedule: schedule, _id: -1, logging: logging, mailing: mailing, stopped: stopped, remote: remote, trigger: trigger}, function(){
			location.reload();
		});
	});
}

function doBackup(){
	messageBox("<p> Do you want to take backup? </p>", "Confirm backup", null, null, function(){
		$.get(routes.backup, {}, function(){
			location.reload();
		});
	});
}

function delete_backup(db_name){
	messageBox("<p> Do you want to delete this backup? </p>", "Confirm delete", null, null, function(){
		$.get(routes.delete_backup, {db: db_name}, function(){
			location = '.';
		});
	});
}

function restore_backup(db_name){
	messageBox("<p> Do you want to restore this backup? </p>", "Confirm restore", null, null, function(){
		$.get(routes.restore_backup, {db: db_name}, function(){
			location = '.';
		});
	});
}

function import_db(){
	messageBox("<p> Do you want to import crontab?<br /> <b style='color:red'>NOTE: It is recommended to take a backup before this.</b> </p>", "Confirm import from crontab", null, null, function(){
		$('#import_file').click();
	});
}

$.fn.serializeObject = function(){

    var self = this,
        json = {},
        push_counters = {},
        patterns = {
            "validate": /^[a-zA-Z][a-zA-Z0-9_\-]*(?:\[(?:\d*|[a-zA-Z0-9_\-]+)\])*$/,
            "key":      /[a-zA-Z0-9_\-]+|(?=\[\])/g,
            "push":     /^$/,
            "fixed":    /^\d+$/,
            "named":    /^[a-zA-Z0-9_\-]+$/
        };


    this.build = function(base, key, value){
        base[key] = value;
        return base;
    };

    this.push_counter = function(key){
        if(push_counters[key] === undefined){
            push_counters[key] = 0;
        }
        return push_counters[key]++;
    };

    $.each($(this).serializeArray(), function(){

        // skip invalid keys
        if(!patterns.validate.test(this.name)){
            return;
        }

        var k,
            keys = this.name.match(patterns.key),
            merge = this.value,
            reverse_key = this.name;

        while((k = keys.pop()) !== undefined){

            // adjust reverse_key
            reverse_key = reverse_key.replace(new RegExp("\\[" + k + "\\]$"), '');

            // push
            if(k.match(patterns.push)){
                merge = self.build([], self.push_counter(reverse_key), merge);
            }

            // fixed
            else if(k.match(patterns.fixed)){
                merge = self.build([], k, merge);
            }

            // named
            else if(k.match(patterns.named)){
                merge = self.build({}, k, merge);
            }
        }

        json = $.extend(true, json, merge);
    });

    return json;
};

flattenObject = function(ob) {
    var toReturn = {};

    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;

        if ((typeof ob[i]) == 'object' && ob[i] !== null) {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;

                toReturn[i + '][' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }

    return toReturn;
}
deserializeObject = function(ob) {
    toReturn = flattenObject(ob);
    for (i in toReturn) {
        let key = i.replace(/\]/, "");
        if (key != i) {
            key += "]";
            toReturn[key] = toReturn[i];
            delete toReturn[i];
        }
    }
    return toReturn;
}

/* jQuery.values: get or set all of the name/value pairs from child input controls
 * @argument data {array} If included, will populate all child controls.
 * @returns element if data was provided, or array of values if not
*/

$.fn.values = function(data) {
    if(typeof data != 'object') {
        return $(this).serializeObject();
    } else {
		$.each(deserializeObject(data), function(name, value){
            let input = document.getElementsByName(name)[0];
            if (input) {
                if(input.type == 'checkbox' || input.type == 'radio') {
                    $(input).attr("checked", value == $(input).val());
                } else {
                    $(input).val(value);
                }
            }
        });
        return $(this);
    }
};
function setMailConfig(a){
	let data = JSON.parse(a.getAttribute("data-json"));
	let container = document.createElement("div");

	let message = "<p>This is based on nodemailer. Refer <a href='http://lifepluslinux.blogspot.com/2017/03/introducing-mailing-in-crontab-ui.html'>this</a> for more details.</p>";
	container.innerHTML += message;

	let transporterLabel = document.createElement("label");
	transporterLabel.innerHTML = "Transporter";
	let transporterInput = document.createElement("input");
	transporterInput.type = "text";
	transporterInput.id = "transporterInput";
	transporterInput.setAttribute("placeholder", config.transporterStr);
	transporterInput.className = "form-control";
	if (data.transporterStr){
		transporterInput.setAttribute("value", data.transporterStr);
	}
	container.appendChild(transporterLabel);
	container.appendChild(transporterInput);

	container.innerHTML += "<br/>";

	let mailOptionsLabel = document.createElement("label");
	mailOptionsLabel.innerHTML = "Mail Config";
	let mailOptionsInput = document.createElement("textarea");
	mailOptionsInput.setAttribute("placeholder", JSON.stringify(config.mailOptions, null, 2));
	mailOptionsInput.className = "form-control";
	mailOptionsInput.id = "mailOptionsInput";
	mailOptionsInput.setAttribute("rows", "10");
	if (data.mailOptions)
		mailOptionsInput.innerHTML = JSON.stringify(data.mailOptions, null, 2);
	container.appendChild(mailOptionsLabel);
	container.appendChild(mailOptionsInput);

	container.innerHTML += "<br/>";

	let button = document.createElement("a");
	button.className = "btn btn-primary btn-small";
	button.innerHTML = "Use Defaults";
	button.onclick = function(){
		document.getElementById("transporterInput").value = config.transporterStr;
		document.getElementById("mailOptionsInput").innerHTML = JSON.stringify(config.mailOptions, null, 2);
	};
	container.appendChild(button);

	let buttonClear = document.createElement("a");
	buttonClear.className = "btn btn-default btn-small";
	buttonClear.innerHTML = "Clear";
	buttonClear.onclick = function(){
		document.getElementById("transporterInput").value = "";
		document.getElementById("mailOptionsInput").innerHTML = "";
	};
	container.appendChild(buttonClear);

	messageBox(container, "Mailing", null, null, function(){
		let transporterStr = document.getElementById("transporterInput").value;
		let mailOptions;
		try{
			mailOptions = JSON.parse(document.getElementById("mailOptionsInput").value);
		} catch (err) {}

		if (transporterStr && mailOptions){
				a.setAttribute("data-json", JSON.stringify({transporterStr: transporterStr, mailOptions: mailOptions}));
		} else {
				a.setAttribute("data-json", JSON.stringify({}));
		}
	});
}

function toggleRemote(element){
	let combinaison = {
        'job-docker':['job-docker-params', ['job-ssh']],
        'job-ssh':['job-ssh-params', ['job-docker']],
    }
    if (typeof(combinaison[element]) != "undefined") {
		block = combinaison[element][0];
		antagonists = combinaison[element][1];
		antagonists.forEach(function(e){ document.getElementById(e).parentNode.classList.toggle('collapse'); });
		document.getElementById(block).classList.toggle('collapse');
        $.get(routes.get_ssh_key, {}, function(data){
            document.getElementById("job-remote-ssh-key").innerText=data;
        });
    }
}

// script corresponding to job popup management
function job_string(){
	$("#job-string").val(schedule + " " + job_command);
	return schedule + " " + job_command;
}

function set_schedule(){
	schedule = $("#job-minute").val() + " " +$("#job-hour").val() + " " +$("#job-day").val() + " " +$("#job-month").val() + " " +$("#job-week").val();
	job_string();
}
// popup management ends

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
var modalHTML = null;

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
		$.post(routes.save, {_id: _id, stopped: true}, function(){
			location.reload();
		});
	});
}

function killJob(_id) {
    messageBox("<p> Do you want to stop this Job? </p>", "Confirm stop job", null, null, function(){
        $.post(routes.kill, {_id: _id, stopped: true}, function(){
            location.reload();
        });
    });
}

function startJob(_id){
	messageBox("<p> Do you want to start this Job? </p>", "Confirm start job", null, null, function(){
		$.post(routes.save, {_id: _id, stopped: false}, function(){
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
			location.reload();
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

    newJob();

	var job = null;
	crontabs.forEach(function(crontab){
		if(crontab._id == _id)
			job = crontab;
	});
	if(job){
        $("#job_form").values(job);
		if (job.mailing) {
			$("#job-mailing").attr("data-json", JSON.stringify(job.mailing));
		}

        toggleRemote();
        job_string();
	}

}

function newJob(){
    if (modalHTML === null) {
        modalHTML = $("#job").clone().wrap('<p/>').parent().html();
    }
    $("#job").remove();
    $('body').append(modalHTML);
    $("#job").modal("show");
    toggleRemote();
	job_string();
	$(".job-save").unbind("click"); // remove existing events attached to this
	$(".job-save").click(function(){
		let data = $("#job_form").values();
        data.mailling = JSON.parse($("#job-mailing").attr("data-json"));
		$.post(routes.save, data, function(){
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

/* jQuery.values: get or set all of the name/value pairs from child input controls
 * @argument data {array} If included, will populate all child controls.
 * @returns element if data was provided, or array of values if not
*/

$.fn.values = function(data) {
    var els = $(this).find(':input').get();

    if(typeof data != 'object') {
        // return all data
        data = {};

        $.each(els, function() {
            if (this.name && !this.disabled && (this.checked
                || /select|textarea/i.test(this.nodeName)
                || /text|hidden|password/i.test(this.type))) {
                data[this.name] = $(this).val();
            }
        });
        return data;
    } else {
        $.each(els, function() {
			let value = false;
			if (this.name) {
				if (data[this.name]) {
					value = data[this.name];
				} else if (this.name.match(/\[/)) {
					try {
						value = eval('data' + '["' + this.name.replace(/\[/, '][').replace(/\[/g, '["').replace(/\]/g, '"]'));
					} catch (e) {
						value = false;
					}
				}
				if (value) {
					if(this.type == 'checkbox' || this.type == 'radio') {
						$(this).attr("checked", (value == $(this).val()));
					} else if(this.type == 'textarea'){
						$(this).html(value);
					} else {
						$(this).val(value);
					}
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

function toggleRemote() {
	let combinaison = {
        'job-docker':['job-docker-params', ['job-ssh']],
        'job-ssh':['job-ssh-params', ['job-docker']],
    }
    for (var element in combinaison) {
		block = combinaison[element][0];
		antagonists = combinaison[element][1];
		if ($("#"+element).prop("checked")) {
            antagonists.forEach(function(e){ document.getElementById(e).parentNode.classList.add('collapse'); });
            document.getElementById(block).classList.remove('collapse');
        }  else {
            antagonists.forEach(function(e){ document.getElementById(e).parentNode.classList.remove('collapse'); });
            document.getElementById(block).classList.add('collapse');
        }
    }
    $.get(routes.get_ssh_key, {}, function(data){
        document.getElementById("job-remote-ssh-key").innerText=data;
    });
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

exports.routes = {
	"root" : "/",
	"save" : "/save",
	"run" : "/runjob",
	"hook" : "/hook",
	"crontab" : "/crontab",
	"kill" : "/kill",
	"remove": "/remove",
	"backup": "/backup",
	"restore": "/restore",
	"delete_backup": "/delete",
	"restore_backup": "/restore_backup",
	"export": "/export",
	"import": "/import", // this is import from database
	"import_crontab": "/import_crontab", // this is from existing crontab
	"logger": "/logger",
	"stdout": "/stdout",
	"get_ssh_key": "/get_ssh_key"
};

exports.relative = Object.keys(exports.routes).reduce((p, c) => ({...p, [c]: exports.routes[c].replace(/^\//, '')}), {});
exports.relative["root"] = ".";
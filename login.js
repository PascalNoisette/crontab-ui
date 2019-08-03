
var CT = require('node-login/app/server/modules/country-list');
var AM = require('./account-manager');
var EM = require('node-login/app/server/modules/email-dispatcher');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var routes = require("./routes").routes;
var NedbStore = require('nedb-session-store')(session);

module.exports = function(app) {

    app.use(cookieParser());


    app.use(session({
            secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b5',
            proxy: true,
            resave: true,
            saveUninitialized: true,
            store: new NedbStore({
                filename: 'crontabs/session.db'
            })
        })
    );


    /* predispacth check */
    app.use(function(req, res, next) {
        if ([routes.login, routes.signup, routes.lost].indexOf(req.url) != -1) {
        	// unprotected pages
            next();
            return;
        }
        console.log(req.cookies);
        if (typeof(req.cookies) != "undefined" && req.cookies.login != undefined){
            // attempt automatic login //
            AM.validateLoginKey(req.cookies.login, req.ip, function(e, o){
                if (o){
                    AM.autoLogin(o.user, o.pass, function(o){
                        req.session.user = o;
                        next();
                    });
                }	else{
                    res.redirect(routes.login);
                }
            });
        } else {
            res.redirect(routes.login);
        }

    });



/*
	login & logout
*/

    app.get('/login', function(req, res){
        // check if the user has an auto login key saved in a cookie //
        if (typeof(req.cookies) == "undefined" || req.cookies.login == undefined){
            res.render('login.pug', { title: 'Hello - Please Login To Your Account' });
        }	else{
            // attempt automatic login //
            AM.validateLoginKey(req.cookies.login, req.ip, function(e, o){
                if (o){
                    AM.autoLogin(o.user, o.pass, function(o){
                        req.session.user = o;
                        res.redirect('/home');
                    });
                }	else{
                    res.render('login.pug', { title: 'Hello - Please Login To Your Account' });
                }
            });
        }
    });

    app.post('/login', function(req, res){
        AM.manualLogin(req.body['user'], req.body['pass'], function(e, o){
            if (!o){
                res.status(400).send(e);
            }	else{
                req.session.user = o;
                if (req.body['remember-me'] == 'false'){
                    res.status(200).send(o);
                }	else{
                    AM.generateLoginKey(o.user, req.ip, function(key){
                        res.cookie('login', key, { maxAge: 900000 });
                        res.status(200).send(o);
                    });
                }
            }
        });
    });


	app.all('/logout', function(req, res){
		res.clearCookie('login');
		req.session.destroy(function(e){ res.redirect('/login'); });
	})
	
/*
	control panel
*/
	
	app.get('/home', function(req, res) {
		if (req.session.user == null){
			res.redirect('/');
		}	else{
			res.render('profile.pug', {
				title : 'Control Panel',
				countries : CT,
                routes : routes,
				udata : req.session.user
			});
		}
	});
	
	app.post('/home', function(req, res){
		if (req.session.user == null){
			res.redirect('/');
		}	else{
			AM.updateAccount({
				id		: req.session.user._id,
				name	: req.body['name'],
				email	: req.body['email'],
				pass	: req.body['pass'],
				country	: req.body['country']
			}, function(e, o){
				if (e){
					res.status(400).send('error-updating-account');
				}	else{
					req.session.user = o.value;
					res.status(200).send('ok');
				}
			});
		}
	});

/*
	new accounts
*/

	app.get('/signup', function(req, res) {
		res.render('signup.pug', {  title: 'Signup', countries : CT });
	});
	
	app.post('/signup', function(req, res){
		AM.addNewAccount({
			name 	: req.body['name'],
			email 	: req.body['email'],
			user 	: req.body['user'],
			pass	: req.body['pass'],
			country : req.body['country']
		}, function(e){
			if (e){
				res.status(400).send(e);
			}	else{
				res.status(200).send('ok');
			}
		});
	});

/*
	password reset
*/

	app.post('/lost-password', function(req, res){
		let email = req.body['email'];
		AM.generatePasswordKey(email, req.ip, function(e, account){
			if (e){
				res.status(400).send(e);
			}	else{
				EM.dispatchResetPasswordLink(account, function(e, m){
			// TODO this callback takes a moment to return, add a loader to give user feedback //
					if (!e){
						res.status(200).send('ok');
					}	else{
						for (k in e) console.log('ERROR : ', k, e[k]);
						res.status(400).send('unable to dispatch password reset');
					}
				});
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		AM.validatePasswordKey(req.query['key'], req.ip, function(e, o){
			if (e || o == null){
				res.redirect('/');
			} else{
				req.session.passKey = req.query['key'];
				res.render('reset.pug', { title : 'Reset Password' });
			}
		})
	});
	
	app.post('/reset-password', function(req, res) {
		let newPass = req.body['pass'];
		let passKey = req.session.passKey;
	// destory the session immediately after retrieving the stored passkey //
		req.session.destroy();
		AM.updatePassword(passKey, newPass, function(e, o){
			if (o){
				res.status(200).send('ok');
			}	else{
				res.status(400).send('unable to update password');
			}
		})
	});
	
/*
	view, delete & reset accounts
*/
	
	app.get('/print', function(req, res) {
		AM.getAllRecords( function(e, accounts){
			res.render('print.pug', { title : 'Account List', accts : accounts });
		})
	});
	
	app.post('/delete', function(req, res){
		AM.deleteAccount(req.session.user._id, function(e, obj){
			if (!e){
				res.clearCookie('login');
				req.session.destroy(function(e){ res.status(200).send('ok'); });
			}	else{
				res.status(400).send('record not found');
			}
		});
	});
	
	app.get('/reset', function(req, res) {
		AM.deleteAllAccounts(function(){
			res.redirect('/print');
		});
	});


};

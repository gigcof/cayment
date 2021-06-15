var dotenv = require('dotenv')
dotenv.config({ path: './config/config.env' });
var express = require('express');
var fs = require('fs');
var path = require('path');
var app 		   = express();
var mongoose 	   = require('mongoose');
var passport 	   = require('passport');
var LocalStrategy  = require('passport-local');
var bodyParser 	   = require("body-parser");
var flash		   = require("connect-flash");
var crypto 		   = require('crypto');
var User 		   = require('./models/user');
const sgMail 	   = require('@sendgrid/mail');
const cron = require('node-cron');
const request = require('request');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

mongoose.connect("mongodb://localhost:27017/crypto", {useNewUrlParser: true});
app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(flash());
app.use(bodyParser.urlencoded({extended: true}));
var adminRoute = require('./routes/admin');
app.use(express.static(__dirname + "/public"));

// PASSPORT CONFIGURATION
app.use(require("express-session")({
	secret: "This is a crypto app",
	resave: false,
	saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash('error');
	res.locals.success = req.flash('success');
	next();
});

// LANDING PAGE
app.get('/', (req, res) => {
	res.render('index');
})

// AUTH ROUTES

// signup form
app.get('/register', (req, res) => {
	if (req.query.id) {
		res.render('register1', {passed: req.query.id});
	} else {
		res.render('register');
	}
	
});

// signup logic
app.post("/register", function(req, res){
	if(
        req.body['g-recaptcha-response'] === undefined || 
        req.body['g-recaptcha-response'] === '' || 
        req.body['g-recaptcha-response'] === null
    ) {
        return res.json({"success": false, "msg": "please select captcha"});
    }

    // Secret Key
    const secretKey = '6LfF2cYZAAAAAHQlk5HByDC6AZhUylX3EFp_nYIQ';

    // Verify URL
    const verifyurl = `https://google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${req.body['g-recaptcha-response']}&remoteip=${req.connection.remoteAddress}`;

    // Make request to verify url
    request(verifyurl, (err, response, body) => {
        body = JSON.parse(body);

        // if not successfull
        if(body.success !== undefined && !body.success) {
            return res.json({"success": false, "msg": "Failed captcha verification"}); 
        }

        // If successfull
         console.log("Successful captcha");
	});
	if(req.body.passed.length > 0) {
	var newUser = new User({
		username: req.body.username,
		password: req.body.password,
		email: req.body.email,
		amount: 500,
		refferalCount: 0,
		emailToken: crypto.randomBytes(64).toString('hex'),
		isVerified: false,
		referID: req.body.passed
	});
	} else {
		var newUser = new User({
			username: req.body.username,
			password: req.body.password,
			email: req.body.email,
			amount: 500,
			refferalCount: 0,
			emailToken: crypto.randomBytes(64).toString('hex'),
			isVerified: false,
		});
	}
	console.log(newUser);
	User.register(newUser, req.body.password, async function(err, user){
		if (err) {
			console.log(err);
			return res.render("register", {error: err.message});
		}
		const msg = {
			from: 'info@coinganga.com',
			to: user.email,
			subject: 'Coinganga - verify your email',
			text: `
				Hello, thanks for registering on our site.
				Please copy and paste the address below to verify your account.
				http://${req.headers.host}/verify-email?token=${user.emailToken}
			`,
			html: `
				<h1>Hello, ${user.username}</h1>
				<p>Thanks for registering on our site.</p>
				<p>To continue setting up your Coinganga account, we need to confirm your email address. Please click on the button below to verify your email address.</p>
				<a href="http://${req.headers.host}/verify-email?token=${user.emailToken}">Verify Email</a>
			`
		}
		try {
			await sgMail.send(msg);
			req.flash('success', 'Thanks for registering! Please check your email to verify your account.');
			res.redirect('/');
		} catch(error) {
			console.log(error);
			req.flash('error', 'Something went wrong. Please contact us for assistance.');
			res.redirect('/');
		}
	});
});

// Email verification route
app.get('/verify-email', async (req, res, next) => {
	try {
		const user = await User.findOne( {emailToken: req.query.token} )
		if (!user) {
			req.flash('error', 'Token is invalid. Please contact us for assistance.');
			return res.redirect('/');
		}
		user.emailToken = null;
		user.isVerified = true;
		await user.save();
		await req.login(user, async (err) => {
			if (err) {
				return next(err);
			} else {
				req.flash('success', `Welcome to Cayment ${user.username}`);
				const redirectUrl = req.session.redirectTo || '/';
				delete req.session.redirectTo;
				res.redirect(redirectUrl);
			}
		});

	} catch (error) {
			req.flash('error', 'Something went wrong. Please contact us for assistance.');
			console.log(error);
			res.redirect('/');
		}
});
// login page
app.get('/login', (req, res) => {
	res.render('login');
});

// login logic
app.post("/login", isNotVerified, passport.authenticate("local", 
	{
		successRedirect: "/home",
		failureRedirect: "/login"
	}), function(req, res){
});

// logout logic
app.get("/logout", function(req, res){
	req.logout();
	req.flash("success", "Logged you out");
	res.redirect("/");
});


// user dashboard
app.get('/home', isLoggedin, (req, res) => {
	// console.log(req.user);
	if (req.user.kyc && req.user.referID) {
		User.findOneAndUpdate({_id: req.user.referID}, { $inc: { refferalCount: 1} }, function(err, response) {
			if (err) {
				console.log(err);
			} else {
				req.user.refferalCount += 1;
				req.user.referID = null;
				req.user.save();
			}
		});
	} else {
		console.log("FALSE");
	}
	res.render('home');
});

app.use('/adminconsole', adminRoute);

// Middleware
function isLoggedin(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash('error', 'Please login first');
	res.redirect("/login");
}

// middleware
async function isNotVerified(req, res, next) {
	try	{
		const user = await User.findOne({username: req.body.username});
		if (user.isVerified) {
			return next();
		} else {
			console.log('error');
		}
	} catch (error) {
		req.flash('error', "Incorrect username or password");
		res.redirect('/');
	}
}

app.listen( process.env.PORT || 3000, function(){
	console.log("STARTED");
});

// TODO : 
// Change content of email
// configure sender's email at sendgrid.
cron.schedule('0 0 0 * * *', function() {
	console.log('Data Reset');
	User.find({kyc: true},(err, users)=>{
        if(err) console.log(err);
		else {
			users.forEach((user) => {
				if(!user.isEmailSent) {
					
						var options = {
							method: 'POST',
							url: 'https://api.sendgrid.com/v3/mail/send',
							headers: {
								Authorization: 
									"Bearer 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"
							},
							body: {
								personalizations: [
									{
										to: [
											{
												email: user.email,
												name: user.username
											}
										],
										subject: "Welcome Aboard! Your KYC has been approved."
									}
								],
								from: {
									email: 'info@coinganga.com',
									name: 'Coinganga'
								},
								template_id: 'd-9f7e16350f9b4729b9774c55dbf0fb4d',
							},
							json: true 
						}
					
						request(options, function (error, response, body) {
							if (error) throw new Error(error);
						  
						// console.log(body);
						});
					 console.log(user.username);
					 user.isEmailSent = true;
					 user.save();
				}
			})
			
		}
	});
	User.find({rejectKyc: true}, (err, foundUsers) => {
		if(err) {
			console.log(err);
		} else {
			foundUsers.forEach((user) => {
				if(!user.isEmailSent) {
					// send rejection email 
					var options = {
						method: 'POST',
						url: 'https://api.sendgrid.com/v3/mail/send',
						headers: {
							Authorization: 
								"Bearer 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"
						},
						body: {
							personalizations: [
								{
									to: [
										{
											email: user.email,
											name: user.username
										}
									],
									subject: "Your KYC Submission Has Been Rejected"
								}
							],
							from: {
								email: 'info@coinganga.com',
								name: 'Coinganga'
							},
							template_id: 'd-d104999a91dc4c7eb7302d1fa689a2ad',
						},
						json: true 
					}
				
					request(options, function (error, response, body) {
						if (error) throw new Error(error);
					  
					// console.log(body);
					});
				 console.log(user.username);
				 user.isEmailSent = true;
				 user.save();
				}
				
			});
		}
	});
});
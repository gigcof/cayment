var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
	username: String,
	password: String,
	email: {type: String, unique: true, lowercase: true},
	amount: Number,
	refferalCount: Number,
	emailToken: String,
	isVerified: {type: Boolean, default: false},
	kyc: {type: Boolean, default: false},
	rejectKyc: {type: Boolean, default: false},
	isEmailSent: {type: Boolean, default: false},
	referID: String
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
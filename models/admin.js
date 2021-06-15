var mongoose = require('mongoose');

var adminSchema = new mongoose.Schema({
    email: String,
    password: String
});

module.exports = mongoose.model("Admin", adminSchema);
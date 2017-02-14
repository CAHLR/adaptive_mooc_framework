var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var RecentSchema = new Schema({
    user: String,
    recentId: String
});

module.exports = mongoose.model('Recent', RecentSchema);

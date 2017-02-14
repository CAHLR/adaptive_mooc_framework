var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var RecentSchema = new Schema({
    anonID: String,
    recentId: String
});

module.exports = mongoose.model('Recent', RecentSchema);

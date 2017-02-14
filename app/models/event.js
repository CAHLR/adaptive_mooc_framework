var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var EventSchema = new Schema({
    user: String,
    origin: String,
    recommendation: String,
    followed: String,
    prevId: String,
    timestamp: String,
    timeSeq: String
});

module.exports = mongoose.model('Event', EventSchema);

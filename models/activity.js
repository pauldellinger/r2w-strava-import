var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var ActivitySchema = new Schema(
  {
    name: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    distance: { type: Number, required: true },
    time: { type: Number, required: false },
    date: { type: Date, required: true },
    description: { type: String, required: false },
    gpsId: { type: String, required: false }
  }
);

// Virtual for book's URL
ActivitySchema
  .virtual('url')
  .get(function () {
    return '/catalog/activity/' + this._id;
  });

// Export model
module.exports = mongoose.model('Activity', ActivitySchema);

/*
name
required String, in form	The name of the activity.
type
required String, in form	Type of activity. For example - Run, Ride etc.
start_date_local
required String, in form	ISO 8601 formatted date time.
elapsed_time
required Integer, in form	In seconds.
description
String, in form	Description of the activity.
distance
Float, in form	In meters.
trainer
Integer, in form	Set to 1 to mark as a trainer activity.
photo_ids
String, in form	List of native photo ids to attach to the activity.
commute
Integer, in form	Set to 1 to mark as commute.
*/

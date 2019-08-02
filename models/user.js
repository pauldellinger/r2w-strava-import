var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var UserSchema = new Schema(
  {
    name: { type: String, required: true },
    access_token: { type: String, required: true },
    refresh_token: { type: String, required: true },
    strava_id: { type: Number, required: true },
    strava_pic: { type: String, required: false }
  }
);

// Virtual for book's URL
UserSchema
  .virtual('url')
  .get(function () {
    return '/catalog/user/' + this._id;
  });

// Export model
module.exports = mongoose.model('User', UserSchema);

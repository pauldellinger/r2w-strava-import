var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');
var Activity = require('../models/activity');
var User = require('../models/user');
var moment = require('moment');
const request = require('request');

const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');
var async = require('async');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const IMDB_URL = (movie_id) => `https://www.imdb.com/title/${movie_id}/`;
const MOVIE_ID = `tt6763664`;
const R2W_URL = (r2w_user) => `http://www.running2win.com/community/view-member-running-log.asp?vu=${r2w_user}&sd=7/8/2000&ed=7/28/2019`;
const CLIENT_ID = '36915';
const CLIENT_SECRET = 'e2fe9096e00c20e6348844803250d7ba82a74242';
function STRAVA_URI (code) {
  var url = 'https://www.strava.com/oauth/token?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&code=' + code + '&grant_type=authorization_code';
  return url;
};

// Display list of all Authors.
exports.user_list = function (req, res, next) {
  User.find()
    .sort([['name', 'descending']])
    .exec(function (err, list_users) {
      if (err) { return next(err); }
      // Successful, so render
      res.render('user_list', { title: 'User List', user_list: list_users });
    });
};

// Display detail page for a specific activity.
exports.user_detail = function (req, res, next) {
  async.parallel({
    user: function (callback) {
      User.findById(req.params.id)
        .exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); } // Error in API Usage
    if (results.user == null) { // no results
      err = new Error('user not found');
      err.status = 404;
      return next(err);
    }
    // successful, render
    // console.log(results.user);
    res.render('user_detail', { title: results.user.name, user: results.user });
  });
};

// Display activity delete form on GET.
exports.user_delete_get = function (req, res, next) {
  async.parallel({
    user: function (callback) {
      User.findById(req.params.id).exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); }
    if (results.user == null) { // No results.
      res.redirect('/catalog/users');
    }
    // Successful, so render.
    res.render('user_delete', { title: 'Delete User', user: results.user });
  });
};

// Handle activity delete on POST.
// Handle Author delete on POST.

exports.user_delete_post = function (req, res, next) {
  Activity.deleteMany({ user: req.body.userid }, function (err, results) {
    if (err) { return next(err); }
    // Success
    // Author has no books. Delete object and redirect to the list of authors.
    User.findByIdAndRemove(req.body.userid, function deleteActivity (err) {
      if (err) { return next(err); }
      // Success - go to author list
      res.redirect('/catalog/users');
    });
  });
};

exports.user_delete_all_get = function (req, res, next) {
  res.render('user_delete_all', { title: 'Delete All Users' });
};

exports.user_delete_all_post = function (req, res, next) {
  // Author has no books. Delete object and redirect to the list of authors.
  User.deleteMany(function deleteAllUsers (err) {
    if (err) { return next(err); }
    // Success - go to author list
    res.redirect('/catalog/users');
  });
};
exports.token_exchange_get = function (req, res, next) {
  var uri = STRAVA_URI(req.query.code);
  request.post(uri, (error, res2, body) => {
    if (error) {
      console.error(error);
      return;
    }
    // console.log(`statusCode: ${res2.statusCode}`);
    // console.log(res);
    var bodyJson = JSON.parse(body);
    // console.log(bodyJson.athlete.firstname, bodyJson.access_token, bodyJson.refresh_token, bodyJson.athlete.id);
    var op = {
      upsert: true,
      returnOriginal: false
    };
    User.findOneAndUpdate(
      { strava_id: bodyJson.athlete.id },
      {
        $set: {
          name: bodyJson.athlete.firstname + ' ' + bodyJson.athlete.lastname,
          access_token: bodyJson.access_token,
          refresh_token: bodyJson.refresh_token,
          strava_id: bodyJson.athlete.id,
          strava_pic: bodyJson.athlete.profile
        }
      },
      {
        upsert: true
      }, function (err, result) {
        if (err) { return next(err); }
        // Successful, redirect to new author record
        User.findOne({ strava_id: bodyJson.athlete.id }
          , function (err, result) {
            if (err) { return next(err); }
            res.redirect(result.url);
          });
      });
  });
};

        /*
    User.findOne({ strava_id: bodyJson.athlete.id }, function (err, found) {
      if (err) {
        throw err;
      }
      if (found) {
        var user = found;
        found.access_token = bodyJson.access_token;
        found.refresh_token = bodyJson.refresh_token;
        // console.log(found);
        res.redirect(user.url);
        res.render('exchange_token', { title: 'Finshing authentication', user: user });
      } else {
        user = new User(
          {
            name: bodyJson.athlete.firstname + ' ' + bodyJson.athlete.lastname,
            access_token: bodyJson.access_token,
            refresh_token: bodyJson.refresh_token,
            strava_id: bodyJson.athlete.id,
            strava_pic: bodyJson.athlete.profile
          });
        // console.log('The query was successful, but nothing was found');
        user.save(function (err) {
          if (err) { return next(err); }
          // Successful, redirect to new author record
          res.redirect(user.url);
          //  res.render('exchange_token', { title: 'Finshing authentication', user: user });
        });
      };
    });
    */


exports.user_finish_get = function (req, res, next) {
  // console.log(req.params.id);
  res.render('finish', { title: 'Finish Import', userid: req.params.id });
};
exports.user_finish_post = function (req, res, next) {
  Activity.deleteMany({ user: req.params.id }, function (err, results) {
    if (err) { return next(err); }
    // Success
    // Author has no books. Delete object and redirect to the list of authors.
    User.findByIdAndRemove(req.params.id, function deleteActivity (err) {
      if (err) { return next(err); }
      // Success - go to author list
      res.redirect('https://www.strava.com/athlete/training');
    });
  });
};

// Display activity update form on GET.
exports.user_update_get = function (req, res) {
  res.send('NOT IMPLEMENTED: activity update GET');
};

// Handle activity update on POST.
exports.user_update_post = function (req, res) {
  res.send('NOT IMPLEMENTED: activity update POST');
};

var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');
var Activity = require('../models/activity');
var User = require('../models/user');

var debug = require('debug')('activity');
var moment = require('moment');
const request = require('request');
var rp = require('request-promise');

const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');
var async = require('async');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const IMDB_URL = (movie_id) => `https://www.imdb.com/title/${movie_id}/`;
const MOVIE_ID = `tt6763664`;
const R2W_URL = (r2wUser, startDate, endDate) => `http://www.running2win.com/community/view-member-running-log.asp?vu=${r2wUser}&sd=${startDate}&ed=${endDate}`;
const GPS_LINK = (activityKey) => `http://www.running2win.com/garmin/ReportData.asp?wok=${activityKey}`;
const CLIENT_ID = '36915';
const CLIENT_SECRET = 'e2fe9096e00c20e6348844803250d7ba82a74242';
const STRAVA_CREATE_URL = (name, date, time, description, distance, token) => `https://www.strava.com/api/v3/activities?name=${name}&type=Run&start_date_local=${date}&elapsed_time=${time}&description=${description}&distance=${distance}&access_token=${token}`;
const STRAVA_GET_ACTIVITIES = (before, after, page, token) => `https://www.strava.com/api/v3/athlete/activities?before=${before}&after=${after}&page=${page}&per_page=200&access_token=${token}`;
function STRAVA_URI (code) {
  var url = 'https://www.strava.com/oauth/token?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&code=' + code + '&grant_type=authorization_code';
  return url;
};

// Display list of all Authors.
exports.activity_list = function (req, res, next) {
  async.parallel({
    user: function (callback) {
      User.findById(req.params.id)
        .exec(callback);
    },
    list_activities: function (callback) {
      Activity.find({ user: req.params.id })
        .sort([['date', 'descending']])
        .populate('user')
        .exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); } // Error in API Usage
    if (results.user == null) { // no results
      err = new Error('Author not found');
      err.status = 404;
      return next(err);
    }
    // successful, render
    // console.log('activity list : ', results.list_activities);
    console.log(results.user);
    res.render('activity_list', { title: 'Activity List', activity_list: results.list_activities, user: results.user });
  });
};

// Display detail page for a specific activity.
exports.activity_detail = function (req, res, next) {
  async.parallel({
    activity: function (callback) {
      Activity.findById(req.params.id)
        .populate('user')
        .exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); } // Error in API Usage
    if (results.activity == null) { // no results
      err = new Error('Activity not found');
      err.status = 404;
      return next(err);
    }
    // successful, render
    res.render('activity_detail', { title: results.activity.name, activity: results.activity, user: results.activity.user });
  });
};

// Display activity create form on GET.
exports.activity_create_get = function (req, res, next) {
  res.render('activity_form', { title: 'Create Activity' });
};

// Handle activity create on POST.
exports.activity_create_post = [
  // Validation
  body('name').isLength({ min: 1 }).trim().withMessage('Must have name'),
  body('date', 'Invalid Date').optional({ checkFalsy: true }).isISO8601(),

  // Sanitize
  sanitizeBody('name').escape(),
  sanitizeBody('description').escape(),
  sanitizeBody('date').toDate(),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // extract request after val and san
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // WE got some errors, render form with messages
      res.render('activity_form', { title: 'Create_activity', activity: req.body, errors: errors.array() });
      return;
    } else {
      // data is valid
      // create author object
      // console.log(req.body.date);
      var activity = new Activity(
        {
          name: req.body.name,
          distance: req.body.distance,
          time: req.body.time,
          date: req.body.date,
          description: req.body.description
        });
      activity.save(function (err) {
        if (err) { return next(err); }
        // Successful, redirect to new author record
        res.redirect(activity.url);
      });
    }
  }
];

exports.activity_import_get = function (req, res, next) {
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
    res.render('import_form', { title: 'Import Activities', user: results.user });
  });
};

exports.activity_import_post = [
  // Validation
  body('r2w_username').isLength({ min: 1 }).trim().withMessage('Must have username'),

  // Sanitize
  sanitizeBody('r2w_username').escape(),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // extract request after val and san
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // WE got some errors, render form with messages
      res.render('import_form', { title: 'Import Activities', username: req.body, errors: errors.array() });
      // // console.log("we're seeing some errors here");
      return;
    } else {
      // data is valid
      // create author object
      // console.log(req.body.r2w_username);
      // console.log(req.body.startDate, req.body.endDate);
      // console.log(req.params.id);

      User.findById(req.params.id, function (error, result) {
        if (error) { return next(error); }
        // console.log(result);
        var user = result;
        // console.log(user);
        (async () => {
          // var r2w_user = req.body.r2w_username;

          const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
          const page = await browser.newPage();
          await page.goto('http://www.running2win.com//index.asp?login=Demo');
          await page.waitFor(() => document.querySelector('#leftcolumn > div > div.sideContainer > table > tbody > tr > td'));
          var startDate = moment(req.body.startDate);
          var endDate = moment(req.body.endDate);
          // console.log(startDate.year(), endDate.year());
          var yearDifference = endDate.year() - startDate.year();
          var combine = [];
          while (startDate.year() <= endDate.year() + 1) {
            var addYear = startDate.clone().add(365, 'days');
            await page.goto(R2W_URL(req.body.r2w_username, startDate.format('MM-DD-YYYY'), addYear.format('MM-DD-YYYY')));

            try {
              await page.waitFor(() => document.querySelector('body > div.footer > div:nth-child(1) > div > div:nth-child(2) > div > table > tbody > tr:nth-child(3) > td:nth-child(2)'));
              let data = await page.evaluate(() => {
                // let hi = document.querySelector('body > div.container > form > table:nth-child(8) > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(3)').innerText;
                // console.log(hi);
                var arr = [];
                var tables = document.querySelectorAll('table.encapsule');
                for (var i = 1; i < tables.length; i++) {
                  var html = tables[i].innerHTML; // firstChild.firstChild.childNodes[1].firstChild.childNodes[1].childNodes[1].firstChild.firstChild.innerHTML;
                  var dateRegex = /(0[1-9]|1[012]|[0-9])[- /.](0[1-9]|[12][0-9]|3[01]|[0-9])[- /.](19|20)\d\d/g;
                  var date = html.slice(html.search(dateRegex), html.search(dateRegex) + 10);
                  date = date.replace('"', '');
                  var detailStart = '<strong><span style="color:red; font-size:1.5em;">\n';
                  var details = html.slice(html.indexOf(detailStart) + detailStart.length, html.indexOf('</span>', html.indexOf(detailStart)));
                  var commentStart = 'Comments</td>\n<td colspan="2">';
                  var comment = html.slice(html.indexOf(commentStart) + commentStart.length, html.indexOf('</td>', html.indexOf(commentStart) + commentStart.length));
                  var mileage = details.slice(0, details.indexOf(' Miles'));
                  var time = details.slice(details.indexOf('in ') + 3, details.indexOf('['));
                  var wok = html.slice(html.indexOf('WOK=') + 4, html.indexOf('&', html.indexOf('WOK=')));
                  var hasGps = html.indexOf('runmap');

                  // var details = tables[i].querySelector('tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(2) > strong > span').innerHTML;
                  // console.log({ html, date, mileage, time, details, comment });

                  arr.push({ date, mileage, time, details, comment, wok, hasGps });
                }
                return arr;
              });
              combine = combine.concat(data);
              startDate.add(1, 'years');
            } catch (err) { startDate.add(1, 'years'); }
          }
          /*
          await page.goto(R2W_URL(req.body.r2w_username, req.body.startDate, req.body.endDate));
          await page.waitFor(() => document.querySelector('body > div.footer > div:nth-child(1) > div > div:nth-child(2) > div > table > tbody > tr:nth-child(3) > td:nth-child(2)'));
          let data = await page.evaluate(() => {
            // let hi = document.querySelector('body > div.container > form > table:nth-child(8) > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(3)').innerText;
            // console.log(hi);
            var arr = [];
            var tables = document.querySelectorAll('table.encapsule');
            for (var i = 1; i < tables.length; i++) {
              var html = tables[i].innerHTML; // firstChild.firstChild.childNodes[1].firstChild.childNodes[1].childNodes[1].firstChild.firstChild.innerHTML;
              var dateRegex = /(0[1-9]|1[012]|[0-9])[- /.](0[1-9]|[12][0-9]|3[01]|[0-9])[- /.](19|20)\d\d/g;
              var date = html.slice(html.search(dateRegex), html.search(dateRegex) + 10);
              var detailStart = '<strong><span style="color:red; font-size:1.5em;">\n';
              var details = html.slice(html.indexOf(detailStart) + detailStart.length, html.indexOf('</span>', html.indexOf(detailStart)));
              var commentStart = 'Comments</td>\n<td colspan="2">';
              var comment = html.slice(html.indexOf(commentStart) + commentStart.length, html.indexOf('</td>', html.indexOf(commentStart) + commentStart.length));
              var mileage = details.slice(0, details.indexOf(' Miles'));
              var time = details.slice(details.indexOf('in ') + 3, details.indexOf('['));
              var wok = html.slice(html.indexOf('WOK=') + 4, html.indexOf('&', html.indexOf('WOK=')));
              var hasGps = html.indexOf('runmap');

              // var details = tables[i].querySelector('tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(2) > strong > span').innerHTML;
              // console.log({ html, date, mileage, time, details, comment });
              arr.push({ date, mileage, time, details, comment, wok, hasGps });
            }
            return arr;
          });
          */
          // await browser.close();
          /* Outputting what we scraped */
          // console.log(combine);
          // console.log(data[data.length - 1]);
          /*
          request(GPS_LINK(18596612), function (error, response, body) {
            console.error('error:', error); // Print the error if one occurred
            // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            // console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
          });
          */
          for (var i = 0; i < combine.length; i++) {
            var run = combine[i];
            run.date = moment(run.date);

            // console.log(run.date.format('MM-DD-YYYY'));
            // console.log(run.mileage + ' mile run on ' + run.date.format('MM-DD-YYYY'));
            var name = (run.mileage + ' mile run');
            var seconds;
            if (run.time.split(':').length > 1) seconds = toSeconds(run.time);
            else seconds = 0;
            var re = /<br>/gi;
            run.comment = run.comment.replace('-- Garmin Connect Import --', '');
            run.comment = run.comment.replace(re, '');
            // console.log(name, run.mileage * 1609.344, seconds, run.date.format(), run.comment);
            if (!isNaN(run.mileage * 1609.344) && !run.date.isAfter(endDate)) {
              var activity = new Activity(
                {
                  name: name,
                  user: user,
                  distance: run.mileage * 1609.344,
                  time: seconds,
                  date: run.date.format(),
                  description: run.comment
                });
              if (run.hasGps > 0) activity.gpsId = run.wok;
              // console.log(activity.user);
              // console.log(activity.user.strava_id);

              activity.save(function (err) {
                if (err) { return next(err); }
                // Successful, redirect to new author record
                // console.log('error on run: ' + run.date.format());
              });
            }
          }
          res.redirect('/catalog/user/' + req.params.id + '/activities');
          // ...
        })();
      });
    };
  }
];

exports.activity_export_get = function (req, res, next) {
  Activity.find({ user: req.params.id })
    .sort([['date', 'descending']])
    .populate('user')
    .exec(function (err, list_activities) {
      if (err) { return next(err); }
      // Successful, so render
      var before = moment(list_activities[0].date).add(1, 'day').unix();
      // var before = 1564515793; // unix for today
      var after = moment(list_activities[list_activities.length - 1].date).subtract(1, 'day').unix();
      var token = list_activities[0].user.access_token;
      var page = 1;
      var uri = STRAVA_GET_ACTIVITIES(before, after, page, token);
      var stravaRuns = [];
      // console.log(uri, stravaRuns);
      getActivities(page, stravaRuns, token, before, after).then(function (result) {
        stravaRuns = result;
        // console.log('inside .then: ', result.length);
        // console.log('inside .then stravaRuns: ', stravaRuns.length);
        for (var i = 0; i < list_activities.length; i++) {
          var run = list_activities[i];
          // console.log(run);
          if (!matchRun(run, stravaRuns)) createActivity(run);
        }
      });
      // console.log('stravaruns: ', stravaRuns.length);
        /*
        for (var i = 0; i < list_activities.length; i++) {
          var run = list_activities[i];
          console.log(run);
          var uri = STRAVA_CREATE_URL(run.name, run.date, run.time, run.description, run.distance, run.user.access_token);
          request.post(uri, (error, res2, body) => {
            if (error) {
              console.error(error);
              return;
            }
            console.log(`statusCode: ${res2.statusCode}`);
            // console.log(res);
            var bodyJson = JSON.parse(body);
            console.log(bodyJson.athlete.firstname, bodyJson.access_token, bodyJson.refresh_token, bodyJson.athlete.id);
          });
        }
        */

      res.redirect('/catalog/user/' + req.params.id + '/activities/finish');
    });
};
exports.activity_export_post = function (req, res, next) {
  res.send('NOT IMPLEMENTED: activity update GET');
};
// Display activity delete form on GET.
exports.activity_delete_get = function (req, res, next) {
  async.parallel({
    activity: function (callback) {
      Activity.findById(req.params.id).exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); }
    if (results.activity == null) { // No results.
      res.redirect('/catalog/activities');
    }
    // Successful, so render.
    res.render('activity_delete', { title: 'Delete Activity', activity: results.activity });
  });
};

// Handle activity delete on POST.
// Handle Author delete on POST.

exports.activity_delete_post = function (req, res, next) {
  async.parallel({
    activity: function (callback) {
      Activity.findById(req.body.activityid).exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); }
    // Success

    // Author has no books. Delete object and redirect to the list of authors.
    Activity.findByIdAndRemove(req.body.activityid, function deleteActivity (err) {
      if (err) { return next(err); }
      // Success - go to author list
      res.redirect('/catalog/activities');
    });
  }
  );
};

exports.activity_delete_all_get = function (req, res, next) {
  res.render('activity_delete_all', { title: 'Delete All Activiies' });
};

exports.activity_delete_all_post = function (req, res, next) {
  // Author has no books. Delete object and redirect to the list of authors.
  Activity.deleteMany(function deleteAllActivities (err) {
    if (err) { return next(err); }
    // Success - go to author list
    res.redirect('../');
  });
};
/*
exports.token_exchange_get = function (req, res, next) {
  var uri = STRAVA_URI(req.query.code);
  request.post(uri, (error, res, body) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log(`statusCode: ${res.statusCode}`);
    // console.log(res);
    var bodyJson = JSON.parse(body);
    console.log(bodyJson.athlete.firstname, bodyJson.access_token, bodyJson.refresh_token, bodyJson.athlete.id);
    var user = new User(
      {
        name: bodyJson.athlete.firstname + ' ' + bodyJson.athlete.lastname,
        access_token: bodyJson.access_token,
        refresh_token: bodyJson.refresh_token,
        strava_id: bodyJson.athlete.id
      });
    user.save(function (err) {
      if (err) { return next(err); }
      // Successful, redirect to new author record
      res.redirect('../user/' + user.url);
    });
  });
  res.render('exchange_token', { title: 'Finshing authentication' });
};
*/
// Display activity update form on GET.
exports.activity_update_get = function (req, res) {
  res.send('NOT IMPLEMENTED: activity update GET');
};
// Handle activity update on POST.
exports.activity_update_post = function (req, res) {
  res.send('NOT IMPLEMENTED: activity update POST');
};
function toSeconds (str) {
  var time = str.split(':');
  // return Number(time[0]) +  Number(time[1]);
  if (time.length === 2) return (parseInt(time[0]) * 60) + parseInt(time[1]);
  else if (time.length === 3) return (parseInt(time[0]) * 60 * 60) + (parseInt(time[1]) * 60) + parseInt(time[2]);
}

function getActivities (page, stravaRuns, token, before, after) {
  var options = {
    uri: 'https://www.strava.com/api/v3/athlete/activities',
    qs: {
      access_token: token, // -> uri + '?access_token=xxxxx%20xxxxx'
      before: before,
      after: after,
      page: page,
      per_page: 200
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };

  return rp(options)
    .then(function (res) {
      stravaRuns = stravaRuns.concat(res);
      if (res.length < 200) {
        // console.log('in function: ', stravaRuns.length);
        return stravaRuns;
      } else {
        return getActivities(page + 1, stravaRuns, token, before, after);
      }
    })
    .catch(function (err) {
      // API call failed...
      debug('get activity error: ' + err);
    });
}
function updateRun (id, description, token) {
  var options = {
    uri: 'https://www.strava.com/api/v3/activities/' + id,
    method: 'PUT',
    qs: {
      access_token: token, // -> uri + '?access_token=xxxxx%20xxxxx'
      description: description
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };
  return rp(options)
    .then(function (res) {
      // console.log(res);
      // console.log(res.description);
    })
    .catch(function (err) {
      // API call failed...
      debug('update error: ' + err);
    });
}
function createActivity (run) {
  var options = {
    uri: 'https://www.strava.com/api/v3/activities',
    method: 'POST',
    body: {
      name: run.name,
      type: 'Run',
      start_date_local: run.date,
      elapsed_time: run.time,
      description: run.description,
      distance: run.distance,
      access_token: run.user.access_token
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  };
  return rp(options)
    .then(function (res) {
      // console.log('creating: ', res.name);
    })
    .catch(function (err) {
      // API call failed...
      debug('create error: ' + err);
    });
}
function matchRun (run, stravaRuns) {
  for (var j = 0; j < stravaRuns.length; j++) {
    var stravaRun = stravaRuns[j];
    // console.log('comparing strava: ', moment(stravaRun.start_date).format('YYYY-MM-DD'), run.distance, 'to r2w: ', moment(run.date).format('YYYY-MM-DD'), stravaRun.distance);
    if (moment(stravaRun.start_date_local).format('YYYY-MM-DD') === moment(run.date).format('YYYY-MM-DD') && (stravaRun.distance > run.distance - 800 && stravaRun.distance < run.distance + 800)) {
      // console.log(stravaRun.distance, run.distance);
      if (run.description.length !== 0) {
        // update run with r2w description
        // console.log('updating', run.name, run.date); // , run.description);
        updateRun(stravaRun.id, run.description, run.user.access_token);
      }
      return true;
    }
  }
  // console.log('no matched run');
  return false;
}

/*
function getR2W (page, arr) {
  let data = await page.evaluate(() => {
    // let hi = document.querySelector('body > div.container > form > table:nth-child(8) > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(3)').innerText;
    // console.log(hi);
    var tables = document.querySelectorAll('table.encapsule');
    for (var i = 1; i < tables.length; i++) {
      var html = tables[i].innerHTML; // firstChild.firstChild.childNodes[1].firstChild.childNodes[1].childNodes[1].firstChild.firstChild.innerHTML;
      var dateRegex = /(0[1-9]|1[012]|[0-9])[- /.](0[1-9]|[12][0-9]|3[01]|[0-9])[- /.](19|20)\d\d/g;
      var date = html.slice(html.search(dateRegex), html.search(dateRegex) + 10);
      var detailStart = '<strong><span style="color:red; font-size:1.5em;">\n';
      var details = html.slice(html.indexOf(detailStart) + detailStart.length, html.indexOf('</span>', html.indexOf(detailStart)));
      var commentStart = 'Comments</td>\n<td colspan="2">';
      var comment = html.slice(html.indexOf(commentStart) + commentStart.length, html.indexOf('</td>', html.indexOf(commentStart) + commentStart.length));
      var mileage = details.slice(0, details.indexOf(' Miles'));
      var time = details.slice(details.indexOf('in ') + 3, details.indexOf('['));
      var wok = html.slice(html.indexOf('WOK=') + 4, html.indexOf('&', html.indexOf('WOK=')));
      var hasGps = html.indexOf('runmap');

      // var details = tables[i].querySelector('tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(2) > strong > span').innerHTML;
      // console.log({ html, date, mileage, time, details, comment });
      arr.push({ date, mileage, time, details, comment, wok, hasGps });
    }
    return arr;
  });
} */

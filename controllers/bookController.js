var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');
var Activity = require('../models/activity');
const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');
var async = require('async');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const IMDB_URL = (movie_id) => `https://www.imdb.com/title/${movie_id}/`;
const MOVIE_ID = `tt6763664`;

exports.index = function (req, res) {
  var dev_authorize_url = "http://www.strava.com/oauth/authorize?client_id=36915&response_type=code&redirect_uri=https://activityimporter.herokuapp.com/catalog/user/exchange_token&approval_prompt=force&scope=read,activity:read_all,activity:write";
  var url = process.env.AUTHORIZE_URL || dev_authorize_url;
  async.parallel({
    book_count: function (callback) {
      Book.countDocuments({}, callback); // Pass an empty object as match condition to find all documents of this collection
    },
    book_instance_count: function (callback) {
      BookInstance.countDocuments({}, callback);
    },
    book_instance_available_count: function (callback) {
      BookInstance.countDocuments({ status: 'Available' }, callback);
    },
    author_count: function (callback) {
      Author.countDocuments({}, callback);
    },
    genre_count: function (callback) {
      Genre.countDocuments({}, callback);
    },
    activity_count: function (callback) {
      Activity.countDocuments({}, callback);
    }
  }, function (err, results) {
    res.render('index', { title: 'Local Library Home', url: url, error: err, data: results });
  });
};

// Display list of all books.
exports.book_list = function (req, res, next) {
  Book.find({}, 'title author')
    .populate('author')
    .exec(function (err, list_books) {
      if (err) { return next(err); }
      // Successful, so render
      res.render('book_list', { title: 'Book List', book_list: list_books });
    });
};

// Display detail page for a specific book.
exports.book_detail = function (req, res, next) {
  (async () => {
    /* Initiate the Puppeteer browser */
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    /* Go to the IMDB Movie page and wait for it to load */
    await page.goto(IMDB_URL(MOVIE_ID), { waitUntil: 'networkidle0' });
    /* Run javascript inside of the page */
    let data = await page.evaluate(() => {
      let title = document.querySelector('div[class="title_wrapper"] > h1').innerText;
      let rating = document.querySelector('span[itemprop="ratingValue"]').innerText;
      let ratingCount = document.querySelector('span[itemprop="ratingCount"]').innerText;
      /* Returning an object filled with the scraped data */
      return {
        title,
        rating,
        ratingCount
      }
    });
    /* Outputting what we scraped */
    console.log(data);
    await browser.close();
  })();
  (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://www.running2win.com//index.asp?login=Demo');
    await page.waitFor(() => document.querySelector('#leftcolumn > div > div.sideContainer > table > tbody > tr > td'));
    await page.goto('http://www.running2win.com/community/view-member-running-log.asp?vu=pauldellinger&sd=7/8/2000&ed=7/28/2019');
    await page.waitFor(() => document.querySelector('body > div.footer > div:nth-child(1) > div > div:nth-child(2) > div > table > tbody > tr:nth-child(3) > td:nth-child(2)'));
    let data = await page.evaluate(() => {
      // let hi = document.querySelector('body > div.container > form > table:nth-child(8) > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(3)').innerText;
      // console.log(hi);
      var arr = [];
      var tables = document.querySelectorAll('table.encapsule');
      for (var i = 0; i < tables.length; i++) {
        var html = tables[i].innerHTML; // firstChild.firstChild.childNodes[1].firstChild.childNodes[1].childNodes[1].firstChild.firstChild.innerHTML;
        var dateRegex = /(0[1-9]|1[012]|[0-9])[- /.](0[1-9]|[12][0-9]|3[01]|[0-9])[- /.](19|20)\d\d/g;
        var date = html.slice(html.search(dateRegex), html.search(dateRegex) + 9);
        var detailStart = '<strong><span style="color:red; font-size:1.5em;">\n';
        var details = html.slice(html.indexOf(detailStart) + detailStart.length, html.indexOf('</span>', html.indexOf(detailStart)));
        var commentStart = 'Comments</td>\n<td colspan="2">';
        var comment = html.slice(html.indexOf(commentStart) + commentStart.length, html.indexOf('</td>', html.indexOf(commentStart) + commentStart.length));
        var mileage = details.slice(0, details.indexOf(' Miles'));
        var time = details.slice(details.indexOf('in ') + 3, details.indexOf('['));
        // var details = tables[i].querySelector('tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td:nth-child(2) > strong > span').innerHTML;
        arr.push({ date, mileage, time, details, comment });
      }
      return {
        tables,
        arr
      };
    });
    /* Outputting what we scraped */
    console.log(data);
    await browser.close();
    // ...
  })();
  async.parallel({
    book: function (callback) {
      Book.findById(req.params.id)
        .populate('author')
        .populate('genre')
        .exec(callback);
    },
    book_instance: function (callback) {
      BookInstance.find({ book: req.params.id })
        .exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); }
    if (results.book == null) { // No results.
      err = new Error('Book not found');
      err.status = 404;
      return next(err);
    }
    // Successful, so render.
    res.render('book_detail', { title: results.book.title, book: results.book, book_instances: results.book_instance });
  });
};

// Display book create form on GET.
exports.book_create_get = function (req, res, next) {
  // Get all authors and genres, which we can use for adding to our book.
  async.parallel({
    authors: function (callback) {
      Author.find(callback);
    },
    genres: function (callback) {
      Genre.find(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); }
    res.render('book_form', { title: 'Create Book', authors: results.authors, genres: results.genres });
  });
};

// Handle book create on POST.
exports.book_create_post = [
  // Convert the genre to an array.
  (req, res, next) => {
    if (!(req.body.genre instanceof Array)) {
      if (typeof req.body.genre === 'undefined') req.body.genre = [];
      else { req.body.genre = new Array(req.body.genre); }
    }
    next();
  },

  // Validate fields.
  body('title', 'Title must not be empty.').isLength({ min: 1 }).trim(),
  body('author', 'Author must not be empty.').isLength({ min: 1 }).trim(),
  body('summary', 'Summary must not be empty.').isLength({ min: 1 }).trim(),
  body('isbn', 'ISBN must not be empty').isLength({ min: 1 }).trim(),

  // Sanitize fields (using wildcard).
  sanitizeBody('*').escape(),

  // Process request after validation and sanitization.
  (req, res, next) => {
    // extract validation errors
    const errors = validationResult(req);
    // creat a book object with data
    var book = new Book(
      { title: req.body.title,
        author: req.body.author,
        summary: req.body.summary,
        isbn: req.body.isbn,
        genre: req.body.genre
      });
    if (!errors.isEmpty()) {
      // there are errors, render form again
      async.parallel({
        authors: function (callback) {
          Author.find(callback);
        },
        genres: function (callback) {
          Genre.find(callback);
        }
      }, function (err, results) {
        if (err) { return next(err); }
        // mark selected genres as checked
        for (let i = 0; i < results.genres.length; i++) {
          if (book.genre.indexOf(results.genres[i]._id) > -1) {
            results.genres[i].checked = 'true';
          }
        }
        res.render('book_form', { title: 'Create Book', authors: results.authors, genres: results.genres, book: book, errors: errors.array() });
      });
      return;
    }
    else {
      // Data from form is valid. Save book.
      book.save(function (err) {
        if (err) { return next(err); }
        // successful - redirect to new book record.
        res.redirect(book.url);
      });
    }
  }
];
// Display book delete form on GET.
exports.book_delete_get = function(req, res) {
    res.send('NOT IMPLEMENTED: Book delete GET');
};

// Handle book delete on POST.
exports.book_delete_post = function(req, res) {
    res.send('NOT IMPLEMENTED: Book delete POST');
};

// Display book update form on GET.
exports.book_update_get = function(req, res) {
    res.send('NOT IMPLEMENTED: Book update GET');
};

// Handle book update on POST.
exports.book_update_post = function(req, res) {
    res.send('NOT IMPLEMENTED: Book update POST');
};

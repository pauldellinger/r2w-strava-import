var Author = require('../models/author');
var async = require('async');
var Book = require('../models/book');
const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');

// Display list of all authors.
exports.author_list = function (req, res, next) {
  Author.find()
    .sort([['family_name', 'ascending']])
    .exec(function (err, list_authors) {
      if (err) { return next(err); }
      // Successful, so render
      res.render('author_list', { title: 'Author List', author_list: list_authors });
    });
};

// Display detail page for a specific author.
exports.author_detail = function (req, res, next) {
  async.parallel({
    author: function (callback) {
      Author.findById(req.params.id)
        .exec(callback);
    },
    authors_books: function (callback) {
      Book.find({ author: req.params.id }, 'title summary')
        .exec(callback);
    }
  }, function (err, results) {
    if (err) { return next(err); } // Error in API Usage
    if (results.author == null) { // no results
      err = new Error('Author not found');
      err.status = 404;
      return next(err);
    }
    // successful, render
    res.render('author_detail', { title: 'Author Detail', author: results.author, author_books: results.authors_books });
  });
};
// Display author create form on GET
exports.author_create_get = function (req, res, next) {
  res.render('author_form', { title: 'Create Author' });
};

// Handle Author create on POST.
exports.author_create_post = [
  // Validation
  body('first_name').isLength({ min: 1 }).trim().withMessage('Must have first name')
    .isAlphanumeric().withMessage('First name has non_alpha chars'),
  body('family_name').isLength({ min: 1 }).trim().withMessage('Must have family name')
    .isAlphanumeric().withMessage('family name has non_alpha chars'),
  body('date_of_birth', 'Invalid DOB').optional({ checkFalsy: true }).isISO8601(),
  body('date_of_death', 'Invalid death date').optional({ checkFalsy: true }).isISO8601(),

  // Sanitize
  sanitizeBody('first_name').escape(),
  sanitizeBody('family_name').escape(),
  sanitizeBody('date_of_birth').toDate(),
  sanitizeBody('date_of_death').toDate(),

  // Process request after validation and sanitization.
  (req, res, next) => {
    // extract request after val and san
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // WE got some errors, render form with messages
      res.render('author_form', { title: 'Create_author', author: req.body, errors: errors.array() });
      return;
    } else {
      // data is valid
      // create author object
      var author = new Author(
        {
          first_name: req.body.first_name,
          family_name: req.body.family_name,
          date_of_birth: req.body.date_of_birth,
          date_of_death: req.body.date_of_death
        });
      author.save(function (err) {
        if (err) { return next(err); }
        // Successful, redirect to new author record
        res.redirect(author.url);
      });
    }
  }
];

// Display Author delete form on GET.
exports.author_delete_get = function (req, res) {
  res.send('NOT IMPLEMENTED: Author delete GET');
};

// Handle Author delete on POST.
exports.author_delete_post = function (req, res) {
  res.send('NOT IMPLEMENTED: Author delete POST');
};

// Display Author update form on GET.
exports.author_update_get = function (req, res) {
  res.send('NOT IMPLEMENTED: Author update GET');
};

// Handle Author update on POST.
exports.author_update_post = function (req, res) {
  res.send('NOT IMPLEMENTED: Author update POST');
};

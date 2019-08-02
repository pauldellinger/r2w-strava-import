var express = require('express');
var router = express.Router();

// Require controller modules.
var activity_controller = require('../controllers/activityController');
var author_controller = require('../controllers/authorController');
var genre_controller = require('../controllers/genreController');
var book_instance_controller = require('../controllers/bookinstanceController');

/// BOOK ROUTES ///

// GET catalog home page.
router.get('/', activity_controller.index);

// GET request for creating a Book. NOTE This must come before routes that display Book (uses id).
router.get('/activity/create', activity_controller.activity_create_get);

// POST request for creating Book.
router.post('/activity/create', activity_controller.activity_create_post);

// GET request to delete activity.
router.get('/activity/:id/delete', activity_controller.activity_delete_get);

// POST request to delete activity.
router.post('/activity/:id/delete', activity_controller.activity_delete_post);

// GET request to update Book.
router.get('/activity/:id/update', activity_controller.activity_update_get);

// POST request to update activity.
router.post('/activity/:id/update', activity_controller.activity_update_post);

// GET request for one activity.
router.get('/activity/:id', activity_controller.activity_detail);

// GET request for list of all activity items.
router.get('/activitys', activity_controller.activity_list);

module.exports = router;

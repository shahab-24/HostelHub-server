const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const checkAdmin = require('../middlewares/checkAdmin');
const {getAdminProfile} = require('../controllers/adminController');

const router = express.Router();

router.get('/profile',verifyToken, checkAdmin, getAdminProfile)

module.exports = router;
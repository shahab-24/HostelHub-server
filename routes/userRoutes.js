const express = require('express');
const verifyToken = require('../middlewares/verifyToken');
const {getUserProfile, updateUserProfile, createUser, makeAdmin} = require('../controllers/userController');

const router = express.Router();

router.get('/profile', verifyToken, getUserProfile)
router.put('/profile', verifyToken, updateUserProfile)
router.post('/:email', createUser)
router.patch('/:id', verifyToken, makeAdmin)

module.exports = router;
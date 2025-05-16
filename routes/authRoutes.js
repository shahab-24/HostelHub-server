const express = require('express')
const {generateJwt, refreshJwt} = require('../controllers/authController')
const verifyToken = require('../middlewares/verifyToken')


const router = express.Router()


// router.post('/jwt', generateJwt)

// router.get('/refresh', refreshJwt)
module.exports = router;
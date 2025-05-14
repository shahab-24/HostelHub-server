const express = require('express')
const {generateJwt} = require('../controllers/authController')
const verifyToken = require('../middlewares/verifyToken')


const router = express.Router()


router.post('/jwt', generateJwt)

// router.get('/users', verifyToken, async(req, res) => {
//         res.send({user: req.user})

// })
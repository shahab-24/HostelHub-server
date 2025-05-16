const getUsersCollection = require('../config/db')

const checkAdmin = async(req, res, next) => {

        try {
                const {email} = req.user;
                const user = await getUsersCollection().findOne({email})

                if(!use || user.role !== 'admin'){
                        res.status(403).send({message: 'Access denied. Admins only'})
                }
                next()
        } catch (error) {
                console.error("Error fetching admin role",error)
                res.status(500).send({message: "Internal server error"})
                
        }
}
module.exports = checkAdmin
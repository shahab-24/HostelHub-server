const {getUsersCollection, getMealsCollection} = require('../config/db')


const getAdminProfile = async(req, res, next) => {
        try {
                const {email} = req.use;
                const admin = await getUsersCollection().findOne({email, role: 'admin'})

                if(!admin){
        return res.status(403).send({message: "You are not authorized to view thisj profile"})
                }

                const mealCount = await getMealsCollection().countDocument({
                        distributorEmail: email,
                })
                res.send({
                        name: admin.name,
                        image: admin.image,
                        email: admin.email,
                        mealCount
                })
        } catch (error) {
                console.error("Failed to fetch admin profile:", error);
                res.status(500).send({ message: "Failed to fetch admin profile" });
            }
        ;
                
        
}

module.exports = {getAdminProfile}
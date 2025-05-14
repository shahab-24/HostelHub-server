
const jwt = require("jsonwebtoken");
const { getUsersCollection } = require("../config/db");


const generateJWT = async (req, res) => {
    const { email } = req.body;

    
    if (!email) {
        return res.status(400).send({ message: "Email is required" });
    }

   

    try {
        const usersCollection = getUsersCollection()
        const user = await usersCollection.findOne({email})
        if(!user){
                return res.status(404).send({message: "user not found"})
        }


        const accessToken = jwt.sign(
            { email, role: user?.role },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "1h" }
        );
        
        // refresh token
        const refreshToken = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'})
        
        // store refresh token in db
        await usersCollection.updateOne({email}, {$set: {refreshToken}})

        res.cookie('refreshToken', refreshToken, {
                secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        res.send({accessToken})
    } catch (error) {
        console.error("Error generating JWT:", error);
        res.status(500).send({ message: "Internal server error" });
    }
};

module.exports = { generateJWT };

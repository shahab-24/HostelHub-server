
const jwt = require("jsonwebtoken");
const { getUsersCollection } = require("../config/db");


const generateJwt = async (req, res) => {
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
        // const refreshToken = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'})
        
        // // store refresh token in db
        // await usersCollection.updateOne({email}, {$set: {refreshToken}})

        // res.cookie('refreshToken', refreshToken, {
        //         secure: process.env.NODE_ENV === "production",
        //     sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        //     maxAge: 7 * 24 * 60 * 60 * 1000,
        // })
        res.send({accessToken})
    } catch (error) {
        console.error("Error generating JWT:", error);
        res.status(500).send({ message: "Internal server error" });
    }
};


// const refreshJwt = async(req, res) => {
//         const refreshToken = req.cookies.refreshToken;
//         console.log(refreshToken)

//         if (!refreshToken) {
//                 return res.status(401).send({ message: "No refresh token found" });
//             }

//             try {
//                 const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET )
//                 const usersCollection = getUsersCollection();
//                 const user = await usersCollection.findOne({email: decoded.email})

//                 if (!user || user.refreshToken !== refreshToken) {
//                         return res.status(403).send({ message: "Invalid refresh token" });
//                     }

//                     const accessToken = jwt.sign(
//                         { email: user.email, role: user.role },
//                         process.env.ACCESS_TOKEN_SECRET,
//                         { expiresIn: "1h" }
//                     );
            
//                     res.send({ accessToken });
                
//             } catch (error) {
//                 console.error("Error refreshing JWT:", error);
//                 res.status(403).send({ message: "Invalid refresh token" });
                
//             }
        
// }

module.exports = { generateJwt };

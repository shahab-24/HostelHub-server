require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 7000;
const app = express();

const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(morgan("dev"));

// verifyToken=============================================================
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3jtn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

async function run() {
  try {
    const usersCollection = client.db("HostelHub").collection("users");
    const mealsCollection = client.db("HostelHub").collection("meals");
    const reviewsCollection = client.db("HostelHub").collection("reviews");

    //     user related api===================================
    app.post("/api/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      const isExist = await usersCollection.findOne(query);

      if (isExist) {
        return res.send({ message: "User exists" });
      }
      const result = await usersCollection.insertOne({
        ...user,
        badge: "Bronze",
        role: "user",
      });
      res.send(result);
    });

    // Meals related api=======================================
    app.get("/api/meals", verifyToken, async (req, res) => {
      // const meals = req.body;
      const result = await mealsCollection.find().toArray();
      res.send(result);
    });

    //     get meal details
    app.get("/api/meals/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/meals", verifyToken, async (req, res) => {
      const meals = req.body;
      const result = await mealsCollection.insertOne(meals);
      res.send(result);
    });

    //     increase like==========
//     app.patch("/api/meals/:id/like", verifyToken, async (req, res) => {
//       const id = req.params.id;
// //     
//       const { email } = req.user;
// //  

//       //       const query = { _id: new ObjectId(id) }
//       const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
//       if (!meal) {
//         return res.send({ message: "Meal not found" });
//       }

//       if (meal.likedBy?.includes(email)) {
//         return res.status(400).send({ message: "You already like this" });
//       }

//       const updateMeal = await mealsCollection.findOneAndUpdate(
//         { _id: new ObjectId(id) , likeBy: { $ne : email}},
//         {
//           $inc: { likes: 1 },
//           $push: { likeBy: email },
//         },
//         { returnDocument: "after" }
//       );

//       if (!updateMeal?.value) {
//         return res.status(400).send({ message: "You already liked this meal." });
//       }

//       res.json(updateMeal.value);
//     });

app.patch("/api/meals/:id/like", verifyToken, async (req, res) => {
        try {
          const id = req.params.id;
          const { email } = req.user;
      
          if (!email) {
            return res.status(400).json({ message: "User email is required." });
          }
      
          // Perform the update in a single operation
          const updateMeal = await mealsCollection.findOneAndUpdate(
            { 
              _id: new ObjectId(id), 
              likeBy: { $ne: email } // Ensure the user hasn't already liked this meal
            },
            {
              $inc: { likes: 1 }, // Increment like count
              $push: { likeBy: email }, // Add user to likedBy array
            },
            { returnDocument: "after" } // Return the updated document
          );
      
          // Check if the meal was updated
          if (!updateMeal?.value) {
            return res.status(400).json({ message: "You have already liked this meal or it does not exist." });
          }
      
          // Success response
          res.status(200).json({ message: "Meal liked successfully!", meal: updateMeal.value });
        } catch (error) {
          console.error("Error liking meal:", error);
          res.status(500).json({ message: "An error occurred while liking the meal.", error: error.message });
        }
      });


      

//       reviews
app.post('/api/reviews', verifyToken, async(req,res) => {
        const {mealId, comment, rating} = req.body;
        const {email} = req.user;
        const review = {
                mealId,
                comment,
                 rating,
                 email,
                 createdAt: new Date()
        }
        const result = await reviewsCollection.insertOne(review)
        

        await mealsCollection.updateOne({_id: new ObjectId(mealId)}, {
                $inc: { reviews_count: 1}
        })
        res.send(result)
})

// display reviees=================
app.get("/api/reviews/:mealId", async (req, res) => {
        const { mealId } = req.params;
        const reviews = await reviewsCollection
          .find({ mealId: mealId })
          .sort({ createdAt: -1 })
          .toArray();
        res.json(reviews);
      });


    // Connect the client to the server	(optional starting in v4.7)
    //     await client.connect();
    // Send a ping to confirm a successful connection
    //     await client.db("admin").command({ ping: 1 });
    //     console.log("Pinged your deployment. You successfully connected to MongoDB!");
    app.post("/api/jwt", async (req, res) => {
      console.log("request body", req.body);
      const email = req.body;

      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.get("/api/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (error) {
        res.status(500).send(error);
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("HostelHub is runing....");
});

app.listen(port, () => {
  console.log(`server is running on port : ${port}`);
});

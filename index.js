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


//     get admin profile with added meals count=======
    app.get("/api/admin/profile", verifyToken, async (req, res) => {

        try {
                const { email } = req.user;
      const admin = await usersCollection.findOne({ email, role: "admin" });

      if (!admin) {
        return res
          .status(403)
          .send({ message: "You are not authorized to view this Profile" });
      }

      const mealCount = await mealsCollection.countDocuments({
        distributorEmail: email
      })

      const profile = {
        name: admin.name,
        image: admin.image,
        email: admin.email,
        mealCount
      }

      res.send(profile)
                
        } catch (error) {
                console.log(error)
                res.status(500).send({message: 'failed to fetch admin profile'})
        }
      
    });

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

    // sort filter by title, price rang and category===========
    app.get("/api/meals", async (req, res) => {
      const { search, category, minPrice, maxPrice, page, limit } = req.query;

      // Base query
      const query = {};

      // Search
      if (search) query.title = { $regex: search, $options: "i" };

      // Category filter
      if (category) query.category = category;

      // Price range filter
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Pagination
      const meals = await mealsCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      res.json(meals);
    });

    //     get meal details by id =================
    app.get("/api/meals/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mealsCollection.findOne(query);
      res.send(result);
    });

    //     add meals by admin ===================
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
            likeBy: { $ne: email }, // Ensure the user hasn't already liked this meal
          },
          {
            $inc: { likes: 1 }, // Increment like count
            $push: { likeBy: email }, // Add user to likedBy array
          },
          { returnDocument: "after" } // Return the updated document
        );

        // Check if the meal was updated
        if (!updateMeal?.value) {
          return res
            .status(400)
            .json({
              message: "You have already liked this meal or it does not exist.",
            });
        }

        // Success response
        res
          .status(200)
          .json({
            message: "Meal liked successfully!",
            meal: updateMeal.value,
          });
      } catch (error) {
        console.error("Error liking meal:", error);
        res
          .status(500)
          .json({
            message: "An error occurred while liking the meal.",
            error: error.message,
          });
      }
    });

    //       get reviews====================
    app.get("/api/reviews/:id", async (req, res) => {
      const { id } = req.params;

      const reviews = await reviewsCollection
        .find({ id })
        .sort({ createdAt: -1 }) // Latest reviews first
        .toArray();

      res.send(reviews);
    });

    // make reviews=========================
    app.post("/api/reviews", verifyToken, async (req, res) => {
      const { mealId, comment, rating } = req.body;
      const { email } = req.user;
      const review = {
        mealId,
        comment,
        rating,
        email,
        createdAt: new Date(),
      };
      const result = await reviewsCollection.insertOne(review);

      await mealsCollection.updateOne(
        { _id: new ObjectId(mealId) },
        {
          $inc: { reviews_count: 1 },
        }
      );
      res.send(result);
    });

    // display reviees=================
    app.patch("/api/reviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { comment, rating } = req.body;
      const { email } = req.user;

      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id), email }, // Only allow the owner to edit
        { $set: { comment, rating, updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res
          .status(404)
          .send({
            message: "Review not found or you are not authorized to edit it.",
          });
      }

      res.send({ message: "Review updated successfully." });
    });

    //       get users ==============================
    app.get("/api/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const result = await usersCollection.findOne();
      res.send({ role: result?.role });
    });

    // get upcoming meals and sorted by likes===============
    app.get("/api/upcoming-meals", async (req, res) => {
      try {
        const meals = await mealsCollection
          .find({ status: "upcoming" })
          .sort({ likes: -1 })
          .toArray();
        res.send(meals);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // make food item publish==============================
    app.put("/api/meals/:id/publish", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await mealsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "published" } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // created upcoming-meals============================
    app.post("/api/upcoming-meals", async (req, res) => {
      try {
        const newMeal = {
          title: req.body.title,
          category: req.body.category,
          image: req.body.image,
          description: req.body.description,
          likes: 0,
          status: "upcoming",
          publishDate: new Date(req.body.publishDate),
        };

        const result = await mealsCollection.insertOne(newMeal);
        res.status(201).send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // only premium user can like upcoming meals==============
    app.post("/api/meals/:id/like", async (req, res) => {
      const { userId, userType } = req.body; // Assume user data is passed in request
      const { id } = req.params;

      if (!["Silver", "Gold", "Platinum"].includes(userType)) {
        return res
          .status(403)
          .send({ message: "Only premium users can like meals." });
      }

      try {
        // Check if the user has already liked the meal
        const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
        if (!meal.likesBy) meal.likesBy = [];
        if (meal.likesBy.includes(userId)) {
          return res
            .status(400)
            .send({ message: "You have already liked this meal." });
        }

        // Increment likes and track the user
        const result = await mealsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { likes: 1 },
            $push: { likesBy: userId }, // Track user likes
          }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
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

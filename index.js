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
  credentials: true, // Allow cookies and credentials
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
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
    const requestCollection = client.db("HostelHub").collection("mealRequests");
    const packagesCollection = client
      .db("HostelHub")
      .collection("packages")

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
            distributorEmail: email,
          });

          const profile = {
            name: admin.name,
            image: admin.image,
            email: admin.email,
            mealCount,
          };

          res.send(profile);
        } catch (error) {
          console.log(error);
          res.status(500).send({ message: "failed to fetch admin profile" });
        }
      });

    app.get("/api/user/profile", verifyToken, async (req, res) => {
      try {
        const { email } = req.user;
        const user = await usersCollection.findOne({ email, role: "user" });

        if (!user) {
          return res
            .status(403)
            .send({ message: "You are not authorized to view this Profile" });
        }

        //       const mealCount = await mealsCollection.countDocuments({
        //         distributorEmail: email
        //       })

        const profile = {
          name: user.name,
          image: user.image,
          email: user.email,
          badge: user.badge,
          // mealCount
        };

        res.send(profile);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "failed to fetch user profile" });
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
    //     app.get("/api/meals", verifyToken, async (req, res) => {
    //       // const meals = req.body;
    //       const result = await mealsCollection.find().toArray();
    //       res.send(result);
    //     });
    // app.get("/api/meals", verifyToken, async (req, res) => {
    //         const { search, category, minPrice, maxPrice, page = 1, limit = 10, sortBy = "likes", order = "desc" } = req.query;

    //         const query = {};
    //         if (search) query.title = { $regex: search, $options: "i" }; // Search by title (case-insensitive)
    //         if (category) query.category = category; // Filter by category
    //         if (minPrice || maxPrice) {
    //           query.price = {};
    //           if (minPrice) query.price.$gte = parseFloat(minPrice);
    //           if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    //         }

    //         const sortField = sortBy === "reviews" ? "reviews_count" : "likes";
    //         const sortOrder = order === "asc" ? 1 : -1;

    //         try {
    //           const meals = await mealsCollection
    //             .find(query)
    //             .sort({ [sortField]: sortOrder })
    //             .skip((page - 1) * limit)
    //             .limit(parseInt(limit))
    //             .toArray();

    //           res.send(meals);
    //         } catch (error) {
    //           console.error("Failed to fetch meals:", error);
    //           res.status(500).send({ message: "Failed to fetch meals." });
    //         }
    //       });
    // app.get("/api/meals", async (req, res) => {
    //         const { search, category, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

    //         const query = {};
    //         if (search) query.title = { $regex: search, $options: "i" };
    //         if (category) query.category = category;
    //         if (minPrice || maxPrice) {
    //           query.price = {};
    //           if (minPrice) query.price.$gte = parseFloat(minPrice);
    //           if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    //         }

    //         try {
    //           const meals = await mealsCollection
    //             .find(query)
    //             .skip((page - 1) * limit) // Pagination
    //             .limit(parseInt(limit)) // Limit
    //             .toArray();

    //           res.json(meals);
    //         } catch (error) {
    //           res.status(500).send({ message: "Failed to fetch meals." });
    //         }
    //       });

    // merger get api======
    app.get("/api/meals", verifyToken, async (req, res) => {
      const {
        search,
        category,
        minPrice,
        maxPrice,
        page = 1,
        limit = 10,
        sortBy = "likes",
        order = "desc",
      } = req.query;

      // Query for filtering
      const query = {};
      if (search) query.title = { $regex: search, $options: "i" }; // Search by title
      if (category) query.category = category; // Filter by category
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Sorting logic
      const sortField = sortBy === "reviews" ? "reviews_count" : "likes";
      const sortOrder = order === "asc" ? 1 : -1;

      try {
        // Fetch meals with filters, sorting, and pagination
        const meals = await mealsCollection
          .find(query)
          .sort({ [sortField]: sortOrder }) // Sort by likes or reviews
          .skip((page - 1) * parseInt(limit)) // Skip for pagination
          .limit(parseInt(limit)) // Limit results per page
          .toArray();

        // If no more meals are available, indicate to the frontend
        const hasMore = meals.length === parseInt(limit);

        res.json({ meals, hasMore });
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send({ message: "Failed to fetch meals." });
      }
    });

    //     all meals for admin table==============
    //     app.get("/api/meals", verifyToken, async (req, res) => {
    //       const { sortBy = "likes", order = "dsc"} = req.query;

    //       try {
    //         const sortField = sortBy === 'reviews' ? 'reviews_count' : 'likes';
    //         const sortOrder = order === "asc" ? 1 : -1;

    //         const result = await mealsCollection.find().sort({[sortField]: sortOrder}).toArray();
    //         res.send(result);

    //       } catch (error) {
    //         console.log(error)
    //         res.status(500).send('Failed to fetch sorted Meals')

    //       }

    //     });

    // sort filter by title, price rang and category===========
    //     app.get("/api/meals", async (req, res) => {
    //       const { search, category, minPrice, maxPrice, page, limit } = req.query;

    //       // Base query
    //       const query = {};

    //       // Search
    //       if (search) query.title = { $regex: search, $options: "i" };

    //       // Category filter
    //       if (category) query.category = category;

    //       // Price range filter
    //       if (minPrice || maxPrice) {
    //         query.price = {};
    //         if (minPrice) query.price.$gte = parseFloat(minPrice);
    //         if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    //       }

    //       // Pagination
    //       const meals = await mealsCollection
    //         .find(query)
    //         .skip((page - 1) * limit)
    //         .limit(parseInt(limit));

    //       res.json(meals);
    //     });

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

    //     app.patch("/api/meals/:id/like", verifyToken, async (req, res) => {
    //       try {
    //         const id = req.params.id;
    //         const { email } = req.user;

    //         if (!email) {
    //           return res.status(400).json({ message: "User email is required." });
    //         }

    //         // Perform the update in a single operation
    //         const updateMeal = await mealsCollection.findOneAndUpdate(
    //           {
    //             _id: new ObjectId(id),
    //             likeBy: { $ne: email }, // Ensure the user hasn't already liked this meal
    //           },
    //           {
    //             $inc: { likes: 1 }, // Increment like count
    //             $push: { likeBy: email }, // Add user to likedBy array
    //           },
    //           { returnDocument: "after" } // Return the updated document
    //         );

    //         // Check if the meal was updated
    //         if (!updateMeal?.value) {
    //           return res
    //             .status(400)
    //             .json({
    //               message: "You have already liked this meal or it does not exist.",
    //             });
    //         }

    //         // Success response
    //         res
    //           .status(200)
    //           .json({
    //             message: "Meal liked successfully!",
    //             meal: updateMeal.value,
    //           });
    //       } catch (error) {
    //         console.error("Error liking meal:", error);
    //         res
    //           .status(500)
    //           .json({
    //             message: "An error occurred while liking the meal.",
    //             error: error.message,
    //           });
    //       }
    //     });

    app.patch("/api/meals/:id/like", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const { email } = req.user;

        const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
        if (!meal) return res.status(404).send({ message: "Meal not found." });

        if (meal.likeBy?.includes(email)) {
          return res
            .status(400)
            .send({ message: "You have already liked this meal." });
        }

        const updateMeal = await mealsCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $inc: { likes: 1 },
            $push: { likeBy: email }, // Add email to likeBy array
          },
          { returnDocument: "after" }
        );

        res.send({ message: "Liked successfully!", meal: updateMeal.value });
      } catch (error) {
        console.error("Error liking meal:", error);
        res.status(500).send({ message: "Failed to like meal." });
      }
    });

    //       get reviews====================

    //     app.get('/api/reviews', async (req, res) => {
    //         try {
    //           const page = parseInt(req.query.page) || 1;
    //           const limit = parseInt(req.query.limit) || 10;
    //           const skip = (page - 1) * limit;

    //           // Fetch meals with reviews count, likes, and ratings
    //           const meals = await mealsCollection
    //             .aggregate([
    //               {
    //                 $lookup: {
    //                   from: 'reviews',
    //                   localField: '_id',
    //                   foreignField: 'mealId',
    //                   as: 'reviews',
    //                 },
    //               },
    //               {
    //                 $addFields: {
    //                   reviews_count: { $size: '$reviews' },
    //                   rating: {
    //                     $cond: {
    //                       if: { $gt: [{ $size: '$reviews' }, 0] },
    //                       then: { $avg: '$reviews.rating' },
    //                       else: 0,
    //                     },
    //                   },
    //                 },
    //               },
    //               {
    //                 $project: {
    //                   _id: 1,
    //                   title: 1,
    //                   likes: 1,
    //                   reviews_count: 1,
    //                   rating: { $round: ['$rating', 1] },
    //                 },
    //               },
    //             ])
    //             .skip(skip)
    //             .limit(limit)
    //             .toArray();

    //           // Total count for pagination
    //           const total = await mealsCollection.countDocuments();

    //           res.status(200).json({ reviews: meals, total });
    //         } catch (error) {
    //           console.error('Error fetching meals:', error);
    //           res.status(500).send({ error: 'An error occurred while fetching meals data.' });
    //         }
    //       });

    // Import the ObjectId function from the MongoDB library to work with MongoDB object IDs

    // Define the route to handle GET requests to '/api/reviews'
    app.get("/api/reviews", async (req, res) => {
      try {
        // Fetch all reviews from the reviews collection
        const reviews = await reviewsCollection.find().toArray();

        // Loop through each review and fetch its related meal details
        const enrichedReviews = await Promise.all(
          reviews.map(async (review) => {
            // Find the corresponding meal using the mealId from the review
            const meal = await mealsCollection.findOne({
              _id: new ObjectId(review.mealId),
            });

            // Return a new object that combines the review with additional meal details
            return {
              ...review, // Include all existing review data
              mealTitle: meal ? meal.title : "Unknown Meal", // Add meal title or a default value
              likes: meal ? meal.likes : 0, // Add likes or a default value
              reviews_count: meal ? meal.reviews_count : 0, // Add reviews count or a default value
            };
          })
        );

        // Send the enriched reviews back to the client
        res.status(200).send(enrichedReviews);
      } catch (error) {
        // Handle any errors that occur during the process
        console.error("Error fetching reviews:", error);
        res.status(500).send({ error: "Failed to fetch reviews" });
      }
    });

    app.get("/api/reviews/:id", async (req, res) => {
        const { id } = req.params;  // This is the mealId
      
        try {
          const reviews = await reviewsCollection
            .find({ mealId: id })  // Use mealId to fetch reviews related to the specific meal
            .sort({ createdAt: -1 }) // Sort reviews by createdAt in descending order (latest first)
            .toArray();
          res.send(reviews);
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch reviews." });
        }
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

    // display reviews=================
//     app.patch("/api/reviews/:id", verifyToken, async (req, res) => {
//       const { id } = req.params;
//       const { comment, rating } = req.body;
//       const { email } = req.user;

//       const result = await reviewsCollection.updateOne(
//         { _id: new ObjectId(id), email }, // Only allow the owner to edit
//         { $set: { comment, rating, updatedAt: new Date() } }
//       );

//       if (result.modifiedCount === 0) {
//         return res.status(404).send({
//           message: "Review not found or you are not authorized to edit it.",
//         });
//       }

//       res.send({ message: "Review updated successfully." });
//     });
app.patch("/api/reviews/:id", async (req, res) => {
        const { id } = req.params;  // This is the review ID
        const { comment, rating } = req.body;
      
        try {
          const updatedReview = await reviewsCollection.updateOne(
            { _id: new ObjectId(id) },  // Find the review by its ID
            { $set: { comment, rating, updatedAt: new Date() } }  // Update the review
          );
      
          if (updatedReview.modifiedCount === 0) {
            return res.status(404).send({ message: "Review not found or no changes made." });
          }
      
          res.send({ message: "Review updated successfully." });
        } catch (error) {
          res.status(500).send({ message: "Failed to update review." });
        }
      });
      

    // deleting reviews==================
//     app.delete("/api/reviews/:id", verifyToken, async (req, res) => {
//       const { id } = req.params; // Get the review ID
//       const { email } = req.user; // Get the authenticated user's email

//       try {
//         // Delete the review if it belongs to the user
//         const result = await reviewsCollection.deleteOne({
//           _id: new ObjectId(id),
//           email,
//         });

//         if (result.deletedCount === 0) {
//           return res
//             .status(404)
//             .send({
//               message:
//                 "Review not found or you are not authorized to delete it.",
//             });
//         }

//         res.send({ message: "Review deleted successfully." });
//       } catch (error) {
//         console.error("Error deleting review:", error);
//         res.status(500).send({ message: "Failed to delete review." });
//       }
//     });
app.delete("/api/reviews/:id", async (req, res) => {
        const { id } = req.params;  // This is the review ID
      
        try {
          const deletedReview = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      
          if (deletedReview.deletedCount === 0) {
            return res.status(404).send({ message: "Review not found." });
          }
      
          res.send({ message: "Review deleted successfully." });
        } catch (error) {
          res.status(500).send({ message: "Failed to delete review." });
        }
      });
      

    //       request meals==============
    app.post("/api/meal-requests", verifyToken, async (req, res) => {
      const { mealId, message } = req.body; // Get meal ID and user message from the request body
      const { email } = req.user; // Get the authenticated user's email

      try {
        const request = {
          mealId: new ObjectId(mealId),
          message,
          email,
          createdAt: new Date(),
        };

        // Insert the meal request into a `mealRequests` collection
        const result = await requestCollection.insertOne(request);

        res
          .status(201)
          .send({
            message: "Meal request submitted successfully.",
            requestId: result.insertedId,
          });
      } catch (error) {
        console.error("Error submitting meal request:", error);
        res.status(500).send({ message: "Failed to submit meal request." });
      }
    });

    //       average rating========
    app.get("/api/meals/:id/average-rating", async (req, res) => {
      const { id } = req.params; // Get the meal ID

      try {
        // Use aggregation pipeline to calculate the average rating
        const [result] = await reviewsCollection
          .aggregate([
            { $match: { mealId: new ObjectId(id) } }, // Filter reviews for the meal
            { $group: { _id: "$mealId", averageRating: { $avg: "$rating" } } }, // Calculate average rating
          ])
          .toArray();

        const averageRating = result?.averageRating || 0; // Default to 0 if no reviews

        // Update the meal document with the new averageRating
        await mealsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { averageRating } }
        );

        res.send({ averageRating });
      } catch (error) {
        console.error("Error calculating average rating:", error);
        res
          .status(500)
          .send({ message: "Failed to calculate average rating." });
      }
    });

    //       get users ==============================
    app.get("/api/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const result = await usersCollection.findOne({ email });
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

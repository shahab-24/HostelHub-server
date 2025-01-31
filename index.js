require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 7000;

const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hostelhub-f7524.web.app",
  ],
  credentials: true, // Allow cookies and credentials
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Allowed HTTP methods
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
//   console.log(token, "token verify")

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

// Middleware to verify user subscription
const verifySubscription = (req, res, next) => {
  if (
    req.user.package !== "Silver" &&
    req.user.package !== "Gold" &&
    req.user.package !== "Platinum"
  ) {
    return res.status(403).json({ message: "Subscription required" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3jtn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("HostelHub").collection("users");
    const mealsCollection = client.db("HostelHub").collection("meals");
    const reviewsCollection = client.db("HostelHub").collection("reviews");

    const packagesCollection = client.db("HostelHub").collection("packages");
    const requestedMealCollection = client
      .db("HostelHub")
      .collection("requestedMeal");

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

    // get all users and search users
    app.get("/users", verifyToken, async (req, res) => {
      const { search } = req.query;
      const query = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {};
      try {
        //
        const users = await usersCollection.find(query).toArray(); // Ensure the data is an array

        if (users.length === 0) {
          return res.status(404).send({ message: "No users found" });
        }

        res.send(users);
        console.log(users); // Send the data as a JSON array
      } catch (err) {
        console.error("Error fetching users:", err); // Log the error on the server
        res.status(500).send({ message: "Error fetching users" }); // Ensure a JSON response
      }
    });

    // Update user role to 'admin'
    app.patch("/api/users/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { role: "admin" } };
      try {
        const user = await usersCollection.updateOne(query, update);
        if (user.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        const updateUser = await usersCollection.findOne(query);
        res.send(updateUser); // Send the updated user as a JSON response
      } catch (err) {
        console.error("Error updating user role:", err); // Log the error on the server
        res.status(500).send({ message: "Error updating user role" });
      }
    });

    //

    // Get meal by ID
    app.get("/api/meals/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }
      const query = { _id: new ObjectId(id) };

      try {
        const meal = await mealsCollection.findOne(query);
        if (!meal) {
          return res.status(404).send({ message: "Meal not found" });
        }
        res.send(meal);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    // merger get api======
    app.get("/api/meals", async (req, res) => {
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

        res.send({ meals, hasMore });
      } catch (error) {
        console.error("Error fetching meals:", error);
        res.status(500).send({ message: "Failed to fetch meals." });
      }
    });

    //     get meal details by id =================

    app.get("/api/meals/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // Check if the ID is valid before converting to ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid meal ID" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await mealsCollection.findOne(query);

        if (!result) {
          return res.status(404).json({ error: "Meal not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    //     add meals by admin ===================
    app.post("/api/meals", verifyToken, async (req, res) => {
      const meals = req.body;
      const result = await mealsCollection.insertOne(meals);
      res.send(result);
    });

    // Update meal by ID

    app.put("/api/meals/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const {
        title,
        description,
        price,
        ingredients,
        category,
        image,
        distributorName,
        distributorEmail,
        rating,
        reviews_count,
        likes,
      } = req.body;

      try {
        const result = await mealsCollection.updateOne(
          { _id: new ObjectId(id) }, // Convert id to ObjectId
          {
            $set: {
              // Fields to update
              title,
              description,
              price,
              ingredients,
              category,
              image,
              distributorName,
              distributorEmail,
              rating,
              reviews_count,
              likes,
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Meal not found" });
        }

        res.send({ message: "Meal updated successfully" });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.delete("/api/meals/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const result = await mealsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Meal not found" });
        }

        res.status(204).send(); // No content, meal deleted successfully
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

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

    //     meal id related reviews get==============
    app.get("/api/reviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params; // This is the mealId

      try {
        const reviews = await reviewsCollection
          .find({ mealId: id }) // Use mealId to fetch reviews related to the specific meal
          .sort({ createdAt: -1 }) // Sort reviews by createdAt in descending order (latest first)
          .toArray();
        res.send(reviews);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch reviews." });
      }
    });

    //     get userid related reviews meams loggedin user reviews =====
    // Route to get logged-in user's reviews with meal details
    app.get("/user-reviews", async (req, res) => {
      const userEmail = req.query.email;

      try {
        // Fetch reviews made by the logged-in user
        const userReviews = await reviewsCollection
          .find({ email: userEmail })
          .toArray();

        // Fetch the meal details for each review
        const mealIds = userReviews.map(
          (review) => new ObjectId(review.mealId)
        );
        const meals = await mealsCollection
          .find({ _id: { $in: mealIds } })
          .toArray();

        // Map reviews with their corresponding meal details
        const reviewsWithMeals = userReviews.map((review) => {
          const meal = meals.find((m) => m._id.toString() === review.mealId);
          return {
            ...review,
            mealTitle: meal?.title || "Unknown Meal",
            likes: meal?.likes || 0,
            reviewsCount: meal?.reviews_count || 0,
          };
        });

        res.send(reviewsWithMeals);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch reviews" });
      }
    });

    //     edit review by logged in user===
    app.put("/edit-review/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const { comment, rating } = req.body;
      try {
        const result = await reviewsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { comment, rating } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to edit review" });
      }
    });

    //     delete review====
    app.delete("/delete-review/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await reviewsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to delete review" });
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

    app.patch("/api/reviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params; // This is the review ID
      const { comment, rating } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid review ID." }); // Check if ID is valid
      }

      try {
        const updatedReview = await reviewsCollection.updateOne(
          { _id: new ObjectId(id) }, // Ensure _id is a valid ObjectId
          { $set: { comment, rating, updatedAt: new Date() } } // Update the review fields
        );

        if (updatedReview.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Review not found or no changes made." });
        }

        res.send({ message: "Review updated successfully." });
      } catch (error) {
        console.error("Error updating review:", error); // Log the error on server side
        res.status(500).send({ message: "Failed to update review." });
      }
    });

    // deleting reviews==================

    app.delete("/api/reviews/:id", verifyToken, async (req, res) => {
      const { id } = req.params; // This is the review ID

      try {
        const deletedReview = await reviewsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (deletedReview.deletedCount === 0) {
          return res.status(404).send({ message: "Review not found." });
        }

        res.send({ message: "Review deleted successfully." });
      } catch (error) {
        res.status(500).send({ message: "Failed to delete review." });
      }
    });

    //       get packages===================

    // Fetch all packages from the database
    app.get("/api/packages", async (req, res) => {
      try {
        const packages = await packagesCollection.find().toArray(); // Fetch all packages
        res.send(packages); // Send as JSON response
      } catch (error) {
        console.error("Error fetching packages:", error.message);
        res.status(500).send({ message: "Failed to fetch packages." });
      }
    });

    //       get pakcage by pckage name====
    app.get("/packages/:name", async (req, res) => {
      let { name } = req.params;

      try {
        // Convert the name to lowercase
        name = name.toLowerCase();

        // Use a case-insensitive regex query
        const pkg = await packagesCollection.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
        });

        if (!pkg) {
          return res.status(404).send({ message: "Package not found." });
        }

        res.send(pkg);
      } catch (error) {
        console.error("Error fetching package:", error.message);
        res.status(500).send({ message: "Failed to fetch package details." });
      }
    });

    //       request meals==============

    app.post("/api/request-meals/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { email } = req.body; // Get meal ID and user email

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid meal ID format." });
        }

        // Find user by email
        const requestUser = await usersCollection.findOne({ email });

        if (!requestUser) {
          return res.status(404).send({ error: "User not found." });
        }

        // Find meal by ID
        const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });

        if (!meal) {
          return res.status(404).send({ message: "Meal not found." });
        }

        // Create a new request object
        const request = {
          mealId: new ObjectId(meal._id), // Store meal ID separately
          title: meal.title,
          category: meal.category,
          image: meal.image,
          description: meal.description,
          likes: meal.likes,
          reviews_count: meal.reviews_count,
          status: "pending", // Request status
          requestDate: new Date(), // Timestamp for the request
          userId: requestUser._id, // Use the user's _id from database
          email: requestUser.email, // Ensure email is included
        };

        // Insert the meal request into the `requestedMealCollection`
        const result = await requestedMealCollection.insertOne(request);
        res
          .status(201)
          .send({ message: "Meal request submitted successfully.", result });
      } catch (error) {
        console.error("Error submitting meal request:", error);
        res.status(500).send({ message: "Failed to submit meal request." });
      }
    });
    app.get("/api/requested-meals/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).send({ error: "User not found." });
        }

        const requestedMeals = await requestedMealCollection
          .find({ userId: user._id })
          .toArray();

        res.status(200).send(requestedMeals);
      } catch (error) {
        console.error("Error fetching requested meals:", error);
        res.status(500).send({ message: "Failed to fetch requested meals." });
      }
    });

    app.delete("/api/meals/requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedMealCollection.deleteOne(query);
      res.send(result);
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
    app.get("/api/upcoming-meals", verifyToken, async (req, res) => {
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
    app.put("/api/meals/:id/publish", verifyToken, async (req, res) => {
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
    app.post("/api/upcoming-meals", verifyToken, async (req, res) => {
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

    //     serve meals=======================
    app.get("/api/requested-meals", verifyToken, async (req, res) => {
      try {
        const { search } = req.query; // Get search query (email or username)

        // Construct the search query to filter meals based on email or username
        const filter = search
          ? {
              $or: [
                { email: { $regex: search, $options: "i" } },
                { "userId.name": { $regex: search, $options: "i" } }, // Assuming the user name is in the userId object
              ],
            }
          : {};

        // Fetch meals with optional filter
        const requestedMeals = await requestedMealCollection
          .find(filter)
          .toArray();

        res.status(200).send(requestedMeals);
      } catch (error) {
        console.error("Error fetching requested meals:", error);
        res.status(500).send({ message: "Failed to fetch requested meals." });
      }
    });

    //       serve meal status update==============
    app.patch("/api/meals/requests/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate ObjectId format
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid meal ID format." });
        }

        // Find the meal by ID and update its status to 'delivered'
        const result = await requestedMealCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "delivered" } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "Meal not found or already delivered." });
        }

        res.status(200).send({ message: "Meal status updated to delivered." });
      } catch (error) {
        console.error("Error updating meal status:", error);
        res.status(500).send({ message: "Failed to update meal status." });
      }
    });

    // only premium user can like upcoming meals==============
    app.post("/api/meals/:id/like", verifyToken, async (req, res) => {
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

    //     banner search==============
    app.get("/search", async (req, res) => {
      const query = req.query.query;
      try {
        const meals = mealsCollection.find({
          $or: [
            { title: new RegExp(query, "i") },
            { description: new RegExp(query, "i") },
            { category: new RegExp(query, "i") },
          ],
        });
        res.send(meals);
      } catch (err) {
        res.status(500).send("Error fetching meals");
      }
    });

    app.post("/api/jwt", async (req, res) => {
      console.log("request body", req.body);
      const {email} = req.body;

//       if (!email) {
//         return res.status(400).send({ message: "Email is required" });
//       }

      const token = jwt.sign({email}, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

//       console.log("Generated JWT:", token);

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

    //     stripe intent============
    //     app.post("/api/payment-intent", async (req, res) => {
    //       const { amount } = req.body;
    //       try {
    //         const paymentIntent = await stripe.paymentIntents.create({
    //           amount, // Amount in cents
    //           currency: "usd",
    //           payment_method_types: ["card"],
    //         });
    //         res.send({ clientSecret: paymentIntent.client_secret });
    //       } catch (error) {
    //         console.error("Error creating payment intent:", error.message);
    //         res.status(500).send({ message: "Failed to create payment intent." });
    //       }
    //     });

    //     //       save payment details====
    //     app.post("/api/save-payment", async (req, res) => {
    //       const { packageName, price, transactionId } = req.body;
    //       try {
    //         await paymentsCollection.insertOne({
    //           packageName,
    //           price,
    //           transactionId,
    //           timestamp: new Date(),
    //         });
    //         // Update user's package (assign badge, etc.)
    //         await usersCollection.updateOne(
    //           { email: req.user.email }, // Replace with actual user identification
    //           { $set: { packageName, badge: packageName.toUpperCase() } }
    //         );
    //         res.send({ message: "Payment saved successfully." });
    //       } catch (error) {
    //         console.error("Error saving payment:", error.message);
    //         res.status(500).send({ message: "Failed to save payment details." });
    //       }
    //     });
  } finally {

  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("HostelHub is runing....");
});

app.listen(port, () => {
  console.log(`server is running on port : ${port}`);
});

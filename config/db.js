
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3jtn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");
        db = client.db("HostelHub");
    } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1); // Exit the server if the database connection fails
    }
}

// Export the collections for reuse
module.exports = {
    connectDB,
    getDB: () => db,
    getUsersCollection: () => db.collection("users"),
    getMealsCollection: () => db.collection("meals"),
    getReviewsCollection: () => db.collection("reviews"),
    getPackagesCollection: () => db.collection("packages"),
    getRequestedMealCollection: () => db.collection("requestedMeal"),
    getPaymentsCollection: () => db.collection("payments"),
};

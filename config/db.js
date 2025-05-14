require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const port = process.env.PORT || 7000;

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
                await client.connect()
                console.log('db connected to MongoDB')
                db = client.db('HostelHub')
        } catch (error) {
                console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
                
        }
        
}

module.exports = {
        connectDB,
        client,
        getDB: () => db,
        getUsersCollection: () => db.collection("users"),
        getMealsCollection: () => db.collection("meals"),
        getReviewsCollection: () => db.collection("reviews"),
        getPackagesCollection: () => db.collection("packages"),
        getRequestedMealCollection: () => db.collection("requestedMeal"),
        getPaymentsCollection: () => db.collection("payments"),

}

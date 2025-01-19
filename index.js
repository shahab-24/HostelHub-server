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
    app.get('/api/meals/:id', verifyToken, async(req,res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await mealsCollection.findOne(query)
        res.send(result)
    })
    
    app.post("/api/meals", verifyToken, async (req, res) => {
      const meals = req.body;
      const result = await mealsCollection.insertOne(meals);
      res.send(result);
    });
    // Connect the client to the server	(optional starting in v4.7)
    //     await client.connect();
    // Send a ping to confirm a successful connection
    //     await client.db("admin").command({ ping: 1 });
    //     console.log("Pinged your deployment. You successfully connected to MongoDB!");
    app.post("/jwt", async (req, res) => {
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

    app.get("/logout", async (req, res) => {
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

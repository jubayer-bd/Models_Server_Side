const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config(); // ✅ load .env variables

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// firebase sdk
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware

const middleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decoded = decodedUser;
    next();
  } catch (error) {
    res.status(403).send({ message: "Forbidden access" });
  }
};

app.get("/", (req, res) => {
  res.send("Be Ready to Code");
});

// ✅ Use environment variables for MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db(process.env.DB_NAME);
    const modelCollection = db.collection("models");
    const downloadsCollection = db.collection("downloads");

    // get all models
    app.get("/models", async (req, res) => {
      const result = await modelCollection.find().toArray();
      res.send(result);
    });

    // get single model by ID
    app.get("/models/:id", middleware, async (req, res) => {
      const { id } = req.params;
      const result = await modelCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // get latest models
    app.get("/latest-models", async (req, res) => {
      const result = await modelCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // insert model
    app.post("/models", async (req, res) => {
      const data = req.body;
      const result = await modelCollection.insertOne(data);
      res.send(result);
    });

    // update model
    app.put("/models/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: data };
      const result = await modelCollection.updateOne(filter, update);
      res.send(result);
    });

    // delete model
    app.delete("/models/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await modelCollection.deleteOne(filter);
      res.send(result);
    });

    // my models making api
    app.get("/my-models", middleware, async (req, res) => {
      const email = req.query.email;
      const result = await modelCollection
        .find({ created_by: email })
        .toArray();
      res.send(result);
    });

    // download api
    app.post("/downloads/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const result = await downloadsCollection.insertOne(data);
      const filter = { _id: new ObjectId(id) };
      const update = {
        $inc: {
          downloads: 1,
        },
      };
      const downloadCounted = await modelCollection.updateOne(filter, update);
      res.send({ result, downloadCounted });
    });

    app.get("/my-downloads", async (req, res) => {
      const email = req.query.email;
      const result = await downloadsCollection
        .find({ downloaded_by: email })
        .toArray();
      res.send(result);
    });

    // search
    app.get("/search", async (req, res) => {
      const search_Text = req.query.name; // match the frontend query param

      if (!search_Text) {
        return res.status(400).send({ message: "Search query is required" });
      }

      const query = { name: { $regex: search_Text, $options: "i" } }; // partial, case-insensitive
      const result = await modelCollection.find(query).toArray();
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB successfully!");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

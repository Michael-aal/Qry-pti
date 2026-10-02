const { MongoClient } = require("mongodb");

let client;
let users;
const memoryUsers = new Map();

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set; using in-memory development storage.");
    return null;
  }
  client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "qrypti");
  users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  return db;
}

function usersStore() {
  return users || {
    async findOne(query) {
      if (query.email) return memoryUsers.get(query.email.toLowerCase()) || null;
      return null;
    },
    async insertOne(doc) {
      const email = doc.email.toLowerCase();
      if (memoryUsers.has(email)) {
        const error = new Error("duplicate");
        error.code = 11000;
        throw error;
      }
      memoryUsers.set(email, doc);
      return { insertedId: doc._id };
    },
  };
}

async function closeDB() {
  if (client) await client.close();
}

module.exports = { connectDB, usersStore, closeDB };

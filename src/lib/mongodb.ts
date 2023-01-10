import mongoose from "mongoose";

const mongoClient = mongoose.createConnection(
  process.env.DATABASE_URL as string
);

export default mongoClient;

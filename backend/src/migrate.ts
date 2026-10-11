import "dotenv/config";
import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}
import mongoose from "mongoose";
import {
  UserSchema,
  QuestSchema,
  ProgressSchema,
  ObservationSchema,
} from "./schemas";

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI is not defined in environment.");
    process.exit(1);
  }

  console.log("Connecting to database:", uri.replace(/:([^:@]+)@/, ":****@"));
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected successfully to database:", conn.connection.name);

  // Initialize models to ensure schemas and indexes are defined
  const UserModel = conn.model("User", UserSchema);
  const QuestModel = conn.model("Quest", QuestSchema);
  const ProgressModel = conn.model("Progress", ProgressSchema);
  const ObservationModel = conn.model("Observation", ObservationSchema);

  console.log("Ensuring and synchronizing indexes...");
  await Promise.all([
    UserModel.syncIndexes(),
    QuestModel.syncIndexes(),
    ProgressModel.syncIndexes(),
    ObservationModel.syncIndexes(),
  ]);

  const collections = await conn.connection.db!.listCollections().toArray();
  console.log(
    "Existing collections in database:",
    collections.map((c) => c.name),
  );

  for (const model of [
    UserModel,
    QuestModel,
    ProgressModel,
    ObservationModel,
  ]) {
    const indexes = await model.collection.indexes();
    console.log(
      `Indexes on ${model.modelName} (${model.collection.collectionName}):`,
    );
    for (const idx of indexes) {
      console.log(
        `  - ${idx.name}:`,
        JSON.stringify(idx.key),
        idx.unique ? "(unique)" : "",
      );
    }
  }

  console.log("Migration and index synchronization completed successfully!");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

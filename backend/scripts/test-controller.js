import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import { getDeliveryCashBalances } from "../app/controller/adminController.js";

dotenv.config();

async function run() {
  await connectDB();
  const req = { query: { page: 1, limit: 25 } };
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log("Response Status:", code);
        console.log(JSON.stringify(data, null, 2));
      }
    })
  };

  await getDeliveryCashBalances(req, res);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import dotenv from "dotenv";
import connectDB from "../app/dbConfig/dbConfig.js";
import { getDeliveryEarnings } from "../app/controller/deliveryController.js";

dotenv.config();

async function run() {
  await connectDB();
  const req = {
    user: { id: "69f457a748d7368ffdbc576f" }
  };
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log("Response Status:", code);
        console.log(JSON.stringify(data, null, 2));
      }
    })
  };

  await getDeliveryEarnings(req, res);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

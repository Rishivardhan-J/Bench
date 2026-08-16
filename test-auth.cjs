const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require("firebase/auth");

const app = initializeApp({
  apiKey: "demo-api-key",
  projectId: "demo-project"
});

const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099");

async function run() {
  try {
    const res = await createUserWithEmailAndPassword(auth, "test" + Date.now() + "@test.com", "password123");
    console.log("Success!", res.user.uid);
  } catch (err) {
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);
  }
}

run();

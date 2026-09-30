// Plesk's Node.js extension (Passenger) loads the startup file with
// require(); Hack Nexus is an ES module, so this CommonJS file starts it.
// In Plesk set "Application startup file" to server/passenger.cjs.
import("./index.js").catch((error) => {
  console.error("Hack Nexus failed to start:", error);
  process.exit(1);
});

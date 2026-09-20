const fs = require('fs');
const postmanPath = 'e:/baracuda/My12Photos_Postman_Collection.json';
let collection = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));

// Find Auth folder
const authFolder = collection.item.find(i => i.name === 'Auth');
if (authFolder) {
  const loginRequest = authFolder.item.find(i => i.name === 'Login');
  if (loginRequest && loginRequest.request && loginRequest.request.body) {
    loginRequest.request.body.raw = "{\n  \"email\": \"shanjid.maktech@gmail.com\",\n  \"password\": \"password123\"\n  \n  // ADMIN CREDENTIALS:\n  // \"email\": \"admin@my12photos.com\",\n  // \"password\": \"admin123\"\n}";
    fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2));
    console.log('Login body updated with admin credentials comment.');
  }
}

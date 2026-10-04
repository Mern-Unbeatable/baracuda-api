const fs = require('fs');
const file = 'My12Photos_Postman_Collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const userFolder = data.item.find(i => i.name === 'User');
if (userFolder) {
  const profileFolder = userFolder.item.find(i => i.name === 'Profile');
  if (profileFolder) {
    const originalLength = profileFolder.item.length;
    
    // Filter out the items to remove
    const itemsToRemove = ['Get Settings Profile', 'Update Settings Profile', 'Change Password'];
    profileFolder.item = profileFolder.item.filter(i => !itemsToRemove.includes(i.name));
    
    if (profileFolder.item.length < originalLength) {
      console.log(`Removed ${originalLength - profileFolder.item.length} items from Profile folder.`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } else {
      console.log('No matching items found to remove in Profile folder.');
    }
  } else {
    console.log('Profile folder not found.');
  }
} else {
  console.log('User folder not found.');
}

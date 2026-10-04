const fs = require('fs');
const file = 'My12Photos_Postman_Collection.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const settingsFolder = {
  name: 'Settings',
  item: [
    {
      name: 'Get Settings / My Profile',
      request: {
        method: 'GET',
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
        url: { raw: '{{baseUrl}}/api/v1/users/profile/me', host: ['{{baseUrl}}'], path: ['api', 'v1', 'users', 'profile', 'me'] }
      }
    },
    {
      name: 'Update Settings / Profile',
      request: {
        method: 'PUT',
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
        url: { raw: '{{baseUrl}}/api/v1/users/profile', host: ['{{baseUrl}}'], path: ['api', 'v1', 'users', 'profile'] },
        body: { 
          mode: 'formdata', 
          formdata: [ 
            { key: 'name', value: 'John Doe', type: 'text' }, 
            { key: 'username', value: 'johndoe', type: 'text' }, 
            { key: 'email', value: 'john@example.com', type: 'text' }, 
            { key: 'phone', value: '0123456789', type: 'text' }, 
            { key: 'bio', value: 'Hello world', type: 'text' }, 
            { key: 'city', value: 'New York', type: 'text' }, 
            { key: 'country', value: 'USA', type: 'text' }, 
            { key: 'socialLinks', value: '{"website":"https://john.com","facebook":"fb.com/john"}', type: 'text' }, 
            { key: 'avatar', type: 'file', src: '' },
            { key: 'coverPhoto', type: 'file', src: '' },
            { key: 'introVideo', type: 'file', src: '' }
          ] 
        }
      }
    },
    {
      name: 'Change Password',
      request: {
        method: 'POST',
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
        url: { raw: '{{baseUrl}}/api/v1/auth/change-password', host: ['{{baseUrl}}'], path: ['api', 'v1', 'auth', 'change-password'] },
        body: { 
          mode: 'raw', 
          raw: '{\n  "currentPassword": "old_password",\n  "newPassword": "new_password"\n}', 
          options: { raw: { language: 'json' } } 
        }
      }
    }
  ]
};

// Locate the "User" folder
const userFolder = data.item.find(i => i.name === 'User');

if (userFolder) {
  // Check if Settings folder already exists
  const existingIndex = userFolder.item.findIndex(i => i.name === 'Settings');
  if (existingIndex !== -1) {
    userFolder.item[existingIndex] = settingsFolder;
    console.log('Settings folder updated!');
  } else {
    userFolder.item.push(settingsFolder);
    console.log('Settings folder added!');
  }
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
} else {
  console.log('Could not find User folder in the collection');
}

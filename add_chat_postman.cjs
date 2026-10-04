const fs = require('fs'); 
const file = 'My12Photos_Postman_Collection.json'; 
const data = JSON.parse(fs.readFileSync(file, 'utf8')); 

const chatFolder = { 
  name: 'Chat', 
  item: [ 
    { 
      name: 'Get or Create Room', 
      request: { 
        method: 'POST', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/room', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', 'room'] }, 
        body: { mode: 'raw', raw: '{\n  "targetUserId": "REPLACE_WITH_USER_ID"\n}', options: { raw: { language: 'json' } } } 
      } 
    }, 
    { 
      name: 'Get Chat List', 
      request: { 
        method: 'GET', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/list?search=', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', 'list'], query: [{key: 'search', value: ''}] } 
      } 
    }, 
    { 
      name: 'Get Room Messages', 
      request: { 
        method: 'GET', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/{{roomId}}/messages?page=1&limit=50', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', '{{roomId}}', 'messages'], query: [{key: 'page', value: '1'}, {key: 'limit', value: '50'}] } 
      } 
    }, 
    { 
      name: 'Send Message', 
      request: { 
        method: 'POST', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/{{roomId}}/messages', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', '{{roomId}}', 'messages'] }, 
        body: { mode: 'formdata', formdata: [ { key: 'content', value: 'Hello!', type: 'text' }, { key: 'file', type: 'file', src: '' } ] } 
      } 
    }, 
    { 
      name: 'Edit Message', 
      request: { 
        method: 'PUT', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/messages/{{messageId}}', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', 'messages', '{{messageId}}'] }, 
        body: { mode: 'raw', raw: '{\n  "content": "Updated message"\n}', options: { raw: { language: 'json' } } } 
      } 
    }, 
    { 
      name: 'Delete Message', 
      request: { 
        method: 'DELETE', 
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] }, 
        url: { raw: '{{baseUrl}}/api/v1/chat/messages/{{messageId}}', host: ['{{baseUrl}}'], path: ['api', 'v1', 'chat', 'messages', '{{messageId}}'] } 
      } 
    } 
  ] 
}; 

// Check if Chat folder already exists
const existingChatIndex = data.item.findIndex(i => i.name === 'Chat');
if (existingChatIndex >= 0) {
    data.item[existingChatIndex] = chatFolder;
} else {
    data.item.push(chatFolder);
}

fs.writeFileSync(file, JSON.stringify(data, null, 4)); 
console.log('Successfully added Chat APIs to Postman');

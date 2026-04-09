const fs = require('fs');
const fetch = require('node-fetch'); // we can just use native node fetch if node > 18
async function test() {
  const FormData = require('form-data');
  const form = new FormData();
  // Find a valid image in uploads to use
  const files = fs.readdirSync('./backend/uploads');
  if(files.length === 0) return console.log('no files');
  form.append('image', fs.createReadStream('./backend/uploads/' + files[0]));
  
  const res = await (await import('node-fetch')).default('http://localhost:4000/api/identify', {
    method: 'POST',
    body: form
  });
  console.log(await res.json());
}
test();

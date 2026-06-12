import { run } from './app.js';

run().then((lines) => {
  for (const line of lines) console.log(line);
});
